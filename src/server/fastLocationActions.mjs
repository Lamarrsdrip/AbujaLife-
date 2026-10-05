import { GameError } from './errors.mjs';

const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

function fail(condition, message, status = 400, code = 'invalid_action') {
  if (!condition) throw new GameError(message, status, code);
}

// Old AbujaLife interiors predate resident-owned furniture. Those rooms drew several
// removable pieces directly into the scene, so a resident could see a sofa or bed but
// the server correctly refused to sell it because no inventory row existed. Migrate
// each legacy home once: grant only the authored removable pieces for that floor plan,
// then move the home onto the owned-furniture renderer. Plumbing, walls, doors and
// permanent fixtures are deliberately not inventory.
const LEGACY_HOME_FURNITURE = Object.freeze({
  'garki-studio': Object.freeze(['bed','wardrobe','kitchen-unit','fridge','sofa','coffee-table','plant','floor-lamp']),
  'lugbe-flat': Object.freeze(['bed','wardrobe','kitchen-unit','fridge','sofa','dining-table','plant']),
  'gwarinpa-apartment': Object.freeze(['bed','wardrobe','work-desk','office-chair','sofa','kitchen-unit','fridge','dining-table','plant']),
  'jabi-apartment': Object.freeze(['bed','wardrobe','lounge-chair','sofa','kitchen-unit','fridge','dining-table','plant']),
  'guzape-terrace': Object.freeze(['bed','wardrobe','work-desk','office-chair','sofa','kitchen-unit','fridge','coffee-table','plant']),
  'maitama-villa': Object.freeze(['bed','wardrobe','work-desk','accent-chair','library-shelf','sofa','kitchen-unit','fridge','dining-table','plant']),
});

async function migrateLegacyHomeFurniture(store, residentId, profile, options = {}) {
  if (!profile?.home || Number(profile.home.starterVersion || 0) >= 1) return profile;
  const layoutId = profile.home.layoutId || profile.home.propertyId;
  const defaults = LEGACY_HOME_FURNITURE[layoutId];
  if (!defaults?.length) return profile;

  const session = options?.session || null;
  const dbOptions = session ? { session } : {};
  const acquiredAt = store.clock();
  const inventory = store.collection('inventory');

  // Inventory rows are written before the migration marker. A process interruption
  // can therefore only cause a safe retry; it cannot mark a partially migrated home.
  for (const itemId of defaults) {
    await inventory.updateOne(
      { residentId, itemId },
      {
        $setOnInsert: {
          _id: `${residentId}:${itemId}`,
          residentId,
          itemId,
          category: 'furniture',
          acquiredAt,
          source: 'legacy-home-furniture',
        },
      },
      { ...dbOptions, upsert: true },
    );
  }

  const furnishingPreset = 'nepo-furnished';
  await store.collection('homes').updateOne(
    { residentId },
    { $set: { starterVersion: 1, furnishingPreset } },
    dbOptions,
  );

  profile.inventory = [...new Set([...(profile.inventory || []), ...defaults])];
  profile.home = { ...profile.home, starterVersion: 1, furnishingPreset };
  profile.legacyHomeFurnitureMigrated = true;
  return profile;
}

/**
 * Installs bounded, hot-path location transitions on an existing MongoGameStore.
 *
 * `leave-home` used to flow through the generic economy/action transaction. That
 * path reconstructs the complete resident, writes several unrelated normalized
 * documents and records an economy operation even though leaving a house changes
 * only player_state (plus the normal needs clock). Under load this made a simple
 * navigation tap compete with wallet, inventory, loan and social reads.
 *
 * Keep the public store.action contract so production-http retains its existing
 * authorization, social reconciliation, old/new-zone detection and realtime
 * presence broadcast. Only the internal mutation is specialized.
 */
export function installFastLocationActions(store) {
  fail(store && typeof store.action === 'function' && typeof store.transaction === 'function' && typeof store.collection === 'function' && typeof store.profile === 'function', 'Fast location actions require the Mongo game store', 500, 'storage_unavailable');
  if (store.fastLocationActionsInstalled === true) return store;

  const originalProfile = store.profile.bind(store);
  store.profile = async (residentId, options = {}) => {
    const profile = await originalProfile(residentId, options);
    return migrateLegacyHomeFurniture(store, residentId, profile, options);
  };

  const originalAction = store.action.bind(store);

  store.action = async (residentId, action, payload = {}) => {
    if (action !== 'leave-home') return originalAction(residentId, action, payload);

    const timestamp = store.clock();
    let replayed = false;

    await store.transaction(async session => {
      const playerState = await store.collection('player_state').findOne(
        { residentId },
        { session, projection: { district: 1, location: 1, activeTrip: 1, drivingVehicle: 1 } },
      );
      fail(playerState, 'Resident persistence is incomplete', 503, 'storage_incomplete');
      fail(!playerState.activeTrip, 'Your journey is still in progress', 409, 'trip_in_progress');

      // A retry after the server committed but the mobile response was lost is a
      // successful replay, not an error. This makes the transition naturally
      // idempotent without putting a navigation-only action in the economy log.
      if (playerState.location?.kind === 'public' && playerState.location?.venue === 'neighbourhood') {
        replayed = true;
        return;
      }

      fail(playerState.location?.kind === 'home', 'Go home to use this object');

      const needs = await store.collection('needs').findOne(
        { residentId },
        { session, projection: { energy: 1, hunger: 1, social: 1, lastActionAt: 1 } },
      );
      fail(needs, 'Resident persistence is incomplete', 503, 'storage_incomplete');

      // Preserve the generic action path's needs decay + activity clock exactly,
      // but update only the fields that can actually change for leave-home.
      const minutes = Math.min(120, Math.max(0, (timestamp - Number(needs.lastActionAt || timestamp)) / 60000));
      const needsUpdate = { lastActionAt: timestamp };
      if (minutes > 1) {
        needsUpdate.energy = clamp(Number(needs.energy || 0) - minutes * 0.10);
        needsUpdate.hunger = clamp(Number(needs.hunger || 0) - minutes * 0.12);
        needsUpdate.social = clamp(Number(needs.social || 0) - minutes * 0.05);
      }

      const changed = await store.collection('player_state').updateOne(
        {
          _id: playerState._id,
          residentId,
          'location.kind': 'home',
          activeTrip: playerState.activeTrip ?? null,
        },
        {
          $set: {
            drivingVehicle: null,
            location: { kind: 'public', district: playerState.district, venue: 'neighbourhood' },
          },
        },
        { session },
      );
      fail(changed.modifiedCount === 1, 'Your location changed; try again', 409, 'location_changed');

      await store.collection('needs').updateOne(
        { _id: needs._id, residentId },
        { $set: needsUpdate },
        { session },
      );
    });

    // Return the same authoritative profile shape expected by the existing UI.
    // This read happens outside the transaction so normalized profile collections
    // can use the store's parallel read path instead of serial transaction reads.
    const profile = await store.profile(residentId);
    if (!replayed) await store.emitUser(residentId, 'profile', { profile });
    return { ok: true, profile, replayed, fastLocation: true };
  };

  Object.defineProperty(store, 'fastLocationActionsInstalled', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return store;
}

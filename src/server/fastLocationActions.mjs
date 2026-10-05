import { GameError } from './errors.mjs';

const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

function fail(condition, message, status = 400, code = 'invalid_action') {
  if (!condition) throw new GameError(message, status, code);
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

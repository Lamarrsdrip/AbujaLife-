import crypto from 'node:crypto';
import { GameError } from './errors.mjs';
import { routeForJourney } from '../shared/abuja-navigation.mjs';

const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

function fail(condition, message, status = 400, code = 'invalid_action') {
  if (!condition) throw new GameError(message, status, code);
}

const ownedVehicle=(profile,vehicleId)=>Boolean(vehicleId&&profile?.inventory?.includes(vehicleId)&&Object.hasOwn(profile?.vehicleColors||{},vehicleId));
const locationVenue=profile=>profile?.location?.kind==='home'?'home':profile?.location?.venue||'neighbourhood';
const vehicleIsWithResident=(profile,presence=profile?.vehiclePresence)=>Boolean(['parked','driving'].includes(presence?.state)&&ownedVehicle(profile,presence.vehicleId)&&presence.district===profile?.district&&presence.venue===locationVenue(profile));
const cleanPresence=(profile,presence=profile?.vehiclePresence)=>ownedVehicle(profile,presence?.vehicleId)?presence:null;
const secondsForLocalRoute=(profile,mode)=>{const route=routeForJourney({fromDistrict:profile.district,fromVenue:profile.location?.kind==='venue'?profile.location.venue:null,toDistrict:profile.home?.district||profile.district,returningHome:true,homeDistrict:profile.home?.district||profile.district});const speed=mode==='car'?175:70;return Math.max(mode==='car'?6:9,Math.min(24,Math.round(Math.max(1,route?.distance||1)/speed)));};

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

// A successful home purchase now delivers a real owned furniture package. These are
// catalogue items, not renderer-only props, so residents can move/store/sell them with
// the existing authoritative furniture system. Higher tiers receive visibly richer
// combinations while LAPO starter homes remain sparse until a paid home is acquired.
const PURCHASED_HOME_FURNITURE = Object.freeze({
  1:Object.freeze(['bed','sofa','dining-table','fridge','floor-lamp','plant']),
  2:Object.freeze(['bed','sofa','dining-table','fridge','floor-lamp','plant','wardrobe','kitchen-unit','work-desk','office-chair','rug']),
  3:Object.freeze(['bed','sofa','dining-table','fridge','floor-lamp','plant','wardrobe','kitchen-unit','work-desk','office-chair','rug','lounge-chair','coffee-table','tv','tall-plant','bedside-table']),
  4:Object.freeze(['king-bed','premium-sofa','dining-table','fridge','floor-lamp','tall-plant','wardrobe','kitchen-island','work-desk','office-chair','large-rug','coffee-table','tv','music-speaker','storage-drawers','full-length-mirror','accent-chair']),
  5:Object.freeze(['king-bed','premium-sofa','dining-table','fridge','floor-lamp','indoor-ficus','wardrobe','kitchen-island','work-desk','office-chair','large-rug','coffee-table','tv','floor-speaker','media-sideboard','full-length-mirror','accent-chair','library-shelf','balcony-bench','gaming-console','art-piece','table-lamp']),
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

async function furnishPurchasedHome(store,residentId,profile,options={}){
  if(!profile?.home||profile.home.tenure!=='own')return profile;
  const property=store.propertyFor?.(profile,profile.home.propertyId);
  if(!property||!Number.isInteger(property.tier)||property.tier<1)return profile;
  if(profile.home.purchaseFurnishedPropertyId===property.id&&Number(profile.home.purchaseFurnishingTier||0)>=property.tier)return profile;

  const session=options?.session||null,dbOptions=session?{session}:{};
  // A browser cannot trigger this from a claimed property id. The persistent
  // ownership row must already exist, so payment/ownership commits first.
  const ownership=await store.collection('properties').findOne({residentId,propertyId:property.id,owned:true},dbOptions);
  if(!ownership)return profile;

  const packageItems=PURCHASED_HOME_FURNITURE[property.tier]||PURCHASED_HOME_FURNITURE[5];
  const inventory=store.collection('inventory'),acquiredAt=store.clock();
  const existing=await inventory.find({residentId,itemId:{$in:packageItems}},dbOptions).project({itemId:1}).toArray();
  const existingIds=new Set(existing.map(row=>row.itemId)),granted=[];
  for(const itemId of packageItems){
    if(existingIds.has(itemId))continue;
    await inventory.updateOne({residentId,itemId},{$setOnInsert:{_id:`${residentId}:${itemId}`,residentId,itemId,category:'furniture',acquiredAt,source:`purchased-home-tier-${property.tier}`,propertyId:property.id}},{...dbOptions,upsert:true});
    granted.push(itemId);
  }

  const update={$set:{starterVersion:1,furnishingPreset:'nepo-furnished',purchaseFurnishedPropertyId:property.id,purchaseFurnishingTier:property.tier,purchaseFurnishedAt:acquiredAt}};
  // Freshly delivered items have no previous home to preserve. Clearing only their
  // saved coordinates lets the existing route-safe interior arranger place them.
  if(granted.length){update.$pull={storedFurniture:{$in:granted}};update.$unset=Object.fromEntries(granted.map(itemId=>[`furnitureLayout.${itemId}`,'']));}
  await store.collection('homes').updateOne({residentId,propertyId:property.id},update,dbOptions);

  profile.inventory=[...new Set([...(profile.inventory||[]),...granted])];
  profile.storedFurniture=(profile.storedFurniture||[]).filter(itemId=>!granted.includes(itemId));
  profile.furnitureLayout={...(profile.furnitureLayout||{})};for(const itemId of granted)delete profile.furnitureLayout[itemId];
  profile.home={...profile.home,starterVersion:1,furnishingPreset:'nepo-furnished',purchaseFurnishedPropertyId:property.id,purchaseFurnishingTier:property.tier,purchaseFurnishedAt:acquiredAt};
  profile.purchasedHomeFurnished={propertyId:property.id,tier:property.tier,granted:[...granted]};
  return profile;
}

async function writeVehiclePresence(store,residentId,presence,{emit=true}={}){
  await store.collection('player_state').updateOne({residentId},presence?{$set:{vehiclePresence:presence}}:{$unset:{vehiclePresence:''}});
  const profile=await store.profile(residentId);
  if(emit)await store.emitUser(residentId,'profile',{profile});
  return profile;
}

async function beginSameDistrictHomeTrip(store,residentId,profile,payload={}){
  const timestamp=store.clock(),presence=cleanPresence(profile),requested=payload.mode||'walk';
  if(requested==='car'&&payload.vehicleId!=null)fail(ownedVehicle(profile,payload.vehicleId),'Buy this car before choosing it');
  const selectedVehicle=payload.vehicleId||profile.drivingVehicle||presence?.vehicleId;
  const keepCar=(vehicleIsWithResident(profile,presence)||requested==='car'&&ownedVehicle(profile,selectedVehicle))&&payload.leaveVehicle!==true;
  const mode=keepCar&&(requested==='walk'||requested==='car')?'car':requested==='car'&&!keepCar?'walk':requested;
  fail(mode==='walk'||mode==='car','Choose walking or your nearby car for this short trip');
  const seconds=secondsForLocalRoute(profile,mode),vehicleId=mode==='car'?selectedVehicle:null;
  let trip,replayed=false;
  await store.transaction(async session=>{
    const state=await store.collection('player_state').findOne({residentId},{session,projection:{district:1,location:1,activeTrip:1,vehiclePresence:1}});
    fail(state,'Resident persistence is incomplete',503,'storage_incomplete');
    if(state.activeTrip?.returningHome&&state.activeTrip.destination===profile.home.district){trip=state.activeTrip;replayed=true;return;}
    fail(!state.activeTrip,'Your journey is still in progress',409,'trip_in_progress');
    fail(state.location?.kind!=='home','You are already home',409,'already_home');
    trip={id:crypto.randomUUID(),destination:profile.home.district,mode,cost:0,seconds,vehicleId,arrivesAt:timestamp+seconds*1000,returningHome:true};
    const nextPresence=vehicleId?{vehicleId,state:'transit',district:profile.district,venue:locationVenue(profile),destinationDistrict:profile.home.district,destinationVenue:'home',updatedAt:timestamp}:state.vehiclePresence;
    const update={$set:{activeTrip:trip,drivingVehicle:null,location:{kind:'transit',district:profile.district,venue:'journey'},...(nextPresence?{vehiclePresence:nextPresence}:{})}};
    const changed=await store.collection('player_state').updateOne({_id:state._id,residentId,activeTrip:state.activeTrip??null},update,{session});
    fail(changed.modifiedCount===1,'Your location changed; try again',409,'location_changed');
  });
  const next=await store.profile(residentId);if(!replayed)await store.emitUser(residentId,'profile',{profile:next});
  return {ok:true,profile:next,trip,replayed,fastLocation:true};
}

/**
 * Installs bounded, hot-path location transitions on an existing MongoGameStore.
 *
 * Besides the optimized leave-home mutation, this layer owns the durable transition
 * between resident location and personal-vehicle presence. High-frequency car motion
 * remains visual/realtime state; only driving/transit/parked transitions are stored.
 */
export function installFastLocationActions(store) {
  fail(store && typeof store.action === 'function' && typeof store.transaction === 'function' && typeof store.collection === 'function' && typeof store.profile === 'function', 'Fast location actions require the Mongo game store', 500, 'storage_unavailable');
  if (store.fastLocationActionsInstalled === true) return store;

  const originalProfile = store.profile.bind(store);
  store.profile = async (residentId, options = {}) => {
    let profile = await originalProfile(residentId, options);
    profile=await migrateLegacyHomeFurniture(store,residentId,profile,options);
    profile=await furnishPurchasedHome(store,residentId,profile,options);
    if(profile.vehiclePresence&&!cleanPresence(profile))profile.vehiclePresence=null;
    return profile;
  };

  const originalAction = store.action.bind(store);

  store.action = async (residentId, action, payload = {}) => {
    if(action==='move-home'){
      const result=await originalAction(residentId,action,payload);
      const profile=await store.profile(residentId);
      return result&&typeof result==='object'?{...result,profile,purchasedHomeFurnished:profile.purchasedHomeFurnished||null}:result;
    }
    if(action==='travel'||action==='return-home'||action==='arrive'||action==='toggle-driving'||action==='exit-venue'){
      const before=await store.profile(residentId),presence=cleanPresence(before),carWithResident=vehicleIsWithResident(before,presence);
      if(action==='return-home'&&before.location?.kind!=='home'&&before.home?.district===before.district){
        return beginSameDistrictHomeTrip(store,residentId,before,payload);
      }
      let adjusted=payload;
      if((action==='travel'||action==='return-home')&&carWithResident&&payload.leaveVehicle!==true){
        if(payload.mode==null||payload.mode==='walk')adjusted={...payload,mode:'car',vehicleId:presence.vehicleId};
        else if(payload.mode==='car'&&payload.vehicleId==null)adjusted={...payload,vehicleId:presence.vehicleId};
      }
      const previousTrip=before.activeTrip;
      const result=await originalAction(residentId,action,adjusted);
      let after=result?.profile||await store.profile(residentId),nextPresence=null,shouldWrite=false;
      if((action==='travel'||action==='return-home')&&after.activeTrip?.mode==='car'&&ownedVehicle(before,after.activeTrip.vehicleId)){
        nextPresence={vehicleId:after.activeTrip.vehicleId,state:'transit',district:before.district,venue:locationVenue(before),destinationDistrict:after.activeTrip.destination,destinationVenue:after.activeTrip.returningHome?'home':after.activeTrip.venueId||'neighbourhood',updatedAt:store.clock()};shouldWrite=true;
      }else if(action==='arrive'&&previousTrip?.mode==='car'&&ownedVehicle(after,previousTrip.vehicleId)){
        nextPresence={vehicleId:previousTrip.vehicleId,state:'parked',district:after.district,venue:locationVenue(after),updatedAt:store.clock()};shouldWrite=true;
      }else if(action==='exit-venue'&&carWithResident){
        nextPresence={...presence,state:'parked',venue:'neighbourhood',updatedAt:store.clock()};shouldWrite=true;
      }else if(action==='toggle-driving'){
        const vehicleId=after.drivingVehicle||before.drivingVehicle||presence?.vehicleId;
        if(ownedVehicle(after,vehicleId)){
          nextPresence={vehicleId,state:after.drivingVehicle?'driving':'parked',district:after.district,venue:locationVenue(after),updatedAt:store.clock()};shouldWrite=true;
        }
      }
      if(shouldWrite){after=await writeVehiclePresence(store,residentId,nextPresence);return {...result,profile:after,vehiclePresence:nextPresence};}
      return result;
    }

    if (action !== 'leave-home') return originalAction(residentId, action, payload);

    const timestamp = store.clock();
    let replayed = false;

    await store.transaction(async session => {
      const playerState = await store.collection('player_state').findOne(
        { residentId },
        { session, projection: { district: 1, location: 1, activeTrip: 1, drivingVehicle: 1, vehiclePresence: 1 } },
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

      const presence=playerState.vehiclePresence?.state==='parked'&&playerState.vehiclePresence.district===playerState.district&&playerState.vehiclePresence.venue==='home'
        ?{...playerState.vehiclePresence,venue:'neighbourhood',updatedAt:timestamp}
        :playerState.vehiclePresence;
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
            ...(presence?{vehiclePresence:presence}:{}),
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

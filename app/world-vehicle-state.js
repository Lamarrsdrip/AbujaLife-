import {vehicleFor} from '../src/shared/vehicles.mjs';

// Both the interaction layer and native 3D scenery use the same server-owned
// selected vehicle. Older residents without vehiclePresence keep their existing
// inventory fallback; a recorded vehicle in another district is never invented.
export function worldVehicleState(profile={},rememberedDistrict=null) {
  const trip=profile.activeTrip,driving=profile.drivingVehicle;
  const presence=profile.vehiclePresence;
  const parkedHere=presence?.district===profile.district&&presence?.state!=='transit';
  const candidate=trip?.vehicleId||driving||(presence?parkedHere?presence.vehicleId:null:(profile.inventory||[]).find(id=>vehicleFor(id)));
  const vehicleId=vehicleFor(candidate)?candidate:null;
  const carWithYou=!!driving||trip?.mode==='car'||(presence?parkedHere:!rememberedDistrict||rememberedDistrict===profile.district);
  return {vehicleId,carWithYou:!!vehicleId&&carWithYou};
}

// Stable AbujaLife world-mode entry point. Keep the proven free-roam/interior
// simulator isolated from route travel so an active journey cannot remount a
// generic fake highway over the city.
import {renderWorld as renderFreeRoamWorld,avatarSVG} from './world-free-roam.js';
import {renderTripWorld} from './world-trip.js';

export {avatarSVG};

export function renderWorld(container,options={}){
  return options?.profile?.activeTrip
    ? renderTripWorld(container,options)
    : renderFreeRoamWorld(container,options);
}

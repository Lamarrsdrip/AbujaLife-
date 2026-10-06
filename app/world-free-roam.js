// Free-roam adapter around the long-lived world simulator. Vehicle possession is
// authoritative server state; reorder only the presentation list so the same parked
// personal car is the one rendered outside after a trip or venue visit.
import './civic-travel-phone-bridge.js';
import {renderWorld as renderSimulator,avatarSVG} from './world-simulator.js';
import {polishWorldPresentation} from './world-presentation.js';

export {avatarSVG};

function renderWithPresentation(container,options){
  const cleanup=renderSimulator(container,options);
  const disposePresentation=polishWorldPresentation(container);
  const wrapped=()=>{disposePresentation();cleanup?.();};
  if(cleanup&&typeof cleanup==='function')Object.assign(wrapped,cleanup);
  return wrapped;
}

export function renderWorld(container,options={}){
  const profile=options.profile||{};
  const preferred=profile.vehiclePresence?.state==='parked'?profile.vehiclePresence?.vehicleId:null;
  if(!preferred||!profile.inventory?.includes(preferred))return renderWithPresentation(container,options);
  const inventory=[preferred,...profile.inventory.filter(id=>id!==preferred)];
  return renderWithPresentation(container,{...options,profile:{...profile,inventory}});
}

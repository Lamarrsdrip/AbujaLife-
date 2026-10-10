// Free-roam adapter around the long-lived world simulator. Vehicle possession is
// authoritative server state; reorder only the presentation list so the same parked
// personal car is the one rendered outside after a trip or venue visit.
import './civic-travel-phone-bridge.js';
import {renderWorld as renderSimulator,avatarSVG} from './world-simulator.js';
import {polishWorldPresentation} from './world-presentation.js';
import {createStreetPresenceLayer,streetPresenceMode} from './world-presence.js';

export {avatarSVG};

function renderWithPresentation(container,options){
  const profile=options.profile||{},tagsOnly=streetPresenceMode(profile),initialPeople=Array.isArray(options.people)?options.people:[];
  // The public street deliberately receives no remote resident bodies. Their
  // authoritative realtime poses are rendered by the lightweight tag layer below.
  // Once the resident enters a home/building we pass the same people through and
  // the existing simulator/WebGL path shows full characters plus head labels.
  const cleanup=renderSimulator(container,tagsOnly?{...options,people:[]}:options);
  const disposePresentation=polishWorldPresentation(container);
  const streetPresence=tagsOnly&&cleanup?createStreetPresenceLayer(container,{
    people:initialPeople,
    profileId:profile.id,
    onResident:options.onResident,
    project:point=>cleanup.worldToScreen?.(point),
  }):null;
  if(!tagsOnly)container.dataset.multiplayerPresence='resident-avatars';
  const wrapped=()=>{
    streetPresence?.dispose();
    disposePresentation();
    cleanup?.();
    if(globalThis.__ABJ_WORLD__?.handle===wrapped){globalThis.__ABJ_WORLD__=null;globalThis.dispatchEvent?.(new CustomEvent('abujalife:world-unmounted'));}
    if(container.dataset.multiplayerPresence==='resident-avatars')delete container.dataset.multiplayerPresence;
  };
  if(cleanup&&typeof cleanup==='function'){
    Object.assign(wrapped,cleanup);
    // Guided-task layers (street gigs) attach to whichever world is mounted.
    globalThis.__ABJ_WORLD__={handle:wrapped,container,profile};
    queueMicrotask(()=>globalThis.dispatchEvent?.(new CustomEvent('abujalife:world-mounted',{detail:{handle:wrapped,container}})));
    if(tagsOnly){
      const simulatorUpdateResidents=cleanup.updateResidents?.bind(cleanup);
      wrapped.updateResidents=next=>{
        streetPresence?.updateResidents(next);
        // Keep the underlying 2D/3D resident collection empty outside so there is
        // never a second body hidden behind the public street tag.
        return simulatorUpdateResidents?.([]);
      };
      wrapped.updateResidentPose=data=>streetPresence?.updateResidentPose(data)===true;
    }
  }
  return wrapped;
}

export function renderWorld(container,options={}){
  const profile=options.profile||{};
  const preferred=profile.vehiclePresence?.state==='parked'?profile.vehiclePresence?.vehicleId:null;
  if(!preferred||!profile.inventory?.includes(preferred))return renderWithPresentation(container,options);
  const inventory=[preferred,...profile.inventory.filter(id=>id!==preferred)];
  return renderWithPresentation(container,{...options,profile:{...profile,inventory}});
}

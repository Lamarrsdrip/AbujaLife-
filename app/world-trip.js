import {renderOutside} from './outside-city-v4.js';

// Journeys use the same authored city, road geometry and landmark builders as
// exploration. The server owns the journey; the renderer only samples its route.
export function renderTripWorld(container,options={}){
 const trip=options.profile?.activeTrip;
 if(!container||!trip)return Object.assign(()=>{},{getMotionState:()=>({scene:'transit'})});
 container.classList.add('world-canvas','world-playable','world-route-trip');
 return renderOutside(container,{...options,atlas:options.atlas||[],venues:options.venues||[],journey:trip});
}

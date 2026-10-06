import {routeForJourney,parkingAnchorFor} from '../src/shared/abuja-navigation.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=text=>{let value=2166136261;for(const c of String(text||'')){value^=c.charCodeAt(0);value=Math.imul(value,16777619);}return value>>>0;};
const line=(points,shift)=>points.map((point,index)=>`${index?'L':'M'}${(point.x+shift.x).toFixed(1)} ${(point.y+shift.y).toFixed(1)}`).join(' ');

/**
 * A streamed journey corridor cut from the same navigation graph as the full
 * Abuja overview. It is deliberately route-specific: different destinations
 * produce different geometry and headings instead of replaying one highway.
 */
export function buildRouteScene({profile={},place={},trip=profile.activeTrip,id='journey'}={}){
 const route=routeForJourney({
  fromDistrict:profile.district||place.id,
  fromVenue:profile.location?.kind==='venue'?profile.location?.venue:null,
  toDistrict:trip?.destination,
  toVenue:trip?.venueId,
  returningHome:trip?.returningHome===true,
  homeDistrict:profile.home?.district||trip?.destination
 });
 const source=route?.points?.length>=2?route.points:[{x:0,y:0,name:place.name||'Abuja'},{x:900,y:0,name:trip?.destination||'Destination'}];
 const minX=Math.min(...source.map(p=>p.x)),maxX=Math.max(...source.map(p=>p.x)),minY=Math.min(...source.map(p=>p.y)),maxY=Math.max(...source.map(p=>p.y));
 const margin=460,shift={x:margin-minX,y:margin-minY},routePoints=source.map(point=>({...point,x:point.x+shift.x,y:point.y+shift.y}));
 const width=Math.max(1800,maxX-minX+margin*2),height=Math.max(1250,maxY-minY+margin*2);
 const routePath=line(source,shift),seed=hash(trip?.id||id);
 const trees=Array.from({length:Math.min(44,10+routePoints.length*4)},(_,i)=>{const point=routePoints[i%routePoints.length],angle=((seed+i*137)%360)*Math.PI/180,spread=125+((seed>>i%16)+i*31)%190,x=Math.max(45,Math.min(width-45,point.x+Math.cos(angle)*spread)),y=Math.max(45,Math.min(height-45,point.y+Math.sin(angle)*spread));return `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><ellipse rx="25" ry="9" fill="#173d3020"/><rect x="-3" y="-31" width="6" height="31" rx="3" fill="#8b6e4e"/><circle cy="-38" r="20" fill="${i%3?'#5f865d':'#769467'}"/></g>`;}).join('');
 const labels=routePoints.map((point,i)=>{if(i!==0&&i!==routePoints.length-1&&i%2)return '';const text=point.name||String(point.id||'').replace(/^district:/,'').replaceAll('-',' ');return `<g transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})"><circle r="12" fill="#f0d895" stroke="#3d5b53" stroke-width="4"/><rect x="-88" y="-64" width="176" height="34" rx="17" fill="#f6f0df" stroke="#d9cba9"/><text y="-42" text-anchor="middle" font-size="16" font-weight="700" fill="#29483f">${esc(text.slice(0,28))}</text></g>`;}).join('');
 const routeD=routePoints.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
 const destination=routePoints.at(-1),start=routePoints[0],parking=parkingAnchorFor({districtId:trip?.destination,venueId:trip?.venueId});
 return {
  id:`${id}-route`,title:trip?.returningHome?'Driving home':trip?.venueId?'Driving through Abuja':'Across Abuja',width,height,
  art:`<defs><linearGradient id="${id}-land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9dbb86"/><stop offset="1" stop-color="#789a70"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#${id}-land)"/><path d="${routeD}" fill="none" stroke="#c7d0c1" stroke-width="88" stroke-linecap="round" stroke-linejoin="round"/><path d="${routeD}" fill="none" stroke="#43565b" stroke-width="66" stroke-linecap="round" stroke-linejoin="round"/><path d="${routeD}" fill="none" stroke="#eadba8" stroke-width="3" stroke-dasharray="20 18" stroke-linecap="round"/>${trees}${labels}`,
  obstacles:[],interactables:[],pedestrians:[],traffic:[],buildings:[],objects:[],
  spawn:{x:start.x,y:start.y},routePoints,routeNodeIds:route?.nodeIds||[],routeDistance:route?.distance||Math.hypot(destination.x-start.x,destination.y-start.y),
  arrival:{x:destination.x,y:destination.y,angle:parking.angle},parkingAnchor:parking
 };
}

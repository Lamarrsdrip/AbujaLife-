import {renderTripWorld} from './world-trip.js';
import { canUseFurnitureSurface } from '../src/shared/furniture-metadata.mjs';
// Original AbujaLife scenery. These are authored social spaces, not geographic maps.
let serial = 0;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shades = {
  skin: {deep:'#613e2e',brown:'#986343',warm:'#bf865d',light:'#d7a882'},
  top: {ochre:'#bd733a',forest:'#326752',cream:'#e6dfce',navy:'#334456',agbada:'#c3a26d'},
  bottom: {charcoal:'#41464a',denim:'#536b7a',cream:'#d7cfbd'},
  shoes: {white:'#eeece5',black:'#303538'}
};
const color = (kind, key, fallback) => shades[kind][key] || fallback;

function residentArt(a = {}) {
  const skin = color('skin',a.skinTone,'#986343');
  const top = color('top',a.top,'#bd733a');
  const bottom = color('bottom',a.bottom,'#41464a');
  const shoe = color('shoes',a.shoes,'#eeece5');
  const body = a.body === 'broad' ? 9 : a.body === 'slim' ? -6 : 0;
  const left = 66-body, right = 134+body;
  const feminine = a.presentation === 'feminine';
  const face = a.face === 'round' ? 'M74 63Q73 43 100 42Q127 43 127 64L124 88Q117 108 100 109Q83 108 76 89Z' : a.face === 'angular' ? 'M76 61Q76 43 100 43Q124 43 124 61L122 88L109 106H92L78 90Z' : 'M75 63Q75 43 100 42Q125 43 125 63L122 88Q118 107 100 109Q82 107 78 88Z';
  const hairs = {
    bun:'<path d="M75 72Q67 29 100 29Q132 29 126 75L118 54Q100 58 81 53L81 75Z" fill="#282521"/><ellipse cx="101" cy="24" rx="18" ry="15" fill="#282521"/><path d="M85 22Q98 12 113 21" stroke="#4b3a2d" stroke-width="3" fill="none"/>',
    long:'<path d="M74 72Q64 25 100 27Q137 26 128 77L135 134L117 141L119 54Q98 60 81 53L81 137L64 129Z" fill="#282521"/><path d="M76 49L73 127M126 50L128 130" stroke="#4b3a2d" stroke-width="3" fill="none"/>',
    twists:'<path d="M76 72Q63 35 91 29Q126 22 129 67L121 77L117 53L83 56L81 79Z" fill="#282521"/><path d="M79 35Q70 63 76 91M88 31Q80 52 84 64M99 29L95 53M110 31Q115 48 114 59M121 38Q131 70 124 97" stroke="#48372b" stroke-width="5" stroke-linecap="round" fill="none"/>',
    crop:'<path d="M75 70V57Q73 34 100 33Q128 34 125 58V68L119 60L117 51Q103 58 82 50L82 63Z" fill="#242322"/><path d="M81 46Q102 39 119 46" stroke="#3c3731" stroke-width="4" fill="none"/>',
    bald:'<path d="M77 59Q80 43 100 42Q119 43 123 59" fill="none" stroke="#fff" opacity=".13" stroke-width="3"/>',
    afro:'<path d="M75 76Q61 71 65 59Q57 46 69 37Q68 21 85 25Q95 14 107 23Q123 19 129 33Q143 38 135 52Q141 65 126 75L122 57Q106 60 81 52Z" fill="#292724"/><path d="M72 42Q90 22 118 33M67 57Q79 48 85 47M110 27Q126 30 128 43" fill="none" stroke="#453c32" stroke-width="3" stroke-linecap="round"/>',
    locs:'<path d="M75 61Q74 31 99 31Q128 31 127 63L124 74L118 52Q97 63 82 54L79 79" fill="#282521"/><path d="M80 38Q73 60 74 90M89 35Q79 57 81 86M98 35Q90 53 86 60M107 35Q116 53 119 81M118 39Q130 69 126 96M99 36Q104 49 102 55" stroke="#41382e" stroke-width="6" stroke-linecap="round" fill="none"/>',
    braids:'<path d="M74 72Q67 29 100 28Q134 31 128 78L118 58Q106 58 81 55L81 77Z" fill="#282521"/><path d="M81 37Q76 56 75 103M88 33Q84 47 81 57M96 31L90 55M103 31L100 56M111 33L109 57M119 39Q125 62 126 108" stroke="#4b3a2d" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M75 85V124M126 89V125" stroke="#282521" stroke-width="7" stroke-linecap="round"/>'
  };
  const agbada = a.top === 'agbada';
  return `<g class="resident-figure">
    <ellipse cx="100" cy="271" rx="43" ry="9" fill="#25392d" opacity=".15"/>
    <path d="M${left+5} 179L99 179L94 249L74 249Z" fill="${bottom}"/><path d="M101 179L${right-5} 179L127 249H106Z" fill="${bottom}"/>
    <path d="M76 187L82 238M121 187L117 238" stroke="#111" opacity=".12" stroke-width="3"/>
    <path d="M74 245H94L96 260Q88 266 63 262L64 255Z" fill="${shoe}"/><path d="M106 245H126L135 255L135 263H105Z" fill="${shoe}"/>
    <path d="M65 260L94 260M107 260H133" stroke="#262b2b" stroke-width="2" opacity=".55"/>
    <path d="M${left} 125Q${left-15} 127 ${left-16} 146L${left-22} 190Q${left-25} 203 ${left-16} 207Q${left-7} 208 ${left-6} 196L${left+2} 153Z" fill="${skin}"/>
    <path d="M${right} 125Q${right+15} 127 ${right+16} 146L${right+22} 190Q${right+25} 203 ${right+16} 207Q${right+7} 208 ${right+6} 196L${right-2} 153Z" fill="${skin}"/>
    ${agbada ? `<path d="M79 116Q100 107 122 116L155 137L145 191L124 188L126 213H74L76 188L54 191L45 138Z" fill="${top}"/><path d="M99 125V207M90 135L90 182M109 135V182" stroke="#ede3cc" stroke-width="3" fill="none"/><path d="M83 117L100 126L119 117L113 146H88Z" fill="#af8b57"/>` : `<path d="M81 114Q100 109 119 114L${right+12} 126L${right+7} 149L${right-1} 149L${right-1} 186Q100 195 ${left+1} 186L${left+1} 149L${left-7} 149L${left-12} 126Z" fill="${top}"/><path d="M${left+6} 147L${left+6} 181M${right-6} 147L${right-6} 181" stroke="#111" opacity=".09" stroke-width="2"/><path d="M84 115Q100 131 117 115" stroke="#fff" opacity=".25" stroke-width="3" fill="none"/>`}
    <path d="M89 98H112L114 116Q100 127 86 116Z" fill="${skin}"/><path d="M89 104Q102 111 112 103L112 109Q98 118 89 110Z" fill="#221916" opacity=".16"/>
    <ellipse cx="76" cy="76" rx="5" ry="9" fill="${skin}"/><ellipse cx="124" cy="76" rx="5" ry="9" fill="${skin}"/>
    <path d="${face}" fill="${skin}"/><path d="M78 64Q79 47 96 45" fill="none" stroke="#fff" stroke-width="3" opacity=".1"/>
    <path d="M85 68L94 67M106 67L115 68" stroke="#3d2c24" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="90" cy="73" rx="2.2" ry="2.5" fill="#242321"/><ellipse cx="111" cy="73" rx="2.2" ry="2.5" fill="#242321"/>
    <path d="M100 75L97 86H103" fill="none" stroke="#352720" stroke-width="1.5" opacity=".4" stroke-linecap="round"/>
    <path d="M92 94Q100 98 109 94" fill="none" stroke="#482d26" stroke-width="2" stroke-linecap="round"/>
    ${a.facialHair==='beard'?'<path d="M79 84L86 94Q100 104 114 94L121 84L119 99Q100 119 82 100Z" fill="#2b2722" opacity=".85"/><path d="M92 93Q100 97 109 93" fill="none" stroke="#b3896a" stroke-width="1.5"/>':''}
    ${hairs[a.hair]||hairs.crop}
    ${a.accessory==='glasses'?'<g fill="none" stroke="#272e2e" stroke-width="2"><rect x="80" y="66" width="17" height="14" rx="5"/><rect x="104" y="66" width="17" height="14" rx="5"/><path d="M97 70H104M75 69H80M121 69H126"/></g>':''}
    ${feminine?'<circle cx="76" cy="87" r="2.5" fill="#c8a45e"/><circle cx="124" cy="87" r="2.5" fill="#c8a45e"/>':''}
  </g>`;
}

export function avatarSVG(appearance = {}, {size = 160, fullBody = false} = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="resident-avatar ${fullBody?'resident-avatar-full':''}" viewBox="${fullBody?'0 0 200 280':'25 22 150 154'}" width="${Number(size)||160}" role="img" aria-label="Resident portrait">${residentArt(appearance)}</svg>`;
}

import { buildCity, vehicleArt } from './world-city.js';
import { buildInterior, furnitureGhost, furnitureDimensions } from './world-interiors.js';
import { interiorExit, interiorPromptPosition } from './world-interior-actions.js';
import { worldVehicleState } from './world-vehicle-state.js';
import { VENUES, VENUE_ACTIONS, venuesForDistrict } from '../src/shared/life.mjs';
import { vehicleColorHex, vehicleFor } from '../src/shared/vehicles.mjs';
import { createCharacterRenderer } from './world-3d.js';
import { abujaTime, clubSchedule, seasonalWeather } from '../src/shared/simulation.mjs';
import { createClubAudio } from './world-audio.js';
import { soundscapeFor } from './audio-director.js';
import { WORLD_ZOOM, clampWorldZoom, worldViewport, constrainWorldCamera, screenToWorld, worldToScreen, worldFloorTransform, screenVectorToWorld } from './world-camera.js';
import { worldEntryState } from './world-spawn.js';
import { createWorldOrbit } from './world-orbit.js';
import { STREET_VIEW, streetCameraPose, streetPoseAtDistance, streetFollowYaw, easeYaw, readStreetPreference, writeStreetPreference } from './world-street-camera.js';
import { bindWorldTouch } from './world-touch.js';
import { furniturePlacementFeedback, surfaceForFurnitureAt } from '../src/shared/furniture-placement.mjs';

// Cosmetic scene positions only. Gameplay progress remains owned by the game API.
const sceneMemory = new Map();
const poseStorageKey = 'abujalife.world-poses.v1';
const poseLimit = 64;
let posesLoaded = false;
let lastPoseWrite = '';
function validPose(pose) {
  const coordinate = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100000;
  return pose && typeof pose === 'object' && ['x','y','cameraX','cameraY','angle'].every(key => coordinate(pose[key])) &&
    (pose.dir === 1 || pose.dir === -1) && typeof pose.driving === 'boolean' && coordinate(pose.parked?.x) && coordinate(pose.parked?.y);
}
function loadScenePoses() {
  if (posesLoaded) return;
  posesLoaded = true;
  try {
    const raw = localStorage.getItem(poseStorageKey);
    if (!raw || raw.length > 100000) return;
    const stored = JSON.parse(raw);
    if (stored.version !== 1 || !Array.isArray(stored.scenes)) return;
    for (const entry of stored.scenes.slice(-poseLimit)) {
      if (typeof entry?.key === 'string' && entry.key.length <= 512 && validPose(entry.pose)) sceneMemory.set(entry.key, entry.pose);
    }
  } catch { /* Restricted storage or an old malformed record must not block play. */ }
}
function writeScenePoses() {
  try {
    const serialized = JSON.stringify({version:1,scenes:[...sceneMemory].slice(-poseLimit).map(([key,pose])=>({key,pose}))});
    if (serialized !== lastPoseWrite) {localStorage.setItem(poseStorageKey,serialized);lastPoseWrite=serialized;}
  } catch { /* The live scene still works when browser storage is unavailable. */ }
}
const carDistrictKey='abujalife.car-district.v1';
function storedCarDistrict(profile){
  try{
    const raw=localStorage.getItem(carDistrictKey);if(!raw)return null;
    const parsed=JSON.parse(raw);
    if(parsed?.residentId!==profile?.id||typeof parsed.district!=='string')return null;
    return parsed.district;
  }catch{return null;}
}
export function rememberCarDistrict(residentId,district){
  if(typeof residentId!=='string'||!residentId||typeof district!=='string'||!district)return;
  try{localStorage.setItem(carDistrictKey,JSON.stringify({residentId,district}));}catch{}
}
const arrowIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6h12v12"/></svg>';
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

function movingResident(appearance={},own=false) {
  const skin=color('skin',appearance.skinTone,'#986343'),shirt=color('top',appearance.top,'#bd733a'),trousers=color('bottom',appearance.bottom,'#41464a'),shoe=color('shoes',appearance.shoes,'#eeece5');
  const broad=appearance.body==='broad'?3:appearance.body==='slim'?-2:0;
  const head=appearance.face==='angular'?`<path d="M-12-70Q-11-80 0-80Q12-80 12-69L10-56L3-50H-4L-11-57Z" fill="${skin}"/>`:`<ellipse cy="-65" rx="${appearance.face==='round'?13:12}" ry="${appearance.face==='round'?13:15}" fill="${skin}"/>`;
  const beard=appearance.facialHair==='beard'?'<path d="M-11-63L-7-57Q0-52 8-57L11-63L10-53Q0-45-10-54Z" fill="#312e25"/><path d="M-3-57Q1-54 5-57" fill="none" stroke="#b68d69" stroke-width="1.4"/>':'';
  const earrings=appearance.presentation==='feminine'?'<circle cx="-13" cy="-60" r="1.8" fill="#dbbd72"/><circle cx="13" cy="-60" r="1.8" fill="#dbbd72"/>':'';
  const hair={crop:'<path d="M-12-57V-64Q-13-78 0-78Q14-78 13-64L10-60L8-69Q0-66-9-70L-9-59Z"/>',bald:'',afro:'<path d="M-12-56Q-21-63-16-69Q-20-79-10-81Q-5-90 3-83Q14-88 17-78Q25-73 16-63L11-56L8-69L-10-68Z"/>',locs:'<path d="M-13-56Q-20-76-4-82Q15-85 17-67L15-49L9-52L9-71L-8-66L-10-50L-16-49Z"/>',braids:'<path d="M-13-57Q-17-78-1-82Q19-80 15-60L17-38L11-38L8-69L-8-68L-11-39L-16-39Z"/>'}[appearance.hair||'crop'];
  return `<g class="walker-silhouette"><ellipse cy="0" rx="19" ry="7" fill="#253e2c" opacity=".18"/><g class="walker-body"><g class="walker-leg walker-leg-left"><path d="M-10-30H-1L-3-5H-12Z" fill="${trousers}"/><path d="M-13-7H-3L-2-1H-17V-4Z" fill="${shoe}"/></g><g class="walker-leg walker-leg-right"><path d="M1-30H11L12-5H3Z" fill="${trousers}"/><path d="M3-7H13L17-3V0H2Z" fill="${shoe}"/></g><g class="walker-arm walker-arm-left"><path d="M${-11-broad}-51Q-18-48-18-38L-21-29" fill="none" stroke="${skin}" stroke-width="8" stroke-linecap="round"/></g><g class="walker-arm walker-arm-right"><path d="M${11+broad}-51Q18-48 18-38L21-29" fill="none" stroke="${skin}" stroke-width="8" stroke-linecap="round"/></g><path d="M-8-56Q0-59 8-56L${15+broad}-50L${12+broad}-30Q0-26 ${-12-broad}-30L${-15-broad}-50Z" fill="${shirt}"/><path d="M-7-54Q0-49 7-54" fill="none" stroke="#f9edcf" stroke-width="2" opacity=".4"/>${appearance.top==='agbada'?`<path d="M-11-54L-25-45L-19-23L-10-26L-11-15H13L12-26L21-23L25-45L10-54Z" fill="${shirt}"/><path d="M0-49V-20M-5-42V-28M5-42V-28" stroke="#eee1b7" stroke-width="2"/>`:''}<path d="M-5-60H5V-51H-5Z" fill="${skin}"/>${head}<g class="walker-face"><path d="M-7-65H-3M3-65H7" stroke="#382b21" stroke-width="2" stroke-linecap="round"/><path d="M-3-58Q0-56 4-59" fill="none" stroke="#58382a" stroke-width="1.5"/>${appearance.accessory==='glasses'?'<path d="M-10-68H-2V-62H-10ZM2-68H10V-62H2ZM-2-66H2" fill="none" stroke="#253831" stroke-width="1.5"/>':''}${beard}${earrings}</g><g fill="#312e25">${hair}</g><ellipse class="walker-back-head" cy="-66" rx="12" ry="13" fill="${appearance.hair==='bald'?skin:'#312e25'}" opacity="0"/></g></g>`;
}

function makeNavigation(scene,radius=10) {
  const step=26,cols=Math.ceil(scene.width/step),rows=Math.ceil(scene.height/step),blocked=new Uint8Array(cols*rows);
  const contains=(x,y,r=radius)=>x<r+12||y<r+12||x>scene.width-r-12||y>scene.height-r-12||scene.obstacles.some(o=>x>o.x-r&&x<o.x+o.w+r&&y>o.y-r&&y<o.y+o.h+r);
  for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++)blocked[gy*cols+gx]=contains((gx+.5)*step,(gy+.5)*step)?1:0;
  const free=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&!blocked[y*cols+x];
  const nearest=p=>{
    const ox=clamp(Math.floor(p.x/step),0,cols-1),oy=clamp(Math.floor(p.y/step),0,rows-1);
    if(free(ox,oy))return [ox,oy];
    for(let r=1;r<16;r++)for(let y=oy-r;y<=oy+r;y++)for(let x=ox-r;x<=ox+r;x++)if((Math.abs(x-ox)===r||Math.abs(y-oy)===r)&&free(x,y))return [x,y];
    return null;
  };
  const clear=(a,b)=>{const n=Math.ceil(distance(a,b)/10);for(let i=0;i<=n;i++)if(contains(a.x+(b.x-a.x)*i/(n||1),a.y+(b.y-a.y)*i/(n||1)))return false;return true;};
  const path=(start,end)=>{
    if(!contains(end.x,end.y)&&clear(start,end))return [{...end}];
    const from=nearest(start),to=nearest(end);if(!from||!to)return [];
    const startIndex=from[1]*cols+from[0],endIndex=to[1]*cols+to[0];
    const scores=new Float64Array(cols*rows).fill(Infinity),parents=new Int32Array(cols*rows).fill(-1),closed=new Uint8Array(cols*rows),open=[startIndex];scores[startIndex]=0;
    const heuristic=i=>Math.hypot(i%cols-to[0],Math.floor(i/cols)-to[1]);let found=false;
    while(open.length){let best=0;for(let i=1;i<open.length;i++)if(scores[open[i]]+heuristic(open[i])<scores[open[best]]+heuristic(open[best]))best=i;const index=open.splice(best,1)[0];if(index===endIndex){found=true;break;}closed[index]=1;const x=index%cols,y=Math.floor(index/cols);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,ny=y+dy,ni=ny*cols+nx;if(!free(nx,ny)||closed[ni]||(dx&&dy&&(!free(x+dx,y)||!free(x,y+dy))))continue;const score=scores[index]+(dx&&dy?1.4142:1);if(score<scores[ni]){scores[ni]=score;parents[ni]=index;if(!open.includes(ni))open.push(ni);}}
    }
    if(!found)return [];
    const result=[];for(let cursor=endIndex;cursor!==startIndex&&cursor!==-1;cursor=parents[cursor])result.push({x:(cursor%cols+.5)*step,y:(Math.floor(cursor/cols)+.5)*step});result.reverse();
    if(!contains(end.x,end.y)&&(!result.length||clear(result.at(-1),end)))result.push({...end});
    const smooth=[];let anchor=start;for(let i=0;i<result.length;){let j=result.length-1;while(j>i&&!clear(anchor,result[j]))j--;smooth.push(result[j]);anchor=result[j];i=j+1;}return smooth;
  };
  return {contains,clear,path,nearest,step};
}

/** A locally simulated playable world. Online residents only come from the server. */
export function renderWorld(container,{profile={},place={},people=[],serverNow,weather:reportedWeather,canDecorate=true,catalog=[],onInteract=()=>{},onResident=()=>{},onFurnitureSelect=()=>{},onDestination=()=>{},onArrive}={}) {
 if(profile.activeTrip)return renderTripWorld(container,{profile,place,people,serverNow,onArrive});
 if(!container)return Object.assign(()=>{},{perform:()=>{},walkTo:()=>{}});
 const id=`abuja-motion-${++serial}`,trip=null,kind=trip?'transit':profile.location?.kind||'public',atHome=kind==='home'||kind==='visit',interior=atHome||kind==='venue',preview=container.id==='welcome-scene';
 const realTimeStart=Number.isFinite(Number(serverNow))?Number(serverNow):Date.now(),localTimeStart=performance.now();
 const now=()=>realTimeStart+(performance.now()-localTimeStart);
 const venue=VENUES.find(v=>v.id===profile.location?.venue),isClub=venue?.kind==='club'||['club','club-cage','magic-city','bear-barn'].includes(venue?.id);
 let scene=interior?buildInterior({profile:kind==='visit'?{...profile,location:{...profile.location,kind:'home',venue:'home'}}:profile,venue:kind==='visit'?undefined:venue,id}):buildCity({profile,place,id,venues:venuesForDistrict(profile.district||place.id)});
 scene.obstacles ||= [];scene.interactables ||= [];
 // A guest sees the owner's real floor plan, but every interaction must stay
 // read-only. Keep the door as the authoritative leave action and turn the
 // home's furniture/activity points into local inspection moments instead of
 // silently dropping them (which made a visit feel empty and disconnected).
 if(kind==='visit'){
  scene.interactables.forEach(point=>{
   if(point.action==='leave-home'){point.action='leave-visit';point.label='Leave this home';return;}
   point.payload={...point.payload,visitAction:point.action,visitLabel:point.label};
   point.action='visit-interact';
   point.label=point.label?.replace(/^Arrange your home$/i,'Look around the room')||'Look around the room';
  });
 }
 scene.pedestrians ||= [];scene.traffic ||= [];
 const {vehicleId:ownVehicle,carWithYou}=worldVehicleState(profile,storedCarDistrict(profile));
 const driving=!!profile.drivingVehicle&&!interior&&!trip,transport=trip?trip.mode!=='walk':driving;
 const key=[profile.id||'preview',profile.createdAt||0,profile.district||place.id||'garki',kind,atHome?profile.home?.propertyId:venue?.id||'',trip?.id||''].join(':');
 const persistentScene=container.id==='world-scene'&&typeof profile.id==='string'&&profile.id.length>0&&!trip;
 if(persistentScene)loadScenePoses();
 const entry=worldEntryState(scene,profile,persistentScene?sceneMemory.get(key):undefined),saved=entry.saved;scene.spawn=entry.spawn;
 let nav=makeNavigation(scene,driving?24:10);
 const initial=saved?{x:saved.x,y:saved.y}:scene.spawn;
 let player={x:initial.x,y:initial.y},camera={x:saved?.cameraX??player.x,y:saved?.cameraY??player.y},angle=saved?.angle||0,dir=saved?.dir||1,disposed=false,raf=0,lastTime=0,elapsed=0,travelDistance=0,walkPhase=0,path=[],pending=null,routeRepairs=0,nearby=null,moving=false,sprinting=false,arrived=false,furnitureMode=null,furnitureRotation=0,activity=null,lastStatus='',parked={x:saved?.parked?.x??scene.spawn.x+144,y:saved?.parked?.y??scene.spawn.y+108};
 if(saved&&saved.driving&&!driving&&!interior&&!trip){parked={...player};player.x+=78;}
 if(saved&&!saved.driving&&driving){player={...parked};camera={...player};}
 // Furniture and scene geometry can change between visits; repair stale positions.
 const fitPosition=(position,fallback,navigation=nav)=>{
  const inBounds=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=scene.width&&p.y>=0&&p.y<=scene.height;
  if(inBounds(position)&&!navigation.contains(position.x,position.y))return {...position};
  const anchor=inBounds(position)?position:fallback,n= navigation.nearest(anchor);
  return n?{x:(n[0]+.5)*navigation.step,y:(n[1]+.5)*navigation.step}:{...scene.spawn};
 };
 const originalPosition={...player};player=fitPosition(player,scene.spawn);
 const parkingNav=ownVehicle&&!interior&&!trip&&!driving?makeNavigation(scene,24):nav;
 parked=fitPosition(parked,{x:scene.spawn.x+144,y:scene.spawn.y+108},parkingNav);
 if(distance(originalPosition,player)>40)camera={...player};
 camera.x=clamp(camera.x,0,scene.width);camera.y=clamp(camera.y,0,scene.height);
 const keyboard=new Set(),joy={x:0,y:0,pointer:null},listeners=[];
 let viewWidth=1050,viewHeight=650,zoom=clampWorldZoom(saved?.zoom ?? 1),frameCount=0;
 const orbit=createWorldOrbit({yaw:saved?.cameraYaw,elevation:saved?.cameraElevation,zoom});
 if(preview)camera={x:scene.width/2,y:scene.height/2};
 const orientation=()=>orbit.getState();
 // Third-person street view is the default presentation. The overview (dollhouse)
 // camera remains for arranging furniture, previews and as a player choice.
 let streetPreferred=readStreetPreference(),streetDistance=0,streetTilt=0,streetShown=false;
 let waypoint=null;
 const streetOn=()=>streetPreferred&&oblique&&!preview&&!furnitureMode;
 const viewport=()=>({width:viewWidth,height:viewHeight,oblique,...orientation()});
 const usablePose=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=scene.width&&p.y<=scene.height;
 let knownResidents=trip?[]:people.filter(p=>p.id!==profile.id&&p.online),neighbours=knownResidents.filter(p=>usablePose(p.pose)).slice(0,50);
 const residentPoses=new Map(neighbours.map(p=>[String(p.id),{...p.pose}]));
 const residentTargets=new Map(neighbours.map(p=>[String(p.id),{...p.pose}]));
 const residentUpdatedAt=new Map(neighbours.map(p=>[String(p.id),now()]));
 const residentMarkup=person=>{const pose=residentPoses.get(String(person.id))||person.pose;return `<g class="world-online-resident" data-world-resident="${escape(person.id)}" transform="translate(${pose.x} ${pose.y})" role="button" tabindex="0" aria-label="${escape('@'+String(person.username||'resident').replace(/^@+/,''))} — live resident">${movingResident(person.appearance)}<g class="online-resident-label"><rect x="-52" y="-145" width="104" height="20" rx="10" fill="#f5f1df"/><circle cx="-41" cy="-135" r="3" fill="#63a168"/><text x="4" y="-131" text-anchor="middle">${escape(('@'+String(person.username||'resident').replace(/^@+/, '')).slice(0,22))}</text></g><rect x="-27" y="-145" width="54" height="150" fill="transparent"/></g>`;};
 const carColor=vehicleColorHex(profile,ownVehicle),carStyle=vehicleFor(ownVehicle)?.bodyStyle||'sedan';
 if(ownVehicle&&carWithYou&&!interior&&!trip)scene.interactables.push({id:'your-car',x:parked.x,y:parked.y-58,label:'Drive your car',action:'toggle-driving',payload:{vehicleId:ownVehicle},radius:105,icon:'↔'});
 const markerMarkup=()=>scene.interactables.map(point=>`<g class="world-point" data-world-target="${escape(point.id)}" transform="translate(${point.x} ${point.y})" role="button" tabindex="0" aria-label="Walk to ${escape(point.label)}"><ellipse class="world-point-ring" cy="0" rx="22" ry="9"/><path class="world-point-arrow" d="M-5-13L0-8L5-13"/><g class="world-point-label"><rect x="${-Math.max(45,point.label.length*3.15+17)}" y="-48" width="${Math.max(90,point.label.length*6.3+34)}" height="25" rx="12.5"/><text y="-31" text-anchor="middle">${escape(point.label)}</text></g><rect x="-44" y="-58" width="88" height="79" rx="10" fill="transparent"/></g>`).join('');
 container.classList.add('world-canvas','world-playable');container.classList.toggle('world-preview',preview);container.tabIndex=0;
 container.dataset.sceneKind=kind;container.dataset.sceneName=scene.title||'';container.dataset.driving=String(driving);container.dataset.homeProperty=atHome?profile.home?.propertyId||'garki-studio':'';
 container.setAttribute('aria-label',`${scene.title||'Abuja'} playable world. Use WASD or arrow keys to walk. Hold Shift to run. E to interact. Tap the ground to move; use the camera + and − buttons or pinch this environment to zoom.`);
 container.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" class="world-scene ${interior?'world-interior':'world-public'}" data-home-property="${escape(atHome?profile.home?.propertyId||'garki-studio':'')}" viewBox="0 0 1050 650" role="group" aria-label="${escape(scene.title||'Your neighbourhood')}"><title>${escape(scene.title||'AbujaLife')}</title><desc>Walkable authored game scenery. Tap a destination, use arrow keys or WASD, or drag the movement joystick. City pedestrians and traffic are ambient simulation; online residents have separate name labels.</desc><g class="world-art">${scene.art}</g><g class="world-traffic">${scene.traffic.map((car,i)=>`<g data-city-traffic="${i}" aria-label="Ambient city traffic">${vehicleArt(car.color,car.type)}</g>`).join('')}</g><g class="world-ambient">${scene.pedestrians.map((npc,i)=>`<g data-city-npc="${i}" aria-label="${escape(scene.pedestrians[i]?.role||'Ambient city pedestrian')}"><g class="walker-facing">${movingResident({skinTone:i%3?'brown':'deep',top:['forest','cream','ochre','navy'][i%4],hair:['crop','braids','afro'][i%3]})}</g><text x="0" y="-91" text-anchor="middle" class="world-npc-label ${scene.pedestrians[i]?.role?'is-security':''}">${escape(scene.pedestrians[i]?.role||'')}</text></g>`).join('')}</g><g class="world-online">${neighbours.map(residentMarkup).join('')}</g><g class="world-route"><path class="world-route-line"/><g class="world-destination" hidden><ellipse rx="17" ry="7"/><ellipse rx="7" ry="3"/></g></g><g class="world-markers">${markerMarkup()}</g>${ownVehicle&&carWithYou&&!interior&&!trip?`<g class="world-parked-car" data-world-target="your-car" aria-label="Your parked car" transform="translate(${parked.x} ${parked.y})">${vehicleArt(carColor,carStyle,ownVehicle)}</g>`:''}<g class="world-player" data-world-player><ellipse class="world-player-halo" cy="3" rx="27" ry="11"/><g class="world-player-walker"><g class="walker-facing">${movingResident(profile.appearance,true)}</g><g class="world-you-label"><path d="M-4-94L0-88L4-94Z"/><rect x="-18" y="-115" width="36" height="19" rx="9"/><text text-anchor="middle" y="-102">YOU</text></g></g><g class="world-player-car">${vehicleArt(trip&&trip.mode==='taxi'?'#cfb278':carColor,trip?.mode==='bus'?'bus':trip?.mode==='taxi'?'taxi':carStyle,ownVehicle)}</g></g><g class="world-furniture-ghost" hidden><ellipse rx="49" ry="24"/><path d="M-25-12H25V12H-25Z"/><text y="-34" text-anchor="middle">PLACE HERE</text></g></svg><div class="world-hud"><div class="world-location-chip"><i></i><span>${escape(scene.title||place.name||'Abuja')}</span><small>${trip?'ON THE ROAD':driving?'DRIVING':interior?'INDOORS':'FREE ROAM'}</small></div><span class="world-camera-tools"><button type="button" class="world-camera-button world-view-toggle" data-world-control="view-mode" aria-pressed="true" aria-label="Switch camera view" title="Switch camera view"><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 7l7-4 7 4-7 4z"/><path d="M3 7v6l7 4 7-4V7M10 11v6"/></svg></button><button class="world-camera-button" data-world-control="center" title="Center on you" aria-label="Center camera on your character">⌖</button></span></div><div class="world-zoom-controls" role="group" aria-label="Environment camera zoom"><button type="button" data-world-control="zoom-out" aria-label="Zoom environment out" title="Zoom out">−</button><button type="button" data-world-control="zoom-fit" aria-label="Reset environment to wide view" title="Wide view"><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4"/></svg></button><button type="button" data-world-control="zoom-in" aria-label="Zoom environment in" title="Zoom in">+</button><span class="world-zoom-announcement" aria-live="polite"></span></div><div class="world-minimap" aria-label="Your position in this game space"><svg viewBox="0 0 ${scene.width} ${scene.height}" preserveAspectRatio="xMidYMid meet">${scene.obstacles.map(o=>`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="8" fill="#668269" opacity=".45"/>`).join('')}${scene.interactables.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${interior?12:22}" fill="#f4e6b8"/>`).join('')}<rect class="world-minimap-view" fill="#fbf5d31a" stroke="#f3f0d8" stroke-width="${interior?5:13}"/><circle class="world-minimap-player" r="${interior?19:33}" fill="#fff4c8" stroke="#55714e" stroke-width="${interior?5:10}"/></svg><span>YOUR NEIGHBOURHOOD</span></div><div class="world-motion-status" aria-live="polite">${trip?'Watch the city go by':preview?'':interior?'Make yourself at home.':'A whole neighbourhood to explore.'}</div><div class="world-game-controls"><div class="world-joystick-wrap"><div class="world-joystick" role="application" aria-label="Movement joystick. Drag to walk; push further to run." tabindex="0"><span class="world-joystick-cross"></span><span class="world-joystick-knob"></span></div><span class="world-joystick-caption">${driving?'DRIVE':'MOVE'}</span></div><div class="world-actions"><button class="world-sprint-button" data-world-control="sprint" aria-label="Hold to ${driving?'accelerate':'run'}"><span>${arrowIcon}</span><small>${driving?'BOOST':'RUN'}</small></button><div class="world-interaction-row">${interior&&kind!=='home'&&!preview&&interiorExit(scene)?`<button type="button" class="world-exit-shortcut" data-world-control="exit" aria-label="Go outside to the street"><span>Go outside</span>${arrowIcon}</button>`:''}<button class="world-interact-button" data-world-control="interact"><kbd>E</kbd><span>${driving?'Get out':'Explore'}</span><b>${arrowIcon}</b></button></div></div></div><button type="button" class="world-context-action" data-world-context hidden></button><div class="world-help"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span><span><kbd>Shift</kbd> run</span><span>Tap anywhere to walk</span></div><div class="world-simulation-label">${interior?'Your space, your pace':'City traffic & pedestrians · simulated'}</div><div class="world-furniture-toolbar" hidden role="group" aria-label="Arrange your furniture"><div class="world-furniture-heading"><strong data-furniture-name>Your piece</strong><span data-furniture-feedback aria-live="polite">Choose a spot</span></div><div class="world-furniture-adjust"><button type="button" data-world-control="nudge-left" aria-label="Move furniture left">←</button><button type="button" data-world-control="nudge-forward" aria-label="Move furniture forward">↑</button><button type="button" data-world-control="nudge-back" aria-label="Move furniture back">↓</button><button type="button" data-world-control="nudge-right" aria-label="Move furniture right">→</button><button type="button" data-world-control="rotate" aria-label="Rotate furniture 90 degrees">↻</button><button type="button" data-world-control="snap" aria-pressed="true">Snap</button></div><div class="world-furniture-confirm"><button type="button" data-world-control="cancel-furniture">Cancel</button><button type="button" data-world-control="place-furniture">Place</button></div></div>`;
 const svg=container.querySelector('.world-scene'),playerNode=container.querySelector('.world-player'),walkerNode=playerNode.querySelector('.world-player-walker'),carNode=playerNode.querySelector('.world-player-car'),facingNode=walkerNode.querySelector('.walker-facing'),bodyNode=walkerNode.querySelector('.walker-body'),legs=[...walkerNode.querySelectorAll('.walker-leg')],arms=[...walkerNode.querySelectorAll('.walker-arm')],backHead=walkerNode.querySelector('.walker-back-head'),frontFace=walkerNode.querySelector('.walker-face'),destinationNode=container.querySelector('.world-destination'),routeNode=container.querySelector('.world-route-line'),statusNode=container.querySelector('.world-motion-status'),interactButton=container.querySelector('.world-interact-button'),contextAction=container.querySelector('[data-world-context]'),parkedNode=container.querySelector('.world-parked-car'),ghost=container.querySelector('.world-furniture-ghost'),joyNode=container.querySelector('.world-joystick'),joyKnob=container.querySelector('.world-joystick-knob'),trafficNodes=[...container.querySelectorAll('[data-city-traffic]')],npcNodes=[...container.querySelectorAll('[data-city-npc]')];
 walkerNode.style.display=transport?'none':'';carNode.style.display=transport?'':'none';if(driving&&parkedNode)parkedNode.style.display='none';
 if(driving)container.querySelector('[data-world-target="your-car"].world-point')?.setAttribute('display','none');
 const timeChip=document.createElement('div');timeChip.className='world-time-chip';timeChip.setAttribute('aria-label','Actual Abuja time and weather');container.append(timeChip);
 let clock=abujaTime(now()),weather=reportedWeather||seasonalWeather(now()),lastClockSecond=-1;
 const sound=createClubAudio({enabled:profile.settings?.soundEnabled!==false,mode:isClub?'club':'ambient',scene:preview?null:soundscapeFor({kind:trip?'transit':kind,venueId:venue?.id,venueKind:venue?.kind,night:abujaTime(now()).isNight}),onState:state=>{const button=container.querySelector('.world-sound-toggle');if(button){const label=isClub?'Music':'Ambience';button.textContent=state.playing?`${label} on`:state.enabled?`${label} paused`:`${label} off`;button.setAttribute('aria-pressed',String(state.enabled));}}});
 {const button=document.createElement('button');button.className='world-sound-toggle';button.type='button';button.textContent=isClub?'Music off':'Ambience off';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',isClub?'Toggle original synthesized club music':'Toggle original Abuja city ambience');button.disabled=profile.settings?.soundEnabled===false;button.title=button.disabled?'Enable sound in Settings first':isClub?'Original club beats · tap to listen':'Original Abuja ambience · tap to listen';button.onclick=()=>sound.toggle();container.append(button);}
 let characterRenderer=null;
 const mountCharacterRenderer=()=>{
  if(disposed||characterRenderer)return;
  characterRenderer=createCharacterRenderer(container,{appearance:profile.appearance,pedestrians:scene.pedestrians,neighbours,scene,profile,kind,venue,place});
  if(waypoint)characterRenderer?.setBeacon?.(waypoint);
  if(container.dataset.environmentRenderer==='webgl-3d'){oblique=true;updateViewport();}
  armLoop();
 };
 let oblique=container.dataset.environmentRenderer==='webgl-3d';
 const roofLabels=document.createElement('div');roofLabels.className='world-roof-labels';container.append(roofLabels);
 const roofEntries=(scene.buildings||[]).filter(b=>b.name).map(b=>{
  const button=document.createElement('button');button.type='button';button.className='world-roof-name';button.textContent=b.name;button.dataset.roofBuilding=b.id;button.setAttribute('aria-label',`Visit ${b.name}`);
  button.onclick=()=>{if(!inputBlocked()&&!trip&&!furnitureMode)onDestination(b.id==='home'?{home:true}:{venueId:b.id});};roofLabels.append(button);
  return {button,point:{x:b.x+b.w/2,y:(b.frontY===false?b.y:b.y-b.h)+b.h/2,elevation:(b.id==='hotel'?250:b.id==='home'?145:b.floors>1?140:103)+72}};
 });

 const groundGroup=document.createElementNS('http://www.w3.org/2000/svg','g');groundGroup.classList.add('world-ground');
 while(svg.firstChild)groundGroup.append(svg.firstChild);svg.append(groundGroup);
 const on=(node,type,handler,options)=>{node.addEventListener(type,handler,options);listeners.push(()=>node.removeEventListener(type,handler,options));};
 const say=text=>{if(text!==lastStatus){statusNode.textContent=text;lastStatus=text;statusNode.classList.toggle('is-important',/out of reach|Try |Get out|Park your|clear space|clear spot|rotation/.test(text));}};
 const modalOpen=()=>[...document.querySelectorAll('.sheet-backdrop,[aria-modal="true"],.ph-backdrop')].some(modal=>{if(modal.contains(container)||modal.hidden||modal.getAttribute('aria-hidden')==='true')return false;const style=getComputedStyle(modal);return style.display!=='none'&&style.visibility!=='hidden'&&modal.getClientRects().length>0;});
 const inputBlocked=()=>preview||document.hidden||modalOpen()||/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable;
 let exiting=false;
 const updateInteriorPrompt=()=>{
  if(!contextAction)return;
  const eligible=interior&&!trip&&!furnitureMode&&!activity&&!inputBlocked();
  const points=eligible?scene.interactables.filter(point=>!['exit-venue','leave-home','leave-visit','furnish'].includes(point.action)&&distance(player,point)<260).sort((a,b)=>distance(player,a)-distance(player,b)):[];
  contextAction.hidden=true;
  delete contextAction.dataset.pointId;
  const rect=container.getBoundingClientRect();
  const blockers=[];
  if(!points.length||!rect.width||!rect.height)return;
  const stage=container.closest('.world-stage')||container;
  for(const node of stage.querySelectorAll('.world-hud,.world-live-stats,.world-time-chip,.world-zoom-controls,.world-game-controls,.world-catalogue-button,.world-sound-toggle,.abj-whole-city-button,.hud-context-slot,.world-resident-actions,.world-live-popover,.play-visit-card,.club-life-dock,.location-chat-panel,.world-furniture-toolbar')){
   if(node.hidden||!node.getClientRects().length)continue;
   const style=getComputedStyle(node),box=node.getBoundingClientRect();
   if(style.display==='none'||style.visibility==='hidden'||!box.width||!box.height)continue;
   blockers.push({x:box.left-rect.left,y:box.top-rect.top,width:box.width,height:box.height});
  }
  const you=characterRenderer?.projectGround?.(player)||worldToScreen(player,rect,camera,viewport());
  blockers.push({x:you.x-rect.left-22,y:you.y-rect.top-76,width:44,height:94});
  for(const point of points){
   contextAction.textContent=point.label;
   contextAction.setAttribute('aria-label',`Walk to ${point.label.toLowerCase()}`);
   contextAction.hidden=false;
   const anchor=point.promptAnchor||point,projected=characterRenderer?.projectWorld?.(anchor)||worldToScreen(anchor,rect,camera,viewport());
   if(projected.z!==undefined&&(projected.z<-1||projected.z>1)){contextAction.hidden=true;continue;}
   const placement=interiorPromptPosition({anchor:{x:projected.x-rect.left,y:projected.y-rect.top},width:rect.width,height:rect.height,promptWidth:contextAction.offsetWidth,promptHeight:contextAction.offsetHeight,blockers});
   if(!placement){contextAction.hidden=true;continue;}
   contextAction.style.left=`${placement.x}px`;contextAction.style.top=`${placement.y}px`;contextAction.dataset.pointId=point.id;break;
  }
 };
 const remember=(persist=false)=>{if(!persistentScene)return;sceneMemory.delete(key);sceneMemory.set(key,{...player,cameraX:camera.x,cameraY:camera.y,zoom,cameraYaw:orientation().yaw,cameraElevation:orientation().elevation,angle,dir,parked:{...parked},driving,exteriorTransition:entry.exteriorTransition});while(sceneMemory.size>poseLimit)sceneMemory.delete(sceneMemory.keys().next().value);if(persist)writeScenePoses();};
 on(window,'beforeunload',()=>remember(true));on(window,'pagehide',()=>remember(true));
 const updateRoute=()=>{routeNode.setAttribute('d',path.length?`M${player.x} ${player.y} ${path.map(p=>`L${p.x} ${p.y}`).join(' ')}`:'');destinationNode.toggleAttribute('hidden',!path.length);if(path.length)destinationNode.setAttribute('transform',`translate(${path.at(-1).x} ${path.at(-1).y})`);};
 const stop=()=>{path=[];const interrupted=pending;pending=null;interrupted?.after?.(false);moving=false;updateRoute();};
 const dispatch=(action,payload,after)=>{try{Promise.resolve(onInteract(action,payload||{})).then(result=>after?.(result!==false&&result!==null)).catch(error=>{say(error.message||'Try that again.');after?.(false);});}catch(error){say(error.message||'Try that again.');after?.(false);}};
 const moveTo=(x,y,point=null)=>{if(trip||preview||activity)return false;const target={x:clamp(Number(x)||0,24,scene.width-24),y:clamp(Number(y)||0,24,scene.height-24)};path=nav.path(player,target);pending=point;routeRepairs=0;updateRoute();if(!path.length){say('That spot is out of reach. Try the open path.');pending=null;return false;}say(point?`${driving?'Driving':'Walking'} to ${point.label.toLowerCase()}…`:driving?'Taking the wheel.':'On your way.');container.focus({preventScroll:true});poke();return true;};
 const activate=point=>{if(!point||trip||furnitureMode||activity){point?.after?.(false);return;}pending=null;stop();remember();if(driving&&point.action!=='toggle-driving'){say('Park your car and get out to go inside.');return;}if(point.action==='travel-venue'){onDestination({venueId:point.payload?.destinationVenueId,districtId:point.payload?.districtId});point.after?.(true);return;}const task=point.action==='venue-action'?VENUE_ACTIONS.find(a=>a.id===point.payload?.activityId):null;if(task){animateActivity(task.animation,task.duration,()=>dispatch(point.action,point.payload,point.after),task.name);}else dispatch(point.action,point.payload,point.after);};
 const requestPoint=point=>{if(!point)return false;if(driving&&point.action!=='toggle-driving'){say('Get out of your car to enter a place.');return false;}if(distance(player,point)<(point.radius||66)){activate(point);return true;}return moveTo(point.x,point.y,point);};
 const perform=(action,payload={},after=null)=>{
  if(action==='furnish'&&payload.itemId){setFurnitureMode(payload.itemId);return true;}
  if(action==='toggle-driving'&&driving){stop();parked={...player};remember();dispatch(action,{vehicleId:null},after);return true;}
  const point=scene.interactables.find(p=>p.action===action&&(action!=='enter-venue'||p.payload?.venueId===payload.venueId)&&(action!=='venue-action'||p.payload?.activityId===payload.activityId));
  if(point)return requestPoint({...point,payload:{...point.payload,...payload},after});
  if(['furnish','dealership','estate-office','banex-market'].includes(action)){remember();dispatch(action,payload,after);return true;}return false;
 };
 let furnitureCursor=null,furnitureFeedback=null,furnitureSnap=true,furnitureSaving=false;
 const furniturePayload=p=>{
  const area=scene.furnishingArea||{x:0,y:0,w:scene.width,h:scene.height},surface=surfaceForFurnitureAt(scene,furnitureMode,p,furnitureRotation);
  return {x:(p.x-area.x)/area.w,y:(p.y-area.y)/area.h,rotation:furnitureRotation,propertyId:profile.home?.propertyId,...(surface?{supportId:surface.supportId}:{})};
 };
 const furniturePointer=event=>(canUseFurnitureSurface(furnitureMode)&&characterRenderer?.screenToFurnitureSurface?.(event.clientX,event.clientY,furnitureMode))||toWorld(event);
 const snappedFurniture=p=>{
  if(!furnitureSnap||surfaceForFurnitureAt(scene,furnitureMode,p,furnitureRotation))return p;
  const def=furnitureDimensions(furnitureMode),w=furnitureRotation%180&&!def.upright?def.height:def.width,h=furnitureRotation%180&&!def.upright?def.width:def.height;
  let x=p.x,y=p.y,bestX=13,bestY=13;
  const align=(candidate,axis)=>{const gap=Math.abs(candidate-p[axis]);if(gap<(axis==='x'?bestX:bestY)){if(axis==='x'){x=candidate;bestX=gap;}else{y=candidate;bestY=gap;}}};
  for(const boundary of [68+w/2,scene.width-68-w/2])align(boundary,'x');
  for(const boundary of [168+h/2,scene.height-118-h/2])align(boundary,'y');
  for(const wall of scene.walls||[]){
   if(p.y+h/2>wall.y&&p.y-h/2<wall.y+wall.h){align(wall.x-w/2-4,'x');align(wall.x+wall.w+w/2+4,'x');}
   if(p.x+w/2>wall.x&&p.x-w/2<wall.x+wall.w){align(wall.y-h/2-4,'y');align(wall.y+wall.h+h/2+4,'y');}
  }
  const candidate={x,y};return furniturePlacementFeedback(profile,furnitureMode,furniturePayload(candidate),{scene,checkRoutes:false}).valid?candidate:p;
 };
 const paintFurniture=p=>{
  if(!furnitureMode||furnitureSaving)return;
  furnitureCursor=snappedFurniture(p);furnitureFeedback=furniturePlacementFeedback(profile,furnitureMode,furniturePayload(furnitureCursor),{scene,checkRoutes:false});
  const def=furnitureDimensions(furnitureMode),box=furnitureFeedback.footprint||{x:furnitureCursor.x-def.width/2,y:furnitureCursor.y-def.height/2,w:def.width,h:def.height};
  ghost.innerHTML=`<ellipse rx="${Math.max(25,box.w/2+8)}" ry="${Math.max(15,box.h/2+8)}"/>${oblique?'':`<g transform="rotate(${furnitureRotation}) translate(${-def.width/2} ${-def.height/2})" opacity=".72">${furnitureGhost(furnitureMode).art}</g>`}`;
  ghost.setAttribute('transform',`translate(${furnitureCursor.x} ${furnitureCursor.y})`);ghost.classList.toggle('is-blocked',!furnitureFeedback.valid);
  characterRenderer?.setFurniturePreview?.({...furnitureFeedback.placement,itemId:furnitureMode,...box,rotation:furnitureRotation,elevation:furnitureFeedback.elevation||0},{valid:furnitureFeedback.valid});
  const feedback=container.querySelector('[data-furniture-feedback]');feedback.textContent=furnitureFeedback.message;
  container.querySelector('[data-world-control="place-furniture"]').disabled=!furnitureFeedback.valid;
  container.dataset.furniturePreview=JSON.stringify({itemId:furnitureMode,valid:furnitureFeedback.valid,placement:furnitureFeedback.placement,footprint:box,elevation:furnitureFeedback.elevation||0,cursor:furnitureCursor,renderer:oblique?'webgl-3d':'svg'});
 };
 const setFurnitureMode=(itemId,options={})=>{
  if(!atHome||!canDecorate||kind==='visit'||itemId&&!profile.inventory?.includes(itemId))return false;
  stop();orbit.stopMomentum();if(furnitureMode)characterRenderer?.setFurnitureHidden?.(furnitureMode,false);
  furnitureMode=itemId||null;furnitureSaving=false;container.dataset.furnitureMode=furnitureMode||'';
  container.querySelector('.world-furniture-toolbar').hidden=!furnitureMode;ghost.toggleAttribute('hidden',!furnitureMode);
  container.classList.toggle('is-arranging',!!furnitureMode);
  if(!furnitureMode){characterRenderer?.setFurniturePreview?.(null);delete container.dataset.furniturePreview;delete container.dataset.furnitureModelBounds;return true;}
  const own=scene.furniturePlacements?.find(item=>item.itemId===itemId);furnitureRotation=options.rotation??own?.rotation??0;
  characterRenderer?.setFurnitureHidden?.(itemId,true);
  container.querySelector('[data-furniture-name]').textContent=catalog.find(item=>item.id===itemId)?.name||'Your piece';
  let position=own?{x:own.x+own.w/2,y:own.y+own.h/2}:{x:player.x,y:player.y-130};
  if(!own&&!furniturePlacementFeedback(profile,itemId,furniturePayload(position),{scene,checkRoutes:false}).valid){
   search:for(let y=220;y<scene.height-145;y+=45)for(let x=110;x<scene.width-100;x+=45){const p={x,y};if(furniturePlacementFeedback(profile,itemId,furniturePayload(p),{scene,checkRoutes:false}).valid){position=p;break search;}}
  }
  paintFurniture(position);say('Drag your piece, turn it, then choose Place.');return true;
 };
 const confirmFurniture=async()=>{
  if(!furnitureMode||furnitureSaving||!furnitureCursor)return false;
  const result=furniturePlacementFeedback(profile,furnitureMode,furniturePayload(furnitureCursor),{scene});
  if(!result.valid){container.querySelector('[data-furniture-feedback]').textContent=result.message;say(result.message);return false;}
  furnitureSaving=true;container.querySelectorAll('.world-furniture-toolbar button').forEach(button=>button.disabled=true);
  try{const saved=await onInteract('place-furniture',{itemId:furnitureMode,...result.placement});if(saved!==false&&saved!==null&&saved!==undefined){if(!disposed)setFurnitureMode(null);return true;}if(!disposed){setFurnitureMode(null);say('Could not save that spot. Your piece is back where it was.');}return false;}
  finally{if(!disposed){furnitureSaving=false;container.querySelectorAll('.world-furniture-toolbar button').forEach(button=>button.disabled=false);paintFurniture(furnitureCursor);}}
 };
 const toWorld=e=>{
  if(streetOn()){const hit=characterRenderer?.screenToGround?.(e.clientX,e.clientY);
   // A tap on the sky has no ground point: stay put rather than walking to a guess.
   return hit&&Math.hypot(hit.x-player.x,hit.y-player.y)<2600?{x:clamp(hit.x,0,scene.width),y:clamp(hit.y,0,scene.height)}:{...player};}
  return screenToWorld({x:e.clientX,y:e.clientY},svg.getBoundingClientRect(),camera,viewport());
 };
 const updateViewport=()=>{
  if(disposed)return;
  const box=container.getBoundingClientRect(),view=worldViewport({pixelWidth:box.width,pixelHeight:box.height,sceneWidth:scene.width,sceneHeight:scene.height,interior,transit:!!trip,zoom,oblique,...orientation()});
  viewWidth=view.width;viewHeight=view.height;camera=constrainWorldCamera(camera,view,scene);
  if(oblique&&!preview){const screen=worldToScreen(player,{left:0,top:0,width:1,height:1},camera,view);if(screen.x<.15||screen.x>.85||screen.y<.12||screen.y>.88)camera=constrainWorldCamera({x:player.x,y:player.y-55},view,scene);}
  container.dataset.cameraZoom=zoom.toFixed(3);container.dataset.cameraYaw=orientation().yaw.toFixed(5);container.dataset.cameraElevation=orientation().elevation.toFixed(5);
  container.dataset.cameraViewWidth=viewWidth.toFixed(2);container.dataset.cameraViewHeight=viewHeight.toFixed(2);
  const target=orientation().targetZoom,streetLimits=streetOn();container.querySelector('[data-world-control="zoom-out"]').disabled=target<=(streetLimits?STREET_VIEW.minZoom:WORLD_ZOOM.min)+.0005;container.querySelector('[data-world-control="zoom-in"]').disabled=target>=(streetLimits?STREET_VIEW.maxZoom:WORLD_ZOOM.max)-.001;
 };
 const setZoom=(next,{announce=false,immediate=false}={})=>{
  if(streetOn())next=clamp(next,STREET_VIEW.minZoom,STREET_VIEW.maxZoom);
  orbit.setZoom(next,{immediate});zoom=orientation().zoom;updateViewport();
  if(announce)container.querySelector('.world-zoom-announcement').textContent=`Environment zoom ${Math.round(orientation().targetZoom*100)} percent`;remember();return orientation().targetZoom;
 };
 const resetZoom=()=>{
  if(!interior&&!trip){
   const box=container.getBoundingClientRect(),aspect=Math.max(.45,box.width/Math.max(1,box.height));
   const atOne=worldViewport({pixelWidth:box.width,pixelHeight:box.height,sceneWidth:scene.width,sceneHeight:scene.height,interior:false,transit:false,zoom:1,oblique,...orientation()});
   const fit=clampWorldZoom(atOne.baseWidth/Math.max(scene.width*1.32,scene.height*aspect*1.45));
   orbit.stopMomentum();orbit.setZoom(fit,{immediate:false});zoom=orientation().zoom;camera={x:scene.width/2,y:scene.height/2};updateViewport();remember();return fit;
  }
  orbit.reset({immediate:false});camera={x:interior?scene.width/2:player.x,y:interior?scene.height/2:player.y-55};updateViewport();remember();return 1;
 };
 const touch=bindWorldTouch({surface:svg,enabled:()=>!inputBlocked()&&!trip,orbit,placing:()=>!!furnitureMode,onStart:stop,onItemDrag:e=>paintFurniture(furniturePointer(e)),onZoom:next=>setZoom(next),onChange:()=>{zoom=orientation().zoom;updateViewport();}});
 on(svg,'click',e=>{
  if(inputBlocked()||trip||touch.blocksClick())return;const person=e.target.closest('[data-world-resident]');if(person){const resident=neighbours.find(p=>String(p.id)===person.dataset.worldResident);if(resident)onResident(resident);return;}
  const p=toWorld(e);if(furnitureMode){paintFurniture(furniturePointer(e));return;}
  const itemId=atHome&&canDecorate?characterRenderer?.pickFurniture?.(e.clientX,e.clientY):null;
  if(itemId){stop();onFurnitureSelect(itemId);return;}
  const target=e.target.closest('[data-world-target]');if(target){requestPoint(scene.interactables.find(point=>point.id===target.dataset.worldTarget));return;}moveTo(p.x,p.y);
 });
 on(container,'click',e=>{
  const prompt=e.target.closest('[data-world-context]');
  if(prompt){e.preventDefault();e.stopPropagation();if(!inputBlocked())requestPoint(scene.interactables.find(point=>point.id===prompt.dataset.pointId));return;}
  const control=e.target.closest('[data-world-control]')?.dataset.worldControl;if(!control)return;
  if(control==='exit'){
   e.preventDefault();e.stopPropagation();
   const exit=interiorExit(scene);
   if(!exit||exiting||activity||furnitureMode||inputBlocked())return;
   exiting=true;e.target.closest('button').disabled=true;stop();remember();
   dispatch(exit.action,exit.payload,()=>{exiting=false;if(!disposed)container.querySelector('[data-world-control="exit"]').disabled=false;});return;
  }
  if(control==='center'){orbit.stopMomentum();camera={...player};if(streetOn())orbit.setOrientation({yaw:streetFollowYaw(angle)},{immediate:false});container.focus({preventScroll:true});}
  if(control==='view-mode'){streetPreferred=!streetPreferred;writeStreetPreference(streetPreferred);orbit.stopMomentum();if(streetPreferred){orbit.setZoom(1,{immediate:true});orbit.setOrientation({yaw:streetFollowYaw(angle),elevation:undefined},{immediate:true});}zoom=orientation().zoom;updateViewport();say(streetPreferred?'Street view.':'Overview.');poke();}
  if(control==='zoom-in')setZoom(orientation().targetZoom*WORLD_ZOOM.step,{announce:true});
  if(control==='zoom-out')setZoom(orientation().targetZoom/WORLD_ZOOM.step,{announce:true});
  if(control==='zoom-fit')resetZoom();
  if(control==='interact'){if(driving)perform('toggle-driving');else if(nearby)requestPoint(nearby);else say('Walk up to a door or an object to interact.');}
  if(control==='rotate'&&furnitureMode){furnitureRotation=(furnitureRotation+90)%360;paintFurniture(furnitureCursor);}
  if(control==='snap'){furnitureSnap=!furnitureSnap;e.target.closest('button').setAttribute('aria-pressed',String(furnitureSnap));paintFurniture(furnitureCursor);}
  if(control==='cancel-furniture')setFurnitureMode(null);
  if(control==='place-furniture')void confirmFurniture();
  const nudges={'nudge-left':[-12,0],'nudge-right':[12,0],'nudge-forward':[0,-12],'nudge-back':[0,12]};
  if(nudges[control]&&furnitureMode){const [x,y]=nudges[control],vector=screenVectorToWorld({x,y},oblique,orientation());paintFurniture({x:furnitureCursor.x+vector.x,y:furnitureCursor.y+vector.y});}
 });
 const updateJoy=e=>{const rect=joyNode.getBoundingClientRect(),dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2),length=Math.hypot(dx,dy),max=rect.width*.32,limit=Math.min(length,max);joy.x=length>4?dx/length*limit/max:0;joy.y=length>4?dy/length*limit/max:0;joyKnob.style.transform=`translate(${joy.x*max}px,${joy.y*max}px)`;};
 on(container,'pointerdown',()=>poke());
 on(joyNode,'pointerdown',e=>{if(inputBlocked()||trip)return;e.preventDefault();container.focus({preventScroll:true});stop();orbit.stopMomentum();joy.pointer=e.pointerId;joyNode.setPointerCapture(e.pointerId);updateJoy(e);joyNode.classList.add('is-active');poke();});
 on(joyNode,'pointermove',e=>{if(joy.pointer===e.pointerId){e.preventDefault();updateJoy(e);}});
 const releaseJoy=e=>{if(e&&joy.pointer!==e.pointerId)return;joy.x=joy.y=0;joy.pointer=null;joyKnob.style.transform='translate(0,0)';joyNode.classList.remove('is-active');};
 on(joyNode,'pointerup',releaseJoy);on(joyNode,'pointercancel',releaseJoy);on(joyNode,'lostpointercapture',releaseJoy);
 const sprintButton=container.querySelector('[data-world-control="sprint"]');on(sprintButton,'pointerdown',e=>{e.preventDefault();sprinting=true;sprintButton.setPointerCapture(e.pointerId);sprintButton.classList.add('is-active');});for(const type of ['pointerup','pointercancel','lostpointercapture'])on(sprintButton,type,()=>{sprinting=false;sprintButton.classList.remove('is-active');});
 const movementKeys=['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'];
 on(window,'keydown',e=>{poke();const k=e.key.toLowerCase();if(inputBlocked())return;if(container.contains(e.target)&&['+','=','-','0'].includes(k)){e.preventDefault();if(k==='0')resetZoom();else setZoom(k==='-'?zoom/WORLD_ZOOM.step:zoom*WORLD_ZOOM.step,{announce:true});return;}if(trip)return;if(furnitureMode&&(k==='r'||k==='escape')){e.preventDefault();if(k==='escape')setFurnitureMode(null);else{furnitureRotation=(furnitureRotation+90)%360;paintFurniture(furnitureCursor);}return;}if(movementKeys.includes(k)||k==='shift'){e.preventDefault();container.focus({preventScroll:true});keyboard.add(k);if(k!=='shift'){stop();orbit.stopMomentum();}}if(k==='e'&&!e.repeat){e.preventDefault();if(driving)perform('toggle-driving');else if(nearby)requestPoint(nearby);}if((k==='enter'||k===' ')&&e.target.closest('[data-world-target]')){e.preventDefault();requestPoint(scene.interactables.find(p=>p.id===e.target.closest('[data-world-target]').dataset.worldTarget));}});
 on(window,'keyup',e=>keyboard.delete(e.key.toLowerCase()));
 const resetInput=()=>{sound?.setActive(false);keyboard.clear();releaseJoy();sprinting=false;touch.reset();sprintButton.classList.remove('is-active');lastTime=0;};
 let inViewport=true,pageActive=true,idleTimer=0,activeUntil=0;
 const playbackBlocked=()=>document.hidden||!pageActive||!inViewport||modalOpen();
 const armLoop=()=>{
  if(disposed||playbackBlocked())return;
  clearTimeout(idleTimer);idleTimer=0;
  container.dataset.renderPaused='false';
  if(!raf)raf=requestAnimationFrame(time=>tick(time));
 };
 const poke=()=>{activeUntil=performance.now()+500;armLoop();};
 const syncPlayback=()=>{
  if(disposed)return;
  if(playbackBlocked()){cancelAnimationFrame(raf);raf=0;clearTimeout(idleTimer);idleTimer=0;resetInput();container.dataset.renderPaused='true';}
  else armLoop();
 };
 on(window,'blur',resetInput);on(window,'focus',syncPlayback);
 on(document,'visibilitychange',()=>{resetInput();if(document.hidden)remember(true);syncPlayback();});
 on(window,'pagehide',()=>{pageActive=false;syncPlayback();});on(window,'pageshow',()=>{pageActive=true;syncPlayback();});
 // Observe only overlay roots. Watching world attributes would schedule work each frame.
 const overlayObserver=typeof MutationObserver!=='undefined'?new MutationObserver(syncPlayback):null;
 overlayObserver?.observe(document.body,{childList:true});
 for(const overlay of document.querySelectorAll('#sheet-root,#phone-root,.home-editor-root,dialog'))overlayObserver?.observe(overlay,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-hidden','aria-modal','open']});
 const visibilityObserver=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{inViewport=entries[0]?.isIntersecting!==false;syncPlayback();}):null;
 visibilityObserver?.observe(container);
 const resize=()=>updateViewport();
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(container);resize();
 const updatePlayer=(dx,dy,dt)=>{
  let blocked=false;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/9));for(let i=0;i<steps;i++){if(!nav.contains(player.x+dx/steps,player.y)){player.x+=dx/steps;}else blocked=true;if(!nav.contains(player.x,player.y+dy/steps)){player.y+=dy/steps;}else blocked=true;}
  const amount=Math.hypot(dx,dy);if(amount>.1){walkPhase+=dt*(sprinting||keyboard.has('shift')?15:10);travelDistance+=amount;angle=Math.atan2(dy,dx)*180/Math.PI;if(Math.abs(dx)>.2)dir=dx<0?-1:1;}return blocked;
 };
 let activityTimer=0;
 function finishActivity(){
  if(!activity||disposed)return;
  clearTimeout(activityTimer);activityTimer=0;
  const cb=activity.done;activity=null;
  container.removeAttribute('data-activity');container.removeAttribute('data-activity-object');container.removeAttribute('data-activity-progress');
  container.querySelector('.world-activity-prop')?.remove();statusNode.classList.remove('is-activity');
  say('A little better than before.');cb?.();
 }
 function paintActivity(){
  if(!activity||disposed)return;
  activity.elapsed=Math.max(0,performance.now()-activity.started);
  const progress=clamp(activity.elapsed/activity.duration,0,1);
  walkPhase+=.08;container.dataset.activityProgress=progress.toFixed(3);
  container.querySelector('.world-activity-progress')?.setAttribute('stroke-dashoffset',String(126*(1-progress)));
  statusNode.classList.add('is-activity');statusNode.style.setProperty('--activity-progress',String(progress));
  if(frameCount%20===0)say(`${activity.label} · ${Math.max(1,Math.ceil((activity.duration-activity.elapsed)/1000))}s`);
  if(progress>=1)finishActivity();
 }
 function armActivityClock(){
  clearTimeout(activityTimer);
  const step=()=>{activityTimer=0;if(disposed||!activity)return;paintActivity();if(activity)activityTimer=setTimeout(step,100);};
  activityTimer=setTimeout(step,100);
 }
 // Buildings and large fixtures stop the street camera; kerbs, lamps and trees do not.
 const cameraBlocked=(x,y)=>scene.obstacles.some(o=>o.w>=70&&o.h>=70&&x>o.x-6&&x<o.x+o.w+6&&y>o.y-6&&y<o.y+o.h+6);
 const placeStreetNode=(node,point,rect,{reach=1150,lift=0}={})=>{
  if(!node)return;
  const gap=distance(player,point),p=gap<=reach?characterRenderer?.projectWorld?.({x:point.x,y:point.y,elevation:lift}):null;
  const visible=!!p&&p.z>-1&&p.z<1&&p.x>rect.left-80&&p.x<rect.right+80&&p.y>rect.top-80&&p.y<rect.bottom+80;
  node.classList.toggle('is-out-of-view',!visible);
  if(visible)node.setAttribute('transform',`translate(${(p.x-rect.left).toFixed(1)} ${(p.y-rect.top).toFixed(1)}) scale(${clamp(380/(gap+250),.45,.85).toFixed(3)})`);
 };
 // In street view the SVG layer is a screen-space overlay: every interactive
 // marker keeps its node, label and click target, positioned by real projection.
 const projectStreetOverlay=()=>{
  const rect=container.getBoundingClientRect();
  for(const node of container.querySelectorAll('.world-point')){const point=scene.interactables.find(item=>item.id===node.dataset.worldTarget);if(point)placeStreetNode(node,point,rect);}
  if(parkedNode)placeStreetNode(parkedNode,parked,rect);
  for(const person of neighbours){const pose=residentPoses.get(String(person.id));if(pose)placeStreetNode(container.querySelector(`[data-world-resident="${CSS.escape(String(person.id))}"]`),pose,rect,{reach:1500});}
 };
 const setStreetShown=next=>{
  streetShown=next;streetDistance=0;container.dataset.streetView=next?'on':'off';
  const toggle=container.querySelector('[data-world-control="view-mode"]');
  if(toggle){toggle.setAttribute('aria-pressed',String(next));toggle.title=next?'Switch to overview':'Switch to street view';toggle.setAttribute('aria-label',next?'Street view on. Switch to overview camera':'Overview on. Switch to street view camera');}
  if(next)return;
  for(const node of container.querySelectorAll('.world-point')){const point=scene.interactables.find(item=>item.id===node.dataset.worldTarget);node.classList.remove('is-out-of-view');if(point)node.setAttribute('transform',`translate(${point.x} ${point.y})`);}
  if(parkedNode){parkedNode.classList.remove('is-out-of-view');parkedNode.setAttribute('transform',`translate(${parked.x} ${parked.y})`);}
  container.querySelectorAll('.world-online-resident.is-out-of-view').forEach(node=>node.classList.remove('is-out-of-view'));
 };
 const tick=time=>{
  raf=0;if(disposed)return;if(playbackBlocked()){syncPlayback();return;}const frameDt=lastTime?Math.min(1,(time-lastTime)/1000):0;let dt=Math.min(.12,frameDt);lastTime=time;frameCount++;
  const currentNow=now();if(Math.floor(currentNow/1000)!==lastClockSecond){lastClockSecond=Math.floor(currentNow/1000);clock=abujaTime(currentNow);weather=reportedWeather||seasonalWeather(currentNow);const musicButton=container.querySelector('.world-sound-toggle');if(musicButton){const closed=isClub&&!clubSchedule(currentNow).isOpen;musicButton.disabled=closed||profile.settings?.soundEnabled===false;if(closed){musicButton.textContent='DJ off duty';musicButton.title=clubSchedule(currentNow).openingHours;}else if(musicButton.textContent==='DJ off duty'){musicButton.textContent=isClub?'Music off':'Ambience off';musicButton.title=isClub?'Original club beats · tap to listen':'Original Abuja ambience · tap to listen';}}container.dataset.timeOfDay=clock.isNight?'night':'day';container.dataset.abujaTime=clock.label;container.dataset.weather=weather.condition||'clear';timeChip.innerHTML=`<time datetime="${new Date(currentNow).toISOString()}">${clock.label} WAT</time><span title="${escape(weather.label||'Seasonal game weather')}">${weather.condition==='rain'?'Rain':weather.condition==='cloudy'?'Cloudy':weather.condition==='hazy'?'Hazy':'Clear'} · ${Math.round(weather.temperatureC??28)}° <small>${weather.source==='seasonal-simulation'?'game weather':'weather'}</small></span>`;}
  if(oblique&&container.dataset.environmentRenderer!=='webgl-3d'){oblique=false;updateViewport();}
  const blocked=inputBlocked();sound.setActive(!blocked,!isClub||clubSchedule(currentNow).isOpen);if(blocked&&!preview)dt=0;elapsed+=dt;if(blocked){keyboard.clear();joy.x=joy.y=0;}
  const orbitState=orbit.tick(dt);zoom=orbitState.zoom;if(orbitState.changed)updateViewport();
  const old={...player};moving=false;
  if(!blocked&&!furnitureMode&&!activity){let dx=(keyboard.has('d')||keyboard.has('arrowright')?1:0)-(keyboard.has('a')||keyboard.has('arrowleft')?1:0)+joy.x,dy=(keyboard.has('s')||keyboard.has('arrowdown')?1:0)-(keyboard.has('w')||keyboard.has('arrowup')?1:0)+joy.y;
   const inputLength=Math.hypot(dx,dy);if(inputLength>.06){if(path.length)stop();dx/=Math.max(1,inputLength);dy/=Math.max(1,inputLength);const velocity=screenVectorToWorld({x:dx,y:dy},oblique,orientation()),velocityLength=Math.hypot(velocity.x,velocity.y);dx=velocity.x/Math.max(1,velocityLength);dy=velocity.y/Math.max(1,velocityLength);const run=sprinting||keyboard.has('shift')||Math.hypot(joy.x,joy.y)>.82;const speed=driving?(run?455:300):(run?212:127);updatePlayer(dx*speed*dt,dy*speed*dt,dt);}
   else if(path.length){
    // Slow WebGL frames must not stretch a short walk past the time a player
    // will wait. Follow the cleared route for up to half a second of real
    // time each frame, and interact as soon as the destination's own radius
    // is reached instead of abandoning the walk on a one-frame bump.
    const speed=driving?285:172;let budget=speed*Math.min(.5,frameDt),stalled=false;
    for(let hop=0;path.length&&budget>1&&hop<12;hop++){
     const target=path[0],gap=distance(player,target);
     if(gap<=Math.max(5,budget)){const last=path.shift();budget-=gap;player={x:last.x,y:last.y};updateRoute();}
     else {const before={...player};const collision=updatePlayer((target.x-player.x)/gap*budget,(target.y-player.y)/gap*budget,Math.min(.5,frameDt));budget=0;if(collision&&distance(before,player)<.1)stalled=true;}
    }
    const inReach=point=>distance(player,point)<(point.radius||75);
    if(pending&&inReach(pending)){const destination=pending;pending=null;path=[];updateRoute();activate(destination);}
    else if(stalled&&pending){
     const destination=pending,retry=routeRepairs<2?nav.path(player,destination):[];
     if(retry.length&&distance(player,retry[0])>6){routeRepairs++;path=retry;updateRoute();}
     else {pending=null;path=[];updateRoute();say('Try the clear path around that object.');}
    }else if(!path.length&&pending){const destination=pending;pending=null;updateRoute();if(inReach(destination))activate(destination);else say('That spot is out of reach. Try the open path.');}
   }
   moving=distance(old,player)>.05;
  }
  const street=streetOn();
  if(street&&moving&&!orbitState.dragging){
   // Ease the camera behind the direction of travel. Walking toward the lens is
   // left alone, otherwise camera-relative input would spin the resident.
   const current=orientation().yaw,wanted=easeYaw(current,streetFollowYaw(angle),1),turn=Math.abs(wanted-current);
   if(turn>.01&&(turn<2.1||path.length||driving)){const rate=driving?STREET_VIEW.followDrive:path.length?STREET_VIEW.followPath:STREET_VIEW.followWalk;orbit.setOrientation({yaw:easeYaw(current,wanted,1-Math.exp(-dt*rate))},{immediate:true});}
  }
  if(activity)paintActivity();
  else if(street){camera={x:player.x,y:player.y};}
  else if(!moving){camera=constrainWorldCamera({x:player.x,y:player.y-55},viewport(),scene);}
  else {const targetCam={x:player.x+(driving?Math.cos(angle*Math.PI/180)*100:0),y:player.y-55};const ease=1-Math.exp(-dt*(driving?4.5:6));camera.x+=(targetCam.x-camera.x)*ease;camera.y+=(targetCam.y-camera.y)*ease;camera=constrainWorldCamera(camera,viewport(),scene);}
  if(street!==streetShown)setStreetShown(street);
  if(street){const box=container.getBoundingClientRect();groundGroup.removeAttribute('transform');svg.setAttribute('viewBox',`0 0 ${Math.max(1,box.width).toFixed(0)} ${Math.max(1,box.height).toFixed(0)}`);}
  else{groundGroup.setAttribute('transform',worldFloorTransform(camera,viewport()));
  svg.setAttribute('viewBox',`${(camera.x-viewWidth/2).toFixed(2)} ${(camera.y-viewHeight/2).toFixed(2)} ${viewWidth.toFixed(2)} ${viewHeight.toFixed(2)}`);}
  playerNode.setAttribute('transform',`translate(${player.x.toFixed(2)} ${player.y.toFixed(2)})`);carNode.setAttribute('transform',`rotate(${angle.toFixed(2)})`);facingNode.setAttribute('transform',`scale(${dir} 1)`);
  const bob=moving?Math.abs(Math.sin(walkPhase*2))*1.7:Math.sin(elapsed*2)*.4;bodyNode.setAttribute('transform',`translate(0 ${-bob})`);legs.forEach((leg,i)=>leg.setAttribute('transform',`rotate(${moving?Math.sin(walkPhase+i*Math.PI)*18:0} ${i?7:-7} -27)`));arms.forEach((arm,i)=>arm.setAttribute('transform',`rotate(${moving?Math.sin(walkPhase+i*Math.PI)*-19:0} ${i?12:-12} -51)`));const facingAway=Math.sin(angle*Math.PI/180)<-.45;backHead.setAttribute('opacity',facingAway?'1':'0');frontFace.setAttribute('opacity',facingAway?'0':'1');
  if(activity){const t=activity.elapsed/1000;if(activity.name==='exercise'){bodyNode.setAttribute('transform',`translate(0 ${Math.sin(t*5)*6})`);arms[0].setAttribute('transform',`rotate(${-35-Math.sin(t*5)*65} -12 -51)`);arms[1].setAttribute('transform',`rotate(${35+Math.sin(t*5)*65} 12 -51)`);legs[0].setAttribute('transform',`rotate(${Math.sin(t*5)*12} -7 -27)`);legs[1].setAttribute('transform',`rotate(${-Math.sin(t*5)*12} 7 -27)`);}else if(activity.name==='eat'||activity.name==='groom'){arms[1].setAttribute('transform',`rotate(${-35-Math.sin(t*4)*40} 12 -51)`);}else if(activity.name==='rest'){bodyNode.setAttribute('transform',`translate(0 -5) rotate(-64 0 -25)`);}else if(activity.name==='walk'){bodyNode.setAttribute('transform',`translate(0 ${-Math.abs(Math.sin(t*8))*2})`);legs.forEach((leg,i)=>leg.setAttribute('transform',`rotate(${Math.sin(t*8+i*Math.PI)*20} ${i?7:-7} -27)`));}else if(activity.name==='shower'){bodyNode.setAttribute('transform',`translate(${Math.sin(t*3)} 0)`);} }
  const trafficPositions=[];
  for(let i=0;i<trafficNodes.length;i++){const t=scene.traffic[i],extent=t.axis==='x'?scene.width:scene.height,pos=((t.offset+elapsed*t.speed)%(extent+220)+(extent+220))%(extent+220)-110;trafficPositions.push({x:t.axis==='x'?pos:t.lane,y:t.axis==='x'?t.lane:pos,angle:t.axis==='x'?(t.speed<0?180:0):(t.speed<0?-90:90),color:t.color,type:t.type});trafficNodes[i].setAttribute('transform',`translate(${t.axis==='x'?pos:t.lane} ${t.axis==='x'?t.lane:pos}) rotate(${t.axis==='x'?(t.speed<0?180:0):(t.speed<0?-90:90)})`);}
  const npcPositions=[];
  for(let i=0;i<npcNodes.length;i++){const n=scene.pedestrians[i],length=Math.max(.01,Math.hypot(n.toX-n.x,n.toY-n.y)),cycle=(elapsed*(30+i*2)+i*112)%(length*2),progress=cycle>length?2-cycle/length:cycle/length;const node=npcNodes[i];npcPositions.push({x:n.x+(n.toX-n.x)*progress,y:n.y+(n.toY-n.y)*progress,angle:n.stationary?90:Math.atan2(n.toY-n.y,n.toX-n.x)*180/Math.PI+(cycle>length?180:0),moving:!n.stationary,phase:elapsed*7+i,elevation:n.elevation||0,activity:n.activity?{name:n.activity,elapsed:elapsed*1000}:null});node.setAttribute('transform',`translate(${n.x+(n.toX-n.x)*progress} ${n.y+(n.toY-n.y)*progress}) scale(.85)`);node.querySelector('.walker-facing').setAttribute('transform',`scale(${cycle>length?-1:1} 1)`);node.querySelectorAll('.walker-leg').forEach((leg,j)=>leg.setAttribute('transform',`rotate(${Math.sin(elapsed*7+i+j*Math.PI)*17} ${j?7:-7} -27)`));}
  for(const person of neighbours){
   const id=String(person.id),current=residentPoses.get(id),target=residentTargets.get(id);if(!current||!target)continue;
   const gap=Math.hypot(target.x-current.x,target.y-current.y),age=currentNow-(residentUpdatedAt.get(id)||currentNow);
   if(gap>720||age>10000){Object.assign(current,target);continue;}
   const smooth=1-Math.exp(-dt*9);current.x+=(target.x-current.x)*smooth;current.y+=(target.y-current.y)*smooth;
   const turn=((Number(target.angle||0)-Number(current.angle||0)+540)%360)-180;current.angle=Number(current.angle||0)+turn*smooth;
   current.moving=target.moving===true;current.driving=target.driving===true;if(target.activity)current.activity=target.activity;else delete current.activity;
  }
  let streetPose=null;
  if(street){
   const view=orientation(),raw=streetCameraPose({player,yaw:view.yaw,elevation:view.elevation,zoom:view.zoom,driving:transport,interior,blocked:interior?null:cameraBlocked});
   if(!streetDistance){streetDistance=raw.distance;streetTilt=raw.pitch;}
   streetDistance+=(raw.distance-streetDistance)*(1-Math.exp(-dt*5));
   streetTilt+=(raw.pitch-streetTilt)*(1-Math.exp(-dt*(raw.pitch>streetTilt?7:2.4)));
   streetPose=streetPoseAtDistance(raw,streetDistance,streetTilt);
  }
  if(!blocked||preview)characterRenderer?.draw({player,camera,width:viewWidth,height:viewHeight,orientation:orientation(),street:streetPose,angle,phase:walkPhase,time:elapsed,moving,transport,driving,activity,clock,weather,clubOpen:isClub&&clubSchedule(currentNow).isOpen,carColor,carStyle,ownVehicle,carWithYou,parked,trafficPositions,trip,npcPositions,onlinePositions:neighbours.map(person=>{const pose=residentPoses.get(String(person.id))||person.pose||{};return{...pose,phase:elapsed*8,activity:pose.activity?{name:pose.activity,elapsed:elapsed*1000}:null};})});
  if(frameCount%6===0&&roofEntries.length){
   const rect=container.getBoundingClientRect();
   for(const {button,point} of roofEntries){const p=characterRenderer?.projectWorld?.(point);const visible=p&&p.z>=-1&&p.z<=1&&p.x>rect.left+32&&p.x<rect.right-(street?74:32)&&p.y>rect.top+110&&p.y<rect.bottom-150&&!furnitureMode;
    button.hidden=!visible;if(visible){button.style.left=`${p.x-rect.left}px`;button.style.top=`${p.y-rect.top}px`;}}
  }
  if(frameCount%5===0||moving){nearby=scene.interactables.filter(p=>!driving||p.action==='toggle-driving').filter(p=>distance(player,p)<(p.radius||76)).sort((a,b)=>distance(player,a)-distance(player,b))[0]||null;container.querySelectorAll('.world-point').forEach(node=>node.classList.toggle('is-nearby',node.dataset.worldTarget===nearby?.id));interactButton.querySelector('span').textContent=driving?'Park & get out':nearby?.label||'Explore';interactButton.classList.toggle('is-ready',driving||!!nearby);container.dataset.playerX=player.x.toFixed(2);container.dataset.playerY=player.y.toFixed(2);container.dataset.cameraX=camera.x.toFixed(2);container.dataset.cameraY=camera.y.toFixed(2);const flat=worldToScreen(player,{left:0,top:0,width:container.clientWidth,height:container.clientHeight},camera,viewport()),seen=street?characterRenderer?.projectGround?.(player):null,origin=seen?container.getBoundingClientRect():null,screen=seen?{x:seen.x-origin.left,y:seen.y-origin.top}:flat;container.dataset.playerScreenX=screen.x.toFixed(2);container.dataset.playerScreenY=screen.y.toFixed(2);container.dataset.moving=String(moving);container.dataset.driving=String(driving);container.dataset.distance=travelDistance.toFixed(1);container.dataset.nearby=nearby?.id||'';const miniPlayer=container.querySelector('.world-minimap-player'),miniView=container.querySelector('.world-minimap-view');miniPlayer?.setAttribute('cx',String(player.x));miniPlayer?.setAttribute('cy',String(player.y));if(miniView){miniView.setAttribute('x',String(camera.x-viewWidth/2));miniView.setAttribute('y',String(camera.y-viewHeight/2));miniView.setAttribute('width',String(viewWidth));miniView.setAttribute('height',String(viewHeight));}if(moving&&!pending&&!trip)say(driving?'Windows down. The city is yours.':keyboard.has('shift')||sprinting?'Picking up the pace.':nearby?`${nearby.label} · press E to interact`:'Going places.');}
  if(street)projectStreetOverlay();
  else for(const person of neighbours){const pose=residentPoses.get(String(person.id)),node=container.querySelector(`[data-world-resident="${CSS.escape(String(person.id))}"]`);if(node&&pose)node.setAttribute('transform',`translate(${pose.x} ${pose.y})`);}
  if(frameCount%5===0){updateInteriorPrompt();const exitButton=container.querySelector('[data-world-control="exit"]');if(exitButton)exitButton.disabled=exiting||!!activity||!!furnitureMode||inputBlocked();}
  if(frameCount%60===0)remember();
  const standing=!moving&&!activity&&!trip&&!furnitureMode&&!path.length&&!joy.pointer&&!orbitState.active&&performance.now()>activeUntil;
  if(standing&&frameCount>6&&(preview||characterRenderer)){
   container.dataset.renderPaused='idle';
   const ambient=!preview&&!interior&&!playbackBlocked();
   idleTimer=setTimeout(armLoop,ambient?150:1000);
   return;
  }
  if(!playbackBlocked())raf=requestAnimationFrame(time=>tick(time));
 };
 function animateActivity(name,seconds=4,done,label) {
  poke();stop();const labels={eat:'Enjoying your meal',exercise:'Making time to move',rest:'Resting and recharging',sleep:'Sleeping and recharging',shower:'Freshening up',watch:'Enjoying the film',shop:'Choosing the essentials',walk:'Taking in the garden',groom:'A little self care',pray:'A quiet moment',social:'Making a connection',dance:'Finding your rhythm',dice:'Rolling the dice'};
  const targetKinds={sleep:['bed','king-bed'],rest:['sofa','premium-sofa','chair'],shower:['shower'],exercise:['treadmill','bench-press']};const object=(scene.objects||[]).filter(o=>(targetKinds[name]||[]).includes(o.kind)).sort((a,b)=>distance(player,{x:a.x+a.w/2,y:a.y+a.h/2})-distance(player,{x:b.x+b.w/2,y:b.y+b.h/2}))[0];
  activity={name,object,elapsed:0,started:performance.now(),duration:Math.max(1,seconds)*1000,done,label:label||labels[name]||'Taking a moment'};container.dataset.activity=name;container.dataset.activityObject=object?.kind||'';container.querySelector('.world-activity-prop')?.remove();
  const ns='http://www.w3.org/2000/svg',prop=document.createElementNS(ns,'g');prop.setAttribute('class','world-activity-prop');
  prop.innerHTML=`<g transform="translate(39 -67)"><circle r="21" fill="#f8f0dfe8"/><circle class="world-activity-progress" r="20" fill="none" stroke="#73966b" stroke-width="3" stroke-dasharray="126" stroke-dashoffset="126" transform="rotate(-90)"/><text y="5" text-anchor="middle" font-size="17" fill="#577d50">${{eat:'♨',exercise:'↗',rest:'z',sleep:'z',shower:'≋',watch:'▷',shop:'▱',walk:'♧',groom:'✦',pray:'·',social:'◌',dance:'♫',dice:'⚄'}[name]||'✦'}</text></g>${name==='shower'?'<g class="activity-water" stroke="#b5e2d9" stroke-width="2" stroke-linecap="round"><path d="M-15-93V-83M-5-101V-88M8-96V-80M18-87V-75M-13-76V-65M3-74V-61M16-64V-52"/></g>':''}${name==='shop'?'<path d="M20-35H39L36-14H23Z" fill="#d8b984"/><path d="M24-35V-41Q30-48 36-41V-35" fill="none" stroke="#93754f" stroke-width="2"/>':''}`;
  playerNode.append(prop);say(activity.label);armActivityClock();return true;
 }
 syncPlayback();
 requestAnimationFrame(mountCharacterRenderer);
 const cleanup=()=>{if(disposed)return;stop();disposed=true;remember(true);cancelAnimationFrame(raf);raf=0;clearTimeout(idleTimer);idleTimer=0;clearTimeout(activityTimer);activityTimer=0;activity=null;touch.dispose();overlayObserver?.disconnect();visibilityObserver?.disconnect();characterRenderer?.dispose();sound?.dispose();observer?.disconnect();listeners.forEach(remove=>remove());container.classList.remove('world-playable');};
 const furnitureStateKey=resident=>JSON.stringify([resident?.inventory||[],resident?.furnitureLayout||{},resident?.storedFurniture||[]]);
 let lastFurnitureState=furnitureStateKey(profile);
 cleanup.updateProfile=nextProfile=>{
  if(!nextProfile||nextProfile.id!==profile.id)return false;
  const nextFurnitureState=furnitureStateKey(nextProfile),furnitureChanged=nextFurnitureState!==lastFurnitureState;
  profile=nextProfile;lastFurnitureState=nextFurnitureState;
  if(!furnitureChanged||!atHome||trip||!['home','visit'].includes(kind))return true;
  const oldSpawn=scene.spawn;
  const nextScene=buildInterior({profile:kind==='visit'?{...profile,location:{...profile.location,kind:'home',venue:'home'}}:profile,venue:kind==='visit'?undefined:venue,id});
  nextScene.spawn=oldSpawn;nextScene.obstacles||=[];nextScene.interactables||=[];
  if(kind==='visit')nextScene.interactables.forEach(point=>{
   if(point.action==='leave-home'){point.action='leave-visit';point.label='Leave this home';return;}
   point.payload={...point.payload,visitAction:point.action,visitLabel:point.label};point.action='visit-interact';point.label=point.label?.replace(/^Arrange your home$/i,'Look around the room')||'Look around the room';
  });
  scene=nextScene;nav=makeNavigation(scene,driving?24:10);stop();path=[];nearby=null;
  player=fitPosition(player,scene.spawn,nav);camera=constrainWorldCamera(camera,viewport(),scene);
  svg.querySelector('.world-art').innerHTML=scene.art;
  container.querySelector('.world-markers').innerHTML=markerMarkup();
  const minimap=container.querySelector('.world-minimap svg');
  minimap.setAttribute('viewBox',`0 0 ${scene.width} ${scene.height}`);
  minimap.innerHTML=`${scene.obstacles.map(o=>`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="8" fill="#668269" opacity=".45"/>`).join('')}${scene.interactables.map(point=>`<circle cx="${point.x}" cy="${point.y}" r="${interior?12:22}" fill="#f4e6b8"/>`).join('')}<rect class="world-minimap-view" fill="#fbf5d31a" stroke="#f3f0d8" stroke-width="${interior?5:13}"/><circle class="world-minimap-player" r="${interior?19:33}" fill="#fff4c8" stroke="#55714e" stroke-width="${interior?5:10}"/>`;
  characterRenderer?.updateFurniture?.(scene);
  container.dataset.furnitureReconciled=String(Number(container.dataset.furnitureReconciled||0)+1);
  updateViewport();poke();return true;
 };
 cleanup.updateResidents=next=>{knownResidents=(Array.isArray(next)?next:[]).filter(p=>p.id!==profile.id&&p.online);const present=new Set(knownResidents.map(p=>String(p.id)));for(const id of [...residentPoses.keys()])if(!present.has(id)){residentPoses.delete(id);residentTargets.delete(id);residentUpdatedAt.delete(id);}for(const person of knownResidents){const id=String(person.id);if(usablePose(person.pose)){if(!residentPoses.has(id))residentPoses.set(id,{...person.pose});residentTargets.set(id,{...person.pose});residentUpdatedAt.set(id,now());}else if(Object.hasOwn(person,'pose')){residentPoses.delete(id);residentTargets.delete(id);residentUpdatedAt.delete(id);}}neighbours=knownResidents.filter(p=>usablePose(residentPoses.get(String(p.id)))).slice(0,50);container.querySelector('.world-online').innerHTML=neighbours.map(residentMarkup).join('');characterRenderer?.setResidents?.(neighbours);};
 cleanup.updateResidentPose=data=>{const id=String(data?.residentId||''),pose=data?.pose;if(!usablePose(pose))return false;const current=residentPoses.get(id),last=residentUpdatedAt.get(id)||0,gap=current?Math.hypot(pose.x-current.x,pose.y-current.y):Infinity;if(!current||gap>720||now()-last>10000)residentPoses.set(id,{...pose});residentTargets.set(id,{...pose});residentUpdatedAt.set(id,now());if(!neighbours.some(p=>String(p.id)===id)&&knownResidents.some(p=>String(p.id)===id))cleanup.updateResidents(knownResidents.map(p=>String(p.id)===id?{...p,pose}:p));return true;};
 cleanup.performDirect=(action,payload={},metadata)=>{
  if(preview||trip||activity||furnitureMode||disposed)return false;
  if(action==='venue-action'){
   const task=VENUE_ACTIONS.find(a=>a.id===payload.activityId&&a.venueId===venue?.id);
   if(!task)return false;
   stop();animateActivity(task.animation,task.duration,()=>dispatch(action,payload),task.name);return true;
  }
  if(['sleep','eat','shower','relax'].includes(action)&&kind==='home'&&metadata){
   stop();animateActivity(metadata.animation,metadata.duration,()=>dispatch(action,payload),metadata.name);return true;
  }
  if(['dealership','estate-office','banex-market','furniture-store','play-dice'].includes(action)&&kind==='venue'){stop();dispatch(action,payload);return true;}
  return false;
 };
 cleanup.walkTo=moveTo;cleanup.perform=perform;cleanup.performAsync=(action,payload={})=>new Promise(resolve=>{if(!perform(action,payload,resolve))resolve(false);});cleanup.setFurnitureMode=setFurnitureMode;cleanup.cancelNavigation=stop;cleanup.focus=()=>container.focus({preventScroll:true});cleanup.getFurnitureState=()=>({placed:[...container.querySelectorAll('[data-furniture-item],[data-home-item]')].map(n=>n.dataset.furnitureItem||n.dataset.homeItem).filter((id,i,a)=>a.indexOf(id)===i),stored:scene.storedFurniture||[],placements:scene.furniturePlacements||[]});// Guided tasks (street gigs) read the scene's own interaction points and ask for
 // a destination beacon. They never move the resident or change authoritative state.
 cleanup.getScenePoints=()=>scene.interactables.map(point=>({id:point.id,x:point.x,y:point.y,label:point.label,radius:point.radius||76}));
 cleanup.setWaypoint=point=>{waypoint=point&&Number.isFinite(point.x)&&Number.isFinite(point.y)?{x:point.x,y:point.y,color:point.color}:null;characterRenderer?.setBeacon?.(waypoint);poke();};
 cleanup.projectPoint=point=>{const rect=container.getBoundingClientRect(),seen=characterRenderer?.projectWorld?.(point);if(seen)return{x:seen.x-rect.left,y:seen.y-rect.top,visible:seen.z>-1&&seen.z<1,width:rect.width,height:rect.height};const flat=worldToScreen(point,{left:0,top:0,width:rect.width,height:rect.height},camera,viewport());return{...flat,visible:true,width:rect.width,height:rect.height};};
 cleanup.getMotionState=()=>({...player,angle,cameraX:camera.x,cameraY:camera.y,zoom,viewWidth,viewHeight,moving,driving,activity:activity?.name||null,pathLength:path.length,nearby:nearby?.id,travelDistance,scene:kind});cleanup.animateAction=animateActivity;cleanup.animateActivity=animateActivity;cleanup.setZoom=setZoom;cleanup.resetZoom=resetZoom;cleanup.getCameraState=()=>({x:camera.x,y:camera.y,...orientation(),zoom,width:viewWidth,height:viewHeight,oblique,minZoom:WORLD_ZOOM.min,maxZoom:WORLD_ZOOM.max});// Street view needs the real perspective projection; the flat overview maths would misplace name tags.
 cleanup.worldToScreen=point=>{if(streetOn()){const seen=characterRenderer?.projectWorld?.({x:point.x,y:point.y,elevation:point.elevation||0});if(seen)return seen.z>-1&&seen.z<1?{x:seen.x,y:seen.y}:{x:-9999,y:-9999};}return worldToScreen(point,svg.getBoundingClientRect(),camera,viewport());};
 return cleanup;
}

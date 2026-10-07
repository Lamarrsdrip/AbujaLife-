import {buildRouteScene} from './world-route-scene.js';
import {vehicleArt} from './world-city.js';
import {vehicleColorHex,vehicleFor} from '../src/shared/vehicles.mjs';
import {polylineMetrics,sampleRoutePolyline} from '../src/shared/abuja-navigation.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function routeD(points){return points.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');}
function destinationLabel(trip,place){if(trip?.returningHome)return 'Home';return trip?.venueId?String(trip.venueId).replaceAll('-',' '):place?.name||String(trip?.destination||'Destination').replaceAll('-',' ');}

/**
 * Renders an active authoritative trip through the shared Abuja road graph.
 * Server time owns journey completion. The browser only interpolates visuals;
 * no animation frame is persisted and network timing never snaps the car.
 */
export function renderTripWorld(container,{profile={},place={},serverNow,onArrive}={}){
 if(!container)return Object.assign(()=>{},{getMotionState:()=>({scene:'transit'})});
 const trip=profile.activeTrip;if(!trip)return Object.assign(()=>{},{getMotionState:()=>({scene:'transit'})});
 const scene=buildRouteScene({profile,place,trip,id:`trip-${trip.id||'route'}`}),points=scene.routePoints||[],metrics=polylineMetrics(points);
 const startClock=Number.isFinite(Number(serverNow))?Number(serverNow):Date.now(),startPerf=performance.now(),now=()=>startClock+(performance.now()-startPerf);
 const duration=Math.max(1,Number(trip.seconds)||30)*1000,startsAt=Number(trip.arrivesAt)-duration;
 const vehicleId=trip.vehicleId||profile.drivingVehicle||Object.keys(profile.vehicleColors||{})[0]||null;
 const color=trip.mode==='taxi'?'#cfb278':trip.mode==='bus'?'#d7c78c':vehicleColorHex(profile,vehicleId);
 const style=trip.mode==='bus'?'bus':trip.mode==='taxi'?'taxi':vehicleFor(vehicleId)?.bodyStyle||'sedan';
 const label=destinationLabel(trip,place),fullPath=routeD(points);
 let zoom=1,disposed=false,raf=0,lastFrame=0,arriving=false,visual=null,camera=null,angle=0;

 container.classList.add('world-canvas','world-playable','world-route-trip');container.dataset.sceneKind='transit';container.dataset.sceneName=scene.title;container.dataset.routeNodes=(scene.routeNodeIds||[]).join('>');
 container.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" class="world-scene world-public world-route-scene" viewBox="0 0 1050 650" role="group" aria-label="Driving to ${esc(label)} through Abuja"><title>${esc(scene.title)}</title><desc>This journey follows the calculated AbujaLife road route. The vehicle heading follows each road segment.</desc><g class="world-art">${scene.art}</g><g class="world-route is-active"><path class="world-route-line" d="${fullPath}"/><path class="world-route-progress" d="${fullPath}"/><g class="world-destination" transform="translate(${points.at(-1)?.x||0} ${points.at(-1)?.y||0})"><ellipse rx="18" ry="8"/><ellipse rx="7" ry="3"/></g></g><g class="world-player" data-world-player><ellipse class="world-player-halo" cy="5" rx="36" ry="14"/><g class="world-player-car">${vehicleArt(color,style,vehicleId)}</g></g></svg><div class="world-hud"><div class="world-location-chip"><i></i><span>${esc(label)}</span><small>${trip.mode==='walk'?'WALKING ROUTE':'DRIVING ROUTE'}</small></div><button class="world-camera-button" data-trip-center type="button" aria-label="Center route camera">⌖</button></div><div class="world-zoom-controls" role="group" aria-label="Route camera zoom"><button type="button" data-trip-zoom="out" aria-label="Zoom route out">−</button><button type="button" data-trip-zoom="fit" aria-label="Show more of the route">◇</button><button type="button" data-trip-zoom="in" aria-label="Zoom route in">+</button></div><div class="world-motion-status" aria-live="polite">Following the Abuja route to ${esc(label)}.</div><div class="world-simulation-label">REAL ROUTE · ${Math.max(1,scene.routeNodeIds?.length||0)} ROAD POINTS</div>`;
 const svg=container.querySelector('.world-scene'),player=container.querySelector('[data-world-player]'),car=container.querySelector('.world-player-car'),progressPath=container.querySelector('.world-route-progress'),status=container.querySelector('.world-motion-status');
 const pathLength=Math.max(1,progressPath?.getTotalLength?.()||metrics.length||1);if(progressPath){progressPath.style.strokeDasharray=String(pathLength);progressPath.style.strokeDashoffset=String(pathLength);}
 const listeners=[];const on=(target,type,fn,options)=>{target?.addEventListener(type,fn,options);listeners.push(()=>target?.removeEventListener(type,fn,options));};
 const resize=()=>paintViewport(true);let observer=null;

 function authoritativeProgress(){return clamp((now()-startsAt)/duration,0,1);}
 function paintViewport(immediate=false){
  if(!visual)return;const box=container.getBoundingClientRect(),aspect=Math.max(.55,(box.width||1050)/Math.max(1,box.height||650));
  const baseWidth=clamp(760/zoom,430,1800),baseHeight=baseWidth/aspect,target={x:visual.x+Math.cos(angle*Math.PI/180)*Math.min(150,baseWidth*.16),y:visual.y+Math.sin(angle*Math.PI/180)*Math.min(150,baseHeight*.16)};
  if(!camera||immediate)camera={...target};else{const dt=Math.min(.1,Math.max(0,(performance.now()-lastFrame)/1000)),ease=1-Math.exp(-4.6*dt);camera.x+=(target.x-camera.x)*ease;camera.y+=(target.y-camera.y)*ease;}
  const halfW=baseWidth/2,halfH=baseHeight/2;camera.x=clamp(camera.x,halfW,Math.max(halfW,scene.width-halfW));camera.y=clamp(camera.y,halfH,Math.max(halfH,scene.height-halfH));svg.setAttribute('viewBox',`${(camera.x-halfW).toFixed(2)} ${(camera.y-halfH).toFixed(2)} ${baseWidth.toFixed(2)} ${baseHeight.toFixed(2)}`);
 }
 function tick(time){
  raf=0;if(disposed)return;const rawProgress=authoritativeProgress(),sample=sampleRoutePolyline(points,rawProgress)||points[0]||{x:0,y:0,angle:0};
  const gap=visual?Math.hypot(sample.x-visual.x,sample.y-visual.y):Infinity,dt=lastFrame?Math.min(.12,(time-lastFrame)/1000):0;lastFrame=time;
  if(!visual||gap>650||dt===0)visual={x:sample.x,y:sample.y};else{const ease=1-Math.exp(-10*dt);visual.x+=(sample.x-visual.x)*ease;visual.y+=(sample.y-visual.y)*ease;}
  const turn=((Number(sample.angle||0)-angle+540)%360)-180;angle+=turn*(dt?1-Math.exp(-11*dt):1);
  player.setAttribute('transform',`translate(${visual.x.toFixed(2)} ${visual.y.toFixed(2)})`);car.setAttribute('transform',`rotate(${angle.toFixed(2)})`);
  if(progressPath)progressPath.style.strokeDashoffset=String(pathLength*(1-rawProgress));
  container.dataset.routeProgress=rawProgress.toFixed(4);container.dataset.playerX=visual.x.toFixed(2);container.dataset.playerY=visual.y.toFixed(2);container.dataset.cameraX=(camera?.x||visual.x).toFixed(2);container.dataset.cameraY=(camera?.y||visual.y).toFixed(2);container.dataset.moving='true';container.dataset.driving=String(trip.mode!=='walk');container.dataset.vehicleAngle=angle.toFixed(2);const model=player.getBoundingClientRect();container.dataset.playerModelBounds=JSON.stringify({x:model.x,y:model.y,width:model.width,height:model.height});
  paintViewport(false);
  const remaining=Math.max(0,Math.ceil((Number(trip.arrivesAt)-now())/1000));if(remaining>0&&remaining%3===0)status.textContent=`${remaining}s · driving to ${label}`;
  if(rawProgress>=1&&!arriving){arriving=true;status.textContent=`Arriving at ${label}…`;Promise.resolve(onArrive?.(trip.id)).then(ok=>{if(ok===false){arriving=false;if(!disposed)raf=requestAnimationFrame(tick);}}).catch(()=>{arriving=false;if(!disposed)raf=requestAnimationFrame(tick);});return;}
  raf=requestAnimationFrame(tick);
 }
 function center(){camera=null;paintViewport(true);}
 on(container,'click',event=>{const zoomAction=event.target.closest('[data-trip-zoom]')?.dataset.tripZoom;if(zoomAction==='in')zoom=clamp(zoom*1.22,.65,2.1);if(zoomAction==='out')zoom=clamp(zoom/1.22,.65,2.1);if(zoomAction==='fit')zoom=.72;if(zoomAction)paintViewport(true);if(event.target.closest('[data-trip-center]'))center();});
 on(document,'visibilitychange',()=>{lastFrame=0;if(!document.hidden&&!raf)raf=requestAnimationFrame(tick);});
 if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(resize);observer.observe(container);}
 const initial=sampleRoutePolyline(points,authoritativeProgress())||points[0]||{x:0,y:0,angle:0};visual={x:initial.x,y:initial.y};angle=initial.angle||0;paintViewport(true);raf=requestAnimationFrame(tick);
 const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer?.disconnect();listeners.forEach(remove=>remove());container.classList.remove('world-playable','world-route-trip');};
 cleanup.updateResidents=()=>{};cleanup.updateResidentPose=()=>false;cleanup.walkTo=()=>false;cleanup.perform=()=>false;cleanup.performAsync=async()=>false;cleanup.cancelNavigation=()=>{};cleanup.focus=()=>container.focus?.({preventScroll:true});cleanup.getMotionState=()=>({x:visual?.x||0,y:visual?.y||0,angle,cameraX:camera?.x||0,cameraY:camera?.y||0,zoom,moving:authoritativeProgress()<1,driving:trip.mode!=='walk',routeProgress:authoritativeProgress(),routeNodeIds:scene.routeNodeIds||[],scene:'transit'});cleanup.getCameraState=()=>({x:camera?.x||0,y:camera?.y||0,zoom});
 return cleanup;
}

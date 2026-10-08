import * as THREE from './vendor/three.module.js';
import {adSpaceAt,adSpacePage} from '../src/shared/advertising.mjs';
import {showGameToast as toast} from './game-toast.js';

const states=new WeakMap();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function bind(stage){
 if(states.has(stage))return;
 const state={yaw:.42,elevation:.82,orbit:false,pointers:new Map(),dragDistance:0};states.set(stage,state);
 stage.addEventListener('pointerdown',event=>{if(event.button>0)return;state.dragDistance=0;state.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});});
 stage.addEventListener('pointermove',event=>{const prior=state.pointers.get(event.pointerId);if(!prior)return;const dx=event.clientX-prior.x,dy=event.clientY-prior.y;prior.x=event.clientX;prior.y=event.clientY;state.dragDistance+=Math.abs(dx)+Math.abs(dy);if(state.orbit&&state.pointers.size===1){state.yaw+=dx*.006;state.elevation=clamp(state.elevation+dy*.004,.48,1.18);}});
 const release=event=>state.pointers.delete(event.pointerId);stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',event=>{state.dragDistance=100;release(event);});
 stage.addEventListener('click',event=>{
  if(!stage.isConnected||event.target.closest?.('button,input,select,a'))return;
  const shell=stage.closest('.outside-city');if(!shell||shell.classList.contains('is-journey'))return;
  // Eligible empty land is directly monetizable. The Advertise button now only
  // highlights inventory; residents do not have to discover a hidden mode first.
  if(state.dragDistance>10){state.dragDistance=0;return;}state.dragDistance=0;
  const selection=shell.querySelector('.outside-selection');
  // The native map picker already handled a landmark, venue or existing banner.
  // Only genuinely blank ground falls through to direct ad-land placement.
  if(selection&&!selection.hidden)return;
  const map=globalThis.__ABJ_MAP__,cameraState=map?.getCameraState?.();if(!cameraState)return;
  const rect=stage.getBoundingClientRect();if(rect.width<2||rect.height<2)return;
  let limits;try{limits=JSON.parse(shell.parentElement?.dataset.outsideLimits||shell.dataset.outsideLimits||'{}');}catch{limits={};}
  const width=Number(limits.width)||10400,depth=Number(limits.depth)||7600,aspect=rect.width/rect.height,base=Math.max(width,depth*aspect)*1.03,zoom=Math.max(.22,Number(cameraState.zoom)||.82),spanWidth=base/zoom,spanHeight=base/aspect/zoom;
  const camera=new THREE.OrthographicCamera(-spanWidth/2,spanWidth/2,spanHeight/2,-spanHeight/2,10,19000),elevation=Math.max(.2,state.elevation),distance=7200;
  camera.position.set(Number(cameraState.x)+Math.sin(state.yaw)*Math.cos(elevation)*distance,Math.sin(elevation)*distance,Number(cameraState.y)+Math.cos(state.yaw)*Math.cos(elevation)*distance);camera.lookAt(Number(cameraState.x),0,Number(cameraState.y));camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const ndc=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),ray=new THREE.Raycaster(),point=new THREE.Vector3(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);ray.setFromCamera(ndc,camera);if(!ray.ray.intersectPlane(ground,point))return;
  const space=adSpaceAt(point.x,point.z,'city-frontage');
  const exact=space&&point.x>=space.x&&point.x<space.x+space.width&&point.z>=space.y&&point.z<space.y+space.height;
  if(!exact){const status=shell.querySelector('.outside-status');if(status)status.textContent='That spot is reserved for a road or building. Tap another open plot nearby.';toast('That land is reserved. Choose another open plot nearby.');return;}
  const close=shell.closest('.abj-restored-map')?.querySelector('[data-restored-map-close]');close?.click();
  globalThis.dispatchEvent(new CustomEvent('abj:open-ad-studio',{detail:{kind:space.kind||'plot',plotId:space.id,zoneId:space.zoneId,page:adSpacePage(space.id)}}));
 });
}

function scan(){document.querySelectorAll('.outside-stage').forEach(bind);}
const observer=new MutationObserver(scan);observer.observe(document.documentElement,{subtree:true,childList:true});scan();

document.addEventListener('click',event=>{
 const action=event.target.closest?.('[data-outside-action]');if(!action)return;const shell=action.closest('.outside-city'),stage=shell?.querySelector('.outside-stage'),state=stage&&states.get(stage);if(!state)return;
 queueMicrotask(()=>{
  if(action.dataset.outsideAction==='mode')state.orbit=action.getAttribute('aria-pressed')==='true';
  if(action.dataset.outsideAction==='ads'){
   const enabled=action.getAttribute('aria-pressed')==='true';
   if(enabled){const selection=shell.querySelector('.outside-selection');if(selection&&!selection.hidden)selection.querySelector('[data-outside-action="close"]')?.click();}
   const status=shell.querySelector('.outside-status');if(status)status.textContent=enabled?'Advertising plots highlighted. Tap any eligible square to place an advert.':'Tap any eligible open-land square to place an advert.';
  }
 });
});

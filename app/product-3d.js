import * as THREE from './vendor/three.module.js';
import { buildThreeEnvironment } from './world-3d-scenes.js';
import { VEHICLE_COLORS, vehicleFor } from '../src/shared/vehicles.mjs';
import { buildInterior } from './world-interiors.js';
import { createCharacterModel } from './world-3d.js';
import { HOME_ITEM_MODELS } from '../src/shared/home-items.mjs';

// One reusable offscreen renderer makes actual model thumbnails. Shop cards use
// images, so browsing a catalogue does not hold eight live WebGL contexts open.
let renderer, failed=false;
const thumbnails=new Map();
const furniture={
  plant:['plant',44,38],bookshelf:['shelf',116,56],'lounge-chair':['chair',82,78],
  desk:['desk',164,75],'dining-table':['dining-table',205,170],sofa:['sofa',232,86],
  bed:['bed',170,214],fridge:['fridge',66,74],'floor-lamp':['floor-lamp',38,24],
  rug:['rug',224,142],tv:['tv',146,51],
  'portable-ac':['portable-ac',52,55],'power-inverter':['power-inverter',75,48],
  'premium-sofa':['premium-sofa',270,94],'king-bed':['king-bed',200,228],
  'pool-table':['pool-table',240,145],'gaming-console':['gaming-console',90,45],
  'bar-cart':['bar-cart',96,60],'art-piece':['art-piece',30,22],
  ...Object.fromEntries(Object.entries(HOME_ITEM_MODELS).map(([id,item])=>[id,[item.modelKind,item.width,item.depth,item]])),
};
function thumbnailKey(itemId,colorId,appearance={}) {
  return `${itemId}:${colorId||''}:${itemId.startsWith('wear:')?JSON.stringify(appearance):''}`;
}
function thumbnail(itemId,colorId,appearance={}) {
  const key=thumbnailKey(itemId,colorId,appearance);
  if(thumbnails.has(key))return thumbnails.get(key);
  if(failed)return null;
  const wear=itemId.startsWith('wear:')?itemId.slice(5):null;
  const car=vehicleFor(itemId),dimensions=furniture[itemId],house=itemId.startsWith('home:')?itemId.slice(5):null;
  if(!car&&!dimensions&&!house&&!wear)return null;
  let scene,model,sun;
  try {
    renderer||=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
    renderer.setSize(440,300,false);renderer.setPixelRatio(1);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.setClearColor(0x000000,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    scene=new THREE.Scene();
    const color=VEHICLE_COLORS.find(c=>c.id===(colorId||car?.defaultColor))?.hex||car?.colour;
    const resident=house?{home:{propertyId:house},location:{kind:'home'},inventory:[]}:null;
    model=wear?{group:createCharacterModel({skinTone:'brown',hair:wear==='linen-shirt'?'braids':'crop',presentation:wear==='linen-shirt'?'feminine':'masculine',...appearance,top:({'linen-shirt':'cream','office-shirt':'navy','traditional-set':'agbada'})[wear]||'forest',bottom:appearance.bottom||'charcoal',shoes:wear==='white-trainers'?'white':appearance.shoes||'white'})}:house?buildThreeEnvironment(THREE,{scene:buildInterior({profile:resident}),profile:resident,kind:'home'}):buildThreeEnvironment(THREE,{modelOnly:car?{...car,color}:{...dimensions[3],kind:dimensions[0],width:dimensions[1],depth:dimensions[2]}});
    scene.add(model.group);
    const bounds=new THREE.Box3().setFromObject(model.group),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const footwear=wear==='white-trainers';if(footwear)center.set(0,8,4);
    const span=footwear?49:Math.max(size.x,size.z,size.y*1.45)*1.15;
    const camera=new THREE.OrthographicCamera(-span*.74,span*.74,span*.505,-span*.505,.1,Math.max(5000,span*12));
    camera.position.copy(center).add(new THREE.Vector3(span*1.4,span*(house?1.7:.9),span*1.7));camera.lookAt(center.x,center.y-3,center.z);
    scene.add(new THREE.HemisphereLight('#fff3e0','#546655',1.9));
    sun=new THREE.DirectionalLight('#fff0dc',3);sun.position.copy(center).add(new THREE.Vector3(-span,span*2,span));sun.castShadow=true;
    sun.shadow.mapSize.set(512,512);sun.shadow.camera.left=-span;sun.shadow.camera.right=span;sun.shadow.camera.top=span;sun.shadow.camera.bottom=-span;sun.shadow.camera.near=.1;sun.shadow.camera.far=span*7;sun.shadow.bias=-.001;
    sun.target.position.copy(center);scene.add(sun,sun.target);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(span*2.6,span*2.6),new THREE.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-1;floor.receiveShadow=true;scene.add(floor);
    renderer.render(scene,camera);
    const url=renderer.domElement.toDataURL('image/png');
    thumbnails.set(key,url);while(thumbnails.size>80)thumbnails.delete(thumbnails.keys().next().value);
    return url;
  } catch {failed=true;release(renderer);renderer=undefined;return null;}
  finally {
    // Builders own texture pools; release those even when rendering or PNG
    // encoding throws. Deduplicate shared mesh resources during traversal.
    const owner=model?.dispose?model:model?.group?.dispose?model.group:null;
    if(owner){scene?.remove(model.group);release(owner);}
    const geometries=new Set(),materials=new Set();
    scene?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const material of Array.isArray(o.material)?o.material:[o.material])materials.add(material);});
    for(const geometry of geometries)release(geometry);
    for(const material of materials)release(material);
    release(sun?.shadow.map);release(renderer?.renderLists);
  }
}
function release(resource) {try {resource?.dispose?.();}catch {/* Keep releasing the remaining resources. */}}

const sessions=new WeakMap(),pending=new Set(),records=new Map(),pointers=new Set();
let observer,removals,initialized=false,scheduled,quietUntil=0;
const INPUT_PAUSE=140;
function remove(record) {
  pending.delete(record);records.delete(record.node);record.session.delete(record);
  observer?.unobserve(record.node);
  if(!pending.size)cancelScheduled();
}
function apply(record,url) {
  const {node,itemId,color}=record;
  if(!url||!node.isConnected||node.dataset.productModel!==itemId||node.dataset.productColor!==color)return;
  let img=node.querySelector('img[data-product-3d]');
  if(!img){img=document.createElement('img');img.dataset.product3d='true';img.alt=node.dataset.productName||vehicleFor(itemId)?.name||itemId.replaceAll('-',' ');img.style.cssText='display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2';node.style.position='relative';node.append(img);}
  img.src=url;node.dataset.productRenderer='webgl-3d';
  for(const child of node.children)if(child!==img)child.style.visibility='hidden';
}
function cancelScheduled() {
  if(!scheduled)return;
  const {kind,id}=scheduled;scheduled=undefined;
  if(kind==='idle')window.cancelIdleCallback(id);
  else if(kind==='frame')window.cancelAnimationFrame(id);
  else window.clearTimeout(id);
}
function schedule() {
  if(scheduled||!pending.size||document.hidden||pointers.size)return;
  const delay=quietUntil-Date.now();
  if(delay>0){scheduled={kind:'timer',id:window.setTimeout(()=>{scheduled=undefined;schedule();},delay)};return;}
  if(window.requestIdleCallback)scheduled={kind:'idle',id:window.requestIdleCallback(run,{timeout:500})};
  else scheduled={kind:'frame',id:window.requestAnimationFrame(()=>run())};
}
function run(deadline) {
  scheduled=undefined;
  if(document.hidden||pointers.size)return;
  if(Date.now()<quietUntil||(deadline&&!deadline.didTimeout&&deadline.timeRemaining()<8)){schedule();return;}
  // One actual model per idle slot; multiple catalogues share this queue.
  while(pending.size){
    const record=pending.values().next().value;
    pending.delete(record);
    if(!record.node.isConnected||record.node.dataset.productModel!==record.itemId||record.node.dataset.productColor!==record.color){remove(record);continue;}
    if(!observer&&!nearViewport(record.node))continue;
    apply(record,thumbnail(record.itemId,record.color,record.appearance));remove(record);break;
  }
  if(failed)for(const record of records.values())remove(record);
  else schedule();
}
function nearViewport(node) {
  const rect=node.getBoundingClientRect();
  return rect.bottom>=-160&&rect.top<=window.innerHeight+160&&rect.right>=0&&rect.left<=window.innerWidth;
}
function refreshFallback() {
  if(observer)return;
  for(const record of records.values())if(record.node.isConnected&&nearViewport(record.node))pending.add(record);else pending.delete(record);
}
function initialize() {
  if(initialized)return;initialized=true;
  if(window.IntersectionObserver)observer=new window.IntersectionObserver(entries=>{
    for(const entry of entries){
      const record=records.get(entry.target);if(!record)continue;
      if(!record.node.isConnected){remove(record);continue;}
      if(entry.isIntersecting)pending.add(record);else pending.delete(record);
    }
    if(!pending.size)cancelScheduled();else schedule();
  },{rootMargin:'160px 0px'});
  if(window.MutationObserver){
    removals=new window.MutationObserver(changes=>{
      if(!changes.some(change=>change.removedNodes.length))return;
      for(const record of records.values())if(!record.node.isConnected)remove(record);
    });
    removals.observe(document.documentElement,{childList:true,subtree:true});
  }
  const input=()=>{quietUntil=Date.now()+INPUT_PAUSE;cancelScheduled();refreshFallback();schedule();};
  for(const event of ['wheel','scroll','keydown','input'])window.addEventListener(event,input,{capture:true,passive:true});
  window.addEventListener('pointerdown',event=>{pointers.add(event.pointerId);input();},{capture:true,passive:true});
  const releasePointer=event=>{pointers.delete(event.pointerId);input();};
  for(const event of ['pointerup','pointercancel'])window.addEventListener(event,releasePointer,{capture:true,passive:true});
  window.addEventListener('blur',()=>{pointers.clear();input();});
  document.addEventListener('visibilitychange',()=>{cancelScheduled();pointers.clear();if(!document.hidden){refreshFallback();schedule();}});
}
export function enhanceProductPreviews(container,{appearance={}}={}) {
  if(!container)return;
  for(const record of sessions.get(container)||[])remove(record);
  const session=new Set();sessions.set(container,session);
  const nodes=container.querySelectorAll('[data-product-model]');
  if(!nodes.length)return;
  initialize();
  // Snapshot appearance so an old queued outfit cannot adopt later profile edits.
  const snapshot={...appearance};
  for(const node of nodes){
    if(records.has(node))remove(records.get(node));
    if(!node.isConnected)continue;
    const record={node,itemId:node.dataset.productModel,color:node.dataset.productColor,appearance:snapshot,session};
    const cached=thumbnails.get(thumbnailKey(record.itemId,record.color,snapshot));
    if(cached){apply(record,cached);continue;}
    if(failed)continue;
    session.add(record);records.set(node,record);
    if(observer)observer.observe(node);else if(nearViewport(node))pending.add(record);
  }
  schedule();
}

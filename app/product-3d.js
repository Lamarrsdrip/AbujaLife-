import * as THREE from './vendor/three.module.js';
import { buildThreeEnvironment } from './world-3d-scenes.js';
import { VEHICLE_COLORS, vehicleFor } from '../src/shared/vehicles.mjs';
import { buildInterior } from './world-interiors.js';
import { createCharacterModel } from './world-3d.js';

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
};
function thumbnail(itemId,colorId) {
  if(failed)return null;
  const key=`${itemId}:${colorId||''}`;
  if(thumbnails.has(key))return thumbnails.get(key);
  const car=vehicleFor(itemId),dimensions=furniture[itemId],house=itemId.startsWith('home:')?itemId.slice(5):null,wear=itemId.startsWith('wear:')?itemId.slice(5):null;
  if(!car&&!dimensions&&!house&&!wear)return null;
  try {
    renderer||=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
    renderer.setSize(440,300,false);renderer.setPixelRatio(1);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.setClearColor(0x000000,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene();
    const color=VEHICLE_COLORS.find(c=>c.id===(colorId||car?.defaultColor))?.hex||car?.colour;
    const resident=house?{home:{propertyId:house},location:{kind:'home'},inventory:[]}:null;
    const model=wear?{group:createCharacterModel({skinTone:'brown',hair:'crop',top:({'linen-shirt':'cream','office-shirt':'navy','traditional-set':'agbada'})[wear]||'forest',bottom:'charcoal',shoes:'white'})}:house?buildThreeEnvironment(THREE,{scene:buildInterior({profile:resident}),profile:resident,kind:'home'}):buildThreeEnvironment(THREE,{modelOnly:car?{...car,color}:{kind:dimensions[0],width:dimensions[1],depth:dimensions[2]}});
    scene.add(model.group);
    const bounds=new THREE.Box3().setFromObject(model.group),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const footwear=wear==='white-trainers';if(footwear)center.set(0,8,4);
    const span=footwear?49:Math.max(size.x,size.z,size.y*1.45)*1.15;
    const camera=new THREE.OrthographicCamera(-span*.74,span*.74,span*.505,-span*.505,.1,Math.max(5000,span*12));
    camera.position.copy(center).add(new THREE.Vector3(span*1.4,span*(house?1.7:.9),span*1.7));camera.lookAt(center.x,center.y-3,center.z);
    scene.add(new THREE.HemisphereLight('#fff3e0','#546655',1.9));
    const sun=new THREE.DirectionalLight('#fff0dc',3);sun.position.copy(center).add(new THREE.Vector3(-span,span*2,span));sun.castShadow=true;
    sun.shadow.mapSize.set(512,512);sun.shadow.camera.left=-span;sun.shadow.camera.right=span;sun.shadow.camera.top=span;sun.shadow.camera.bottom=-span;sun.shadow.camera.near=.1;sun.shadow.camera.far=span*7;sun.shadow.bias=-.001;
    sun.target.position.copy(center);scene.add(sun,sun.target);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(span*2.6,span*2.6),new THREE.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-1;floor.receiveShadow=true;scene.add(floor);
    renderer.render(scene,camera);
    const url=renderer.domElement.toDataURL('image/png');
    model.dispose?.();scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});sun.shadow.map?.dispose();
    thumbnails.set(key,url);while(thumbnails.size>80)thumbnails.delete(thumbnails.keys().next().value);
    return url;
  } catch {failed=true;renderer?.dispose();renderer=undefined;return null;}
}
export function enhanceProductPreviews(container) {
  if(!container)return;
  const nodes=[...container.querySelectorAll('[data-product-model]')];
  let i=0;
  function next() {
    if(i>=nodes.length)return;
    const node=nodes[i++];
    if(node.isConnected) {
      const itemId=node.dataset.productModel,color=node.dataset.productColor;
      const url=thumbnail(itemId,color);
      if(url&&node.isConnected&&node.dataset.productColor===color) {
        let img=node.querySelector('img[data-product-3d]');
        if(!img){img=document.createElement('img');img.dataset.product3d='true';img.alt=node.dataset.productName||vehicleFor(itemId)?.name||itemId.replaceAll('-',' ');img.style.cssText='display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2';node.style.position='relative';node.append(img);}
        img.src=url;node.dataset.productRenderer='webgl-3d';
        for(const child of node.children)if(child!==img)child.style.visibility='hidden';
      }
    }
    requestAnimationFrame(next);
  }
  requestAnimationFrame(next);
}

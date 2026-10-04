import * as THREE from './vendor/three.module.js';
import { buildInterior } from './world-interiors.js';
import { buildThreeEnvironment } from './world-3d-scenes.js';

export const HOME_IMAGE_MAX_BYTES = 512 * 1024;
const districtName = id => String(id || 'Abuja').replace(/-a\d+$/i,'').split('-').map(word=>/^(i|ii|iii|iv)$/i.test(word)?word.toUpperCase():word.charAt(0).toUpperCase()+word.slice(1)).join(' ');

export function defaultHomeCaption(profile = {}) {
  const home=profile.home || {}, name=home.name || 'my home', district=districtName(home.district || profile.district);
  const owned=new Set((profile.inventory || []).map(item=>typeof item==='string'?item:item.id || item.itemId));
  const placed=Object.keys(profile.furnitureLayout || {}).filter(id=>owned.has(id)).length;
  return `Hello from ${name} in ${district} 👋 This is my home in AbujaLife.${placed?` ${placed} ${placed===1?'piece':'pieces'} arranged my way.`:''} #AbujaLife`;
}

function fitCamera(camera,bounds,width,height) {
  const center=bounds.getCenter(new THREE.Vector3()), size=bounds.getSize(new THREE.Vector3());
  const span=Math.max(size.x,size.y,size.z,1), direction=new THREE.Vector3(1.12,1.65,1.42).normalize();
  camera.position.copy(center).addScaledVector(direction,span*4);camera.lookAt(center);camera.updateMatrixWorld(true);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
    const point=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
    minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
  }
  const aspect=width/height,halfHeight=Math.max((maxY-minY)/2,(maxX-minX)/(2*aspect))*1.07;
  camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.near=.1;camera.far=span*12;camera.updateProjectionMatrix();
  return {center,span};
}

function pngBytes(url) {return Math.floor((url.split(',')[1]?.length || 0)*3/4)-(url.endsWith('==')?2:url.endsWith('=')?1:0);}

/** Capture the player's actual authored home using the gameplay models and saved layout. */
export async function captureHomeImage({profile} = {}) {
  if(!profile?.id || !profile.home?.propertyId)throw new Error('Load your resident and home before taking a photo.');
  const owner=structuredClone(profile);
  owner.location={kind:'home',district:owner.home.district || owner.district,venue:'home'};
  const layout=buildInterior({profile:owner,id:'home-photo'});
  let renderer,environment,scene,sun;
  try {
    renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
    renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.setClearColor('#eeefe6',1);
    scene=new THREE.Scene();environment=buildThreeEnvironment(THREE,{scene:layout,profile:owner,kind:'home'});scene.add(environment.group);
    const bounds=new THREE.Box3().setFromObject(environment.group);
    if(bounds.isEmpty())throw new Error('Your home model is still loading. Try taking the photo again.');
    let width=960,height=680;
    const camera=new THREE.OrthographicCamera();
    const {center,span}=fitCamera(camera,bounds,width,height);
    scene.add(new THREE.HemisphereLight('#fff4dd','#5e705d',2.1));
    sun=new THREE.DirectionalLight('#fff0db',3);sun.position.copy(center).add(new THREE.Vector3(-span,span*2,span));sun.target.position.copy(center);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-span;sun.shadow.camera.right=span;sun.shadow.camera.top=span;sun.shadow.camera.bottom=-span;sun.shadow.camera.near=.1;sun.shadow.camera.far=span*6;sun.shadow.bias=-.0006;sun.shadow.normalBias=.8;
    scene.add(sun,sun.target);
    const rim=new THREE.DirectionalLight('#d6e0eb',.7);rim.position.copy(center).add(new THREE.Vector3(span,span,-span));scene.add(rim);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(span*2.4,span*2.4),new THREE.ShadowMaterial({opacity:.15}));ground.rotation.x=-Math.PI/2;ground.position.set(center.x,bounds.min.y-1,center.z);ground.receiveShadow=true;scene.add(ground);
    // A full synchronous render precedes each PNG read. This cannot capture a
    // cleared animation canvas or include phone/game controls in the image.
    for(let attempt=0;attempt<5;attempt++) {
      renderer.setSize(width,height,false);fitCamera(camera,bounds,width,height);renderer.render(scene,camera);
      const url=renderer.domElement.toDataURL('image/png');
      if(url.startsWith('data:image/png;base64,') && pngBytes(url)<=HOME_IMAGE_MAX_BYTES)return url;
      width=Math.floor(width*.78);height=Math.floor(height*.78);
    }
    throw new Error('This house photo is too large to share. Try again after simplifying your view.');
  } catch(error) {
    if(error?.message?.includes('home model') || error?.message?.includes('too large'))throw error;
    throw new Error('Your browser could not take a 3D home photo. Keep the game open and try again.');
  } finally {
    environment?.dispose?.();sun?.shadow?.map?.dispose();
    const geometries=new Set(),materials=new Set();scene?.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);});
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
    renderer?.dispose();renderer?.forceContextLoss();
  }
}

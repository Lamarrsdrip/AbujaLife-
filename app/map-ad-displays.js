import * as THREE from './vendor/three.module.js';
import {adSpaceFromId} from '../src/shared/advertising.mjs';

// The map consumes the existing paid campaigns. Unbooked virtual cells are
// selected by coordinates, never materialised as hundreds of thousands of meshes.
export function mapAdPlacements(campaigns=[],now=Date.now()){
 return campaigns.filter(ad=>Number(ad.endAt)>now).flatMap(ad=>(ad.slots||[]).flatMap(id=>{
  const space=adSpaceFromId(id);if(!space)return [];
  const legacy=space.zoneId?null:space.kind==='billboard'?{x:-1200+space.roadIndex*250,y:375,width:96,height:70}:{x:-4480+space.column*560,y:-3040+space.row*160,width:96,height:70};
  return [{...space,...legacy,key:`paid-ad:${id}`,campaign:ad,z:space.y??legacy.y}];
 }));
}
export function createMapAdDisplays(world,{now=Date.now,onChange=()=>{}}={}){
 const group=new THREE.Group();group.name='paid-city-displays';world.add(group);
 let textures=[],materials=[],geometries=[],disposed=false,version=0,placements=[];
 const clear=()=>{group.clear();textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());textures=[];materials=[];geometries=[];};
 function update(state){
  const current=++version;clear();placements=mapAdPlacements(state?.active,now());
  const byRef=new Map();
  for(const place of placements){
   const ad=place.campaign;let material=byRef.get(ad.txRef);
   if(!material){material=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false});byRef.set(ad.txRef,material);materials.push(material);
    if(/^data:image\/(?:png|jpeg|webp);base64,/.test(ad.imageDataUrl||'')){
     const texture=new THREE.TextureLoader().load(ad.imageDataUrl,()=>{if(disposed||current!==version){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;onChange();});
     texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;textures.push(texture);
    }
   }
   const geo=new THREE.PlaneGeometry(place.width,place.height),mesh=new THREE.Mesh(geo,material);geometries.push(geo);
   mesh.rotation.x=-Math.PI/2;mesh.position.set(place.x+place.width/2,8,place.z+place.height/2);
   mesh.userData.adSpaceId=place.id;mesh.userData.destinationKey=place.key;mesh.userData.campaignRef=ad.txRef;
   // Both city roofs/roads and surrounding blue use the same display layer.
   // Landmarks keep their real geometry and normal destination hit testing.
   group.add(mesh);
  }
  onChange();return placements;
 }
 return {group,update,get placements(){return placements;},dispose(){disposed=true;version++;clear();group.removeFromParent();}};
}

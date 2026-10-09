import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../app/vendor/three.module.js';
import {createMapAdParcels} from '../app/map-ad-parcels.js';
import {MAP_AD_INVENTORY,COMPATIBILITY_MAP_AD_INVENTORY} from '../src/shared/advertising.mjs';

function camera(x=0,z=0){const view=new THREE.OrthographicCamera(-6000,6000,4500,-4500,1,20000);view.position.set(x,9000,z);view.up.set(0,0,-1);view.lookAt(x,0,z);view.updateProjectionMatrix();view.updateMatrixWorld();return view;}
test('vacant map inventory stays bounded without creatives or fabricated campaigns',()=>{
 const world=new THREE.Group(),parcels=[...MAP_AD_INVENTORY,...COMPATIBILITY_MAP_AD_INVENTORY];let time=1000;
 const layer=createMapAdParcels(world,parcels,{now:()=>time,maxVisible:12});layer.setView(camera(),{width:1440,height:900});
 assert.equal(world.children.length,2);assert.equal(layer.diagnostics.visibleParcels,12);assert.equal(layer.diagnostics.totalParcels,parcels.length);assert.ok(parcels.length>=197,'authored and compatibility inventory remains available');
 assert.equal(world.children[0].material.opacity,.58,'available plots stay discoverable without expensive heavy fill');
 assert.equal(world.children[1].material.opacity,1,'plot boundaries stay crisp without floating labels');
 assert.ok(world.children[0].instanceColor,'tile fill has per-plot state colour');
 for(const mesh of world.children){assert.equal(mesh.material.map,null);assert.equal(mesh.userData.adParcelIds.length,mesh.count);}
 const picked=parcels[Math.min(150,parcels.length-1)].id;time+=250;layer.setView(camera(),{width:1440,height:900},{selectedId:picked,advertiseMode:true});
 assert.equal(world.children[0].material.opacity,.72,'advertise mode strengthens the tile without adding CTA cards');assert.equal(world.children[1].material.opacity,1);
 assert.equal(world.children[0].userData.adParcelIds[0],picked,'selected visible parcel keeps priority at rendering capacity');
 time+=250;layer.setView(camera(25000,25000),{width:1440,height:900});assert.equal(layer.diagnostics.visibleParcels,0);
 layer.dispose();layer.dispose();assert.equal(world.children.length,0);
});
test('phone rendering caps visible vacant parcels below the desktop budget',()=>{
 const world=new THREE.Group(),parcels=[...MAP_AD_INVENTORY,...COMPATIBILITY_MAP_AD_INVENTORY];
 const layer=createMapAdParcels(world,parcels,{maxVisible:96});layer.setView(camera(),{width:390,height:844});
 assert.ok(layer.diagnostics.visibleParcels<=64);layer.dispose();
});
test('native ray hits identify the exact visible parcel rather than arbitrary surrounding grass',()=>{
 const parcel=MAP_AD_INVENTORY[0],world=new THREE.Group();const layer=createMapAdParcels(world,[parcel]);
 const view=camera(parcel.x+parcel.width/2,parcel.y+parcel.height/2);layer.setView(view,{width:390,height:844});world.updateMatrixWorld(true);
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),view);
 const hit=ray.intersectObjects(world.children,true)[0];assert.ok(hit);assert.equal(hit.object.userData.adParcelIds[hit.instanceId],parcel.id);
 ray.setFromCamera(new THREE.Vector2(.5,.5),view);assert.equal(ray.intersectObjects(world.children,true).length,0);
 layer.dispose();
});
test('a deliberate tap still hits the new visible parcel after panning replaces the batch',()=>{
 const parcels=[{id:'first',x:0,y:0,width:300,height:200},{id:'second',x:3000,y:3000,width:300,height:200}],world=new THREE.Group();let time=1000;
 const layer=createMapAdParcels(world,parcels,{now:()=>time,maxVisible:1}),ray=new THREE.Raycaster();
 for(const parcel of parcels){
  const view=camera(parcel.x+parcel.width/2,parcel.y+parcel.height/2);
  view.left=-500;view.right=500;view.top=500;view.bottom=-500;view.updateProjectionMatrix();
  time+=250;layer.setView(view,{width:390,height:844});world.updateMatrixWorld(true);
  ray.setFromCamera(new THREE.Vector2(0,0),view);
  const hit=ray.intersectObjects(world.children,true)[0];
  assert.ok(hit,'the newly visible plot must remain tappable after an earlier tap populated cached bounds');
  assert.equal(hit.object.userData.adParcelIds[hit.instanceId],parcel.id);
 }
 layer.dispose();
});

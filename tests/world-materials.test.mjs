import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorldMaterialLibrary } from '../app/world-materials.js';
import { buildThreeEnvironment } from '../app/world-3d-scenes.js';

test('authored surfaces share resources within a scene, keep repeats independent and release once', () => {
  const a=createWorldMaterialLibrary(THREE),b=createWorldMaterialLibrary(THREE);
  const first=a.material('fabric','#b28b68'),same=a.material('fabric','#b28b68');
  assert.equal(first,same);assert.equal(first.map,a.texture('fabric'));
  const repeated=a.texture('wood',3,2),base=a.texture('wood');
  assert.equal(repeated,a.texture('wood',3,2));assert.notEqual(repeated,base);
  assert.deepEqual(base.repeat.toArray(),[1,1]);assert.deepEqual(repeated.repeat.toArray(),[3,2]);
  assert.deepEqual(base.image.data,b.texture('wood').image.data);
  assert.notEqual(base,b.texture('wood'));assert.equal(first.map.image.width,128);
  let released=0;first.addEventListener('dispose',()=>released++);base.addEventListener('dispose',()=>released++);
  a.dispose();assert.equal(released,2);assert.deepEqual(a.stats(),{textures:0,materials:0,size:128});b.dispose();
});

test('actual furniture groups stay pickable after batching and reuse the same model during a drag', t => {
  const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>null})};
  t.after(()=>{globalThis.document=previous;});
  const environment=buildThreeEnvironment(THREE,{kind:'home',scene:{width:1100,height:900,objects:[
    {kind:'sofa',itemId:'sofa',x:100,y:200,w:232,h:86,rotation:0,propertyId:'personal-home'}
  ],walls:[],floorAreas:[],furniturePlacements:[]}});
  const [owned]=environment.furnitureObjects();assert.equal(owned.userData.itemId,'sofa');
  environment.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(216,250,243*Math.SQRT2),new THREE.Vector3(0,-1,0));
  assert.ok(ray.intersectObject(owned,true).length,'owned item still has real mesh intersections');
  environment.setFurnitureHidden('sofa',true);assert.equal(owned.visible,false);
  const descriptor={itemId:'sofa',x:450,y:500,w:232,h:86,rotation:0};
  const ghost=environment.setFurniturePreview(descriptor,{valid:true});assert.equal(environment.furniturePreview(),ghost);
  const next=environment.setFurniturePreview({...descriptor,x:480},{valid:false});assert.equal(next,ghost);
  assert.equal(next.position.x,596);assert.equal(next.userData.valid,false);
  assert.ok(next.children.some(part=>part.name==='Placement validity'));
  environment.setFurniturePreview(null);assert.equal(environment.furniturePreview(),null);assert.equal(ghost.parent,null);
  environment.setFurnitureHidden('sofa',false);assert.equal(owned.visible,true);
  environment.dispose();
});

test('surface goods use their authoritative elevation and orbit cutaways keep distant walls full', t => {
  const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>null})};
  t.after(()=>{globalThis.document=previous;});
  const environment=buildThreeEnvironment(THREE,{kind:'home',scene:{width:1100,height:900,objects:[],walls:[],floorAreas:[],furniturePlacements:[]}});
  for(const kind of['table-lamp','vase','succulent','book-stack']){
    const item=environment.createFurnitureModel({itemId:kind,kind,x:100,y:200,w:40,h:32,elevation:36.5,supportId:'coffee-table'});
    assert.equal(item.position.y,36.5);assert.equal(item.userData.supportId,'coffee-table');
    assert.ok(new THREE.Box3().setFromObject(item).getSize(new THREE.Vector3()).y>10);
  }
  const walls=environment.group.children.filter(part=>part.userData.cameraCutaway);assert.equal(walls.length,4);
  environment.updateView({yaw:0,elevation:.6});assert.equal(walls[0].scale.y,1);assert.ok(walls[3].scale.y<.4);
  environment.updateView({yaw:Math.PI,elevation:.6});assert.ok(walls[0].scale.y<.4);assert.equal(walls[3].scale.y,1);
  environment.dispose();
});

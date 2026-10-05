import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../app/vendor/three.module.js';
import { createCharacter, animateCharacter } from '../app/world-character.js';
import { variedAppearance, ambientAppearance } from '../src/shared/avatars.mjs';
import { appearanceOptions } from '../src/shared/catalogue.mjs';
import { createWorldMaterialLibrary } from '../app/world-materials.js';

const dimensions = group => new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
test('new resident variety remains valid, diverse, customizable and limited to free first outfits', () => {
  const appearances=Array.from({length:120},()=>variedAppearance()),identities=new Set(appearances.map(value=>JSON.stringify(value)));
  assert.ok(identities.size>=110,'new accounts do not receive a repeated default avatar');
  for(const value of appearances)for(const [field,allowed] of Object.entries(appearanceOptions)){
    assert.ok(allowed.includes(value[field]),`${field} is accepted by the server`);
  }
  assert.ok(appearances.every(value=>['forest','ochre'].includes(value.top)),'no unpurchased outfit is gifted');
  assert.ok(new Set(appearances.map(value=>value.hair)).size>=6);
  assert.ok(new Set(appearances.map(value=>value.body)).size===3);
  assert.ok(new Set(appearances.map(value=>value.face)).size===3);
  for(const presentation of appearanceOptions.presentation)assert.equal(variedAppearance({presentation}).presentation,presentation);
  assert.throws(()=>variedAppearance({presentation:'forged'}),RangeError);
  assert.throws(()=>variedAppearance({randomInt:max=>max}),RangeError);
});

test('ambient pedestrians are stable across scene remounts with different individual identities', () => {
  const first=ambientAppearance('wuse-ii:market-pedestrian-0');
  assert.deepEqual(ambientAppearance('wuse-ii:market-pedestrian-0'),first);
  const citizens=Array.from({length:36},(_,index)=>ambientAppearance(`banex:pedestrian-${index}`));
  assert.equal(new Set(citizens.map(value=>JSON.stringify(value))).size,36);
  assert.ok(citizens.some(value=>value.presentation==='feminine'));
  assert.ok(citizens.some(value=>value.presentation==='masculine'));
});

test('actual male and female models have different human silhouettes without changing the animation joints', () => {
  const female=createCharacter({presentation:'feminine',hair:'braids'}),male=createCharacter({presentation:'masculine',hair:'crop'});
  try {
    const hips=rig=>rig.body.getObjectByName('Hips').children.find(part=>part.isMesh);
    assert.ok(dimensions(hips(female)).x>dimensions(hips(male)).x,'female pelvis has its own silhouette');
    assert.ok(Math.abs(male.arms[0].shoulder.position.x)>Math.abs(female.arms[0].shoulder.position.x),'male shoulders are broader');
    assert.equal(female.arms.length,2);assert.equal(male.legs.length,2);
    const slim=createCharacter({presentation:'feminine',body:'slim'}),broad=createCharacter({presentation:'feminine',body:'broad'});
    assert.ok(dimensions(hips(slim)).x<dimensions(hips(broad)).x);slim.dispose();broad.dispose();
    for(const rig of [female,male]) {
      animateCharacter(rig,{x:120,y:90,angle:90,time:0});rig.root.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(rig.root),size=bounds.getSize(new THREE.Vector3());
      assert.ok(Math.abs(bounds.min.y)<.05,'both soles rest on the actual game floor');
      assert.ok(size.y>100&&size.y<125,'full body keeps a human scale');
      assert.ok(size.x<size.y*.45,'human body is taller than it is wide');
      assert.equal(rig.root.position.x,120);assert.equal(rig.root.position.z,90/Math.SQRT1_2);
    }
  } finally {female.dispose();male.dispose();}
});

test('every selectable hairstyle has a real distinct silhouette and remains efficiently batched', () => {
  const silhouette=new Set();
  for(const hair of appearanceOptions.hair) {
    const rig=createCharacter({presentation:'feminine',hair});
    try {
      const group=rig.head.getObjectByName(`Hairstyle ${hair}`);
      const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
      if(hair==='bald')assert.equal(group.children.length,0);
      else {
        assert.ok(size.x>10&&size.y>3&&size.z>8,`${hair} has visible dimensional hair`);
        silhouette.add(size.toArray().map(value=>value.toFixed(1)).join(':'));
        const meshes=[];group.traverse(part=>{if(part.isMesh)meshes.push(part);});
        assert.ok(meshes.length<=3,`${hair} strands are merged instead of drawing a mesh per strand`);
      }
    } finally {rig.dispose();}
  }
  assert.equal(silhouette.size,appearanceOptions.hair.length-1,'different hair styles are not a shared cap');
});

test('activities keep their existing rig actions and heading damping is frame-rate independent', () => {
  for(const name of ['exercise','dance','pray','eat','groom','dice','social','sleep','shower','dj','rest','walk']) {
    const rig=createCharacter({presentation:'feminine',hair:'bun'});
    try {
      animateCharacter(rig,{x:100,y:100,time:1,activity:{name,elapsed:1000,object:{kind:name==='exercise'?'treadmill':'chair',x:120,y:130,w:80,h:50}}});
      assert.ok(rig.arms.some(arm=>Math.abs(arm.shoulder.rotation.x)+Math.abs(arm.shoulder.rotation.z)>.07)||name==='walk');
      rig.root.traverse(part=>assert.ok([...part.position.toArray(),...part.rotation.toArray().slice(0,3)].every(Number.isFinite),name+' contains no invalid transform'));
      assert.equal(rig.root.position.x,160,'action still binds to the target object');
    } finally {rig.dispose();}
  }
  const heading = fps => {
    const rig=createCharacter();
    animateCharacter(rig,{x:0,y:0,time:0,angle:90});
    for(let frame=1;frame<=fps/2;frame++)animateCharacter(rig,{x:0,y:0,time:frame/fps,angle:0});
    const result=rig.root.rotation.y;rig.dispose();return result;
  };
  assert.ok(Math.abs(heading(30)-heading(60))<.00001);
  assert.ok(Math.abs(heading(60)-heading(120))<.00001);
});

test('each character releases its authored surfaces once without disposing another resident or caller library', () => {
  const a=createCharacter({hair:'braids'}),b=createCharacter({hair:'long'}),textures=new Set();
  a.root.traverse(part=>{if(part.material?.map)textures.add(part.material.map);});
  assert.ok(textures.size>0,'clothes have original fabric texture');
  let released=0;for(const texture of textures)texture.addEventListener('dispose',()=>released++);
  a.dispose();a.dispose();assert.equal(released,textures.size);
  const shared=createWorldMaterialLibrary(THREE,{size:64});
  const c=createCharacter({}, {materials:shared});c.dispose();assert.ok(shared.stats().textures>0);
  b.dispose();shared.dispose();
});

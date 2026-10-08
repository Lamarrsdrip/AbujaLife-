import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeFurnitureLayout, furnitureForProperty, installPropertyFurnitureIsolation } from '../src/server/propertyFurnitureIsolation.mjs';

test('legacy unscoped placements are anchored to the home they were loaded in exactly once',()=>{
  const input={sofa:{x:.4,y:.5,rotation:0},bed:{x:.2,y:.3,rotation:90,propertyId:'home-a'},lamp:{slot:2}};
  const first=scopeFurnitureLayout(input,'home-a');
  assert.equal(first.changed,true);
  assert.equal(first.layout.sofa.propertyId,'home-a');
  assert.equal(first.layout.bed.propertyId,'home-a');
  assert.equal(first.layout.lamp.propertyId,'home-a');
  const replay=scopeFurnitureLayout(first.layout,'home-b');
  assert.equal(replay.changed,false);
  assert.equal(replay.layout.sofa.propertyId,'home-a');
});

test('property view never leaks old-home placements into a new home',()=>{
  const layout={sofa:{x:.2,y:.2,propertyId:'home-a'},bed:{x:.5,y:.5,propertyId:'home-b'},plant:{x:.8,y:.7,propertyId:'home-a'}};
  assert.deepEqual(Object.keys(furnitureForProperty(layout,'home-a')).sort(),['plant','sofa']);
  assert.deepEqual(Object.keys(furnitureForProperty(layout,'home-b')).sort(),['bed']);
});

test('legacy numeric slots are bound to their original property',()=>{
  const scoped=scopeFurnitureLayout({sofa:2},'home-a');
  assert.deepEqual(scoped.layout.sofa,{slot:2,propertyId:'home-a'});
  assert.deepEqual(furnitureForProperty(scoped.layout,'home-b'),{});
});

test('default owned furniture stays in its first home while stored items can be intentionally moved',async()=>{
  const profile={id:'resident-default',home:{propertyId:'home-a'},inventory:['sofa','bed','plant','car-corolla'],furnitureLayout:{},storedFurniture:['plant']};
  const store={
    async profile(){return structuredClone(profile);},
    collection(){return{async updateOne(_filter,update){profile.furnitureLayout=structuredClone(update.$set.furnitureLayout);return{matchedCount:1};}};},
    async action(_id,action,payload){if(action==='move-home')profile.home={propertyId:payload.propertyId};return{profile:structuredClone(profile)};}
  };
  installPropertyFurnitureIsolation(store);
  await store.action(profile.id,'move-home',{propertyId:'home-b'});
  const moved=await store.profile(profile.id);
  assert.equal(moved.furnitureLayout.sofa.propertyId,'home-a');
  assert.equal(moved.furnitureLayout.bed.propertyId,'home-a');
  assert.equal(moved.furnitureLayout.plant,undefined);
  assert.equal(moved.furnitureLayout['car-corolla'],undefined);
  assert.deepEqual(furnitureForProperty(moved.furnitureLayout,'home-b'),{});
});

test('a concurrent Studio edit wins over legacy furniture migration',async()=>{
  const stale={home:{propertyId:'home-a'},inventory:['sofa'],furnitureLayout:{sofa:{x:.2,y:.2}},storedFurniture:[]};
  const edited={...stale,furnitureLayout:{sofa:{x:.6,y:.5,propertyId:'home-a'}}};
  let reads=0;
  const store={async profile(){return structuredClone(reads++?edited:stale);},async action(){},collection(){return{async updateOne(filter){assert.deepEqual(filter.furnitureLayout,stale.furnitureLayout);return{matchedCount:0};}};}};
  installPropertyFurnitureIsolation(store);
  const profile=await store.profile('resident-edit');
  assert.deepEqual(profile.furnitureLayout,edited.furnitureLayout);
});

test('move-home scopes old placements before the actual home transition',async()=>{
  const profile={id:'resident-1',home:{propertyId:'home-a'},furnitureLayout:{sofa:{x:.3,y:.4}},storedFurniture:[]};
  const writes=[],actions=[];
  const store={
    async profile(){return structuredClone(profile);},
    collection(name){assert.equal(name,'homes');return{async updateOne(filter,update){writes.push({filter,update});profile.furnitureLayout=structuredClone(update.$set.furnitureLayout);}};},
    async action(_id,action,payload){actions.push({action,payload});if(action==='move-home')profile.home={propertyId:payload.propertyId};return{profile:structuredClone(profile)};}
  };
  installPropertyFurnitureIsolation(store);
  const result=await store.action('resident-1','move-home',{propertyId:'home-b'});
  assert.equal(writes.length,1);
  assert.equal(writes[0].update.$set.furnitureLayout.sofa.propertyId,'home-a');
  assert.equal(actions[0].action,'move-home');
  assert.equal(result.profile.home.propertyId,'home-b');
  assert.equal(profile.furnitureLayout.sofa.propertyId,'home-a');
});

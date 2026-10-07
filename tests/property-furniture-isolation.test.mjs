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

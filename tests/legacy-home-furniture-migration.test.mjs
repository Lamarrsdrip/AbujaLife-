import test from 'node:test';
import assert from 'node:assert/strict';
import { installFastLocationActions } from '../src/server/fastLocationActions.mjs';

function fixture() {
  const home={residentId:'resident-a',propertyId:'garki-studio',layoutId:'garki-studio'};
  const inventory=new Map();
  let originalActionCalls=0;
  const store={
    clock:()=>123456,
    async transaction(fn){return fn({id:'session'});},
    async emitUser(){},
    async action(){originalActionCalls++;return {ok:true};},
    async profile(id){return {id,home:{...home},inventory:[...inventory.keys()]};},
    collection(name){
      if(name==='inventory')return {
        async updateOne(query,update){
          if(!inventory.has(query.itemId))inventory.set(query.itemId,{residentId:query.residentId,itemId:query.itemId,...update.$setOnInsert});
          return {matchedCount:1,modifiedCount:1};
        },
      };
      if(name==='homes')return {
        async updateOne(query,update){Object.assign(home,update.$set||{});return {matchedCount:1,modifiedCount:1};},
      };
      if(name==='player_state'||name==='needs')throw new Error('Location collections should not be touched by profile migration');
      throw new Error(`Unexpected collection ${name}`);
    },
  };
  return {store,home,inventory,get originalActionCalls(){return originalActionCalls;}};
}

test('legacy baked home furniture becomes real owned inventory exactly once',async()=>{
  const f=fixture();
  installFastLocationActions(f.store);
  const first=await f.store.profile('resident-a');
  const expected=['bed','wardrobe','kitchen-unit','fridge','sofa','coffee-table','plant','floor-lamp'];
  for(const itemId of expected)assert.ok(first.inventory.includes(itemId),`${itemId} should become owned`);
  assert.equal(first.home.starterVersion,1);
  assert.equal(first.home.furnishingPreset,'nepo-furnished');
  assert.equal(first.legacyHomeFurnitureMigrated,true);
  assert.equal(f.inventory.size,expected.length);

  const second=await f.store.profile('resident-a');
  assert.equal(second.legacyHomeFurnitureMigrated,undefined);
  assert.equal(f.inventory.size,expected.length,'migration must be idempotent');
  assert.equal(f.originalActionCalls,0);
});

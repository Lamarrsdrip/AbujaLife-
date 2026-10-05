import test from 'node:test';
import assert from 'node:assert/strict';
import { installFastLocationActions } from '../src/server/fastLocationActions.mjs';

function fixture() {
  const rows={inventory:new Map(),home:{residentId:'resident-a',layoutId:'garki-studio',propertyId:'legacy-home'}};
  const store={
    clock:()=>123456,
    async transaction(fn){return fn({id:'session'});},
    collection(name){
      if(name==='inventory')return{
        async updateOne(query,update){
          if(!rows.inventory.has(query.itemId))rows.inventory.set(query.itemId,{...update.$setOnInsert});
          return{matchedCount:1,modifiedCount:1,upsertedCount:1};
        },
      };
      if(name==='homes')return{
        async updateOne(query,update){Object.assign(rows.home,update.$set);return{matchedCount:1,modifiedCount:1};},
      };
      throw new Error(`Unexpected collection ${name}`);
    },
    async profile(id){return{id,inventory:[],home:{propertyId:'legacy-home',layoutId:'garki-studio'},location:{kind:'home'},district:'lugbe'};},
    async action(){return{ok:true,delegated:true};},
  };
  return{store,rows};
}

test('legacy baked-in home pieces become durable resident-owned furniture exactly once',async()=>{
  const f=fixture();installFastLocationActions(f.store);
  const profile=await f.store.profile('resident-a');
  const expected=['bed','wardrobe','kitchen-unit','fridge','sofa','coffee-table','plant','floor-lamp'];
  assert.deepEqual(profile.inventory.sort(),[...expected].sort());
  assert.equal(profile.home.starterVersion,1);assert.equal(profile.home.furnishingPreset,'nepo-furnished');
  assert.equal(profile.legacyHomeFurnitureMigrated,true);
  assert.deepEqual([...f.rows.inventory.keys()].sort(),[...expected].sort());
  assert.equal(f.rows.home.starterVersion,1);
});

test('already migrated owned-furniture homes are read without touching migration collections',async()=>{
  let collectionCalls=0;
  const store={
    clock:()=>1,async transaction(fn){return fn({});},
    collection(){collectionCalls++;throw new Error('migration should not run');},
    async profile(id){return{id,inventory:['sofa'],home:{layoutId:'garki-studio',starterVersion:1,furnishingPreset:'nepo-furnished'}};},
    async action(){return{ok:true};},
  };
  installFastLocationActions(store);
  const profile=await store.profile('resident-b');
  assert.deepEqual(profile.inventory,['sofa']);assert.equal(collectionCalls,0);
});

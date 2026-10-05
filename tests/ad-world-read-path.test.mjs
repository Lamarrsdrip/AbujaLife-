import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoAdStore } from '../src/server/mongo/adStore.mjs';

test('public ad-map reads remain read-only and rely on bounded expiry-filtered queries', async () => {
  const calls=[];
  const rows={ad_slots:[],ad_orders:[]};
  const collection=name=>({
    deleteMany:async()=>{calls.push([name,'deleteMany']);return{deletedCount:0};},
    find:(filter,options={})=>({sort(){return this;},limit(){return this;},toArray:async()=>{calls.push([name,'find',filter,options]);return rows[name];}}),
    countDocuments:async filter=>{calls.push([name,'countDocuments',filter]);return 0;},
  });
  const db={collection};
  const store=new MongoAdStore({store:{db,transaction:async callback=>callback(null),clock:()=>Date.UTC(2026,9,5)},admin:{},payments:{provider(){},config(){}}});

  const world=await store.world();
  assert.equal(world.ok,true);assert.ok(world.spaces.length>0);
  assert.deepEqual(calls.filter(row=>row[1]==='deleteMany'),[]);
  assert.ok(calls.find(row=>row[0]==='ad_slots'&&row[1]==='find')[2].expiresAt.$gt instanceof Date);

  calls.length=0;
  assert.equal((await store.publicState()).enabled,true);
  assert.deepEqual(calls.filter(row=>row[1]==='deleteMany'),[]);
});

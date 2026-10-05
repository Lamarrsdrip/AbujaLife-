import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { connectMongo } from '../src/server/mongo/database.mjs';
import { MongoGameStore } from '../src/server/mongo/gameStore.mjs';
import { buildInterior } from '../app/world-interiors.js';
import { furnitureFootprint } from '../src/shared/furniture-placement.mjs';

const config=process.env.TEST_MONGODB_CONFIG?JSON.parse(fs.readFileSync(process.env.TEST_MONGODB_CONFIG,'utf8')):{};
const uri=process.env.TEST_MONGODB_URI||config.uri,database=process.env.TEST_MONGODB_DATABASE||config.database||'abujalife_prod';
const key=()=>crypto.randomUUID();
const integration=(name,fn)=>test(name,{skip:!uri?'Requires an authenticated MongoDB replica set':false},fn);
async function fixture(t){
  const connection=await connectMongo({uri,database,production:true});
  const store=new MongoGameStore({...connection,originRandomInt:(min,max)=>max===2?1:0});
  t.after(()=>connection.close());const suffix=crypto.randomBytes(5).toString('hex');
  const owner=await store.register({username:`furn_${suffix}`,password:'secure-test-password',appearance:{presentation:'feminine'}});
  const guest=await store.register({username:`guest_${suffix}`,password:'secure-test-password',appearance:{presentation:'masculine'}});
  return {connection,store,id:owner.residentId,guestId:guest.residentId};
}
const purchase=(f,itemId,idempotencyKey=key())=>f.store.action(f.id,'purchase',{itemId,idempotencyKey});
const place=(f,itemId,x=.4,y=.5,extra={})=>f.store.action(f.id,'place-furniture',{itemId,x,y,rotation:0,...extra});

integration('Mongo concurrent furniture purchase grants one real owned stored item and one immutable debit',async t=>{
  const f=await fixture(t),payload={itemId:'coffee-table',price:0,verified:true,idempotencyKey:key()};
  const bought=await Promise.all(Array.from({length:6},()=>f.store.action(f.id,'purchase',payload)));
  assert.ok(bought.every(result=>result.profile.wallet===9920000));
  const p=await f.store.profile(f.id);assert.deepEqual(p.inventory,['coffee-table']);assert.deepEqual(p.storedFurniture,['coffee-table']);
  assert.equal(await f.connection.db.collection('inventory').countDocuments({residentId:f.id,itemId:'coffee-table'}),1);
  assert.equal(await f.connection.db.collection('ledger').countDocuments({residentId:f.id,amount:-80000}),1);
  assert.equal(buildInterior({profile:p}).furniturePlacements.length,0);
  const secondConnection=await connectMongo({uri,database,production:true});t.after(()=>secondConnection.close());
  const restarted=new MongoGameStore({...secondConnection});const replay=await restarted.action(f.id,'purchase',payload);assert.equal(replay.replayed,true);assert.equal(replay.profile.wallet,9920000);
});

integration('Mongo enforces owned-home geometry and persists exact surface layouts across separate backend connections',async t=>{
  const f=await fixture(t);await purchase(f,'coffee-table');await purchase(f,'table-lamp');await purchase(f,'plant');
  await place(f,'coffee-table');const before=await f.store.profile(f.id);
  await assert.rejects(place(f,'plant'),error=>error.code==='furniture_object_overlap');
  await assert.rejects(place(f,'table-lamp',.4,.5,{supportId:'coffee-table',propertyId:'forged-home'}),error=>error.code==='furniture_wrong_home');
  await assert.rejects(f.store.action(f.guestId,'place-furniture',{itemId:'coffee-table',x:.4,y:.5,ownerId:f.id,inventory:['coffee-table']}),/Buy this furniture/);
  assert.deepEqual(await f.store.profile(f.id),before);assert.equal((await f.store.profile(f.guestId)).wallet,10000000);
  const result=await place(f,'table-lamp',.4,.5,{supportId:'coffee-table',elevation:90000});
  await place(f,'coffee-table',.6,.6,{rotation:90});const p=await f.store.profile(f.id);
  assert.equal(p.furnitureLayout['table-lamp'].propertyId,p.home.propertyId);assert.equal(p.furnitureLayout['table-lamp'].supportId,'coffee-table');assert.equal(p.furnitureLayout['table-lamp'].x,.6);assert.equal(p.furnitureLayout['table-lamp'].rotation,90);
  const stored=await f.connection.db.collection('homes').findOne({residentId:f.id});assert.deepEqual(stored.furnitureLayout,p.furnitureLayout);
  const secondConnection=await connectMongo({uri,database,production:true});t.after(()=>secondConnection.close());
  const restarted=new MongoGameStore({...secondConnection}),reloaded=await restarted.profile(f.id);assert.deepEqual(reloaded.furnitureLayout,p.furnitureLayout);assert.equal(reloaded.wallet,result.profile.wallet);
  const scene=buildInterior({profile:reloaded}),table=scene.furniturePlacements.find(item=>item.itemId==='coffee-table'),expected=furnitureFootprint(scene,'coffee-table',p.furnitureLayout['coffee-table']);assert.deepEqual({x:table.x,y:table.y,w:table.w,h:table.h},expected);
  assert.equal(scene.objects.find(item=>item.itemId==='table-lamp').elevation,36.5);
});

integration('Mongo storage and system resale keep supported items owned and never re-credit a sale',async t=>{
  const f=await fixture(t);await purchase(f,'coffee-table');await purchase(f,'ceramic-vase');await place(f,'coffee-table');await place(f,'ceramic-vase',.4,.5,{supportId:'coffee-table'});
  const stored=await f.store.action(f.id,'store-furniture',{itemId:'coffee-table'});assert.deepEqual(stored.profile.storedFurniture.sort(),['ceramic-vase','coffee-table']);assert.deepEqual(stored.profile.furnitureLayout,{});
  await place(f,'coffee-table');await place(f,'ceramic-vase',.4,.5,{supportId:'coffee-table'});const before=await f.store.profile(f.id),payload={itemId:'coffee-table',amount:999999999,idempotencyKey:key()};
  const sold=await f.store.action(f.id,'sell-item',payload);assert.equal(sold.profile.wallet,before.wallet+40000);assert.deepEqual(sold.profile.inventory,['ceramic-vase']);assert.deepEqual(sold.profile.storedFurniture,['ceramic-vase']);assert.deepEqual(sold.profile.furnitureLayout,{});
  const replay=await new MongoGameStore({...f.connection}).action(f.id,'sell-item',payload);assert.equal(replay.replayed,true);assert.equal(replay.profile.wallet,sold.profile.wallet);
  assert.equal(await f.connection.db.collection('ledger').countDocuments({residentId:f.id,amount:40000}),1);assert.equal(await f.connection.db.collection('inventory').countDocuments({residentId:f.id,itemId:'ceramic-vase'}),1);
});

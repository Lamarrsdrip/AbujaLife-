import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import {connectMongo} from '../src/server/mongo/database.mjs';
import {MongoGameStore} from '../src/server/mongo/gameStore.mjs';
import {MongoAdminStore} from '../src/server/mongo/adminStore.mjs';
import {MongoPaymentStore} from '../src/server/mongo/paymentStore.mjs';
import {MongoAdStore} from '../src/server/mongo/adStore.mjs';
import {installOkrikaHouseAds,attachOkrikaHouseAdRuntime} from '../src/server/okrikaHouseAds.mjs';
import {MAP_AD_INVENTORY,adSpaceFromId} from '../src/shared/advertising.mjs';

const config=process.env.TEST_MONGODB_CONFIG?JSON.parse(fs.readFileSync(process.env.TEST_MONGODB_CONFIG,'utf8')):{};
const uri=process.env.TEST_MONGODB_URI||config.uri,database=process.env.TEST_MONGODB_DATABASE||config.database||'abujalife_prod';
const key=()=>crypto.randomBytes(8).toString('hex');
const fixtureKeyFile=process.env.TEST_PAYMENT_KEY_FILE||(process.env.TEST_MONGODB_CONFIG?process.env.TEST_MONGODB_CONFIG+'.payment-key':null);
let fixtureKey=fixtureKeyFile&&fs.existsSync(fixtureKeyFile)?fs.readFileSync(fixtureKeyFile,'utf8').trim():crypto.randomBytes(32).toString('hex');
if(uri&&fixtureKeyFile&&!fs.existsSync(fixtureKeyFile))fs.writeFileSync(fixtureKeyFile,fixtureKey,{mode:0o600,flag:'wx'});

test('authenticated Mongo house ads preserve controls, atomic placements, paid priority and revenue separation',{
 skip:!uri?'Requires an authenticated disposable replica set through TEST_MONGODB_CONFIG or TEST_MONGODB_URI':false,
},async t=>{
 const connection=await connectMongo({uri,database,production:true});let backup;
 t.after(async()=>{try{if(backup)await connection.db.collection('ad_house_campaigns').updateOne({_id:backup._id},{$set:{campaigns:backup.campaigns},$inc:{version:1}});}finally{await connection.close();}});
 const now=Date.now(),store=new MongoGameStore({...connection,clock:()=>now,originRandomInt:()=>0});
 const ownerRegistration=await store.register({username:'h_owner_'+key().slice(0,10),password:'House ads replica password'});
 const ownerProfile=await store.profile(ownerRegistration.residentId),admin=new MongoAdminStore({store,bootstrapUsername:ownerProfile.username});await admin.init({ensureIndexes:false});
 const owner=(await connection.db.collection('admin_roles').findOne({role:'superadmin'})).residentId;
 const operator=await store.register({username:'h_op_'+key().slice(0,10),password:'House ads replica password'}),resident=await store.register({username:'h_user_'+key().slice(0,10),password:'House ads replica password'});
 await admin.assignRole(owner,{residentId:operator.residentId,role:'operator'});
 const payments=new MongoPaymentStore({store,admin,configKey:fixtureKey,publicOrigin:'https://game.example',fetchImpl:async()=>({ok:true,json:async()=>({status:'success',data:{link:'https://checkout.flutterwave.com/v3/hosted/pay/house-replica-fixture'}})})});await payments.init({ensureIndexes:false});
 const createAds=async()=>{const ads=new MongoAdStore({store,admin,payments});await ads.init({ensureIndexes:false});await installOkrikaHouseAds(ads,{database:connection});return ads;};
 const a=await createAds(),b=await createAds(),initial=await a.houseCampaigns({fresh:true});assert.equal(initial.length,20);
 backup=await connection.db.collection('ad_house_campaigns').findOne({_id:'okrika-house-inventory-v1'});assert.ok(backup);

 await t.test('runtime role can persist and reload the existing twenty non-billing campaigns',async()=>{
  const id=initial[0].id;await a.saveHouseCampaign(operator.residentId,{id,title:'Persisted premium Okrika',enabled:false});
  const restarted=await createAds(),inventory=await restarted.houseInventory(operator.residentId),row=inventory.campaigns.find(c=>c.id===id);
  assert.equal(row.title,'Persisted premium Okrika');assert.equal(row.enabled,false);assert.equal(inventory.billing,false);assert.equal(inventory.count,20);
  await a.saveHouseCampaign(operator.residentId,{id,title:initial[0].title,enabled:initial[0].enabled});
 });

 await t.test('two runtime instances cannot assign one new parcel to two enabled campaigns',async()=>{
  const used=new Set(initial.map(row=>row.slotId)),slotId=MAP_AD_INVENTORY.find(row=>!used.has(row.id)).id;
  const results=await Promise.allSettled([a.saveHouseCampaign(operator.residentId,{id:initial[0].id,slotId}),b.saveHouseCampaign(operator.residentId,{id:initial[1].id,slotId})]);
  assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(results.filter(row=>row.status==='rejected'&&row.reason.code==='house_slot_conflict').length,1);
  const restarted=await createAds(),rows=await restarted.houseCampaigns({fresh:true});assert.equal(rows.filter(row=>row.enabled&&row.slotId===slotId).length,1);
  const moved=rows.find(row=>row.slotId===slotId),original=initial.find(row=>row.id===moved.id);await a.saveHouseCampaign(operator.residentId,{id:moved.id,slotId:original.slotId});
 });

 await t.test('admin HTTP flow authenticates, rejects residents and cross-origin cookie writes, and persists changes',async()=>{
  const server=http.createServer((req,res)=>{res.writeHead(404);res.end();});
  attachOkrikaHouseAdRuntime(server,{ads:a,store,publicWebUrl:'https://house-ads.example'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
   const url=`http://127.0.0.1:${server.address().port}/api/admin/ads/house`,headers={authorization:'Bearer '+operator.token,'content-type':'application/json',origin:'https://house-ads.example'};
   assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:{authorization:'Bearer '+resident.token}})).status,403);
   const listed=await fetch(url,{headers});assert.equal(listed.status,200);assert.equal((await listed.json()).campaigns.length,20);
   assert.equal((await fetch(url,{method:'POST',headers:{cookie:'abujalife_session='+operator.token,'content-type':'application/json'},body:JSON.stringify({id:initial[2].id,enabled:false})})).status,403);
   const saved=await fetch(url,{method:'POST',headers,body:JSON.stringify({id:initial[2].id,enabled:false})});assert.equal(saved.status,200);assert.equal((await saved.json()).campaign.enabled,false);
   const restarted=await createAds();assert.equal((await restarted.houseInventory(operator.residentId)).campaigns.find(row=>row.id===initial[2].id).enabled,false);
   await a.saveHouseCampaign(operator.residentId,{id:initial[2].id,enabled:initial[2].enabled});
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 });

 await t.test('house administration leaves financial orders, receipts, revenue and game money untouched',async()=>{
  const before={orders:await connection.db.collection('ad_orders').countDocuments(),receipts:await connection.db.collection('ad_receipts').countDocuments(),revenue:await a.revenue(),wallet:(await store.profile(operator.residentId)).wallet};
  await a.saveHouseCampaign(operator.residentId,{id:initial[3].id,title:'A non-billing house campaign'});
  assert.equal(await connection.db.collection('ad_orders').countDocuments(),before.orders);assert.equal(await connection.db.collection('ad_receipts').countDocuments(),before.receipts);
  assert.deepEqual(await a.revenue(),before.revenue);assert.equal((await store.profile(operator.residentId)).wallet,before.wallet);
  const inventory=await a.inventory(operator.residentId);assert.equal(inventory.houseCampaigns.length,20);assert.deepEqual(inventory.revenue,before.revenue);
 });

 await t.test('a real pending ad checkout suppresses house fill without claiming paid revenue',async()=>{
  const settings=connection.db.collection('payment_config'),preferences=connection.db.collection('payment_preferences'),priorSettings=await settings.findOne({_id:'test'}),priorPreference=await preferences.findOne({_id:'active-mode'});
  try{
  await payments.configure(owner,{mode:'test',enabled:true,creditRate:10,publicOrigin:'https://game.example',secretKey:'FLWSECK_TEST-house-replica-secret-000000000',webhookSecret:'house-replica-signing-secret',activate:true});
  const row=(await a.houseCampaigns({fresh:true}))[0],space=adSpaceFromId(row.slotId),revenue=await a.revenue(),wallet=(await store.profile(operator.residentId)).wallet;
  // Warm the lock cache first; successful checkout must invalidate it.
  assert.ok((await a.world({bounds:{x:space.x,y:space.y,width:space.width,height:space.height}})).active.some(c=>c.id===row.id));
  const order=(await a.checkout(operator.residentId,{kind:'plot',slots:[row.slotId],title:'Disposable paid reservation',link:'https://house-ads.example/',imageDataUrl:'data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,64,0,0,0,64]).toString('base64'),email:'house-ads@example.test',idempotencyKey:key()})).checkout;
  try{
   assert.equal(order.status,'pending');assert.equal((await connection.db.collection('ad_slots').findOne({_id:row.slotId})).state,'reserved');
   const world=await a.world({bounds:{x:space.x,y:space.y,width:space.width,height:space.height}});assert.ok(!world.active.some(c=>c.id===row.id));assert.ok(!world.housePlacements.some(c=>c.campaignId===row.campaignId));
   const restarted=await createAds();assert.ok(!(await restarted.publicState()).active.some(c=>c.id===row.id));
   assert.deepEqual(await a.revenue(),revenue);assert.equal((await store.profile(operator.residentId)).wallet,wallet);assert.equal(await connection.db.collection('ad_receipts').countDocuments({txRef:order.txRef}),0);
  }finally{await connection.db.collection('ad_slots').updateOne({_id:row.slotId,txRef:order.txRef},{$set:{expiresAt:new Date(0)}});await a.purgeExpiredSlots();}
  }finally{
   if(priorSettings)await settings.replaceOne({_id:'test'},priorSettings);else await settings.deleteOne({_id:'test'});
   if(priorPreference)await preferences.replaceOne({_id:'active-mode'},priorPreference);else await preferences.deleteOne({_id:'active-mode'});
  }
 });
});

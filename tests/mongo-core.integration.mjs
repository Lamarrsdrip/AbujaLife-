import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { connectMongo } from '../src/server/mongo/database.mjs';
import { MongoGameStore, catalog, jobs, properties } from '../src/server/mongo/gameStore.mjs';
import { MongoSocialStore } from '../src/server/mongo/socialStore.mjs';
import { MongoAuthStore, hashToken } from '../src/server/mongo/authStore.mjs';
import { GAME_YEAR_MS, GAME_BILL_PERIOD_MS, INVESTMENT_META, LOAN_META } from '../src/shared/life.mjs';

const configFile=process.env.TEST_MONGODB_CONFIG;
const config=configFile?JSON.parse(fs.readFileSync(configFile,'utf8')):{};
const uri=process.env.TEST_MONGODB_URI||config.uri;
const database=process.env.TEST_MONGODB_DATABASE||config.database||'abujalife_prod';
const key=()=>crypto.randomUUID();
const rejectCode=(promise,code)=>assert.rejects(promise,error=>error.code===code);
async function fixture(t,{origin='lapo'}={}){
  const connection=await connectMongo({uri,database,production:true});let now=Date.parse('2026-10-05T09:00:00Z');
  const store=new MongoGameStore({...connection,clock:()=>now,originRandomInt:(min,max)=>max===2?(origin==='lapo'?1:0):0});
  t.after(()=>connection.close());const suffix=crypto.randomBytes(5).toString('hex');
  const ada=await store.register({username:`ada_${suffix}`,displayName:'Ada',password:'secure-test-password'}),bello=await store.register({username:`bello_${suffix}`,displayName:'Bello',password:'secure-test-password',email:`${suffix}@example.test`});
  return{store,connection,ada,bello,get now(){return now;},advance(ms){now+=ms;},at(time){now=Date.parse(time);}};
}
async function travel(f,id,district){let p=await f.store.profile(id);if(p.location.kind==='home')await f.store.action(id,'leave-home');if(p.location.kind==='venue')await f.store.action(id,'exit-venue');if(p.district===district)return;const {trip}=await f.store.action(id,'travel',{district,mode:'bus',idempotencyKey:key(),cost:0,seconds:0});f.advance(trip.seconds*1000);await f.store.action(id,'arrive',{tripId:trip.id});}
const integration=(name,fn)=>test(name,{skip:!uri?'Requires TEST_MONGODB_URI or TEST_MONGODB_CONFIG for a real authenticated replica set':false},fn);

integration('Mongo registration persists normalized Lapo/Nepo origins and hashed credentials/sessions',async t=>{
  const f=await fixture(t),p=await f.store.profile(f.ada.residentId);assert.equal(p.wallet,10000000);assert.equal(p.origin.id,'lapo');assert.equal(p.home.furnishingPreset,'lapo-basic');assert.deepEqual(p.inventory,[]);
  const resident=await f.connection.db.collection('residents').findOne({id:p.id});assert.ok(resident.passwordHash.startsWith('scrypt$32768$'));assert.equal(resident.password,undefined);assert.equal(resident.profile,undefined);assert.equal(resident.wallet,undefined);
  const session=await f.connection.db.collection('sessions').findOne({residentId:p.id});assert.equal(session._id,hashToken(f.ada.token));assert.equal(JSON.stringify(session).includes(f.ada.token),false);assert.equal(await f.store.session(f.ada.token),p.id);
  const other=new MongoGameStore({...f.connection});assert.equal((await other.profile(p.id)).wallet,10000000);assert.equal((await other.login({username:p.username,password:'secure-test-password'})).residentId,p.id);const email=await f.connection.db.collection('residents').findOne({id:f.bello.residentId},{projection:{email:1}});assert.equal((await other.login({email:email.email,password:'secure-test-password'})).residentId,f.bello.residentId);
  await rejectCode(other.login({username:p.username,password:'wrong-password'}),'invalid_credentials');
  const nepo=await fixture(t,{origin:'nepo'}),n=await nepo.store.profile(nepo.ada.residentId);assert.equal(n.wallet,100000000);assert.equal(n.home.furnishingPreset,'nepo-furnished');assert.deepEqual(n.inventory.sort(),['bed','sofa','dining-table','fridge'].sort());assert.ok(['jabi','guzape','maitama'].includes(n.home.district));
  await f.store.updateProfile(p.id,{wallet:999999999,origin:{id:'nepo'},inventory:['used-hatchback'],skills:{Technology:999},appearance:{top:'forest'}});const preserved=await f.store.profile(p.id);assert.equal(preserved.wallet,10000000);assert.equal(preserved.origin.id,'lapo');assert.deepEqual(preserved.inventory,[]);assert.equal(preserved.skills.Technology,undefined);await rejectCode(f.store.updateProfile(p.id,{onboardingComplete:true}),'gender_required');assert.equal((await f.store.updateProfile(p.id,{appearance:{presentation:'feminine'},onboardingComplete:true})).onboardingComplete,true);
});

integration('Mongo concurrent requests replay one debit and enforce unique operation fingerprints',async t=>{
  const f=await fixture(t),id=f.ada.residentId,payload={residentId:f.bello.residentId,amount:5000,note:'Dinner',idempotencyKey:key()};
  const responses=await Promise.all(Array.from({length:8},()=>f.store.transfer(id,payload)));assert.equal(new Set(responses.map(r=>r.transfer.id)).size,1);assert.equal((await f.store.profile(id)).wallet,9995000);assert.equal((await f.store.profile(f.bello.residentId)).wallet,10005000);
  assert.equal(await f.connection.db.collection('ledger').countDocuments({residentId:id,amount:-5000}),1);assert.equal(await f.connection.db.collection('ledger').countDocuments({residentId:f.bello.residentId,amount:5000}),1);assert.equal(await f.connection.db.collection('notifications').countDocuments({residentId:f.bello.residentId,kind:'transfer'}),1);
  const replay=await new MongoGameStore({...f.connection}).transfer(id,payload);assert.equal(replay.replayed,true);assert.equal(replay.transfer.id,responses[0].transfer.id);await rejectCode(f.store.transfer(id,{...payload,amount:5001}),'idempotency_conflict');
  await assert.rejects(f.connection.db.collection('ledger').updateOne({residentId:id},{$set:{amount:0}}),e=>e.code===13);await assert.rejects(f.connection.db.collection('ledger').deleteOne({residentId:id}),e=>e.code===13);
});

integration('Mongo concurrent insufficient-fund transfers preserve both balances and ledger invariants',async t=>{
  const f=await fixture(t),id=f.ada.residentId,target=f.bello.residentId;
  const results=await Promise.allSettled(Array.from({length:4},()=>f.store.transfer(id,{residentId:target,amount:6000000,idempotencyKey:key()})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='insufficient_balance').length,3);
  assert.equal((await f.store.profile(id)).wallet,4000000);assert.equal((await f.store.profile(target)).wallet,16000000);const ledger=await f.connection.db.collection('ledger').find({residentId:{$in:[id,target]}}).toArray();assert.equal(ledger.reduce((sum,row)=>sum+row.amount,0),20000000);
  for(const residentId of [id,target]){const entries=ledger.filter(row=>row.residentId===residentId).sort((a,b)=>a.sequence-b.sequence);let running=0;for(const row of entries){running+=row.amount;assert.equal(row.balanceAfter,running);assert.ok(row.type);}}const before=ledger.length;await rejectCode(f.store.transfer(id,{residentId:target,amount:4000001,idempotencyKey:key()}),'insufficient_balance');assert.equal(await f.connection.db.collection('ledger').countDocuments({residentId:{$in:[id,target]}}),before);
  await rejectCode(f.store.action(id,'demo-topup',{amount:100000,idempotencyKey:key()}),'topup_disabled');const forced=new MongoGameStore({...f.connection,allowGameTopups:true});await rejectCode(forced.topup(id,{amount:100,idempotencyKey:key()}),'topup_disabled');
});

integration('Mongo purchases use server prices and persist furniture/vehicle ownership exactly once',async t=>{
  const f=await fixture(t),id=f.ada.residentId,item=catalog.find(item=>item.id==='plant'),payload={itemId:item.id,price:0,idempotencyKey:key()};
  const results=await Promise.all([f.store.action(id,'purchase',payload),f.store.action(id,'purchase',payload)]);assert.equal(results[0].profile.wallet,10000000-item.price);assert.equal((await f.store.profile(id)).inventory.filter(i=>i===item.id).length,1);
  await f.store.action(id,'place-furniture',{itemId:'plant',x:.4,y:.5});await f.store.action(id,'store-furniture',{itemId:'plant'});assert.deepEqual((await f.store.profile(id)).storedFurniture,['plant']);
  const car=catalog.find(item=>item.id==='used-hatchback'),buy={itemId:car.id,color:car.defaultColor,price:0,idempotencyKey:key()};await f.store.action(id,'purchase',buy);const p=await new MongoGameStore({...f.connection}).profile(id);assert.ok(p.inventory.includes(car.id));assert.equal(p.vehicleColors[car.id],car.defaultColor);assert.equal(p.wallet,10000000-item.price-car.price);
  await rejectCode(f.store.action(id,'purchase',{itemId:'sofa'}),'idempotency_required');await assert.rejects(f.store.action(id,'equip',{itemId:'office-shirt'}));
});

integration('Mongo property rent/investment/loan payments commit authoritative terms once',async t=>{
  const f=await fixture(t,{origin:'nepo'}),id=f.ada.residentId,property=properties.find(p=>p.id==='lugbe-flat');
  const investment=await f.store.action(id,'buy-investment',{propertyId:property.id,buy:1,idempotencyKey:key()});assert.equal(investment.profile.wallet,100000000-property.buy);f.advance(INVESTMENT_META.periodMs*3);
  const payload={propertyId:property.id,amount:999999999,idempotencyKey:key()},rents=await Promise.all([f.store.action(id,'collect-rent',payload),f.store.action(id,'collect-rent',payload)]);assert.equal(rents[0].income.amount,property.investmentIncome*3);assert.equal(rents[0].income.amount,rents[1].income.amount);
  await f.store.action(id,'sell-investment',{propertyId:property.id,idempotencyKey:key()});assert.equal(await f.connection.db.collection('properties').countDocuments({residentId:id,propertyId:property.id}),0);
  const moved=await f.store.action(id,'move-home',{propertyId:property.id,tenure:'rent',rent:0,idempotencyKey:key()});assert.equal(moved.profile.home.starterVersion,1);assert.equal(moved.profile.home.furnishingPreset,'nepo-furnished');const before=moved.profile.wallet;f.advance(GAME_YEAR_MS);await f.store.action(id,'renew-rent',{amount:0,idempotencyKey:key()});assert.equal((await f.store.profile(id)).wallet,before-property.rent);
  const borrow={amount:10000,interest:0,consent:true,consentVersion:LOAN_META.consentVersion,idempotencyKey:key()},loan=await f.store.action(id,'borrow-loan',borrow);assert.ok(loan.loan.totalRepayment>borrow.amount);
  const repay={loanId:loan.loan.id,amount:loan.loan.totalRepayment,idempotencyKey:key()},payments=await Promise.all([f.store.action(id,'repay-loan',repay),f.store.action(id,'repay-loan',repay)]);assert.equal(payments[0].loan.outstanding,0);assert.equal((await f.store.profile(id)).loans[0].outstanding,0);
});

integration('Mongo shift completion rewards server answer keys exactly once and preserves daily limits',async t=>{
  const f=await fixture(t),id=f.ada.residentId;await f.store.action(id,'take-job',{jobId:'bank-teller'});await travel(f,id,jobs['bank-teller'].district);const starts=await Promise.all([f.store.action(id,'start-shift'),f.store.action(id,'start-shift')]);assert.equal(starts[0].challenge.id,starts[1].challenge.id);
  f.advance(2000);const before=(await f.store.profile(id)).wallet,payload={challengeId:starts[0].challenge.id,pay:999999999,answers:jobs['bank-teller'].tasks.map(t=>({taskId:t.id,optionId:t.answer}))};const result=await Promise.all([f.store.action(id,'complete-shift',payload),f.store.action(id,'complete-shift',payload)]);assert.equal(result[0].result.pay,jobs['bank-teller'].pay);assert.equal((await f.store.profile(id)).wallet,before+jobs['bank-teller'].pay);assert.equal((await f.store.profile(id)).completedShifts,1);assert.equal((await f.store.workSchedule(id)).completedToday,1);f.advance(20000);await rejectCode(f.store.action(id,'start-shift'),'shift_slot_completed');
  f.at('2026-10-05T12:00:00Z');const next=await f.store.action(id,'start-shift');f.advance(2000);await f.store.action(id,'complete-shift',{...payload,challengeId:next.challenge.id});assert.equal((await f.store.workSchedule(id)).completedToday,2);f.advance(20000);await rejectCode(f.store.action(id,'start-shift'),'daily_shift_limit');
});

integration('Mongo session rotation, revocation, expiration and password resets invalidate durable sessions',async t=>{
  const f=await fixture(t),id=f.bello.residentId,rotated=await f.store.refreshSession(f.bello.token);assert.equal(await f.store.session(f.bello.token),null);assert.equal(await f.store.session(rotated.token),id);await f.store.logoutAll(id);assert.equal(await f.store.session(rotated.token),null);
  let delivered;const auth=new MongoAuthStore({...f.connection,clock:()=>f.now,deliverPasswordReset:async payload=>{delivered=payload;}});const p=await f.store.profile(id),active=await auth.login({username:p.username,password:'secure-test-password'});const response=await auth.requestPasswordReset({username:p.username});assert.deepEqual(response,{ok:true});assert.ok(delivered.token);const resetDoc=await f.connection.db.collection('password_resets').findOne({residentId:id});assert.equal(resetDoc._id,hashToken(delivered.token));assert.equal(JSON.stringify(resetDoc).includes(delivered.token),false);
  await auth.resetPassword({token:delivered.token,password:'replacement-password'});assert.equal(await auth.session(active.token),null);await rejectCode(auth.login({username:p.username,password:'secure-test-password'}),'invalid_credentials');await auth.login({username:p.username,password:'replacement-password'});await rejectCode(auth.resetPassword({token:delivered.token,password:'another-password'}),'invalid_reset');
  f.advance(31*86400000);assert.equal(await f.store.session(f.ada.token),null);
});

integration('Mongo email verification persists hashed tokens, requires password for changes and consumes tokens once', async t => {
  const f = await fixture(t), id = f.bello.residentId, deliveries = [];
  const auth = new MongoAuthStore({ ...f.connection, clock: () => f.now, deliverEmailVerification: async payload => deliveries.push(payload) });
  const before = await auth.emailStatus(id);
  assert.equal(before.emailVerified, false);
  await auth.requestEmailVerification(id);
  const first = deliveries.at(-1), record = await f.connection.db.collection('email_verifications').findOne({ residentId: id });
  assert.equal(record._id, hashToken(first.token));
  assert.equal(JSON.stringify(record).includes(first.token), false);
  const reconnected = new MongoAuthStore({ ...f.connection, clock: () => f.now });
  await reconnected.verifyEmail({ token: first.token });
  assert.equal((await auth.emailStatus(id)).emailVerified, true);
  await rejectCode(auth.verifyEmail({ token: first.token }), 'invalid_verification');
  const email = `changed_${crypto.randomBytes(6).toString('hex')}@example.test`;
  await rejectCode(auth.requestEmailVerification(id, { email, password: 'wrong-password' }), 'invalid_credentials');
  await auth.requestEmailVerification(id, { email, password: 'secure-test-password' });
  assert.equal((await auth.emailStatus(id)).email, before.email);
  await auth.verifyEmail({ token: deliveries.at(-1).token });
  assert.equal((await auth.emailStatus(id)).email, email);
  assert.equal((await auth.login({ email, password: 'secure-test-password' })).residentId, id);
  await auth.requestEmailVerification(id, { email: `expired_${email}`, password: 'secure-test-password' });
  const expired = deliveries.at(-1).token;
  f.advance(24 * 60 * 60 * 1000 + 1);
  await rejectCode(auth.verifyEmail({ token: expired }), 'invalid_verification');
  assert.equal((await auth.emailStatus(id)).email, email);
  await auth.requestEmailVerification(id, { email: `revoked_${email}`, password: 'secure-test-password' });
  const revoked = deliveries.at(-1).token;
  await auth.logoutAll(id);
  await rejectCode(auth.verifyEmail({ token: revoked }), 'invalid_verification');
});

integration('Mongo failed email delivery revokes the undelivered verification token', async t => {
  const f = await fixture(t), id = f.bello.residentId;
  const auth = new MongoAuthStore({ ...f.connection, clock: () => f.now, deliverEmailVerification: async () => { throw new Error('provider unavailable'); } });
  assert.deepEqual(await auth.requestEmailVerification(id), { ok: true });
  assert.equal(await f.connection.db.collection('email_verifications').countDocuments({ residentId: id }), 0);
  assert.equal((await auth.emailStatus(id)).emailVerified, false);
});

integration('Mongo system resale credits the server buyback value once and clears normalized possessions',async t=>{
  const f=await fixture(t),id=f.ada.residentId,plant=catalog.find(item=>item.id==='plant');await f.store.action(id,'purchase',{itemId:plant.id,idempotencyKey:key()});await f.store.action(id,'place-furniture',{itemId:plant.id,x:.4,y:.5});await f.store.action(id,'store-furniture',{itemId:plant.id});
  const before=(await f.store.profile(id)).wallet,payload={itemId:plant.id,amount:999999999,idempotencyKey:key()},sold=await Promise.all(Array.from({length:3},()=>f.store.action(id,'sell-item',payload)));assert.equal(sold[0].sale.amount,Math.floor(plant.price/2));assert.equal((await f.store.profile(id)).wallet,before+Math.floor(plant.price/2));assert.equal(await f.connection.db.collection('inventory').countDocuments({residentId:id,itemId:plant.id}),0);const p=await f.store.profile(id);assert.equal(p.furnitureLayout[plant.id],undefined);assert.ok(!p.storedFurniture.includes(plant.id));assert.equal(await f.connection.db.collection('ledger').countDocuments({residentId:id,type:'sell-item'}),1);
  const replay=await f.store.action(id,'sell-item',{...payload,amount:1});assert.equal(replay.replayed,true);await rejectCode(f.store.action(id,'sell-item',{itemId:plant.id,idempotencyKey:key()}),'item_not_owned');await rejectCode(f.store.action(id,'sell-item',{itemId:'sofa'}),'idempotency_required');
  const car=catalog.find(item=>item.id==='used-hatchback');await f.store.action(id,'purchase',{itemId:car.id,color:car.defaultColor,idempotencyKey:key()});await f.store.action(id,'leave-home');await f.store.action(id,'toggle-driving',{vehicleId:car.id});await rejectCode(f.store.action(id,'sell-item',{itemId:car.id,idempotencyKey:key()}),'vehicle_driving');await f.store.action(id,'toggle-driving',{vehicleId:null});await f.store.action(id,'sell-item',{itemId:car.id,idempotencyKey:key()});assert.equal(await f.connection.db.collection('vehicles').countDocuments({residentId:id,itemId:car.id}),0);
  const shirt=catalog.find(item=>item.id==='office-shirt');await f.store.action(id,'purchase',{itemId:shirt.id,idempotencyKey:key()});await f.store.action(id,'equip',{itemId:shirt.id});await f.store.action(id,'sell-item',{itemId:shirt.id,idempotencyKey:key()});assert.equal((await f.store.profile(id)).appearance.top,'forest');
});

integration('Mongo dice outcomes and payouts are server-authoritative and latest-round order is durable',async t=>{
  const f=await fixture(t),id=f.ada.residentId;await f.store.action(id,'leave-home');await f.store.action(id,'enter-venue',{venueId:'games-lounge'});let die=1;t.mock.method(crypto,'randomInt',()=>die);
  const payload={stake:500,choice:'low',die:6,payout:999999999,idempotencyKey:key()},won=await f.store.action(id,'play-dice',payload);assert.equal(won.round.die,1);assert.equal(won.round.payout,1000);assert.equal(won.profile.wallet,10000500);die=6;const lost=await f.store.action(id,'play-dice',{stake:500,choice:'low',idempotencyKey:key()});assert.equal(lost.round.won,false);assert.equal(lost.profile.wallet,10000000);
  const persisted=await new MongoGameStore({...f.connection}).profile(id);assert.equal(persisted.lastGambleRound.id,lost.round.id);assert.equal(persisted.gambleHistory[0].id,lost.round.id);const replay=await f.store.action(id,'play-dice',payload);assert.equal(replay.replayed,true);assert.equal(replay.round.id,won.round.id);assert.equal(replay.profile.wallet,10000000);assert.equal(await f.connection.db.collection('gamble_rounds').countDocuments({residentId:id}),2);
});

integration('Mongo Abuja Car exit persists an exact venue transition without moving home or trusting client spawn hints',async t=>{
  const f=await fixture(t),id=f.ada.residentId,original=await f.store.profile(id);
  await f.store.action(id,'leave-home');
  const {trip}=await f.store.action(id,'travel',{district:original.district,mode:'taxi',venueId:'dealership',idempotencyKey:key()});
  f.advance(trip.seconds*1000);
  assert.equal((await f.store.action(id,'arrive',{tripId:trip.id})).profile.location.venue,'dealership');
  const exited=(await f.store.action(id,'exit-venue',{venueId:'home',exteriorEntry:{venueId:'home',transitionId:'forged'}})).profile;
  assert.equal(exited.location.kind,'public');assert.equal(exited.district,original.district);assert.equal(exited.location.exteriorEntry.venueId,'dealership');assert.notEqual(exited.location.exteriorEntry.transitionId,'forged');assert.equal(exited.wallet,original.wallet-trip.cost);
  const persisted=await new MongoGameStore({...f.connection}).profile(id);assert.deepEqual(persisted.location,exited.location);assert.equal(persisted.home.propertyId,original.home.propertyId);
  const row=await f.connection.db.collection('player_state').findOne({residentId:id});assert.deepEqual(row.location,exited.location);
  await f.store.action(id,'enter-venue',{venueId:'dealership'});const nextExit=(await f.store.action(id,'exit-venue')).profile;assert.notEqual(nextExit.location.exteriorEntry.transitionId,exited.location.exteriorEntry.transitionId);
  const home=(await f.store.action(id,'return-home',{mode:'walk',idempotencyKey:key()})).profile;assert.equal(home.location.kind,'home');assert.equal(home.location.exteriorEntry,undefined);assert.equal(home.home.propertyId,original.home.propertyId);
});

async function chatFixture(t){const f=await fixture(t);f.social=new MongoSocialStore(f.store);await f.social.init({ensureIndexes:false});f.social.attachToGame();f.conversationId=(await f.social.createConversation(f.ada.residentId,{residentId:f.bello.residentId})).conversation.id;return f;}
async function transferSnapshot(f){const ids=[f.ada.residentId,f.bello.residentId],db=f.connection.db;return{
  wallets:await db.collection('wallets').find({residentId:{$in:ids}}).sort({_id:1}).toArray(),
  ledger:await db.collection('ledger').find({residentId:{$in:ids}}).sort({_id:1}).toArray(),
  transfers:await db.collection('wallet_transfers').find({senderId:{$in:ids}}).sort({_id:1}).toArray(),
  operations:await db.collection('economy_operations').find({residentId:{$in:ids}}).sort({_id:1}).toArray(),
  notifications:await db.collection('notifications').find({residentId:{$in:ids}}).sort({_id:1}).toArray(),
  messages:await db.collection('messages').find({conversationId:f.conversationId}).sort({_id:1}).toArray(),
  conversation:await db.collection('conversations').findOne({id:f.conversationId}),
  members:await db.collection('members').find({conversationId:f.conversationId}).sort({residentId:1}).toArray()
};}

integration('Mongo in-chat Send Naira atomically persists one authorized receipt and broadcasts once across retries',async t=>{
  const f=await chatFixture(t),sender=f.ada.residentId,target=f.bello.residentId,events=[];f.store.emitUser=(id,event,data)=>{events.push({id,event,data});};
  const payload={residentId:target,conversationId:f.conversationId,amount:2500,note:'Dinner together',idempotencyKey:key(),kind:'transfer',transferId:'forged',fee:999,payout:999999};
  const results=await Promise.all(Array.from({length:6},()=>f.store.transfer(sender,payload)));const result=results.find(row=>!row.replayed);assert.ok(result);assert.equal(results.filter(row=>!row.replayed).length,1);assert.equal(new Set(results.map(row=>row.receipt.id)).size,1);assert.equal(result.receipt.kind,'transfer');assert.equal(result.receipt.transferId,result.transfer.id);assert.equal(result.receipt.transfer.amount,2500);assert.equal(result.receipt.transfer.note,'Dinner together');assert.equal(result.receipt.transfer.from,sender);assert.equal(result.receipt.transfer.to,target);assert.equal(result.receipt.transfer.currency,'game-naira');assert.equal((await f.store.profile(sender)).wallet,9997500);assert.equal((await f.store.profile(target)).wallet,10002500);
  const records=await f.connection.db.collection('wallet_transfers').find({senderId:sender,operationKey:payload.idempotencyKey}).toArray();assert.equal(records.length,1);assert.equal(records[0].messageId,result.receipt.id);assert.equal(records[0].amount,2500);assert.equal(await f.connection.db.collection('messages').countDocuments({conversationId:f.conversationId,kind:'transfer'}),1);assert.equal(await f.connection.db.collection('notifications').countDocuments({residentId:target,kind:'transfer'}),1);
  const ledger=await f.connection.db.collection('ledger').find({transferId:result.transfer.id}).toArray();assert.equal(ledger.length,2);assert.equal(ledger.reduce((sum,row)=>sum+row.amount,0),0);assert.equal((await f.connection.db.collection('conversations').findOne({id:f.conversationId})).seq,1);assert.equal(events.filter(e=>e.event==='message'&&e.data.kind==='transfer').length,2);assert.equal(events.filter(e=>e.id===target&&e.event==='notification').length,1);
  const eventCount=events.length;const replay=await f.store.transfer(sender,payload);assert.equal(replay.replayed,true);assert.equal(replay.receipt.id,result.receipt.id);assert.equal(events.length,eventCount);await rejectCode(f.store.transfer(sender,{...payload,conversationId:null}),'idempotency_conflict');
  await assert.rejects(f.connection.db.collection('wallet_transfers').updateOne({_id:result.transfer.id},{$set:{amount:1}}),e=>e.code===13);await assert.rejects(f.connection.db.collection('wallet_transfers').deleteOne({_id:result.transfer.id}),e=>e.code===13);
  const reopened=new MongoGameStore({...f.connection}),social=new MongoSocialStore(reopened);await social.init({ensureIndexes:false});social.attachToGame();const history=await social.messages(target,f.conversationId);const receipt=history.messages.find(row=>row.id===result.receipt.id);assert.equal(receipt.kind,'transfer');assert.equal(receipt.transfer.amount,2500);assert.equal(receipt.transfer.note,'Dinner together');assert.equal((await reopened.transfer(sender,payload)).replayed,true);
});

integration('Mongo chat transfer rejects guessed conversations, wrong partners, groups and blocked recipients without changes',async t=>{
  const f=await chatFixture(t),sender=f.ada.residentId,target=f.bello.residentId,third=(await f.store.register({username:`third_${crypto.randomBytes(5).toString('hex')}`,password:'secure-test-password'})).residentId;
  const unrelated=(await f.social.createConversation(target,{residentId:third})).conversation.id;let before=await transferSnapshot(f);await assert.rejects(f.store.transfer(sender,{residentId:target,conversationId:unrelated,amount:1000,idempotencyKey:key()}),e=>[403,404].includes(e.status));assert.deepEqual(await transferSnapshot(f),before);
  await rejectCode(f.store.transfer(sender,{residentId:third,conversationId:f.conversationId,amount:1000,idempotencyKey:key()}),'transfer_conversation_mismatch');assert.deepEqual(await transferSnapshot(f),before);
  await f.social.requestFriend(sender,target);const request=(await f.social.friendRequests(target)).find(row=>row.from===sender);await f.social.respondFriend(target,request.id,true);const group=(await f.social.createConversation(sender,{kind:'group',memberIds:[target],name:'Dinner group'})).conversation.id;before=await transferSnapshot(f);await rejectCode(f.store.transfer(sender,{residentId:target,conversationId:group,amount:1000,idempotencyKey:key()}),'transfer_conversation_mismatch');assert.deepEqual(await transferSnapshot(f),before);
  await f.social.moderate(target,'block',sender,true);before=await transferSnapshot(f);await rejectCode(f.store.transfer(sender,{residentId:target,conversationId:f.conversationId,amount:1000,idempotencyKey:key()}),'recipient_unavailable');assert.deepEqual(await transferSnapshot(f),before);
});

integration('Mongo receipt insert failure rolls back wallet credit, ledger, sequence, notifications and retry key',async t=>{
  const f=await chatFixture(t),sender=f.ada.residentId,target=f.bello.residentId,payload={residentId:target,conversationId:f.conversationId,amount:1700,note:'Shared meal',idempotencyKey:key()},before=await transferSnapshot(f),events=[];f.store.emitUser=(id,event,data)=>events.push({id,event,data});
  const original=f.social.collection.bind(f.social),messages=original('messages');f.social.collection=name=>name==='messages'?messages:original(name);t.mock.method(messages,'insertOne',async()=>{throw new Error('Injected receipt insert failure');});
  try{await assert.rejects(f.store.transfer(sender,payload),/Injected receipt insert failure/);}finally{t.mock.restoreAll();f.social.collection=original;}
  assert.deepEqual(await transferSnapshot(f),before);assert.equal(events.length,0);const result=await f.store.transfer(sender,payload);assert.equal(result.replayed,false);assert.equal(result.receipt.kind,'transfer');assert.equal((await f.store.profile(sender)).wallet,9998300);assert.equal((await f.store.profile(target)).wallet,10001700);
});

integration('Mongo ordinary chat cannot forge transfer receipt metadata',async t=>{
  const f=await chatFixture(t),sender=f.ada.residentId,before=(await f.store.profile(sender)).wallet;
  const sent=await f.social.sendMessage(sender,f.conversationId,{text:'I sent money',kind:'transfer',transferId:'forged',transfer:{id:'forged',amount:999999,from:sender,to:f.bello.residentId},idempotencyKey:key()});assert.equal(sent.message.kind,'text');assert.equal(sent.message.transferId,undefined);assert.equal(sent.message.transfer,undefined);assert.equal((await f.store.profile(sender)).wallet,before);assert.equal(await f.connection.db.collection('wallet_transfers').countDocuments({senderId:sender}),0);const history=await f.social.messages(f.bello.residentId,f.conversationId);assert.equal(history.messages[0].kind,'text');assert.equal(history.messages[0].transfer,undefined);
});

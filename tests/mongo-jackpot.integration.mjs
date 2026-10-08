import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { connectMongo } from '../src/server/mongo/database.mjs';
import { MongoGameStore } from '../src/server/mongo/gameStore.mjs';
import { MongoAdminStore } from '../src/server/mongo/adminStore.mjs';
import { MongoPaymentStore } from '../src/server/mongo/paymentStore.mjs';
import { JackpotIntegration } from '../src/server/jackpotIntegration.mjs';
import { migrateJackpotWithdrawalFingerprints } from '../src/server/mongo/jackpotSchema.mjs';

const configuration=process.env.TEST_MONGODB_CONFIG?JSON.parse(fs.readFileSync(process.env.TEST_MONGODB_CONFIG,'utf8')):{};
const uri=process.env.TEST_MONGODB_URI||configuration.uri;
const unique=()=>crypto.randomBytes(8).toString('hex');

test('Mongo Jackpot verifies deposits, settles once, isolates game wallets and protects bank withdrawal review',{
  skip:uri?false:'Requires an authenticated disposable Mongo replica set'
},async t=>{
  const database=await connectMongo({uri,database:configuration.database||'abujalife_prod',production:true});t.after(()=>database.close());
  let now=Date.now();const store=new MongoGameStore({...database,clock:()=>now,originRandomInt:()=>1});
  const players=[];
  for(let i=0;i<2;i++){const registered=await store.register({username:`jackpot_${unique()}`,password:'Disposable Jackpot acceptance password!'});players.push(registered.residentId);}
  const admin=new MongoAdminStore({store,bootstrapUsername:(await store.profile(players[0])).username});await admin.init({ensureIndexes:false});
  const financeId=(await database.db.collection('admin_roles').findOne({role:'superadmin'})).residentId;
  const keyFile=process.env.TEST_PAYMENT_KEY_FILE || (process.env.TEST_MONGODB_CONFIG?`${process.env.TEST_MONGODB_CONFIG}.payment-key`:null);
  let key=crypto.randomBytes(32).toString('hex');
  if(keyFile){try{fs.writeFileSync(keyFile,key,{mode:0o600,flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}key=fs.readFileSync(keyFile,'utf8').trim();}
  const verified=new Map();
  const payments=new MongoPaymentStore({store,admin,configKey:key,publicOrigin:'https://game.example',fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('/v3/payments')?{status:'success',data:{link:'https://checkout.flutterwave.com/v3/hosted/pay/jackpot-fixture'}}:{status:'success',data:verified.get(url.match(/transactions\/(\d+)\/verify/)?.[1])||{status:'failed'}}})});
  await payments.init({ensureIndexes:false});
  await payments.configure(financeId,{mode:'test',enabled:true,creditRate:10,secretKey:'FLWSECK_TEST-fixture-secret-000000000000000',webhookSecret:'fixture-hmac-signing-secret-at-least16',activate:true});
  const jackpot=new JackpotIntegration({store,admin,payments,database,publicWebUrl:'https://game.example'});
  const gameBalances=await Promise.all(players.map(async id=>(await store.profile(id)).wallet));
  for(const residentId of players){
    const checkout=await jackpot.depositCheckout(residentId,{amount:5000,email:'fixture@example.test',idempotencyKey:unique()});
    const transactionId=String(crypto.randomInt(100000000,2000000000));
    verified.set(transactionId,{id:transactionId,tx_ref:checkout.checkout.txRef,amount:5000,currency:'NGN',status:'successful'});
    const payload={transactionId,txRef:checkout.checkout.txRef};
    await jackpot.verifyDeposit(residentId,payload);await jackpot.verifyDeposit(residentId,payload);
    assert.equal((await jackpot.ensureAccount(residentId)).available,5000,'verified replay must credit only once');
  }
  const initial=await jackpot.state(players[0]),room=initial.rooms.find(item=>item.status==='open');
  assert.equal(initial.serverTime,now);assert.ok(room);
  const joinKey=unique(),joins=await Promise.all([jackpot.join(players[0],room.id,joinKey),jackpot.join(players[0],room.id,joinKey)]);
  assert.equal(joins[0].ticket.ticketId,joins[1].ticket.ticketId);
  await jackpot.join(players[1],room.id,unique());
  assert.equal(await database.db.collection('jackpot_entries').countDocuments({roomId:room.id}),2);
  now=room.drawsAt+1;await jackpot.tick();await jackpot.tick();
  const result=await database.db.collection('jackpot_rooms').findOne({_id:room.id});
  assert.equal(result.status,'completed');assert.equal(result.potAmount,4000);
  assert.equal(await database.db.collection('jackpot_ledger').countDocuments({'metadata.roomId':room.id,type:'jackpot_win'}),1);
  const accounts=await Promise.all(players.map(id=>jackpot.ensureAccount(id)));assert.equal(accounts.reduce((sum,account)=>sum+account.available,0),10000);
  const winner=result.winnerId,unauthorized=players.find(id=>id!==financeId);
  const withdrawal={amount:1000,bankName:'Fixture Bank',accountNumber:'1234567890',accountName:'Fixture Resident',idempotencyKey:unique()};
  const holds=await Promise.all([jackpot.requestWithdrawal(winner,withdrawal),jackpot.requestWithdrawal(winner,withdrawal)]);
  const id=holds[0].withdrawal.id;assert.equal(holds[1].withdrawal.id,id);assert.equal(holds[0].withdrawal.netAmount,900);assert.equal(holds[0].withdrawal.feeAmount,100);
  const saved=await database.db.collection('jackpot_withdrawals').findOne({_id:id});assert.ok(!JSON.stringify(saved).includes(withdrawal.accountNumber),'encrypted bank account numbers must not also appear in a plaintext replay fingerprint');
  const legacyFingerprint=JSON.stringify({grossAmount:1000,feeAmount:100,netAmount:900,bankName:withdrawal.bankName.toLowerCase(),accountNumber:withdrawal.accountNumber,accountName:withdrawal.accountName.toLowerCase()});
  await database.db.collection('jackpot_withdrawals').updateOne({_id:id},{$set:{fingerprint:legacyFingerprint}});
  await migrateJackpotWithdrawalFingerprints(database.db);
  const migrated=await database.db.collection('jackpot_withdrawals').findOne({_id:id});assert.equal(migrated.fingerprint,saved.fingerprint);assert.ok(!JSON.stringify(migrated).includes(withdrawal.accountNumber));
  assert.equal((await jackpot.requestWithdrawal(winner,withdrawal)).withdrawal.id,id,'legacy privacy migration must preserve replay protection and balances');
  await assert.rejects(jackpot.requestWithdrawal(winner,{...withdrawal,amount:2000}),error=>error.code==='idempotency_conflict');
  await assert.rejects(jackpot.adminWithdrawalAction(unauthorized,id,'paid',{reference:'unauthorized-transfer'}),error=>error.code==='admin_forbidden');
  await jackpot.adminWithdrawalAction(financeId,id,'start');
  await Promise.all([jackpot.adminWithdrawalAction(financeId,id,'paid',{reference:'fixture-bank-transfer'}),jackpot.adminWithdrawalAction(financeId,id,'paid',{reference:'fixture-bank-transfer'})]);
  assert.equal((await jackpot.ensureAccount(winner)).pendingWithdrawal,0);
  assert.equal(await database.db.collection('jackpot_ledger').countDocuments({residentId:winner,type:'withdrawal_paid','metadata.withdrawalId':id}),1);
  await assert.rejects(jackpot.adminWithdrawalAction(financeId,id,'return',{reason:'Cannot return a paid withdrawal'}),error=>error.code==='withdrawal_state');
  const beforeReturn=(await jackpot.ensureAccount(winner)).available;
  const another=await jackpot.requestWithdrawal(winner,{...withdrawal,idempotencyKey:unique()});
  await jackpot.adminWithdrawalAction(financeId,another.withdrawal.id,'return',{reason:'Bank account could not receive the fixture transfer'});
  await jackpot.adminWithdrawalAction(financeId,another.withdrawal.id,'return',{reason:'Bank account could not receive the fixture transfer'});
  assert.equal((await jackpot.ensureAccount(winner)).available,beforeReturn);
  assert.deepEqual(await Promise.all(players.map(async residentId=>(await store.profile(residentId)).wallet)),gameBalances,'Jackpot accounting must never mutate ordinary game wallets');
});

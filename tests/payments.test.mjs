import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore } from '../src/server/gameStore.mjs';
import { AdminStore } from '../src/server/adminStore.mjs';
import { PaymentStore } from '../src/server/paymentStore.mjs';
import {validFlutterwaveWebhook} from '../src/server/flutterwaveVerification.mjs';

test('v3 secret hash and v4 raw body signature validate explicitly without bad-signature fallback',()=>{
 const raw=Buffer.from('{"event":"charge.completed"}'),secret='test_webhook_secret_at_least16',signature=crypto.createHmac('sha256',secret).update(raw).digest('base64');
 assert.equal(validFlutterwaveWebhook(raw,signature,secret),true);
 assert.equal(validFlutterwaveWebhook(raw,undefined,secret,secret),true);
 assert.equal(validFlutterwaveWebhook(raw,undefined,secret,'wrong'),false);
 assert.equal(validFlutterwaveWebhook(raw,'wrong',secret,secret),false);
 assert.equal(validFlutterwaveWebhook(raw,signature,secret+'wrong'),false);
 assert.equal(validFlutterwaveWebhook(Buffer.concat([raw,Buffer.from(' ')]),signature,secret),false);
});

// Explicit provider fixture: these tests do not contact Flutterwave or claim a
// live merchant configuration. The production verifier still parses the exact
// provider response and shares the real SQLite ledger transaction boundary.
const SECRET='FLWSECK_TEST-fixture-0000000000000000000';
const WEBHOOK_SECRET='local-fixture-webhook-signing-secret';
async function fixture(t,{configured=true}={}) {const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-payments-test-'));let store=new GameStore({dataDir});t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});const owner=(await store.register({username:'payment_owner',password:'Local payment fixture password!'})).residentId;const resident=(await store.register({username:'payment_user',password:'Local payment fixture password!'})).residentId;const other=(await store.register({username:'payment_other',password:'Local payment fixture password!'})).residentId;let admin=new AdminStore({store,bootstrapUsername:'payment_owner'});const key=crypto.randomBytes(32).toString('hex'),calls=[],verified=new Map();const fetchImpl=async(url,options)=>{calls.push({url,options});if(url.endsWith('/v3/payments'))return{ok:true,json:async()=>({status:'success',data:{link:'https://checkout.flutterwave.com/v3/hosted/pay/local-fixture'}})};const ref=new URL(url).searchParams.get('tx_ref');const id=ref?[...verified].find(([,row])=>row.tx_ref===ref)?.[0]:url.match(/transactions\/(\d+)\/verify/)?.[1];return{ok:true,json:async()=>({status:'success',data:verified.get(id)||{id:Number(id),status:'failed'}})};};let payments=new PaymentStore({store,admin,fetchImpl,configKey:key,publicOrigin:'https://game.example'});if(configured)payments.configure(owner,{mode:'test',enabled:true,creditRate:10,secretKey:SECRET,webhookSecret:WEBHOOK_SECRET,activate:true});return{dataDir,owner,resident,other,initial:{resident:store.profile(resident).wallet,other:store.profile(other).wallet},key,calls,verified,get store(){return store;},get admin(){return admin;},get payments(){return payments;},restart(){store.close();store=new GameStore({dataDir});admin=new AdminStore({store});payments=new PaymentStore({store,admin,fetchImpl,configKey:key,publicOrigin:'https://game.example'});}};}
async function checkout(f,key='checkout_fixture_key_001',amount=1000){return(await f.payments.checkout(f.resident,{amount,email:'fixture@example.test',idempotencyKey:key})).checkout;}
function providerSuccess(f,order,id='901',overrides={}){f.verified.set(id,{id:Number(id),tx_ref:order.txRef,amount:order.amount,currency:'NGN',status:'successful',...overrides});return id;}

test('unconfigured checkout is unavailable and provider configuration is authorized and encrypted',async t=>{const f=await fixture(t,{configured:false});assert.equal(f.payments.publicConfig().enabled,false);await assert.rejects(f.payments.checkout(f.resident,{amount:1000,email:'fixture@example.test',idempotencyKey:'disabled_checkout_001'}),{code:'payments_unavailable'});assert.throws(()=>f.payments.configure(f.resident,{mode:'test',secretKey:SECRET}),{status:403});f.payments.configure(f.owner,{mode:'test',enabled:true,creditRate:10,secretKey:SECRET,webhookSecret:WEBHOOK_SECRET,activate:true});const raw=f.store.get("SELECT secrets FROM payment_config WHERE mode='test'").secrets;assert.ok(!raw.includes(SECRET));assert.ok(!raw.includes(WEBHOOK_SECRET));const exposed=JSON.stringify(f.payments.adminConfig(f.owner));assert.ok(!exposed.includes(SECRET));assert.ok(!exposed.includes(WEBHOOK_SECRET));assert.equal(f.payments.publicConfig().enabled,true);assert.equal(f.calls.length,0);assert.ok(!JSON.stringify(f.admin.audit(f.owner)).includes(SECRET));});

test('checkout trusts only saved rate/origin, uses the provider host, and retries do not create another order',async t=>{const f=await fixture(t);const initial=f.store.profile(f.resident).wallet,order=await checkout(f);assert.equal(order.amount,1000);assert.equal(order.credits,10000);assert.equal(order.status,'pending');assert.equal(f.store.profile(f.resident).wallet,initial);const call=f.calls[0],payload=JSON.parse(call.options.body);assert.equal(call.url,'https://api.flutterwave.com/v3/payments');assert.equal(payload.currency,'NGN');assert.equal(payload.amount,1000);assert.equal(new URL(payload.redirect_url).origin,'https://game.example');const replay=await f.payments.checkout(f.resident,{amount:1000,email:'fixture@example.test',idempotencyKey:'checkout_fixture_key_001'});assert.equal(replay.checkout.txRef,order.txRef);assert.equal(replay.replayed,true);assert.equal(f.calls.length,1);await assert.rejects(f.payments.checkout(f.resident,{amount:1001,email:'fixture@example.test',idempotencyKey:'checkout_fixture_key_001'}),{code:'idempotency_conflict'});});

test('client assertions and mismatched amount/currency/reference/status cannot credit a payment',async t=>{const f=await fixture(t);const order=await checkout(f),before=f.store.profile(f.resident).wallet;for(const override of [{amount:999},{currency:'USD'},{tx_ref:'invented_reference'},{status:'pending'},{id:99999}]){providerSuccess(f,order,'902',override);await assert.rejects(f.payments.verify(f.resident,{transactionId:'902',txRef:order.txRef,verified:true,amount:1000}),{code:'payment_verification_failed'});assert.equal(f.store.profile(f.resident).wallet,before);}assert.equal(f.store.transactions(f.resident).filter(row=>row.reason.startsWith('Verified Flutterwave')).length,0);});

test('verified provider payment credits exactly once and survives server restart',async t=>{const f=await fixture(t);const order=await checkout(f),id=providerSuccess(f,order);const before=f.store.profile(f.resident).wallet;const first=await f.payments.verify(f.resident,{transactionId:id,txRef:order.txRef});assert.equal(first.profile.wallet,before+10000);assert.equal(first.payment.status,'credited');assert.equal(first.replayed,false);f.restart();assert.equal(f.payments.adminConfig(f.owner).modes.test.configured,true);const replay=await f.payments.verify(f.resident,{transactionId:id,txRef:order.txRef});assert.equal(replay.profile.wallet,before+10000);assert.equal(replay.replayed,true);assert.equal(f.store.transactions(f.resident).filter(row=>row.reason.startsWith('Verified Flutterwave')).length,1);});

test('payment lookup and verification reject a different resident',async t=>{const f=await fixture(t);const order=await checkout(f),id=providerSuccess(f,order);assert.throws(()=>f.payments.status(f.other,order.txRef),{status:404});await assert.rejects(f.payments.verify(f.other,{transactionId:id,txRef:order.txRef}),{status:404});await assert.rejects(f.payments.verify(f.other,{transactionId:id}),{status:404});assert.equal(f.store.profile(f.resident).wallet,f.initial.resident);assert.equal(f.store.profile(f.other).wallet,f.initial.other);});

test('a provider transaction ID cannot be reused for a second checkout',async t=>{const f=await fixture(t);const first=await checkout(f),second=await checkout(f,'checkout_fixture_key_002');const id=providerSuccess(f,first);await f.payments.verify(f.resident,{transactionId:id,txRef:first.txRef});providerSuccess(f,second,id);await assert.rejects(f.payments.verify(f.resident,{transactionId:id,txRef:second.txRef}),{code:'payment_duplicate'});assert.equal(f.store.profile(f.resident).wallet,f.initial.resident+10000);});

test('webhook requires raw-body HMAC and still verifies the provider before credit',async t=>{const f=await fixture(t);const order=await checkout(f),id=providerSuccess(f,order);const raw=Buffer.from(JSON.stringify({event:'charge.completed',data:{id:Number(id),tx_ref:order.txRef,status:'successful',amount:1000}}));const signature=crypto.createHmac('sha256',WEBHOOK_SECRET).update(raw).digest('base64');await assert.rejects(f.payments.handleWebhook(raw,WEBHOOK_SECRET),{status:401});await assert.rejects(f.payments.handleWebhook(Buffer.concat([raw,Buffer.from(' ')]),signature),{status:401});providerSuccess(f,order,id,{amount:1});await assert.rejects(f.payments.handleWebhook(raw,signature),{code:'payment_verification_failed'});assert.equal(f.store.profile(f.resident).wallet,f.initial.resident);providerSuccess(f,order,id);const success=await f.payments.handleWebhook(raw,signature);assert.equal(success.profile.wallet,f.initial.resident+10000);const replay=await f.payments.handleWebhook(raw,signature);assert.equal(replay.replayed,true);assert.equal(f.store.profile(f.resident).wallet,f.initial.resident+10000);});

test('provider outage and untrusted checkout links never credit game money',async t=>{const f=await fixture(t);f.payments.fetch=async()=>{throw new Error('Explicit provider network fixture');};await assert.rejects(checkout(f),{code:'provider_unavailable'});assert.equal(f.store.profile(f.resident).wallet,f.initial.resident);assert.equal(f.payments.list(f.owner).payments[0].status,'checkout_failed');f.payments.fetch=async()=>({ok:true,json:async()=>({status:'success',data:{link:'https://evil.example/collect-card'}})});await assert.rejects(checkout(f,'checkout_fixture_key_002'),{code:'invalid_checkout'});assert.equal(f.store.profile(f.resident).wallet,f.initial.resident);});

test('test/live keys, public callback origin and encrypted config key are validated',async t=>{const f=await fixture(t);assert.throws(()=>f.payments.configure(f.owner,{mode:'live',secretKey:SECRET}));assert.throws(()=>f.payments.configure(f.owner,{mode:'test',publicOrigin:'http://game.example'}));assert.throws(()=>f.payments.configure(f.owner,{mode:'test',publicOrigin:'https://evil.example/redirect'}));assert.throws(()=>f.payments.configure(f.owner,{mode:'test',arbitraryCustomerBalance:900000}));assert.throws(()=>new PaymentStore({store:f.store,admin:f.admin,configKey:'bad-key'}),{code:'config_key_required'});const changedKey=new PaymentStore({store:f.store,admin:f.admin,configKey:crypto.randomBytes(32).toString('hex')});assert.equal(changedKey.publicConfig().enabled,false);});


test('checkout rejects an uncreditable safe-integer overflow before any provider call or order creation',async t=>{
  const f=await fixture(t),current=f.store.profile(f.resident).wallet;
  f.admin.adjustWallet(f.owner,{residentId:f.resident,amount:Number.MAX_SAFE_INTEGER-current-500,reason:'Explicit boundary fixture administrative adjustment',idempotencyKey:'overflow_boundary_adjust_1'});
  const balance=f.store.profile(f.resident).wallet,ledgerCount=f.store.get('SELECT COUNT(*) count FROM ledger WHERE resident_id=?',f.resident).count;
  assert.equal(balance,Number.MAX_SAFE_INTEGER-500);
  await assert.rejects(checkout(f,'overflow_checkout_key_001',1000),{code:'wallet_limit',status:409});
  assert.equal(f.calls.length,0);
  assert.equal(f.store.get('SELECT COUNT(*) count FROM payment_orders').count,0);
  assert.equal(f.store.get('SELECT COUNT(*) count FROM ledger WHERE resident_id=?',f.resident).count,ledgerCount);
  assert.equal(f.store.profile(f.resident).wallet,balance);
});

test('verification rejects wallet overflow introduced after checkout without a partial payment credit',async t=>{
  const f=await fixture(t),order=await checkout(f,'verify_overflow_key_001'),transactionId=providerSuccess(f,order);
  const current=f.store.profile(f.resident).wallet;
  f.admin.adjustWallet(f.owner,{residentId:f.resident,amount:Number.MAX_SAFE_INTEGER-current-500,reason:'Explicit post-checkout boundary fixture adjustment',idempotencyKey:'verify_overflow_adjust_001'});
  const before=f.store.profile(f.resident).wallet,ledgerCount=f.store.transactions(f.resident).length;
  await assert.rejects(f.payments.verify(f.resident,{transactionId,txRef:order.txRef}),{code:'wallet_limit',status:409});
  assert.equal(f.store.profile(f.resident).wallet,before);
  assert.equal(f.store.transactions(f.resident).length,ledgerCount);
  assert.equal(f.payments.status(f.resident,order.txRef).payment.status,'pending');
  assert.equal(f.payments.status(f.resident,order.txRef).payment.transactionId,null);
});


test('a standard checkout return verifies by saved reference without a transaction ID and still fulfills once',async t=>{
  const f=await fixture(t),order=await checkout(f);providerSuccess(f,order,'934');
  const first=await f.payments.verify(f.resident,{txRef:order.txRef});assert.equal(first.profile.wallet,f.initial.resident+order.credits);
  assert.ok(f.calls.some(call=>new URL(call.url).pathname==='/v3/transactions/verify_by_reference'));
  f.restart();const replay=await f.payments.verify(f.resident,{txRef:order.txRef});assert.equal(replay.replayed,true);assert.equal(replay.profile.wallet,first.profile.wallet);
  assert.equal(f.store.transactions(f.resident).filter(row=>row.reason.startsWith('Verified Flutterwave')).length,1);
});

test('reference recovery rejects unknown and other-resident checkouts before querying the provider',async t=>{
  const f=await fixture(t),order=await checkout(f),calls=f.calls.length;
  await assert.rejects(f.payments.verify(f.other,{txRef:order.txRef}),{status:404});
  await assert.rejects(f.payments.verify(f.resident,{txRef:'abjl_unknown'}),{status:404});assert.equal(f.calls.length,calls);
});

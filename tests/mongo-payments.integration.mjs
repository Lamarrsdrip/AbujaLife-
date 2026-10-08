import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { connectMongo } from '../src/server/mongo/database.mjs';
import { MongoGameStore } from '../src/server/mongo/gameStore.mjs';
import { MongoAdminStore } from '../src/server/mongo/adminStore.mjs';
import {MongoAdStore} from '../src/server/mongo/adStore.mjs';
import {adSpaceAt,adZoneSpaces,adSpaceFromId,MAP_AD_INVENTORY,COMPATIBILITY_MAP_AD_INVENTORY,BILLBOARD_IDS} from '../src/shared/advertising.mjs';
import {mapAdPlacements} from '../app/map-ad-displays.js';
import { MongoPaymentStore } from '../src/server/mongo/paymentStore.mjs';

const configuration = process.env.TEST_MONGODB_CONFIG ? JSON.parse(fs.readFileSync(process.env.TEST_MONGODB_CONFIG, 'utf8')) : {};
const uri = process.env.TEST_MONGODB_URI || configuration.uri, database = process.env.TEST_MONGODB_DATABASE || configuration.database || 'abujalife_prod';
const integration = (name, fn) => test(name, { skip: !uri ? 'Requires an authenticated MongoDB replica set through TEST_MONGODB_CONFIG or TEST_MONGODB_URI' : false }, fn);
const fixtureKeyFile = process.env.TEST_PAYMENT_KEY_FILE || (process.env.TEST_MONGODB_CONFIG ? process.env.TEST_MONGODB_CONFIG + '.payment-key' : null);
let fixtureKey = fixtureKeyFile && fs.existsSync(fixtureKeyFile) ? fs.readFileSync(fixtureKeyFile, 'utf8').trim() : crypto.randomBytes(32).toString('hex');
if (fixtureKeyFile && !fs.existsSync(fixtureKeyFile)) fs.writeFileSync(fixtureKeyFile, fixtureKey, { mode: 0o600, flag: 'wx' });
const SECRET = 'FLWSECK_TEST-fixture-secret-000000000000000', SIGNING = 'fixture-hmac-signing-secret-at-least16';
const unique = prefix => prefix + crypto.randomBytes(5).toString('hex');
const rejectCode = (promise, code) => assert.rejects(promise, error => error.code === code);
async function fixture(t, { configured = true } = {}) {
  const connection = await connectMongo({ uri, database, production: true }); t.after(() => connection.close());
  let now = Date.parse('2026-10-05T09:00:00Z'); const store = new MongoGameStore({ ...connection, clock: () => now, originRandomInt: () => 1 });
  const ownerRegistration = await store.register({ username: unique('pay_owner_'), password: 'Strong replica test password' });
  const ownerProfile = await store.profile(ownerRegistration.residentId), admin = new MongoAdminStore({ store, bootstrapUsername: ownerProfile.username }); await admin.init({ ensureIndexes: false });
  const owner = (await connection.db.collection('admin_roles').findOne({ role: 'superadmin' })).residentId;
  const resident = (await store.register({ username: unique('pay_user_'), password: 'Strong replica test password' })).residentId;
  const otherRegistration = await store.register({ username: unique('pay_other_'), password: 'Strong replica test password' });
  const key = fixtureKey, verified = new Map(), calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/v3/payments')) return { ok: true, json: async () => ({ status: 'success', data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/replica-fixture' } }) };
    const reference=new URL(url).searchParams.get('tx_ref');const transactionId = url.match(/transactions\/(\d+)\/verify/)?.[1] || [...verified].find(([,value])=>value.tx_ref===reference)?.[0]; return { ok: true, json: async () => ({ status: 'success', data: verified.get(transactionId) || { id: transactionId, status: 'failed' } }) };
  };
  const payments = new MongoPaymentStore({ store, admin, fetchImpl, configKey: key, publicOrigin: 'https://game.example' }); await payments.init({ ensureIndexes: false });
  if (configured) await payments.configure(owner, { mode: 'test', enabled: true, creditRate: 10, secretKey: SECRET, webhookSecret: SIGNING, activate: true });
  return { connection, store, admin, payments, owner, resident, other: otherRegistration.residentId, otherToken: otherRegistration.token, key, verified, calls, advance(ms) { now += ms; } };
}
async function checkout(f, operationKey = unique('checkout_'), amount = 1000) { return (await f.payments.checkout(f.resident, { amount, email: 'fixture@example.test', idempotencyKey: operationKey })).checkout; }
function providerSuccess(f, order, transactionId = String(crypto.randomInt(100000000, 2000000000)), overrides = {}) {
  f.verified.set(transactionId, { id: transactionId, tx_ref: order.txRef, amount: order.amount, currency: 'NGN', status: 'successful', ...overrides }); return transactionId;
}
function webhook(f, order, transactionId) {
  const raw = Buffer.from(JSON.stringify({ event: 'charge.completed', data: { id: transactionId, tx_ref: order.txRef, verified: true, amount: order.amount } }));
  return { raw, signature: crypto.createHmac('sha256', SIGNING).update(raw).digest('base64') };
}

integration('v3 webhook hash verifies with Flutterwave before credit and cooperates with callback replay',async t=>{
 const f=await fixture(t),order=await checkout(f),id=providerSuccess(f,order),before=(await f.store.profile(f.resident)).wallet,{raw}=webhook(f,order,id);
 await rejectCode(f.payments.handleWebhook(raw,undefined,'wrong'),'invalid_webhook_signature');
 await rejectCode(f.payments.handleWebhook(raw,'wrong',SIGNING),'invalid_webhook_signature');
 providerSuccess(f,order,id,{amount:1});await rejectCode(f.payments.handleWebhook(raw,undefined,SIGNING),'payment_verification_failed');
 assert.equal((await f.store.profile(f.resident)).wallet,before);
 providerSuccess(f,order,id);await f.payments.handleWebhook(raw,undefined,SIGNING);await f.payments.verify(f.resident,{txRef:order.txRef});
 assert.equal((await f.store.profile(f.resident)).wallet,before+order.credits);assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({txRef:order.txRef}),1);
});

integration('Mongo payment credentials are encrypted, scoped, masked, and unavailable without the server key', async t => {
  const f = await fixture(t), row = await f.connection.db.collection('payment_config').findOne({ _id: 'test' });
  assert.ok(!JSON.stringify(row).includes(SECRET)); assert.ok(!JSON.stringify(row).includes(SIGNING));
  const exposed = JSON.stringify(await f.payments.adminConfig(f.owner)); assert.ok(!exposed.includes(SECRET)); assert.ok(!exposed.includes(SIGNING));
  assert.ok(!JSON.stringify(await f.admin.audit(f.owner)).includes(SECRET));
  await rejectCode(f.payments.configure(f.resident, { mode: 'test', secretKey: SECRET }), 'admin_forbidden');
  const disabled = new MongoPaymentStore({ store: f.store, admin: f.admin, configKey: '', publicOrigin: 'https://game.example' });
  assert.equal((await disabled.publicConfig()).enabled, false); await rejectCode(disabled.configure(f.owner, { mode: 'test' }), 'config_key_required');
  const changed = new MongoPaymentStore({ store: f.store, admin: f.admin, configKey: crypto.randomBytes(32).toString('hex') }); assert.equal((await changed.publicConfig()).enabled, false);
  const encrypted = f.payments.encrypt({ secret: SECRET }, 'fixture-one'); assert.throws(() => f.payments.decrypt(encrypted, 'fixture-other'), { code: 'config_key_mismatch' });
  await rejectCode(f.payments.configure(f.owner, { mode: 'live', secretKey: SECRET }), 'invalid_payment'); await rejectCode(f.payments.configure(f.owner, { mode: 'test', publicOrigin: 'http://game.example' }), 'invalid_payment');
});

integration('Mongo checkout persists authoritative amounts and encrypted credentials with one provider request per idempotency key', async t => {
  const f = await fixture(t), before = (await f.store.profile(f.resident)).wallet, operationKey = unique('checkout_');
  const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => f.payments.checkout(f.resident, { amount: 1000, email: 'fixture@example.test', credits: 999999999, verified: true, idempotencyKey: operationKey })));
  const successes = attempts.filter(value => value.status === 'fulfilled'); assert.ok(successes.length >= 1);
  assert.ok(attempts.filter(value => value.status === 'rejected').every(value => value.reason.code === 'checkout_processing'));
  const order = successes[0].value.checkout; assert.equal(order.credits, 10000); assert.equal(order.status, 'pending'); assert.equal((await f.store.profile(f.resident)).wallet, before);
  assert.equal(f.calls.filter(call => call.url.endsWith('/v3/payments')).length, 1); const call = f.calls[0], body = JSON.parse(call.options.body);
  assert.equal(call.url, 'https://api.flutterwave.com/v3/payments'); assert.equal(call.options.redirect, 'error'); assert.equal(body.amount, 1000); assert.equal(body.currency, 'NGN'); assert.equal(new URL(body.redirect_url).origin, 'https://game.example');
  const row = await f.connection.db.collection('payment_orders').findOne({ txRef: order.txRef }); assert.ok(!row.encryptedSecret.includes(SECRET));
  const replay = await f.payments.checkout(f.resident, { amount: 1000, email: 'fixture@example.test', idempotencyKey: operationKey }); assert.equal(replay.replayed, true); assert.equal(replay.checkout.txRef, order.txRef);
  await rejectCode(f.payments.checkout(f.resident, { amount: 1001, email: 'fixture@example.test', idempotencyKey: operationKey }), 'idempotency_conflict');
});

integration('Mongo provider amount currency status identity and reference mismatches cannot grant wallet credits', async t => {
  const f = await fixture(t), order = await checkout(f), before = (await f.store.profile(f.resident)).wallet;
  for (const override of [{ amount: 999 }, { currency: 'USD' }, { tx_ref: 'invented-reference' }, { status: 'pending' }, { id: '9999999999' }]) {
    const transactionId = providerSuccess(f, order, undefined, override);
    await rejectCode(f.payments.verify(f.resident, { transactionId, txRef: order.txRef, verified: true, amount: 1000 }), 'payment_verification_failed'); assert.equal((await f.store.profile(f.resident)).wallet, before);
  }
  await rejectCode(f.payments.creditVerified({ order, transactionId: '1234', verified: true }), 'payment_verification_required');
  assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({ residentId: f.resident }), 0);
  assert.equal(await f.connection.db.collection('ledger').countDocuments({ residentId: f.resident, type: 'PAYMENT_TOPUP' }), 0);
  for (const provider of ['apple', 'google']) await rejectCode(f.payments.verifyStoreReceipt(f.resident, { provider, verified: true, amount: 1000000 }), 'store_provider_unconfigured');
});

integration('Mongo concurrent verification and signed webhooks commit one receipt credit ledger entry and audit event', async t => {
  const f = await fixture(t), order = await checkout(f), transactionId = providerSuccess(f, order), before = (await f.store.profile(f.resident)).wallet, { raw, signature } = webhook(f, order, transactionId), logs = [];
  f.payments.log = (event, fields) => logs.push({ event, fields });
  const responses = await Promise.all(Array.from({ length: 10 }, (_, index) => index % 2 ? f.payments.verify(f.resident, { transactionId, txRef: order.txRef }) : f.payments.handleWebhook(raw, signature)));
  assert.equal(responses.filter(value => !value.replayed).length, 1); assert.ok(responses.every(value => value.profile.wallet === before + 10000 && value.payment.status === 'credited'));
  assert.equal((await f.store.profile(f.resident)).wallet, before + 10000); assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({ transactionId, provider: 'flutterwave' }), 1);
  const ledger = await f.connection.db.collection('ledger').find({ residentId: f.resident, type: 'PAYMENT_TOPUP' }).toArray(); assert.equal(ledger.length, 1); assert.equal(ledger[0].amount, 10000); assert.equal(ledger[0].balanceAfter, before + 10000);
  assert.equal(await f.connection.db.collection('admin_audit').countDocuments({ action: 'credit-verified-payment', 'details.txRef': order.txRef }), 1);
  assert.equal(logs.filter(value => value.event === 'payment_grant').length, 1);
  assert.equal(logs.filter(value => value.event === 'payment_replay').length, 9);
  assert.ok(!JSON.stringify(logs).includes(SECRET));
  for (const [collection, query] of [['payment_receipts', { transactionId }], ['economy_operations', { residentId: f.resident }], ['admin_audit', { 'details.txRef': order.txRef }]]) {
    await assert.rejects(f.connection.db.collection(collection).updateOne(query, { $set: { tampered: true } }), error => error.code === 13);
    await assert.rejects(f.connection.db.collection(collection).deleteOne(query), error => error.code === 13);
  }
  const restarted = new MongoPaymentStore({ store: new MongoGameStore({ ...f.connection }), admin: new MongoAdminStore({ store: f.store }), configKey: f.key, fetchImpl: f.payments.fetch });
  const replay = await restarted.verify(f.resident, { transactionId, txRef: order.txRef }); assert.equal(replay.replayed, true); assert.equal(replay.profile.wallet, before + 10000);
});

integration('Mongo globally unique provider receipts prevent a transaction being credited to another order or resident', async t => {
  const f = await fixture(t), first = await checkout(f), second = (await f.payments.checkout(f.other, { amount: 1000, email: 'other@example.test', idempotencyKey: unique('checkout_') })).checkout;
  const transactionId = providerSuccess(f, first); await f.payments.verify(f.resident, { transactionId, txRef: first.txRef });
  providerSuccess(f, second, transactionId); await rejectCode(f.payments.verify(f.other, { transactionId, txRef: second.txRef }), 'payment_duplicate');
  await rejectCode(f.payments.status(f.other, first.txRef), 'payment_not_found'); await rejectCode(f.payments.verify(f.other, { transactionId, txRef: first.txRef }), 'payment_not_found');
  assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({ transactionId }), 1); assert.equal((await f.payments.status(f.other, second.txRef)).payment.status, 'pending');
});

integration('Mongo raw-body HMAC validation and provider outage or untrusted checkout URLs never grant money', async t => {
  const f = await fixture(t), order = await checkout(f), transactionId = providerSuccess(f, order), { raw, signature } = webhook(f, order, transactionId), before = (await f.store.profile(f.resident)).wallet;
  await rejectCode(f.payments.handleWebhook(raw, SIGNING), 'invalid_webhook_signature'); await rejectCode(f.payments.handleWebhook(Buffer.concat([raw, Buffer.from(' ')]), signature), 'invalid_webhook_signature');
  providerSuccess(f, order, transactionId, { amount: 1 }); await rejectCode(f.payments.handleWebhook(raw, signature), 'payment_verification_failed');
  f.payments.fetch = async () => { throw new Error('Explicit unavailable provider fixture'); }; await rejectCode(checkout(f), 'provider_unavailable');
  f.payments.fetch = async () => ({ ok: true, json: async () => ({ status: 'success', data: { link: 'https://evil.example/card' } }) }); await rejectCode(checkout(f), 'invalid_checkout');
  assert.equal((await f.store.profile(f.resident)).wallet, before); assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({ residentId: f.resident }), 0);
});

integration('Mongo wallet overflow rolls back provider receipt payment state ledger and audit atomically', async t => {
  const f = await fixture(t), order = await checkout(f), transactionId = providerSuccess(f, order), current = (await f.store.profile(f.resident)).wallet;
  await f.admin.adjustWallet(f.owner, { residentId: f.resident, amount: Number.MAX_SAFE_INTEGER - current - 500, reason: 'Explicit post-checkout numeric boundary fixture', idempotencyKey: unique('adjust_') });
  const before = (await f.store.profile(f.resident)).wallet; await rejectCode(f.payments.verify(f.resident, { transactionId, txRef: order.txRef }), 'wallet_limit');
  assert.equal((await f.store.profile(f.resident)).wallet, before); assert.equal((await f.payments.status(f.resident, order.txRef)).payment.status, 'pending');
  assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({ txRef: order.txRef }), 0); assert.equal(await f.connection.db.collection('ledger').countDocuments({ residentId: f.resident, type: 'PAYMENT_TOPUP' }), 0);
  const calls = f.calls.length; await rejectCode(checkout(f), 'wallet_limit'); assert.equal(f.calls.length, calls);
});

integration('Mongo administrative permissions corrections suspensions reports settings and keyset pages persist', async t => {
  const f = await fixture(t), before = (await f.store.profile(f.resident)).wallet, correction = { residentId: f.resident, amount: 1000, reason: 'Authorized audited correction fixture', idempotencyKey: unique('adjust_') };
  await rejectCode(f.admin.adjustWallet(f.resident, correction), 'admin_forbidden');
  const corrections = await Promise.all(Array.from({ length: 6 }, () => f.admin.adjustWallet(f.owner, correction))); assert.equal(corrections.filter(value => !value.replayed).length, 1); assert.equal((await f.store.profile(f.resident)).wallet, before + 1000);
  await rejectCode(f.admin.adjustWallet(f.owner, { ...correction, amount: 2 }), 'idempotency_conflict'); await rejectCode(f.admin.adjustWallet(f.owner, { ...correction, residentId: f.other }), 'idempotency_conflict');
  await f.admin.assignRole(f.owner, { residentId: f.other, role: 'moderator' }); await rejectCode(f.admin.adjustWallet(f.other, { ...correction, idempotencyKey: unique('adjust_') }), 'admin_forbidden');
  await f.admin.setSuspension(f.owner, { residentId: f.other, suspended: true, reason: 'Authorized moderation fixture decision' }); assert.equal(await f.store.session(f.otherToken), null); assert.equal((await f.admin.status(f.other)).role, null);
  await f.admin.setSuspension(f.owner, { residentId: f.other, suspended: false, reason: 'Completed moderation fixture review' }); assert.equal(await f.store.session(f.otherToken), null); assert.equal((await f.admin.status(f.other)).role, 'moderator');
  const reportId = crypto.randomUUID(); await f.connection.db.collection('reports').insertOne({ id: reportId, reporterId: f.resident, targetId: f.other, reason: 'Original fixture report must stay intact', createdAt: Date.now() });
  await f.admin.reviewReport(f.owner, { reportId, status: 'resolved', note: 'Investigated and resolved the fixture report' }); assert.equal((await f.connection.db.collection('reports').findOne({ id: reportId })).reason, 'Original fixture report must stay intact');
  const reportReview = await f.connection.db.collection('report_reviews').findOne({ reportId }); assert.equal(reportReview.status, 'resolved');
  await rejectCode(f.admin.saveSettings(f.owner, { gameTopupsEnabled: true }), 'topup_disabled'); assert.equal((await f.admin.publicSettings()).gameTopupsEnabled, false); await rejectCode(f.store.topup(f.resident, { amount: 1000, verified: true, idempotencyKey: unique('topup_') }), 'topup_disabled');
  await f.admin.saveSettings(f.owner, { maintenance: true }); assert.equal((await new MongoAdminStore({ store: f.store }).publicSettings()).maintenance, true); await f.admin.saveSettings(f.owner, { maintenance: false });
  const first = await f.admin.residents(f.owner, { query: 'pay_', limit: 2 }); assert.ok(first.nextCursor); const second = await f.admin.residents(f.owner, { query: 'pay_', limit: 2, cursor: first.nextCursor }); assert.equal(first.residents.some(a => second.residents.some(b => a.id === b.id)), false); assert.ok(!JSON.stringify(first).includes('password'));
  await assert.rejects(f.connection.db.collection('ledger').updateOne({ residentId: f.resident }, { $set: { amount: 0 } }), error => error.code === 13); await assert.rejects(f.connection.db.collection('ledger').deleteOne({ residentId: f.resident }), error => error.code === 13);
});

integration('Mongo concurrent receipts for different residents still grant a globally shared provider transaction only once', async t => {
  const f = await fixture(t), first = await checkout(f), second = (await f.payments.checkout(f.other, { amount: 1000, email: 'other@example.test', idempotencyKey: unique('checkout_') })).checkout;
  const transactionId = providerSuccess(f, first), firstProof = await f.payments.verifiedOrder(transactionId, first.txRef, f.resident);
  // Explicit provider fault fixture: the same provider ID later claims another reference.
  providerSuccess(f, second, transactionId); const secondProof = await f.payments.verifiedOrder(transactionId, second.txRef, f.other);
  const balances = [(await f.store.profile(f.resident)).wallet, (await f.store.profile(f.other)).wallet];
  const results = await Promise.allSettled([f.payments.creditVerified(firstProof), f.payments.creditVerified(secondProof)]);
  assert.equal(results.filter(value => value.status === 'fulfilled').length, 1); assert.equal(results.filter(value => value.status === 'rejected' && value.reason.code === 'payment_duplicate').length, 1);
  const after = [(await f.store.profile(f.resident)).wallet, (await f.store.profile(f.other)).wallet]; assert.equal(after[0] + after[1], balances[0] + balances[1] + 10000);
  assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({ transactionId }), 1); assert.equal(await f.connection.db.collection('ledger').countDocuments({ residentId: { $in: [f.resident, f.other] }, type: 'PAYMENT_TOPUP' }), 1);
});

integration('Mongo failure after payment state and wallet writes aborts all records then allows a clean verified retry', async t => {
  const f = await fixture(t), order = await checkout(f), transactionId = providerSuccess(f, order), before = (await f.store.profile(f.resident)).wallet;
  const appendLedger = f.store.appendLedger; f.store.appendLedger = async () => { throw Object.assign(new Error('Explicit persistence failure fixture'), { code: 'fixture_write_failure' }); };
  await rejectCode(f.payments.verify(f.resident, { transactionId, txRef: order.txRef }), 'fixture_write_failure'); f.store.appendLedger = appendLedger;
  assert.equal((await f.store.profile(f.resident)).wallet, before); assert.equal((await f.payments.status(f.resident, order.txRef)).payment.status, 'pending');
  assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({ txRef: order.txRef }), 0); assert.equal(await f.connection.db.collection('admin_audit').countDocuments({ 'details.txRef': order.txRef, action: 'credit-verified-payment' }), 0);
  const retry = await f.payments.verify(f.resident, { transactionId, txRef: order.txRef }); assert.equal(retry.profile.wallet, before + 10000); assert.equal(retry.replayed, false);
});

integration('Mongo concurrent administrator demotions preserve the last active owner with a serialized RBAC check', async t => {
  const f = await fixture(t), roleCollection=f.connection.db.collection('admin_roles');
  const priorOwner=await roleCollection.findOne({residentId:f.owner}),priorOther=await roleCollection.findOne({residentId:f.other});
  await f.admin.assignRole(f.owner, { residentId: f.other, role: 'superadmin' });
  const countBeforeRace=await roleCollection.countDocuments({role:'superadmin'});
  const results = await Promise.allSettled([f.admin.assignRole(f.owner, { residentId: f.owner, role: null }), f.admin.assignRole(f.other, { residentId: f.other, role: null })]);
  const active=await roleCollection.find({role:'superadmin'}).toArray();
  assert.ok(active.length>=1,'concurrent role changes must preserve an active superadministrator');
  if(countBeforeRace===2){assert.equal(results.filter(value => value.status === 'fulfilled').length, 1);assert.equal(results.filter(value => value.status === 'rejected' && value.reason.code === 'last_superadmin').length, 1);}
  // This integration fixture is reused across test runs. Restore the two roles
  // touched here so a repeat run neither accumulates admins nor disables its
  // bootstrap administrator.
  let actor=active[0].residentId;
  const currentOwner=await roleCollection.findOne({residentId:f.owner});
  if(priorOwner&&!currentOwner){await f.admin.assignRole(actor,{residentId:f.owner,role:priorOwner.role});actor=f.owner;}
  else if(currentOwner)actor=f.owner;
  const currentOther=await roleCollection.findOne({residentId:f.other});
  if(priorOther){if(!currentOther||currentOther.role!==priorOther.role)await f.admin.assignRole(actor,{residentId:f.other,role:priorOther.role});}
  else if(currentOther)await f.admin.assignRole(actor,{residentId:f.other,role:null});
  const ownerStatus = await f.admin.status(f.owner); assert.equal(ownerStatus.role,priorOwner?.role||null);
});

integration('Mongo administrative key reuse racing across two wallets grants one correction and returns a domain conflict', async t => {
  const f = await fixture(t), operationKey = unique('adjust_'), before = (await f.store.profile(f.resident)).wallet + (await f.store.profile(f.other)).wallet;
  const body = { amount: 1000, reason: 'Authorized cross-wallet idempotency race fixture', idempotencyKey: operationKey };
  const results = await Promise.allSettled([f.admin.adjustWallet(f.owner, { ...body, residentId: f.resident }), f.admin.adjustWallet(f.owner, { ...body, residentId: f.other })]);
  assert.equal(results.filter(value => value.status === 'fulfilled').length, 1); assert.equal(results.filter(value => value.status === 'rejected' && value.reason.code === 'idempotency_conflict').length, 1);
  assert.equal((await f.store.profile(f.resident)).wallet + (await f.store.profile(f.other)).wallet, before + 1000);
  assert.equal(await f.connection.db.collection('wallet_operations').countDocuments({ actorId: f.owner, operationKey }), 1);
});


integration('reference-only return and competing background workers fulfill an abandoned purchase exactly once',async t=>{
 const f=await fixture(t),order=await checkout(f),before=(await f.store.profile(f.resident)).wallet;
 providerSuccess(f,order);f.advance(120001);
 const results=await Promise.all([f.payments.reconcilePending({limit:1}),f.payments.reconcilePending({limit:1}),f.payments.verify(f.resident,{txRef:order.txRef})]);
 assert.equal((await f.store.profile(f.resident)).wallet,before+10000);
 assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({txRef:order.txRef}),1);
 assert.equal(await f.connection.db.collection('ledger').countDocuments({residentId:f.resident,type:'PAYMENT_TOPUP'}),1);
 assert.equal((await f.payments.status(f.resident,order.txRef)).payment.fulfillmentStatus,'fulfilled');
 const replay=await f.payments.verify(f.resident,{txRef:order.txRef});assert.equal(replay.replayed,true);
});

integration('reference verification requires order ownership and wrong provider facts never produce credits',async t=>{
 const f=await fixture(t),order=await checkout(f),before=(await f.store.profile(f.resident)).wallet,calls=f.calls.length;
 await rejectCode(f.payments.verify(f.other,{txRef:order.txRef}),'payment_not_found');assert.equal(f.calls.length,calls);
 providerSuccess(f,order,undefined,{amount:999});await rejectCode(f.payments.verify(f.resident,{txRef:order.txRef}),'payment_verification_failed');
 assert.equal((await f.store.profile(f.resident)).wallet,before);assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({txRef:order.txRef}),0);
});

integration('map-wide city and sky ad reservations race safely, verify by reference, render their actual image and replay once',async t=>{
 const f=await fixture(t),ads=new MongoAdStore({store:f.store,admin:f.admin,payments:f.payments});await ads.init({ensureIndexes:false});ads.attach();const baselineInventory=await ads.inventory(f.owner);
 const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(320,16);png.writeUInt32BE(200,20);
 const sky=await ads.world({zoneId:'sky-displays',page:100}),city=await ads.world({zoneId:'map-parcels',page:0});assert.ok(sky.spaces.some(p=>p.available));const slots=[city.spaces.find(p=>p.available).id];
 const input={kind:'plot',slots,title:'Fixture city business',email:'advertiser@example.test',link:'https://example.com/business',imageDataUrl:'data:image/png;base64,'+png.toString('base64')};
 const callsBefore=f.calls.length,attempts=await Promise.allSettled([ads.checkout(f.resident,{...input,idempotencyKey:unique('ad_')}),ads.checkout(f.other,{...input,idempotencyKey:unique('ad_')})]);
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(attempts.find(r=>r.status==='rejected').reason.code,'ad_space_taken');
 const order=attempts.find(r=>r.status==='fulfilled').value.checkout,own=(await f.connection.db.collection('ad_orders').findOne({txRef:order.txRef})).residentId;
 const checkoutCall=f.calls.slice(callsBefore).find(call=>call.url.endsWith('/v3/payments')&&JSON.parse(call.options.body).tx_ref===order.txRef),checkoutBody=JSON.parse(checkoutCall.options.body);
 assert.equal(checkoutBody.amount,2000);assert.equal(checkoutBody.currency,'NGN');assert.equal(checkoutBody.customizations.description,'AbujaLife city ad plot · 7 days');
 assert.deepEqual(checkoutBody.meta,{abujalife_reference:order.txRef,purpose:'advertising',kind:'plot'});assert.ok(Object.values(checkoutBody.meta).every(value=>['string','number','boolean'].includes(typeof value)));
 const id=providerSuccess(f,order);const before=(await f.store.profile(own)).wallet;
 const results=await Promise.all([f.payments.verify(own,{purpose:'ad',txRef:order.txRef}),f.payments.verify(own,{purpose:'ad',txRef:order.txRef,transactionId:id})]);
 assert.equal(results.filter(r=>!r.replayed).length,1);assert.equal(await f.connection.db.collection('ad_receipts').countDocuments({txRef:order.txRef}),1);
 assert.equal((await f.store.profile(own)).wallet,before,'real Naira ads never spend or credit game wallets');
 assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({txRef:order.txRef,purpose:'ad',credits:0}),1);
 const state=await ads.publicState();assert.ok(state.active.some(ad=>ad.txRef===order.txRef&&ad.slots.length===1&&ad.imageDataUrl===input.imageDataUrl));
 const visible=await ads.world({bounds:{x:-40000,y:-40000,width:80000,height:80000}});assert.ok(visible.active.some(ad=>ad.txRef===order.txRef));
 const adminList=await f.payments.list(f.owner,{limit:100});assert.ok(adminList.payments.some(ad=>ad.txRef===order.txRef&&ad.purpose==='ad'&&ad.fulfillmentStatus==='fulfilled'));
 const inventory=await ads.inventory(f.owner),inventorySize=inventory.summary.total;assert.ok(inventorySize>=MAP_AD_INVENTORY.length+COMPATIBILITY_MAP_AD_INVENTORY.length+BILLBOARD_IDS.length);assert.equal(inventory.summary.occupied,baselineInventory.summary.occupied+1);assert.equal(inventory.summary.available,inventorySize-inventory.summary.occupied);
 const assigned=inventory.plots.find(p=>p.id===slots[0]);assert.equal(assigned.campaign.txRef,order.txRef);assert.equal(assigned.campaign.residentId,own);assert.equal(assigned.available,false);assert.equal(assigned.width,city.spaces.find(p=>p.id===slots[0]).width);
 await assert.rejects(ads.inventory(f.other),error=>error.status===403);
 const protectedSpace=(await ads.world({zoneId:'capital-brand-coast',limit:180})).spaces.find(p=>!p.eligible);assert.ok(protectedSpace);const gatewayCalls=f.calls.length;
 await rejectCode(ads.checkout(f.resident,{...input,slots:[protectedSpace.id],idempotencyKey:unique('protected_')}),'invalid_ad_space');assert.equal(f.calls.length,gatewayCalls);
 f.advance(7*24*60*60*1000+1);const expired=await ads.inventory(f.owner);assert.equal(expired.plots.find(p=>p.id===slots[0]).available,true,'the tested campaign expires and frees its own plot');assert.equal(expired.summary.available,inventorySize-expired.summary.occupied);

});


integration('historical five-slot checkouts retain their IDs, safe displays and single receipt after deployment',async t=>{
 const f=await fixture(t),ads=new MongoAdStore({store:f.store,admin:f.admin,payments:f.payments});await ads.init({ensureIndexes:false});ads.attach();
 const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(320,16);png.writeUInt32BE(200,20);
 for(const slots of [['plot-10','plot-11','plot-14','plot-23','plot-26'],[32,33,38,39,44].map(c=>`ad:city-frontage:80:${c}`)]){
  const order=(await ads.checkout(f.resident,{kind:'plot',slots:[slots[0]],title:'Historical campaign fixture',email:'advertiser@example.test',link:'https://example.com/business',imageDataUrl:'data:image/png;base64,'+png.toString('base64'),idempotencyKey:unique('historic_')})).checkout;
  // Emulate a checkout stored by the previous five-slot release in this
  // disposable database; production campaign rows are never rewritten.
  await f.connection.db.collection('ad_orders').updateOne({_id:order.txRef},{$set:{slots}});
  const first=await f.connection.db.collection('ad_slots').findOne({_id:slots[0]});
  await f.connection.db.collection('ad_slots').insertMany(slots.slice(1).map(id=>({...first,_id:id,mapX:-99999,mapY:-99999})));
  providerSuccess(f,order);const paid=await f.payments.verify(f.resident,{purpose:'ad',txRef:order.txRef});assert.deepEqual(paid.ad.slots,slots);
  const replay=await f.payments.verify(f.resident,{purpose:'ad',txRef:order.txRef});assert.equal(replay.replayed,true);assert.equal(await f.connection.db.collection('ad_receipts').countDocuments({txRef:order.txRef}),1);
  // Already-active old releases also have stale spatial index coordinates.
  await f.connection.db.collection('ad_slots').updateMany({txRef:order.txRef},{$set:{mapX:-99999,mapY:-99999}});
  const p=adSpaceFromId(slots[0]),view=await ads.world({bounds:{x:p.x,y:p.y,width:p.width,height:p.height}}),campaign=view.active.find(a=>a.txRef===order.txRef);assert.ok(campaign);assert.equal(mapAdPlacements([campaign],f.store.clock()).length,5);
  const inventory=await ads.inventory(f.owner);for(const id of slots){const parcel=inventory.plots.find(p=>p.id===id);assert.ok(parcel);assert.equal(parcel.available,false);assert.equal(parcel.campaign.txRef,order.txRef);}
 }
});

integration('one verified provider transaction cannot fulfill both a game-credit order and an ad campaign',async t=>{
 const f=await fixture(t),ads=new MongoAdStore({store:f.store,admin:f.admin,payments:f.payments});await ads.init({ensureIndexes:false});ads.attach();
 const order=await checkout(f,unique('global_'),2000),id=providerSuccess(f,order);await f.payments.verify(f.resident,{txRef:order.txRef});
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXQAAAABJRU5ErkJggg==';
 const ad=(await ads.checkout(f.other,{kind:'billboard',slots:[(await ads.publicState()).spaces.find(p=>p.kind==='billboard'&&p.available).id],title:'Identity fixture',email:'fixture@example.test',link:'https://example.com',imageDataUrl:image,idempotencyKey:unique('ad_')})).checkout;
 providerSuccess(f,ad,id);await rejectCode(f.payments.verify(f.other,{purpose:'ad',txRef:ad.txRef}),'payment_duplicate');
 assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({transactionId:id}),1);
 assert.equal(await f.connection.db.collection('ad_receipts').countDocuments({transactionId:id}),0);
  assert.equal((await ads.status(f.other,ad.txRef)).payment.status,'pending');
});

const adCreative='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXQAAAABJRU5ErkJggg==';
async function adCheckout(f,ads,{resident=f.resident,slot,kind='plot',key=unique('ad_')}={}){
 const inventory=await ads.inventory(f.owner),space=slot||inventory.plots.find(p=>p.kind===kind&&p.available)?.id;
 assert.ok(space,'disposable fixture should have a free ad placement');
 return (await ads.checkout(resident,{kind,slots:[space],title:'Revenue audit fixture',email:'advertiser@example.test',link:'https://example.com/business',imageDataUrl:adCreative,idempotencyKey:key,amount:1,credits:999999999,mode:'live',verified:true})).checkout;
}

integration('advertising revenue counts unique verified receipts, separates test/live, and survives campaign expiry',async t=>{
 const f=await fixture(t),ads=new MongoAdStore({store:f.store,admin:f.admin,payments:f.payments});await ads.init({ensureIndexes:false});ads.attach();
 const before=(await ads.inventory(f.owner)).revenue,wallet=(await f.store.profile(f.resident)).wallet;
 const pending=await adCheckout(f,ads);assert.equal(pending.amount,2000);assert.equal(pending.mode,'test');
 assert.deepEqual((await ads.inventory(f.owner)).revenue,before,'unpaid checkout amounts never count as revenue');
 const calls=f.calls.length;await rejectCode(ads.verify(f.other,{txRef:pending.txRef}),'payment_not_found');assert.equal(f.calls.length,calls);
 const transactionId=providerSuccess(f,pending),{raw,signature}=webhook(f,pending,transactionId);
 const results=await Promise.all(Array.from({length:8},(_,i)=>i%2?f.payments.verify(f.resident,{purpose:'ad',txRef:pending.txRef}):f.payments.handleWebhook(raw,signature)));
 assert.equal(results.filter(result=>!result.replayed).length,1);
 assert.equal(await f.connection.db.collection('ad_receipts').countDocuments({txRef:pending.txRef}),1);
 assert.equal(await f.connection.db.collection('admin_audit').countDocuments({action:'activate-verified-ad','details.txRef':pending.txRef}),1);
 const testRevenue=(await ads.inventory(f.owner)).revenue;assert.equal(testRevenue.test.fulfilledNgn,before.test.fulfilledNgn+2000);assert.equal(testRevenue.test.fulfilledPayments,before.test.fulfilledPayments+1);assert.deepEqual(testRevenue.live,before.live);
 // The provider remains this fixture's in-process fake adapter. Selecting
 // live mode here never sends a charge to a live merchant or real customer.
 await f.payments.configure(f.owner,{mode:'live',enabled:true,creditRate:10,secretKey:'FLWSECK-fixture-live-secret-000000000000000',webhookSecret:SIGNING,activate:true});
 const live=await adCheckout(f,ads);assert.equal(live.mode,'live');assert.deepEqual((await ads.inventory(f.owner)).revenue,testRevenue);
 providerSuccess(f,live);await f.payments.verify(f.resident,{purpose:'ad',txRef:live.txRef});
 const paid=(await ads.inventory(f.owner)).revenue;assert.equal(paid.live.fulfilledNgn,before.live.fulfilledNgn+2000);assert.equal(paid.live.fulfilledPayments,before.live.fulfilledPayments+1);assert.deepEqual(paid.test,testRevenue.test);assert.equal(paid.settlementVerified,false);assert.equal(paid.gross,true);
 assert.equal((await f.store.profile(f.resident)).wallet,wallet,'advertising receipts never change Game Naira');
 f.advance(7*24*60*60*1000+1);
 const expired=await ads.mine(f.resident,{status:'expired'}),active=await ads.mine(f.resident,{status:'active'});
 for(const txRef of [pending.txRef,live.txRef]){assert.ok(expired.ads.some(row=>row.txRef===txRef&&row.status==='expired'));assert.ok(!active.ads.some(row=>row.txRef===txRef));assert.equal((await ads.status(f.resident,txRef)).payment.status,'expired');assert.equal((await f.connection.db.collection('ad_orders').findOne({txRef})).status,'active','expiry is a view of server timestamps, not a rewrite of paid orders');}
 const replay=await ads.verify(f.resident,{txRef:live.txRef});assert.equal(replay.replayed,true);assert.equal(replay.ad.status,'expired');
 assert.deepEqual((await ads.inventory(f.owner)).revenue,paid,'expiry and callback retries do not reduce or duplicate lifetime gross receipts');
 await rejectCode(ads.inventory(f.other),'admin_forbidden');
});

integration('late paid advertising cannot displace another campaign and unresolved payments remain visible to operators',async t=>{
 const f=await fixture(t),ads=new MongoAdStore({store:f.store,admin:f.admin,payments:f.payments});await ads.init({ensureIndexes:false});ads.attach();
 const before=(await ads.inventory(f.owner)).revenue,delayed=await adCheckout(f,ads);
 f.advance(24*60*60*1000+1);
 const replacement=await adCheckout(f,ads,{resident:f.other,slot:delayed.slots[0]});providerSuccess(f,replacement);await ads.verify(f.other,{txRef:replacement.txRef});
 providerSuccess(f,delayed);await rejectCode(ads.verify(f.resident,{txRef:delayed.txRef}),'ad_space_unavailable_after_payment');
 const lock=await f.connection.db.collection('ad_slots').findOne({_id:delayed.slots[0]});assert.equal(lock.txRef,replacement.txRef);assert.equal(lock.state,'active');
 assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({txRef:delayed.txRef}),0);assert.equal(await f.connection.db.collection('ad_receipts').countDocuments({txRef:delayed.txRef}),0);
 const status=(await ads.status(f.resident,delayed.txRef)).payment;assert.equal(status.fulfillmentStatus,'failed');assert.equal(status.failureReason,'ad_space_unavailable_after_payment');assert.ok(status.verifiedAt);
 const blocked=(await ads.inventory(f.owner)).revenue;assert.equal(blocked.test.fulfilledNgn,before.test.fulfilledNgn+2000);assert.equal(blocked.test.paidUnfulfilledNgn,before.test.paidUnfulfilledNgn+2000);assert.equal(blocked.test.paidUnfulfilledPayments,before.test.paidUnfulfilledPayments+1);
 f.advance(7*24*60*60*1000+1);
 const recovered=await ads.verify(f.resident,{txRef:delayed.txRef});assert.equal(recovered.ad.status,'active');assert.equal(recovered.ad.failureReason,null);assert.equal(recovered.ad.endAt-recovered.ad.startAt,7*24*60*60*1000);
 const after=(await ads.inventory(f.owner)).revenue;assert.equal(after.test.fulfilledNgn,before.test.fulfilledNgn+4000);assert.equal(after.test.paidUnfulfilledNgn,before.test.paidUnfulfilledNgn);assert.equal(after.test.paidUnfulfilledPayments,before.test.paidUnfulfilledPayments);
 assert.equal(await f.connection.db.collection('admin_audit').countDocuments({action:'activate-verified-ad','details.txRef':delayed.txRef}),1);
});

integration('ad activation and audit are one atomic transaction and failed persistence can be retried safely',async t=>{
 const f=await fixture(t),ads=new MongoAdStore({store:f.store,admin:f.admin,payments:f.payments});await ads.init({ensureIndexes:false});ads.attach();
 const order=await adCheckout(f,ads,{kind:'billboard'});providerSuccess(f,order);
 await rejectCode(ads.activateVerified({order,transactionId:'1234',verified:true}),'payment_verification_required');
 const record=f.admin.record;f.admin.record=async(...args)=>{if(args[1]==='activate-verified-ad')throw Object.assign(new Error('Explicit disposable audit persistence failure'),{code:'fixture_ad_audit_failure'});return record.apply(f.admin,args);};
 try{await rejectCode(ads.verify(f.resident,{txRef:order.txRef}),'fixture_ad_audit_failure');}finally{f.admin.record=record;}
 assert.equal((await ads.status(f.resident,order.txRef)).payment.status,'pending');assert.equal((await f.connection.db.collection('ad_slots').findOne({_id:order.slots[0]})).state,'reserved');
 assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({txRef:order.txRef}),0);assert.equal(await f.connection.db.collection('ad_receipts').countDocuments({txRef:order.txRef}),0);assert.equal(await f.connection.db.collection('admin_audit').countDocuments({action:'activate-verified-ad','details.txRef':order.txRef}),0);
 const retry=await ads.verify(f.resident,{txRef:order.txRef});assert.equal(retry.replayed,false);assert.equal(retry.ad.status,'active');assert.equal(retry.ad.failureReason,null);
 const replay=await ads.verify(f.resident,{txRef:order.txRef});assert.equal(replay.replayed,true);
 assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({txRef:order.txRef}),1);assert.equal(await f.connection.db.collection('ad_receipts').countDocuments({txRef:order.txRef}),1);assert.equal(await f.connection.db.collection('admin_audit').countDocuments({action:'activate-verified-ad','details.txRef':order.txRef}),1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { connectMongo } from '../src/server/mongo/database.mjs';
import { MongoGameStore } from '../src/server/mongo/gameStore.mjs';
import { MongoAdminStore } from '../src/server/mongo/adminStore.mjs';
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
    const transactionId = url.match(/transactions\/(\d+)\/verify/)?.[1]; return { ok: true, json: async () => ({ status: 'success', data: verified.get(transactionId) || { id: transactionId, status: 'failed' } }) };
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
  assert.equal(await f.connection.db.collection('ledger').countDocuments({ residentId: f.resident, type: 'verified-payment' }), 0);
  for (const provider of ['apple', 'google']) await rejectCode(f.payments.verifyStoreReceipt(f.resident, { provider, verified: true, amount: 1000000 }), 'store_provider_unconfigured');
});

integration('Mongo concurrent verification and signed webhooks commit one receipt credit ledger entry and audit event', async t => {
  const f = await fixture(t), order = await checkout(f), transactionId = providerSuccess(f, order), before = (await f.store.profile(f.resident)).wallet, { raw, signature } = webhook(f, order, transactionId), logs = [];
  f.payments.log = (event, fields) => logs.push({ event, fields });
  const responses = await Promise.all(Array.from({ length: 10 }, (_, index) => index % 2 ? f.payments.verify(f.resident, { transactionId, txRef: order.txRef }) : f.payments.handleWebhook(raw, signature)));
  assert.equal(responses.filter(value => !value.replayed).length, 1); assert.ok(responses.every(value => value.profile.wallet === before + 10000 && value.payment.status === 'credited'));
  assert.equal((await f.store.profile(f.resident)).wallet, before + 10000); assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({ transactionId, provider: 'flutterwave' }), 1);
  const ledger = await f.connection.db.collection('ledger').find({ residentId: f.resident, type: 'verified-payment' }).toArray(); assert.equal(ledger.length, 1); assert.equal(ledger[0].amount, 10000); assert.equal(ledger[0].balanceAfter, before + 10000);
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
  assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({ txRef: order.txRef }), 0); assert.equal(await f.connection.db.collection('ledger').countDocuments({ residentId: f.resident, type: 'verified-payment' }), 0);
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
  assert.equal(await f.connection.db.collection('payment_receipts').countDocuments({ transactionId }), 1); assert.equal(await f.connection.db.collection('ledger').countDocuments({ residentId: { $in: [f.resident, f.other] }, type: 'verified-payment' }), 1);
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
  const f = await fixture(t); await f.admin.assignRole(f.owner, { residentId: f.other, role: 'superadmin' });
  const results = await Promise.allSettled([f.admin.assignRole(f.owner, { residentId: f.owner, role: null }), f.admin.assignRole(f.other, { residentId: f.other, role: null })]);
  assert.equal(results.filter(value => value.status === 'fulfilled').length, 1); assert.equal(results.filter(value => value.status === 'rejected' && value.reason.code === 'last_superadmin').length, 1);
  const ownerStatus = await f.admin.status(f.owner), otherStatus = await f.admin.status(f.other); assert.ok(ownerStatus.role === 'superadmin' || otherStatus.role === 'superadmin');
  const remaining = ownerStatus.role === 'superadmin' ? f.owner : f.other; await f.admin.assignRole(remaining, { residentId: f.owner, role: 'superadmin' }); await f.admin.assignRole(f.owner, { residentId: f.other, role: null });
});

integration('Mongo administrative key reuse racing across two wallets grants one correction and returns a domain conflict', async t => {
  const f = await fixture(t), operationKey = unique('adjust_'), before = (await f.store.profile(f.resident)).wallet + (await f.store.profile(f.other)).wallet;
  const body = { amount: 1000, reason: 'Authorized cross-wallet idempotency race fixture', idempotencyKey: operationKey };
  const results = await Promise.allSettled([f.admin.adjustWallet(f.owner, { ...body, residentId: f.resident }), f.admin.adjustWallet(f.owner, { ...body, residentId: f.other })]);
  assert.equal(results.filter(value => value.status === 'fulfilled').length, 1); assert.equal(results.filter(value => value.status === 'rejected' && value.reason.code === 'idempotency_conflict').length, 1);
  assert.equal((await f.store.profile(f.resident)).wallet + (await f.store.profile(f.other)).wallet, before + 1000);
  assert.equal(await f.connection.db.collection('wallet_operations').countDocuments({ actorId: f.owner, operationKey }), 1);
});

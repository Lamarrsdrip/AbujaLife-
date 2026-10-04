import crypto from 'node:crypto';
import { GameError } from '../errors.mjs';

const PROVIDER_ORIGIN = 'https://api.flutterwave.com';
const fail = (condition, message, status = 400, code = 'invalid_payment') => { if (!condition) throw new GameError(message, status, code); };
const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const requestKey = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(value);
const mask = secret => secret ? `••••${secret.slice(-4)}` : null;
const paymentView = row => ({ txRef: row.txRef, status: row.status, amount: row.amount, currency: 'NGN', credits: row.credits, mode: row.mode, checkoutUrl: row.checkoutUrl || null, transactionId: row.transactionId || null, createdAt: row.createdAt, creditedAt: row.creditedAt || null });
function encryptionKey(value) {
  if (!value) return null;
  const key = /^[a-f\d]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  fail(key.length === 32, 'ABUJALIFE_CONFIG_KEY must contain a 32-byte key encoded as hex or base64', 503, 'config_key_required'); return key;
}
function publicOrigin(value) {
  let url; try { url = new URL(value); } catch { throw new GameError('Use the HTTPS origin of this AbujaLife deployment'); }
  fail(url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'Use the HTTPS origin of this AbujaLife deployment');
  fail(!/^(localhost|127\.|0\.|\[?::1\]?$)/i.test(url.hostname), 'Use a public HTTPS deployment origin'); return url.origin;
}
const string = { bsonType: 'string', minLength: 1 };
const whole = { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 };
const positive = { ...whole, minimum: 1 };
const schema = (required, properties) => ({ $jsonSchema: { bsonType: 'object', required, properties: { _id: string, ...properties } } });
export const MONGO_PAYMENT_INDEXES = Object.freeze({
  payment_orders: [[{ txRef: 1 }, { unique: true }], [{ residentId: 1, operationKey: 1 }, { unique: true }], [{ transactionId: 1 }, { unique: true, partialFilterExpression: { transactionId: { $type: 'string' } } }], [{ residentId: 1, createdAt: -1, txRef: -1 }, {}], [{ createdAt: -1, txRef: -1 }, {}]],
  payment_receipts: [[{ provider: 1, transactionId: 1 }, { unique: true }], [{ txRef: 1 }, { unique: true }]]
});
export const MONGO_PAYMENT_VALIDATORS = Object.freeze({
  payment_config: schema(['_id', 'mode', 'enabled', 'creditRate', 'publicOrigin', 'secrets', 'updatedAt'], { mode: { enum: ['test', 'live'] }, enabled: { bsonType: 'bool' }, creditRate: positive, publicOrigin: string, secrets: string, updatedAt: whole }),
  payment_preferences: schema(['_id', 'value'], { value: { enum: ['test', 'live'] } }),
  payment_orders: schema(['_id', 'txRef', 'residentId', 'operationKey', 'fingerprint', 'amount', 'credits', 'mode', 'status', 'encryptedSecret', 'createdAt'], { txRef: string, residentId: string, operationKey: string, fingerprint: string, amount: positive, credits: positive, mode: { enum: ['test', 'live'] }, status: { enum: ['creating', 'pending', 'checkout_failed', 'credited'] }, checkoutUrl: { bsonType: ['string', 'null'] }, transactionId: string, encryptedSecret: string, createdAt: whole, creditedAt: { anyOf: [whole, { bsonType: 'null' }] } }),
  payment_receipts: schema(['_id', 'provider', 'transactionId', 'txRef', 'residentId', 'amount', 'credits', 'createdAt'], { provider: { enum: ['flutterwave'] }, transactionId: string, txRef: string, residentId: string, amount: positive, credits: positive, createdAt: whole })
});
export async function ensureMongoPaymentSchema(db) {
  for (const [name, validator] of Object.entries(MONGO_PAYMENT_VALIDATORS)) {
    try { await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' }); }
    catch (error) { if (error.code !== 48) throw error; }
    await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
  }
  for (const [name, definitions] of Object.entries(MONGO_PAYMENT_INDEXES)) for (const [definition, config] of definitions) await db.collection(name).createIndex(definition, config);
}

/** Only server-verified Flutterwave responses enter the authoritative wallet transaction. */
export class MongoPaymentStore {
  #verifiedProofs = new WeakSet();
  constructor({ store, admin, fetchImpl = fetch, configKey = process.env.ABUJALIFE_CONFIG_KEY, publicOrigin: origin = process.env.ABUJALIFE_PUBLIC_ORIGIN || '' } = {}) {
    fail(store?.db && store?.economyOperation && admin, 'Game and administrator stores are required', 500);
    this.store = store; this.db = store.db; this.admin = admin; this.fetch = fetchImpl; this.key = encryptionKey(configKey); this.origin = origin ? publicOrigin(origin) : ''; this.clock = () => store.clock();
  }
  collection(name) { return this.db.collection(name); }
  async init({ ensureIndexes = true } = {}) { if (ensureIndexes) await ensureMongoPaymentSchema(this.db); return this; }
  encrypt(value, scope) {
    fail(this.key, 'Set ABUJALIFE_CONFIG_KEY on the server before saving provider credentials', 503, 'config_key_required');
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv); cipher.setAAD(Buffer.from('abujalife-payments:' + scope));
    const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), body: body.toString('base64') });
  }
  decrypt(value, scope) {
    fail(this.key, 'Payment encryption key is unavailable', 503, 'config_key_required');
    try {
      const stored = JSON.parse(value); fail(stored.v === 1, 'Unsupported payment configuration');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(stored.iv, 'base64')); decipher.setAAD(Buffer.from('abujalife-payments:' + scope)); decipher.setAuthTag(Buffer.from(stored.tag, 'base64'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.body, 'base64')), decipher.final()]).toString());
    } catch { throw new GameError('Payment credentials could not be decrypted; check the server configuration key', 503, 'config_key_mismatch'); }
  }
  async activeMode() { return (await this.collection('payment_preferences').findOne({ _id: 'active-mode' }))?.value || 'test'; }
  async config(mode) {
    mode ||= await this.activeMode(); const row = await this.collection('payment_config').findOne({ _id: mode });
    return row ? { ...row, secrets: this.decrypt(row.secrets, 'config:' + mode) } : null;
  }
  async publicConfig() {
    const mode = await this.activeMode(); let config;
    try { config = await this.config(mode); } catch { return { ok: true, enabled: false, provider: 'Flutterwave', mode, currency: 'NGN', creditRate: 1, reason: 'Payments need server configuration' }; }
    const enabled = Boolean(config?.enabled && config.secrets.secretKey && config.publicOrigin && this.key), creditRate = config?.creditRate || 1;
    return { ok: true, enabled, provider: 'Flutterwave', mode, currency: 'NGN', creditRate, minAmount: 1, maxAmount: Math.floor(Number.MAX_SAFE_INTEGER / creditRate), nativeProviders: { apple: { configured: false }, google: { configured: false } }, ...(enabled ? {} : { reason: 'An administrator must configure Flutterwave on this deployment before payments are available' }) };
  }
  async adminConfig(id) {
    await this.admin.requirePermission(id, 'payments'); const modes = {};
    for (const mode of ['test', 'live']) {
      let config; try { config = await this.config(mode); } catch { modes[mode] = { configured: false, readiness: 'Server encryption key does not match stored credentials' }; continue; }
      modes[mode] = { configured: Boolean(config?.secrets.secretKey), enabled: Boolean(config?.enabled), creditRate: config?.creditRate || 1, publicOrigin: config?.publicOrigin || this.origin, secretKey: mask(config?.secrets.secretKey), webhookSecret: mask(config?.secrets.webhookSecret), updatedAt: config?.updatedAt || null };
    }
    return { ok: true, provider: 'Flutterwave', activeMode: await this.activeMode(), encryptionReady: Boolean(this.key), modes, webhook: { header: 'flutterwave-signature', algorithm: 'HMAC-SHA256', encoding: 'base64', verification: 'Every webhook payment is verified through the Flutterwave transaction API before credit' }, liveVerified: false };
  }
  async configure(id, body) {
    await this.admin.requirePermission(id, 'payments'); fail(body && typeof body === 'object' && !Array.isArray(body), 'Use payment configuration');
    const allowed = ['mode', 'enabled', 'creditRate', 'publicOrigin', 'secretKey', 'webhookSecret', 'activate']; fail(Object.keys(body).every(field => allowed.includes(field)), 'Choose supported payment configuration fields');
    const mode = body.mode; fail(['test', 'live'].includes(mode), 'Choose test or live mode'); const old = await this.config(mode), creditRate = body.creditRate ?? old?.creditRate ?? 1;
    fail(Number.isSafeInteger(creditRate) && creditRate > 0, 'Choose a positive whole credit rate'); const enabled = body.enabled ?? Boolean(old?.enabled), origin = publicOrigin(body.publicOrigin || old?.publicOrigin || this.origin);
    fail(typeof enabled === 'boolean' && (body.activate === undefined || typeof body.activate === 'boolean'), 'Use boolean payment settings');
    const secretKey = body.secretKey === undefined ? old?.secrets.secretKey : clean(body.secretKey, 500), webhookSecret = body.webhookSecret === undefined ? old?.secrets.webhookSecret : clean(body.webhookSecret, 500);
    fail(!enabled || secretKey, 'A Flutterwave secret key is required to enable checkout'); fail(!secretKey || /^FLWSECK[-_][A-Za-z0-9_-]+$/i.test(secretKey), 'Use a Flutterwave secret key');
    if (secretKey) fail(mode === 'test' ? secretKey.toUpperCase().includes('TEST') : !secretKey.toUpperCase().includes('TEST'), 'The secret key does not match the selected test/live mode');
    fail(!webhookSecret || webhookSecret.length >= 16, 'Use a webhook signing secret of at least 16 characters');
    const sealed = this.encrypt({ secretKey: secretKey || '', webhookSecret: webhookSecret || '' }, 'config:' + mode);
    await this.store.transaction(async session => {
      await this.admin.requirePermission(id, 'payments', { session });
      await this.collection('payment_config').updateOne({ _id: mode }, { $set: { mode, enabled, creditRate, publicOrigin: origin, secrets: sealed, updatedAt: this.clock() } }, { session, upsert: true });
      if (body.activate) await this.collection('payment_preferences').updateOne({ _id: 'active-mode' }, { $set: { value: mode } }, { session, upsert: true });
      await this.admin.record(id, 'configure-payments', null, { mode, enabled, creditRate, publicOrigin: origin, secretKeyChanged: body.secretKey !== undefined, webhookSecretChanged: body.webhookSecret !== undefined, activated: Boolean(body.activate) }, { session });
    }); return this.adminConfig(id);
  }
  async provider(path, secretKey, options = {}) {
    fail(path === '/v3/payments' || /^\/v3\/transactions\/\d{1,24}\/verify$/.test(path), 'Unsupported provider request', 500);
    let response, data;
    try {
      response = await this.fetch(PROVIDER_ORIGIN + path, { ...options, headers: { 'content-type': 'application/json', authorization: `Bearer ${secretKey}` }, redirect: 'error', signal: AbortSignal.timeout(20000) }); data = await response.json();
    } catch { throw new GameError('Flutterwave could not be reached. No payment has been credited', 502, 'provider_unavailable'); }
    fail(response.ok && data.status === 'success', 'Flutterwave could not confirm this request. No payment has been credited', 502, 'provider_rejected'); return data.data;
  }
  async checkout(id, { amount, email, idempotencyKey } = {}) {
    fail(!await this.admin.isSuspended(id), 'This account is suspended', 403, 'account_suspended'); await this.store.profile(id); fail(requestKey(idempotencyKey), 'Use a valid payment request key');
    const config = await this.config(); fail(config?.enabled && config.secrets.secretKey && config.publicOrigin, 'Payments are not configured on this deployment', 503, 'payments_unavailable');
    fail(Number.isSafeInteger(amount) && amount > 0 && Number.isSafeInteger(amount * config.creditRate), 'Enter a positive whole Naira amount within the safe numeric range');
    email = clean(email, 254); fail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter your payment receipt email');
    const credits = amount * config.creditRate, fingerprint = JSON.stringify({ amount, email }); let existing = false, row;
    try {
      row = await this.store.transaction(async session => {
        const old = await this.collection('payment_orders').findOne({ residentId: id, operationKey: idempotencyKey }, { session });
        if (old) { fail(old.fingerprint === fingerprint, 'This payment key was already used for a different checkout', 409, 'idempotency_conflict'); existing = true; return old; }
        fail(!await this.admin.isSuspended(id, { session }), 'This account is suspended', 403, 'account_suspended');
        const wallet = (await this.store.profile(id, { session })).wallet;
        fail(Number.isSafeInteger(wallet) && wallet >= 0 && BigInt(wallet) + BigInt(credits) <= BigInt(Number.MAX_SAFE_INTEGER), 'This checkout would exceed the safe numeric wallet range', 409, 'wallet_limit');
        const txRef = 'abjl_' + crypto.randomUUID(), order = { _id: txRef, txRef, residentId: id, operationKey: idempotencyKey, fingerprint, amount, credits, mode: config.mode, status: 'creating', checkoutUrl: null, encryptedSecret: this.encrypt({ secretKey: config.secrets.secretKey }, 'order:' + txRef), createdAt: this.clock(), creditedAt: null };
        await this.collection('payment_orders').insertOne(order, { session }); return order;
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      row = await this.collection('payment_orders').findOne({ residentId: id, operationKey: idempotencyKey });
      fail(row && row.fingerprint === fingerprint, 'This payment key was already used for a different checkout', 409, 'idempotency_conflict'); existing = true;
    }
    if (existing) {
      fail(row.status !== 'creating', 'This checkout is being created. Check its status before retrying', 409, 'checkout_processing'); fail(row.checkoutUrl, 'The checkout could not be created. Start a new payment request', 502, 'checkout_failed');
      return { ok: true, checkout: paymentView(row), replayed: true };
    }
    try {
      const profile = await this.store.profile(id), data = await this.provider('/v3/payments', config.secrets.secretKey, { method: 'POST', body: JSON.stringify({ tx_ref: row.txRef, amount, currency: 'NGN', redirect_url: `${config.publicOrigin}/?payment_ref=${encodeURIComponent(row.txRef)}`, customer: { email, name: profile.displayName }, customizations: { title: 'AbujaLife', description: `${credits.toLocaleString()} game Naira` }, meta: { abujalife_reference: row.txRef } }) });
      let link; try { link = new URL(data.link); } catch { throw new GameError('Flutterwave returned an invalid checkout link', 502, 'invalid_checkout'); }
      fail(link.protocol === 'https:' && (link.hostname === 'checkout.flutterwave.com' || link.hostname.endsWith('.flutterwave.com')) && !link.username && !link.password, 'Flutterwave returned an untrusted checkout link', 502, 'invalid_checkout');
      await this.collection('payment_orders').updateOne({ _id: row.txRef }, [{ $set: { checkoutUrl: link.href, status: { $cond: [{ $eq: ['$status', 'creating'] }, 'pending', '$status'] } } }]);
      return { ok: true, checkout: paymentView(await this.collection('payment_orders').findOne({ _id: row.txRef })), replayed: false };
    } catch (error) { await this.collection('payment_orders').updateOne({ _id: row.txRef, status: 'creating' }, { $set: { status: 'checkout_failed' } }); throw error; }
  }
  async status(id, txRef) {
    const row = await this.collection('payment_orders').findOne({ txRef: clean(txRef, 80), residentId: id }); fail(row, 'Payment not found', 404, 'payment_not_found'); return { ok: true, payment: paymentView(row) };
  }
  async verifiedOrder(transactionId, txRef, id = null) {
    transactionId = String(transactionId ?? ''); fail(/^\d{1,24}$/.test(transactionId), 'Use the Flutterwave transaction ID', 400, 'invalid_transaction');
    let order = txRef ? await this.collection('payment_orders').findOne({ txRef: clean(txRef, 80) }) : null;
    fail(!id || !order || order.residentId === id, 'Payment not found', 404, 'payment_not_found');
    const secrets = order ? this.decrypt(order.encryptedSecret, 'order:' + order.txRef) : (await this.config())?.secrets;
    fail(secrets?.secretKey, 'Payments are not configured', 503, 'payments_unavailable');
    const data = await this.provider(`/v3/transactions/${transactionId}/verify`, secrets.secretKey), ref = String(data?.tx_ref || '');
    if (!order) order = await this.collection('payment_orders').findOne({ txRef: ref });
    fail(order && (!id || order.residentId === id), 'Payment not found', 404, 'payment_not_found');
    fail(String(data?.id) === transactionId && data.status === 'successful' && data.currency === 'NGN' && Number(data.amount) === order.amount && ref === order.txRef, 'This transaction does not match the amount, currency, reference and successful status of your checkout', 409, 'payment_verification_failed');
    // A server-created proof cannot be substituted by a client verified:true field.
    const proof = { order: Object.freeze({ ...order }), transactionId }; this.#verifiedProofs.add(proof); return Object.freeze(proof);
  }
  async creditVerified(proof, actor = 'provider') {
    fail(this.#verifiedProofs.has(proof), 'A server-verified provider receipt is required', 403, 'payment_verification_required'); const { order, transactionId } = proof;
    const operationKey = 'flw_' + crypto.createHash('sha256').update(transactionId).digest('hex');
    let result;
    try {
      result = await this.store.economyOperation(order.residentId, 'verified-payment', { idempotencyKey: operationKey }, { provider: 'flutterwave', transactionId, txRef: order.txRef, amount: order.amount, credits: order.credits }, async (profile, timestamp, session) => {
        const current = await this.collection('payment_orders').findOne({ _id: order.txRef }, { session }); fail(current && current.residentId === profile.id && current.amount === order.amount && current.credits === order.credits && current.mode === order.mode, 'This payment order changed during verification', 409, 'payment_verification_failed');
        fail(current.status !== 'credited', 'This checkout was already credited using another transaction', 409, 'payment_duplicate');
        const prior = await this.collection('payment_receipts').findOne({ _id: 'flutterwave:' + transactionId }, { session }); fail(!prior, 'This provider transaction has already been credited', 409, 'payment_duplicate');
        fail(Number.isSafeInteger(profile.wallet) && profile.wallet >= 0 && Number.isSafeInteger(current.credits) && current.credits > 0 && BigInt(profile.wallet) + BigInt(current.credits) <= BigInt(Number.MAX_SAFE_INTEGER), 'This credit would exceed the safe numeric wallet range', 409, 'wallet_limit');
        await this.collection('payment_receipts').insertOne({ _id: 'flutterwave:' + transactionId, provider: 'flutterwave', transactionId, txRef: current.txRef, residentId: profile.id, amount: current.amount, credits: current.credits, createdAt: timestamp }, { session });
        profile.wallet += current.credits;
        await this.collection('payment_orders').updateOne({ _id: current.txRef, status: { $ne: 'credited' } }, { $set: { status: 'credited', transactionId, creditedAt: timestamp } }, { session });
        await this.admin.record(actor, 'credit-verified-payment', profile.id, { txRef: current.txRef, transactionId, mode: current.mode, amount: current.amount, credits: current.credits }, { session });
        return { payment: paymentView({ ...current, status: 'credited', transactionId, creditedAt: timestamp }), ledgerReason: `Verified Flutterwave ${current.mode} payment · ${current.txRef}` };
      });
    } catch (error) {
      if (error.code === 11000 || error.code === 'idempotency_conflict') throw new GameError('This provider transaction has already been credited', 409, 'payment_duplicate'); throw error;
    }
    return result;
  }
  async verify(id, { transactionId, txRef } = {}) {
    fail(!await this.admin.isSuspended(id), 'This account is suspended', 403, 'account_suspended'); await this.store.profile(id); return this.creditVerified(await this.verifiedOrder(transactionId, txRef, id), id);
  }
  async handleWebhook(rawBody, signature) {
    fail(Buffer.isBuffer(rawBody) && rawBody.length <= 65536, 'Invalid webhook body'); fail(typeof signature === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(signature), 'Invalid Flutterwave webhook signature', 401, 'invalid_webhook_signature');
    const supplied = Buffer.from(signature, 'base64'), matched = [];
    for (const mode of ['test', 'live']) {
      let config; try { config = await this.config(mode); } catch { continue; }
      if (config?.secrets.webhookSecret) { const expected = crypto.createHmac('sha256', config.secrets.webhookSecret).update(rawBody).digest(); if (supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)) matched.push(mode); }
    }
    fail(matched.length, 'Invalid Flutterwave webhook signature', 401, 'invalid_webhook_signature'); let body;
    try { body = JSON.parse(rawBody.toString('utf8')); } catch { throw new GameError('Invalid webhook JSON'); }
    if (body.event !== 'charge.completed') return { ok: true, ignored: true };
    const txRef = clean(body.data?.tx_ref, 80), order = await this.collection('payment_orders').findOne({ txRef }); if (!order) return { ok: true, ignored: true };
    fail(matched.includes(order.mode), 'Webhook signing mode does not match the payment', 401, 'invalid_webhook_signature'); return this.creditVerified(await this.verifiedOrder(body.data?.id, txRef), 'flutterwave-webhook');
  }
  async list(id, { cursor, limit = 30 } = {}) {
    await this.admin.requirePermission(id, 'payments'); const size = Math.max(1, Math.min(100, Number.isSafeInteger(Number(limit)) ? Number(limit) : 30)); let page = null;
    if (cursor) {
      try { fail(typeof cursor === 'string' && cursor.length <= 512, 'Invalid page cursor'); page = JSON.parse(Buffer.from(cursor, 'base64url').toString()); } catch { throw new GameError('Invalid page cursor'); }
      fail(Array.isArray(page) && page.length === 2 && Number.isSafeInteger(page[0]) && page[0] >= 0 && typeof page[1] === 'string' && page[1].length <= 80, 'Invalid page cursor');
    }
    const filter = page ? { $or: [{ createdAt: { $lt: page[0] } }, { createdAt: page[0], txRef: { $lt: page[1] } }] } : {};
    const rows = await this.collection('payment_orders').find(filter).sort({ createdAt: -1, txRef: -1 }).limit(size + 1).toArray(), more = rows.length > size; rows.length = Math.min(rows.length, size);
    return { ok: true, payments: rows.map(row => ({ ...paymentView(row), residentId: row.residentId })), nextCursor: more ? Buffer.from(JSON.stringify([rows.at(-1).createdAt, rows.at(-1).txRef])).toString('base64url') : null };
  }
  async adminVerify(id, body = {}) { await this.admin.requirePermission(id, 'payments'); return this.creditVerified(await this.verifiedOrder(body.transactionId, body.txRef), id); }
  async verifyStoreReceipt(id, { provider } = {}) {
    await this.store.profile(id); fail(['apple', 'google'].includes(provider), 'Choose a supported store provider');
    // Native store receipts require separate server credentials and verifier adapters.
    // No adapter is configured in this release, and client receipt claims never grant credits.
    throw new GameError('This store payment verifier is not configured on the server', 503, 'store_provider_unconfigured');
  }
}

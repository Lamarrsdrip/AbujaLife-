import crypto from 'node:crypto';
import { GameError } from './errors.mjs';

export const JACKPOT_ENTRY_AMOUNT = 2000;
export const JACKPOT_CAPACITY = 50;
export const JACKPOT_ENTRY_WINDOW_MS = 30 * 60 * 1000;
export const JACKPOT_DRAW_COUNTDOWN_MS = 60 * 1000;
export const JACKPOT_WITHDRAWAL_FEE_BPS = 1000;
export const JACKPOT_LANES = Object.freeze([
  Object.freeze({ id: 'wuse-rush', name: 'Wuse Rush' }),
  Object.freeze({ id: 'jabi-vault', name: 'Jabi Vault' }),
  Object.freeze({ id: 'gwarinpa-circle', name: 'Gwarinpa Circle' }),
  Object.freeze({ id: 'maitama-crown', name: 'Maitama Crown' }),
  Object.freeze({ id: 'asokoro-royale', name: 'Asokoro Royale' }),
]);

const SECURITY_HEADERS = Object.freeze({
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000',
  'cache-control': 'no-store',
});
const TOKEN_COOKIE = 'abujalife_session=';
const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const safeWhole = value => Number.isSafeInteger(value) && value >= 0;
const fail = (condition, message, status = 400, code = 'invalid_jackpot_request') => { if (!condition) throw new GameError(message, status, code); };
const idempotencyKey = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(value);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const orderView = row => ({ txRef: row.txRef, status: row.status, amount: row.amount, currency: 'NGN', checkoutUrl: row.checkoutUrl || null, transactionId: row.transactionId || null, createdAt: row.createdAt, creditedAt: row.creditedAt || null });
const publicRoom = row => ({ id: row._id, laneId: row.laneId, name: row.name, status: row.status, entryAmount: row.entryAmount, capacity: row.capacity, participantCount: row.participantCount, potAmount: row.potAmount, opensAt: row.opensAt, closesAt: row.closesAt, drawsAt: row.drawsAt, seedCommit: row.seedCommit, winner: row.winnerId ? { residentId: row.winnerId, displayName: row.winnerName, username: row.winnerUsername, ticketId: row.winningTicketId, amount: row.potAmount } : null, drawProof: row.drawProof || null, seedReveal: ['completed', 'cancelled'].includes(row.status) ? row.seed : null, completedAt: row.completedAt || null });

export function jackpotWithdrawalQuote(grossAmount) {
  fail(Number.isSafeInteger(grossAmount) && grossAmount > 0 && grossAmount % 10 === 0, 'Withdrawal amount must be a positive whole Naira amount ending in 0', 400, 'invalid_withdrawal_amount');
  const feeAmount = grossAmount * JACKPOT_WITHDRAWAL_FEE_BPS / 10000;
  return Object.freeze({ grossAmount, feeAmount, netAmount: grossAmount - feeAmount });
}

export function jackpotWinnerIndex(seed, roomId, ticketIds) {
  fail(typeof seed === 'string' && seed.length >= 32, 'Draw seed is invalid', 500, 'draw_seed_invalid');
  fail(typeof roomId === 'string' && roomId.length > 0, 'Room id is invalid', 500, 'draw_room_invalid');
  fail(Array.isArray(ticketIds) && ticketIds.length > 0 && ticketIds.every(id => typeof id === 'string' && id.length > 0), 'Draw tickets are invalid', 500, 'draw_tickets_invalid');
  const digest = crypto.createHash('sha256').update(seed).update('\0').update(roomId).update('\0').update(ticketIds.join('\n')).digest();
  const value = digest.readBigUInt64BE(0);
  return Number(value % BigInt(ticketIds.length));
}

function tokenFor(req) {
  const bearer = /^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(req.headers.authorization || '');
  if (bearer) return bearer[1];
  return (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(TOKEN_COOKIE))?.slice(TOKEN_COOKIE.length) || null;
}
function json(res, status, body, extra = {}) { if (res.writableEnded) return; res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...extra }); res.end(JSON.stringify(body)); }
async function rawBody(req, maxBytes = 65536) { let size = 0; const chunks = []; for await (const chunk of req) { size += chunk.length; fail(size <= maxBytes, 'Request body is too large', 413, 'body_too_large'); chunks.push(chunk); } return Buffer.concat(chunks); }
async function readJSON(req, maxBytes = 65536) { const raw = await rawBody(req, maxBytes); try { const body = JSON.parse(raw.toString('utf8') || '{}'); fail(body && typeof body === 'object' && !Array.isArray(body), 'Send a JSON object'); return body; } catch (error) { if (error instanceof GameError) throw error; throw new GameError('Send valid JSON'); } }
function trustedCheckout(link) { let url; try { url = new URL(link); } catch { return false; } return url.protocol === 'https:' && !url.username && !url.password && (url.hostname === 'checkout.flutterwave.com' || url.hostname.endsWith('.flutterwave.com')); }
function roomSort(a, b) { return JACKPOT_LANES.findIndex(lane => lane.id === a.laneId) - JACKPOT_LANES.findIndex(lane => lane.id === b.laneId); }

export class JackpotIntegration {
  constructor({ store, admin, payments, database, publicWebUrl, corsOrigins = [], log = () => {} } = {}) {
    fail(store?.db && store?.transaction && admin && payments && database, 'Jackpot requires the production stores', 500, 'jackpot_configuration');
    this.store = store; this.db = store.db; this.admin = admin; this.payments = payments; this.database = database; this.publicWebUrl = publicWebUrl; this.log = log;
    this.allowedOrigins = new Set([publicWebUrl, ...corsOrigins].filter(Boolean)); this.limits = new Map(); this.timer = null; this.tickRunning = false;
  }
  collection(name) { return this.db.collection(name); }
  async init() {
    await Promise.all([
      this.collection('jackpot_accounts').createIndex({ residentId: 1 }, { unique: true }),
      this.collection('jackpot_ledger').createIndex({ residentId: 1, operationKey: 1 }, { unique: true }),
      this.collection('jackpot_ledger').createIndex({ residentId: 1, createdAt: -1 }),
      this.collection('jackpot_deposit_orders').createIndex({ txRef: 1 }, { unique: true }),
      this.collection('jackpot_deposit_orders').createIndex({ residentId: 1, operationKey: 1 }, { unique: true }),
      this.collection('jackpot_deposit_orders').createIndex({ transactionId: 1 }, { unique: true, partialFilterExpression: { transactionId: { $type: 'string' } } }),
      this.collection('jackpot_deposit_receipts').createIndex({ provider: 1, transactionId: 1 }, { unique: true }),
      this.collection('jackpot_rooms').createIndex({ laneId: 1, active: 1 }, { unique: true, partialFilterExpression: { active: true } }),
      this.collection('jackpot_rooms').createIndex({ status: 1, drawsAt: 1 }),
      this.collection('jackpot_entries').createIndex({ roomId: 1, residentId: 1 }, { unique: true }),
      this.collection('jackpot_entries').createIndex({ roomId: 1, createdAt: 1, _id: 1 }),
      this.collection('jackpot_withdrawals').createIndex({ residentId: 1, operationKey: 1 }, { unique: true }),
      this.collection('jackpot_withdrawals').createIndex({ status: 1, requestedAt: 1 }),
    ]);
    await this.tick();
    this.timer = setInterval(() => void this.tick().catch(error => this.log('jackpot_tick_error', { code: error.code || 'internal_error' })), 4000); this.timer.unref?.();
    return this;
  }
  close() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  rateLimit(principal, kind, limit = 60) {
    const now = Date.now(), key = `${principal}:${kind}`, old = this.limits.get(key), bucket = old && now - old.at < 60000 ? old : { at: now, count: 0 }; bucket.count += 1; this.limits.set(key, bucket);
    if (bucket.count > limit) throw new GameError('Please wait before trying again', 429, 'rate_limited');
    if (this.limits.size > 5000) for (const [entry, value] of this.limits) if (now - value.at > 60000) this.limits.delete(entry);
  }
  cors(req, res) {
    const origin = req.headers.origin; if (!origin) return;
    fail(this.allowedOrigins.has(origin), 'This origin is not permitted', 403, 'cross_origin');
    res.setHeader('access-control-allow-origin', origin); res.setHeader('access-control-allow-credentials', 'true'); res.setHeader('vary', 'Origin');
  }
  async requireResident(req) { const token = tokenFor(req), id = token ? await this.store.session(token) : null; fail(id, 'Sign in to use Community Jackpot', 401, 'authentication_required'); fail(!await this.admin.isSuspended(id), 'This account is suspended', 403, 'account_suspended'); return id; }
  requireActionOrigin(req) {
    fail(/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || ''), 'Send JSON for this action', 415);
    if ((req.headers.cookie && !req.headers.authorization) || req.headers['sec-fetch-site'] === 'cross-site') fail(req.headers.origin && this.allowedOrigins.has(req.headers.origin), 'Open AbujaLife to perform this action', 403, 'cross_origin');
  }
  async ensureAccount(residentId, { session = null } = {}) {
    const now = this.store.clock(), options = session ? { session } : {};
    await this.collection('jackpot_accounts').updateOne({ residentId }, { $setOnInsert: { _id: residentId, residentId, available: 0, pendingWithdrawal: 0, version: 0, createdAt: now, updatedAt: now } }, { ...options, upsert: true });
    return this.collection('jackpot_accounts').findOne({ residentId }, options);
  }
  async moveBalance(residentId, { operationKey, type, deltaAvailable = 0, deltaPending = 0, metadata = {} }, session) {
    const prior = await this.collection('jackpot_ledger').findOne({ residentId, operationKey }, { session }); if (prior) return { replayed: true, ledger: prior };
    const account = await this.ensureAccount(residentId, { session });
    fail(safeWhole(account.available) && safeWhole(account.pendingWithdrawal), 'Jackpot balance is invalid', 500, 'jackpot_balance_invalid');
    const available = account.available + deltaAvailable, pendingWithdrawal = account.pendingWithdrawal + deltaPending;
    fail(safeWhole(available) && safeWhole(pendingWithdrawal), deltaAvailable < 0 ? 'Your Jackpot Balance is too low for this action' : 'This action exceeds the safe balance range', deltaAvailable < 0 ? 409 : 500, deltaAvailable < 0 ? 'insufficient_jackpot_balance' : 'jackpot_balance_limit');
    const changed = await this.collection('jackpot_accounts').updateOne({ residentId, version: account.version, available: account.available, pendingWithdrawal: account.pendingWithdrawal }, { $set: { available, pendingWithdrawal, updatedAt: this.store.clock() }, $inc: { version: 1 } }, { session });
    fail(changed.modifiedCount === 1, 'Jackpot balance changed; retry this action', 409, 'jackpot_balance_conflict');
    const ledger = { _id: crypto.randomUUID(), residentId, operationKey, type, deltaAvailable, deltaPending, availableAfter: available, pendingAfter: pendingWithdrawal, metadata, createdAt: this.store.clock() };
    await this.collection('jackpot_ledger').insertOne(ledger, { session }); return { replayed: false, ledger };
  }
  newRoom(lane, now) {
    const seed = crypto.randomBytes(32).toString('hex'), roomId = `${lane.id}:${crypto.randomUUID()}`;
    return { _id: roomId, laneId: lane.id, name: lane.name, active: true, status: 'open', entryAmount: JACKPOT_ENTRY_AMOUNT, capacity: JACKPOT_CAPACITY, participantCount: 0, potAmount: 0, opensAt: now, closesAt: now + JACKPOT_ENTRY_WINDOW_MS, drawsAt: now + JACKPOT_ENTRY_WINDOW_MS + JACKPOT_DRAW_COUNTDOWN_MS, seed, seedCommit: hash(`${roomId}:${seed}`), winnerId: null, winnerName: null, winnerUsername: null, winningTicketId: null, drawProof: null, completedAt: null, createdAt: now };
  }
  async ensureRooms(now = this.store.clock()) {
    for (const lane of JACKPOT_LANES) {
      if (await this.collection('jackpot_rooms').findOne({ laneId: lane.id, active: true })) continue;
      try { await this.collection('jackpot_rooms').insertOne(this.newRoom(lane, now)); } catch (error) { if (error.code !== 11000) throw error; }
    }
  }
  async lockExpired(now) { await this.collection('jackpot_rooms').updateMany({ active: true, status: 'open', closesAt: { $lte: now } }, { $set: { status: 'locked', lockedAt: now } }); }
  async tick() {
    if (this.tickRunning) return; this.tickRunning = true;
    try {
      const now = this.store.clock(); await this.ensureRooms(now); await this.lockExpired(now);
      const due = await this.collection('jackpot_rooms').find({ active: true, status: { $in: ['locked', 'drawing'] }, drawsAt: { $lte: now } }).sort({ drawsAt: 1 }).limit(10).toArray();
      for (const room of due) await this.drawRoom(room._id);
      await this.ensureRooms(this.store.clock());
    } finally { this.tickRunning = false; }
  }
  async drawRoom(roomId) {
    let room = await this.collection('jackpot_rooms').findOne({ _id: roomId }); if (!room || !room.active || !['locked', 'drawing'].includes(room.status)) return room;
    if (room.status === 'locked') { await this.collection('jackpot_rooms').updateOne({ _id: roomId, status: 'locked', active: true }, { $set: { status: 'drawing', drawingAt: this.store.clock() } }); room = await this.collection('jackpot_rooms').findOne({ _id: roomId }); }
    if (!room || room.status !== 'drawing' || !room.active) return room;
    const entries = await this.collection('jackpot_entries').find({ roomId }).sort({ createdAt: 1, _id: 1 }).toArray();
    if (entries.length < 2) {
      await this.store.transaction(async session => {
        const current = await this.collection('jackpot_rooms').findOne({ _id: roomId }, { session }); if (!current || current.status !== 'drawing' || !current.active) return;
        for (const entry of entries) await this.moveBalance(entry.residentId, { operationKey: `room-refund:${roomId}:${entry.residentId}`, type: 'room_refund', deltaAvailable: entry.amount, metadata: { roomId, ticketId: entry._id } }, session);
        await this.collection('jackpot_rooms').updateOne({ _id: roomId, status: 'drawing', active: true }, { $set: { status: 'cancelled', active: false, completedAt: this.store.clock(), cancelReason: 'not_enough_players' } }, { session });
      });
      this.log('jackpot_room_cancelled', { roomId, participants: entries.length }); return;
    }
    const ticketIds = entries.map(entry => entry._id), winner = entries[jackpotWinnerIndex(room.seed, room._id, ticketIds)], drawProof = hash(`${room.seed}\0${room._id}\0${ticketIds.join('\n')}`);
    await this.store.transaction(async session => {
      const current = await this.collection('jackpot_rooms').findOne({ _id: roomId }, { session }); if (!current || current.status !== 'drawing' || !current.active) return;
      fail(current.participantCount === entries.length && current.potAmount === entries.reduce((sum, entry) => sum + entry.amount, 0), 'Room totals changed before settlement', 409, 'room_totals_changed');
      await this.moveBalance(winner.residentId, { operationKey: `room-win:${roomId}`, type: 'jackpot_win', deltaAvailable: current.potAmount, metadata: { roomId, ticketId: winner._id, laneId: current.laneId } }, session);
      await this.collection('jackpot_rooms').updateOne({ _id: roomId, status: 'drawing', active: true }, { $set: { status: 'completed', active: false, winnerId: winner.residentId, winnerName: winner.displayName, winnerUsername: winner.username, winningTicketId: winner._id, drawProof, completedAt: this.store.clock() } }, { session });
    });
    this.log('jackpot_room_completed', { roomId, winnerId: winner.residentId, potAmount: room.potAmount, participants: entries.length });
  }
  async state(residentId) {
    await this.tick(); const profile = await this.store.profile(residentId), account = await this.ensureAccount(residentId);
    const rooms = (await this.collection('jackpot_rooms').find({ active: true }).toArray()).sort(roomSort), roomIds = rooms.map(room => room._id);
    const [tickets, wins, withdrawals, ledger, pendingDeposits] = await Promise.all([
      this.collection('jackpot_entries').find({ residentId, roomId: { $in: roomIds } }).sort({ createdAt: -1 }).toArray(),
      this.collection('jackpot_rooms').find({ winnerId: residentId, status: 'completed' }).sort({ completedAt: -1 }).limit(20).toArray(),
      this.collection('jackpot_withdrawals').find({ residentId }).sort({ requestedAt: -1 }).limit(20).toArray(),
      this.collection('jackpot_ledger').find({ residentId }).sort({ createdAt: -1 }).limit(40).toArray(),
      this.collection('jackpot_deposit_orders').find({ residentId, status: { $in: ['creating', 'pending'] } }).sort({ createdAt: -1 }).limit(5).toArray(),
    ]);
    return { ok: true, serverTime: this.store.clock(), entryAmount: JACKPOT_ENTRY_AMOUNT, capacity: JACKPOT_CAPACITY, withdrawalFeeBps: JACKPOT_WITHDRAWAL_FEE_BPS, account: { available: account.available, pendingWithdrawal: account.pendingWithdrawal }, resident: { id: profile.id, displayName: profile.displayName, username: profile.username }, rooms: rooms.map(publicRoom), tickets: tickets.map(row => ({ ticketId: row._id, roomId: row.roomId, amount: row.amount, createdAt: row.createdAt })), wins: wins.map(publicRoom), withdrawals: withdrawals.map(row => ({ id: row._id, grossAmount: row.grossAmount, feeAmount: row.feeAmount, netAmount: row.netAmount, status: row.status, bankName: row.bankName, bankLast4: row.bankLast4, accountName: row.accountName, requestedAt: row.requestedAt, updatedAt: row.updatedAt, paidAt: row.paidAt || null, reference: row.reference || null })), ledger: ledger.map(({ _id, type, deltaAvailable, deltaPending, availableAfter, pendingAfter, metadata, createdAt }) => ({ id: _id, type, deltaAvailable, deltaPending, availableAfter, pendingAfter, metadata, createdAt })), pendingDeposits: pendingDeposits.map(orderView) };
  }
  async join(residentId, roomId, operationKey) {
    fail(idempotencyKey(operationKey), 'Use a valid join request key'); await this.tick(); const profile = await this.store.profile(residentId); let ticket;
    try {
      ticket = await this.store.transaction(async session => {
        const existing = await this.collection('jackpot_entries').findOne({ roomId, residentId }, { session }); if (existing) return existing;
        const room = await this.collection('jackpot_rooms').findOne({ _id: roomId }, { session }); fail(room && room.active && room.status === 'open' && room.closesAt > this.store.clock(), 'This room is no longer accepting entries', 409, 'room_closed');
        fail(room.participantCount < room.capacity, 'This room is full', 409, 'room_full');
        const entryId = `${roomId}:ticket:${crypto.randomUUID()}`;
        await this.moveBalance(residentId, { operationKey: `room-entry:${roomId}:${residentId}`, type: 'room_entry', deltaAvailable: -room.entryAmount, metadata: { roomId, ticketId: entryId, requestKey: operationKey } }, session);
        const row = { _id: entryId, roomId, residentId, username: profile.username, displayName: profile.displayName, amount: room.entryAmount, createdAt: this.store.clock() };
        await this.collection('jackpot_entries').insertOne(row, { session });
        const changed = await this.collection('jackpot_rooms').updateOne({ _id: roomId, status: 'open', active: true, participantCount: room.participantCount, closesAt: { $gt: this.store.clock() } }, { $inc: { participantCount: 1, potAmount: room.entryAmount } }, { session });
        fail(changed.modifiedCount === 1, 'This room changed while you joined; please try again', 409, 'room_changed'); return row;
      });
    } catch (error) {
      if (error.code === 11000) ticket = await this.collection('jackpot_entries').findOne({ roomId, residentId }); else throw error;
    }
    return { ok: true, ticket: { ticketId: ticket._id, roomId: ticket.roomId, amount: ticket.amount, createdAt: ticket.createdAt }, state: await this.state(residentId) };
  }
  async depositCheckout(residentId, { amount, email, idempotencyKey: requestKey } = {}) {
    fail(idempotencyKey(requestKey), 'Use a valid payment request key'); fail(Number.isSafeInteger(amount) && amount >= 100, 'Deposit at least ₦100 in whole Naira', 400, 'invalid_deposit_amount');
    email = clean(email, 254); fail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter your payment receipt email');
    const config = await this.payments.config(); fail(config?.enabled && config.secrets?.secretKey && config.publicOrigin, 'Payments are not configured on this deployment', 503, 'payments_unavailable');
    const fingerprint = JSON.stringify({ amount, email }), txRef = `abjl_jp_${crypto.randomUUID()}`, now = this.store.clock(); let row, replayed = false;
    try {
      row = await this.store.transaction(async session => {
        const existing = await this.collection('jackpot_deposit_orders').findOne({ residentId, operationKey: requestKey }, { session }); if (existing) { fail(existing.fingerprint === fingerprint, 'This payment key was already used for a different deposit', 409, 'idempotency_conflict'); replayed = true; return existing; }
        const order = { _id: txRef, txRef, residentId, operationKey: requestKey, fingerprint, amount, email, currency: 'NGN', mode: config.mode, status: 'creating', checkoutUrl: null, encryptedSecret: this.payments.encrypt({ secretKey: config.secrets.secretKey }, `jackpot-order:${txRef}`), createdAt: now, creditedAt: null };
        await this.collection('jackpot_deposit_orders').insertOne(order, { session }); return order;
      });
    } catch (error) { if (error.code !== 11000) throw error; row = await this.collection('jackpot_deposit_orders').findOne({ residentId, operationKey: requestKey }); fail(row && row.fingerprint === fingerprint, 'This payment key was already used for a different deposit', 409, 'idempotency_conflict'); replayed = true; }
    if (replayed) { fail(row.status !== 'creating', 'This deposit checkout is still being created. Check again shortly', 409, 'checkout_processing'); fail(row.checkoutUrl, 'This deposit checkout could not be created. Start a new request', 502, 'checkout_failed'); return { ok: true, checkout: orderView(row), replayed: true }; }
    try {
      const profile = await this.store.profile(residentId), data = await this.payments.provider('/v3/payments', config.secrets.secretKey, { method: 'POST', body: JSON.stringify({ tx_ref: txRef, amount, currency: 'NGN', redirect_url: `${config.publicOrigin}/?jackpot=return&jackpot_payment_ref=${encodeURIComponent(txRef)}`, customer: { email, name: profile.displayName }, customizations: { title: 'AbujaLife Community Jackpot', description: `Add ₦${amount.toLocaleString('en-NG')} to Jackpot Balance` }, meta: { abujalife_reference: txRef, abujalife_product: 'community_jackpot' } }) });
      fail(trustedCheckout(data.link), 'Flutterwave returned an untrusted checkout link', 502, 'invalid_checkout');
      await this.collection('jackpot_deposit_orders').updateOne({ _id: txRef, status: 'creating' }, { $set: { status: 'pending', checkoutUrl: data.link } }); row = await this.collection('jackpot_deposit_orders').findOne({ _id: txRef });
      return { ok: true, checkout: orderView(row), replayed: false };
    } catch (error) { await this.collection('jackpot_deposit_orders').updateOne({ _id: txRef, status: 'creating' }, { $set: { status: 'checkout_failed' } }); throw error; }
  }
  async verifiedDeposit(transactionId, txRef, residentId = null) {
    transactionId = String(transactionId ?? ''); fail(/^\d{1,24}$/.test(transactionId), 'Use the Flutterwave transaction ID', 400, 'invalid_transaction');
    const order = await this.collection('jackpot_deposit_orders').findOne({ txRef: clean(txRef, 100) }); fail(order && (!residentId || order.residentId === residentId), 'Deposit not found', 404, 'deposit_not_found');
    const secrets = this.payments.decrypt(order.encryptedSecret, `jackpot-order:${order.txRef}`); fail(secrets?.secretKey, 'Payment credentials are unavailable', 503, 'payments_unavailable');
    const data = await this.payments.provider(`/v3/transactions/${transactionId}/verify`, secrets.secretKey);
    fail(String(data?.id) === transactionId && data.status === 'successful' && data.currency === 'NGN' && Number(data.amount) === order.amount && String(data.tx_ref || '') === order.txRef, 'This transaction does not match your Jackpot deposit', 409, 'payment_verification_failed'); return { order, transactionId };
  }
  async creditDeposit({ order, transactionId }, actor = 'resident') {
    try {
      const result = await this.store.transaction(async session => {
        const current = await this.collection('jackpot_deposit_orders').findOne({ _id: order._id }, { session }); fail(current && current.residentId === order.residentId && current.amount === order.amount, 'Deposit changed during verification', 409, 'payment_verification_failed');
        if (current.status === 'credited') return { replayed: true, payment: orderView(current) };
        const receiptId = `flutterwave:${transactionId}`, prior = await this.collection('jackpot_deposit_receipts').findOne({ _id: receiptId }, { session }); fail(!prior, 'This provider transaction has already been credited', 409, 'payment_duplicate');
        await this.moveBalance(current.residentId, { operationKey: `deposit:${transactionId}`, type: 'deposit', deltaAvailable: current.amount, metadata: { provider: 'flutterwave', transactionId, txRef: current.txRef } }, session);
        await this.collection('jackpot_deposit_receipts').insertOne({ _id: receiptId, provider: 'flutterwave', transactionId, txRef: current.txRef, residentId: current.residentId, amount: current.amount, createdAt: this.store.clock() }, { session });
        await this.collection('jackpot_deposit_orders').updateOne({ _id: current._id, status: { $ne: 'credited' } }, { $set: { status: 'credited', transactionId, creditedAt: this.store.clock() } }, { session });
        await this.admin.record(actor, 'credit-jackpot-deposit', current.residentId, { txRef: current.txRef, transactionId, amount: current.amount, mode: current.mode }, { session });
        return { replayed: false, payment: orderView({ ...current, status: 'credited', transactionId, creditedAt: this.store.clock() }) };
      });
      this.log(result.replayed ? 'jackpot_deposit_replay' : 'jackpot_deposit_credit', { residentId: order.residentId, txRef: order.txRef, transactionId, amount: order.amount }); return result;
    } catch (error) { if (error.code === 11000) throw new GameError('This provider transaction has already been credited', 409, 'payment_duplicate'); throw error; }
  }
  async verifyDeposit(residentId, body = {}) { const result = await this.creditDeposit(await this.verifiedDeposit(body.transactionId, body.txRef, residentId), residentId); return { ok: true, ...result, state: await this.state(residentId) }; }
  async depositStatus(residentId, txRef) { const row = await this.collection('jackpot_deposit_orders').findOne({ residentId, txRef: clean(txRef, 100) }); fail(row, 'Deposit not found', 404, 'deposit_not_found'); return { ok: true, payment: orderView(row) }; }
  async requestWithdrawal(residentId, { amount, bankName, accountNumber, accountName, idempotencyKey: requestKey } = {}) {
    fail(idempotencyKey(requestKey), 'Use a valid withdrawal request key'); const quote = jackpotWithdrawalQuote(Number(amount));
    bankName = clean(bankName, 80); accountNumber = clean(accountNumber, 20).replace(/\s+/g, ''); accountName = clean(accountName, 100);
    fail(bankName.length >= 2, 'Enter your bank'); fail(/^\d{10,20}$/.test(accountNumber), 'Enter a valid account number'); fail(accountName.length >= 2, 'Enter the account name');
    const fingerprint = JSON.stringify({ ...quote, bankName: bankName.toLowerCase(), accountNumber, accountName: accountName.toLowerCase() }), withdrawalId = `jwd_${crypto.randomUUID()}`; let row;
    try {
      row = await this.store.transaction(async session => {
        const existing = await this.collection('jackpot_withdrawals').findOne({ residentId, operationKey: requestKey }, { session }); if (existing) { fail(existing.fingerprint === fingerprint, 'This withdrawal key was already used for another request', 409, 'idempotency_conflict'); return existing; }
        await this.moveBalance(residentId, { operationKey: `withdrawal-hold:${withdrawalId}`, type: 'withdrawal_requested', deltaAvailable: -quote.grossAmount, deltaPending: quote.grossAmount, metadata: { withdrawalId, ...quote } }, session);
        const now = this.store.clock(), encryptedBank = this.payments.encrypt({ bankName, accountNumber, accountName }, `jackpot-withdrawal:${withdrawalId}`);
        const created = { _id: withdrawalId, residentId, operationKey: requestKey, fingerprint, ...quote, status: 'requested', bankName, bankLast4: accountNumber.slice(-4), accountName, encryptedBank, requestedAt: now, updatedAt: now, paidAt: null, reference: null };
        await this.collection('jackpot_withdrawals').insertOne(created, { session }); return created;
      });
    } catch (error) { if (error.code !== 11000) throw error; row = await this.collection('jackpot_withdrawals').findOne({ residentId, operationKey: requestKey }); fail(row && row.fingerprint === fingerprint, 'This withdrawal key was already used for another request', 409, 'idempotency_conflict'); }
    this.log('jackpot_withdrawal_requested', { residentId, withdrawalId: row._id, grossAmount: row.grossAmount, netAmount: row.netAmount }); return { ok: true, withdrawal: { id: row._id, grossAmount: row.grossAmount, feeAmount: row.feeAmount, netAmount: row.netAmount, status: row.status, bankName: row.bankName, bankLast4: row.bankLast4, accountName: row.accountName, requestedAt: row.requestedAt }, state: await this.state(residentId) };
  }
  async adminOverview(adminId) {
    await this.admin.requirePermission(adminId, 'payments'); await this.tick();
    const [rooms, requested, processing, completedToday] = await Promise.all([
      this.collection('jackpot_rooms').find({ active: true }).toArray(),
      this.collection('jackpot_withdrawals').find({ status: 'requested' }).toArray(),
      this.collection('jackpot_withdrawals').find({ status: 'processing' }).toArray(),
      this.collection('jackpot_rooms').countDocuments({ status: 'completed', completedAt: { $gte: this.store.clock() - 86400000 } }),
    ]);
    const queue = [...requested, ...processing]; return { ok: true, rooms: rooms.sort(roomSort).map(publicRoom), stats: { pendingWithdrawals: queue.length, pendingGross: queue.reduce((sum, row) => sum + row.grossAmount, 0), pendingNet: queue.reduce((sum, row) => sum + row.netAmount, 0), completedRooms24h: completedToday } };
  }
  async adminWithdrawals(adminId) {
    await this.admin.requirePermission(adminId, 'payments'); const rows = await this.collection('jackpot_withdrawals').find({ status: { $in: ['requested', 'processing'] } }).sort({ requestedAt: 1 }).limit(200).toArray();
    const output = []; for (const row of rows) { const profile = await this.store.profile(row.residentId); let bank = {}; try { bank = this.payments.decrypt(row.encryptedBank, `jackpot-withdrawal:${row._id}`); } catch { bank = { bankName: row.bankName, accountNumber: `••••${row.bankLast4}`, accountName: row.accountName }; }
      output.push({ id: row._id, residentId: row.residentId, resident: { displayName: profile.displayName, username: profile.username }, grossAmount: row.grossAmount, feeAmount: row.feeAmount, netAmount: row.netAmount, status: row.status, bank, requestedAt: row.requestedAt, updatedAt: row.updatedAt }); }
    return { ok: true, withdrawals: output };
  }
  async adminWithdrawalAction(adminId, withdrawalId, action, { reference, reason } = {}) {
    await this.admin.requirePermission(adminId, 'payments'); fail(['start', 'paid', 'return'].includes(action), 'Choose a supported withdrawal action');
    const now = this.store.clock();
    return this.store.transaction(async session => {
      await this.admin.requirePermission(adminId, 'payments', { session }); const row = await this.collection('jackpot_withdrawals').findOne({ _id: withdrawalId }, { session }); fail(row, 'Withdrawal not found', 404, 'withdrawal_not_found');
      if (action === 'start') { if (row.status === 'processing') return { ok: true, replayed: true }; fail(row.status === 'requested', 'This withdrawal is no longer waiting to start', 409, 'withdrawal_state'); await this.collection('jackpot_withdrawals').updateOne({ _id: row._id, status: 'requested' }, { $set: { status: 'processing', updatedAt: now, processingBy: adminId } }, { session }); await this.admin.record(adminId, 'start-jackpot-withdrawal', row.residentId, { withdrawalId, grossAmount: row.grossAmount, netAmount: row.netAmount }, { session }); return { ok: true }; }
      if (action === 'paid') { reference = clean(reference, 120); fail(reference.length >= 3, 'Enter the transfer reference before marking paid'); if (row.status === 'paid') return { ok: true, replayed: true }; fail(['requested', 'processing'].includes(row.status), 'This withdrawal cannot be marked paid', 409, 'withdrawal_state'); await this.moveBalance(row.residentId, { operationKey: `withdrawal-paid:${row._id}`, type: 'withdrawal_paid', deltaPending: -row.grossAmount, metadata: { withdrawalId: row._id, grossAmount: row.grossAmount, feeAmount: row.feeAmount, netAmount: row.netAmount, reference } }, session); await this.collection('jackpot_withdrawals').updateOne({ _id: row._id, status: { $in: ['requested', 'processing'] } }, { $set: { status: 'paid', reference, paidAt: now, updatedAt: now, paidBy: adminId } }, { session }); await this.admin.record(adminId, 'pay-jackpot-withdrawal', row.residentId, { withdrawalId, grossAmount: row.grossAmount, feeAmount: row.feeAmount, netAmount: row.netAmount, reference }, { session }); return { ok: true }; }
      reason = clean(reason, 300); fail(reason.length >= 3, 'Enter why this withdrawal is being returned'); if (row.status === 'returned') return { ok: true, replayed: true }; fail(['requested', 'processing'].includes(row.status), 'This withdrawal cannot be returned', 409, 'withdrawal_state'); await this.moveBalance(row.residentId, { operationKey: `withdrawal-return:${row._id}`, type: 'withdrawal_returned', deltaAvailable: row.grossAmount, deltaPending: -row.grossAmount, metadata: { withdrawalId: row._id, reason } }, session); await this.collection('jackpot_withdrawals').updateOne({ _id: row._id, status: { $in: ['requested', 'processing'] } }, { $set: { status: 'returned', returnReason: reason, updatedAt: now, returnedBy: adminId } }, { session }); await this.admin.record(adminId, 'return-jackpot-withdrawal', row.residentId, { withdrawalId, grossAmount: row.grossAmount, reason }, { session }); return { ok: true };
    });
  }
  async handleWebhook(req, res) {
    const raw = await rawBody(req), signature = req.headers['flutterwave-signature'];
    const base = await this.payments.handleWebhook(raw, signature); let body = {}; try { body = JSON.parse(raw.toString('utf8')); } catch { return json(res, 200, base); }
    const txRef = clean(body.data?.tx_ref, 100); if (body.event !== 'charge.completed' || !txRef.startsWith('abjl_jp_')) return json(res, 200, base);
    const order = await this.collection('jackpot_deposit_orders').findOne({ txRef }); if (!order) return json(res, 200, { ok: true, ignored: true });
    const result = await this.creditDeposit(await this.verifiedDeposit(body.data?.id, txRef), 'flutterwave-webhook'); return json(res, 200, { ok: true, jackpot: true, ...result });
  }
  async handle(req, res) {
    let pathname = '';
    try {
      const url = new URL(req.url, 'https://api.abujacity.life'); pathname = url.pathname; this.cors(req, res);
      if (req.method === 'OPTIONS') { res.writeHead(204, { ...SECURITY_HEADERS, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization, X-Request-ID', 'access-control-max-age': '600' }); res.end(); return; }
      fail(['GET', 'POST'].includes(req.method || ''), 'Method is not permitted', 405, 'method_not_allowed');
      const residentId = await this.requireResident(req); this.rateLimit(residentId, req.method === 'POST' ? 'writes' : 'reads', req.method === 'POST' ? 45 : 120);
      const adminPath = pathname.startsWith('/api/admin/jackpot/');
      if (req.method === 'POST') this.requireActionOrigin(req); const body = req.method === 'POST' ? await readJSON(req) : {};
      if (pathname === '/api/jackpot/state' && req.method === 'GET') return json(res, 200, await this.state(residentId));
      if (pathname === '/api/jackpot/deposits/checkout' && req.method === 'POST') return json(res, 200, await this.depositCheckout(residentId, body));
      if (pathname === '/api/jackpot/deposits/verify' && req.method === 'POST') return json(res, 200, await this.verifyDeposit(residentId, body));
      if (pathname === '/api/jackpot/deposits/status' && req.method === 'GET') return json(res, 200, await this.depositStatus(residentId, url.searchParams.get('txRef')));
      const join = pathname.match(/^\/api\/jackpot\/rooms\/([^/]+)\/join$/); if (join && req.method === 'POST') return json(res, 200, await this.join(residentId, decodeURIComponent(join[1]), body.idempotencyKey));
      if (pathname === '/api/jackpot/withdrawals' && req.method === 'POST') return json(res, 201, await this.requestWithdrawal(residentId, body));
      if (pathname === '/api/admin/jackpot/overview' && req.method === 'GET') return json(res, 200, await this.adminOverview(residentId));
      if (pathname === '/api/admin/jackpot/withdrawals' && req.method === 'GET') return json(res, 200, await this.adminWithdrawals(residentId));
      const withdrawal = pathname.match(/^\/api\/admin\/jackpot\/withdrawals\/([^/]+)\/(start|paid|return)$/); if (withdrawal && req.method === 'POST') return json(res, 200, await this.adminWithdrawalAction(residentId, decodeURIComponent(withdrawal[1]), withdrawal[2], body));
      if (adminPath) await this.admin.requirePermission(residentId, 'payments');
      return json(res, 404, { ok: false, error: 'Not found', code: 'not_found' });
    } catch (error) {
      const status = error instanceof GameError ? error.status : 500; this.log(status >= 500 ? 'jackpot_request_error' : 'jackpot_request_rejected', { status, code: error instanceof GameError ? error.code : 'internal_error', method: req.method, path: pathname });
      if (res.headersSent) { res.end(); return; } if (status === 429) res.setHeader('retry-after', '60'); return json(res, status, { ok: false, error: error instanceof GameError ? error.message : 'Something went wrong. Please try again.', code: error instanceof GameError ? error.code : 'server_error' });
    }
  }
}

export async function attachJackpotIntegration(server, options = {}) {
  const integration = await new JackpotIntegration(options).init(), listeners = server.listeners('request');
  if (!listeners.length) throw new Error('Cannot attach Community Jackpot before the HTTP request handler exists');
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    let pathname = ''; try { pathname = new URL(req.url, 'https://api.abujacity.life').pathname; } catch {}
    if (pathname.startsWith('/api/jackpot/') || pathname.startsWith('/api/admin/jackpot/')) { void integration.handle(req, res); return; }
    if (pathname === '/api/payments/webhook' && req.method === 'POST') { void integration.handleWebhook(req, res).catch(error => { const status = error instanceof GameError ? error.status : 500; options.log?.('jackpot_webhook_error', { status, code: error instanceof GameError ? error.code : 'internal_error' }); if (!res.headersSent) json(res, status, { ok: false, error: error instanceof GameError ? error.message : 'Something went wrong. Please try again.', code: error instanceof GameError ? error.code : 'server_error' }); else res.end(); }); return; }
    for (const listener of listeners) listener.call(server, req, res);
  });
  server.on('close', () => integration.close()); server.jackpotIntegration = integration; return integration;
}

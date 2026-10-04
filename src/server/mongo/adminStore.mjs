import crypto from 'node:crypto';
import { GameError } from '../errors.mjs';
export const ADMIN_ROLES = Object.freeze({superadmin:['overview','residents','moderation','payments','finance','roles','settings','audit'],operator:['overview','residents','payments','finance','audit'],moderator:['overview','residents','moderation']});

const fail = (condition, message, status = 400, code = 'invalid_admin_action') => { if (!condition) throw new GameError(message, status, code); };
const text = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const key = value => crypto.createHash('sha256').update(value).digest('hex');
const pageLimit = value => Math.max(1, Math.min(100, Number.isSafeInteger(Number(value)) ? Number(value) : 30));
const encodeCursor = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function decodeCursor(value, chronological = false) {
  if (!value) return null;
  try {
    fail(typeof value === 'string' && value.length <= 512, 'Invalid page cursor');
    const page = JSON.parse(Buffer.from(value, 'base64url').toString());
    fail(Array.isArray(page) && page.length === 2 && typeof page[1] === 'string' && page[1].length <= 100
      && (chronological ? Number.isSafeInteger(page[0]) && page[0] >= 0 : typeof page[0] === 'string' && page[0].length <= 24), 'Invalid page cursor');
    return page;
  } catch { throw new GameError('Invalid page cursor'); }
}
const options = session => session ? { session } : {};
const chronologicalPage = page => page ? { $or: [{ createdAt: { $lt: page[0] } }, { createdAt: page[0], id: { $lt: page[1] } }] } : {};
const auditView = row => ({ id: row.id, actor_id: row.actorId, action: row.action, target_id: row.targetId, details: row.details, created_at: row.createdAt });
export const MONGO_ADMIN_INDEXES = Object.freeze({
  admin_roles: [[{ residentId: 1 }, { unique: true }]],
  admin_suspensions: [[{ residentId: 1 }, { unique: true }]],
  admin_audit: [[{ createdAt: -1, id: -1 }, {}], [{ targetId: 1, createdAt: -1 }, {}]],
  report_reviews: [[{ reportId: 1 }, { unique: true }]],
  wallet_operations: [[{ actorId: 1, operationKey: 1 }, { unique: true }]],
  residents: [[{ username: 1, id: 1 }, {}]]
});
const string = { bsonType: 'string', minLength: 1 };
const timestamp = { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 };
const schema = (required, properties) => ({ $jsonSchema: { bsonType: 'object', required, properties: { _id: string, ...properties } } });
export const MONGO_ADMIN_VALIDATORS = Object.freeze({
  admin_roles: schema(['_id', 'residentId', 'role', 'createdAt'], { residentId: string, role: { enum: Object.keys(ADMIN_ROLES) }, assignedBy: { bsonType: ['string', 'null'] }, createdAt: timestamp }),
  admin_suspensions: schema(['_id', 'residentId', 'reason', 'actorId', 'createdAt'], { residentId: string, reason: string, actorId: string, createdAt: timestamp }),
  admin_audit: schema(['_id', 'id', 'actorId', 'action', 'details', 'createdAt'], { id: string, actorId: string, action: string, targetId: { bsonType: ['string', 'null'] }, details: { bsonType: 'object' }, createdAt: timestamp }),
  admin_settings: schema(['_id'], {}),
  report_reviews: schema(['_id', 'reportId', 'status', 'note', 'actorId', 'createdAt'], { reportId: string, status: { enum: ['open', 'resolved', 'dismissed'] }, note: string, actorId: string, createdAt: timestamp }),
  wallet_operations: schema(['_id', 'actorId', 'operationKey', 'fingerprint', 'result', 'createdAt'], { actorId: string, operationKey: string, fingerprint: string, result: { bsonType: 'object' }, createdAt: timestamp })
});
export async function ensureMongoAdminSchema(db) {
  for (const [name, validator] of Object.entries(MONGO_ADMIN_VALIDATORS)) {
    try { await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' }); }
    catch (error) { if (error.code !== 48) throw error; }
    await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
  }
  for (const [name, definitions] of Object.entries(MONGO_ADMIN_INDEXES)) for (const [definition, config] of definitions) await db.collection(name).createIndex(definition, config);
}

/** Persistent server-side RBAC and audited wallet corrections share gameplay transactions. */
export class MongoAdminStore {
  constructor({ store, bootstrapUsername = process.env.ABUJALIFE_ADMIN_USERNAME || '' } = {}) {
    fail(store?.db && store?.transaction, 'The MongoDB game store is required', 500);
    this.store = store; this.db = store.db; this.clock = () => store.clock(); this.bootstrapUsername = text(bootstrapUsername, 24).toLowerCase();
  }
  collection(name) { return this.db.collection(name); }
  async init({ ensureIndexes = true } = {}) {
    if (ensureIndexes) await ensureMongoAdminSchema(this.db);
    if (!this.bootstrapUsername) return this;
    // This runs only at startup and binds a resident already present at that moment.
    await this.store.transaction(async session => {
      await this.lockRoles(session);
      if (await this.collection('admin_roles').findOne({}, { session })) return;
      const resident = await this.collection('residents').findOne({ username: this.bootstrapUsername }, { session });
      if (!resident) return;
      await this.collection('admin_roles').insertOne({ _id: resident.id, residentId: resident.id, role: 'superadmin', assignedBy: null, createdAt: this.clock() }, { session });
      await this.record(resident.id, 'bootstrap-admin', resident.id, { source: 'server environment; existing resident ID' }, { session });
    });
    return this;
  }
  async lockRoles(session) {
    // A common write serializes last-owner checks, including concurrent role changes.
    await this.collection('admin_settings').updateOne({ _id: 'rbac-lock' }, { $inc: { version: 1 } }, { session, upsert: true });
  }
  async record(actorId, action, targetId = null, details = {}, { session } = {}) {
    const id = crypto.randomUUID();
    await this.collection('admin_audit').insertOne({ _id: id, id, actorId, action, targetId, details: structuredClone(details), createdAt: this.clock() }, options(session));
  }
  async isSuspended(id, { session } = {}) { return Boolean(id && await this.collection('admin_suspensions').findOne({ residentId: id }, options(session))); }
  async status(id, { session } = {}) {
    const role = id && !await this.isSuspended(id, { session }) ? (await this.collection('admin_roles').findOne({ residentId: id }, options(session)))?.role || null : null;
    return { ok: true, role, permissions: role && ADMIN_ROLES[role] ? [...ADMIN_ROLES[role]] : [], bootstrapConfigured: Boolean(await this.collection('admin_roles').findOne({}, options(session))) };
  }
  async requirePermission(id, permission, { session } = {}) {
    fail(typeof id === 'string' && id, 'Sign in to your resident account', 401, 'authentication_required');
    const status = await this.status(id, { session });
    fail(status.role && status.permissions.includes(permission), 'This action requires administrator access', 403, 'admin_forbidden'); return status;
  }
  async overview(id) {
    await this.requirePermission(id, 'overview');
    const open = await this.collection('reports').aggregate([{ $lookup: { from: 'report_reviews', localField: 'id', foreignField: 'reportId', as: 'reviews' } }, { $match: { $or: [{ reviews: { $size: 0 } }, { 'reviews.status': 'open' }] } }, { $count: 'total' }]).toArray();
    return { ok: true, stats: { residents: await this.collection('residents').countDocuments(), suspended: await this.collection('admin_suspensions').countDocuments(), openReports: open[0]?.total || 0, admins: await this.collection('admin_roles').countDocuments() }, role: (await this.status(id)).role };
  }
  async residents(id, { query = '', cursor, limit } = {}) {
    await this.requirePermission(id, 'residents'); const prefix = text(query, 24).toLowerCase(); fail(!prefix || /^[a-z0-9_]+$/.test(prefix), 'Search a username prefix');
    const page = decodeCursor(cursor), size = pageLimit(limit), match = prefix ? { username: { $gte: prefix, $lt: prefix + '\uffff' } } : {};
    if (page) match.$or = [{ username: { $gt: page[0] } }, { username: page[0], id: { $gt: page[1] } }];
    const rows = await this.collection('residents').find(match, { projection: { id: 1, username: 1, displayName: 1, createdAt: 1 } }).sort({ username: 1, id: 1 }).limit(size + 1).toArray();
    const more = rows.length > size; rows.length = Math.min(rows.length, size); const ids = rows.map(row => row.id);
    const [wallets, states, roles, suspended] = await Promise.all(['wallets', 'player_state', 'admin_roles', 'admin_suspensions'].map(name => this.collection(name).find({ residentId: { $in: ids } }).toArray()));
    const byId = values => new Map(values.map(value => [value.residentId, value])); const w = byId(wallets), s = byId(states), r = byId(roles), sp = byId(suspended);
    return { ok: true, residents: rows.map(row => ({ id: row.id, username: row.username, displayName: row.displayName, district: s.get(row.id)?.district, wallet: w.get(row.id)?.balance, createdAt: row.createdAt, role: r.get(row.id)?.role || null, suspended: sp.has(row.id) })), nextCursor: more ? encodeCursor([rows.at(-1).username, rows.at(-1).id]) : null };
  }
  async resident(id, residentId) {
    await this.requirePermission(id, 'residents'); const resident = await this.store.profile(residentId), suspension = await this.collection('admin_suspensions').findOne({ residentId });
    return { ok: true, resident, role: (await this.collection('admin_roles').findOne({ residentId }))?.role || null, suspension: suspension ? { reason: suspension.reason, actor_id: suspension.actorId, created_at: suspension.createdAt } : null, transactions: await this.store.transactions(residentId) };
  }
  async protectLastSuperadmin(residentId, session) {
    const role = await this.collection('admin_roles').findOne({ residentId }, { session }); if (role?.role !== 'superadmin') return;
    const active = await this.collection('admin_roles').aggregate([{ $match: { role: 'superadmin' } }, { $lookup: { from: 'admin_suspensions', localField: 'residentId', foreignField: 'residentId', as: 'suspensions' } }, { $match: { suspensions: { $size: 0 } } }, { $count: 'total' }], { session }).toArray();
    fail((active[0]?.total || 0) > 1, 'Keep at least one active super administrator', 409, 'last_superadmin');
  }
  async assignRole(id, { residentId, role } = {}) {
    fail(role === null || Object.hasOwn(ADMIN_ROLES, role), 'Choose a supported administrator role');
    await this.store.transaction(async session => {
      await this.lockRoles(session); await this.requirePermission(id, 'roles', { session }); await this.store.profile(residentId, { session });
      const old = (await this.collection('admin_roles').findOne({ residentId }, { session }))?.role || null;
      if (old === 'superadmin' && role !== 'superadmin') await this.protectLastSuperadmin(residentId, session);
      if (role) await this.collection('admin_roles').updateOne({ residentId }, { $set: { role, assignedBy: id, createdAt: this.clock() }, $setOnInsert: { _id: residentId, residentId } }, { session, upsert: true });
      else await this.collection('admin_roles').deleteOne({ residentId }, { session });
      await this.record(id, 'assign-role', residentId, { before: old, after: role }, { session });
    }); return { ok: true, role };
  }
  async setSuspension(id, { residentId, suspended, reason } = {}) {
    fail(typeof suspended === 'boolean', 'Choose a suspension state'); reason = text(reason); fail(reason.length >= 8, 'Explain this moderation decision in at least eight characters');
    await this.store.transaction(async session => {
      await this.lockRoles(session); const actor = await this.requirePermission(id, 'moderation', { session }); await this.store.profile(residentId, { session });
      if (await this.collection('admin_roles').findOne({ residentId }, { session })) fail(actor.role === 'superadmin', 'Only a super administrator may suspend an administrator', 403, 'admin_forbidden');
      if (suspended) {
        await this.protectLastSuperadmin(residentId, session);
        await this.collection('admin_suspensions').updateOne({ residentId }, { $set: { reason, actorId: id, createdAt: this.clock() }, $setOnInsert: { _id: residentId, residentId } }, { session, upsert: true });
        await this.collection('sessions').deleteMany({ residentId }, { session });
        await this.collection('password_resets').deleteMany({ residentId }, { session });
        await this.collection('residents').updateOne({ id: residentId }, { $inc: { authEpoch: 1 } }, { session });
      } else await this.collection('admin_suspensions').deleteOne({ residentId }, { session });
      await this.record(id, suspended ? 'suspend-resident' : 'restore-resident', residentId, { reason }, { session });
    }); await this.store.emitUser(residentId, 'suspension', { suspended }); return { ok: true, suspended };
  }
  async adjustWallet(id, { residentId, amount, reason, idempotencyKey } = {}) {
    await this.requirePermission(id, 'finance'); fail(Number.isSafeInteger(amount) && amount !== 0, 'Enter a nonzero whole Naira adjustment');
    reason = text(reason, 160); fail(reason.length >= 8, 'Explain this wallet adjustment in at least eight characters');
    fail(typeof idempotencyKey === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey), 'Use a valid request key');
    const fingerprint = JSON.stringify({ residentId, amount, reason }), operationId = key(id + ':' + idempotencyKey);
    const existing = await this.collection('wallet_operations').findOne({ _id: operationId });
    if (existing) { fail(existing.fingerprint === fingerprint, 'Request key was already used for another adjustment', 409, 'idempotency_conflict'); return { ...existing.result, profile: await this.store.profile(residentId), replayed: true }; }
    return this.store.economyOperation(residentId, 'admin-adjustment', { idempotencyKey: 'admin_' + operationId }, { actorId: id, residentId, amount, reason }, async (profile, timestamp, session) => {
      await this.requirePermission(id, 'finance', { session });
      const old = await this.collection('wallet_operations').findOne({ _id: operationId }, { session });
      fail(!old || old.fingerprint === fingerprint, 'Request key was already used for another adjustment', 409, 'idempotency_conflict');
      const before = profile.wallet; fail(Number.isSafeInteger(before + amount) && before + amount >= 0, 'The resulting balance must be a safe, nonnegative Naira amount', 409, 'wallet_limit'); profile.wallet += amount;
      await this.record(id, 'adjust-wallet', residentId, { amount, reason, before, after: profile.wallet }, { session });
      await this.collection('wallet_operations').insertOne({ _id: operationId, actorId: id, operationKey: idempotencyKey, fingerprint, result: { ok: true, amount }, createdAt: timestamp }, { session });
      return { amount, ledgerReason: `Administrator adjustment · ${reason}` };
    }).catch(async error => {
      if (error.code !== 11000) throw error;
      const old = await this.collection('wallet_operations').findOne({ _id: operationId });
      fail(old && old.fingerprint === fingerprint, 'Request key was already used for another adjustment', 409, 'idempotency_conflict');
      return { ...old.result, profile: await this.store.profile(residentId), replayed: true };
    });
  }
  async reports(id, { cursor, limit } = {}) {
    await this.requirePermission(id, 'moderation'); const page = decodeCursor(cursor, true), size = pageLimit(limit);
    const rows = await this.collection('reports').find(chronologicalPage(page)).sort({ createdAt: -1, id: -1 }).limit(size + 1).toArray(); const more = rows.length > size; rows.length = Math.min(rows.length, size);
    const reviews = new Map((await this.collection('report_reviews').find({ reportId: { $in: rows.map(row => row.id) } }).toArray()).map(row => [row.reportId, row]));
    return { ok: true, reports: rows.map(row => ({ id: row.id, reporter_id: row.reporterId, target_id: row.targetId, message_id: row.messageId, reason: row.reason, created_at: row.createdAt, status: reviews.get(row.id)?.status || 'open', review_note: reviews.get(row.id)?.note || null })), nextCursor: more ? encodeCursor([rows.at(-1).createdAt, rows.at(-1).id]) : null };
  }
  async reviewReport(id, { reportId, status, note } = {}) {
    fail(['open', 'resolved', 'dismissed'].includes(status), 'Choose a report status'); note = text(note); fail(note.length >= 8, 'Explain the report decision');
    await this.store.transaction(async session => {
      await this.requirePermission(id, 'moderation', { session }); fail(await this.collection('reports').findOne({ id: reportId }, { session }), 'Report not found', 404);
      await this.collection('report_reviews').updateOne({ reportId }, { $set: { status, note, actorId: id, createdAt: this.clock() }, $setOnInsert: { _id: reportId, reportId } }, { session, upsert: true });
      await this.record(id, 'review-report', reportId, { status, note }, { session });
    }); return { ok: true, status };
  }
  async audit(id, { cursor, limit } = {}) {
    await this.requirePermission(id, 'audit'); const page = decodeCursor(cursor, true), size = pageLimit(limit), rows = await this.collection('admin_audit').find(chronologicalPage(page)).sort({ createdAt: -1, id: -1 }).limit(size + 1).toArray(); const more = rows.length > size; rows.length = Math.min(rows.length, size);
    return { ok: true, audit: rows.map(auditView), nextCursor: more ? encodeCursor([rows.at(-1).createdAt, rows.at(-1).id]) : null };
  }
  async publicSettings() {
    const stored = (await this.collection('admin_settings').findOne({ _id: 'game' }))?.value || {};
    return { registrationOpen: stored.registrationOpen !== false, gameTopupsEnabled: false, maintenance: stored.maintenance === true };
  }
  async settings(id) { await this.requirePermission(id, 'settings'); return { ok: true, settings: await this.publicSettings() }; }
  async saveSettings(id, body) {
    fail(body && typeof body === 'object' && !Array.isArray(body), 'Use game settings'); const allowed = ['registrationOpen', 'gameTopupsEnabled', 'maintenance'];
    fail(Object.keys(body).every(field => allowed.includes(field)), 'Choose supported game settings'); for (const value of Object.values(body)) fail(typeof value === 'boolean', 'Use boolean game settings');
    fail(body.gameTopupsEnabled !== true, 'Free game top-ups are disabled in production', 403, 'topup_disabled');
    let settings; await this.store.transaction(async session => {
      await this.requirePermission(id, 'settings', { session }); const old = (await this.collection('admin_settings').findOne({ _id: 'game' }, { session }))?.value || {};
      settings = { registrationOpen: old.registrationOpen !== false, maintenance: old.maintenance === true, ...body, gameTopupsEnabled: false };
      await this.collection('admin_settings').updateOne({ _id: 'game' }, { $set: { value: settings, updatedAt: this.clock() } }, { session, upsert: true });
      await this.record(id, 'update-game-settings', null, settings, { session });
    }); return { ok: true, settings };
  }
}

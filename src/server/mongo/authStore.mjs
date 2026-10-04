import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_MS = 30 * 60 * 1000;
const PASSWORD_COST = 32768;
const PASSWORD_BYTES = 64;
const dummyPassword = `scrypt$${PASSWORD_COST}$8$1$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(PASSWORD_BYTES).toString('base64url')}`;
const transactionOptions = { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' };

export class AuthError extends Error {
  constructor(message, status = 400, code = 'invalid_auth') {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

const check = (condition, message, status, code) => {
  if (!condition) throw new AuthError(message, status, code);
};
const dateAt = clock => new Date(clock());
const validToken = token => typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
export const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

function validatePassword(password) {
  check(typeof password === 'string' && password.length >= 8 && password.length <= 128,
    'Choose a password of 8–128 characters', 400, 'invalid_password');
  return password;
}

export function validateRegistration({ username, displayName, password, email } = {}) {
  username = typeof username === 'string' ? username.trim().toLowerCase() : '';
  check(/^[a-z0-9_]{3,24}$/.test(username), 'Use 3–24 letters, numbers or underscores for your username', 400, 'invalid_username');
  displayName = displayName == null || displayName === '' ? username : String(displayName).trim();
  check(displayName.length >= 2 && displayName.length <= 40, 'Display name must have 2–40 characters', 400, 'invalid_display_name');
  validatePassword(password);
  if (email != null && email !== '') {
    check(typeof email === 'string', 'Choose a valid email address', 400, 'invalid_email');
    email = email.trim().toLowerCase();
    check(email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Choose a valid email address', 400, 'invalid_email');
  } else email = undefined;
  return { username, displayName, password, ...(email ? { email } : {}) };
}

export async function hashPassword(password) {
  validatePassword(password);
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, PASSWORD_BYTES, { N: PASSWORD_COST, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return `scrypt$${PASSWORD_COST}$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const candidate = typeof password === 'string' && password.length <= 128 ? password : '';
  let cost = PASSWORD_COST, salt, expected, legacy = false;
  if (typeof stored === 'string' && /^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(stored)) {
    // Retain existing residents' scrypt passwords during a one-way SQLite import.
    const [oldSalt, oldHash] = stored.split(':');
    cost = 16384;
    salt = oldSalt;
    expected = Buffer.from(oldHash, 'hex');
    legacy = true;
  } else {
    const fields = String(stored || dummyPassword).split('$');
    const valid = fields.length === 6 && fields[0] === 'scrypt' && [16384, 32768, 65536].includes(Number(fields[1])) && fields[2] === '8' && fields[3] === '1';
    const safeFields = valid ? fields : dummyPassword.split('$');
    cost = Number(safeFields[1]);
    salt = Buffer.from(safeFields[4], 'base64url');
    expected = Buffer.from(safeFields[5], 'base64url');
    if (salt.length !== 16 || expected.length !== PASSWORD_BYTES) {
      const dummy = dummyPassword.split('$');
      salt = Buffer.from(dummy[4], 'base64url');
      expected = Buffer.from(dummy[5], 'base64url');
      stored = null;
    }
    if (!valid) stored = null;
  }
  const actual = await scrypt(candidate, salt, PASSWORD_BYTES, { N: cost, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return { valid: Boolean(stored) && crypto.timingSafeEqual(actual, expected), needsUpgrade: legacy || cost < PASSWORD_COST };
}

export class MongoAuthStore {
  constructor({ db, client, clock = () => Date.now(), deliverPasswordReset = null, sessionMs = SESSION_MS, resetMs = RESET_MS } = {}) {
    check(db && client, 'Mongo authentication requires a connected database', 500, 'mongo_required');
    check(Number.isSafeInteger(sessionMs) && sessionMs > 0 && sessionMs <= SESSION_MS, 'Invalid session lifetime', 500, 'invalid_configuration');
    check(Number.isSafeInteger(resetMs) && resetMs > 0 && resetMs <= RESET_MS, 'Invalid password reset lifetime', 500, 'invalid_configuration');
    this.db = db;
    this.client = client;
    this.clock = clock;
    this.deliverPasswordReset = typeof deliverPasswordReset === 'function' ? deliverPasswordReset : null;
    this.sessionMs = sessionMs;
    this.resetMs = resetMs;
  }

  hashToken(token) { return hashToken(token); }
  hashPassword(password) { return hashPassword(password); }

  async credentials(input) {
    const { password, ...identity } = validateRegistration(input);
    return { ...identity, passwordHash: await hashPassword(password), authEpoch: 0 };
  }

  async transaction(callback) {
    return this.client.withSession(async session => session.withTransaction(() => callback(session), transactionOptions));
  }

  async createSession(residentId, { session, expectedPasswordHash } = {}) {
    const create = async activeSession => {
      const resident = await this.db.collection('residents').findOne({ _id: residentId }, { session: activeSession, projection: { authEpoch: 1, passwordHash: 1 } });
      check(resident && (!expectedPasswordHash || resident.passwordHash === expectedPasswordHash), 'Username or password is incorrect', 401, 'invalid_credentials');
      const token = crypto.randomBytes(32).toString('hex');
      const createdAt = dateAt(this.clock), expiresAt = new Date(createdAt.getTime() + this.sessionMs);
      await this.db.collection('sessions').insertOne({ _id: hashToken(token), residentId, authEpoch: resident.authEpoch ?? 0, createdAt, expiresAt }, { session: activeSession });
      return { residentId, token, expiresAt: expiresAt.getTime() };
    };
    return session ? create(session) : this.transaction(create);
  }

  async login({ username, email, password } = {}) {
    const identifier = typeof email === 'string' && email.trim() ? email : username;
    const normalized = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
    const query = normalized.includes('@')
      ? normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? { email: normalized } : null
      : /^[a-z0-9_]{3,24}$/.test(normalized) ? { username: normalized } : null;
    const resident = query ? await this.db.collection('residents').findOne(query, { projection: { passwordHash: 1, authEpoch: 1 } }) : null;
    const verification = await verifyPassword(password, resident?.passwordHash);
    check(resident && verification.valid, 'Username or password is incorrect', 401, 'invalid_credentials');
    let expectedPasswordHash = resident.passwordHash;
    if (verification.needsUpgrade) {
      const upgraded = await hashPassword(password);
      const changed = await this.db.collection('residents').updateOne({ _id: resident._id, passwordHash: resident.passwordHash, authEpoch: resident.authEpoch ?? 0 }, { $set: { passwordHash: upgraded } });
      check(changed.modifiedCount === 1, 'Username or password is incorrect', 401, 'invalid_credentials');
      expectedPasswordHash = upgraded;
    }
    return this.createSession(resident._id, { expectedPasswordHash });
  }

  async session(token) {
    if (!validToken(token)) return null;
    const stored = await this.db.collection('sessions').findOne({ _id: hashToken(token), expiresAt: { $gt: dateAt(this.clock) } }, { projection: { residentId: 1, authEpoch: 1 } });
    if (!stored) return null;
    const resident = await this.db.collection('residents').findOne({ _id: stored.residentId, authEpoch: stored.authEpoch }, { projection: { _id: 1 } });
    return resident?._id ?? null;
  }

  async logout(token) {
    if (validToken(token)) await this.db.collection('sessions').deleteOne({ _id: hashToken(token) });
    return { ok: true };
  }

  async sessions(residentId, token) {
    const resident = await this.db.collection('residents').findOne({ _id: residentId }, { projection: { authEpoch: 1 } });
    check(resident, 'Resident not found', 404, 'resident_not_found');
    const currentHash = validToken(token) ? hashToken(token) : null;
    const rows = await this.db.collection('sessions').find({ residentId, authEpoch: resident.authEpoch ?? 0, expiresAt: { $gt: dateAt(this.clock) } })
      .sort({ createdAt: -1, _id: 1 }).limit(100).toArray();
    return { ok: true, sessions: rows.map(row => ({ id: row._id, createdAt: row.createdAt.getTime(), expiresAt: row.expiresAt.getTime(), current: row._id === currentHash })) };
  }

  async revokeSession(residentId, sessionId) {
    check(validToken(sessionId), 'Choose a valid session', 400, 'invalid_session');
    await this.db.collection('sessions').deleteOne({ _id: sessionId, residentId });
    return { ok: true };
  }

  async verifyEmail() {
    throw new AuthError('Email verification is not configured', 503, 'email_verification_unavailable');
  }

  async logoutAll(residentId) {
    return this.transaction(async session => {
      await this.db.collection('residents').updateOne({ _id: residentId }, { $inc: { authEpoch: 1 } }, { session });
      await this.db.collection('sessions').deleteMany({ residentId }, { session });
      await this.db.collection('password_resets').deleteMany({ residentId }, { session });
      return { ok: true };
    });
  }

  async refreshSession(token) {
    check(validToken(token), 'Your session has expired', 401, 'invalid_session');
    return this.transaction(async session => {
      const previous = await this.db.collection('sessions').findOneAndDelete({ _id: hashToken(token), expiresAt: { $gt: dateAt(this.clock) } }, { session, includeResultMetadata: false });
      check(previous, 'Your session has expired', 401, 'invalid_session');
      const resident = await this.db.collection('residents').findOne({ _id: previous.residentId, authEpoch: previous.authEpoch }, { session, projection: { _id: 1 } });
      check(resident, 'Your session has expired', 401, 'invalid_session');
      return this.createSession(previous.residentId, { session });
    });
  }

  async requestPasswordReset({ email, username } = {}) {
    // A generic response and no raw token in the response prevent account discovery.
    if (!this.deliverPasswordReset) return { ok: true };
    const query = typeof email === 'string' && email.trim() ? { email: email.trim().toLowerCase() }
      : typeof username === 'string' && /^[a-z0-9_]{3,24}$/i.test(username.trim()) ? { username: username.trim().toLowerCase() } : null;
    if (!query) return { ok: true };
    const resident = await this.db.collection('residents').findOne(query, { projection: { email: 1, authEpoch: 1 } });
    if (!resident?.email) return { ok: true };
    const token = crypto.randomBytes(32).toString('hex'), createdAt = dateAt(this.clock), expiresAt = new Date(createdAt.getTime() + this.resetMs);
    const tokenHash = hashToken(token);
    await this.transaction(async session => {
      await this.db.collection('password_resets').deleteMany({ residentId: resident._id }, { session });
      await this.db.collection('password_resets').insertOne({ _id: tokenHash, residentId: resident._id, authEpoch: resident.authEpoch ?? 0, createdAt, expiresAt }, { session });
    });
    try {
      await this.deliverPasswordReset({ email: resident.email, residentId: resident._id, token, expiresAt: expiresAt.getTime() });
    } catch {
      await this.db.collection('password_resets').deleteOne({ _id: tokenHash });
    }
    return { ok: true };
  }

  async resetPassword({ token, password } = {}) {
    check(validToken(token), 'This password reset link is invalid or expired', 410, 'invalid_reset');
    const passwordHash = await hashPassword(password);
    return this.transaction(async session => {
      const reset = await this.db.collection('password_resets').findOneAndDelete({ _id: hashToken(token), expiresAt: { $gt: dateAt(this.clock) } }, { session, includeResultMetadata: false });
      check(reset, 'This password reset link is invalid or expired', 410, 'invalid_reset');
      const changed = await this.db.collection('residents').updateOne({ _id: reset.residentId, authEpoch: reset.authEpoch }, { $set: { passwordHash }, $inc: { authEpoch: 1 } }, { session });
      check(changed.modifiedCount === 1, 'This password reset link is invalid or expired', 410, 'invalid_reset');
      await this.db.collection('sessions').deleteMany({ residentId: reset.residentId }, { session });
      await this.db.collection('password_resets').deleteMany({ residentId: reset.residentId }, { session });
      return { ok: true };
    });
  }

  completePasswordReset(body) { return this.resetPassword(body); }
}

import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';

export const MONGO_SCHEMA_VERSION = 1;
export const MONGO_APPEND_ONLY_COLLECTIONS = Object.freeze(['ledger', 'wallet_transfers', 'economy_operations', 'payment_receipts', 'admin_audit', 'wallet_operations']);
export const MONGO_COLLECTIONS = Object.freeze([
  'schema_versions', 'residents', 'appearances', 'needs', 'progression', 'player_state', 'homes', 'origins',
  'wallets', 'ledger', 'wallet_transfers', 'economy_operations', 'inventory', 'vehicles', 'properties', 'loans', 'gamble_rounds',
  'challenges', 'sessions', 'password_resets', 'email_verifications', 'conversations', 'members', 'messages', 'friendships',
  'moderation', 'notifications', 'reports', 'invitations', 'events', 'event_rsvps', 'location_messages',
  'social_posts', 'social_likes', 'social_comments', 'home_visit_requests', 'home_visit_sessions', 'follows',
  'community_groups', 'community_members', 'presence_sessions', 'payment_orders', 'payment_config',
  'payment_preferences', 'payment_receipts', 'admin_roles', 'admin_suspensions', 'admin_audit', 'admin_settings',
  'report_reviews', 'wallet_operations', 'x_connections', 'reward_campaigns', 'reward_share_sessions', 'reward_claims', 'reward_activity_definitions', 'reward_activity_sessions', 'reward_activity_claims'
]);

const string = { bsonType: 'string', minLength: 1 };
const whole = { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 };
const signedWhole = { ...whole, minimum: -Number.MAX_SAFE_INTEGER };
const timestamp = { ...whole };
const nullableTimestamp = { anyOf: [timestamp, { bsonType: 'null' }] };
const object = { bsonType: 'object' };
const date = { bsonType: 'date' };
const normalized = (properties = {}, required = ['_id', 'residentId']) => ({
  $jsonSchema: { bsonType: 'object', required, properties: { _id: string, residentId: string, ...properties } }
});
const generic = (properties = {}, required = []) => ({ $jsonSchema: { bsonType: 'object', ...(required.length ? { required } : {}), properties } });

export const MONGO_VALIDATORS = Object.freeze({
  schema_versions: generic({ _id: string, version: whole, createdAt: date, updatedAt: date }, ['_id']),
  residents: { $jsonSchema: {
    bsonType: 'object', additionalProperties: false, required: ['_id', 'username', 'displayName', 'passwordHash', 'authEpoch', 'createdAt'],
    properties: { _id: string, id: string, username: { bsonType: 'string', pattern: '^[a-z0-9_]{3,24}$' }, displayName: { bsonType: 'string', minLength: 2, maxLength: 40 },
      passwordHash: string, authEpoch: whole, email: { bsonType: 'string', maxLength: 254 }, emailVerified: { bsonType: 'bool' }, emailVerifiedAt: nullableTimestamp,
      createdAt: timestamp, searchPrefixes: { bsonType: 'array', items: string, maxItems: 240 }, settings: object, lifeGoal: string, onboardingComplete: { bsonType: 'bool' } }
  } },
  appearances: normalized(), needs: normalized(), progression: normalized(), player_state: normalized(), homes: normalized(),
  origins: normalized({ origin: object }, ['_id', 'residentId', 'origin']),
  wallets: normalized({ balance: whole, version: whole }, ['_id', 'residentId', 'balance', 'version']),
  ledger: normalized({ id: string, amount: signedWhole, balanceAfter: whole, type: string, reason: string, createdAt: timestamp, operationId: string, sequence: whole, transferId: string }, ['_id', 'residentId', 'amount', 'balanceAfter', 'type', 'reason', 'createdAt', 'operationId', 'sequence']),
  wallet_transfers: generic({ _id: string, id: string, senderId: string, recipientId: string, amount: { ...whole, minimum: 1 }, note: { bsonType: 'string', maxLength: 120 }, conversationId: { bsonType: ['string', 'null'] }, operationKey: string, senderLedgerOperationId: string, recipientLedgerOperationId: string, messageId: string, createdAt: timestamp, virtual: { enum: [true] }, currency: { enum: ['game-naira'] } }, ['_id', 'id', 'senderId', 'recipientId', 'amount', 'note', 'conversationId', 'operationKey', 'senderLedgerOperationId', 'recipientLedgerOperationId', 'createdAt', 'virtual', 'currency']),
  economy_operations: normalized({ operationKey: string, kind: string, fingerprint: string, result: object, createdAt: timestamp }, ['_id', 'residentId', 'operationKey', 'kind', 'fingerprint', 'result', 'createdAt']),
  inventory: normalized({ itemId: string, category: string, acquiredAt: timestamp }, ['_id', 'residentId', 'itemId']),
  vehicles: normalized({ itemId: string, color: string }, ['_id', 'residentId', 'itemId']),
  properties: normalized({ propertyId: string, owned: { bsonType: 'bool' }, investment: object }, ['_id', 'residentId', 'propertyId']),
  loans: normalized(), gamble_rounds: normalized(),
  challenges: normalized({ jobId: string, startedAt: timestamp, workDate: string, shiftSlot: string, shiftEndsAt: timestamp, completedAt: nullableTimestamp, cancelledAt: nullableTimestamp }, ['_id', 'residentId', 'jobId', 'startedAt']),
  sessions: normalized({ authEpoch: whole, createdAt: date, expiresAt: date }, ['_id', 'residentId', 'authEpoch', 'createdAt', 'expiresAt']),
  password_resets: normalized({ authEpoch: whole, createdAt: date, expiresAt: date }, ['_id', 'residentId', 'authEpoch', 'createdAt', 'expiresAt']),
  email_verifications: normalized({ authEpoch: whole, email: string, originalEmail: { bsonType: ['string', 'null'] }, createdAt: date, expiresAt: date }, ['_id', 'residentId', 'authEpoch', 'email', 'originalEmail', 'createdAt', 'expiresAt']),
  conversations: generic({ id: string, kind: { enum: ['dm', 'group', 'community'] }, seq: whole }, ['id', 'kind']),
  members: generic({ conversationId: string, residentId: string, joinSeq: whole, readSeq: whole, deliveredSeq: whole }, ['conversationId', 'residentId']),
  messages: { $jsonSchema: {
    bsonType: 'object', required: ['id', 'conversationId', 'senderId', 'text', 'seq', 'createdAt'],
    properties: { id: string, conversationId: string, senderId: string, text: { bsonType: 'string', minLength: 1, maxLength: 4000 }, seq: whole, createdAt: timestamp, kind: { enum: ['text', 'transfer'] }, transferId: string,
      transfer: { bsonType: 'object', required: ['id', 'from', 'to', 'amount', 'note', 'createdAt'], properties: { id: string, from: string, to: string, amount: { ...whole, minimum: 1 }, note: { bsonType: 'string', maxLength: 120 }, createdAt: timestamp, virtual: { enum: [true] }, currency: { enum: ['game-naira'] } } },
    },
    anyOf: [ { required: ['kind', 'transferId', 'transfer'], properties: { kind: { enum: ['transfer'] } } }, { properties: { kind: { enum: ['text'] } }, not: { anyOf: [{ required: ['transferId'] }, { required: ['transfer'] }] } } ]
  } },
  friendships: generic({ id: string, pair: string, sender: string, recipient: string, status: string }, ['id', 'pair', 'sender', 'recipient', 'status']),
  moderation: generic({ owner: string, target: string, kind: { enum: ['block', 'mute'] } }, ['owner', 'target', 'kind']),
  notifications: generic({ id: string, residentId: string, createdAt: timestamp, readAt: nullableTimestamp }, ['id', 'residentId', 'createdAt']),
  location_messages: generic({ id: string, zone: string, senderId: string, purgeAt: date }, ['id', 'zone', 'senderId']),
  social_posts: generic({ id: string, authorId: string, operationKey: string, purgeAt: date }, ['id', 'authorId', 'operationKey']),
  social_likes: generic({ postId: string, residentId: string }, ['postId', 'residentId']),
  social_comments: generic({ id: string, postId: string, authorId: string, operationKey: string }, ['id', 'postId', 'authorId', 'operationKey']),
  presence_sessions: generic({ residentId: string, expiresAt: date }, ['residentId', 'expiresAt']),
  reward_campaigns: generic({ id: string, title: string, description: string, rewardGameNaira: whole, enabled: { bsonType: 'bool' }, startAt: { bsonType: ['int','long','double','null'] }, endAt: { bsonType: ['int','long','double','null'] }, maxClaims: whole, shareText: string, shareUrl: string, createdAt: timestamp, updatedAt: timestamp }, ['_id','id','title','description','rewardGameNaira','enabled','maxClaims','shareText','shareUrl','createdAt','updatedAt']),
  reward_share_sessions: generic({ id: string, residentId: string, campaignId: string, rewardGameNaira: whole, shareText: string, shareUrl: string, expiresAt: date, status: { enum: ['started','completed'] }, createdAt: timestamp, completedAt: { bsonType: ['int','long','double','null'] } }, ['_id','id','residentId','campaignId','rewardGameNaira','shareText','shareUrl','expiresAt','status','createdAt']),
  reward_claims: generic({ id: string, residentId: string, campaignId: string, shareSessionId: string, rewardGameNaira: whole, createdAt: timestamp }, ['_id','id','residentId','campaignId','shareSessionId','rewardGameNaira','createdAt'])
  ,reward_activity_definitions: generic({ id: string, title: string, description: string, venueId: { bsonType: ['string','null'] }, rewardGameNaira: whole, durationMs: whole, cooldownMs: whole, enabled: { bsonType: 'bool' } }, ['_id','id','title','description','rewardGameNaira','durationMs','cooldownMs','enabled'])
  ,reward_activity_sessions: generic({ id: string, residentId: string, activityId: string, startedAt: timestamp, readyAt: timestamp, expiresAt: date, status: { enum: ['started','completed'] }, completedAt: { bsonType: ['int','long','double','null'] } }, ['_id','id','residentId','activityId','startedAt','readyAt','expiresAt','status'])
  ,reward_activity_claims: generic({ id: string, residentId: string, activityId: string, sessionId: string, rewardGameNaira: whole, createdAt: timestamp }, ['_id','id','residentId','activityId','sessionId','rewardGameNaira','createdAt'])
});

export const MONGO_INDEXES = Object.freeze({
  residents: [[{ id: 1 }, { unique: true }], [{ username: 1 }, { unique: true }], [{ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } }], [{ displayName: 1, _id: 1 }, {}]],
  ...Object.fromEntries(['appearances', 'needs', 'progression', 'player_state', 'homes', 'origins', 'wallets'].map(name => [name, [[{ residentId: 1 }, { unique: true }]]])),
  ledger: [[{ residentId: 1, sequence: 1 }, { unique: true }], [{ residentId: 1, createdAt: -1, _id: -1 }, {}], [{ residentId: 1, operationId: 1 }, { unique: true }], [{ operationId: 1 }, {}]],
  wallet_transfers: [[{ senderId: 1, operationKey: 1 }, { unique: true }], [{ senderId: 1, createdAt: -1, id: -1 }, {}], [{ recipientId: 1, createdAt: -1, id: -1 }, {}], [{ conversationId: 1, createdAt: -1, id: -1 }, {}]],
  messages: [[{ transferId: 1 }, { unique: true, partialFilterExpression: { transferId: { $type: 'string' } } }]],
  economy_operations: [[{ residentId: 1, operationKey: 1 }, { unique: true }], [{ residentId: 1, createdAt: -1 }, {}]],
  inventory: [[{ residentId: 1, itemId: 1 }, { unique: true }]],
  vehicles: [[{ residentId: 1, itemId: 1 }, { unique: true }]],
  properties: [[{ residentId: 1, propertyId: 1 }, { unique: true }]],
  loans: [[{ residentId: 1, borrowedAt: -1, _id: -1 }, {}]], gamble_rounds: [[{ residentId: 1, createdAt: -1, _id: -1 }, {}], [{ residentId: 1, sequence: -1, createdAt: -1, _id: -1 }, {}]],
  challenges: [[{ residentId: 1, workDate: 1, completedAt: 1 }, {}], [{ residentId: 1, completedAt: 1, cancelledAt: 1, startedAt: -1 }, {}]],
  sessions: [[{ residentId: 1, authEpoch: 1, createdAt: -1 }, {}], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
  password_resets: [[{ residentId: 1 }, {}], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
  email_verifications: [[{ residentId: 1 }, { unique: true }], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
  presence_sessions: [[{ residentId: 1, expiresAt: 1 }, {}], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
  reward_campaigns: [[{ id: 1 }, { unique: true }]],
  reward_share_sessions: [[{ residentId: 1, createdAt: -1 }, {}], [{ residentId: 1, campaignId: 1, status: 1 }, {}], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
  reward_claims: [[{ campaignId: 1, residentId: 1 }, { unique: true }], [{ campaignId: 1, shareSessionId: 1 }, { unique: true }], [{ residentId: 1, createdAt: -1 }, {}]]
  ,reward_activity_definitions: [[{ id: 1 }, { unique: true }]],
  reward_activity_sessions: [[{ residentId: 1, createdAt: -1 }, {}], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
  reward_activity_claims: [[{ residentId: 1, activityId: 1, createdAt: -1 }, {}], [{ residentId: 1, sessionId: 1 }, { unique: true }]]
});

export class MongoConfigurationError extends Error {
  constructor(message) { super(message); this.name = 'MongoConfigurationError'; this.code = 'mongo_configuration'; }
}

export function mongoConfiguration({ uri = process.env.MONGODB_URI || process.env.ABUJALIFE_MONGODB_URI, database = process.env.MONGODB_DATABASE || process.env.ABUJALIFE_DB_NAME, production = true } = {}) {
  if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\//i.test(uri)) throw new MongoConfigurationError('MONGODB_URI must contain a MongoDB connection URI');
  if (!database && !production) database = 'abujalife_dev';
  if (typeof database !== 'string' || !/^[A-Za-z0-9_-]{1,63}$/.test(database)) throw new MongoConfigurationError('MONGODB_DATABASE is required');
  if (production && database !== 'abujalife_prod') throw new MongoConfigurationError('Production MONGODB_DATABASE must be abujalife_prod');
  const remainder = uri.slice(uri.indexOf('://') + 3), queryAt = remainder.indexOf('?');
  const address = queryAt < 0 ? remainder : remainder.slice(0, queryAt), slashAt = address.indexOf('/');
  const authority = slashAt < 0 ? address : address.slice(0, slashAt), rawDatabase = slashAt < 0 ? '' : address.slice(slashAt + 1);
  let uriDatabase;
  try { uriDatabase = decodeURIComponent(rawDatabase); } catch { throw new MongoConfigurationError('The MongoDB URI database is invalid'); }
  if (uriDatabase && uriDatabase !== database) throw new MongoConfigurationError('The MongoDB URI must name the configured isolated database');
  const parameters = new URLSearchParams(queryAt < 0 ? '' : remainder.slice(queryAt + 1));
  const entries = [...parameters].map(([key, value]) => [key.toLowerCase(), value.toLowerCase()]);
  if (production && entries.some(([key, value]) => ['tlsinsecure', 'tlsallowinvalidcertificates', 'tlsallowinvalidhostnames'].includes(key) && value !== 'false')) {
    throw new MongoConfigurationError('Production MongoDB TLS verification must remain enabled');
  }
  const hosts = authority.slice(authority.lastIndexOf('@') + 1).split(',').map(host => host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0]).map(host => host.toLowerCase());
  const privateConnection = !uri.startsWith('mongodb+srv://') && hosts.every(host => host === 'mongo' || host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host));
  if (production && !privateConnection && entries.some(([key, value]) => ['tls', 'ssl'].includes(key) && value === 'false')) {
    throw new MongoConfigurationError('MongoDB connections outside the private container network require TLS');
  }
  return { uri, database, production, requireTls: production && !privateConnection };
}

/** Run with the database bootstrap/migration identity; application credentials have no DDL privileges. */
export async function ensureMongoSchema(db) {
  for (const name of MONGO_COLLECTIONS) {
    const validator = MONGO_VALIDATORS[name] || generic();
    try { await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' }); }
    catch (error) { if (error.code !== 48) throw error; }
    await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
  }
  for (const [name, definitions] of Object.entries(MONGO_INDEXES)) {
    for (const [key, options] of definitions) await db.collection(name).createIndex(key, options);
  }
  const social = await import('./socialStore.mjs');
  if (typeof social.ensureMongoSocialSchema !== 'function') throw new MongoConfigurationError('The MongoDB social schema migration is unavailable');
  await social.ensureMongoSocialSchema(db);
  const directory = await import('./directoryStore.mjs');
  await directory.ensureMongoDirectorySchema(db);
  const presence = await import('./presenceStore.mjs');
  await presence.ensureMongoPresenceSchema(db);
  const admin = await import('./adminStore.mjs');
  await admin.ensureMongoAdminSchema(db);
  const payments = await import('./paymentStore.mjs');
  await payments.ensureMongoPaymentSchema(db);
  const rewards = await import('./rewardStore.mjs');
  await rewards.ensureMongoRewardSchema(db);
  const civic = await import('./civicSchema.mjs');
  await civic.ensureMongoCivicSchema(db);
  await db.collection('schema_versions').updateOne({ _id: 'normalized-v1' }, { $set: { version: MONGO_SCHEMA_VERSION, collections: [...MONGO_COLLECTIONS], updatedAt: new Date() } }, { upsert: true });
  return { version: MONGO_SCHEMA_VERSION, collections: [...MONGO_COLLECTIONS] };
}

async function verifySchema(db) {
  const version = await db.collection('schema_versions').findOne({ _id: 'normalized-v1', version: MONGO_SCHEMA_VERSION });
  if (!version || !MONGO_COLLECTIONS.every(name => version.collections?.includes(name))) throw new MongoConfigurationError('MongoDB schema migration must run before application startup');
  const social = await import('./socialStore.mjs');
  const directory = await import('./directoryStore.mjs');
  const presence = await import('./presenceStore.mjs');
  const admin = await import('./adminStore.mjs');
  const payments = await import('./paymentStore.mjs');
  const rewards = await import('./rewardStore.mjs');
  const civic = await import('./civicSchema.mjs');
  const definitions = {};
  for (const group of [MONGO_INDEXES, social.MONGO_SOCIAL_INDEXES || {}, directory.MONGO_DIRECTORY_INDEXES || {}, presence.MONGO_PRESENCE_INDEXES || {}, admin.MONGO_ADMIN_INDEXES || {}, payments.MONGO_PAYMENT_INDEXES || {}, rewards.MONGO_REWARD_INDEXES || {}, civic.MONGO_CIVIC_INDEXES || {}]) {
    for (const [name, indexes] of Object.entries(group)) definitions[name] = [...(definitions[name] || []), ...indexes];
  }
  for (const [name, expected] of Object.entries(definitions)) {
    const actual = await db.collection(name).listIndexes().toArray();
    for (const [key, options] of expected) {
      const present = actual.some(index => JSON.stringify(index.key) === JSON.stringify(key)
        && (!options.unique || index.unique === true)
        && (options.expireAfterSeconds === undefined || Number(index.expireAfterSeconds) === options.expireAfterSeconds)
        && (!options.partialFilterExpression || JSON.stringify(index.partialFilterExpression) === JSON.stringify(options.partialFilterExpression)));
      if (!present) throw new MongoConfigurationError(`MongoDB required index is missing on ${name}`);
    }
  }
}

export async function connectMongo(options = {}) {
  const configuration = mongoConfiguration(options);
  if (configuration.production && options.initializeSchema) throw new MongoConfigurationError('Production schema migrations require the separate bootstrap identity');
  const client = new MongoClient(configuration.uri, {
    serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, socketTimeoutMS: 15000,
    maxPoolSize: 30, retryWrites: true, ...(configuration.requireTls ? { tls: true } : {})
  });
  try {
    await client.connect();
    const db = client.db(configuration.database);
    if (configuration.production) {
      const authenticated = await db.command({ connectionStatus: 1 });
      if (!authenticated.authInfo?.authenticatedUsers?.length) throw new MongoConfigurationError('Production MongoDB requires an authenticated dedicated application identity');
    }
    const hello = await db.command({ hello: 1, maxTimeMS: 5000 });
    if (!hello.setName || hello.maxWireVersion < 7) throw new MongoConfigurationError('MongoDB must run as a replica set with transaction support');
    if (options.initializeSchema) await ensureMongoSchema(db);
    await verifySchema(db);
    await client.withSession(async session => session.withTransaction(async () => {
      const probe = `readiness:${crypto.randomUUID()}`;
      await db.collection('schema_versions').insertOne({ _id: probe, kind: 'transaction-readiness', createdAt: new Date() }, { session });
      await db.collection('schema_versions').deleteOne({ _id: probe }, { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary', maxCommitTimeMS: 10000 }));
    let closed = false;
    return {
      client, db,
      async health() {
        if (closed) return { ok: false, code: 'database_closed' };
        try {
          await db.command({ ping: 1, maxTimeMS: 3000 });
          const live = await db.command({ hello: 1, maxTimeMS: 3000 });
          return { ok: Boolean(live.setName), database: configuration.database, replicaSet: live.setName, schemaVersion: MONGO_SCHEMA_VERSION };
        } catch { return { ok: false, code: 'database_unavailable' }; }
      },
      async close() { closed = true; await client.close(); }
    };
  } catch (error) {
    await client.close();
    if (error instanceof MongoConfigurationError) throw error;
    const unavailable = new Error('MongoDB connection, schema permissions, or transaction readiness check failed');
    unavailable.name = 'MongoUnavailableError'; unavailable.code = 'mongo_unavailable';
    throw unavailable;
  }
}

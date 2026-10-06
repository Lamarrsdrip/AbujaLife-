import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';
import { ensureMongoSchema, MONGO_COLLECTIONS, MONGO_APPEND_ONLY_COLLECTIONS } from '../../src/server/mongo/database.mjs';
import { ensureMongoAdSchema } from '../../src/server/mongo/adStore.mjs';
import { mongoCivicRuntimePrivileges, MONGO_CIVIC_COLLECTIONS } from '../../src/server/mongo/civicSchema.mjs';
import { configuration, mongoUri, secret } from './runtime.mjs';

const config = configuration();
const options = { serverSelectionTimeoutMS: 15000 };
const bootstrapUri = `mongodb://abujalife_bootstrap:${encodeURIComponent(secret(config, 'mongo-root-password'))}@${config.mongoHost}/admin?authSource=admin&directConnection=true`;
const OWNER_BOOTSTRAP = Object.freeze({
  username: 'emriz_abj',
  targetBalance: 1_000_000_000_000,
  markerId: 'owner-bootstrap-emriz-abj-v1',
  operationKey: 'owner-balance-emriz-abj-v1'
});

async function ensureOwnerBootstrap(db, client) {
  const session = client.startSession();
  let result = { applied: false, reason: 'already-applied' };
  try {
    await session.withTransaction(async () => {
      const markers = db.collection('schema_versions');
      if (await markers.findOne({ _id: OWNER_BOOTSTRAP.markerId }, { session })) return;

      const resident = await db.collection('residents').findOne({ username: OWNER_BOOTSTRAP.username }, { session });
      if (!resident) {
        result = { applied: false, reason: 'resident-not-found', username: OWNER_BOOTSTRAP.username };
        return;
      }

      const now = Date.now();
      const existingRole = await db.collection('admin_roles').findOne({ residentId: resident.id }, { session });
      if (existingRole?.role !== 'superadmin') {
        await db.collection('admin_roles').updateOne(
          { residentId: resident.id },
          {
            $set: { role: 'superadmin', assignedBy: 'server-console', createdAt: now },
            $setOnInsert: { _id: resident.id, residentId: resident.id }
          },
          { session, upsert: true }
        );
        const auditId = crypto.randomUUID();
        await db.collection('admin_audit').insertOne({
          _id: auditId,
          id: auditId,
          actorId: 'server-console',
          action: 'bootstrap-admin',
          targetId: resident.id,
          details: { before: existingRole?.role || null, after: 'superadmin', source: 'owner production bootstrap v1' },
          createdAt: now
        }, { session });
      }

      const wallet = await db.collection('wallets').findOne({ residentId: resident.id }, { session });
      if (!wallet || !Number.isSafeInteger(wallet.balance) || !Number.isSafeInteger(wallet.version)) {
        throw new Error('Owner bootstrap requires a complete persisted wallet.');
      }

      const before = wallet.balance;
      if (before !== OWNER_BOOTSTRAP.targetBalance) {
        const changed = await db.collection('wallets').updateOne(
          { residentId: resident.id, balance: before, version: wallet.version },
          { $set: { balance: OWNER_BOOTSTRAP.targetBalance }, $inc: { version: 1 } },
          { session }
        );
        if (changed.modifiedCount !== 1) throw new Error('Owner wallet changed during bootstrap; retry deployment.');

        const delta = OWNER_BOOTSTRAP.targetBalance - before;
        const ledgerId = crypto.randomUUID();
        await db.collection('ledger').insertOne({
          _id: ledgerId,
          id: ledgerId,
          residentId: resident.id,
          amount: delta,
          balanceAfter: OWNER_BOOTSTRAP.targetBalance,
          type: 'admin-adjustment',
          reason: 'Owner production balance bootstrap',
          createdAt: now,
          operationId: OWNER_BOOTSTRAP.operationKey,
          sequence: wallet.version + 1
        }, { session });

        await db.collection('economy_operations').insertOne({
          _id: `${resident.id}:${OWNER_BOOTSTRAP.operationKey}`,
          residentId: resident.id,
          operationKey: OWNER_BOOTSTRAP.operationKey,
          kind: 'owner-bootstrap-balance',
          fingerprint: JSON.stringify({ targetBalance: OWNER_BOOTSTRAP.targetBalance }),
          result: { targetBalance: OWNER_BOOTSTRAP.targetBalance, previousBalance: before },
          createdAt: now
        }, { session });

        const auditId = crypto.randomUUID();
        await db.collection('admin_audit').insertOne({
          _id: auditId,
          id: auditId,
          actorId: 'server-console',
          action: 'owner-bootstrap-balance',
          targetId: resident.id,
          details: { before, after: OWNER_BOOTSTRAP.targetBalance, delta, currency: 'game-naira', source: 'owner production bootstrap v1' },
          createdAt: now
        }, { session });
      }

      const stamp = new Date(now);
      await markers.insertOne({
        _id: OWNER_BOOTSTRAP.markerId,
        version: 1,
        createdAt: stamp,
        updatedAt: stamp,
        residentId: resident.id,
        username: OWNER_BOOTSTRAP.username
      }, { session });

      result = {
        applied: true,
        username: OWNER_BOOTSTRAP.username,
        role: 'superadmin',
        balance: OWNER_BOOTSTRAP.targetBalance,
        previousBalance: before
      };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
  } finally {
    await session.endSession();
  }
  return result;
}

let client = new MongoClient(bootstrapUri, options);
try {
  try { await client.connect(); }
  catch (error) {
    if (error.code !== 18) throw error;
    await client.close();
    client = new MongoClient(`mongodb://${config.mongoHost}/admin?directConnection=true`, options);
    await client.connect();
    // MongoDB's localhost exception permits only first-user provisioning.
    // Existing authenticated instances never fall back to a weaker config.
    const admin = client.db('admin');
    try { await admin.command({ replSetGetStatus: 1 }); }
    catch (state) {
      if (![94, 13].includes(state.code)) throw state;
      try { await admin.command({ replSetInitiate: { _id: config.replicaSet, members: [{ _id: 0, host: config.mongoHost }] } }); }
      catch (init) { if (init.code !== 23) throw init; }
    }
    let primary = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      const hello = await admin.command({ hello: 1 });
      if (hello.setName === config.replicaSet && hello.isWritablePrimary) { primary = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!primary) throw new Error('Dedicated replica set did not elect a primary.');
    await admin.command({ createUser: 'abujalife_bootstrap', pwd: secret(config, 'mongo-root-password'), roles: [{ role: 'root', db: 'admin' }] });
    await client.close();
    client = new MongoClient(bootstrapUri, options);
    await client.connect();
  }
  const admin = client.db('admin'), hello = await admin.command({ hello: 1 });
  if (hello.setName !== config.replicaSet || !hello.isWritablePrimary) throw new Error('Refusing to alter a different MongoDB instance.');
  const db = client.db(config.database);
  await ensureMongoSchema(db);
  await ensureMongoAdSchema(db);
  const ownerBootstrap = await ensureOwnerBootstrap(db, client);
  const privileges = MONGO_COLLECTIONS.map(collection => ({ resource: { db: config.database, collection }, actions: MONGO_APPEND_ONLY_COLLECTIONS.includes(collection) ? ['find', 'insert', 'listIndexes'] : collection === 'schema_versions' ? ['find', 'insert', 'remove', 'listIndexes'] : ['find', 'insert', 'update', 'remove', 'listIndexes'] }));
  privileges.push(
    { resource: { db: config.database, collection: 'ad_orders' }, actions: ['find', 'insert', 'update', 'remove', 'listIndexes'] },
    { resource: { db: config.database, collection: 'ad_slots' }, actions: ['find', 'insert', 'update', 'remove', 'listIndexes'] },
    { resource: { db: config.database, collection: 'ad_receipts' }, actions: ['find', 'insert', 'listIndexes'] },
  );
  privileges.push(...mongoCivicRuntimePrivileges(config.database));
  const existingRole = await db.command({ rolesInfo: 'abujalife_runtime' });
  await db.command({ [existingRole.roles.length ? 'updateRole' : 'createRole']: 'abujalife_runtime', privileges, roles: [] });
  // MongoDB's built-in backup role supports full replica-set oplog dumps. On
  // MongoDB 8, mongodump also inspects config.transactions while opening the
  // oplog window, so grant the backup principal read-only access to that
  // internal metadata database. It never grants application writes or access
  // to Okrika's database.
  for (const [user, password, roles] of [['abujalife_app', 'mongo-app-password', [{ role: 'abujalife_runtime', db: config.database }]], ['abujalife_backup', 'mongo-backup-password', [{ role: 'backup', db: 'admin' }, { role: 'read', db: 'config' }]]]) {
    const found = await db.command({ usersInfo: user });
    await db.command({ [found.users.length ? 'updateUser' : 'createUser']: user, pwd: secret(config, password), roles });
  }
  console.log(JSON.stringify({ ok: true, database: config.database, replicaSet: config.replicaSet, collections: MONGO_COLLECTIONS.length, civicCollections: MONGO_CIVIC_COLLECTIONS.length, ledger: 'find/insert only', civic: 'find/insert/update/remove/listIndexes', appDDL: false, ownerBootstrap }));
} finally { await client.close(); }

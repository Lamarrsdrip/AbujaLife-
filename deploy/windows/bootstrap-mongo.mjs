import { MongoClient } from 'mongodb';
import { ensureMongoSchema, MONGO_COLLECTIONS, MONGO_APPEND_ONLY_COLLECTIONS } from '../../src/server/mongo/database.mjs';
import { ensureMongoAdSchema } from '../../src/server/mongo/adStore.mjs';
import { configuration, mongoUri, secret } from './runtime.mjs';

const config = configuration();
const options = { serverSelectionTimeoutMS: 15000 };
const bootstrapUri = `mongodb://abujalife_bootstrap:${encodeURIComponent(secret(config, 'mongo-root-password'))}@${config.mongoHost}/admin?authSource=admin&directConnection=true`;
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
  const privileges = MONGO_COLLECTIONS.map(collection => ({ resource: { db: config.database, collection }, actions: MONGO_APPEND_ONLY_COLLECTIONS.includes(collection) ? ['find', 'insert', 'listIndexes'] : collection === 'schema_versions' ? ['find', 'insert', 'remove', 'listIndexes'] : ['find', 'insert', 'update', 'remove', 'listIndexes'] }));
  privileges.push(
    { resource: { db: config.database, collection: 'ad_orders' }, actions: ['find', 'insert', 'update', 'remove', 'listIndexes'] },
    { resource: { db: config.database, collection: 'ad_slots' }, actions: ['find', 'insert', 'update', 'remove', 'listIndexes'] },
    { resource: { db: config.database, collection: 'ad_receipts' }, actions: ['find', 'insert', 'listIndexes'] },
  );
  const existingRole = await db.command({ rolesInfo: 'abujalife_runtime' });
  await db.command({ [existingRole.roles.length ? 'updateRole' : 'createRole']: 'abujalife_runtime', privileges, roles: [] });
  const backupRole = await admin.command({ rolesInfo: 'abujalife_backup' });
  await admin.command({ [backupRole.roles.length ? 'updateRole' : 'createRole']: 'abujalife_backup', privileges: [{ resource: { db: config.database, collection: '' }, actions: ['find', 'listCollections', 'listIndexes', 'collStats', 'dbStats'] }, { resource: { cluster: true }, actions: ['fsync', 'unlock'] }], roles: [] });
  for (const [user, password, role, roleDb] of [['abujalife_app', 'mongo-app-password', 'abujalife_runtime', config.database], ['abujalife_backup', 'mongo-backup-password', 'abujalife_backup', 'admin']]) {
    const found = await db.command({ usersInfo: user });
    await db.command({ [found.users.length ? 'updateUser' : 'createUser']: user, pwd: secret(config, password), roles: [{ role, db: roleDb }] });
  }
  console.log(JSON.stringify({ ok: true, database: config.database, replicaSet: config.replicaSet, collections: MONGO_COLLECTIONS.length, ledger: 'find/insert only', appDDL: false }));
} finally { await client.close(); }

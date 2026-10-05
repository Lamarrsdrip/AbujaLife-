import { MongoClient } from 'mongodb';
import { ensureMongoJackpotSchema, JACKPOT_COLLECTIONS, JACKPOT_APPEND_ONLY_COLLECTIONS } from '../../src/server/mongo/jackpotSchema.mjs';
import { configuration, secret } from './runtime.mjs';

const config = configuration();
const uri = `mongodb://abujalife_bootstrap:${encodeURIComponent(secret(config, 'mongo-root-password'))}@${config.mongoHost}/admin?authSource=admin&directConnection=true`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

try {
  await client.connect();
  const admin = client.db('admin');
  const hello = await admin.command({ hello: 1 });
  if (hello.setName !== config.replicaSet || !hello.isWritablePrimary) {
    throw new Error('Refusing to alter a different MongoDB instance.');
  }

  const db = client.db(config.database);
  await ensureMongoJackpotSchema(db);

  const roleInfo = await db.command({ rolesInfo: 'abujalife_runtime', showPrivileges: true });
  const role = roleInfo.roles?.[0];
  if (!role) throw new Error('AbujaLife runtime role must exist before Jackpot bootstrap.');

  const jackpotPrivileges = JACKPOT_COLLECTIONS.map(collection => ({
    resource: { db: config.database, collection },
    actions: JACKPOT_APPEND_ONLY_COLLECTIONS.includes(collection)
      ? ['find', 'insert', 'listIndexes']
      : ['find', 'insert', 'update', 'remove', 'listIndexes']
  }));

  const existing = Array.isArray(role.privileges) ? role.privileges : [];
  const byResource = new Map();
  for (const privilege of [...existing, ...jackpotPrivileges]) {
    const key = JSON.stringify(privilege.resource);
    const current = byResource.get(key) || { resource: privilege.resource, actions: [] };
    current.actions = [...new Set([...current.actions, ...(privilege.actions || [])])].sort();
    byResource.set(key, current);
  }

  await db.command({
    updateRole: 'abujalife_runtime',
    privileges: [...byResource.values()],
    roles: role.roles || []
  });

  console.log(JSON.stringify({
    ok: true,
    database: config.database,
    jackpotCollections: JACKPOT_COLLECTIONS.length,
    jackpotLedger: 'find/insert only',
    appDDL: false
  }));
} finally {
  await client.close();
}

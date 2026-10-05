import { MongoClient } from 'mongodb';
import { configuration, mongoUri, secret } from './runtime.mjs';

const config = configuration();
const uri = mongoUri(config, 'abujalife_bootstrap', 'mongo-root-password', 'admin');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

try {
  await client.connect();
  const admin = client.db('admin');
  const hello = await admin.command({ hello: 1 });
  if (hello.setName !== config.replicaSet || !hello.isWritablePrimary) {
    throw new Error('Refusing backup-role maintenance on a different MongoDB instance.');
  }
  const user = await admin.command({ usersInfo: 'abujalife_backup' });
  if (user.users?.length !== 1) throw new Error('The dedicated AbujaLife backup user is missing.');
  // mongodump --oplog on MongoDB 8 reads config.transactions while opening
  // the oplog window. Keep the backup account least-privileged and grant only
  // read access to that internal metadata database before taking a snapshot.
  await admin.command({
    updateUser: 'abujalife_backup',
    pwd: secret(config, 'mongo-backup-password'),
    roles: [{ role: 'backup', db: 'admin' }, { role: 'read', db: 'config' }]
  });
  console.log(JSON.stringify({ ok: true, database: config.database, backupAccess: 'backup plus config read' }));
} finally {
  await client.close();
}

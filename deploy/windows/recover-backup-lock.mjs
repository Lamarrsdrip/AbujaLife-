import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { configuration, mongoUri, acquireLock, lockOwnerRunning } from './runtime.mjs';

const config = configuration(), file = path.join(config.shared, 'mongo-operations.lock');
if (!fs.existsSync(file)) process.exit(0);
const recorded = JSON.parse(fs.readFileSync(file, 'utf8'));
if (recorded.purpose !== 'backup') process.exit(0);
if (lockOwnerRunning(recorded)) process.exit(0);
const lock = acquireLock(file, 'backup-lock-recovery');
let client;
try {
  client = new MongoClient(mongoUri(config, 'abujalife_bootstrap', 'mongo-root-password', 'admin'), { serverSelectionTimeoutMS: 15000 }); await client.connect();
  const admin = client.db('admin'), hello = await admin.command({ hello: 1 });
  if (hello.setName !== config.replicaSet || !hello.isWritablePrimary) throw new Error('Refusing lock recovery on a different MongoDB instance.');
  const state = await admin.command({ currentOp: 1 });
  if (state.fsyncLock) await admin.command({ fsyncUnlock: 1 });
  console.log(JSON.stringify({ ok: true, event: 'stale_backup_lock_recovered', database: config.database, unlocked: state.fsyncLock === true }));
} finally { if (client) await client.close(); fs.closeSync(lock.descriptor); fs.rmSync(file, { force: true }); }

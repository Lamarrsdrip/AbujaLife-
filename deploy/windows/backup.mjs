import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MongoClient } from 'mongodb';
import { temporaryDirectory, toolConfiguration, runTool, encryptArchive, decryptArchive } from '../mongo-ops.mjs';
import { configuration, mongoUri, writeJson, acquireLock } from './runtime.mjs';

const config = configuration();
process.env.ABUJALIFE_SECRETS_DIR = config.secrets;
const lockFile = path.join(config.shared, 'mongo-operations.lock');
const { descriptor: lock, recovered, previous } = acquireLock(lockFile, 'backup');
const working = temporaryDirectory();
const stamp = new Date().toISOString().replace(/[:.]/g, '-'), destination = path.join(config.backups, `abujalife-${stamp}.abjl.enc`), partial = destination + '.partial';
let client, locked = false;
try {
  if (recovered) {
    const recovery = new MongoClient(mongoUri(config, 'abujalife_bootstrap', 'mongo-root-password', 'admin'), { serverSelectionTimeoutMS: 15000 });
    try {
      await recovery.connect();
      const hello = await recovery.db('admin').command({ hello: 1 });
      if (hello.setName !== config.replicaSet || !hello.isWritablePrimary) throw new Error('Refusing backup-lock recovery on a different instance.');
      const status = await recovery.db('admin').command({ currentOp: 1 });
      if (status.fsyncLock) {
        if (previous?.purpose !== 'backup') throw new Error('An operator must inspect the unexpected write lock before continuing.');
        await recovery.db('admin').command({ fsyncUnlock: 1 });
      }
    } finally { await recovery.close(); }
  }
  const backupUri = mongoUri(config, 'abujalife_backup', 'mongo-backup-password');
  client = new MongoClient(backupUri, { serverSelectionTimeoutMS: 15000 }); await client.connect();
  const hello = await client.db('admin').command({ hello: 1 });
  if (hello.setName !== config.replicaSet || !hello.isWritablePrimary) throw new Error('Refusing to back up a different MongoDB instance.');
  // Only the isolated AbujaLife instance is write-locked briefly for consistency.
  await client.db('admin').command({ fsync: 1, lock: true }); locked = true;
  const raw = path.join(working, 'database.archive.gz');
  await runTool(path.join(config.mongoToolsDirectory, 'mongodump.exe'), ['--config', toolConfiguration(working, backupUri), '--db', config.database, '--archive=' + raw, '--gzip']);
  await client.db('admin').command({ fsyncUnlock: 1 }); locked = false;
  await encryptArchive(raw, partial);
  const verifiedRaw = path.join(working, 'authenticated.archive.gz');
  await decryptArchive(partial, verifiedRaw);
  const verifyConfig = toolConfiguration(working, mongoUri(config, 'abujalife_bootstrap', 'mongo-root-password', 'admin'));
  await runTool(path.join(config.mongoToolsDirectory, 'mongorestore.exe'), ['--config', verifyConfig, '--archive=' + verifiedRaw, '--gzip', '--nsInclude=' + config.database + '.*', '--dryRun', '--stopOnError']);
  fs.renameSync(partial, destination);
  let offServer = 'awaiting-secure-pull';
  if (config.offServerTarget) {
    if (!/^[A-Za-z0-9_.-]+@[A-Za-z0-9.-]+:\/[A-Za-z0-9_./-]+$/.test(config.offServerTarget) || /@(?:173\.212\.249\.202|127\.0\.0\.1|localhost):/.test(config.offServerTarget)) throw new Error('Off-server target must be a separate SSH backup host.');
    if (!config.offServerKeyFile || !fs.existsSync(config.offServerKeyFile) || !config.offServerKnownHostsFile || !fs.existsSync(config.offServerKnownHostsFile)) throw new Error('Off-server upload requires a private backup-host SSH key and verified known-hosts file.');
    execFileSync('scp.exe', ['-B', '-i', config.offServerKeyFile, '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=' + config.offServerKnownHostsFile, '-o', 'ConnectTimeout=15', destination, config.offServerTarget], { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true });
    offServer = 'uploaded';
  }
  const retention = config.backupRetentionDays;
  if (!Number.isSafeInteger(retention) || retention < 1) throw new Error('Backup retention must be a positive integer.');
  for (const name of fs.readdirSync(config.backups)) if (/^abujalife-.*\.abjl\.enc$/.test(name)) {
    const file = path.join(config.backups, name);
    if (file !== destination && fs.statSync(file).mtimeMs < Date.now() - retention * 86400000) fs.rmSync(file);
  }
  // Rotate only this instance's Mongo log; the supervisor prunes rotated logs.
  const admin = new MongoClient(mongoUri(config, 'abujalife_bootstrap', 'mongo-root-password', 'admin'), { serverSelectionTimeoutMS: 15000 });
  try { await admin.connect(); await admin.db('admin').command({ logRotate: 1 }); } finally { await admin.close(); }
  const digest = crypto.createHash('sha256');
  for await (const part of fs.createReadStream(destination)) digest.update(part);
  const receipt = { ok: true, database: config.database, backup: destination, bytes: fs.statSync(destination).size, sha256: digest.digest('hex'), consistent: true, encryption: 'AES-256-GCM', validation: 'authenticated decryption and mongorestore --dryRun', offServer, retentionDays: retention, completedAt: new Date().toISOString() };
  writeJson(path.join(config.backups, 'latest-backup.json'), receipt);
  console.log(JSON.stringify(receipt));
} finally {
  if (locked && client) {
    try { await client.db('admin').command({ fsyncUnlock: 1 }); }
    catch { console.error('The isolated AbujaLife database remains write-locked; check fsyncUnlock before resuming gameplay.'); }
  }
  if (client) await client.close();
  fs.rmSync(partial, { force: true }); fs.rmSync(working, { recursive: true, force: true });
  fs.closeSync(lock); fs.rmSync(lockFile, { force: true });
}

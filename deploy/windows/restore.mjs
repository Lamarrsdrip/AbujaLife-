import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MongoClient } from 'mongodb';
import { temporaryDirectory, toolConfiguration, runTool, decryptArchive } from '../mongo-ops.mjs';
import { configuration, mongoUri, health, acquireLock } from './runtime.mjs';

const config = configuration(), [filename, confirm, database] = process.argv.slice(2);
if (!filename || path.basename(filename) !== filename || !/^abujalife-.*\.abjl\.enc$/.test(filename) || confirm !== '--confirm' || database !== config.database) throw new Error('Usage: node deploy/windows/restore.mjs FILE.abjl.enc --confirm abujalife_prod. Disable and stop only the AbujaLife API task first.');
const disabled = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "(Get-ScheduledTask -TaskName 'AbujaLife-API').State.ToString()"], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
if (disabled !== 'Disabled' || await health(config.apiPort)) throw new Error('Disable the AbujaLife-API task and stop its supervisor gracefully before replacing game data.');
process.env.ABUJALIFE_SECRETS_DIR = config.secrets;
const deployLockFile = path.join(config.shared, 'deployment.lock'), mongoLockFile = path.join(config.shared, 'mongo-operations.lock');
const deployLock = acquireLock(deployLockFile, 'restore');
let mongoLock, client, directory;
try {
  mongoLock = acquireLock(mongoLockFile, 'restore');
  directory = temporaryDirectory();
  const raw = path.join(directory, 'database.archive.gz');
  // Authentication of all encrypted bytes completes before any database write.
  await decryptArchive(path.join(config.backups, filename), raw);
  const restoreUri = mongoUri(config, 'abujalife_bootstrap', 'mongo-root-password', 'admin');
  client = new MongoClient(restoreUri, { serverSelectionTimeoutMS: 15000 }); await client.connect();
  const hello = await client.db('admin').command({ hello: 1 });
  if (hello.setName !== config.replicaSet || !hello.isWritablePrimary) throw new Error('Refusing to restore a different MongoDB instance.');
  const current = await client.db('admin').command({ currentOp: 1 });
  if (current.fsyncLock) {
    if (!mongoLock.recovered || mongoLock.previous?.purpose !== 'backup') throw new Error('An operator must inspect the unexpected MongoDB write lock.');
    await client.db('admin').command({ fsyncUnlock: 1 });
  }
  const args = ['--config', toolConfiguration(directory, restoreUri), '--archive=' + raw, '--gzip', '--nsInclude=' + config.database + '.*', '--stopOnError'];
  await runTool(path.join(config.mongoToolsDirectory, 'mongorestore.exe'), [...args, '--dryRun']);
  await client.db(config.database).dropDatabase();
  await runTool(path.join(config.mongoToolsDirectory, 'mongorestore.exe'), args);
  console.log(JSON.stringify({ ok: true, database: config.database, restored: filename, verifiedEncryption: true, next: 'Run bootstrap-mongo.mjs, enable and start AbujaLife-API, verify /health.' }));
} finally {
  if (client) await client.close();
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  if (mongoLock) { fs.closeSync(mongoLock.descriptor); fs.rmSync(mongoLockFile, { force: true }); }
  fs.closeSync(deployLock.descriptor); fs.rmSync(deployLockFile, { force: true });
}

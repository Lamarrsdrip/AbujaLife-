import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { writeJson } from './runtime.mjs';

if (process.platform !== 'win32') throw new Error('Initialize only on the production Windows server.');
const [root, nodePath, mongodPath, tools, publicWebUrl, apiPublicUrl] = process.argv.slice(2);
if (!root || !nodePath || !mongodPath || !tools || !publicWebUrl || !apiPublicUrl) throw new Error('Supply root, Node, mongod, tools, and actual public origins.');
const shared = path.join(root, 'shared'), secrets = path.join(shared, '.secrets');
for (const dir of [shared, secrets, path.join(shared, 'state'), path.join(shared, 'run'), path.join(shared, 'logs'), path.join(shared, 'backups'), path.join(shared, 'runtime'), path.join(shared, 'mongo'), path.join(shared, 'mongo', 'data'), path.join(root, 'releases')]) fs.mkdirSync(dir, { recursive: true });
function create(name, value) {
  try { fs.writeFileSync(path.join(secrets, name), value + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
for (const name of ['mongo-root-password', 'mongo-app-password', 'mongo-backup-password']) create(name, crypto.randomBytes(48).toString('base64url'));
create('mongo-keyfile', crypto.randomBytes(756).toString('base64'));
create('config-key', crypto.randomBytes(32).toString('hex'));
create('backup-key', crypto.randomBytes(32).toString('hex'));
const configFile = path.join(shared, 'windows.json');
if (!fs.existsSync(configFile)) writeJson(configFile, { database: 'abujalife_prod', replicaSet: 'abujalife', mongoHost: '127.0.0.1:27017', apiPort: 18787, mongoService: 'AbujaLifeMongoDB', apiTask: 'AbujaLife-API', backupTask: 'AbujaLife-Backup', nodePath, mongodPath, mongoToolsDirectory: tools, publicWebUrl, apiPublicUrl, corsOrigins: [publicWebUrl, ...(new URL(publicWebUrl).hostname.startsWith('www.') ? [] : [new URL(publicWebUrl).protocol + '//www.' + new URL(publicWebUrl).hostname])], backupRetentionDays: 14, logRetentionDays: 14, offServerTarget: '', offServerKeyFile: '' });
const file = value => JSON.stringify(value.replaceAll('\\', '/'));
const mongoConfig = `storage:\n  dbPath: ${file(path.join(shared, 'mongo', 'data'))}\n  wiredTiger:\n    engineConfig:\n      cacheSizeGB: 0.5\nsystemLog:\n  destination: file\n  path: ${file(path.join(shared, 'logs', 'mongo.log'))}\n  logAppend: true\n  logRotate: rename\nnet:\n  bindIp: 127.0.0.1\n  port: 27017\nsecurity:\n  authorization: enabled\n  keyFile: ${file(path.join(secrets, 'mongo-keyfile'))}\nreplication:\n  replSetName: abujalife\n`;
const mongoFile = path.join(shared, 'mongo', 'mongod.yml');
if (!fs.existsSync(mongoFile)) fs.writeFileSync(mongoFile, mongoConfig, { flag: 'wx', mode: 0o600 });
if (!fs.existsSync(path.join(shared, 'providers.json'))) writeJson(path.join(shared, 'providers.json'), {});
for (const name of ['runtime.mjs', 'supervisor.mjs']) fs.copyFileSync(new URL(name, import.meta.url), path.join(shared, 'runtime', name));
console.log(JSON.stringify({ ok: true, secretValuesPrinted: false, existingSecretsPreserved: true, config: configFile, mongoConfig: mongoFile }));

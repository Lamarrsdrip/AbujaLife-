#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory = path.resolve(process.argv[2] || path.dirname(fileURLToPath(import.meta.url)));
const privateDirectory = path.join(directory, '.secrets');
fs.mkdirSync(privateDirectory, {recursive: true, mode: 0o700});
fs.chmodSync(privateDirectory, 0o700);
function create(name, value) {
  const file = path.join(privateDirectory, name);
  try { fs.writeFileSync(file, value + '\n', {flag: 'wx', mode: 0o600}); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  return fs.readFileSync(file, 'utf8').trim();
}
create('mongo-root-password', crypto.randomBytes(48).toString('base64url'));
const appPassword = create('mongo-app-password', crypto.randomBytes(48).toString('base64url'));
create('mongo-backup-password', crypto.randomBytes(48).toString('base64url'));
create('mongo-keyfile', crypto.randomBytes(756).toString('base64'));
create('mongo-app-uri', `mongodb://abujalife_app:${encodeURIComponent(appPassword)}@mongo:27017/abujalife_prod?replicaSet=abujalife&authSource=abujalife_prod`);
create('config-key', crypto.randomBytes(32).toString('hex'));
create('backup-key', crypto.randomBytes(32).toString('hex'));
try { fs.writeFileSync(path.join(directory,'.env'), `ABUJALIFE_SECRETS_DIR=${privateDirectory}\nABUJALIFE_BACKUP_DIR=${path.join(directory,'backups')}\nABUJALIFE_API_LOOPBACK_PORT=18787\nBACKUP_RETENTION_DAYS=14\nBACKUP_OFFSERVER_TARGET=\nBACKUP_OFFSERVER_KEY_FILE=\n`, {flag: 'wx', mode: 0o600}); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
fs.mkdirSync(path.join(directory, 'backups'), {recursive: true, mode: 0o700});
console.log(`Private deployment files prepared in ${directory}. Existing secrets were preserved; no values were printed.`);

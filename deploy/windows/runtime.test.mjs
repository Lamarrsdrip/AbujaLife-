import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { configuration, apiEnvironment, safeEnvironment, acquireLock, currentRelease, writeJson } from './runtime.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-windows-runtime-'));
  const shared = path.join(root, 'shared');
  for (const name of ['.secrets', 'state', 'run', 'logs', 'backups']) fs.mkdirSync(path.join(shared, name), { recursive: true });
  const values = { database: 'abujalife_prod', replicaSet: 'abujalife', mongoHost: '127.0.0.1:27017', apiPort: 18787, mongoService: 'AbujaLifeMongoDB', apiTask: 'AbujaLife-API', nodePath: process.execPath, mongodPath: process.execPath, mongoToolsDirectory: path.dirname(process.execPath), publicWebUrl: 'https://abujacity.life', apiPublicUrl: 'https://api.abujacity.life', corsOrigins: ['https://abujacity.life'], backupRetentionDays: 14, logRetentionDays: 14 };
  writeJson(path.join(shared, 'windows.json'), values);
  fs.writeFileSync(path.join(shared, '.secrets', 'mongo-app-password'), 'fixture-app-password');
  fs.writeFileSync(path.join(shared, '.secrets', 'config-key'), 'a'.repeat(64));
  return { root, shared, values, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('Windows production runtime rejects every unrelated Mongo/port/service target', () => {
  const data = fixture();
  try {
    for (const [key, value] of [['database', 'okrika_prod'], ['replicaSet', 'rs0'], ['mongoHost', '127.0.0.1:27018'], ['apiPort', 5001], ['mongoService', 'MongoDB'], ['apiTask', 'Okrika-API']]) {
      writeJson(path.join(data.shared, 'windows.json'), { ...data.values, [key]: value });
      assert.throws(() => configuration(data.root), /dedicated AbujaLife/);
    }
  } finally { data.cleanup(); }
});

test('API receives only its own secret files and approved provider keys', () => {
  const data = fixture(), previous = process.env.OKRIKA_WHITE_AI_KEY;
  process.env.OKRIKA_WHITE_AI_KEY = 'unrelated-machine-secret';
  try {
    writeJson(path.join(data.shared, 'providers.json'), { RESEND_API_KEY: 'provider-fixture', EMAIL_FROM: 'AbujaLife <hello@abujacity.life>', X_CLIENT_ID: 'x-client-fixture', X_CLIENT_SECRET: 'x-secret-fixture', X_REDIRECT_URI: 'https://api.abujacity.life/api/x/callback', X_TOKEN_ENCRYPTION_KEY: 'x-encryption-fixture', MONGODB_ROOT_PASSWORD: 'must-not-propagate' });
    const config = configuration(data.root), env = apiEnvironment(config);
    assert.equal(env.OKRIKA_WHITE_AI_KEY, undefined);
    assert.equal(env.MONGODB_ROOT_PASSWORD, undefined);
    assert.equal(env.RESEND_API_KEY, 'provider-fixture');
    assert.equal(env.X_CLIENT_ID, 'x-client-fixture');
    assert.equal(env.X_CLIENT_SECRET, 'x-secret-fixture');
    assert.equal(env.X_REDIRECT_URI, 'https://api.abujacity.life/api/x/callback');
    assert.equal(env.X_TOKEN_ENCRYPTION_KEY, 'x-encryption-fixture');
    assert.equal(safeEnvironment().X_CLIENT_SECRET, undefined);
    assert.equal(env.HOST, '127.0.0.1');
    assert.match(env.MONGODB_URI, /abujalife_app:fixture-app-password@127\.0\.0\.1:27017\/abujalife_prod/);
    assert.equal(safeEnvironment().OKRIKA_WHITE_AI_KEY, undefined);
  } finally { if (previous === undefined) delete process.env.OKRIKA_WHITE_AI_KEY; else process.env.OKRIKA_WHITE_AI_KEY = previous; data.cleanup(); }
});

test('production chat media is pinned to persistent shared storage and never a release .local directory', () => {
  const data = fixture();
  try {
    const config = configuration(data.root), env = apiEnvironment(config);
    const expected = path.join(data.shared, 'media', 'chat');
    assert.equal(config.chatMedia, expected);
    assert.equal(env.CHAT_MEDIA_DIR, expected);
    assert.equal(path.relative(config.shared, env.CHAT_MEDIA_DIR).startsWith('..'), false);
    assert.equal(path.relative(config.releases, env.CHAT_MEDIA_DIR).startsWith('..'), true);
    assert.equal(env.CHAT_MEDIA_DIR.includes(`${path.sep}.local${path.sep}`), false);
  } finally { data.cleanup(); }
});

test('Operation locks reject a live owner and reclaim an exited worker', () => {
  const data = fixture(), file = path.join(data.shared, 'operations.lock');
  try {
    const first = acquireLock(file, 'backup');
    assert.throws(() => acquireLock(file, 'restore'), /Another operation/);
    fs.closeSync(first.descriptor); fs.rmSync(file);
    const ended = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    writeJson(file, { pid: ended.pid, purpose: 'backup', startedAt: new Date().toISOString() });
    const recovered = acquireLock(file, 'restore');
    assert.equal(recovered.recovered, true); assert.equal(recovered.previous.purpose, 'backup');
    fs.closeSync(recovered.descriptor);
  } finally { data.cleanup(); }
});

test('Release pointers cannot select arbitrary executable paths', () => {
  const data = fixture();
  try {
    const config = configuration(data.root);
    writeJson(path.join(config.state, 'current.json'), { releaseId: '..\\okrika', revision: 'b'.repeat(40) });
    assert.throws(() => currentRelease(config), /Invalid deployed/);
    const releaseId = 'a'.repeat(12) + '-' + 'b'.repeat(12), directory = path.join(config.releases, releaseId);
    fs.mkdirSync(path.join(directory, 'deploy', 'windows'), { recursive: true }); fs.writeFileSync(path.join(directory, 'deploy', 'windows', 'api.mjs'), '// fixture');
    writeJson(path.join(config.state, 'current.json'), { releaseId, revision: 'c'.repeat(40) });
    assert.equal(currentRelease(config).directory, directory);
  } finally { data.cleanup(); }
});

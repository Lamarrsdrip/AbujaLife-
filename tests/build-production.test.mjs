import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { buildProduction, publicConfiguration, publicOrigin } from '../scripts/build-production.mjs';
import { apiURL, apiFetch, createApiEventSource } from '../app/api-client.js';

test('production config emits exactly the two public HTTPS origins', () => {
  assert.deepEqual(publicConfiguration({ MONGODB_URI: 'SECRET_DATABASE_SENTINEL', ADMIN_PASSWORD: 'SECRET_ADMIN_SENTINEL' }), {
    API_PUBLIC_URL: 'https://api.abujacity.life', PUBLIC_WEB_URL: 'https://abujacity.life',
  });
  assert.equal(publicOrigin('https://api.abujacity.life/', 'API_PUBLIC_URL'), 'https://api.abujacity.life');
  for (const value of ['http://api.abujacity.life', 'https://localhost', 'https://localhost.example.test', 'https://127.0.0.1', 'https://10.2.3.4', 'https://[::1]', 'https://api.internal', 'https://api.abujacity.life:8443', 'https://user:password@api.abujacity.life', 'https://api.abujacity.life/api', 'https://api.abujacity.life?key=x', 'https://api.abujacity.life#key', 'mongodb://database/game']) {
    assert.throws(() => publicOrigin(value, 'API_PUBLIC_URL'), /public HTTPS origin/, value);
  }
});

test('API client uses credentialed production HTTP and SSE while source preview stays same-origin', async () => {
  const original = { config: globalThis.ABUJA_PUBLIC_CONFIG, fetch: globalThis.fetch, EventSource: globalThis.EventSource };
  try {
    delete globalThis.ABUJA_PUBLIC_CONFIG;
    assert.equal(apiURL('/api/bootstrap'), '/api/bootstrap');
    globalThis.ABUJA_PUBLIC_CONFIG = { API_PUBLIC_URL: 'https://api.abujacity.life' };
    assert.equal(apiURL('/api/residents?search=A%20B'), 'https://api.abujacity.life/api/residents?search=A%20B');
    for (const value of ['https://another.site/api/bootstrap', '/admin', '/api/../admin', '/api/\\admin']) assert.throws(() => apiURL(value));
    let request;
    globalThis.fetch = async (url, options) => { request = { url, options }; return { ok: true }; };
    await apiFetch('/api/action', { method: 'POST', credentials: 'omit', cache: 'force-cache' });
    assert.equal(request.url, 'https://api.abujacity.life/api/action');
    assert.equal(request.options.credentials, 'include');
    assert.equal(request.options.cache, 'no-store');
    globalThis.EventSource = class { constructor(url, options) { this.url = url; this.options = options; } };
    const stream = createApiEventSource('/api/realtime', { withCredentials: false });
    assert.equal(stream.url, 'https://api.abujacity.life/api/realtime');
    assert.equal(stream.options.withCredentials, true);
    globalThis.ABUJA_PUBLIC_CONFIG = { API_PUBLIC_URL: 'http://api.abujacity.life' };
    assert.throws(() => apiURL('/api/bootstrap'), /HTTPS origin/);
  } finally {
    if (original.config === undefined) delete globalThis.ABUJA_PUBLIC_CONFIG;
    else globalThis.ABUJA_PUBLIC_CONFIG = original.config;
    globalThis.fetch = original.fetch;
    globalThis.EventSource = original.EventSource;
  }
});

test('Hostinger build contains connected bundles and public assets, and worker bypasses private requests', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'abujalife-production-test-'));
  try {
    const target = path.join(directory, 'dist');
    const result = await buildProduction({ outputDirectory: target, environment: { MONGODB_URI: 'SECRET_DATABASE_SENTINEL', ADMIN_PASSWORD: 'SECRET_ADMIN_SENTINEL' } });
    for (const name of ['.htaccess', 'index.html', 'app.js', 'admin.js', 'game-ui-kit.js', 'game-ui-kit.css', 'game-status-hud.css', 'admin/index.html', 'runtime-config.js', 'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-maskable-512.png', 'map.css', 'licenses/three.txt']) assert.ok(result.files.includes(name), name);
    for (const name of result.files) assert.doesNotMatch(name, /(?:^|\/)(?:src|server|preview|node_modules|\.env)(?:\/|$)|\.(?:sqlite|db|map)$/);
    const scripts = (await Promise.all(result.files.filter(name => /\.(?:js|html|webmanifest)$/.test(name)).map(name => fs.readFile(path.join(target, name), 'utf8')))).join('\n');
    assert.equal(/localhost|127\.0\.0\.1|SECRET_DATABASE_SENTINEL|SECRET_ADMIN_SENTINEL|mongodb(?:\+srv)?:\/\/|node:sqlite|abujalife:reset-preview/.test(scripts), false, 'The production build contains a forbidden development, secret, database or preview string.');
    const index = await fs.readFile(path.join(target, 'index.html'), 'utf8');
    assert.ok(index.indexOf('src="/runtime-config.js"') < index.indexOf('src="/app.js"'));
    assert.match(index, /href="\/game-ui-kit\.css"/);
    assert.match(index, /href="\/game-status-hud\.css"/);
    assert.match(index, /src="\/game-ui-kit\.js"/);
    const runtime = {};
    vm.runInNewContext(await fs.readFile(path.join(target, 'runtime-config.js'), 'utf8'), runtime);
    assert.deepEqual(Object.keys(runtime.ABUJA_PUBLIC_CONFIG).sort(), ['API_PUBLIC_URL', 'PUBLIC_WEB_URL']);
    assert.equal(runtime.ABUJA_PUBLIC_CONFIG.API_PUBLIC_URL, 'https://api.abujacity.life');
    const manifest = JSON.parse(await fs.readFile(path.join(target, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.scope, '/'); assert.equal(manifest.id, '/');
    const handlers = {};
    let cacheAdds;
    const self = { location: { origin: 'https://abujacity.life' }, addEventListener: (name, callback) => { handlers[name] = callback; }, clients: { claim: async () => {} } };
    vm.runInNewContext(await fs.readFile(path.join(target, 'sw.js'), 'utf8'), { URL, self, caches: { open: async () => ({ addAll: async files => { cacheAdds = files; } }) } });
    let installed;
    handlers.install({ waitUntil(promise) { installed = promise; } });
    await installed;
    assert.ok(cacheAdds.includes('/app.js'));
    assert.ok(cacheAdds.includes('/game-ui-kit.js'));
    assert.ok(cacheAdds.includes('/game-ui-kit.css'));
    assert.ok(cacheAdds.includes('/game-status-hud.css'));
    for (const cached of cacheAdds) {
      assert.doesNotMatch(cached, /^\/(?:\.|api\/|admin|runtime-config\.js)/);
      await fs.access(path.join(target, cached));
    }
    for (const [method, url] of [['GET', 'https://api.abujacity.life/api/bootstrap'], ['GET', 'https://abujacity.life/api/bootstrap'], ['GET', 'https://abujacity.life/api/admin/status'], ['GET', 'https://abujacity.life/admin/'], ['POST', 'https://abujacity.life/app.js'], ['GET', 'https://abujacity.life/runtime-config.js'], ['GET', 'https://abujacity.life/unlisted-private-photo.png']]) {
      let intercepted = false;
      handlers.fetch({ request: { method, url }, respondWith() { intercepted = true; } });
      assert.equal(intercepted, false, `${method} ${url}`);
    }
    const firstWorker = await fs.readFile(path.join(target, 'sw.js'), 'utf8');
    await buildProduction({ outputDirectory: target, environment: { API_PUBLIC_URL: 'https://api.other-public.com' } });
    assert.notEqual(await fs.readFile(path.join(target, 'sw.js'), 'utf8'), firstWorker, 'Changing public config invalidates the static shell cache');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

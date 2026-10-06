import test from 'node:test';
import assert from 'node:assert/strict';

async function freshClient(name) {
  return import(`../app/api-client.js?core-refresh-fast=${encodeURIComponent(name)}-${Date.now()}-${Math.random()}`);
}

async function withFetch(mock, run) {
  const originalFetch = globalThis.fetch;
  const originalConfig = globalThis.ABUJA_PUBLIC_CONFIG;
  globalThis.fetch = mock;
  delete globalThis.ABUJA_PUBLIC_CONFIG;
  try { return await run(); }
  finally {
    globalThis.fetch = originalFetch;
    if (originalConfig === undefined) delete globalThis.ABUJA_PUBLIC_CONFIG;
    else globalThis.ABUJA_PUBLIC_CONFIG = originalConfig;
  }
}

test('every startup=1 core refresh remains on the dedicated city entry contract', async () => {
  const calls = [];
  await withFetch(async url => {
    calls.push(String(url));
    if (String(url) === '/api/bootstrap') throw new Error('core refresh must never hit full bootstrap');
    if (String(url) === '/api/bootstrap/fast') throw new Error('core refresh must never depend on optional fast bootstrap');
    if (String(url) !== '/api/entry') throw new Error(`Unexpected request ${url}`);
    return new Response(JSON.stringify({ authenticated: true, startup: true, entry: true, profile: { id: 'resident-a' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }, async () => {
    const { apiFetch } = await freshClient('repeat-core');
    for (let i = 0; i < 4; i++) {
      const response = await apiFetch('/api/bootstrap?startup=1');
      assert.equal(response.status, 200);
      const body=await response.json();
      assert.equal(body.startup, true);
      assert.equal(body.entry, true);
    }
  });
  assert.deepEqual(calls, ['/api/entry','/api/entry','/api/entry','/api/entry']);
});

test('staggered deploy prefers entry and falls back only to authoritative compact bootstrap', async () => {
  const calls = [];
  await withFetch(async url => {
    calls.push(String(url));
    if (String(url) === '/api/bootstrap/fast') throw new Error('optional fast listener must not gate startup');
    if (String(url) === '/api/entry') {
      return new Response(JSON.stringify({ ok:false, code:'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url) === '/api/bootstrap?startup=1') {
      return new Response(JSON.stringify({ authenticated: false, startup: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected request ${url}`);
  }, async () => {
    const { apiFetch } = await freshClient('staggered-core');
    const response = await apiFetch('/api/bootstrap?startup=1');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { authenticated: false, startup: true });
  });
  assert.deepEqual(calls, ['/api/entry','/api/bootstrap?startup=1']);
});

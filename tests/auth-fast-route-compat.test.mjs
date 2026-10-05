import test from 'node:test';
import assert from 'node:assert/strict';

async function freshClient(name) {
  return import(`../app/api-client.js?auth-fast-route-compat=${encodeURIComponent(name)}-${Date.now()}-${Math.random()}`);
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

test('staggered deploy auth guard falls back instead of trapping anonymous users on Reconnect', async () => {
  const calls = [];
  await withFetch(async url => {
    calls.push(String(url));
    if (String(url) === '/api/bootstrap/fast') {
      return new Response(JSON.stringify({ ok: false, error: 'Sign in to your resident account', code: 'authentication_required' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url) === '/api/bootstrap') {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected request ${url}`);
  }, async () => {
    const { apiFetch } = await freshClient('bootstrap');
    const response = await apiFetch('/api/bootstrap');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { authenticated: false });
  });
  assert.deepEqual(calls, ['/api/bootstrap/fast', '/api/bootstrap']);
});

test('genuine invalid login stays a single 401 and never doubles password work', async () => {
  const calls = [];
  await withFetch(async url => {
    calls.push(String(url));
    return new Response(JSON.stringify({ ok: false, error: 'Username or password is incorrect', code: 'invalid_credentials' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }, async () => {
    const { apiFetch } = await freshClient('login');
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'resident', password: 'not-the-password' }),
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'invalid_credentials');
  });
  assert.deepEqual(calls, ['/api/auth/login/fast']);
});

test('Start Playing arms a fast bootstrap instead of blocking on the heavyweight city bootstrap', async () => {
  const calls = [];
  await withFetch(async (url, init = {}) => {
    calls.push([String(url), String(init.method || 'GET').toUpperCase()]);
    if (String(url) === '/api/bootstrap/fast') {
      return new Response(JSON.stringify({ authenticated: true, fastBootstrap: true, profile: { id: 'resident-1', onboardingComplete: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url) === '/api/profile') {
      return new Response(JSON.stringify({ ok: true, profile: { id: 'resident-1', onboardingComplete: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url) === '/api/bootstrap') {
      throw new Error('heavy bootstrap must not gate Start Playing');
    }
    throw new Error(`Unexpected request ${url}`);
  }, async () => {
    const { apiFetch } = await freshClient('start-playing');
    const initial = await apiFetch('/api/bootstrap');
    assert.equal(initial.status, 200);
    const profile = await apiFetch('/api/profile', {
      method: 'POST',
      body: JSON.stringify({ onboardingComplete: true }),
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(profile.status, 200);
    const afterProfile = await apiFetch('/api/bootstrap');
    assert.equal(afterProfile.status, 200);
    assert.equal((await afterProfile.json()).fastBootstrap, true);
  });
  assert.deepEqual(calls, [
    ['/api/bootstrap/fast', 'GET'],
    ['/api/profile', 'POST'],
    ['/api/bootstrap/fast', 'GET'],
  ]);
});

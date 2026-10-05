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

test('explicit core startup and account writes retain authoritative bootstrap and full hydration', async () => {
  const calls=[];
  await withFetch(async url=>{
    calls.push(String(url));
    return new Response(JSON.stringify({authenticated:true,profile:{id:'resident-a'}}),{status:200});
  },async()=>{
    const {apiFetch}=await freshClient('core');
    await apiFetch('/api/bootstrap?startup=1');
    for(const path of ['/api/auth/register','/api/auth/login','/api/profile']){
      await apiFetch(path,{method:'POST',body:JSON.stringify({startup:true})});
    }
    await apiFetch('/api/bootstrap');
  });
  assert.deepEqual(calls,['/api/bootstrap/fast','/api/auth/register/fast','/api/auth/login/fast','/api/profile','/api/bootstrap']);
});

test('authoritative startup owns its transport deadline instead of inheriting the shell abort', async () => {
  const shell = new AbortController();
  shell.abort(new DOMException('shell timeout','TimeoutError'));
  let observed;
  await withFetch(async (url,init={})=>{
    observed={url:String(url),signal:init.signal};
    return new Response(JSON.stringify({authenticated:false,fastBootstrap:true}),{status:200});
  },async()=>{
    const {apiFetch}=await freshClient('startup-deadline');
    const response=await apiFetch('/api/bootstrap?startup=1',{signal:shell.signal});
    assert.equal(response.status,200);
  });
  assert.equal(observed.url,'/api/bootstrap/fast');
  assert.notEqual(observed.signal,shell.signal);
  assert.equal(observed.signal.aborted,false);
});

test('unreachable bootstrap never presents cached authentication or a fake successful response', async () => {
  const original=globalThis.sessionStorage;
  let reads=0,removed=0;
  globalThis.sessionStorage={getItem(){reads++;return JSON.stringify({authenticated:true,profile:{id:'stale-user',wallet:1000000}});},removeItem(){removed++;}};
  try{
    await withFetch(async()=>{throw new TypeError('Network unavailable');},async()=>{
      const {apiFetch}=await freshClient('network-loss');
      await assert.rejects(apiFetch('/api/bootstrap'),TypeError);
    });
    assert.equal(reads,0);assert.equal(removed,1);
  }finally{if(original===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=original;}
});

test('concurrent core reads share network work and return independently readable responses', async () => {
  let calls=0,release;
  const gate=new Promise(resolve=>{release=resolve;});
  await withFetch(async()=>{calls++;await gate;return new Response(JSON.stringify({authenticated:false}),{status:200});},async()=>{
    const {apiFetch}=await freshClient('coalesced-core');
    const a=apiFetch('/api/bootstrap?startup=1',{headers:{}}),b=apiFetch('/api/bootstrap?startup=1',{headers:{}});
    assert.equal(calls,1);release();
    const responses=await Promise.all([a,b]);
    assert.deepEqual(await responses[0].json(),{authenticated:false});
    assert.deepEqual(await responses[1].json(),{authenticated:false});
    await apiFetch('/api/bootstrap?startup=1');assert.equal(calls,2);
  });
});

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

test('staggered deploy preserves lightweight startup query when fast route is missing', async () => {
  const calls=[];
  await withFetch(async url=>{
    calls.push(String(url));
    if(String(url)==='/api/bootstrap/fast')return new Response(JSON.stringify({ok:false,error:'Sign in to your resident account',code:'authentication_required'}),{status:401,headers:{'content-type':'application/json'}});
    if(String(url)==='/api/bootstrap?startup=1')return new Response(JSON.stringify({authenticated:false,startup:true}),{status:200,headers:{'content-type':'application/json'}});
    throw new Error(`Unexpected request ${url}`);
  },async()=>{
    const {apiFetch}=await freshClient('startup-fallback');
    const response=await apiFetch('/api/bootstrap?startup=1');
    assert.equal(response.status,200);
    assert.equal((await response.json()).startup,true);
  });
  assert.deepEqual(calls,['/api/bootstrap/fast','/api/bootstrap?startup=1']);
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

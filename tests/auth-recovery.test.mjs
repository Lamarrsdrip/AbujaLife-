import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeAuthLink, createAuthRecovery, loginCredentials } from '../app/auth-recovery.js';

const token = 'a7'.repeat(32);

test('email callback tokens are removed from history before any asynchronous work', () => {
  for (const kind of ['verify-email', 'reset-password']) {
    const calls = [], location = { pathname: '/', search: '?source=email', hash: `#${kind}=${token}` };
    const history = { state: { view: 'world' }, replaceState(...args) { calls.push(args); location.hash = ''; } };
    const link = consumeAuthLink(location, history);
    assert.deepEqual(link, { kind, token });
    assert.equal(location.hash, '');
    assert.deepEqual(calls, [[{ view: 'world' }, '', '/?source=email']]);
    assert.ok(!JSON.stringify(calls).includes(token));
  }
});

test('malformed email links are cleared and never submitted while game routes stay intact', async () => {
  for (const hash of ['#reset-password=short', `#verify-email=${token}&redirect=https://other.example`, '#reset-password=%00']) {
    let replaced = false, contacted = false;
    const link = consumeAuthLink({ hash, pathname: '/', search: '' }, { replaceState() { replaced = true; } });
    assert.equal(replaced, true);
    assert.equal(link.invalid, true);
    const recovery = createAuthRecovery({ link, api() { contacted = true; } });
    await assert.rejects(link.kind === 'verify-email' ? recovery.verify() : recovery.reset('new-password'), /new email link/);
    assert.equal(contacted, false);
  }
  let replaced = false;
  assert.equal(consumeAuthLink({ hash: '#profile', pathname: '/', search: '' }, { replaceState() { replaced = true; } }), null);
  assert.equal(replaced, false);
});

test('verification failures can be retried without exposing or storing the token in snapshots', async () => {
  const calls = [];
  const recovery = createAuthRecovery({ link: { kind: 'verify-email', token }, api: async (path, options) => {
    calls.push({ path, options });
    if (calls.length === 1) throw new Error('Connection interrupted.');
    return { ok: true };
  } });
  assert.ok(!JSON.stringify(recovery.snapshot()).includes(token));
  await assert.rejects(recovery.verify(), /interrupted/);
  assert.equal(recovery.snapshot().status, 'error');
  await recovery.verify();
  assert.equal(recovery.snapshot().status, 'complete');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], { path: '/api/auth/email/verify', options: { method: 'POST', body: { token } } });
  await assert.rejects(recovery.verify(), /new email link/);
  assert.equal(calls.length, 2, 'completed callbacks cannot submit the token again');
});

test('password reset cannot overlap requests and dismissing recovery removes its ability to fulfill', async () => {
  let resolve, calls = 0;
  const recovery = createAuthRecovery({ link: { kind: 'reset-password', token }, api: (path, options) => {
    calls++;
    assert.equal(path, '/api/auth/password/reset/complete');
    assert.deepEqual(options.body, { token, password: 'my-new-password' });
    return new Promise(done => { resolve = done; });
  } });
  const first = recovery.reset('my-new-password');
  await assert.rejects(recovery.reset('another-password'), /already in progress/);
  assert.equal(calls, 1);
  assert.equal(recovery.snapshot().status, 'working');
  resolve({ ok: true }); await first;
  recovery.dismiss();
  assert.deepEqual(recovery.snapshot(), { kind: null, status: 'idle', error: '' });
  await assert.rejects(recovery.reset('another-password'), /new email link/);
  assert.equal(calls, 1);
});

test('login sends email and username identities without changing the password', () => {
  assert.deepEqual(loginCredentials('  zara_abuja  ', ' space matters '), { username: 'zara_abuja', password: ' space matters ' });
  assert.deepEqual(loginCredentials('  zara@example.com  ', 'my-password'), { email: 'zara@example.com', password: 'my-password' });
});

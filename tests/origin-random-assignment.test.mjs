import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server/http.mjs';
import { ORIGIN_META } from '../src/shared/origins.mjs';

const APPEARANCE = { presentation: 'neutral' };

test('a starting life is dealt by the server and a client cannot pick one', async t => {
  assert.equal(ORIGIN_META.random, true); assert.equal(ORIGIN_META.selectable, false);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-origin-'));
  let deal = 1; // 0 = nepo, 1 = lapo
  const server = createServer({ dataDir, originRandomInt: (min, max) => (min === 0 && max === 2 ? deal : 0) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeRealtime?.(); server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const register = async (username, extra) => {
    const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, displayName: 'Origin QA', password: 'Origin QA fixture 2026!', appearance: APPEARANCE, ...extra }) });
    const cookie = (response.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(response.ok, await response.clone().text());
    return (await (await fetch(`${base}/api/bootstrap`, { headers: { cookie } })).json()).profile;
  };
  const asked = await register('origin_asks_nepo', { originId: 'nepo' });
  assert.equal(asked.origin.id, 'lapo', 'the requested origin must be ignored');
  assert.equal(asked.wallet, ORIGIN_META.options.find(row => row.id === 'lapo').startingBalance);
  deal = 0;
  const dealt = await register('origin_dealt_nepo', { originId: 'lapo' });
  assert.equal(dealt.origin.id, 'nepo');
  assert.equal(dealt.wallet, ORIGIN_META.options.find(row => row.id === 'nepo').startingBalance);
  const invalid = await register('origin_bogus', { originId: 'billionaire' });
  assert.ok(['nepo', 'lapo'].includes(invalid.origin.id));
});

test('the signup form offers no starting-life picker', () => {
  const app = fs.readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
  assert.ok(!app.includes('name="originId"') && !app.includes('originId'), 'signup must not collect or send an origin');
});

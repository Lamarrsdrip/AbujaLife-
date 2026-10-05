import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore } from '../src/server/gameStore.mjs';
import { AdminStore } from '../src/server/adminStore.mjs';
import { RewardStore } from '../src/server/rewardStore.mjs';

function fixture(t) {
  let now = 1_000_000_000;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-rewards-'));
  const store = new GameStore({ dataDir, clock: () => now });
  t.after(() => { store.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  return { store, clock: () => now, advance(ms) { now += ms; } };
}

test('native share reward is server-session based, atomic and idempotent', async t => {
  const f = fixture(t), account = await f.store.register({ username: 'share_reward', password: 'password123' });
  const rewards = new RewardStore({ store: f.store, admin: new AdminStore({ store: f.store, bootstrapUsername: 'share_reward' }), clock: f.clock });
  const before = f.store.profile(account.residentId).wallet;
  const started = await rewards.start(account.residentId, { campaignId: 'share-abuja-life' });
  assert.ok(started.shareSessionId);
  const settled = await rewards.complete(account.residentId, { shareSessionId: started.shareSessionId });
  assert.equal(settled.rewardGameNaira, 100000);
  const replay = await rewards.complete(account.residentId, { shareSessionId: started.shareSessionId });
  assert.equal(replay.replayed, true);
  assert.equal(f.store.profile(account.residentId).wallet, before + 100000);
  assert.equal(f.store.transactions(account.residentId).filter(row => row.reason.startsWith('SOCIAL_SHARE_REWARD')).length, 1);
  assert.equal((await rewards.start(account.residentId, { campaignId: 'share-abuja-life' })).claimed, true);
});

test('activity reward requires the authored venue and a completed server-time session', async t => {
  const f = fixture(t), account = await f.store.register({ username: 'activity_reward', password: 'password123' });
  const rewards = new RewardStore({ store: f.store, clock: f.clock });
  await assert.rejects(() => rewards.startActivity(account.residentId, { activityId: 'gym-workout' }), error => error.code === 'activity_location_required');
  const profile = f.store.profile(account.residentId); profile.location = { kind: 'venue', district: profile.district, venue: 'gym' }; f.store.transaction(() => f.store.save(profile));
  const started = await rewards.startActivity(account.residentId, { activityId: 'gym-workout' });
  await assert.rejects(() => rewards.completeActivity(account.residentId, { activitySessionId: started.activitySessionId }), error => error.code === 'activity_not_complete');
  f.advance(5 * 60 * 1000);
  const settled = await rewards.completeActivity(account.residentId, { activitySessionId: started.activitySessionId });
  assert.equal(settled.rewardGameNaira, 5000);
  assert.equal((await rewards.completeActivity(account.residentId, { activitySessionId: started.activitySessionId })).replayed, true);
});

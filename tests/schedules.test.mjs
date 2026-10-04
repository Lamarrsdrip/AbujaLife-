import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore, jobs } from '../src/server/gameStore.mjs';
import { VENUES, NIGHTCLUB_IDS, actionsForVenue } from '../src/shared/life.mjs';
import { ABUJA_ATLAS } from '../src/shared/atlas.mjs';

const rejects = (fn, code) => assert.throws(fn, error => error.code === code);
async function fixture(t, time = '2026-10-05T09:00:00Z') {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-schedule-'));
  let now = Date.parse(time), store = new GameStore({ dataDir, clock: () => now, originRandomInt: (min, max) => max === 2 ? 1 : 0 });
  t.after(() => { store.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const id = (await store.register({ username: 'working_resident', password: 'a-test-password' })).residentId;
  return { id, get store() { return store; }, get now() { return now; }, at(time) { now = Date.parse(time); }, advance(ms) { now += ms; },
    reopen() { store.close(); store = new GameStore({ dataDir, clock: () => now }); },
    workplace(jobId) { store.action(id, 'take-job', { jobId }); const p = store.profile(id); if (p.location.kind === 'home') store.action(id, 'leave-home'); const { trip } = store.action(id, 'travel', { district: jobs[jobId].district, mode: 'bus' }); now += trip.seconds * 1000; store.action(id, 'arrive', { tripId: trip.id }); },
    complete() { const { challenge } = store.action(id, 'start-shift'); now += 2000; const answers = jobs[challenge.jobId].tasks.map(task => ({ taskId: task.id, optionId: task.answer })); return store.action(id, 'complete-shift', { challengeId: challenge.id, answers }); },
  };
}

test('bank work respects real Abuja weekdays and the client cannot supply a different clock', async t => {
  const f = await fixture(t, '2026-10-03T09:00:00Z'); f.workplace('bank-teller');
  rejects(() => f.store.action(f.id, 'start-shift', { now: Date.parse('2026-10-05T09:00:00Z'), dateKey: '2026-10-05' }), 'workplace_closed');
  f.at('2026-10-05T06:59:59Z'); rejects(() => f.store.action(f.id, 'start-shift'), 'workplace_closed');
  f.at('2026-10-05T07:00:00Z'); const { challenge } = f.store.action(f.id, 'start-shift');
  assert.equal(challenge.slotId, 'morning'); assert.equal(challenge.dateKey, '2026-10-05'); assert.equal(challenge.expiresAt, Date.parse('2026-10-05T11:00:00Z'));
  assert.equal(f.store.publicJobs()['bank-teller'].schedule.timeZone, 'Africa/Lagos');
  assert.equal(f.store.bootstrap(f.id).workSchedule.openingHours, 'Mon–Fri · 08:00–17:00');
});

test('two slots per real day persist across restarts and job switching cannot replay a completed slot', async t => {
  const f = await fixture(t); f.workplace('bank-teller'); const first = f.complete();
  assert.equal(first.result.pay, 7800); assert.equal(first.workSchedule.completedToday, 1); assert.equal(first.workSchedule.remainingToday, 1);
  const answers = jobs['bank-teller'].tasks.map(task => ({ taskId: task.id, optionId: task.answer }));
  const replay = f.store.action(f.id, 'complete-shift', { challengeId: first.result.challengeId, answers }); assert.equal(replay.profile.wallet, first.profile.wallet);
  f.advance(20000); rejects(() => f.store.action(f.id, 'start-shift'), 'shift_slot_completed');
  f.workplace('junior-dev'); rejects(() => f.store.action(f.id, 'start-shift'), 'shift_slot_completed');
  const forged = f.store.profile(f.id); forged.workDays = {}; f.store.save(forged); rejects(() => f.store.action(f.id, 'start-shift'), 'shift_slot_completed');
  f.at('2026-10-05T11:00:00Z'); const second = f.complete(); assert.equal(second.result.slotId, 'afternoon'); assert.equal(second.workSchedule.completedToday, 2);
  f.advance(20000); rejects(() => f.store.action(f.id, 'start-shift'), 'daily_shift_limit');
  f.reopen(); rejects(() => f.store.action(f.id, 'start-shift'), 'daily_shift_limit'); assert.equal(f.store.bootstrap(f.id).workSchedule.completedToday, 2);
  f.at('2026-10-06T07:00:00Z'); assert.equal(f.store.workSchedule(f.id).remainingToday, 2); assert.equal(f.store.action(f.id, 'start-shift').challenge.slotId, 'morning');
});

test('expired work cannot be redeemed the following day and a fresh slot does not retain stale active work', async t => {
  const f = await fixture(t); f.workplace('bank-teller'); const { challenge } = f.store.action(f.id, 'start-shift'), wallet = f.store.profile(f.id).wallet;
  f.at('2026-10-06T07:00:00Z');
  const answers = jobs['bank-teller'].tasks.map(task => ({ taskId: task.id, optionId: task.answer }));
  rejects(() => f.store.action(f.id, 'complete-shift', { challengeId: challenge.id, answers }), 'shift_expired'); assert.equal(f.store.profile(f.id).wallet, wallet);
  assert.equal(f.store.activeChallenge(f.id), null); const fresh = f.store.action(f.id, 'start-shift').challenge;
  assert.notEqual(fresh.id, challenge.id); assert.equal(fresh.dateKey, '2026-10-06'); assert.ok(f.store.get('SELECT cancelled_at FROM challenges WHERE id=?', challenge.id).cancelled_at);
});

test('restaurant weekend shifts run within restaurant hours while club payment is restricted to its nights', async t => {
  const f = await fixture(t, '2026-10-04T09:00:00Z'); f.workplace('restaurant-host'); assert.equal(f.complete().result.slotId, 'morning');
  f.store.action(f.id, 'enter-venue', { venueId: 'club' }); const wallet = f.store.profile(f.id).wallet;
  rejects(() => f.store.action(f.id, 'venue-action', { activityId: 'club-dance', now: Date.parse('2026-10-09T20:00:00Z') }), 'venue_closed'); assert.equal(f.store.profile(f.id).wallet, wallet);
  f.at('2026-10-09T19:00:00Z'); assert.equal(f.store.action(f.id, 'venue-action', { activityId: 'club-dance' }).activity.venueId, 'club');
  f.at('2026-10-10T01:00:00Z'); rejects(() => f.store.action(f.id, 'venue-action', { activityId: 'club-dance' }), 'venue_closed');
});

test('upgrading an old database cancels unfinished work that has no real-calendar reservation', async t => {
  const f = await fixture(t); f.workplace('bank-teller');
  f.store.run('INSERT INTO challenges(id,resident_id,job_id,started_at) VALUES(?,?,?,?)', 'legacy-challenge', f.id, 'bank-teller', f.now - 3000);
  f.reopen(); assert.equal(f.store.activeChallenge(f.id), null);
  const answers = jobs['bank-teller'].tasks.map(task => ({ taskId: task.id, optionId: task.answer }));
  rejects(() => f.store.action(f.id, 'complete-shift', { challengeId: 'legacy-challenge', answers }), 'shift_expired');
  assert.equal(f.store.action(f.id, 'start-shift').challenge.slotId, 'morning');
});

test('the four player-named clubs have distinct game settings and retain Tokyo compatibility', () => {
  assert.deepEqual(NIGHTCLUB_IDS, ['club', 'club-cage', 'magic-city', 'bear-barn']);
  assert.deepEqual(NIGHTCLUB_IDS.map(id => VENUES.find(venue => venue.id === id).name), ['Tokyo', 'Cage', 'Magic City', 'Bear Barn']);
  const styles = new Set();
  for (const id of NIGHTCLUB_IDS) {
    const venue = VENUES.find(venue => venue.id === id); styles.add(venue.style);
    assert.equal(venue.fictional, true); assert.equal(venue.pricesVerified, false); assert.equal(venue.settingSource, 'authored-game-scenery');
    assert.equal(venue.nameSource, 'player-provided'); assert.equal(venue.category, 'Nightlife');
    assert.ok(!venue.address && !venue.latitude && !venue.longitude);
    for (const district of venue.districts || []) assert.ok(ABUJA_ATLAS.some(place => place.id === district));
    assert.ok(actionsForVenue(id).length >= 2);
  }
  assert.equal(styles.size, 4);
  assert.ok(actionsForVenue('club').some(action => action.id === 'club-dance'));
  assert.ok(actionsForVenue('club').some(action => action.id === 'club-refreshment'));
});

for (const venueId of ['club', 'club-cage', 'magic-city', 'bear-barn']) {
  test(`${venueId} allows daytime entry and charges exact server prices for every club-night activity`, async t => {
    const f = await fixture(t, '2026-10-09T12:00:00Z'), venue = VENUES.find(venue => venue.id === venueId), actions = actionsForVenue(venueId);
    f.store.action(f.id, 'leave-home');
    if (venue.districts) {
      const { trip } = f.store.action(f.id, 'travel', { district: venue.districts[0], mode: 'bus' });
      f.advance(trip.seconds * 1000); f.store.action(f.id, 'arrive', { tripId: trip.id });
    }
    const entered = f.store.action(f.id, 'enter-venue', { venueId });
    assert.equal(entered.profile.location.venue, venueId); assert.equal(entered.venue.name, venue.name);
    assert.equal(f.store.zone(f.id), `venue:${entered.profile.district}:${venueId}`);
    const dayWallet = entered.profile.wallet;
    for (const action of actions) rejects(() => f.store.action(f.id, 'venue-action', { activityId: action.id, now: Date.parse('2026-10-09T19:00:00Z') }), 'venue_closed');
    assert.equal(f.store.profile(f.id).wallet, dayWallet);
    f.at('2026-10-09T19:00:00Z'); f.store.action(f.id, 'exit-venue'); f.store.action(f.id, 'enter-venue', { venueId });
    for (const action of actions) {
      const before = f.store.profile(f.id), result = f.store.action(f.id, 'venue-action', { activityId: action.id, cost: -999999, effects: { wallet: 9e9, fun: 999 } });
      assert.equal(result.profile.wallet, before.wallet - action.cost); assert.equal(result.activity.venueId, venueId);
      for (const [need, effect] of Object.entries(action.effects)) assert.equal(result.profile[need], Math.max(0, Math.min(100, Math.round(before[need] + effect))));
    }
    assert.equal(f.store.transactions(f.id).filter(row => row.reason === 'venue-action').length, actions.length);
    const wallet = f.store.profile(f.id).wallet;
    f.at('2026-10-10T01:00:00Z'); rejects(() => f.store.action(f.id, 'venue-action', { activityId: actions[0].id }), 'venue_closed');
    assert.equal(f.store.profile(f.id).wallet, wallet);
    f.at('2026-10-10T19:00:00Z'); assert.equal(f.store.action(f.id, 'venue-action', { activityId: actions[0].id }).profile.wallet, wallet - actions[0].cost);
    f.at('2026-10-12T19:00:00Z'); rejects(() => f.store.action(f.id, 'venue-action', { activityId: actions[0].id }), 'venue_closed');
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { GameStore } from '../src/server/gameStore.mjs';
import { HUSTLE_RULES, HUSTLE_MISSIONS, HUSTLE_TIERS, REP_LEVELS, repLevel, missionsForDay, ensureHustleDay, hustleEvent, recordHustleProgress, hustleView, applyHustleAction, HustleError } from '../src/shared/daily-hustle.mjs';
import { GIG_RULES } from '../src/shared/street-gigs.mjs';
import { JOB_PAY } from '../src/shared/economy.mjs';

const key = () => crypto.randomUUID(), DAY = 86_400_000, T0 = Date.parse('2026-10-06T10:00:00+01:00');
const code = (fn, expected) => assert.throws(fn, error => { assert.equal(error.code, expected, error.message); return true; });

test('Rep levels, mission pool and rewards are coherent and bounded', () => {
  assert.equal(repLevel(0).title, 'JJC'); assert.equal(repLevel(249).level, 2); assert.equal(repLevel(250).title, 'Correct Person'); assert.equal(repLevel(-5).xp, 0);
  assert.equal(repLevel(99).next.remaining, 1); assert.equal(repLevel(10 ** 7).next, null); assert.equal(repLevel(10 ** 7).level, REP_LEVELS.at(-1).level);
  for (let i = 1; i < REP_LEVELS.length; i++) assert.ok(REP_LEVELS[i].xp > REP_LEVELS[i - 1].xp);
  assert.equal(new Set(HUSTLE_MISSIONS.map(m => m.id)).size, HUSTLE_MISSIONS.length);
  for (const tier of HUSTLE_TIERS) assert.ok(HUSTLE_MISSIONS.filter(m => m.tier === tier).length >= 3, `${tier} has enough variety to swap`);
  const best = tier => Math.max(...HUSTLE_MISSIONS.filter(m => m.tier === tier).map(m => m.naira));
  const dailyMax = HUSTLE_TIERS.reduce((sum, tier) => sum + best(tier), 0) + HUSTLE_RULES.bonus.naira + Math.max(...HUSTLE_RULES.streak.map(day => day.naira));
  assert.ok(dailyMax <= Math.max(...Object.values(JOB_PAY)) * 1.2, `a perfect day pays ₦${dailyMax}, about one good shift`);
  assert.equal(HUSTLE_RULES.streak.length, 7); assert.ok(HUSTLE_RULES.streak[6].naira > HUSTLE_RULES.streak[0].naira);
});

test('each resident gets one mission per tier, stable for the day and different across days', () => {
  const today = missionsForDay('resident-a', '2026-10-06');
  assert.deepEqual(today, missionsForDay('resident-a', '2026-10-06'));
  assert.deepEqual(today.map(id => HUSTLE_MISSIONS.find(m => m.id === id).tier), HUSTLE_TIERS);
  const variety = new Set(); for (let day = 1; day <= 28; day++) variety.add(missionsForDay('resident-a', `2026-10-${String(day).padStart(2, '0')}`).join());
  assert.ok(variety.size >= 8, 'the list changes from day to day');
  const profile = { id: 'resident-a', wallet: 0 }, first = ensureHustleDay(profile, T0);
  assert.equal(ensureHustleDay(profile, T0 + 3600000), first, 'the same day is not regenerated');
  first.missions[0].progress = 1; assert.equal(ensureHustleDay(profile, T0 + DAY).missions[0].progress, 0, 'a new day starts clean');
});

test('only real completed actions move missions, and never past their goal', () => {
  assert.deepEqual(hustleEvent('gig-complete', {}, { payout: { kind: 'ride' } }), { type: 'gig', kind: 'ride' });
  assert.equal(hustleEvent('gig-complete', {}, {}), null, 'a gig action without a payout is not a completed gig');
  assert.equal(hustleEvent('gig-accept', {}, {}), null); assert.equal(hustleEvent('purchase', { itemId: 'x' }, {}), null); assert.equal(hustleEvent('hustle-claim', {}, {}), null);
  assert.deepEqual(hustleEvent('travel', { district: 'jabi' }, {}), { type: 'travel', district: 'jabi' });
  const profile = { id: 'p', wallet: 0, location: { venue: 'club' } };
  profile.hustle = { dateKey: '2026-10-06', missions: [{ id: 'eat-out', progress: 0, claimed: false }, { id: 'night-out', progress: 0, claimed: false }, { id: 'gigs-3', progress: 0, claimed: false }], bonusClaimed: false, swaps: 0, streak: 0, checkedIn: null };
  const fire = (kind, payload, extra) => recordHustleProgress(profile, { kind, payload, extra, now: T0 });
  fire('venue-action', { activityId: 'jollof-chicken' }, {}); fire('venue-action', { activityId: 'gym-workout' }, {}); fire('venue-action', { activityId: 'club-dance' }, {});
  for (let i = 0; i < 5; i++) fire('gig-complete', {}, { payout: { kind: 'errand' } });
  assert.deepEqual(profile.hustle.missions.map(m => m.progress), [1, 1, 3]);
  assert.equal(profile.rep.xp, 5 * HUSTLE_RULES.gigRep, 'gigs also earn a little Rep on their own');
  const view = hustleView(profile, T0); assert.equal(view.allDone, true); assert.ok(view.missions.every(m => m.done && !m.claimed));
});

test('claims pay once, in order, with typed errors and no mutation on failure', () => {
  const profile = { id: 'p', wallet: 1000 }; ensureHustleDay(profile, T0);
  const [easy, out, hustle] = profile.hustle.missions, act = (action, payload) => applyHustleAction(profile, action, payload, { now: T0 });
  code(() => act('hustle-claim', { missionId: easy.id }), 'hustle_not_done'); code(() => act('hustle-claim', { missionId: 'bonus' }), 'hustle_not_done'); code(() => act('hustle-claim', { missionId: 'nope' }), 'hustle_unknown_mission');
  assert.throws(() => act('hustle-free-money', {}), HustleError); assert.equal(profile.wallet, 1000);
  for (const row of [easy, out, hustle]) row.progress = 99;
  const meta = HUSTLE_MISSIONS.find(m => m.id === easy.id), first = act('hustle-claim', { missionId: easy.id });
  assert.equal(profile.wallet, 1000 + meta.naira); assert.equal(first.reward.rep, meta.rep); assert.equal(first.ledgerType, 'OTHER_GAME_INCOME'); assert.match(first.ledgerReason, /^Today's Hustle · /);
  code(() => act('hustle-claim', { missionId: easy.id }), 'hustle_claimed');
  act('hustle-claim', { missionId: out.id }); act('hustle-claim', { missionId: hustle.id });
  const bonus = act('hustle-claim', { missionId: 'bonus' }); assert.equal(bonus.reward.naira, HUSTLE_RULES.bonus.naira); code(() => act('hustle-claim', { missionId: 'bonus' }), 'hustle_claimed');
  const total = [easy, out, hustle].reduce((sum, row) => sum + HUSTLE_MISSIONS.find(m => m.id === row.id).naira, 0) + HUSTLE_RULES.bonus.naira;
  assert.equal(profile.wallet, 1000 + total);
});

test('one swap a day replaces an untouched mission with another from the same tier', () => {
  const profile = { id: 'swapper', wallet: 0 }; ensureHustleDay(profile, T0);
  const before = profile.hustle.missions.map(m => m.id), act = (action, payload) => applyHustleAction(profile, action, payload, { now: T0 });
  profile.hustle.missions[1].progress = 1; code(() => act('hustle-swap', { missionId: before[1] }), 'hustle_started');
  const view = act('hustle-swap', { missionId: before[0] }).hustle, after = profile.hustle.missions.map(m => m.id);
  assert.notEqual(after[0], before[0]); assert.equal(HUSTLE_MISSIONS.find(m => m.id === after[0]).tier, 'easy'); assert.equal(new Set(after).size, 3); assert.equal(view.swapsLeft, 0);
  code(() => act('hustle-swap', { missionId: after[2] }), 'hustle_no_swaps'); assert.equal(profile.wallet, 0, 'swapping never pays');
});

test('the check-in streak grows daily, wraps after seven and restarts after a missed day', () => {
  const profile = { id: 'streak', wallet: 0 }; let now = T0, paid = 0;
  const checkin = () => applyHustleAction(profile, 'hustle-checkin', {}, { now });
  for (let day = 0; day < 8; day++) { assert.equal(hustleView(profile, now).streak.nextDay, day % 7 + 1); const result = checkin(); assert.equal(result.reward.naira, HUSTLE_RULES.streak[day % 7].naira); paid += result.reward.naira; code(checkin, 'hustle_checked_in'); assert.equal(hustleView(profile, now).streak.checkedInToday, true); now += DAY; }
  assert.equal(profile.wallet, paid); assert.equal(profile.hustle.streak, 8);
  now += 2 * DAY; assert.equal(hustleView(profile, now).streak.days, 0, 'a missed day shows as a fresh start'); assert.equal(hustleView(profile, now).streak.nextDay, 1);
  assert.equal(checkin().reward.naira, HUSTLE_RULES.streak[0].naira); assert.equal(profile.hustle.streak, 1);
});

test('in the real store: gigs advance missions, rewards hit the ledger once and survive a retry', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-hustle-')); let time = T0;
  const store = new GameStore({ dataDir, clock: () => time, originRandomInt: (min, max) => max === 2 ? 1 : 0 });
  t.after(() => { store.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const { residentId: id } = await store.register({ username: 'hustle_player', password: 'a-test-password' }), act = (action, payload = {}) => store.action(id, action, payload);
  const start = store.profile(id).wallet;
  code(() => act('hustle-checkin'), 'idempotency_required');
  const checkKey = key(), checked = act('hustle-checkin', { idempotencyKey: checkKey });
  assert.equal(checked.profile.wallet, start + HUSTLE_RULES.streak[0].naira); assert.equal(checked.hustle.streak.checkedInToday, true);
  assert.equal(act('hustle-checkin', { idempotencyKey: checkKey }).replayed, true, 'a retried request is replayed, not paid twice');
  assert.equal(store.profile(id).wallet, start + HUSTLE_RULES.streak[0].naira);
  act('leave-home'); let gigs = 0;
  const gig = () => { const g = act('gig-offer').gigs.gig; act('gig-accept', { gigId: g.id }); time += GIG_RULES.minLegMs; act('gig-pickup', { gigId: g.id }); time += GIG_RULES.minLegMs; const done = act('gig-complete', { gigId: g.id, idempotencyKey: key() }); time += GIG_RULES.cooldownMs; gigs++; return done.payout.paid; };
  let gigIncome = 0; for (let i = 0; i < 3; i++) gigIncome += gig();
  const profile = store.profile(id), view = hustleView(profile, time), gigMission = view.missions.find(m => ['errand', 'gigs-3', 'deliveries-2'].includes(m.id));
  assert.equal(profile.rep.xp, HUSTLE_RULES.streak[0].rep + 3 * HUSTLE_RULES.gigRep);
  if (gigMission) {
    assert.equal(gigMission.done, true, `${gigMission.id} completes after three errands`);
    const claimKey = key(), claimed = act('hustle-claim', { missionId: gigMission.id, idempotencyKey: claimKey });
    assert.equal(claimed.reward.naira, gigMission.naira); assert.equal(act('hustle-claim', { missionId: gigMission.id, idempotencyKey: claimKey }).replayed, true);
    code(() => act('hustle-claim', { missionId: gigMission.id, idempotencyKey: key() }), 'hustle_claimed');
    assert.equal(store.profile(id).wallet, start + HUSTLE_RULES.streak[0].naira + gigIncome + gigMission.naira);
  }
  const rows = store.all('SELECT amount,reason,type FROM ledger WHERE resident_id=? ORDER BY rowid', id), income = rows.slice(1).reduce((sum, row) => sum + row.amount, 0);
  assert.equal(store.profile(id).wallet, start + income, 'every Naira earned has a ledger entry');
  assert.ok(rows.some(row => /^Daily check-in · day 1$/.test(row.reason) && row.type === 'OTHER_GAME_INCOME'));
});

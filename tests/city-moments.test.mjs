import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { GameStore } from '../src/server/gameStore.mjs';
import { MOMENT_TEMPLATES, MOMENT_RULES, momentBlock, momentContext, dealMoments, ensureMoments, recordMomentProgress, momentsView, applyMomentAction, MomentError } from '../src/shared/city-moments.mjs';
import { recordHustleProgress } from '../src/shared/daily-hustle.mjs';
import { GIG_RULES } from '../src/shared/street-gigs.mjs';
import { JOB_PAY } from '../src/shared/economy.mjs';

const HOUR = 3_600_000, key = () => crypto.randomUUID();
const at = (date, hour) => Date.parse(`${date}T${String(hour).padStart(2, '0')}:30:00+01:00`);
const code = (fn, expected) => assert.throws(fn, error => { assert.equal(error.code, expected, error.message); return true; });
const ids = (profile, now) => dealMoments(profile, now).map(m => m.templateId);
const templates = new Map(MOMENT_TEMPLATES.map(t => [t.id, t]));

test('moments are dealt per four-hour block, deterministically, at most two at a time', () => {
  const profile = { id: 'resident-a', district: 'garki-ii', home: {} }, now = at('2026-10-14', 20);
  assert.deepEqual(dealMoments(profile, now), dealMoments(profile, now + HOUR), 'the same block deals the same moments');
  assert.ok(dealMoments(profile, now).length <= MOMENT_RULES.perBlock);
  assert.equal(momentBlock(now).key, '2026-10-14:5');
  const seen = new Set(); for (let day = 10; day <= 23; day++) for (const hour of [6, 10, 14, 18, 22]) ids(profile, at(`2026-10-${day}`, hour)).forEach(id => seen.add(id));
  assert.ok(seen.size >= 9, `${seen.size} different moments over two weeks`);
});

test('moments respect the hour, the weekday, the weather and what the resident has', () => {
  const ctx = (overrides, now) => ({ ...momentContext({ id: 'x', district: 'jabi' }, now), ...overrides });
  const allowed = (id, c) => templates.get(id).when(c);
  assert.equal(allowed('night-invite', ctx({ hour: 21 })), true); assert.equal(allowed('night-invite', ctx({ hour: 1 })), true); assert.equal(allowed('night-invite', ctx({ hour: 11 })), false, 'no club invitations at noon');
  assert.equal(allowed('jumuah', ctx({ hour: 12, dayIndex: 5 })), true); assert.equal(allowed('jumuah', ctx({ hour: 12, dayIndex: 3 })), false);
  assert.equal(allowed('sunday-service', ctx({ hour: 9, dayIndex: 0 })), true); assert.equal(allowed('sunday-service', ctx({ hour: 9, dayIndex: 6 })), false);
  assert.equal(allowed('morning-burn', ctx({ hour: 6 })), true); assert.equal(allowed('morning-burn', ctx({ hour: 22 })), false);
  assert.equal(allowed('rain-in', ctx({ rain: true, hasHome: true })), true); assert.equal(allowed('rain-in', ctx({ rain: false, hasHome: true })), false);
  assert.equal(allowed('boss-check', ctx({ hour: 10, dayIndex: 2, hasJob: false })), false, 'no boss without a job');
  assert.equal(allowed('cruise', ctx({ hour: 12, hasCar: false })), false, 'no car, no cruise');
  for (const day of ['2026-10-14', '2026-10-15', '2026-10-16']) for (const hour of [11, 13]) assert.ok(!ids({ id: 'r', district: 'jabi' }, at(day, hour)).includes('night-invite'));
  const cousin = dealMoments({ id: 'r', district: 'jabi' }, at('2026-10-14', 10)).find(m => m.templateId === 'cousin-visit');
  if (cousin) assert.notEqual(cousin.params.district, 'jabi', 'the cousin lives somewhere else');
});

test('only matching, validated actions before the deadline move a moment', () => {
  const now = at('2026-10-14', 20), profile = { id: 'p', wallet: 0, district: 'jabi', location: { venue: 'club' } };
  profile.moments = { block: momentBlock(now).key, list: [
    { id: 'a', templateId: 'night-invite', params: { friend: 'Ada' }, progress: 0, claimed: false, expiresAt: momentBlock(now).endsAt },
    { id: 'b', templateId: 'cousin-visit', params: { district: 'maitama' }, progress: 0, claimed: false, expiresAt: momentBlock(now).endsAt },
    { id: 'c', templateId: 'cruise', params: { friend: 'Musa' }, progress: 0, claimed: false, expiresAt: momentBlock(now).endsAt },
  ], claimedTotal: 0 };
  const fire = (kind, payload = {}, extra = {}, when = now) => recordHustleProgress(profile, { kind, payload, extra, now: when });
  fire('enter-venue', { venueId: 'gym' }); fire('travel', { district: 'garki-ii', mode: 'walk' });
  assert.deepEqual(profile.moments.list.map(m => m.progress), [0, 0, 0]);
  fire('enter-venue', { venueId: 'magic-city' }); fire('travel', { district: 'maitama', mode: 'car' });
  assert.deepEqual(profile.moments.list.map(m => m.progress), [1, 1, 1]);
  fire('enter-venue', { venueId: 'club' }); assert.equal(profile.moments.list[0].progress, 1, 'never past the goal');
  const late = { id: 'p2', wallet: 0, moments: { block: momentBlock(now).key, list: [{ id: 'z', templateId: 'night-invite', params: {}, progress: 0, claimed: false, expiresAt: now - 1 }] } };
  recordMomentProgress(late, { type: 'enter-venue', venueId: 'club' }, now); assert.equal(late.moments.list[0].progress, 0, 'expired moments do not count');
});

test('claims pay once with typed errors; finished moments survive into the next block for a grace period', () => {
  const now = at('2026-10-14', 20), block = momentBlock(now), profile = { id: 'p', wallet: 1000, district: 'jabi' };
  profile.moments = { block: block.key, list: [{ id: 'a', templateId: 'night-invite', params: { friend: 'Ada' }, progress: 0, claimed: false, expiresAt: block.endsAt }], claimedTotal: 0 };
  const act = (payload, when = now) => applyMomentAction(profile, 'moment-claim', payload, { now: when });
  code(() => act({ momentId: 'a' }), 'moment_not_done'); code(() => act({ momentId: 'nope' }), 'moment_unknown');
  assert.throws(() => applyMomentAction(profile, 'moment-free-money', {}, { now }), MomentError); assert.equal(profile.wallet, 1000);
  profile.moments.list[0].progress = 1;
  const nextBlock = block.endsAt + HOUR, view = momentsView({ ...profile, moments: structuredClone(profile.moments) }, nextBlock);
  assert.ok(view.moments.some(m => m.id === 'a' && m.done && !m.claimed), 'still collectable just after the block ends');
  const paid = act({ momentId: 'a' }, nextBlock), meta = templates.get('night-invite');
  assert.equal(profile.wallet, 1000 + meta.naira); assert.equal(paid.reward.rep, meta.rep); assert.equal(paid.ledgerType, 'OTHER_GAME_INCOME'); assert.match(paid.ledgerReason, /^City moment · /);
  code(() => act({ momentId: 'a' }, nextBlock), 'moment_claimed');
  const stale = { id: 'q', wallet: 0, moments: { block: block.key, list: [{ id: 'b', templateId: 'night-invite', params: {}, progress: 1, claimed: false, expiresAt: block.endsAt }] } };
  code(() => applyMomentAction(stale, 'moment-claim', { momentId: 'b' }, { now: block.endsAt + MOMENT_RULES.claimGraceMs + HOUR }), 'moment_unknown');
});

test('a full day of moments stays a side income next to a real job', () => {
  const profile = { id: 'rich-day', district: 'jabi', home: {}, job: 'junior-dev', inventory: ['compact-car'] };
  let worst = 0;
  for (let day = 12; day <= 25; day++) {
    let total = 0; for (let hour = 0; hour < 24; hour += 4) total += dealMoments(profile, at(`2026-10-${day}`, hour)).reduce((sum, m) => sum + templates.get(m.templateId).naira, 0);
    worst = Math.max(worst, total);
  }
  assert.ok(worst <= Math.max(...Object.values(JOB_PAY)), `a perfect day of moments pays at most ₦${worst}`);
});

test('in the real store: a dealt moment completes from real gigs and pays exactly once through the ledger', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-moments-')); let time = at('2026-10-14', 8);
  const store = new GameStore({ dataDir, clock: () => time, originRandomInt: (min, max) => max === 2 ? 1 : 0 });
  t.after(() => { store.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const { residentId: id } = await store.register({ username: 'moment_player', password: 'a-test-password' }), act = (action, payload = {}) => store.action(id, action, payload);
  act('leave-home');
  // Find a weekday rush-hour block in which this resident is dealt the rush-hour moment.
  const candidates = []; for (let day = 12; day <= 30; day++) for (const hour of [8, 17]) candidates.push(at(`2026-10-${day}`, hour));
  time = candidates.find(when => ids(store.profile(id), when).includes('rush-hour'));
  assert.ok(time, 'rush hour is dealt at least once in a fortnight');
  const start = store.profile(id).wallet;
  let gigIncome = 0;
  for (let i = 0; i < 2; i++) { const g = act('gig-offer').gigs.gig; act('gig-accept', { gigId: g.id }); time += GIG_RULES.minLegMs; act('gig-pickup', { gigId: g.id }); time += GIG_RULES.minLegMs; const done = act('gig-complete', { gigId: g.id, idempotencyKey: key() }); gigIncome += done.gigs?.payout?.naira ?? 0; time += GIG_RULES.cooldownMs; }
  const profile = store.profile(id), moment = momentsView(profile, time).moments.find(m => m.templateId === 'rush-hour');
  assert.ok(moment?.done, 'two real gigs finish the rush-hour moment');
  code(() => act('moment-claim', { momentId: moment.id }), 'idempotency_required');
  const claimKey = key(), claimed = act('moment-claim', { momentId: moment.id, idempotencyKey: claimKey });
  assert.equal(claimed.reward.naira, templates.get('rush-hour').naira);
  assert.equal(act('moment-claim', { momentId: moment.id, idempotencyKey: claimKey }).replayed, true, 'a retry is replayed, not paid twice');
  code(() => act('moment-claim', { momentId: moment.id, idempotencyKey: key() }), 'moment_claimed');
  const after = store.profile(id);
  assert.equal(after.moments.list.find(m => m.id === moment.id).claimed, true, 'the claim persists in the saved profile');
  const rows = store.all('SELECT amount,reason,type FROM ledger WHERE resident_id=? ORDER BY rowid', id);
  assert.ok(rows.some(row => /^City moment · Rush hour pays$/.test(row.reason) && row.type === 'OTHER_GAME_INCOME' && row.amount === templates.get('rush-hour').naira));
  assert.ok(after.wallet >= start + templates.get('rush-hour').naira);
});

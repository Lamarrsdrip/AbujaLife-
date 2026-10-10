import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { GameStore } from '../src/server/gameStore.mjs';
import { GIG_RULES, GIG_KINDS, GIG_ACTIONS, GIG_MONEY_ACTIONS, applyGigAction, gigView, GigError } from '../src/shared/street-gigs.mjs';
import { VENUES, venueAvailable } from '../src/shared/life.mjs';
import { VEHICLE_PRICES } from '../src/shared/economy.mjs';

const key = () => crypto.randomUUID();
async function fixture(t, { gigRandomInt } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-gigs-'));
  let time = Date.parse('2026-10-06T10:00:00+01:00');
  const store = new GameStore({ dataDir, clock: () => time, originRandomInt: (min, max) => max === 2 ? 1 : 0, ...(gigRandomInt ? { gigRandomInt } : {}) });
  const { residentId: id } = await store.register({ username: 'gig_player', password: 'a-test-password' });
  t.after(() => { store.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const act = (action, payload = {}) => store.action(id, action, payload);
  return { id, store, act, advance: ms => { time += ms; }, now: () => time, ledger: () => store.all('SELECT amount,reason,type,balance_after FROM ledger WHERE resident_id=? ORDER BY rowid', id) };
}
const expectCode = (fn, code) => assert.throws(fn, error => { assert.equal(error.code, code, error.message); return true; });

test('gig rules are bounded side income, not a money printer', () => {
  assert.deepEqual([...GIG_ACTIONS].sort(), ['gig-accept', 'gig-cancel', 'gig-complete', 'gig-offer', 'gig-pickup']);
  assert.deepEqual([...GIG_MONEY_ACTIONS], ['gig-complete'], 'only completion moves money, so only completion needs an idempotency key');
  const best = Math.max(...Object.values(GIG_KINDS).map(kind => kind.fare[1]));
  const ceiling = GIG_RULES.dailyLimit * Math.floor(best * (1 + GIG_RULES.executiveBasisPoints / 10000) * (1 + GIG_RULES.onTimeTipBasisPoints / 10000));
  assert.ok(ceiling <= 1_500_000, `a perfect day of gigs pays at most ₦${ceiling}, about two job shifts`);
  for (const kind of Object.values(GIG_KINDS)) { assert.ok(kind.fare[0] > 0 && kind.fare[1] > kind.fare[0] && (kind.fare[1] - kind.fare[0]) % 2000 === 0); }
  assert.equal(GIG_KINDS.errand.needsVehicle, false, 'a resident with no car still has paid work');
  assert.ok(GIG_RULES.minLegMs >= 5000 && GIG_RULES.cooldownMs > 0);
});

test('an errand on foot pays exactly once through the ledger', async t => {
  const f = await fixture(t), before = f.store.profile(f.id).wallet;
  expectCode(() => f.act('gig-offer'), 'gig_not_on_street');
  f.act('leave-home');
  const offered = f.act('gig-offer').gigs.gig;
  assert.equal(offered.kind, 'errand'); assert.equal(offered.state, 'offered'); assert.notEqual(offered.from, offered.to);
  assert.ok(venueAvailable(offered.from, f.store.profile(f.id).district) && venueAvailable(offered.to, f.store.profile(f.id).district), 'both stops are real places in this district');
  assert.ok(offered.fare >= GIG_KINDS.errand.fare[0] && offered.fare <= GIG_KINDS.errand.fare[1]);
  assert.equal(f.store.profile(f.id).wallet, before, 'an offer pays nothing');
  f.act('gig-accept', { gigId: offered.id });
  expectCode(() => f.act('gig-pickup', { gigId: offered.id }), 'gig_too_fast');
  f.advance(GIG_RULES.minLegMs);
  assert.equal(f.act('gig-pickup', { gigId: offered.id }).gigs.gig.state, 'onboard');
  expectCode(() => f.act('gig-complete', { gigId: offered.id, idempotencyKey: key() }), 'gig_too_fast');
  expectCode(() => f.act('gig-complete', { gigId: offered.id }), 'idempotency_required');
  f.advance(GIG_RULES.minLegMs);
  const completion = key(), done = f.act('gig-complete', { gigId: offered.id, idempotencyKey: completion });
  const tip = Math.floor(offered.fare * GIG_RULES.onTimeTipBasisPoints / 10000);
  assert.deepEqual({ fare: done.payout.fare, tip: done.payout.tip, paid: done.payout.paid, onTime: done.payout.onTime }, { fare: offered.fare, tip, paid: offered.fare + tip, onTime: true });
  assert.equal(done.profile.wallet, before + offered.fare + tip); assert.equal(done.gigs.gig, null); assert.equal(done.gigs.today, 1);
  // The same request replayed (double tap, retry after a dropped connection) pays nothing more.
  const replay = f.act('gig-complete', { gigId: offered.id, idempotencyKey: completion });
  assert.equal(replay.replayed, true); assert.equal(f.store.profile(f.id).wallet, before + offered.fare + tip);
  expectCode(() => f.act('gig-complete', { gigId: offered.id, idempotencyKey: key() }), 'gig_expired');
  const entry = f.ledger().at(-1);
  assert.equal(entry.amount, offered.fare + tip); assert.equal(entry.type, 'JOB_INCOME'); assert.match(entry.reason, /^Errand fee · /); assert.equal(entry.balance_after, before + offered.fare + tip);
  assert.equal(f.ledger().filter(row => row.type === 'JOB_INCOME').length, 1);
  assert.equal(f.store.profile(f.id).reputation, 1);
  // Working costs a little energy and appetite, never below zero.
  const worked = f.store.profile(f.id); assert.ok(worked.energy <= 82 - GIG_RULES.effort.onFoot.energy && worked.energy >= 0); assert.ok(worked.hunger <= 72 - GIG_RULES.effort.onFoot.hunger && worked.hunger >= 0);
});

test('rides need the resident to really be driving their own car, and pay more in a luxury car', async t => {
  const f = await fixture(t, { gigRandomInt: (min, max) => min }), afford = id => f.store.transaction(() => { const p = f.store.profile(f.id); p.wallet = VEHICLE_PRICES[id] + 1_000_000; f.store.save(p); });
  f.act('leave-home'); afford('used-hatchback'); f.act('purchase', { itemId: 'used-hatchback', idempotencyKey: key() });
  f.act('toggle-driving', { vehicleId: 'used-hatchback' });
  const ride = f.act('gig-offer').gigs.gig;
  assert.equal(ride.kind, 'ride'); assert.equal(ride.executive, false); assert.equal(ride.fare, GIG_KINDS.ride.fare[0]); assert.ok(ride.customer);
  f.act('gig-accept', { gigId: ride.id });
  // Parking the car, or swapping to another, does not carry the passenger.
  f.act('toggle-driving', { vehicleId: null }); f.advance(GIG_RULES.minLegMs);
  expectCode(() => f.act('gig-pickup', { gigId: ride.id }), 'gig_vehicle_required');
  f.act('toggle-driving', { vehicleId: 'used-hatchback' }); f.act('gig-pickup', { gigId: ride.id });
  // A slow trip is still paid, without the on-time tip.
  f.advance(GIG_RULES.onTimeMs + 1000);
  const slow = f.act('gig-complete', { gigId: ride.id, idempotencyKey: key() });
  assert.equal(slow.payout.tip, 0); assert.equal(slow.payout.paid, ride.fare);
  expectCode(() => f.act('gig-offer'), 'gig_cooldown'); f.advance(GIG_RULES.cooldownMs);
  afford('mercedes-g63'); f.act('toggle-driving', { vehicleId: null }); f.act('purchase', { itemId: 'mercedes-g63', idempotencyKey: key() }); f.act('toggle-driving', { vehicleId: 'mercedes-g63' });
  const executive = f.act('gig-offer').gigs.gig;
  assert.equal(executive.executive, true); assert.equal(executive.fare, ride.fare + Math.floor(ride.fare * GIG_RULES.executiveBasisPoints / 10000));
});

test('offers lapse, abandoning a passenger costs reputation, and leaving the street stops the gig', async t => {
  const f = await fixture(t); f.act('leave-home');
  const first = f.act('gig-offer').gigs.gig; f.advance(GIG_RULES.offerMs + 1);
  expectCode(() => f.act('gig-accept', { gigId: first.id }), 'gig_expired');
  const second = f.act('gig-offer').gigs.gig; assert.notEqual(second.id, first.id);
  expectCode(() => f.act('gig-accept', { gigId: first.id }), 'gig_expired');
  f.act('gig-accept', { gigId: second.id });
  expectCode(() => f.act('gig-offer'), 'gig_in_progress');
  assert.equal(f.act('gig-cancel').cancelled, true, 'cancelling before pick-up is free');
  assert.equal(f.store.profile(f.id).reputation, 0);
  // Build a point of reputation, then abandon a customer mid-trip.
  const paid = f.act('gig-offer').gigs.gig; f.act('gig-accept', { gigId: paid.id }); f.advance(GIG_RULES.minLegMs); f.act('gig-pickup', { gigId: paid.id }); f.advance(GIG_RULES.minLegMs); f.act('gig-complete', { gigId: paid.id, idempotencyKey: key() });
  f.advance(GIG_RULES.cooldownMs);
  const dropped = f.act('gig-offer').gigs.gig; f.act('gig-accept', { gigId: dropped.id }); f.advance(GIG_RULES.minLegMs); f.act('gig-pickup', { gigId: dropped.id });
  const wallet = f.store.profile(f.id).wallet; f.act('gig-cancel');
  assert.equal(f.store.profile(f.id).reputation, 0, 'abandoning after pick-up costs a point'); assert.equal(f.store.profile(f.id).wallet, wallet, 'and pays nothing');
  expectCode(() => f.act('gig-offer'), 'gig_cooldown'); f.advance(GIG_RULES.abandonCooldownMs);
  const home = f.act('gig-offer').gigs.gig; f.act('gig-accept', { gigId: home.id }); f.act('enter-home'); f.advance(GIG_RULES.minLegMs);
  expectCode(() => f.act('gig-pickup', { gigId: home.id }), 'gig_not_on_street');
});

test('the daily limit holds and resets on the next Abuja day; rule errors never mutate state', async t => {
  const f = await fixture(t); f.act('leave-home');
  const run = () => { const gig = f.act('gig-offer').gigs.gig; f.act('gig-accept', { gigId: gig.id }); f.advance(GIG_RULES.minLegMs); f.act('gig-pickup', { gigId: gig.id }); f.advance(GIG_RULES.minLegMs); const done = f.act('gig-complete', { gigId: gig.id, idempotencyKey: key() }); f.advance(GIG_RULES.cooldownMs); return done; };
  let earned = 0; for (let i = 0; i < GIG_RULES.dailyLimit; i++) earned += run().payout.paid;
  const view = gigView(f.store.profile(f.id), f.now());
  assert.equal(view.today, GIG_RULES.dailyLimit); assert.equal(view.remaining, 0); assert.equal(view.completed, GIG_RULES.dailyLimit); assert.equal(view.earned, earned);
  const wallet = f.store.profile(f.id).wallet;
  expectCode(() => f.act('gig-offer'), 'gig_daily_limit'); assert.equal(f.store.profile(f.id).wallet, wallet);
  assert.equal(f.ledger().filter(row => row.type === 'JOB_INCOME').reduce((sum, row) => sum + row.amount, 0), earned, 'ledger income equals what was paid, nothing more');
  f.advance(24 * 60 * 60 * 1000); assert.ok(run().payout.paid > 0, 'a new day brings new requests');
  // Pure-rule guard: a client cannot name places outside the district, or invent actions.
  const profile = { district: 'lugbe', location: { kind: 'public' }, wallet: 0 }, places = VENUES.filter(venue => !venueAvailable(venue.id, 'lugbe')).slice(0, 5).map(venue => venue.id);
  assert.throws(() => applyGigAction(profile, 'gig-offer', { places: [...places, 'not-a-place'] }, { now: 1, randomInt: () => 0 }), error => error instanceof GigError && error.code === 'gig_no_places');
  assert.throws(() => applyGigAction(profile, 'gig-pay-me', {}, { now: 1, randomInt: () => 0 }), GigError);
  assert.equal(profile.wallet, 0); assert.equal(profile.gig, undefined);
});

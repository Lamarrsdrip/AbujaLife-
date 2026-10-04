import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { GameStore, properties } from '../src/server/gameStore.mjs';
import { ABUJA_ATLAS } from '../src/shared/atlas.mjs';
import { createOrigin, ORIGIN_HOMES, ORIGIN_META } from '../src/shared/origins.mjs';
import { LOAN_META, INVESTMENT_META, investmentView, loanQuote } from '../src/shared/life.mjs';

const operationKey = () => crypto.randomUUID();
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);
async function fixture(t, originRandomInt = (min, max) => max === 2 ? 1 : 0) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-origin-'));
  let now = Date.parse('2026-10-05T09:00:00Z');
  let store = new GameStore({ dataDir, clock: () => now, originRandomInt });
  t.after(() => { store.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const id = (await store.register({ username: 'origin_resident', password: 'a-test-password', origin: 'nepo', wallet: 9e9, district: 'wuse-ii-a07' })).residentId;
  return { get store() { return store; }, id, get now() { return now; }, advance(ms) { now += ms; },
    reopen() { store.close(); store = new GameStore({ dataDir, clock: () => now, originRandomInt }); } };
}

test('each origin uses an unbiased two-way random draw and an atlas-backed authored residence', () => {
  assert.equal(ORIGIN_META.equalProbability, true);
  for (const [branch, originId] of ['nepo', 'lapo'].entries()) {
    for (const [index, expected] of ORIGIN_HOMES[originId].entries()) {
      const calls = [];
      const origin = createOrigin({ residentId: 'resident-id', now: 123,
        randomInt: (min, max) => { calls.push([min, max]); return calls.length === 1 ? branch : index; }, properties, atlas: ABUJA_ATLAS });
      assert.deepEqual(calls, [[0, 2], [0, ORIGIN_HOMES[originId].length]]);
      assert.equal(origin.id, originId);
      assert.equal(origin.startingBalance, originId === 'nepo' ? 1000000 : 100000);
      assert.equal(origin.residence.district, expected.district);
      assert.equal(origin.residence.layoutId, expected.layoutId);
      assert.ok(ABUJA_ATLAS.some(place => place.id === origin.residence.district));
      assert.ok(properties.some(property => property.id === origin.residence.layoutId));
      assert.ok(!['garki-i', 'wuse-ii-a07'].includes(origin.residence.district));
      assert.equal(origin.residence.id, 'origin-home-resident-id');
      assert.equal(origin.giftedHome, originId === 'nepo');
    }
  }
});

test('new registrations cannot choose or rewrite their origin and retain their personal home after restart', async t => {
  const f = await fixture(t), before = f.store.profile(f.id);
  assert.equal(before.origin.id, 'lapo'); assert.equal(before.wallet, 100000);
  assert.equal(before.district, 'lugbe'); assert.equal(before.home.layoutId, 'garki-studio');
  const update = f.store.updateProfile(f.id, { origin: { id: 'nepo' }, home: { district: 'maitama' }, wallet: 1000000 });
  assert.deepEqual(update.origin, before.origin); assert.deepEqual(update.home, before.home); assert.equal(update.wallet, before.wallet);
  const forged = f.store.profile(f.id); forged.origin.id = 'nepo'; forged.origin.residence.district = 'maitama'; f.store.save(forged);
  assert.deepEqual(f.store.profile(f.id).origin, before.origin);
  assert.equal(f.store.bootstrap(f.id).properties.find(property => property.id === before.home.propertyId).district, 'lugbe');
  f.reopen(); assert.deepEqual(f.store.profile(f.id).origin, before.origin);
  assert.equal(f.store.transactions(f.id).filter(row => row.reason === 'Resident starting balance').length, 1);
});

test('Nepo balances and gifted homes are owned without buying the authored listing', async t => {
  const f = await fixture(t, () => 0), p = f.store.profile(f.id);
  assert.equal(p.origin.id, 'nepo'); assert.equal(p.wallet, 1000000); assert.equal(p.home.district, 'jabi');
  assert.equal(p.home.tenure, 'own'); assert.equal(p.home.gifted, true);
  assert.deepEqual(p.ownedProperties, [p.home.propertyId]); assert.ok(!p.ownedProperties.includes('jabi-apartment'));
  const borrowed = f.store.action(f.id, 'borrow-loan', { amount: 1000, consent: true, consentVersion: LOAN_META.consentVersion, idempotencyKey: operationKey() });
  assert.equal(borrowed.profile.wallet, 1001000);
});

test('loans require versioned consent, calculate fees on the server and replay one ledger mutation across restarts', async t => {
  const f = await fixture(t), request = { amount: 200000, consent: true, consentVersion: LOAN_META.consentVersion, idempotencyKey: operationKey(), fee: 0, dueAt: 0, wallet: 9e9 };
  rejects(() => f.store.action(f.id, 'borrow-loan', { ...request, consent: false }), 'loan_consent_required');
  rejects(() => f.store.action(f.id, 'borrow-loan', { ...request, consentVersion: 'forged' }), 'loan_consent_required');
  assert.equal(f.store.all('SELECT * FROM economy_operations').length, 0);
  const result = f.store.action(f.id, 'borrow-loan', request);
  assert.equal(result.profile.wallet, 300000); assert.equal(result.loan.fee, 10000); assert.equal(result.loan.outstanding, 210000);
  assert.equal(result.loan.dueAt, f.now + LOAN_META.termMs); assert.equal(result.loan.consentedAt, f.now);
  assert.equal(f.store.action(f.id, 'borrow-loan', request).loan.id, result.loan.id);
  rejects(() => f.store.action(f.id, 'borrow-loan', { ...request, amount: 1000 }), 'idempotency_conflict');
  rejects(() => f.store.action(f.id, 'borrow-loan', { ...request, idempotencyKey: operationKey() }), 'active_loan');
  f.reopen(); assert.equal(f.store.action(f.id, 'borrow-loan', request).replayed, true);
  assert.equal(f.store.transactions(f.id).filter(row => row.reason === 'Game loan · borrowed principal').length, 1);
  f.advance(LOAN_META.termMs); assert.equal(f.store.wallet(f.id).loans[0].overdue, true); assert.equal(f.store.wallet(f.id).loans[0].outstanding, 210000);
});

test('partial loan repayments remain exact, reject overpayments atomically, and allow a new loan once settled', async t => {
  const f = await fixture(t);
  const loan = f.store.action(f.id, 'borrow-loan', { amount: 200000, consent: true, consentVersion: LOAN_META.consentVersion, idempotencyKey: operationKey() }).loan;
  const partial = { loanId: loan.id, amount: 50000, idempotencyKey: operationKey(), outstanding: 0 };
  const paid = f.store.action(f.id, 'repay-loan', partial); assert.equal(paid.loan.outstanding, 160000); assert.equal(paid.profile.wallet, 250000);
  const before = [f.store.profile(f.id), f.store.all('SELECT * FROM ledger').length];
  rejects(() => f.store.action(f.id, 'repay-loan', { ...partial, amount: 160001, idempotencyKey: operationKey() }), 'invalid_repayment');
  assert.deepEqual([f.store.profile(f.id), f.store.all('SELECT * FROM ledger').length], before);
  f.reopen(); assert.equal(f.store.action(f.id, 'repay-loan', partial).replayed, true);
  const settled = f.store.action(f.id, 'repay-loan', { loanId: loan.id, amount: 160000, idempotencyKey: operationKey() });
  assert.equal(settled.loan.outstanding, 0); assert.equal(settled.loan.repaid, 210000); assert.equal(settled.profile.wallet, 90000);
  f.store.action(f.id, 'borrow-loan', { amount: 1, consent: true, consentVersion: LOAN_META.consentVersion, idempotencyKey: operationKey() });
  assert.deepEqual(loanQuote(1), { principal: 1, fee: 1, totalRepayment: 2, termDays: 28 });
});

test('economy removes former business ceilings while exact-integer overflow rolls back and preserves retry keys', async t => {
  const f = await fixture(t);
  for (let index = 0; index < 5; index++) f.store.topup(f.id, { amount: 25000000, idempotencyKey: operationKey() });
  assert.equal(f.store.profile(f.id).wallet, 125100000);
  const retry = { amount: Number.MAX_SAFE_INTEGER, idempotencyKey: operationKey() }, before = [f.store.profile(f.id).wallet, f.store.all('SELECT * FROM ledger').length];
  rejects(() => f.store.topup(f.id, retry), 'numeric_limit'); assert.deepEqual([f.store.profile(f.id).wallet, f.store.all('SELECT * FROM ledger').length], before);
  assert.equal(f.store.get('SELECT count(*) n FROM economy_operations WHERE operation_key=?', retry.idempotencyKey).n, 0);
  for (const amount of [0, -1, 1.5, '1000', Infinity, NaN]) rejects(() => f.store.topup(f.id, { amount, idempotencyKey: operationKey() }), 'invalid_topup');
  rejects(() => f.store.action(f.id, 'borrow-loan', { amount: Number.MAX_SAFE_INTEGER, consent: true, consentVersion: LOAN_META.consentVersion, idempotencyKey: operationKey() }), 'numeric_limit');
  const property = properties.find(item => item.id === 'lugbe-flat');
  f.store.action(f.id, 'buy-investment', { propertyId: property.id, idempotencyKey: operationKey() }); f.advance(INVESTMENT_META.periodMs * 1000);
  assert.equal(investmentView(f.store.profile(f.id), property, f.now).collectable, property.investmentIncome * 1000);
  assert.equal(f.store.action(f.id, 'collect-rent', { propertyId: property.id, idempotencyKey: operationKey() }).income.amount, property.investmentIncome * 1000);
});

test('large transfers and dice stakes remain uncapped while representational overflow never creates a partial ledger', async t => {
  const f = await fixture(t), recipient = (await f.store.register({ username: 'wealthy_recipient', password: 'a-test-password' })).residentId;
  f.store.topup(f.id, { amount: 250000000, idempotencyKey: operationKey() });
  const transfer = f.store.transfer(f.id, { residentId: recipient, amount: 200000000, idempotencyKey: operationKey() });
  assert.equal(transfer.profile.wallet, 50100000); assert.equal(f.store.profile(recipient).wallet, 200100000);
  f.store.topup(recipient, { amount: Number.MAX_SAFE_INTEGER - 100 - f.store.profile(recipient).wallet, idempotencyKey: operationKey() });
  const before = [f.store.profile(f.id).wallet, f.store.profile(recipient).wallet, f.store.all('SELECT * FROM ledger').length];
  const request = { residentId: recipient, amount: 101, idempotencyKey: operationKey() };
  rejects(() => f.store.transfer(f.id, request), 'numeric_limit');
  assert.deepEqual([f.store.profile(f.id).wallet, f.store.profile(recipient).wallet, f.store.all('SELECT * FROM ledger').length], before);
  assert.equal(f.store.get('SELECT count(*) n FROM economy_operations WHERE operation_key=?', request.idempotencyKey).n, 0);
  f.store.action(f.id, 'leave-home'); f.store.action(f.id, 'enter-venue', { venueId: 'games-lounge' });
  t.mock.method(crypto, 'randomInt', () => 1);
  const round = f.store.action(f.id, 'play-dice', { stake: 10000000, choice: 'low', idempotencyKey: operationKey(), payout: 9e9 });
  assert.equal(round.round.payout, 20000000); assert.equal(round.profile.wallet, before[0] + 10000000);
});

test('home designs use the personal origin layout, persist across restarts and reject visitor edits', async t => {
  const f = await fixture(t), roomStyle = { wall: 'sage', floor: 'tile', partitions: [] };
  const designed = f.store.action(f.id, 'design-home', { roomStyle }); assert.deepEqual(designed.profile.home.roomStyle, roomStyle);
  assert.equal(designed.profile.home.layoutId, 'garki-studio'); f.reopen(); assert.deepEqual(f.store.profile(f.id).home.roomStyle, roomStyle);
  const p = f.store.profile(f.id); p.location = { kind: 'visit', district: p.district, venue: 'home', ownerId: 'another-owner' }; f.store.save(p);
  assert.throws(() => f.store.action(f.id, 'design-home', { roomStyle: { wall: 'clay', floor: 'oak', partitions: [] } }), /Go home/);
  rejects(() => f.store.action(f.id, 'travel', { district: 'jabi' }), 'visit_active');
  assert.deepEqual(f.store.profile(f.id).home.roomStyle, roomStyle);
});

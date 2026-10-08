import test from 'node:test';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TENANCY_RULES } from '../src/shared/tenancy.mjs';
import { GameStore, jobs, catalog, properties } from '../src/server/gameStore.mjs';
import { VEHICLE_PRICES } from '../src/shared/economy.mjs';
import { GAME_BILL_PERIOD_MS, VENUES, VENUE_ACTIONS } from '../src/shared/life.mjs';

async function fixture(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-life-'));
  let now = Date.parse('2026-10-05T10:00:00Z');
  let store = new GameStore({ dataDir, clock: () => now, originRandomInt:(min,max)=>max===2?1:0 });
  t.after(() => { store.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const { residentId: id } = await store.register({ username: 'life_player', password: 'a-test-password' });
  return {
    id, dataDir, get store() { return store; }, advance(ms) { now += ms; },
    reopen() { store.close(); store = new GameStore({ dataDir, clock: () => now }); return store; },
  };
}

test('venues require entry and apply their own prices and bounded needs', async t => {
  const { store, id } = await fixture(t);
  assert.throws(() => store.action(id, 'enter-venue', { venueId: 'restaurant' }), /Head out/);
  assert.throws(() => store.action(id, 'venue-action', { activityId: 'jollof-chicken' }), /Enter this place/);
  store.action(id, 'leave-home');
  assert.throws(() => store.action(id, 'enter-venue', { venueId: 'restaurant', district: 'jabi' }), /Travel/);
  assert.throws(() => store.action(id, 'enter-venue', { venueId: 'invented' }), /Choose a place/);
  store.action(id, 'enter-venue', { venueId: 'restaurant' });
  const before = store.profile(id);
  const result = store.action(id, 'venue-action', { activityId: 'jollof-chicken', cost: -99999, effects: { hunger: 9000, wallet: 999999 } });
  assert.equal(result.profile.wallet, before.wallet - VENUE_ACTIONS.find(activity=>activity.id==='jollof-chicken').cost);
  assert.equal(result.profile.hunger, 100);
  assert.equal(result.activity.venueId, 'restaurant');
  assert.throws(() => store.action(id, 'venue-action', { activityId: 'gym-workout' }), /Enter this place/);
  assert.equal(store.profile(id).wallet, result.profile.wallet);
  assert.equal(store.action(id, 'exit-venue').profile.location.kind, 'public');
  assert.ok(VENUES.some(venue => venue.fictional === false),'real Abuja hubs are first-class playable venues');
  assert.ok(VENUES.some(venue => venue.fictional === true),'authored game venues remain available');
  assert.ok(VENUE_ACTIONS.every(activity => VENUES.some(venue => venue.id === activity.venueId)));
});

test('work pays an earned wage and purchased driving enforces ownership without charging an owned-car fare', async t => {
  const { store, id, advance } = await fixture(t);
  assert.throws(() => store.action(id, 'purchase', { itemId: 'compact-car', price: 0 }), /need more/);
  store.action(id, 'take-job', { jobId: 'restaurant-host' });
  store.action(id, 'leave-home');
  assert.throws(() => store.action(id, 'toggle-driving', { vehicleId: 'used-hatchback' }), /Buy this car/);
  const commute=store.action(id,'travel',{district:jobs['restaurant-host'].district,mode:'bus'}).trip;advance(commute.seconds*1000);store.action(id,'arrive',{tripId:commute.id});const beforeWork=store.profile(id).wallet;
  const { challenge } = store.action(id, 'start-shift');
  advance(2000);
  const earned=store.action(id, 'complete-shift', { challengeId: challenge.id, answers: jobs['restaurant-host'].tasks.map(task => ({ taskId: task.id, optionId: task.answer })) });assert.equal(earned.result.pay,jobs['restaurant-host'].pay);assert.equal(earned.profile.wallet,beforeWork+earned.result.pay);
  const bought = store.action(id, 'purchase', { itemId: 'used-hatchback' }).profile;
  assert.equal(bought.wallet, earned.profile.wallet - catalog.find(item=>item.id==='used-hatchback').price);
  assert.equal(bought.drivingVehicle, null);
  const driving = store.action(id, 'toggle-driving', { vehicleId: 'used-hatchback' }).profile;
  assert.equal(driving.drivingVehicle, 'used-hatchback');
  assert.throws(() => store.action(id, 'enter-venue', { venueId: 'hotel' }), /Park your car/);
  const beforeDrive=store.profile(id).wallet,quote = store.quoteTravel(id, { district: 'jabi', mode: 'car' });
  assert.equal(quote.cost,0);
  const { trip } = store.action(id, 'travel', { district: 'jabi', mode: 'car' });
  assert.equal(trip.vehicleId, 'used-hatchback');assert.equal(trip.cost,0);assert.equal(store.profile(id).wallet,beforeDrive);
  assert.equal(store.profile(id).drivingVehicle, null);
  advance(trip.seconds * 1000);
  assert.equal(store.action(id, 'arrive', { tripId: trip.id }).profile.drivingVehicle, 'used-hatchback');
  assert.equal(store.action(id, 'toggle-driving', { vehicleId: null }).profile.drivingVehicle, null);
  store.action(id, 'enter-venue', { venueId: 'hotel' });
  assert.throws(() => store.action(id, 'toggle-driving', { vehicleId: 'used-hatchback' }), /Head out/);
  assert.equal(catalog.find(item => item.id === 'compact-car').price, VEHICLE_PRICES['compact-car']);
});

test('furniture must be owned, placed at home and remain inside the floor plan after restart', async t => {
  const f = await fixture(t);
  const starting=f.store.profile(f.id).wallet;
  assert.throws(() => f.store.action(f.id, 'place-furniture', { itemId: 'dining-table', x: .5, y: .5 }), /Buy this furniture/);
  f.store.action(f.id, 'purchase', { itemId: 'dining-table' });
  for (const payload of [{ x: -1, y: .5 }, { x: .5, y: 2 }, { x: Infinity, y: .5 }, { x: '.5', y: .5 }, { x: .5, y: .5, rotation: 45 }]) {
    assert.throws(() => f.store.action(f.id, 'place-furniture', { itemId: 'dining-table', ...payload }), /valid furniture rotation/);
  }
  const placed = f.store.action(f.id, 'place-furniture', { itemId: 'dining-table', x: .375, y: .625, rotation: 90 }).profile;
  assert.deepEqual(placed.furnitureLayout['dining-table'], { x: .375, y: .625, rotation: 90, propertyId:placed.home.propertyId });
  f.store.action(f.id, 'leave-home');
  assert.throws(() => f.store.action(f.id, 'place-furniture', { itemId: 'dining-table', x: .5, y: .5 }), /Go home/);
  f.reopen();
  assert.deepEqual(f.store.profile(f.id).furnitureLayout, placed.furnitureLayout);
  assert.equal(f.store.profile(f.id).wallet, starting - catalog.find(item=>item.id==='dining-table').price);
});

test('rent runs weekly while service charges remain a separate disclosed payment', async t => {
  const { store, id, advance } = await fixture(t),key=()=>crypto.randomUUID();
  const starting=store.profile(id).wallet,home=properties.find(property=>property.id==='lugbe-flat');
  const moved=store.action(id,'move-home',{propertyId:home.id,tenure:'rent',idempotencyKey:key()}).profile;
  assert.equal(moved.wallet,starting-home.rent-home.cautionDeposit);
  assert.equal(moved.home.rentDueAt,moved.rentPaidAt+TENANCY_RULES.intervalMs);
  assert.throws(()=>store.action(id,'pay-bills'),/up to date/);
  assert.throws(()=>store.action(id,'renew-rent',{idempotencyKey:key()}),/up to date/);
  advance(GAME_BILL_PERIOD_MS);
  const serviced=store.action(id,'pay-bills').profile;
  assert.equal(serviced.wallet,moved.wallet-home.bills);
  assert.equal(serviced.home.tenancy.outstanding,home.rent);
  const renewed=store.action(id,'renew-rent',{idempotencyKey:key()}).profile;
  assert.equal(renewed.wallet,serviced.wallet-home.rent);
  assert.equal(renewed.home.tenancy.outstanding,0);
  assert.equal(renewed.home.rentDueAt,renewed.rentPaidAt+TENANCY_RULES.intervalMs);
  assert.throws(()=>store.action(id,'renew-rent',{idempotencyKey:key()}),/up to date/);
});

test('character onboarding persists choices without accepting inventory or life-state forgery', async t => {
  const f = await fixture(t);
  const starting=f.store.profile(f.id).wallet;
  const profile = f.store.updateProfile(f.id, {
    displayName: 'Amaka', lifeGoal: 'home', onboardingComplete: true,
    appearance: { presentation: 'feminine', hair: 'braids', skinTone: 'deep', top: 'ochre' },
    wallet: 9000000, drivingVehicle: 'premium-suv', furnitureLayout: { sofa: { x: 0, y: 0 } }, inventory: ['premium-suv'],
  });
  assert.equal(profile.wallet, starting);
  assert.equal(profile.appearance.presentation, 'feminine');
  assert.equal(profile.drivingVehicle, null);
  assert.deepEqual(profile.inventory, []);
  assert.deepEqual(profile.furnitureLayout, {});
  assert.throws(() => f.store.updateProfile(f.id, { lifeGoal: '__proto__' }), /listed life goal/);
  assert.throws(() => f.store.updateProfile(f.id, { onboardingComplete: 'yes' }), /onboarding state/);
  f.reopen();
  const restored = f.store.profile(f.id);
  assert.equal(restored.onboardingComplete, true);
  assert.equal(restored.lifeGoal, 'home');
  assert.equal(restored.appearance.hair, 'braids');
  assert.equal(restored.displayName, 'Amaka');
});

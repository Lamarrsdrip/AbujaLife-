import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore, jobs, catalog, properties } from '../src/server/gameStore.mjs';
import { GAME_YEAR_MS, GAME_BILL_PERIOD_MS, VENUES, VENUE_ACTIONS } from '../src/shared/life.mjs';

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
  assert.equal(result.profile.wallet, before.wallet - 1800);
  assert.equal(result.profile.hunger, 100);
  assert.equal(result.activity.venueId, 'restaurant');
  assert.throws(() => store.action(id, 'venue-action', { activityId: 'gym-workout' }), /Enter this place/);
  assert.equal(store.profile(id).wallet, result.profile.wallet);
  assert.equal(store.action(id, 'exit-venue').profile.location.kind, 'public');
  assert.ok(VENUES.every(venue => venue.fictional));
  assert.ok(VENUE_ACTIONS.every(activity => VENUES.some(venue => venue.id === activity.venueId)));
});

test('work pays an earned wage and purchased driving still enforces ownership and affordability', async t => {
  const { store, id, advance } = await fixture(t);
  assert.throws(() => store.action(id, 'purchase', { itemId: 'compact-car', price: 0 }), /need more/);
  store.action(id, 'take-job', { jobId: 'restaurant-host' });
  store.action(id, 'leave-home');
  assert.throws(() => store.action(id, 'toggle-driving', { vehicleId: 'used-hatchback' }), /Buy this car/);
  const commute=store.action(id,'travel',{district:jobs['restaurant-host'].district,mode:'bus'}).trip;advance(commute.seconds*1000);store.action(id,'arrive',{tripId:commute.id});const beforeWork=store.profile(id).wallet;
  const { challenge } = store.action(id, 'start-shift');
  advance(2000);
  const earned=store.action(id, 'complete-shift', { challengeId: challenge.id, answers: jobs['restaurant-host'].tasks.map(task => ({ taskId: task.id, optionId: task.answer })) });assert.equal(earned.result.pay,5600);assert.equal(earned.profile.wallet,beforeWork+earned.result.pay);
  const bought = store.action(id, 'purchase', { itemId: 'used-hatchback' }).profile;
  assert.equal(bought.wallet, earned.profile.wallet - 28000);
  assert.equal(bought.drivingVehicle, null);
  const driving = store.action(id, 'toggle-driving', { vehicleId: 'used-hatchback' }).profile;
  assert.equal(driving.drivingVehicle, 'used-hatchback');
  assert.throws(() => store.action(id, 'enter-venue', { venueId: 'hotel' }), /Park your car/);
  const quote = store.quoteTravel(id, { district: 'jabi', mode: 'car' });
  assert.ok(quote.cost > 0);
  const { trip } = store.action(id, 'travel', { district: 'jabi', mode: 'car' });
  assert.equal(trip.vehicleId, 'used-hatchback');
  assert.equal(store.profile(id).drivingVehicle, null);
  advance(trip.seconds * 1000);
  assert.equal(store.action(id, 'arrive', { tripId: trip.id }).profile.drivingVehicle, 'used-hatchback');
  assert.equal(store.action(id, 'toggle-driving', { vehicleId: null }).profile.drivingVehicle, null);
  store.action(id, 'enter-venue', { venueId: 'hotel' });
  assert.throws(() => store.action(id, 'toggle-driving', { vehicleId: 'used-hatchback' }), /Head out/);
  assert.equal(catalog.find(item => item.id === 'compact-car').price, 240000);
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
  assert.deepEqual(placed.furnitureLayout['dining-table'], { x: .375, y: .625, rotation: 90 });
  f.store.action(f.id, 'leave-home');
  assert.throws(() => f.store.action(f.id, 'place-furniture', { itemId: 'dining-table', x: .5, y: .5 }), /Go home/);
  f.reopen();
  assert.deepEqual(f.store.profile(f.id).furnitureLayout, placed.furnitureLayout);
  assert.equal(f.store.profile(f.id).wallet, starting - 4200);
});

test('rent covers a game year while weekly service charges never charge annual rent again', async t => {
  const { store, id, advance } = await fixture(t);
  const starting=store.profile(id).wallet;
  const home = properties.find(property => property.id === 'lugbe-flat');
  const moved = store.action(id, 'move-home', { propertyId: home.id, tenure: 'rent' }).profile;
  assert.equal(moved.wallet, starting - 18000);
  assert.equal(moved.home.rentDueAt, moved.rentPaidAt + GAME_YEAR_MS);
  assert.throws(() => store.action(id, 'pay-bills'), /up to date/);
  advance(GAME_BILL_PERIOD_MS);
  const serviced = store.action(id, 'pay-bills').profile;
  assert.equal(serviced.wallet, moved.wallet - home.bills);
  assert.throws(() => store.action(id, 'renew-rent'), /already paid/);
  advance(GAME_YEAR_MS - GAME_BILL_PERIOD_MS);
  const renewed = store.action(id, 'renew-rent').profile;
  assert.equal(renewed.wallet, serviced.wallet - home.rent);
  assert.equal(renewed.home.rentDueAt, renewed.rentPaidAt + GAME_YEAR_MS);
  assert.throws(() => store.action(id, 'renew-rent'), /already paid/);
});

test('character onboarding persists choices without accepting inventory or life-state forgery', async t => {
  const f = await fixture(t);
  const starting=f.store.profile(f.id).wallet;
  const profile = f.store.updateProfile(f.id, {
    displayName: 'Amaka', lifeGoal: 'home', onboardingComplete: true,
    appearance: { hair: 'braids', skinTone: 'deep', top: 'ochre' },
    wallet: 9000000, drivingVehicle: 'premium-suv', furnitureLayout: { sofa: { x: 0, y: 0 } }, inventory: ['premium-suv'],
  });
  assert.equal(profile.wallet, starting);
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

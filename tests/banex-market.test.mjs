import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore, catalog } from '../src/server/gameStore.mjs';
import { ABUJA_ATLAS } from '../src/shared/atlas.mjs';
import { venueFor, venueAvailable, venuesForDistrict } from '../src/shared/life.mjs';
import { buildCity } from '../app/world-city.js';
import { buildInterior } from '../app/world-interiors.js';

// Run the actual walking navigation without constructing a DOM or WebGL renderer.
// The in-memory export leaves the production module and its public API untouched.
const worldURL = new URL('../app/world.js', import.meta.url);
const navigationSource = fs.readFileSync(worldURL, 'utf8').replace(
  /from (['"])(\.{1,2}\/[^'"]+)\1/g,
  (_, quote, specifier) => `from ${JSON.stringify(new URL(specifier, worldURL).href)}`,
) + '\nexport { makeNavigation as navigationForTest };';
const { navigationForTest } = await import(`data:text/javascript;base64,${Buffer.from(navigationSource).toString('base64')}`);

const district = 'wuse-ii-a08';
function banex() {
  const venue = venueFor('banex');
  assert.ok(venue, 'Banex is registered in the shared venue catalogue');
  return venue;
}

function assertReachable(scene, targets) {
  const navigation = navigationForTest(scene);
  assert.equal(navigation.contains(scene.spawn.x, scene.spawn.y), false, 'the arrival point is clear for a resident');
  for (const point of targets) {
    const route = navigation.path(scene.spawn, point);
    assert.ok(route.length, `${point.id}: a walking route exists from arrival`);
    assert.ok(Math.hypot(route.at(-1).x - point.x, route.at(-1).y - point.y) < (point.radius || 66), `${point.id}: the route reaches interaction range`);
    let previous = scene.spawn;
    for (const waypoint of route) {
      assert.equal(navigation.contains(waypoint.x, waypoint.y), false, `${point.id}: waypoints avoid solid fixtures`);
      assert.equal(navigation.clear(previous, waypoint), true, `${point.id}: movement does not cut through a wall or counter`);
      previous = waypoint;
    }
  }
}

async function fixture(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-banex-'));
  let now = Date.parse('2026-10-05T10:00:00Z');
  const store = new GameStore({ dataDir, clock: () => now, originRandomInt: (min, max) => max === 2 ? 1 : 0 });
  t.after(() => { store.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const { residentId: id } = await store.register({ username: 'banex_player', password: 'a-test-password' });
  return { store, id, advance: milliseconds => { now += milliseconds; } };
}

test('Banex belongs to Wuse II retail A08 and publishes authored scenery without invented geography', () => {
  const venue = banex();
  assert.equal(venue.name, 'Banex Tech Market');
  assert.equal(venue.type, 'tech-market');
  assert.equal(venue.fictional, true);
  assert.deepEqual(venue.districts, [district]);
  assert.equal(ABUJA_ATLAS.find(place => place.id === district)?.name, 'Wuse II');
  for (const place of ABUJA_ATLAS) {
    assert.equal(venueAvailable(venue.id, place.id), place.id === district, place.id);
    assert.equal(venuesForDistrict(place.id).some(item => item.id === venue.id), place.id === district, place.id);
  }
  for (const field of ['lat', 'lng', 'latitude', 'longitude', 'coordinates', 'address', 'streetAddress']) {
    assert.ok(venue[field] == null, `${field} must not invent a real-world location`);
  }
});

test('the Wuse II city has a reachable Banex entrance and other districts do not expose one', () => {
  banex();
  for (const current of [district, 'wuse-ii-a07', 'garki-i']) {
    const place = ABUJA_ATLAS.find(item => item.id === current);
    const scene = buildCity({ profile: { district: current }, place, venues: venuesForDistrict(current) });
    const entrance = scene.interactables.find(point => point.payload?.venueId === 'banex');
    const facade = scene.buildings.find(building => building.id === 'banex');
    if (current === district) {
      assert.ok(entrance);
      assert.ok(facade);
      assert.equal(entrance.action, 'enter-venue');
      assert.match(scene.art, /data-world-target="banex"/);
      assertReachable(scene, [entrance]);
    } else {
      assert.equal(entrance, undefined);
      assert.equal(facade, undefined);
    }
  }
});

test('Banex arrival, browsing and exit remain walkable around every solid market fixture', () => {
  const scene = buildInterior({ profile: { district, location: { kind: 'venue', district, venue: 'banex' } }, venue: banex() });
  assert.equal(scene.title, 'Banex Tech Market');
  const browse = scene.interactables.filter(point => point.action === 'banex-market');
  assert.ok(browse.length, 'the market offers its technology browsing interaction');
  assert.ok(scene.interactables.some(point => point.action === 'exit-venue'));
  for (const point of browse) assert.equal(point.payload.venueId, 'banex');
  assertReachable(scene, scene.interactables);
  const navigation = navigationForTest(scene);
  const marketFixtures = scene.objects.filter(object => object.kind.startsWith('tech-'));
  assert.ok(marketFixtures.length >= 8, 'the room contains distinct original market counters and stock');
  for (const kind of ['tech-laptop-stall', 'tech-console-stall', 'tech-accessory-stall', 'tech-repair-bench', 'tech-power-stall', 'tech-parts-shelf']) {
    assert.ok(marketFixtures.some(object => object.kind === kind), `${kind} has its own market fixture`);
  }
  for (const fixture of marketFixtures) {
    assert.equal(fixture.solid, true, 'residents walk around the counters instead of through displayed stock');
    assert.ok(fixture.x >= 0 && fixture.y >= 0 && fixture.x + fixture.w <= scene.width && fixture.y + fixture.h <= scene.height);
    assert.ok(scene.obstacles.some(obstacle => ['x', 'y', 'w', 'h'].every(key => obstacle[key] === fixture[key])), 'visible counters and collision footprints agree');
  }
  assert.ok(scene.pedestrians.length > 0 && scene.pedestrians.length <= 6, 'ambient market visitors remain bounded');
  for (const npc of scene.pedestrians) {
    assert.equal(navigation.contains(npc.x, npc.y), false, 'visitor starts in a clear aisle');
    assert.equal(navigation.contains(npc.toX, npc.toY), false, 'visitor destination stays in a clear aisle');
    assert.ok(navigation.path(npc, { x: npc.toX, y: npc.toY }).length, 'visitor can walk between aisle anchors');
  }
});

test('server travel enforces the Banex district and arrival supports existing catalogue purchases and exit', async t => {
  banex();
  const { store, id, advance } = await fixture(t);
  store.action(id, 'leave-home');
  const original = store.profile(id);
  assert.throws(() => store.action(id, 'enter-venue', { venueId: 'banex' }), /Choose a place/);
  assert.throws(() => store.quoteTravel(id, { district: 'wuse-ii-a07', mode: 'bus', venueId: 'banex' }), /Choose a place/);
  assert.throws(() => store.action(id, 'travel', { district: 'wuse-ii-a07', mode: 'bus', venueId: 'banex', cost: 0 }), /Choose a place/);
  assert.equal(store.profile(id).wallet, original.wallet);
  assert.deepEqual(store.profile(id).location, original.location);
  const quote = store.quoteTravel(id, { district, mode: 'bus', venueId: 'banex' });
  const { trip, profile: departed } = store.action(id, 'travel', { district, mode: 'bus', venueId: 'banex', cost: 0, seconds: 0 });
  assert.equal(trip.venueId, 'banex');
  assert.equal(trip.cost, quote.cost);
  assert.equal(trip.seconds, quote.seconds);
  assert.equal(departed.wallet, original.wallet - quote.cost);
  assert.throws(() => store.action(id, 'arrive', { tripId: trip.id }), error => error.code === 'trip_in_progress');
  advance(trip.seconds * 1000);
  const arrived = store.action(id, 'arrive', { tripId: trip.id }).profile;
  assert.deepEqual(arrived.location, { kind: 'venue', district, venue: 'banex' });
  assert.equal(arrived.activeTrip, null);
  const item = catalog.find(product => product.id === 'gaming-console');
  assert.ok(item, 'the market uses an existing technology product');
  const purchased = store.action(id, 'purchase', { itemId: item.id, price: 0 }).profile;
  assert.equal(purchased.wallet, arrived.wallet - item.price);
  assert.ok(purchased.inventory.includes(item.id));
  const exited = store.action(id, 'exit-venue').profile;
  assert.equal(exited.location.kind, 'public');
  assert.equal(exited.district, district);
  const returned = store.action(id, 'enter-venue', { venueId: 'banex' }).profile;
  assert.deepEqual(returned.location, { kind: 'venue', district, venue: 'banex' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore } from '../src/server/gameStore.mjs';
import { venuesForDistrict } from '../src/shared/life.mjs';
import { buildCity } from '../app/world-city.js';
import { worldEntryState } from '../app/world-spawn.js';

function city(profile) {
  return buildCity({ profile, venues: venuesForDistrict(profile.district) });
}

test('paid Abuja Car arrival exits onto its own street, keeps walking through reload, and enters home only explicitly', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abujalife-exterior-'));
  let now = Date.parse('2026-10-05T09:00:00Z');
  let store = new GameStore({ dataDir, clock: () => now, originRandomInt: (min, max) => max === 2 ? 1 : 0 });
  t.after(() => { store.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const { residentId } = await store.register({ username: 'exterior_player', password: 'secure-test-password' });
  const origin = store.profile(residentId);
  store.action(residentId, 'leave-home');
  const originalCity = city(store.profile(residentId));
  const oldPublicPose = { ...originalCity.spawn, cameraX: originalCity.spawn.x, cameraY: originalCity.spawn.y };
  const { trip } = store.action(residentId, 'travel', { district: origin.district, mode: 'bus', venueId: 'dealership' });
  now += trip.seconds * 1000;
  assert.equal(store.action(residentId, 'arrive', { tripId: trip.id }).profile.location.venue, 'dealership');
  const exited = store.action(residentId, 'exit-venue', { venueId: 'home', exteriorEntry: { venueId: 'home', transitionId: 'forged' } }).profile;
  assert.equal(exited.location.kind, 'public');
  assert.equal(exited.district, origin.district);
  assert.equal(exited.home.propertyId, origin.home.propertyId);
  assert.equal(exited.wallet, origin.wallet - trip.cost);
  assert.equal(exited.location.exteriorEntry.venueId, 'dealership');
  assert.notEqual(exited.location.exteriorEntry.transitionId, 'forged');
  const scene = city(exited);
  const door = scene.interactables.find(point => point.payload?.venueId === 'dealership');
  const entry = worldEntryState(scene, exited, oldPublicPose);
  assert.equal(entry.saved, undefined, 'the earlier home-street pose does not teleport the resident home');
  assert.deepEqual(entry.spawn, { x: door.x, y: door.y });
  assert.ok(Math.hypot(entry.spawn.x - originalCity.spawn.x, entry.spawn.y - originalCity.spawn.y) > 500);
  assert.ok(!scene.obstacles.some(obstacle => entry.spawn.x >= obstacle.x && entry.spawn.x <= obstacle.x + obstacle.w && entry.spawn.y >= obstacle.y && entry.spawn.y <= obstacle.y + obstacle.h), 'the dealership doorstep is outside solid scenery');
  const walkedPose = { x: door.x + 100, y: door.y + 20, cameraX: door.x + 100, cameraY: door.y + 20, exteriorTransition: entry.exteriorTransition };
  store.close();
  store = new GameStore({ dataDir, clock: () => now });
  const reloaded = store.profile(residentId);
  assert.deepEqual(reloaded.location, exited.location, 'the authoritative exit survives backend restart');
  assert.deepEqual(worldEntryState(city(reloaded), reloaded, walkedPose).saved, walkedPose, 'a consumed transition retains subsequent street walking');
  store.action(residentId, 'enter-venue', { venueId: 'dealership' });
  const nextExit = store.action(residentId, 'exit-venue').profile;
  assert.notEqual(nextExit.location.exteriorEntry.transitionId, entry.exteriorTransition);
  assert.equal(worldEntryState(city(nextExit), nextExit, walkedPose).saved, undefined, 'a later visit returns to this door again');
  const home = store.action(residentId, 'return-home', { mode: 'walk' }).profile;
  assert.equal(home.location.kind, 'home');
  assert.equal(home.location.exteriorEntry, undefined);
  assert.equal(home.home.propertyId, origin.home.propertyId);
});

test('legacy, unknown and interior spawn hints retain their existing scene positions', () => {
  const profile = { district: 'lugbe', location: { kind: 'public', district: 'lugbe', venue: 'neighbourhood' } };
  const scene = city(profile), saved = { x: 800, y: 1020 };
  for (const location of [profile.location, { ...profile.location, exteriorEntry: { venueId: 'unlisted', transitionId: 'missing-door' } }, { ...profile.location, exteriorEntry: { venueId: 'dealership', transitionId: '' } }, { kind: 'home', exteriorEntry: { venueId: 'dealership', transitionId: 'interior' } }]) {
    const entry = worldEntryState(scene, { ...profile, location }, saved);
    assert.equal(entry.saved, saved);
    assert.equal(entry.spawn, scene.spawn);
    assert.equal(entry.exteriorTransition, null);
  }
});

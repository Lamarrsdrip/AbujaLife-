import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCity } from '../app/world-city.js';
import { SIDEWALK_TREES, PARK_FOUNTAIN, landmarkStreetPoint } from '../app/world-city-base.js';
import { makeNavigation } from '../app/world-navigation.js';
import { roadRects, ROUNDABOUTS, BOULEVARDS, AVENUES } from '../src/shared/city-roads.mjs';
import { CITY_ROADS } from '../app/world-city-fabric.js';
import { venuesForDistrict } from '../src/shared/life.mjs';
import { ABUJA_ATLAS } from '../src/shared/atlas.mjs';
import { CITY_LANDMARKS } from '../src/shared/city-landmarks.mjs';
import { WORLD_LANDMARK_SIZES } from '../src/shared/world-landmark-sizes.mjs';

const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const cityFor = id => buildCity({ profile: { district: id }, place: { id, name: id }, id: 't', venues: venuesForDistrict(id) });

// Everything the WebGL street draws as a solid body, in collision coordinates.
function renderedSolids(scene) {
  return [
    ...scene.buildings.map(b => ({ x: b.x, y: b.frontY === false ? b.y : b.y - b.h, w: b.w, h: b.h })),
    ...scene.fabric.blocks.map(b => ({ x: b.x, y: b.y - b.h, w: b.w, h: b.h })),
    ...scene.fabric.kiosks,
    ...SIDEWALK_TREES.map(([x, y]) => ({ x: x - 12, y: y - 14, w: 24, h: 28 })),
    PARK_FOUNTAIN,
    ...(scene.waterBodies || []),
  ];
}

test('the 3D street, fabric and collision share one road network', () => {
  assert.equal(CITY_ROADS.horizontal, BOULEVARDS);
  assert.equal(CITY_ROADS.vertical, AVENUES);
});

test('every collider in every district has visible geometry (no invisible walls)', () => {
  for (const { id } of ABUJA_ATLAS) {
    const scene = cityFor(id), solids = renderedSolids(scene);
    for (const o of scene.obstacles) {
      if (o.roundabout) continue;
      const covered = solids.reduce((sum, r) => sum + overlap(o, r), 0);
      assert.ok(covered >= o.w * o.h * .6, `${id}: collider ${JSON.stringify(o)} has no drawn body`);
    }
  }
});

test('no collider stands on a carriageway except roundabout islands', () => {
  const roads = roadRects();
  for (const { id } of ABUJA_ATLAS) {
    for (const o of cityFor(id).obstacles) {
      if (o.roundabout) continue;
      for (const road of roads) assert.equal(overlap(o, road), 0, `${id}: ${JSON.stringify(o)} blocks the road at ${JSON.stringify(road)}`);
    }
  }
});

test('a car can drive the full length of every lane of every road in every district', () => {
  const lanes = [
    ...BOULEVARDS.flatMap(([y, h]) => (h > 200 ? [y + 40, y + h - 40] : [y + h / 2]).map(lane => ({ axis: 'x', lane }))),
    ...AVENUES.filter(([x]) => x < 11200).flatMap(([x, w]) => (w > 200 ? [x + 40, x + w - 40] : [x + w / 2]).map(lane => ({ axis: 'y', lane }))),
  ];
  for (const { id } of ABUJA_ATLAS) {
    const scene = cityFor(id), nav = makeNavigation(scene, 24);
    for (const { axis, lane } of lanes) {
      const extent = axis === 'x' ? scene.width : scene.height;
      for (let t = 60; t < extent - 60; t += 8) {
        const [x, y] = axis === 'x' ? [t, lane] : [lane, t];
        assert.equal(nav.contains(x, y), false, `${id}: car stopped by an invisible blocker at (${x}, ${y}) on the ${axis === 'x' ? 'boulevard' : 'avenue'} lane ${lane}`);
      }
    }
  }
});

test('roundabout islands are solid and drawn, and traffic lanes pass around them', () => {
  const scene = cityFor('central-area'), nav = makeNavigation(scene, 24);
  for (const r of ROUNDABOUTS) {
    assert.equal(nav.contains(r.x, r.y), true, `${r.id} island is solid`);
    for (const car of scene.traffic) {
      const d = car.axis === 'x' ? Math.abs(car.lane - r.y) : Math.abs(car.lane - r.x);
      assert.ok(d > r.island * .8 + 18, `ambient traffic lane ${car.lane} drives through ${r.id}`);
    }
  }
});

test('landmarks sit inside blocks and every door can be walked to from the spawn', () => {
  const roads = roadRects();
  for (const landmark of CITY_LANDMARKS) {
    const p = landmarkStreetPoint(landmark.id), [w, h] = WORLD_LANDMARK_SIZES[landmark.builder] || [390, 280];
    const footprint = { x: p.x - w / 2 - 7, y: p.y - h / 2 - 8, w: w + 14, h: h + 18 };
    assert.ok(roads.every(road => overlap(footprint, road) === 0), `${landmark.id} straddles a road`);
  }
  const scene = cityFor('wuse-ii-a07'), nav = makeNavigation(scene, 10);
  for (const point of scene.interactables.filter(p => CITY_LANDMARKS.some(l => l.id === p.id))) {
    const route = nav.path(scene.spawn, point);
    assert.ok(route.length, `${point.id} entrance is unreachable on foot`);
  }
});

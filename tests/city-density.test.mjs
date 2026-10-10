import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { buildCity } from '../app/world-city-base.js';
import { CITY_ROADS, districtCharacter, generateCityFabric, buildCityFabric, fabricBlockHeight } from '../app/world-city-fabric.js';
import { createLayout } from '../app/outside-city-v4.js';
import { generateMapDetail, mapRoadWidth, MAP_ROAD_WIDTH } from '../app/map-city-detail.js';
import { MAP_BILLBOARD, billboardShape } from '../app/map-billboard.js';
import { createMapAdDisplays } from '../app/map-ad-displays.js';
import { ABUJA_ATLAS } from '../src/shared/atlas.mjs';
import { VENUES, venueAvailable } from '../src/shared/life.mjs';
import { abujaNavigationNodes, abujaNavigationEdges } from '../src/shared/abuja-navigation.mjs';
import { MAP_AD_PROTECTED_ROADS } from '../src/shared/map-ad-land.mjs';
import { MAP_AD_INVENTORY } from '../src/shared/advertising.mjs';
import { STREET_VIEW } from '../app/world-street-camera.js';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const DISTRICTS = ['lugbe', 'central-area', 'maitama', 'wuse-ii-a07', 'kubwa'];
const city = id => buildCity({ profile: { district: id, home: { district: id } }, place: { id, name: id }, venues: VENUES.filter(venue => venueAvailable(venue.id, id)) });
const overlap = (a, b, m = 0) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;

test('each district street is filled with buildings in its own character', () => {
  assert.equal(districtCharacter('central-area'), 'core'); assert.equal(districtCharacter('wuse-ii-a07'), 'commercial');
  assert.equal(districtCharacter('maitama'), 'affluent'); assert.equal(districtCharacter('lugbe'), 'satellite'); assert.equal(districtCharacter('somewhere-new'), 'satellite');
  const counts = {};
  for (const id of DISTRICTS) {
    const scene = city(id), fabric = scene.fabric; counts[id] = fabric.blocks.length;
    assert.ok(fabric.blocks.length >= 70, `${id} has ${fabric.blocks.length} extra buildings`);
    assert.ok(fabric.trees.length >= 100 && fabric.lamps.length >= 300, `${id} has street trees and lights`);
    assert.deepEqual(city(id).fabric.blocks.map(b => [b.x, b.y, b.w, b.h, b.floors]), fabric.blocks.map(b => [b.x, b.y, b.w, b.h, b.floors]), 'the same district always generates the same streets');
  }
  const average = id => { const blocks = city(id).fabric.blocks; return blocks.reduce((sum, b) => sum + b.floors, 0) / blocks.length; };
  assert.ok(average('central-area') > average('wuse-ii-a07') && average('wuse-ii-a07') > average('lugbe'), 'the centre is tallest, satellite towns lowest');
  assert.ok(average('maitama') <= 2, 'Maitama is low-rise villas');
  assert.ok(counts.lugbe > counts.maitama, 'satellite towns are denser than villa districts');
});

test('new buildings never cover a road, an authored building or the way to a door', () => {
  for (const id of DISTRICTS) {
    const scene = city(id), fabric = scene.fabric, authored = scene.obstacles.filter(o => !o.fabric);
    const roads = [...CITY_ROADS.horizontal.map(([y, h]) => ({ x: 0, y, w: scene.width, h })), ...CITY_ROADS.vertical.map(([x, w]) => ({ x, y: 0, w, h: scene.height }))];
    const footprints = fabric.blocks.map(b => ({ x: b.x, y: b.y - b.h, w: b.w, h: b.h }));
    for (const [index, rect] of footprints.entries()) {
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= scene.width && rect.y + rect.h <= scene.height);
      assert.ok(!roads.some(road => overlap(rect, road)), `${id} block ${index} sits on a road`);
      assert.ok(!authored.some(o => overlap(rect, o)), `${id} block ${index} overlaps an authored building`);
      for (let other = index + 1; other < footprints.length; other++) assert.ok(!overlap(rect, footprints[other]), `${id} blocks ${index}/${other} overlap`);
    }
    for (const point of scene.interactables) assert.ok(![...footprints, ...fabric.kiosks].some(rect => point.x > rect.x - 20 && point.x < rect.x + rect.w + 20 && point.y > rect.y - 20 && point.y < rect.y + rect.h + 120), `${id}: ${point.id} approach is blocked`);
  }
});

test('every door and marker is still reachable on foot from the spawn point', () => {
  for (const id of ['lugbe', 'central-area']) {
    const scene = city(id), step = 26, cols = Math.ceil(scene.width / step), rows = Math.ceil(scene.height / step), blocked = new Uint8Array(cols * rows), r = 10;
    for (const o of scene.obstacles) for (let gy = Math.max(0, Math.floor((o.y - r) / step)); gy <= Math.min(rows - 1, Math.floor((o.y + o.h + r) / step)); gy++) for (let gx = Math.max(0, Math.floor((o.x - r) / step)); gx <= Math.min(cols - 1, Math.floor((o.x + o.w + r) / step)); gx++) {
      const cx = (gx + .5) * step, cy = (gy + .5) * step; if (cx > o.x - r && cx < o.x + o.w + r && cy > o.y - r && cy < o.y + o.h + r) blocked[gy * cols + gx] = 1;
    }
    const seen = new Uint8Array(cols * rows), start = Math.floor(scene.spawn.y / step) * cols + Math.floor(scene.spawn.x / step), queue = [start]; seen[start] = 1;
    for (let head = 0; head < queue.length; head++) { const cell = queue[head], x = cell % cols, y = (cell - x) / cols; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, next = ny * cols + nx; if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1 || seen[next] || blocked[next]) continue; seen[next] = 1; queue.push(next); } }
    for (const point of scene.interactables) {
      let reached = false; const radius = Math.ceil((point.radius || 76) / step);
      const px = Math.floor(point.x / step), py = Math.floor(point.y / step);
      for (let dy = -radius; dy <= radius && !reached; dy++) for (let dx = -radius; dx <= radius; dx++) { const x = px + dx, y = py + dy; if (x >= 0 && y >= 0 && x < cols && y < rows && seen[y * cols + x]) { reached = true; break; } }
      assert.ok(reached, `${id}: ${point.id} cannot be reached from the spawn point`);
    }
  }
});

test('the 3D fabric is a handful of instanced draws with lit windows after dark', () => {
  const fabric = generateCityFabric({ placeId: 'wuse-ii-a07' }), built = buildCityFabric(THREE, fabric, {});
  assert.ok(built.stats.drawCalls <= 16, `${built.stats.drawCalls} draw calls`);
  let instances = 0; built.group.traverse(node => { if (node.isInstancedMesh) { instances += node.count; assert.ok(node.count <= node.instanceMatrix.count, 'no instance buffer overflows'); } });
  assert.ok(instances > fabric.blocks.length * 4);
  const lit = []; built.group.traverse(node => { if (node.material?.emissive && node.material.emissive.getHex() !== 0) lit.push(node.material); });
  assert.ok(lit.length >= 2); built.update({ night: false }); assert.ok(lit.every(material => material.emissiveIntensity === 0));
  built.update({ night: true }); assert.ok(lit.every(material => material.emissiveIntensity > 0), 'windows and street lights come on at night');
  assert.ok(fabricBlockHeight({ floors: 10 }) > fabricBlockHeight({ floors: 2 }) * 3);
  const light = buildCityFabric(THREE, fabric, { light: true }); let lightInstances = 0; light.group.traverse(node => { if (node.isInstancedMesh) lightInstances += node.count; });
  assert.ok(lightInstances < instances, 'phones draw fewer window strips'); built.dispose(); light.dispose();
});

test('street view draws vehicles at building scale, with Abuja taxis and keke outside the centre', () => {
  assert.ok(STREET_VIEW.vehicleScale > .7 && STREET_VIEW.vehicleScale < .85);
  const types = id => city(id).traffic.map(vehicle => vehicle.type || 'sedan');
  assert.ok(types('lugbe').includes('keke') && types('kubwa').includes('keke'), 'satellite towns have tricycles');
  assert.ok(!types('central-area').includes('keke') && !types('maitama').includes('keke'), 'city-centre districts do not');
  for (const id of DISTRICTS) { const taxis = city(id).traffic.filter(vehicle => vehicle.type === 'taxi'); assert.ok(taxis.length >= 2 && taxis.every(taxi => taxi.color === '#1f7a4a'), 'green city taxis'); assert.ok(city(id).traffic.length >= 10); }
  const scenes = read('app/world-3d-scenes.js');
  assert.match(scenes, /function kekeModel\(/); assert.match(scenes, /if\(car\.group\.scale\.x!==vehicleScale\)car\.group\.scale\.setScalar\(vehicleScale\);/);
  assert.match(read('app/world-3d.js'), /vehicleScale:streetOn\?STREET_VIEW\.vehicleScale:1/, 'the overview keeps its original vehicle size');
});

test('the Map is a dense city: housing by district, forests, roundabouts, rocks and ground names', () => {
  const layout = createLayout(ABUJA_ATLAS, VENUES, { district: 'lugbe' }), nodes = new Map(abujaNavigationNodes().map(node => [node.id, { x: node.x, z: node.y }]));
  const roads = abujaNavigationEdges().map(edge => ({ a: nodes.get(edge.a), b: nodes.get(edge.b), roadClass: edge.roadClass })).filter(road => road.a && road.b);
  const started = performance.now(), detail = generateMapDetail({ layout, roads }), elapsed = performance.now() - started;
  assert.ok(detail.houses.length > 2000, `${detail.houses.length} houses`); assert.ok(detail.trees.length > 1500); assert.ok(detail.roundabouts.length >= 10); assert.ok(detail.labels.length >= 20);
  assert.deepEqual(detail.rocks.map(rock => rock.id), ['aso-rock', 'zuma-rock']);
  assert.ok(elapsed < 4000, `generation took ${Math.round(elapsed)} ms`);
  // No house or tree stands on any advertising plot.
  for (const item of [...detail.houses, ...detail.trees]) for (const plot of layout.adPlots) assert.ok(!(Math.abs(item.x - plot.x) < plot.w / 2 && Math.abs(item.z - plot.z) < plot.d / 2), 'scenery on an advertising plot');
  // No house stands on a road.
  for (const house of detail.houses) for (const road of roads) { const dx = road.b.x - road.a.x, dz = road.b.z - road.a.z, l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((house.x - road.a.x) * dx + (house.z - road.a.z) * dz) / l)) : 0; assert.ok(Math.hypot(house.x - road.a.x - dx * t, house.z - road.a.z - dz * t) >= mapRoadWidth(road.roadClass) / 2, 'house on a road'); }
  assert.ok(generateMapDetail({ layout, roads, light: true }).houses.length < detail.houses.length, 'phones draw a lighter city');
  // Wider roads still sit inside the clearance every advertising plot keeps from a road centre.
  assert.equal(MAP_ROAD_WIDTH.major, 72); assert.equal(MAP_ROAD_WIDTH.minor, 60);
  for (const road of MAP_AD_PROTECTED_ROADS) { const width = road.clearance === 42 / 2 + 32 ? MAP_ROAD_WIDTH.major : MAP_ROAD_WIDTH.minor; assert.ok(width * .65 + 4.5 <= road.clearance, 'road and kerb stay inside the ad clearance'); }
  const map = read('app/outside-city-v4.js');
  assert.match(map, /road\(world,a,b,mapRoadWidth\(edge\.roadClass\)\)/); assert.match(map, /mapDetailCache/); assert.match(map, /view\.zoom=target\.zoom=clamp\(base\/3600,\.82,6\)/, 'opens framed on the city');
});

test('advertising placements stand up as roadside billboards', () => {
  const standard = billboardShape(MAP_AD_INVENTORY[0]), mega = billboardShape({ format: 'roadside-billboard', width: 240, height: 120 });
  assert.equal(standard.mega, false); assert.equal(mega.mega, true); assert.ok(mega.width > standard.width && mega.lift > standard.lift);
  for (const shape of [standard, mega]) { assert.ok(Math.abs(shape.height / shape.width - MAP_BILLBOARD.aspect) < 1e-9); assert.ok(shape.width >= 120 && shape.width <= 360); }
  const world = new THREE.Group(), camera = new THREE.OrthographicCamera(-6000, 6000, 4500, -4500, 1, 20000); camera.position.set(0, 9000, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const ads = createMapAdDisplays(world, { now: () => 1000, decode: async () => ({ width: 640, height: 360 }), makeCanvas: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) });
  ads.update({ active: [{ txRef: 'board', slots: [MAP_AD_INVENTORY[0].id], endAt: 9e9, imageDataUrl: 'data:image/png;base64,fixture' }] }); ads.setView(camera, { width: 1440, height: 900 }); world.updateMatrixWorld(true);
  const parts = []; ads.group.traverse(node => { if (node.isMesh) parts.push(node); });
  assert.equal(new Set(parts.map(part => part.userData.adSpaceId)).size, 1, 'every part of the board identifies its placement for taps');
  assert.ok(parts.length >= 5, 'plinth, frame, face and two posts');
  const face = parts.find(part => part.geometry.type === 'PlaneGeometry'), normal = new THREE.Vector3(0, 0, 1).transformDirection(face.matrixWorld), centre = new THREE.Vector3().setFromMatrixPosition(face.matrixWorld);
  assert.ok(normal.y > .2 && normal.y < .7, `the face leans back toward the high camera (normal.y=${normal.y})`);
  assert.ok(centre.y > standard.lift, 'the face stands above the ground on its posts');
  assert.ok(Math.abs(face.scale.x / face.scale.y - 1 / MAP_BILLBOARD.aspect) < .01, 'a 16:9 face');
  ads.dispose(); assert.equal(world.children.length, 0);
});

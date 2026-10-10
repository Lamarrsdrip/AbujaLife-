import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { WORLD_CAMERA, screenVectorToWorld } from '../app/world-camera.js';
import { STREET_VIEW, streetCameraPose, streetPoseAtDistance, streetFollowYaw, streetPitch, streetFieldOfView, streetProfile, easeYaw, readStreetPreference, writeStreetPreference } from '../app/world-street-camera.js';
import { createStreetBackdrop, skyPalette } from '../app/world-skyline.js';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const DS = WORLD_CAMERA.depthScale;
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≉ ${b}`);

test('street camera sits behind the resident on the same axes the joystick uses', () => {
  for (const yaw of [0, .54, 1.9, -2.4]) {
    const player = {x: 620, y: 410}, pose = streetCameraPose({player, yaw});
    // Joystick "up" in world 2D, converted to the 3D ground plane.
    const forward2d = screenVectorToWorld({x: 0, y: -1}, true, {yaw, elevation: WORLD_CAMERA.elevation});
    const forward = new THREE.Vector2(forward2d.x, forward2d.y * DS).normalize();
    const view = new THREE.Vector2(pose.target.x - pose.position.x, pose.target.z - pose.position.z).normalize();
    near(forward.dot(view), 1, 1e-9);
    near(pose.target.x, player.x); near(pose.target.z, player.y * DS);
    assert.ok(pose.position.y > pose.target.y, 'the eye is above the look-at point');
  }
});

test('a perspective camera built from the pose keeps the resident centred and upright', () => {
  const pose = streetCameraPose({player: {x: 300, y: 500}, yaw: .7});
  const camera = new THREE.PerspectiveCamera(streetFieldOfView(390 / 719), 390 / 719, STREET_VIEW.near, STREET_VIEW.far);
  camera.position.set(pose.position.x, pose.position.y, pose.position.z); camera.lookAt(pose.target.x, pose.target.y, pose.target.z); camera.updateMatrixWorld(true);
  const head = new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z).project(camera), feet = new THREE.Vector3(pose.target.x, 0, pose.target.z).project(camera);
  near(head.x, 0, 1e-6); near(head.y, 0, 1e-6);
  assert.ok(feet.y < 0 && feet.y > -1, 'feet are on screen below the centre');
  assert.ok(head.z > -1 && head.z < 1, 'the resident is inside the clip range');
});

test('follow yaw places the camera behind the direction of travel', () => {
  for (const angle of [0, 90, 180, -90, 37]) {
    const yaw = streetFollowYaw(angle), heading = new THREE.Vector2(Math.cos(angle * Math.PI / 180), Math.sin(angle * Math.PI / 180) * DS).normalize();
    const pose = streetCameraPose({player: {x: 0, y: 0}, yaw});
    const view = new THREE.Vector2(-pose.position.x, -pose.position.z).normalize();
    near(heading.dot(view), 1, 1e-9);
  }
  near(easeYaw(3.1, -3.1, 1), 3.1 + (2 * Math.PI - 6.2), 1e-9);
  near(easeYaw(.2, 1.2, .5), .7, 1e-9);
});

test('a building behind the resident lifts the eye over the rooftops instead of closing in', () => {
  const player = {x: 500, y: 500}, open = streetCameraPose({player, yaw: 0});
  // A building directly behind the resident (camera sits at +y for yaw 0).
  const blocked = (x, y) => y > 500 + 90;
  const lifted = streetCameraPose({player, yaw: 0, blocked});
  assert.equal(open.raised, false);
  assert.equal(lifted.raised, true);
  near(lifted.distance, open.distance, 1e-9);
  assert.ok(lifted.pitch >= STREET_VIEW.overPitch && lifted.pitch > open.pitch, 'the lifted camera looks down over the roof');
  assert.ok(lifted.position.y > 250, `eye height ${lifted.position.y} clears a two-storey building`);
  near(lifted.target.x, open.target.x); near(lifted.target.z, open.target.z);
  // Driving sits further back and so ends up higher still.
  assert.ok(streetCameraPose({player, yaw: 0, blocked, driving: true}).position.y > lifted.position.y);
  const eased = streetPoseAtDistance(open, open.distance * .5);
  near(eased.distance, open.distance * .5); near(eased.target.x, open.target.x);
  assert.ok(Math.hypot(eased.position.x - eased.target.x, eased.position.z - eased.target.z) < Math.hypot(open.position.x - open.target.x, open.position.z - open.target.z));
  // Distance and pitch are eased together so the lift never pops.
  const tilted = streetPoseAtDistance(open, open.distance, lifted.pitch);
  near(tilted.position.y, lifted.position.y, 1e-6);
});

test('zoom, pitch and field of view stay inside playable bounds on every screen shape', () => {
  const player = {x: 0, y: 0};
  const far = streetCameraPose({player, zoom: .0001}), close = streetCameraPose({player, zoom: 99});
  near(far.distance, STREET_VIEW.walk.distance / STREET_VIEW.minZoom); near(close.distance, STREET_VIEW.walk.distance / STREET_VIEW.maxZoom);
  assert.equal(streetPitch(WORLD_CAMERA.elevation), STREET_VIEW.walk.pitch);
  assert.equal(streetPitch(WORLD_CAMERA.minElevation - 5), STREET_VIEW.minPitch);
  assert.equal(streetPitch(WORLD_CAMERA.maxElevation + 5), STREET_VIEW.maxPitch);
  assert.equal(streetProfile({driving: true}), STREET_VIEW.drive);
  assert.equal(streetProfile({interior: true}), STREET_VIEW.interior);
  for (const aspect of [320 / 568, 390 / 719, 430 / 932, 1, 16 / 9, 21 / 9, NaN, 0]) {
    const fov = streetFieldOfView(aspect);
    assert.ok(fov >= 50 && fov <= 72, `fov ${fov} for aspect ${aspect}`);
  }
  assert.ok(streetFieldOfView(390 / 719) > streetFieldOfView(16 / 9), 'portrait phones get the taller view');
});

test('view preference defaults to street view, persists, and survives blocked storage', () => {
  const memory = new Map(), storage = {getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value)};
  assert.equal(readStreetPreference(storage), true);
  writeStreetPreference(false, storage); assert.equal(readStreetPreference(storage), false);
  writeStreetPreference(true, storage); assert.equal(readStreetPreference(storage), true);
  const broken = {getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }};
  assert.equal(readStreetPreference(broken), true); assert.doesNotThrow(() => writeStreetPreference(false, broken));
});

test('the horizon is bounded scenery outside the walkable scene', () => {
  const width = 1640, depth = 1500, backdrop = createStreetBackdrop(THREE, {width, depth, seed: 'lugbe', mobile: true});
  assert.equal(backdrop.group.visible, false, 'hidden until street view presents it');
  let meshes = 0, instanced = 0;
  backdrop.group.traverse(node => { if (node.isMesh) meshes++; if (node.isInstancedMesh) instanced++; });
  assert.ok(meshes <= 8, `horizon uses ${meshes} draw calls`); assert.equal(instanced, 2);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
  backdrop.group.traverse(node => {
    if (!node.isInstancedMesh) return;
    for (let i = 0; i < node.count; i++) {
      node.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
      const inside = position.x > 0 && position.x < width && position.z > 0 && position.z < depth;
      assert.equal(inside, false, 'no horizon object stands inside the playable scene');
    }
  });
  const again = createStreetBackdrop(THREE, {width, depth, seed: 'lugbe', mobile: true});
  const a = new THREE.Matrix4(), b = new THREE.Matrix4();
  backdrop.group.children.find(n => n.isInstancedMesh).getMatrixAt(3, a); again.group.children.find(n => n.isInstancedMesh).getMatrixAt(3, b);
  assert.deepEqual(a.elements, b.elements, 'a district keeps the same skyline between visits');
  backdrop.update({daylight: 1, night: true}); assert.equal(`#${backdrop.fog.color.getHexString()}`, skyPalette({night: true}).fog);
  backdrop.update({daylight: 1, condition: 'rain'}); assert.ok(backdrop.fog.far < 9800, 'rain shortens visibility');
  backdrop.dispose(); again.dispose();
});

test('street view is wired without removing the overview camera or its controls', () => {
  const sim = read('app/world-simulator.js'), renderer = read('app/world-3d.js'), scenes = read('app/world-3d-scenes.js'), css = read('app/world.css');
  // Existing overview behaviour is still present.
  assert.match(renderer, /new THREE\.OrthographicCamera\(-500,500,325,-325,1,12000\)/);
  assert.match(sim, /worldFloorTransform\(camera,viewport\(\)\)/);
  for (const control of ['zoom-in', 'zoom-out', 'zoom-fit', 'center', 'interact', 'sprint']) assert.ok(sim.includes(`data-world-control="${control}"`) || sim.includes(`control==='${control}'`), control);
  // New presentation.
  assert.match(renderer, /new THREE\.PerspectiveCamera\(STREET_VIEW\.fov/);
  assert.match(sim, /data-world-control="view-mode"/);
  assert.match(sim, /<div class="world-zoom-controls" role="group" aria-label="Environment camera zoom"><button type="button" data-world-control="zoom-out"/, 'the zoom row keeps its original three-button footprint');
  assert.match(sim, /const streetOn=\(\)=>streetPreferred&&oblique&&!preview&&!furnitureMode;/, 'arranging furniture and previews keep the overview');
  assert.match(sim, /characterRenderer\?\.screenToGround\?\.\(e\.clientX,e\.clientY\)/, 'taps are resolved against the real ground plane');
  assert.match(scenes, /exitDoors/);
  assert.match(css, /\[data-street-view="on"\] \.is-out-of-view\{opacity:0;pointer-events:none\}/, 'hidden markers remain focusable');
  assert.doesNotMatch(css, /\.is-out-of-view\{display:none\}/);
  // The frame-rate governor may only judge consecutive gameplay frames.
  assert.match(renderer, /playerBusy&&gap>0&&gap<120/);
  assert.doesNotMatch(renderer, /setPixelRatio\(1\);qualityStart/);
});

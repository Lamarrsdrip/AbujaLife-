import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../app/vendor/three.module.js';
import { WORLD_ZOOM, clampWorldZoom, worldViewport, constrainWorldCamera, applyWorldCamera, screenToWorld, worldToScreen } from '../app/world-camera.js';

test('mobile neighbourhood framing exposes several streets without depending on device pixel ratio', () => {
  const view = worldViewport({pixelWidth: 358, pixelHeight: 540, sceneWidth: 3540, sceneHeight: 4190});
  assert.ok(view.width >= 1200, 'default phone view is at least three times the former 393 world-unit crop');
  assert.equal(view.width / view.height, 358 / 540);
  const desktop = worldViewport({pixelWidth: 1200, pixelHeight: 760, sceneWidth: 3540, sceneHeight: 4190});
  assert.ok(desktop.width > view.width && desktop.width <= 1640);
});

test('every room edge remains visible at default zoom on narrow phones and wide desktops', () => {
  for (const [sceneWidth, sceneHeight] of [[1000, 820], [1320, 1100], [1640, 1230]]) {
    for (const [pixelWidth, pixelHeight] of [[358, 540], [1200, 760]]) {
      const view = worldViewport({pixelWidth, pixelHeight, sceneWidth, sceneHeight, interior: true});
      const center = constrainWorldCamera({x: 80, y: sceneHeight - 145}, view, {width: sceneWidth, height: sceneHeight});
      assert.deepEqual(center, {x: sceneWidth / 2, y: sceneHeight / 2});
      assert.ok(view.width >= sceneWidth + 128 && view.height >= sceneHeight + 144);
      for (const p of [{x: 0, y: 0}, {x: sceneWidth, y: sceneHeight}]) {
        const screen = worldToScreen(p, {left: 0, top: 0, width: pixelWidth, height: pixelHeight}, center, view);
        assert.ok(screen.x > 0 && screen.x < pixelWidth && screen.y > 0 && screen.y < pixelHeight);
      }
    }
  }
});

test('zoom gestures and repeated taps cannot exceed the playable camera range', () => {
  let zoom = 1;
  for (let i = 0; i < 200; i++) zoom = clampWorldZoom(zoom * WORLD_ZOOM.step);
  assert.equal(zoom, WORLD_ZOOM.max);
  for (let i = 0; i < 200; i++) zoom = clampWorldZoom(zoom / WORLD_ZOOM.step);
  assert.equal(zoom, WORLD_ZOOM.min);
  assert.equal(clampWorldZoom(Number.NaN), 1);
  assert.equal(clampWorldZoom(Infinity), 1);
  assert.equal(clampWorldZoom(-1000), WORLD_ZOOM.min);
  assert.equal(clampWorldZoom(1000), WORLD_ZOOM.max);
});

test('floor picking stays aligned with genuine 3D projection through zoom, follow and resize', () => {
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), camera = new THREE.OrthographicCamera(-500, 500, 325, -325, 1, 12000);
  for (const [pixelWidth, pixelHeight] of [[358, 540], [1024, 680]]) {
    const bounds = {left: 13, top: 122, width: pixelWidth, height: pixelHeight};
    for (const zoom of [.8, 1, 1.44, 2.5]) {
      const view = worldViewport({pixelWidth, pixelHeight, sceneWidth: 3540, sceneHeight: 4190, zoom});
      const center = constrainWorldCamera({x: 1840, y: 2400}, view, {width: 3540, height: 4190});
      assert.equal(applyWorldCamera(camera, {...center, ...view}), true);
      for (const point of [{x: 1780, y: 2480}, {x: 1900, y: 2310}, {x: center.x, y: center.y}]) {
        const projected = new THREE.Vector3(point.x, 0, point.y / Math.SQRT1_2).project(camera);
        const rendered = {x: bounds.left + (projected.x + 1) * bounds.width / 2, y: bounds.top + (1 - projected.y) * bounds.height / 2};
        const overlay = worldToScreen(point, bounds, center, view), picked = screenToWorld(rendered, bounds, center, view);
        assert.ok(Math.abs(rendered.x - overlay.x) < 1e-8 && Math.abs(rendered.y - overlay.y) < 1e-8, 'visible mesh and click plane coincide');
        assert.ok(Math.hypot(picked.x - point.x, picked.y - point.y) < 1e-8);
        ray.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
        const hit = ray.ray.intersectPlane(ground, new THREE.Vector3());
        assert.ok(Math.hypot(hit.x - point.x, hit.z * Math.SQRT1_2 - point.y) < 1e-8, 'real camera ray hits the same furniture floor coordinate');
      }
    }
  }
});

test('camera constraints follow roads at close zoom and center rooms when wider than their bounds', () => {
  assert.deepEqual(constrainWorldCamera({x: 20, y: 4100}, {width: 500, height: 600}, {width: 3540, height: 4190}), {x: 250, y: 3890});
  assert.deepEqual(constrainWorldCamera({x: 10, y: 10}, {width: 1300, height: 1800}, {width: 1000, height: 800}), {x: 500, y: 400});
  const camera = new THREE.OrthographicCamera(-500, 500, 325, -325, 1, 12000);
  assert.equal(applyWorldCamera(camera, {x: 0, y: 0, width: 0, height: 600}), false);
});

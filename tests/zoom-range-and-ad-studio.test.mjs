import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { MAP_ZOOM, clampMapZoom, mapLayers, normalizeMapCenter, visibleMapTiles, projectMapPoint, unprojectMapPoint } from '../app/map.js';
import { WORLD_ZOOM, WORLD_CAMERA, clampWorldZoom, worldViewport, constrainWorldCamera, applyWorldCamera, worldCameraEnvelope, screenToWorld, worldToScreen } from '../app/world-camera.js';
import { createWorldOrbit } from '../app/world-orbit.js';
import { STREET_VIEW, streetCameraPose } from '../app/world-street-camera.js';
import { AD_STUDIO, studioPageSize, studioPageUrl, adStateSignature, pageSignature, createPageCache, readCachedPricing, writeCachedPricing, renderBatches, isAbort } from '../app/ad-studio-data.js';
import { MAP_AD_INVENTORY, COMPATIBILITY_MAP_AD_INVENTORY, AD_ZONES, adZoneSpaces, adZonePageCount, adSpacePage } from '../src/shared/advertising.mjs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const ABUJA = {lat: 9.0765, lon: 7.3986};

test('Map zooms out to the whole-world tile instead of stopping at level 7', () => {
  assert.equal(MAP_ZOOM.min, 0); assert.equal(MAP_ZOOM.max, 17);
  let zoom = MAP_ZOOM.initial, steps = 0;
  while (clampMapZoom(zoom - 1) !== zoom) { zoom = clampMapZoom(zoom - 1); steps++; }
  assert.equal(zoom, 0); assert.equal(steps, MAP_ZOOM.initial);
  while (clampMapZoom(zoom + 1) !== zoom) zoom = clampMapZoom(zoom + 1);
  assert.equal(zoom, 17, 'zooming back in is not limited');
  assert.equal(clampMapZoom(-5), 0); assert.equal(clampMapZoom(NaN), MAP_ZOOM.initial);
  const source = read('app/map.js');
  assert.doesNotMatch(source, /clamp\(zoom\+delta,7,17\)/); assert.doesNotMatch(source, /zoom<=7/);
  assert.match(source, /zoomOut\.disabled=zoom<=MAP_ZOOM\.min;zoomIn\.disabled=zoom>=MAP_ZOOM\.max/);
  // Buttons, pinch, wheel and keyboard all go through the one clamped function.
  assert.equal((source.match(/changeZoom\(/g) || []).length >= 5, true);
});

test('Map stays stable at its widest view: valid tiles, wrap-safe panning, light layers', () => {
  for (const [width, height] of [[390, 719], [320, 568], [1440, 900]]) {
    const {tiles} = visibleMapTiles({center: ABUJA, zoom: 0, width, height});
    assert.ok(tiles.length >= 1 && tiles.length <= 12, `${tiles.length} tiles at ${width}x${height}`);
    assert.equal(new Set(tiles.map(tile => tile.key)).size, tiles.length, 'repeated world columns keep distinct elements');
    for (const tile of tiles) assert.equal(tile.path, '0/0/0', 'only the real level-0 tile is requested');
  }
  for (let zoom = 0; zoom <= 17; zoom++) {
    const {tiles} = visibleMapTiles({center: ABUJA, zoom, width: 390, height: 719}), n = 2 ** zoom;
    for (const tile of tiles) { const [z, x, y] = tile.path.split('/').map(Number); assert.ok(z === zoom && x >= 0 && x < n && y >= 0 && y < n, tile.path); }
    assert.ok(tiles.length <= 16);
  }
  assert.deepEqual(normalizeMapCenter({lat: 200, lon: 7}), {lat: 85, lon: 7});
  assert.ok(Math.abs(normalizeMapCenter({lat: 9, lon: 367.4}).lon - 7.4) < 1e-9);
  assert.ok(Math.abs(normalizeMapCenter({lat: 9, lon: -352.6}).lon - 7.4) < 1e-9);
  // Panning a full world east at level 0 returns to the same place.
  const start = projectMapPoint(ABUJA, 0), moved = normalizeMapCenter(unprojectMapPoint({x: start.x + 256, y: start.y}, 0));
  assert.ok(Math.abs(moved.lon - ABUJA.lon) < 1e-6 && Math.abs(moved.lat - ABUJA.lat) < 1e-6);
  assert.deepEqual(mapLayers(0), {buildings: false, placeMarkers: false});
  assert.deepEqual(mapLayers(9), {buildings: false, placeMarkers: true});
  assert.deepEqual(mapLayers(12), {buildings: true, placeMarkers: true});
});

test('World reaches the new safe minimum zoom through buttons, pinch and direct set', () => {
  assert.equal(WORLD_ZOOM.min, .01); assert.ok(WORLD_ZOOM.min > 0, 'never zero: the viewport divides by zoom');
  assert.equal(clampWorldZoom(0), WORLD_ZOOM.min); assert.equal(clampWorldZoom(-3), WORLD_ZOOM.min); assert.equal(clampWorldZoom(.03), .03);
  const orbit = createWorldOrbit({zoom: 1});
  let level = 1; for (let i = 0; i < 40; i++) level = orbit.setZoom(level / WORLD_ZOOM.step, {immediate: true}).zoom;
  assert.equal(level, WORLD_ZOOM.min);
  assert.equal(createWorldOrbit({zoom: 1}).pinch(.0001, 1).targetZoom, WORLD_ZOOM.min);
  assert.equal(orbit.setZoom(WORLD_ZOOM.max * 9, {immediate: true}).zoom, WORLD_ZOOM.max, 'zooming back in is unchanged');
});

test('minimum World zoom frames the whole city with generous context and centres it', () => {
  const scene = {width: 3540, height: 4190};
  for (const [pixelWidth, pixelHeight] of [[390, 719], [320, 568], [1440, 772]]) {
    const view = worldViewport({pixelWidth, pixelHeight, sceneWidth: scene.width, sceneHeight: scene.height, zoom: WORLD_ZOOM.min, oblique: true, yaw: WORLD_CAMERA.yaw, elevation: WORLD_CAMERA.elevation});
    assert.ok(Number.isFinite(view.width) && Number.isFinite(view.height));
    assert.ok(view.width > scene.width * 10 && view.height > scene.height * 5, 'far more than the scene is visible');
    const old = worldViewport({pixelWidth, pixelHeight, sceneWidth: scene.width, sceneHeight: scene.height, zoom: .06, oblique: true});
    assert.ok(view.width > old.width * 5.9, 'six times wider than the previous floor');
    // A viewport larger than the scene centres the scene instead of pinning a corner.
    assert.deepEqual(constrainWorldCamera({x: 12, y: 9000}, view, scene), {x: scene.width / 2, y: scene.height / 2});
  }
});

test('camera envelope and floor picking stay aligned at extreme zoom-out', () => {
  const scene = {width: 3540, height: 4190}, bounds = {left: 0, top: 0, width: 390, height: 719};
  const view = worldViewport({pixelWidth: 390, pixelHeight: 719, sceneWidth: scene.width, sceneHeight: scene.height, zoom: WORLD_ZOOM.min, oblique: true, yaw: WORLD_CAMERA.yaw, elevation: WORLD_CAMERA.elevation});
  const centre = constrainWorldCamera({x: 0, y: 0}, view, scene), camera = new THREE.OrthographicCamera(-500, 500, 325, -325, 1, 12000);
  assert.equal(applyWorldCamera(camera, {...centre, width: view.width, height: view.height, oblique: true, yaw: view.yaw, elevation: view.elevation}), true);
  const envelope = worldCameraEnvelope({height: view.height, elevation: view.elevation});
  assert.ok(camera.near >= 1 && camera.far === envelope.far && camera.far > envelope.distance * 2, 'near and far enclose the scene');
  const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), corner = new THREE.Vector3();
  for (const point of [{x: 0, y: 0}, {x: scene.width, y: scene.height}, {x: 1770, y: 2095}, {x: 300, y: 4000}]) {
    // Every corner of the scene, with a 600-unit-tall landmark on it, is inside the clip volume.
    for (const up of [0, 600]) { corner.set(point.x, up, point.y * WORLD_CAMERA.depthScale).project(camera); assert.ok(corner.z > -1 && corner.z < 1, `depth ${corner.z}`); }
    const screen = worldToScreen(point, bounds, centre, view), back = screenToWorld(screen, bounds, centre, view);
    assert.ok(Math.abs(back.x - point.x) < 1e-6 && Math.abs(back.y - point.y) < 1e-6, 'overlay maths round-trips');
    // The WebGL ray through the same pixel lands on the same floor point.
    ray.setFromCamera(new THREE.Vector2(screen.x / bounds.width * 2 - 1, 1 - screen.y / bounds.height * 2), camera);
    assert.ok(ray.ray.intersectPlane(ground, hit));
    assert.ok(Math.abs(hit.x - point.x) < .5 && Math.abs(hit.z / WORLD_CAMERA.depthScale - point.y) < .5, `picked ${hit.x},${hit.z / WORLD_CAMERA.depthScale} for ${point.x},${point.y}`);
  }
});

test('street view stays the default and zooms out into a clear aerial view', () => {
  const player = {x: 900, y: 900}, building = (x, y) => y > 1000;
  const near = streetCameraPose({player, yaw: 0, zoom: 1, blocked: building}), far = streetCameraPose({player, yaw: 0, zoom: .0001, blocked: building});
  assert.equal(near.shortened, true, 'at street level a building still stops the camera');
  assert.equal(far.shortened, false, 'the aerial eye is above the rooftops');
  assert.ok(Math.abs(far.distance - STREET_VIEW.walk.distance / STREET_VIEW.minZoom) < 1e-6);
  assert.ok(far.distance > streetCameraPose({player, yaw: 0, zoom: 1}).distance * 9);
  assert.ok(far.pitch >= STREET_VIEW.clearPitch && far.pitch <= STREET_VIEW.maxPitch && far.position.y > 1500);
  assert.ok(far.position.y < STREET_VIEW.far / 2, 'well inside the far plane');
  const sim = read('app/world-simulator.js');
  assert.match(sim, /let streetPreferred=readStreetPreference\(\)/);
  assert.match(sim, /if\(streetOn\(\)\)next=clamp\(next,STREET_VIEW\.minZoom,STREET_VIEW\.maxZoom\)/);
});

test('the studio opens without waiting on inventory and never requires the broad 96-space fetch', () => {
  const source = read('app/ads.js'), open = source.slice(source.indexOf('function openStudio('), source.indexOf('function trustedCheckout('));
  assert.match(source, /\nfunction openStudio\(kind='plot',preselectId=null,zoneId=null\)\{/, 'opening is synchronous');
  assert.doesNotMatch(source, /async function openStudio/);
  const beforeShell = open.slice(0, open.indexOf('sheetRoot.innerHTML=studioMarkup(kind)'));
  assert.doesNotMatch(beforeShell, /await|apiFetch|loadAds\(|loadAdConfig\(/, 'nothing is fetched before the shell is rendered');
  assert.doesNotMatch(open, /loadAds\(|loadAdOverview\(|limit=96/, 'the studio never triggers the city overview request');
  assert.match(open, /showPage\(\{deferred:true\}\)/); assert.match(open, /if\(deferred\)await afterPaint\(\)/);
  assert.match(open, /readCachedPricing\(\)/);
  // Listing pages omit campaign artwork and use the presentation page size.
  assert.equal(studioPageUrl('map-parcels', 2, 24), '/api/ads/world?zone=map-parcels&page=2&limit=24&zoom=1');
  assert.equal(studioPageSize(390), 24); assert.equal(studioPageSize(1280), 48);
  // The overview still decorates the world, but only in the background.
  assert.match(source, /function loadAds\(\)\{[^}]*loadAdConfig\(\)\.then\(state=>\{void loadAdOverview\(\);return state;\}\)/);
});

test('stale inventory requests are aborted or ignored', () => {
  const source = read('app/ads.js'), open = source.slice(source.indexOf('function openStudio('), source.indexOf('function trustedCheckout('));
  assert.match(open, /studioSession\?\.abort\(\);const session=new AbortController\(\);studioSession=session;/, 'reopening cancels the previous studio');
  assert.match(open, /pageRequest\?\.abort\(\);const request=new AbortController\(\);pageRequest=request;const version=\+\+pageVersion;/, 'a new page or area cancels the old request');
  assert.match(open, /signal:request\.signal/);
  assert.match(open, /session\.signal\.addEventListener\('abort',\(\)=>pageRequest\?\.abort\(\)/);
  assert.match(open, /if\(!live\(\)\|\|version!==pageVersion\)return;/);
  assert.match(open, /if\(isAbort\(error\)\|\|!live\(\)\|\|version!==pageVersion\)return;/, 'an aborted request never shows an error');
  assert.match(source, /function closeStudio\(\)\{studioSession\?\.abort\(\);studioSession=null;sheetRoot\.replaceChildren\(\);\}/);
  assert.match(source, /if\(studioSession&&!sheetRoot\.querySelector\('\[data-ad-form\]'\)\)\{studioSession\.abort\(\)/, 'another sheet replacing the studio ends its session');
  assert.equal(isAbort(new DOMException('x', 'AbortError')), true); assert.equal(isAbort(new Error('network')), false);
});

test('inventory pages use stale-while-revalidate and identical refreshes do not redraw', () => {
  let clock = 1000; const cache = createPageCache({now: () => clock}), key = cache.key('map-parcels', 0, 24);
  assert.equal(cache.read(key), null);
  const spaces = [{id: 'a', available: true}, {id: 'b', available: false, ad: {txRef: 't'}}];
  cache.write(key, {spaces, nextPage: 1});
  assert.equal(cache.read(key).fresh, true);
  clock += AD_STUDIO.pageFreshMs + 1; const stale = cache.read(key);
  assert.equal(stale.fresh, false, 'shown immediately, then revalidated'); assert.equal(stale.signature, pageSignature(spaces));
  assert.notEqual(pageSignature(spaces), pageSignature([{id: 'a', available: false}, spaces[1]]), 'a newly reserved space redraws');
  clock += AD_STUDIO.pageKeepMs; assert.equal(cache.read(key), null, 'old pages are dropped');
  for (let i = 0; i < 100; i++) cache.write(cache.key('z', i, 24), {spaces: [], nextPage: null});
  assert.equal(cache.size, AD_STUDIO.maxCachedPages, 'the cache is bounded');
  const state = {pricing: {amount: 2000, plotPackSize: 1}, active: [{txRef: 'x', endAt: 9, slots: ['p1']}], spaces: [{id: 'p1', available: false, ad: {txRef: 'x'}}], serverTime: 1};
  assert.equal(adStateSignature(state), adStateSignature({...state, serverTime: 999}), 'a new server time alone is not a change');
  assert.notEqual(adStateSignature(state), adStateSignature({...state, active: []}));
  assert.notEqual(adStateSignature(state), adStateSignature({...state, pricing: {amount: 2500, plotPackSize: 1}}));
  assert.match(read('app/ads.js'), /if\(adsState&&signature===publishedSignature\)\{[^}]*return adsState;\}/);
});

test('complete advertising inventory stays reachable at the smaller presentation page size', () => {
  const authored = [...MAP_AD_INVENTORY, ...COMPATIBILITY_MAP_AD_INVENTORY];
  for (const size of [AD_STUDIO.narrowPageSize, AD_STUDIO.widePageSize]) {
    // City map plots: the server slices this list by page*limit, so walking pages must cover every id once.
    const seen = new Set(); for (let page = 0; page * size < authored.length; page++) for (const space of authored.slice(page * size, (page + 1) * size)) seen.add(space.id);
    assert.equal(seen.size, authored.length);
    // Generated zones: the same ids at any page size, and each id is found on the page the client computes for it.
    // Generated zones are very large, so sample the first 192 cells and the last page of each:
    // the same ids appear at any page size, on the page the client computes for them.
    for (const zone of AD_ZONES.slice(0, 3)) {
      const small = new Set(), reference = new Set(), pages = 192 / size;
      for (let page = 0; page < pages; page++) for (const space of adZoneSpaces(zone.id, {page, limit: size})) { small.add(space.id); assert.equal(adSpacePage(space.id, size), page); }
      for (let page = 0; page < 2; page++) for (const space of adZoneSpaces(zone.id, {page, limit: 96})) reference.add(space.id);
      assert.deepEqual([...small].sort(), [...reference].sort(), `${zone.id} offers the same placements at ${size} per page`);
      const count = adZonePageCount(zone.id, size);
      assert.equal(count, Math.ceil(adZonePageCount(zone.id, 1) / size), 'page count covers every cell');
      assert.ok(adZoneSpaces(zone.id, {page: count, limit: size}).length === 0, 'nothing exists beyond the last page');
    }
  }
  assert.ok(AD_STUDIO.narrowPageSize >= 12, 'within the server page-size contract');
});

test('rendering is batched, checkout cannot double-submit, and pricing cache is display-only', () => {
  const batches = renderBatches(Array.from({length: 48}, (_, i) => i));
  assert.equal(batches[0].length, AD_STUDIO.firstBatch); assert.equal(batches.flat().length, 48);
  assert.ok(batches.every(batch => batch.length <= Math.max(AD_STUDIO.firstBatch, AD_STUDIO.batch)));
  assert.deepEqual(renderBatches([]), []);
  const source = read('app/ads.js'), css = read('app/ads.css');
  assert.match(source, /if\(index\+1<batches\.length\)\(globalThis\.requestAnimationFrame\|\|setTimeout\)\(\(\)=>paint\(index\+1\)\)/);
  assert.match(css, /\.abj-ad-map\[aria-busy="true"\]/, 'the loading state has its own stable box');
  // One submit at a time, one idempotency key per unchanged intent, server-side price and verification untouched.
  assert.match(source, /event\.preventDefault\(\);if\(submit\.disabled\|\|submitting\)return;submitting=true;update\(\);/);
  assert.match(source, /if\(intent\?\.fingerprint!==digest\)intent=\{fingerprint:digest,key:crypto\.randomUUID\(\)\};/);
  assert.match(source, /idempotencyKey:intent\.key/);
  assert.equal((source.match(/\/api\/payments\/checkout/g) || []).length, 1);
  assert.match(source, /submit\.disabled=submitting\|\|!priced\|\|selected\.size!==need\|\|!imageDataUrl\|\|!valid\|\|!paymentEnabled;/);
  const memory = new Map(), storage = {getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v)};
  assert.equal(readCachedPricing(storage), null);
  writeCachedPricing({amount: 2000, plotPackSize: 1}, true, storage, 1000);
  assert.deepEqual(readCachedPricing(storage, 2000), {pricing: {amount: 2000, plotPackSize: 1}, enabled: true});
  assert.equal(readCachedPricing(storage, 1000 + AD_STUDIO.pricingKeepMs + 1), null, 'expires');
  memory.set(AD_STUDIO.pricingKey, JSON.stringify({pricing: {amount: -5, plotPackSize: 1}, at: 1000})); assert.equal(readCachedPricing(storage, 1500), null, 'rejects nonsense');
  memory.set(AD_STUDIO.pricingKey, '{broken'); assert.equal(readCachedPricing(storage, 1500), null);
  assert.equal(readCachedPricing({getItem() { throw new Error('blocked'); }}), null);
});

test('the admin publishing layer cannot re-trigger its own observer', () => {
  const source = read('app/admin-ad-bypass.js'), refresh = source.slice(source.indexOf('function refresh('), source.indexOf('async function publish('));
  // Assigning textContent records a mutation even when the text is unchanged, and refresh()
  // runs from a MutationObserver on the studio, so unconditional writes loop forever.
  assert.match(source, /const setText=\(node,text\)=>\{if\(node\.textContent!==text\)node\.textContent=text;\};/);
  assert.doesNotMatch(refresh, /\.textContent=/, 'refresh writes text only through the conditional helper');
  assert.match(refresh, /if\(submit\.disabled===valid\)submit\.disabled=!valid;setText\(submit,ADMIN_SUBMIT_LABEL\)/);
  assert.match(source, /observer\.observe\(studio,\{subtree:true,childList:true\}\)/, 'the observer the helper protects is still installed');
  // The studio keeps its own writes idempotent too and leaves the admin label alone.
  const ads = read('app/ads.js');
  assert.match(ads, /if\(note\.textContent!==message\)note\.textContent=message;/);
  assert.match(ads, /if\(selectedList\.dataset\.chosen!==chosen\)/);
  assert.match(ads, /if\(!submitting&&form\.dataset\.adminAdMode!=='1'\)submit\.textContent=/);
});

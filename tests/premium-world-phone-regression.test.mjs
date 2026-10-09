import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const world3d=read('app/world-3d.js');
const lighting=read('app/world-lighting.js');
const assets=read('app/world-assets.js');
const vendor=read('scripts/vendor-three.mjs');
const polish=read('app/abuja-game-polish-2026.js');
const polishCss=read('app/abuja-game-polish-2026.css');
const map=read('app/game-map.js');
const city=read('app/outside-city-v4.js');

test('realtime residents keep a visible fallback until their own WebGL rig is ready',()=>{
  assert.match(world3d,/syncResidentFallbacks/);
  assert.match(world3d,/has-webgl-resident/);
  assert.match(world3d,/if\(person\.pose\)animate\(rig/);
  assert.match(world3d,/renderer\.render\(scene,camera\)/);
  assert.match(polishCss,/world-online-resident \.walker-body\{visibility:visible!important\}/);
  assert.match(polishCss,/world-online-resident\.has-webgl-resident \.walker-body\{visibility:hidden!important\}/);
  assert.doesNotMatch(polish,/has-webgl-resident/);
  assert.doesNotMatch(read('app/phone.js'),/class="ph-put-away"/);
  assert.match(read('app/phone.js'),/>Close</);
  assert.match(read('app/phone.js'),/ph-network-type/);
  assert.doesNotMatch(polishCss,/ph-put-away/);
  assert.match(read('app/phone.js'),/AbujaLife Phone/);
  assert.doesNotMatch(polish,/ph-device-caption/);
});

test('premium 3D quality keeps soft shadows on capable phones with a constrained fallback',()=>{
  assert.match(world3d,/const constrained=.*memory<=2/);
  assert.match(world3d,/const shadows=!constrained/);
  assert.match(world3d,/PCFSoftShadowMap/);
  assert.match(world3d,/powerPreference:constrained\?'low-power':'high-performance'/);
  // Street view raised the phone ceiling from 1.3x to 1.75x; constrained devices stay at 1x.
  assert.match(world3d,/constrained\?1:mobile\?1\.75:2/);
});

test('canonical renderer uses a local prefiltered environment instead of pretending hemisphere light is GI',()=>{
  assert.match(world3d,/createWorldEnvironmentLighting/);
  assert.match(world3d,/scene\.environment=ibl\.texture/);
  assert.match(lighting,/PMREMGenerator/);
  assert.match(lighting,/RoomEnvironment/);
  assert.match(lighting,/if\(constrained\)return/);
});

test('world asset runtime supports local Meshopt and KTX2 without third-party hotlinks',()=>{
  assert.match(assets,/GLTFLoader/);
  assert.match(assets,/KTX2Loader/);
  assert.match(assets,/detectSupport\(renderer\)/);
  assert.match(assets,/setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(assets,/basisPath='\/vendor\/basis\/'/);
  assert.match(vendor,/basis_transcoder\.wasm/);
  assert.match(vendor,/shared-three/);
  assert.doesNotMatch(assets,/https?:\/\//);
});

test('real mobile devices use the visual viewport while the handset frame keeps one sizing owner',()=>{
  assert.doesNotMatch(polish,/syncPhoneViewport|--abj-phone-vh/);
  assert.doesNotMatch(polishCss,/--abj-phone-vh|--abj-phone-vtop/);
  assert.match(read('app/phone-viewport.js'),/visualViewport/);
  assert.match(read('app/phone-hardware-2026.css'),/width:390px/);
  assert.match(polishCss,/phone-keyboard-open \.ph-chat-thread \.ph-composer\{position:relative!important/);
  assert.match(read('app/civic-life.js'),/data-civic-launcher/);
  assert.match(read('app/civic-life.js'),/City Story/);
  assert.doesNotMatch(polish,/civicPhoneApp/);
});

test('the main Map uses the premium Abuja v4 diorama and includes civic destinations',()=>{
  assert.match(map,/outside-city-v4\.js/);
  for(const id of ['inec-hq','efcc-hq','federal-high-court-hub','national-assembly-hub','wtc-abuja-hub'])assert.ok(read('src/shared/city-landmarks.mjs').includes(`'${id}'`),`${id} missing from premium city`);
  assert.match(city,/renderer\.shadowMap\.enabled=true/);
});

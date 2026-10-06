import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const world3d=read('app/world-3d.js');
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
});

test('premium 3D quality keeps soft shadows on capable phones with a constrained fallback',()=>{
  assert.match(world3d,/const constrained=.*memory<=2/);
  assert.match(world3d,/const shadows=!constrained/);
  assert.match(world3d,/PCFSoftShadowMap/);
  assert.match(world3d,/powerPreference:constrained\?'low-power':'high-performance'/);
  assert.match(world3d,/mobile\?1\.3:1\.8/);
});

test('real mobile devices use the visual viewport instead of squeezing a second handset',()=>{
  assert.match(polish,/visualViewport/);
  assert.match(polish,/--abj-phone-vh/);
  assert.match(polish,/--abj-phone-vtop/);
  assert.match(polishCss,/@media\(max-width:700px\)[\s\S]*\.phone-root\{top:var\(--abj-phone-vtop/);
  assert.match(polishCss,/\.phone-root \.ph-device[\s\S]*width:100%!important[\s\S]*height:100%!important/);
  assert.match(polishCss,/phone-keyboard-open \.ph-chat-thread \.ph-composer\{position:relative!important/);
  assert.match(polish,/dataset\.civicPhoneApp/);
  assert.match(polish,/City Story/);
});

test('the main Map uses the premium Abuja v4 diorama and includes civic destinations',()=>{
  assert.match(map,/outside-city-v4\.js/);
  for(const id of ['inec-hq','efcc-hq','federal-high-court-hub','national-assembly-hub','wtc-abuja-hub'])assert.ok(city.includes(`'${id}'`),`${id} missing from premium city`);
  assert.match(city,/renderer\.shadowMap\.enabled=true/);
});

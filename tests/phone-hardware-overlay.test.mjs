import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const phone=fs.readFileSync(new URL('../app/phone.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../app/phone-hardware-2026.css',import.meta.url),'utf8');
const polish=fs.readFileSync(new URL('../app/abuja-game-polish-2026.css',import.meta.url),'utf8');

test('production shell loads the physical handset override after every older phone and game style',()=>{
  const hardware=html.indexOf('/phone-hardware-2026.css'),chat=html.indexOf('/phone-chat-pro.css'),realm=html.indexOf('/game-realm-2026.css'),polish=html.indexOf('/abuja-game-polish-2026.css');
  assert.ok(hardware>chat&&hardware>realm&&hardware>polish);
});

test('phone renderer always includes one Pro-sized physical device, clipped screen, status hardware and floating close control',()=>{
  for(const token of ['ph-device','ph-screen','ph-hardware ph-action-button','ph-hardware ph-volume','ph-hardware ph-power','ph-statusbar','ph-network-type','Wi-Fi','ph-island','ph-home-indicator','ph-device-caption','>Close<'])assert.match(phone,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(css,/\.ph-device\{[\s\S]*aspect-ratio:/);
  assert.match(css,/\.ph-screen\{[\s\S]*overflow:hidden/);
  assert.match(css,/\.ph-screen\{[\s\S]*clip-path:/);
  assert.match(css,/width:390px/);
  assert.match(css,/\.ph-device-caption button\{[^}]*border-radius:999px/);
  assert.match(css,/--ph-viewport-height/);
  assert.match(css,/env\(safe-area-inset-top\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
});

test('floating Close control never steals taps from the handset home indicator',()=>{
  assert.match(css,/\.ph-device-caption\{[^}]*pointer-events:none/);
  assert.match(css,/\.ph-device-caption button\{[^}]*pointer-events:auto/);
});

test('Phone remains a world overlay rather than a full-screen replacement app',()=>{
  assert.match(css,/\.ph-backdrop\{[\s\S]*background:radial-gradient/);
  assert.match(css,/backdrop-filter:none/);
  assert.doesNotMatch(css,/\.ph-backdrop\{[^}]*background:\s*#fff/i);
  assert.match(phone,/root\.hidden=false/);
  assert.match(phone,/viewport\.lock\(\)/);
  assert.match(phone,/viewport\.unlock\(\)/);
  const renderer=phone.slice(phone.indexOf('function render()'),phone.indexOf('function bind',phone.indexOf('function render()')));
  assert.doesNotMatch(renderer,/location\.(?:assign|replace|reload)|history\.(?:pushState|replaceState)|onNavigate\(/);
});

test('native keyboard changes the usable chat viewport without deleting the virtual handset',()=>{
  assert.ok(phone.includes('createPhoneViewport'));
  assert.ok(css.includes('phone-keyboard-open'));
  assert.match(css,/scale\(var\(--ph-device-scale/);
  assert.match(css,/phone-keyboard-open \.ph-thread-scroll/);
  assert.match(css,/font-size:16px/);
  assert.doesNotMatch(css,/phone-keyboard-open \.ph-device\s*\{[^}]*display:none/);
  assert.doesNotMatch(polish,/\.ph-device/,'A secondary responsive rule must not replace the handset owner or force a full-screen phone');
  assert.doesNotMatch(polish,/\.ph-hardware[^}]*display:none/);
});

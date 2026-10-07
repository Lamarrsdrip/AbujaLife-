import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const experience=fs.readFileSync(new URL('../app/game-experience.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../app/game-experience.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../app/sw.js',import.meta.url),'utf8');

test('production shell ships the premium game experience layer',()=>{
  assert.match(index,/game-experience\.css/);
  assert.match(index,/game-experience\.js/);
  assert.match(sw,/game-experience\.js/);
  assert.match(sw,/game-experience\.css/);
});

test('Map is restored as a separate main navigation experience',()=>{
  assert.match(experience,/Open Abuja map/);
  assert.match(experience,/renderMap\(/);
  assert.match(experience,/Outside remains part of Play/);
  assert.match(styles,/\.abj-map-overlay/);
});

test('returning players receive a welcome-back gate with real city pulse',()=>{
  assert.match(experience,/Welcome back\./);
  assert.match(experience,/visits today/);
  assert.match(experience,/online now/);
  assert.match(styles,/\.abj-welcome-back/);
});

test('My Life and owned vehicles have game-like social and garage surfaces',()=>{
  assert.match(experience,/YOUR ABUJA LIFE/);
  assert.match(experience,/Live Abuja/);
  assert.match(experience,/findVehicleItems/);
  assert.match(app,/function openGarage\(/);
  assert.match(app,/data-drive=/);
  assert.match(app,/\['garage','map','Garage'/);
  assert.match(styles,/\.abj-life-shortcuts/);
  assert.doesNotMatch(experience,/className\s*=\s*['"]abj-home-garage-bay|ensureGarageBay|function openGarage\(/);
  assert.doesNotMatch(styles,/\.abj-home-garage-bay|\.abj-garage-overlay/);
  assert.match(experience,/querySelectorAll\('\.abj-home-garage-bay,\.abj-garage-overlay'\)/);
});

test('room actions stay contextual and the gameplay overlay does not recreate a garage card',()=>{
  const world=fs.readFileSync(new URL('../app/world-simulator.js',import.meta.url),'utf8');
  const worldStyles=fs.readFileSync(new URL('../app/world.css',import.meta.url),'utf8');
  assert.match(world,/data-world-context/);
  assert.match(world,/requestPoint\(nearby\)/);
  assert.match(worldStyles,/\.world-context-action/);
  assert.doesNotMatch(world,/abj-home-garage-bay|YOUR GARAGE/);
});

test('nearby location chat is compact and reuses the existing location-chat endpoints',()=>{
  const world=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../app/game.css',import.meta.url),'utf8');
  assert.match(world,/api\/chat\/location/);
  assert.match(world,/location-chat/);
  assert.match(world,/location-chat-panel/);
  assert.match(world,/message\.resident\?\.displayName/);
  assert.match(css,/\.location-chat-panel\{position:absolute/);
  assert.match(css,/\.location-chat-panel\.is-minimized\{display:none\}/);
});

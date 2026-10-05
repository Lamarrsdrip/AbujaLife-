import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const experience=fs.readFileSync(new URL('../app/game-experience.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../app/game-experience.css',import.meta.url),'utf8');
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
  assert.match(experience,/Your cars live here\./);
  assert.match(experience,/findVehicleItems/);
  assert.match(styles,/\.abj-life-shortcuts/);
  assert.match(styles,/\.abj-home-garage-bay/);
});

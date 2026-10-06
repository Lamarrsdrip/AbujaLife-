import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const map=fs.readFileSync(new URL('../app/game-map.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../app/sw.js',import.meta.url),'utf8');

test('main Map restores the authored 3D city overview instead of the utility street map',()=>{
  assert.match(map,/renderOutside/);
  assert.doesNotMatch(map,/renderMap/);
  assert.match(map,/outside-city(?:-v\d+)?\.js/);
  assert.match(map,/data-nav-outside/);
  assert.match(map,/data-life-shortcut="map"/);
  assert.ok(index.indexOf('/game-map.js')<index.indexOf('/game-experience.js'),'3D map interceptor must register before the enhancement fallback');
});

test('restored Map and its styles are part of the offline production shell',()=>{
  assert.match(index,/game-map\.css/);
  assert.match(index,/game-map\.js/);
  assert.match(sw,/game-map\.css/);
  assert.match(sw,/game-map\.js/);
});
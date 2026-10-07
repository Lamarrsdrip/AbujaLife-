import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const citySource=()=>[read('app/world-city.js'),read('app/world-city-base.js')].join('\n');

test('City Story and INEC experience is actually loaded into the phone',()=>{
 const index=read('app/index.html'),civic=read('app/civic-life.js');
 assert.match(index,/src="\/civic-life\.js"/);
 assert.match(civic,/City Story/);
 assert.match(civic,/inec-hq/);
 assert.match(civic,/insertBefore\(button,firstPageAnchor\)/);
});

test('playable World can frame the full Abuja landmark city',()=>{
 const camera=read('app/world-camera.js'),sim=read('app/world-simulator.js'),city=citySource();
 assert.match(camera,/min: \.06, max: 10/);
 assert.match(sim,/scene\.width\/2,y:scene\.height\/2/);
 assert.match(sim,/atOne\.baseWidth\/Math\.max\(scene\.width\*1\.32/);
 assert.match(city,/CITY_LANDMARKS\.map\(landmarkWorldPoint\)/);
 assert.match(city,/city-context-block/);
 assert.match(city,/airport-plane-a/);
});

test('Okrika environmental sponsor remains visible without replacing paid ad inventory',()=>{
 const city=read('app/world-city.js'),ads=read('docs/ABUJALIFE_ADS.md');
 assert.match(city,/data-environmental-sponsor="okrika"/);
 assert.match(city,/>OKRIKA</);
 assert.match(city,/scene\.environmentalSponsor='okrika'/);
 assert.match(ads,/dedicated open Abuja Business Park contains 40 visible plots/);
 assert.match(ads,/ten visible roadside billboard spaces/);
});

test('outer map surrounding space is dense clickable advertising land',()=>{
 const map=read('app/outside-city-v4.js');
 assert.match(map,/function createAdPlots\(\)/);
 assert.match(map,/width:10400,depth:7600/);
 assert.match(map,/best<720/);
 assert.match(map,/pinchBase\.zoom\*d\/pinchBase\.distance,\.22,24/);
 assert.match(map,/plot\.w\|\|318/);
});

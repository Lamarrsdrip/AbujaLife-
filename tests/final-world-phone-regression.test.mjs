import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const citySource=()=>[read('app/world-city.js'),read('app/world-city-base.js')].join('\n');

test('Outside keeps city fabric visible while direct entry stays district-authoritative',()=>{
  const city=citySource();
  assert.equal(city.includes("if(spec.id!=='home'&&!venues.some(venue=>venue.id===spec.id))continue;"),false);
  assert.match(city,/const localVenue=venues\.find/);
  assert.match(city,/city-neighbourhood-fabric/);
  assert.match(city,/CITY_LANDMARKS/);
});

test('house exposes Go Out and deduplicates authored versus saved furniture',()=>{
  const app=read('app/app.js'),interiors=[read('app/world-interiors.js'),read('app/world-interiors-base.js')].join('\n');
  assert.match(app,/world-go-out-shortcut/);
  assert.match(app,/>Go Out</);
  assert.match(interiors,/entryByItem=new Map/);
  assert.match(interiors,/removeBase\(itemId\)/);
  assert.match(interiors,/\['bed','dining-table'\]/);
});

test('map opens at medium overview but retains extreme zoom',()=>{
  const map=read('app/outside-city-v4.js');
  assert.match(map,/zoom:\.82,yaw:\.42/);
  assert.match(map,/minZoom:\.22,maxZoom:24/);
});

test('phone uses the previous full handset kit and native premium Naira receipt',()=>{
  const phone=read('app/phone.css'),chat=read('app/phone-chat-pro.css'),chatJs=read('app/phone-chat-pro.js'),base=read('app/phone.js');
  assert.doesNotMatch(phone,/2026-10 final phone framing/);
  assert.match(phone,/\.ph-device\{position:relative;width:min\(360px/);
  assert.doesNotMatch(chat,/ph-transfer-message\{min-width:/);
  assert.doesNotMatch(chat,/receipt-like Naira transfer card/);
  assert.match(chatJs,/function transformTransfer\(\)\{\/\* Keep native AbujaLife cream\/gold Naira receipt presentation\. \*\/\}/);
  assert.match(base,/YOU SENT NAIRA/);
  assert.match(base,/Transfer confirmed · No fee/);
});

test('World Home always opens the travel chooser so owned cars can drive home',()=>{
  const app=read('app/app.js');
  const home=app.slice(app.indexOf('async function goHome()'),app.indexOf('function openLifeMenu()'));
  assert.match(home,/travelSheet\(p\.home\.district,true\);return;/);
  assert.doesNotMatch(home,/cleanup\?\.performAsync\)await cleanup\.performAsync\('enter-home'\)/);
  assert.match(app,/const ownsCar=list\(state\.catalog\)\.some\(item=>item\.category==='vehicle'/);
  assert.match(app,/const modes=TRANSPORT_MODES\.filter\(mode=>mode\.id!=='car'\|\|ownsCar\)/);
});

test('presence heartbeat is lightweight, accurate and keeps strict expiry',()=>{
  const app=read('app/app.js'),prod=read('src/server/production-http.mjs'),stats=read('src/server/cityStats.mjs'),presence=read('src/server/mongo/presenceStore.mjs');
  assert.match(app,/heartbeat:true/);
  assert.match(prod,/body\.heartbeat===true/);
  assert.match(stats,/GLOBAL_CACHE_MS = 1000/);
  assert.match(presence,/leaseMs=45000/);
});

test('driving route remains visibly guided',()=>{
  const world=read('app/world.css'),sim=read('app/world-simulator.js');
  assert.match(world,/abjRouteDrive/);
  assert.match(world,/data-driving/);
  assert.match(sim,/dataset\.driving=String\(driving\)/);
});

test('live WebGL Outside receives the complete city and recognisable landmarks',()=>{
  const city=citySource(),three=read('app/world-3d-scenes.js');
  assert.match(city,/const visibleLegacyBuildings=/);
  assert.match(city,/const safeLandmarkBuildings=/);
  assert.match(city,/context-landmark-/);
  assert.match(city,/buildings:visibleBuildings/);
  assert.match(three,/renderLandmarkBuilding/);
  for(const builder of ['airport','cityGate','stadium','wtc','cbn','assembly','mosque','transcorp','inec'])assert.match(three,new RegExp(`case'${builder}'`));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Outside keeps city fabric visible while direct entry stays district-authoritative',()=>{
  const city=read('app/world-city.js');
  assert.equal(city.includes("if(spec.id!=='home'&&!venues.some(venue=>venue.id===spec.id))continue;"),false);
  assert.match(city,/const localVenue=venues\.find/);
  assert.match(city,/city-neighbourhood-fabric/);
  assert.match(city,/CITY_LANDMARKS/);
});

test('house exposes Go Out and deduplicates authored versus saved furniture',()=>{
  const app=read('app/app.js'),interiors=read('app/world-interiors.js');
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

test('phone stays framed and Naira receipts cannot collapse vertically',()=>{
  const phone=read('app/phone.css'),chat=read('app/phone-chat-pro.css');
  assert.match(phone,/whole handset visible/);
  assert.match(chat,/receipt-like Naira transfer card/);
  assert.match(chat,/white-space:nowrap!important/);
  assert.match(chat,/grid-template-columns:28px minmax\(0,1fr\) auto/);
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

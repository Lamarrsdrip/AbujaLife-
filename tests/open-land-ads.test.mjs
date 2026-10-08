import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AD_ZONES,adSpaceAt,adSpaceFromId} from '../src/shared/advertising.mjs';
import {MAP_AD_PARCELS,MAP_AD_COMPATIBILITY_PARCELS} from '../src/shared/map-ad-land.mjs';

test('arbitrary open points across Abuja resolve to exact eligible advertising cells',()=>{
 const zone=AD_ZONES.find(row=>row.id==='city-frontage');let found=null;
 for(let y=zone.y+50;y<zone.y+zone.height&&!found;y+=100)for(let x=zone.x+60;x<zone.x+zone.width&&!found;x+=120){const space=adSpaceAt(x,y);if(space&&x>=space.x&&x<space.x+space.width&&y>=space.y&&y<space.y+space.height)found={x,y,space};}
 assert.ok(found,'expected at least one safe arbitrary city point');assert.equal(found.space.eligible,true);assert.deepEqual(adSpaceFromId(found.space.id).id,found.space.id);
});

test('the map exposes broad safe advertising inventory without fake campaigns or displaced legacy land',()=>{
 assert.ok(MAP_AD_PARCELS.length>=80,`expected broad map inventory, got ${MAP_AD_PARCELS.length}`);
 assert.equal(MAP_AD_COMPATIBILITY_PARCELS.length,43,'all legacy sale rights must keep real safe geometry');
 for(const p of MAP_AD_COMPATIBILITY_PARCELS)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.width>0&&p.height>0);
 assert.ok(MAP_AD_PARCELS.some(p=>p.x<0&&p.y<0));
 assert.ok(MAP_AD_PARCELS.some(p=>p.x>0&&p.y<0));
 assert.ok(MAP_AD_PARCELS.some(p=>p.x<0&&p.y>0));
 assert.ok(MAP_AD_PARCELS.some(p=>p.x>0&&p.y>0));
});

test('the live map opens safe blank land directly without requiring Advertise mode',()=>{
 const source=fs.readFileSync(new URL('../app/open-land-ads.js',import.meta.url),'utf8'),index=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 assert.match(source,/adSpaceAt\(/);assert.match(source,/map land is itself the storefront/i);assert.match(source,/abj:open-ad-studio/);assert.match(source,/dragDistance>10/);
 assert.match(source,/stopImmediatePropagation/);assert.match(source,/\},true\);/);assert.match(source,/isOccupied\(space\)/);
 assert.doesNotMatch(source,/getAttribute\('aria-pressed'\)!=='true'\)return/);
 assert.match(index,/open-land-ads\.js/);assert.match(index,/map-premium-2026\.css/);
});

test('map parcel renderer keeps hundreds of discoverable square placements cheap',()=>{
 const source=fs.readFileSync(new URL('../app/map-ad-parcels.js',import.meta.url),'utf8');
 assert.match(source,/maxVisible=280/);assert.match(source,/InstancedMesh/);assert.match(source,/drawCalls:2/);
});

test('admin in-game bypass is shipped without changing the customer ₦2,000 price',()=>{
 const source=fs.readFileSync(new URL('../app/admin-ad-bypass.js',import.meta.url),'utf8'),index=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 assert.match(source,/Publish to AbujaLife · No charge/);assert.match(source,/\/api\/admin\/ads\/platform/);assert.match(index,/admin-ad-bypass\.js/);
});

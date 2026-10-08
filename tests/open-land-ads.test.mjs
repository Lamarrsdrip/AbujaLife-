import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AD_ZONES,adSpaceAt,adSpaceFromId} from '../src/shared/advertising.mjs';

test('arbitrary open points across Abuja resolve to exact eligible advertising cells',()=>{
 const zone=AD_ZONES.find(row=>row.id==='city-frontage');let found=null;
 for(let y=zone.y+50;y<zone.y+zone.height&&!found;y+=100)for(let x=zone.x+60;x<zone.x+zone.width&&!found;x+=120){const space=adSpaceAt(x,y);if(space&&x>=space.x&&x<space.x+space.width&&y>=space.y&&y<space.y+space.height)found={x,y,space};}
 assert.ok(found,'expected at least one safe arbitrary city point');assert.equal(found.space.eligible,true);assert.deepEqual(adSpaceFromId(found.space.id).id,found.space.id);
});

test('the live map open-land bridge is shipped and uses shared safety geometry',()=>{
 const source=fs.readFileSync(new URL('../app/open-land-ads.js',import.meta.url),'utf8'),index=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 assert.match(source,/adSpaceAt\(/);assert.match(source,/roads and buildings/i);assert.match(source,/abj:open-ad-studio/);assert.match(index,/open-land-ads\.js/);
});

test('admin in-game bypass is shipped without changing the customer ₦2,000 price',()=>{
 const source=fs.readFileSync(new URL('../app/admin-ad-bypass.js',import.meta.url),'utf8'),index=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 assert.match(source,/Publish to AbujaLife · No charge/);assert.match(source,/\/api\/admin\/ads\/platform/);assert.match(index,/admin-ad-bypass\.js/);
});

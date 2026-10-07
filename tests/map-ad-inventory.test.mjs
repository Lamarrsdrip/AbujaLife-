import test from 'node:test';
import assert from 'node:assert/strict';
import {adSpaceAt,adSpaceFromId,adZoneSpaces,AD_ZONES} from '../src/shared/advertising.mjs';
import {mapAdPlacements} from '../app/map-ad-displays.js';

test('the core city, districts and blue surrounds select existing authoritative inventory',()=>{
 for(const [x,y] of [[0,0],[3500,2700],[-5800,500],[14000,-17000],[-18000,24000]]){
  const space=adSpaceAt(x,y);assert.ok(space);assert.deepEqual(space,adSpaceFromId(space.id));
 }
 assert.equal(adSpaceAt(14000,-17000).zoneId,'sky-displays');
 assert.equal(adSpaceAt(80000,0),null);assert.equal(adSpaceAt(NaN,0),null);
});
test('surrounds cannot sell city cells and city-wide inventory cannot duplicate existing district displays',()=>{
 const sky=AD_ZONES[0];const city=AD_ZONES[1];
 assert.equal(adSpaceFromId(`ad:sky-displays:${Math.floor((0-sky.y)/100)}:${Math.floor((0-sky.x)/120)}`),null);
 for(const zone of AD_ZONES.slice(2)){
  const x=zone.x+zone.width/2,y=zone.y+zone.height/2;
  assert.equal(adSpaceFromId(`ad:city-frontage:${Math.floor((y-city.y)/100)}:${Math.floor((x-city.x)/120)}`),null);
  assert.equal(adSpaceAt(x,y).zoneId,zone.id);
 }
 assert.ok(adZoneSpaces('sky-displays').length>0);
});
test('paid creatives use their purchased city and sky positions, expire and never fabricate campaigns',()=>{
 const a=adSpaceAt(0,0),b=adSpaceAt(18000,18000),ad={txRef:'paid',endAt:2000,slots:[a.id,b.id],title:'Real business'};
 const placements=mapAdPlacements([ad],1000);assert.equal(placements.length,2);
 assert.deepEqual(placements.map(p=>[p.x,p.z]),[[a.x,a.y],[b.x,b.y]]);
 assert.equal(mapAdPlacements([ad],2000).length,0);assert.equal(mapAdPlacements([],1000).length,0);
 assert.equal(mapAdPlacements([{...ad,slots:['invalid']}],1000).length,0);
});

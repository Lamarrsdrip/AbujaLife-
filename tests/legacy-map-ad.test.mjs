import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPATIBILITY_MAP_AD_INVENTORY,MAP_AD_INVENTORY,PLOT_IDS,adSpaceAt,adSpaceFromId} from '../src/shared/advertising.mjs';
import {MAP_ROADSIDE_PARCELS,mapLandConflict,boxesOverlap} from '../src/shared/map-ad-land.mjs';
import {mapAdPlacements} from '../app/map-ad-displays.js';

test('original ad IDs and earlier checkout cells retain dedicated safe sale rights',()=>{
 assert.equal(COMPATIBILITY_MAP_AD_INVENTORY.length,43);
 assert.deepEqual(COMPATIBILITY_MAP_AD_INVENTORY.slice(0,40).map(p=>p.id),PLOT_IDS);
 const all=[...MAP_AD_INVENTORY,...COMPATIBILITY_MAP_AD_INVENTORY,...MAP_ROADSIDE_PARCELS];
 const saleRights=[...MAP_AD_INVENTORY,...COMPATIBILITY_MAP_AD_INVENTORY],uniqueRights=new Set(saleRights.map(p=>p.id));
 assert.equal(uniqueRights.size,saleRights.length,'inventory cannot reuse a legacy reservation ID');
 assert.ok(uniqueRights.size>=197,'bounded map inventory must preserve all established sale rights');
 for(const parcel of COMPATIBILITY_MAP_AD_INVENTORY){
  assert.equal(mapLandConflict(parcel),null,parcel.id);
  assert.ok(parcel.x>=-5200&&parcel.y>=-3800&&parcel.x+parcel.width<=5200&&parcel.y+parcel.height<=3800);
  assert.ok(parcel.width>=220&&parcel.height>=220);
  assert.equal(adSpaceFromId(parcel.id).eligible,true);
  assert.equal(adSpaceAt(parcel.x+parcel.width/2,parcel.y+parcel.height/2).id,parcel.id);
  for(const other of all)if(other!==parcel)assert.equal(boxesOverlap(parcel,other),false,`${parcel.id} collides`);
 }
 const campaign={txRef:'legacy-verified',startAt:1,endAt:2000,slots:[...PLOT_IDS,'ad:city-frontage:80:32','ad:city-frontage:80:33','ad:city-frontage:80:38','ad:city-frontage:80:39','ad:city-frontage:80:44']};
 assert.equal(mapAdPlacements([campaign],1000).length,45);
});

test('new dynamic cells cannot resell compatibility land through another slot ID',()=>{
 for(const parcel of COMPATIBILITY_MAP_AD_INVENTORY){
  const column=Math.floor((parcel.x+parcel.width/2+7000)/120),row=Math.floor((parcel.y+parcel.height/2+5000)/100);
  const other=adSpaceFromId(`ad:city-frontage:${row}:${column}`);
  if(other)assert.equal(other.eligible,false,other.id);
 }
});

test('existing active and already-safe pending authored parcels keep exact geometry',()=>{
 for(const [id,x] of [['ad:city-frontage:80:25',-4180],['ad:city-frontage:80:39',-2500],['ad:city-frontage:80:44',-1940]]){
  const parcel=adSpaceFromId(id);
  assert.deepEqual([parcel.x,parcel.y,parcel.width,parcel.height],[x,2870,520,340]);
  assert.equal(parcel.eligible,true);
  assert.equal(COMPATIBILITY_MAP_AD_INVENTORY.some(p=>p.id===id),false);
 }
 for(let index=1;index<=10;index++)assert.equal(adSpaceFromId(`billboard-${String(index).padStart(2,'0')}`).name,`Roadside billboard ${index}`);
});

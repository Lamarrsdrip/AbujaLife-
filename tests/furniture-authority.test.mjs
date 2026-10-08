import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { GameStore, catalog, properties } from '../src/server/gameStore.mjs';
import { buildInterior } from '../app/world-interiors.js';
import { furniturePlacementFeedback, furnitureScenePlacementFeedback, furnitureFootprint, surfaceForFurnitureAt } from '../src/shared/furniture-placement.mjs';
import { furnitureSurface } from '../src/shared/furniture-metadata.mjs';

const key=()=>crypto.randomUUID();
async function fixture(t){
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-furniture-authority-'));
  let store=new GameStore({dataDir,originRandomInt:(min,max)=>max===2?1:0});
  const id=(await store.register({username:'furniture_owner',password:'a-test-password',appearance:{presentation:'feminine'}})).residentId;
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  return {id,get store(){return store;},reopen(){store.close();store=new GameStore({dataDir});}};
}
const purchase=(f,itemId,idempotencyKey=key())=>f.store.action(f.id,'purchase',{itemId,idempotencyKey});
const place=(f,itemId,x=.4,y=.5,extra={})=>f.store.action(f.id,'place-furniture',{itemId,x,y,rotation:0,...extra});

test('furniture purchase debits one server price and remains stored until placement, including retry after restart',async t=>{
  const f=await fixture(t),p=f.store.profile(f.id),payload={itemId:'coffee-table',idempotencyKey:key(),price:1,wallet:900000000};
  const bought=f.store.action(f.id,'purchase',payload);assert.equal(bought.profile.wallet,p.wallet-catalog.find(item=>item.id==='coffee-table').price);
  assert.deepEqual(bought.profile.inventory,['coffee-table']);assert.deepEqual(bought.profile.storedFurniture,['coffee-table']);
  assert.equal(buildInterior({profile:bought.profile}).furniturePlacements.length,0);
  f.reopen();const repeated=f.store.action(f.id,'purchase',payload);assert.equal(repeated.replayed,true);assert.equal(repeated.profile.wallet,bought.profile.wallet);
  assert.equal(f.store.transactions(f.id).filter(entry=>entry.reason==='Furniture purchase · Timber coffee table').length,1);
  assert.throws(()=>f.store.action(f.id,'purchase',{idempotencyKey:crypto.randomUUID(),...payload,itemId:'bedside-table'}),error=>error.code==='idempotency_conflict');
  const placed=place(f,'coffee-table').profile;assert.equal(placed.furnitureLayout['coffee-table'].propertyId,p.home.propertyId);assert.deepEqual(placed.storedFurniture,[]);
  f.reopen();assert.deepEqual(f.store.profile(f.id).furnitureLayout,placed.furnitureLayout);assert.equal(f.store.profile(f.id).wallet,bought.profile.wallet);
});

test('server refuses forged ownership, another home, wall and item overlaps without changing persisted state',async t=>{
  const f=await fixture(t);purchase(f,'coffee-table');purchase(f,'plant');place(f,'coffee-table');
  const before=f.store.profile(f.id),ledger=f.store.transactions(f.id);
  const check=(itemId,payload,code)=>assert.throws(()=>f.store.action(f.id,'place-furniture',{itemId,rotation:0,...payload}),error=>error.code===code);
  check('plant',{x:.4,y:.5},'furniture_object_overlap');check('plant',{x:.4,y:.7,propertyId:'another-resident-home'},'furniture_wrong_home');
  const scene=buildInterior({profile:before}),wall=scene.walls[0],area=scene.furnishingArea;
  check('plant',{x:(wall.x+wall.w/2-area.x)/area.w,y:(wall.y+wall.h/2-area.y)/area.h},'furniture_wall_overlap');
  check('plant',{x:0,y:0},'furniture_outside_floor');assert.throws(()=>place(f,'sofa'),/Buy this furniture/);
  assert.deepEqual(f.store.profile(f.id),before);assert.deepEqual(f.store.transactions(f.id),ledger);
  f.store.action(f.id,'leave-home');assert.throws(()=>place(f,'plant'),/Go home/);
});

test('validated exact placements retain their position and rotation when rendered and after storage/re-placement',async t=>{
  const f=await fixture(t);purchase(f,'coffee-table');const placed=place(f,'coffee-table',.427,.627,{rotation:90}).profile;
  for(const profile of [placed,JSON.parse(JSON.stringify(placed)),f.store.profile(f.id)]){
    const scene=buildInterior({profile}),item=scene.furniturePlacements.find(item=>item.itemId==='coffee-table'),expected=furnitureFootprint(scene,'coffee-table',profile.furnitureLayout['coffee-table']);
    assert.deepEqual({x:item.x,y:item.y,w:item.w,h:item.h},expected);assert.equal(item.rotation,90);
  }
  f.store.action(f.id,'store-furniture',{itemId:'coffee-table'});f.reopen();assert.deepEqual(f.store.profile(f.id).storedFurniture,['coffee-table']);assert.ok(f.store.profile(f.id).inventory.includes('coffee-table'));
  const again=place(f,'coffee-table',.427,.627,{rotation:90}).profile;assert.deepEqual(again.furnitureLayout,placed.furnitureLayout);assert.equal(again.wallet,placed.wallet);
});

test('surface items require real owned placed supports and derive height without trusting client height',async t=>{
  const f=await fixture(t);purchase(f,'coffee-table');purchase(f,'table-lamp');purchase(f,'ceramic-vase');
  assert.throws(()=>place(f,'table-lamp'),error=>error.code==='furniture_surface_required');
  assert.throws(()=>place(f,'table-lamp',.4,.5,{supportId:'coffee-table'}),error=>error.code==='furniture_invalid_surface');
  place(f,'coffee-table');const lamp=place(f,'table-lamp',.4,.5,{supportId:'coffee-table',elevation:99999,verified:true}).profile;
  assert.deepEqual(lamp.furnitureLayout['table-lamp'],{x:.4,y:.5,rotation:0,propertyId:lamp.home.propertyId,supportId:'coffee-table'});
  const scene=buildInterior({profile:lamp}),model=scene.objects.find(item=>item.itemId==='table-lamp');assert.equal(model.elevation,furnitureSurface('coffee-table').height);assert.equal(model.supportId,'coffee-table');
  assert.equal(scene.obstacles.some(rect=>rect.x===model.x&&rect.y===model.y&&rect.w===model.w&&rect.h===model.h),false);
  const center={x:model.x+model.w/2,y:model.y+model.h/2};assert.equal(surfaceForFurnitureAt(scene,'table-lamp',center).supportId,'coffee-table');
  assert.throws(()=>place(f,'ceramic-vase',.4,.5,{supportId:'coffee-table'}),error=>error.code==='furniture_object_overlap');
  assert.throws(()=>place(f,'table-lamp',.55,.5,{supportId:'coffee-table'}),error=>error.code==='furniture_surface_edge');
  assert.throws(()=>place(f,'coffee-table',.4,.5,{supportId:'table-lamp'}),error=>error.code==='furniture_invalid_surface');
  f.reopen();assert.deepEqual(f.store.profile(f.id).furnitureLayout,lamp.furnitureLayout);assert.equal(buildInterior({profile:f.store.profile(f.id)}).objects.find(item=>item.itemId==='table-lamp').elevation,36.5);
});

test('moving a furnished support carries its objects; storing or selling it returns children to owned inventory',async t=>{
  const f=await fixture(t);purchase(f,'coffee-table');purchase(f,'table-lamp');place(f,'coffee-table');place(f,'table-lamp',.4,.5,{supportId:'coffee-table'});
  const moved=place(f,'coffee-table',.6,.6,{rotation:90}).profile;assert.deepEqual(moved.furnitureLayout['table-lamp'],{x:.6,y:.6,rotation:90,propertyId:moved.home.propertyId,supportId:'coffee-table'});
  f.store.action(f.id,'store-furniture',{itemId:'coffee-table'});let stored=f.store.profile(f.id);assert.deepEqual(stored.storedFurniture.sort(),['coffee-table','table-lamp']);assert.deepEqual(stored.furnitureLayout,{});assert.deepEqual(stored.inventory.sort(),['coffee-table','table-lamp']);
  place(f,'coffee-table');place(f,'table-lamp',.4,.5,{supportId:'coffee-table'});const wallet=f.store.profile(f.id).wallet;
  const sold=f.store.action(f.id,'sell-item',{itemId:'coffee-table',idempotencyKey:key()}).profile;assert.equal(sold.wallet,wallet+Math.floor(catalog.find(item=>item.id==='coffee-table').price/2));assert.deepEqual(sold.inventory,['table-lamp']);assert.deepEqual(sold.storedFurniture,['table-lamp']);assert.deepEqual(sold.furnitureLayout,{});
});

test('a placement belongs to its saved property while remaining movable into the current owned home',async t=>{
  const f=await fixture(t);purchase(f,'plant');const saved=place(f,'plant').profile,original=saved.home.propertyId;
  const target=properties.find(item=>item.id==='lugbe-flat');f.store.topup(f.id,{amount:target.buy,idempotencyKey:key()});
  const moved=f.store.action(f.id,'move-home',{idempotencyKey:crypto.randomUUID(),propertyId:target.id,tenure:'own'}).profile;assert.equal(moved.furnitureLayout.plant.propertyId,original);
  const scene=buildInterior({profile:{...moved,location:{kind:'home'}}});assert.equal(scene.furniturePlacements.some(item=>item.itemId==='plant'),false);assert.ok(scene.storedFurniture.includes('plant'));
  // Arranging is permitted only after reaching the resident's actual new home.
  const p=f.store.profile(f.id);p.district=p.home.district;p.location={kind:'home',district:p.home.district};f.store.save(p);
  const replaced=place(f,'plant',.6,.65).profile;assert.equal(replaced.furnitureLayout.plant.propertyId,target.id);assert.ok(replaced.ownedProperties.includes(target.id));
});

test('cheap drag feedback and authoritative confirmation disagree only on route reachability, never ownership or collisions',()=>{
  const scene={width:1760,height:1280,spawn:{x:857,y:1110},furnishingArea:{x:62,y:160,w:1636,h:1000},objects:[],walls:[],obstacles:[],interactables:[],furniturePlacements:[]};
  const p={location:{kind:'home'},home:{propertyId:'home'},inventory:['plant'],furnitureLayout:{},storedFurniture:['plant']};
  assert.equal(furniturePlacementFeedback(p,'plant',{x:.4,y:.5},{scene,checkRoutes:false}).valid,true);
  assert.equal(furniturePlacementFeedback(p,'plant',{x:.4,y:.7,propertyId:'foreign'},{scene,checkRoutes:false}).code,'furniture_wrong_home');
  assert.equal(furnitureScenePlacementFeedback(scene,'plant',{x:0,y:0,rotation:0},{checkRoutes:false}).code,'furniture_outside_floor');
  const furniture=catalog.filter(item=>item.category==='furniture');
  assert.ok(furniture.length>=54);
  for(const itemId of ['vanity-desk','kitchen-island','media-sideboard','floor-speaker','indoor-ficus','runner-rug'])assert.ok(furniture.some(item=>item.id===itemId),`${itemId} should be resident-owned 3D furniture`);
});

test('the server rejects a locally clear placement that seals the Maitama bedroom doorway',()=>{
  const profile={home:{propertyId:'maitama-villa'},location:{kind:'home'},inventory:['sofa','pool-table'],storedFurniture:['pool-table'],furnitureLayout:{sofa:{x:(476-62)/1636,y:(1029-160)/1000,rotation:90}}};
  const placement={x:(389.5-62)/1636,y:(735-160)/1000,rotation:270};
  const scene=buildInterior({profile});
  assert.equal(furniturePlacementFeedback(profile,'pool-table',placement,{scene,checkRoutes:false}).valid,true);
  assert.equal(furniturePlacementFeedback(profile,'pool-table',placement,{scene}).code,'furniture_route_blocked');
});

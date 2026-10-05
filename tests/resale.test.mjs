import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { build } from 'esbuild';
import { GameStore, catalog } from '../src/server/gameStore.mjs';
import { buildInterior } from '../app/world-interiors.js';

async function fixture(t,branch=1){
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-resale-'));
  let calls=0,time=Date.parse('2026-10-05T09:00:00Z'),store=new GameStore({dataDir,clock:()=>time,originRandomInt:()=>calls++%2===0?branch:0});
  const id=(await store.register({username:'resale_player',password:'a-test-password'})).residentId;
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  return{id,get store(){return store;},advance:ms=>{time+=ms;},reopen(){store.close();store=new GameStore({dataDir,clock:()=>time});}};
}
const sell=(f,itemId,key='resale_item_key',extra={})=>f.store.action(f.id,'sell-item',{itemId,idempotencyKey:key,...extra});

test('system resale pays the authoritative half price, clears placement and replays without another credit',async t=>{
  const f=await fixture(t);
  f.store.action(f.id,'purchase',{itemId:'plant'});f.store.action(f.id,'place-furniture',{itemId:'plant',x:.4,y:.5});
  const before=f.store.profile(f.id),ledger=f.store.transactions(f.id).length;
  const result=sell(f,'plant','resale_plant_key',{amount:999999999,price:999999999,wallet:999999999});
  assert.equal(result.sale.amount,1150);assert.equal(result.sale.itemId,'plant');assert.equal(result.sale.virtual,true);
  assert.equal(result.profile.wallet,before.wallet+1150);assert.equal(result.profile.inventory.includes('plant'),false);
  assert.equal(result.profile.furnitureLayout.plant,undefined);assert.equal(result.profile.storedFurniture.includes('plant'),false);
  assert.equal(f.store.transactions(f.id).length,ledger+1);
  f.reopen();const repeated=sell(f,'plant','resale_plant_key');
  assert.equal(repeated.replayed,true);assert.equal(repeated.profile.wallet,before.wallet+1150);
  assert.equal(f.store.transactions(f.id).filter(row=>row.reason==='System resale · Indoor plant').length,1);
  assert.throws(()=>sell(f,'plant','resale_second_key'),error=>error.code==='item_not_owned');
  assert.equal(f.store.profile(f.id).wallet,before.wallet+1150);
});

test('selling stored furniture removes storage ownership and fresh gifts can be sold without reseeding',async t=>{
  const f=await fixture(t,0);f.store.action(f.id,'store-furniture',{itemId:'sofa'});
  const before=f.store.profile(f.id),price=catalog.find(item=>item.id==='sofa').price;
  const result=sell(f,'sofa');
  assert.equal(result.sale.amount,Math.floor(price/2));assert.equal(result.profile.wallet,before.wallet+Math.floor(price/2));
  assert.equal(result.profile.inventory.includes('sofa'),false);assert.equal(result.profile.storedFurniture.includes('sofa'),false);
  f.reopen();const p=f.store.profile(f.id),scene=buildInterior({profile:p});
  assert.equal(p.home.furnishingPreset,'nepo-furnished');assert.equal(p.inventory.includes('sofa'),false);
  assert.equal(scene.objects.some(object=>object.itemId==='sofa'),false);
});

test('selling an equipped paid outfit returns to the starter outfit and removes the entitlement',async t=>{
  const f=await fixture(t);f.store.action(f.id,'purchase',{itemId:'traditional-set'});f.store.action(f.id,'equip',{itemId:'traditional-set'});
  const before=f.store.profile(f.id).wallet,result=sell(f,'traditional-set');
  assert.equal(result.sale.amount,6000);assert.equal(result.profile.wallet,before+6000);assert.equal(result.profile.appearance.top,'forest');
  assert.throws(()=>f.store.action(f.id,'equip',{itemId:'traditional-set'}),/own/);
});

test('driving vehicles and active journeys reject resale until parked or arrived',async t=>{
  const f=await fixture(t);
  f.store.action(f.id,'purchase',{itemId:'used-hatchback',color:'blue'});f.store.action(f.id,'purchase',{itemId:'plant'});f.store.action(f.id,'leave-home');
  f.store.action(f.id,'toggle-driving',{vehicleId:'used-hatchback'});
  const before=f.store.profile(f.id);
  assert.throws(()=>sell(f,'used-hatchback','resale_drive_key'),error=>error.code==='vehicle_driving');
  assert.equal(f.store.profile(f.id).wallet,before.wallet);assert.equal(f.store.profile(f.id).vehicleColors['used-hatchback'],'blue');
  f.store.action(f.id,'toggle-driving',{vehicleId:null});const {trip}=f.store.action(f.id,'travel',{district:'jabi',mode:'car'});
  assert.throws(()=>sell(f,'plant','resale_trip_key'),error=>error.code==='trip_active');
  assert.throws(()=>sell(f,'used-hatchback','resale_drive_key'),error=>error.code==='trip_active');
  f.advance(trip.seconds*1000);f.store.action(f.id,'arrive',{tripId:trip.id});
  assert.throws(()=>sell(f,'used-hatchback','resale_drive_key'),error=>error.code==='vehicle_driving');
  f.store.action(f.id,'toggle-driving',{vehicleId:null});const result=sell(f,'used-hatchback','resale_drive_key');
  assert.equal(result.sale.amount,14000);assert.equal(result.profile.vehicleColors['used-hatchback'],undefined);assert.equal(result.profile.drivingVehicle,null);
  assert.equal(sell(f,'plant','resale_trip_key').sale.amount,1150);
});

test('unknown items, missing ownership and reused operation keys cannot create credits',async t=>{
  const f=await fixture(t),before=f.store.profile(f.id).wallet;
  assert.throws(()=>sell(f,'invented'),error=>error.code==='invalid_item');
  assert.throws(()=>sell(f,'plant'),error=>error.code==='item_not_owned');
  assert.throws(()=>f.store.action(f.id,'sell-item',{itemId:'plant'}),error=>error.code==='idempotency_required');
  assert.equal(f.store.profile(f.id).wallet,before);
  f.store.action(f.id,'purchase',{itemId:'plant'});sell(f,'plant','resale_conflict_key');
  f.store.action(f.id,'purchase',{itemId:'rug'});
  assert.throws(()=>sell(f,'rug','resale_conflict_key'),error=>error.code==='idempotency_conflict');
  assert.equal(f.store.profile(f.id).inventory.includes('rug'),true);
});

test('a wallet overflow rolls back ownership, placement, ledger and operation key atomically',async t=>{
  const f=await fixture(t);f.store.action(f.id,'purchase',{itemId:'plant'});f.store.action(f.id,'place-furniture',{itemId:'plant',x:.4,y:.5});
  const profile=f.store.profile(f.id);profile.wallet=Number.MAX_SAFE_INTEGER;f.store.save(profile);
  const before=f.store.profile(f.id),ledger=f.store.transactions(f.id).length;
  assert.throws(()=>sell(f,'plant','resale_overflow_key'),error=>error.code==='numeric_limit');
  assert.deepEqual(f.store.profile(f.id),before);assert.equal(f.store.transactions(f.id).length,ledger);
  assert.equal(f.store.get('SELECT count(*) n FROM economy_operations WHERE resident_id=? AND operation_key=?',f.id,'resale_overflow_key').n,0);
  const retry=f.store.profile(f.id);retry.wallet-=1150;f.store.save(retry);
  assert.equal(sell(f,'plant','resale_overflow_key').profile.wallet,Number.MAX_SAFE_INTEGER);
});

const repo=new URL('../',import.meta.url).pathname;
const source=fs.readFileSync(path.join(repo,'preview/runtime.mjs'),'utf8').replace("await import('../app/app.js');",'globalThis.__adapterReady=true;');
const code=(await build({stdin:{contents:source,resolveDir:path.join(repo,'preview'),sourcefile:'runtime.mjs'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'})).outputFiles[0].text;
function preview(storage=new Map()){
  let draws=0;const events=new EventTarget(),context=vm.createContext({
    Date,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},document:{documentElement:{dataset:{}}},
    location:Object.assign(new URL('https://preview.test/'),{reload(){}}),crypto:{randomUUID:()=>crypto.randomUUID(),getRandomValues(value){value[0]=draws++%2===0?1:0;return value;}},
    structuredClone,URL,Request,Response,Event,EventTarget,MessageEvent,DOMException,Blob,atob,btoa,queueMicrotask,
    addEventListener:events.addEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),fetch:async()=>{throw new Error('Unexpected external request');},
  });vm.runInContext(code,context);
  return{storage,async request(route,body,status=200){const response=await context.fetch('https://preview.test'+route,body===undefined?{}:{method:'POST',body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;},action(action,payload={},status=200){return this.request('/api/action',{action,payload},status);}};
}

test('the actual browser adapter keeps keyed purchases stored and restores exact property and support references',async()=>{
  const f=preview(),before=(await f.request('/api/bootstrap')).profile.wallet;
  const purchase={itemId:'coffee-table',idempotencyKey:'preview_furniture_purchase'};
  const bought=await f.action('purchase',purchase);assert.equal(bought.profile.wallet,before-8000);assert.deepEqual(bought.profile.storedFurniture,['coffee-table']);
  const retry=await f.action('purchase',purchase);assert.equal(retry.replayed,true);assert.equal(retry.profile.wallet,bought.profile.wallet);
  await f.action('place-furniture',{itemId:'coffee-table',x:.4,y:.5,rotation:90});await f.action('purchase',{itemId:'plant',idempotencyKey:'preview_surface_plant'});
  // A small plant can sit on a real table, and supplied client elevation is ignored.
  const arranged=await f.action('place-furniture',{itemId:'plant',x:.4,y:.5,rotation:0,supportId:'coffee-table',elevation:99999});
  assert.equal(arranged.profile.furnitureLayout.plant.supportId,'coffee-table');assert.equal(arranged.profile.furnitureLayout.plant.propertyId,arranged.profile.home.propertyId);assert.equal(arranged.profile.furnitureLayout.plant.elevation,undefined);
  const again=preview(f.storage),restored=(await again.request('/api/bootstrap')).profile;assert.deepEqual(restored.furnitureLayout,arranged.profile.furnitureLayout);assert.equal(restored.wallet,arranged.profile.wallet);
  const blocked=await again.action('place-furniture',{itemId:'plant',x:.4,y:.5,propertyId:'another-home'},400);assert.equal(blocked.code,'furniture_wrong_home');
  const after=(await again.request('/api/bootstrap')).profile;assert.deepEqual(after.furnitureLayout,restored.furnitureLayout);
});

test('the actual preview resale clears placed and stored pieces and remains idempotent after reload',async()=>{
  const f=preview();await f.action('purchase',{itemId:'plant'});await f.action('place-furniture',{itemId:'plant',x:.4,y:.5});
  const before=(await f.request('/api/bootstrap')).profile.wallet;
  const result=await f.action('sell-item',{itemId:'plant',idempotencyKey:'preview_resale_key',amount:999999999});
  assert.equal(result.sale.amount,1150);assert.equal(result.profile.wallet,before+1150);assert.equal(result.profile.furnitureLayout.plant,undefined);assert.deepEqual(result.profile.inventory,[]);
  const again=preview(f.storage),replay=await again.action('sell-item',{itemId:'plant',idempotencyKey:'preview_resale_key'});
  assert.equal(replay.replayed,true);assert.equal(replay.profile.wallet,before+1150);
  const denied=await again.action('sell-item',{itemId:'plant',idempotencyKey:'preview_resale_second'},403);assert.equal(denied.code,'item_not_owned');
  await again.action('purchase',{itemId:'rug'});await again.action('store-furniture',{itemId:'rug'});
  const sold=await again.action('sell-item',{itemId:'rug',idempotencyKey:'preview_resale_stored'});assert.equal(sold.profile.storedFurniture.includes('rug'),false);
});

test('preview resale restores starter clothing and rejects driving or travelling sales',async()=>{
  const f=preview();await f.action('purchase',{itemId:'traditional-set'});await f.action('equip',{itemId:'traditional-set'});
  const outfit=await f.action('sell-item',{itemId:'traditional-set',idempotencyKey:'preview_resale_outfit'});assert.equal(outfit.profile.appearance.top,'forest');assert.equal(outfit.sale.amount,6000);
  await f.action('purchase',{itemId:'used-hatchback',color:'red'});await f.action('leave-home');await f.action('toggle-driving',{vehicleId:'used-hatchback'});
  const parked=await f.action('sell-item',{itemId:'used-hatchback',idempotencyKey:'preview_resale_car'},409);assert.equal(parked.code,'vehicle_driving');
  await f.action('toggle-driving',{vehicleId:null});const sold=await f.action('sell-item',{itemId:'used-hatchback',idempotencyKey:'preview_resale_car'});assert.equal(sold.sale.amount,14000);assert.equal(sold.profile.vehicleColors['used-hatchback'],undefined);
  await f.action('purchase',{itemId:'plant'});await f.action('travel',{district:'jabi',mode:'bus'});
  const transit=await f.action('sell-item',{itemId:'plant',idempotencyKey:'preview_resale_trip'},409);assert.equal(transit.code,'trip_active');
});

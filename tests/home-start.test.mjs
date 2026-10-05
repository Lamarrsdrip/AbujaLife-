import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { build } from 'esbuild';
import { GameStore, catalog, properties } from '../src/server/gameStore.mjs';
import { appearanceOptions as appearanceValues } from '../src/shared/catalogue.mjs';
import { starterHomeSeed } from '../src/shared/life.mjs';
import { ORIGIN_HOMES } from '../src/shared/origins.mjs';
import { buildInterior, furniturePlacementPreservesRoutes } from '../app/world-interiors.js';

const repo=fileURLToPath(new URL('../',import.meta.url));
const gifts=['bed','sofa','dining-table','fridge'];
async function fixture(t,branch=1,index=0) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-home-start-'));
  let calls=0,store=new GameStore({dataDir,originRandomInt:()=>calls++%2===0?branch:index});
  const id=(await store.register({username:'home_start_player',password:'a-test-password',appearance:{presentation:'feminine'},inventory:['king-bed','premium-sofa'],home:{furnishingPreset:'forged'}})).residentId;
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  return {id,get store(){return store;},reopen(){store.close();store=new GameStore({dataDir});}};
}

test('new Lapo residents start bare and Nepo residents own only moderate furnishings',async t=>{
  for(const [branch,originId] of ['nepo','lapo'].entries()){
    const f=await fixture(t,branch),p=f.store.profile(f.id),nepo=originId==='nepo';
    assert.equal(p.origin.id,originId);assert.equal(p.wallet,nepo?1000000:100000);
    assert.equal(p.home.furnishingPreset,nepo?'nepo-furnished':'lapo-basic');assert.equal(p.home.starterVersion,1);
    assert.deepEqual(p.inventory,nepo?gifts:[]);assert.deepEqual(p.furnitureLayout,{});assert.deepEqual(p.storedFurniture,[]);
    assert.ok(!p.inventory.includes('king-bed'));assert.ok(!p.inventory.includes('premium-sofa'));
    assert.ok(p.inventory.every(id=>catalog.some(item=>item.id===id&&item.category==='furniture')));
    assert.equal(f.store.transactions(f.id).filter(row=>row.reason==='Resident starting balance').length,1);
    f.reopen();assert.deepEqual(f.store.profile(f.id).inventory,p.inventory);assert.equal(f.store.profile(f.id).wallet,p.wallet);
  }
});

test('random origin areas retain their different layouts and furnishing presets',async t=>{
  for(const [branch,originId] of ['nepo','lapo'].entries())for(const [index,home] of ORIGIN_HOMES[originId].entries()){
    const f=await fixture(t,branch,index),p=f.store.profile(f.id);
    assert.equal(p.district,home.district);assert.equal(p.home.layoutId,home.layoutId);
    assert.equal(p.home.furnishingPreset,originId==='nepo'?'nepo-furnished':'lapo-basic');
  }
});

test('Lapo furnishing progresses through actual purchases and saved placements',async t=>{
  const f=await fixture(t),before=f.store.profile(f.id);
  assert.throws(()=>f.store.action(f.id,'place-furniture',{itemId:'plant',x:.4,y:.5}),/Buy this furniture/);
  const bought=f.store.action(f.id,'purchase',{itemId:'plant'}).profile;
  assert.equal(bought.wallet,before.wallet-2300);assert.deepEqual(bought.inventory,['plant']);
  const placed=f.store.action(f.id,'place-furniture',{itemId:'plant',x:.4,y:.5,rotation:0}).profile;
  f.reopen();assert.deepEqual(f.store.profile(f.id).inventory,['plant']);assert.deepEqual(f.store.profile(f.id).furnitureLayout,placed.furnitureLayout);
  assert.equal(f.store.profile(f.id).home.furnishingPreset,'lapo-basic');assert.equal(f.store.profile(f.id).wallet,before.wallet-2300);
});

test('moderate Nepo gifts remain owned and stored gifts are not reseeded on restart',async t=>{
  const f=await fixture(t,0),before=f.store.profile(f.id);
  assert.throws(()=>f.store.action(f.id,'purchase',{itemId:'bed'}),/already own/);
  f.store.action(f.id,'store-furniture',{itemId:'bed'});f.reopen();
  const p=f.store.profile(f.id);assert.deepEqual(p.inventory,gifts);assert.deepEqual(p.storedFurniture,['bed']);assert.equal(p.wallet,before.wallet);
  assert.deepEqual(starterHomeSeed(p.origin).inventory,gifts);
});

test('existing residents keep their inventory, appearance and home without a new furnishing seed',async t=>{
  const f=await fixture(t,0),old=f.store.profile(f.id);
  delete old.home.furnishingPreset;delete old.home.starterVersion;
  old.inventory=['plant'];old.furnitureLayout={plant:{x:.4,y:.5,rotation:0}};old.wallet=87654;old.appearance.presentation='neutral';
  f.store.save(old);f.reopen();const restored=f.store.profile(f.id);
  assert.deepEqual(restored.home,old.home);assert.deepEqual(restored.inventory,['plant']);assert.deepEqual(restored.furnitureLayout,old.furnitureLayout);
  assert.equal(restored.wallet,87654);assert.equal(restored.appearance.presentation,'neutral');assert.equal(restored.home.furnishingPreset,undefined);
});

test('fresh Lapo scenes contain a basic mat and plumbing while Nepo scenes display only their four owned gifts',()=>{
  const layoutShapes=new Set();
  for(const [originId,homes] of Object.entries(ORIGIN_HOMES))for(const home of homes){
    const seed=starterHomeSeed({id:originId});
    const profile={home:{...home,propertyId:'personal-home',...seed.homeStyle},location:{kind:'home'},inventory:seed.inventory,furnitureLayout:{},storedFurniture:[]};
    const scene=buildInterior({profile}),bare=originId==='lapo';
    assert.equal(furniturePlacementPreservesRoutes(scene,null),true,home.district+' keeps every activity reachable');
    assert.ok(scene.interactables.some(point=>point.action==='shower'));
    assert.ok(scene.interactables.some(point=>point.action==='sleep'));
    assert.ok(scene.interactables.some(point=>point.action==='eat'));
    assert.ok(scene.interactables.some(point=>point.action==='leave-home'));
    if(bare){
      assert.deepEqual(scene.furniturePlacements,[]);
      assert.deepEqual(scene.objects.map(object=>object.kind).sort(),['basin','shower','sleeping-mat','toilet']);
      assert.equal(scene.objects.some(object=>object.itemId),false,'a basic mat grants no catalog furniture');
    }else{
      assert.deepEqual(scene.furniturePlacements.map(item=>item.itemId).sort(),[...gifts].sort());
      assert.deepEqual(scene.objects.filter(object=>!object.itemId).map(object=>object.kind).sort(),['basin','shower','toilet']);
      assert.deepEqual(scene.storedFurniture,[]);
      layoutShapes.add(JSON.stringify([scene.width,scene.height,scene.walls]));
    }
    assert.equal(scene.objects.some(object=>['wardrobe','kitchen','plant','tv','chair','desk','art-piece','pool-table'].includes(object.kind)),false);
  }
  assert.equal(layoutShapes.size,3,'the three Nepo areas retain different authored floor plans');
});

test('buying a bed replaces the basic mat, and storing gifts removes their scene objects',()=>{
  const lapo=starterHomeSeed({id:'lapo'}),profile={home:{propertyId:'personal-home',layoutId:'garki-studio',...lapo.homeStyle},location:{kind:'home'},inventory:['bed'],furnitureLayout:{},storedFurniture:[]};
  const furnished=buildInterior({profile});
  assert.ok(furnished.objects.some(object=>object.itemId==='bed'));assert.equal(furnished.objects.some(object=>object.kind==='sleeping-mat'),false);
  assert.equal(furniturePlacementPreservesRoutes(furnished,null),true);
  const nepo=starterHomeSeed({id:'nepo'}),stored=buildInterior({profile:{...profile,home:{...profile.home,layoutId:'jabi-apartment',...nepo.homeStyle},inventory:nepo.inventory,storedFurniture:['bed','sofa','dining-table','fridge']}});
  assert.deepEqual(stored.furniturePlacements,[]);assert.deepEqual(stored.storedFurniture,gifts);
  assert.deepEqual(stored.objects.map(object=>object.kind).sort(),['basin','shower','toilet']);
  assert.equal(furniturePlacementPreservesRoutes(stored,null),true);
});

test('fresh homes remain walkable with the purchased furniture catalog and saved rotated placements',()=>{
  const furniture=catalog.filter(item=>item.category==='furniture').map(item=>item.id);
  for(const [originId,homes] of Object.entries(ORIGIN_HOMES))for(const home of homes){
    const seed=starterHomeSeed({id:originId}),profile={home:{...home,propertyId:'personal-home',...seed.homeStyle},location:{kind:'home'},inventory:furniture,storedFurniture:[],furnitureLayout:Object.fromEntries(furniture.map((id,index)=>[id,{x:(index%4+1)/5,y:(Math.floor(index/4)+1)/6,rotation:index%2?90:270}]))};
    const scene=buildInterior({profile});
    assert.equal(furniturePlacementPreservesRoutes(scene,null),true,home.district);
    assert.equal(scene.furniturePlacements.length+scene.storedFurniture.length,furniture.length,home.district+' accounts for every purchase');
  }
});

test('moving to every listed floor plan preserves the furnishing progression without free props',async t=>{
  for(const branch of [0,1]){
    const f=await fixture(t,branch);f.store.topup(f.id,{amount:20000000,idempotencyKey:'home_start_move_funds'});
    const before=f.store.profile(f.id),inventory=[...before.inventory];
    for(const property of properties.filter(item=>item.tier>0)){
      const moved=f.store.action(f.id,'move-home',{propertyId:property.id,tenure:'own'}).profile;
      assert.equal(moved.home.starterVersion,1);assert.equal(moved.home.furnishingPreset,before.home.furnishingPreset);assert.deepEqual(moved.inventory,inventory);
      const scene=buildInterior({profile:{...moved,location:{kind:'home'}}});
      assert.equal(furniturePlacementPreservesRoutes(scene,null),true,property.id+' remains reachable after moving');
      assert.equal(scene.objects.some(object=>['kitchen','wardrobe','plant','tv','desk'].includes(object.kind)),false);
      assert.deepEqual(scene.furniturePlacements.map(item=>item.itemId).sort(),[...inventory].sort());
      assert.equal(scene.objects.filter(object=>object.kind==='sleeping-mat').length,branch===1?1:0);
    }
  }
});

test('fresh onboarding requires a real Female or Male choice while old neutral residents remain valid',async t=>{
  const f=await fixture(t);f.store.updateProfile(f.id,{appearance:{presentation:'neutral'}});
  assert.throws(()=>f.store.updateProfile(f.id,{onboardingComplete:true}),error=>error.code==='gender_required');
  assert.equal(f.store.profile(f.id).onboardingComplete,false);
  assert.equal(f.store.updateProfile(f.id,{appearance:{presentation:'masculine'},onboardingComplete:true}).appearance.presentation,'masculine');
  const legacy=f.store.profile(f.id);delete legacy.home.starterVersion;delete legacy.home.furnishingPreset;legacy.appearance.presentation='neutral';f.store.save(legacy);
  assert.equal(f.store.updateProfile(f.id,{onboardingComplete:true}).appearance.presentation,'neutral');
});

const previewSource=fs.readFileSync(path.join(repo,'preview/runtime.mjs'),'utf8').replace("await import('../app/app.js');",'globalThis.__adapterReady=true;');
const previewCode=(await build({stdin:{contents:previewSource,resolveDir:path.join(repo,'preview'),sourcefile:'runtime.mjs'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'})).outputFiles[0].text;
function preview(branch=1,index=0,storage=new Map()) {
  const events=new EventTarget();let calls=0;
  const context=vm.createContext({
    Date,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},document:{documentElement:{dataset:{}}},
    location:Object.assign(new URL('https://preview.test/'),{reload(){}}),
    crypto:{randomUUID:()=>crypto.randomUUID(),getRandomValues(value){value[0]=calls++%2===0?branch:index;return value;}},
    structuredClone,URL,Request,Response,Event,EventTarget,MessageEvent,DOMException,Blob,atob,btoa,queueMicrotask,
    addEventListener:events.addEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),fetch:async()=>{throw new Error('Unexpected external request');},
  });
  vm.runInContext(previewCode,context);
  return {storage,get randomCalls(){return calls;},async request(route,body,expected=200){const response=await context.fetch('https://preview.test'+route,body===undefined?{}:{method:'POST',body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;}};
}

test('actual preview onboarding and moving homes retain the same sparse progression as the server',async()=>{
  const adapter=preview(1),error=await adapter.request('/api/profile',{onboardingComplete:true},400);
  assert.equal(error.code,'gender_required');
  const chosen=await adapter.request('/api/profile',{appearance:{presentation:'feminine'},onboardingComplete:true});
  assert.equal(chosen.profile.onboardingComplete,true);assert.equal(chosen.profile.appearance.presentation,'feminine');
  await adapter.request('/api/wallet/topup',{amount:20000000,idempotencyKey:'preview_home_move_funds'});
  for(const property of properties.filter(item=>item.tier>0)){
    const moved=await adapter.request('/api/action',{action:'move-home',payload:{propertyId:property.id,tenure:'own'}});
    assert.equal(moved.profile.home.starterVersion,1);assert.equal(moved.profile.home.furnishingPreset,'lapo-basic');assert.deepEqual(moved.profile.inventory,[]);
    const scene=buildInterior({profile:{...moved.profile,location:{kind:'home'}}});
    assert.equal(furniturePlacementPreservesRoutes(scene,null),true,property.id);
    assert.deepEqual(scene.objects.map(object=>object.kind).sort(),['basin','shower','sleeping-mat','toilet']);
  }
});

test('the actual browser adapter matches server fresh-home seeds and preserves purchases on reload',async t=>{
  for(const branch of [0,1]){
    const f=await fixture(t,branch),adapter=preview(branch),server=f.store.profile(f.id),browser=(await adapter.request('/api/bootstrap')).profile;
    assert.equal(browser.origin.id,server.origin.id);assert.equal(browser.wallet,server.wallet);assert.equal(browser.home.furnishingPreset,server.home.furnishingPreset);
    assert.deepEqual(browser.inventory,server.inventory);
    await adapter.request('/api/action',{action:'purchase',payload:{itemId:'plant'}});
    const reloaded=preview(1-branch,0,adapter.storage),saved=(await reloaded.request('/api/bootstrap')).profile;
    assert.deepEqual(saved.inventory,[...server.inventory,'plant']);assert.equal(saved.wallet,server.wallet-2300);assert.equal(reloaded.randomCalls,0);
  }
});

test('preview saves created before furnishing presets stay unchanged',async()=>{
  const adapter=preview(0),key='abujalife.browser-preview.v1',old=JSON.parse(adapter.storage.get(key));
  delete old.profile.home.furnishingPreset;delete old.profile.home.starterVersion;
  old.profile.inventory=['plant'];old.profile.furnitureLayout={plant:{x:.4,y:.5,rotation:0}};old.profile.wallet=43210;old.profile.appearance.presentation='neutral';
  adapter.storage.set(key,JSON.stringify(old));const reloaded=preview(1,0,adapter.storage),p=(await reloaded.request('/api/bootstrap')).profile;
  assert.deepEqual(p.inventory,['plant']);assert.deepEqual(p.home,old.profile.home);assert.equal(p.wallet,43210);assert.equal(p.appearance.presentation,'neutral');assert.equal(reloaded.randomCalls,0);
});

test('the signup wizard requires Male or Female while an existing neutral profile retains its choice',()=>{
  const source=fs.readFileSync(path.join(repo,'app/app.js'),'utf8');
  const lines=['const appearanceOptionsLabels=','const appearanceOptions=','const appearanceLabels=','const appearanceColors=','function appearanceChoices('].map(prefix=>source.split('\n').find(line=>line.startsWith(prefix))).join('\n');
  const context=vm.createContext({appearanceValues,state:{profile:{inventory:[]}},esc:value=>String(value)});
  vm.runInContext(lines,context);
  const signup=vm.runInContext("appearanceChoices({presentation:'neutral'},['presentation'],{signup:true})",context);
  assert.match(signup,/>Gender</);assert.match(signup,/>Female</);assert.match(signup,/>Male</);
  assert.equal((signup.match(/required/g)||[]).length,2);assert.doesNotMatch(signup,/value="neutral"/);
  const legacy=vm.runInContext("appearanceChoices({presentation:'neutral'},['presentation'])",context);
  assert.match(legacy,/value="neutral"[^>]*checked/);
});

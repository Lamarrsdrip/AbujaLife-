import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore, transportModes } from '../src/server/gameStore.mjs';
import { SocialStore } from '../src/server/socialStore.mjs';
import { ABUJA_ATLAS } from '../src/shared/atlas.mjs';
import { travelPricing } from '../src/shared/life.mjs';

async function fixture(t) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-transport-'));
  let time=Date.parse('2026-10-05T10:00:00Z'),store=new GameStore({dataDir,clock:()=>time,originRandomInt:(min,max)=>max===2?1:0});
  const {residentId:id}=await store.register({username:'transport_player',password:'a-test-password'});
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  return {id,get store(){return store;},advance:ms=>{time+=ms;},reopen(){store.close();store=new GameStore({dataDir,clock:()=>time});}};
}

test('paid transport charges authoritative fares while a resident-owned car is free to drive',async t=>{
  const f=await fixture(t);
  f.store.topup(f.id,{amount:100000,idempotencyKey:'transport_car_funds'});
  f.store.action(f.id,'purchase',{itemId:'used-hatchback'});
  f.store.action(f.id,'leave-home');
  const fares={bus:330,taxi:830,ride:1080,bike:420,car:0};
  assert.ok(transportModes.some(mode=>mode.id==='bike'));
  for(const [mode,fare] of Object.entries(fares)){
    const district=f.store.profile(f.id).district,before=f.store.profile(f.id).wallet;
    const quote=f.store.quoteTravel(f.id,{district,mode,venueId:'restaurant'});
    assert.equal(quote.cost,fare);assert.ok(quote.seconds>=4);assert.equal(quote.venueId,'restaurant');
    const result=f.store.action(f.id,'travel',{district,mode,venueId:'restaurant',cost:999999,seconds:0,arrivesAt:0});
    assert.equal(result.trip.cost,fare);assert.equal(result.trip.seconds,quote.seconds);
    assert.equal(result.profile.wallet,before-fare);assert.equal(result.profile.location.kind,'transit');
    if(mode==='car')assert.equal(result.trip.vehicleId,'used-hatchback');
    assert.throws(()=>f.store.action(f.id,'arrive',{tripId:result.trip.id}),error=>error.code==='trip_in_progress');
    assert.throws(()=>f.store.action(f.id,'enter-home'),/journey/);
    f.advance(result.trip.seconds*1000);
    const arrived=f.store.action(f.id,'arrive',{tripId:result.trip.id}).profile;
    assert.deepEqual(arrived.location,{kind:'venue',district,venue:'restaurant'});
    assert.equal(arrived.activeTrip,null);assert.equal(arrived.drivingVehicle,null);
    assert.equal(arrived.wallet,before-fare);
    assert.throws(()=>f.store.action(f.id,'arrive',{tripId:result.trip.id}),/no longer active/);
    f.store.action(f.id,'exit-venue');
  }
});

test('walking stays free and targeted rides require leaving the current interior',async t=>{
  const f=await fixture(t),district=f.store.profile(f.id).district,before=f.store.profile(f.id).wallet;
  const quote=f.store.quoteTravel(f.id,{district,mode:'walk',venueId:'cafe'});
  assert.equal(quote.cost,0);
  assert.throws(()=>f.store.action(f.id,'travel',{district,mode:'taxi',venueId:'cafe'}),/Head out/);
  assert.equal(f.store.profile(f.id).wallet,before);
  f.store.action(f.id,'leave-home');f.store.action(f.id,'enter-venue',{venueId:'cafe'});
  assert.equal(f.store.profile(f.id).wallet,before);assert.equal(f.store.profile(f.id).activeTrip,null);
  assert.throws(()=>f.store.action(f.id,'travel',{district,mode:'bike',venueId:'restaurant'}),/Head out/);
  f.store.action(f.id,'exit-venue');f.store.action(f.id,'enter-home');
  assert.equal(f.store.profile(f.id).location.kind,'home');assert.equal(f.store.profile(f.id).wallet,before);
});

test('an explicitly selected owned car remains the journey vehicle with multiple cars',async t=>{
  const f=await fixture(t);
  f.store.topup(f.id,{amount:1000000,idempotencyKey:'multiple_owned_cars'});
  f.store.action(f.id,'purchase',{itemId:'used-hatchback'});
  f.store.action(f.id,'purchase',{itemId:'compact-car'});
  f.store.action(f.id,'leave-home');
  const district=f.store.profile(f.id).district,before=f.store.profile(f.id).wallet;
  const result=f.store.action(f.id,'travel',{district,mode:'car',venueId:'restaurant',vehicleId:'compact-car'});
  assert.equal(result.trip.vehicleId,'compact-car');
  assert.equal(result.profile.wallet,before);
  f.advance(result.trip.seconds*1000);
  f.store.action(f.id,'arrive',{tripId:result.trip.id});
  f.store.action(f.id,'exit-venue');
  assert.throws(()=>f.store.action(f.id,'travel',{district,mode:'car',venueId:'restaurant',vehicleId:'unowned-car'}),/Buy this car/);
  assert.equal(f.store.profile(f.id).activeTrip,null);
  assert.equal(f.store.profile(f.id).wallet,before);
});

test('venue availability, walk range, vehicle ownership and affordability cannot be forged',async t=>{
  const f=await fixture(t),district=f.store.profile(f.id).district;
  f.store.action(f.id,'leave-home');
  const before=f.store.profile(f.id);
  const invalid=[
    {district,mode:'car',venueId:'cafe'},
    {district,mode:'plane',venueId:'cafe'},
    {district,mode:'taxi',venueId:''},
    {district,mode:'taxi',venueId:'invented'},
    {district,mode:'taxi',venueId:'jabi-lake'},
    {district:'jabi',mode:'walk',venueId:'jabi-lake'},
    {district:'invented',mode:'taxi',venueId:'cafe'},
  ];
  for(const route of invalid){
    assert.throws(()=>f.store.quoteTravel(f.id,route));assert.throws(()=>f.store.action(f.id,'travel',{...route,cost:0}));
    assert.equal(f.store.profile(f.id).wallet,before.wallet);assert.deepEqual(f.store.profile(f.id).location,before.location);assert.equal(f.store.profile(f.id).activeTrip,null);
  }
  const poor=f.store.profile(f.id);poor.wallet=0;f.store.save(poor);
  assert.throws(()=>f.store.action(f.id,'travel',{district,mode:'bike',venueId:'cafe',cost:0}),/need more Naira/);
  assert.equal(f.store.profile(f.id).wallet,0);assert.equal(f.store.profile(f.id).activeTrip,null);
});

test('a venue destination survives restart and cross-district arrival opens the selected room',async t=>{
  const f=await fixture(t);f.store.action(f.id,'leave-home');
  const {trip}=f.store.action(f.id,'travel',{district:'jabi',mode:'bike',venueId:'jabi-lake'});
  const paid=f.store.profile(f.id).wallet;f.reopen();
  assert.equal(f.store.profile(f.id).activeTrip.venueId,'jabi-lake');
  assert.equal(f.store.profile(f.id).activeTrip.mode,'bike');
  f.advance(trip.seconds*1000);
  const arrived=f.store.action(f.id,'arrive',{tripId:trip.id}).profile;
  assert.deepEqual(arrived.location,{kind:'venue',district:'jabi',venue:'jabi-lake'});assert.equal(arrived.wallet,paid);
  f.store.action(f.id,'exit-venue');
  const home=f.store.action(f.id,'return-home',{mode:'bus',district:'maitama'}).trip;
  assert.equal(home.destination,arrived.home.district);f.advance(home.seconds*1000);
  const back=f.store.action(f.id,'arrive',{tripId:home.id}).profile;
  assert.equal(back.location.kind,'home');assert.equal(back.district,back.home.district);assert.equal(back.drivingVehicle,null);
});

test('returning from a consented visit first leaves the owner home and then reaches the guest own home',async t=>{
  const f=await fixture(t),social=new SocialStore(f.store);
  const ownerId=(await f.store.register({username:'transport_host',password:'a-test-password'})).residentId;
  const guest=f.store.profile(f.id),ownHomeId=guest.home.propertyId;
  f.store.topup(ownerId,{amount:1000000,idempotencyKey:'transport_host_funds'});
  const relocated=f.store.action(ownerId,'move-home',{propertyId:'jabi-apartment',tenure:'own'}).profile;
  const hostTrip=f.store.action(ownerId,'return-home',{mode:'bus'}).trip;f.advance(hostTrip.seconds*1000);f.store.action(ownerId,'arrive',{tripId:hostTrip.id});
  assert.equal(f.store.profile(ownerId).district,relocated.home.district);
  f.store.action(f.id,'leave-home');const visitTrip=f.store.action(f.id,'travel',{district:relocated.home.district,mode:'bus'}).trip;
  f.advance(visitTrip.seconds*1000);f.store.action(f.id,'arrive',{tripId:visitTrip.id});
  const request=social.requestVisit(f.id,{ownerId,idempotencyKey:'transport_visit_request'}).request;
  social.answerVisit(ownerId,request.id,true);assert.equal(f.store.profile(f.id).location.kind,'visit');
  assert.throws(()=>f.store.action(f.id,'return-home',{mode:'taxi'}),error=>error.code==='visit_active');
  assert.equal(f.store.profile(f.id).home.propertyId,ownHomeId);
  social.leaveVisit(f.id);assert.equal(f.store.profile(f.id).location.kind,'public');
  const before=f.store.profile(f.id).wallet,home=f.store.action(f.id,'return-home',{mode:'taxi',district:relocated.home.district}).trip;
  assert.equal(home.destination,guest.home.district);assert.equal(f.store.profile(f.id).wallet,before-home.cost);
  f.advance(home.seconds*1000);const arrived=f.store.action(f.id,'arrive',{tripId:home.id}).profile;
  assert.equal(arrived.location.kind,'home');assert.equal(arrived.home.propertyId,ownHomeId);assert.equal(arrived.district,guest.home.district);
  assert.equal(f.store.profile(ownerId).location.kind,'home');
});

test('district-only travel quotes and owned car public arrivals preserve their existing contract',async t=>{
  const f=await fixture(t),district=f.store.profile(f.id).district;
  assert.deepEqual(f.store.quoteTravel(f.id,{district,mode:'bus'}),{destination:district,mode:'bus',cost:0,seconds:1});
  const origin=ABUJA_ATLAS.find(place=>place.id===district),destination=ABUJA_ATLAS.find(place=>place.id==='jabi');
  assert.deepEqual(f.store.quoteTravel(f.id,{district:'jabi',mode:'bus'}),travelPricing(origin,destination,'bus'));
  f.store.topup(f.id,{amount:100000,idempotencyKey:'transport_legacy_car'});f.store.action(f.id,'purchase',{itemId:'used-hatchback'});f.store.action(f.id,'leave-home');
  const before=f.store.profile(f.id).wallet,{trip}=f.store.action(f.id,'travel',{district:'jabi',mode:'car'});
  assert.equal(trip.cost,0);assert.equal(f.store.profile(f.id).wallet,before);
  f.advance(trip.seconds*1000);
  const arrived=f.store.action(f.id,'arrive',{tripId:trip.id}).profile;
  assert.equal(arrived.location.kind,'public');assert.equal(arrived.drivingVehicle,'used-hatchback');assert.equal(arrived.wallet,before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { GameStore, jobs, catalog, properties } from '../src/server/gameStore.mjs';
import { createServer } from '../src/server/http.mjs';
import { WALLET_META, INVESTMENT_META, GAME_BILL_PERIOD_MS, HOME_UPGRADES, homeBenefits, investmentView, venueAvailable } from '../src/shared/life.mjs';
import { VEHICLE_CATALOG, VEHICLE_COLORS, vehicleColorHex } from '../src/shared/vehicles.mjs';
import { clubSchedule } from '../src/shared/simulation.mjs';

const key = () => crypto.randomUUID();
async function fixture(t) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-economy-'));let now=Date.parse('2026-10-05T10:00:00Z');
  let store=new GameStore({dataDir,clock:()=>now,originRandomInt:(min,max)=>max===2?1:0});
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const ada=(await store.register({username:'economy_ada',displayName:'Ada',password:'a-test-password'})).residentId;
  const bello=(await store.register({username:'economy_bello',displayName:'Bello',password:'a-test-password'})).residentId;
  return{ada,bello,dataDir,get store(){return store;},get now(){return now;},advance(ms){now+=ms;},reopen(){store.close();store=new GameStore({dataDir,clock:()=>now});}};
}
const rejection=(fn,code)=>assert.throws(fn,error=>error.code===code);
function travel(f,id,district){const p=f.store.profile(id);if(p.location.kind==='home')f.store.action(id,'leave-home');if(p.location.kind==='venue')f.store.action(id,'exit-venue');if(p.district===district)return;const quote=f.store.quoteTravel(id,{district,mode:'bus'}),before=f.store.profile(id).wallet,{trip}=f.store.action(id,'travel',{district,mode:'bus'});assert.equal(trip.cost,quote.cost);assert.equal(f.store.profile(id).wallet,before-trip.cost);f.advance(trip.seconds*1000);f.store.action(id,'arrive',{tripId:trip.id});}

test('free game top-ups allow former business ceilings and remain payload-bound and durably idempotent',async t=>{
  const f=await fixture(t),id=f.ada,starting=f.store.profile(id).wallet;
  for(const amount of [0,-1,1.5,'1000',NaN,Infinity,Number.MAX_SAFE_INTEGER+1])rejection(()=>f.store.topup(id,{amount,idempotencyKey:key()}),'invalid_topup');
  rejection(()=>f.store.topup(id,{amount:1000}),'idempotency_required');
  rejection(()=>f.store.topup(id,{amount:1000,verified:true,idempotencyKey:key()}),'payments_unavailable');
  const request={amount:5000001,idempotencyKey:key()},added=f.store.topup(id,request);
  assert.equal(added.profile.wallet,starting+request.amount);assert.equal(added.topup.virtual,true);
  assert.equal(f.store.topup(id,request).topup.id,added.topup.id);
  rejection(()=>f.store.topup(id,{...request,amount:1000}),'idempotency_conflict');
  for(let i=0;i<3;i++)f.store.action(id,'demo-topup',{amount:5000000,idempotencyKey:key()});
  const beyondDaily=f.store.topup(id,{amount:1000,idempotencyKey:key()});assert.equal(beyondDaily.profile.wallet,starting+20001001);
  assert.equal(f.store.transactions(id).filter(row=>row.reason==='Free game Naira top-up').length,5);
  f.reopen();assert.equal(f.store.topup(id,request).replayed,true);assert.equal(f.store.profile(id).wallet,beyondDaily.profile.wallet);
  assert.equal(f.store.topup(id,{amount:1,idempotencyKey:key()}).profile.wallet,beyondDaily.profile.wallet+1);
  assert.equal(f.store.wallet(id).walletMeta.uncapped,true);
  assert.equal(f.store.wallet(id).walletMeta.balanceLabel,'Naira balance');
});

test('resident transfers commit balanced double ledger entries, recipient notices and SSE exactly once across restarts',async t=>{
  const f=await fixture(t),events=[];f.store.emitUser=(id,event,data)=>events.push({id,event,data});
  const payload={residentId:f.bello,amount:3500,note:'Dinner',idempotencyKey:key()};
  const senderBefore=f.store.profile(f.ada).wallet,recipientBefore=f.store.profile(f.bello).wallet,before=senderBefore+recipientBefore;
  const sent=f.store.transfer(f.ada,payload);
  assert.equal(sent.profile.wallet,senderBefore-payload.amount);assert.equal(f.store.profile(f.bello).wallet,recipientBefore+payload.amount);
  assert.equal(f.store.profile(f.ada).wallet+f.store.profile(f.bello).wallet,before);
  const debit=f.store.transactions(f.ada)[0],credit=f.store.transactions(f.bello)[0];assert.equal(debit.amount+credit.amount,0);
  assert.match(debit.reason,/Naira to Bello/);assert.match(credit.reason,/Naira from Ada/);
  assert.ok(events.some(event=>event.id===f.bello&&event.event==='profile'&&event.data.profile.wallet===recipientBefore+payload.amount));
  assert.equal(events.filter(event=>event.id===f.bello&&event.event==='notification').length,1);
  const notice=f.store.notifications(f.bello).find(notice=>notice.kind==='transfer');assert.ok(notice);assert.equal(notice.link,'wallet');
  const eventCount=events.length;assert.equal(f.store.transfer(f.ada,payload).transfer.id,sent.transfer.id);assert.equal(events.length,eventCount);
  rejection(()=>f.store.transfer(f.ada,{...payload,amount:3501}),'idempotency_conflict');
  rejection(()=>f.store.transfer(f.ada,{...payload,residentId:f.ada}),'self_transfer');
  f.reopen();assert.equal(f.store.transfer(f.ada,payload).replayed,true);
  assert.equal(f.store.profile(f.bello).wallet,recipientBefore+payload.amount);assert.equal(f.store.notifications(f.bello).filter(notice=>notice.kind==='transfer').length,1);
  assert.equal(f.store.transactions(f.ada).filter(row=>row.amount===-3500).length,1);
});

test('transfers reject forged amounts, absent or blocked recipients and insufficient funds with no partial writes',async t=>{
  const f=await fixture(t),snapshot=()=>[f.store.profile(f.ada).wallet,f.store.profile(f.bello).wallet,f.store.all('SELECT * FROM ledger').length];
  const before=snapshot();
  for(const amount of [0,-1,1.5,'100',Infinity,Number.MAX_SAFE_INTEGER+1])rejection(()=>f.store.transfer(f.ada,{residentId:f.bello,amount,idempotencyKey:key()}),'invalid_amount');
  rejection(()=>f.store.transfer(f.ada,{residentId:f.bello,amount:before[0]+1,idempotencyKey:key()}),'insufficient_balance');
  rejection(()=>f.store.transfer(f.ada,{residentId:f.bello,amount:Number.MAX_SAFE_INTEGER,idempotencyKey:key()}),'insufficient_balance');
  assert.throws(()=>f.store.transfer(f.ada,{residentId:'absent-user',amount:100,idempotencyKey:key()}),/Resident not found/);
  f.store.moderate(f.bello,'block',f.ada,true);
  rejection(()=>f.store.transfer(f.ada,{residentId:f.bello,amount:100,idempotencyKey:key()}),'recipient_unavailable');
  assert.deepEqual(snapshot(),before);assert.equal(f.store.all('SELECT * FROM economy_operations').length,0);
  f.store.moderate(f.bello,'block',f.ada,false);
  const request={residentId:f.bello,amount:100,idempotencyKey:key()};f.store.transfer(f.ada,request);
  rejection(()=>f.store.topup(f.ada,{amount:1000,idempotencyKey:request.idempotencyKey}),'idempotency_conflict');
});

test('branded vehicles preserve existing prices, validate chosen paint and retain owned colours after restart',async t=>{
  const f=await fixture(t);f.store.topup(f.ada,{amount:2000000,idempotencyKey:key()});
  assert.deepEqual(VEHICLE_CATALOG.slice(0,5).map(item=>item.price),[28000,95000,240000,380000,890000]);
  assert.equal(catalog.find(item=>item.id==='used-hatchback').brand,'Toyota');
  assert.ok(VEHICLE_CATALOG.some(item=>item.brand==='Mercedes-AMG'&&item.bodyStyle==='offroad'));
  assert.throws(()=>f.store.action(f.ada,'purchase',{itemId:'mercedes-g63',color:'<script>'}),/available car colour/);
  const purchase={itemId:'mercedes-g63',color:'red',idempotencyKey:key()};const bought=f.store.action(f.ada,'purchase',purchase);
  assert.equal(bought.profile.vehicleColors['mercedes-g63'],'red');assert.equal(vehicleColorHex(bought.profile,'mercedes-g63'),VEHICLE_COLORS.find(color=>color.id==='red').hex);
  assert.equal(f.store.action(f.ada,'purchase',purchase).replayed,true);
  rejection(()=>f.store.action(f.ada,'purchase',{...purchase,color:'black'}),'idempotency_conflict');
  const paint={itemId:'mercedes-g63',color:'green',idempotencyKey:key()};const painted=f.store.action(f.ada,'paint-vehicle',paint);
  assert.equal(painted.profile.wallet,bought.profile.wallet);assert.equal(painted.profile.vehicleColors['mercedes-g63'],'green');
  rejection(()=>f.store.action(f.ada,'paint-vehicle',{itemId:'bmw-x5',color:'red'}),'vehicle_not_owned');
  f.reopen();assert.equal(f.store.profile(f.ada).vehicleColors['mercedes-g63'],'green');assert.equal(f.store.action(f.ada,'paint-vehicle',paint).replayed,true);
});

test('exact-integer wallet limits roll back both transfer sides and top-ups without consuming retry keys',async t=>{
  const f=await fixture(t),senderBefore=f.store.profile(f.ada).wallet,maximum=Number.MAX_SAFE_INTEGER;
  f.store.topup(f.bello,{amount:maximum-1000-f.store.profile(f.bello).wallet,idempotencyKey:key()});
  assert.equal(f.store.profile(f.bello).wallet,maximum-1000);assert.ok(f.store.profile(f.bello).wallet>100000000);
  const before=f.store.all('SELECT * FROM ledger').length;
  const transferRetry={residentId:f.bello,amount:1001,idempotencyKey:key()};rejection(()=>f.store.transfer(f.ada,transferRetry),'numeric_limit');
  assert.equal(f.store.profile(f.ada).wallet,senderBefore);assert.equal(f.store.profile(f.bello).wallet,maximum-1000);assert.equal(f.store.all('SELECT * FROM ledger').length,before);assert.equal(f.store.get('SELECT COUNT(*) n FROM economy_operations WHERE operation_key=?',transferRetry.idempotencyKey).n,0);
  f.store.transfer(f.ada,{residentId:f.bello,amount:1000,idempotencyKey:key()});
  const retry={amount:1000,idempotencyKey:key()};rejection(()=>f.store.topup(f.bello,retry),'numeric_limit');
  assert.equal(f.store.get('SELECT COUNT(*) n FROM economy_operations WHERE operation_key=?',retry.idempotencyKey).n,0);
  f.store.transfer(f.bello,{residentId:f.ada,amount:1000,idempotencyKey:key()});assert.equal(f.store.topup(f.bello,retry).profile.wallet,maximum);assert.equal(f.store.profile(f.ada).wallet,senderBefore);
});

test('property investments accrue uncapped simulated rent and resell durably without allowing primary-home income',async t=>{
  const f=await fixture(t),property=properties.find(item=>item.id==='lugbe-flat'),starting=f.store.profile(f.ada).wallet;
  f.store.topup(f.ada,{amount:1000000,idempotencyKey:key()});
  const buy={propertyId:property.id,idempotencyKey:key()},investment=f.store.action(f.ada,'buy-investment',buy);
  assert.equal(investment.profile.wallet,starting+1000000-property.buy);assert.equal(investment.investment.incomePerPeriod,560);
  assert.ok(investment.profile.ownedProperties.includes(property.id));
  assert.equal(f.store.action(f.ada,'buy-investment',buy).replayed,true);
  const collect={propertyId:property.id,idempotencyKey:key()};rejection(()=>f.store.action(f.ada,'collect-rent',collect),'rent_not_ready');
  rejection(()=>f.store.action(f.ada,'sell-investment',{propertyId:property.id,idempotencyKey:key()}),'investment_cooldown');
  f.advance(INVESTMENT_META.periodMs*3+3000);const income=f.store.action(f.ada,'collect-rent',collect);
  assert.equal(income.income.amount,1680);assert.equal(income.investment.collectable,0);
  f.reopen();assert.equal(f.store.action(f.ada,'collect-rent',collect).income.amount,1680);assert.equal(f.store.action(f.ada,'collect-rent',collect).replayed,true);
  f.advance(INVESTMENT_META.periodMs*100);assert.equal(investmentView(f.store.profile(f.ada),property,f.now).collectable,560*100);
  const uncapped=f.store.action(f.ada,'collect-rent',{propertyId:property.id,idempotencyKey:key()});assert.equal(uncapped.income.amount,56000);
  rejection(()=>f.store.action(f.ada,'collect-rent',{propertyId:property.id,idempotencyKey:key()}),'rent_not_ready');
  const sale={propertyId:property.id,idempotencyKey:key()},sold=f.store.action(f.ada,'sell-investment',sale);
  assert.equal(sold.sale.resaleValue,252000);assert.equal(sold.sale.rentalIncome,0);assert.ok(!sold.profile.ownedProperties.includes(property.id));
  f.reopen();assert.equal(f.store.action(f.ada,'sell-investment',sale).sale.amount,252000);assert.equal(f.store.action(f.ada,'sell-investment',sale).replayed,true);
  f.store.action(f.ada,'buy-investment',{propertyId:property.id,idempotencyKey:key()});f.advance(60000);
  const before=f.store.profile(f.ada).wallet,moved=f.store.action(f.ada,'move-home',{propertyId:property.id,tenure:'own'});
  assert.equal(moved.profile.wallet,before+560);assert.equal(moved.settledIncome,560);assert.ok(moved.profile.ownedProperties.includes(property.id));assert.equal(moved.profile.propertyInvestments[property.id],undefined);
  for(const action of ['buy-investment','collect-rent','sell-investment'])rejection(()=>f.store.action(f.ada,action,{propertyId:property.id,idempotencyKey:key()}),'primary_home');
  f.advance(600000);assert.equal(investmentView(f.store.profile(f.ada),property,f.now),null);
});

test('dice stakes exceed the former ceiling but only server outcomes pay and replays remain durable',async t=>{
  const f=await fixture(t),starting=f.store.profile(f.ada).wallet;let nextDie=1;t.mock.method(crypto,'randomInt',()=>nextDie);
  const payload={stake:500,choice:'low',idempotencyKey:key()};
  rejection(()=>f.store.action(f.ada,'play-dice',payload),'wrong_venue');
  f.store.action(f.ada,'leave-home');f.store.action(f.ada,'enter-venue',{venueId:'games-lounge'});
  for(const stake of [-1,0,99,100.5,'100',Number.MAX_SAFE_INTEGER+1])rejection(()=>f.store.action(f.ada,'play-dice',{...payload,stake}),'invalid_stake');
  const large=f.store.action(f.ada,'play-dice',{stake:5001,choice:'low',idempotencyKey:key()});assert.equal(large.round.payout,10002);assert.equal(large.profile.wallet,starting+5001);
  const won=f.store.action(f.ada,'play-dice',{...payload,die:6,payout:999999});assert.equal(won.round.die,1);assert.equal(won.round.payout,1000);assert.equal(won.round.net,500);assert.equal(won.profile.wallet,large.profile.wallet+500);
  nextDie=6;const lost=f.store.action(f.ada,'play-dice',{stake:500,choice:'low',idempotencyKey:key()});assert.equal(lost.round.won,false);assert.equal(lost.round.net,-500);assert.equal(lost.profile.wallet,large.profile.wallet);
  rejection(()=>f.store.action(f.ada,'play-dice',{...payload,choice:'high'}),'idempotency_conflict');
  for(let i=0;i<23;i++)f.store.action(f.ada,'play-dice',{stake:100,choice:i%2?'high':'low',idempotencyKey:key()});
  assert.equal(f.store.profile(f.ada).gambleHistory.length,20);const balance=f.store.profile(f.ada).wallet;
  f.store.action(f.ada,'exit-venue');f.reopen();const replay=f.store.action(f.ada,'play-dice',payload);
  assert.equal(replay.round.id,won.round.id);assert.equal(replay.profile.wallet,balance);assert.equal(replay.replayed,true);
  assert.equal(f.store.transactions(f.ada).filter(row=>row.reason.startsWith('Dice lounge')).length,26);
});

test('unrepresentable rental credits and dice payouts preserve profiles, accrual, ledger and retry keys',async t=>{
  const f=await fixture(t),property=properties.find(item=>item.id==='lugbe-flat');f.store.topup(f.ada,{amount:300000,idempotencyKey:key()});f.store.action(f.ada,'buy-investment',{propertyId:property.id,idempotencyKey:key()});f.store.topup(f.ada,{amount:Number.MAX_SAFE_INTEGER-f.store.profile(f.ada).wallet,idempotencyKey:key()});f.advance(INVESTMENT_META.periodMs);
  const snapshot=()=>({profile:f.store.profile(f.ada),ledger:f.store.all('SELECT * FROM ledger'),operations:f.store.all('SELECT * FROM economy_operations')});const beforeRent=snapshot(),collect={propertyId:property.id,idempotencyKey:key()};rejection(()=>f.store.action(f.ada,'collect-rent',collect),'numeric_limit');assert.deepEqual(snapshot(),beforeRent);assert.equal(f.store.get('SELECT COUNT(*) n FROM economy_operations WHERE operation_key=?',collect.idempotencyKey).n,0);
  f.store.transfer(f.ada,{residentId:f.bello,amount:560,idempotencyKey:key()});assert.equal(f.store.action(f.ada,'collect-rent',collect).profile.wallet,Number.MAX_SAFE_INTEGER);
  f.store.action(f.ada,'leave-home');f.store.action(f.ada,'enter-venue',{venueId:'games-lounge'});t.mock.method(crypto,'randomInt',()=>1);const beforeDice=snapshot(),round={stake:Number.MAX_SAFE_INTEGER,choice:'low',idempotencyKey:key()};rejection(()=>f.store.action(f.ada,'play-dice',round),'numeric_limit');assert.deepEqual(snapshot(),beforeDice);assert.equal(f.store.get('SELECT COUNT(*) n FROM economy_operations WHERE operation_key=?',round.idempotencyKey).n,0);
});

test('new life destinations enforce Jabi Lake geography and furniture storage retains ownership',async t=>{
  const f=await fixture(t);assert.equal(venueAvailable('jabi-lake','garki-i'),false);assert.equal(venueAvailable('jabi-lake','jabi'),true);
  f.store.action(f.ada,'purchase',{itemId:'plant'});f.store.action(f.ada,'place-furniture',{itemId:'plant',x:.4,y:.5});
  const stored=f.store.action(f.ada,'store-furniture',{itemId:'plant'}).profile;assert.ok(stored.inventory.includes('plant'));assert.equal(stored.furnitureLayout.plant,undefined);
  assert.deepEqual(stored.storedFurniture,['plant']);f.reopen();assert.deepEqual(f.store.profile(f.ada).storedFurniture,['plant']);
  const placed=f.store.action(f.ada,'place-furniture',{itemId:'plant',x:.4,y:.5}).profile;assert.deepEqual(placed.storedFurniture,[]);assert.deepEqual(placed.furnitureLayout.plant,{x:.4,y:.5,rotation:0,propertyId:placed.home.propertyId});
  f.store.action(f.ada,'leave-home');assert.throws(()=>f.store.action(f.ada,'enter-venue',{venueId:'jabi-lake'}),/Choose a place/);
  for(const [venueId,activityId] of [['mosque','mosque-prayer'],['church','church-reflect'],['club','club-dance']]){
    if(venueId==='club'){f.store.action(f.ada,'enter-venue',{venueId});rejection(()=>f.store.action(f.ada,'venue-action',{activityId}),'venue_closed');f.store.action(f.ada,'exit-venue');const opening=clubSchedule(f.now).nextAvailableAt;f.advance(opening-f.now);}
    f.store.action(f.ada,'enter-venue',{venueId});const result=f.store.action(f.ada,'venue-action',{activityId});assert.equal(result.activity.venueId,venueId);f.store.action(f.ada,'exit-venue');
  }
  const {trip}=f.store.action(f.ada,'travel',{district:'jabi',mode:'bus'});f.advance(trip.seconds*1000);f.store.action(f.ada,'arrive',{tripId:trip.id});
  f.store.action(f.ada,'enter-venue',{venueId:'jabi-lake'});assert.equal(f.store.action(f.ada,'venue-action',{activityId:'lake-walk'}).activity.animation,'walk');
});

test('purchased home upgrades improve real rest and relaxation, lower bills and retain placement security after restart',async t=>{
  const f=await fixture(t);f.store.topup(f.ada,{amount:500000,idempotencyKey:key()});
  assert.deepEqual(HOME_UPGRADES.map(item=>[item.id,item.price]),[['portable-ac',45000],['power-inverter',78000],['premium-sofa',56000],['king-bed',65000],['pool-table',55000],['gaming-console',42000],['bar-cart',18000],['art-piece',24000]]);
  assert.throws(()=>f.store.action(f.bello,'place-furniture',{itemId:'king-bed',x:.5,y:.5}),/Buy this furniture/);
  const start=f.store.profile(f.ada).wallet;
  for(const item of HOME_UPGRADES)f.store.action(f.ada,'purchase',{itemId:item.id});
  assert.equal(f.store.profile(f.ada).wallet,start-HOME_UPGRADES.reduce((sum,item)=>sum+item.price,0));
  f.store.action(f.ada,'place-furniture',{itemId:'king-bed',x:.4,y:.6,rotation:90});
  f.store.action(f.ada,'take-job',{jobId:'restaurant-host'});f.store.action(f.ada,'leave-home');
  assert.throws(()=>f.store.action(f.ada,'place-furniture',{itemId:'portable-ac',x:.5,y:.5}),/Go home/);
  travel(f,f.ada,jobs['restaurant-host'].district);
  for(let i=0;i<4;i++){
    if(i===2){travel(f,f.ada,f.store.profile(f.ada).home.district);f.store.action(f.ada,'enter-home');f.store.action(f.ada,'sleep');travel(f,f.ada,jobs['restaurant-host'].district);}
    const schedule=f.store.workSchedule(f.ada);if(!schedule.canStart)f.advance(schedule.nextAvailableAt-f.now);
    const {challenge}=f.store.action(f.ada,'start-shift');f.advance(2000);
    f.store.action(f.ada,'complete-shift',{challengeId:challenge.id,answers:jobs['restaurant-host'].tasks.map(task=>({taskId:task.id,optionId:task.answer}))});f.advance(20000);
  }
  assert.equal(f.store.profile(f.ada).completedShifts,4);travel(f,f.ada,f.store.profile(f.ada).home.district);f.store.action(f.ada,'enter-home');f.reopen();
  const beforeSleep=f.store.profile(f.ada),slept=f.store.action(f.ada,'sleep').profile;
  assert.equal(slept.energy,Math.min(100,beforeSleep.energy+46+10+6));assert.ok(slept.energy>beforeSleep.energy+46);
  const relaxed=f.store.action(f.ada,'relax').profile;
  assert.equal(relaxed.fun,Math.min(100,slept.fun+22+12+6));assert.ok(relaxed.fun>slept.fun+22);
  assert.equal(relaxed.stress,Math.max(0,slept.stress-14-6));assert.equal(relaxed.stress,slept.stress-20);
  assert.deepEqual(relaxed.furnitureLayout['king-bed'],{x:.4,y:.6,rotation:90,propertyId:relaxed.home.propertyId});
  assert.equal(homeBenefits(relaxed,properties[0]).billDiscountPercent,15);
  f.advance(GAME_BILL_PERIOD_MS);const wallet=f.store.profile(f.ada).wallet,paid=f.store.action(f.ada,'pay-bills');
  assert.deepEqual(paid.bill,{amount:383,baseAmount:450,discountPercent:15});assert.equal(paid.profile.wallet,wallet-383);
  assert.throws(()=>f.store.action(f.ada,'pay-bills'),/up to date/);
  const starter=f.store.profile(f.bello);assert.deepEqual(homeBenefits(starter,properties[0]),{sleepEnergyBonus:0,relaxFunBonus:0,relaxStressReduction:0,billDiscountPercent:0});
});

test('comfortable Jabi and Maitama homes add functional rest benefits without changing starter behavior',async t=>{
  const f=await fixture(t);f.store.topup(f.ada,{amount:300000,idempotencyKey:key()});
  f.store.action(f.ada,'move-home',{propertyId:'jabi-apartment',tenure:'rent'});
  const {trip}=f.store.action(f.ada,'travel',{district:'jabi',mode:'bus'});f.advance(trip.seconds*1000);f.store.action(f.ada,'arrive',{tripId:trip.id});f.store.action(f.ada,'enter-home');
  const p=f.store.profile(f.ada),home=properties.find(item=>item.id===p.home.propertyId),benefits=homeBenefits(p,home);
  assert.equal(benefits.sleepEnergyBonus,4);assert.equal(benefits.relaxFunBonus,4);assert.equal(home.comfortBonus,4);
  f.store.action(f.ada,'leave-home');for(let i=0;i<4;i++)f.store.action(f.ada,'exercise');f.store.action(f.ada,'enter-home');
  const before=f.store.profile(f.ada),slept=f.store.action(f.ada,'sleep').profile;
  assert.equal(slept.energy,before.energy+50);
  const profile={inventory:[]};assert.equal(homeBenefits(profile,properties.find(item=>item.id==='maitama-villa')).sleepEnergyBonus,4);
  assert.equal(homeBenefits(profile,properties.find(item=>item.id==='garki-studio')).sleepEnergyBonus,0);
});

test('authenticated HTTP wallet routes serve metadata and persist actual two-resident transfers and chat',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-wallet-http-'));let app;
  const start=async()=>{const server=createServer({dataDir,clock:()=>Date.parse('2026-10-05T10:00:00Z'),originRandomInt:(min,max)=>max===2?1:0,allowGameTopups:true});server.listen(0,'127.0.0.1');await once(server,'listening');return server;};
  app=await start();t.after(async()=>{app.closeRealtime();app.close();await once(app,'close');fs.rmSync(dataDir,{recursive:true,force:true});});
  const request=async(route,cookie,body)=>{const response=await fetch(`http://127.0.0.1:${app.address().port}${route}`,{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  assert.equal((await request('/api/wallet')).status,401);
  const account=async username=>{const registered=await request('/api/auth/register',null,{username,password:'a-test-password'});assert.equal(registered.status,201);assert.equal(typeof registered.data.residentId,'string');const entry=await request('/api/entry',registered.cookie);assert.equal(entry.data.profile.id,registered.data.residentId);return{cookie:registered.cookie,data:entry.data};};
  const ada=await account('wallet_ada'),bello=await account('wallet_bello');
  assert.equal(ada.data.walletMeta.currency,'NGN');assert.equal(ada.data.vehicleColors.length,7);assert.equal(ada.data.investmentMeta.periodMs,60000);
  const adaStart=ada.data.profile.wallet,belloStart=bello.data.profile.wallet,topup=await request('/api/wallet/topup',ada.cookie,{amount:10000,idempotencyKey:key()});assert.equal(topup.status,200);assert.equal(topup.data.profile.wallet,adaStart+10000);
  const payload={residentId:bello.data.profile.id,amount:2500,idempotencyKey:key()},transfer=await request('/api/wallet/transfer',ada.cookie,payload);assert.equal(transfer.status,200);
  assert.equal((await request('/api/wallet',bello.cookie)).data.profile.wallet,belloStart+2500);
  assert.equal((await request('/api/wallet/transfer',ada.cookie,{...payload,amount:2501})).status,409);
  const conversation=(await request('/api/conversations',ada.cookie,{residentId:bello.data.profile.id})).data.conversation;
  await request(`/api/conversations/${conversation.id}/messages`,ada.cookie,{text:'Thanks for dinner!'});
  assert.equal((await request(`/api/conversations/${conversation.id}/messages`,bello.cookie)).data.messages[0].text,'Thanks for dinner!');
  app.closeRealtime();app.close();await once(app,'close');app=await start();
  const retry=await request('/api/wallet/transfer',ada.cookie,payload);assert.equal(retry.data.replayed,true);assert.equal(retry.data.transfer.id,transfer.data.transfer.id);
  assert.equal((await request('/api/wallet',ada.cookie)).data.profile.wallet,adaStart+10000-2500);
  assert.equal((await request('/api/wallet',bello.cookie)).data.profile.wallet,belloStart+2500);
});

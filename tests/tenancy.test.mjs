import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore, properties } from '../src/server/gameStore.mjs';
import { TENANCY_RULES, createTenancy, advanceTenancy, payTenancy, askForTime, answerIncrease, syncHomeTenancy, nextTenancyCheck } from '../src/shared/tenancy.mjs';
import { LOAN_META } from '../src/shared/life.mjs';
const DAY=86400000,WEEK=TENANCY_RULES.intervalMs,key=()=>crypto.randomUUID(),START=Date.parse('2026-10-08T09:00:00Z');
const tenant=(extra={})=>({...createTenancy({id:'lease-one',residentId:'resident-a',property:{id:'home-a',rent:180000},now:START}),...extra});
const reject=(fn,code)=>assert.throws(fn,error=>error.code===code);
async function fixture(t){const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abuja-tenancy-'));let now=START,store=new GameStore({dataDir,clock:()=>now});t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});const {residentId:id}=await store.register({username:'tenant_test',password:'safe-test-password',originId:'lapo'});store.updateProfile(id,{appearance:{presentation:'feminine'},onboardingComplete:true});return{id,get store(){return store;},get now(){return now;},advance(ms){now+=ms;},reopen(){store.close();store=new GameStore({dataDir,clock:()=>now});}};}
const rent=(f,propertyId='lugbe-flat')=>f.store.action(f.id,'move-home',{propertyId,tenure:'rent',idempotencyKey:key()});

test('rent accrues by elapsed server weeks across inactivity without silently withdrawing wallet money',()=>{
 const t=tenant();assert.equal(advanceTenancy(t,START+WEEK-1),true);assert.equal(t.outstanding,0);assert.equal(t.status,'upcoming');
 advanceTenancy(t,START+WEEK);assert.equal(t.outstanding,180000);assert.equal(t.status,'due');
 advanceTenancy(t,START+WEEK*3+DAY);assert.equal(t.outstanding,540000);assert.equal(t.nextRentDueAt,START+WEEK*4);assert.equal(t.missedPayments,3);
 const snapshot=structuredClone(t);advanceTenancy(t,START+WEEK*3+DAY);assert.deepEqual(t,snapshot);
});
test('final action grants a full notice window even when the first observation is months late',()=>{
 const t=tenant();const late=START+WEEK*20;advanceTenancy(t,late);assert.equal(t.status,'final');assert.equal(t.finalNoticeAt,late);assert.ok(!t.endedAt);
 advanceTenancy(t,late+WEEK-1);assert.notEqual(t.status,'evicted');advanceTenancy(t,late+WEEK);assert.equal(t.status,'evicted');assert.equal(t.endedAt,late+WEEK);
});
test('asking for time persists a personality-specific extension and cannot be farmed using repeated calls',()=>{
 const t=tenant({landlord:{id:'landlord-a',personality:'strict'}});advanceTenancy(t,START+WEEK+DAY*2);askForTime(t,START+WEEK+DAY*2);assert.equal(t.status,'grace');assert.equal(t.graceUntil,START+WEEK+DAY*4);reject(()=>askForTime(t,START+WEEK+DAY*2),'grace_already_used');
 advanceTenancy(t,t.graceUntil+1);assert.equal(t.status,'overdue');const amount=payTenancy(t,t.graceUntil+1);assert.equal(amount,180000);assert.equal(t.outstanding,0);assert.equal(t.finalNoticeAt,null);
});
test('early payment opens near the due date, extends exactly one week and clears stale reminders',()=>{
 const t=tenant();reject(()=>payTenancy(t,START+DAY,{early:true}),'rent_not_due');const amount=payTenancy(t,START+WEEK-DAY,{early:true});assert.equal(amount,180000);assert.equal(t.nextRentDueAt,START+WEEK*2);assert.equal(t.story.kind,'paid');assert.equal(t.onTimePayments,1);
});
test('accepted rent increase has a fresh notice period and accrues old and new periods correctly',()=>{
 const t=tenant();t.rentIncrease={previousAmount:180000,amount:225000,offeredAt:START,effectiveAt:START+WEEK*2,acceptedAt:null,negotiated:false};answerIncrease(t,'accept-rent-increase',START+DAY);assert.equal(t.rentIncrease.effectiveAt,START+DAY+WEEK*2);
 advanceTenancy(t,START+WEEK*4);assert.equal(t.outstanding,180000*2+225000*2);assert.equal(t.weeklyRent,225000);
 const u=tenant();u.rentIncrease={previousAmount:180000,amount:225000,offeredAt:START,effectiveAt:START+WEEK*2,acceptedAt:null};advanceTenancy(u,START+WEEK*4);assert.equal(u.outstanding,180000*4);assert.equal(u.weeklyRent,180000);
});
test('legacy rental migration starts a new week now, while owned and gifted houses never accrue rent',()=>{
 const property=properties.find(row=>row.id==='lugbe-flat'),temporaryProperty=properties[0],now=START+WEEK*100;
 const p={id:'legacy-a',home:{propertyId:property.id,tenure:'rent',rentDueAt:START},onboardingComplete:true};syncHomeTenancy(p,{property,temporaryProperty,now,id:'migrated-a'});assert.equal(p.home.tenancy.outstanding,0);assert.equal(p.home.tenancy.nextRentDueAt,now+WEEK);assert.equal(p.home.tenancy.migratedAt,now);
 const owner={id:'owner-a',home:{propertyId:property.id,tenure:'own',gifted:true}};assert.equal(syncHomeTenancy(owner,{property,temporaryProperty,now,id:'unused'}),false);assert.equal(owner.home.tenancy,undefined);
});
test('worker schedule advances to the next real transition instead of polling each overdue resident every minute',()=>{
 const t=tenant();advanceTenancy(t,START+WEEK+DAY*5);const next=nextTenancyCheck(t,START+WEEK+DAY*5);assert.equal(next,START+WEEK*2);assert.ok(next>START+WEEK+DAY*5+60000);
});
test('SQLite rent move-in and payment resolve server prices, retry durably and record immutable audit categories',async t=>{
 const f=await fixture(t),property=properties.find(row=>row.id==='lugbe-flat'),before=f.store.profile(f.id).wallet;const payload={propertyId:property.id,tenure:'rent',amount:1,deposit:0,idempotencyKey:key()};const moved=f.store.action(f.id,'move-home',payload);assert.equal(moved.profile.wallet,before-property.rent-property.cautionDeposit);assert.equal(moved.profile.home.tenancy.weeklyRent,property.rent);assert.equal(f.store.action(f.id,'move-home',payload).replayed,true);
 f.advance(WEEK);const due=f.store.profile(f.id);assert.equal(due.wallet,moved.profile.wallet);assert.equal(due.home.tenancy.outstanding,property.rent);
 const payment={amount:1,idempotencyKey:key()},paid=f.store.action(f.id,'pay-rent',payment);assert.equal(paid.profile.wallet,due.wallet-property.rent);assert.equal(paid.profile.home.tenancy.outstanding,0);
 f.reopen();const repeated=f.store.action(f.id,'pay-rent',payment);assert.equal(repeated.replayed,true);assert.equal(repeated.profile.wallet,paid.profile.wallet);assert.equal(f.store.transactions(f.id).filter(row=>row.type==='RENT_PAYMENT').length,1);assert.equal(f.store.transactions(f.id)[0].balanceAfter,paid.profile.wallet);
});
test('SQLite insufficient rent leaves balance/arrears unchanged, while explicit consented loan can fund rent',async t=>{
 const f=await fixture(t);rent(f);f.advance(WEEK);const p=f.store.profile(f.id);p.wallet=0;f.store.save(p);const pending=f.store.profile(f.id).home.tenancy.outstanding;
 reject(()=>f.store.action(f.id,'pay-rent',{idempotencyKey:key()}),'insufficient_balance');assert.equal(f.store.profile(f.id).wallet,0);assert.equal(f.store.profile(f.id).home.tenancy.outstanding,pending);
 const loan=f.store.action(f.id,'borrow-loan',{amount:pending,consent:true,consentVersion:LOAN_META.consentVersion,idempotencyKey:key()});assert.equal(loan.profile.wallet,pending);const paid=f.store.action(f.id,'pay-rent',{idempotencyKey:key()});assert.equal(paid.profile.wallet,0);assert.equal(paid.profile.home.tenancy.outstanding,0);assert.ok(paid.profile.loans[0].outstanding>pending);
});
test('moving out stops future billing, preserves possessions and retains disclosed arrears until paid',async t=>{
 const f=await fixture(t);rent(f);f.advance(WEEK*2);const p=f.store.profile(f.id),tenancyId=p.home.tenancy.id,inventory=[...p.inventory];reject(()=>f.store.action(f.id,'move-out',{idempotencyKey:key()}),'housing_debt_confirmation');
 const out=f.store.action(f.id,'move-out',{confirm:true,idempotencyKey:key()});assert.equal(out.profile.home.tenure,'temporary');assert.deepEqual(out.profile.inventory,inventory);assert.equal(out.profile.home.housingDebts[0].outstanding,p.home.tenancy.outstanding-p.home.tenancy.deposit);
 f.advance(WEEK*10);const after=f.store.profile(f.id);assert.equal(after.home.housingDebts[0].outstanding,p.home.tenancy.outstanding-p.home.tenancy.deposit);const settled=f.store.action(f.id,'pay-rent',{tenancyId,idempotencyKey:key()});assert.equal(settled.profile.home.housingDebts[0].outstanding,0);assert.equal(settled.profile.home.tenure,'temporary');
 const cheaper=rent(f,'mpape-self-contained');assert.equal(cheaper.profile.home.tenancy.propertyId,'mpape-self-contained');
});
test('eviction keeps account, inventory and possessions valid and removes the old home route',async t=>{
 const f=await fixture(t);rent(f);const initial=f.store.profile(f.id);initial.furnitureLayout.bed={propertyId:initial.home.propertyId,x:.5,y:.5};f.store.save(initial);
 f.advance(WEEK*8);const warning=f.store.profile(f.id);assert.equal(warning.home.tenancy.status,'final');f.advance(WEEK);const packed=f.store.profile(f.id);assert.equal(packed.home.tenure,'temporary');assert.equal(packed.home.propertyId,'garki-studio');assert.ok(packed.storedFurniture.includes('bed'));assert.deepEqual(packed.inventory,initial.inventory);assert.equal(packed.location.kind==='home'?packed.location.district:packed.district,packed.district);assert.equal(packed.home.housingHistory[0].status,'evicted');
});
test('buying a home ends tenancy without charging owned property weekly rent or duplicating ownership',async t=>{
 const f=await fixture(t);rent(f,'mpape-self-contained');const p=f.store.profile(f.id);p.wallet=100000000;f.store.save(p);const payload={propertyId:'mpape-self-contained',tenure:'own',idempotencyKey:key()};const owned=f.store.action(f.id,'move-home',payload);assert.equal(owned.profile.home.tenure,'own');assert.equal(owned.profile.home.tenancy,undefined);assert.equal(f.store.action(f.id,'move-home',payload).replayed,true);const wallet=owned.profile.wallet;f.advance(WEEK*100);assert.equal(f.store.profile(f.id).wallet,wallet);assert.equal(f.store.profile(f.id).home.tenancy,undefined);
});

test('caution deposit refunds once on a clean move and offsets only genuine arrears',async t=>{
 const f=await fixture(t),property=properties.find(row=>row.id==='lugbe-flat'),moved=rent(f),payload={idempotencyKey:key()};const out=f.store.action(f.id,'move-out',payload);assert.equal(out.housing.depositRefund,property.cautionDeposit);assert.equal(out.housing.depositApplied,0);assert.equal(out.profile.wallet,moved.profile.wallet+property.cautionDeposit);assert.equal(f.store.action(f.id,'move-out',payload).profile.wallet,out.profile.wallet);
 rent(f);f.advance(WEEK*2);const owed=f.store.profile(f.id),closed=f.store.action(f.id,'move-out',{confirm:true,idempotencyKey:key()});assert.equal(closed.housing.depositApplied,property.cautionDeposit);assert.equal(closed.housing.depositRefund,0);assert.equal(closed.profile.home.housingDebts[0].outstanding,owed.home.tenancy.outstanding-property.cautionDeposit);
});
test('temporary hotel stay resolves the listed price and expires safely into free accommodation',async t=>{
 const f=await fixture(t);rent(f);f.store.action(f.id,'move-out',{idempotencyKey:key()});if(f.store.profile(f.id).location.kind==='home')f.store.action(f.id,'leave-home');f.store.action(f.id,'enter-venue',{venueId:'hotel'});const before=f.store.profile(f.id).wallet,payload={venueId:'hotel',cost:1,idempotencyKey:key()},booked=f.store.action(f.id,'temporary-stay',payload);assert.ok(booked.housing.amount>1);assert.equal(booked.profile.wallet,before-booked.housing.amount);assert.equal(booked.profile.home.temporaryHotelId,'hotel');assert.equal(f.store.action(f.id,'temporary-stay',payload).replayed,true);f.advance(WEEK);const p=f.store.profile(f.id);assert.equal(p.home.temporaryHotelId,undefined);assert.equal(p.home.tenure,'temporary');assert.equal(p.home.propertyId,'garki-studio');assert.equal(p.home.housingStory.kind,'short-stay-ended');
});

test('grace requested on the due day remains grace across subsequent reads and good tenancy earns goodwill',()=>{
 const t=tenant();advanceTenancy(t,START+WEEK);askForTime(t,START+WEEK);const grace=t.graceUntil;advanceTenancy(t,START+WEEK+1000);assert.equal(t.status,'grace');assert.equal(t.graceUntil,grace);
 const good=tenant({onTimePayments:8,landlord:{id:'landlord-a',personality:'strict'}});advanceTenancy(good,START+WEEK);assert.equal(good.graceUntil,START+WEEK+DAY*2);
});

test('a resident can fund a cheaper move using the deposit being returned in that same transaction',async t=>{
 const f=await fixture(t);rent(f);const before=f.store.profile(f.id),cheaper=properties.find(row=>row.id==='mpape-self-contained');before.wallet=cheaper.moveInCost-before.home.tenancy.deposit;f.store.save(before);assert.ok(before.wallet<cheaper.moveInCost);const moved=f.store.action(f.id,'move-home',{propertyId:cheaper.id,tenure:'rent',idempotencyKey:key()});assert.equal(moved.profile.wallet,0);assert.equal(moved.housing.depositRefund,before.home.tenancy.deposit);assert.equal(moved.profile.home.tenancy.propertyId,cheaper.id);
});

test('packing out stores the rented home furniture while preserving layouts at other owned properties',async t=>{
 const f=await fixture(t);rent(f);const p=f.store.profile(f.id);p.furnitureLayout={bed:{propertyId:p.home.propertyId,x:.5,y:.5},sofa:{propertyId:'owned-villa',x:.2,y:.2}};f.store.save(p);const moved=f.store.action(f.id,'move-out',{idempotencyKey:key()});assert.ok(moved.profile.storedFurniture.includes('bed'));assert.ok(!moved.profile.storedFurniture.includes('sofa'));assert.deepEqual(moved.profile.furnitureLayout.sofa,p.furnitureLayout.sofa);assert.equal(moved.profile.furnitureLayout.bed,undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ECONOMY_CONFIG, PROPERTY_ECONOMY, ITEM_PRICES, VEHICLE_PRICES, JOB_PAY, LEGACY_PROPERTY_BUY, RENT_RULES } from '../src/shared/economy.mjs';
import { ORIGIN_META, createOrigin } from '../src/shared/origins.mjs';
import { ABUJA_ATLAS } from '../src/shared/atlas.mjs';
import { catalog, properties, jobs } from '../src/shared/catalogue.mjs';
import { VENUE_ACTIONS, INVESTMENT_META, normalizeInvestmentRecords, investmentView } from '../src/shared/life.mjs';
import { GameStore } from '../src/server/gameStore.mjs';
import { housingSummary } from '../app/housing.js';
const key=()=>crypto.randomUUID();
async function fixture(t){const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abuja-economy-v2-'));let now=Date.parse('2026-10-08T09:00:00Z'),store=new GameStore({dataDir,clock:()=>now,originRandomInt:()=>0});t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});return {get store(){return store;},get now(){return now;},advance(ms){now+=ms;},reopen(){store.close();store=new GameStore({dataDir,clock:()=>now,originRandomInt:()=>0});}};}

test('starting backgrounds share one authoritative exact balance and never imply rental gifted homes',()=>{
  assert.deepEqual(ECONOMY_CONFIG.startingMoney,{lapo:10_000_000,nepo:100_000_000});
  assert.equal(ORIGIN_META.selectable,true);
  for(const option of ORIGIN_META.options){const calls=[],origin=createOrigin({residentId:'one',now:123,originId:option.id,randomInt:(a,b)=>{calls.push([a,b]);return 0;},properties,atlas:ABUJA_ATLAS});assert.equal(origin.startingBalance,ECONOMY_CONFIG.startingMoney[option.id]);assert.equal(origin.residence.ownerId,'one');assert.equal(origin.residence.rent,0);assert.equal(origin.residence.cautionDeposit,0);assert.equal(calls.length,1);}
  assert.throws(()=>createOrigin({residentId:'one',now:123,originId:'hacked',randomInt:()=>0,properties,atlas:ABUJA_ATLAS}),/origin selection/);
});

test('selected Lapo and Nepo signup balances persist through login, restart and duplicate signup without another grant',async t=>{
  const f=await fixture(t);
  for(const originId of ['lapo','nepo']){const username=`chosen_${originId}`,body={username,password:'secure-test-password',originId,wallet:1e12},registered=await f.store.register(body),id=registered.residentId,initial=f.store.profile(id);assert.equal(initial.origin.id,originId);assert.equal(initial.wallet,ECONOMY_CONFIG.startingMoney[originId]);assert.equal(initial.home.tenure,originId==='nepo'?'own':'starter');assert.equal(initial.home.tenancy,undefined);assert.equal(f.store.transactions(id).filter(row=>row.amount===initial.wallet).length,1);await assert.rejects(f.store.register(body));assert.equal(f.store.profile(id).wallet,initial.wallet);f.store.updateProfile(id,{originId:originId==='lapo'?'nepo':'lapo',wallet:0,home:{tenure:'rent'}});assert.equal(f.store.profile(id).wallet,initial.wallet);assert.equal(f.store.profile(id).origin.id,originId);f.reopen();assert.equal((await f.store.login({username,password:body.password})).residentId,id);assert.equal(f.store.profile(id).wallet,initial.wallet);assert.equal(f.store.transactions(id).filter(row=>row.amount===initial.wallet).length,1);}
});

test('authored price ladder gives Lapo attainable essentials and leaves meaningful upper-class goals for Nepo',()=>{
  for(const property of properties){assert.deepEqual([property.rent,property.buy,property.bills],[PROPERTY_ECONOMY[property.id].rent,PROPERTY_ECONOMY[property.id].buy,PROPERTY_ECONOMY[property.id].bills]);assert.equal(property.rentPeriodDays,7);assert.equal(property.moveInCost,property.rent+property.cautionDeposit);assert.equal(property.cautionDeposit,property.rent*RENT_RULES.depositWeeks);assert.ok(Number.isSafeInteger(property.buy));assert.ok(property.capacity>=2);}
  for(const item of catalog)assert.equal(item.price,(item.category==='vehicle'?VEHICLE_PRICES:ITEM_PRICES)[item.id]);
  for(const job of Object.values(jobs))assert.equal(job.pay,JOB_PAY[job.id]);
  assert.ok(VEHICLE_PRICES['used-hatchback']<ECONOMY_CONFIG.startingMoney.lapo/2);
  assert.ok(VEHICLE_PRICES['compact-car']>ECONOMY_CONFIG.startingMoney.lapo);
  assert.ok(PROPERTY_ECONOMY['maitama-villa'].buy>ECONOMY_CONFIG.startingMoney.nepo*5);
  assert.ok(PROPERTY_ECONOMY['mpape-self-contained'].rent<=JOB_PAY['restaurant-host']);
  assert.ok(VENUE_ACTIONS.filter(row=>row.cost===0).length>=30);
  assert.equal(VENUE_ACTIONS.find(row=>row.id==='mosque-prayer').cost,0);
  assert.ok(VENUE_ACTIONS.find(row=>row.id==='tokyo-vip').cost>VENUE_ACTIONS.find(row=>row.id==='ceddi-genesis-film').cost*10);
  assert.equal(INVESTMENT_META.periodMs,7*86400000);
});

test('price migration preserves legitimate original investment quotes and excludes mixed or forged quotes',()=>{
  const property=properties.find(row=>row.id==='lugbe-flat'),purchasePrice=LEGACY_PROPERTY_BUY[property.id],record={propertyId:property.id,boughtAt:1,lastCollectedAt:1,purchasePrice,incomePerPeriod:Math.floor(purchasePrice*.002),resaleValue:Math.floor(purchasePrice*.9)},profile={home:{propertyId:'a-personal-home'},ownedProperties:[property.id],propertyInvestments:{[property.id]:record}};
  assert.deepEqual(normalizeInvestmentRecords(profile,properties),profile.propertyInvestments);
  const view=investmentView(profile,property,1+INVESTMENT_META.periodMs*3);assert.equal(view.purchasePrice,purchasePrice);assert.equal(view.resaleValue,record.resaleValue);assert.equal(view.collectable,record.incomePerPeriod*3);
  profile.propertyInvestments[property.id]={...record,incomePerPeriod:property.investmentIncome};assert.deepEqual(normalizeInvestmentRecords(profile,properties),{});
});

test('compact housing summary uses server tenancy balances and exempts owned, starter and temporary homes',()=>{
  const nextRentDueAt=Date.parse('2026-10-10T09:00:00Z'),profile={home:{tenure:'rent',tenancy:{id:'t1',status:'warning',weeklyRent:850000,nextRentDueAt,outstanding:1700000}}};
  const summary=housingSummary(profile,nextRentDueAt-86400000);assert.equal(summary.canPay,true);assert.equal(summary.attention,true);assert.match(summary.detail,/1,700,000/);
  profile.home.tenure='own';assert.equal(housingSummary(profile).canPay,false);assert.equal(housingSummary(profile).detail,'No weekly rent');
  profile.home={tenure:'own',gifted:true};assert.match(housingSummary(profile).detail,/Gifted and owned/);
  profile.home={tenure:'temporary'};assert.equal(housingSummary(profile).attention,true);assert.equal(housingSummary(profile).canPay,false);
});

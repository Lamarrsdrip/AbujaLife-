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

const key = () => crypto.randomUUID();
async function fixture(t) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-economy-'));let now=Date.now();
  let store=new GameStore({dataDir,clock:()=>now});
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const ada=(await store.register({username:'economy_ada',displayName:'Ada',password:'a-test-password'})).residentId;
  const bello=(await store.register({username:'economy_bello',displayName:'Bello',password:'a-test-password'})).residentId;
  return{ada,bello,dataDir,get store(){return store;},get now(){return now;},advance(ms){now+=ms;},reopen(){store.close();store=new GameStore({dataDir,clock:()=>now});}};
}
const rejection=(fn,code)=>assert.throws(fn,error=>error.code===code);

test('free game top-ups are capped, payload-bound and durably idempotent without pretending to verify payments',async t=>{
  const f=await fixture(t),id=f.ada;
  for(const amount of [0,-1,999,5000001,1.5,'1000',NaN,Infinity,Number.MAX_SAFE_INTEGER])rejection(()=>f.store.topup(id,{amount,idempotencyKey:key()}),'invalid_topup');
  rejection(()=>f.store.topup(id,{amount:1000}),'idempotency_required');
  rejection(()=>f.store.topup(id,{amount:1000,verified:true,idempotencyKey:key()}),'payments_unavailable');
  const request={amount:5000000,idempotencyKey:key()},added=f.store.topup(id,request);
  assert.equal(added.profile.wallet,5026000);assert.equal(added.topup.virtual,true);
  assert.equal(f.store.topup(id,request).topup.id,added.topup.id);
  rejection(()=>f.store.topup(id,{...request,amount:1000}),'idempotency_conflict');
  for(let i=0;i<3;i++)f.store.action(id,'demo-topup',{amount:5000000,idempotencyKey:key()});
  rejection(()=>f.store.topup(id,{amount:1000,idempotencyKey:key()}),'topup_limit');
  assert.equal(f.store.transactions(id).filter(row=>row.reason==='Free game Naira top-up').length,4);
  f.reopen();assert.equal(f.store.topup(id,request).replayed,true);assert.equal(f.store.profile(id).wallet,20026000);
  f.advance(WALLET_META.topupWindowMs);f.store.topup(id,{amount:1000,idempotencyKey:key()});
  assert.equal(f.store.wallet(id).walletMeta.balanceLabel,'Naira balance');
});

test('resident transfers commit balanced double ledger entries, recipient notices and SSE exactly once across restarts',async t=>{
  const f=await fixture(t),events=[];f.store.emitUser=(id,event,data)=>events.push({id,event,data});
  const payload={residentId:f.bello,amount:3500,note:'Dinner',idempotencyKey:key()};
  const before=f.store.profile(f.ada).wallet+f.store.profile(f.bello).wallet;
  const sent=f.store.transfer(f.ada,payload);
  assert.equal(sent.profile.wallet,22500);assert.equal(f.store.profile(f.bello).wallet,29500);
  assert.equal(f.store.profile(f.ada).wallet+f.store.profile(f.bello).wallet,before);
  const debit=f.store.transactions(f.ada)[0],credit=f.store.transactions(f.bello)[0];assert.equal(debit.amount+credit.amount,0);
  assert.match(debit.reason,/Naira to Bello/);assert.match(credit.reason,/Naira from Ada/);
  assert.ok(events.some(event=>event.id===f.bello&&event.event==='profile'&&event.data.profile.wallet===29500));
  assert.equal(events.filter(event=>event.id===f.bello&&event.event==='notification').length,1);
  const notice=f.store.notifications(f.bello).find(notice=>notice.kind==='transfer');assert.ok(notice);assert.equal(notice.link,'wallet');
  const eventCount=events.length;assert.equal(f.store.transfer(f.ada,payload).transfer.id,sent.transfer.id);assert.equal(events.length,eventCount);
  rejection(()=>f.store.transfer(f.ada,{...payload,amount:3501}),'idempotency_conflict');
  rejection(()=>f.store.transfer(f.ada,{...payload,residentId:f.ada}),'self_transfer');
  f.reopen();assert.equal(f.store.transfer(f.ada,payload).replayed,true);
  assert.equal(f.store.profile(f.bello).wallet,29500);assert.equal(f.store.notifications(f.bello).filter(notice=>notice.kind==='transfer').length,1);
  assert.equal(f.store.transactions(f.ada).filter(row=>row.amount===-3500).length,1);
});

test('transfers reject forged amounts, absent or blocked recipients and insufficient funds with no partial writes',async t=>{
  const f=await fixture(t),snapshot=()=>[f.store.profile(f.ada).wallet,f.store.profile(f.bello).wallet,f.store.all('SELECT * FROM ledger').length];
  const before=snapshot();
  for(const amount of [0,-1,1.5,'100',Infinity,Number.MAX_SAFE_INTEGER])rejection(()=>f.store.transfer(f.ada,{residentId:f.bello,amount,idempotencyKey:key()}),'invalid_amount');
  rejection(()=>f.store.transfer(f.ada,{residentId:f.bello,amount:26001,idempotencyKey:key()}),'insufficient_balance');
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

test('wallet balance caps roll back both sides of transfers and failed top-ups without consuming retry keys',async t=>{
  const f=await fixture(t);let remaining=WALLET_META.maxBalance-1000-26000;
  for(let i=0;remaining>0;i++){
    if(i&&i%4===0)f.advance(WALLET_META.topupWindowMs);
    const amount=Math.min(WALLET_META.topupMax,remaining);f.store.topup(f.bello,{amount,idempotencyKey:key()});remaining-=amount;
  }
  assert.equal(f.store.profile(f.bello).wallet,99999000);
  const before=f.store.all('SELECT * FROM ledger').length;
  rejection(()=>f.store.transfer(f.ada,{residentId:f.bello,amount:1001,idempotencyKey:key()}),'wallet_limit');
  assert.equal(f.store.profile(f.ada).wallet,26000);assert.equal(f.store.profile(f.bello).wallet,99999000);assert.equal(f.store.all('SELECT * FROM ledger').length,before);
  f.store.transfer(f.ada,{residentId:f.bello,amount:1000,idempotencyKey:key()});
  const retry={amount:1000,idempotencyKey:key()};rejection(()=>f.store.topup(f.bello,retry),'wallet_limit');
  assert.equal(f.store.get('SELECT COUNT(*) n FROM economy_operations WHERE operation_key=?',retry.idempotencyKey).n,0);
  f.store.transfer(f.bello,{residentId:f.ada,amount:1000,idempotencyKey:key()});assert.equal(f.store.topup(f.bello,retry).profile.wallet,100000000);
});

test('property investments accrue capped simulated rent, collect and resell durably without allowing primary-home income',async t=>{
  const f=await fixture(t),property=properties.find(item=>item.id==='lugbe-flat');
  f.store.topup(f.ada,{amount:1000000,idempotencyKey:key()});
  const buy={propertyId:property.id,idempotencyKey:key()},investment=f.store.action(f.ada,'buy-investment',buy);
  assert.equal(investment.profile.wallet,1026000-property.buy);assert.equal(investment.investment.incomePerPeriod,560);
  assert.ok(investment.profile.ownedProperties.includes(property.id));
  assert.equal(f.store.action(f.ada,'buy-investment',buy).replayed,true);
  const collect={propertyId:property.id,idempotencyKey:key()};rejection(()=>f.store.action(f.ada,'collect-rent',collect),'rent_not_ready');
  rejection(()=>f.store.action(f.ada,'sell-investment',{propertyId:property.id,idempotencyKey:key()}),'investment_cooldown');
  f.advance(INVESTMENT_META.periodMs*3+3000);const income=f.store.action(f.ada,'collect-rent',collect);
  assert.equal(income.income.amount,1680);assert.equal(income.investment.collectable,0);
  f.reopen();assert.equal(f.store.action(f.ada,'collect-rent',collect).income.amount,1680);assert.equal(f.store.action(f.ada,'collect-rent',collect).replayed,true);
  f.advance(INVESTMENT_META.periodMs*100);assert.equal(investmentView(f.store.profile(f.ada),property,f.now).collectable,560*60);
  const capped=f.store.action(f.ada,'collect-rent',{propertyId:property.id,idempotencyKey:key()});assert.equal(capped.income.amount,33600);
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

test('dice rounds charge or reward only server outcomes and remain replay-proof after leaving and restarting',async t=>{
  const f=await fixture(t);let nextDie=1;t.mock.method(crypto,'randomInt',()=>nextDie);
  const payload={stake:500,choice:'low',idempotencyKey:key()};
  rejection(()=>f.store.action(f.ada,'play-dice',payload),'wrong_venue');
  f.store.action(f.ada,'leave-home');f.store.action(f.ada,'enter-venue',{venueId:'games-lounge'});
  for(const stake of [-1,0,99,5001,100.5,'100'])rejection(()=>f.store.action(f.ada,'play-dice',{...payload,stake}),'invalid_stake');
  const won=f.store.action(f.ada,'play-dice',{...payload,die:6,payout:999999});assert.equal(won.round.die,1);assert.equal(won.round.payout,1000);assert.equal(won.round.net,500);assert.equal(won.profile.wallet,26500);
  nextDie=6;const lost=f.store.action(f.ada,'play-dice',{stake:500,choice:'low',idempotencyKey:key()});assert.equal(lost.round.won,false);assert.equal(lost.round.net,-500);assert.equal(lost.profile.wallet,26000);
  rejection(()=>f.store.action(f.ada,'play-dice',{...payload,choice:'high'}),'idempotency_conflict');
  for(let i=0;i<23;i++)f.store.action(f.ada,'play-dice',{stake:100,choice:i%2?'high':'low',idempotencyKey:key()});
  assert.equal(f.store.profile(f.ada).gambleHistory.length,20);const balance=f.store.profile(f.ada).wallet;
  f.store.action(f.ada,'exit-venue');f.reopen();const replay=f.store.action(f.ada,'play-dice',payload);
  assert.equal(replay.round.id,won.round.id);assert.equal(replay.profile.wallet,balance);assert.equal(replay.replayed,true);
  assert.equal(f.store.transactions(f.ada).filter(row=>row.reason.startsWith('Dice lounge')).length,25);
});

test('new life destinations enforce Jabi Lake geography and furniture storage retains ownership',async t=>{
  const f=await fixture(t);assert.equal(venueAvailable('jabi-lake','garki-i'),false);assert.equal(venueAvailable('jabi-lake','jabi'),true);
  f.store.action(f.ada,'purchase',{itemId:'plant'});f.store.action(f.ada,'place-furniture',{itemId:'plant',x:.4,y:.5});
  const stored=f.store.action(f.ada,'store-furniture',{itemId:'plant'}).profile;assert.ok(stored.inventory.includes('plant'));assert.equal(stored.furnitureLayout.plant,undefined);
  assert.deepEqual(stored.storedFurniture,['plant']);f.reopen();assert.deepEqual(f.store.profile(f.ada).storedFurniture,['plant']);
  const placed=f.store.action(f.ada,'place-furniture',{itemId:'plant',x:.4,y:.5}).profile;assert.deepEqual(placed.storedFurniture,[]);assert.deepEqual(placed.furnitureLayout.plant,{x:.4,y:.5,rotation:0});
  f.store.action(f.ada,'leave-home');assert.throws(()=>f.store.action(f.ada,'enter-venue',{venueId:'jabi-lake'}),/Choose a place/);
  for(const [venueId,activityId] of [['mosque','mosque-prayer'],['church','church-reflect'],['club','club-dance']]){
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
  for(let i=0;i<4;i++){
    const {challenge}=f.store.action(f.ada,'start-shift');f.advance(2000);
    f.store.action(f.ada,'complete-shift',{challengeId:challenge.id,answers:jobs['restaurant-host'].tasks.map(task=>({taskId:task.id,optionId:task.answer}))});f.advance(20000);
  }
  f.store.action(f.ada,'enter-home');f.reopen();
  const beforeSleep=f.store.profile(f.ada),slept=f.store.action(f.ada,'sleep').profile;
  assert.equal(slept.energy,Math.min(100,beforeSleep.energy+46+10+6));assert.ok(slept.energy>beforeSleep.energy+46);
  const relaxed=f.store.action(f.ada,'relax').profile;
  assert.equal(relaxed.fun,Math.min(100,slept.fun+22+12+6));assert.ok(relaxed.fun>slept.fun+22);
  assert.equal(relaxed.stress,Math.max(0,slept.stress-14-6));assert.equal(relaxed.stress,slept.stress-20);
  assert.deepEqual(relaxed.furnitureLayout['king-bed'],{x:.4,y:.6,rotation:90});
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
  const start=async()=>{const server=createServer({dataDir});server.listen(0,'127.0.0.1');await once(server,'listening');return server;};
  app=await start();t.after(async()=>{app.closeRealtime();app.close();await once(app,'close');fs.rmSync(dataDir,{recursive:true,force:true});});
  const request=async(route,cookie,body)=>{const response=await fetch(`http://127.0.0.1:${app.address().port}${route}`,{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  assert.equal((await request('/api/wallet')).status,401);
  const ada=await request('/api/auth/register',null,{username:'wallet_ada',password:'a-test-password'}),bello=await request('/api/auth/register',null,{username:'wallet_bello',password:'a-test-password'});
  assert.equal(ada.data.walletMeta.currency,'NGN');assert.equal(ada.data.vehicleColors.length,7);assert.equal(ada.data.investmentMeta.periodMs,60000);
  const topup=await request('/api/wallet/topup',ada.cookie,{amount:10000,idempotencyKey:key()});assert.equal(topup.data.profile.wallet,36000);
  const payload={residentId:bello.data.profile.id,amount:2500,idempotencyKey:key()},transfer=await request('/api/wallet/transfer',ada.cookie,payload);assert.equal(transfer.status,200);
  assert.equal((await request('/api/wallet',bello.cookie)).data.profile.wallet,28500);
  assert.equal((await request('/api/wallet/transfer',ada.cookie,{...payload,amount:2501})).status,409);
  const conversation=(await request('/api/conversations',ada.cookie,{residentId:bello.data.profile.id})).data.conversation;
  await request(`/api/conversations/${conversation.id}/messages`,ada.cookie,{text:'Thanks for dinner!'});
  assert.equal((await request(`/api/conversations/${conversation.id}/messages`,bello.cookie)).data.messages[0].text,'Thanks for dinner!');
  app.closeRealtime();app.close();await once(app,'close');app=await start();
  const retry=await request('/api/wallet/transfer',ada.cookie,payload);assert.equal(retry.data.replayed,true);assert.equal(retry.data.transfer.id,transfer.data.transfer.id);
  assert.equal((await request('/api/wallet',ada.cookie)).data.profile.wallet,33500);
  assert.equal((await request('/api/wallet',bello.cookie)).data.profile.wallet,28500);
});

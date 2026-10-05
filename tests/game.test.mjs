import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore, jobs } from '../src/server/gameStore.mjs';

async function fixture(t) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-game-'));
  let time=Date.parse('2026-10-05T10:00:00Z');const store=new GameStore({dataDir,clock:()=>time,originRandomInt:(min,max)=>max===2?1:0});
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const {residentId}=await store.register({username:'resident',displayName:'Resident',password:'a-test-password'});
  return{store,id:residentId,advance:ms=>{time+=ms;},dataDir};
}

test('home meal debits the authoritative wallet and raises hunger',async t=>{
  const {store,id}=await fixture(t);const before=store.profile(id),after=store.action(id,'eat').profile;
  assert.equal(after.wallet,before.wallet-1200);assert.ok(after.hunger>before.hunger);
  store.action(id,'leave-home');assert.throws(()=>store.action(id,'sleep'),/Go home/);
});

test('client verification and payload amounts cannot mint currency',async t=>{
  const {store,id}=await fixture(t);const before=store.profile(id);
  for(const verified of [false,true])assert.throws(()=>store.action(id,'topup',{amount:5000000,receipt:'forged',verified}),/verified payment provider/);
  assert.throws(()=>store.action(id,'purchase',{itemId:'not-a-real-item',price:-999999}),/Okrika Marketplace/);
  const after=store.action(id,'purchase',{itemId:'plant',price:-999999,wallet:999999999}).profile;
  assert.equal(after.wallet,before.wallet-2300);assert.deepEqual(after.inventory,['plant']);
  assert.throws(()=>store.action(id,'purchase',{itemId:'plant'}),/already own/);
});

test('interactive job checks workplace, task answers and reward idempotency',async t=>{
  const {store,id,advance}=await fixture(t);store.action(id,'take-job',{jobId:'restaurant-host'});
  assert.throws(()=>store.action(id,'work-shift'),/work tasks/);assert.throws(()=>store.action(id,'start-shift'),/Head out/);
  store.action(id,'leave-home');assert.throws(()=>store.action(id,'start-shift'),/Travel to Garki/);const {trip}=store.action(id,'travel',{district:jobs['restaurant-host'].district,mode:'bus'});advance(trip.seconds*1000);store.action(id,'arrive',{tripId:trip.id});const before=store.profile(id);const {challenge}=store.action(id,'start-shift');
  assert.equal(challenge.tasks.length,3);assert.ok(challenge.tasks.every(task=>!('answer' in task)));
  const answers=jobs['restaurant-host'].tasks.map(task=>({taskId:task.id,optionId:task.answer}));
  assert.throws(()=>store.action(id,'complete-shift',{challengeId:challenge.id,answers}),/Read the tasks/);
  advance(2000);assert.throws(()=>store.action(id,'complete-shift',{challengeId:challenge.id,answers:[]}),/each shift task/);
  const first=store.action(id,'complete-shift',{challengeId:challenge.id,answers});assert.equal(first.profile.wallet,before.wallet+5600);
  const replay=store.action(id,'complete-shift',{challengeId:challenge.id,answers});assert.equal(replay.profile.wallet,first.profile.wallet);assert.deepEqual(replay.result,first.result);
  assert.throws(()=>store.action(id,'start-shift'),/between shifts/);
});

test('travel persists cost and rejects early arrival and invented locations',async t=>{
  const {store,id,advance}=await fixture(t),starting=store.profile(id).wallet;assert.throws(()=>store.action(id,'travel',{district:'invented'}),/atlas/);
  assert.throws(()=>store.action(id,'travel',{district:'jabi',mode:'walk'}),/choose transport/);
  const {trip,profile}=store.action(id,'travel',{district:'jabi',mode:'bus'});assert.ok(trip.cost>0);assert.equal(profile.wallet,starting-trip.cost);
  assert.throws(()=>store.action(id,'arrive',{tripId:trip.id}),/in progress/);assert.throws(()=>store.action(id,'eat'),/journey/);
  advance(trip.seconds*1000);const after=store.action(id,'arrive',{tripId:trip.id}).profile;assert.equal(after.district,'jabi');assert.equal(after.activeTrip,null);
  assert.throws(()=>store.action(id,'arrive',{tripId:trip.id}),/no longer active/);
});

test('profile update allowlist prevents balance and progression tampering',async t=>{
  const {store,id}=await fixture(t),starting=store.profile(id).wallet;const p=store.updateProfile(id,{wallet:90000000,reputation:999,inventory:['compact-car'],appearance:{hair:'locs'},settings:{presenceVisible:false}});
  assert.equal(p.wallet,starting);assert.equal(p.reputation,0);assert.deepEqual(p.inventory,[]);assert.equal(p.appearance.hair,'locs');assert.equal(p.settings.presenceVisible,false);
  assert.throws(()=>store.updateProfile(id,{appearance:{hair:'anything'}}),/supported hair/);
});

test('premium wardrobe ownership and travel quotations are enforced by the server',async t=>{
  const {store,id}=await fixture(t);const before=store.profile(id);
  assert.throws(()=>store.updateProfile(id,{appearance:{top:'agbada'}}),/Buy this outfit/);
  const bought=store.action(id,'purchase',{itemId:'traditional-set'}).profile;
  assert.equal(bought.wallet,before.wallet-12000);assert.equal(store.updateProfile(id,{appearance:{top:'agbada'}}).appearance.top,'agbada');
  const quote=store.quoteTravel(id,{district:'jabi',mode:'bus'});assert.equal(store.profile(id).wallet,bought.wallet);
  const journey=store.action(id,'travel',{district:'jabi',mode:'bus',cost:0});assert.equal(journey.trip.cost,quote.cost);assert.equal(journey.trip.seconds,quote.seconds);assert.equal(journey.profile.wallet,bought.wallet-quote.cost);
});

test('same-millisecond messages remain unread until read, and blocks hide group previews',async t=>{
  const {store,id}=await fixture(t);const b=(await store.register({username:'neighbor',password:'a-test-password'})).residentId,c=(await store.register({username:'third',password:'a-test-password'})).residentId;
  for(const target of [b,c]){store.requestFriend(id,target);const request=store.friendRequests(target)[0];store.respondFriend(target,request.id,true);}
  const conversation=store.createConversation(id,{kind:'group',name:'Garki friends',memberIds:[b,c]}).conversation;
  store.sendMessage(id,conversation.id,'First');store.messages(b,conversation.id);store.sendMessage(id,conversation.id,'Second in the same millisecond');
  assert.equal(store.conversation(b,conversation.id).unread,1);assert.equal(store.messages(b,conversation.id).messages.length,2);
  store.moderate(b,'block',id,true);store.sendMessage(id,conversation.id,'Blocked sender content');
  const view=store.conversation(b,conversation.id);assert.equal(view.lastMessage,null);assert.equal(view.unread,0);assert.deepEqual(store.messages(b,conversation.id).messages,[]);
  store.sendMessage(c,conversation.id,'Visible group member');assert.equal(store.conversation(b,conversation.id).lastMessage.text,'Visible group member');
});

test('friend groups, invitations, event RSVPs and reports contain actual residents',async t=>{
  const {store,id}=await fixture(t);const other=(await store.register({username:'neighbor',password:'a-test-password'})).residentId;
  assert.throws(()=>store.createConversation(id,{kind:'group',name:'Friends',memberIds:[other]}),/accepted friends/);
  store.requestFriend(id,other);store.respondFriend(other,store.friendRequests(other)[0].id,true);
  assert.equal(store.createConversation(id,{kind:'group',name:'Friends',memberIds:[other]}).conversation.members.length,2);
  let emitted;store.emitUser=(target,event,data)=>{if(target===other&&event==='invitation')emitted=data;};
  const invitation=store.invite(id,{residentId:other,kind:'home',note:'Come over after work'}).invitation;
  assert.equal(emitted.resident.id,id);assert.equal(invitation.resident.id,other);
  assert.equal(store.respondInvite(other,invitation.id,true).invitations[0].status,'accepted');
  const event=store.createEvent(id,{title:'Lake walk',district:'jabi',startsAt:store.clock()+3600000,description:'Meet by the lake'}).event;
  store.rsvp(other,event.id,true);assert.deepEqual(new Set(store.events(other)[0].attendeeIds),new Set([id,other]));
  const conversation=store.createConversation(id,{residentId:other}).conversation;
  store.moderate(other,'mute',id,true);const count=store.notifications(other).length;
  const sent=store.sendMessage(id,conversation.id,'This message is saved without a muted alert');assert.equal(store.notifications(other).length,count);assert.equal(store.messages(other,conversation.id).messages.length,1);
  assert.ok(store.report(other,{messageId:sent.message.id,reason:'Please review this message'}).reportId);
  assert.throws(()=>store.action(id,'take-job',{jobId:'constructor'}),/listed job/);
});

test('securing a home preserves travel and previously purchased ownership',async t=>{
  const {store,id,advance}=await fixture(t);store.topup(id,{amount:900000,idempotencyKey:'home_purchase_funds'});const {trip}=store.action(id,'travel',{district:'garki-i',mode:'bus'});advance(trip.seconds*1000);store.action(id,'arrive',{tripId:trip.id});const starting=store.profile(id);
  const bought=store.action(id,'move-home',{propertyId:'lugbe-flat',tenure:'own'}).profile;
  assert.equal(bought.wallet,starting.wallet-280000);assert.equal(bought.home.district,'lugbe');assert.equal(bought.district,starting.district);assert.equal(bought.location.kind,'public');assert.deepEqual(bought.ownedProperties,['lugbe-flat']);
  assert.throws(()=>store.action(id,'enter-home'),/Travel to your home/);
  const rental=store.action(id,'move-home',{propertyId:'gwarinpa-apartment',tenure:'rent'}).profile;assert.equal(rental.wallet,bought.wallet-38000);assert.equal(rental.district,starting.district);
  const returned=store.action(id,'move-home',{propertyId:'lugbe-flat',tenure:'own'}).profile;assert.equal(returned.wallet,rental.wallet);assert.equal(returned.home.propertyId,'lugbe-flat');assert.deepEqual(returned.ownedProperties,['lugbe-flat']);
});

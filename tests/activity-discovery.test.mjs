import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {GameStore} from '../src/server/gameStore.mjs';
import {installActivityDiscovery} from '../src/server/activityDiscovery.mjs';
import {activityCandidates,selectActivity,ACTIVITY_REGISTRY} from '../src/shared/activity-discovery.mjs';
import {VENUES,VENUE_ACTIONS} from '../src/shared/life.mjs';
const now=Date.parse('2026-10-07T20:30:00Z');
const profile={id:'a',district:'garki-i',location:{kind:'home'},wallet:100000,energy:30,hunger:90,hygiene:90,fun:90,discovery:{}};

test('registry connects every existing destination and venue activity to a real action',()=>{
 for(const venue of VENUES)assert.ok(ACTIVITY_REGISTRY.some(a=>a.venueId===venue.id&&a.action.kind==='travel'));
 for(const activity of VENUE_ACTIONS)assert.ok(ACTIVITY_REGISTRY.some(a=>a.action.activityId===activity.id));
 assert.equal(new Set(ACTIVITY_REGISTRY.map(a=>a.id)).size,ACTIVITY_REGISTRY.length);
});
test('eligibility respects actual location, money, needs, private visits, completed features and paid-play eligibility',()=>{
 const a=activityCandidates({profile,now});assert.ok(a.some(a=>a.id==='need:sleep'));assert.ok(!a.some(a=>a.id==='need:eat'));assert.ok(!a.some(a=>a.category==='jackpot'));
 assert.equal(activityCandidates({profile:{...profile,activeTrip:{id:'trip'}},now}).length,0);
 assert.ok(!activityCandidates({profile:{...profile,location:{kind:'visit'}},now}).some(a=>a.action.kind==='travel'));
 assert.ok(!activityCandidates({profile:{...profile,location:{kind:'venue',venue:'jabi-lake'}},now}).some(a=>a.id==='venue:jabi-lake'));
 assert.ok(!activityCandidates({profile:{...profile,discovery:{features:{phone:now}}},now}).some(a=>a.id==='feature:phone'));
});
test('individual weighted draws include nothing and diverse real destinations, with category and activity cooldowns',()=>{
 const draws=[.99,.01,.1,.2,.35,.55,.72,.9].map(draw=>{let call=0;return selectActivity({profile,now},()=>call++?draw:draw===.99?.99:.1)?.id||null;});
 assert.ok(draws.includes(null));assert.ok(new Set(draws).size>=5,draws);
 const p={...profile,discovery:{entries:{'need:sleep':{dismissedAt:now}},categories:{nightlife:now}}};
 const c=activityCandidates({profile:p,now:now+60000});assert.ok(!c.some(a=>a.id==='need:sleep'||a.category==='nightlife'));
});
test('social weighting uses aggregated public venues without accessing private home identities',()=>{
 const context={profile:{...profile,district:'jabi'},now};const base=activityCandidates(context).find(a=>a.id==='venue:jabi-lake');
 const active=activityCandidates({...context,stats:{hotPlaces:[{venueId:'jabi-lake',district:'jabi',online:3},{zone:'home:secret',online:9}]}}).find(a=>a.id===base.id);
 assert.ok(active.weight>base.weight);assert.match(active.description,/3 visible residents/);assert.ok(!JSON.stringify(active).includes('secret'));
});
test('progression persists dismissals, authentic completions and cross-tab shown cooldown without granting money',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abuja-discovery-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let store=new GameStore({dataDir:dir,clock:()=>now,originRandomInt:()=>1});installActivityDiscovery(store);const id=(await store.register({username:'discovery_qa',password:'Discovery fixture password'})).residentId,before=store.profile(id).wallet;
 await store.action(id,'discovery-event',{activityId:'need:sleep',event:'shown'});const suppressed=await store.action(id,'discovery-event',{activityId:'venue:jabi-lake',event:'shown'});assert.equal(suppressed.suppressed,true);
 await store.action(id,'discovery-event',{activityId:'need:sleep',event:'dismissed'});await store.action(id,'sleep');assert.equal(store.profile(id).discovery.features.sleep,now);assert.equal(store.profile(id).wallet,before);
 await assert.rejects(store.action(id,'discovery-event',{activityId:'invented',event:'shown'}),{code:'invalid_discovery'});
 store.close();store=new GameStore({dataDir:dir,clock:()=>now});t.after(()=>store.close());assert.equal(store.profile(id).discovery.features.sleep,now);
});

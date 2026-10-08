import test from 'node:test';
import assert from 'node:assert/strict';
import {locationActivities} from '../src/shared/location-activities.mjs';
import {VENUES,VENUE_ACTIONS} from '../src/shared/life.mjs';
import {activityCandidates} from '../src/shared/activity-discovery.mjs';
const profile={id:'tray-a',onboardingComplete:true,district:'central-area',location:{kind:'venue',venue:'ceddi-genesis-cinema'},wallet:100000,energy:80,discovery:{}};
const state={profile,venues:VENUES,venueActions:VENUE_ACTIONS,clubSchedule:{isOpen:true}};
test('every location projects the existing catalogue with its real cost and action',()=>{
 for(const venue of VENUES){
  const tray=locationActivities({...state,profile:{...profile,location:{kind:'venue',venue:venue.id}}});
  for(const action of VENUE_ACTIONS.filter(a=>a.venueId===venue.id)){
   const item=tray.items.find(a=>a.id===action.id);assert.equal(item.cost,action.cost);assert.deepEqual(item.payload,{activityId:action.id});assert.equal(item.duration,action.duration);
  }
 }
 const genesis=locationActivities(state);assert.equal(genesis.items.length,4);assert.ok(genesis.items.some(a=>a.name==='Buy popcorn'));
});
test('requirements, trips, guest privacy and residents are independent',()=>{
 assert.equal(locationActivities({...state,profile:{...profile,activeTrip:{id:'trip'}}}),null);
 assert.equal(locationActivities({...state,profile:{...profile,location:{kind:'visit'}}}),null);
 const poor=locationActivities({...state,profile:{...profile,id:'tray-b',wallet:0}});assert.notEqual(poor.key,locationActivities(state).key);assert.ok(poor.items.find(a=>a.cost>0).unavailable);assert.equal(poor.items.find(a=>a.cost===0).unavailable,null);
 const club=locationActivities({...state,profile:{...profile,location:{kind:'venue',venue:'club'}},clubSchedule:{isOpen:false}});assert.ok(club.items.every(a=>a.unavailable));
 const tired=locationActivities({...state,profile:{...profile,energy:0,location:{kind:'venue',venue:'gym'}}});assert.equal(tired.items.find(a=>a.id==='gym-workout').unavailable,'Rest first');
});
test('opportunities follow real recent completions and respect individual cooldowns',()=>{
 const now=Date.parse('2026-10-09T20:30:00Z');
 const context={profile:{...profile,location:{kind:'home'}},now};
 assert.ok(!activityCandidates(context).some(a=>a.id.startsWith('chain:')));
 const match={...context.profile,discovery:{features:{'ceddi-genesis-screening':now-60000}}};
 assert.ok(activityCandidates({...context,profile:match}).some(a=>a.id==='chain:match-food'));
 assert.ok(!activityCandidates({...context,profile:{...match,discovery:{features:{'ceddi-genesis-screening':now-7*3600000}}}}).some(a=>a.id==='chain:match-food'));
 assert.ok(!activityCandidates({...context,profile:{...match,discovery:{...match.discovery,entries:{'chain:match-food':{dismissedAt:now-60000}}}}}).some(a=>a.id==='chain:match-food'));
 const dinner={...context.profile,discovery:{features:{'farmcity-meal':now-60000}}};
 assert.ok(activityCandidates({...context,profile:dinner}).some(a=>a.id==='chain:friday-night'));
 assert.ok(!activityCandidates({...context,now:Date.parse('2026-10-09T11:00:00Z'),profile:dinner}).some(a=>a.id==='chain:friday-night'));
});

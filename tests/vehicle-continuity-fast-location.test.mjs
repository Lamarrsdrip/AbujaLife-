import test from 'node:test';
import assert from 'node:assert/strict';
import {installFastLocationActions} from '../src/server/fastLocationActions.mjs';

function fixture(){
 const profile={id:'resident-1',district:'maitama',location:{kind:'venue',district:'maitama',venue:'transcorp-hilton-hub'},home:{district:'gwarinpa-i',starterVersion:1},inventory:['city-sedan','bugatti-test'],vehicleColors:{'city-sedan':'black','bugatti-test':'red'},drivingVehicle:null,activeTrip:null,vehiclePresence:{vehicleId:'bugatti-test',state:'parked',district:'maitama',venue:'transcorp-hilton-hub',updatedAt:1}};
 const events=[];
 const playerState={updateOne:async(_filter,update)=>{Object.assign(profile,update.$set||{});for(const key of Object.keys(update.$unset||{}))delete profile[key];return{modifiedCount:1};},findOne:async()=>({...profile,_id:profile.id})};
 const store={clock:()=>1000,fastLocationActionsInstalled:false,profile:async()=>profile,transaction:async fn=>fn({}),collection:name=>{if(name==='player_state')return playerState;throw new Error(`unexpected collection ${name}`);},emitUser:async(_id,event,data)=>events.push({event,data}),action:async(_id,action,payload={})=>{
   if(action==='travel'||action==='return-home'){
    const mode=payload.mode||'walk',vehicleId=mode==='car'?payload.vehicleId||profile.vehiclePresence?.vehicleId:null;
    profile.activeTrip={id:'trip-1',destination:payload.district||payload.destination||'central-area',mode,vehicleId,venueId:payload.venueId,seconds:12,arrivesAt:13000,returningHome:action==='return-home'};
    profile.location={kind:'transit',district:profile.district,venue:'journey'};profile.drivingVehicle=null;return{ok:true,profile};
   }
   if(action==='arrive'){
    const trip=profile.activeTrip;profile.district=trip.destination;profile.location={kind:trip.returningHome?'home':trip.venueId?'venue':'public',district:trip.destination,venue:trip.returningHome?'home':trip.venueId||'neighbourhood'};profile.activeTrip=null;profile.drivingVehicle=null;return{ok:true,profile};
   }
   if(action==='toggle-driving'){profile.drivingVehicle=payload.vehicleId||null;return{ok:true,profile};}
   if(action==='exit-venue'){profile.location={kind:'public',district:profile.district,venue:'neighbourhood'};return{ok:true,profile};}
   return{ok:true,profile};
 }};
 installFastLocationActions(store);return{store,profile,events};
}

test('nearby personal vehicle remains the default through trip, arrival and re-entry',async()=>{
 const {store,profile}=fixture();
 const start=await store.action(profile.id,'travel',{district:'central-area',venueId:'cbn-experience',mode:'walk'});
 assert.equal(start.profile.activeTrip.mode,'car');
 assert.equal(start.profile.activeTrip.vehicleId,'bugatti-test');
 assert.equal(start.profile.vehiclePresence.state,'transit');
 assert.equal(start.profile.vehiclePresence.vehicleId,'bugatti-test');
 const arrived=await store.action(profile.id,'arrive',{tripId:'trip-1'});
 assert.equal(arrived.profile.location.venue,'cbn-experience');
 assert.equal(arrived.profile.vehiclePresence.state,'parked');
 assert.equal(arrived.profile.vehiclePresence.vehicleId,'bugatti-test');
 assert.equal(arrived.profile.vehiclePresence.venue,'cbn-experience');
 const driving=await store.action(profile.id,'toggle-driving',{vehicleId:'bugatti-test'});
 assert.equal(driving.profile.drivingVehicle,'bugatti-test');
 assert.equal(driving.profile.vehiclePresence.state,'driving');
});

test('explicit leaveVehicle keeps the personal car parked while resident walks',async()=>{
 const {store,profile}=fixture();
 const result=await store.action(profile.id,'travel',{district:'central-area',venueId:'cbn-experience',mode:'walk',leaveVehicle:true});
 assert.equal(result.profile.activeTrip.mode,'walk');
 assert.equal(result.profile.vehiclePresence.state,'parked');
 assert.equal(result.profile.vehiclePresence.venue,'transcorp-hilton-hub');
});

test('exiting a venue keeps the arrived car nearby for the next journey',async()=>{
 const {store,profile}=fixture();
 const outside=await store.action(profile.id,'exit-venue');
 assert.equal(outside.profile.vehiclePresence.vehicleId,'bugatti-test');
 assert.equal(outside.profile.vehiclePresence.venue,'neighbourhood');
 assert.equal(outside.profile.vehiclePresence.state,'parked');
 const start=await store.action(profile.id,'travel',{district:'central-area',venueId:'cbn-experience',mode:'car'});
 assert.equal(start.profile.activeTrip.vehicleId,'bugatti-test');
});

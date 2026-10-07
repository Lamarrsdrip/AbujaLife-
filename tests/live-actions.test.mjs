import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveActions} from '../src/server/liveActions.mjs';

const TOKEN='live-city-test-token-abcdefghijklmnopqrstuvwxyz';
const NOW=Date.parse('2026-10-03T21:00:00Z');

function request(method,url,payload){
 const encoded=payload===undefined?'':JSON.stringify(payload);
 return{method,url,headers:{authorization:`Bearer ${TOKEN}`,...(payload===undefined?{}:{'content-type':'application/json'})},socket:{remoteAddress:'127.0.0.1'},async *[Symbol.asyncIterator](){if(encoded)yield Buffer.from(encoded);}};
}
function response(){return{status:0,headers:{},text:'',writableEnded:false,setHeader(name,value){this.headers[name]=value;},writeHead(status,headers={}){this.status=status;Object.assign(this.headers,headers);},end(text=''){this.text=String(text);this.writableEnded=true;},json(){return JSON.parse(this.text||'{}');}};}
function fixture(){
 const profile={id:'resident-a',username:'ada_abj',displayName:'Ada',wallet:20000,fun:50,social:50,mood:50,job:null,district:'wuse-ii-a07',location:{kind:'venue',venue:'club'}};
 const nearbyResident={id:'resident-b',username:'bello_abj',displayName:'Bello',online:true,pose:{x:20,y:10,angle:0,moving:false,driving:false}};
 const emitted=[],operations=new Map(),realtime={statsBroadcasts:0},traffic={visitsAllTime:1200,visitDays:{'2026-10-03':9},trackingSince:Date.parse('2026-10-01T00:00:00Z')};
 const store={
  clock:()=>NOW,session:async token=>token===TOKEN?'resident-a':null,profile:async()=>profile,
  presence:{nearby:async()=>[nearbyResident],zone:async()=>'venue:wuse-ii-a07:club'},
  collection(name){if(name==='presence_sessions')return{aggregate:pipeline=>({toArray:async()=>[{count:pipeline[0]?.$match?.zone?2:5}]})};if(name==='residents')return{countDocuments:async()=>800};if(name==='admin_settings')return{findOne:async()=>traffic};throw new Error(`Unexpected collection ${name}`);},
  async economyOperation(id,type,payload,fingerprint,mutate){assert.equal(id,'resident-a');assert.equal(type,'club_spray');const key=payload.idempotencyKey;if(operations.has(key))return{...structuredClone(operations.get(key)),replayed:true};const extra=await mutate(profile,NOW),result={...extra,profile:structuredClone(profile),replayed:false};operations.set(key,structuredClone(result));return result;},
  async emitZone(id,type,event){emitted.push({id,type,event:structuredClone(event)});},emitCityStats(){realtime.statsBroadcasts++;}
 };
 const admin={isSuspended:async()=>false};
 return{profile,nearbyResident,emitted,realtime,store,admin,traffic};
}
async function call(runtime,method,url,payload){const res=response();assert.equal(await runtime.handle(request(method,url,payload),res),true);return{res,body:res.json()};}

test('nearby endpoint remains a live gameplay action, not an auth/startup route',async()=>{
 const f=fixture(),runtime=createLiveActions({store:f.store,admin:f.admin,publicWebUrl:'https://abujacity.life'}),{res,body}=await call(runtime,'GET','/api/presence/nearby');
 assert.equal(res.status,200);assert.equal(body.nearby.length,1);assert.equal(body.nearby[0].id,f.nearbyResident.id);assert.deepEqual(body.stats,{onlineNow:5,totalPlayers:800,visitsToday:9,visitsAllTime:1200,trackingSince:f.traffic.trackingSince,hereNow:2});assert.equal(body.serverTime,NOW);
});

test('real nearby polling records a session visit once in its existing visit window',async()=>{
 const f=fixture();let recordedAt=null;
 const collection=f.store.collection.bind(f.store);
 f.store.auth={hashToken:token=>`hash:${token}`};
 f.store.collection=name=>name==='sessions'?{async updateOne(filter,update){if(recordedAt!==null&&recordedAt>filter.$or[0].lastCityVisitAt.$lte)return{modifiedCount:0};recordedAt=update.$set.lastCityVisitAt;return{modifiedCount:1};}}:name==='admin_settings'?{findOne:async()=>f.traffic,async updateOne(filter,update){f.traffic.visitsAllTime+=update.$inc.visitsAllTime;f.traffic.visitDays['2026-10-03']+=update.$inc['visitDays.2026-10-03'];}}:collection(name);
 const runtime=createLiveActions({store:f.store,admin:f.admin});
 const first=await call(runtime,'GET','/api/presence/nearby'),again=await call(runtime,'GET','/api/presence/nearby');
 assert.equal(first.res.status,200);assert.equal(first.body.stats.visitsToday,10);assert.equal(again.body.stats.visitsToday,10);assert.equal(f.traffic.visitsAllTime,1201);
 assert.equal(f.realtime.statsBroadcasts,1,'a newly recorded visit updates every connected city counter once');
});

test('authenticated nearby polling does not pool distinct residents on one mobile-network IP',async()=>{
 const f=fixture();f.store.session=async token=>token===TOKEN?'resident-a':token===`${TOKEN}b`?'resident-b':null;
 const runtime=createLiveActions({store:f.store,admin:f.admin});
 for(let i=0;i<400;i++){
  for(const token of [TOKEN,`${TOKEN}b`]){
   const req=request('GET','/api/presence/nearby');req.headers.authorization=`Bearer ${token}`;
   const res=response();await runtime.handle(req,res);assert.equal(res.status,200);
  }
 }
});

test('club spray still debits once and broadcasts once',async()=>{
 const f=fixture(),runtime=createLiveActions({store:f.store,admin:f.admin,publicWebUrl:'https://abujacity.life'}),payload={amount:5000,idempotencyKey:'spray-valid-1'};
 const first=await call(runtime,'POST','/api/club/spray',payload);assert.equal(first.res.status,200);assert.equal(f.profile.wallet,15000);assert.equal(first.body.clubSpray.amount,5000);assert.equal(f.emitted.length,1);assert.equal(f.emitted[0].type,'club-spray');
 const replay=await call(runtime,'POST','/api/club/spray',payload);assert.equal(replay.res.status,200);assert.equal(replay.body.replayed,true);assert.equal(f.profile.wallet,15000);assert.equal(f.emitted.length,1);
});

test('club spray keeps balance and physical-location protections',async()=>{
 const poor=fixture();poor.profile.wallet=1000;let runtime=createLiveActions({store:poor.store,admin:poor.admin,publicWebUrl:'https://abujacity.life'}),result=await call(runtime,'POST','/api/club/spray',{amount:5000,idempotencyKey:'spray-poor-1'});assert.equal(result.res.status,409);assert.equal(result.body.code,'insufficient_balance');assert.equal(poor.profile.wallet,1000);
 const outside=fixture();outside.profile.location={kind:'public',venue:'neighbourhood'};runtime=createLiveActions({store:outside.store,admin:outside.admin,publicWebUrl:'https://abujacity.life'});result=await call(runtime,'POST','/api/club/spray',{amount:5000,idempotencyKey:'spray-outside-1'});assert.equal(result.res.status,409);assert.equal(result.body.code,'club_required');assert.equal(outside.profile.wallet,20000);
});

test('player emotes still require a genuinely nearby resident',async()=>{
 const f=fixture(),runtime=createLiveActions({store:f.store,admin:f.admin,publicWebUrl:'https://abujacity.life'});let result=await call(runtime,'POST','/api/presence/emote',{emote:'wave',targetResidentId:'resident-b'});assert.equal(result.res.status,200);assert.equal(result.body.emote.username,'ada_abj');assert.equal(f.emitted.at(-1).type,'player-emote');
 result=await call(runtime,'POST','/api/presence/emote',{emote:'wave',targetResidentId:'resident-missing'});assert.equal(result.res.status,409);assert.equal(result.body.code,'resident_not_nearby');
});

test('live actions contain no login, registration, logout or bootstrap endpoints',()=>{
 const source=fs.readFileSync(new URL('../src/server/liveActions.mjs',import.meta.url),'utf8');
 for(const forbidden of ['/api/auth/login','/api/auth/register','/api/auth/logout','/api/bootstrap','fastStartup'])assert.equal(source.includes(forbidden),false,`auth/startup leaked into liveActions: ${forbidden}`);
});

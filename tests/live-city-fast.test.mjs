import test from 'node:test';
import assert from 'node:assert/strict';
import { createFastStartup } from '../src/server/fastStartup.mjs';

const TOKEN='live-city-test-token-abcdefghijklmnopqrstuvwxyz';
const NOW=Date.parse('2026-10-03T21:00:00Z'); // Saturday 22:00 WAT: club night is open.

function request(method,url,payload){
  const encoded=payload===undefined?'':JSON.stringify(payload);
  return {
    method,url,
    headers:{authorization:`Bearer ${TOKEN}`,...(payload===undefined?{}:{'content-type':'application/json'})},
    socket:{remoteAddress:'127.0.0.1'},
    async *[Symbol.asyncIterator](){if(encoded)yield Buffer.from(encoded);},
  };
}

function response(){
  return {
    status:0,headers:{},text:'',writableEnded:false,
    setHeader(name,value){this.headers[name]=value;},
    writeHead(status,headers={}){this.status=status;Object.assign(this.headers,headers);},
    end(text=''){this.text=String(text);this.writableEnded=true;},
    json(){return JSON.parse(this.text||'{}');},
  };
}

function fixture(){
  const profile={
    id:'resident-a',username:'ada_abj',displayName:'Ada',wallet:20000,
    fun:50,social:50,mood:50,job:null,district:'wuse-ii-a07',
    location:{kind:'venue',venue:'club'},
  };
  const nearbyResident={id:'resident-b',username:'bello_abj',displayName:'Bello',online:true,pose:{x:20,y:10,angle:0,moving:false,driving:false}};
  const emitted=[];
  const operations=new Map();
  const traffic={visitsAllTime:1200,visitDays:{'2026-10-03':9},trackingSince:Date.parse('2026-10-01T00:00:00Z')};
  const store={
    clock:()=>NOW,
    session:async token=>token===TOKEN?'resident-a':null,
    profile:async()=>profile,
    publicJobs:()=>[],
    propertiesFor:async()=>[],
    presence:{
      nearby:async()=>[nearbyResident],
      zone:async()=> 'venue:wuse-ii-a07:club',
    },
    collection(name){
      if(name==='presence_sessions')return{aggregate:pipeline=>({toArray:async()=>[{count:pipeline[0]?.$match?.zone?2:5}]})};
      if(name==='residents')return{countDocuments:async()=>800};
      if(name==='admin_settings')return{findOne:async()=>traffic};
      throw new Error(`Unexpected collection ${name}`);
    },
    async economyOperation(id,type,payload,fingerprint,mutate){
      assert.equal(id,'resident-a');assert.equal(type,'club_spray');
      const key=payload.idempotencyKey;
      if(operations.has(key))return{...structuredClone(operations.get(key)),replayed:true};
      const extra=await mutate(profile,NOW);
      const result={...extra,profile:structuredClone(profile),replayed:false};
      operations.set(key,structuredClone(result));
      return result;
    },
    async emitZone(id,type,event){emitted.push({id,type,event:structuredClone(event)});},
  };
  const admin={isSuspended:async()=>false,publicSettings:async()=>({registrationOpen:true})};
  return{profile,nearbyResident,emitted,store,admin,traffic};
}

async function call(runtime,method,url,payload){
  const res=response();
  assert.equal(await runtime.handle(request(method,url,payload),res),true);
  return{res,body:res.json()};
}

test('fast nearby endpoint returns real residents and truthful separate city counters',async()=>{
  const f=fixture(),runtime=createFastStartup({store:f.store,admin:f.admin,publicWebUrl:'https://abujacity.life'});
  const {res,body}=await call(runtime,'GET','/api/presence/nearby');
  assert.equal(res.status,200);
  assert.equal(body.nearby.length,1);
  assert.equal(body.nearby[0].id,f.nearbyResident.id);
  assert.deepEqual(body.stats,{onlineNow:5,totalPlayers:800,visitsToday:9,visitsAllTime:1200,trackingSince:f.traffic.trackingSince,hereNow:2});
  assert.equal(body.serverTime,NOW);
});

test('club spray debits Game Naira once, replays idempotently, and broadcasts once',async()=>{
  const f=fixture(),runtime=createFastStartup({store:f.store,admin:f.admin,publicWebUrl:'https://abujacity.life'});
  const payload={amount:5000,idempotencyKey:'spray-valid-1'};
  const first=await call(runtime,'POST','/api/club/spray',payload);
  assert.equal(first.res.status,200);
  assert.equal(f.profile.wallet,15000);
  assert.equal(first.body.clubSpray.amount,5000);
  assert.equal(f.emitted.length,1);
  assert.equal(f.emitted[0].type,'club-spray');
  assert.equal(f.emitted[0].event.username,'ada_abj');

  const replay=await call(runtime,'POST','/api/club/spray',payload);
  assert.equal(replay.res.status,200);
  assert.equal(replay.body.replayed,true);
  assert.equal(f.profile.wallet,15000);
  assert.equal(f.emitted.length,1,'an idempotent retry must not broadcast another spray');
});

test('club spray rejects insufficient balance without debiting',async()=>{
  const f=fixture();f.profile.wallet=1000;
  const runtime=createFastStartup({store:f.store,admin:f.admin,publicWebUrl:'https://abujacity.life'});
  const {res,body}=await call(runtime,'POST','/api/club/spray',{amount:5000,idempotencyKey:'spray-poor-1'});
  assert.equal(res.status,409);
  assert.equal(body.code,'insufficient_balance');
  assert.equal(f.profile.wallet,1000);
  assert.equal(f.emitted.length,0);
});

test('club spray rejects residents who are not physically inside a club',async()=>{
  const f=fixture();f.profile.location={kind:'public',venue:'neighbourhood'};
  const runtime=createFastStartup({store:f.store,admin:f.admin,publicWebUrl:'https://abujacity.life'});
  const {res,body}=await call(runtime,'POST','/api/club/spray',{amount:5000,idempotencyKey:'spray-outside-1'});
  assert.equal(res.status,409);
  assert.equal(body.code,'club_required');
  assert.equal(f.profile.wallet,20000);
  assert.equal(f.emitted.length,0);
});

test('player emotes only target a resident who is genuinely nearby',async()=>{
  const f=fixture(),runtime=createFastStartup({store:f.store,admin:f.admin,publicWebUrl:'https://abujacity.life'});
  const ok=await call(runtime,'POST','/api/presence/emote',{emote:'wave',targetResidentId:'resident-b'});
  assert.equal(ok.res.status,200);
  assert.equal(ok.body.emote.username,'ada_abj');
  assert.equal(f.emitted.at(-1).type,'player-emote');

  const denied=await call(runtime,'POST','/api/presence/emote',{emote:'wave',targetResidentId:'resident-missing'});
  assert.equal(denied.res.status,409);
  assert.equal(denied.body.code,'resident_not_nearby');
});

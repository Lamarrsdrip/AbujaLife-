import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { attachEntryBootstrap } from '../src/server/entryBootstrap.mjs';

async function fixture(){
 let profileReads=0;
 const sessionToken='a'.repeat(64),profile={id:'resident-1',username:'ada',displayName:'Ada',onboardingComplete:true,wallet:120000,district:'garki-i',location:{kind:'home',district:'garki-i',venue:'home'},home:{name:'Starter home',district:'garki-i'},appearance:{},settings:{},origin:{residence:{id:'starter-home',district:'garki-i'}},inventory:[],ownedProperties:[],vehicleColors:{},propertyInvestments:{},furnitureLayout:{},storedFurniture:[]};
 const store={
  clock:()=>1_760_000_000_000,
  publicJobs:()=>({}),
  async session(token){return token===sessionToken?profile.id:null;},
  async profile(id){profileReads++;assert.equal(id,profile.id);return structuredClone(profile);}
 };
 const admin={async isSuspended(){return false;}};
 const fallback=http.createServer((req,res)=>{res.writeHead(418,{'content-type':'application/json'});res.end(JSON.stringify({fallback:true,url:req.url}));});
 attachEntryBootstrap(fallback,{store,admin,corsOrigins:['http://localhost'],publicWebUrl:'http://localhost'});
 await new Promise(resolve=>fallback.listen(0,'127.0.0.1',resolve));
 return{server:fallback,base:`http://127.0.0.1:${fallback.address().port}`,token:sessionToken,counters:()=>({profileReads})};
}

test('anonymous entry responds without resident reads',async t=>{
 const f=await fixture();t.after(()=>new Promise(resolve=>f.server.close(resolve)));
 const response=await fetch(`${f.base}/api/entry`),body=await response.json();
 assert.equal(response.status,200);assert.deepEqual(body,{authenticated:false,startup:true,entry:true,serverTime:1_760_000_000_000});
 assert.deepEqual(f.counters(),{profileReads:0});
});

test('authenticated entry returns only first-frame city state',async t=>{
 const f=await fixture();t.after(()=>new Promise(resolve=>f.server.close(resolve)));
 const response=await fetch(`${f.base}/api/entry`,{headers:{cookie:`abujalife_session=${f.token}`}}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.authenticated,true);assert.equal(body.entry,true);assert.equal(body.startup,true);assert.equal(body.profile.id,'resident-1');
 assert.deepEqual(body.conversations,[]);assert.deepEqual(body.notifications,[]);assert.deepEqual(body.transactions,[]);assert.equal(body.payments,null);assert.deepEqual(f.counters(),{profileReads:1});
});

test('non-entry routes fall through untouched',async t=>{
 const f=await fixture();t.after(()=>new Promise(resolve=>f.server.close(resolve)));
 const response=await fetch(`${f.base}/api/bootstrap`),body=await response.json();
 assert.equal(response.status,418);assert.equal(body.fallback,true);assert.equal(body.url,'/api/bootstrap');
});

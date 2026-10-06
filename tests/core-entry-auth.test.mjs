import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { attachCoreEntry } from '../src/server/coreEntry.mjs';

async function fixture(){
 let profileReads=0,loginWrites=0,registerWrites=0;
 const sessions=new Map();
 const profile={id:'resident-1',username:'ada',displayName:'Ada',onboardingComplete:true,wallet:100000,district:'garki-i',location:{kind:'home',district:'garki-i',venue:'home'},home:{name:'Starter home',district:'garki-i'},appearance:{},settings:{},loans:[],inventory:[],ownedProperties:[],vehicleColors:{},propertyInvestments:{},furnitureLayout:{},storedFurniture:[]};
 const store={
  clock:()=>1_760_000_000_000,
  publicJobs:()=>({}),
  async login(){loginWrites++;const session={residentId:profile.id,token:'a'.repeat(64)};sessions.set(session.token,profile.id);return session;},
  async register(){registerWrites++;const session={residentId:profile.id,token:'b'.repeat(64)};sessions.set(session.token,profile.id);return session;},
  async session(token){return sessions.get(token)||null;},
  async logout(token){sessions.delete(token);},
  async profile(id){profileReads++;assert.equal(id,profile.id);return structuredClone(profile);}
 };
 const admin={async isSuspended(){return false;},async publicSettings(){return{registrationOpen:true};}};
 const fallback=http.createServer((req,res)=>{res.writeHead(418,{'content-type':'application/json'});res.end(JSON.stringify({fallback:true,url:req.url}));});
 attachCoreEntry(fallback,{store,admin,corsOrigins:['http://localhost'],publicWebUrl:'http://localhost',secureCookies:false});
 await new Promise(resolve=>fallback.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${fallback.address().port}`;
 return{base,server:fallback,counters:()=>({profileReads,loginWrites,registerWrites})};
}

async function json(response){const body=await response.json();return{response,body};}

test('login returns session acknowledgement before any resident bootstrap work',async t=>{
 const f=await fixture();t.after(()=>new Promise(resolve=>f.server.close(resolve)));
 const {response,body}=await json(await fetch(`${f.base}/api/auth/login?session=1`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'ada',password:'password1'})}));
 assert.equal(response.status,200);assert.deepEqual(body,{ok:true,authenticated:true,residentId:'resident-1'});
 assert.deepEqual(f.counters(),{profileReads:0,loginWrites:1,registerWrites:0});
 assert.match(response.headers.get('set-cookie'),/^abujalife_session=a{64};/);assert.doesNotMatch(response.headers.get('set-cookie'),/; Secure/);
});

test('compact startup reads only the resident core after authentication',async t=>{
 const f=await fixture();t.after(()=>new Promise(resolve=>f.server.close(resolve)));
 const login=await fetch(`${f.base}/api/auth/login?session=1`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'ada',password:'password1'})});
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const {response,body}=await json(await fetch(`${f.base}/api/bootstrap?startup=1`,{headers:{cookie}}));
 assert.equal(response.status,200);assert.equal(body.authenticated,true);assert.equal(body.startup,true);assert.equal(body.profile.id,'resident-1');
 assert.deepEqual(body.conversations,[]);assert.deepEqual(body.notifications,[]);assert.deepEqual(body.nearby,[]);assert.equal(body.payments.deferred,true);
 assert.deepEqual(f.counters(),{profileReads:1,loginWrites:1,registerWrites:0});
});

test('anonymous startup never performs resident work',async t=>{
 const f=await fixture();t.after(()=>new Promise(resolve=>f.server.close(resolve)));
 const {response,body}=await json(await fetch(`${f.base}/api/bootstrap?startup=1`));
 assert.equal(response.status,200);assert.deepEqual(body,{authenticated:false,startup:true,serverTime:1_760_000_000_000});
 assert.deepEqual(f.counters(),{profileReads:0,loginWrites:0,registerWrites:0});
});

test('legacy routes remain available for compatibility instead of being silently replaced',async t=>{
 const f=await fixture();t.after(()=>new Promise(resolve=>f.server.close(resolve)));
 const {response,body}=await json(await fetch(`${f.base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));
 assert.equal(response.status,418);assert.equal(body.fallback,true);
});

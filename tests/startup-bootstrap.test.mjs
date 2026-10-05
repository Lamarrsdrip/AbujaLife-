import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoGameStore } from '../src/server/mongo/gameStore.mjs';
import { createProductionServer } from '../src/server/production-http.mjs';
import { GameError } from '../src/server/errors.mjs';

const socialNames=['people','friends','friendRequests','conversations','notifications','invitations','nearby','events'];
const profile=()=>({id:'resident',username:'resident',wallet:100000,inventory:['plant'],loans:[],workDays:{},home:{propertyId:'starter',district:'garki'},district:'garki',location:{kind:'home',district:'garki'},job:null});

test('Mongo startup bootstrap keeps authoritative playable state without running social or ledger queries',async()=>{
  const store=Object.create(MongoGameStore.prototype),calls=[];
  store.clock=()=>Date.UTC(2026,9,5,10);
  store.profile=async()=>profile();
  store.workSchedule=async p=>{p.workDays.today={completed:1};return{completedToday:1};};
  store.activeChallenge=async()=>({id:'existing-shift'});
  store.propertiesFor=()=>[{id:'origin-home'}];
  store.transactions=async()=>{calls.push('transactions');return[{id:'salary'}];};
  store.collection=name=>{calls.push(name);return{find:()=>({toArray:async()=>[{kind:'block',target:'blocked'}]})};};
  for(const name of socialNames)store[name]=async()=>{calls.push(name);return[{id:name}];};
  const startup=await store.bootstrap('resident',{startup:true});
  assert.equal(startup.profile.wallet,100000);assert.deepEqual(startup.profile.inventory,['plant']);
  assert.equal(startup.workSchedule.completedToday,1);assert.equal(startup.activeChallenge.id,'existing-shift');
  assert.equal(startup.profile.workDays.today.completed,1);assert.equal(startup.properties[0].id,'origin-home');
  assert.deepEqual(calls,[]);assert.equal(startup.startup,true);
  for(const name of [...socialNames,'blocked','muted','transactions'])assert.deepEqual(startup[name],[]);
  const full=await store.bootstrap('resident');
  assert.equal(full.startup,undefined);assert.equal(full.notifications[0].id,'notifications');
  assert.deepEqual(full.blocked,['blocked']);assert.equal(full.transactions[0].id,'salary');
  assert.deepEqual(new Set(calls),new Set([...socialNames,'moderation','transactions']));
});

async function fixture(t){
  const calls=[],token='a'.repeat(48),state={tokens:new Map([[token,'resident']]),suspended:false,storageError:false,healthError:false,visitRow:null,guest:false,visitDenied:false,reconcileWait:null,reconcileEntered:null,broadcastWait:null,broadcastEntered:null,actionDone:false};
  const store={clock:()=>Date.UTC(2026,9,5,10),publicJobs:()=>({}),
    session:async candidate=>{if(state.storageError)throw new Error('Storage unavailable');return state.tokens.get(candidate)||null;},
    register:async body=>{assert.equal(Object.hasOwn(body,'startup'),false);calls.push(['register',body]);return{token,residentId:'resident'};},
    login:async body=>{assert.equal(Object.hasOwn(body,'startup'),false);calls.push(['login',body]);return{token,residentId:'resident'};},
    logout:async()=>{calls.push(['logout']);},
    updateProfile:async(id,body)=>{assert.equal(Object.hasOwn(body,'startup'),false);calls.push(['updateProfile',body]);return{...profile(),onboardingComplete:body.onboardingComplete===true};},
    friendIds:async()=>{state.broadcastEntered?.();if(state.broadcastWait)await state.broadcastWait;return[];},
    action:async(id,action)=>{assert.equal(action,'leave-home');calls.push(['action']);state.actionDone=true;return{ok:true,profile:{...profile(),location:{kind:'public',district:'garki'}}};},
    bootstrap:async(id,options={})=>{calls.push(['bootstrap',options.startup===true]);const p=profile();if(state.guest)p.location={kind:'visit',ownerId:'owner',visitId:'active-visit'};return{authenticated:true,...(options.startup?{startup:true}:{}),profile:p,properties:[{id:'origin-home'}],workSchedule:{completedToday:1},activeChallenge:{id:'resume-shift'},...Object.fromEntries(socialNames.map(name=>[name,options.startup?[]:[{id:name}]]))};},
    zone:async()=>{calls.push(['zone']);return state.guest?'home:owner':state.actionDone?'district:garki':'home:resident';}
  };
  const social={reconcileVisits:async()=>{calls.push(['reconcile']);state.reconcileEntered?.();if(state.reconcileWait)await state.reconcileWait;},visitState:async()=>{calls.push(['visitState']);return{visit:null,requests:[{id:'request'}],visitors:[]};},
    collection:name=>{assert.equal(name,'home_visit_sessions');return{findOne:async query=>{assert.deepEqual(query,{id:'active-visit',guestId:'resident',ownerId:'owner',endedAt:null});return state.visitRow;}};},
    leaveVisit:async()=>{assert.equal(state.guest,true);state.guest=false;state.actionDone=true;calls.push(['leaveVisit']);return{ok:true,profile:{...profile(),location:{kind:'public',district:'garki'}},visit:null};},
    answerVisit:async(id,requestId)=>{if(requestId!=='owned-request')throw new GameError('Visit unavailable',403,'visit_unavailable');calls.push(['answerVisit']);return{ok:true,visit:{guestId:'guest'}};},
    visitView:async(id,row)=>{if(state.visitDenied)throw new GameError('Home visit is unavailable',403,'visit_unavailable');return{id:row.id,ownerHome:{id:'owner',home:{propertyId:'owners-home'},inventory:['sofa'],furnitureLayout:{sofa:{x:.5,y:.5}}}};}
  };
  const admin={isSuspended:async id=>Boolean(id&&state.suspended),status:async()=>({role:null,permissions:[]}),publicSettings:async()=>({registrationOpen:true})};
  const payments={publicConfig:async()=>{calls.push(['payments']);return{enabled:true};}};
  const server=createProductionServer({store,social,directory:{},admin,payments,rewards:{},ads:{},database:{health:async()=>{if(state.healthError)throw new Error('database unavailable');return true;}},corsOrigins:['https://game.example'],publicWebUrl:'https://game.example',log:()=>{}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeRealtime();await new Promise(resolve=>server.close(resolve));});
  const request=async(path,{body,cookie}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:body?'POST':'GET',headers:{origin:'https://game.example',...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}: {})},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};};
  return{calls,token,state,request};
}

test('Production startup auth and boot defer optional joins, preserve secure sessions and leave the full response opt-in default intact',async t=>{
  const f=await fixture(t);
  const anonymous=await f.request('/api/bootstrap?startup=1');
  assert.equal(anonymous.data.authenticated,false);assert.equal(anonymous.data.payments,null);assert.equal(f.calls.length,0);
  for(const route of ['/api/auth/register','/api/auth/login']){
    f.calls.length=0;
    const result=await f.request(route,{body:{username:'resident',password:'unchanged password',startup:true}});
    assert.equal(result.status,route.endsWith('register')?201:200);assert.equal(result.data.startup,true);
    assert.equal(result.data.profile.wallet,100000);assert.equal(result.data.activeChallenge.id,'resume-shift');
    assert.equal(result.data.properties[0].id,'origin-home');assert.ok(result.data.catalog.length);assert.ok(result.data.atlas.length);
    assert.deepEqual(result.data.homeVisitRequests,[]);assert.equal(result.data.homeVisit,null);
    assert.match(result.cookie,/HttpOnly; Secure; SameSite=Lax/);
    assert.deepEqual(f.calls.map(row=>row[0]),[route.endsWith('register')?'register':'login','bootstrap']);
    assert.equal(f.calls[0][1].password,'unchanged password');assert.equal(f.calls[1][1],true);
  }
  f.calls.length=0;
  const boot=await f.request('/api/bootstrap?startup=1',{cookie:`abujalife_session=${f.token}`});
  assert.equal(boot.data.authenticated,true);assert.deepEqual(f.calls,[['bootstrap',true]]);
  f.calls.length=0;
  const full=await f.request('/api/bootstrap',{cookie:`abujalife_session=${f.token}`});
  assert.equal(full.data.startup,undefined);assert.equal(full.data.notifications[0].id,'notifications');
  assert.equal(full.data.payments.enabled,true);assert.equal(full.data.homeVisitRequests[0].id,'request');
  assert.deepEqual(new Set(f.calls.map(row=>row[0])),new Set(['payments','reconcile','bootstrap','visitState','zone']));
});

test('Startup keeps session expiry, storage failures and suspended login distinct',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/api/bootstrap?startup=1',{cookie:'abujalife_session=expired'})).data.authenticated,false);
  assert.equal((await f.request('/api/wallet',{cookie:'abujalife_session=expired'})).status,401);
  f.state.storageError=true;
  assert.equal((await f.request('/api/bootstrap?startup=1')).status,500);
  f.state.storageError=false;f.state.suspended=true;
  const denied=await f.request('/api/auth/login',{body:{username:'resident',password:'password',startup:true}});
  assert.equal(denied.status,403);assert.equal(denied.data.code,'account_suspended');assert.equal(denied.cookie,null);
  assert.equal(f.calls.filter(row=>row[0]==='logout').length,1);
});

test('Readiness probe reflects Mongo dependency failures without exposing internals',async t=>{
  const f=await fixture(t);
  const ready=await f.request('/ready');
  assert.equal(ready.status,200);assert.equal(ready.data.ok,true);assert.equal(ready.data.storage,'mongodb');
  f.state.healthError=true;
  const unavailable=await f.request('/ready');
  assert.equal(unavailable.status,503);assert.deepEqual(unavailable.data,{ok:false,service:'AbujaLife API',storage:'unavailable'});
  assert.equal((await f.request('/health')).status,503);
});

test('Startup guests receive validated owner home data and cannot recover a missing or forbidden visit',async t=>{
  const f=await fixture(t);f.state.guest=true;
  const cookie=`abujalife_session=${f.token}`;
  const missing=await f.request('/api/bootstrap?startup=1',{cookie});
  assert.equal(missing.status,403);assert.equal(missing.data.code,'visit_unavailable');
  f.state.visitRow={id:'active-visit',ownerId:'owner',guestId:'resident',endedAt:null};
  const valid=await f.request('/api/bootstrap?startup=1',{cookie});
  assert.equal(valid.status,200);assert.equal(valid.data.homeVisit.ownerHome.home.propertyId,'owners-home');
  assert.deepEqual(valid.data.homeVisit.ownerHome.inventory,['sofa']);assert.deepEqual(valid.data.homeVisitors,[]);
  f.state.visitDenied=true;
  assert.equal((await f.request('/api/bootstrap?startup=1',{cookie})).status,403);
  assert.equal(f.calls.some(row=>['visitState','payments'].includes(row[0])),false);
});

test('Home onboarding returns committed profile before presence work while privacy updates retain synchronous reconciliation',async t=>{
  const f=await fixture(t),cookie=`abujalife_session=${f.token}`;
  let release;
  f.state.reconcileWait=new Promise(resolve=>{release=resolve;});
  const ready=await f.request('/api/profile',{cookie,body:{startup:true,onboardingComplete:true,appearance:{presentation:'feminine'}}});
  assert.equal(ready.status,200);assert.equal(ready.data.profile.onboardingComplete,true);
  assert.equal(ready.data.profile.wallet,100000);assert.deepEqual(ready.data.profile.inventory,['plant']);
  assert.equal(f.calls.some(row=>row[0]==='reconcile'),true);
  assert.equal(f.calls.some(row=>row[0]==='zone'),false,'Presence must not delay the onboarding response');
  release();await new Promise(resolve=>setImmediate(resolve));
  let entered;
  const privacyEntered=new Promise(resolve=>{entered=resolve;});
  f.state.reconcileEntered=entered;
  f.state.reconcileWait=new Promise(resolve=>{release=resolve;});
  let completed=false;
  const pending=f.request('/api/profile',{cookie,body:{startup:true,onboardingComplete:true,settings:{presenceVisible:false}}}).then(result=>{completed=true;return result;});
  await privacyEntered;assert.equal(completed,false,'Privacy changes must finish reconciliation before returning');
  release();assert.equal((await pending).status,200);
});

test('Committed house exit and visit actions return while presence fan-out waits, retaining reconciliation and authorization',async t=>{
  const f=await fixture(t),cookie=`abujalife_session=${f.token}`;
  for(const [path,body] of [
    ['/api/action',{action:'leave-home',payload:{}}],
    ['/api/home/visits/leave',{}],
    ['/api/home/visits/respond',{requestId:'owned-request',accept:true}]
  ]){
    if(path.endsWith('/leave'))f.state.guest=true;
    let release,entered;
    f.state.broadcastWait=new Promise(resolve=>{release=resolve;});
    const broadcastEntered=new Promise(resolve=>{entered=resolve;});
    f.state.broadcastEntered=entered;
    const before=f.calls.length;
    try{
      const result=await Promise.race([f.request(path,{cookie,body}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Committed action waited for presence fan-out')),1000);timer.unref();})]);
      assert.equal(result.status,200);assert.equal(result.data.ok,true);
      await broadcastEntered;
      if(path==='/api/action'){
        assert.equal(result.data.profile.location.kind,'public');
        const actionCalls=f.calls.slice(before).filter(row=>['reconcile','action'].includes(row[0])).map(row=>row[0]);
        assert.deepEqual(actionCalls,['reconcile','action','reconcile']);
      }
      if(path.endsWith('/leave'))assert.equal(result.data.profile.location.kind,'public');
    }finally{release();f.state.broadcastWait=null;await new Promise(resolve=>setImmediate(resolve));}
  }
  const denied=await f.request('/api/home/visits/respond',{cookie,body:{requestId:'another-residents-request',accept:true}});
  assert.equal(denied.status,403);assert.equal(denied.data.code,'visit_unavailable');
});

test('Verified residents on one network have separate request caps while anonymous and invalid sessions retain the IP cap',async t=>{
  const f=await fixture(t),secondToken='b'.repeat(48);f.state.tokens.set(secondToken,'second-resident');
  for(const token of [f.token,secondToken]){
    for(let i=0;i<360;i++)assert.equal((await f.request('/api/bootstrap?startup=1',{cookie:`abujalife_session=${token}`})).status,200);
    assert.equal((await f.request('/api/bootstrap?startup=1',{cookie:`abujalife_session=${token}`})).status,429);
  }
  for(let i=0;i<360;i++)assert.equal((await f.request('/api/bootstrap?startup=1',i%2?{cookie:'abujalife_session=invalid'}:{})).status,200);
  assert.equal((await f.request('/api/bootstrap?startup=1')).status,429);
  assert.equal((await f.request('/api/bootstrap?startup=1',{cookie:'abujalife_session=invalid'})).status,429);
});

test('Authentication attempts retain their shared-IP abuse limit with verified sessions',async t=>{
  const f=await fixture(t),secondToken='b'.repeat(48);f.state.tokens.set(secondToken,'second-resident');
  for(let i=0;i<12;i++)assert.equal((await f.request('/api/auth/login',{cookie:`abujalife_session=${i%2?secondToken:f.token}`,body:{username:'resident',password:'password',startup:true}})).status,200);
  assert.equal((await f.request('/api/auth/login',{cookie:`abujalife_session=${secondToken}`,body:{username:'resident',password:'password',startup:true}})).status,429);
});

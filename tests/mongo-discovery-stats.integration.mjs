import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {createProductionApplication} from '../src/server/production.mjs';

const config=process.env.TEST_MONGODB_CONFIG?JSON.parse(fs.readFileSync(process.env.TEST_MONGODB_CONFIG,'utf8')):{};
const uri=process.env.TEST_MONGODB_URI||config.uri,database=process.env.TEST_MONGODB_DATABASE||config.database||'abujalife_prod';
test('Mongo discovery claims, atomic visit counters and existing SSE reconcile unique residents and expiry',{
  skip:uri?false:'Requires an isolated authenticated Mongo replica set',timeout:60000,
},async t=>{
  // A private test clock isolates live-lease counts from other concurrent test
  // files. It is never sent to a production server or payment provider.
  let now=Date.parse('2081-10-07T22:59:59Z');
  const origin='https://abujacity.life',app=await createProductionApplication({
    env:{...process.env,NODE_ENV:'production',MONGODB_URI:uri,MONGODB_DATABASE:database,PUBLIC_WEB_URL:origin,API_PUBLIC_URL:'https://api.abujacity.life',CORS_ORIGINS:origin,ABUJALIFE_ADMIN_USERNAME:''},
    clock:()=>now,originRandomInt:(min,max)=>max===2?1:0,log:()=>{},
    fetchImpl:async()=>{throw new Error('No external provider requests in this test');},
  });
  const streams=[],ids=[];
  t.after(async()=>{for(const stream of streams)stream.close();for(const id of ids)await app.presence.disconnect(id);await app.close();});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  async function request(path,account,body){
    const res=await fetch(base+path,{method:body?'POST':'GET',headers:{origin,...(account?{cookie:account.cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
    const value=await res.json();assert.ok(res.ok,`${res.status}: ${value.code}`);
    return{value,cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  async function register(){const registered=await request('/api/auth/register',null,{username:'stats_'+crypto.randomBytes(6).toString('hex'),displayName:'Statistics acceptance',password:'Isolated statistics acceptance password!'});const account={cookie:registered.cookie,id:registered.value.residentId};ids.push(account.id);await request('/api/entry',account);return account;}
  async function stream(account){
    const controller=new AbortController(),events=[];
    const res=await fetch(base+'/api/realtime',{headers:{origin,cookie:account.cookie},signal:controller.signal});assert.equal(res.status,200);
    const reader=res.body.getReader(),decoder=new TextDecoder();let failure;
    void(async()=>{let pending='';try{for(;;){const part=await reader.read();if(part.done)return;pending+=decoder.decode(part.value,{stream:true});for(let end;(end=pending.indexOf('\n\n'))>=0;){const block=pending.slice(0,end);pending=pending.slice(end+2);const type=/^event: (.+)$/m.exec(block)?.[1],data=/^data: (.+)$/m.exec(block)?.[1];if(type&&data)events.push({type,data:JSON.parse(data)});}}}catch(error){if(!controller.signal.aborted)failure=error;}})();
    const result={events,close:()=>controller.abort(),async wait(predicate,timeout=7000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(failure)throw failure;const found=events.find(predicate);if(found)return found;await delay(25);}throw new Error('Authoritative realtime statistics event was not received');}};
    streams.push(result);await result.wait(event=>event.type==='ready');return result;
  }
  const a=await register(),b=await register(),sa=await stream(a),bStreams=[];
  for(let i=0;i<5;i++)bStreams.push(await stream(b));
  await app.store.emitCityStats();
  await sa.wait(e=>e.type==='city-stats'&&e.data.stats.onlineNow===2&&e.data.stats.hereNow===1);
  const action=(account,name,payload={})=>request('/api/action',account,{action:name,payload});
  await action(a,'leave-home');await action(b,'leave-home');sa.events.length=0;await app.store.emitCityStats();
  await sa.wait(e=>e.type==='city-stats'&&e.data.stats.onlineNow===2&&e.data.stats.hereNow===2);
  await action(b,'enter-venue',{venueId:'restaurant'});sa.events.length=0;await app.store.emitCityStats();
  await sa.wait(e=>e.type==='city-stats'&&e.data.stats.onlineNow===2&&e.data.stats.hereNow===1);
  await request('/api/profile',b,{settings:{presenceVisible:false}});sa.events.length=0;await app.store.emitCityStats();
  await sa.wait(e=>e.type==='city-stats'&&e.data.stats.onlineNow===1);
  await request('/api/profile',b,{settings:{presenceVisible:true}});sa.events.length=0;await app.store.emitCityStats();
  await sa.wait(e=>e.type==='city-stats'&&e.data.stats.onlineNow===2);

  const shown=await Promise.all(['venue:jabi-lake','venue:magicland'].map(activityId=>action(a,'discovery-event',{activityId,event:'shown'})));
  assert.equal(shown.filter(result=>!result.value.suppressed).length,1,'one cross-tab suggestion claim');
  const winner=shown[0].value.suppressed?'venue:magicland':'venue:jabi-lake';
  await Promise.all(['clicked','dismissed'].map(event=>action(a,'discovery-event',{activityId:winner,event})));
  const progression=(await app.store.profile(a.id)).discovery;
  assert.equal(progression.entries[winner].shownAt,now);assert.equal(progression.entries[winner].clickedAt,now);assert.equal(progression.entries[winner].dismissedAt,now);
  assert.equal((await action(a,'discovery-event',{activityId:winner,event:'shown'})).value.suppressed,true);

  const session=await app.store.collection('sessions').findOne({residentId:a.id}),token=a.cookie.slice(a.cookie.indexOf('=')+1);
  assert.equal(await app.store.cityStats.recordVisit(token,a.id),false);
  const traffic=await app.store.collection('admin_settings').findOne({_id:'city-traffic'}),before=traffic.visitDays?.['2081-10-08']||0;
  now+=30*60*1000;
  await request('/api/presence/nearby',a);
  assert.equal((await app.store.collection('admin_settings').findOne({_id:'city-traffic'})).visitDays?.['2081-10-08']||0,before,'an idle presence refresh cannot invent a visit');
  const visits=await Promise.all(Array.from({length:8},()=>app.store.cityStats.recordVisit(token,a.id)));
  assert.equal(visits.filter(Boolean).length,1,'concurrent visits commit one rolling-window increment');
  assert.equal((await app.store.collection('admin_settings').findOne({_id:'city-traffic'})).visitDays['2081-10-08'],before+1,'server Lagos date owns the daily counter');
  assert.equal((await app.store.collection('sessions').findOne({_id:session._id})).lastCityVisitAt,now);
  await app.presence.touch(a.id);await app.presence.touch(b.id);await app.store.emitCityStats();
  for(const stream of bStreams)stream.close();
  now+=60000;sa.events.length=0;
  // The existing 20-second SSE heartbeat renews A, observes B's expired REST
  // lease, and broadcasts statistics. No page reload or counter polling.
  await sa.wait(e=>e.type==='city-stats'&&e.data.stats.onlineNow===1&&e.data.stats.hereNow===1,25000);
});

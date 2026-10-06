import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {createProductionApplication} from '../src/server/production.mjs';

const config=process.env.TEST_MONGODB_CONFIG?JSON.parse(fs.readFileSync(process.env.TEST_MONGODB_CONFIG,'utf8')):{};
const uri=process.env.TEST_MONGODB_URI||config.uri,database=process.env.TEST_MONGODB_DATABASE||config.database||'abujalife_prod';
const origin='https://abujacity.life';

test('Real Mongo HTTP peers receive street, venue and consented home poses, including legacy visibility defaults',{
  skip:uri?false:'Requires an authenticated disposable Mongo replica set'
},async t=>{
  const app=await createProductionApplication({
    env:{...process.env,NODE_ENV:'production',MONGODB_URI:uri,MONGODB_DATABASE:database,PUBLIC_WEB_URL:origin,API_PUBLIC_URL:'https://api.abujacity.life',CORS_ORIGINS:origin,ABUJALIFE_ADMIN_USERNAME:''},
    originRandomInt:(min,max)=>max===2?1:0,log:()=>{}
  });
  const streams=[];
  t.after(async()=>{for(const stream of streams)stream.close();await app.close();});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  async function request(path,account,body){
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{origin,...(account?{cookie:account.cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});
    const value=await response.json();assert.ok(response.ok,`${response.status} ${value.code}`);
    return{value,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  async function register(label){
    const result=await request('/api/auth/register',null,{username:`pose_${label}_${crypto.randomBytes(5).toString('hex')}`,displayName:`Presence ${label}`,password:'Disposable presence acceptance password!'});
    assert.equal(typeof result.value.residentId,'string');assert.equal(result.value.profile,undefined);
    const entry=await request('/api/entry',{cookie:result.cookie});
    assert.equal(entry.value.profile.id,result.value.residentId);
    return{id:result.value.residentId,cookie:result.cookie};
  }
  async function stream(account){
    const controller=new AbortController(),events=[];
    const response=await fetch(base+'/api/realtime',{headers:{origin,cookie:account.cookie},signal:controller.signal});
    assert.equal(response.status,200);
    const reader=response.body.getReader(),decoder=new TextDecoder();
    let failure=null;
    const finished=(async()=>{let pending='';try{for(;;){const part=await reader.read();if(part.done)return;pending+=decoder.decode(part.value,{stream:true});for(let end;(end=pending.indexOf('\n\n'))>=0;){const block=pending.slice(0,end);pending=pending.slice(end+2);const type=/^event: (.+)$/m.exec(block)?.[1],data=/^data: (.+)$/m.exec(block)?.[1];if(type&&data)events.push({type,data:JSON.parse(data)});}}}catch(error){if(!controller.signal.aborted)failure=error;}})();
    const result={events,close:()=>controller.abort(),async wait(predicate){for(let i=0;i<160;i++){if(failure)throw failure;const found=events.find(predicate);if(found)return found;await delay(25);}throw new Error('Expected real resident event was not received');},finished};
    streams.push(result);await result.wait(event=>event.type==='ready');return result;
  }
  const [a,b]=await Promise.all([register('a'),register('b')]);
  const [streamA,streamB]=await Promise.all([stream(a),stream(b)]);
  const action=(account,name,payload={})=>request('/api/action',account,{action:name,payload});
  const nearby=async account=>(await request('/api/presence/nearby',account)).value.nearby;
  const pose=(account,x,activity='walk')=>request('/api/presence',account,{pose:{x,y:800,angle:0,moving:activity==='walk',driving:false,activity}});
  assert.equal((await nearby(a)).some(person=>person.id===b.id),false,'Distinct homes must remain private');
  await action(a,'leave-home');await action(b,'leave-home');
  await streamA.wait(event=>event.type==='presence'&&event.data.resident.id===b.id&&event.data.resident.location?.kind==='public');
  assert.ok((await nearby(a)).some(person=>person.id===b.id));
  // An older resident may have a settings object without this newer flag.
  await app.store.collection('residents').updateOne({id:b.id},{$unset:{'settings.presenceVisible':''}});
  await pose(b,501);
  const street=await streamA.wait(event=>event.type==='world-pose'&&event.data.residentId===b.id&&event.data.pose.x===501);
  assert.equal(street.data.zone,`district:${(await app.store.profile(a.id)).district}`);
  assert.equal((await nearby(a)).find(person=>person.id===b.id).pose.x,501);
  await action(a,'enter-venue',{venueId:'restaurant'});await action(b,'enter-venue',{venueId:'restaurant'});
  await streamA.wait(event=>event.type==='presence'&&event.data.resident.id===b.id&&event.data.resident.location?.kind==='venue');
  assert.ok((await nearby(a)).some(person=>person.id===b.id&&person.location.kind==='venue'));
  await pose(b,650,'eat');
  const meal=await streamA.wait(event=>event.type==='world-pose'&&event.data.residentId===b.id&&event.data.pose.x===650);
  assert.equal(meal.data.pose.activity,'eat');assert.match(meal.data.zone,/^venue:.*:restaurant$/);
  await request('/api/profile',b,{settings:{presenceVisible:false}});
  assert.equal((await nearby(a)).some(person=>person.id===b.id),false);
  await pose(b,777,'eat');await delay(150);
  assert.equal(streamA.events.some(event=>event.type==='world-pose'&&event.data.residentId===b.id&&event.data.pose.x===777),false,'A hidden resident must not broadcast movement');
  await request('/api/profile',b,{settings:{presenceVisible:true}});
  await action(a,'exit-venue');await action(a,'enter-home');await action(b,'exit-venue');
  const visitRequest=(await request('/api/home/visits/request',b,{ownerId:a.id,idempotencyKey:crypto.randomUUID()})).value.request;
  await request('/api/home/visits/respond',a,{requestId:visitRequest.id,accept:true});
  await streamA.wait(event=>event.type==='presence'&&event.data.resident.id===b.id&&event.data.resident.location?.kind==='visit');
  const startup=(await request('/api/bootstrap?startup=1',b)).value;
  assert.equal(startup.homeVisit.ownerHome.id,a.id);
  assert.ok((await nearby(a)).some(person=>person.id===b.id));
  assert.ok((await nearby(b)).some(person=>person.id===a.id));
  await pose(a,550,'rest');await pose(b,590,'social');
  const guestMotion=await streamA.wait(event=>event.type==='world-pose'&&event.data.residentId===b.id&&event.data.pose.x===590);
  assert.equal(guestMotion.data.zone,`home:${a.id}`);
  await streamB.wait(event=>event.type==='world-pose'&&event.data.residentId===a.id&&event.data.pose.x===550);
  await request('/api/chat/location',a,{text:'Welcome to our shared home scene'});
  const homeChat=await streamB.wait(event=>event.type==='location-chat'&&event.data?.text==='Welcome to our shared home scene');
  assert.equal(homeChat.data.senderId,a.id);
  assert.equal(homeChat.data.zone,`home:${a.id}`);
  await request('/api/moderation/block',a,{residentId:b.id,blocked:true});
  assert.equal((await nearby(a)).some(person=>person.id===b.id),false);
  assert.equal((await nearby(b)).some(person=>person.id===a.id),false);
  assert.equal((await app.store.profile(b.id)).location.kind,'public');
});

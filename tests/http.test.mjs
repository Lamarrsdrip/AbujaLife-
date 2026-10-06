import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createServer } from '../src/server/http.mjs';

async function start(dataDir) {
  const server=createServer({dataDir,clock:()=>Date.parse('2026-10-05T10:00:00Z'),originRandomInt:(min,max)=>max===2?1:0});server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}`;
  const request=async(route,{cookie,body,headers={},method=body===undefined?'GET':'POST'}={})=>{
    const response=await fetch(url+route,{method,headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json();return{status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  return{server,url,request,close:async()=>{server.closeRealtime();server.close();await once(server,'close');}};
}

async function register(request,username) {
  const result=await request('/api/auth/register',{body:{username,displayName:username==='ada'?'Ada':'Bello',password:'test-password-123'}});
  assert.equal(result.status,201);assert.ok(result.cookie);assert.equal(typeof result.data.residentId,'string');assert.equal('profile' in result.data,false);
  const entry=await request('/api/entry',{cookie:result.cookie});
  assert.equal(entry.status,200);assert.equal(entry.data.profile.id,result.data.residentId);
  return{cookie:result.cookie,id:entry.data.profile.id,startingWallet:entry.data.profile.wallet};
}

test('two real residents persist friendship, messages, unread state and purchases after restart',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-http-'));let app=await start(dataDir);
  t.after(async()=>{if(app)await app.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const guest=await app.request('/api/bootstrap');assert.equal(guest.data.authenticated,false);assert.equal(guest.data.profile,undefined);
  const ada=await register(app.request,'ada'),bello=await register(app.request,'bello');
  let state=await app.request('/api/bootstrap',{cookie:ada.cookie});assert.equal(state.data.people.length,1);assert.equal(state.data.people[0].id,bello.id);assert.equal(state.data.people[0].online,false);
  await app.request('/api/friends/request',{cookie:ada.cookie,body:{residentId:bello.id}});
  const incoming=(await app.request('/api/bootstrap',{cookie:bello.cookie})).data.friendRequests[0];assert.equal(incoming.from,ada.id);
  const accepted=await app.request('/api/friends/respond',{cookie:bello.cookie,body:{requestId:incoming.id,accept:true}});assert.equal(accepted.data.friends[0].id,ada.id);
  const conversation=(await app.request('/api/conversations',{cookie:ada.cookie,body:{residentId:bello.id}})).data.conversation;
  const sent=await app.request(`/api/conversations/${conversation.id}/messages`,{cookie:ada.cookie,body:{text:'Meet at Jabi after work?'}});assert.equal(sent.status,201);
  state=await app.request('/api/bootstrap',{cookie:bello.cookie});assert.equal(state.data.conversations[0].unread,1);assert.ok(state.data.notifications.some(n=>n.kind==='message'&&!n.readAt));
  const thread=await app.request(`/api/conversations/${conversation.id}/messages`,{cookie:bello.cookie});assert.equal(thread.data.messages[0].text,'Meet at Jabi after work?');assert.ok(thread.data.messages[0].readBy.includes(bello.id));
  state=await app.request('/api/bootstrap',{cookie:bello.cookie});assert.equal(state.data.conversations[0].unread,0);assert.ok(state.data.notifications.filter(n=>n.kind==='message').every(n=>n.readAt));
  const purchase=await app.request('/api/action',{cookie:ada.cookie,body:{action:'purchase',payload:{itemId:'plant',price:1}}});assert.equal(purchase.data.profile.wallet,ada.startingWallet-2300);
  await app.close();app=await start(dataDir);
  state=await app.request('/api/bootstrap',{cookie:ada.cookie});assert.equal(state.data.authenticated,true);assert.equal(state.data.profile.wallet,ada.startingWallet-2300);assert.deepEqual(state.data.profile.inventory,['plant']);assert.equal(state.data.friends[0].id,bello.id);
  assert.equal((await app.request(`/api/conversations/${conversation.id}/messages`,{cookie:bello.cookie})).data.messages.length,1);
  const badLogin=await app.request('/api/auth/login',{body:{username:'ada',password:'wrong-password'}});assert.equal(badLogin.status,401);
  const login=await app.request('/api/auth/login',{body:{username:'ada',password:'test-password-123'}});assert.equal(login.data.residentId,ada.id);assert.equal((await app.request('/api/entry',{cookie:login.cookie})).data.profile.id,ada.id);
  await app.request('/api/auth/logout',{cookie:login.cookie,body:{}});assert.equal((await app.request('/api/bootstrap',{cookie:login.cookie})).data.authenticated,false);
});

test('HTTP enforces authentication, same origin, membership and block privacy',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-auth-')),app=await start(dataDir);t.after(async()=>{await app.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  assert.equal((await app.request('/api/action',{body:{action:'sleep'}})).status,401);
  const ada=await register(app.request,'ada'),bello=await register(app.request,'bello'),third=await register(app.request,'third');
  assert.equal((await app.request('/api/action',{cookie:ada.cookie,body:{action:'sleep'},headers:{origin:'https://evil.example'}})).status,403);
  const conversation=(await app.request('/api/conversations',{cookie:ada.cookie,body:{residentId:bello.id}})).data.conversation;
  assert.equal((await app.request(`/api/conversations/${conversation.id}/messages`,{cookie:third.cookie})).status,404);
  await app.request('/api/moderation/block',{cookie:bello.cookie,body:{residentId:ada.id,blocked:true}});
  assert.equal((await app.request(`/api/conversations/${conversation.id}/messages`,{cookie:ada.cookie,body:{text:'Blocked'}})).status,403);
  assert.equal((await app.request('/api/invitations',{cookie:ada.cookie,body:{residentId:bello.id,kind:'home'}})).status,403);
  const state=(await app.request('/api/bootstrap',{cookie:ada.cookie})).data;assert.ok(state.people.every(p=>p.id!==bello.id));assert.equal(state.conversations.length,0);
  assert.equal((await app.request('/api/action',{cookie:ada.cookie,body:{action:'topup',payload:{verified:true,amount:50000}}})).status,403);
  const demo=await app.request('/api/wallet/topup',{cookie:ada.cookie,body:{amount:10000,idempotencyKey:'default_demo_disabled'}});assert.equal(demo.status,403);assert.equal(demo.data.code,'provider_required');assert.equal((await app.request('/api/bootstrap',{cookie:ada.cookie})).data.profile.wallet,ada.startingWallet);
  const response=await fetch(app.url+'/src/shared/atlas.mjs');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
});

test('SSE presence and nearby chat are real, location scoped and privacy aware',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-realtime-')),app=await start(dataDir);const controllers=[];t.after(async()=>{controllers.forEach(c=>c.abort());await app.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const ada=await register(app.request,'ada'),bello=await register(app.request,'bello');
  for(const person of [ada,bello])await app.request('/api/action',{cookie:person.cookie,body:{action:'leave-home'}});
  const controller=new AbortController();controllers.push(controller);const response=await fetch(app.url+'/api/realtime',{headers:{cookie:bello.cookie},signal:controller.signal});assert.equal(response.status,200);const reader=response.body.getReader();let buffer='';
  const waitEvent=async event=>{const deadline=setTimeout(()=>controller.abort(),3000);try{while(!buffer.includes(`event: ${event}\n`)){const {value,done}=await reader.read();assert.ok(!done);buffer+=new TextDecoder().decode(value);}const index=buffer.indexOf(`event: ${event}\n`),end=buffer.indexOf('\n\n',index);if(end===-1){const {value}=await reader.read();buffer+=new TextDecoder().decode(value);}const chunk=buffer.slice(index,buffer.indexOf('\n\n',index));buffer=buffer.slice(buffer.indexOf('\n\n',index)+2);return JSON.parse(chunk.split('\ndata: ')[1]);}finally{clearTimeout(deadline);}};
  await waitEvent('ready');let state=(await app.request('/api/bootstrap',{cookie:ada.cookie})).data;assert.equal(state.nearby[0].id,bello.id);assert.equal(state.nearby[0].online,true);
  await app.request('/api/chat/location',{cookie:ada.cookie,body:{text:'Hello Garki'}});assert.equal((await waitEvent('location-chat')).text,'Hello Garki');
  const history=(await app.request('/api/chat/location',{cookie:bello.cookie})).data;assert.equal(history.messages.length,1);
  await app.request('/api/profile',{cookie:bello.cookie,body:{settings:{presenceVisible:false}}});state=(await app.request('/api/bootstrap',{cookie:ada.cookie})).data;assert.equal(state.nearby.length,0);assert.equal(state.people[0].online,false);assert.equal(state.people[0].district,null);
  await app.request('/api/action',{cookie:bello.cookie,body:{action:'enter-home'}});assert.equal((await app.request('/api/chat/location',{cookie:bello.cookie})).data.messages.length,0);
});

test('city shell endpoints match the production contract used before and after sign-in',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-shell-')),app=await start(dataDir);t.after(async()=>{await app.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const config=await app.request('/api/auth/config');
  assert.equal(config.status,200);assert.equal(config.data.ok,true);assert.equal(config.data.emailVerificationEnabled,false);assert.equal(config.data.passwordResetEnabled,false);
  const ads=await app.request('/api/ads/world?zoom=1&limit=96');
  assert.equal(ads.status,200);assert.deepEqual(ads.data.spaces,[]);assert.deepEqual(ads.data.active,[]);
  assert.equal((await app.request('/api/presence/nearby')).status,401);
  const ada=await register(app.request,'ada');
  const nearby=await app.request('/api/presence/nearby',{cookie:ada.cookie});
  assert.equal(nearby.status,200);assert.deepEqual(nearby.data.nearby,[]);assert.equal(nearby.data.stats.onlineNow,1);assert.equal(nearby.data.stats.hereNow,1);assert.equal(typeof nearby.data.serverTime,'number');
  assert.equal((await app.request('/api/auth/config',{cookie:ada.cookie})).status,200);
  assert.equal((await app.request('/api/ads/world',{cookie:ada.cookie})).status,200);
});

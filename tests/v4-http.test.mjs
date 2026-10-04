import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { deflateSync } from 'node:zlib';
import { GameStore } from '../src/server/gameStore.mjs';
import { createServer } from '../src/server/http.mjs';

const PASSWORD='Disposable HTTP fixture password!';
const TEST_KEY='FLWSECK_TEST-http-fixture-000000000000000000';
const SIGNING_KEY='http-fixture-webhook-signing-secret';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-v4-http-'));
  let time=Date.parse('2026-10-07T20:30:00Z');
  const store=new GameStore({dataDir:dir,clock:()=>time,originRandomInt:(min,max)=>max===2?1:0});
  // Initial administrator is explicitly bound on the trusted server console to
  // an existing real resident; every subsequent account uses the actual HTTP API.
  const ownerSession=await store.register({username:'v4_owner',displayName:'Owner V4',password:PASSWORD});
  const calls=[],transactions=new Map();
  const paymentFetch=async(url,options)=>{calls.push({url,method:options.method||'GET'});if(url.endsWith('/v3/payments'))return{ok:true,json:async()=>({status:'success',data:{link:'https://checkout.flutterwave.com/v3/hosted/pay/http-fixture'}})};const id=url.match(/transactions\/(\d+)\/verify/)?.[1];return{ok:true,json:async()=>({status:'success',data:transactions.get(id)||{id:Number(id),status:'pending'}})};};
  const server=createServer({store,adminUsername:'v4_owner',configKey:crypto.randomBytes(32).toString('hex'),publicOrigin:'https://abujalife.test',paymentFetch});
  server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  const controllers=[];
  const request=async(route,{cookie,body,raw,headers={},method=body===undefined&&raw===undefined?'GET':'POST'}={})=>{const response=await fetch(base+route,{method,redirect:'manual',headers:{...(cookie?{cookie}:{}),...(body===undefined&&raw===undefined?{}:{'content-type':'application/json'}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:raw!==undefined?{body:raw}:{})});const contentType=response.headers.get('content-type')||'',data=contentType.includes('json')?await response.json():await response.text();return{status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};};
  const login=async username=>{const result=await request('/api/auth/login',{body:{username,password:PASSWORD}});assert.equal(result.status,200);return{cookie:result.cookie,id:result.data.profile.id,profile:result.data.profile};};
  const register=async username=>{const result=await request('/api/auth/register',{body:{username,displayName:username,password:PASSWORD}});assert.equal(result.status,201);return{cookie:result.cookie,id:result.data.profile.id,profile:result.data.profile};};
  const owner=await login('v4_owner'),a=await register('v4_ada'),b=await register('v4_bello'),c=await register('v4_chika');
  assert.equal(owner.id,ownerSession.residentId);
  const action=(person,name,payload={})=>request('/api/action',{cookie:person.cookie,body:{action:name,payload}});
  const bootstrap=async person=>(await request('/api/bootstrap',{cookie:person.cookie})).data;
  const stream=async person=>{const controller=new AbortController();controllers.push(controller);const response=await fetch(base+'/api/realtime',{headers:{cookie:person.cookie},signal:controller.signal});assert.equal(response.status,200);const events=[],reader=response.body.getReader();let buffer='';const pump=(async()=>{try{for(;;){const{value,done}=await reader.read();if(done)break;buffer+=new TextDecoder().decode(value);let split;while((split=buffer.indexOf('\n\n'))!==-1){const packet=buffer.slice(0,split);buffer=buffer.slice(split+2);const type=packet.match(/^event: (.+)$/m)?.[1],data=packet.match(/^data: (.+)$/m)?.[1];if(type&&data)events.push({type,data:JSON.parse(data)});}}}catch(error){if(!controller.signal.aborted)throw error;}})();const wait=async(type,predicate=()=>true)=>{for(let i=0;i<150;i++){const event=events.find(row=>row.type===type&&predicate(row.data));if(event)return event.data;await pause(10);}throw new Error(`Actual SSE event ${type} did not arrive`);};await wait('ready');return{events,wait,close:()=>controller.abort(),pump};};
  t.after(async()=>{controllers.forEach(controller=>controller.abort());server.closeRealtime();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});});
  return{server,store,base,request,register,login,owner,a,b,c,action,bootstrap,stream,calls,transactions,advance:ms=>time+=ms};
}

function actualPng() {
  const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  const crc=bytes=>{let n=0xffffffff;for(const byte of bytes)n=crcTable[(n^byte)&255]^(n>>>8);return(n^0xffffffff)>>>0;};
  const chunk=(type,data)=>{const named=Buffer.concat([Buffer.from(type),data]),result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);named.copy(result,4);result.writeUInt32BE(crc(named),data.length+8);return result;};
  const width=128,height=128,header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const pixels=crypto.randomBytes((width*4+1)*height);for(let row=0;row<height;row++)pixels[row*(width*4+1)]=0;
  const image=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
  assert.ok(image.length>65536&&image.length<524288);
  return'data:image/png;base64,'+image.toString('base64');
}

test('full HTTP server denies free funds by default and never accepts a client payment assertion',async t=>{
  const f=await fixture(t),before=await f.bootstrap(f.a);
  for(const path of ['/api/wallet/topup','/api/action']){const body=path.endsWith('topup')?{amount:10000,idempotencyKey:'v4_free_funds_1'}:{action:'demo-topup',payload:{amount:10000,idempotencyKey:'v4_free_funds_2'}};const result=await f.request(path,{cookie:f.a.cookie,body});assert.equal(result.status,403);assert.equal(result.data.code,'provider_required');assert.equal(result.headers.get('cache-control'),'no-store');}
  const forged=await f.request('/api/payments/verify',{cookie:f.a.cookie,body:{verified:true,amount:999999,transactionId:'123'}});assert.notEqual(forged.status,200);
  assert.equal((await f.bootstrap(f.a)).profile.wallet,before.profile.wallet);assert.equal(f.calls.length,0);
  assert.equal((await f.request('/api/payments/config')).data.enabled,false);
});

test('real HTTP social posts accept a valid raster above 64 KiB, persist interactions, expire statuses and respect blocks',async t=>{
  const f=await fixture(t),imageDataUrl=actualPng(),input={text:'A real uploaded image in the full game',imageDataUrl,idempotencyKey:'v4_post_large_png_1'};
  const posted=await f.request('/api/social/posts',{cookie:f.a.cookie,body:input});assert.equal(posted.status,201);assert.equal(posted.data.post.imageDataUrl,imageDataUrl);const post=posted.data.post;
  const replay=await f.request('/api/social/posts',{cookie:f.a.cookie,body:input});assert.equal(replay.data.replayed,true);assert.equal(replay.data.post.id,post.id);
  assert.equal((await f.request(`/api/social/posts/${post.id}/like`,{cookie:f.b.cookie,body:{}})).data.post.likes,1);
  const reply=await f.request(`/api/social/posts/${post.id}/comments`,{cookie:f.b.cookie,body:{text:'Real saved reply',idempotencyKey:'v4_real_reply_1'}});assert.equal(reply.status,201);
  assert.equal((await f.request(`/api/social/posts/${post.id}/comments`,{cookie:f.a.cookie})).data.comments[0].text,'Real saved reply');
  const status=await f.request('/api/social/posts',{cookie:f.a.cookie,body:{kind:'status',text:'Today only',expiresAt:9999999999999,idempotencyKey:'v4_real_status_1'}});assert.equal(status.status,201);assert.equal(status.data.post.expiresAt-status.data.post.createdAt,86400000);
  assert.equal((await f.request('/api/social/statuses',{cookie:f.b.cookie})).data.statuses.length,1);
  const blocked=await f.request('/api/moderation/block',{cookie:f.b.cookie,body:{residentId:f.a.id,blocked:true}});assert.equal(blocked.status,200);
  assert.equal((await f.request('/api/social/feed',{cookie:f.b.cookie})).data.posts.length,0);
  assert.equal((await f.request(`/api/social/posts/${post.id}/comments`,{cookie:f.a.cookie})).data.comments.length,0);
  assert.equal((await f.request(`/api/social/posts/${post.id}/like`,{cookie:f.b.cookie,body:{}})).status,404);
  await f.request('/api/moderation/block',{cookie:f.b.cookie,body:{residentId:f.a.id,blocked:false}});f.advance(86400000);
  assert.equal((await f.request('/api/social/statuses',{cookie:f.b.cookie})).data.statuses.length,0);
  assert.equal((await f.request('/api/social/feed',{cookie:f.c.cookie})).data.posts[0].id,post.id);
});

test('administrator HTTP page routes and mutation aliases enforce roles, suspend login, redact secrets and preserve audits',async t=>{
  const f=await fixture(t),adminCookie=f.owner.cookie;
  assert.equal((await f.request('/admin')).status,303);assert.match((await f.request('/admin.html')).data,/AbujaLife · Operations/);
  for(const route of ['/api/admin/overview','/api/admin/residents','/api/admin/reports','/api/admin/audit','/api/admin/settings','/api/admin/payments/config','/api/admin/payments']){assert.equal((await f.request(route,{cookie:adminCookie})).status,200,route);assert.equal((await f.request(route,{cookie:f.a.cookie})).status,403,route);}
  const plain=await f.request('/api/admin/status',{cookie:f.a.cookie});assert.equal(plain.data.role,null);
  for(const route of [`/api/admin/resident?residentId=${f.a.id}`,`/api/admin/residents/${f.a.id}`])assert.equal((await f.request(route,{cookie:adminCookie})).data.resident.id,f.a.id);
  const before=(await f.bootstrap(f.a)).profile.wallet;
  for(const[index,route]of['/api/admin/wallet','/api/admin/wallet/adjust'].entries()){const result=await f.request(route,{cookie:adminCookie,body:{residentId:f.a.id,amount:500,reason:'Approved actual HTTP fixture adjustment',idempotencyKey:'v4_wallet_alias_'+index}});assert.equal(result.status,200);}
  assert.equal((await f.bootstrap(f.a)).profile.wallet,before+1000);
  assert.equal((await f.request('/api/admin/roles',{cookie:adminCookie,body:{residentId:f.c.id,role:'moderator'}})).status,200);
  assert.equal((await f.request('/api/admin/payments/config',{cookie:f.c.cookie})).status,403);
  assert.equal((await f.request('/api/admin/suspension',{cookie:adminCookie,body:{residentId:f.a.id,suspended:true,reason:'HTTP moderation fixture suspension'}})).status,200);
  assert.equal((await f.bootstrap(f.a)).authenticated,false);
  const denied=await f.request('/api/auth/login',{body:{username:'v4_ada',password:PASSWORD}});assert.equal(denied.status,403);assert.equal(denied.data.code,'account_suspended');assert.equal(denied.cookie,undefined);
  assert.equal((await f.request('/api/admin/residents/suspend',{cookie:adminCookie,body:{residentId:f.a.id,suspended:false,reason:'HTTP review restores fixture resident'}})).status,200);
  assert.equal((await f.bootstrap(f.a)).authenticated,false);const restored=await f.login('v4_ada');assert.equal(restored.id,f.a.id);
  const report=await f.request('/api/moderation/report',{cookie:f.b.cookie,body:{residentId:f.a.id,reason:'Actual resident HTTP report fixture'}});
  for(const route of ['/api/admin/reports','/api/admin/reports/review'])assert.equal((await f.request(route,{cookie:adminCookie,body:{reportId:report.data.reportId,status:'resolved',note:'Reviewed the original HTTP report'}})).status,200);
  const post=await f.request('/api/social/posts',{cookie:f.b.cookie,body:{text:'Actual post for administrator moderation',idempotencyKey:'v4_admin_moderation_1'}});
  const second=await f.request('/api/social/posts',{cookie:f.b.cookie,body:{text:'Second actual moderation post',idempotencyKey:'v4_admin_moderation_2'}});
  for(const[route,postId]of[['/api/admin/social/delete',post.data.post.id],[`/api/admin/social/posts/${second.data.post.id}/delete`,second.data.post.id]])assert.equal((await f.request(route,{cookie:adminCookie,body:{postId,reason:'Recorded HTTP moderation decision'}})).status,200);
  const removed=await f.request('/api/admin/social/posts?includeDeleted=true&limit=20',{cookie:adminCookie});assert.equal(removed.status,200);assert.equal(removed.data.posts.length,2);assert.ok(removed.data.posts.every(row=>row.deletedBy===f.owner.id));
  assert.equal((await f.request('/api/admin/social/posts',{cookie:adminCookie})).status,200);
  const audit=await f.request('/api/admin/audit',{cookie:adminCookie});assert.ok(audit.data.audit.some(row=>row.action==='adjust-wallet'));
});

test('approved home visits expose the owner layout read-only, leave safely and reconcile privacy changes',async t=>{
  const f=await fixture(t);
  assert.equal((await f.action(f.a,'purchase',{itemId:'plant'})).status,200);
  assert.equal((await f.action(f.a,'place-furniture',{itemId:'plant',x:.5,y:.5,rotation:90})).status,200);
  assert.equal((await f.action(f.a,'design-home',{roomStyle:{wall:'sage',floor:'tile',partitions:[]}})).status,200);
  assert.equal((await f.action(f.b,'leave-home')).status,200);
  const requestBody={ownerId:f.a.id,note:'Can I visit your actual home?',idempotencyKey:'v4_home_request_1'};
  const pending=await f.request('/api/home/visits/request',{cookie:f.b.cookie,body:requestBody});assert.equal(pending.status,201);
  assert.equal((await f.bootstrap(f.b)).profile.location.kind,'public');
  assert.equal((await f.request('/api/home/visits/respond',{cookie:f.c.cookie,body:{requestId:pending.data.request.id,accept:true}})).status,404);
  const approved=await f.request('/api/home/visits/respond',{cookie:f.a.cookie,body:{requestId:pending.data.request.id,accept:true}});assert.equal(approved.status,200);
  const ownerBefore=await f.bootstrap(f.a),guestBefore=await f.bootstrap(f.b);
  assert.equal(guestBefore.profile.location.kind,'visit');assert.equal(guestBefore.homeVisit.ownerId,f.a.id);assert.deepEqual(guestBefore.homeVisit.ownerHome.furnitureLayout,ownerBefore.profile.furnitureLayout);assert.equal(guestBefore.homeVisit.ownerHome.home.roomStyle.wall,'sage');assert.equal(Object.hasOwn(guestBefore.homeVisit.ownerHome,'wallet'),false);
  for(const action of ['sleep','eat','shower','relax','place-furniture','store-furniture','design-home'])assert.equal((await f.action(f.b,action,{itemId:'plant',x:.4,y:.4,roomStyle:{wall:'clay',floor:'oak',partitions:[]}})).status,400,action);
  assert.equal((await f.bootstrap(f.b)).profile.wallet,guestBefore.profile.wallet);assert.deepEqual((await f.bootstrap(f.a)).profile.furnitureLayout,ownerBefore.profile.furnitureLayout);
  assert.equal((await f.request('/api/home/visits/leave',{cookie:f.b.cookie,body:{}})).data.profile.location.kind,'public');assert.equal((await f.request('/api/home/visits/leave',{cookie:f.b.cookie,body:{}})).data.replayed,true);
  const next=await f.request('/api/home/visits/request',{cookie:f.b.cookie,body:{...requestBody,idempotencyKey:'v4_home_request_2'}});await f.request('/api/home/visits/respond',{cookie:f.a.cookie,body:{requestId:next.data.request.id,accept:true}});
  await f.request('/api/profile',{cookie:f.a.cookie,body:{settings:{allowHomeVisits:false}}});
  const ended=await f.bootstrap(f.b);assert.equal(ended.profile.location.kind,'public');assert.equal(ended.homeVisit,null);
  assert.equal((await f.request('/api/home/visits/request',{cookie:f.b.cookie,body:{...requestBody,idempotencyKey:'v4_home_request_3'}})).status,403);
});

test('resident HTTP directory pages and FTS search return actual IDs without duplicates and honor blocks',async t=>{
  const f=await fixture(t),first=await f.request('/api/residents?limit=2',{cookie:f.a.cookie});assert.equal(first.status,200);assert.equal(first.data.people.length,2);assert.ok(first.data.nextCursor);
  const second=await f.request('/api/residents?limit=2&cursor='+encodeURIComponent(first.data.nextCursor),{cookie:f.a.cookie});assert.equal(second.status,200);assert.equal(second.data.people.length,1);
  const all=[...first.data.people,...second.data.people];assert.equal(new Set(all.map(person=>person.id)).size,3);assert.ok(all.every(person=>person.id!==f.a.id));
  const result=await f.request('/api/residents?q=bello&limit=40',{cookie:f.a.cookie});assert.deepEqual(result.data.people.map(person=>person.id),[f.b.id]);
  await f.request('/api/moderation/block',{cookie:f.a.cookie,body:{residentId:f.b.id,blocked:true}});assert.equal((await f.request('/api/residents?q=bello&limit=40',{cookie:f.a.cookie})).data.people.length,0);
  assert.equal((await f.request('/api/residents?cursor=invented',{cookie:f.a.cookie})).status,400);
  assert.equal((await f.request('/api/residents')).status,401);
});

test('real SSE carries same-zone movement and venue chat without leaking to other rooms or hidden residents',async t=>{
  const f=await fixture(t);for(const person of [f.a,f.b,f.c])assert.equal((await f.action(person,'leave-home')).status,200);
  await f.stream(f.a); // A real active connection puts the sender in the online zone index.
  const street=await f.stream(f.b),other=await f.stream(f.c);await f.action(f.c,'enter-venue',{venueId:'church'});
  const pose={x:640,y:850,angle:45,moving:true,driving:false};assert.equal((await f.request('/api/presence',{cookie:f.a.cookie,body:{pose}})).status,200);
  const observed=await street.wait('world-pose',row=>row.residentId===f.a.id);assert.deepEqual(observed.pose,pose);await pause(100);assert.ok(!other.events.some(row=>row.type==='world-pose'&&row.data.residentId===f.a.id));
  assert.equal((await f.bootstrap(f.b)).nearby.find(person=>person.id===f.a.id)?.pose.x,640);
  await f.action(f.a,'enter-venue',{venueId:'mosque'});await f.action(f.b,'enter-venue',{venueId:'mosque'});
  const sent=await f.request('/api/chat/location',{cookie:f.a.cookie,body:{text:'Actual scoped mosque chat'}});assert.equal(sent.status,200);
  assert.equal((await street.wait('location-chat',row=>row.text==='Actual scoped mosque chat')).zone,`venue:${f.a.profile.district}:mosque`);
  await pause(100);assert.ok(!other.events.some(row=>row.type==='location-chat'&&row.data.text==='Actual scoped mosque chat'));
  await f.request('/api/profile',{cookie:f.a.cookie,body:{settings:{presenceVisible:false}}});const count=street.events.filter(row=>row.type==='world-pose').length;
  await f.request('/api/presence',{cookie:f.a.cookie,body:{pose:{...pose,x:800}}});await pause(100);assert.equal(street.events.filter(row=>row.type==='world-pose').length,count);
  assert.equal((await f.request('/api/presence',{cookie:f.a.cookie,body:{pose:{...pose,x:NaN}}})).status,400);
});

test('revoking an approved home visit removes the guest from the private home SSE zone immediately',async t=>{
  const f=await fixture(t);await f.action(f.b,'leave-home');const requested=await f.request('/api/home/visits/request',{cookie:f.b.cookie,body:{ownerId:f.a.id,idempotencyKey:'v4_revoke_sse_1'}});await f.request('/api/home/visits/respond',{cookie:f.a.cookie,body:{requestId:requested.data.request.id,accept:true}});
  const guest=await f.stream(f.b);await f.request('/api/chat/location',{cookie:f.a.cookie,body:{text:'Welcome actual guest'}});await guest.wait('location-chat',row=>row.text==='Welcome actual guest');
  await f.request('/api/profile',{cookie:f.a.cookie,body:{settings:{allowHomeVisits:false}}});await guest.wait('home-visit-ended');
  await f.request('/api/chat/location',{cookie:f.a.cookie,body:{text:'Private after visit revoked'}});await pause(150);
  assert.ok(!guest.events.some(row=>row.type==='location-chat'&&row.data.text==='Private after visit revoked'),'Revoked guest retained an SSE subscription to the private home');
  assert.equal((await f.bootstrap(f.b)).profile.location.kind,'public');
});

test('HTTP Flutterwave fixture credits only verified matching transactions and handles signed webhook retries atomically',async t=>{
  const f=await fixture(t),adminCookie=f.owner.cookie;
  const saved=await f.request('/api/admin/payments/config',{cookie:adminCookie,body:{mode:'test',enabled:true,activate:true,creditRate:5,publicOrigin:'https://abujalife.test',secretKey:TEST_KEY,webhookSecret:SIGNING_KEY}});assert.equal(saved.status,200);assert.ok(!JSON.stringify(saved.data).includes(TEST_KEY));assert.ok(!JSON.stringify(saved.data).includes(SIGNING_KEY));
  assert.equal((await f.request('/api/payments/config')).data.enabled,true);assert.equal((await f.request('/api/payments/config')).data.creditRate,5);
  const before=(await f.bootstrap(f.b)).profile.wallet,created=await f.request('/api/payments/checkout',{cookie:f.b.cookie,body:{amount:5000,email:'http-fixture@example.test',idempotencyKey:'v4_provider_checkout_1'}});assert.equal(created.status,200);const order=created.data.checkout;assert.equal(order.credits,25000);assert.equal((await f.bootstrap(f.b)).profile.wallet,before);
  assert.equal((await f.request('/api/payments/status?txRef='+order.txRef,{cookie:f.a.cookie})).status,404);assert.equal((await f.request('/api/payments/status?txRef='+order.txRef,{cookie:f.b.cookie})).data.payment.status,'pending');
  f.transactions.set('501',{id:501,tx_ref:order.txRef,amount:1,currency:'NGN',status:'successful'});
  assert.equal((await f.request('/api/payments/verify',{cookie:f.b.cookie,body:{transactionId:'501',txRef:order.txRef,verified:true,amount:5000}})).status,409);assert.equal((await f.bootstrap(f.b)).profile.wallet,before);
  f.transactions.set('501',{id:501,tx_ref:order.txRef,amount:5000,currency:'NGN',status:'successful'});
  const paid=await f.request('/api/payments/verify',{cookie:f.b.cookie,body:{transactionId:'501',txRef:order.txRef}});assert.equal(paid.status,200);assert.equal(paid.data.profile.wallet,before+25000);
  assert.equal((await f.request('/api/payments/verify',{cookie:f.b.cookie,body:{transactionId:'501',txRef:order.txRef}})).data.replayed,true);
  const second=await f.request('/api/payments/checkout',{cookie:f.b.cookie,body:{amount:1000,email:'http-fixture@example.test',idempotencyKey:'v4_provider_checkout_2'}}),secondOrder=second.data.checkout;
  f.transactions.set('502',{id:502,tx_ref:secondOrder.txRef,amount:1000,currency:'NGN',status:'successful'});
  const raw=JSON.stringify({event:'charge.completed',data:{id:502,tx_ref:secondOrder.txRef,status:'successful'}}),signature=crypto.createHmac('sha256',SIGNING_KEY).update(raw).digest('base64');
  assert.equal((await f.request('/api/payments/webhook',{raw,headers:{'flutterwave-signature':'wrong'}})).status,401);
  const credited=await f.request('/api/payments/webhook',{raw,headers:{'flutterwave-signature':signature}});assert.equal(credited.status,200);assert.equal(credited.data.profile.wallet,before+30000);
  assert.equal((await f.request('/api/payments/webhook',{raw,headers:{'flutterwave-signature':signature}})).data.replayed,true);
  assert.equal((await f.request('/api/admin/payments/verify',{cookie:adminCookie,body:{transactionId:'502',txRef:secondOrder.txRef}})).data.replayed,true);
  const activity=(await f.request('/api/wallet',{cookie:f.b.cookie})).data.transactions.filter(row=>row.reason.startsWith('Verified Flutterwave'));assert.equal(activity.length,2);
  const list=await f.request('/api/admin/payments',{cookie:adminCookie});assert.equal(list.data.payments.length,2);assert.ok(list.data.payments.every(payment=>payment.status==='credited'));
  const returned=await f.request('/payments/return?transaction_id=502&tx_ref='+secondOrder.txRef+'&status=successful');assert.equal(returned.status,303);assert.match(returned.headers.get('location'),/^\/\?payment=return&/);
});

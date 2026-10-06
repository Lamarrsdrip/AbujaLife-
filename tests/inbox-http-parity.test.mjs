import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { GameStore } from '../src/server/gameStore.mjs';
import { ResidentDirectory } from '../src/server/residentDirectory.mjs';
import { createServer } from '../src/server/http.mjs';

const key=()=>crypto.randomUUID();
const fails=(status,code)=>error=>error.status===status&&(!code||error.code===code);
const member=(store,id,conversationId)=>({...store.get('SELECT read_at,delivered_at FROM members WHERE resident_id=? AND conversation_id=?',id,conversationId)});
const saved=(store,id)=>store.get('SELECT * FROM messages WHERE id=?',id);

async function fixture(t){
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-inbox-parity-'));
  let now=Date.parse('2026-10-05T10:00:00Z');
  const store=new GameStore({dataDir,clock:()=>now,originRandomInt:(min,max)=>max===2?1:0});
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const ids=[];
  for(const username of ['inbox_ada','inbox_bello','inbox_chika'])ids.push((await store.register({username,password:'Disposable-inbox-password'})).residentId);
  const [sender,recipient,outsider]=ids,conversationId=store.createConversation(sender,{residentId:recipient}).conversation.id;
  return{store,sender,recipient,outsider,conversationId,directory:new ResidentDirectory(store),advance(ms=1000){now+=ms;}};
}

test('scoped delivery advances only the acknowledged conversation watermark without marking messages read',async t=>{
  const f=await fixture(t),events=[];
  const first=f.store.sendMessage(f.sender,f.conversationId,'First incoming message',{idempotencyKey:key()}).message;
  const second=f.store.sendMessage(f.sender,f.conversationId,'Second incoming message',{idempotencyKey:key()}).message;
  const other=f.store.createConversation(f.recipient,{residentId:f.outsider}).conversation.id;
  f.store.sendMessage(f.outsider,other,'A different conversation',{idempotencyKey:key()});
  f.store.emitUser=(id,event,data)=>events.push({id,event,data});
  const receipt={uptoMessageId:first.id,createdAt:first.createdAt,uptoSeq:1};
  assert.equal(f.store.delivered(f.recipient,f.conversationId,receipt).deliveredAt,first.createdAt);
  assert.deepEqual(member(f.store,f.recipient,f.conversationId),{read_at:0,delivered_at:first.createdAt});
  assert.deepEqual(member(f.store,f.recipient,other),{read_at:0,delivered_at:0});
  assert.deepEqual(f.store.messageView(saved(f.store,first.id)).deliveredTo,[f.recipient]);
  assert.deepEqual(f.store.messageView(saved(f.store,second.id)).deliveredTo,[]);
  assert.deepEqual(f.store.messageView(saved(f.store,first.id)).readBy,[]);
  assert.equal(f.store.conversation(f.recipient,f.conversationId).unread,2);
  assert.deepEqual(events,[{id:f.sender,event:'message',data:{conversationId:f.conversationId,residentId:f.recipient,deliveredAt:first.createdAt,receipt:true}}]);
  f.store.delivered(f.recipient,f.conversationId,receipt);
  f.store.delivered(f.recipient,f.conversationId,{uptoSeq:0,createdAt:0});
  assert.equal(events.length,1);
  f.store.delivered(f.recipient,f.conversationId,{uptoSeq:2,createdAt:second.createdAt});
  f.store.delivered(f.recipient,f.conversationId,receipt);
  assert.equal(events.length,2);
  assert.deepEqual(member(f.store,f.recipient,f.conversationId),{read_at:0,delivered_at:second.createdAt});
  assert.deepEqual(f.store.messageView(saved(f.store,second.id)).deliveredTo,[f.recipient]);
});

test('delivery rejects unauthorized, blocked and inconsistent receipt watermarks without writes or events',async t=>{
  const f=await fixture(t),events=[];
  const first=f.store.sendMessage(f.sender,f.conversationId,'One',{idempotencyKey:key()}).message;
  const second=f.store.sendMessage(f.sender,f.conversationId,'Two',{idempotencyKey:key()}).message;
  const other=f.store.createConversation(f.sender,{residentId:f.outsider}).conversation.id;
  const elsewhere=f.store.sendMessage(f.sender,other,'Elsewhere',{idempotencyKey:key()}).message;
  f.store.emitUser=(id,event,data)=>events.push({id,event,data});
  const before=JSON.stringify(f.store.all('SELECT * FROM members'));
  assert.throws(()=>f.store.delivered(f.outsider,f.conversationId,{createdAt:first.createdAt}),fails(404));
  for(const body of [
    {createdAt:second.createdAt+1},{createdAt:-1},{createdAt:String(first.createdAt)},
    {uptoSeq:3},{uptoSeq:-1},{uptoSeq:1.5},{uptoMessageId:elsewhere.id},
    {uptoMessageId:first.id,createdAt:second.createdAt},{uptoSeq:2,createdAt:first.createdAt},
  ])assert.throws(()=>f.store.delivered(f.recipient,f.conversationId,body),fails(400,'invalid_receipt_watermark'));
  assert.equal(JSON.stringify(f.store.all('SELECT * FROM members')),before);
  assert.deepEqual(events,[]);
  f.store.moderate(f.recipient,'block',f.sender,true);
  assert.throws(()=>f.store.delivered(f.recipient,f.conversationId,{uptoMessageId:first.id}),fails(403));
  assert.equal(JSON.stringify(f.store.all('SELECT * FROM members')),before);
  assert.deepEqual(events,[]);
});

test('initial realtime delivery still acknowledges every joined conversation and preserves read watermarks',async t=>{
  const f=await fixture(t),other=f.store.createConversation(f.recipient,{residentId:f.outsider}).conversation.id;
  const first=f.store.sendMessage(f.sender,f.conversationId,'First room',{idempotencyKey:key()}).message;
  const second=f.store.sendMessage(f.outsider,other,'Second room',{idempotencyKey:key()}).message;
  f.store.delivered(f.recipient);
  assert.deepEqual(f.store.messageView(saved(f.store,first.id)).deliveredTo,[f.recipient]);
  assert.deepEqual(f.store.messageView(saved(f.store,second.id)).deliveredTo,[f.recipient]);
  assert.equal(member(f.store,f.recipient,f.conversationId).read_at,0);
  assert.equal(member(f.store,f.recipient,other).read_at,0);
  const before=member(f.store,f.recipient,f.conversationId).delivered_at;
  f.store.delivered(f.recipient,f.conversationId,{createdAt:0});
  assert.equal(member(f.store,f.recipient,f.conversationId).delivered_at,before);
});

test('inbox keyset pages cover tied activity timestamps once, reorder on messages, and omit blocked DMs before paging',async t=>{
  const f=await fixture(t),ids=[f.conversationId];
  f.store.requestFriend(f.sender,f.recipient);
  f.store.respondFriend(f.recipient,f.store.friendRequests(f.recipient)[0].id,true);
  for(let i=0;i<4;i++)ids.push(f.store.createConversation(f.sender,{kind:'group',name:`Abuja group ${i}`,memberIds:[f.recipient]}).conversation.id);
  const seen=[];let cursor;
  do{const page=f.directory.conversations(f.sender,{limit:2,cursor});assert.ok(page.conversations.length<=2);seen.push(...page.conversations.map(row=>row.id));cursor=page.nextCursor;}while(cursor);
  assert.deepEqual(seen,[...ids].sort().reverse());
  assert.equal(new Set(seen).size,ids.length);
  assert.deepEqual(f.directory.conversations(f.outsider).conversations,[]);
  f.advance();
  const latest=f.store.sendMessage(f.recipient,ids[0],'An active conversation',{idempotencyKey:key()}).message;
  const active=f.directory.conversations(f.sender,{limit:1});
  assert.equal(active.conversations[0].id,ids[0]);
  assert.equal(active.conversations[0].updatedAt,latest.createdAt);
  assert.equal(active.conversations[0].unread,1);
  assert.equal(member(f.store,f.sender,ids[0]).read_at,0);
  f.store.moderate(f.recipient,'block',f.sender,true);
  const remaining=[];cursor=null;
  do{const page=f.directory.conversations(f.sender,{limit:1,cursor});remaining.push(...page.conversations.map(row=>row.id));cursor=page.nextCursor;}while(cursor);
  assert.deepEqual(new Set(remaining),new Set(ids.slice(1)));
  assert.equal(remaining.length,4);
  for(const limit of [0,51,-1,1.5,'nope',''])assert.throws(()=>f.directory.conversations(f.sender,{limit}),fails(400));
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  for(const bad of ['broken',encode({}),encode([0]),encode(['0','id']),encode([-1,'id']),encode([0,'../private'])])assert.throws(()=>f.directory.conversations(f.sender,{cursor:bad}),fails(400,'invalid_cursor'));
});

test('real local HTTP exposes bounded inbox pages and authorized delivered acknowledgements for authenticated accounts',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-inbox-http-'));
  const server=createServer({dataDir,production:false,clock:()=>Date.parse('2026-10-05T10:00:00Z'),originRandomInt:(min,max)=>max===2?1:0});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{const stopped=once(server,'close');server.closeRealtime();server.close();await stopped;fs.rmSync(dataDir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(route,cookie,body)=>{const res=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};};
  const accounts=[];
  for(const username of ['http_inbox_ada','http_inbox_bello','http_inbox_chika']){const account=await request('/api/auth/register',null,{username,password:'Disposable-inbox-password'});assert.equal(account.status,201);assert.equal(typeof account.body.residentId,'string');const entry=await request('/api/entry',account.cookie);assert.equal(entry.body.profile.id,account.body.residentId);accounts.push({cookie:account.cookie,body:entry.body});}
  const [ada,bello,chika]=accounts;
  const dm=(await request('/api/conversations',ada.cookie,{residentId:bello.body.profile.id})).body.conversation.id;
  const other=(await request('/api/conversations',ada.cookie,{residentId:chika.body.profile.id})).body.conversation.id;
  assert.equal((await request('/api/conversations',null)).status,401);
  assert.equal((await request(`/api/conversations/${dm}/delivered`,null,{createdAt:0})).status,401);
  const page=await request('/api/conversations?limit=1',ada.cookie);
  assert.equal(page.status,200);assert.equal(page.body.conversations.length,1);assert.ok(page.body.nextCursor);
  const next=await request(`/api/conversations?limit=1&cursor=${encodeURIComponent(page.body.nextCursor)}`,ada.cookie);
  assert.equal(next.status,200);assert.equal(next.body.nextCursor,null);
  assert.deepEqual(new Set([...page.body.conversations,...next.body.conversations].map(row=>row.id)),new Set([dm,other]));
  assert.equal((await request('/api/conversations?limit=51',ada.cookie)).status,400);
  assert.equal((await request('/api/conversations?cursor=broken',ada.cookie)).body.code,'invalid_cursor');
  const messages=[];
  for(const text of ['First over HTTP','Second over HTTP'])messages.push((await request(`/api/conversations/${dm}/messages`,ada.cookie,{text,idempotencyKey:key()})).body.message);
  const route=`/api/conversations/${dm}/delivered`,watermark={uptoMessageId:messages[0].id,createdAt:messages[0].createdAt,uptoSeq:1};
  assert.equal((await request(route,chika.cookie,watermark)).status,404);
  assert.equal((await request(route,bello.cookie,{createdAt:messages[1].createdAt+1})).status,400);
  const delivered=await request(route,bello.cookie,watermark);
  assert.equal(delivered.status,200);assert.equal(delivered.body.deliveredAt,messages[0].createdAt);
  assert.deepEqual(member(server.store,bello.body.profile.id,dm),{read_at:0,delivered_at:messages[0].createdAt});
  assert.deepEqual(server.store.messageView(saved(server.store,messages[1].id)).deliveredTo,[]);
  const unread=await request('/api/conversations',bello.cookie);
  assert.equal(unread.body.conversations.length,1);assert.equal(unread.body.conversations[0].unread,2);
  assert.equal((await request(route,bello.cookie,watermark)).body.deliveredAt,messages[0].createdAt);
  await request('/api/moderation/block',bello.cookie,{residentId:ada.body.profile.id,blocked:true});
  assert.equal((await request(route,bello.cookie,watermark)).status,403);
  assert.deepEqual((await request('/api/conversations',bello.cookie)).body.conversations,[]);
});

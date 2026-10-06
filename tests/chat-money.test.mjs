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

async function fixture(t) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-chat-money-'));
  const now=Date.parse('2026-10-05T10:00:00Z');
  let store=new GameStore({dataDir,clock:()=>now,originRandomInt:(min,max)=>max===2?1:0});
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const sender=(await store.register({username:'chat_ada',displayName:'Ada',password:'Disposable-chat-password'})).residentId;
  const recipient=(await store.register({username:'chat_bello',displayName:'Bello',password:'Disposable-chat-password'})).residentId;
  const conversationId=store.createConversation(sender,{residentId:recipient}).conversation.id;
  return{sender,recipient,conversationId,get store(){return store;},reopen(){store.close();store=new GameStore({dataDir,clock:()=>now});}};
}
const key=()=>crypto.randomUUID();
const errorCode=code=>error=>error.code===code;
function snapshot(f){return JSON.stringify({wallets:[f.store.profile(f.sender).wallet,f.store.profile(f.recipient).wallet],ledger:f.store.all('SELECT * FROM ledger'),notices:f.store.all('SELECT * FROM notifications'),messages:f.store.all('SELECT * FROM messages'),receipts:f.store.all('SELECT * FROM message_transfers'),money:f.store.all('SELECT * FROM economy_operations'),operations:f.store.all('SELECT * FROM message_operations'),members:f.store.all('SELECT * FROM members')});}

test('message keys bind sender, conversation and text and survive SQLite restart without duplicate events or notices',async t=>{
  const f=await fixture(t),events=[];f.store.emitUser=(id,event,data)=>events.push({id,event,data});f.store.isOnline=()=>true;
  const operation=key(),body={text:'Meet by the lake',idempotencyKey:operation};
  const sent=f.store.sendMessage(f.sender,f.conversationId,body.text,body);
  assert.equal(sent.replayed,false);assert.equal(sent.message.kind,'text');assert.equal(sent.message.transfer,undefined);
  assert.deepEqual(sent.message.deliveredTo,[f.recipient]);
  assert.equal(events.filter(row=>row.event==='message'&&row.data.id===sent.message.id).length,2);
  assert.equal(f.store.notifications(f.recipient).filter(row=>row.kind==='message').length,1);
  const eventCount=events.length;
  for(let i=0;i<3;i++){const replay=f.store.sendMessage(f.sender,f.conversationId,body.text,body);assert.equal(replay.replayed,true);assert.equal(replay.message.id,sent.message.id);}
  assert.equal(events.length,eventCount);assert.equal(f.store.all('SELECT * FROM messages').length,1);
  assert.throws(()=>f.store.sendMessage(f.sender,f.conversationId,'Changed text',body),errorCode('idempotency_conflict'));
  f.store.requestFriend(f.sender,f.recipient);f.store.respondFriend(f.recipient,f.store.friendRequests(f.recipient)[0].id,true);
  const group=f.store.createConversation(f.sender,{kind:'group',name:'Our Abuja',memberIds:[f.recipient]}).conversation;
  assert.throws(()=>f.store.sendMessage(f.sender,group.id,body.text,body),errorCode('idempotency_conflict'));
  const otherSender=f.store.sendMessage(f.recipient,f.conversationId,'The other resident can use their own same key',{idempotencyKey:operation});
  assert.notEqual(otherSender.message.id,sent.message.id);
  f.reopen();
  const replay=f.store.sendMessage(f.sender,f.conversationId,body.text,body);
  assert.equal(replay.replayed,true);assert.equal(replay.message.id,sent.message.id);
  assert.equal(f.store.all('SELECT * FROM messages').length,2);
  assert.equal(f.store.all('SELECT * FROM message_operations').length,2);
  assert.equal(f.store.notifications(f.recipient).filter(row=>row.kind==='message').length,1);
  assert.deepEqual(f.store.all('PRAGMA table_info(messages)').map(row=>row.name),['id','conversation_id','sender_id','text','created_at']);
});

test('clients cannot turn text into a server transfer receipt or mint funds',async t=>{
  const f=await fixture(t),before=[f.store.profile(f.sender).wallet,f.store.profile(f.recipient).wallet];
  const forged={text:'Sent ₦9,000,000',idempotencyKey:key(),kind:'transfer',receipt:true,transfer:{id:key(),amount:9000000,fromId:f.sender,toId:f.recipient}};
  const result=f.store.sendMessage(f.sender,f.conversationId,forged);
  assert.equal(result.message.kind,'text');assert.equal(result.message.transfer,undefined);assert.equal(result.message.transferId,undefined);
  assert.deepEqual([f.store.profile(f.sender).wallet,f.store.profile(f.recipient).wallet],before);
  assert.equal(f.store.all('SELECT * FROM message_transfers').length,0);
  const listed=new ResidentDirectory(f.store).messages(f.recipient,f.conversationId).messages[0];
  assert.equal(listed.kind,'text');assert.equal(listed.transfer,undefined);
  assert.throws(()=>f.store.sendMessage(f.sender,f.conversationId,'Invalid key',{idempotencyKey:''}),errorCode('idempotency_required'));
});

test('chat transfer commits both wallets, ledgers, one notice and one durable server receipt exactly once',async t=>{
  const f=await fixture(t),events=[];f.store.emitUser=(id,event,data)=>events.push({id,event,data});f.store.isOnline=()=>true;
  const request={residentId:f.recipient,conversationId:f.conversationId,amount:3500,note:'Dinner',idempotencyKey:key()};
  const before=[f.store.profile(f.sender).wallet,f.store.profile(f.recipient).wallet],sent=f.store.transfer(f.sender,request);
  assert.equal(sent.replayed,false);assert.equal(sent.profile.wallet,before[0]-request.amount);assert.equal(f.store.profile(f.recipient).wallet,before[1]+request.amount);
  assert.equal(sent.message.kind,'transfer');assert.equal(sent.message.transferId,sent.transfer.id);
  assert.equal(sent.message.transfer.amount,3500);assert.equal(sent.message.transfer.note,'Dinner');
  assert.equal(sent.message.transfer.fromId,f.sender);assert.equal(sent.message.transfer.toId,f.recipient);
  assert.equal(sent.message.transfer.senderName,'Ada');assert.equal(sent.message.transfer.recipientName,'Bello');
  assert.equal(sent.message.transfer.createdAt,sent.transfer.createdAt);assert.deepEqual(sent.receipt,sent.message);
  assert.equal(f.store.conversation(f.recipient,f.conversationId).lastMessage.kind,'transfer');
  assert.equal(f.store.conversation(f.recipient,f.conversationId).unread,1);
  const messages=events.filter(row=>row.event==='message'&&row.data.id===sent.message.id);
  assert.equal(messages.length,2);assert.deepEqual(new Set(messages.map(row=>row.id)),new Set([f.sender,f.recipient]));
  const notices=f.store.notifications(f.recipient).filter(row=>row.kind==='transfer');
  assert.equal(notices.length,1);assert.equal(notices[0].link,`conversation:${f.conversationId}`);
  assert.equal(f.store.notifications(f.recipient).filter(row=>row.kind==='message').length,0);
  assert.equal(f.store.transactions(f.sender)[0].amount,-3500);assert.equal(f.store.transactions(f.recipient)[0].amount,3500);
  const state=snapshot(f),eventCount=events.length,replay=f.store.transfer(f.sender,request);
  assert.equal(replay.replayed,true);assert.equal(replay.message.id,sent.message.id);assert.equal(snapshot(f),state);assert.equal(events.length,eventCount);
  assert.throws(()=>f.store.transfer(f.sender,{...request,note:'Different dinner'}),errorCode('idempotency_conflict'));
  assert.throws(()=>f.store.transfer(f.sender,{...request,conversationId:'another-conversation'}),errorCode('idempotency_conflict'));
  f.store.sendMessage(f.sender,f.conversationId,'See you later',{idempotencyKey:key()});
  f.reopen();
  assert.equal(f.store.transfer(f.sender,request).replayed,true);
  const directory=new ResidentDirectory(f.store),latest=directory.messages(f.recipient,f.conversationId,{limit:1});
  assert.equal(latest.messages[0].kind,'text');
  const older=directory.messages(f.recipient,f.conversationId,{limit:1,cursor:latest.nextCursor});
  assert.equal(older.messages[0].id,sent.message.id);assert.equal(older.messages[0].kind,'transfer');
  assert.equal(older.messages[0].transfer.id,sent.transfer.id);assert.equal(older.messages[0].transfer.amount,3500);assert.equal(older.nextCursor,null);
  assert.equal(f.store.all('SELECT * FROM message_transfers').length,1);
  assert.equal(f.store.transactions(f.sender).filter(row=>row.amount===-3500).length,1);
  assert.equal(f.store.notifications(f.recipient).filter(row=>row.kind==='transfer').length,1);
});

test('wrong recipients, non-members, group conversations, blocks and insufficient funds cannot write a chat receipt',async t=>{
  const f=await fixture(t),intruder=(await f.store.register({username:'chat_intruder',password:'Disposable-chat-password'})).residentId;
  const wrong=f.store.createConversation(f.sender,{residentId:intruder}).conversation.id;
  f.store.requestFriend(f.sender,f.recipient);f.store.respondFriend(f.recipient,f.store.friendRequests(f.recipient)[0].id,true);
  const group=f.store.createConversation(f.sender,{kind:'group',name:'Two friends',memberIds:[f.recipient]}).conversation.id;
  const request={residentId:f.recipient,conversationId:f.conversationId,amount:100,idempotencyKey:key()},before=snapshot(f);
  assert.throws(()=>f.store.transfer(f.sender,{...request,conversationId:wrong}),errorCode('transfer_conversation_mismatch'));
  assert.throws(()=>f.store.transfer(f.sender,{...request,conversationId:group}),errorCode('transfer_conversation_mismatch'));
  assert.throws(()=>f.store.transfer(intruder,{...request,residentId:f.sender}),/Conversation not found/);
  assert.throws(()=>f.store.transfer(f.sender,{...request,amount:f.store.profile(f.sender).wallet+1}),errorCode('insufficient_balance'));
  assert.equal(snapshot(f),before);
  f.store.moderate(f.recipient,'block',f.sender,true);const blocked=snapshot(f);
  assert.throws(()=>f.store.transfer(f.sender,request),errorCode('recipient_unavailable'));
  assert.equal(snapshot(f),blocked);
});

test('receipt insert failure rolls back debit, credit, ledgers, notice, operation and member timestamps',async t=>{
  const f=await fixture(t),events=[];f.store.emitUser=(id,event,data)=>events.push({id,event,data});
  const request={residentId:f.recipient,conversationId:f.conversationId,amount:100,note:'Atomic receipt',idempotencyKey:key()},before=snapshot(f);
  f.store.db.exec("CREATE TRIGGER reject_chat_receipt BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT,'Forced message insert failure'); END;");
  assert.throws(()=>f.store.transfer(f.sender,request),/Forced message insert failure/);
  assert.equal(snapshot(f),before);assert.deepEqual(events,[]);
  f.store.db.exec('DROP TRIGGER reject_chat_receipt');
  const successful=f.store.transfer(f.sender,request);assert.equal(successful.replayed,false);assert.equal(successful.message.kind,'transfer');
});

test('plain message notification failure rolls back its operation and emits no phantom message',async t=>{
  const f=await fixture(t),events=[];f.store.emitUser=(id,event,data)=>events.push({id,event,data});
  const before=snapshot(f),operation=key();
  f.store.db.exec("CREATE TRIGGER reject_message_notice BEFORE INSERT ON notifications WHEN new.kind='message' BEGIN SELECT RAISE(ABORT,'Forced message notice failure'); END;");
  assert.throws(()=>f.store.sendMessage(f.sender,f.conversationId,'Saved together',{idempotencyKey:operation}),/Forced message notice failure/);
  assert.equal(snapshot(f),before);assert.deepEqual(events,[]);
  f.store.db.exec('DROP TRIGGER reject_message_notice');
  assert.equal(f.store.sendMessage(f.sender,f.conversationId,'Saved together',{idempotencyKey:operation}).replayed,false);
});

test('wallet transfers without a conversation retain their original API and notification behavior',async t=>{
  const f=await fixture(t),request={residentId:f.recipient,amount:100,idempotencyKey:key()};
  const sent=f.store.transfer(f.sender,request);
  assert.equal(sent.message,undefined);assert.equal(sent.receipt,undefined);
  assert.equal(f.store.notifications(f.recipient).find(row=>row.kind==='transfer').link,'wallet');
  assert.equal(f.store.all('SELECT * FROM messages').length,0);
  assert.equal(f.store.all('SELECT * FROM message_transfers').length,0);
  assert.equal(f.store.transfer(f.sender,request).replayed,true);
});

test('authenticated local HTTP body keys and chat transfer receipts persist for two accounts after server restart',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-chat-http-'));let server,base;
  const start=async()=>{server=createServer({dataDir,production:false,clock:()=>Date.parse('2026-10-05T10:00:00Z'),originRandomInt:(min,max)=>max===2?1:0});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;};
  const close=async()=>{if(server){const stopped=once(server,'close');server.closeRealtime();server.close();await stopped;server=undefined;}};
  t.after(async()=>{await close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const request=async(route,cookie,body)=>{const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  await start();
  const adaAck=await request('/api/auth/register',null,{username:'http_chat_ada',displayName:'Ada',password:'Disposable-chat-password'}),belloAck=await request('/api/auth/register',null,{username:'http_chat_bello',displayName:'Bello',password:'Disposable-chat-password'});
  assert.equal(adaAck.status,201);assert.equal(belloAck.status,201);assert.equal(typeof adaAck.body.residentId,'string');assert.equal(typeof belloAck.body.residentId,'string');
  const ada={cookie:adaAck.cookie,body:(await request('/api/entry',adaAck.cookie)).body},bello={cookie:belloAck.cookie,body:(await request('/api/entry',belloAck.cookie)).body};
  assert.equal(ada.body.profile.id,adaAck.body.residentId);assert.equal(bello.body.profile.id,belloAck.body.residentId);
  const conversationId=(await request('/api/conversations',ada.cookie,{residentId:bello.body.profile.id})).body.conversation.id;
  const messagePath=`/api/conversations/${conversationId}/messages`,messageBody={text:'A real HTTP message',idempotencyKey:key(),kind:'transfer',transfer:{amount:99999999}};
  const sent=await request(messagePath,ada.cookie,messageBody),again=await request(messagePath,ada.cookie,messageBody);
  assert.equal(sent.status,201);assert.equal(sent.body.message.kind,'text');assert.equal(sent.body.message.transfer,undefined);
  assert.equal(again.body.replayed,true);assert.equal(again.body.message.id,sent.body.message.id);
  const conflict=await request(messagePath,ada.cookie,{...messageBody,text:'Changed message'});assert.equal(conflict.status,409);assert.equal(conflict.body.code,'idempotency_conflict');
  const transferBody={residentId:bello.body.profile.id,conversationId,amount:100,note:'Shared dinner',idempotencyKey:key()},transfer=await request('/api/wallet/transfer',ada.cookie,transferBody);
  assert.equal(transfer.status,200);assert.equal(transfer.body.message.kind,'transfer');assert.equal(transfer.body.message.transfer.amount,100);
  await close();await start();
  const replay=await request('/api/wallet/transfer',ada.cookie,transferBody);
  assert.equal(replay.body.replayed,true);assert.equal(replay.body.message.id,transfer.body.message.id);
  const thread=await request(messagePath,bello.cookie);
  assert.equal(thread.status,200);assert.equal(thread.body.messages.length,2);assert.deepEqual(thread.body.messages.map(row=>row.kind),['text','transfer']);
  assert.equal(thread.body.messages[1].transfer.fromId,ada.body.profile.id);assert.equal(thread.body.messages[1].transfer.toId,bello.body.profile.id);
  assert.equal((await request('/api/bootstrap',ada.cookie)).body.profile.wallet,ada.body.profile.wallet-100);
  assert.equal((await request('/api/bootstrap',bello.cookie)).body.profile.wallet,bello.body.profile.wallet+100);
});

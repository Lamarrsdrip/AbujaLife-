import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from '../src/server/http.mjs';

const voice=Buffer.from([0x1a,0x45,0xdf,0xa3,1,2,3,4]);

test('authenticated voice send persists once, binds retries to content, and protects recipient media access',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'abujalife-voice-http-'));
  const mediaDir=path.join(root,'shared','media','chat');
  const server=createServer({dataDir:path.join(root,'state'),env:{NODE_ENV:'production',CHAT_MEDIA_DIR:mediaDir}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeRealtime();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(route,cookie,body){
    const res=await fetch(base+route,{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return{status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  const users=[];
  for(const label of ['sender','recipient','outsider']){
    const result=await request('/api/auth/register',null,{username:`voice_${label}_${crypto.randomBytes(4).toString('hex')}`,password:'Disposable voice acceptance password!'});
    assert.equal(result.status,201);users.push({id:result.body.residentId,cookie:result.cookie});
  }
  const [sender,recipient,outsider]=users;
  const conversation=(await request('/api/conversations',sender.cookie,{residentId:recipient.id})).body.conversation.id;
  const otherConversation=(await request('/api/conversations',sender.cookie,{residentId:outsider.id})).body.conversation.id;
  async function upload(key,{bytes=voice,conversationId=conversation,durationMs=900}={}){
    const query=new URLSearchParams({kind:'voice',durationMs:String(durationMs),idempotencyKey:key});
    const res=await fetch(`${base}/api/chat-pro/conversations/${conversationId}/media?${query}`,{method:'POST',headers:{cookie:sender.cookie,'content-type':'audio/webm'},body:bytes});
    return{status:res.status,body:await res.json()};
  }
  const key=crypto.randomUUID(),first=await upload(key);
  assert.equal(first.status,201);assert.equal(first.body.message.kind,'voice');
  const replay=await upload(key);assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);assert.equal(replay.body.message.id,first.body.message.id);
  for(const changed of [{bytes:Buffer.concat([voice,Buffer.from([9])])},{conversationId:otherConversation},{durationMs:1200}]){
    const result=await upload(key,changed);assert.equal(result.status,409);assert.equal(result.body.code,'idempotency_conflict');
  }
  const concurrentKey=crypto.randomUUID(),concurrent=await Promise.all([upload(concurrentKey),upload(concurrentKey)]);
  assert.ok(concurrent.every(result=>result.status===200||result.status===201));
  assert.equal(concurrent[0].body.message.id,concurrent[1].body.message.id);
  const messages=(await request(`/api/conversations/${conversation}/messages`,recipient.cookie)).body.messages;
  assert.equal(messages.length,2);assert.equal((await fs.readdir(mediaDir)).length,2,'a concurrent retry must not retain an orphan media file');
  const mediaUrl=first.body.message.media.url;
  const opened=await fetch(base+mediaUrl,{headers:{cookie:recipient.cookie}});
  assert.equal(opened.status,200);assert.equal(opened.headers.get('content-type'),'audio/webm');assert.deepEqual(Buffer.from(await opened.arrayBuffer()),voice);
  assert.equal((await fetch(base+mediaUrl,{headers:{cookie:outsider.cookie}})).status,404);
  await request('/api/moderation/block',recipient.cookie,{residentId:sender.id,blocked:true});
  assert.equal((await fetch(base+mediaUrl,{headers:{cookie:recipient.cookie}})).status,404,'a known media URL must not bypass a block');
  await request('/api/moderation/block',recipient.cookie,{residentId:sender.id,blocked:false});
  const deleted=await request(`/api/chat-pro/messages/${first.body.message.id}/delete`,sender.cookie,{scope:'everyone'});
  assert.equal(deleted.status,200);assert.equal((await fetch(base+mediaUrl,{headers:{cookie:recipient.cookie}})).status,404);
});

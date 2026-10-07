import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProductionApplication } from '../src/server/production.mjs';

const configuration=process.env.TEST_MONGODB_CONFIG?JSON.parse(await fs.readFile(process.env.TEST_MONGODB_CONFIG,'utf8')):{};
const uri=process.env.TEST_MONGODB_URI||configuration.uri;
const origin='https://abujacity.life';
const voice=Buffer.from([0x1a,0x45,0xdf,0xa3,1,2,3,4]);

test('Mongo production voice survives restart and relogin, and graceful shutdown drains live SSE',{
  skip:uri?false:'Requires an authenticated disposable Mongo replica set'
},async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'abujalife-production-voice-'));
  const mediaDir=path.join(root,'shared','media','chat');
  const env={NODE_ENV:'production',MONGODB_URI:uri,MONGODB_DATABASE:configuration.database||'abujalife_prod',PUBLIC_WEB_URL:origin,API_PUBLIC_URL:'https://api.abujacity.life',CORS_ORIGINS:origin,CHAT_MEDIA_DIR:mediaDir};
  let app,base,streamController;
  t.after(async()=>{streamController?.abort();if(app)await app.close();await fs.rm(root,{recursive:true,force:true});});
  async function start(){app=await createProductionApplication({env,log:()=>{}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;}
  async function request(route,cookie,body){
    const response=await fetch(base+route,{method:body?'POST':'GET',headers:{origin,...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
    return{status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  await start();
  const accounts=[];
  for(const label of ['sender','recipient']){
    const username=`pv_${label}_${crypto.randomBytes(4).toString('hex')}`,password='Disposable production voice password!';
    const registered=await request('/api/auth/register',null,{username,password});assert.equal(registered.status,201);
    accounts.push({username,password,id:registered.body.residentId,cookie:registered.cookie});
  }
  const [sender,recipient]=accounts;
  const conversation=(await request('/api/conversations',sender.cookie,{residentId:recipient.id})).body.conversation.id;
  const query=new URLSearchParams({kind:'voice',durationMs:'900',idempotencyKey:crypto.randomUUID()});
  async function upload(){const response=await fetch(`${base}/api/chat-pro/conversations/${conversation}/media?${query}`,{method:'POST',headers:{origin,cookie:sender.cookie,'content-type':'audio/webm'},body:voice,signal:AbortSignal.timeout(10000)});return{status:response.status,body:await response.json()};}
  const sent=await upload();assert.equal(sent.status,201,sent.body.code||'voice upload');const replay=await upload();assert.equal(replay.status,200);assert.equal(replay.body.message.id,sent.body.message.id);
  assert.equal(await app.store.collection('messages').countDocuments({conversationId:conversation}),1);
  const mediaUrl=sent.body.message.media.url;
  const filename=path.join(mediaDir,sent.body.message.media.id);assert.deepEqual(await fs.readFile(filename),voice);
  streamController=new AbortController();
  const stream=await fetch(base+'/api/realtime',{headers:{origin,cookie:recipient.cookie},signal:streamController.signal});assert.equal(stream.status,200);
  const reader=stream.body.getReader();await reader.read();
  const started=Date.now();
  await app.close();app=null;
  assert.ok(Date.now()-started<5000,'graceful shutdown must drain SSE without its forced-kill timeout');
  streamController.abort();
  await start();
  async function readMedia(){const response=await fetch(base+mediaUrl,{headers:{origin,cookie:recipient.cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'audio/webm');assert.deepEqual(Buffer.from(await response.arrayBuffer()),voice);}
  await readMedia();
  assert.equal((await request('/api/auth/logout',recipient.cookie,{})).status,200);
  const loggedIn=await request('/api/auth/login',null,{username:recipient.username,password:recipient.password});assert.equal(loggedIn.status,200);recipient.cookie=loggedIn.cookie;
  await readMedia();
  assert.equal((await fs.readdir(mediaDir)).length,1);
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  const imageQuery=new URLSearchParams({kind:'image',idempotencyKey:crypto.randomUUID()});
  const imageResponse=await fetch(`${base}/api/chat-pro/conversations/${conversation}/media?${imageQuery}`,{method:'POST',headers:{origin,cookie:sender.cookie,'content-type':'image/png'},body:image});
  assert.equal(imageResponse.status,201,'the production validator must also accept bounded private photos');
  const deleted=await request(`/api/chat-pro/messages/${sent.body.message.id}/delete`,sender.cookie,{scope:'everyone'});assert.equal(deleted.status,200,'deleted-media metadata must remain valid under the production schema');
  assert.equal((await fetch(base+mediaUrl,{headers:{origin,cookie:recipient.cookie}})).status,404);
});

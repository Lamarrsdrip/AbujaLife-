import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ChatMediaStore } from '../src/server/chatMediaStore.mjs';

const voice = Buffer.from([0x1a,0x45,0xdf,0xa3,0x01,0x02,0x03,0x04]);
const id = () => crypto.randomUUID();

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-chat-media-'));
  return{root,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('production file media requires an explicit absolute persistent directory',()=>{
  const disabled=new ChatMediaStore({env:{NODE_ENV:'production'}});
  assert.deepEqual(disabled.configuration().configured,false);
  assert.throws(()=>new ChatMediaStore({env:{NODE_ENV:'production',CHAT_MEDIA_DIR:'.local/chat-media'}}),/absolute persistent path/);
  assert.throws(()=>new ChatMediaStore({env:{NODE_ENV:'production',CHAT_MEDIA_DIR:'C:\\services\\abujalife\\releases\\abc123-def456\\.local\\chat-media'}}),/outside versioned release/);
  assert.throws(()=>new ChatMediaStore({env:{NODE_ENV:'production',CHAT_MEDIA_DIR:path.join(path.parse(process.cwd()).root,'services','abujalife','releases')}}),/outside versioned release/);
  if(process.platform!=='win32')assert.throws(()=>new ChatMediaStore({env:{NODE_ENV:'production',CHAT_MEDIA_DIR:'C:\\services\\abujalife\\shared\\media\\chat'}}),/absolute persistent path/,'foreign-platform paths must not become relative runtime writes');
});

test('production voice media writes, reads, survives a new store instance and deletes from shared storage',async t=>{
  const f=fixture();t.after(f.cleanup);const root=path.join(f.root,'shared','media','chat'),mediaId=id();
  const first=new ChatMediaStore({env:{NODE_ENV:'production',CHAT_MEDIA_DIR:root}});
  assert.equal(first.configuration().mode,'file');
  const saved=await first.put({mediaId,kind:'voice',mime:'audio/webm',bytes:voice,durationMs:1400});
  assert.equal(saved.id,mediaId);assert.equal(saved.kind,'voice');assert.equal(saved.mime,'audio/webm');
  assert.deepEqual((await first.read(mediaId)).body,voice);
  const restarted=new ChatMediaStore({env:{NODE_ENV:'production',CHAT_MEDIA_DIR:root}});
  assert.deepEqual((await restarted.read(mediaId)).body,voice,'media must survive API/release restarts');
  await restarted.remove(mediaId);
  await assert.rejects(restarted.read(mediaId),error=>error.code==='media_missing');
});

test('failed file storage returns a safe domain error and never pretends the voice message was stored',async t=>{
  const f=fixture();t.after(f.cleanup);const notDirectory=path.join(f.root,'blocked');fs.writeFileSync(notDirectory,'file');
  const store=new ChatMediaStore({env:{NODE_ENV:'production',CHAT_MEDIA_DIR:notDirectory}});
  await assert.rejects(store.put({mediaId:id(),kind:'voice',mime:'audio/webm',bytes:voice,durationMs:900}),error=>error.code==='media_storage_failed'&&!/EPERM|EACCES|ENOTDIR/i.test(error.message));
});

test('an existing file never makes different uploaded bytes appear successfully stored',async t=>{
  const f=fixture();t.after(f.cleanup);const mediaId=id(),root=path.join(f.root,'shared','media','chat');
  const store=new ChatMediaStore({env:{NODE_ENV:'production',CHAT_MEDIA_DIR:root}});
  await store.put({mediaId,kind:'voice',mime:'audio/webm',bytes:voice,durationMs:900});
  const changed=Buffer.concat([voice,Buffer.from([9])]);
  await assert.rejects(store.put({mediaId,kind:'voice',mime:'audio/webm',bytes:changed,durationMs:900}),error=>error.code==='media_storage_conflict');
  assert.deepEqual((await store.read(mediaId)).body,voice);
});

test('private object-storage network failures return a safe error',async()=>{
  const store=new ChatMediaStore({env:{NODE_ENV:'production',CHAT_MEDIA_S3_ENDPOINT:'https://storage.example.test',CHAT_MEDIA_S3_BUCKET:'chat-private',CHAT_MEDIA_S3_ACCESS_KEY_ID:'fixture-access-key',CHAT_MEDIA_S3_SECRET_ACCESS_KEY:'fixture-secret'},fetchImpl:async()=>{throw new Error('fixture-secret: network denied');}});
  await assert.rejects(store.put({mediaId:id(),kind:'voice',mime:'audio/webm',bytes:voice,durationMs:900}),error=>error.code==='media_storage_failed'&&!/fixture-secret|network denied/.test(error.message));
});

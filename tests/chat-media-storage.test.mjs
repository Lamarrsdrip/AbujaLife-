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

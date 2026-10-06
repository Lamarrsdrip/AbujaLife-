import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path,'utf8');

const html=read('app/index.html');
const client=read('app/phone-chat-pro.js');
const css=read('app/phone-chat-pro.css');
const runtime=read('src/server/chatProRuntime.mjs');
const media=read('src/server/chatMediaStore.mjs');
const session=read('src/server/sessionRuntime.mjs');

test('Chat Pro assets are loaded by the real game shell',()=>{
  assert.match(html,/phone-chat-pro\.css/);
  assert.match(html,/phone-chat-pro\.js/);
});

test('Chat Pro runtime is enabled from the already-attached directory store',()=>{
  assert.match(session,/const chatDirectory=directory\|\|store\.directory\|\|null/);
  assert.match(session,/createChatProRuntime\(\{store,social,directory:chatDirectory/);
});

test('advanced chat supports photo send, voice draft, reply and delete flows',()=>{
  for(const token of ['prepareImage','startRecording','Voice note ready','sendMedia','setReply','deleteSelected'])assert.ok(client.includes(token),`missing ${token}`);
  assert.ok(client.includes('Review before sending'));
  assert.ok(client.includes("kind==='image'"));
  assert.ok(client.includes("kind==='voice'"));
});

test('media messages use authenticated private server routes and durable storage',()=>{
  for(const token of ['createChatProRuntime','mediaMessage','mediaRead','replyToMessageId','chat-pro','transfer_receipt_immutable'])assert.ok(runtime.includes(token),`missing ${token}`);
  assert.ok(runtime.includes("scope==='everyone'"));
  assert.ok(runtime.includes("'cache-control':'private"));
  assert.ok(media.includes('CHAT_MEDIA_S3_ENDPOINT'));
  assert.ok(media.includes("this.production=env.NODE_ENV==='production'"));
  assert.ok(media.includes("this.mode=this.s3?'s3':this.production?'disabled':'file'"));
});

test('money messages render as compact completed transfer receipts',()=>{
  for(const token of ['Transfer sent','Money received','Completed','In-game transfer'])assert.ok(client.includes(token),`missing ${token}`);
  assert.match(css,/\.pro-transfer-amount/);
  assert.match(css,/\.ph-transfer-message/);
});

test('chat media stays bounded for a light client and safe server',()=>{
  assert.ok(client.includes('max=1600'));
  assert.ok(client.includes("canvas.toBlob(resolve,'image/jpeg',.86)"));
  assert.ok(media.includes('imageBytes:8*1024*1024'));
  assert.ok(media.includes('voiceBytes:8*1024*1024'));
  assert.ok(media.includes('voiceDurationMs:120000'));
});

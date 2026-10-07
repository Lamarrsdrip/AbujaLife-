import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual browser upload handler with transport/DOM boundaries only.
const source=fs.readFileSync(new URL('../app/phone-chat-pro.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function sendMedia('),source.indexOf('\nfunction supportedVoiceMime'));
function harness(){
  const requests=[],revoked=[],messages=[],errors=[];
  let pending;
  const c=vm.createContext({currentConversationId:'conversation-a',activeReply:{conversationId:'conversation-a',message:{id:'original-reply'}},imageDraft:null,voiceDraft:null,
    uuid:()=>`intent-${requests.length}`,selectedCaption:()=>'',URLSearchParams,AbortSignal,
    URL:{revokeObjectURL:url=>revoked.push(url)},apiURL:p=>p,
    nativeFetch:(url,options)=>{requests.push({url,options});return new Promise((resolve,reject)=>{pending={resolve,reject};});},
    stopPlayback(){},renderComposerExtras(){},cachePayload:body=>messages.push(body),clearReply(){c.activeReply=null;},currentComposer:()=>null,scheduleEnhance(){},setTimeout(){},refreshThreadMeta:async()=>{},toast:text=>errors.push(text),
  });
  vm.runInContext(code,c);
  return {c,requests,revoked,messages,errors,get pending(){return pending;}};
}
test('concurrent media taps and lost-response retries keep one original upload intent',async()=>{
  const h=harness(),draft={conversationId:'conversation-a',blob:{type:'audio/webm'},durationMs:1400,url:'blob:original'};h.c.voiceDraft=draft;
  const first=h.c.sendMedia('voice',draft);await h.c.sendMedia('voice',draft);
  assert.equal(h.requests.length,1);assert.equal(draft.sending,true);
  h.pending.reject(new Error('lost response'));await first;
  assert.equal(h.c.voiceDraft,draft);assert.equal(draft.sending,false);
  h.c.activeReply={conversationId:'conversation-a',message:{id:'different-reply'}};
  const retry=h.c.sendMedia('voice',draft);
  assert.equal(h.requests[1].url,h.requests[0].url);
  h.pending.resolve({ok:true,json:async()=>({ok:true,message:{id:'one-message'}})});await retry;
  assert.equal(h.c.voiceDraft,null);assert.equal(h.messages.length,1);assert.deepEqual(h.revoked,['blob:original']);
});
test('a completed upload cannot discard a newer draft from another conversation',async()=>{
  const h=harness(),draft={conversationId:'conversation-a',blob:{type:'audio/webm'},durationMs:900,url:'blob:a'};h.c.voiceDraft=draft;
  const first=h.c.sendMedia('voice',draft);const next={conversationId:'conversation-b',url:'blob:b'};
  h.c.currentConversationId='conversation-b';h.c.voiceDraft=next;
  h.pending.resolve({ok:true,json:async()=>({ok:true,message:{id:'sent-a'}})});await first;
  assert.equal(h.c.voiceDraft,next);assert.deepEqual(h.revoked,[]);assert.equal(h.messages.length,1);
});

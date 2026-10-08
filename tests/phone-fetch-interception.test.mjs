import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the production fetch interceptor with a controlled transport. A
// pending world request must retain its native promise so Safari can cancel it
// during navigation without an extra detached async wrapper.
const source=fs.readFileSync(new URL('../app/phone-chat-pro.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('const nativeFetch='),source.indexOf('\nif(globalThis.EventSource'));
function harness(fetch){
  const requests=[],effects=[];
  const context=vm.createContext({fetch:(...args)=>{requests.push(args);return fetch(...args);},URL,location:{href:'https://game.example/'},clearReply:()=>effects.push('clearReply'),releaseTransient:()=>effects.push('releaseTransient'),scheduleEnhance:()=>effects.push('enhance')});
  vm.runInContext(code,context);
  return {context,requests,effects};
}

test('non-chat requests pass through as the original native promise, including cancellation',async()=>{
  let reject;
  const pending=new Promise((resolve,no)=>{reject=no;}),h=harness(()=>pending);
  const options={method:'POST',signal:new AbortController().signal,body:'{"pose":{"x":10}}'};
  const result=h.context.fetch('https://api.example/api/presence',options);
  assert.equal(result,pending);
  assert.equal(h.requests[0][1],options);
  const cancellation=new DOMException('Navigation cancelled the request.','AbortError');
  const rejection=assert.rejects(result,error=>error===cancellation);
  reject(cancellation);await rejection;
  assert.deepEqual(h.effects,[]);
});

test('message requests still enrich replies and cache the original response safely',async()=>{
  const response={ok:true,headers:{get:()=> 'application/json'},clone:()=>({json:async()=>({message:{id:'sent',conversationId:'thread-a'}})})};
  const h=harness(async()=>response);
  vm.runInContext("activeReply={conversationId:'thread-a',message:{id:'reply-a'}}",h.context);
  const result=await h.context.fetch('https://api.example/api/conversations/thread-a/messages',{method:'POST',body:'{"text":"How far?"}'});
  assert.equal(result,response);
  assert.deepEqual(JSON.parse(h.requests[0][1].body),{text:'How far?',replyToMessageId:'reply-a'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(vm.runInContext("messageCache.get('sent').conversationId",h.context),'thread-a');
  assert.deepEqual(h.effects,['clearReply','enhance']);
});

test('a failed chat cache read cannot change the successful caller response',async()=>{
  const response={ok:true,headers:{get:()=> 'application/json'},clone:()=>({json:async()=>{throw new Error('Download cancelled');}})};
  const h=harness(async()=>response);
  assert.equal(await h.context.fetch('https://api.example/api/conversations'),response);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(h.effects,[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {apiFetch,boundedFetch} from '../app/api-client.js';

test('entry and writes work without newer AbortSignal static methods',async()=>{
 const original={fetch:globalThis.fetch,any:AbortSignal.any,timeout:AbortSignal.timeout};
 try{
  AbortSignal.any=undefined;AbortSignal.timeout=undefined;
  let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.credentials,'include');assert.equal(options.cache,'no-store');assert.ok(options.signal instanceof AbortSignal);return new Response(JSON.stringify({authenticated:false,entry:true}));};
  const [a,b]=await Promise.all([apiFetch('/api/entry'),apiFetch('/api/entry')]);assert.equal(calls,1);assert.deepEqual(await a.json(),await b.json());
  await apiFetch('/api/action',{method:'POST',body:'{}'});assert.equal(calls,2);
 }finally{globalThis.fetch=original.fetch;AbortSignal.any=original.any;AbortSignal.timeout=original.timeout;}
});
test('deadline and caller cancellation abort once; mutation failures never retry',async()=>{
 let calls=0;const waits=(input,{signal})=>new Promise((resolve,reject)=>{calls++;if(signal.aborted)return reject(signal.reason);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
 await assert.rejects(boundedFetch('/api/action',{timeoutMs:5,method:'POST'},waits),{name:'TimeoutError'});assert.equal(calls,1);
 const controller=new AbortController(),pending=boundedFetch('/api/entry',{signal:controller.signal},waits);controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,2);
});
test('settlement releases caller listener and a failed GET can reconnect',async()=>{
 const original=globalThis.fetch;let added=0,removed=0,calls=0;
 const controller=new AbortController(),signal={get aborted(){return controller.signal.aborted;},get reason(){return controller.signal.reason;},addEventListener(...args){added++;controller.signal.addEventListener(...args);},removeEventListener(...args){removed++;controller.signal.removeEventListener(...args);}};
 const response=await boundedFetch('/api/entry',{signal},async()=>new Response('{}'));await response.json();assert.equal(added,1);assert.equal(removed,1);
 try{globalThis.fetch=async()=>{calls++;if(calls===1)throw new TypeError('Disconnected');return new Response('{}');};await assert.rejects(apiFetch('/api/entry'));await apiFetch('/api/entry');assert.equal(calls,2);}finally{globalThis.fetch=original;}
});

test('a stalled response body still observes its deadline after successful headers',async()=>{
 const response=await boundedFetch('/api/entry',{timeoutMs:5},async(input,{signal})=>new Response(new ReadableStream({start(controller){signal.addEventListener('abort',()=>controller.error(signal.reason),{once:true});}})));
 await assert.rejects(response.json(),{name:'TimeoutError'});
});

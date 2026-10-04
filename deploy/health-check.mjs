#!/usr/bin/env node
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
export async function healthCheck(origin){
  const base=new URL(origin);
  assert.ok(base.protocol==='https:'||base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname));
  const response=await fetch(new URL('/api/health',base),{headers:{origin:'https://abujacity.life'},signal:AbortSignal.timeout(5000)});
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.ok,true);assert.equal(body.storage,'mongodb');
  assert.equal(response.headers.get('access-control-allow-origin'),'https://abujacity.life');assert.equal(response.headers.get('access-control-allow-credentials'),'true');
  return{ok:true,storage:'mongodb',origin:base.origin};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await healthCheck(process.argv[2]||'https://api.abujacity.life')));

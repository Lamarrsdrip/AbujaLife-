import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Windows runners may check the repository out with CRLF; normalize before
// extracting the self-contained boot function used by this VM fixture.
const source=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const start=source.indexOf('async function boot(){');
const boot=source.slice(start,source.indexOf('\n}\n',start)+2);
function fixture(refresh){
  const button={},root={innerHTML:'',querySelector:()=>button};
  const calls=[];
  const context=vm.createContext({root,state:{authenticated:false},authConfig:{},AbortSignal,
    api:(path,options)=>{calls.push({path,options});return new Promise(()=>{});},
    refresh,renderMain:()=>calls.push('render'),connectRealtime:()=>calls.push('realtime'),hydrateStartup:()=>{},expireAccount:()=>calls.push('login'),
    brandMark:()=>'<b>AbujaLife</b>',esc:String,
    authRecovery:{snapshot:()=>({kind:null})},location:new URL('https://abujacity.life'),
    URLSearchParams,phone:{open:()=>{}},toast:()=>{}});
  vm.runInContext(`${boot};globalThis.start=boot;`,context);
  return {root,button,calls,start:context.start};
}

test('a stalled optional account configuration cannot hold a ready city on the loader',async()=>{
  const f=fixture(async()=>{});
  await Promise.race([f.start(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Optional configuration blocked startup')),100))]);
  assert.deepEqual(f.calls.filter(value=>typeof value==='string'),['render','realtime']);
  assert.equal(f.calls[0].path,'/api/auth/config');
  assert.equal(f.calls[0].options.timeoutMs,5000);
});

test('an expired startup session opens sign-in instead of a reconnect loop',async()=>{
  const f=fixture(async()=>{throw Object.assign(new Error('Sign in'),{status:401});});
  await f.start();assert.deepEqual(f.calls.filter(value=>typeof value==='string'),['login']);
  assert.doesNotMatch(f.root.innerHTML,/Reconnect/);
});

test('bootstrap timeout replaces the loader with a working reconnect action',async()=>{
  let attempts=0;
  const f=fixture(async()=>{if(++attempts===1)throw new DOMException('Deadline reached','TimeoutError');});
  await f.start();
  assert.match(f.root.innerHTML,/Your connection timed out/);
  assert.doesNotMatch(f.root.innerHTML,/Opening your city/);
  assert.equal(f.button.onclick,f.start);
  await f.button.onclick();
  assert.equal(attempts,2);
  assert.equal(f.calls.filter(value=>value==='render').length,1);
});

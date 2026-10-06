import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from '../src/server/http.mjs';

const appearance={skinTone:'brown',hair:'crop',top:'forest',bottom:'charcoal',shoes:'white',body:'regular',face:'oval',presentation:'neutral',facialHair:'none',accessory:'none'};

async function fixture(t){
 const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'abujalife-session-runtime-'));
 const server=createServer({dataDir,publicWebUrl:'http://localhost',corsOrigins:['http://localhost']});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeRealtime();await new Promise(resolve=>server.close(resolve));await fs.rm(dataDir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(route,{method='GET',body,cookie}={})=>{
  const response=await fetch(`${base}${route}`,{method,headers:{origin:'http://localhost',...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
 };
 return{server,request};
}

test('register returns only a session acknowledgement and entry is a separate authoritative read',async t=>{
 const f=await fixture(t),username=`qa_${Date.now().toString(36)}`,password='Disposable resident 2026!';
 const registered=await f.request('/api/auth/register',{method:'POST',body:{displayName:'QA Resident',username,password,appearance}});
 assert.equal(registered.status,201);assert.deepEqual(Object.keys(registered.data).sort(),['authenticated','ok','residentId']);
 assert.equal(registered.data.ok,true);assert.equal(registered.data.authenticated,true);assert.equal(typeof registered.data.residentId,'string');
 assert.equal('profile' in registered.data,false);assert.equal('atlas' in registered.data,false);assert.equal('catalog' in registered.data,false);
 assert.match(registered.cookie||'',/^abujalife_session=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/);
 const cookie=registered.cookie.split(';')[0],entry=await f.request('/api/entry',{cookie});
 assert.equal(entry.status,200);assert.equal(entry.data.authenticated,true);assert.equal(entry.data.entry,true);assert.equal(entry.data.profile.id,registered.data.residentId);assert.equal(entry.data.profile.username,username);
});

test('login returns a tiny acknowledgement and reload entry uses the same cookie',async t=>{
 const f=await fixture(t),username=`login_${Date.now().toString(36)}`,password='Disposable login 2026!';
 await f.request('/api/auth/register',{method:'POST',body:{displayName:'Login Resident',username,password,appearance}});
 const login=await f.request('/api/auth/login',{method:'POST',body:{username,password}});
 assert.equal(login.status,200);assert.deepEqual(Object.keys(login.data).sort(),['authenticated','ok','residentId']);
 assert.equal(login.data.ok,true);assert.equal(login.data.authenticated,true);assert.equal('profile' in login.data,false);assert.equal('entry' in login.data,false);
 const cookie=login.cookie.split(';')[0],entry=await f.request('/api/entry',{cookie});
 assert.equal(entry.status,200);assert.equal(entry.data.authenticated,true);assert.equal(entry.data.profile.id,login.data.residentId);assert.equal(entry.data.profile.username,username);
});

test('anonymous entry is harmless and logout invalidates the canonical session',async t=>{
 const f=await fixture(t),username=`logout_${Date.now().toString(36)}`,password='Disposable logout 2026!';
 const anonymous=await f.request('/api/entry');assert.equal(anonymous.status,200);assert.equal(anonymous.data.authenticated,false);assert.equal(anonymous.data.entry,true);
 const registered=await f.request('/api/auth/register',{method:'POST',body:{displayName:'Logout Resident',username,password,appearance}}),cookie=registered.cookie.split(';')[0];
 const logout=await f.request('/api/auth/logout',{method:'POST',body:{},cookie});
 assert.equal(logout.status,200);assert.equal(logout.data.authenticated,false);assert.match(logout.cookie||'',/Max-Age=0/);
 const after=await f.request('/api/entry',{cookie});assert.equal(after.status,200);assert.equal(after.data.authenticated,false);
});

test('legacy startup stack is physically absent and both HTTP servers dispatch one sessionRuntime directly',async()=>{
 const absent=['src/server/coreEntry.mjs','src/server/entryBootstrap.mjs','src/server/fastStartup.mjs'];
 for(const file of absent)await assert.rejects(fs.access(file));
 const [dev,production,localHttp,productionHttp,sessionSource,client,auth,app,integration]=await Promise.all(['scripts/dev.mjs','src/server/production.mjs','src/server/http.mjs','src/server/production-http.mjs','src/server/sessionRuntime.mjs','app/api-client.js','app/auth-session.js','app/app.js','tests/production-integration.mjs'].map(file=>fs.readFile(file,'utf8')));
 const runtimeText=`${dev}\n${production}`;
 assert.doesNotMatch(runtimeText,/attachSessionRuntime/);assert.match(production,/attachLiveActions/);assert.doesNotMatch(runtimeText,/attachCoreEntry|attachEntryBootstrap|attachFastStartup|coreEntry\.mjs|entryBootstrap\.mjs|fastStartup\.mjs/);
 const serverText=`${localHttp}\n${productionHttp}`;assert.match(localHttp,/sessionRuntime\.handle\(req,res\)/);assert.match(productionHttp,/sessionRuntime\.handle\(req,res\)/);assert.doesNotMatch(sessionSource,/attachSessionRuntime/);assert.doesNotMatch(serverText,/bootstrap\(session\.residentId|\{startup,\.\.\.credentials\}|startup:url\.searchParams|get\('startup'\)|startup===true/);
 assert.doesNotMatch(sessionSource,/\.\.\.entryState|await state\(session\.residentId\)/);
 assert.match(sessionSource,/\{ok:true,authenticated:true,residentId:session\.residentId\}/);
 const clientText=`${client}\n${auth}\n${app}`;
 for(const forbidden of ['/api/auth/login/fast','/api/auth/register/fast','/api/bootstrap/fast','?session=1','/api/bootstrap?startup=1'])assert.equal(clientText.includes(forbidden),false,`legacy client route survived: ${forbidden}`);
 assert.match(auth,/acknowledgement=await api/);assert.match(auth,/const recovered=await readSession\(\)/);
 assert.match(app,/startup\?'\/api\/entry':'\/api\/bootstrap'/);
 assert.doesNotMatch(app,/if\(!next\.authenticated\)\{expireAccount\(\);return;\}/);
 assert.match(integration,/request\('\/api\/entry'/);
 assert.doesNotMatch(integration,/\/api\/bootstrap\?startup=1|startup:true/);
});

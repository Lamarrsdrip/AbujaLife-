import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from '../src/server/http.mjs';
import {attachSessionRuntime} from '../src/server/sessionRuntime.mjs';

const appearance={skinTone:'brown',hair:'crop',top:'forest',bottom:'charcoal',shoes:'white',body:'regular',face:'oval',presentation:'neutral',facialHair:'none',accessory:'none'};

async function fixture(t){
 const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'abujalife-session-runtime-'));
 const server=createServer({dataDir});
 attachSessionRuntime(server,{store:server.store,admin:server.admin,social:server.social,corsOrigins:['http://localhost'],publicWebUrl:'http://localhost',secureCookies:false});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeRealtime();await new Promise(resolve=>server.close(resolve));await fs.rm(dataDir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(route,{method='GET',body,cookie}={})=>{
  const response=await fetch(`${base}${route}`,{method,headers:{origin:'http://localhost',...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
 };
 return{server,request};
}

test('register is one canonical session-and-entry handshake',async t=>{
 const f=await fixture(t),username=`qa_${Date.now().toString(36)}`,password='Disposable resident 2026!';
 const registered=await f.request('/api/auth/register',{method:'POST',body:{displayName:'QA Resident',username,password,appearance}});
 assert.equal(registered.status,201);assert.equal(registered.data.ok,true);assert.equal(registered.data.authenticated,true);assert.equal(registered.data.entry,true);
 assert.equal(registered.data.profile.username,username);assert.equal(registered.data.profile.id,registered.data.residentId);
 assert.match(registered.cookie||'',/^abujalife_session=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/);
 const cookie=registered.cookie.split(';')[0],entry=await f.request('/api/entry',{cookie});
 assert.equal(entry.status,200);assert.equal(entry.data.authenticated,true);assert.equal(entry.data.entry,true);assert.equal(entry.data.profile.id,registered.data.profile.id);
});

test('login returns the playable resident in the same response and reload entry uses the same cookie',async t=>{
 const f=await fixture(t),username=`login_${Date.now().toString(36)}`,password='Disposable login 2026!';
 await f.request('/api/auth/register',{method:'POST',body:{displayName:'Login Resident',username,password,appearance}});
 const login=await f.request('/api/auth/login',{method:'POST',body:{username,password}});
 assert.equal(login.status,200);assert.equal(login.data.ok,true);assert.equal(login.data.authenticated,true);assert.equal(login.data.entry,true);assert.equal(login.data.profile.username,username);
 const cookie=login.cookie.split(';')[0],entry=await f.request('/api/entry',{cookie});
 assert.equal(entry.status,200);assert.equal(entry.data.authenticated,true);assert.equal(entry.data.profile.id,login.data.profile.id);
});

test('anonymous entry is harmless and logout invalidates the canonical session',async t=>{
 const f=await fixture(t),username=`logout_${Date.now().toString(36)}`,password='Disposable logout 2026!';
 const anonymous=await f.request('/api/entry');assert.equal(anonymous.status,200);assert.equal(anonymous.data.authenticated,false);assert.equal(anonymous.data.entry,true);
 const registered=await f.request('/api/auth/register',{method:'POST',body:{displayName:'Logout Resident',username,password,appearance}}),cookie=registered.cookie.split(';')[0];
 const logout=await f.request('/api/auth/logout',{method:'POST',body:{},cookie});
 assert.equal(logout.status,200);assert.equal(logout.data.authenticated,false);assert.match(logout.cookie||'',/Max-Age=0/);
 const after=await f.request('/api/entry',{cookie});assert.equal(after.status,200);assert.equal(after.data.authenticated,false);
});

test('legacy startup stack is physically absent and normal runtimes only attach sessionRuntime',async()=>{
 const absent=['src/server/coreEntry.mjs','src/server/entryBootstrap.mjs','src/server/fastStartup.mjs'];
 for(const file of absent)await assert.rejects(fs.access(file));
 const [dev,production,client,auth,app,integration]=await Promise.all(['scripts/dev.mjs','src/server/production.mjs','app/api-client.js','app/auth-session.js','app/app.js','tests/production-integration.mjs'].map(file=>fs.readFile(file,'utf8')));
 const runtimeText=`${dev}\n${production}`;
 assert.match(runtimeText,/attachSessionRuntime/);assert.match(production,/attachLiveActions/);assert.doesNotMatch(runtimeText,/attachCoreEntry|attachEntryBootstrap|attachFastStartup|coreEntry\.mjs|entryBootstrap\.mjs|fastStartup\.mjs/);
 const clientText=`${client}\n${auth}\n${app}`;
 for(const forbidden of ['/api/auth/login/fast','/api/auth/register/fast','/api/bootstrap/fast','?session=1','/api/bootstrap?startup=1'])assert.equal(clientText.includes(forbidden),false,`legacy client route survived: ${forbidden}`);
 assert.match(app,/startup\?'\/api\/entry':'\/api\/bootstrap'/);
 assert.doesNotMatch(app,/if\(!next\.authenticated\)\{expireAccount\(\);return;\}/);
 assert.match(integration,/request\('\/api\/entry'/);
 assert.doesNotMatch(integration,/\/api\/bootstrap\?startup=1|startup:true/);
});

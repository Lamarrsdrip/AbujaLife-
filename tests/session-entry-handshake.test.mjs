import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server/http.mjs';
import { attachEntryBootstrap } from '../src/server/entryBootstrap.mjs';
import { attachCoreEntry } from '../src/server/coreEntry.mjs';

async function fixture(){
 const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'abujalife-session-entry-'));
 const server=createServer({dataDir});
 const entry=attachEntryBootstrap(server,{store:server.store,admin:server.admin,social:server.social,corsOrigins:['http://localhost'],publicWebUrl:'http://localhost'});
 attachCoreEntry(server,{store:server.store,admin:server.admin,social:server.social,corsOrigins:['http://localhost'],publicWebUrl:'http://localhost',secureCookies:false,entryState:entry.state});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return{
  server,
  base:`http://127.0.0.1:${server.address().port}`,
  async close(){server.closeRealtime();await new Promise(resolve=>server.close(resolve));await fs.rm(dataDir,{recursive:true,force:true});}
 };
}

const appearance={skinTone:'brown',hair:'crop',top:'forest',bottom:'charcoal',shoes:'white',body:'regular',face:'oval',presentation:'neutral',facialHair:'none',accessory:'none'};

test('local register is one session handshake and its cookie authenticates entry reloads',async t=>{
 const f=await fixture();t.after(()=>f.close());
 const username=`qa_${Date.now().toString(36)}`;
 const response=await fetch(`${f.base}/api/auth/register?session=1`,{
  method:'POST',headers:{'content-type':'application/json','origin':'http://localhost'},
  body:JSON.stringify({displayName:'QA Resident',username,password:'Disposable password 2026!',appearance})
 });
 const body=await response.json();
 assert.equal(response.status,201);assert.equal(body.ok,true);assert.equal(body.authenticated,true);assert.equal(body.entry,true);assert.equal(body.startup,true);
 assert.equal(body.profile.username,username);assert.equal(body.profile.id,body.residentId);
 const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.match(cookie||'',/^abujalife_session=[a-f0-9]{64}$/);
 const entryResponse=await fetch(`${f.base}/api/entry`,{headers:{cookie}}),entryBody=await entryResponse.json();
 assert.equal(entryResponse.status,200);assert.equal(entryBody.authenticated,true);assert.equal(entryBody.entry,true);assert.equal(entryBody.profile.id,body.profile.id);
});

test('local login returns playable entry snapshot without a second session confirmation request',async t=>{
 const f=await fixture();t.after(()=>f.close());
 const username=`login_${Date.now().toString(36)}`,password='Disposable login 2026!';
 const registered=await fetch(`${f.base}/api/auth/register?session=1`,{method:'POST',headers:{'content-type':'application/json','origin':'http://localhost'},body:JSON.stringify({displayName:'Login Resident',username,password,appearance})});
 assert.equal(registered.status,201);
 const login=await fetch(`${f.base}/api/auth/login?session=1`,{method:'POST',headers:{'content-type':'application/json','origin':'http://localhost'},body:JSON.stringify({username,password})}),body=await login.json();
 assert.equal(login.status,200);assert.equal(body.ok,true);assert.equal(body.authenticated,true);assert.equal(body.entry,true);assert.equal(body.profile.username,username);assert.equal(body.profile.id,body.residentId);
 assert.match(login.headers.get('set-cookie')||'',/^abujalife_session=[a-f0-9]{64};/);
});

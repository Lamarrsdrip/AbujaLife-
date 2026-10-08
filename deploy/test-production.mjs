#!/usr/bin/env node
// Disposable infrastructure acceptance. It never accepts a production URI,
// uses a unique Compose project, and deletes only that project's own volumes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MongoClient} from 'mongodb';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-infra-'));
const project='abujalife-qa-'+crypto.randomBytes(6).toString('hex');
const releaseId=crypto.randomBytes(6).toString('hex')+'-'+crypto.randomBytes(6).toString('hex');
const images={mongo:'abujalife-mongo:'+releaseId,ops:'abujalife-ops:'+releaseId,api:'abujalife-api:'+releaseId};
// Preserve the host Docker CLI plugin discovery when the caller did not
// provide an explicit config. Pointing DOCKER_CONFIG at a fresh directory
// hides Docker Compose on macOS installations where it is installed as a
// user CLI plugin, making this acceptance test fail before infrastructure is
// even exercised.
const environment={...process.env,...(process.env.DOCKER_CONFIG?{DOCKER_CONFIG:process.env.DOCKER_CONFIG}:{}),ABUJALIFE_DEPLOY_ENV_FILE:path.join(directory,'.env'),ABUJALIFE_RELEASE_STATE_DIR:path.join(directory,'releases'),ABUJALIFE_PROJECT_NAME:project,ABUJALIFE_SECRETS_DIR:path.join(directory,'.secrets'),ABUJALIFE_BACKUP_DIR:path.join(directory,'backups'),ABUJALIFE_MONGO_IMAGE:images.mongo,ABUJALIFE_OPS_IMAGE:images.ops,ABUJALIFE_API_IMAGE:images.api,ABUJALIFE_API_LOOPBACK_PORT:'0',ABUJALIFE_OPS_DIAGNOSTICS:'1'};
const active=new Set();let client,restoreAdmin,composeCreated=false,failed=false;
async function run(command,arguments_,{capture=false,input,env={}}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,arguments_,{cwd:root,env:{...environment,...env},stdio:capture||input!==undefined?['pipe','pipe','pipe']:'inherit'});active.add(child);let out='',error='';
    if(capture||input!==undefined){child.stdout.on('data',part=>out+=part.toString());child.stderr.on('data',part=>error+=part.toString());}
    if(input!==undefined)child.stdin.end(input);
    child.on('error',reject);child.on('exit',code=>{active.delete(child);code===0?resolve(out):reject(new Error(`${command} failed (${code}). ${capture?error.slice(-1200):''}`));});
  });
}
const compose=(arguments_,options)=>run('docker',['compose','--project-name',project,'--env-file',path.join(directory,'.env'),'-f',path.join(root,'deploy/compose.yml'),'-f',path.join(root,'deploy/compose.qa.yml'),...arguments_],options);
async function waitFor(check,label){for(let attempt=0;attempt<360;attempt++){try{if(await check())return;}catch{}await new Promise(resolve=>setTimeout(resolve,500));}throw new Error(label+' did not become ready.');}
async function build(arguments_){
  const args=['build','--network','host','--build-arg','HTTPS_PROXY','--build-arg','HTTP_PROXY','--build-arg','NO_PROXY'];
  const proxies=new Set();for(const name of ['HTTPS_PROXY','HTTP_PROXY'])if(process.env[name])proxies.add(new URL(process.env[name]).hostname);
  for(const host of proxies){const answer=await dns.lookup(host);args.push('--add-host',host+':'+answer.address);}
  if(process.env.NODE_EXTRA_CA_CERTS)args.push('--secret','id=build-ca,src='+process.env.NODE_EXTRA_CA_CERTS);
  await run('docker',[...args,...arguments_,'.']);
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{failed=true;for(const child of active)child.kill(signal);});
try{
  await run(process.execPath,['deploy/init-env.mjs',directory]);
  await compose(['config','--quiet']);
  await build(['-f','deploy/Dockerfile.mongo','-t',images.mongo]);
  await build(['--target','ops','-t',images.ops]);
  await build(['--target','runtime','-t',images.api]);
  composeCreated=true;await compose(['up','-d','--no-build','mongo']);
  try{await waitFor(async()=>(await run('docker',['inspect','--format','{{.State.Health.Status}}',project+'-mongo-1'],{capture:true})).trim()==='healthy','Authenticated Mongo');}
  catch(error){console.error(await run('docker',['logs','--tail','30',project+'-mongo-1'],{capture:true}));console.error(await run('docker',['inspect','--format','{{json .State.Health}}',project+'-mongo-1'],{capture:true}));throw error;}
  await compose(['run','--rm','--no-deps','bootstrap']);
  const mongoPorts=JSON.parse(await run('docker',['inspect','--format','{{json .NetworkSettings.Ports}}',project+'-mongo-1'],{capture:true}));
  const mongoPort=mongoPorts['27017/tcp']?.find(mapping=>mapping.HostIp==='127.0.0.1')?.HostPort;
  assert.ok(mongoPort,'Disposable Mongo must publish only to a loopback host port: '+JSON.stringify(mongoPorts));
  const password=fs.readFileSync(path.join(directory,'.secrets/mongo-app-password'),'utf8').trim();
  const uri=`mongodb://abujalife_app:${encodeURIComponent(password)}@127.0.0.1:${mongoPort}/abujalife_prod?replicaSet=abujalife&authSource=abujalife_prod&directConnection=true`;
  const configFile=path.join(directory,'test-mongodb.json');fs.writeFileSync(configFile,JSON.stringify({uri,database:'abujalife_prod'}),{mode:0o600});
  const testEnvironment={TEST_MONGODB_CONFIG:configFile,TEST_MONGODB_URI:'',TEST_MONGODB_DATABASE:'abujalife_prod'};
  const integrationFiles=fs.readdirSync(path.join(root,'tests')).filter(name=>/^mongo-.*\.integration\.mjs$/.test(name)).sort().map(name=>'tests/'+name);
  // Files share global provider configuration and scheduled game records in
  // this disposable database. Keep their fixtures isolated; each file still
  // exercises simultaneous requests and database races within its own tests.
  assert.ok(integrationFiles.length>=3);await run(process.execPath,['--test','--test-concurrency=1',...integrationFiles],{env:testEnvironment});
  const portServer=net.createServer();await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));const httpPort=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
  await run('npm',['run','qa:production'],{env:{...testEnvironment,ABUJALIFE_QA_HTTP_PORT:String(httpPort)}});
  await compose(['up','-d','--no-build','api']);
  const published=JSON.parse(await run('docker',['inspect','--format','{{json .NetworkSettings.Ports}}',project+'-api-1'],{capture:true}));
  const recordedPort=published['3000/tcp']?.find(mapping=>mapping.HostIp==='127.0.0.1')?.HostPort;
  assert.ok(recordedPort,'Disposable API must publish only to a loopback host port: '+JSON.stringify(published));
  let base='http://127.0.0.1:'+recordedPort;
  await waitFor(async()=>{const response=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)});return response.ok&&(await response.json()).storage==='mongodb';},'Actual production API container');
  const uid=await run('docker',['exec',project+'-api-1','node','-e',"const s=require('fs').readFileSync('/proc/1/status','utf8');console.log(/^Uid:\\s+(\\d+)/m.exec(s)[1])"],{capture:true});assert.equal(uid.trim(),'1000');
  fs.mkdirSync(environment.ABUJALIFE_RELEASE_STATE_DIR,{mode:0o700});
  fs.writeFileSync(path.join(environment.ABUJALIFE_RELEASE_STATE_DIR,'current.json'),JSON.stringify({releaseId,environment:{ABUJALIFE_MONGO_IMAGE:images.mongo,ABUJALIFE_OPS_IMAGE:images.ops,ABUJALIFE_API_IMAGE:images.api,ABUJALIFE_API_LOOPBACK_PORT:recordedPort}}),{mode:0o600});
  const username='infra_'+crypto.randomBytes(5).toString('hex');
  const response=await fetch(base+'/api/auth/register',{method:'POST',headers:{origin:'https://abujacity.life','content-type':'application/json'},body:JSON.stringify({username,password:crypto.randomBytes(18).toString('base64url'),displayName:'Before backup'})});
  assert.equal(response.status,201);const registered=await response.json(),cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal(registered.authenticated,true);assert.equal(typeof registered.residentId,'string');assert.equal(registered.profile,undefined);
  const entryResponse=await fetch(base+'/api/entry',{headers:{origin:'https://abujacity.life',cookie}});assert.equal(entryResponse.status,200);const entry=await entryResponse.json();assert.equal(entry.profile.id,registered.residentId);
  await compose(['exec','-T','api','node','deploy/admin-bootstrap.mjs','--username',username]);
  client=new MongoClient(uri);await client.connect();const db=client.db('abujalife_prod');
  const ledgerCount=await db.collection('ledger').countDocuments();
  const backupOutput=await run(process.execPath,['deploy/backup-run.mjs'],{capture:true,env:{ABUJALIFE_OPS_IMAGE:'abujalife-ops:unavailable-fixture-image'}});
  const backup=backupOutput.split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)).find(value=>value.backup);assert.ok(backup?.consistent);assert.equal(backup.encryption,'AES-256-GCM');
  const filename=path.basename(backup.backup),encrypted=path.join(directory,'backups',filename);assert.ok(fs.statSync(encrypted).size>36);assert.equal(fs.statSync(encrypted).mode&0o777,0o600);
  const change=await fetch(base+'/api/profile',{method:'POST',headers:{origin:'https://abujacity.life',cookie,'content-type':'application/json'},body:JSON.stringify({displayName:'After backup'})});assert.equal(change.status,200);
  await run(process.execPath,['deploy/compose.mjs','stop','api']);
  const rootPassword=fs.readFileSync(path.join(directory,'.secrets/mongo-root-password'),'utf8').trim();
  restoreAdmin=new MongoClient(`mongodb://abujalife_bootstrap:${encodeURIComponent(rootPassword)}@127.0.0.1:${mongoPort}/admin?replicaSet=abujalife&authSource=admin&directConnection=true`);
  await restoreAdmin.connect();
  await restoreAdmin.db('abujalife_prod').collection('restore_post_snapshot_probe').insertOne({_id:'must-not-survive',createdAfterSnapshot:true});
  const corruptName='tampered.abjl.enc',corrupt=fs.readFileSync(encrypted);corrupt[24]^=1;fs.writeFileSync(path.join(directory,'backups',corruptName),corrupt,{mode:0o600});
  let corruptionRejected=false;try{await run(process.execPath,['deploy/restore-run.mjs',corruptName,'--confirm','abujalife_prod'],{capture:true,env:{ABUJALIFE_OPS_IMAGE:'abujalife-ops:unavailable-fixture-image'}});}catch{corruptionRejected=true;}
  assert.ok(corruptionRejected);assert.equal((await db.collection('residents').findOne({id:registered.residentId})).displayName,'After backup');
  assert.ok(await restoreAdmin.db('abujalife_prod').collection('restore_post_snapshot_probe').findOne({_id:'must-not-survive'}));
  await run(process.execPath,['deploy/restore-run.mjs',filename,'--confirm','abujalife_prod'],{env:{ABUJALIFE_OPS_IMAGE:'abujalife-ops:unavailable-fixture-image'}});
  assert.equal(await restoreAdmin.db('abujalife_prod').collection('restore_post_snapshot_probe').countDocuments(),0);
  assert.equal((await db.collection('residents').findOne({id:registered.residentId})).displayName,'Before backup');assert.equal(await db.collection('ledger').countDocuments(),ledgerCount);
  await run(process.execPath,['deploy/compose.mjs','up','-d','--no-build','--no-deps','api']);
  base='http://127.0.0.1:'+recordedPort;
  await waitFor(async()=>(await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)})).ok,'Restored API');
  const persisted=await fetch(base+'/api/bootstrap',{headers:{origin:'https://abujacity.life',cookie}});assert.equal(persisted.status,200);const restored=await persisted.json();assert.equal(restored.profile.wallet,entry.profile.wallet);assert.equal(restored.profile.displayName,'Before backup');assert.equal(restored.admin.role,'superadmin');
  console.log('PASS actual API container runs as UID 1000; recorded immutable images selected; consistent encrypted backup; tampering rejects before writes; complete snapshot excludes newer collections; database/session/wallet/admin survive restore and process restart.');
}catch(error){failed=true;console.error(error.message);}
finally{
  if(client)await client.close();if(restoreAdmin)await restoreAdmin.close();
  if(composeCreated){try{await compose(['down','--volumes','--remove-orphans']);}catch{failed=true;}}
  for(const image of Object.values(images)){try{await run('docker',['image','rm',image],{capture:true});}catch{}}
  fs.rmSync(directory,{recursive:true,force:true});
}
if(failed)process.exitCode=1;

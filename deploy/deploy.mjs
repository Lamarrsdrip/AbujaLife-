#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {configuration,compose,ROOT,releaseStateDirectory} from './config.mjs';
import {verifyRelease} from './verify-release.mjs';
import {healthCheck} from './health-check.mjs';
const {manifest,releaseId}=verifyRelease(ROOT);
if(manifest.workingTreeChanged&&process.env.ABUJALIFE_ALLOW_DIRTY_RELEASE!=='1')throw new Error('Deploy a committed CI-validated release. This archive records uncommitted changes.');
const config=configuration(),port=Number(config.ABUJALIFE_API_LOOPBACK_PORT||18787);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Select an unprivileged loopback API port.');
await compose(['config','--quiet']);
const current=compose(['ps','--status','running','--format','json','api'],{capture:true}).trim();
const runningApis=!current?[]:current.startsWith('[')?JSON.parse(current):current.split(/\r?\n/).map(line=>JSON.parse(line));
const portBelongsToApi=runningApis.some(service=>service.Publishers?.some(published=>published.URL==='127.0.0.1'&&Number(published.PublicPort)===port&&Number(published.TargetPort)===3000));
if(!portBelongsToApi)await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(new Error('The API loopback port is already used. Inspect the VPS and choose another; no existing service was stopped.')));probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
const stateDirectory=releaseStateDirectory(config);
fs.mkdirSync(stateDirectory,{recursive:true,mode:0o700});const stateFile=path.join(stateDirectory,'current.json');
const previous=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):null;
const existingMongo=compose(['ps','--all','--format','json','mongo'],{capture:true}).trim();
const environment={ABUJALIFE_API_IMAGE:'abujalife-api:'+releaseId,ABUJALIFE_OPS_IMAGE:'abujalife-ops:'+releaseId,ABUJALIFE_MONGO_IMAGE:'abujalife-mongo:'+releaseId,ABUJALIFE_API_LOOPBACK_PORT:String(port)};
await compose(['build','mongo','bootstrap','api'],{environment});
if(previous||(current&&current!=='[]')||(existingMongo&&existingMongo!=='[]')){
  const result=compose(['--profile','ops','run','--rm','--no-deps','backup'],{capture:true,environment:previous?.environment||environment});
  if(!result.split(/\r?\n/).some(line=>line.startsWith('{')&&JSON.parse(line).ok===true))throw new Error('A verified pre-update backup is required. Deployment stopped.');
}
let healthy=false,startFailed=false;
try{await compose(['up','-d','--no-build','mongo','bootstrap','api'],{environment});}
catch{startFailed=true;}
if(!startFailed)for(let attempt=0;attempt<30;attempt++){try{await healthCheck('http://127.0.0.1:'+port);healthy=true;break;}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
if(!healthy){
  if(previous?.environment?.ABUJALIFE_API_IMAGE){
    try{
      await compose(['up','-d','--no-build','--no-deps','api'],{environment:previous.environment});
      let recovered=false;for(let attempt=0;attempt<30;attempt++){try{await healthCheck('http://127.0.0.1:'+previous.environment.ABUJALIFE_API_LOOPBACK_PORT);recovered=true;break;}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
      if(!recovered)throw new Error('Prior API was not ready.');
      console.error('New API failed startup or readiness; prior immutable API image restored. Database was not reverted.');
    }
    catch{console.error('Prior API could not read the migrated database. Use the known-compatible release and explicit backup restore procedure.');}
  }else{try{await compose(['stop','api']);}catch{console.error('Inspect and stop the failed AbujaLife API service before retrying.');}}
  throw new Error('Release did not pass actual Mongo API readiness. No successful release was recorded.');
}
fs.writeFileSync(stateFile,JSON.stringify({releaseId,revision:manifest.revision,environment,previous:previous?.releaseId||null,completedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({ok:true,releaseId,api:'http://127.0.0.1:'+port,publicHttps:'not-provisioned-by-this-command',proxy:'integrate API vhost after existing Okrika inspection'}));

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {spawn} from 'node:child_process';
import {MongoClient} from 'mongodb';
export const DATABASE='abujalife_prod';
const MAGIC=Buffer.from('ABJLBN01');
export function secret(name){return fs.readFileSync(path.join(process.env.ABUJALIFE_SECRETS_DIR||'/run/secrets',name),'utf8').trim();}
export function toolDatabasePath(authSource=DATABASE,databasePath){return databasePath===undefined?(authSource==='admin'?'':DATABASE):databasePath;}
export function uri(user,passwordFile,authSource=DATABASE,databasePath){
  if(process.env.MONGODB_DATABASE&&process.env.MONGODB_DATABASE!==DATABASE)throw new Error('Operations are restricted to abujalife_prod.');
  const host=process.env.MONGODB_HOST||'mongo:27017';
  if(!/^(mongo|localhost|127\.0\.0\.1):\d+$/.test(host))throw new Error('Operations require the dedicated private Mongo service or a local integration endpoint.');
  const selectedDatabase=toolDatabasePath(authSource,databasePath),selected=selectedDatabase?`/${selectedDatabase}`:'/';
  return `mongodb://${user}:${encodeURIComponent(secret(passwordFile))}@${host}${selected}?authSource=${authSource}&replicaSet=abujalife&directConnection=true`;
}
export async function connect(uriValue){
  const client=new MongoClient(uriValue,{serverSelectionTimeoutMS:15000});await client.connect();
  const hello=await client.db('admin').command({hello:1});
  if(hello.setName!=='abujalife'||!hello.isWritablePrimary){await client.close();throw new Error('The isolated abujalife replica set must have a writable primary.');}
  return client;
}
export function temporaryDirectory(){return fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-ops-'));}
export function toolConfiguration(directory,uriValue){const file=path.join(directory,'tools.json');fs.writeFileSync(file,JSON.stringify({uri:uriValue})+'\n',{mode:0o600});return file;}
function diagnosticOutput(value){
  let sanitized=value.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/g,'[redacted Mongo URI]');
  for(const name of ['mongo-root-password','mongo-app-password','mongo-backup-password','mongo-app-uri','config-key','backup-key']){
    let value_;try{value_=secret(name);}catch{continue;}
    if(value_)for(const form of [value_,encodeURIComponent(value_)])sanitized=sanitized.split(form).join('[redacted secret]');
  }
  return sanitized;
}
export function runTool(tool,arguments_){return new Promise((resolve,reject)=>{
  const process_=spawn(tool,arguments_,{stdio:['ignore','ignore','pipe']});let diagnostic='';
  process_.stderr.on('data',part=>{diagnostic=(diagnostic+part.toString()).slice(-8192);});
  process_.on('error',()=>reject(new Error(`${tool} could not start. No successful operation is recorded.`)));
  process_.on('exit',code=>code===0?resolve():reject(new Error(`${tool} failed with exit code ${code}. No successful operation is recorded.${process.env.ABUJALIFE_OPS_DIAGNOSTICS==='1'?'\n'+diagnosticOutput(diagnostic):''}`)));
});}
function backupKey(){const value=secret('backup-key');if(!/^[a-f0-9]{64}$/i.test(value))throw new Error('The private backup key must be a stable 32-byte hex key.');return Buffer.from(value,'hex');}
export async function encryptArchive(source,destination){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',backupKey(),iv);cipher.setAAD(MAGIC);
  fs.writeFileSync(destination,Buffer.concat([MAGIC,iv]),{flag:'wx',mode:0o600});
  try{await pipeline(fs.createReadStream(source),cipher,fs.createWriteStream(destination,{flags:'a'}));fs.appendFileSync(destination,cipher.getAuthTag());}
  catch(error){fs.rmSync(destination,{force:true});throw error;}
}
export async function decryptArchive(source,destination){
  const stat=fs.statSync(source);if(stat.size<37)throw new Error('Encrypted backup is incomplete.');
  const descriptor=fs.openSync(source,'r'),header=Buffer.alloc(20),tag=Buffer.alloc(16);
  try{fs.readSync(descriptor,header,0,20,0);fs.readSync(descriptor,tag,0,16,stat.size-16);}finally{fs.closeSync(descriptor);}
  if(!header.subarray(0,8).equals(MAGIC))throw new Error('Encrypted backup format is unsupported.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',backupKey(),header.subarray(8));decipher.setAAD(MAGIC);decipher.setAuthTag(tag);
  fs.writeFileSync(destination,'',{flag:'wx',mode:0o600});
  try{await pipeline(fs.createReadStream(source,{start:20,end:stat.size-17}),decipher,fs.createWriteStream(destination,{flags:'a'}));}
  catch{fs.rmSync(destination,{force:true});throw new Error('Backup authentication failed. Restore has not started.');}
}

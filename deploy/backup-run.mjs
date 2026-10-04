#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT,configuration,compose} from './config.mjs';
const config=configuration();
const output=compose(['--profile','ops','run','--rm','--no-deps','backup'],{capture:true,deployed:true});
const result=output.split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)).find(value=>value.ok&&value.backup);
if(!result||result.consistent!==true||result.encryption!=='AES-256-GCM')throw new Error('No successful consistent encrypted backup result was returned.');
const directory=path.resolve(config.ABUJALIFE_BACKUP_DIR||path.join(ROOT,'deploy/backups'));
const file=path.join(directory,path.basename(result.backup));
if(!fs.existsSync(file))throw new Error('The encrypted backup is not present on the host.');
let offServer='not-configured';
if(config.BACKUP_OFFSERVER_TARGET){
  if(!/^[A-Za-z0-9_.-]+@[A-Za-z0-9.-]+:\/[A-Za-z0-9_./-]+$/.test(config.BACKUP_OFFSERVER_TARGET))throw new Error('Use user@host:/absolute/path for the separate backup target.');
  if(!config.BACKUP_OFFSERVER_KEY_FILE||!fs.existsSync(config.BACKUP_OFFSERVER_KEY_FILE))throw new Error('Configure the separate backup host SSH key before uploading.');
  execFileSync('scp',['-B','-i',config.BACKUP_OFFSERVER_KEY_FILE,'-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15',file,config.BACKUP_OFFSERVER_TARGET],{stdio:'inherit'});
  offServer='uploaded';
}
const retention=Number(config.BACKUP_RETENTION_DAYS||14);
if(!Number.isSafeInteger(retention)||retention<1)throw new Error('BACKUP_RETENTION_DAYS must be a positive whole number.');
const before=Date.now()-retention*86400000;
for(const name of fs.readdirSync(directory))if(/^abujalife-.*\.abjl\.enc$/.test(name)){const candidate=path.join(directory,name);if(candidate!==file&&fs.lstatSync(candidate).isFile()&&fs.statSync(candidate).mtimeMs<before)fs.unlinkSync(candidate);}
const receipt={ok:true,backup:file,consistent:true,encryption:'AES-256-GCM',offServer,retentionDays:retention,completedAt:new Date().toISOString()};
fs.writeFileSync(path.join(directory,'latest-backup.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(receipt));

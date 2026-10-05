import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {Writable} from 'node:stream';

const destination = process.argv[2] || path.join(os.homedir(), 'AbujaLife-backups');
fs.mkdirSync(destination, {recursive:true, mode:0o700});
fs.chmodSync(destination, 0o700);
const sshArguments = ['-i',path.join(os.homedir(),'.ssh/id_ed25519'),'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15'];
function command(program, args) {
  const result = spawnSync(program,args,{encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
  if(result.error || result.status!==0) throw new Error(`${path.basename(program)} backup transport failed; no successful pull recorded.`);
  return result.stdout;
}
const readReceipt = "$ProgressPreference='SilentlyContinue'; Get-Content -LiteralPath 'C:\\services\\abujalife\\shared\\backups\\latest-backup.json' -Raw";
const receipt=JSON.parse(command('/usr/bin/ssh',[...sshArguments,'Administrator@173.212.249.202','powershell -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(readReceipt,'utf16le').toString('base64')]));
const name=path.win32.basename(receipt.backup || '');
if(receipt.ok!==true || receipt.database!=='abujalife_prod' || receipt.encryption!=='AES-256-GCM' || receipt.consistent!==true || receipt.validation!=='authenticated decryption and mongorestore --dryRun' || !/^abujalife-[0-9TZ-]+\.abjl\.enc$/.test(name) || !/^[a-f0-9]{64}$/.test(receipt.sha256 || '') || !Number.isSafeInteger(receipt.bytes) || receipt.bytes<37) throw new Error('The server backup receipt did not pass validation.');
if(Date.now()-Date.parse(receipt.completedAt)>48*3600000) throw new Error('Server backup is older than 48 hours; inspect the AbujaLife-Backup scheduled task.');
// Escrow only AbujaLife recovery keys, never the SSH key. The config key is
// needed to decrypt provider settings restored from the production database.
for (const keyName of ['backup-key', 'config-key']) {
  const keyPath = path.join(destination, keyName);
  if (!fs.existsSync(keyPath)) {
    command('/usr/bin/scp', [...sshArguments, 'Administrator@173.212.249.202:C:/services/abujalife/shared/.secrets/' + keyName, keyPath]);
  }
  fs.chmodSync(keyPath, 0o600);
}
const escrow=path.join(destination,'backup-key');
const archive=path.join(destination,name), partial=archive+'.partial';
if(!fs.existsSync(archive)) {
  command('/usr/bin/scp',[...sshArguments,'Administrator@173.212.249.202:C:/services/abujalife/shared/backups/'+name,partial]);
  fs.chmodSync(partial,0o600);
  fs.renameSync(partial,archive);
}
const bytes=fs.readFileSync(archive);
if(bytes.length!==receipt.bytes || crypto.createHash('sha256').update(bytes).digest('hex')!==receipt.sha256 || bytes.subarray(0,8).toString()!=='ABJLBN01') throw new Error('Off-server backup checksum or format failed.');
const key=fs.readFileSync(escrow,'utf8').trim();
if(!/^[a-f0-9]{64}$/i.test(key)) throw new Error('The private backup escrow key has an invalid format.');
const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),bytes.subarray(8,20));
decipher.setAAD(bytes.subarray(0,8)); decipher.setAuthTag(bytes.subarray(-16));
// Authenticate all ciphertext without writing unencrypted player data to disk.
await pipeline(fs.createReadStream(archive,{start:20,end:bytes.length-17}),decipher,new Writable({write(_chunk,_encoding,callback){callback();}}));
fs.writeFileSync(path.join(destination,name+'.json'),JSON.stringify({...receipt,backup:name,offServer:'Mac encrypted copy authenticated',pulledAt:new Date().toISOString(),retentionDays:30},null,2)+'\n',{mode:0o600});
for(const file of fs.readdirSync(destination)) if(/^abujalife-[0-9TZ-]+\.abjl\.enc(?:\.json)?$/.test(file) && fs.statSync(path.join(destination,file)).mtimeMs<Date.now()-30*86400000) fs.rmSync(path.join(destination,file));
for(const file of ['pull.stdout.log','pull.stderr.log']) {const log=path.join(destination,file);if(fs.existsSync(log)&&fs.statSync(log).size>1048576){fs.renameSync(log,log+'.previous');fs.writeFileSync(log,'',{mode:0o600});}}
console.log(JSON.stringify({ok:true,archive:name,sha256:receipt.sha256,encrypted:true,authenticated:true,offServer:'Mac',retentionDays:30,completedAt:new Date().toISOString()}));

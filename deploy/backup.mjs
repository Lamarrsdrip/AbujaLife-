#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {DATABASE,uri,connect,temporaryDirectory,toolConfiguration,runTool,encryptArchive} from './mongo-ops.mjs';
const directory=temporaryDirectory(),output=process.env.BACKUP_OUTPUT_DIR||'/backups';
fs.mkdirSync(output,{recursive:true,mode:0o700});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const destination=path.join(output,`abujalife-${stamp}.abjl.enc`),partial=destination+'.partial';
// `mongodump --oplog` must be a true full replica-set dump. A database name in
// the URI scopes the dump exactly like --db, so the tools URI intentionally
// connects at the replica-set root while authenticating against abujalife_prod.
const backupUri=uri('abujalife_backup','mongo-backup-password',DATABASE,'');let client;
try{
  client=await connect(backupUri);
  const raw=path.join(directory,'database.archive.gz');
  // This is a dedicated AbujaLife MongoDB service, so capture the complete
  // replica-set archive. `mongodump --oplog` is only valid for a full dump;
  // restore filters it back to abujalife_prod and never touches Okrika.
  // Oplog capture keeps the archive point-in-time consistent without taking
  // a write lock on the live database.
  await runTool('mongodump',['--config',toolConfiguration(directory,backupUri),'--archive='+raw,'--gzip','--oplog']);
  await encryptArchive(raw,partial);fs.renameSync(partial,destination);
  // Keep the ciphertext private and readable by the owner of the host backup
  // directory, including a non-root CI/operator using a root ops container.
  const owner=fs.statSync(output);fs.chownSync(destination,owner.uid,owner.gid);
  console.log(JSON.stringify({ok:true,database:DATABASE,backup:destination,bytes:fs.statSync(destination).size,encryption:'AES-256-GCM',consistent:true,offServer:'not-attempted-by-container'}));
}finally{
  if(client)await client.close();fs.rmSync(partial,{force:true});fs.rmSync(directory,{recursive:true,force:true});
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {DATABASE,uri,connect,temporaryDirectory,toolConfiguration,runTool,decryptArchive} from './mongo-ops.mjs';
const arguments_=process.argv.slice(2);
if(arguments_.length!==3||arguments_[1]!=='--confirm'||arguments_[2]!==DATABASE)throw new Error('Usage: node deploy/restore.mjs /backups/FILE.abjl.enc --confirm abujalife_prod. Stop the API first.');
const source=path.resolve(arguments_[0]);
if(!source.startsWith(path.resolve(process.env.BACKUP_OUTPUT_DIR||'/backups')+path.sep))throw new Error('Choose an encrypted file in the protected backups directory.');
const directory=temporaryDirectory();let client;
try{
  const raw=path.join(directory,'database.archive.gz');
  // Authenticate every byte before mongorestore can modify any data.
  await decryptArchive(source,raw);
  // `mongodump --oplog` is a full replica-set dump. MongoDB requires a full
  // restore when replaying that oplog, so do not combine this with nsInclude.
  // AbujaLife has its own dedicated Mongo instance; restoring the instance
  // cannot touch Okrika's separate service/port. Stable bootstrap credentials
  // are included in the same snapshot, so authentication survives the restore.
  const restoreUri=uri('abujalife_bootstrap','mongo-root-password','admin','');client=await connect(restoreUri);
  const restoreArguments=['--config',toolConfiguration(directory,restoreUri),'--archive='+raw,'--gzip','--drop','--oplogReplay','--stopOnError'];
  // Dry-run the exact full/oplog restore contract before replacing anything.
  await runTool('mongorestore',[...restoreArguments,'--dryRun']);
  await runTool('mongorestore',restoreArguments);
  console.log(JSON.stringify({ok:true,database:DATABASE,restored:source,verifiedEncryption:true,oplogReplayed:true,scope:'dedicated-abujalife-mongo-instance'}));
}finally{if(client)await client.close();fs.rmSync(directory,{recursive:true,force:true});}

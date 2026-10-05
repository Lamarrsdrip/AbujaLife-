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
  const restoreUri=uri('abujalife_bootstrap','mongo-root-password','admin');client=await connect(restoreUri);
  // Full archives with oplog replay cannot be namespace-filtered. The Mongo
  // service is dedicated to AbujaLife; restore the snapshot and replay its
  // oplog after dropping only abujalife_prod.
  const restoreArguments=['--config',toolConfiguration(directory,restoreUri),'--archive='+raw,'--gzip','--oplogReplay','--stopOnError'];
  // --drop alone leaves collections created after the selected snapshot.
  // Validate the authenticated archive before replacing this exact isolated DB.
  await runTool('mongorestore',[...restoreArguments,'--dryRun']);
  await client.db(DATABASE).dropDatabase();
  await runTool('mongorestore',restoreArguments);
  console.log(JSON.stringify({ok:true,database:DATABASE,restored:source,verifiedEncryption:true,oplogReplayed:true}));
}finally{if(client)await client.close();fs.rmSync(directory,{recursive:true,force:true});}

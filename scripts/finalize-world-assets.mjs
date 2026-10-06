import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');

async function copyDirectory(source,destination){
  let entries=[];try{entries=await fs.readdir(source,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
  await fs.mkdir(destination,{recursive:true});
  for(const entry of entries){
    const from=path.join(source,entry.name),to=path.join(destination,entry.name);
    if(entry.isDirectory())await copyDirectory(from,to);
    else if(entry.isFile())await fs.copyFile(from,to);
  }
}

// KTX2's Basis transcoder is runtime data, not part of the service-worker shell.
await copyDirectory(path.join(root,'app/vendor/basis'),path.join(dist,'vendor/basis'));
// Optimized GLB/KTX2 art is deliberately outside app/ so the shell builder
// cannot eagerly precache every district. It is streamed by world-assets.js.
await copyDirectory(path.join(root,'assets/world'),path.join(dist,'world-assets'));
console.log('Finalized streamed AbujaLife world assets.');

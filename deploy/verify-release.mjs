#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
export function verifyRelease(directory){
  const root=path.resolve(directory),manifest=JSON.parse(fs.readFileSync(path.join(root,'RELEASE.json'),'utf8'));
  assert.equal(manifest.mode,'production-mongodb-api');assert.equal(manifest.database,'abujalife_prod');
  assert.equal(manifest.publicOrigin,'https://abujacity.life');assert.equal(manifest.apiPublicOrigin,'https://api.abujacity.life');
  assert.match(manifest.revision,/^[a-f0-9]{40}$/);assert.ok(Array.isArray(manifest.files)&&manifest.files.length>10);
  for(const item of manifest.files){
    const file=path.resolve(root,item.path);assert.ok(file.startsWith(root+path.sep));assert.ok(fs.lstatSync(file).isFile());
    const content=fs.readFileSync(file);assert.equal(content.length,item.bytes,item.path);assert.equal(crypto.createHash('sha256').update(content).digest('hex'),item.sha256,item.path);
  }
  const digest=crypto.createHash('sha256').update(JSON.stringify(manifest.files)).digest('hex');
  return{manifest,releaseId:manifest.revision.slice(0,12)+'-'+digest.slice(0,12)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=verifyRelease(process.argv[2]||process.cwd());console.log(JSON.stringify({ok:true,releaseId:result.releaseId,files:result.manifest.files.length,workingTreeChanged:result.manifest.workingTreeChanged}));}

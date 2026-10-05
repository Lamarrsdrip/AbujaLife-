import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionEntryPoints } from '../scripts/build-production.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('every module script declared by production HTML has a production entrypoint',async()=>{
  const html=await fs.readFile(path.join(root,'app/index.html'),'utf8');
  const declared=[...html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']\/([^"']+)["'][^>]*>/gi)].map(match=>match[1]);
  assert.ok(declared.length>0,'index.html should declare production modules');
  const bundled=new Set(Object.values(productionEntryPoints).map(value=>value.replace(/^app\//,'')));
  for(const filename of declared)assert.ok(bundled.has(filename),`${filename} is declared by index.html but missing from the production bundle entrypoints`);
});

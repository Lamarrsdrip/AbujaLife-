import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionEntryPoints } from '../scripts/build-production.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('every script declared by production HTML is external and has a production entrypoint',async()=>{
  const bundled=new Set(Object.values(productionEntryPoints).map(value=>value.replace(/^app\//,'')));
  for(const page of ['index.html','admin.html']){
    const html=await fs.readFile(path.join(root,'app',page),'utf8');
    const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.ok(scripts.length>0,`${page} should declare production scripts`);
    for(const [,attributes,body] of scripts){
      const filename=/\bsrc=["']\/([^"']+)["']/i.exec(attributes)?.[1];
      assert.ok(filename,`${page} has an inline script blocked by production CSP`);
      assert.equal(body.trim(),'','Scripts must load from our origin rather than embed executable content');
      assert.ok(bundled.has(filename),`${filename} is declared by ${page} but missing from the production bundle entrypoints`);
    }
  }
});

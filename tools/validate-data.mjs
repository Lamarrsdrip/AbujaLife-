import fs from 'node:fs'; import path from 'node:path';
const dir=new URL('../data/abuja/',import.meta.url); const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json')); let fail=0;
for(const f of files){try{const value=JSON.parse(fs.readFileSync(new URL(f,dir),'utf8'));const size=Array.isArray(value)?value.length:Object.keys(value).length;console.log(`✓ ${f} (${size})`);}catch(e){console.error(`✗ ${f}: ${e.message}`);fail++;}}
const districts=JSON.parse(fs.readFileSync(new URL('districts.json',dir),'utf8')); const ids=new Set(); for(const d of districts){if(ids.has(d.id)){console.error('duplicate district id',d.id);fail++;}ids.add(d.id);if(!d.name||!d.world)fail++;}
if(fail)process.exit(1);console.log(`Abuja data validation passed: ${files.length} files, ${districts.length} encoded districts/areas.`);

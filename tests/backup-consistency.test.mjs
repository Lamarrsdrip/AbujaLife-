import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const backup=fs.readFileSync(new URL('../deploy/backup.mjs',import.meta.url),'utf8');
const restore=fs.readFileSync(new URL('../deploy/restore.mjs',import.meta.url),'utf8');

test('replica-set backup uses a full oplog dump instead of an invalid scoped dump',()=>{
  assert.match(backup,/runTool\('mongodump',[\s\S]*'--oplog'/);
  assert.doesNotMatch(backup,/mongodump[\s\S]{0,500}'--db'/);
  assert.match(backup,/consistent:true/);
});

test('consistent restore replays the captured oplog without namespace filters',()=>{
  assert.match(restore,/restoreArguments=.*'--oplogReplay'/);
  assert.doesNotMatch(restore,/--nsInclude|--nsExclude/);
  assert.match(restore,/dropDatabase\(\)/);
});

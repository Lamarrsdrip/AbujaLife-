import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DATABASE,toolDatabasePath} from '../deploy/mongo-ops.mjs';

const backup=fs.readFileSync(new URL('../deploy/backup.mjs',import.meta.url),'utf8');
const restore=fs.readFileSync(new URL('../deploy/restore.mjs',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('../deploy/mongo-bootstrap.mjs',import.meta.url),'utf8');

test('replica-set backup uses a full oplog dump instead of an invalid scoped dump',()=>{
  assert.match(backup,/runTool\('mongodump',[\s\S]*'--oplog'/);
  assert.doesNotMatch(backup,/mongodump[\s\S]{0,500}'--db'/);
  assert.match(backup,/consistent:true/);
});

test('backup identity uses MongoDB supported minimal full-instance backup role',()=>{
  assert.match(bootstrap,/\['abujalife_backup','mongo-backup-password','backup','admin'\]/);
  assert.doesNotMatch(bootstrap,/createRole'\]: 'abujalife_backup'/);
  assert.doesNotMatch(bootstrap,/collection:\s*'transactions'/);
});

test('admin ops connection stays unscoped for oplog restore while app ops remain scoped',()=>{
  assert.equal(toolDatabasePath('admin'), '');
  assert.equal(toolDatabasePath(DATABASE), DATABASE);
  assert.equal(toolDatabasePath('admin',DATABASE), DATABASE);
});

test('consistent restore replays the captured oplog without namespace filters',()=>{
  assert.match(restore,/restoreArguments=.*'--oplogReplay'/);
  assert.doesNotMatch(restore,/--nsInclude|--nsExclude/);
  assert.match(restore,/dropDatabase\(\)/);
});

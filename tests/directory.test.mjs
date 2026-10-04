import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore } from '../src/server/gameStore.mjs';
import { ResidentDirectory } from '../src/server/residentDirectory.mjs';

async function fixture(t) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'abuja-directory-'));
  const store=new GameStore({dataDir:directory,clock:()=>Date.parse('2026-10-05T10:00:00Z')});
  t.after(()=>{store.close();fs.rmSync(directory,{recursive:true,force:true});});
  const ids=[];
  for(const username of ['amara','bala','chioma','david']) {
    ids.push((await store.register({username,password:'Directory123!',displayName:username})).residentId);
  }
  return {store, ids, directory:new ResidentDirectory(store)};
}

test('resident keyset pages reach every actual resident without duplicates',async t=>{
  const {directory,ids}=await fixture(t),seen=[],viewer=ids[0];let cursor;
  do {
    const page=directory.people(viewer,{limit:1,cursor});
    seen.push(...page.people.map(p=>p.id));cursor=page.nextCursor;
  }while(cursor);
  assert.deepEqual(new Set(seen),new Set(ids.slice(1)));
  assert.equal(seen.length,3);
  assert.throws(()=>directory.people(viewer,{cursor:'invalid'}),/cursor/);
});

test('indexed resident search follows name changes and respects blocks',async t=>{
  const {store,directory,ids}=await fixture(t);
  assert.equal(directory.people(ids[0],{q:'chi'}).people[0].id,ids[2]);
  store.updateProfile(ids[2],{displayName:'Nana Abuja'});
  assert.equal(directory.people(ids[0],{q:'nana'}).people[0].id,ids[2]);
  store.moderate(ids[2],'block',ids[0],true);
  assert.equal(directory.people(ids[0],{q:'nana'}).people.length,0);
  assert.equal(directory.people(ids[0],{q:'" OR *'}).people.length,0);
});

test('message history paginates old actual messages and preserves member access',async t=>{
  const {store,directory,ids}=await fixture(t);
  const conversation=store.createConversation(ids[0],{residentId:ids[1]}).conversation;
  for(const text of ['first','second','third','fourth'])store.sendMessage(ids[0],conversation.id,text);
  const recent=directory.messages(ids[1],conversation.id,{limit:2});
  assert.deepEqual(recent.messages.map(m=>m.text),['third','fourth']);
  const older=directory.messages(ids[1],conversation.id,{limit:2,cursor:recent.nextCursor});
  assert.deepEqual(older.messages.map(m=>m.text),['first','second']);
  assert.equal(older.nextCursor,null);
  assert.throws(()=>directory.messages(ids[2],conversation.id),/Conversation not found/);
  store.moderate(ids[1],'block',ids[0],true);
  assert.deepEqual(directory.messages(ids[1],conversation.id).messages,[]);
});

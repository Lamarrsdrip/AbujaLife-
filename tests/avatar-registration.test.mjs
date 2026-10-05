import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameStore } from '../src/server/gameStore.mjs';

test('new accounts receive different saved appearances while explicit appearance and gender choices remain authoritative',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-avatar-accounts-'));
  let store=new GameStore({dataDir,originRandomInt:(min,max)=>max===2?1:0});
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  t.mock.method(crypto,'randomInt',()=>0);
  const first=await store.register({username:'varied_first',password:'a-test-password',appearance:{presentation:'feminine',top:'ochre'}});
  const a=store.profile(first.residentId);assert.equal(a.appearance.presentation,'feminine');assert.equal(a.appearance.hair,'braids');assert.equal(a.appearance.top,'ochre');assert.equal(a.appearance.facialHair,'none');
  t.mock.method(crypto,'randomInt',max=>max-1);
  const second=await store.register({username:'varied_second',password:'a-test-password',appearance:{presentation:'feminine'}});
  const b=store.profile(second.residentId);assert.equal(b.appearance.hair,'afro');assert.notEqual(b.appearance.skinTone,a.appearance.skinTone);assert.notEqual(b.appearance.body,a.appearance.body);assert.notEqual(b.appearance.face,a.appearance.face);assert.ok(['forest','ochre'].includes(b.appearance.top));
  const savedA=structuredClone(a.appearance),savedB=structuredClone(b.appearance);
  store.close();store=new GameStore({dataDir});assert.deepEqual(store.profile(a.id).appearance,savedA);assert.deepEqual(store.profile(b.id).appearance,savedB);
  assert.deepEqual(store.updateProfile(a.id,{displayName:'Ada'}).appearance,savedA);
});

test('random appearance does not invent a gender choice or unlock a paid outfit',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-avatar-choice-'));
  const store=new GameStore({dataDir,originRandomInt:(min,max)=>max===2?1:0});
  t.after(()=>{store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const account=await store.register({username:'choose_gender',password:'a-test-password'}),p=store.profile(account.residentId);
  assert.equal(p.appearance.presentation,'neutral');assert.ok(['forest','ochre'].includes(p.appearance.top));
  assert.throws(()=>store.updateProfile(p.id,{onboardingComplete:true}),error=>error.code==='gender_required');
  assert.throws(()=>store.updateProfile(p.id,{appearance:{top:'navy'}}),error=>error.code==='outfit_not_owned');
  assert.equal(store.updateProfile(p.id,{appearance:{presentation:'masculine',hair:'twists'},onboardingComplete:true}).appearance.hair,'twists');
  await assert.rejects(store.register({username:'bad_presentation',password:'a-test-password',appearance:{presentation:'invented'}}),error=>error.status===400);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, resetProfile } from '../src/server/gameStore.mjs';

test('food debits wallet and raises hunger',()=>{ resetProfile('t1'); const before=applyAction('t1','shower'); const after=applyAction('t1','eat'); assert.equal(after.wallet,before.wallet-2200); assert.ok(after.hunger>before.hunger); });
test('unverified topup is rejected',()=>{ resetProfile('t2'); assert.throws(()=>applyAction('t2','topup',{amount:50000,receipt:'x',verified:false})); });
test('verified receipt is idempotent',()=>{ resetProfile('t3'); const a=applyAction('t3','topup',{amount:50000,receipt:'r1',verified:true}); const b=applyAction('t3','topup',{amount:50000,receipt:'r1',verified:true}); assert.equal(a.wallet,b.wallet); });
test('job loop is playable',()=>{ resetProfile('t4'); applyAction('t4','take-job',{jobId:'junior-dev'}); const p=applyAction('t4','work-shift'); assert.ok(p.wallet>26000); assert.equal(p.job,'junior-dev'); });

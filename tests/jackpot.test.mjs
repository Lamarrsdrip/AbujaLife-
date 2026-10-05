import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JACKPOT_ENTRY_AMOUNT,
  JACKPOT_CAPACITY,
  JACKPOT_LANES,
  JACKPOT_WITHDRAWAL_FEE_BPS,
  jackpotWithdrawalQuote,
  jackpotWinnerIndex,
} from '../src/server/jackpotIntegration.mjs';

test('Community Jackpot has five fixed Abuja rooms and a ₦2,000 entry', () => {
  assert.equal(JACKPOT_ENTRY_AMOUNT, 2000);
  assert.equal(JACKPOT_CAPACITY, 50);
  assert.equal(JACKPOT_LANES.length, 5);
  assert.deepEqual(JACKPOT_LANES.map(room => room.name), ['Wuse Rush','Jabi Vault','Gwarinpa Circle','Maitama Crown','Asokoro Royale']);
});

test('withdrawal quote takes exactly ten percent for supported whole-Naira amounts', () => {
  assert.equal(JACKPOT_WITHDRAWAL_FEE_BPS, 1000);
  assert.deepEqual(jackpotWithdrawalQuote(50000), { grossAmount: 50000, feeAmount: 5000, netAmount: 45000 });
  assert.deepEqual(jackpotWithdrawalQuote(2000), { grossAmount: 2000, feeAmount: 200, netAmount: 1800 });
  assert.throws(() => jackpotWithdrawalQuote(2001));
});

test('draw selection is deterministic and bounded', () => {
  const seed='7'.repeat(64), room='jabi-vault:room-1', tickets=['t-1','t-2','t-3','t-4'];
  const first=jackpotWinnerIndex(seed,room,tickets);
  assert.equal(first,jackpotWinnerIndex(seed,room,tickets));
  assert.ok(first>=0 && first<tickets.length);
  assert.equal(first,1);
  assert.ok(jackpotWinnerIndex(seed,room,[...tickets,'t-5'])>=0);
});

test('Windows production deploy provisions Jackpot schema before candidate startup', () => {
  const bootstrap = fs.readFileSync(new URL('../deploy/windows/bootstrap-jackpot.mjs', import.meta.url), 'utf8');
  const deploy = fs.readFileSync(new URL('../deploy/windows/deploy.mjs', import.meta.url), 'utf8');
  assert.match(bootstrap, /ensureMongoJackpotSchema\(db\)/);
  assert.match(bootstrap, /JACKPOT_COLLECTIONS/);
  assert.match(bootstrap, /updateRole:\s*'abujalife_runtime'/);
  const baseBootstrap = deploy.indexOf("bootstrap-mongo.mjs");
  const jackpotBootstrap = deploy.indexOf("bootstrap-jackpot.mjs");
  const prepareBackup = deploy.indexOf("prepare-backup.mjs");
  const snapshot = deploy.indexOf("backup.mjs");
  const candidateStart = deploy.indexOf("ABUJALIFE_CANDIDATE_PORT");
  assert.ok(prepareBackup >= 0 && snapshot > prepareBackup && baseBootstrap > snapshot && jackpotBootstrap > baseBootstrap && candidateStart > jackpotBootstrap);
});

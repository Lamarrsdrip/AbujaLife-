import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CIVIC_META,CIVIC_PARTIES,CIVIC_CAMPAIGN_ACTIONS,CIVIC_GOVERNMENT_ACTIONS,civicCycle } from '../src/shared/civic-life.mjs';
import { ABUJA_2026_LANDMARK_VENUE_IDS } from '../src/shared/abuja-landmarks-2026.mjs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const runtime=read('src/server/civicIntegration-v2.mjs');
const production=read('src/server/production.mjs');
const dev=read('scripts/dev.mjs');

test('AbujaLife civic life is explicitly fictional and has a complete playable election cycle',()=>{
  assert.equal(CIVIC_META.fictional,true);
  assert.equal(CIVIC_PARTIES.length,3);
  assert.equal(civicCycle(Date.parse('2026-10-02T12:00:00+01:00')).phase.id,'nominations');
  assert.equal(civicCycle(Date.parse('2026-10-10T12:00:00+01:00')).phase.id,'campaign');
  assert.equal(civicCycle(Date.parse('2026-10-15T12:00:00+01:00')).phase.id,'debates');
  assert.equal(civicCycle(Date.parse('2026-10-19T12:00:00+01:00')).phase.id,'voting');
  assert.equal(civicCycle(Date.parse('2026-10-24T12:00:00+01:00')).phase.id,'results');
  assert.ok(CIVIC_META.nominationFee>0);
  assert.ok(CIVIC_META.governmentBudget>CIVIC_META.nominationFee);
});

test('campaigns include public rallies, debates, transparent choices and abstract fictional risk without procedural crime mechanics',()=>{
  const ids=new Set(CIVIC_CAMPAIGN_ACTIONS.map(a=>a.id));
  for(const id of ['street-canvass','eagle-square-rally','icc-townhall','debate-performance','declare-finances','risky-backer'])assert.ok(ids.has(id),`${id} missing`);
  assert.ok(CIVIC_CAMPAIGN_ACTIONS.some(a=>Number(a.heat)>0));
  assert.ok(CIVIC_CAMPAIGN_ACTIONS.some(a=>Number(a.heat)<0));
  assert.ok(CIVIC_GOVERNMENT_ACTIONS.length>=4);
  const copy=CIVIC_CAMPAIGN_ACTIONS.map(a=>a.description).join(' ');
  assert.equal(/how to launder|wash (?:cash|money)|shell compan(?:y|ies)|smurfing|layering funds|evade reporting|hide transfers/i.test(copy),false);
  assert.match(copy,/No laundering method is depicted/i);
  assert.match(copy,/no real-world evasion technique or payment method/i);
});

test('INEC, EFCC and court story destinations are real first-class AbujaLife venues',()=>{
  for(const id of ['inec-hq','efcc-hq','federal-high-court-hub'])assert.ok(ABUJA_2026_LANDMARK_VENUE_IDS.includes(id),`${id} missing`);
});

test('server civic runtime enforces one vote per resident, physical polling and idempotent money actions',()=>{
  assert.match(runtime,/createIndex\(\{cycleId:1,voterId:1\},\{unique:true\}\)/);
  assert.match(runtime,/profile\?\.district===profile\?\.home\?\.district/);
  assert.match(runtime,/idempotency_required/);
  assert.match(runtime,/store\.economyOperation/);
  assert.match(runtime,/Only the elected AbujaLife President can make this decision/);
  assert.match(runtime,/city budget is too low/i);
});

test('civic runtime is attached in both local gameplay and production',()=>{
  assert.match(production,/attachCivicRuntime/);
  assert.match(production,/civicConfigured:true/);
  assert.match(dev,/attachCivicRuntime/);
});

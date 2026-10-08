import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServerClock } from '../app/jackpot-clock.js';

test('jackpot countdown ignores an incorrect device wall clock once server time is observed',()=>{
  let mono=10_000;
  const clock=createServerClock({wallNow:()=>Date.parse('2049-01-01T00:00:00Z'),monotonicNow:()=>mono});
  assert.equal(clock.secondsUntil(Date.parse('2026-10-07T04:01:00Z')),null,'do not invent a countdown before authoritative time arrives');
  assert.equal(clock.observe(Date.parse('2026-10-07T04:00:00Z')),true);
  assert.equal(clock.secondsUntil(Date.parse('2026-10-07T04:01:00Z')),60);
  mono+=12_400;
  assert.equal(clock.secondsUntil(Date.parse('2026-10-07T04:01:00Z')),48);
});

test('Community Jackpot observes serverTime and never uses Date.now for room countdown math',()=>{
  const source=fs.readFileSync(new URL('../app/jackpot.js',import.meta.url),'utf8');
  assert.match(source,/serverClock\.observe\(next\.serverTime\)/);
  assert.match(source,/serverClock\.secondsUntil\(timestamp\)/);
  assert.doesNotMatch(source,/function secondsUntil\(timestamp\)\{[^}]*Date\.now/);
});

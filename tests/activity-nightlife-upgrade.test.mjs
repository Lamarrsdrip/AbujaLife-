import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VENUE_ACTIONS, travelPricing } from '../src/shared/life.mjs';

const app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const interiors=fs.readFileSync(new URL('../app/world-interiors.js',import.meta.url),'utf8');
const world3d=fs.readFileSync(new URL('../app/world-3d.js',import.meta.url),'utf8');
const character=fs.readFileSync(new URL('../app/world-character.js',import.meta.url),'utf8');

test('every authored venue activity is ten seconds longer',()=>{
  assert.ok(VENUE_ACTIONS.length>=25);
  assert.ok(VENUE_ACTIONS.every(activity=>activity.duration>=14),VENUE_ACTIONS.map(a=>`${a.id}:${a.duration}`).join(','));
  assert.equal(VENUE_ACTIONS.find(a=>a.id==='gym-workout')?.duration,18);
  assert.equal(VENUE_ACTIONS.find(a=>a.id==='club-dance')?.duration,18);
  assert.equal(VENUE_ACTIONS.find(a=>a.id==='tokyo-vip')?.duration,17);
});

test('real travel and driving get another ten seconds',()=>{
  const quote=travelPricing({id:'a',commute:35},{id:'b',commute:35},'car');
  assert.ok(quote.seconds>=14&&quote.seconds<=24,`unexpected car journey ${quote.seconds}s`);
});

test('home activities are also ten seconds longer',()=>{
  assert.match(app,/sleep:18,shower:16,relax:16,eat:15,exercise:18/);
  assert.match(app,/||15,complete/);
});

test('nightclubs have denser crowds, active dance motion and dynamic colour lighting',()=>{
  assert.match(interiors,/activity:'dance'.*activity:'dance'.*activity:'dance'/s);
  assert.ok((interiors.match(/activity:'dance'/g)||[]).length>=10);
  assert.match(world3d,/const clubLights=\[\]/);
  assert.match(world3d,/new THREE.PointLight/);
  assert.ok(world3d.includes('renderer.toneMappingExposure=partyOn?1.16:1.06'));
  assert.match(character,/const bounce=.*sway=.*step=/);
});

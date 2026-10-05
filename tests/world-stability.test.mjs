import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const phone=fs.readFileSync(new URL('../app/phone.js',import.meta.url),'utf8');
const world=fs.readFileSync(new URL('../app/world-3d.js',import.meta.url),'utf8');

test('live 3D views reconcile realtime data without rebuilding the world',()=>{
  assert.match(app,/function scheduleRealtimeRefresh\(\)/);
  assert.match(app,/!\['world','outside'\]\.includes\(view\)/);
  assert.doesNotMatch(app,/refresh\(\{render:!document\.querySelector\('\.sheet'\)&&!root\.contains\(document\.activeElement\)\}\)/);
});

test('only real location transitions rebuild the playable world',()=>{
  assert.match(app,/previousLocation!==locationKey\(result\.profile\)&&view==='world'/);
  assert.match(app,/mode==='walk'&&sameDistrict&&\(venueId\|\|returningHome\)/);
});

test('phone destination paints before notification read housekeeping',()=>{
  const notice=phone.indexOf("case 'notice'");
  const open=phone.indexOf('if(convId)void openThread(convId)',notice);
  const read=phone.indexOf("api('/api/notifications/read'",notice);
  assert.ok(notice>=0&&open>notice&&read>open);
  assert.match(phone,/pending-dm:/);
});

test('main world WebGL context can recover and is not forcibly lost on teardown',()=>{
  const main=world.slice(0,world.indexOf('/** Full-body resident preview'));
  assert.match(main,/webglcontextrestored/);
  assert.match(main,/event\.preventDefault\(\)/);
  assert.doesNotMatch(main,/forceContextLoss\(\)/);
  assert.match(main,/rect\.width<2\|\|rect\.height<2/);
});

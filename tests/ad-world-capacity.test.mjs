import test from 'node:test';
import assert from 'node:assert/strict';
import { AD_ZONES } from '../src/server/ads.mjs';

test('Outside Ad World keeps more than one thousand scalable plot positions',()=>{
  const capacity=AD_ZONES.reduce((sum,zone)=>sum+Math.max(1,Math.floor(zone.width/120))*Math.max(1,Math.floor(zone.height/100)),0);
  assert.ok(capacity>=1000,`Expected at least 1,000 outside ad plots, got ${capacity}`);
  assert.ok(AD_ZONES.length>=4,'Advertising land must stay distributed around the Outside world');
});

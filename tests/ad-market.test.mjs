import test from 'node:test';
import assert from 'node:assert/strict';
import { AD_PRICING, AD_SPACES, normalizeAdImage, normalizeAdLink } from '../src/server/mongo/adStore.mjs';

test('AbujaLife real-world ads use fixed Naira pricing without game-wallet semantics', () => {
  assert.deepEqual(AD_PRICING,{currency:'NGN',amount:2000,durationDays:7,plotPackSize:5,billboardCount:1});
  assert.equal(AD_SPACES.filter(space=>space.kind==='plot').length,40);
  assert.equal(AD_SPACES.filter(space=>space.kind==='billboard').length,10);
  assert.equal(new Set(AD_SPACES.map(space=>space.id)).size,50);
});

test('ad links are HTTPS and cannot smuggle credentials', () => {
  assert.equal(normalizeAdLink('https://example.com/shop?from=abuja'),'https://example.com/shop?from=abuja');
  assert.equal(normalizeAdLink('https://x.com/abujalife'),'https://x.com/abujalife');
  assert.throws(()=>normalizeAdLink('http://example.com'),{code:'invalid_ad_link'});
  assert.throws(()=>normalizeAdLink('https://user:secret@example.com'),{code:'invalid_ad_link'});
  assert.throws(()=>normalizeAdLink('javascript:alert(1)'),{code:'invalid_ad_link'});
});

test('ad images are bounded data images and never arbitrary HTML or remote fetches', () => {
  const tinyPng='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const normalized=normalizeAdImage(`data:image/png;base64,${tinyPng}`);
  assert.equal(normalized.bytes>0,true);
  assert.match(normalized.sha256,/^[a-f0-9]{64}$/);
  assert.match(normalized.dataUrl,/^data:image\/png;base64,/);
  assert.throws(()=>normalizeAdImage('https://example.com/ad.png'),{code:'invalid_ad_image'});
  const huge=Buffer.alloc(50*1024,1).toString('base64');
  assert.throws(()=>normalizeAdImage(`data:image/png;base64,${huge}`),{code:'ad_image_too_large'});
});
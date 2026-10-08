import test from 'node:test';
import assert from 'node:assert/strict';
import { AD_PRICING, AD_SPACES, MONGO_AD_VALIDATORS, normalizeAdImage, normalizeAdLink } from '../src/server/mongo/adStore.mjs';

test('AbujaLife real-world ads use fixed per-placement Naira pricing without game-wallet semantics', () => {
  assert.deepEqual(AD_PRICING,{currency:'NGN',amount:2000,durationDays:7,plotPackSize:1,billboardCount:1});
  assert.equal(AD_SPACES.filter(space=>space.kind==='plot').length,40);
  assert.equal(AD_SPACES.filter(space=>space.kind==='billboard').length,10);
  assert.equal(new Set(AD_SPACES.map(space=>space.id)).size,50);
});

test('ad links are HTTPS and cannot smuggle credentials', () => {
  assert.equal(normalizeAdLink('https://example.com/shop?from=abuja'),'https://example.com/shop?from=abuja');
  assert.equal(normalizeAdLink('https://x.com/abujalife'),'https://x.com/abujalife');
  for(const link of ['https://fcmb.com/','https://fd.example.com/','https://fea.example.com/'])assert.equal(normalizeAdLink(link),link,'domain prefixes are not IPv6 addresses');
  assert.equal(normalizeAdLink('https://[2606:4700:4700::1111]/'),'https://[2606:4700:4700::1111]/');
  assert.equal(normalizeAdLink('https://[::ffff:8.8.8.8]/'),'https://[::ffff:808:808]/');
  assert.throws(()=>normalizeAdLink('http://example.com'),{code:'invalid_ad_link'});
  assert.throws(()=>normalizeAdLink('https://user:secret@example.com'),{code:'invalid_ad_link'});
  assert.throws(()=>normalizeAdLink('javascript:alert(1)'),{code:'invalid_ad_link'});
  for (const link of ['https://localhost/admin','https://localhost./admin','https://router.local./admin','https://api.internal./admin','https://127.0.0.1/admin','https://10.0.0.4/admin','https://192.168.1.4/admin','https://[::]/admin','https://[::1]/admin','https://[fc00::1]/admin','https://[fd12::1]/admin','https://[fe80::1]/admin','https://[febf::1]/admin','https://[::ffff:127.0.0.1]/admin','https://[::ffff:10.0.0.4]/admin','https://[::ffff:c0a8:104]/admin']) assert.throws(()=>normalizeAdLink(link),{code:'invalid_ad_link'});
});

test('ad images are bounded data images and never arbitrary HTML or remote fetches', () => {
  const tinyPng='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const normalized=normalizeAdImage(`data:image/png;base64,${tinyPng}`);
  assert.equal(normalized.bytes>0,true);
  assert.match(normalized.sha256,/^[a-f0-9]{64}$/);
  assert.match(normalized.dataUrl,/^data:image\/png;base64,/);
  assert.throws(()=>normalizeAdImage('https://example.com/not-an-uploaded-creative-image.png'),{code:'invalid_ad_image'});
  assert.throws(()=>normalizeAdImage('data:image/jpeg;base64,'+Buffer.from('not-a-jpeg').toString('base64')),{code:'invalid_ad_image'});
  assert.throws(()=>normalizeAdImage('data:image/png;base64,'+Buffer.from('not-a-png').toString('base64')),{code:'invalid_ad_image'});
  const huge=Buffer.alloc(50*1024,1).toString('base64');
  assert.throws(()=>normalizeAdImage(`data:image/png;base64,${huge}`),{code:'ad_image_too_large'});
});

test('pending ad orders allow null provider fields while legacy multi-slot orders remain readable', () => {
  const properties = MONGO_AD_VALIDATORS.ad_orders.$jsonSchema.properties;
  assert.deepEqual(properties.checkoutUrl.bsonType, ['string','null']);
  assert.deepEqual(properties.transactionId.bsonType, ['string','null']);
  assert.equal(properties.slots.maxItems,5,'legacy five-slot campaigns stay schema-compatible after new checkouts become one placement');
});

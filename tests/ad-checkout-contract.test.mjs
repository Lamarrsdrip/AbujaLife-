import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AD_PRICING } from '../src/server/mongo/adStore.mjs';

const serverSource = readFileSync(new URL('../src/server/mongo/adStore.mjs', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../app/ads.js', import.meta.url), 'utf8');

test('new ad checkout sells one placement for the authoritative ₦2,000 price', () => {
  assert.equal(AD_PRICING.amount, 2000);
  assert.equal(AD_PRICING.durationDays, 7);
  assert.equal(AD_PRICING.plotPackSize, 1);
  assert.equal(AD_PRICING.billboardCount, 1);
  assert.match(serverSource, /Choose one available ad plot/);
  assert.doesNotMatch(serverSource, /Choose exactly 5 available ad plots/);
});

test('Flutterwave Standard metadata stays scalar-only and never embeds selected-slot arrays', () => {
  assert.match(serverSource, /meta:\{abujalife_reference:order\.txRef,purpose:'advertising',kind\}/);
  assert.doesNotMatch(serverSource, /purpose:'advertising',kind,slots/);
  assert.match(serverSource, /description:kind==='plot'\?'AbujaLife city ad plot · 7 days'/);
});

test('browser invalidates legacy hosted-checkout intents and presents single-placement copy', () => {
  assert.match(clientSource, /const AD_CHECKOUT_SCHEMA=2;/);
  assert.match(clientSource, /checkoutSchema:AD_CHECKOUT_SCHEMA/);
  assert.match(clientSource, />City display<\/button>/);
  assert.doesNotMatch(clientSource, />5 city displays<\/button>/);
  assert.match(clientSource, /sessionStorage\.removeItem\('abujalife\.ad-intent'\)/);
});

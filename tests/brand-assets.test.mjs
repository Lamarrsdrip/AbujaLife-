import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { generateBrandRasterAssets } from '../scripts/brand-raster.mjs';

function pngSize(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('production brand assets include proper app icons and a large social card', () => {
  const assets = generateBrandRasterAssets();
  assert.deepEqual(pngSize(assets['icons/apple-touch-icon.png']), { width: 180, height: 180 });
  assert.deepEqual(pngSize(assets['icons/icon-192.png']), { width: 192, height: 192 });
  assert.deepEqual(pngSize(assets['icons/icon-512.png']), { width: 512, height: 512 });
  assert.deepEqual(pngSize(assets['icons/icon-maskable-512.png']), { width: 512, height: 512 });
  assert.deepEqual(pngSize(assets['social/abujalife-share-v2.png']), { width: 1200, height: 630 });
  for (const buffer of Object.values(assets)) assert.ok(buffer.length > 900, 'brand raster must contain real PNG image data');
});

test('social metadata never falls back to the square app icon', () => {
  const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.match(html, /twitter:card" content="summary_large_image"/);
  assert.match(html, /og:image" content="https:\/\/abujacity\.life\/social\/abujalife-share-v2\.png"/);
  assert.match(html, /og:image:width" content="1200"/);
  assert.match(html, /og:image:height" content="630"/);
  assert.match(html, /twitter:image" content="https:\/\/abujacity\.life\/social\/abujalife-share-v2\.png"/);
  assert.doesNotMatch(html, /(?:og:image|twitter:image)[^>]*icon-512\.png/);
  assert.match(html, /apple-touch-icon\.png\?v=abuja-brand-v2/);
});

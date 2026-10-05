import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
function pngSize(path){const data=fs.readFileSync(new URL(path,import.meta.url));assert.equal(data.toString('ascii',1,4),'PNG');return {width:data.readUInt32BE(16),height:data.readUInt32BE(20)};}

test('AbujaLife link cards use the dedicated wide branded social preview',()=>{
  assert.match(html,/twitter:card\" content=\"summary_large_image/);
  assert.match(html,/og:image\" content=\"https:\/\/abujacity\.life\/social-preview\.png\?v=/);
  assert.match(html,/twitter:image\" content=\"https:\/\/abujacity\.life\/social-preview\.png\?v=/);
  assert.doesNotMatch(html,/og:image\" content=\"[^\"]*icon-512\.png/);
  assert.deepEqual(pngSize('../app/social-preview.png'),{width:1200,height:630});
});

test('AbujaLife installed icons are correctly sized raster gate assets',()=>{
  assert.deepEqual(pngSize('../app/icons/icon-512.png'),{width:512,height:512});
  assert.deepEqual(pngSize('../app/icons/icon-maskable-512.png'),{width:512,height:512});
  assert.deepEqual(pngSize('../app/icons/icon-192.png'),{width:192,height:192});
  assert.deepEqual(pngSize('../app/icons/apple-touch-icon.png'),{width:180,height:180});
});

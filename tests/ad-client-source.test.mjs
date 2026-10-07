import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../app/ads.js',import.meta.url),'utf8');

test('ad checkout client keeps escaped attribute entities complete',()=>{
  assert.match(source,/['"]&quot;['"]/);
  assert.doesNotMatch(source,/['"]&quot['"]/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app/game-realm-2026.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app/game-realm-2026.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-production.mjs'), 'utf8');

test('production shell loads the Realm 2026 game layer after legacy styling', () => {
  const legacyCss = html.indexOf('/game-experience.css');
  const realmCss = html.indexOf('/game-realm-2026.css');
  const legacyJs = html.indexOf('/game-experience.js');
  const realmJs = html.indexOf('/game-realm-2026.js');
  assert.ok(legacyCss >= 0 && realmCss > legacyCss);
  assert.ok(legacyJs >= 0 && realmJs > legacyJs);
  assert.match(build, /'game-realm-2026':\s*'app\/game-realm-2026\.js'/);
});

test('Realm UI is full-screen, safe-area aware and touch-sized like a game', () => {
  assert.match(css, /100dvh/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:48px/);
  assert.match(css, /\.game-nav button\{[^}]*min-height:58px/s);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('Realm UI replaces flat finance styling with colourful gameplay surfaces', () => {
  for (const token of ['--realm-sky', '--realm-violet', '--realm-coral', '--realm-sun', '--realm-mint']) assert.match(css, new RegExp(token));
  assert.match(css, /\.job-list,\.market-list,\.property-list\{[^}]*display:grid/s);
  assert.match(css, /\.abj-life-shortcuts button:nth-child/);
  assert.match(css, /\.game-shell\.is-playing/);
  assert.match(css, /\.ph-backdrop/);
});

test('Realm interaction layer adds feedback without owning gameplay or network state', () => {
  assert.match(js, /realm-pressing/);
  assert.match(js, /navigator\.vibrate/);
  assert.match(js, /MutationObserver/);
  assert.doesNotMatch(js, /fetch\s*\(/);
  assert.doesNotMatch(js, /apiFetch|WebSocket|EventSource/);
});

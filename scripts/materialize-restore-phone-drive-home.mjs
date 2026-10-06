import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
const mustReplace = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing expected source for ${label}`);
  return source.replace(before, after);
};

// 1) Restore the previous full handset framing only. Keep every newer phone feature/logic.
{
  const path = 'app/phone.css';
  let css = read(path);
  const marker = '\n\n/* 2026-10 final phone framing: keep the whole handset visible and calm on mobile. */';
  if (!css.includes(marker)) throw new Error('Final phone framing override was not found');
  css = css.slice(0, css.indexOf(marker));
  write(path, css.endsWith('\n') ? css : `${css}\n`);
}

// 2) Keep the native AbujaLife cream/gold transfer receipt markup instead of repainting it Chat Pro green.
{
  const path = 'app/phone-chat-pro.js';
  let js = read(path);
  const start = js.indexOf('function transformTransfer(node,message){');
  const end = js.indexOf('\nfunction transformDeleted', start);
  if (start < 0 || end < 0) throw new Error('Chat Pro transfer transform was not found');
  js = `${js.slice(0, start)}function transformTransfer(){/* Keep native AbujaLife cream/gold Naira receipt presentation. */}${js.slice(end)}`;
  write(path, js);
}

// 3) Remove only Chat Pro transfer-card paint/compact overrides. Base phone.css owns the old premium receipt again.
{
  const path = 'app/phone-chat-pro.css';
  let css = read(path);
  css = css.replace(',#phone-root.chat-pro-ready .pro-flash .ph-transfer-message', '');
  const transferStart = css.indexOf('\n#phone-root .ph-transfer-message{min-width:');
  const mediaStart = css.indexOf('\n#phone-root .pro-media-message{', transferStart);
  if (transferStart < 0 || mediaStart < 0) throw new Error('Chat Pro transfer skin block was not found');
  css = `${css.slice(0, transferStart)}\n${css.slice(mediaStart + 1)}`;
  css = css.replace('@media(max-width:480px){#phone-root .ph-transfer-message{min-width:min(245px,74vw)}#phone-root .pro-transfer-amount{font-size:25px}.pro-message-actions{bottom:max(8px,env(safe-area-inset-bottom))}}', '@media(max-width:480px){.pro-message-actions{bottom:max(8px,env(safe-area-inset-bottom))}}');
  const compactMarker = '\n\n/* Compact, receipt-like Naira transfer card. */';
  if (!css.includes(compactMarker)) throw new Error('Compact transfer override was not found');
  css = css.slice(0, css.indexOf(compactMarker));
  write(path, css.endsWith('\n') ? css : `${css}\n`);
}

// 4) Home from World must always use the existing travel chooser. Same-district owners can pick Walk or Car.
{
  const path = 'app/app.js';
  let js = read(path);
  const before = `  if(p.district!==p.home.district){travelSheet(p.home.district,true);return;}\n  toast('Making your way to your own home.');\n  if(cleanup?.performAsync)await cleanup.performAsync('enter-home');else await action('enter-home');`;
  const after = `  travelSheet(p.home.district,true);return;`;
  js = mustReplace(js, before, after, 'goHome travel chooser');
  write(path, js);
}

// 5) Lock these exact user-facing regressions with source tests.
{
  const path = 'tests/final-world-phone-regression.test.mjs';
  let test = read(path);
  const oldPhoneTest = `test('phone stays framed and Naira receipts cannot collapse vertically',()=>{\n  const phone=read('app/phone.css'),chat=read('app/phone-chat-pro.css');\n  assert.match(phone,/whole handset visible/);\n  assert.match(chat,/receipt-like Naira transfer card/);\n  assert.match(chat,/white-space:nowrap!important/);\n  assert.match(chat,/grid-template-columns:28px minmax\\(0,1fr\\) auto/);\n});`;
  const newPhoneTest = `test('phone uses the previous full handset kit and native premium Naira receipt',()=>{\n  const phone=read('app/phone.css'),chat=read('app/phone-chat-pro.css'),chatJs=read('app/phone-chat-pro.js'),base=read('app/phone.js');\n  assert.doesNotMatch(phone,/2026-10 final phone framing/);\n  assert.match(phone,/\\.ph-device\\{position:relative;width:min\\(360px/);\n  assert.doesNotMatch(chat,/ph-transfer-message\\{min-width:/);\n  assert.doesNotMatch(chat,/receipt-like Naira transfer card/);\n  assert.match(chatJs,/function transformTransfer\\(\\)\\{\\/\\* Keep native AbujaLife cream\\/gold Naira receipt presentation\\. \\*\\/\\}/);\n  assert.match(base,/YOU SENT NAIRA/);\n  assert.match(base,/Transfer confirmed · No fee/);\n});\n\ntest('World Home always opens the travel chooser so owned cars can drive home',()=>{\n  const app=read('app/app.js');\n  const home=app.slice(app.indexOf('async function goHome()'),app.indexOf('function openLifeMenu()'));\n  assert.match(home,/travelSheet\\(p\\.home\\.district,true\\);return;/);\n  assert.doesNotMatch(home,/cleanup\\?\\.performAsync\\)await cleanup\\.performAsync\\('enter-home'\\)/);\n  assert.match(app,/const ownsCar=list\\(state\\.catalog\\)\\.some\\(item=>item\\.category==='vehicle'/);\n  assert.match(app,/const modes=TRANSPORT_MODES\\.filter\\(mode=>mode\\.id!=='car'\\|\\|ownsCar\\)/);\n});`;
  test = mustReplace(test, oldPhoneTest, newPhoneTest, 'final phone regression test');
  write(path, test);
}

// 6) Update the Chat Pro contract: media/realtime stays Pro, transfer receipts intentionally use the native card.
{
  const path = 'tests/chat-pro.test.mjs';
  let test = read(path);
  const before = `test('money messages render as compact completed transfer receipts',()=>{\n  for(const token of ['Transfer sent','Money received','Completed','In-game transfer'])assert.ok(client.includes(token),\`missing \${token}\`);\n  assert.match(css,/\\.pro-transfer-amount/);\n  assert.match(css,/\\.ph-transfer-message/);\n});`;
  const after = `test('money messages keep the native AbujaLife premium receipt while Chat Pro handles media and realtime',()=>{\n  assert.ok(client.includes('Keep native AbujaLife cream/gold Naira receipt presentation'));\n  assert.doesNotMatch(css,/\\.pro-transfer-amount/);\n  assert.doesNotMatch(css,/ph-transfer-message\\{min-width:/);\n  assert.ok(read('app/phone.js').includes('YOU SENT NAIRA'));\n  assert.ok(read('app/phone.js').includes('Transfer confirmed · No fee'));\n});`;
  test = mustReplace(test, before, after, 'Chat Pro transfer receipt contract');
  write(path, test);
}

console.log('Restored previous phone kit + native receipt and routed Home through transport chooser.');

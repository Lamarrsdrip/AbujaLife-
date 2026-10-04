import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../src/shared/atlas.mjs';
import { jobs, catalog, properties, transportModes, appearanceOptions, activities } from '../src/server/gameStore.mjs';
import { VENUES, VENUE_ACTIONS, LIFE_GOALS, ECONOMY_META, WALLET_META, INVESTMENT_META, DICE_META, HOME_UPGRADES } from '../src/shared/life.mjs';
import { VEHICLE_COLORS } from '../src/shared/vehicles.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.dirname(directory);
// Only public catalogues are exported. No database, account, session or credential is read.
const data = { atlas:ABUJA_ATLAS, councils:AREA_COUNCILS, landmarks:LANDMARKS,
  atlasMeta:ATLAS_META, jobs, catalog, properties, transportModes, appearanceOptions, activities,
  venues:VENUES, venueActions:VENUE_ACTIONS, lifeGoals:LIFE_GOALS, economyMeta:ECONOMY_META,
  walletMeta:WALLET_META, investmentMeta:INVESTMENT_META, diceMeta:DICE_META, vehicleColors:VEHICLE_COLORS,homeUpgrades:HOME_UPGRADES };
await fs.writeFile(path.join(directory,'data.mjs'), `// Generated public preview catalogue. Rebuild with npm run preview:build.\nexport default ${JSON.stringify(data)};\n`);
const result = await build({
  absWorkingDir:repository, entryPoints:['preview/runtime.mjs'], bundle:true, write:false,
  format:'esm', platform:'browser', target:'es2022', minify:true, charset:'utf8', legalComments:'inline'
});
const script = result.outputFiles[0].text.replace(/[ \t]+$/gm,'').replace(/<\/script/gi,'<\\/script');
// Inline the whole client stylesheet graph. New world/interior styles travel with
// the public preview, instead of depending on a CDN resolving relative CSS URLs.
const appDirectory=path.join(repository,'app'),includedStyles=new Set();
async function inlineStyles(filename,parents=[]) {
  const absolute=path.resolve(appDirectory,filename);
  if(!absolute.startsWith(`${appDirectory}${path.sep}`))throw new Error('Preview CSS imports must stay in the app directory');
  if(parents.includes(absolute))throw new Error(`Circular CSS import: ${filename}`);
  if(includedStyles.has(absolute))return '';
  includedStyles.add(absolute);
  const source=await fs.readFile(absolute,'utf8');
  const imports=/@import\s+(?:url\(\s*['"]?([^'"()\s]+)['"]?\s*\)|['"]([^'"]+)['"])\s*;/g;
  let output='',cursor=0;
  for(const match of source.matchAll(imports)) {
    const imported=match[1]||match[2];
    if(/^(?:https?:|data:|\/\/)/i.test(imported))throw new Error('Preview styles must not require an external stylesheet');
    output+=source.slice(cursor,match.index);
    output+=await inlineStyles(path.relative(appDirectory,path.resolve(path.dirname(absolute),imported)),[...parents,absolute]);
    cursor=match.index+match[0].length;
  }
  return output+source.slice(cursor);
}
const clientHTML=await fs.readFile(path.join(appDirectory,'index.html'),'utf8');
let css='';
for(const [link] of clientHTML.matchAll(/<link\b[^>]*>/gi)) {
  if(!/\brel\s*=\s*["']stylesheet["']/i.test(link))continue;
  const href=link.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if(href&&href.endsWith('.css'))css+=`\n${await inlineStyles(href.replace(/^\/+/,''))}`;
}
if(!includedStyles.size)css=await inlineStyles('styles.css');
for(const name of (await fs.readdir(appDirectory)).filter(name=>name.endsWith('.css')).sort())css+=`\n${await inlineStyles(name)}`;
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#204b3c">
<meta name="description" content="Explore the AbujaLife browser preview. No account required.">
<title>AbujaLife · Preview</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23204b3c'/%3E%3Ctext x='32' y='44' text-anchor='middle' font-size='42' font-family='Georgia' fill='%23f4f2eb'%3EA%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" data-abuja-map-styles href="data:text/css,">
<style>${css}
.preview-launcher{position:fixed;right:14px;top:max(7px,env(safe-area-inset-top));z-index:70;border:1px solid #cbd7ca;background:#f4f6efed;backdrop-filter:blur(12px);color:#526450;border-radius:99px;padding:2px 9px;min-height:22px;height:22px;font:600 10px/16px system-ui,sans-serif;letter-spacing:.02em}.preview-launcher::before{content:'';display:inline-block;width:5px;height:5px;border-radius:50%;background:#6c8b65;margin-right:5px;vertical-align:1px}.preview-info{width:min(380px,calc(100vw - 32px));max-height:calc(100dvh - 48px);box-sizing:border-box;border:1px solid #d7dfd1;border-radius:24px;background:#f8f8f1;color:#263f32;padding:28px;box-shadow:0 18px 75px #142c2340}.preview-info::backdrop{background:#172d2260;backdrop-filter:blur(8px)}.preview-info h2{font-size:22px;letter-spacing:-.6px;margin:14px 0 12px}.preview-info p{font-size:13px;line-height:1.65;color:#697660}.preview-info .preview-eyebrow{font:650 10px/1.3 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#82916d}.preview-info .preview-close{float:right;width:32px;height:32px;padding:0;background:#e9ede3;border:0;border-radius:50%;color:#476348;font:22px/1 system-ui,sans-serif}.preview-info #preview-reset{width:100%;min-height:44px;border:1px solid #bdcbb5;border-radius:13px;background:#e8eee0;color:#38543c;font-size:12px;font-weight:650;margin-top:8px}.preview-info .preview-warning{font-size:11px;color:#8a6b42;margin-bottom:0}[data-preview-storage='memory'] .preview-launcher::before{background:#b18345}[data-logout]{display:none}
/* Keep browser-edition information below the wordmark, clear of money/profile controls. */
body:has(.game-shell) .preview-launcher{left:16px;right:auto;top:32px;height:22px;min-height:22px;padding:0 3px;display:flex;align-items:center;font-size:8px;line-height:10px;background:transparent;border:0;backdrop-filter:none;letter-spacing:.03em}
body:has(.game-shell) .preview-launcher::before{width:3px;height:3px;margin-right:4px}
body:has(.sheet) .preview-launcher,body.phone-is-open .preview-launcher,body:has(dialog[open]) .preview-launcher{visibility:hidden}
@media(min-width:651px){body:has(.game-shell) .preview-launcher{left:28px;top:40px}}
</style>
</head>
<body>
<button id="preview-info-open" class="preview-launcher" type="button" aria-haspopup="dialog" aria-controls="preview-info">Preview</button>
<dialog id="preview-info" class="preview-info" aria-labelledby="preview-info-title"><button id="preview-info-close" class="preview-close" aria-label="Close preview information" type="button">×</button><span class="preview-eyebrow">AbujaLife · Browser edition</span><h2 id="preview-info-title">Your city, on this device.</h2><p id="preview-status">No account or payment needed. Your character, purchases and progress save in this browser.</p><p>Naira here is game currency with no cash value. Free top-ups help you try the game. Chat and money transfers connect registered residents in the full game.</p><button id="preview-reset" type="button">Start fresh</button><p class="preview-warning">Starting fresh clears this browser’s game progress.</p></dialog>
<div id="app" class="app-shell"></div><div id="phone-root"></div><div id="sheet-root"></div><div id="toast" role="status" aria-live="polite"></div>
<script type="module">${script}</script>
<script>const previewInfo=document.getElementById('preview-info');document.getElementById('preview-info-open').addEventListener('click',()=>{previewInfo.setAttribute('aria-modal','true');previewInfo.showModal();});previewInfo.addEventListener('close',()=>previewInfo.removeAttribute('aria-modal'));document.getElementById('preview-info-close').addEventListener('click',()=>previewInfo.close());previewInfo.addEventListener('click',event=>{if(event.target===previewInfo){const bounds=previewInfo.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)previewInfo.close();}});document.getElementById('preview-reset').addEventListener('click',()=>window.dispatchEvent(new Event('abujalife:reset-preview')));window.addEventListener('abujalife:preview-storage-unavailable',()=>{document.getElementById('preview-status').textContent='This browser cannot save progress. Your game works for this visit; reloading starts fresh.';document.getElementById('preview-info-open').textContent='Preview · unsaved';});</script>
</body></html>\n`;
await fs.writeFile(path.join(directory,'index.html'),html);
console.log(`Built anonymous browser preview (${Math.round(Buffer.byteLength(html)/1024)} KB). No game server or credentials required.`);

import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../src/shared/atlas.mjs';
import { jobs, catalog, properties, transportModes, appearanceOptions, activities } from '../src/server/gameStore.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.dirname(directory);
// Only public catalogues are exported. No database, account, session or credential is read.
const data = { atlas:ABUJA_ATLAS, councils:AREA_COUNCILS, landmarks:LANDMARKS,
  atlasMeta:ATLAS_META, jobs, catalog, properties, transportModes, appearanceOptions, activities };
await fs.writeFile(path.join(directory,'data.mjs'), `// Generated public preview catalogue. Rebuild with npm run preview:build.\nexport default ${JSON.stringify(data)};\n`);
const result = await build({
  absWorkingDir:repository, entryPoints:['preview/runtime.mjs'], bundle:true, write:false,
  format:'esm', platform:'browser', target:'es2022', minify:true, charset:'utf8', legalComments:'inline'
});
const script = result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const styles = await Promise.all(['styles.css','world.css','phone.css','map.css'].map(name=>fs.readFile(path.join(repository,'app',name),'utf8')));
const css = styles.map(text=>text.replace(/^@import[^;]+;\s*/gm,'')).join('\n');
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
.preview-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 24px;background:#e5ebdf;color:#385440;border-bottom:1px solid #d4ddcd;font-size:11px;line-height:1.5}.preview-banner strong{font-weight:600}.preview-banner small{display:block;font-size:10px;color:#61725e}.preview-banner button{flex-shrink:0;border:1px solid #b7c5ad;background:transparent;color:#385440;border-radius:9px;padding:8px 12px;font-size:10px;min-height:36px}.preview-banner button:hover{background:#d8e2d0}[data-logout]{display:none}@media(max-width:600px){.preview-banner{padding:9px 14px;font-size:10px}.preview-banner small{font-size:9px}.preview-banner button{padding:8px;font-size:9px}}
</style>
</head>
<body>
<aside class="preview-banner" aria-label="Preview information"><div><strong>Browser preview · No account needed</strong><small id="preview-status">Your progress stays on this device. Multiplayer runs in the full app.</small></div><button id="preview-reset" type="button">Start fresh</button></aside>
<div id="app" class="app-shell"></div><div id="phone-root"></div><div id="sheet-root"></div><div id="toast" role="status" aria-live="polite"></div>
<script type="module">${script}</script>
<script>document.getElementById('preview-reset').addEventListener('click',()=>window.dispatchEvent(new Event('abujalife:reset-preview')));window.addEventListener('abujalife:preview-storage-unavailable',()=>{document.getElementById('preview-status').textContent='This browser cannot save progress; reloading starts fresh. Multiplayer runs in the full app.';});</script>
</body></html>\n`;
await fs.writeFile(path.join(directory,'index.html'),html);
console.log(`Built anonymous browser preview (${Math.round(Buffer.byteLength(html)/1024)} KB). No game server or credentials required.`);

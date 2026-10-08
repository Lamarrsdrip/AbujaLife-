import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicAssetExtensions = new Set(['.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.wav', '.ogg', '.glb', '.gltf', '.bin']);
export const productionEntryPoints = Object.freeze({
  'checkout-window': 'app/checkout-window.js',
  app: 'app/app.js',
  admin: 'app/admin.js',
  'admin-house-ads': 'app/admin-house-ads.js',
  'phone-chat-pro': 'app/phone-chat-pro.js',
  'civic-life': 'app/civic-life.js',
  'game-ui-kit': 'app/game-ui-kit.js',
  ads: 'app/ads.js',
  integrations: 'app/integrations.js',
  jackpot: 'app/jackpot.js',
  'jackpot-admin': 'app/jackpot-admin.js',
  'outside-quick-access': 'app/outside-quick-access.js',
  'living-city': 'app/living-city.js',
  'game-map': 'app/game-map.js',
  'game-experience': 'app/game-experience.js',
  'game-realm-2026': 'app/game-realm-2026.js',
  'abuja-game-polish-2026': 'app/abuja-game-polish-2026.js',
});

export function publicOrigin(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a public HTTPS origin.`); }
  const hostname = url.hostname.toLowerCase();
  const dnsName = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/;
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || !dnsName.test(hostname) || /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(hostname)) {
    throw new Error(`${name} must identify a public HTTPS origin without credentials, a port, path, query or fragment.`);
  }
  return url.origin;
}

export function publicConfiguration(environment = process.env) {
  return {
    API_PUBLIC_URL: publicOrigin(environment.API_PUBLIC_URL || 'https://api.abujacity.life', 'API_PUBLIC_URL'),
    PUBLIC_WEB_URL: publicOrigin(environment.PUBLIC_WEB_URL || 'https://abujacity.life', 'PUBLIC_WEB_URL'),
  };
}

async function filesBelow(directory, relative = '', includeHidden = true) {
  const entries = await fs.readdir(path.join(directory, relative), { withFileTypes: true });
  const output = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!includeHidden && entry.name.startsWith('.')) continue;
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Static assets cannot contain a symbolic link: ${name}`);
    if (entry.isDirectory()) output.push(...await filesBelow(directory, name, includeHidden));
    else if (entry.isFile()) output.push(name);
  }
  return output;
}

function configureHTML(source) {
  if (!/<script\b[^>]*\btype=["']module["']/i.test(source)) throw new Error('The client HTML has no module entry point.');
  return source.replace(/(<script\b[^>]*\btype=["']module["'])/i, '<script src="/runtime-config.js"></script>\n  $1');
}

function serviceWorker(shell, fingerprint) {
  return `// Public static shell only. Account data and API responses never enter this cache.\nconst CACHE='abujalife-production-${fingerprint}';\nconst SHELL=${JSON.stringify(shell)};\nself.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));\nself.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('abujalife-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',event=>{\n const url=new URL(event.request.url);\n if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/admin')||url.pathname==='/runtime-config.js'||url.pathname==='/sw.js')return;\n const key=url.pathname==='/'?'/index.html':url.pathname;\n if(!SHELL.includes(key))return;\n event.respondWith(fetch(event.request).then(response=>{if(response.ok&&response.type!=='opaque'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,copy)));}return response;}).catch(()=>caches.match(key)));\n});\n`;
}

export async function buildProduction({ environment = process.env, outputDirectory = path.join(repository, 'dist') } = {}) {
  const configuration = publicConfiguration(environment);
  const target = path.resolve(outputDirectory);
  if (target === repository || target === path.parse(target).root || target === path.join(repository, 'app')) throw new Error('Choose a dedicated static output directory.');
  const staging = await fs.mkdtemp(path.join(path.dirname(target), '.abujalife-static-'));
  try {
    const sourceDirectory = path.join(repository, 'app');
    for (const filename of await filesBelow(sourceDirectory, '', false)) {
      if (!publicAssetExtensions.has(path.extname(filename).toLowerCase())) continue;
      const destination = path.join(staging, filename);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(sourceDirectory, filename), destination);
    }
    const result = await build({
      absWorkingDir: repository,
      entryPoints: productionEntryPoints,
      outdir: staging,
      bundle: true,
      splitting: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      minify: true,
      charset: 'utf8',
      legalComments: 'none',
      sourcemap: false,
      metafile: true,
      chunkNames: 'assets/[name]-[hash]',
      plugins: [{ name: 'pinned-three', setup(builder) {
        builder.onResolve({ filter: /(?:^|\/)vendor\/three\.module\.js$/ }, () => ({ path: path.join(repository, 'node_modules/three/build/three.module.js') }));
      } }],
    });
    if (Object.keys(result.metafile.inputs).some(filename => /(?:^|\/)(?:server|preview)\//.test(filename))) throw new Error('A server or preview module was included in the production client.');
    await fs.mkdir(path.join(staging, 'licenses'), { recursive: true });
    await fs.copyFile(path.join(repository, 'node_modules/three/LICENSE'), path.join(staging, 'licenses/three.txt'));
    // Branding exports are public source assets; never replace them with a different design.
    await fs.writeFile(path.join(staging, 'runtime-config.js'), `// Public configuration only; rebuild to change origins.\nglobalThis.ABUJA_PUBLIC_CONFIG=Object.freeze(${JSON.stringify(configuration)});\n`);
    await fs.writeFile(path.join(staging, 'index.html'), configureHTML(await fs.readFile(path.join(sourceDirectory, 'index.html'), 'utf8')));
    const adminHTML = configureHTML(await fs.readFile(path.join(sourceDirectory, 'admin.html'), 'utf8'));
    await fs.writeFile(path.join(staging, 'admin.html'), adminHTML);
    await fs.mkdir(path.join(staging, 'admin'), { recursive: true });
    await fs.writeFile(path.join(staging, 'admin/index.html'), adminHTML);
    const manifest = JSON.parse(await fs.readFile(path.join(sourceDirectory, 'manifest.webmanifest'), 'utf8'));
    manifest.id = '/'; manifest.start_url = '/?source=homescreen'; manifest.scope = '/';
    await fs.writeFile(path.join(staging, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.copyFile(path.join(repository, 'deploy/hostinger.htaccess'), path.join(staging, '.htaccess'));
    await fs.copyFile(path.join(sourceDirectory, 'robots.txt'), path.join(staging, 'robots.txt'));
    const allFiles = await filesBelow(staging);
    const shell = allFiles.filter(filename => !filename.startsWith('.') && !filename.startsWith('admin') && filename !== 'runtime-config.js').map(filename => `/${filename.split(path.sep).join('/')}`);
    const fingerprint = createHash('sha256');
    for (const filename of allFiles) fingerprint.update(filename).update(await fs.readFile(path.join(staging, filename)));
    await fs.writeFile(path.join(staging, 'sw.js'), serviceWorker(shell, fingerprint.digest('hex').slice(0, 16)));
    await fs.rm(target, { recursive: true, force: true });
    await fs.rename(staging, target);
    const files = (await filesBelow(target)).map(filename => filename.split(path.sep).join('/'));
    return { directory: target, outputDirectory: target, configuration, files, shell };
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildProduction().then(({ directory, files, configuration }) => console.log(`Built connected production static site: ${path.relative(repository, directory)} (${files.length} public files). API: ${configuration.API_PUBLIC_URL}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}

const CACHE='abujalife-playable-v2';
const SHELL=['/','/index.html','/app.js','/styles.css','/game.css','/phone.js','/phone.css','/world.js','/world.css','/world-city.js','/world-interiors.js','/map.js','/map.css','/manifest.webmanifest','/icon.svg','/src/shared/atlas.mjs','/src/shared/geography-sources.mjs','/src/shared/life.mjs'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(!SHELL.includes(url.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});

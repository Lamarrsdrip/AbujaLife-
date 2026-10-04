const CACHE='abujalife-city-launch-v8';
const SHELL=["/","/index.html","/app.js","/api-client.js","/auth-recovery.js","/styles.css","/game.css","/premium-pages.css","/life-v4.css","/home-editor.css","/home-editor.js","/home-share.js","/life-panels.js","/phone-browser.js","/phone-social.js","/world-audio.js","/phone.js","/phone.css","/phone-inbox.css","/vehicle-art.js","/product-3d.js","/world.js","/world.css","/world-city.js","/world-interiors.js","/world-3d.js","/world-camera.js","/world-3d-scenes.js","/vendor/three.module.js","/map.js","/map.css","/manifest.webmanifest","/icon.svg","/install.js","/install.css","/brand.js","/brand.css","/page-viewport.js","/travel.css","/icons/icon-192.png","/icons/icon-512.png","/icons/icon-maskable-512.png","/icons/apple-touch-icon.png","/src/shared/atlas.mjs","/src/shared/geography-sources.mjs","/src/shared/life.mjs","/src/shared/vehicles.mjs","/src/shared/origins.mjs","/src/shared/simulation.mjs","/src/shared/home-design.mjs","/src/shared/home-items.mjs","/src/shared/banex.mjs","/phone-home.js","/phone-home.css","/world-spawn.js"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('abujalife-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(!SHELL.includes(url.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(url.pathname,copy));}return response;}).catch(()=>caches.match(url.pathname)));
});

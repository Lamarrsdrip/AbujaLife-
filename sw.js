// Public static shell only. Account data and API responses never enter this cache.
const CACHE='abujalife-production-13e699485c34121f';
const SHELL=["/ads.css","/ads.js","/app.js","/assets/chunk-46QLWU46.js","/assets/chunk-7H257IZD.js","/assets/chunk-AAZABAPM.js","/assets/chunk-EPNA5IRH.js","/assets/chunk-MMGTUHLK.js","/assets/chunk-PDEHE7BK.js","/assets/chunk-Y2ZV3BMG.js","/assets/home-share-N7PD5HY2.js","/brand.css","/furniture-catalogue.css","/game-experience.css","/game-experience.js","/game-kit.css","/game-map.css","/game-map.js","/game-status-hud.css","/game-ui-kit.css","/game-ui-kit.js","/game.css","/home-editor.css","/icon.svg","/icons/apple-touch-icon.png","/icons/icon-192.png","/icons/icon-512.png","/icons/icon-maskable-512.png","/index.html","/install.css","/integrations.css","/integrations.js","/jackpot-admin.css","/jackpot-admin.js","/jackpot.css","/jackpot.js","/licenses/three.txt","/life-v4.css","/living-city.css","/living-city.js","/manifest.webmanifest","/map.css","/outside-city.css","/outside-quick-access.css","/outside-quick-access.js","/phone-home.css","/phone-inbox.css","/phone.css","/premium-pages.css","/social/abujalife-share-v2.png","/styles.css","/travel.css","/world.css"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('abujalife-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/admin')||url.pathname==='/runtime-config.js'||url.pathname==='/sw.js')return;
 const key=url.pathname==='/'?'/index.html':url.pathname;
 if(!SHELL.includes(key))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok&&response.type!=='opaque'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,copy)));}return response;}).catch(()=>caches.match(key)));
});

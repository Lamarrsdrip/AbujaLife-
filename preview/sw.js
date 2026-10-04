// Static Hostinger package only: the public raw-CDN preview does not register this worker.
// This worker caches the local game shell. It provides no account, payments or multiplayer service.
const CACHE='abujalife-local-pwa-v5';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-512.png','/icons/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('abujalife-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!SHELL.includes(url.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(url.pathname,copy));}return response;}).catch(()=>caches.match(url.pathname)));
});

const CACHE='abujalife-single-session-v26';
const LOCAL=self.location.protocol!=='https:';
const SHELL=['/','/index.html','/app.js','/api-client.js','/auth-recovery.js','/auth-session.js','/game-ui-kit.js','/game-ui-kit.css','/game-status-hud.css','/ads.js','/ads.css','/integrations.js','/integrations.css','/styles.css','/game.css','/premium-pages.css','/life-v4.css','/home-editor.css','/home-editor.js','/home-share.js','/life-panels.js','/phone-browser.js','/phone-social.js','/world-audio.js','/phone.js','/phone-home.js','/phone-home.css','/phone.css','/phone-inbox.css','/vehicle-art.js','/product-3d.js','/world.js','/world-presence.js','/world.css','/world-city.js','/outside-city.js','/outside-city.css','/outside-quick-access.js','/outside-quick-access.css','/living-city.js','/living-city.css','/game-map.js','/game-map.css','/game-experience.js','/game-experience.css','/world-interiors.js','/world-3d.js','/world-camera.js','/world-spawn.js','/world-orbit.js','/world-touch.js','/world-materials.js','/world-character.js','/furniture-catalogue.js','/furniture-catalogue.css','/game-kit.css','/world-3d-scenes.js','/vendor/three.module.js','/map.js','/map.css','/manifest.webmanifest','/icon.svg','/install.js','/install.css','/brand.js','/brand.css','/page-viewport.js','/travel.css','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-512.png','/icons/apple-touch-icon.png','/src/shared/atlas.mjs','/src/shared/geography-sources.mjs','/src/shared/life.mjs','/src/shared/vehicles.mjs','/src/shared/origins.mjs','/src/shared/simulation.mjs','/src/shared/home-design.mjs','/src/shared/home-items.mjs','/src/shared/catalogue.mjs','/src/shared/avatars.mjs','/src/shared/furniture-placement.mjs','/src/shared/furniture-metadata.mjs','/src/shared/banex.mjs'];
self.addEventListener('install',event=>{
 if(LOCAL){self.skipWaiting();return;}
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
});
self.addEventListener('activate',event=>{
 if(LOCAL){event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('abujalife-')).map(key=>caches.delete(key)))).then(()=>self.registration.unregister()));return;}
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('abujalife-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(LOCAL)return;
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(!SHELL.includes(url.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(url.pathname,copy));}return response;}).catch(()=>caches.match(url.pathname)));
});
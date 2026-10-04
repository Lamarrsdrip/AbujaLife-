import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createInstallController, isIOSSafari, isInstalled, trustedInstallContext, installCooldownActive, INSTALL_STORAGE_KEY, INSTALL_COOLDOWN_MS } from '../app/install.js';

const SAFARI='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME='Mozilla/5.0 AppleWebKit/537.36 Chrome/132.0 Safari/537.36';
class EventTargetFixture {
 handlers=new Map();
 addEventListener(type,handler){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(handler);}
 removeEventListener(type,handler){this.handlers.get(type)?.delete(handler);}
 dispatch(type,event={}){for(const handler of [...this.handlers.get(type)||[]])handler(event);}
}
function fixture({ios=false,installed=false,manifest=true,active=true,storageBlocked=false,localProgress=false}={}){
 let timestamp=Date.UTC(2026,9,4,10),nextTimer=0;
 const timers=new Map(),saved=new Map(),sheets=[],availability=[];
 const storage={getItem(key){if(storageBlocked)throw new Error('Storage denied');return saved.get(key)||null;},setItem(key,value){if(storageBlocked)throw new Error('Storage denied');saved.set(key,value);}};
 const doc=new EventTargetFixture();doc.hidden=false;
 const node=()=>({isConnected:true,focus(){doc.activeElement=this;}});
 const originalFocus=node();doc.activeElement=originalFocus;
 doc.querySelector=selector=>selector==='link[rel="manifest"]'&&manifest?{getAttribute:()=>'/manifest.webmanifest'}:null;
 doc.createElement=()=>{
  const elements=new Map();
  const sheet={className:'',removed:false,get innerHTML(){return this.markup;},set innerHTML(value){this.markup=value;for(const key of ['.install-card','.install-close','.install-later'])elements.set(key,node());if(value.includes('class="install-primary"'))elements.set('.install-primary',node());},querySelector:selector=>elements.get(selector)||null,querySelectorAll:()=>[elements.get('.install-close'),elements.get('.install-primary'),elements.get('.install-later')].filter(Boolean),remove(){this.removed=true;for(const element of elements.values())element.isConnected=false;}};
  return sheet;
 };
 doc.body={append(sheet){sheets.push(sheet);}};
 const serviceWorker=new EventTargetFixture();serviceWorker.getRegistration=async()=>({active:active?{}:null,scope:'https://abujacity.life/'});
 const win=new EventTargetFixture();Object.assign(win,{navigator:{userAgent:ios?SAFARI:CHROME,standalone:installed,serviceWorker},document:doc,location:{href:'https://abujacity.life/'},localStorage:storage,isSecureContext:true,matchMedia:()=>({matches:false}),setTimeout(callback,delay){const id=++nextTimer;timers.set(id,{callback,delay});return id;},clearTimeout(id){timers.delete(id);}});win.top=win.self=win;
 const controller=createInstallController({window:win,storage,now:()=>timestamp,onAvailabilityChange:value=>availability.push(value),localProgress});
 return {controller,doc,win,storage,saved,sheets,availability,timers,originalFocus,advance(ms){timestamp+=ms;},now:()=>timestamp,async runTimer(){const [id,timer]=timers.entries().next().value||[];assert.ok(timer,'Expected a scheduled install suggestion');timers.delete(id);await timer.callback();}};
}

test('install suggestions require secure owned root-manifest and active worker scope',()=>{
 const context={pageUrl:'https://abujacity.life/',manifestUrl:'/manifest.webmanifest',registrationScope:'https://abujacity.life/',secure:true};
 assert.equal(trustedInstallContext(context),true);
 for(const changed of [{secure:false},{topLevel:false},{manifestUrl:null},{registrationScope:null},{manifestUrl:'https://other.site/manifest.webmanifest'},{manifestUrl:'/preview/manifest.webmanifest'},{registrationScope:'https://other.site/'},{registrationScope:'https://abujacity.life/game/'}])assert.equal(trustedInstallContext({...context,...changed}),false,JSON.stringify(changed));
 assert.equal(trustedInstallContext({...context,pageUrl:'https://abujacity.life/game/?source=homescreen',registrationScope:'https://abujacity.life/game/'}),true);
 assert.equal(trustedInstallContext({...context,pageUrl:'https://abujacity.life/gamers/',registrationScope:'https://abujacity.life/game'}),false);
});

test('iPhone and desktop-mode iPad Safari qualify for honest manual installation steps',()=>{
 assert.equal(isIOSSafari({userAgent:SAFARI}),true);
 assert.equal(isIOSSafari({userAgent:'Mozilla/5.0 (Macintosh) Version/18.0 Safari/605.1.15',platform:'MacIntel',maxTouchPoints:5}),true);
 for(const extra of [' CriOS/123',' FxiOS/18',' EdgiOS/123',' OPiOS/14',' DuckDuckGo/18'])assert.equal(isIOSSafari({userAgent:SAFARI+extra}),false);
 assert.equal(isIOSSafari({userAgent:CHROME}),false);
 assert.equal(isIOSSafari({userAgent:'Mozilla/5.0 Macintosh Safari/605.1.15',platform:'MacIntel',maxTouchPoints:0}),false);
 assert.equal(isInstalled({navigator:{standalone:true}}),true);
 assert.equal(isInstalled({navigator:{},matchMedia:query=>({matches:query==='(display-mode: standalone)'})}),true);
});

test('dismissal cooldown lasts seven real days and malformed or denied storage is tolerated',()=>{
 const f=fixture();f.saved.set(INSTALL_STORAGE_KEY,JSON.stringify({dismissedUntil:f.now()+INSTALL_COOLDOWN_MS}));
 assert.equal(installCooldownActive(f.storage,f.now()),true);
 f.advance(INSTALL_COOLDOWN_MS);assert.equal(installCooldownActive(f.storage,f.now()),false);
 for(const raw of ['{broken','null','{"dismissedUntil":"tomorrow"}']){f.saved.set(INSTALL_STORAGE_KEY,raw);assert.equal(installCooldownActive(f.storage,f.now()),false);}
 assert.equal(installCooldownActive({getItem(){throw new Error('Denied');}},f.now()),false);f.controller.destroy();
});

test('ordinary Chromium, CDN preview without manifest and inactive-worker Safari remain quiet',async()=>{
 for(const options of [{},{ios:true,manifest:false},{ios:true,active:false}]){
  const f=fixture(options);assert.equal(await f.controller.refresh(),false);assert.equal(await f.controller.show({manual:true}),false);assert.equal(f.sheets.length,0);assert.equal(f.timers.size,0);f.controller.destroy();
 }
});

test('explicit native-event fixture calls browser prompt only from the installation button',async()=>{
 const f=fixture();let prompted=0,prevented=0;
 // This event is a unit fixture. It does not certify real operating-system installation.
 const event={preventDefault(){prevented++;},prompt(){prompted++;return Promise.resolve();},userChoice:Promise.resolve({outcome:'accepted'})};
 f.win.dispatch('beforeinstallprompt',event);await f.controller.refresh();
 assert.equal(prevented,1);assert.equal(f.controller.available,true);assert.equal(prompted,0);
 assert.equal(await f.controller.show({manual:true}),true);assert.equal(prompted,0);
 const sheet=f.sheets.at(-1);assert.match(sheet.innerHTML,/Add to Home Screen/);
 await sheet.querySelector('.install-primary').onclick();assert.equal(prompted,1);assert.equal(sheet.removed,true);assert.equal(f.doc.activeElement,f.originalFocus);assert.equal(f.controller.available,false);
 f.win.dispatch('appinstalled');await f.controller.refresh();assert.equal(await f.controller.show({manual:true}),false);assert.equal(f.timers.size,0);f.controller.destroy();
});

test('Safari receives a delayed manual guide, then a seven-day reminder cooldown',async()=>{
 const f=fixture({ios:true});await f.controller.refresh();assert.equal(f.controller.available,true);assert.equal([...f.timers.values()][0].delay,20000);
 await f.runTimer();const sheet=f.sheets.at(-1);assert.match(sheet.innerHTML,/Safari’s/);assert.match(sheet.innerHTML,/Choose <strong>Add to Home Screen/);assert.equal(sheet.querySelector('.install-primary'),null);
 sheet.querySelector('.install-later').onclick();assert.equal(sheet.removed,true);await f.controller.refresh();assert.equal(f.timers.size,0);assert.equal(await f.controller.show(),false);
 f.advance(INSTALL_COOLDOWN_MS-1);await f.controller.refresh();assert.equal(f.timers.size,0);
 f.advance(1);await f.controller.refresh();assert.equal(f.timers.size,1);await f.runTimer();assert.equal(f.sheets.length,2);f.controller.destroy();
});

test('manual install can reopen a dismissed guide, installed apps never receive suggestions',async()=>{
 const f=fixture({ios:true});await f.controller.refresh();await f.controller.show();f.sheets.at(-1).querySelector('.install-close').onclick();assert.equal(await f.controller.show(),false);assert.equal(await f.controller.show({manual:true}),true);f.controller.destroy();
 const installed=fixture({ios:true,installed:true});await installed.controller.refresh();assert.equal(installed.controller.available,false);assert.equal(await installed.controller.show({manual:true}),false);assert.equal(installed.timers.size,0);installed.controller.destroy();
});

test('denied storage still remembers dismissal for this session and local installations disclose device saves',async()=>{
 const f=fixture({ios:true,storageBlocked:true,localProgress:true});await f.controller.refresh();await f.controller.show();
 assert.match(f.sheets.at(-1).innerHTML,/This preview saves on this device/);assert.doesNotMatch(f.sheets.at(-1).innerHTML,/stay with your account/);
 f.sheets.at(-1).querySelector('.install-later').onclick();await f.controller.refresh();assert.equal(await f.controller.show(),false);assert.equal(f.timers.size,0);f.controller.destroy();
});

test('parallel show calls create one dialog and destroy removes listeners and timers',async()=>{
 const f=fixture({ios:true});await f.controller.refresh();const shown=await Promise.all([f.controller.show(),f.controller.show()]);assert.deepEqual(shown,[true,false]);assert.equal(f.sheets.length,1);
 f.controller.destroy();assert.equal(f.sheets[0].removed,true);assert.equal(f.timers.size,0);for(const listeners of f.win.handlers.values())assert.equal(listeners.size,0);assert.equal(await f.controller.show({manual:true}),false);
});

test('real PNG dimensions and both manifests provide required icons, root scopes and honest static description',()=>{
 for(const root of ['app','preview']){
  const manifest=JSON.parse(fs.readFileSync(`${root}/manifest.webmanifest`,'utf8'));assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/?source=homescreen');assert.equal(manifest.display,'standalone');
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'&&icon.type==='image/png'));assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='maskable'));
  for(const icon of manifest.icons){if(icon.type!=='image/png')continue;const data=fs.readFileSync(`app${icon.src}`);assert.deepEqual([...data.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,icon.sizes);}
 }
 const apple=fs.readFileSync('app/icons/apple-touch-icon.png');assert.equal(apple.readUInt32BE(16),180);assert.equal(apple[25],2,'Apple icon must be opaque RGB');
 const maskable=fs.readFileSync('app/icons/icon-maskable-512.png');assert.equal(maskable[25],2,'Maskable background must be opaque RGB');
 assert.match(JSON.parse(fs.readFileSync('preview/manifest.webmanifest','utf8')).description,/local preview saves on this device/);
});

test('both actual service workers cache query-bearing launch shell and never intercept private APIs',async()=>{
 for(const root of ['app','preview']){
  const handlers=new Map(),cached=new Map(),intercepted=[];let offline=false;
  const worker={location:{origin:'https://abujacity.life'},clients:{claim:async()=>{}},addEventListener(type,handler){handlers.set(type,handler);}};
  const cache={async addAll(urls){for(const url of urls){const file=url==='/'?`${root}/index.html`:url==='/manifest.webmanifest'?`${root}/manifest.webmanifest`:url.startsWith('/src/')?url.slice(1):`app${url}`;assert.ok(fs.existsSync(file),`Precache file missing: ${file}`);cached.set(url,{fromCache:url});}},async put(url,response){cached.set(url,response);}};
  const caches={async open(){return cache;},async keys(){return ['unrelated-cache'];},async delete(){throw new Error('Unrelated cache deletion');},async match(url){return cached.get(url);}};
  const context=vm.createContext({self:worker,URL,caches,fetch:async()=>{if(offline)throw new Error('Offline');return {ok:true,clone(){return this;}};}});
  vm.runInContext(fs.readFileSync(`${root}/sw.js`,'utf8'),context);let installation;handlers.get('install')({waitUntil(promise){installation=promise;}});await installation;
  offline=true;
  for(const url of ['/api/bootstrap','/api/payments/status','https://another.site/'])handlers.get('fetch')({request:{method:'GET',url:new URL(url,'https://abujacity.life').href},respondWith(promise){intercepted.push(promise);}});
  assert.equal(intercepted.length,0);
  const event={request:{method:'GET',url:'https://abujacity.life/?source=homescreen'},respondWith(promise){intercepted.push(promise);}};handlers.get('fetch')(event);assert.equal((await intercepted[0]).fromCache,'/');
  let activation;handlers.get('activate')({waitUntil(promise){activation=promise;}});await activation;
 }
});

from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text): (ROOT/path).write_text(text,encoding='utf-8')
def once(text,old,new,label):
    count=text.count(old)
    if count!=1: raise SystemExit(f'{label}: expected 1 anchor, got {count}')
    return text.replace(old,new,1)

# 1) Restore visible urban density in the playable world without weakening venue authority.
p='app/world-city.js'; s=read(p)
old=""" for(const spec of specs) {
  if(spec.id!=='home'&&!venues.some(venue=>venue.id===spec.id))continue;
  spec.name=venues.find(v=>v.id===spec.id)?.name||spec.name;
  art+=building(spec);
  obstacles.push({x:spec.x-4,y:spec.y-spec.h-8,w:spec.w+31,h:spec.h+18});
  const isHome=spec.id==='home',canHome=profile.home?.district===profile.district||!profile.district;
  interactables.push({id:spec.id,x:spec.x+spec.w/2,y:spec.y+58,label:isHome?(canHome?'Your front door':'View homes'):(venues.find(v=>v.id===spec.id)?.name||spec.name),action:isHome?(canHome?'enter-home':'estate-office'):'enter-venue',payload:isHome?{}:{venueId:spec.id},radius:78,icon:isHome?'⌂':({restaurant:'♨',gym:'↗',hotel:'✦',cinema:'▷',dealership:'↔','estate-office':'⌂','furniture-store':'▱',grocery:'✿'}[spec.id])});
 }
"""
new=""" for(const spec of specs) {
  const localVenue=venues.find(venue=>venue.id===spec.id);
  spec.name=localVenue?.name||spec.name;
  art+=building(spec);
  obstacles.push({x:spec.x-4,y:spec.y-spec.h-8,w:spec.w+31,h:spec.h+18});
  const isHome=spec.id==='home',canHome=profile.home?.district===profile.district||!profile.district;
  // Abuja should still look like a city when a venue belongs to another district.
  // Only the authoritative local venue (or the resident's own home) is directly enterable.
  if(isHome||localVenue)interactables.push({id:spec.id,x:spec.x+spec.w/2,y:spec.y+58,label:isHome?(canHome?'Your front door':'View homes'):(localVenue?.name||spec.name),action:isHome?(canHome?'enter-home':'estate-office'):'enter-venue',payload:isHome?{}:{venueId:spec.id},radius:78,icon:isHome?'⌂':({restaurant:'♨',gym:'↗',hotel:'✦',cinema:'▷',dealership:'↔','estate-office':'⌂','furniture-store':'▱',grocery:'✿'}[spec.id])});
 }
"""
s=once(s,old,new,'world city venue-filtered building loop')
# Give the left-hand resident neighbourhood extra skyline depth while keeping roads/doors clear.
anchor=" art+=garden(1340,1102,362,352,true)+garden(155,1850,640,280)+garden(2250,1860,1030,280,true);"
insert=""" const neighbourhoodFabric=[
  {x:40,y:1188,w:330,h:145,c:'#d9d1be'},{x:430,y:1200,w:285,h:132,c:'#c9cfbf'},{x:820,y:1192,w:310,h:150,c:'#e0d7c2'},
  {x:2140,y:1200,w:320,h:145,c:'#d2c9b6'},{x:2570,y:1200,w:300,h:138,c:'#c8d0c0'},{x:2960,y:1200,w:315,h:150,c:'#ddd4be'},
  {x:820,y:2840,w:325,h:154,c:'#d4cbb8'},{x:1370,y:2840,w:315,h:146,c:'#cad1c1'},{x:2160,y:2840,w:330,h:150,c:'#e0d6c0'},
  {x:2700,y:2840,w:310,h:142,c:'#cdd0bd'},{x:3050,y:3650,w:300,h:148,c:'#d9ceb9'},{x:1710,y:3650,w:330,h:150,c:'#c9d0bf'}
 ];
 for(const [i,b] of neighbourhoodFabric.entries()){
  const top=b.y-b.h,windows=Array.from({length:4},(_,k)=>rect(b.x+28+k*(b.w-62)/4,top+38,34,42,'#76918b',3)+rect(b.x+28+k*(b.w-62)/4,top+91,34,28,'#829a91',3)).join('');
  art+=`<g class=\"city-neighbourhood-fabric\" aria-hidden=\"true\">${rect(b.x,top,b.w,b.h,b.c,7)}${rect(b.x-7,top,b.w+14,10,'#eee7d4',4)}${windows}${rect(b.x+b.w*.44,b.y-58,b.w*.14,58,'#617a70',3)}</g>`;
  obstacles.push({x:b.x-5,y:top-6,w:b.w+20,h:b.h+14});
  if(i%2===0)art+=cityTree(b.x-24,b.y-8,.58,i%4===0);
 }
"""+anchor
s=once(s,anchor,insert,'neighbourhood fabric anchor')
write(p,s)

# 2) House furniture: one authoritative placement per item/property; remove built-in fixture when a saved placement exists.
p='app/world-interiors.js'; s=read(p)
old="""function addOwnedFurniture(s,profile,owned) {
  const configured=profile.furnitureLayout||profile.home?.furnitureLayout||profile.home?.furniture||{};
  const entries=Array.isArray(configured)?configured:Object.entries(configured).map(([itemId,value])=>({itemId,...(typeof value==='object'?value:{slot:value})}));
  s.furniturePlacements=[];
"""
new="""function addOwnedFurniture(s,profile,owned) {
  const configured=profile.furnitureLayout||profile.home?.furnitureLayout||profile.home?.furniture||{};
  const rawEntries=Array.isArray(configured)?configured:Object.entries(configured).map(([itemId,value])=>({itemId,...(typeof value==='object'?value:{slot:value})}));
  const currentProperty=profile.home?.propertyId,entryByItem=new Map();
  for(const entry of rawEntries){
    const itemId=entry?.itemId||entry?.id;if(!itemId)continue;
    const previous=entryByItem.get(itemId),isCurrent=!entry.propertyId||entry.propertyId===currentProperty,previousCurrent=previous&&(!previous.propertyId||previous.propertyId===currentProperty);
    if(!previous||isCurrent&&!previousCurrent)entryByItem.set(itemId,{...entry,itemId});
  }
  const entries=[...entryByItem.values()];
  s.furniturePlacements=[];
"""
s=once(s,old,new,'furniture source normalization')
old="""  const adoptBase=itemId=>{
    const base=s.items.find(v=>itemId==='bed'?v.art.includes('#faf2df'):itemId==='dining-table'?v.art.includes('#6b8653')&&v.art.includes('#efe6cd'):false);
    if(!base)return false;
"""
new="""  const baseFor=itemId=>s.items.find(v=>itemId==='bed'?v.art.includes('#faf2df'):itemId==='dining-table'?v.art.includes('#6b8653')&&v.art.includes('#efe6cd'):itemId==='sofa'?v.art.includes('#d9b984')&&v.art.includes('#e4dfc5'):false);
  const removeBase=itemId=>{
    const base=baseFor(itemId);if(!base)return false;
    s.items.splice(s.items.indexOf(base),1);
    const objectIndex=s.objects.findIndex(o=>o.x===base.x&&o.y===base.footY&&o.w===base.w&&o.h===base.h);if(objectIndex>=0)s.objects.splice(objectIndex,1);
    const obstacleIndex=s.obstacles.findIndex(b=>b.x===base.x&&b.y===base.footY&&b.w===base.w&&b.h===base.h);if(obstacleIndex>=0)s.obstacles.splice(obstacleIndex,1);
    return true;
  };
  const adoptBase=itemId=>{
    const base=baseFor(itemId);
    if(!base)return false;
"""
s=once(s,old,new,'shared base furniture helper')
old="""    if(!stored&&['bed','dining-table'].includes(itemId)&&adoptBase(itemId))continue;
    if(itemId==='sofa') {
      const base=s.items.find(v=>v.art.includes('#d9b984')&&v.art.includes('#e4dfc5'));
"""
new="""    if(!stored&&['bed','dining-table'].includes(itemId)&&adoptBase(itemId))continue;
    if(stored&&['bed','dining-table'].includes(itemId))removeBase(itemId);
    if(itemId==='sofa') {
      const base=baseFor('sofa');
"""
s=once(s,old,new,'remove base fixtures for stored placements')
old="if(base&&stored){s.items.splice(s.items.indexOf(base),1);const objectIndex=s.objects.findIndex(o=>o.x===base.x&&o.y===base.footY&&o.w===base.w&&o.h===base.h);if(objectIndex>=0)s.objects.splice(objectIndex,1);const index=s.obstacles.findIndex(b=>b.x===base.x&&b.y===base.footY&&b.w===base.w&&b.h===base.h);if(index>=0)s.obstacles.splice(index,1);}"
s=once(s,old,"if(base&&stored)removeBase('sofa');",'sofa base removal')
write(p,s)

# 3) House Go Out control + resilient active-presence heartbeat.
p='app/app.js'; s=read(p)
old="""  const atHome=p.location?.kind==='home',row=document.createElement('div'),home=document.createElement('button');
  row.className='world-action-row';home.type='button';home.className='world-home-shortcut';home.dataset.quickHome='';
  home.setAttribute('aria-label',atHome?'You are at your own home':'Go to your own home');home.title=atHome?'Your own home':'Head home';
  home.disabled=atHome||!!p.activeTrip||quickHomeNavigating;home.innerHTML=`${icon('world')}<span>Home</span>`;home.onclick=goHome;
  sprint.before(row);row.append(home,sprint);
"""
new="""  const atHome=p.location?.kind==='home',row=document.createElement('div'),home=document.createElement('button');
  row.className='world-action-row';home.type='button';home.className=atHome?'world-home-shortcut world-go-out-shortcut':'world-home-shortcut';home.dataset.quickHome='';
  home.setAttribute('aria-label',atHome?'Go outside your home':'Go to your own home');home.title=atHome?'Go outside':'Head home';
  home.disabled=!!p.activeTrip||quickHomeNavigating;home.innerHTML=atHome?`${icon('arrow')}<span>Go Out</span>`:`${icon('world')}<span>Home</span>`;home.onclick=atHome?()=>navigate('outside'):goHome;
  sprint.before(row);row.append(home,sprint);
"""
s=once(s,old,new,'house go-out shortcut')
old="setInterval(()=>void posePublisher.publish(),500);\nsetInterval(()=>{if(state.authenticated&&!document.hidden&&!document.querySelector('[aria-modal=\"true\"]'))refresh({render:false}).catch(()=>{});},60000);"
new="setInterval(()=>void posePublisher.publish(),500);\nsetInterval(()=>{if(state.authenticated&&!document.hidden)void api('/api/presence',{method:'POST',body:{heartbeat:true}}).catch(()=>{});},20000);\nsetInterval(()=>{if(state.authenticated&&!document.hidden&&!document.querySelector('[aria-modal=\"true\"]'))refresh({render:false}).catch(()=>{});},60000);"
s=once(s,old,new,'presence heartbeat')
write(p,s)

# 4) Map opens at the requested medium overview, keeping full zoom range.
p='app/outside-city-v4.js'; s=read(p)
s=once(s,"view={x:home?.x||0,z:home?.z||0,zoom:1.06,yaw:.42,elevation:.82}","view={x:home?.x||0,z:home?.z||0,zoom:.82,yaw:.42,elevation:.82}",'map default zoom')
write(p,s)

# 5) Phone frame: restore a complete, restrained handset in view without losing new apps/features.
p='app/phone.css'; s=read(p)
s += """

/* 2026-10 final phone framing: keep the whole handset visible and calm on mobile. */
.phone-root .ph-backdrop{padding:24px 16px 48px}
.phone-root .ph-device{width:min(348px,calc(100vw - 44px),calc((100dvh - 100px)*.474));height:min(735px,calc(100dvh - 100px));border-radius:46px;padding:7px}
.phone-root .ph-screen{border-radius:38px}
@media(max-width:600px){
 .phone-root .ph-backdrop{padding:max(18px,env(safe-area-inset-top)) 16px max(38px,env(safe-area-inset-bottom))}
 .phone-root .ph-device{width:min(334px,calc(100vw - 42px));height:min(706px,calc(100dvh - 82px));max-height:calc(100dvh - 82px)}
 .phone-root.phone-chat-open .ph-backdrop{top:var(--ph-chat-viewport-top,0);height:var(--ph-chat-viewport-height,100dvh);bottom:auto;padding:10px 14px 24px}
 .phone-root.phone-chat-open .ph-device{width:min(334px,calc(100vw - 42px));height:min(706px,calc(var(--ph-chat-viewport-height,100dvh) - 42px));min-height:300px}
}
"""
write(p,s)

# 6) Chat transfer receipt must never collapse into vertical text or overflow.
p='app/phone-chat-pro.css'; s=read(p)
s += """

/* Compact, receipt-like Naira transfer card. */
#phone-root.chat-pro-ready .ph-message:has(.ph-transfer-message){max-width:min(88%,290px);width:auto}
#phone-root .ph-transfer-message{width:min(272px,100%)!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;padding:12px 13px!important}
#phone-root .pro-transfer-top{grid-template-columns:28px minmax(0,1fr) auto!important;gap:8px!important}
#phone-root .pro-transfer-top>span:nth-child(2){min-width:0!important;overflow:hidden}
#phone-root .pro-transfer-top small,#phone-root .pro-transfer-top strong{display:block;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;word-break:normal!important;overflow-wrap:normal!important}
#phone-root .pro-transfer-top em{white-space:nowrap!important;flex:none}
#phone-root .pro-transfer-amount{font-size:clamp(22px,7vw,28px)!important;line-height:1.05!important;white-space:nowrap!important;word-break:normal!important;overflow-wrap:normal!important;overflow:hidden;text-overflow:ellipsis;margin:13px 0 7px!important}
#phone-root .pro-transfer-person{display:block;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;word-break:normal!important;overflow-wrap:normal!important}
#phone-root .pro-transfer-foot{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important}
#phone-root .pro-transfer-foot span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:380px){#phone-root.chat-pro-ready .ph-message:has(.ph-transfer-message){max-width:92%}#phone-root .ph-transfer-message{width:100%!important}#phone-root .pro-transfer-top em{font-size:8px;padding:4px 6px}}
"""
write(p,s)

# 7) Driving/path presentation: readable route, current driving state exposed each frame.
p='app/world-simulator.js'; s=read(p)
old="container.dataset.moving=String(moving);container.dataset.distance=travelDistance.toFixed(1);"
new="container.dataset.moving=String(moving);container.dataset.driving=String(driving);container.dataset.distance=travelDistance.toFixed(1);"
s=once(s,old,new,'driving dataset refresh')
write(p,s)

p='app/world.css'; s=read(p)
s += """

/* Route guidance stays legible at road scale and while driving. */
.world-route-line{stroke:#fff0b8;stroke-width:5;stroke-dasharray:12 9;opacity:.9;filter:drop-shadow(0 1px 2px #17392f) drop-shadow(0 0 4px #17392f66)}
.world-canvas[data-driving=\"true\"] .world-route-line{stroke:#ffd46f;stroke-width:6;stroke-dasharray:18 10;opacity:1;animation:abjRouteDrive .85s linear infinite}
@keyframes abjRouteDrive{to{stroke-dashoffset:-28}}
.world-go-out-shortcut{background:linear-gradient(145deg,#f5c75f,#e2a93d)!important;color:#213d31!important;box-shadow:0 14px 32px #7a5a1738!important;min-width:126px!important;font-weight:850!important}
.world-go-out-shortcut svg{width:20px;height:20px}
.world-go-out-shortcut span{font-size:15px;letter-spacing:-.02em}
"""
write(p,s)

# 8) Presence stats: lower UI cache latency and tolerate short mobile/network heartbeat gaps.
p='src/server/cityStats.mjs'; s=read(p)
s=once(s,'const GLOBAL_CACHE_MS = 4000;\nconst ZONE_CACHE_MS = 2500;','const GLOBAL_CACHE_MS = 1000;\nconst ZONE_CACHE_MS = 1000;','stats cache responsiveness')
write(p,s)
p='src/server/mongo/presenceStore.mjs'; s=read(p)
s=once(s,'constructor(game,social=game.social,{leaseMs=45000,maxNearby=50}={})','constructor(game,social=game.social,{leaseMs=75000,maxNearby=50}={})','presence lease resilience')
write(p,s)

p='src/server/production-http.mjs'; s=read(p)
anchor="if(pathname==='/api/presence'&&method==='POST'){lastSeen.set(id,Date.now());await reindex(id);if(body.pose){"
replacement="if(pathname==='/api/presence'&&method==='POST'){lastSeen.set(id,Date.now());await reindex(id);if(body.heartbeat===true){if(presence)await presence.touch(id,{connectionId:'heartbeat',zone:await store.zone(id)});return json(res,200,{ok:true,serverTime:store.clock()});}if(body.pose){"
s=once(s,anchor,replacement,'production lightweight presence heartbeat')
write(p,s)
p='src/server/http.mjs'; s=read(p)
anchor="if(pathname==='/api/presence'&&method==='POST'){lastSeen.set(id,Date.now());reindex(id);if(body.pose){"
replacement="if(pathname==='/api/presence'&&method==='POST'){lastSeen.set(id,Date.now());reindex(id);if(body.heartbeat===true)return json(res,200,{ok:true,serverTime:store.clock()});if(body.pose){"
s=once(s,anchor,replacement,'dev lightweight presence heartbeat')
write(p,s)

# 9) Durable regression coverage for the exact failures reported in the live UI.
p='tests/final-world-phone-regression.test.mjs'
write(p,"""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Outside keeps city fabric visible while direct entry stays district-authoritative',()=>{
 const city=read('app/world-city.js');
 assert.doesNotMatch(city,/spec\.id!==['\"]home['\"]&&!venues\.some\([^\n]+\)\)continue/);
 assert.match(city,/const localVenue=venues\.find/);
 assert.match(city,/city-neighbourhood-fabric/);
 assert.match(city,/CITY_LANDMARKS/);
});

test('house exposes Go Out and deduplicates authored versus saved furniture',()=>{
 const app=read('app/app.js'),interiors=read('app/world-interiors.js');
 assert.match(app,/world-go-out-shortcut/);
 assert.match(app,/>Go Out</);
 assert.match(interiors,/entryByItem=new Map/);
 assert.match(interiors,/removeBase\(itemId\)/);
 assert.match(interiors,/\['bed','dining-table'\]/);
});

test('map opens at medium overview but retains extreme zoom',()=>{
 const map=read('app/outside-city-v4.js');
 assert.match(map,/zoom:\.82,yaw:\.42/);
 assert.match(map,/minZoom:\.22,maxZoom:24/);
});

test('phone stays framed and Naira receipts cannot collapse vertically',()=>{
 const phone=read('app/phone.css'),chat=read('app/phone-chat-pro.css');
 assert.match(phone,/whole handset visible/);
 assert.match(chat,/receipt-like Naira transfer card/);
 assert.match(chat,/white-space:nowrap!important/);
 assert.match(chat,/grid-template-columns:28px minmax\(0,1fr\) auto/);
});

test('presence heartbeat is lightweight and stats refresh quickly',()=>{
 const app=read('app/app.js'),prod=read('src/server/production-http.mjs'),stats=read('src/server/cityStats.mjs'),presence=read('src/server/mongo/presenceStore.mjs');
 assert.match(app,/heartbeat:true/);assert.match(prod,/body\.heartbeat===true/);assert.match(stats,/GLOBAL_CACHE_MS = 1000/);assert.match(presence,/leaseMs=75000/);
});

test('driving route remains visibly guided',()=>{
 const world=read('app/world.css'),sim=read('app/world-simulator.js');
 assert.match(world,/abjRouteDrive/);assert.match(world,/data-driving/);assert.match(sim,/dataset\.driving=String\(driving\)/);
});
""")
print('final regression polish materialized')

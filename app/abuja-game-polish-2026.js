import './civic-life.js';

const appRoot=document.querySelector('#app');
const sheetRoot=document.querySelector('#sheet-root');
const phoneRoot=document.querySelector('#phone-root');

function fixHeaderIcon(scope=document){
  scope.querySelectorAll?.('.game-header .wordmark').forEach(wordmark=>{
    if(wordmark.querySelector('.abj-header-app-icon'))return;
    wordmark.innerHTML='<img class="abj-header-app-icon" src="/icon.svg?v=abuja-brand-v2" alt="AbujaLife">';
    wordmark.setAttribute('aria-label','AbujaLife home');
  });
}

function cleanMyLife(scope=document){
  scope.querySelectorAll?.('.abj-life-shortcuts').forEach(node=>node.remove());
  const hubs=[...scope.querySelectorAll?.('.abj-life-game-hub')||[]];
  hubs.slice(1).forEach(node=>node.remove());
  const hub=hubs[0];
  if(hub){hub.querySelectorAll('.abj-life-vitals,.abj-life-live-head,.abj-live-places').forEach(node=>node.remove());hub.classList.add('abj-life-game-hub--compact');}
}

function closeMapThen(run){document.querySelector('.abj-restored-map [data-restored-map-close]')?.click();requestAnimationFrame(()=>requestAnimationFrame(run));}
function ensureMapNav(scope=document){
  scope.querySelectorAll?.('.abj-restored-map').forEach(map=>{
    if(map.querySelector('.abj-map-bottom-nav'))return;
    const nav=document.createElement('nav');nav.className='abj-map-bottom-nav';nav.setAttribute('aria-label','Game navigation');
    nav.innerHTML=`<button type="button" data-map-game-nav="play" aria-label="Return to Play"><span class="abj-nav-icon">⌂</span><strong>Play</strong></button><button type="button" data-map-game-nav="map" class="active" aria-current="page" aria-label="Map"><span class="abj-nav-icon">◇</span><strong>Map</strong></button><button type="button" data-map-game-nav="life" aria-label="Open My Life"><span class="abj-nav-icon">☀</span><strong>My life</strong></button><button type="button" data-map-game-nav="phone" aria-label="Open Phone"><span class="abj-nav-icon">▯</span><strong>Phone</strong></button>`;
    map.append(nav);
    nav.addEventListener('click',event=>{const button=event.target.closest('[data-map-game-nav]');if(!button)return;const action=button.dataset.mapGameNav;if(action==='map'){map.querySelector('[data-outside-action="overview"]')?.click();return;}if(action==='play')closeMapThen(()=>appRoot?.querySelector('.game-nav [data-view="world"]')?.click());if(action==='life')closeMapThen(()=>appRoot?.querySelector('.game-nav [data-nav-life]')?.click());if(action==='phone')closeMapThen(()=>appRoot?.querySelector('.game-nav [data-phone="home"]')?.click());});
  });
}
function ensureWholeCityButton(scope=document){const stage=scope.querySelector?.('.game-content.view-world .world-stage');if(!stage||stage.querySelector('[data-open-whole-abuja]'))return;const button=document.createElement('button');button.type='button';button.className='abj-whole-city-button';button.dataset.openWholeAbuja='';button.innerHTML='<span>◇</span><strong>Whole Abuja</strong>';button.setAttribute('aria-label','Open the whole Abuja city map');button.onclick=()=>appRoot?.querySelector('.game-nav [data-nav-outside]')?.click();stage.append(button);}

// Keep the virtual phone honest and player-oriented. Do not advertise a dead
// feature as if it worked, and do not pretend the in-game device is a real
// Apple model. Existing working screens stay intact; only misleading launcher
// surfaces are corrected here while the canonical phone state remains phone.js.
function auditPhone(scope=document){
  scope.querySelectorAll?.('.ph-app-grid [data-app="calls"]').forEach(button=>button.remove());
  scope.querySelectorAll?.('.ph-app-label').forEach(label=>{
    const text=label.textContent?.trim();
    if(text==='Outside')label.textContent='Map';
    else if(text==='Camera')label.textContent='Profile';
    else if(text==='Xshare')label.textContent='Share';
  });
  scope.querySelectorAll?.('.ph-page-intro h2').forEach(title=>{if(title.textContent?.trim()==='Camera & profile')title.textContent='Profile';});
  scope.querySelectorAll?.('#ph-device-name,.ph-about strong').forEach(label=>{if(/iphone/i.test(label.textContent||''))label.textContent='AbujaLife Phone';});
}

function decorate(scope=document){fixHeaderIcon(scope);cleanMyLife(scope);ensureMapNav(scope);ensureWholeCityButton(scope);auditPhone(scope);}
decorate();
const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;decorate(node);decorate(document);}});
observer.observe(document.documentElement,{childList:true,subtree:true});
addEventListener('hashchange',()=>queueMicrotask(()=>decorate()));

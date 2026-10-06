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

function ensureCivicPhoneApp(scope=document){
  const grids=[...scope.querySelectorAll?.('.ph-app-grid')||[]];
  if(scope.matches?.('.ph-app-grid'))grids.unshift(scope);
  for(const grid of new Set(grids)){
    if(grid.querySelector('[data-civic-phone-app]'))continue;
    const button=document.createElement('button');button.type='button';button.className='ph-launcher civic-phone-launcher';button.dataset.civicPhoneApp='';button.setAttribute('aria-label','Open City Story and Election');
    button.innerHTML='<span class="ph-app-icon civic-phone-icon" aria-hidden="true"><span style="font-size:27px;line-height:1">◆</span></span><span class="ph-app-label">City Story</span>';
    button.onclick=()=>window.dispatchEvent(new CustomEvent('abj:open-civic-life'));
    grid.append(button);
  }
}

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
  scope.querySelectorAll?.('.ph-about strong').forEach(label=>{if(label.textContent?.trim()==='iPhone 18 Pro Max')label.textContent='AbujaLife Phone';});
  scope.querySelectorAll?.('.ph-device-caption').forEach(label=>{if(/iphone/i.test(label.textContent||''))label.textContent='AbujaLife Phone';});
}

// world.js keeps an SVG safety body for each resident so a WebGL failure never
// becomes a floating nametag. Once the canonical 3D renderer is mounted it has
// a rig for every resident in the same neighbours array, so hide that one SVG
// body. Context-loss CSS immediately exposes the safety body again.
function syncResidentBodies(scope=document){
  const canvases=[];
  if(scope.matches?.('.world-canvas'))canvases.push(scope);
  canvases.push(...scope.querySelectorAll?.('.world-canvas')||[]);
  for(const canvas of new Set(canvases)){
    const ready=canvas.dataset.characterRenderer==='webgl-3d'&&canvas.dataset.webglContext!=='lost';
    canvas.querySelectorAll('.world-online-resident').forEach(node=>node.classList.toggle('has-webgl-resident',ready));
  }
}

function syncPhoneViewport(){
  if(!phoneRoot)return;
  const mobile=globalThis.matchMedia?.('(max-width: 700px)').matches===true;
  if(!mobile){phoneRoot.style.removeProperty('--abj-phone-vh');phoneRoot.style.removeProperty('--abj-phone-vtop');phoneRoot.classList.remove('abj-phone-input-active');return;}
  const viewport=globalThis.visualViewport;
  const height=Math.max(240,Math.round(viewport?.height||globalThis.innerHeight||700));
  const top=Math.max(0,Math.round(viewport?.offsetTop||0));
  phoneRoot.style.setProperty('--abj-phone-vh',`${height}px`);
  phoneRoot.style.setProperty('--abj-phone-vtop',`${top}px`);
  const focused=phoneRoot.contains(document.activeElement)&&document.activeElement?.matches?.('input,textarea,select');
  phoneRoot.classList.toggle('abj-phone-input-active',Boolean(focused));
}

function decorate(scope=document){fixHeaderIcon(scope);cleanMyLife(scope);ensureMapNav(scope);ensureWholeCityButton(scope);ensureCivicPhoneApp(scope);auditPhone(scope);syncResidentBodies(scope);}
decorate();syncPhoneViewport();
const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;decorate(node);decorate(document);}syncResidentBodies(document);syncPhoneViewport();});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-character-renderer','data-webgl-context']});
addEventListener('hashchange',()=>queueMicrotask(()=>decorate()));
addEventListener('resize',syncPhoneViewport,{passive:true});
visualViewport?.addEventListener('resize',syncPhoneViewport,{passive:true});
visualViewport?.addEventListener('scroll',syncPhoneViewport,{passive:true});
document.addEventListener('focusin',syncPhoneViewport);document.addEventListener('focusout',()=>requestAnimationFrame(syncPhoneViewport));

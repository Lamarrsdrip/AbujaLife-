import {showGameToast as toast} from './game-toast.js';
import { apiFetch } from './api-client.js';
import { brandMark } from './brand.js';
import { renderMap } from './map.js';
import { avatarSVG } from './world.js';

const appRoot=document.querySelector('#app');
const sheetRoot=document.querySelector('#sheet-root');
const toastRoot=document.querySelector('#toast');
const WELCOME_KEY='abujalife.welcome-back.v1';
// Payment callbacks resume an existing life. Capture this before their handler
// removes the query string so a delayed bootstrap cannot open a welcome modal.
const PAYMENT_RETURN_AT_ENTRY=['payment','payment_ref','ad_payment_ref','jackpot_payment_ref','jp_payment_ref','transaction_id'].some(key=>new URL(location.href).searchParams.has(key));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const compact=value=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(Number(value||0));
const money=value=>`₦${new Intl.NumberFormat('en-NG',{maximumFractionDigits:0}).format(Number(value||0))}`;

let snapshot=null,stats=null,initialAuthenticated=false,mapCleanup=null,mapOverlay=null,welcomeOverlay=null,lastSnapshotAt=0;

async function json(path,options={}){
  const response=await apiFetch(path,{...options,signal:options.signal,timeoutMs:options.timeoutMs||8000});
  let body={};try{body=await response.json();}catch{}
  if(!response.ok||body.ok===false){const error=new Error(body.error||'Please try again.');error.status=response.status;error.code=body.code;throw error;}
  return body;
}
async function readSnapshot({fresh=false}={}){
  if(!fresh&&snapshot&&Date.now()-lastSnapshotAt<12000)return snapshot;
  const next=await json('/api/bootstrap?startup=1');
  if(next.authenticated){snapshot=next;lastSnapshotAt=Date.now();}
  return next;
}
async function readStats(){
  try{
    const result=await json('/api/presence/nearby');
    if(result.stats)updateStats(result.stats);
    return result.stats||stats;
  }catch{return stats;}
}
function updateStats(next){
  if(!next)return;stats={...stats,...next};
  document.querySelectorAll('[data-city-visits]').forEach(node=>node.textContent=compact(stats.visitsToday));
  document.querySelectorAll('[data-city-online]').forEach(node=>node.textContent=compact(stats.onlineNow));
  document.querySelectorAll('[data-city-here]').forEach(node=>node.textContent=compact(stats.hereNow));
  renderHotPlaces(document.querySelector('.abj-live-places'));
}
function venueName(venueId){return snapshot?.venues?.find(venue=>venue.id===venueId)?.name||String(venueId||'Abuja').replace(/[-_]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());}
function districtName(districtId){return snapshot?.atlas?.find(place=>place.id===districtId)?.name||String(districtId||'Abuja').replace(/[-_]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());}
function hotPlaces(){return (stats?.hotPlaces||[]).filter(place=>place.online>0).map(place=>({...place,name:venueName(place.venueId)}));}

function ensurePulse(){
  const shell=appRoot?.querySelector('.game-shell'),header=shell?.querySelector('.game-header');if(!shell||!header)return;
  let pulse=shell.querySelector('.abj-city-pulse');
  if(!pulse){pulse=document.createElement('div');pulse.className='abj-city-pulse';pulse.innerHTML=`<span title="Visits to AbujaLife today">👀 <strong data-city-visits>${compact(stats?.visitsToday)}</strong> today</span><span class="is-online" title="Residents online now"><i></i><strong data-city-online>${compact(stats?.onlineNow)}</strong> online</span><span class="is-here" title="Residents in your current place"><b>◎</b><strong data-city-here>${compact(stats?.hereNow)}</strong> here</span>`;shell.append(pulse);}
  const bottom=`${Math.round(header.getBoundingClientRect().bottom+8)}px`;
  if(pulse.style.getPropertyValue('--abj-pulse-top')!==bottom)pulse.style.setProperty('--abj-pulse-top',bottom);
  const here=pulse.querySelector('.is-here'),empty=Number(stats?.hereNow||0)<=1;
  if(here&&here.classList.contains('is-empty')!==empty)here.classList.toggle('is-empty',empty);
}

function relabelMap(){
  const button=appRoot?.querySelector('.game-nav [data-nav-outside]');if(!button)return;
  const label=button.querySelector('span');if(label&&label.textContent!=='Map')label.textContent='Map';
  if(button.getAttribute('aria-label')!=='Open Abuja map')button.setAttribute('aria-label','Open Abuja map');
  if(button.title!=='Map')button.title='Map';
}

function renderHotPlaces(host){
  if(!host)return;
  const places=hotPlaces().slice(0,5);
  host.innerHTML=places.length?places.map(place=>`<button type="button" data-hot-venue="${esc(place.venueId)}"><span class="abj-live-dot"></span><strong>${esc(place.name)}</strong><small>${place.online} ${place.online===1?'person':'people'} now</small></button>`).join(''):`<div class="abj-live-empty"><strong>Abuja is waking up.</strong><small>Visit a park, gym, café, mosque, church or club and people in the same place will appear with you.</small></div>`;
  host.querySelectorAll('[data-hot-venue]').forEach(button=>button.onclick=()=>{sheetRoot.innerHTML='';openMap({focusVenueId:button.dataset.hotVenue});});
}

async function enhanceLifeHub(){
  const grid=sheetRoot?.querySelector('.life-menu-grid');if(!grid||grid.closest('.sheet')?.querySelector('.abj-life-game-hub'))return;
  try{await readSnapshot();await readStats();}catch{}
  const p=snapshot?.profile||{},place=districtName(p.district),venue=snapshot?.venues?.find(item=>item.id===(p.location?.venueId||p.location?.venue));
  const hub=document.createElement('section');hub.className='abj-life-game-hub';hub.innerHTML=`
    <div class="abj-life-hero">
      <div><span class="eyebrow">YOUR ABUJA LIFE</span><h3>${esc(venue?.name||place)}</h3><p>${venue?'You are out in the city.':'Home, work, people and the next thing you feel like doing.'}</p></div>
      <div class="abj-life-avatar">${avatarSVG(p.appearance||{}, {size:68})}</div>
    </div>
    <div class="abj-life-vitals"><span><small>Game Naira</small><strong>${money(p.wallet)}</strong></span><span><small>Online</small><strong>${compact(stats?.onlineNow)}</strong></span><span><small>Here now</small><strong>${compact(stats?.hereNow)}</strong></span></div>
    <div class="abj-life-live-head"><div><span class="abj-live-dot"></span><strong>Live Abuja</strong></div><button type="button" data-life-open-map>Open Map</button></div>
    <div class="abj-live-places"></div>`;
  grid.before(hub);renderHotPlaces(hub.querySelector('.abj-live-places'));hub.querySelector('[data-life-open-map]').onclick=()=>{sheetRoot.innerHTML='';openMap();};
  const nav=document.createElement('nav');nav.className='abj-life-shortcuts';nav.setAttribute('aria-label','My Life shortcuts');
  nav.innerHTML=`<button type="button" data-life-shortcut="home"><span>⌂</span><strong>Home</strong></button><button type="button" data-life-shortcut="garage"><span>▰</span><strong>Garage</strong></button><button type="button" data-life-shortcut="houses"><span>⌂+</span><strong>Property</strong></button><button type="button" data-life-shortcut="work"><span>▣</span><strong>Work</strong></button><button type="button" data-life-shortcut="chat"><span>◉</span><strong>People</strong></button><button type="button" data-life-shortcut="map"><span>◇</span><strong>Map</strong></button>`;
  grid.after(nav);
  nav.querySelectorAll('[data-life-shortcut]').forEach(button=>button.onclick=()=>{
    const id=button.dataset.lifeShortcut;if(id==='map'){sheetRoot.innerHTML='';openMap();return;}
    const target=sheetRoot.querySelector(`[data-life="${id}"]`);if(target){target.click();return;}
    if(id==='garage'){openNativeGarage();return;}toast('That part of your life is opening soon.');
  });
}

function findVehicleItems(){
  const p=snapshot?.profile||{},inventory=new Set(p.inventory||[]);
  return (snapshot?.catalog||[]).filter(item=>item.category==='vehicle'&&inventory.has(item.id));
}
function openNativeGarage(){
  const life=appRoot?.querySelector('.game-nav [data-nav-life]');life?.click();
  let attempts=0;const open=()=>{const button=sheetRoot?.querySelector('[data-life="garage"]');if(button){button.click();return;}if(attempts++<15)setTimeout(open,40);};open();
}
function removeObsoleteGarageBays(){document.querySelectorAll('.abj-home-garage-bay,.abj-garage-overlay').forEach(bay=>bay.remove());}

async function gameAction(action,payload={}){
  const body={action,payload:{...payload,idempotencyKey:payload.idempotencyKey||crypto.randomUUID()}};
  return json('/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),timeoutMs:12000});
}
async function ensurePublicLocation(){
  const p=snapshot?.profile;if(!p)return;
  if(p.location?.kind==='home'){const result=await gameAction('leave-home');if(result.profile)snapshot.profile=result.profile;}
  else if(p.location?.kind==='venue'){const result=await gameAction('exit-venue');if(result.profile)snapshot.profile=result.profile;}
  else if(p.location?.kind==='visit'){const result=await json('/api/home/visits/leave',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});if(result.profile)snapshot.profile=result.profile;else snapshot=await readSnapshot({fresh:true});}
}

function focusMapVenue(venueId){
  if(!venueId||!mapOverlay)return;
  const name=venueName(venueId).toLowerCase();let attempts=0;
  const find=()=>{const buttons=[...mapOverlay.querySelectorAll('.abuja-map-place')],target=buttons.find(button=>button.querySelector('strong')?.textContent?.trim().toLowerCase()===name);if(target){target.click();target.scrollIntoView({block:'nearest'});return;}const input=mapOverlay.querySelector('.abuja-map-search input');if(input){input.value=venueName(venueId);input.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>{const found=[...mapOverlay.querySelectorAll('.abuja-map-place')].find(button=>button.querySelector('strong')?.textContent?.trim().toLowerCase()===name);found?.click();},80);return;}if(attempts++<10)setTimeout(find,60);};find();
}
async function openMap({focusVenueId=null}={}){
  try{await readSnapshot({fresh:true});await readStats();}catch(error){toast(error.message);return;}
  if(!snapshot?.authenticated)return;
  mapCleanup?.();mapCleanup=null;mapOverlay?.remove();
  const overlay=document.createElement('div');overlay.className='abj-map-overlay';overlay.innerHTML=`<section class="abj-map-shell" role="dialog" aria-modal="true" aria-label="Abuja map"><header class="abj-map-top"><div><span class="eyebrow">ABUJA LIFE · MAP</span><h2>Your city, alive.</h2><p>Find districts, places and where residents are gathering right now.</p></div><button type="button" data-map-close aria-label="Close map">×</button></header><div class="abj-map-live"><strong>Live now</strong><div class="abj-map-live-list"></div></div><div id="abj-real-map" class="abj-real-map"></div></section>`;
  document.body.append(overlay);mapOverlay=overlay;
  overlay.querySelector('[data-map-close]').onclick=closeMap;overlay.addEventListener('click',event=>{if(event.target===overlay)closeMap();});
  const live=overlay.querySelector('.abj-map-live-list'),places=hotPlaces().slice(0,5);live.innerHTML=places.length?places.map(place=>`<button type="button" data-map-hot="${esc(place.venueId)}"><span class="abj-live-dot"></span>${esc(place.name)} <b>${place.online}</b></button>`).join(''):'<span>Public places become live gathering spaces as residents arrive.</span>';live.querySelectorAll('[data-map-hot]').forEach(button=>button.onclick=()=>focusMapVenue(button.dataset.mapHot));
  mapCleanup=renderMap(overlay.querySelector('#abj-real-map'),{atlas:snapshot.atlas||[],venues:snapshot.venues||[],profile:snapshot.profile||{},onTravel:(district,venueId)=>openJourney(district,venueId),onSelect:()=>{}});
  if(focusVenueId)setTimeout(()=>focusMapVenue(focusVenueId),100);
}
function closeMap(){mapCleanup?.();mapCleanup=null;mapOverlay?.remove();mapOverlay=null;}

async function openJourney(district,venueId=null){
  const destination=districtName(district),venue=snapshot?.venues?.find(item=>item.id===venueId),sameDistrict=snapshot?.profile?.district===district;
  const ownsCar=findVehicleItems().length>0,modes=(snapshot?.transportModes||[]).filter(mode=>mode.id!=='car'||ownsCar);
  const panel=document.createElement('div');panel.className='abj-journey-panel';panel.innerHTML=`<div class="abj-journey-card"><button type="button" data-journey-close aria-label="Close journey">×</button><span class="eyebrow">GETTING AROUND</span><h3>${esc(venue?.name||destination)}</h3><p>${esc(destination)} · choose how you want to go.</p><div class="abj-journey-modes">${modes.map(mode=>`<button type="button" data-journey-mode="${esc(mode.id)}" ${mode.id==='walk'&&!sameDistrict?'disabled':''}><strong>${esc(mode.name)}</strong><small>${esc(mode.description||'Get around Abuja')}</small></button>`).join('')}</div><div class="abj-journey-quote" data-journey-quote>Choose a ride.</div><button type="button" class="abj-journey-go" data-journey-go disabled>Start journey</button></div>`;mapOverlay.append(panel);panel.querySelector('[data-journey-close]').onclick=()=>panel.remove();let selected=null,quote=null;
  const choose=async mode=>{
    selected=mode;quote=null;panel.querySelectorAll('[data-journey-mode]').forEach(button=>button.classList.toggle('active',button.dataset.journeyMode===mode));const quoteEl=panel.querySelector('[data-journey-quote]'),go=panel.querySelector('[data-journey-go]');go.disabled=true;quoteEl.textContent='Checking your route…';
    if(mode==='walk'&&sameDistrict&&venueId){quote={cost:0,seconds:0,mode};quoteEl.innerHTML='<span>Walk to the entrance</span><strong>Free</strong>';go.textContent='Walk there';go.disabled=false;return;}
    try{const result=await json(`/api/travel/quote?district=${encodeURIComponent(district)}&mode=${encodeURIComponent(mode)}${venueId?`&venueId=${encodeURIComponent(venueId)}`:''}`);quote=result.quote;quoteEl.innerHTML=`<span>${quote.seconds?`${quote.seconds}s journey`:'Ready now'}</span><strong>${quote.cost?money(quote.cost):'Free'}</strong>`;go.textContent=quote.cost?`Pay ${money(quote.cost)} & go`:'Start journey';go.disabled=Number(quote.cost||0)>Number(snapshot.profile.wallet||0);}catch(error){quoteEl.textContent=error.message;}
  };
  panel.querySelectorAll('[data-journey-mode]:not(:disabled)').forEach(button=>button.onclick=()=>choose(button.dataset.journeyMode));
  panel.querySelector('[data-journey-go]').onclick=async event=>{
    if(!selected||!quote)return;event.currentTarget.disabled=true;event.currentTarget.textContent='Heading out…';
    try{await ensurePublicLocation();let result;if(selected==='walk'&&sameDistrict&&venueId)result=await gameAction('enter-venue',{venueId});else result=await gameAction('travel',{district,mode:selected,...(venueId?{venueId}:{})});if(result?.profile){snapshot.profile=result.profile;lastSnapshotAt=Date.now();window.dispatchEvent(new CustomEvent('abujalife:profile',{detail:{profile:result.profile}}));}panel.remove();closeMap();toast(venue?`On your way to ${venue.name}.`:`Journey to ${destination} started.`);}catch(error){toast(error.message);event.currentTarget.disabled=false;event.currentTarget.textContent='Try again';}
  };
}

async function showWelcome(initial){
  if(sessionStorage.getItem(WELCOME_KEY)==='1'||welcomeOverlay||!initial?.authenticated||!initial.profile?.onboardingComplete)return;
  if(PAYMENT_RETURN_AT_ENTRY||location.hash.includes('verify')||location.hash.includes('reset'))return;
  snapshot=initial;lastSnapshotAt=Date.now();await readStats();
  let tries=0;while(!appRoot?.querySelector('.game-shell')&&tries++<40)await new Promise(resolve=>setTimeout(resolve,50));
  if(!appRoot?.querySelector('.game-shell'))return;
  const p=initial.profile,overlay=document.createElement('div');overlay.className='abj-welcome-back';overlay.innerHTML=`<section class="abj-welcome-card" role="dialog" aria-modal="true" aria-label="Welcome back to AbujaLife"><div class="abj-welcome-brand">${brandMark()}</div><span class="eyebrow">THE CAPITAL IS YOURS</span><h1>Welcome back.</h1><p>Pick up your Abuja life exactly where you left it.</p><div class="abj-welcome-resident"><div>${avatarSVG(p.appearance||{}, {size:78})}</div><span><strong>${esc(p.displayName||p.username)}</strong><small>@${esc(p.username)} · ${esc(districtName(p.district))}</small></span><b>${money(p.wallet)}</b></div><div class="abj-welcome-city"><span>👀 <strong>${compact(stats?.visitsToday)}</strong> visits today</span><span><i></i><strong>${compact(stats?.onlineNow)}</strong> online now</span></div><button type="button" class="abj-welcome-continue" data-welcome-continue>Continue</button><button type="button" class="abj-welcome-new" data-welcome-new>New life</button><small class="abj-welcome-safe">Your current resident stays saved.</small></section>`;
  document.body.append(overlay);welcomeOverlay=overlay;
  const continueGame=()=>{sessionStorage.setItem(WELCOME_KEY,'1');overlay.classList.add('leaving');setTimeout(()=>{overlay.remove();welcomeOverlay=null;},220);};overlay.querySelector('[data-welcome-continue]').onclick=continueGame;
  overlay.querySelector('[data-welcome-new]').onclick=async()=>{if(!confirm('Start another life? Your current resident stays saved and you will be signed out so you can create another account.'))return;try{await json('/api/auth/logout/fast',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});sessionStorage.setItem(WELCOME_KEY,'1');location.reload();}catch(error){toast(error.message);}};
}

function refreshEnhancements(){
  relabelMap();ensurePulse();void enhanceLifeHub();removeObsoleteGarageBays();
}

// Map is a separate city/navigation surface again. Outside remains part of Play
// and is reached by physically leaving the resident's home or a venue.
document.addEventListener('click',event=>{
  const mapButton=event.target.closest?.('.game-nav [data-nav-outside]');if(!mapButton)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void openMap();
},true);

addEventListener('abujalife:living-city',event=>{if(event.detail?.stats)updateStats(event.detail.stats);if(event.detail?.type==='snapshot')refreshEnhancements();});
addEventListener('resize',()=>ensurePulse(),{passive:true});
const observer=new MutationObserver(()=>refreshEnhancements());if(appRoot)observer.observe(appRoot,{childList:true,subtree:true});if(sheetRoot)observer.observe(sheetRoot,{childList:true,subtree:true});

(async()=>{
  try{const initial=await readSnapshot({fresh:true});initialAuthenticated=initial.authenticated===true;if(initialAuthenticated){await readStats();refreshEnhancements();void showWelcome(initial);}}
  catch{/* Core AbujaLife boot remains authoritative if this optional game layer cannot hydrate. */}
})();

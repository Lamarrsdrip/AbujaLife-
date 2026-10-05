import { apiFetch } from './api-client.js';
import { renderOutside } from './outside-city.js';
import { TRANSPORT_MODES } from '../src/shared/life.mjs';

const appRoot=document.querySelector('#app');
const toastRoot=document.querySelector('#toast');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>`₦${new Intl.NumberFormat('en-NG',{maximumFractionDigits:0}).format(Number(value||0))}`;
let overlay=null,cleanup=null,snapshot=null,busy=false;

function toast(message){if(!toastRoot)return;toastRoot.textContent=message;toastRoot.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>toastRoot.classList.remove('visible'),3400);}
async function json(path,options={}){
 const response=await apiFetch(path,{...options,signal:options.signal||AbortSignal.timeout(10000)});let body={};try{body=await response.json();}catch{}
 if(!response.ok||body.ok===false){const error=new Error(body.error||'Please try again.');error.status=response.status;error.code=body.code;throw error;}return body;
}
async function readSnapshot(){const next=await json('/api/bootstrap?startup=1');if(next.authenticated)snapshot=next;return next;}
function placeName(id){return snapshot?.atlas?.find(place=>place.id===id)?.name||String(id||'Abuja').replace(/[-_]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());}
function venueFor(id){return snapshot?.venues?.find(venue=>venue.id===id);}
async function action(name,payload={}){return json('/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:name,payload:{...payload,idempotencyKey:payload.idempotencyKey||crypto.randomUUID()}}),signal:AbortSignal.timeout(12000)});}
async function leaveInterior(){
 const profile=snapshot?.profile;if(!profile)return;
 if(profile.location?.kind==='home'){const result=await action('leave-home');if(result.profile)snapshot.profile=result.profile;return;}
 if(profile.location?.kind==='venue'){const result=await action('exit-venue');if(result.profile)snapshot.profile=result.profile;return;}
 if(profile.location?.kind==='visit'){await json('/api/home/visits/leave',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});snapshot=await readSnapshot();}
}
function closeMap(){cleanup?.();cleanup=null;overlay?.remove();overlay=null;busy=false;}

async function openJourney(district,venueId){
 if(!overlay||busy)return;
 const destination=placeName(district),venue=venueFor(venueId),sameDistrict=snapshot?.profile?.district===district;
 const inventory=new Set(snapshot?.profile?.inventory||[]),catalog=snapshot?.catalog||[],ownsCar=catalog.some(item=>item.category==='vehicle'&&inventory.has(item.id));
 const modes=(snapshot?.transportModes?.length?snapshot.transportModes:TRANSPORT_MODES).filter(mode=>mode.id!=='car'||ownsCar);
 const panel=document.createElement('div');panel.className='abj-map-journey';panel.innerHTML=`<section><button type="button" data-map-journey-close aria-label="Close">×</button><span class="eyebrow">GETTING AROUND</span><h3>${esc(venue?.name||destination)}</h3><p>${esc(destination)} · choose how you want to go.</p><div class="abj-map-modes">${modes.map(mode=>`<button type="button" data-map-mode="${esc(mode.id)}" ${mode.id==='walk'&&!sameDistrict?'disabled':''}><strong>${esc(mode.name)}</strong><small>${esc(mode.description||'Move around Abuja')}</small></button>`).join('')}</div><div class="abj-map-quote" data-map-quote>Choose a ride.</div><button type="button" class="abj-map-go" data-map-go disabled>Start journey</button></section>`;overlay.append(panel);
 panel.querySelector('[data-map-journey-close]').onclick=()=>panel.remove();let selected=null,quote=null;
 async function selectMode(mode){
  selected=mode;quote=null;panel.querySelectorAll('[data-map-mode]').forEach(button=>button.classList.toggle('active',button.dataset.mapMode===mode));const quoteNode=panel.querySelector('[data-map-quote]'),go=panel.querySelector('[data-map-go]');go.disabled=true;quoteNode.textContent='Checking your route…';
  if(mode==='walk'&&sameDistrict&&venueId){quote={mode,cost:0,seconds:0};quoteNode.innerHTML='<span>Walk to the entrance</span><strong>Free</strong>';go.textContent='Walk there';go.disabled=false;return;}
  try{const result=await json(`/api/travel/quote?district=${encodeURIComponent(district)}&mode=${encodeURIComponent(mode)}${venueId?`&venueId=${encodeURIComponent(venueId)}`:''}`);quote=result.quote;quoteNode.innerHTML=`<span>${quote.seconds?`${quote.seconds}s journey`:'Ready now'}</span><strong>${quote.cost?money(quote.cost):'Free'}</strong>`;go.textContent=quote.cost?`Pay ${money(quote.cost)} & go`:'Start journey';go.disabled=Number(quote.cost||0)>Number(snapshot?.profile?.wallet||0);}catch(error){quoteNode.textContent=error.message;}
 }
 panel.querySelectorAll('[data-map-mode]:not(:disabled)').forEach(button=>button.onclick=()=>selectMode(button.dataset.mapMode));
 panel.querySelector('[data-map-go]').onclick=async event=>{
  if(!selected||!quote||busy)return;busy=true;event.currentTarget.disabled=true;event.currentTarget.textContent='Heading out…';
  try{await leaveInterior();let result;if(selected==='walk'&&sameDistrict&&venueId)result=await action('enter-venue',{venueId});else result=await action('travel',{district,mode:selected,...(venueId?{venueId}:{})});if(result?.profile)snapshot.profile=result.profile;closeMap();toast(venue?`On your way to ${venue.name}.`:`Journey to ${destination} started.`);setTimeout(()=>location.hash='#world',0);}catch(error){toast(error.message);busy=false;event.currentTarget.disabled=false;event.currentTarget.textContent='Try again';}
 };
}

async function openCityMap({focusVenueId=null}={}){
 if(busy)return;busy=true;
 try{const next=await readSnapshot();if(!next.authenticated){busy=false;return;}}
 catch(error){busy=false;toast(error.message);return;}
 cleanup?.();overlay?.remove();
 const shell=document.createElement('div');shell.className='abj-restored-map';shell.innerHTML=`<div class="abj-restored-map-stage" id="abj-restored-map-stage"></div><button type="button" class="abj-restored-map-close" data-restored-map-close aria-label="Close Map">×</button>`;document.body.append(shell);overlay=shell;shell.querySelector('[data-restored-map-close]').onclick=closeMap;
 cleanup=renderOutside(shell.querySelector('#abj-restored-map-stage'),{atlas:snapshot.atlas||[],venues:snapshot.venues||[],profile:snapshot.profile||{},serverNow:snapshot.serverTime,onSelect:destination=>{if(destination.adPlotId){globalThis.dispatchEvent(new CustomEvent('abj:open-ad-studio',{detail:{kind:'plot',plotId:destination.adPlotId}}));return;}if(destination.districtId)void openJourney(destination.districtId,destination.venueId||null);},onHome:()=>{closeMap();location.hash='#world';}});
 if(focusVenueId){const venue=venueFor(focusVenueId),district=venue?.district||venue?.districts?.[0];if(district)setTimeout(()=>cleanup?.focusDistrict?.(district),70);}
 busy=false;
}

// Register before the enhancement layer so every visible Map affordance opens
// the authored 3D city overview, never the old utility street-map surface.
document.addEventListener('click',event=>{
 const target=event.target.closest?.('.game-nav [data-nav-outside],[data-life-open-map],[data-life-shortcut="map"],[data-hot-venue]');if(!target)return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void openCityMap({focusVenueId:target.dataset.hotVenue||null});
},true);

const observer=new MutationObserver(()=>{const button=appRoot?.querySelector('.game-nav [data-nav-outside]');if(button){button.querySelector('span')&&(button.querySelector('span').textContent='Map');button.setAttribute('aria-label','Open AbujaLife Map');}});if(appRoot)observer.observe(appRoot,{childList:true,subtree:true});

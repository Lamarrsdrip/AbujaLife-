import {showGameToast as toast} from './game-toast.js';
import {AD_ZONES,PLOT_IDS,adSpaceFromId,adSpacePage,MAP_AD_INVENTORY,COMPATIBILITY_MAP_AD_INVENTORY} from '../src/shared/advertising.mjs';
import {optimizeAdImage} from './ad-creative.js';
import { apiFetch } from './api-client.js';
import {mergeAdSnapshot} from './ad-state.js';

const sheetRoot=document.querySelector('#sheet-root'),appRoot=document.querySelector('#app');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let adsState=null,paymentEnabled=false,adsLoadPromise=null,worldRefreshTimer;
const renderedAds=new WeakMap();
const AD_CHECKOUT_SCHEMA=2;
const mergeSpaces=(prior=[],next=[])=>[...new Map([...prior,...next].map(space=>[space.id,space])).values()].slice(-480);
const formatNaira=value=>`₦${new Intl.NumberFormat('en-NG',{maximumFractionDigits:0}).format(Number(value||0))}`;

function loadAds(){if(adsLoadPromise)return adsLoadPromise;adsLoadPromise=(async()=>{try{const response=await apiFetch('/api/payments/config',{timeoutMs:8000});if(!response.ok)return adsState;const body=await response.json();paymentEnabled=body.enabled===true;if(body.ads)adsState=mergeAdSnapshot(adsState,{...body.ads,serverTime:body.ads.serverTime||body.serverTime});try{const world=await apiFetch('/api/ads/world?zoom=1&limit=96',{timeoutMs:8000});if(world.ok){const streamed=await world.json();adsState={...mergeAdSnapshot(adsState,streamed),spaces:mergeSpaces(adsState?.spaces,streamed.spaces)};}}catch{/* The payment surface remains usable if the optional world stream is offline. */}globalThis.__ABJ_ADS__=adsState;dispatchEvent(new CustomEvent('abj:ads-updated',{detail:adsState}));return adsState;}catch{return adsState;}})().finally(()=>{adsLoadPromise=null;});return adsLoadPromise;}
async function loadAdWorld(zoneId,bounds=null){try{const query=bounds?'?'+new URLSearchParams({...bounds,zoom:2}):zoneId?`?zone=${encodeURIComponent(zoneId)}&zoom=2&limit=180`:'?zoom=1&limit=96';const response=await apiFetch(`/api/ads/world${query}`,{timeoutMs:8000});if(!response.ok)return;const world=await response.json();adsState={...mergeAdSnapshot(adsState,world),spaces:mergeSpaces(adsState?.spaces,world.spaces)};globalThis.__ABJ_ADS__=adsState;dispatchEvent(new CustomEvent('abj:ads-updated',{detail:adsState}));}catch{/* Directory exploration should never block the game. */}}
function cleanExternal(url){try{const parsed=new URL(url);return parsed.protocol==='https:'?parsed.href:null;}catch{return null;}}
function currentAds(){return adsState?.active||[];}

function ensureLifeEntry(){const grid=sheetRoot?.querySelector('.life-menu-grid');if(!grid||grid.querySelector('[data-abj-ads]'))return;const button=document.createElement('button');button.className='abj-ad-entry';button.dataset.abjAds='';button.innerHTML='<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 18V7h16v11zM8 7V4h8v3M8 12h8M8 15h5"/></svg></span><strong>Advertise in Abuja</strong><small>Open city ad plots</small>';button.onclick=()=>openStudio('plot');grid.append(button);}

function addRoofLabels(){const svg=appRoot?.querySelector('.world-canvas[data-scene-kind]:not([data-scene-kind="home"]):not([data-scene-kind="interior"]):not([data-scene-kind="transit"]) .world-scene');if(!svg||svg.closest('.world-canvas')?.dataset.environmentRenderer==='webgl-3d')return;svg.querySelectorAll('.city-building[data-world-target]').forEach(building=>{if(building.querySelector('.world-roof-label'))return;let box;try{box=building.getBBox();}catch{return;}if(!box||box.width<70)return;const raw=building.getAttribute('data-world-target')||'';const label=raw.replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase()).slice(0,28);const width=Math.min(Math.max(90,label.length*7.2),box.width*.9);const x=box.x+box.width/2,y=box.y+18;const ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g');group.classList.add('world-roof-label');const rect=document.createElementNS(ns,'rect');rect.setAttribute('x',String(x-width/2));rect.setAttribute('y',String(y-11));rect.setAttribute('width',String(width));rect.setAttribute('height','22');const text=document.createElementNS(ns,'text');text.setAttribute('x',String(x));text.setAttribute('y',String(y));text.textContent=label;group.append(rect,text);building.append(group);});}

function renderWorldAds(){const canvas=appRoot?.querySelector('.world-canvas');const svg=canvas?.querySelector('.world-scene.world-public');if(!svg||canvas.dataset.sceneKind==='transit')return;const previous=svg.querySelector('.world-ad-layer');if(previous&&renderedAds.get(svg)===adsState)return;previous?.remove();const ns='http://www.w3.org/2000/svg',layer=document.createElementNS(ns,'g');layer.classList.add('world-ad-layer');
  const land=document.createElementNS(ns,'g');land.classList.add('world-ad-land');land.setAttribute('transform','translate(626 395)');land.setAttribute('role','button');land.setAttribute('tabindex','0');land.setAttribute('aria-label','AbujaLife business advertising plots. Tap to advertise.');land.innerHTML='';
  const known=new Map((adsState?.spaces||[]).map(space=>[space.id,space]));for(const [index,id] of PLOT_IDS.entries()){const space=known.get(id),x=18+index%8*44.5,y=18+Math.floor(index/8)*31.5;const rect=document.createElementNS(ns,'rect');rect.classList.add('ad-plot');if(space?.available===false)rect.classList.add('is-taken');rect.dataset.adSpaceId=id;rect.setAttribute('x',String(x));rect.setAttribute('y',String(y));rect.setAttribute('width','41');rect.setAttribute('height','28');rect.setAttribute('rx','4');land.append(rect);if(space?.ad?.imageDataUrl){const image=document.createElementNS(ns,'image');image.setAttribute('x',String(x));image.setAttribute('y',String(y));image.setAttribute('width','41');image.setAttribute('height','28');image.setAttribute('preserveAspectRatio','xMidYMid meet');image.setAttribute('href',space.ad.imageDataUrl);image.dataset.adSpaceId=id;image.dataset.adLink=space.ad.link||'';land.append(image);}}
  land.addEventListener('click',event=>{const link=event.target?.dataset?.adLink&&cleanExternal(event.target.dataset.adLink);if(link){window.open(link,'_blank','noopener,noreferrer');return;}openStudio('plot',event.target?.dataset?.adSpaceId||null,'map-parcels');});land.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openStudio('plot');}});layer.append(land);
  const art=svg.querySelector('.world-art');if(art){art.after(layer);renderedAds.set(svg,adsState);}}

function spaceLabel(id){const space=adSpaceFromId(id);return space?.name||(space?.zoneId?`${space.zone} · ${space.row+1}/${space.column+1}`:id.replaceAll('-',' '));}
function gridMarkup(kind,spaces){
 const eligible=spaces.filter(space=>space.eligible!==false);
 return `<div class="${kind==='plot'?'abj-ad-grid':'abj-ad-billboards'}">${eligible.map(space=>{
  const status=space.ad?'Live':space.available?'Available':'Reserved';
  return `<button type="button" class="abj-ad-cell ${space.available?'':'taken'}" data-ad-space="${esc(space.id)}" ${space.available?'':'disabled'} aria-pressed="false" aria-label="${space.available?'Select':status} ${esc(spaceLabel(space.id))}"><strong>${esc(spaceLabel(space.id))}</strong><small>${status}</small></button>`;
 }).join('')||'<p class="abj-ad-empty">No bookable plots on this page. Choose another area or view more spaces.</p>'}</div>`;
}
function studioMarkup(kind){const pricing=adsState.pricing;return `<div class="sheet-backdrop"><section class="sheet game-sheet-wide abj-ad-studio" role="dialog" aria-modal="true" aria-labelledby="ad-title"><button class="sheet-close icon-button" data-ad-close aria-label="Close advertising">×</button><span class="eyebrow">REAL BUSINESS · ABUJA</span><h2 id="ad-title">Put your business in the city.</h2><p class="muted">Choose a placement, preview your ad and pay securely. Real Naira buys a seven-day display. Your game Naira balance stays separate.</p><div class="abj-ad-tabs"><button type="button" data-ad-kind="plot" class="${kind==='plot'?'active':''}">City display</button><button type="button" data-ad-kind="billboard" class="${kind==='billboard'?'active':''}">Roadside billboard</button><button type="button" data-ad-campaigns>Your campaigns</button></div><div class="abj-ad-lead"><div><label>Choose an area<select data-ad-zone><option value="map-parcels">City map plots</option><option value="legacy">Original business park</option>${AD_ZONES.map(zone=>`<option value="${zone.id}">${esc(zone.name)}</option>`).join('')}</select></label><div class="abj-ad-map" data-ad-grid></div><div class="abj-ad-pages"><button type="button" data-ad-page="previous">Previous spaces</button><span data-ad-page-label></span><button type="button" data-ad-page="next">More spaces</button></div><div data-ad-selected class="abj-ad-selected" aria-label="Selected advertising spaces"></div></div><aside class="abj-ad-summary"><small>7-DAY PLACEMENT</small><strong>${formatNaira(pricing.amount)}</strong><p>${kind==='plot'?'One city display':'One roadside board'} for one campaign. Your selected space is reserved at checkout. The campaign starts only after payment is independently verified.</p><small>AbujaLife price ${formatNaira(pricing.amount)} · Flutterwave may show its payment fee separately at checkout</small></aside></div><form class="abj-ad-form" data-ad-form><div class="abj-ad-upload"><div class="abj-ad-preview" data-ad-preview>Preview</div><label>Ad image<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label></div><label>Business / campaign name<input name="title" minlength="2" maxlength="70" required placeholder="Your business name"></label><label>Receipt email<input name="email" type="email" maxlength="254" required placeholder="you@example.com"></label><label class="full">Website or X link<input name="link" type="url" pattern="https://.*" maxlength="500" required placeholder="https://yourbusiness.com"></label><p class="abj-ad-selection-note" data-ad-note role="status" aria-live="polite"></p><button class="primary abj-ad-submit" type="submit" disabled>Continue to Flutterwave · ${formatNaira(pricing.amount)}</button></form></section></div>`;}
async function openStudio(kind='plot',preselectId=null,zoneId=null){
 if(!adsState?.pricing)await loadAds();if(!adsState?.pricing){toast('Advertising is temporarily unavailable.');return;}
 kind=kind==='billboard'?'billboard':'plot';sheetRoot.innerHTML=studioMarkup(kind);
 const selected=new Set(),form=sheetRoot.querySelector('[data-ad-form]'),submit=form.querySelector('[type=submit]'),note=form.querySelector('[data-ad-note]'),grid=sheetRoot.querySelector('[data-ad-grid]'),zoneSelect=sheetRoot.querySelector('[data-ad-zone]'),selectedList=sheetRoot.querySelector('[data-ad-selected]');
 const mapIndex=[...MAP_AD_INVENTORY,...COMPATIBILITY_MAP_AD_INVENTORY].findIndex(p=>p.id===preselectId);
 let imageDataUrl='',imageVersion=0,submitting=false,intent=null,page=mapIndex>=0?Math.floor(mapIndex/96):preselectId?adSpacePage(preselectId):0,pageSpaces=[],nextPage=null,pageVersion=0;
 const preselected=adSpaceFromId(preselectId);zoneSelect.value=mapIndex>=0?'map-parcels':preselected&&!preselected.zoneId?'legacy':zoneId||preselected?.zoneId||'map-parcels';zoneSelect.closest('label').hidden=kind==='billboard';
 const required=kind==='plot'?adsState.pricing.plotPackSize:1;
 const update=()=>{
  const valid=form.checkValidity();submit.disabled=submitting||selected.size!==required||!imageDataUrl||!valid||!paymentEnabled;
  note.textContent=!paymentEnabled?'Checkout is currently unavailable.':`${selected.size} of ${required} space${required===1?'':'s'} selected${selected.size<required?` · select ${required-selected.size} more`:!imageDataUrl?' · add your image':!valid?' · complete the campaign details':` · ready for ${formatNaira(adsState.pricing.amount)}`}.`;
  grid.querySelectorAll('[data-ad-space]').forEach(button=>{const yes=selected.has(button.dataset.adSpace);button.classList.toggle('selected',yes);button.setAttribute('aria-pressed',String(yes));});
  selectedList.innerHTML=[...selected].map(id=>`<button type="button" data-ad-remove="${esc(id)}" aria-label="Remove ${esc(spaceLabel(id))}">${esc(spaceLabel(id))} ×</button>`).join('');
 };
 const loadPage=async()=>{
  const version=++pageVersion;let spaces,next;grid.textContent='Loading available spaces…';
  if(kind==='billboard'||zoneSelect.value==='legacy'){spaces=adsState.spaces.filter(space=>space.kind===kind&&!space.zoneId);next=null;}
  else{const response=await apiFetch(`/api/ads/world?zone=${encodeURIComponent(zoneSelect.value)}&page=${page}&limit=96&zoom=2`);const body=await response.json();if(!response.ok)throw new Error(body.error||'Could not load spaces.');spaces=body.spaces;next=body.nextPage;}
  if(!form.isConnected||version!==pageVersion)return;pageSpaces=spaces;nextPage=next;grid.innerHTML=gridMarkup(kind,pageSpaces);sheetRoot.querySelector('[data-ad-page-label]').textContent=`Page ${page+1}`;sheetRoot.querySelector('[data-ad-page="previous"]').disabled=page===0;sheetRoot.querySelector('[data-ad-page="next"]').disabled=nextPage===null;update();
 };
 sheetRoot.querySelector('[data-ad-close]').onclick=()=>{sheetRoot.innerHTML='';};sheetRoot.querySelector('.sheet-backdrop').onclick=event=>{if(event.target.classList.contains('sheet-backdrop'))sheetRoot.innerHTML='';};
 sheetRoot.querySelectorAll('[data-ad-kind]').forEach(button=>button.onclick=()=>openStudio(button.dataset.adKind));sheetRoot.querySelector('[data-ad-campaigns]').onclick=()=>openCampaigns();
 grid.onclick=event=>{const button=event.target.closest('[data-ad-space]');if(!button||button.disabled||submitting)return;const id=button.dataset.adSpace;if(selected.has(id))selected.delete(id);else if(required===1){selected.clear();selected.add(id);}else if(selected.size<required)selected.add(id);else{toast(`Remove a selected space to choose another. (${required} maximum)`);return;}update();};
 selectedList.onclick=event=>{const id=event.target.closest('[data-ad-remove]')?.dataset.adRemove;if(id&&!submitting){selected.delete(id);update();}};
 zoneSelect.onchange=()=>{page=0;void loadPage().catch(error=>toast(error.message));};sheetRoot.querySelectorAll('[data-ad-page]').forEach(button=>button.onclick=()=>{page=button.dataset.adPage==='previous'?Math.max(0,page-1):nextPage;void loadPage().catch(error=>toast(error.message));});
 form.elements.image.onchange=async()=>{const version=++imageVersion,file=form.elements.image.files?.[0];imageDataUrl='';update();if(!file)return;const preview=form.querySelector('[data-ad-preview]');preview.textContent='Preparing image…';try{const data=await optimizeAdImage(file);if(version!==imageVersion)return;imageDataUrl=data;preview.innerHTML=`<img src="${data}" alt="Your campaign preview">`;}catch(error){if(version!==imageVersion)return;preview.textContent='Choose another image';toast(error.message);}update();};
 form.addEventListener('input',update);await loadPage();if(preselectId&&pageSpaces.some(space=>space.id===preselectId&&space.available)){selected.add(preselectId);update();}
 form.onsubmit=async event=>{
  event.preventDefault();if(submit.disabled||submitting)return;submitting=true;update();
  const payload={purpose:'ad',checkoutSchema:AD_CHECKOUT_SCHEMA,kind,slots:[...selected].sort(),title:form.elements.title.value.trim(),email:form.elements.email.value.trim(),link:form.elements.link.value.trim(),imageDataUrl},fingerprint=JSON.stringify(payload);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint))),byte=>byte.toString(16).padStart(2,'0')).join('');
  try{intent=JSON.parse(sessionStorage.getItem('abujalife.ad-intent')||'null');}catch{}
  if(intent?.fingerprint!==digest)intent={fingerprint:digest,key:crypto.randomUUID()};
  try{sessionStorage.setItem('abujalife.ad-intent',JSON.stringify(intent));}catch{}submitting=true;update();submit.textContent='Preparing secure checkout…';
  try{const response=await apiFetch('/api/payments/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload,idempotencyKey:intent.key}),timeoutMs:25000}),result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'Could not create checkout'),{code:result.code});const url=trustedCheckout(result.checkout?.checkoutUrl);if(!url)throw new Error('Checkout link is unavailable.');sessionStorage.setItem('abujalife.pending-ad',result.checkout.txRef);location.assign(url);}
  catch(error){if(error.code==='checkout_failed')intent=null;submitting=false;update();note.textContent=error.message;note.classList.add('error');submit.textContent=`Continue to Flutterwave · ${formatNaira(adsState.pricing.amount)}`;}
 };
}
function trustedCheckout(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&(url.hostname==='checkout.flutterwave.com'||url.hostname.endsWith('.flutterwave.com'))?url.href:null;}catch{return null;}}
async function openCampaigns(){
 const response=await apiFetch('/api/ads/mine');const result=await response.json();if(!response.ok){toast(result.error||'Sign in to manage campaigns.');return;}
 sheetRoot.innerHTML=`<div class="sheet-backdrop"><section class="sheet abj-ad-studio" role="dialog" aria-modal="true" aria-label="Your campaigns"><button class="sheet-close icon-button" data-ad-close aria-label="Close campaigns">×</button><span class="eyebrow">YOUR BUSINESS IN ABUJA</span><h2>Your campaigns</h2>${result.ads.map(ad=>{const active=ad.status==='active'&&ad.endAt>(result.serverTime||Date.now()),expired=ad.status==='expired'||ad.status==='active'&&!active;return `<article class="abj-campaign"><strong>${esc(ad.title)}</strong><p>${active?'Live':expired?'Finished':ad.fulfillmentStatus==='failed'?'Paid · needs fulfillment':'Awaiting provider confirmation'} · ${formatNaira(ad.amount)} · ${ad.slots.length} space${ad.slots.length===1?'':'s'}</p><small>${esc(ad.txRef)}</small>${active?`<p>Runs until ${new Date(ad.endAt).toLocaleDateString('en-NG')}</p>`:expired?'':`<button type="button" data-ad-verify="${esc(ad.txRef)}">Verify with Flutterwave</button>${trustedCheckout(ad.checkoutUrl)?`<a href="${esc(ad.checkoutUrl)}">Resume checkout</a>`:''}`}</article>`;}).join('')||'<p>You have no campaigns yet.</p>'}<button class="primary full" data-ad-new>Create a campaign</button></section></div>`;
 sheetRoot.querySelector('[data-ad-close]').onclick=()=>sheetRoot.replaceChildren();sheetRoot.querySelector('[data-ad-new]').onclick=()=>openStudio();sheetRoot.querySelectorAll('[data-ad-verify]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await verifyAdvert(button.dataset.adVerify);await openCampaigns();}catch(error){button.disabled=false;toast(error.message);}});
}
async function verifyAdvert(txRef,transactionId){
 const response=await apiFetch('/api/payments/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({purpose:'ad',txRef,...(transactionId?{transactionId}:{})}),timeoutMs:25000}),body=await response.json();if(!response.ok)throw new Error(body.error||'Confirming your ad payment. Verification continues on the server.');const campaign=body.checkout||body.ad||body;toast(campaign.status==='expired'||campaign.endAt&&campaign.endAt<=(body.serverTime||Date.now())?'This campaign has finished.':'Your advert is live in AbujaLife.');await loadAds();renderWorldAds();return body;
}
async function verifyReturn(){
 const params=new URLSearchParams(location.search),txRef=params.get('ad_payment_ref')||params.get('tx_ref');if(!/^abjl_ad_[a-f0-9-]+$/.test(txRef||''))return;
 try{await verifyAdvert(txRef,params.get('transaction_id'));const url=new URL(location.href);['ad_payment_ref','transaction_id','tx_ref','status'].forEach(key=>url.searchParams.delete(key));history.replaceState(history.state,'',url.pathname+url.search+url.hash);sessionStorage.removeItem('abujalife.pending-ad');sessionStorage.removeItem('abujalife.ad-intent');}catch(error){toast(error.message);}
}

function decorateWorld(){addRoofLabels();renderWorldAds();}
let observedCanvas;
const canvasObserver=new MutationObserver(decorateWorld);
function observeWorldBoundary(){
  const canvas=appRoot?.querySelector('.world-canvas');
  if(canvas!==observedCanvas){
    canvasObserver.disconnect();observedCanvas=canvas;
    if(canvas)canvasObserver.observe(canvas,{childList:true,attributes:true,attributeFilter:['data-environment-renderer','data-scene-kind']});
  }
  decorateWorld();
}
// Core rendering replaces these direct children. Decorations live further inside
// the SVG and sheet, so their own changes never schedule another decoration pass.
const appObserver=new MutationObserver(observeWorldBoundary);
const sheetObserver=new MutationObserver(ensureLifeEntry);
if(appRoot)appObserver.observe(appRoot,{childList:true});
if(sheetRoot)sheetObserver.observe(sheetRoot,{childList:true});
await loadAds();ensureLifeEntry();observeWorldBoundary();verifyReturn();setInterval(async()=>{if(document.hidden)return;await loadAds();if(adViewportBounds)await loadAdWorld(null,adViewportBounds);renderWorldAds();},60000);addEventListener('focus',()=>{clearTimeout(worldRefreshTimer);worldRefreshTimer=setTimeout(async()=>{await loadAds();renderWorldAds();},150);});
addEventListener('abj:open-ad-studio',event=>{void openStudio(event.detail?.kind||'plot',event.detail?.plotId||null,event.detail?.zoneId||null).catch(()=>toast('Advertising is temporarily unavailable. Please try again.'));});

addEventListener('abujalife:living-city',event=>{if(event.detail?.type==='receipt'&&event.detail.data?.payment?.purpose==='ad'){void loadAds().then(renderWorldAds);if(sheetRoot.querySelector('[data-ad-new]'))void openCampaigns();}});

let viewportTimer,adViewportBounds;addEventListener('abj:ad-viewport',event=>{adViewportBounds=event.detail;clearTimeout(viewportTimer);viewportTimer=setTimeout(()=>{void loadAdWorld(null,adViewportBounds);},350);});

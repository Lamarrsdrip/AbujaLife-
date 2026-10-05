import { apiFetch } from './api-client.js';

const appRoot = document.querySelector('#app');
const sheetRoot = document.querySelector('#sheet-root');
const needs = [
  { key:'energy', label:'Energy', glyph:'⚡' },
  { key:'hunger', label:'Food', glyph:'◒' },
  { key:'hygiene', label:'Clean', glyph:'◇' },
  { key:'social', label:'Social', glyph:'◎' },
  { key:'fun', label:'Fun', glyph:'✦' },
  { key:'stress', label:'Stress', glyph:'⌁', inverse:true },
];

let loading = false;
let lastProfile;
let refreshTimer;
const seedKey='abujalife.character-seed.v2';
const choices={
  skinTone:['deep','brown','warm','light'],hair:['crop','locs','afro','braids','bald'],body:['regular','slim','broad'],face:['oval','round','angular'],
  top:['ochre','forest'],bottom:['charcoal','denim','cream'],shoes:['white','black'],accessory:['none','glasses'],facialHair:['none','beard']
};

const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
const pick = values => values[Math.floor(Math.random()*values.length)];
function severity(definition, value) {
  if (definition.inverse) return value >= 75 ? 'critical' : value >= 55 ? 'watch' : 'good';
  return value <= 25 ? 'critical' : value <= 45 ? 'watch' : 'good';
}

function ensureRail() {
  const stage = appRoot?.querySelector('.game-shell.is-playing .world-stage');
  if (!stage) return null;
  let rail = stage.querySelector('.game-status-rail');
  if (!rail) {
    rail = document.createElement('section');
    rail.className = 'game-status-rail';
    rail.setAttribute('aria-label', 'Resident needs');
    stage.append(rail);
  }
  return rail;
}

function render(profile = lastProfile) {
  if (!profile) return;
  lastProfile = profile;
  const rail = ensureRail();
  if (!rail) return;
  rail.innerHTML = needs.map(definition => {
    const value = clamp(profile[definition.key]);
    return `<div class="game-status-chip is-${severity(definition,value)}" title="${definition.label}: ${value}%">
      <span class="game-status-glyph" aria-hidden="true">${definition.glyph}</span>
      <span class="game-status-copy"><small>${definition.label}</small><strong>${value}</strong></span>
      <i class="game-status-meter" aria-hidden="true"><b style="--status-value:${value}%"></b></i>
    </div>`;
  }).join('');
}

async function refresh() {
  if (loading || document.hidden || !appRoot?.querySelector('.game-shell.is-playing')) return;
  loading = true;
  try {
    const response = await apiFetch('/api/bootstrap', { signal:AbortSignal.timeout(8000) });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload?.authenticated && payload.profile) render(payload.profile);
  } catch {
    // The core game owns connection recovery. Cosmetic UI never interrupts play.
  } finally {
    loading = false;
  }
}

function scheduleRefresh(delay = 120) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, delay);
}

function replaceMarketplaceName(root=document){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];let node;while((node=walker.nextNode()))if(node.nodeValue?.includes('Capital Market'))nodes.push(node);
  for(const text of nodes)text.nodeValue=text.nodeValue.replaceAll('Capital Market','Okrika Marketplace');
}

function readSeed(){try{return JSON.parse(sessionStorage.getItem(seedKey)||'{}')||{};}catch{return{};}}
function writeSeed(seed){try{sessionStorage.setItem(seedKey,JSON.stringify(seed));}catch{}}
function genderDefaults(seed,presentation){
  if(presentation==='feminine'){
    seed.hair=pick(['braids','locs','afro']);seed.body=pick(['slim','regular']);seed.facialHair='none';
  }else if(presentation==='masculine'){
    seed.hair=pick(['crop','locs','afro','bald']);seed.body=pick(['regular','broad']);seed.facialHair=Math.random()>.72?'beard':'none';
  }
  writeSeed(seed);
}
function seedCharacterControls(){
  const form=appRoot?.querySelector('#onboarding-form');if(!form)return;
  const seed=readSeed();
  for(const [name,values] of Object.entries(choices)){
    if(seed[name]===undefined)seed[name]=pick(values);
    const control=form.querySelector(`[name="${name}"]`);if(!control||control.dataset.characterSeeded)return;
    control.dataset.characterSeeded='true';
    if([...control.options||[]].some(option=>option.value===seed[name])){control.value=seed[name];control.dispatchEvent(new Event('change',{bubbles:true}));}
    control.addEventListener('change',()=>{const current=readSeed();current[name]=control.value;writeSeed(current);});
  }
  const presentation=form.querySelector('[name="presentation"]');
  if(presentation&&!presentation.dataset.genderPolished){
    presentation.dataset.genderPolished='true';
    presentation.addEventListener('change',()=>{const current=readSeed();current.presentation=presentation.value;genderDefaults(current,presentation.value);queueMicrotask(seedCharacterControls);});
  }
  writeSeed(seed);
  const card=form.querySelector('.onboarding-card');
  if(card&&!card.querySelector('.character-randomize-note')){
    const note=document.createElement('p');note.className='character-randomize-note';note.textContent='Every AbujaLife resident starts with their own look. You can change every detail.';card.append(note);
  }
}

function diversifyAmbientResidents(){
  appRoot?.querySelectorAll('[data-city-npc]').forEach((npc,index)=>{
    npc.classList.remove('npc-variant-wide','npc-variant-tall','npc-variant-small');
    npc.classList.add(['npc-variant-wide','npc-variant-tall','npc-variant-small',''][index%4]);
    const face=npc.querySelector('.walker-face');if(!face||face.querySelector('[data-npc-detail]'))return;
    const ns='http://www.w3.org/2000/svg',detail=document.createElementNS(ns,'g');detail.dataset.npcDetail='';
    if(index%5===1){detail.innerHTML='<circle cx="-13" cy="-60" r="1.8" fill="#d8b86d"/><circle cx="13" cy="-60" r="1.8" fill="#d8b86d"/>';}
    else if(index%5===2){detail.innerHTML='<path d="M-8-56Q0-50 8-56" fill="none" stroke="#2d2924" stroke-width="2"/>';}
    else if(index%5===3){detail.innerHTML='<path d="M-10-70H-2V-63H-10ZM2-70H10V-63H2ZM-2-67H2" fill="none" stroke="#24362e" stroke-width="1.4"/>';}
    if(detail.childNodes.length)face.append(detail);
  });
}

function polish(){replaceMarketplaceName(appRoot);replaceMarketplaceName(sheetRoot);seedCharacterControls();diversifyAmbientResidents();}

const appObserver = new MutationObserver(() => {
  polish();
  if (appRoot?.querySelector('.game-shell.is-playing')) {
    if (lastProfile) render(lastProfile);
    scheduleRefresh();
  }
});
const sheetObserver=new MutationObserver(()=>replaceMarketplaceName(sheetRoot));
// renderMain replaces the app root's direct child. Watching only that boundary avoids
// reacting to our own HUD updates or animation DOM work inside the 3D scene.
if (appRoot) appObserver.observe(appRoot, { childList:true });
if (sheetRoot) sheetObserver.observe(sheetRoot,{childList:true,subtree:true,characterData:true});
addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRefresh(80); });
addEventListener('focus', () => scheduleRefresh(80));
setInterval(() => { if (!document.hidden) refresh(); }, 60000);
polish();
scheduleRefresh(0);
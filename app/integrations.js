import { apiFetch } from './api-client.js';

const PHONE_ROOT = () => document.querySelector('#phone-root');
const GUIDE_KEY = 'abujalife.camera-guide.v2';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const publicOrigin = () => {
  const configured = globalThis.ABUJA_PUBLIC_CONFIG?.PUBLIC_WEB_URL;
  try { return new URL(configured || location.origin).origin; } catch { return location.origin; }
};

async function api(path, options = {}) {
  const response = await apiFetch(path, {
    ...options,
    headers: {'content-type':'application/json', ...(options.headers || {})},
    ...(options.body && typeof options.body !== 'string' ? {body:JSON.stringify(options.body)} : {})
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    const error = new Error(body.error || 'Please try again.');
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return body;
}

let profilePromise;
async function currentProfile() {
  profilePromise ||= api('/api/bootstrap').then(result => result.profile || null).catch(() => null);
  return profilePromise;
}

export function shareURL(kind = 'life', {residentId, id, district, slug} = {}) {
  const url = new URL('/', publicOrigin());
  url.searchParams.set('share', String(kind || 'life').slice(0, 32));
  if (residentId) url.searchParams.set('resident', String(residentId).slice(0, 100));
  if (id) url.searchParams.set('id', String(id).slice(0, 120));
  if (district) url.searchParams.set('district', String(district).slice(0, 80));
  if (slug) url.searchParams.set('slug', String(slug).slice(0, 120));
  url.hash = kind === 'home' ? 'world' : '';
  return url.href;
}

function dataURLFile(value, name = 'abujalife.png') {
  if (typeof value !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)) return null;
  const [head, encoded] = value.split(','), type = head.match(/^data:([^;]+)/i)?.[1] || 'image/png';
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  return new File([bytes], name, {type});
}

export async function shareAbujaLife({kind='life', title='AbujaLife', text='', imageDataUrl='', id, district, slug} = {}) {
  const profile = await currentProfile();
  const url = shareURL(kind, {residentId:profile?.id, id, district:district || profile?.district, slug});
  const cleanText = String(text || '').trim();
  const file = dataURLFile(imageDataUrl, `abujalife-${kind}.png`);
  const payload = {title, text:cleanText, url};
  try {
    if (navigator.share) {
      if (file && navigator.canShare?.({files:[file]})) await navigator.share({...payload, files:[file]});
      else await navigator.share(payload);
      return {shared:true, url};
    }
  } catch (error) {
    if (error?.name === 'AbortError') return {shared:false, cancelled:true, url};
  }
  const fallback = `${cleanText}${cleanText?'\n\n':''}${url}`;
  try { await navigator.clipboard?.writeText(fallback); } catch {}
  if (file) {
    const objectUrl = URL.createObjectURL(file), a = document.createElement('a');
    a.href = objectUrl; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  return {shared:false, copied:true, url};
}

function xIntent(text, url = '') {
  const target = new URL('https://x.com/intent/post');
  target.searchParams.set('text', `${String(text || '').trim()}${url ? `${text?'\n\n':''}${url}` : ''}`);
  return target.href;
}

function removeQueryFlag(name) {
  const url = new URL(location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

let xDraft = '', xReplyTo = '', xView = 'home', xSearch = '', xOpened = false, xStatus = null, xRows = [], xIncludes = {}, xBusy = false, xError = '';
const xUserMap = () => new Map((xIncludes?.users || []).map(user => [String(user.id), user]));
const xRoot = () => PHONE_ROOT()?.querySelector('.abj-x-overlay');

function xOfficialPostURL(id) { return /^\d+$/.test(String(id || '')) ? `https://x.com/i/web/status/${id}` : 'https://x.com/'; }
function xMetric(row, key) { return Number(row?.public_metrics?.[key] || 0).toLocaleString(); }
function xCard(row) {
  const author = xUserMap().get(String(row.author_id)) || {}, name = author.name || author.username || 'X user';
  return `<article class="abj-x-post" data-x-post="${esc(row.id)}">
    <header><div class="abj-x-avatar">${author.profile_image_url ? `<img src="${esc(author.profile_image_url)}" alt="">` : '𝕏'}</div><div><strong>${esc(name)}${author.verified?' <span class="abj-x-verified">✓</span>':''}</strong><small>${author.username?`@${esc(author.username)}`:''}${row.created_at?` · ${esc(new Date(row.created_at).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'}))}`:''}</small></div></header>
    <p>${esc(row.text || '')}</p>
    <footer>
      <button data-x-action="reply" data-id="${esc(row.id)}" aria-label="Reply">↩ <span>${xMetric(row,'reply_count')}</span></button>
      <button data-x-action="repost" data-id="${esc(row.id)}" aria-label="Repost">↻ <span>${xMetric(row,'retweet_count')}</span></button>
      <button data-x-action="like" data-id="${esc(row.id)}" aria-label="Like">♡ <span>${xMetric(row,'like_count')}</span></button>
      <button data-x-action="bookmark" data-id="${esc(row.id)}" aria-label="Bookmark">⌑</button>
      <a href="${xOfficialPostURL(row.id)}" target="_blank" rel="noopener noreferrer" aria-label="Open on X">↗</a>
    </footer>
  </article>`;
}

function xMarkup() {
  if (!xStatus) return `<div class="abj-x-loading"><span>𝕏</span><p>Connecting to X…</p></div>`;
  if (!xStatus.enabled) return `<div class="abj-x-state"><span class="abj-x-logo">𝕏</span><h2>X is ready for connection</h2><p>${xStatus.reason === 'secure_token_key_missing' ? 'Secure X token storage needs to be configured on the server before residents can connect accounts.' : 'Add the X developer credentials on the AbujaLife server to activate the connected X experience.'}</p><a class="abj-x-primary" href="https://x.com/" target="_blank" rel="noopener noreferrer">Open official X ↗</a></div>`;
  if (!xStatus.connected) return `<div class="abj-x-state"><span class="abj-x-logo">𝕏</span><h2>Bring your X account into your AbujaLife phone.</h2><p>Connect securely with X. AbujaLife never sees or stores your X password.</p><button class="abj-x-primary" data-x-action="connect">Connect X</button><a class="abj-x-secondary" href="https://x.com/" target="_blank" rel="noopener noreferrer">Open official X ↗</a>${xError?`<p class="abj-x-error">${esc(xError)}</p>`:''}</div>`;
  const user = xStatus.user || {};
  return `<div class="abj-x-connected">
    <div class="abj-x-profile"><div class="abj-x-avatar large">${user.profile_image_url?`<img src="${esc(user.profile_image_url)}" alt="">`:'𝕏'}</div><div><strong>${esc(user.name || 'X')}</strong><small>${user.username?`@${esc(user.username)}`:'Connected'}</small></div><button data-x-action="disconnect">Disconnect</button></div>
    <form class="abj-x-compose" data-x-form="compose"><textarea name="xText" maxlength="4000" placeholder="What’s happening?">${esc(xDraft)}</textarea>${xReplyTo?`<div class="abj-x-replying">Replying to a post <button type="button" data-x-action="cancel-reply">×</button></div>`:''}<div><span>${xDraft.length.toLocaleString()} / 4,000</span><button type="submit" ${xBusy?'disabled':''}>${xBusy?'Posting…':'Post'}</button></div></form>
    <nav class="abj-x-tabs"><button data-x-tab="home" class="${xView==='home'?'active':''}">Home</button><button data-x-tab="mentions" class="${xView==='mentions'?'active':''}">Mentions</button><button data-x-tab="bookmarks" class="${xView==='bookmarks'?'active':''}">Bookmarks</button><button data-x-tab="search" class="${xView==='search'?'active':''}">Search</button></nav>
    ${xView==='search'?`<form class="abj-x-search" data-x-form="search"><input name="q" value="${esc(xSearch)}" placeholder="Search X"><button type="submit">Search</button></form>`:''}
    ${xError?`<p class="abj-x-error">${esc(xError)}</p>`:''}
    <div class="abj-x-feed">${xBusy&&!xRows.length?'<p class="abj-x-note">Loading X…</p>':xRows.map(xCard).join('') || '<p class="abj-x-note">Nothing to show here yet.</p>'}</div>
  </div>`;
}

function renderX() {
  let overlay = xRoot();
  const screen = PHONE_ROOT()?.querySelector('.ph-screen');
  if (!screen) return;
  if (!overlay) {
    overlay = document.createElement('section');
    overlay.className = 'abj-x-overlay';
    overlay.setAttribute('aria-label','X inside AbujaLife phone');
    screen.append(overlay);
  }
  overlay.innerHTML = `<header class="abj-x-header"><button data-x-action="close" aria-label="Back to phone">‹</button><strong>𝕏</strong><a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="Open official X">↗</a></header><div class="abj-x-scroll">${xMarkup()}</div>`;
}

async function loadXStatus() {
  xError = '';
  try { xStatus = await api('/api/x/status'); } catch (error) { xStatus = {enabled:false, connected:false}; xError = error.message; }
  renderX();
}
async function loadXFeed() {
  if (!xStatus?.connected) return;
  xBusy = true; xError = ''; renderX();
  try {
    const params = new URLSearchParams({kind:xView});
    if (xView === 'search') params.set('q', xSearch);
    const result = await api(`/api/x/timeline?${params}`);
    xRows = result.items || []; xIncludes = result.includes || {};
  } catch (error) { xError = error.message; xRows = []; xIncludes = {}; }
  finally { xBusy = false; renderX(); }
}
async function openX(prefill = '') {
  xOpened = true; xDraft = String(prefill || '').trim(); xReplyTo = ''; xError = ''; xRows = []; xIncludes = {}; xStatus = null; xView = 'home';
  renderX(); await loadXStatus(); if (xStatus?.connected) await loadXFeed();
}
function closeX() { xOpened = false; xDraft = ''; xReplyTo = ''; xRoot()?.remove(); }

async function connectX() {
  xBusy = true; xError = ''; renderX();
  try {
    const result = await api('/api/x/connect',{method:'POST',body:{}});
    const popup = window.open(result.authorizeUrl,'abujalife-x-oauth','popup,width=560,height=760,noopener=false');
    if (!popup) location.href = result.authorizeUrl;
  } catch (error) { xError = error.message; }
  finally { xBusy = false; renderX(); }
}
async function xMutation(action, data) {
  xBusy = true; xError = ''; renderX();
  try { await api(`/api/x/${action}`,{method:'POST',body:data}); await loadXFeed(); }
  catch (error) { xError = error.message; xBusy = false; renderX(); }
}

function dismissGuide(guide, remember = true) {
  if (!guide?.isConnected) return;
  guide.classList.add('abj-guide-leaving');
  if (remember) { try { localStorage.setItem(GUIDE_KEY,'1'); } catch {} }
  setTimeout(() => guide.remove(), 220);
}
function enhanceGuide() {
  const guide = document.querySelector('.play-guide');
  if (!guide || guide.dataset.abjEnhanced) return;
  guide.dataset.abjEnhanced = 'true';
  let seen = false; try { seen = localStorage.getItem(GUIDE_KEY) === '1'; } catch {}
  if (seen) { guide.remove(); return; }
  guide.classList.add('abj-camera-guide');
  guide.innerHTML = `<span aria-hidden="true">⌁</span><p><strong>Look around</strong> Drag · pinch to zoom</p><button type="button" aria-label="Dismiss camera tip">×</button>`;
  guide.querySelector('button')?.addEventListener('click', () => dismissGuide(guide));
  const stage = guide.closest('.world-stage');
  const learned = () => dismissGuide(guide);
  stage?.addEventListener('pointerup', learned, {once:true});
  stage?.addEventListener('wheel', learned, {once:true, passive:true});
  setTimeout(() => dismissGuide(guide), 4200);
}

function enhanceShareButtons() {
  document.querySelectorAll('[data-ph-action="home-share-native"]').forEach(button => {
    if (!button.dataset.abjLabel) { button.dataset.abjLabel='1'; button.textContent='Share home + AbujaLife link'; }
  });
  document.querySelectorAll('[data-ph-action="home-share-x"]').forEach(button => {
    if (!button.dataset.abjLabel) { button.dataset.abjLabel='1'; button.textContent='Share to X'; }
  });
}

function readShareDraft(button) {
  const scope = button.closest('.ph-scroll') || PHONE_ROOT();
  return {
    caption: scope?.querySelector('#ph-shareCaption')?.value?.trim() || 'My life in AbujaLife',
    image: scope?.querySelector('.ph-share-preview')?.src || ''
  };
}

async function handleCaptureClick(event) {
  const button = event.target.closest?.('button,[data-app]');
  if (!button) return;
  if (button.matches('[data-app="x"]')) {
    event.preventDefault(); event.stopImmediatePropagation();
    void openX(); return;
  }
  if (button.matches('[data-ph-action="home-share-native"]')) {
    event.preventDefault(); event.stopImmediatePropagation();
    const {caption,image} = readShareDraft(button);
    void shareAbujaLife({kind:'home',title:'My AbujaLife home',text:caption,imageDataUrl:image});
    return;
  }
  if (button.matches('[data-ph-action="home-share-x"]')) {
    event.preventDefault(); event.stopImmediatePropagation();
    const {caption} = readShareDraft(button), profile = await currentProfile(), url = shareURL('home',{residentId:profile?.id,district:profile?.district});
    if (xStatus?.connected || xOpened) void openX(`${caption}\n\n${url}`);
    else void openX(`${caption}\n\n${url}`);
  }
}

function normalizeIncomingShareLink() {
  const url = new URL(location.href), kind = url.searchParams.get('share');
  if (!kind) return;
  document.documentElement.dataset.sharedEntry = kind.slice(0,32);
}

addEventListener('message', event => {
  if (event.origin !== publicOrigin() && event.origin !== globalThis.ABUJA_PUBLIC_CONFIG?.API_PUBLIC_URL) return;
  if (event.data?.type !== 'abujalife:x-connected') return;
  void (async()=>{await loadXStatus();if(xStatus?.connected)await loadXFeed();})();
});
addEventListener('DOMContentLoaded', () => {
  normalizeIncomingShareLink(); enhanceGuide(); enhanceShareButtons();
  if (new URL(location.href).searchParams.get('x') === 'connected') { removeQueryFlag('x'); setTimeout(() => void openX(), 250); }
});
document.addEventListener('click', handleCaptureClick, true);
document.addEventListener('click', event => {
  const action = event.target.closest?.('[data-x-action]'), tab = event.target.closest?.('[data-x-tab]');
  if (tab && xRoot()?.contains(tab)) { xView = tab.dataset.xTab; xRows=[]; xIncludes={}; renderX(); if (xView !== 'search') void loadXFeed(); return; }
  if (!action || !xRoot()?.contains(action)) return;
  const kind=action.dataset.xAction,id=action.dataset.id;
  if(kind==='close'){closeX();return;}if(kind==='connect'){void connectX();return;}if(kind==='disconnect'){void (async()=>{try{await api('/api/x/disconnect',{method:'POST',body:{}});xStatus={enabled:true,connected:false};xRows=[];}catch(e){xError=e.message;}renderX();})();return;}if(kind==='cancel-reply'){xReplyTo='';renderX();return;}if(kind==='reply'){xReplyTo=id;xDraft='';renderX();xRoot()?.querySelector('textarea')?.focus();return;}
  if(['like','repost','bookmark'].includes(kind)) void xMutation(kind,{tweetId:id});
});
document.addEventListener('input', event => { if (event.target.matches?.('.abj-x-compose textarea')) { xDraft=event.target.value; const counter=xRoot()?.querySelector('.abj-x-compose span');if(counter)counter.textContent=`${xDraft.length.toLocaleString()} / 4,000`; } });
document.addEventListener('submit', event => {
  const form=event.target;
  if(form.matches?.('[data-x-form="compose"]')){event.preventDefault();if(!xDraft.trim()||xBusy)return;void (async()=>{xBusy=true;xError='';renderX();try{await api('/api/x/post',{method:'POST',body:{text:xDraft.trim(),...(xReplyTo?{replyTo:xReplyTo}:{})}});xDraft='';xReplyTo='';await loadXFeed();}catch(e){xError=e.message;xBusy=false;renderX();}})();}
  if(form.matches?.('[data-x-form="search"]')){event.preventDefault();xSearch=String(new FormData(form).get('q')||'').trim();if(!xSearch)return;xView='search';void loadXFeed();}
});

const observer = new MutationObserver(() => {
  enhanceGuide(); enhanceShareButtons();
  if (xOpened && PHONE_ROOT()?.querySelector('.ph-screen') && !xRoot()) renderX();
});
observer.observe(document.documentElement,{childList:true,subtree:true});

// Stable public integration surface for future profile, property, achievement,
// event, location and business share buttons. New features should call this
// instead of constructing internal or temporary URLs themselves.
globalThis.AbujaLifeShare = Object.freeze({ share:shareAbujaLife, url:shareURL, openX, xIntent });

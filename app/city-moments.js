// City Moments: the small things that happen in a resident's Abuja day, shown
// as phone-style notices in the stage's shared context slot (one card at a
// time, never over Nearby Chat, the gig bar or the controls). Presentation
// only: the rules live in src/shared/city-moments.mjs, the server counts real
// actions and pays every reward through the ledger.
import { apiFetch } from './api-client.js';
import { showGameToast as toast } from './game-toast.js';
import { audioDirector } from './audio-director.js';
import { momentsView } from '../src/shared/city-moments.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const naira = value => `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
const short = value => value >= 1000 ? `₦${Math.round(value / 1000)}k` : naira(value);
const FROM = { friend: 'Message', family: 'Family', coach: 'Gym', community: 'Community', weather: 'Weather', dispatch: 'Dispatch', neighbour: 'Neighbour', work: 'Work' };
const SHOW_MS = 11000;

let profile = null, view = null, card = null, hideTimer = 0, busyClaim = false, clockOffset = 0;
// Prefer the app's server-anchored game clock; device clocks can be hours off.
const now = () => (typeof globalThis.__ABJ_GAME_NOW__ === 'function' ? globalThis.__ABJ_GAME_NOW__() : Date.now() + clockOffset);
const stage = () => document.querySelector('.world-stage');
const canvas = () => stage()?.querySelector('.world-canvas');
const world = () => globalThis.__ABJ_WORLD__?.handle || null;
const sheetRoot = document.querySelector('#sheet-root');

const seenKey = () => `abujalife.moments.seen.v1:${profile?.id || ''}`;
function seen() { try { return new Set(JSON.parse(localStorage.getItem(seenKey()) || '[]')); } catch { return new Set(); } }
function remember(id) { try { const list = [...seen(), id].slice(-40); localStorage.setItem(seenKey(), JSON.stringify(list)); } catch {} }

function refresh() { view = profile ? momentsView(profile, now()) : null; paintChip(); if (sheetRoot?.querySelector('.abj-moments')) paintSheet(); }

function busy() {
  const scene = canvas(); if (!scene || scene.classList.contains('world-preview')) return true;
  const slot = stage()?.querySelector('.hud-context-slot');
  // Notices appear on the street only; indoors the activity tray owns the slot (the chip still counts).
  return Boolean(sheetRoot?.childElementCount) || document.body.classList.contains('phone-is-open') || scene.dataset.sceneKind !== 'public'
    || Boolean(scene.dataset.activity) || Boolean(profile?.activeTrip) || !profile?.onboardingComplete
    || Boolean(slot?.querySelector('.needs-coach-card,.activity-discovery-card,.gig-card,.location-activity-tray:not([data-mode="minimized"]):not([data-mode="dismissed"])'));
}
function dismiss() { clearTimeout(hideTimer); card?.remove(); card = null; }

async function claim(moment) {
  if (busyClaim) return; busyClaim = true; paintSheet();
  try {
    const response = await apiFetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'moment-claim', payload: { momentId: moment.id, idempotencyKey: crypto.randomUUID() } }), timeoutMs: 15000 });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Could not collect that right now. Check your connection and try again.');
    if (body.profile) { profile = body.profile; dispatchEvent(new CustomEvent('abujalife:profile', { detail: { profile: body.profile } })); }
    audioDirector().effect('money');
    toast(`+${naira(body.reward?.naira)} · +${body.reward?.rep || 0} Rep · ${moment.title}`);
  } catch (error) { audioDirector().effect('error'); toast(error.message); }
  finally { busyClaim = false; refresh(); }
}

/** Take the resident toward the moment using controls that already work. */
function go(moment) {
  const target = moment.target || {}, scene = canvas(), handle = world();
  if (target.gig) { const find = document.querySelector('.gig-find:not([disabled])'); if (find) { find.click(); return; } toast('Street gigs are on the bar at the bottom of the street.'); return; }
  if (target.home) { const button = document.querySelector('[data-quick-home]'); if (button && !button.disabled) { button.click(); return; } toast('Head home when you can.'); return; }
  if (target.job) { toast('Open My life → Work to start a shift.'); return; }
  if (target.venueId && scene?.dataset.sceneKind === 'public' && handle?.getScenePoints) {
    const point = handle.getScenePoints().find(item => item.id === target.venueId);
    if (point) {
      handle.setWaypoint?.({ x: point.x, y: point.y, color: '#ff9bd2' });
      if (scene.dataset.driving !== 'true') handle.walkTo?.(point.x, point.y + 40);
      toast(`${target.label}: follow the pink beacon.`); setTimeout(() => handle.setWaypoint?.(null), 60000); return;
    }
  }
  // Somewhere else in Abuja: the Map plans the real journey.
  const map = document.querySelector('.game-nav [data-nav-outside]');
  toast(target.district ? `${target.label} is across town. Pick it on the Map to travel.` : `${target.label || 'That place'} is in another part of Abuja. Find it on the Map.`);
  map?.click();
}

function showCard(moment, kind) {
  const slot = stage()?.querySelector('.hud-context-slot'); if (!slot) return false;
  dismiss();
  card = document.createElement('div'); card.className = `moment-card is-${kind}`; card.setAttribute('role', 'status');
  card.innerHTML = kind === 'done'
    ? `<span class="moment-icon" aria-hidden="true">✅</span><div><small>Moment complete</small><strong>${esc(moment.title)}</strong><p>${short(moment.naira)} + ${moment.rep} Rep waiting for you.</p></div><button type="button" class="moment-go" data-moment-claim>Collect</button><button type="button" class="moment-close" data-moment-close aria-label="Later">×</button>`
    : `<span class="moment-icon" aria-hidden="true">${moment.icon}</span><div><small>📱 ${esc(FROM[moment.from] || 'Abuja')} · ${short(moment.naira)} + ${moment.rep} Rep</small><strong>${esc(moment.title)}</strong><p>${esc(moment.body)}</p></div><button type="button" class="moment-go" data-moment-go>Go</button><button type="button" class="moment-close" data-moment-close aria-label="Later">×</button>`;
  card.addEventListener('click', event => {
    if (event.target.closest('[data-moment-close]')) { dismiss(); return; }
    if (event.target.closest('[data-moment-go]')) { dismiss(); go(moment); return; }
    if (event.target.closest('[data-moment-claim]')) { dismiss(); void claim(moment); return; }
  });
  slot.prepend(card); audioDirector().effect('notify');
  hideTimer = setTimeout(dismiss, SHOW_MS);
  return true;
}

function check() {
  if (!profile) profile = globalThis.__ABJ_WORLD__?.profile || null;
  if (!profile) return;
  refresh();
  if (card && (!card.isConnected || busy())) dismiss();
  if (card || busy() || !view) return;
  const known = seen();
  const ready = view.moments.find(m => m.done && !m.claimed && !known.has(`done:${m.id}`));
  if (ready && showCard(ready, 'done')) { remember(`done:${ready.id}`); return; }
  const fresh = view.moments.find(m => !m.done && !m.claimed && !known.has(m.id));
  if (fresh && showCard(fresh, 'new')) remember(fresh.id);
}

// A compact chip beside the Hustle chip, and a sheet listing this block's moments.
function chipText() { if (!view) return '📱'; const open = view.moments.filter(m => !m.claimed).length; return `📱 ${open}${view.ready ? ' •' : ''}`; }
function paintChip() {
  const host = stage(); if (!host) return;
  const scene = canvas(); if (!scene || scene.classList.contains('world-preview')) return;
  let chip = host.querySelector('.moments-chip');
  if (!chip) { chip = document.createElement('button'); chip.type = 'button'; chip.className = 'moments-chip'; chip.setAttribute('aria-label', 'Open City Moments'); chip.onclick = () => openSheet(); host.append(chip); }
  const text = chipText(); if (chip.textContent !== text) chip.textContent = text;
  chip.classList.toggle('has-ready', Boolean(view?.ready));
}
function remaining(endsAt) { const minutes = Math.max(0, Math.round((endsAt - now()) / 60000)); return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m left` : `${minutes}m left`; }
function paintSheet() {
  if (!sheetRoot || !view) return;
  const list = view.moments.length ? view.moments.map(m => `<article class="hustle-mission ${m.claimed ? 'claimed' : m.done ? 'ready' : ''}"><span class="hustle-icon" aria-hidden="true">${m.icon}</span><div><small>${esc(FROM[m.from] || 'Abuja')}${m.done || m.claimed ? '' : ` · ${remaining(m.expiresAt)}`}</small><strong>${esc(m.title)}</strong><p>${esc(m.body)}</p><div class="hustle-progress"><i style="width:${Math.round(m.progress / m.goal * 100)}%"></i></div></div><div class="hustle-side"><b>${short(m.naira)}</b><small>+${m.rep} Rep</small>${m.claimed ? '<em>Collected</em>' : m.done ? `<button type="button" class="primary" data-moment-claim="${esc(m.id)}" ${busyClaim ? 'disabled' : ''}>${busyClaim ? 'Collecting…' : 'Collect'}</button>` : `<button type="button" data-moment-go="${esc(m.id)}">Go</button>`}</div></article>`).join('')
    : '<p class="muted">Nothing new right now. Moments arrive through the day: invitations at night, prayers on Friday, rush hour for drivers, visits across town.</p>';
  sheetRoot.innerHTML = `<div class="sheet-backdrop"><section class="sheet game-sheet-wide abj-hustle abj-moments" role="dialog" aria-modal="true" aria-labelledby="moments-title"><button class="sheet-close icon-button" data-moments-close aria-label="Close City Moments">×</button><span class="eyebrow">YOUR ABUJA DAY</span><h2 id="moments-title">City Moments</h2><p class="muted">New moments every four hours, Abuja time. They count what you really do in the city.</p><div class="hustle-missions">${list}</div><p class="muted hustle-note">Next moments in ${remaining(view.endsAt).replace(' left', '')}.</p></section></div>`;
  const close = () => sheetRoot.replaceChildren();
  sheetRoot.querySelector('[data-moments-close]').onclick = close;
  sheetRoot.querySelector('.sheet-backdrop').onclick = event => { if (event.target.classList.contains('sheet-backdrop')) close(); };
  sheetRoot.querySelectorAll('[data-moment-claim]').forEach(button => button.onclick = () => { const m = view.moments.find(item => item.id === button.dataset.momentClaim); if (m) void claim(m); });
  sheetRoot.querySelectorAll('[data-moment-go]').forEach(button => button.onclick = () => { const m = view.moments.find(item => item.id === button.dataset.momentGo); close(); if (m) go(m); });
}
function openSheet() { if (!profile) profile = globalThis.__ABJ_WORLD__?.profile || null; refresh(); paintSheet(); }

addEventListener('abujalife:profile', event => { if (event.detail?.profile) { profile = event.detail.profile; refresh(); } });
addEventListener('abujalife:world-mounted', () => { profile = globalThis.__ABJ_WORLD__?.profile || profile; dismiss(); refresh(); });
addEventListener('abj:open-moments', openSheet);
// The server's clock decides the block; align once from bootstrap.
void apiFetch('/api/bootstrap', { timeoutMs: 12000 }).then(r => r.json()).then(body => { if (Number.isFinite(body?.serverTime)) clockOffset = body.serverTime - Date.now(); if (body?.profile) { profile = body.profile; refresh(); } }).catch(() => {});
setInterval(check, 5000);

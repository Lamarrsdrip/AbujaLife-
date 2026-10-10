// Needs notifications. One card at a time, in the stage's shared context slot
// (so it cannot cover Nearby Chat, the gig bar or the controls), chosen by the
// rules in src/shared/needs-coach.mjs. Every action drives a control or place
// that already works: the Home button, a home activity, or a walk to a real door.
import { nextNeedNotice, recordNeedNotice, nearestNeedPlace } from '../src/shared/needs-coach.mjs';
import { showGameToast as toast } from './game-toast.js';
import { audioDirector } from './audio-director.js';

const KEY = 'abujalife.needs-history.v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let profile = null, history = load(), card = null, hideTimer = 0, current = null;
function load() { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(history)); } catch {} }

const stage = () => document.querySelector('.world-stage');
const canvas = () => stage()?.querySelector('.world-canvas');
const sheetOpen = () => Boolean(document.querySelector('#sheet-root')?.childElementCount) || document.body.classList.contains('phone-is-open');
function busy() {
  const scene = canvas(); if (!scene || scene.classList.contains('world-preview')) return true;
  return sheetOpen() || scene.dataset.sceneKind === 'transit' || Boolean(scene.dataset.activity) || Boolean(profile?.activeTrip) || !profile?.onboardingComplete || Boolean(stage()?.querySelector('.activity-discovery-card,.gig-card'));
}
function dismiss() { clearTimeout(hideTimer); card?.remove(); card = null; current = null; }

const HOME_ACTIVITY = { rest: 'sleep', food: 'eat', clean: 'shower', toilet: 'shower', unwind: 'relax', fun: 'relax' };
function run(notice) {
  const scene = canvas(), kind = scene?.dataset.sceneKind, id = notice.action.id, world = globalThis.__ABJ_WORLD__?.handle;
  const goHome = () => { const button = document.querySelector('[data-quick-home]'); if (button && !button.disabled) { button.click(); return true; } return false; };
  if (kind === 'home') {
    // At home the fix is an activity in the room, if this home offers it.
    const button = document.querySelector(`[data-location-activity="${HOME_ACTIVITY[id] || ''}"]:not([disabled])`);
    if (button) { button.click(); return; }
    if (id === 'social' || id === 'fun') { if (goHome()) return; } // at home this control reads "Go Out"
    toast(id === 'food' ? 'Step out and find a place to eat.' : 'Head out and explore the neighbourhood.'); return;
  }
  if (id === 'rest' || id === 'clean' || id === 'toilet') { if (goHome()) return; toast('Make your way home when you can.'); return; }
  if (kind === 'public' && world?.getScenePoints) {
    const motion = world.getMotionState?.() || { x: 0, y: 0 }, place = nearestNeedPlace(id, world.getScenePoints(), motion);
    if (place) { world.setWaypoint?.({ x: place.x, y: place.y, color: '#7fd0ff' }); world.walkTo?.(place.x, place.y + 40); toast(`Heading to ${place.label}.`); setTimeout(() => world.setWaypoint?.(null), 45000); return; }
  }
  // Inside a venue, or a street with no suitable door: open the city Map to choose somewhere.
  const map = document.querySelector('.game-nav [data-nav-outside]'); if (map) { map.click(); return; }
  toast('Open the Map to find a place nearby.');
}

function show(notice) {
  const slot = stage()?.querySelector('.hud-context-slot'); if (!slot) return false;
  dismiss(); current = notice;
  card = document.createElement('div'); card.className = `needs-coach-card is-${notice.level}`; card.setAttribute('role', 'status');
  card.innerHTML = `<span class="needs-coach-icon" aria-hidden="true">${notice.action.icon}</span><div><small>${esc(notice.label)} · ${notice.level === 'critical' ? 'critical' : notice.level === 'low' ? 'low' : 'needs attention'}</small><strong>${esc(notice.message)}</strong></div><button type="button" class="needs-coach-go" data-needs-go>${esc(notice.action.label)}</button><button type="button" class="needs-coach-close" data-needs-close aria-label="Dismiss">×</button>`;
  card.addEventListener('click', event => { if (event.target.closest('[data-needs-go]')) { const chosen = current; dismiss(); if (chosen) run(chosen); } else if (event.target.closest('[data-needs-close]')) dismiss(); });
  slot.prepend(card);
  history = recordNeedNotice(history, notice, Date.now()); save();
  if (notice.level !== 'attention') audioDirector().effect('notify');
  hideTimer = setTimeout(dismiss, notice.showMs);
  return true;
}
function check() {
  if (!profile) profile = globalThis.__ABJ_WORLD__?.profile || null;
  if (!profile) return;
  if (card && (!card.isConnected || busy())) dismiss();
  if (card) return;
  const notice = nextNeedNotice(profile, history, Date.now(), { busy: busy() });
  if (notice) show(notice);
}
addEventListener('abujalife:profile', event => { if (event.detail?.profile) profile = event.detail.profile; });
addEventListener('abujalife:world-mounted', () => { profile = globalThis.__ABJ_WORLD__?.profile || profile; dismiss(); });
setInterval(check, 4000);

// Street gigs: ride-hailing, deliveries and errands the resident physically
// carries out in the street scene. This layer only presents requests, guides
// the resident with a waypoint and reports arrival. The server decides every
// offer, checks every step and pays through the ledger.
import { apiFetch } from './api-client.js';
import { showGameToast as toast } from './game-toast.js';
import { GIG_KINDS, GIG_RULES } from '../src/shared/street-gigs.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const naira = value => `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
const ICON = { ride: '🚕', delivery: '📦', errand: '🧺' };
const EXCLUDED_POINTS = new Set(['home', 'your-car']);

let docker = () => {}, world = null, bar = null, arrow = null, gig = null, summary = null, busy = false, timer = 0, reporting = false, lastError = '';

async function act(action, payload = {}) {
  const response = await apiFetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, payload }), timeoutMs: 15000 });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || 'That did not work. Please try again.'), { code: body.code });
  if (body.profile) dispatchEvent(new CustomEvent('abujalife:profile', { detail: { profile: body.profile } }));
  if (body.gigs) { summary = { ...body.gigs, receivedAt: Date.now() }; gig = body.gigs.gig; }
  return body;
}

const onStreet = () => world?.container?.isConnected && world.container.dataset.sceneKind === 'public';
const point = id => world?.handle?.getScenePoints?.().find(item => item.id === id) || null;
const target = () => !gig ? null : gig.state === 'onboard' ? point(gig.to) : gig.state === 'accepted' ? point(gig.from) : null;
const driving = () => world?.container?.dataset.driving === 'true';

function syncWaypoint() {
  const spot = target();
  world?.handle?.setWaypoint?.(spot ? { x: spot.x, y: spot.y, color: gig.state === 'onboard' ? '#5fe08a' : '#ffd35a' } : null);
}

function render() {
  if (!bar) return;
  if (!onStreet()) { bar.hidden = true; if (arrow) arrow.hidden = true; return; }
  bar.hidden = false;
  const kind = gig ? GIG_KINDS[gig.kind] : null, today = summary ? `${summary.today}/${summary.dailyLimit} today` : '';
  let markup;
  if (!gig) {
    const done = summary && summary.remaining === 0;
    markup = `<button type="button" class="gig-find" data-gig="find" ${busy || done ? 'disabled' : ''}><span class="gig-icon" aria-hidden="true">${driving() ? '🚕' : '🧺'}</span><span><strong>${done ? 'Gigs done for today' : busy ? 'Looking for a request…' : driving() ? 'Go online · rides & deliveries' : 'Find an errand'}</strong><small>${done ? 'New requests tomorrow' : driving() ? 'You are driving · earn per trip' : 'On foot · drive your car for rides'}${today ? ` · ${today}` : ''}</small></span></button>`;
  } else if (gig.state === 'offered') {
    markup = `<div class="gig-card" role="group" aria-label="${esc(kind.title)}"><div class="gig-head"><span class="gig-icon" aria-hidden="true">${ICON[gig.kind]}</span><div><strong>${esc(gig.executive ? 'Executive ride' : kind.title)} · ${esc(gig.customer)}</strong><small>${esc(gig.fromName)} → ${esc(gig.toName)}${gig.cargo ? ` · ${esc(gig.cargo)}` : ''}</small></div><b>${naira(gig.fare)}</b></div><div class="gig-actions"><button type="button" class="gig-skip" data-gig="skip" ${busy ? 'disabled' : ''}>Skip</button><button type="button" class="gig-accept" data-gig="accept" ${busy ? 'disabled' : ''}>Accept</button></div></div>`;
  } else {
    const picking = gig.state === 'accepted', place = picking ? gig.fromName : gig.toName;
    markup = `<div class="gig-card gig-live" role="status"><div class="gig-head"><span class="gig-icon" aria-hidden="true">${ICON[gig.kind]}</span><div><strong>${esc(picking ? kind.verb : kind.drop)} · ${esc(place)}</strong><small data-gig-distance>${esc(picking ? `${gig.customer} is waiting` : `${naira(gig.fare)} on arrival · quick trips earn a tip`)}</small></div><button type="button" class="gig-cancel" data-gig="cancel" aria-label="Cancel this gig" ${busy ? 'disabled' : ''}>×</button></div></div>`;
  }
  if (bar.dataset.markup !== markup) { bar.dataset.markup = markup; bar.innerHTML = markup; }
}

function guide() {
  if (!onStreet() || !gig || gig.state === 'offered') { if (arrow) arrow.hidden = true; return; }
  const spot = target(), motion = world.handle.getMotionState?.();
  if (!spot || !motion) return;
  const gap = Math.hypot(spot.x - motion.x, spot.y - motion.y), reach = (spot.radius || 76) + (motion.driving ? 120 : 40);
  const label = bar?.querySelector('[data-gig-distance]');
  if (label) { const text = gap <= reach ? 'You have arrived' : `${Math.max(5, Math.round(gap / 10))} m away · follow the beacon`; if (label.textContent !== text) label.textContent = text; }
  // Edge arrow while the stop is off screen.
  const seen = world.handle.projectPoint?.({ x: spot.x, y: spot.y, elevation: 60 });
  if (arrow && seen) {
    const margin = 46, on = seen.visible && seen.x > margin && seen.x < seen.width - margin && seen.y > 90 && seen.y < seen.height - 150;
    arrow.hidden = on;
    if (!on) {
      const cx = seen.width / 2, cy = seen.height / 2; let dx = seen.x - cx, dy = seen.y - cy; if (!seen.visible) { dx = -dx; dy = -dy; }
      const angle = Math.atan2(dy, dx), rx = cx - margin, ry = cy - 120, scale = Math.min(rx / Math.max(1, Math.abs(Math.cos(angle))), ry / Math.max(1, Math.abs(Math.sin(angle))));
      arrow.style.transform = `translate(${(cx + Math.cos(angle) * scale).toFixed(0)}px, ${(cy + Math.sin(angle) * scale).toFixed(0)}px) rotate(${(angle * 180 / Math.PI).toFixed(0)}deg)`;
    }
  }
  if (gap <= reach && !reporting) void arrive();
}

async function arrive() {
  if (!gig || reporting) return;
  reporting = true;
  try {
    if (gig.state === 'accepted') { await act('gig-pickup', { gigId: gig.id }); toast(gig.kind === 'ride' ? `${gig.customer} is in. Head to ${gig.toName}.` : `Collected. Take it to ${gig.toName}.`); }
    else if (gig.state === 'onboard') {
      const key = (arrive.keys ||= new Map()).get(gig.id) || crypto.randomUUID(); arrive.keys.set(gig.id, key);
      const done = await act('gig-complete', { gigId: gig.id, idempotencyKey: key });
      if (done.payout) dispatchEvent(new Event('abj:game-success'));
      if (done.payout) toast(`${done.payout.tip ? `On time! ${naira(done.payout.fare)} + ${naira(done.payout.tip)} tip` : `Paid ${naira(done.payout.paid)}`} · ${summary.today}/${summary.dailyLimit} today`);
    }
    lastError = '';
  } catch (error) {
    // "Too fast" simply means the server has not seen enough travel time yet: try again on the next check.
    if (error.code === 'gig_expired') { gig = null; toast('That request has ended.'); }
    else if (error.code !== 'gig_too_fast' && error.message !== lastError) { lastError = error.message; toast(error.message); }
  } finally { reporting = false; syncWaypoint(); render(); }
}

async function run(action) {
  if (busy) return; busy = true; render();
  try {
    if (action === 'find') { const places = (world.handle.getScenePoints?.() || []).map(item => item.id).filter(id => !EXCLUDED_POINTS.has(id)).slice(0, GIG_RULES.maxPlaces); await act('gig-offer', { places }); if (gig && !point(gig.from)) { await act('gig-cancel'); toast('No requests right here. Try again in a moment.'); } }
    else if (action === 'accept') { await act('gig-accept', { gigId: gig.id }); toast(`${GIG_KINDS[gig.kind].verb} at ${gig.fromName}. Follow the beacon.`); }
    else if (action === 'skip' || action === 'cancel') { await act('gig-cancel'); }
  } catch (error) { if (error.code === 'gig_expired') gig = null; toast(error.message); }
  finally { busy = false; syncWaypoint(); render(); }
}

function mount(detail) {
  unmount();
  if (!detail?.handle || !detail.container) return;
  world = { handle: detail.handle, container: detail.container };
  const stage = detail.container.closest('.world-stage') || detail.container;
  bar = document.createElement('div'); bar.className = 'street-gigs'; bar.setAttribute('aria-live', 'polite'); bar.hidden = true;
  bar.addEventListener('click', event => { const button = event.target.closest('[data-gig]'); if (button && !button.disabled) void run(button.dataset.gig); });
  arrow = document.createElement('div'); arrow.className = 'street-gig-arrow'; arrow.hidden = true; arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '➤';
  // The bar lives in the stage's shared context slot, the one region that is
  // already coordinated with Nearby Chat, the activity tray, toasts and popovers.
  // Pinning it at its own fixed height is what let Nearby Chat sit on top of it.
  const dock = () => { const slot = stage.querySelector('.hud-context-slot'); if (slot && bar && bar.parentElement !== slot) slot.prepend(bar); return Boolean(slot); };
  if (!dock()) { stage.append(bar); bar.dataset.undocked = ''; }
  docker = () => { if (bar && dock()) delete bar.dataset.undocked; };
  detail.container.append(arrow);
  const profile = globalThis.__ABJ_WORLD__?.profile;
  if (profile?.gig && !gig) gig = { ...profile.gig, fromName: point(profile.gig.from)?.label || profile.gig.from, toName: point(profile.gig.to)?.label || profile.gig.to };
  syncWaypoint(); render();
  timer = setInterval(() => {
    // Server time, advanced locally since the last reply, decides when a request has lapsed.
    if (gig && summary && gig.expiresAt <= summary.serverTime + (Date.now() - summary.receivedAt)) { gig = null; syncWaypoint(); }
    docker(); render(); guide();
  }, 300);
}
function unmount() { clearInterval(timer); timer = 0; bar?.remove(); arrow?.remove(); bar = arrow = null; world = null; }

addEventListener('abujalife:world-mounted', event => mount(event.detail));
addEventListener('abujalife:world-unmounted', unmount);
if (globalThis.__ABJ_WORLD__?.handle) mount(globalThis.__ABJ_WORLD__);

// Today's Hustle: the daily missions, Abuja Rep level and check-in streak.
// Presentation only: the server tracks progress from real actions and pays
// every reward through the ledger.
import { apiFetch } from './api-client.js';
import { showGameToast as toast } from './game-toast.js';
import { hustleView, REP_LEVELS } from '../src/shared/daily-hustle.mjs';

const sheetRoot = document.querySelector('#sheet-root');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const naira = value => `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
const short = value => value >= 1000 ? `₦${Math.round(value / 1000)}k` : naira(value);
const TIER = { easy: 'EASY', out: 'OUT & ABOUT', hustle: 'HUSTLE' };
let view = null, busy = false, clockOffset = 0;
const now = () => Date.now() + clockOffset;

async function load() {
  const response = await apiFetch('/api/bootstrap', { timeoutMs: 12000 }), body = await response.json().catch(() => ({}));
  if (!response.ok || !body.profile) throw new Error(body.error || 'Sign in to see today\'s hustle.');
  if (Number.isFinite(body.serverTime)) clockOffset = body.serverTime - Date.now();
  view = hustleView(body.profile, now()); return view;
}
async function act(action, payload = {}) {
  const response = await apiFetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, payload }), timeoutMs: 15000 });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || 'That did not work. Please try again.'), { code: body.code });
  if (body.profile) dispatchEvent(new CustomEvent('abujalife:profile', { detail: { profile: body.profile } }));
  if (body.hustle) view = body.hustle;
  return body;
}

function markup() {
  const rep = view.rep;
  // Progress through the current level only, so the bar starts empty at each new title.
  const percent = rep.next ? Math.max(4, Math.min(100, Math.round((1 - rep.next.remaining / Math.max(1, rep.next.xp - levelFloor(rep))) * 100))) : 100;
  const streak = view.streak;
  return `<div class="sheet-backdrop"><section class="sheet game-sheet-wide abj-hustle" role="dialog" aria-modal="true" aria-labelledby="hustle-title"><button class="sheet-close icon-button" data-hustle-close aria-label="Close today's hustle">×</button>
<span class="eyebrow">TODAY IN ABUJA</span><h2 id="hustle-title">Today's Hustle</h2>
<div class="hustle-rep"><div><small>ABUJA REP · LEVEL ${rep.level}</small><strong>${esc(rep.title)}</strong></div><div class="hustle-rep-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div><small>${rep.next ? `${rep.next.remaining} Rep to “${esc(rep.next.title)}”` : 'Top level reached'}</small></div>
<div class="hustle-streak"><div class="hustle-days">${streak.calendar.map((day, index) => { const number = index + 1, done = streak.checkedInToday ? number <= streak.nextDay : number < streak.nextDay && streak.days > 0, today = number === streak.nextDay && !streak.checkedInToday; return `<span class="${done ? 'done' : ''} ${today ? 'today' : ''}"><b>${done ? '✓' : number === 7 ? '🎁' : number}</b><small>${short(day.naira)}</small></span>`; }).join('')}</div>
<button type="button" class="primary" data-hustle-checkin ${streak.checkedInToday || busy ? 'disabled' : ''}>${streak.checkedInToday ? 'Checked in · come back tomorrow' : `Check in · day ${streak.nextDay}: ${short(streak.reward.naira)} + ${streak.reward.rep} Rep`}</button></div>
<h3 class="hustle-heading">Today's missions<small>${view.swapsLeft ? `${view.swapsLeft} free swap` : 'no swaps left'}</small></h3>
<div class="hustle-missions">${view.missions.map(m => `<article class="hustle-mission ${m.claimed ? 'claimed' : m.done ? 'ready' : ''}"><span class="hustle-icon" aria-hidden="true">${m.icon}</span><div><small>${TIER[m.tier]}</small><strong>${esc(m.title)}</strong><p>${esc(m.hint)}</p><div class="hustle-progress"><i style="width:${Math.round(m.progress / m.goal * 100)}%"></i></div></div><div class="hustle-side"><b>${short(m.naira)}</b><small>+${m.rep} Rep</small>${m.claimed ? '<em>Collected</em>' : m.done ? `<button type="button" class="primary" data-hustle-claim="${esc(m.id)}" ${busy ? 'disabled' : ''}>Collect</button>` : `<em>${m.progress}/${m.goal}</em>${m.progress === 0 && view.swapsLeft ? `<button type="button" data-hustle-swap="${esc(m.id)}" ${busy ? 'disabled' : ''}>Swap</button>` : ''}`}</div></article>`).join('')}</div>
<div class="hustle-bonus ${view.bonus.claimed ? 'claimed' : view.allDone ? 'ready' : ''}"><span aria-hidden="true">🏆</span><div><strong>Finish all three</strong><small>${short(view.bonus.naira)} · +${view.bonus.rep} Rep</small></div>${view.bonus.claimed ? '<em>Collected</em>' : `<button type="button" class="primary" data-hustle-claim="bonus" ${view.allDone && !busy ? '' : 'disabled'}>Collect</button>`}</div>
<p class="muted hustle-note">Missions count real things you do in the city. New missions every day at midnight, Abuja time.</p></section></div>`;
}
const levelFloor = rep => REP_LEVELS[rep.level - 1]?.xp || 0;

function paint() {
  if (!view) return;
  sheetRoot.innerHTML = markup();
  const close = () => sheetRoot.replaceChildren();
  sheetRoot.querySelector('[data-hustle-close]').onclick = close;
  sheetRoot.querySelector('.sheet-backdrop').onclick = event => { if (event.target.classList.contains('sheet-backdrop')) close(); };
  const run = async (action, payload, done) => { if (busy) return; busy = true; paint(); try { const result = await act(action, payload); done?.(result); } catch (error) { toast(error.message); } finally { busy = false; if (sheetRoot.querySelector('.abj-hustle')) paint(); refreshChips(); } };
  sheetRoot.querySelector('[data-hustle-checkin]').onclick = () => { const key = crypto.randomUUID(); void run('hustle-checkin', { idempotencyKey: key }, result => toast(`Checked in: ${naira(result.reward.naira)} + ${result.reward.rep} Rep`)); };
  sheetRoot.querySelectorAll('[data-hustle-claim]').forEach(button => button.onclick = () => { const key = crypto.randomUUID(); void run('hustle-claim', { missionId: button.dataset.hustleClaim, idempotencyKey: key }, result => toast(`Collected ${naira(result.reward.naira)} + ${result.reward.rep} Rep`)); });
  sheetRoot.querySelectorAll('[data-hustle-swap]').forEach(button => button.onclick = () => void run('hustle-swap', { missionId: button.dataset.hustleSwap }));
}
export async function openHustle() {
  try { await load(); paint(); refreshChips(); } catch (error) { toast(error.message); }
}

// Entry points: the Life menu, and a chip beside the street gig bar.
function ensureLifeEntry() {
  const grid = sheetRoot?.querySelector('.life-menu-grid'); if (!grid || grid.querySelector('[data-abj-hustle]')) return;
  const button = document.createElement('button'); button.dataset.abjHustle = ''; button.className = 'abj-hustle-entry';
  button.innerHTML = '<span aria-hidden="true">🎯</span><strong>Today\'s Hustle</strong><small>Daily missions · Abuja Rep</small>'; button.onclick = () => void openHustle(); grid.prepend(button);
}
function chipText() { if (!view) return '🎯 Hustle'; const ready = view.missions.filter(m => m.done && !m.claimed).length + (view.allDone && !view.bonus.claimed ? 1 : 0) + (view.streak.checkedInToday ? 0 : 1); return `🎯 ${view.missions.filter(m => m.done).length}/3${ready ? ' •' : ''}`; }
function refreshChips() { document.querySelectorAll('.hustle-chip').forEach(chip => { const text = chipText(); if (chip.textContent !== text) chip.textContent = text; }); }
function ensureChip() {
  const stage = document.querySelector('.world-stage'); if (!stage || stage.querySelector('.hustle-chip')) return;
  const canvas = stage.querySelector('.world-canvas'); if (!canvas || canvas.classList.contains('world-preview')) return;
  const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'hustle-chip'; chip.setAttribute('aria-label', 'Open today\'s hustle'); chip.textContent = chipText(); chip.onclick = () => void openHustle(); stage.append(chip);
}
if (sheetRoot) new MutationObserver(ensureLifeEntry).observe(sheetRoot, { childList: true });
addEventListener('abujalife:world-mounted', () => { ensureChip(); if (!view) void load().then(refreshChips).catch(() => {}); });
addEventListener('abujalife:profile', event => { if (event.detail?.profile) { view = hustleView(event.detail.profile, now()); refreshChips(); } });
ensureLifeEntry(); ensureChip();
addEventListener('abj:open-hustle', () => void openHustle());

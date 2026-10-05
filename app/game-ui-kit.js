import { apiFetch } from './api-client.js';

const appRoot = document.querySelector('#app');
const needs = [
  { key:'energy', label:'Energy', glyph:'⚡', good:value=>value >= 35 },
  { key:'hunger', label:'Food', glyph:'◒', good:value=>value >= 35 },
  { key:'hygiene', label:'Clean', glyph:'◇', good:value=>value >= 35 },
  { key:'social', label:'Social', glyph:'◎', good:value=>value >= 35 },
  { key:'fun', label:'Fun', glyph:'✦', good:value=>value >= 35 },
  { key:'stress', label:'Stress', glyph:'⌁', good:value=>value <= 65, inverse:true },
];

let loading = false;
let lastProfile;
let refreshTimer;

const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));

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
    // The core game already owns connection recovery. A cosmetic HUD must never interrupt play.
  } finally {
    loading = false;
  }
}

function scheduleRefresh(delay = 120) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, delay);
}

const observer = new MutationObserver(() => {
  if (appRoot?.querySelector('.game-shell.is-playing')) {
    if (lastProfile) render(lastProfile);
    scheduleRefresh();
  }
});

if (appRoot) observer.observe(appRoot, { childList:true, subtree:true });
addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRefresh(80); });
addEventListener('focus', () => scheduleRefresh(80));
setInterval(() => { if (!document.hidden) refresh(); }, 60000);
scheduleRefresh(0);

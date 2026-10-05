import { apiFetch } from './api-client.js';

const appRoot = document.querySelector('#app');
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

// renderMain replaces the app root's direct child. Watching only that boundary avoids
// reacting to our own HUD updates or animation DOM work inside the 3D scene.
if (appRoot) observer.observe(appRoot, { childList:true });
addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRefresh(80); });
addEventListener('focus', () => scheduleRefresh(80));
setInterval(() => { if (!document.hidden) refresh(); }, 60000);
scheduleRefresh(0);

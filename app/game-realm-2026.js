const root = document.documentElement;
const app = document.querySelector('#app');
const sheetRoot = document.querySelector('#sheet-root');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

root.dataset.realmUi = '2026';
document.body.classList.add('realm-ui');

function currentView() {
  const active = document.querySelector('.game-nav button.active');
  const label = active?.textContent?.trim().toLowerCase() || '';
  if (label.includes('map')) return 'map';
  if (label.includes('life')) return 'life';
  if (label.includes('phone')) return 'phone';
  const hash = location.hash.replace(/^#/, '').toLowerCase();
  if (hash === 'outside') return 'outside';
  if (hash === 'work') return 'work';
  if (hash === 'market') return 'market';
  if (hash === 'property') return 'property';
  if (hash === 'profile') return 'profile';
  return 'play';
}

let lastSurface;
function decorate() {
  document.body.dataset.realmView = currentView();

  const nav = document.querySelector('.game-nav');
  if (nav) nav.setAttribute('aria-label', 'AbujaLife game navigation');

  const wallet = document.querySelector('.wallet-button');
  if (wallet) {
    wallet.dataset.realmResource = 'cash';
    wallet.title = 'Game Naira';
  }

  const surface = document.querySelector('.game-content > *:first-child');
  if (surface && surface !== lastSurface && !reduceMotion.matches) {
    lastSurface = surface;
    surface.classList.remove('realm-view-enter');
    requestAnimationFrame(() => surface.classList.add('realm-view-enter'));
  }

  document.querySelectorAll('.game-nav button,.primary,.secondary,.world-camera-button,.world-sprint-button,.abj-life-shortcuts button,.abj-live-places button').forEach(button => {
    if (!button.hasAttribute('data-realm-control')) button.setAttribute('data-realm-control', 'true');
  });
}

function pressTarget(event) {
  const target = event.target instanceof Element ? event.target.closest('button,[role="button"]') : null;
  return target instanceof HTMLElement && !target.hasAttribute('disabled') ? target : null;
}

function beginPress(event) {
  const target = pressTarget(event);
  if (!target) return;
  target.classList.add('realm-pressing');
}

function endPress(event) {
  const target = pressTarget(event);
  if (!target) return;
  target.classList.remove('realm-pressing');
  if (!reduceMotion.matches && typeof navigator.vibrate === 'function' && target.matches('.game-nav button,.primary,.world-sprint-button,[data-realm-control]')) {
    try { navigator.vibrate(8); } catch {}
  }
}

addEventListener('pointerdown', beginPress, { passive: true });
addEventListener('pointerup', endPress, { passive: true });
addEventListener('pointercancel', event => pressTarget(event)?.classList.remove('realm-pressing'), { passive: true });
addEventListener('hashchange', decorate);
addEventListener('abujalife:scene-ready', decorate);

const observer = new MutationObserver(() => queueMicrotask(decorate));
if (app) observer.observe(app, { childList: true });
if (sheetRoot) observer.observe(sheetRoot, { childList: true, subtree: true });

decorate();
window.dispatchEvent(new CustomEvent('abujalife:realm-ready', { detail: { version: '2026' } }));

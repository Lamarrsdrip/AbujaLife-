// Player feedback that should never be missing: what just happened to my money,
// and whether the game can reach the city right now.
// - A floating +₦/−₦ chip under the balance whenever it changes.
// - A small connection banner: offline, reconnecting (only after a few
//   seconds, so ordinary blips stay silent) and a short "back online".
const fmt = value => new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Math.abs(Number(value) || 0));
const digits = text => { const n = Number(String(text || '').replace(/[^\d]/g, '')); return Number.isSafeInteger(n) ? n : null; };

let shownWallet = null, owner = null;
function walletButton() { return document.querySelector('.wallet-button'); }
function floatDelta(delta) {
  const button = walletButton(); if (!button || !delta) return;
  const rect = button.getBoundingClientRect(); if (!rect.width) return;
  const chip = document.createElement('div');
  chip.className = `wallet-delta ${delta > 0 ? 'is-gain' : 'is-spend'}`; chip.setAttribute('aria-hidden', 'true');
  chip.textContent = `${delta > 0 ? '+' : '−'}₦${fmt(delta)}`;
  chip.style.left = `${Math.round(rect.left + rect.width / 2)}px`; chip.style.top = `${Math.round(rect.bottom + 6)}px`;
  document.body.append(chip); button.classList.remove('wallet-pulse'); void button.offsetWidth; button.classList.add(delta > 0 ? 'wallet-pulse' : 'wallet-pulse-spend');
  setTimeout(() => { chip.remove(); button.classList.remove('wallet-pulse', 'wallet-pulse-spend'); }, 2200);
  const live = document.querySelector('#wallet-live') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'wallet-live', className: 'visually-hidden' });
  live.setAttribute('aria-live', 'polite'); live.textContent = `${delta > 0 ? 'Received' : 'Spent'} ${fmt(delta)} Naira.`;
}
// The number the player can see is the source of truth: react when the header's
// balance changes (re-rendered or patched), never to a profile the header has
// not shown yet. A different resident resets the baseline instead of animating.
function checkWallet() {
  const value = digits(walletButton()?.querySelector('strong')?.textContent), id = globalThis.__ABJ_WORLD__?.profile?.id || owner;
  if (value === null) return;
  if (id !== owner || shownWallet === null) { owner = id; shownWallet = value; return; }
  if (value !== shownWallet) { floatDelta(value - shownWallet); shownWallet = value; }
}
let walletQueued = false;
new MutationObserver(() => { if (walletQueued) return; walletQueued = true; requestAnimationFrame(() => { walletQueued = false; checkWallet(); }); })
  .observe(document.body, { childList: true, subtree: true, characterData: true });
setInterval(checkWallet, 1500);

// Connection banner.
let banner = null, reconnectTimer = 0, backTimer = 0, state = 'online';
function paintBanner(kind, text) {
  clearTimeout(backTimer);
  if (!kind) { banner?.remove(); banner = null; return; }
  if (!banner) { banner = document.createElement('div'); banner.className = 'connection-banner'; banner.setAttribute('role', 'status'); document.body.append(banner); }
  banner.dataset.kind = kind; banner.textContent = text;
  if (kind === 'back') backTimer = setTimeout(() => paintBanner(null), 2200);
}
function update(next) {
  if (next === state) return;
  const previous = state; state = next; clearTimeout(reconnectTimer);
  if (next === 'offline') paintBanner('offline', 'You\'re offline. Your progress is safe; reconnect to keep playing.');
  else if (next === 'reconnecting') reconnectTimer = setTimeout(() => { if (state === 'reconnecting') paintBanner('reconnecting', 'Reconnecting to the city…'); }, 3500);
  else if (next === 'online') { if (banner || previous === 'offline') paintBanner('back', 'Back online.'); else paintBanner(null); }
}
addEventListener('offline', () => update('offline'));
addEventListener('online', () => update(document.documentElement.dataset.connection === 'reconnecting' ? 'reconnecting' : 'online'));
new MutationObserver(() => { if (navigator.onLine === false) return update('offline'); update(document.documentElement.dataset.connection === 'reconnecting' ? 'reconnecting' : 'online'); })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-connection'] });
if (navigator.onLine === false) update('offline');

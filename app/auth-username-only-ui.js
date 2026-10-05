import { apiFetch } from './api-client.js';

// AbujaLife account access is username/password only. This adapter keeps the
// rendered auth and security surfaces aligned with that production policy even
// while the main app remains backwards-compatible with older stored accounts.
const root = document.querySelector('#app');
const sheetRoot = document.querySelector('#sheet-root');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sessionsBusy = false;

async function api(path, { body, ...options } = {}) {
  const response = await apiFetch(path, {
    ...options,
    headers: { ...(body !== undefined ? {'content-type':'application/json'} : {}), ...(options.headers || {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    const error = new Error(result.error || 'Please try again.');
    error.status = response.status;
    error.code = result.code;
    throw error;
  }
  return result;
}

function closeSessions() {
  if (sheetRoot) sheetRoot.innerHTML = '';
}

function sessionMarkup(sessions = []) {
  return sessions.map(session => `
    <div class="account-session">
      <span>
        <strong>${session.current ? 'This device' : 'Signed-in device'}</strong>
        <small>Signed in ${esc(new Date(session.createdAt).toLocaleString())}</small>
      </span>
      ${session.current ? '' : `<button type="button" class="text-button" data-username-session-revoke="${esc(session.id)}">Sign out</button>`}
    </div>`).join('');
}

async function openSessions() {
  if (!sheetRoot || sessionsBusy) return;
  sessionsBusy = true;
  sheetRoot.innerHTML = `<div class="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="username-security-title"><button type="button" class="sheet-close" data-username-sessions-close aria-label="Close account settings">×</button><span class="eyebrow">YOUR ACCOUNT</span><h2 id="username-security-title">Account &amp; security</h2><p class="muted" role="status">Loading your signed-in devices…</p></section></div>`;
  const sheet = sheetRoot.querySelector('.sheet');
  sheetRoot.querySelector('[data-username-sessions-close]')?.addEventListener('click', closeSessions);
  sheetRoot.querySelector('.sheet-backdrop')?.addEventListener('click', event => { if (event.target === event.currentTarget) closeSessions(); });
  try {
    const result = await api('/api/auth/sessions');
    if (!sheet.isConnected) return;
    const sessions = Array.isArray(result.sessions) ? result.sessions : [];
    sheet.innerHTML = `<button type="button" class="sheet-close" data-username-sessions-close aria-label="Close account settings">×</button><span class="eyebrow">YOUR ACCOUNT</span><h2 id="username-security-title">Account &amp; security</h2><p class="muted">Your AbujaLife account uses your username and password. Review the devices currently signed in.</p><section class="account-sessions"><h3>Active sessions</h3><div class="account-session-list">${sessionMarkup(sessions)}</div><p class="form-error" role="alert"></p><button type="button" class="secondary full" data-username-logout-all>Sign out all devices</button></section>`;
    sheet.querySelector('[data-username-sessions-close]')?.addEventListener('click', closeSessions);
    sheet.querySelectorAll('[data-username-session-revoke]').forEach(button => button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      const error = sheet.querySelector('[role="alert"]');
      if (error) error.textContent = '';
      try {
        await api('/api/auth/sessions/revoke', { method:'POST', body:{ sessionId:button.dataset.usernameSessionRevoke } });
        button.closest('.account-session')?.remove();
      } catch (failure) {
        if (error) error.textContent = failure.message;
        button.disabled = false;
      }
    }));
    sheet.querySelector('[data-username-logout-all]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      if (button.disabled) return;
      button.disabled = true;
      const error = sheet.querySelector('[role="alert"]');
      if (error) error.textContent = '';
      try {
        await api('/api/auth/logout-all', { method:'POST', body:{} });
        location.replace('/');
      } catch (failure) {
        if (error) error.textContent = failure.message;
        button.disabled = false;
      }
    });
  } catch (failure) {
    if (sheet.isConnected) sheet.innerHTML = `<button type="button" class="sheet-close" data-username-sessions-close aria-label="Close account settings">×</button><h2 id="username-security-title">Account &amp; security</h2><p class="form-error" role="alert">${esc(failure.message)}</p><button type="button" class="secondary" data-username-sessions-retry>Try again</button>`;
    sheet.querySelector('[data-username-sessions-close]')?.addEventListener('click', closeSessions);
    sheet.querySelector('[data-username-sessions-retry]')?.addEventListener('click', () => { sessionsBusy = false; void openSessions(); });
  } finally {
    sessionsBusy = false;
  }
}

function applyUsernameOnlyUi() {
  const form = root?.querySelector('#auth-form');
  if (form) {
    form.elements.email?.closest('label')?.remove();
    root.querySelector('[data-forgot-password]')?.remove();
    const username = form.elements.username;
    if (username) {
      const registering = root.querySelector('[data-mode="register"]')?.getAttribute('aria-pressed') === 'true';
      username.placeholder = registering ? 'e.g. zara_abuja' : 'Your username';
      username.maxLength = 24;
      const hint = root.querySelector('#username-hint');
      if (hint) hint.textContent = registering ? 'Use 3–24 letters, numbers or underscores.' : 'Use the username saved with your resident.';
      const label = username.closest('label');
      if (!registering && label?.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.textContent = 'Username';
    }
  }
  const security = root?.querySelector('[data-account-security]');
  if (security) security.textContent = 'Account & security';
}

// Capture the legacy account-security click before app.js can open its former
// email-management sheet. The replacement is sessions-only: no email, no link.
root?.addEventListener('click', event => {
  const button = event.target.closest?.('[data-account-security]');
  if (!button || !root.contains(button)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void openSessions();
}, true);

const observer = new MutationObserver(applyUsernameOnlyUi);
if (root) observer.observe(root, { childList:true, subtree:true });
applyUsernameOnlyUi();

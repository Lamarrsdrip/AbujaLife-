// Production account access is username/password only. Keep this policy close to
// the rendered auth surface so staggered frontend/API deployments never expose
// an email field that the server intentionally ignores.
const root = document.querySelector('#app');
function applyUsernameOnlyUi() {
  const form = root?.querySelector('#auth-form');
  if (!form) return;
  form.elements.email?.closest('label')?.remove();
  root.querySelector('[data-forgot-password]')?.remove();
  const username = form.elements.username;
  if (!username) return;
  const registering = root.querySelector('[data-mode="register"]')?.getAttribute('aria-pressed') === 'true';
  if (!registering) {
    username.placeholder = 'Your username';
    username.maxLength = 24;
    const hint = root.querySelector('#username-hint');
    if (hint) hint.textContent = 'Use the username saved with your resident.';
    const label = username.closest('label');
    if (label?.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.textContent = 'Username';
  }
}
const observer = new MutationObserver(applyUsernameOnlyUi);
if (root) observer.observe(root, { childList: true, subtree: true });
applyUsernameOnlyUi();

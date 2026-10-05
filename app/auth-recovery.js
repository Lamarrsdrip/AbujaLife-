// Email links carry their one-use token in a fragment so it never reaches web
// hosting logs. Remove it from browser history before making any API request.
export function consumeAuthLink(location, history) {
  const hash = String(location.hash || '');
  if (!/^#(?:verify-email|reset-password)=/.test(hash)) return null;
  history.replaceState(history.state, '', `${location.pathname}${location.search || ''}`);
  const match = /^#(verify-email|reset-password)=([a-f0-9]{64})$/.exec(hash);
  return match ? { kind: match[1], token: match[2] } : { kind: hash.startsWith('#verify-email=') ? 'verify-email' : 'reset-password', invalid: true };
}

export function loginCredentials(identifier, password) {
  const value = String(identifier || '').trim();
  return { [value.includes('@') ? 'email' : 'username']: value, password };
}

// Only this closure retains the token. Views, storage and status snapshots never
// receive it. A failed request remains retryable; a completed request consumes it.
export function createAuthRecovery({ link, api }) {
  let token = link?.token, kind = link?.kind || null, status = link ? link.invalid ? 'error' : 'pending' : 'idle';
  let error = link?.invalid ? 'This link is incomplete. Request a new email and use its full link.' : '';
  const snapshot = () => ({ kind, status, error });
  async function complete(expected, body) {
    if (kind !== expected || !token) throw new Error('Request a new email link to continue.');
    if (status === 'working') throw new Error('Your request is already in progress.');
    status = 'working'; error = '';
    try {
      await api(expected === 'verify-email' ? '/api/auth/email/verify' : '/api/auth/password/reset/complete', { method: 'POST', body: { token, ...body } });
      token = undefined; status = 'complete';
      return snapshot();
    } catch (failure) {
      status = 'error'; error = failure.message || 'Please try again.';
      throw failure;
    }
  }
  return {
    snapshot,
    verify: () => complete('verify-email', {}),
    reset: password => complete('reset-password', { password }),
    dismiss() { token = undefined; kind = null; status = 'idle'; error = ''; },
  };
}

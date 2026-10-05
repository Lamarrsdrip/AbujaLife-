// Recover ambiguous network outcomes by reading the genuine session. Never
// replay registration or another write simply because its response was lost.
export function interruptedRequest(error) {
  return error?.name === 'AbortError' || error?.name === 'TimeoutError' ||
    (error?.name === 'TypeError' && !error?.status);
}

export function accountErrorMessage(error) {
  if (interruptedRequest(error)) return 'The connection was interrupted. Your progress is saved if the server received it. Please try again.';
  if (error?.status === 401) return 'Your session has expired. Please sign in again.';
  return error?.message || 'We could not complete this request. Please try again.';
}

export async function authenticateAccount({api, mode, credentials, readSession}) {
  try {
    return await api(`/api/auth/${mode}`, {method:'POST', body:{...credentials, startup:true}});
  } catch (error) {
    if (!interruptedRequest(error)) throw error;
    let recovered;
    try { recovered = await readSession(); } catch { throw error; }
    const expected = credentials.username?.trim().toLowerCase();
    if (recovered.authenticated && recovered.profile &&
        (!expected || recovered.profile.username?.toLowerCase() === expected)) return recovered;
    throw error;
  }
}

export async function finishOnboarding({api, draft, residentId, readSession}) {
  try {
    const result = await api('/api/profile', {method:'POST', body:{...draft, onboardingComplete:true, startup:true}});
    if (result.profile?.onboardingComplete) return result.profile;
  } catch (error) {
    if (!interruptedRequest(error)) throw error;
    let recovered;
    try { recovered = await readSession(); } catch { throw error; }
    if (recovered.authenticated && recovered.profile?.onboardingComplete && (!residentId || recovered.profile.id === residentId)) return recovered.profile;
    throw error;
  }
  const recovered = await readSession();
  if (recovered.authenticated && recovered.profile?.onboardingComplete && (!residentId || recovered.profile.id === residentId)) return recovered.profile;
  throw new Error('Your setup has not finished yet. Please try again.');
}

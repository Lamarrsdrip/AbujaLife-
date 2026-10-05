// Recover ambiguous network outcomes by reading the genuine session. Never
// replay registration or another write simply because its response was lost.
const deferredFields=['people','friends','friendRequests','conversations','notifications','invitations','nearby','events','blocked','muted','transactions','homeVisitRequests','homeVisitors','payments'];
export function mergeCoreBootstrap(current,next) {
  if(!next.startup || !current.authenticated || current.profile?.id!==next.profile?.id)return next;
  const merged={...next};
  for(const key of deferredFields)if(current[key]!==undefined)merged[key]=current[key];
  return merged;
}

export function interruptedRequest(error) {
  return error?.name === 'AbortError' || error?.name === 'TimeoutError' ||
    (error?.name === 'TypeError' && !error?.status);
}

export function accountErrorMessage(error) {
  if (interruptedRequest(error)) return 'The connection was interrupted. Your progress is saved if the server received it. Please try again.';
  if (error?.status === 401 && error?.code === 'invalid_credentials') return error.message || 'Username or password is incorrect.';
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
    const matchesIdentity = expected
      ? recovered.profile?.username?.toLowerCase() === expected
      : credentials.email && recovered.profile?.email?.toLowerCase() === credentials.email.trim().toLowerCase();
    if (recovered.authenticated && recovered.profile && matchesIdentity) return recovered;
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

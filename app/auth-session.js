// Entry is the only session/bootstrap contract used to enter AbujaLife.
const deferredFields=['people','friends','friendRequests','conversations','notifications','invitations','nearby','events','blocked','muted','transactions','homeVisitRequests','homeVisitors','payments'];
export function mergeCoreBootstrap(current,next) {
  if(!next?.entry || !current.authenticated || current.profile?.id!==next.profile?.id)return next;
  const merged={...next};
  const locationKey=p=>[p?.district,p?.location?.kind,p?.location?.venue,p?.location?.ownerId,p?.location?.visitId].join(':');
  for(const key of deferredFields)if(current[key]!==undefined && (key!=='nearby'||locationKey(current.profile)===locationKey(next.profile)))merged[key]=current[key];
  return merged;
}

export function interruptedRequest(error) {
  return error?.name === 'AbortError' || error?.name === 'TimeoutError' ||
    (error?.name === 'TypeError' && !error?.status);
}

export function accountErrorMessage(error) {
  if (interruptedRequest(error)) return 'The connection was interrupted. Your progress is saved if the server received it. Please try again.';
  if (error?.status === 401 && error?.code === 'invalid_credentials') return error.message || 'Username or password is incorrect.';
  if (error?.status === 401) return 'Please sign in again.';
  return error?.message || 'We could not complete this request. Please try again.';
}

function sessionMatches(recovered,credentials={}) {
  if(!recovered?.authenticated||!recovered.profile)return false;
  const username=credentials.username?.trim().toLowerCase();
  const email=credentials.email?.trim().toLowerCase();
  if(username)return recovered.profile.username?.toLowerCase()===username || (username.includes('@')&&recovered.profile.email?.toLowerCase()===username);
  return email ? recovered.profile.email?.toLowerCase()===email : true;
}

export async function authenticateAccount({api, mode, credentials, readSession}) {
  try {
    const result=await api(`/api/auth/${mode}`, {method:'POST', body:{...credentials}});
    if(!sessionMatches(result,credentials))throw new Error('Your resident could not be opened. Please try again.');
    return result;
  } catch (error) {
    if (!interruptedRequest(error)) throw error;
    let recovered;
    try { recovered=await readSession(); } catch { throw error; }
    if(sessionMatches(recovered,credentials))return recovered;
    throw error;
  }
}

export async function finishOnboarding({api, draft, residentId, readSession}) {
  try {
    const result = await api('/api/profile', {method:'POST', body:{...draft, onboardingComplete:true}});
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

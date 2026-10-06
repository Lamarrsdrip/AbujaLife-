// Only public origins belong in this configuration. Source development and the
// anonymous preview intentionally keep /api requests on the current origin.
export function apiURL(path) {
  if (typeof path !== 'string' || !path.startsWith('/api/') || path.includes('\\')) {
    throw new TypeError('Use an API path beginning with /api/.');
  }
  const normalized = new URL(path, 'https://api.abujacity.life');
  if (!normalized.pathname.startsWith('/api/')) throw new TypeError('The API path is invalid.');
  const origin = globalThis.ABUJA_PUBLIC_CONFIG?.API_PUBLIC_URL;
  if (!origin) return path;
  let url;
  try { url = new URL(origin); } catch { throw new Error('The public API origin is invalid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/i.test(url.hostname) || /(?:^|\.)(?:local|internal|invalid|test)$/i.test(url.hostname)) {
    throw new Error('The public API origin must be an HTTPS origin.');
  }
  return new URL(path, url.origin).href;
}

// City entry is a dedicated contract. `/api/entry` contains only the state
// needed to draw the playable resident/world. The full bootstrap remains a
// background hydration path and a rolling-deploy fallback only.
let startupBootstrapPending = true;
let postProfileBootstrapPending = false;
const FAST_ROUTE_MISSING = new Set([404,405,501]);
try { globalThis.sessionStorage?.removeItem('abujalife.fast-bootstrap.v1'); } catch {}
function requestsCoreState(options) {
  if(typeof options.body !== 'string')return options.body?.startup === true;
  try { return JSON.parse(options.body)?.startup === true; } catch { return false; }
}

// Realtime events can cause several surfaces to ask for the same fresh state at
// once. Share only the in-flight GET; never cache a settled response.
const inFlightGets = new Map();

async function fastRouteUnavailable(response) {
  if (FAST_ROUTE_MISSING.has(response.status)) return true;
  if (response.status !== 401) return false;
  try {
    const body = await response.clone().json();
    return body?.code === 'authentication_required';
  } catch {
    return false;
  }
}

async function compatibleFetch(primaryPath, fallbackPath, init) {
  const response = await globalThis.fetch(apiURL(primaryPath), init);
  if (fallbackPath && await fastRouteUnavailable(response)) {
    return globalThis.fetch(apiURL(fallbackPath), init);
  }
  return response;
}

export function apiFetch(path, options = {}) {
  const deadline=AbortSignal.timeout(15000);
  const signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline;
  const method=String(options.method||'GET').toUpperCase();
  const startupBootstrapQuery=method==='GET'&&path==='/api/bootstrap?startup=1';
  const plainBootstrapRequest=method==='GET'&&path==='/api/bootstrap';
  const loginRequest=method==='POST'&&path==='/api/auth/login';
  const registerRequest=method==='POST'&&path==='/api/auth/register';
  const logoutRequest=method==='POST'&&path==='/api/auth/logout';
  const profileWrite=method==='POST'&&path==='/api/profile';
  const coreWrite=requestsCoreState(options);
  const coreAuth=(loginRequest||registerRequest)&&coreWrite;
  if(coreAuth){startupBootstrapPending=false;postProfileBootstrapPending=false;}
  const coreBootstrapRequest=startupBootstrapQuery||(plainBootstrapRequest&&(startupBootstrapPending||postProfileBootstrapPending));
  const fastLogin=loginRequest&&!coreAuth,fastRegister=registerRequest&&!coreAuth;
  const primaryPath=coreBootstrapRequest?'/api/entry':fastLogin?'/api/auth/login/fast':fastRegister?'/api/auth/register/fast':logoutRequest?'/api/auth/logout/fast':path;
  const fallbackPath=coreBootstrapRequest?'/api/bootstrap?startup=1':fastLogin?'/api/auth/login':fastRegister?'/api/auth/register':logoutRequest?'/api/auth/logout':null;
  const url=apiURL(primaryPath);
  const init={...options,signal,credentials:'include',cache:'no-store'};

  if(method!=='GET'||options.body!==undefined||Object.keys(options.headers||{}).length){
    return compatibleFetch(primaryPath,fallbackPath,init).then(async response=>{
      if(profileWrite&&response.ok)postProfileBootstrapPending=!coreWrite;
      return response;
    });
  }

  let pending=inFlightGets.get(url);
  if(!pending){
    pending=compatibleFetch(primaryPath,fallbackPath,init).then(response=>{
      if(coreBootstrapRequest&&response.ok){startupBootstrapPending=false;postProfileBootstrapPending=false;}
      return response;
    }).finally(()=>inFlightGets.delete(url));
    inFlightGets.set(url,pending);
  }
  return pending.then(response=>response.clone());
}

export function createApiEventSource(path, options = {}) {
  return new globalThis.EventSource(apiURL(path), { ...options, withCredentials: true });
}

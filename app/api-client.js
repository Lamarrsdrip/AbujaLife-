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

// The first city render only needs the resident and world state. Heavy social,
// inbox, history and admin data hydrate immediately after the shell is usable.
// Keep retrying the lightweight route until one response succeeds so a flaky
// first request never falls back to the old blocking startup path.
let startupBootstrapPending = true;

// Realtime events can cause several surfaces to ask for the same fresh state at
// once. Share only the in-flight GET; never cache a settled response, so a later
// interaction always reaches the server and mutations are never hidden.
const inFlightGets = new Map();

export function apiFetch(path, options = {}) {
  const deadline=AbortSignal.timeout(15000);
  const signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline;
  const method=String(options.method||'GET').toUpperCase();
  const startupRequest=method==='GET'&&path==='/api/bootstrap'&&startupBootstrapPending;
  const loginRequest=method==='POST'&&path==='/api/auth/login';
  const requestPath=startupRequest?'/api/bootstrap/fast':loginRequest?'/api/auth/login/fast':path;
  const url=apiURL(requestPath);
  const init={...options,signal,credentials:'include',cache:'no-store'};

  if(method!=='GET'||options.body!==undefined||options.headers){
    return globalThis.fetch(url,init);
  }

  let pending=inFlightGets.get(url);
  if(!pending){
    pending=globalThis.fetch(url,init).then(response=>{
      if(startupRequest&&response.ok)startupBootstrapPending=false;
      return response;
    }).finally(()=>inFlightGets.delete(url));
    inFlightGets.set(url,pending);
  }
  return pending.then(response=>response.clone());
}

export function createApiEventSource(path, options = {}) {
  return new globalThis.EventSource(apiURL(path), { ...options, withCredentials: true });
}

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

// The first city render only needs resident/world state. During a staggered
// production deploy the static client can arrive before the API route does, so
// fast startup MUST gracefully fall back to the established endpoint rather
// than blocking residents with a 404/405/501 response. This compatibility path
// is intentionally kept during backend rollouts and restarts.
let startupBootstrapPending = true;
const FAST_ROUTE_MISSING = new Set([404,405,501]);

// Realtime events can cause several surfaces to ask for the same fresh state at
// once. Share only the in-flight GET; never cache a settled response, so a later
// interaction always reaches the server and mutations are never hidden.
const inFlightGets = new Map();

async function compatibleFetch(primaryPath, fallbackPath, init) {
  const response = await globalThis.fetch(apiURL(primaryPath), init);
  if (fallbackPath && FAST_ROUTE_MISSING.has(response.status)) {
    return globalThis.fetch(apiURL(fallbackPath), init);
  }
  return response;
}

export function apiFetch(path, options = {}) {
  const deadline=AbortSignal.timeout(15000);
  const signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline;
  const method=String(options.method||'GET').toUpperCase();
  const startupRequest=method==='GET'&&path==='/api/bootstrap'&&startupBootstrapPending;
  const loginRequest=method==='POST'&&path==='/api/auth/login';
  const primaryPath=startupRequest?'/api/bootstrap/fast':loginRequest?'/api/auth/login/fast':path;
  const fallbackPath=startupRequest?'/api/bootstrap':loginRequest?'/api/auth/login':null;
  const url=apiURL(primaryPath);
  const init={...options,signal,credentials:'include',cache:'no-store'};

  if(method!=='GET'||options.body!==undefined||options.headers){
    return compatibleFetch(primaryPath,fallbackPath,init);
  }

  let pending=inFlightGets.get(url);
  if(!pending){
    pending=compatibleFetch(primaryPath,fallbackPath,init).then(response=>{
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

// Only public origins belong in this configuration. Source development and the
// anonymous preview intentionally keep /api requests on the current origin.
// A production page whose runtime-config.js did not run must still call the
// API host. The website answers /api with the HTML shell, and parsing that
// shell is what players see as "can't reach the city".
function productionApiOrigin() {
  const host = globalThis.location?.hostname;
  return host === 'abujacity.life' || host === 'www.abujacity.life' ? 'https://api.abujacity.life' : '';
}

export function apiURL(path) {
  if (typeof path !== 'string' || !path.startsWith('/api/') || path.includes('\\')) {
    throw new TypeError('Use an API path beginning with /api/.');
  }
  const normalized = new URL(path, 'https://api.abujacity.life');
  if (!normalized.pathname.startsWith('/api/')) throw new TypeError('The API path is invalid.');
  const origin = globalThis.ABUJA_PUBLIC_CONFIG?.API_PUBLIC_URL || productionApiOrigin();
  if (!origin) return path;
  let url;
  try { url = new URL(origin); } catch { throw new Error('The public API origin is invalid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/i.test(url.hostname) || /(?:^|\.)(?:local|internal|invalid|test)$/i.test(url.hostname)) {
    throw new Error('The public API origin must be an HTTPS origin.');
  }
  return new URL(path, url.origin).href;
}

// Realtime events can cause several surfaces to ask for the same fresh state at
// once. Share only an in-flight GET; never cache a settled response.
const inFlightGets = new Map();

// AbortSignal.any/timeout are unavailable in older Safari and embedded
// browsers. Own one cancellable deadline per request and release its listener
// and timer after settlement. Never retry a money-changing request here.
export function boundedFetch(input, options = {}, fetchImpl = globalThis.fetch) {
  const {timeoutMs = 15000, signal: caller, ...rest} = options;
  const controller = new AbortController();
  const abort = () => controller.abort(caller.reason);
  if (caller?.aborted) abort();
  else caller?.addEventListener('abort', abort, {once:true});
  const timer = setTimeout(() => controller.abort(new DOMException('The request timed out.', 'TimeoutError')), Math.min(30000, Math.max(1, Number(timeoutMs) || 15000)));
  let released=false;
  const release = () => { if(released)return;released=true;clearTimeout(timer);caller?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',release); };
  controller.signal.addEventListener('abort',release,{once:true});
  const track = response => {
    if(!response.body){release();return response;}
    // Keep the deadline through JSON/media download, not just receipt of HTTP
    // headers. Cloned GET consumers share the same completed network body.
    for(const method of ['json','text','blob','arrayBuffer','formData'])if(typeof response[method]==='function'){
      const consume=response[method].bind(response);
      response[method]=(...args)=>consume(...args).finally(release);
    }
    const clone=response.clone.bind(response);response.clone=()=>track(clone());
    return response;
  };
  try { return Promise.resolve(fetchImpl(input, {...rest, signal:controller.signal})).then(track,error=>{release();throw error;}); }
  catch (error) { release(); return Promise.reject(error); }
}

export function apiFetch(path, options = {}) {
  const method=String(options.method||'GET').toUpperCase();
  const url=apiURL(path);
  const init={...options,credentials:'include',cache:'no-store'};

  if(method!=='GET'||options.body!==undefined||Object.keys(options.headers||{}).length||options.signal){
    return boundedFetch(url,init);
  }

  let pending=inFlightGets.get(url);
  if(!pending){
    // Finish the bounded network body before cloning it for consumers. Safari
    // can report an aborted in-flight tee as an uncaught error during reload.
    // Completed bytes remain cloneable; only concurrent requests are shared.
    pending=boundedFetch(url,init).then(async response=>{
      if(response.body)await response.clone().arrayBuffer();
      return response;
    }).finally(()=>inFlightGets.delete(url));
    inFlightGets.set(url,pending);
  }
  return pending.then(response=>response.clone());
}

export function createApiEventSource(path, options = {}) {
  return new globalThis.EventSource(apiURL(path), { ...options, withCredentials: true });
}

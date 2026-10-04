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

export function apiFetch(path, options = {}) {
  return globalThis.fetch(apiURL(path), { ...options, credentials: 'include', cache: 'no-store' });
}

export function createApiEventSource(path, options = {}) {
  return new globalThis.EventSource(apiURL(path), { ...options, withCredentials: true });
}

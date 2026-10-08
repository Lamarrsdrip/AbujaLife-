// Keep the existing hosted-checkout handoff in the current tab on iOS Safari.
// Load from our own origin so production's script-src 'self' permits it.
(() => {
  const nativeOpen = window.open.bind(window);
  window.open = (url = '', target = '', features = '') => {
    if (url === 'about:blank' && target === '_blank') {
      let closed = false;
      return {
        opener: null,
        get closed() { return closed; },
        close() { closed = true; },
        location: {
          replace(nextUrl) {
            if (!closed && typeof nextUrl === 'string' && /^https:\/\//i.test(nextUrl)) {
              window.location.assign(nextUrl);
            }
          }
        }
      };
    }
    return nativeOpen(url, target, features);
  };
})();

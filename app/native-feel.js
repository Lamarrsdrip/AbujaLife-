// Makes the game behave like an app, not a web page: no long-press menus or
// accidental text selection on the game surface, no double-tap or pinch page
// zoom, no pull-to-refresh, and a clean lifecycle signal the audio director and
// a native shell can share. Text fields, chat messages and links stay normal.
const editable = target => Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"],.allow-select,.ph-message,.chat-message'));

document.addEventListener('contextmenu', event => { if (!editable(event.target) && !event.target.closest?.('a[href]')) event.preventDefault(); });
document.addEventListener('selectstart', event => { if (!editable(event.target)) event.preventDefault(); });
document.addEventListener('dragstart', event => { if (event.target?.closest?.('img,canvas,svg')) event.preventDefault(); });
// iOS ignores user-scalable=no for accessibility; the game surface handles its own pinch.
let lastTouchEnd = 0;
document.addEventListener('touchend', event => { const now = Date.now(); if (now - lastTouchEnd < 320 && !editable(event.target) && event.target?.closest?.('.game-shell,.sheet,.outside-city')) event.preventDefault(); lastTouchEnd = now; }, { passive: false });
for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, event => event.preventDefault(), { passive: false });

// One lifecycle signal for web and native shells.
const background = () => dispatchEvent(new Event('abj:app-background')), foreground = () => dispatchEvent(new Event('abj:app-foreground'));
document.addEventListener('visibilitychange', () => (document.hidden ? background : foreground)());
// A Capacitor shell, when present, reports the real application state.
globalThis.Capacitor?.Plugins?.App?.addListener?.('appStateChange', state => (state.isActive ? foreground : background)());
document.documentElement.classList.toggle('is-native-shell', Boolean(globalThis.Capacitor?.isNativePlatform?.()));
document.documentElement.classList.toggle('is-standalone', globalThis.matchMedia?.('(display-mode: standalone)').matches === true || globalThis.navigator?.standalone === true);

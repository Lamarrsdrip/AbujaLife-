// Per-scene handle onto the shared audio director (audio-director.js).
//
// The simulator creates one of these for each mounted scene. It used to own a
// private synth that started silent in every location; it now only tells the
// single director which soundscape this scene wants, so moving between places
// crossfades instead of restarting, and two scenes can never play at once.
// All sound is original and synthesized: no recordings, samples or songs.
import { audioDirector } from './audio-director.js';

export function createClubAudio({ enabled = true, onState = () => {}, mode = 'club', scene = mode === 'club' ? 'club' : 'street', closedScene = 'lounge' } = {}) {
  const director = audioDirector(); let disposed = false, open = true, active = true;
  const report = () => { if (disposed) return; const state = director.getState(); onState({ enabled: enabled && !state.muted, playing: enabled && state.playing }); };
  const listen = () => report();
  globalThis.addEventListener?.('abj:audio-state', listen);
  director.setAllowed(enabled);
  const apply = () => { if (disposed) return; director.setScene(open ? scene : closedScene); director.setDucked(!active); report(); };
  apply();
  // The HUD button is created just after this handle; report again once it exists.
  queueMicrotask(report);
  return {
    /** The HUD button: mutes or unmutes all game audio. The choice is remembered. */
    async toggle() { if (!enabled || disposed) return false; director.unlock(); director.toggleMute(); report(); return !director.getState().muted; },
    /** `value` false while a sheet or dialog is open (music ducks); `isOpen` false when a club's DJ is off duty. */
    setActive(value, isOpen = true) { const nextActive = Boolean(value), nextOpen = isOpen !== false; if (nextActive === active && nextOpen === open) return; active = nextActive; open = nextOpen; apply(); },
    dispose() { disposed = true; globalThis.removeEventListener?.('abj:audio-state', listen); },
  };
}

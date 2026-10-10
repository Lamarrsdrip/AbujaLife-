// AbujaLife audio director.
//
// One audio graph for the whole session: a music/ambience bus and an effects bus
// under a master gain. Every location has an original soundscape that is
// synthesized in code (oscillators and filtered noise), so there are no audio
// downloads, nothing to licence and nothing to preload. Changing location
// crossfades; there is never more than one soundscape fading in and one fading
// out. Audio starts only after the first touch or key press (browser and iOS
// policy), stops when the app is in the background, and remembers the player's
// volumes and mute.

export const AUDIO_RULES = Object.freeze({
  storageKey: 'abujalife.audio.v1', fadeSeconds: 1.4, duckLevel: .32, lookAhead: .18, tickMs: 60,
  defaults: Object.freeze({ muted: false, music: .6, effects: .7 }),
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function normalizeAudioPrefs(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}, level = (value, fallback) => Number.isFinite(Number(value)) ? clamp(Number(value), 0, 1) : fallback;
  return { muted: source.muted === true, music: level(source.music, AUDIO_RULES.defaults.music), effects: level(source.effects, AUDIO_RULES.defaults.effects) };
}
export function readAudioPrefs(storage = globalThis.localStorage) {
  try { return normalizeAudioPrefs(JSON.parse(storage?.getItem(AUDIO_RULES.storageKey) || 'null')); } catch { return normalizeAudioPrefs(null); }
}
export function writeAudioPrefs(prefs, storage = globalThis.localStorage) {
  try { storage?.setItem(AUDIO_RULES.storageKey, JSON.stringify(normalizeAudioPrefs(prefs))); } catch {}
}

const CLUBS = new Set(['club', 'club-cage', 'magic-city', 'bear-barn']);
/** Which soundscape belongs to a place. Unknown places fall back to a quiet interior. */
export function soundscapeFor({ kind, venueId = '', venueKind = '', night = false, clubOpen = true } = {}) {
  if (kind === 'home' || kind === 'visit') return 'home';
  if (kind === 'transit') return 'drive';
  if (kind === 'public') return night ? 'street-night' : 'street';
  const id = String(venueId), type = String(venueKind);
  if (CLUBS.has(id) || type === 'club') return clubOpen ? 'club' : 'lounge';
  if (/gym|stadium/.test(id) || type === 'gym') return 'gym';
  if (/restaurant|cafe|farm-city|sahad|grand-square|bear/.test(id) || type === 'restaurant') return 'restaurant';
  if (/grocery|furniture-store|banex|market|mall|plaza|dealership/.test(id) || /market|shop/.test(type)) return 'market';
  if (/park|lake|magicland|aso-rock/.test(id)) return 'park';
  if (/mosque|church|christian/.test(id) || /mosque|church/.test(type)) return 'calm';
  if (/cinema|games-lounge|hotel|salon/.test(id)) return 'lounge';
  return 'office';
}

// Musical material. Frequencies in Hz; patterns are 16 steps per bar.
const A_MINOR = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
const STEP = (bpm) => 60 / bpm / 4;
/**
 * Each soundscape: tempo, an ambience bed (filtered noise) and a `bar` function
 * that schedules one 16th-note step. `play` is the voice API below.
 */
export const SOUNDSCAPES = Object.freeze({
  street: { bpm: 92, bed: { type: 'lowpass', frequency: 420, level: .05 }, step(play, step, bar) {
    const beat = step % 16; // soft highlife-style guitar figure over city hum, with a distant horn now and then
    if ([0, 3, 6, 10, 12].includes(beat)) play.pluck(A_MINOR[(bar * 2 + beat) % 5] * (beat === 10 ? 2 : 1), .16, .022);
    if (beat === 0 && bar % 2 === 0) play.tone(110, .5, 'sine', .03);
    if (beat === 8 && bar % 8 === 5) play.horn(.02);
    if (beat === 4 && bar % 4 === 2) play.chirp(.012);
  } },
  'street-night': { bpm: 76, bed: { type: 'lowpass', frequency: 300, level: .04 }, step(play, step, bar) {
    const beat = step % 16; // quieter city with crickets
    if (beat % 2 === 0) play.cricket(.007);
    if (beat === 0 && bar % 2 === 0) play.tone(98, .7, 'sine', .028);
    if ([4, 11].includes(beat) && bar % 2 === 1) play.pluck(A_MINOR[(bar + beat) % 5], .22, .014);
  } },
  drive: { bpm: 100, bed: { type: 'lowpass', frequency: 260, level: .075 }, step(play, step, bar) {
    const beat = step % 16; // engine hum with a light road rhythm
    if (beat % 4 === 0) play.tone(82, .2, 'triangle', .02);
    if ([2, 6, 10, 14].includes(beat)) play.hat(.006);
    if (beat === 12 && bar % 4 === 3) play.pluck(A_MINOR[bar % 5] * 2, .2, .016);
  } },
  home: { bpm: 66, bed: { type: 'lowpass', frequency: 220, level: .018 }, step(play, step, bar) {
    const beat = step % 16; // calm warm chords
    if (beat === 0) for (const note of [[220, 261.63, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 329.63]][bar % 4]) play.tone(note, 1.9, 'sine', .016);
    if (beat === 10 && bar % 2 === 1) play.pluck(A_MINOR[(bar * 3) % 7] * 2, .5, .012);
  } },
  calm: { bpm: 54, bed: { type: 'lowpass', frequency: 180, level: .014 }, step(play, step, bar) {
    if (step % 16 === 0) for (const note of [[196, 293.66], [174.61, 261.63]][bar % 2]) play.tone(note, 3, 'sine', .014);
  } },
  office: { bpm: 70, bed: { type: 'bandpass', frequency: 900, level: .012 }, step(play, step, bar) {
    const beat = step % 16; // room tone with the odd keyboard tick
    if ((beat * 7 + bar * 3) % 11 === 0) play.tick(.008);
    if (beat === 0 && bar % 4 === 0) play.tone(146.83, 2.4, 'sine', .01);
  } },
  restaurant: { bpm: 96, bed: { type: 'bandpass', frequency: 700, level: .04, wobble: .6 }, step(play, step, bar) {
    const beat = step % 16; // dining-room murmur with a gentle highlife figure
    if ([0, 3, 6, 8, 11, 14].includes(beat)) play.pluck(A_MINOR[(bar + beat * 2) % 7], .14, .018);
    if (beat % 8 === 4) play.shaker(.008);
    if (beat === 0) play.tone([110, 98, 87.31, 98][bar % 4], .5, 'triangle', .026);
    if ((beat + bar * 5) % 13 === 0) play.clink(.01);
  } },
  market: { bpm: 104, bed: { type: 'bandpass', frequency: 1100, level: .06, wobble: 1.1 }, step(play, step, bar) {
    const beat = step % 16; // busy crowd with a shaker and talking-drum style bounce
    if (beat % 2 === 0) play.shaker(.012);
    if ([0, 3, 7, 10].includes(beat)) play.drum([150, 190, 130, 170][(beat + bar) % 4], .02);
    if (beat === 12 && bar % 4 === 1) play.horn(.012);
  } },
  park: { bpm: 60, bed: { type: 'highpass', frequency: 1800, level: .014, wobble: .25 }, step(play, step, bar) {
    const beat = step % 16; // open air: birds and a breeze
    if ((beat * 5 + bar * 7) % 9 === 0) play.chirp(.016);
    if (beat === 0 && bar % 3 === 0) play.tone(196, 2, 'sine', .01);
  } },
  gym: { bpm: 122, bed: { type: 'lowpass', frequency: 300, level: .02 }, step(play, step, bar) {
    const beat = step % 16; // driving but restrained workout beat
    if (beat % 4 === 0) play.kick(.16);
    if (beat % 4 === 2) play.hat(.014);
    if (beat === 4 || beat === 12) play.snare(.035);
    if ([0, 3, 6, 10].includes(beat)) play.tone([55, 55, 65.41, 49][bar % 4], .16, 'sawtooth', .03);
  } },
  lounge: { bpm: 88, bed: { type: 'bandpass', frequency: 600, level: .03, wobble: .4 }, step(play, step, bar) {
    const beat = step % 16; // low-key room: soft keys and a slow pulse
    if (beat === 0) for (const note of [[220, 277.18, 329.63], [196, 246.94, 293.66]][bar % 2]) play.tone(note, 1.2, 'triangle', .012);
    if (beat % 8 === 4) play.hat(.006);
  } },
  club: { bpm: 104, bed: { type: 'bandpass', frequency: 800, level: .055, wobble: 1.4 }, step(play, step, bar) {
    const beat = step % 16; // original Afrobeats-style club groove with a crowd underneath
    if ([0, 3, 6, 10, 12].includes(beat)) play.kick(.3);                                   // syncopated kick
    if (beat === 4 || beat === 12) { play.snare(.06); play.rim(.03); }
    play.shaker(beat % 2 ? .012 : .02);                                                    // constant 16ths
    if ([2, 7, 11, 14].includes(beat)) play.drum([196, 174.61, 220, 164.81][(bar + beat) % 4], .05);  // conga
    if ([0, 3, 8, 11].includes(beat)) play.log([55, 55, 65.41, 49][bar % 4], .12);          // log-drum bass
    if (beat === 6 || beat === 14) for (const note of [[220, 261.63, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [164.81, 207.65, 246.94]][bar % 4]) play.tone(note * 2, .14, 'sawtooth', .012);
    if (bar % 8 === 7 && beat >= 12) play.hat(.03);                                        // fill into the next phrase
    if (beat === 0 && bar % 4 === 0) play.cheer(.02);
  } },
});

/** Short, quiet effects. `haptic` is a vibration pattern used where the device supports it. */
export const EFFECTS = Object.freeze({
  coin: { notes: [[880, 0, .09], [1318.5, .07, .16]], type: 'triangle', level: .1, haptic: [12] },
  success: { notes: [[523.25, 0, .1], [659.25, .09, .1], [783.99, .18, .2]], type: 'triangle', level: .09, haptic: [10, 40, 16] },
  purchase: { notes: [[392, 0, .08], [329.63, .08, .14]], type: 'sine', level: .08, haptic: [10] },
  door: { notes: [[196, 0, .06], [146.83, .05, .12]], type: 'sine', level: .07 },
  notify: { notes: [[659.25, 0, .08], [880, .1, .14]], type: 'sine', level: .07, haptic: [8] },
  tap: { notes: [[1046.5, 0, .03]], type: 'sine', level: .04 },
  error: { notes: [[220, 0, .1], [185, .1, .16]], type: 'triangle', level: .07, haptic: [20, 30, 20] },
});

export function createAudioDirector({ AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext, storage = globalThis.localStorage, documentRef = globalThis.document,
  setTimer = (fn, ms) => setInterval(fn, ms), clearTimer = id => clearInterval(id), vibrate = pattern => globalThis.navigator?.vibrate?.(pattern), onState = () => {} } = {}) {
  let prefs = readAudioPrefs(storage), context = null, master = null, musicBus = null, effectsBus = null, noise = null;
  let unlocked = false, hidden = false, allowed = true, ducked = false, wanted = null, current = null, timer = null, disposed = false, startCount = 0;
  const fading = new Set();

  const state = () => ({ ...prefs, unlocked, scene: current?.key || null, wanted, playing: Boolean(current) && !prefs.muted && unlocked && !hidden && allowed, voices: (current ? 1 : 0) + fading.size, starts: startCount });
  const emit = () => { const snapshot = state(); try { onState(snapshot); } catch {} try { globalThis.dispatchEvent?.(new CustomEvent('abj:audio-state', { detail: snapshot })); } catch {} return snapshot; };
  const audible = () => unlocked && !hidden && allowed && !prefs.muted && !disposed;
  function applyLevels() {
    if (!context) return;
    const t = context.currentTime;
    master.gain.setTargetAtTime(prefs.muted ? 0 : 1, t, .05);
    musicBus.gain.setTargetAtTime(prefs.music * (ducked ? AUDIO_RULES.duckLevel : 1), t, .12);
    effectsBus.gain.setTargetAtTime(prefs.effects, t, .05);
  }
  function ensureContext() {
    if (context || !AudioContextClass || disposed) return Boolean(context);
    context = new AudioContextClass(); master = context.createGain(); musicBus = context.createGain(); effectsBus = context.createGain();
    musicBus.connect(master); effectsBus.connect(master); master.connect(context.destination);
    // Two seconds of noise, reused by every bed, shaker, hat and crowd voice.
    const length = Math.floor(context.sampleRate * 2); noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0); let seed = 22222; for (let i = 0; i < length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823.5 - 1; }
    applyLevels(); return true;
  }

  function voices(bus) {
    const env = (node, at, attack, hold, peak) => { const gain = context.createGain(); gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + attack); gain.gain.exponentialRampToValueAtTime(.0001, at + attack + hold); node.connect(gain); gain.connect(bus); return gain; };
    const osc = (frequency, at, duration, type, peak, endFrequency) => { const o = context.createOscillator(); o.type = type; o.frequency.setValueAtTime(frequency, at); if (endFrequency) o.frequency.exponentialRampToValueAtTime(endFrequency, at + duration); const g = env(o, at, .008, duration, peak); o.onended = () => { o.disconnect(); g.disconnect(); }; o.start(at); o.stop(at + duration + .05); };
    const burst = (at, duration, peak, filterType, frequency, q = 1) => { const source = context.createBufferSource(); source.buffer = noise; const filter = context.createBiquadFilter(); filter.type = filterType; filter.frequency.value = frequency; filter.Q.value = q; source.connect(filter); const g = env(filter, at, .004, duration, peak); source.onended = () => { source.disconnect(); filter.disconnect(); g.disconnect(); }; source.start(at, Math.random() * 1.5); source.stop(at + duration + .05); };
    let at = 0;
    return {
      at(time) { at = time; },
      tone: (f, d, type = 'sine', level = .02) => osc(f, at, d, type, level),
      pluck: (f, d, level) => { osc(f, at, d, 'triangle', level); osc(f * 2, at, d * .5, 'sine', level * .35); },
      kick: level => osc(128, at, .22, 'sine', level, 42),
      log: (f, level) => osc(f * 2, at, .2, 'sine', level, f),
      drum: (f, level) => osc(f, at, .12, 'sine', level, f * .7),
      snare: level => { burst(at, .12, level, 'bandpass', 1900, .8); osc(190, at, .08, 'triangle', level * .6); },
      rim: level => osc(1400, at, .03, 'square', level),
      hat: level => burst(at, .035, level, 'highpass', 7200),
      shaker: level => burst(at, .05, level, 'bandpass', 5200, 1.4),
      tick: level => burst(at, .012, level, 'highpass', 3000),
      clink: level => { osc(2637, at, .05, 'sine', level); osc(3520, at + .02, .06, 'sine', level * .6); },
      chirp: level => { osc(2400, at, .07, 'sine', level, 3300); osc(2900, at + .1, .06, 'sine', level * .8, 3600); },
      cricket: level => { osc(4300, at, .018, 'square', level); osc(4300, at + .04, .018, 'square', level); },
      horn: level => { osc(415, at, .16, 'sawtooth', level); osc(523, at, .16, 'sawtooth', level * .7); },
      cheer: level => burst(at, .9, level, 'bandpass', 1500, .5),
    };
  }

  function start(key) {
    const scape = SOUNDSCAPES[key]; if (!scape || !ensureContext()) return null;
    const bus = context.createGain(), t = context.currentTime; bus.gain.setValueAtTime(.0001, t); bus.gain.exponentialRampToValueAtTime(1, t + AUDIO_RULES.fadeSeconds); bus.connect(musicBus);
    const voice = { key, bus, play: voices(bus), next: t + .08, step: 0, bed: null }; startCount++;
    if (scape.bed) {
      const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
      const filter = context.createBiquadFilter(); filter.type = scape.bed.type; filter.frequency.value = scape.bed.frequency; filter.Q.value = .7;
      const level = context.createGain(); level.gain.value = scape.bed.level; source.connect(filter); filter.connect(level); level.connect(bus);
      let lfo = null; if (scape.bed.wobble) { lfo = context.createOscillator(); const depth = context.createGain(); lfo.frequency.value = scape.bed.wobble; depth.gain.value = scape.bed.level * .45; lfo.connect(depth); depth.connect(level.gain); lfo.start(); }
      source.start(); voice.bed = { source, filter, level, lfo };
    }
    return voice;
  }
  function stop(voice) {
    if (!voice || !context) return;
    const t = context.currentTime; voice.bus.gain.cancelScheduledValues(t); voice.bus.gain.setValueAtTime(Math.max(.0001, voice.bus.gain.value), t); voice.bus.gain.exponentialRampToValueAtTime(.0001, t + AUDIO_RULES.fadeSeconds);
    fading.add(voice);
    const finish = () => { if (!fading.delete(voice)) return; try { voice.bed?.source.stop(); voice.bed?.lfo?.stop(); } catch {} voice.bus.disconnect(); };
    voice.release = setTimeout(finish, AUDIO_RULES.fadeSeconds * 1000 + 120); voice.finish = finish;
  }
  function schedule() {
    if (!current || !context || !audible()) return;
    const scape = SOUNDSCAPES[current.key], size = STEP(scape.bpm);
    if (current.next < context.currentTime - .5) current.next = context.currentTime + .05; // catch up after a pause instead of bursting
    while (current.next < context.currentTime + AUDIO_RULES.lookAhead) { current.play.at(current.next); scape.step(current.play, current.step, Math.floor(current.step / 16)); current.step++; current.next += size; }
  }
  function sync() {
    if (disposed) return emit();
    if (!audible()) { if (timer) { clearTimer(timer); timer = null; } if (context && context.state === 'running') context.suspend?.()?.catch?.(() => {}); return emit(); }
    if (!ensureContext()) return emit();
    if (context.state !== 'running') context.resume?.()?.catch?.(() => {});
    if (wanted !== (current?.key || null)) { if (current) stop(current); current = wanted ? start(wanted) : null; }
    applyLevels();
    if (current && !timer) timer = setTimer(schedule, AUDIO_RULES.tickMs);
    if (!current && timer) { clearTimer(timer); timer = null; }
    return emit();
  }

  const unlock = () => { if (unlocked || disposed) return; unlocked = true; sync(); };
  const onVisibility = () => { hidden = documentRef?.hidden === true; sync(); };
  const onHide = () => { hidden = true; sync(); }, onShow = () => { hidden = documentRef?.hidden === true; sync(); };
  if (documentRef?.addEventListener) {
    for (const type of ['pointerdown', 'keydown', 'touchend']) documentRef.addEventListener(type, unlock, { capture: true, passive: true });
    documentRef.addEventListener('visibilitychange', onVisibility);
    globalThis.addEventListener?.('pagehide', onHide); globalThis.addEventListener?.('pageshow', onShow);
    // A native shell reports its own lifecycle; honour it the same way.
    globalThis.addEventListener?.('abj:app-background', onHide); globalThis.addEventListener?.('abj:app-foreground', onShow);
  }

  return {
    getState: state,
    unlock,
    /** Sets the soundscape for where the player is. Idempotent: the same key never restarts the music. */
    setScene(key) { const next = key && SOUNDSCAPES[key] ? key : null; if (next === wanted) return state(); wanted = next; return sync(); },
    /** Lowers music under sheets and dialogs without stopping it. */
    setDucked(value) { if (ducked === Boolean(value)) return; ducked = Boolean(value); applyLevels(); },
    /** The account-level sound setting. Turning it off silences everything. */
    setAllowed(value) { if (allowed === (value !== false)) return state(); allowed = value !== false; return sync(); },
    setPrefs(next) { prefs = normalizeAudioPrefs({ ...prefs, ...next }); writeAudioPrefs(prefs, storage); return sync(); },
    toggleMute() { return this.setPrefs({ muted: !prefs.muted }); },
    effect(name) {
      const effect = EFFECTS[name]; if (!effect) return false;
      if (effect.haptic && allowed && !prefs.muted) { try { vibrate(effect.haptic); } catch {} }
      if (!audible() || !ensureContext() || prefs.effects <= 0) return false;
      const t = context.currentTime + .01;
      for (const [frequency, offset, duration] of effect.notes) { const o = context.createOscillator(), g = context.createGain(); o.type = effect.type; o.frequency.value = frequency; g.gain.setValueAtTime(.0001, t + offset); g.gain.exponentialRampToValueAtTime(effect.level, t + offset + .01); g.gain.exponentialRampToValueAtTime(.0001, t + offset + duration); o.connect(g); g.connect(effectsBus); o.onended = () => { o.disconnect(); g.disconnect(); }; o.start(t + offset); o.stop(t + offset + duration + .03); }
      return true;
    },
    dispose() {
      disposed = true; if (timer) clearTimer(timer); timer = null;
      for (const voice of [...fading]) { clearTimeout(voice.release); voice.finish?.(); }
      if (current) { try { current.bed?.source.stop(); current.bed?.lfo?.stop(); } catch {} current.bus.disconnect(); current = null; }
      if (documentRef?.removeEventListener) { for (const type of ['pointerdown', 'keydown', 'touchend']) documentRef.removeEventListener(type, unlock, { capture: true }); documentRef.removeEventListener('visibilitychange', onVisibility); }
      globalThis.removeEventListener?.('pagehide', onHide); globalThis.removeEventListener?.('pageshow', onShow); globalThis.removeEventListener?.('abj:app-background', onHide); globalThis.removeEventListener?.('abj:app-foreground', onShow);
      context?.close?.()?.catch?.(() => {}); context = null;
    },
  };
}

let shared = null;
/** The single director for the page. Created on first use, so importing this file plays nothing. */
export function audioDirector() { return shared ||= createAudioDirector(); }

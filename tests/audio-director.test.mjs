import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AUDIO_RULES, SOUNDSCAPES, EFFECTS, createAudioDirector, soundscapeFor, normalizeAudioPrefs, readAudioPrefs, writeAudioPrefs } from '../app/audio-director.js';

const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
function fakeAudio() {
  const stats = { contexts: 0, oscillators: 0, sources: 0, live: new Set(), closed: 0 };
  const node = extra => ({ connect() {}, disconnect() {}, ...extra });
  class Context {
    constructor() { stats.contexts++; this.currentTime = 0; this.sampleRate = 8000; this.state = 'suspended'; this.destination = node(); }
    createGain() { return node({ gain: param() }); }
    createBiquadFilter() { return node({ frequency: param(), Q: param(), type: '' }); }
    createOscillator() { stats.oscillators++; return node({ frequency: param(), type: '', start() {}, stop() {} }); }
    createBufferSource() { stats.sources++; const source = node({ buffer: null, loop: false, start() { if (this.loop) stats.live.add(this); }, stop() { stats.live.delete(this); } }); return source; }
    createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; stats.closed++; return Promise.resolve(); }
  }
  return { Context, stats };
}
function harness(options = {}) {
  const { Context, stats } = fakeAudio(), memory = new Map(), storage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
  const listeners = new Map(), doc = { hidden: false, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
  const timers = new Set(), buzz = [];
  const director = createAudioDirector({ AudioContextClass: Context, storage, documentRef: doc, setTimer: fn => { timers.add(fn); return fn; }, clearTimer: fn => timers.delete(fn), vibrate: pattern => buzz.push(pattern), ...options });
  return { director, stats, storage, memory, doc, listeners, timers, buzz, tick: () => { for (const fn of [...timers]) fn(); } };
}

test('every location has a soundscape and each one schedules real notes', () => {
  const places = [[{ kind: 'home' }, 'home'], [{ kind: 'visit' }, 'home'], [{ kind: 'public' }, 'street'], [{ kind: 'public', night: true }, 'street-night'], [{ kind: 'transit' }, 'drive'],
    [{ kind: 'venue', venueId: 'club' }, 'club'], [{ kind: 'venue', venueId: 'magic-city' }, 'club'], [{ kind: 'venue', venueId: 'club-cage', clubOpen: false }, 'lounge'],
    [{ kind: 'venue', venueId: 'gym' }, 'gym'], [{ kind: 'venue', venueId: 'restaurant' }, 'restaurant'], [{ kind: 'venue', venueId: 'cafe' }, 'restaurant'], [{ kind: 'venue', venueId: 'grocery' }, 'market'],
    [{ kind: 'venue', venueId: 'banex' }, 'market'], [{ kind: 'venue', venueId: 'park' }, 'park'], [{ kind: 'venue', venueId: 'jabi-lake' }, 'park'], [{ kind: 'venue', venueId: 'mosque' }, 'calm'],
    [{ kind: 'venue', venueId: 'church' }, 'calm'], [{ kind: 'venue', venueId: 'cinema' }, 'lounge'], [{ kind: 'venue', venueId: 'estate-office' }, 'office'], [{ kind: 'venue', venueId: 'something-new' }, 'office']];
  for (const [place, expected] of places) { assert.equal(soundscapeFor(place), expected, JSON.stringify(place)); assert.ok(SOUNDSCAPES[expected]); }
  for (const [key, scape] of Object.entries(SOUNDSCAPES)) {
    let notes = 0; const play = new Proxy({}, { get: () => () => { notes++; } });
    for (let step = 0; step < 16 * 8; step++) scape.step(play, step, Math.floor(step / 16));
    assert.ok(notes > 0, `${key} is not silent`); assert.ok(scape.bpm >= 50 && scape.bpm <= 130);
    assert.ok(!scape.bed || scape.bed.level <= .08, `${key} ambience bed stays subtle`);
  }
  assert.ok(Object.keys(EFFECTS).length >= 6); for (const effect of Object.values(EFFECTS)) assert.ok(effect.level <= .1, 'effects are quiet');
  const source = fs.readFileSync(new URL('../app/audio-director.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.mp3|\.ogg|\.wav|new Audio\(|fetch\(/, 'no recordings are downloaded or embedded');
});

test('nothing plays before the first touch, then the scene starts once', () => {
  const h = harness();
  h.director.setScene('street');
  assert.equal(h.stats.contexts, 0, 'no audio context before a user gesture'); assert.equal(h.director.getState().playing, false);
  h.listeners.get('pointerdown')();
  assert.equal(h.stats.contexts, 1); assert.deepEqual({ scene: h.director.getState().scene, playing: h.director.getState().playing }, { scene: 'street', playing: true });
  const before = h.stats.oscillators; h.tick(); assert.ok(h.stats.oscillators > before, 'the scheduler produces notes');
  h.director.setScene('street'); h.director.setScene('street'); h.listeners.get('keydown')();
  assert.equal(h.director.getState().starts, 1, 'the same scene never restarts'); assert.equal(h.stats.contexts, 1, 'one context for the whole session');
  h.director.dispose();
});

test('entering and leaving a club crossfades: at most one scene fading in and one fading out', async () => {
  const h = harness(); h.director.unlock(); h.director.setScene('street');
  h.director.setScene('club');
  assert.equal(h.director.getState().scene, 'club'); assert.equal(h.director.getState().voices, 2, 'street fades out while the club fades in');
  h.director.setScene('street');
  assert.equal(h.director.getState().scene, 'street'); assert.ok(h.director.getState().voices <= 3);
  await new Promise(resolve => setTimeout(resolve, AUDIO_RULES.fadeSeconds * 1000 + 250));
  assert.equal(h.director.getState().voices, 1, 'only the street remains after the fade');
  assert.equal(h.stats.live.size, 1, 'the club ambience bed was stopped, not left looping');
  h.director.setScene(null); await new Promise(resolve => setTimeout(resolve, AUDIO_RULES.fadeSeconds * 1000 + 250));
  assert.equal(h.director.getState().voices, 0); assert.equal(h.stats.live.size, 0); assert.equal(h.timers.size, 0, 'the scheduler stops when nothing is playing');
  h.director.dispose();
});

test('backgrounding the app stops sound; returning resumes the same scene without a restart', () => {
  const h = harness(); h.director.unlock(); h.director.setScene('club');
  const starts = h.director.getState().starts;
  h.doc.hidden = true; h.listeners.get('visibilitychange')();
  assert.equal(h.director.getState().playing, false); assert.equal(h.timers.size, 0, 'no scheduling in the background');
  const silent = h.stats.oscillators; h.tick(); assert.equal(h.stats.oscillators, silent);
  h.doc.hidden = false; h.listeners.get('visibilitychange')();
  assert.equal(h.director.getState().playing, true); assert.equal(h.director.getState().scene, 'club'); assert.equal(h.director.getState().starts, starts, 'resumed, not restarted');
  h.director.dispose();
});

test('mute, volumes and the account sound setting are respected and remembered', () => {
  const h = harness(); h.director.unlock(); h.director.setScene('home');
  assert.deepEqual(normalizeAudioPrefs(null), AUDIO_RULES.defaults); assert.deepEqual(normalizeAudioPrefs({ music: 9, effects: -3, muted: 'yes' }), { muted: false, music: 1, effects: 0 });
  h.director.setPrefs({ music: .25, effects: .5 });
  assert.deepEqual(readAudioPrefs(h.storage), { muted: false, music: .25, effects: .5 });
  assert.equal(h.director.effect('coin'), true); assert.deepEqual(h.buzz.at(-1), EFFECTS.coin.haptic);
  h.director.toggleMute();
  assert.equal(readAudioPrefs(h.storage).muted, true); assert.equal(h.director.getState().playing, false);
  const buzzes = h.buzz.length; assert.equal(h.director.effect('coin'), false, 'no effects while muted'); assert.equal(h.buzz.length, buzzes, 'and no vibration');
  // A new session starts with the saved choice.
  const again = createAudioDirector({ AudioContextClass: fakeAudio().Context, storage: h.storage, documentRef: { hidden: false, addEventListener() {}, removeEventListener() {} } });
  assert.equal(again.getState().muted, true); assert.equal(again.getState().music, .25); again.dispose();
  h.director.toggleMute(); assert.equal(h.director.getState().playing, true);
  h.director.setAllowed(false); assert.equal(h.director.getState().playing, false, 'the Settings sound switch silences everything'); assert.equal(h.director.effect('success'), false);
  h.director.setAllowed(true); assert.equal(h.director.getState().playing, true);
  assert.equal(h.director.effect('not-a-sound'), false);
  writeAudioPrefs({ music: .9 }, { setItem() { throw new Error('blocked'); } }); assert.deepEqual(readAudioPrefs({ getItem() { throw new Error('blocked'); } }), AUDIO_RULES.defaults);
  h.director.dispose(); assert.equal(h.stats.closed, 1);
});

test('devices without Web Audio stay silent without errors', () => {
  const director = createAudioDirector({ AudioContextClass: undefined, documentRef: { hidden: false, addEventListener() {}, removeEventListener() {} }, storage: null });
  director.unlock(); director.setScene('club'); assert.equal(director.effect('coin'), false); assert.equal(director.getState().scene, null); director.dispose();
});

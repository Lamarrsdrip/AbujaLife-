// A first appearance is saved with the account, never rerolled while rendering.
// Initial outfits remain free; purchases and appearance authorization stay in the store.
import { appearanceOptions } from './catalogue.mjs';

function secureRandomInt(max) {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure avatar randomness is unavailable');
  const limit = Math.floor(0x100000000 / max) * max, value = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % max;
}

export function variedAppearance({presentation, randomInt = secureRandomInt} = {}) {
  const choose = values => {
    const index = randomInt(values.length);
    if (!Number.isInteger(index) || index < 0 || index >= values.length) throw new RangeError('Invalid avatar random index');
    return values[index];
  };
  if (presentation !== undefined && !appearanceOptions.presentation.includes(presentation)) throw new RangeError('Unsupported avatar presentation');
  const gender = presentation ?? choose(['feminine','masculine']);
  const hair = gender === 'feminine'
    ? ['braids','bun','long','twists','locs','afro']
    : gender === 'masculine' ? ['crop','locs','afro','twists'] : ['crop','locs','afro','braids','bun','long','twists'];
  return {
    presentation: gender,
    skinTone: choose(appearanceOptions.skinTone),
    hair: choose(hair),
    top: choose(['forest','ochre']),
    body: choose(appearanceOptions.body),
    face: choose(appearanceOptions.face),
    facialHair: gender === 'masculine' ? choose(['none','none','none','beard']) : 'none',
    bottom: choose(appearanceOptions.bottom),
    shoes: choose(appearanceOptions.shoes),
    accessory: choose(['none','none','none','glasses'])
  };
}

// Authored ambient citizens keep their identity on remount; they are not accounts.
export function ambientAppearance(identity) {
  let state = 2166136261;
  for (const char of String(identity)) { state ^= char.charCodeAt(0); state = Math.imul(state,16777619) >>> 0; }
  return variedAppearance({randomInt(max) {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) % max;
  }});
}

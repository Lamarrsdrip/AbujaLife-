import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Sound used to be opt-in per scene. It is now part of the world: on after the
// first touch, with the HUD button acting as a remembered mute. The director's
// behaviour is covered in audio-director.test.mjs; this file guards the wiring.
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('each scene hands its soundscape to the shared director instead of owning a synth', () => {
  const handle = read('app/world-audio.js'), sim = read('app/world-simulator.js');
  assert.match(handle, /import \{ audioDirector \} from '\.\/audio-director\.js';/);
  assert.doesNotMatch(handle, /new (?:Audio|webkitAudio)Context|createOscillator/, 'no second audio graph per scene');
  assert.match(handle, /director\.setScene\(open \? scene : closedScene\)/); assert.match(handle, /director\.setDucked\(!active\)/);
  assert.match(sim, /scene:preview\?null:soundscapeFor\(\{kind:trip\?'transit':kind,venueId:venue\?\.id,venueKind:venue\?\.kind,night:abujaTime\(now\(\)\)\.isNight\}\)/, 'the login preview stays silent');
  assert.match(sim, /sound\.setActive\(!blocked,!isClub\|\|clubSchedule\(currentNow\)\.isOpen\);/, 'a closed club plays the quiet room, an open sheet ducks the music');
  assert.match(sim, /enabled:profile\.settings\?\.soundEnabled!==false/, 'the account sound setting still applies');
});

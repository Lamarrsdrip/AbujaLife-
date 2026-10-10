// Sound controls and sound effects. The sheet (mute, music and effects volume) is
// opened from the Life menu; effects are tied to things that really happened:
// money arriving or leaving, changing place, finishing a gig or mission.
import { audioDirector } from './audio-director.js';

const sheetRoot = document.querySelector('#sheet-root'), director = audioDirector();
const percent = value => Math.round(value * 100);

export function openSoundSettings() {
  const state = director.getState();
  sheetRoot.innerHTML = `<div class="sheet-backdrop"><section class="sheet abj-sound" role="dialog" aria-modal="true" aria-labelledby="sound-title"><button class="sheet-close icon-button" data-sound-close aria-label="Close sound settings">×</button>
<span class="eyebrow">MAKE IT YOURS</span><h2 id="sound-title">Sound</h2>
<label class="sound-row sound-mute"><span><strong>Game sound</strong><small>Music, city ambience and effects</small></span><input type="checkbox" data-sound-on ${state.muted ? '' : 'checked'}></label>
<label class="sound-row"><span><strong>Music &amp; ambience</strong><small data-sound-label="music">${percent(state.music)}%</small></span><input type="range" min="0" max="100" step="5" value="${percent(state.music)}" data-sound-level="music" aria-label="Music and ambience volume"></label>
<label class="sound-row"><span><strong>Sound effects</strong><small data-sound-label="effects">${percent(state.effects)}%</small></span><input type="range" min="0" max="100" step="5" value="${percent(state.effects)}" data-sound-level="effects" aria-label="Sound effects volume"></label>
<p class="muted">Every sound in AbujaLife is original and made for the game. Your choices are saved on this device. Sound stops when you leave the app.</p></section></div>`;
  const close = () => sheetRoot.replaceChildren();
  sheetRoot.querySelector('[data-sound-close]').onclick = close;
  sheetRoot.querySelector('.sheet-backdrop').onclick = event => { if (event.target.classList.contains('sheet-backdrop')) close(); };
  sheetRoot.querySelector('[data-sound-on]').onchange = event => { director.unlock(); director.setPrefs({ muted: !event.target.checked }); };
  sheetRoot.querySelectorAll('[data-sound-level]').forEach(input => { input.oninput = () => { const key = input.dataset.soundLevel; director.setPrefs({ [key]: Number(input.value) / 100 }); sheetRoot.querySelector(`[data-sound-label="${key}"]`).textContent = `${input.value}%`; }; input.onchange = () => { if (input.dataset.soundLevel === 'effects') director.effect('tap'); }; });
}

function ensureLifeEntry() {
  const grid = sheetRoot?.querySelector('.life-menu-grid'); if (!grid || grid.querySelector('[data-abj-sound]')) return;
  const button = document.createElement('button'); button.dataset.abjSound = ''; button.className = 'abj-sound-entry';
  button.innerHTML = '<span aria-hidden="true">🔊</span><strong>Sound</strong><small>Music, ambience and effects</small>'; button.onclick = openSoundSettings; grid.append(button);
}
if (sheetRoot) new MutationObserver(ensureLifeEntry).observe(sheetRoot, { childList: true });
ensureLifeEntry();

// Effects from real state changes only.
let wallet = null, residentId = null, sceneKey = '';
addEventListener('abujalife:profile', event => {
  const profile = event.detail?.profile; if (!profile) return;
  director.setAllowed(profile.settings?.soundEnabled !== false);
  if (profile.id === residentId && Number.isSafeInteger(wallet) && Number.isSafeInteger(profile.wallet) && profile.wallet !== wallet) director.effect(profile.wallet > wallet ? 'coin' : 'purchase');
  residentId = profile.id; wallet = profile.wallet;
});
addEventListener('abujalife:world-mounted', event => {
  const data = event.detail?.container?.dataset, key = `${data?.sceneKind || ''}:${data?.sceneName || ''}`;
  if (sceneKey && key !== sceneKey && data?.sceneKind !== 'transit') director.effect('door');
  sceneKey = key;
  const profile = globalThis.__ABJ_WORLD__?.profile; if (profile && residentId === null) { residentId = profile.id; wallet = profile.wallet; }
});
addEventListener('abj:game-success', () => director.effect('success'));

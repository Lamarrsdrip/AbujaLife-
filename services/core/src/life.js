import { invariant } from './errors.js';
const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
export const applyNeedDecay = (needs, minutes) => ({
  hunger: clamp(needs.hunger - minutes * 0.20),
  energy: clamp(needs.energy - minutes * 0.13),
  hygiene: clamp(needs.hygiene - minutes * 0.10),
  social: clamp(needs.social - minutes * 0.08)
});
const ACTIONS = {
  eat: { hunger: +36, energy: +3 },
  sleep: { energy: +58, hunger: -8 },
  shower: { hygiene: +65 },
  socialize: { social: +38, energy: -3 }
};
export const performLifeAction = (needs, action) => {
  const effect = ACTIONS[action];
  invariant(effect, 'UNKNOWN_LIFE_ACTION', 'Unknown life action.');
  const next = { ...needs };
  for (const [key, delta] of Object.entries(effect)) next[key] = clamp(next[key] + delta);
  return next;
};

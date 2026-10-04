import crypto from 'node:crypto';

const START = Object.freeze({
  wallet: 26000,
  energy: 82,
  hunger: 72,
  hygiene: 88,
  social: 58,
  mood: 76,
  reputation: 4,
  district: 'wuse-ii-a07',
  home: 'Wuse starter studio',
  job: null,
  lastActionAt: Date.now()
});

const jobs = {
  'junior-dev': { title: 'Junior Developer', district: 'wuse-ii-a07', pay: 8500, energy: 18, skill: 'Tech' },
  'media-assistant': { title: 'Media Assistant', district: 'garki-ii', pay: 6200, energy: 15, skill: 'Media' },
  'property-agent': { title: 'Property Agent', district: 'jabi', pay: 9800, energy: 20, skill: 'Sales' },
  'site-supervisor': { title: 'Site Supervisor', district: 'guzape', pay: 11000, energy: 24, skill: 'Construction' },
  'restaurant-host': { title: 'Restaurant Host', district: 'wuse-ii-a07', pay: 5600, energy: 14, skill: 'Hospitality' }
};

const profiles = new Map();
const seenReceipts = new Set();

export function getOrCreateProfile(id='demo') {
  if (!profiles.has(id)) profiles.set(id, structuredClone(START));
  return structuredClone(profiles.get(id));
}

function save(id, next) { profiles.set(id, structuredClone(next)); return structuredClone(next); }
function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

export function applyAction(id, action, payload={}) {
  const s = getOrCreateProfile(id);
  const now = Date.now();
  const elapsedMins = Math.max(0, (now - s.lastActionAt) / 60000);
  if (elapsedMins > 0.2) {
    s.energy = clamp(s.energy - elapsedMins * .16);
    s.hunger = clamp(s.hunger - elapsedMins * .19);
    s.social = clamp(s.social - elapsedMins * .08);
  }

  switch (action) {
    case 'eat':
      if (s.wallet < 2200) throw new Error('Not enough Abuja Naira');
      s.wallet -= 2200; s.hunger = clamp(s.hunger + 34); s.mood = clamp(s.mood + 4); break;
    case 'sleep':
      s.energy = clamp(s.energy + 46); s.hunger = clamp(s.hunger - 9); break;
    case 'shower':
      s.hygiene = clamp(s.hygiene + 42); s.mood = clamp(s.mood + 2); break;
    case 'hangout':
      if (s.wallet < 3500) throw new Error('Not enough Abuja Naira');
      s.wallet -= 3500; s.social = clamp(s.social + 34); s.mood = clamp(s.mood + 9); break;
    case 'travel':
      s.district = String(payload.district || s.district); s.energy = clamp(s.energy - 3); break;
    case 'take-job': {
      const job = jobs[payload.jobId]; if (!job) throw new Error('Unknown job'); s.job = payload.jobId; break;
    }
    case 'work-shift': {
      if (!s.job || !jobs[s.job]) throw new Error('Take a job first');
      const job = jobs[s.job];
      if (s.energy < job.energy) throw new Error('You need more energy before this shift');
      s.energy = clamp(s.energy - job.energy); s.hunger = clamp(s.hunger - 12); s.wallet += job.pay; s.reputation += 1; s.mood = clamp(s.mood + 3); break;
    }
    case 'topup': {
      if (!payload.verified) throw new Error('Payment must be verified by server');
      const receipt = String(payload.receipt || '');
      if (!receipt) throw new Error('Missing receipt');
      if (seenReceipts.has(receipt)) return s;
      const amount = Number(payload.amount || 0);
      if (!Number.isInteger(amount) || amount < 1000 || amount > 5_000_000) throw new Error('Invalid amount');
      seenReceipts.add(receipt); s.wallet += amount; break;
    }
    default: throw new Error('Unknown action');
  }
  s.lastActionAt = now;
  return save(id, s);
}

export function resetProfile(id='demo') { profiles.set(id, structuredClone(START)); return getOrCreateProfile(id); }
export { jobs };

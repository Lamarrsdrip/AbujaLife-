// City Moments: small, time-aware things that happen in a resident's Abuja day.
//
// A friend asks you out to a club at night, Friday prayers at midday, a cousin
// across town wants a visit, rain keeps you indoors, rush hour pays drivers
// more. Each moment belongs to a four-hour block of the Abuja day, is chosen
// deterministically for the resident (so the phone and the server always agree)
// and only appears when it makes sense: the hour, the weekday, the weather, a
// job, a car. Progress counts only real, server-validated actions (the same
// event stream as Today's Hustle) and rewards are claimed explicitly through
// the ledger. Nothing is random at claim time and nothing can be bought.
import { abujaTime, seasonalWeather } from './simulation.mjs';
import { vehicleFor } from './vehicles.mjs';

const HOUR = 3_600_000, BLOCK_HOURS = 4;
export const MOMENT_RULES = Object.freeze({ version: 1, perBlock: 2, claimGraceMs: 2 * HOUR, keep: 6 });
export const MOMENT_ACTIONS = new Set(['moment-claim']);

const CLUBS = new Set(['club', 'club-cage', 'magic-city']);
const FOOD = /jollof|suya|egusi|meal|food|dining|coffee|popcorn|picnic|groceries|chop|drink/;
const FIT = /gym|workout|train|recovery|exercise/;
const COUSIN_DISTRICTS = ['jabi', 'wuse-ii-a07', 'garki-ii', 'maitama', 'asokoro', 'gwarinpa', 'utako', 'kubwa', 'lugbe', 'central-area'];
const DISTRICT_NAMES = { jabi: 'Jabi', 'wuse-ii-a07': 'Wuse II', 'garki-ii': 'Garki II', maitama: 'Maitama', asokoro: 'Asokoro', gwarinpa: 'Gwarinpa', utako: 'Utako', kubwa: 'Kubwa', lugbe: 'Lugbe', 'central-area': 'Central Area' };
const FRIENDS = ['Ada', 'Tunde', 'Zainab', 'Emeka', 'Halima', 'Kelechi', 'Bisi', 'Musa', 'Chioma', 'Sadiq'];

const inHours = (hour, from, to) => from <= to ? hour >= from && hour < to : hour >= from || hour < to;
const ownsCar = profile => (profile.inventory || []).some(id => Boolean(vehicleFor(id)));

/**
 * Templates. `when(ctx)` decides eligibility; `match(event, params)` decides
 * whether a validated action counts. `params(ctx, pick)` fixes per-moment
 * details (a friend's name, a district) at the moment it is dealt.
 */
export const MOMENT_TEMPLATES = Object.freeze([
  { id: 'night-invite', icon: '🪩', from: 'friend', goal: 1, naira: 45_000, rep: 25,
    when: c => inHours(c.hour, 19, 2), params: (c, pick) => ({ friend: pick(FRIENDS) }),
    title: p => `${p.friend} is out tonight`, body: p => `${p.friend}: "The DJ at Tokyo is on fire. Show face for one hour now!" Any club counts.`,
    target: { venueId: 'club', label: 'Tokyo' },
    match: e => (e.type === 'enter-venue' && CLUBS.has(e.venueId)) || (e.type === 'venue-activity' && CLUBS.has(e.venueId)) },
  { id: 'suya-run', icon: '🍢', from: 'friend', goal: 1, naira: 30_000, rep: 15,
    when: c => inHours(c.hour, 17, 23), params: (c, pick) => ({ friend: pick(FRIENDS) }),
    title: () => 'Suya run', body: p => `${p.friend}: "Abeg, suya and small chops? My treat if you come out." Buy food anywhere in town.`,
    target: { venueId: 'bear-barn', label: 'Bear Barn' },
    match: e => e.type === 'venue-activity' && FOOD.test(e.activityId) },
  { id: 'morning-burn', icon: '🏃', from: 'coach', goal: 1, naira: 35_000, rep: 20,
    when: c => inHours(c.hour, 5, 10), title: () => 'Morning burn', body: () => 'Form & Motion: early sessions are half empty. Get a workout in before the city wakes up.',
    target: { venueId: 'gym', label: 'Form & Motion gym' },
    match: e => e.type === 'exercise' || (e.type === 'venue-activity' && FIT.test(e.activityId)) },
  { id: 'jumuah', icon: '🕌', from: 'community', goal: 1, naira: 20_000, rep: 30,
    when: c => c.dayIndex === 5 && inHours(c.hour, 11, 15), title: () => 'Jumu\'ah', body: () => 'Friday prayers at the mosque. The whole neighbourhood will be there.',
    target: { venueId: 'mosque', label: 'Neighbourhood Mosque' },
    match: e => e.type === 'enter-venue' && /mosque/.test(e.venueId) },
  { id: 'sunday-service', icon: '⛪', from: 'community', goal: 1, naira: 20_000, rep: 30,
    when: c => c.dayIndex === 0 && inHours(c.hour, 7, 13), title: () => 'Sunday service', body: () => 'Service has started at the church. Your people are asking for you.',
    target: { venueId: 'church', label: 'Community Church' },
    match: e => e.type === 'enter-venue' && /church|christian/.test(e.venueId) },
  { id: 'rain-in', icon: '🌧️', from: 'weather', goal: 1, naira: 15_000, rep: 10,
    when: c => c.rain && c.hasHome, title: () => 'Rain don start', body: () => 'Heavy rain over Abuja. Stay dry: rest or sleep at home for a bit.',
    target: { home: true, label: 'Home' },
    match: e => e.type === 'relax' || e.type === 'sleep' },
  { id: 'cousin-visit', icon: '🏡', from: 'family', goal: 1, naira: 50_000, rep: 30,
    when: c => inHours(c.hour, 9, 19), params: (c, pick) => ({ district: pick(COUSIN_DISTRICTS.filter(id => id !== c.district)) }),
    title: p => `Your cousin in ${DISTRICT_NAMES[p.district] || p.district}`, body: p => `"Long time! Come and see us in ${DISTRICT_NAMES[p.district] || p.district} today." Travel there by any means.`,
    target: p => ({ district: p.district, label: DISTRICT_NAMES[p.district] || p.district }),
    match: (e, p) => e.type === 'travel' && e.district === p.district },
  { id: 'rush-hour', icon: '🚕', from: 'dispatch', goal: 2, naira: 90_000, rep: 40,
    when: c => (inHours(c.hour, 7, 10) || inHours(c.hour, 16, 20)) && c.dayIndex >= 1 && c.dayIndex <= 5, title: () => 'Rush hour pays', body: () => 'Dispatch: requests are piling up. Finish two street gigs this block for a rush bonus.',
    target: { gig: true, label: 'Street gigs' },
    match: e => e.type === 'gig' },
  { id: 'market-day', icon: '🧺', from: 'neighbour', goal: 1, naira: 25_000, rep: 15,
    when: c => c.dayIndex === 6 && inHours(c.hour, 8, 18), title: () => 'Saturday market', body: () => 'Mama Nkechi: "Fresh tomatoes just came in. Buy something at the market before they finish."',
    target: { venueId: 'grocery', label: 'Fresh Market' },
    match: e => (e.type === 'venue-activity' && (/grocery|market/.test(e.venueId) || FOOD.test(e.activityId))) || e.type === 'purchase' },
  { id: 'lake-sunset', icon: '🌅', from: 'friend', goal: 1, naira: 30_000, rep: 20,
    when: c => inHours(c.hour, 15, 19) && !c.rain, params: (c, pick) => ({ friend: pick(FRIENDS) }),
    title: () => 'Sunset at Jabi Lake', body: p => `${p.friend}: "The lake is beautiful this evening. Come and catch the sunset."`,
    target: { venueId: 'jabi-lake', label: 'Jabi Lake' },
    match: e => (e.type === 'enter-venue' || e.type === 'venue-activity') && e.venueId === 'jabi-lake' },
  { id: 'boss-check', icon: '💼', from: 'work', goal: 1, naira: 60_000, rep: 30,
    when: c => c.hasJob && c.dayIndex >= 1 && c.dayIndex <= 5 && inHours(c.hour, 8, 17), title: () => 'The boss is counting heads', body: () => 'Your manager is in today. Finish a shift and be seen.',
    target: { job: true, label: 'Your job' },
    match: e => e.type === 'shift' },
  { id: 'fresh-cut', icon: '💈', from: 'friend', goal: 1, naira: 20_000, rep: 10,
    when: c => (c.dayIndex === 4 || c.dayIndex === 5) && inHours(c.hour, 9, 20), params: (c, pick) => ({ friend: pick(FRIENDS) }),
    title: () => 'Fresh for the weekend', body: p => `${p.friend}: "Weekend is coming. Freshen up first: salon or a proper shower."`,
    target: { venueId: 'salon', label: 'Fresh Studio' },
    match: e => e.type === 'shower' || (e.type === 'venue-activity' && /salon/.test(e.venueId)) },
  { id: 'movie-date', icon: '🎬', from: 'friend', goal: 1, naira: 35_000, rep: 20,
    when: c => inHours(c.hour, 16, 23), params: (c, pick) => ({ friend: pick(FRIENDS) }),
    title: () => 'Movie night', body: p => `${p.friend}: "New film at the cinema tonight. You dey come?"`,
    target: { venueId: 'cinema', label: 'The Screen' },
    match: e => e.type === 'cinema' || (e.type === 'venue-activity' && /cinema|film|screening/.test(`${e.venueId} ${e.activityId}`)) },
  { id: 'cruise', icon: '🚗', from: 'friend', goal: 1, naira: 40_000, rep: 20,
    when: c => c.hasCar && inHours(c.hour, 10, 22), params: (c, pick) => ({ friend: pick(FRIENDS) }),
    title: () => 'Show off the ride', body: p => `${p.friend}: "I hear say you get new whip. Drive come Wuse make we see am." Any trip by car counts.`,
    target: { label: 'Your car' },
    match: e => e.type === 'travel' && e.mode === 'car' },
]);
const templateById = new Map(MOMENT_TEMPLATES.map(t => [t.id, t]));

// FNV-1a with an avalanche finish, as in daily-hustle.mjs.
function hash(text) { let n = 2166136261; for (const c of String(text)) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } n ^= n >>> 16; n = Math.imul(n, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return n >>> 0; }

export class MomentError extends Error { constructor(message, code = 'invalid_moment_action', status = 409) { super(message); this.code = code; this.status = status; } }
const check = (value, message, code) => { if (!value) throw new MomentError(message, code); };

/** The block of the Abuja day `now` falls in, with its start and end times. */
export function momentBlock(now) {
  const time = abujaTime(now), block = Math.floor(time.hour / BLOCK_HOURS);
  const midnight = Date.parse(`${time.dateKey}T00:00:00+01:00`), startsAt = midnight + block * BLOCK_HOURS * HOUR;
  return { key: `${time.dateKey}:${block}`, startsAt, endsAt: startsAt + BLOCK_HOURS * HOUR, time };
}

export function momentContext(profile = {}, now = Date.now()) {
  const time = abujaTime(now), weather = seasonalWeather(now);
  return { hour: time.hour, dayIndex: time.dayIndex, rain: weather?.condition === 'rain', district: String(profile.district || ''),
    hasHome: Boolean(profile.home), hasJob: Boolean(profile.job), hasCar: ownsCar(profile) };
}

/** The moments this resident is dealt for the block containing `now`. Deterministic. */
export function dealMoments(profile, now) {
  const { key, endsAt } = momentBlock(now), ctx = momentContext(profile, now);
  const eligible = MOMENT_TEMPLATES.filter(t => t.when(ctx));
  const order = eligible.map(t => ({ t, rank: hash(`${profile.id}:${key}:${t.id}`) })).sort((a, b) => a.rank - b.rank);
  return order.slice(0, MOMENT_RULES.perBlock).map(({ t, rank }) => {
    let n = rank; const pick = list => list[(n = hash(`${n}`)) % list.length];
    return { id: `${key}:${t.id}`, templateId: t.id, block: key, params: t.params ? t.params(ctx, pick) : {}, progress: 0, claimed: false, expiresAt: endsAt };
  });
}

/** Rolls `profile.moments` forward to the current block. Mutates and returns it. */
export function ensureMoments(profile, now) {
  const { key } = momentBlock(now), current = profile.moments;
  if (current?.block === key) return current;
  // Finished-but-unclaimed moments stay collectable for a short grace period.
  const carried = (current?.list || []).filter(m => m.progress >= (templateById.get(m.templateId)?.goal || 1) && !m.claimed && now < m.expiresAt + MOMENT_RULES.claimGraceMs);
  profile.moments = { block: key, list: [...carried, ...dealMoments(profile, now)].slice(-MOMENT_RULES.keep), claimedTotal: current?.claimedTotal || 0 };
  return profile.moments;
}

/** Called with the same validated event Today's Hustle receives. */
export function recordMomentProgress(profile, event, now) {
  if (!event || !profile?.id) return;
  const state = ensureMoments(profile, now);
  for (const row of state.list) {
    const template = templateById.get(row.templateId);
    if (!template || row.claimed || row.progress >= template.goal || now >= row.expiresAt) continue;
    if (template.match(event, row.params || {})) row.progress += 1;
  }
}

function present(row, now) {
  const t = templateById.get(row.templateId); if (!t) return null;
  const params = row.params || {}, target = typeof t.target === 'function' ? t.target(params) : t.target || {};
  const done = row.progress >= t.goal, expired = !done && now >= row.expiresAt, lapsed = done && !row.claimed && now >= row.expiresAt + MOMENT_RULES.claimGraceMs;
  return { id: row.id, templateId: t.id, icon: t.icon, from: t.from, title: t.title(params), body: t.body(params), goal: t.goal, progress: Math.min(row.progress, t.goal),
    naira: t.naira, rep: t.rep, done, claimed: row.claimed, expired: expired || lapsed, expiresAt: row.expiresAt, target };
}

/** What the phone shows. Uses the stored block when current, else the deal it will get. */
export function momentsView(profile = {}, now = Date.now()) {
  const { key, endsAt } = momentBlock(now), stored = profile.moments?.block === key ? profile.moments.list : [...(profile.moments?.list || []).filter(m => !m.claimed && now < m.expiresAt + MOMENT_RULES.claimGraceMs), ...(profile.id ? dealMoments(profile, now) : [])];
  const moments = stored.map(row => present(row, now)).filter(Boolean).filter(m => !m.expired || m.claimed);
  return { block: key, endsAt, moments, ready: moments.filter(m => m.done && !m.claimed).length };
}

/** Runs inside a store's existing atomic economy operation. */
export function applyMomentAction(profile, action, payload = {}, { now }) {
  check(MOMENT_ACTIONS.has(action), 'Unknown action.', 'invalid_moment_action');
  const state = ensureMoments(profile, now), row = state.list.find(item => item.id === payload.momentId), t = row && templateById.get(row.templateId);
  check(t, 'That moment has passed.', 'moment_unknown');
  check(row.progress >= t.goal, 'Finish this first, then collect.', 'moment_not_done');
  check(!row.claimed, 'You already collected this.', 'moment_claimed');
  check(now < row.expiresAt + MOMENT_RULES.claimGraceMs, 'This one has expired. New moments come every few hours.', 'moment_expired');
  check(Number.isSafeInteger(profile.wallet + t.naira), 'This reward cannot be represented as exact whole Naira.', 'numeric_limit');
  row.claimed = true; state.claimedTotal = (state.claimedTotal || 0) + 1;
  profile.wallet += t.naira; profile.rep = { xp: (profile.rep?.xp || 0) + t.rep };
  const label = `City moment · ${t.title(row.params || {})}`;
  return { moments: momentsView(profile, now), reward: { naira: t.naira, rep: t.rep, label }, ledgerReason: label, ledgerType: 'OTHER_GAME_INCOME' };
}

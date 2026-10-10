// Today's Hustle: three daily missions, an Abuja Rep level and a 7-day check-in
// streak. Missions progress only from real, server-validated actions (gigs,
// shifts, venue activities, travel). Rewards are claimed explicitly and paid
// through the ledger like any other income. Shared so the phone can present the
// same day the server will honour.
import { abujaTime } from './simulation.mjs';

const DAY = 86_400_000;
export const HUSTLE_RULES = Object.freeze({
  version: 1,
  bonus: Object.freeze({ naira: 150_000, rep: 80 }),
  gigRep: 5, shiftRep: 15,
  swapsPerDay: 1,
  // Seven-day check-in. Missing a day restarts at day one; nothing is ever taken away.
  streak: Object.freeze([
    { naira: 50_000, rep: 10 }, { naira: 60_000, rep: 10 }, { naira: 80_000, rep: 15 }, { naira: 100_000, rep: 20 },
    { naira: 130_000, rep: 25 }, { naira: 170_000, rep: 30 }, { naira: 300_000, rep: 100 },
  ]),
});
export const REP_LEVELS = Object.freeze([
  { level: 1, xp: 0, title: 'JJC' }, { level: 2, xp: 100, title: 'Street Smart' }, { level: 3, xp: 250, title: 'Correct Person' },
  { level: 4, xp: 500, title: 'Area Regular' }, { level: 5, xp: 900, title: 'Abuja Insider' }, { level: 6, xp: 1500, title: 'City Mover' },
  { level: 7, xp: 2400, title: 'Capital Boss' }, { level: 8, xp: 3600, title: 'Abuja Legend' },
]);
export function repLevel(xp = 0) {
  const value = Math.max(0, Math.floor(Number(xp) || 0));
  const current = [...REP_LEVELS].reverse().find(row => value >= row.xp), next = REP_LEVELS.find(row => row.xp > value) || null;
  return { xp: value, level: current.level, title: current.title, next: next ? { level: next.level, title: next.title, xp: next.xp, remaining: next.xp - value } : null };
}

const FOOD = /jollof|suya|egusi|meal|food|dining|coffee|popcorn|picnic|groceries/;
const NIGHT = /club|dance|vip|drinks|refreshment|stage|magic-city|cage|bear-barn|tokyo/;
const FIT = /gym|workout|train|recovery|exercise/;
const CULTURE = /film|cinema|screening|workshop|arcade|rides|pool|play|hangout|social/;
// A mission counts events; `when(event)` decides whether an event counts.
export const HUSTLE_MISSIONS = Object.freeze([
  { id: 'eat-out', tier: 'easy', icon: '🍛', title: 'Chop something outside', hint: 'Buy a meal at any restaurant, café or market', goal: 1, naira: 30_000, rep: 20, when: e => e.type === 'venue-activity' && FOOD.test(e.activityId) },
  { id: 'step-out', tier: 'easy', icon: '🚪', title: 'Show face in town', hint: 'Enter any two places in the city', goal: 2, naira: 30_000, rep: 20, when: e => e.type === 'enter-venue' },
  { id: 'fresh', tier: 'easy', icon: '🫧', title: 'Look fresh today', hint: 'Freshen up at home or at the salon', goal: 1, naira: 25_000, rep: 15, when: e => e.type === 'shower' || (e.type === 'venue-activity' && /salon|shower/.test(e.activityId)) },
  { id: 'errand', tier: 'easy', icon: '🧺', title: 'Run one errand', hint: 'Finish any street gig', goal: 1, naira: 35_000, rep: 20, when: e => e.type === 'gig' },
  { id: 'night-out', tier: 'out', icon: '🪩', title: 'Have a night out', hint: 'Enjoy a club or lounge', goal: 1, naira: 60_000, rep: 35, when: e => e.type === 'venue-activity' && NIGHT.test(`${e.activityId} ${e.venueId}`) },
  { id: 'cross-town', tier: 'out', icon: '🛣️', title: 'Cross town', hint: 'Travel to another district', goal: 1, naira: 55_000, rep: 30, when: e => e.type === 'travel' },
  { id: 'keep-fit', tier: 'out', icon: '🏋️', title: 'Keep fit', hint: 'Work out at a gym or the stadium', goal: 1, naira: 50_000, rep: 30, when: e => e.type === 'exercise' || (e.type === 'venue-activity' && FIT.test(e.activityId)) },
  { id: 'enjoyment', tier: 'out', icon: '🎬', title: 'Small enjoyment', hint: 'Cinema, arcade, pool or a hangout', goal: 1, naira: 55_000, rep: 30, when: e => e.type === 'cinema' || e.type === 'hangout' || (e.type === 'venue-activity' && CULTURE.test(e.activityId)) },
  { id: 'gigs-3', tier: 'hustle', icon: '🚕', title: 'Three trips, no story', hint: 'Complete three street gigs', goal: 3, naira: 110_000, rep: 50, when: e => e.type === 'gig' },
  { id: 'rides-2', tier: 'hustle', icon: '🚘', title: 'Carry passengers', hint: 'Complete two ride requests in your car', goal: 2, naira: 120_000, rep: 55, when: e => e.type === 'gig' && e.kind === 'ride' },
  { id: 'shift', tier: 'hustle', icon: '💼', title: 'Clock in', hint: 'Complete a shift at your job', goal: 1, naira: 100_000, rep: 50, when: e => e.type === 'shift' },
  { id: 'deliveries-2', tier: 'hustle', icon: '📦', title: 'Deliver the goods', hint: 'Complete two deliveries or errands', goal: 2, naira: 100_000, rep: 50, when: e => e.type === 'gig' && e.kind !== 'ride' },
]);
export const HUSTLE_TIERS = Object.freeze(['easy', 'out', 'hustle']);
export const HUSTLE_ACTIONS = new Set(['hustle-claim', 'hustle-checkin', 'hustle-swap']);
export const HUSTLE_MONEY_ACTIONS = new Set(['hustle-claim', 'hustle-checkin']);
const missionById = new Map(HUSTLE_MISSIONS.map(mission => [mission.id, mission]));

export class HustleError extends Error {
  constructor(message, code = 'invalid_hustle_action', status = 409) { super(message); this.code = code; this.status = status; }
}
const check = (value, message, code) => { if (!value) throw new HustleError(message, code); };
// FNV-1a with a final avalanche: without it, similar dates pick the same mission day after day.
function hash(text) { let n = 2166136261; for (const c of String(text)) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } n ^= n >>> 16; n = Math.imul(n, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return n >>> 0; }
const dayNumber = dateKey => Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / DAY);

/** The same resident always gets the same three missions for a given Abuja day. */
export function missionsForDay(residentId, dateKey) {
  return HUSTLE_TIERS.map(tier => { const pool = HUSTLE_MISSIONS.filter(mission => mission.tier === tier); return pool[hash(`${residentId}:${dateKey}:${tier}`) % pool.length].id; });
}
/** Starts a new day when the date has changed. Mutates and returns profile.hustle. */
export function ensureHustleDay(profile, now) {
  const dateKey = abujaTime(now).dateKey, current = profile.hustle;
  if (current?.dateKey === dateKey) return current;
  profile.hustle = { dateKey, missions: missionsForDay(profile.id, dateKey).map(id => ({ id, progress: 0, claimed: false })), bonusClaimed: false, swaps: 0,
    streak: current?.streak || 0, checkedIn: current?.checkedIn || null };
  return profile.hustle;
}

/** Normalises a completed action into the event missions understand, or null. */
export function hustleEvent(kind, payload = {}, extra = {}) {
  if (kind === 'gig-complete' && extra.payout) return { type: 'gig', kind: extra.payout.kind };
  if (kind === 'complete-shift') return { type: 'shift' };
  if (kind === 'venue-action') return { type: 'venue-activity', activityId: String(payload.activityId || ''), venueId: String(payload.venueId || '') };
  if (kind === 'enter-venue') return { type: 'enter-venue', venueId: String(payload.venueId || '') };
  if (kind === 'travel' && payload.district) return { type: 'travel', district: String(payload.district) };
  if (['shower', 'exercise', 'cinema', 'hangout'].includes(kind)) return { type: kind };
  return null;
}
/** Called by both stores after an action succeeds, inside the same atomic operation. */
export function recordHustleProgress(profile, { kind, payload, extra, now }) {
  const event = hustleEvent(kind, payload, extra); if (!event) return;
  if (event.type === 'venue-activity' && !event.venueId) event.venueId = String(profile.location?.venue || '');
  const day = ensureHustleDay(profile, now);
  for (const row of day.missions) { const mission = missionById.get(row.id); if (mission && !row.claimed && row.progress < mission.goal && mission.when(event)) row.progress += 1; }
  const passive = event.type === 'gig' ? HUSTLE_RULES.gigRep : event.type === 'shift' ? HUSTLE_RULES.shiftRep : 0;
  if (passive) profile.rep = { xp: (profile.rep?.xp || 0) + passive };
}

export function hustleView(profile, now) {
  const dateKey = abujaTime(now).dateKey, stored = profile.hustle?.dateKey === dateKey ? profile.hustle : null;
  const rows = stored?.missions || missionsForDay(profile.id, dateKey).map(id => ({ id, progress: 0, claimed: false }));
  const missions = rows.map(row => { const m = missionById.get(row.id); return { id: m.id, tier: m.tier, icon: m.icon, title: m.title, hint: m.hint, goal: m.goal, naira: m.naira, rep: m.rep, progress: Math.min(row.progress, m.goal), done: row.progress >= m.goal, claimed: row.claimed }; });
  const lastDay = profile.hustle?.checkedIn ? dayNumber(profile.hustle.checkedIn) : null, today = dayNumber(dateKey), streak = profile.hustle?.streak || 0;
  const alive = lastDay !== null && today - lastDay <= 1, checkedInToday = lastDay === today, nextIndex = checkedInToday ? (streak - 1) % 7 : alive ? streak % 7 : 0;
  return { dateKey, rep: repLevel(profile.rep?.xp), missions, allDone: missions.every(m => m.done), bonus: { ...HUSTLE_RULES.bonus, claimed: Boolean(stored?.bonusClaimed) },
    swapsLeft: Math.max(0, HUSTLE_RULES.swapsPerDay - (stored?.swaps || 0)), streak: { days: alive || checkedInToday ? streak : 0, checkedInToday, nextDay: nextIndex + 1, reward: HUSTLE_RULES.streak[nextIndex], calendar: HUSTLE_RULES.streak } };
}

/** Shared by both stores inside their existing atomic economy operation. */
export function applyHustleAction(profile, action, payload = {}, { now }) {
  const p = profile; check(HUSTLE_ACTIONS.has(action), 'Unknown action.', 'invalid_hustle_action');
  const day = ensureHustleDay(p, now), dateKey = day.dateKey;
  const pay = (naira, rep, label) => { check(Number.isSafeInteger(p.wallet + naira), 'This reward cannot be represented as exact whole Naira.', 'numeric_limit'); p.wallet += naira; p.rep = { xp: (p.rep?.xp || 0) + rep }; return { hustle: hustleView(p, now), reward: { naira, rep, label }, ledgerReason: label, ledgerType: 'OTHER_GAME_INCOME' }; };
  if (action === 'hustle-checkin') {
    const last = day.checkedIn ? dayNumber(day.checkedIn) : null, today = dayNumber(dateKey);
    check(last !== today, 'You already checked in today. Come back tomorrow.', 'hustle_checked_in');
    day.streak = last !== null && today - last === 1 ? (day.streak || 0) + 1 : 1; day.checkedIn = dateKey;
    const reward = HUSTLE_RULES.streak[(day.streak - 1) % 7];
    return pay(reward.naira, reward.rep, `Daily check-in · day ${(day.streak - 1) % 7 + 1}`);
  }
  if (action === 'hustle-swap') {
    const row = day.missions.find(item => item.id === payload.missionId); check(row, 'That mission is not on today\'s list.', 'hustle_unknown_mission');
    check(!row.claimed && row.progress === 0, 'You already started this mission.', 'hustle_started'); check(day.swaps < HUSTLE_RULES.swapsPerDay, 'No swaps left today.', 'hustle_no_swaps');
    const tier = missionById.get(row.id).tier, taken = new Set(day.missions.map(item => item.id)), pool = HUSTLE_MISSIONS.filter(m => m.tier === tier && !taken.has(m.id));
    check(pool.length > 0, 'There is nothing to swap to.', 'hustle_no_swaps');
    row.id = pool[hash(`${p.id}:${dateKey}:${row.id}:swap`) % pool.length].id; row.progress = 0; day.swaps += 1;
    return { hustle: hustleView(p, now) };
  }
  // hustle-claim
  if (payload.missionId === 'bonus') {
    check(day.missions.every(row => row.progress >= missionById.get(row.id).goal), 'Finish all three missions first.', 'hustle_not_done'); check(!day.bonusClaimed, 'You already collected today\'s bonus.', 'hustle_claimed');
    day.bonusClaimed = true; return pay(HUSTLE_RULES.bonus.naira, HUSTLE_RULES.bonus.rep, 'Today\'s Hustle · all three done');
  }
  const row = day.missions.find(item => item.id === payload.missionId), mission = row && missionById.get(row.id);
  check(mission, 'That mission is not on today\'s list.', 'hustle_unknown_mission'); check(row.progress >= mission.goal, 'This mission is not finished yet.', 'hustle_not_done'); check(!row.claimed, 'You already collected this reward.', 'hustle_claimed');
  row.claimed = true; return pay(mission.naira, mission.rep, `Today's Hustle · ${mission.title}`);
}

// Player-needs coaching: when a need gets low the game says so once, in a human
// voice, with an action that leads somewhere real. Pure rules, no timers or DOM:
// the client asks `nextNeedNotice` what (if anything) to show.
const MINUTE = 60_000;
export const NEED_LEVELS = Object.freeze(['normal', 'attention', 'low', 'critical']);
// Higher is better for every need except stress, where rising is the problem.
export const NEEDS = Object.freeze({
  energy: { label: 'Energy', inverted: false, action: 'rest' },
  hunger: { label: 'Food', inverted: false, action: 'food' },
  fun: { label: 'Fun', inverted: false, action: 'fun' },
  social: { label: 'Social', inverted: false, action: 'social' },
  hygiene: { label: 'Cleanliness', inverted: false, action: 'clean' },
  bladder: { label: 'Toilet', inverted: false, action: 'toilet' },
  stress: { label: 'Stress', inverted: true, action: 'unwind' },
});
export const NEED_RULES = Object.freeze({
  thresholds: Object.freeze({ attention: 45, low: 28, critical: 14 }),         // "wellness" out of 100
  cooldownMs: Object.freeze({ attention: 30 * MINUTE, low: 12 * MINUTE, critical: 5 * MINUTE }),
  globalGapMs: 75_000, escalationGapMs: 15_000,
  showMs: Object.freeze({ attention: 9000, low: 12000, critical: 18000 }),
});
/** 0–100 where 100 is perfectly fine, whatever direction the raw stat runs. */
export function wellness(need, value) {
  const raw = Math.max(0, Math.min(100, Number(value)));
  return NEEDS[need].inverted ? 100 - raw : raw;
}
export function needLevel(need, value) {
  if (!NEEDS[need] || !Number.isFinite(Number(value))) return 'normal';
  const score = wellness(need, value), t = NEED_RULES.thresholds;
  return score <= t.critical ? 'critical' : score <= t.low ? 'low' : score <= t.attention ? 'attention' : 'normal';
}
export function needsReport(profile = {}) {
  return Object.keys(NEEDS).filter(need => Number.isFinite(Number(profile[need]))).map(need => ({ need, value: Number(profile[need]), level: needLevel(need, profile[need]), wellness: wellness(need, profile[need]) }));
}

// Natural Nigerian English, with Pidgin where it reads warmly. Not every line is slang.
const LINES = Object.freeze({
  energy: { attention: 'You’re slowing down small. Plan some rest soon.', low: 'You’re getting tired. Maybe it’s time to head home.', critical: 'Body no be firewood. You need to rest now.' },
  hunger: { attention: 'A meal would be nice before long.', low: 'Omo, hunger don dey show. Find something to eat.', critical: 'You’re running on empty. Eat something now.' },
  fun: { attention: 'It’s been all work lately. Plan something you enjoy.', low: 'Life no suppose boring like this. Find somewhere to enjoy yourself.', critical: 'You need a proper break. Go and catch some fun.' },
  social: { attention: 'It’s been a quiet stretch. Say hello to someone.', low: 'You’ve been on your own for a while. Step outside and meet people.', critical: 'Too much alone time. Go where people dey.' },
  hygiene: { attention: 'A quick freshen-up wouldn’t hurt.', low: 'You fit freshen up small. A shower will sort you.', critical: 'Time for a proper bath before you step out again.' },
  bladder: { attention: 'You may want a bathroom break soon.', low: 'You need the toilet. Head home or find a place.', critical: 'This one no fit wait. Find a toilet now.' },
  stress: { attention: 'Things are piling up a little. Take it easy.', low: 'Stress dey build. Take a moment to relax.', critical: 'You’re carrying too much. Stop and unwind now.' },
});
const ACTIONS = Object.freeze({
  rest: { label: 'Go home', icon: '🏠' }, food: { label: 'Find food', icon: '🍛' }, fun: { label: 'Explore activities', icon: '🎉' },
  social: { label: 'Find people', icon: '💬' }, clean: { label: 'Freshen up', icon: '🫧' }, toilet: { label: 'Go home', icon: '🏠' }, unwind: { label: 'Relax', icon: '🌿' },
});
const RANK = { attention: 1, low: 2, critical: 3 };

/**
 * @param history  { [need]: { level, at } } of notices already shown, plus history.lastAt
 * @param context  { busy } — true while the player is mid-activity, travelling or reading a sheet
 * @returns the single most important notice to show now, or null
 */
export function nextNeedNotice(profile, history = {}, now = Date.now(), { busy = false } = {}) {
  if (busy) return null;
  const candidates = needsReport(profile).filter(row => row.level !== 'normal').map(row => {
    const seen = history[row.need], escalated = seen && RANK[row.level] > RANK[seen.level];
    const cooling = seen && !escalated && now - seen.at < NEED_RULES.cooldownMs[row.level];
    return cooling ? null : { ...row, escalated: Boolean(escalated) };
  }).filter(Boolean);
  if (!candidates.length) return null;
  // Worst level first, then the lowest wellness: a critical need always beats a merely low one.
  candidates.sort((a, b) => RANK[b.level] - RANK[a.level] || a.wellness - b.wellness);
  const top = candidates[0], sinceLast = now - (history.lastAt || 0);
  const gap = top.level === 'critical' || top.escalated ? NEED_RULES.escalationGapMs : NEED_RULES.globalGapMs;
  if (sinceLast < gap) return null;
  const action = ACTIONS[NEEDS[top.need].action];
  return { need: top.need, label: NEEDS[top.need].label, level: top.level, value: top.value, message: LINES[top.need][top.level], action: { id: NEEDS[top.need].action, ...action }, showMs: NEED_RULES.showMs[top.level] };
}
export function recordNeedNotice(history = {}, notice, now = Date.now()) {
  return { ...history, [notice.need]: { level: notice.level, at: now }, lastAt: now };
}
/** Places on a street that can satisfy an action, best first. Matched against scene point ids. */
export const NEED_PLACES = Object.freeze({
  food: [/^restaurant$/, /^cafe$/, /farm-city|sahad|grand-square|bear-barn/, /^grocery$/],
  fun: [/^cinema$/, /^games-lounge$/, /magicland|ceddi/, /^club/, /^park$/],
  social: [/^cafe$/, /^club/, /^park$/, /^restaurant$/, /^games-lounge$/],
  unwind: [/^park$/, /jabi-lake|millennium-park/, /^mosque$|^church$/, /^cafe$/],
});
export function nearestNeedPlace(actionId, points = [], from = { x: 0, y: 0 }) {
  const patterns = NEED_PLACES[actionId]; if (!patterns) return null;
  for (const pattern of patterns) {
    const match = points.filter(point => pattern.test(String(point.id))).sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
    if (match) return match;
  }
  return null;
}

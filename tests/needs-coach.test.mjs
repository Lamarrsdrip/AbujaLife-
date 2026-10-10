import test from 'node:test';
import assert from 'node:assert/strict';
import { NEEDS, NEED_RULES, needLevel, wellness, needsReport, nextNeedNotice, recordNeedNotice, nearestNeedPlace } from '../src/shared/needs-coach.mjs';

const MIN = 60_000, fine = { energy: 80, hunger: 80, fun: 80, social: 80, hygiene: 80, stress: 10 };

test('four severity levels, with stress read the other way round', () => {
  assert.deepEqual([90, 45, 28, 14, 0].map(v => needLevel('energy', v)), ['normal', 'attention', 'low', 'critical', 'critical']);
  assert.equal(needLevel('energy', 46), 'normal'); assert.equal(needLevel('hunger', 29), 'attention');
  assert.deepEqual([5, 55, 72, 86, 100].map(v => needLevel('stress', v)), ['normal', 'attention', 'low', 'critical', 'critical']);
  assert.equal(wellness('stress', 90), 10); assert.equal(wellness('fun', 90), 90);
  assert.equal(needLevel('energy', undefined), 'normal'); assert.equal(needLevel('made-up', 0), 'normal');
  assert.deepEqual(needsReport(fine).map(row => row.level), Array(6).fill('normal'), 'a healthy resident gets no warnings');
  assert.ok(!needsReport(fine).some(row => row.need === 'bladder'), 'a need the profile does not track is simply skipped');
});

test('the most serious need wins, with a human message and a real action', () => {
  assert.equal(nextNeedNotice(fine, {}, 10 * MIN), null);
  const notice = nextNeedNotice({ ...fine, hunger: 25, fun: 20, energy: 10 }, {}, 10 * MIN);
  assert.deepEqual({ need: notice.need, level: notice.level, action: notice.action.id, label: notice.action.label }, { need: 'energy', level: 'critical', action: 'rest', label: 'Go home' });
  assert.equal(nextNeedNotice({ ...fine, hunger: 25, fun: 20 }, {}, 10 * MIN).need, 'fun', 'between two low needs, the worse one');
  assert.equal(nextNeedNotice({ ...fine, hunger: 25 }, {}, 10 * MIN).message, 'Omo, hunger don dey show. Find something to eat.');
  assert.equal(nextNeedNotice({ ...fine, stress: 90 }, {}, 10 * MIN).action.label, 'Relax');
  for (const need of Object.keys(NEEDS)) for (const level of ['attention', 'low', 'critical']) {
    const value = NEEDS[need].inverted ? { attention: 60, low: 75, critical: 95 }[level] : { attention: 40, low: 20, critical: 5 }[level];
    const row = nextNeedNotice({ [need]: value }, {}, 10 * MIN); assert.equal(row.level, level); assert.ok(row.message.length > 12 && row.action.label && row.showMs >= 9000, `${need}/${level}`);
  }
  assert.equal(nextNeedNotice({ ...fine, energy: 5 }, {}, 10 * MIN, { busy: true }), null, 'never interrupts an activity, a journey or an open sheet');
});

test('no spam: cooldown per need, a gap between any two notices, and escalation still gets through', () => {
  const hungry = { ...fine, hunger: 25 }; let now = 100 * MIN, history = {};
  const first = nextNeedNotice(hungry, history, now); history = recordNeedNotice(history, first, now);
  for (const later of [1, 5, 11]) assert.equal(nextNeedNotice(hungry, history, now + later * MIN), null, `quiet ${later} min later`);
  assert.equal(nextNeedNotice(hungry, history, now + NEED_RULES.cooldownMs.low + 1).need, 'hunger', 'reminds again only after the cooldown');
  // A different need must still wait for the global gap.
  const bored = { ...hungry, fun: 20 };
  assert.equal(nextNeedNotice(bored, history, now + 30_000), null); assert.equal(nextNeedNotice(bored, history, now + NEED_RULES.globalGapMs + 1).need, 'fun');
  // Hunger getting worse is news, even inside its cooldown.
  const starving = { ...fine, hunger: 8 };
  assert.equal(nextNeedNotice(starving, history, now + 5000), null, 'but not within seconds of the last card');
  const escalated = nextNeedNotice(starving, history, now + NEED_RULES.escalationGapMs + 1); assert.deepEqual([escalated.need, escalated.level], ['hunger', 'critical']);
  history = recordNeedNotice(history, escalated, now + 20_000);
  assert.equal(nextNeedNotice(starving, history, now + 3 * MIN), null); assert.equal(nextNeedNotice(starving, history, now + 20_000 + NEED_RULES.cooldownMs.critical + 1).level, 'critical');
  // Eating fixes it: nothing more to say.
  assert.equal(nextNeedNotice(fine, history, now + 60 * MIN), null);
  let shown = 0, h = {}; for (let t = 0; t < 60 * MIN; t += 5000) { const n = nextNeedNotice({ ...fine, hunger: 25, fun: 20, social: 40 }, h, t + 1000 * MIN); if (n) { shown++; h = recordNeedNotice(h, n, t + 1000 * MIN); } }
  assert.ok(shown <= 12, `${shown} cards in an hour with three unmet needs`);
});

test('actions resolve to a real nearby place on the street', () => {
  const points = [{ id: 'home', x: 0, y: 0 }, { id: 'grocery', x: 50, y: 0 }, { id: 'restaurant', x: 900, y: 0 }, { id: 'cafe', x: 300, y: 0 }, { id: 'park', x: 100, y: 0 }, { id: 'club-cage', x: 40, y: 0 }];
  assert.equal(nearestNeedPlace('food', points, { x: 0, y: 0 }).id, 'restaurant', 'a proper meal is preferred over the nearest shop');
  assert.equal(nearestNeedPlace('food', points.filter(p => p.id !== 'restaurant'), { x: 0, y: 0 }).id, 'cafe');
  assert.equal(nearestNeedPlace('unwind', points, { x: 0, y: 0 }).id, 'park'); assert.equal(nearestNeedPlace('social', points, { x: 0, y: 0 }).id, 'cafe');
  assert.equal(nearestNeedPlace('fun', points, { x: 0, y: 0 }).id, 'club-cage');
  assert.equal(nearestNeedPlace('rest', points, { x: 0, y: 0 }), null, 'going home is handled by the Home control, not a street marker');
  assert.equal(nearestNeedPlace('food', [], { x: 0, y: 0 }), null);
});

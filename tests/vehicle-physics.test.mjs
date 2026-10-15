import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR, createCarState, carInput, stepCar, speedKmh } from '../app/world-vehicle-physics.js';

const open = { blocked: () => false, onRoad: () => true };
const run = (seconds, control, world = open, state = createCarState(0), position = { x: 0, y: 0 }) => {
  for (let t = 0; t < seconds; t += 1 / 60) stepCar(position, state, typeof control === 'function' ? control(state, position) : control, world, 1 / 60);
  return { state, position };
};

test('accelerates with momentum to top speed and never past it; boost goes faster', () => {
  const half = run(.5, { throttle: 1 }).state.speed, full = run(4, { throttle: 1 }).state.speed;
  assert.ok(half > 120 && half < CAR.topSpeed * .6, `not instant: ${half}`);
  assert.ok(full > CAR.topSpeed * .97 && full <= CAR.topSpeed + 1, `reaches top speed: ${full}`);
  assert.ok(run(5, { throttle: 1, boost: true }).state.speed > CAR.topSpeed * 1.2);
  assert.ok(speedKmh(CAR.topSpeed) >= 50 && speedKmh(CAR.topSpeed) <= 70, `${speedKmh(CAR.topSpeed)} km/h feels like city driving`);
});

test('brakes hard, coasts gently, and reverses slowly', () => {
  const moving = run(4, { throttle: 1 }).state, start = moving.speed;
  const braked = run(.6, { throttle: -1 }, open, moving).state.speed;
  assert.ok(braked < start * .3, `braking bites: ${braked}`);
  const coasting = run(1, { throttle: 0 }, open, run(4, { throttle: 1 }).state).state.speed;
  assert.ok(coasting > start * .55 && coasting < start, `engine braking is gentle: ${coasting}`);
  const reverse = run(4, { throttle: -1 }).state.speed;
  assert.ok(reverse < 0 && -reverse <= CAR.reverseSpeed + 1, `reverse is capped: ${reverse}`);
});

test('grass halves the top speed', () => {
  const grass = run(5, { throttle: 1 }, { blocked: () => false, onRoad: () => false }).state.speed;
  assert.ok(grass < CAR.topSpeed * .55 && grass > CAR.topSpeed * .3, `${grass}`);
});

test('steering needs speed, and is calmer at the top end', () => {
  assert.equal(run(1, { throttle: 0, steer: 1 }).state.heading, 0, 'no turning on the spot');
  const slow = createCarState(0); slow.speed = slow.vx = 200; const fast = createCarState(0); fast.speed = fast.vx = CAR.topSpeed;
  const turnSlow = run(.5, { throttle: .36, steer: 1 }, open, slow).state.heading, turnFast = run(.5, { throttle: 1, steer: 1 }, open, fast).state.heading;
  assert.ok(turnSlow > .45 && turnSlow < 1.1, `a half-second turn at town speed: ${turnSlow}`);
  assert.ok(turnFast < turnSlow, 'less twitchy at top speed');
  const released = run(.25, { throttle: .5, steer: 0 }, open, { ...slow, steer: 1 }).state.steer;
  assert.ok(Math.abs(released) < .1, 'the wheel self-centres when released');
});

test('walls stop the car without penetration; it can always reverse away', () => {
  const wall = { blocked: (x) => x > 300, onRoad: () => true };
  const { state, position } = run(3, { throttle: 1 }, wall);
  assert.ok(position.x <= 300 && position.x > 250, `stopped at the wall: ${position.x}`);
  assert.ok(Math.abs(state.speed) < 60, 'no tunnelling, speed scrubbed');
  const away = run(1.5, { throttle: -1 }, wall, state, position).position.x;
  assert.ok(away < 250, `backs away: ${away}`);
});

test('a glancing hit slides along the wall instead of stopping dead', () => {
  const wall = { blocked: (x, y) => y < -20, onRoad: () => true }, state = createCarState(-15);
  const { position } = run(2, { throttle: 1 }, wall, state);
  assert.ok(position.x > 600, `kept going along the wall: ${position.x}`);
  assert.ok(position.y >= -20);
});

test('the touch stick steers toward where it points and reverses when pointing behind', () => {
  const target = { x: 0, y: 1 }; // south
  const { state } = run(3, s => carInput(s, { direction: target }));
  assert.ok(Math.abs(state.heading - Math.PI / 2) < .2, `turned to face the stick: ${state.heading}`);
  const back = carInput(createCarState(0), { direction: { x: -1, y: 0 } });
  assert.ok(back.throttle < 0, 'stick pulled behind a stopped car reverses');
  const moving = createCarState(0); moving.speed = 400;
  assert.deepEqual(carInput(moving, { direction: { x: -1, y: 0 } }), { throttle: -1, steer: 0 }, 'a moving car brakes first');
});

test('touching another car never locks the resident in place', () => {
  const traffic = [{ x: 30, y: 0, r: 46 }], world = { blocked: () => false, onRoad: () => true, dynamic: traffic };
  const pushed = run(1.5, { throttle: 1 }, world, createCarState(0), { x: -200, y: 0 }).position.x;
  assert.ok(pushed <= 30 - 46 + 1 && pushed > -40, `stops at the other car, not through it: ${pushed}`);
  const overlap = { x: 10, y: 0 }, state = createCarState(0);
  const back = run(1, { throttle: -1 }, world, state, overlap).position.x;
  assert.ok(back < 0, `reverses out of an overlap: ${back}`);
  const side = run(1, { throttle: 1 }, world, createCarState(90), { x: 10, y: 0 }).position.y;
  assert.ok(side > 30, `drives out sideways: ${side}`);
});

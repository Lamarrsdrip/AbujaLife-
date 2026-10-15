// Arcade-believable car handling for the free-roam street.
//
// Before this module a car moved exactly like a walking resident: full speed
// on the first frame, instant 90° turns, sideways strafing and a dead stop on
// contact. The model below keeps the same world units and collision probe but
// gives the car momentum, speed-dependent steering, tyre grip (a little slide
// at speed), braking/reverse, engine braking, grass drag and a glancing slide
// along walls. It is pure and deterministic so it can be tested without a DOM.

export const CAR = Object.freeze({
  topSpeed: 560,          // world units per second (the old fixed speed was 300)
  boostSpeed: 760,
  reverseSpeed: 170,
  accel: 420,
  boostAccel: 560,
  brake: 1250,
  coast: 170,             // engine braking with no throttle
  offRoadTop: .5,         // grass, kerbs and verges: half top speed
  offRoadDrag: 2.1,
  maxYawRate: 2.1,        // radians per second at ideal speed
  yawSpeed: 150,          // speed at which steering reaches full authority
  grip: 9,                // how quickly sideways velocity is scrubbed
  wallKeep: .55,          // speed kept when glancing off a wall
  bounce: .22,            // speed returned (backwards) on a head-on hit
});

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/** Fresh state from a heading in degrees (the simulator's `angle`). */
export function createCarState(angleDegrees = 0) {
  return { heading: (Number(angleDegrees) || 0) * Math.PI / 180, speed: 0, vx: 0, vy: 0, steer: 0, contact: 0 };
}

/**
 * Turn raw input into throttle/steer.
 * - Keyboard (tank style): `forward` −1..1 (W/S), `turn` −1..1 (A/D).
 * - Stick/joystick (point to steer): a world-space `direction` {x,y} with
 *   magnitude 0..1. The car steers toward it and reverses when the stick
 *   points well behind a slow car.
 */
export function carInput(state, { forward = 0, turn = 0, direction = null } = {}) {
  if (direction && Math.hypot(direction.x, direction.y) > .06) {
    const magnitude = clamp(Math.hypot(direction.x, direction.y), 0, 1);
    const wanted = Math.atan2(direction.y, direction.x), diff = wrap(wanted - state.heading);
    const behind = Math.abs(diff) > 2.0;
    // Nosed into something with the stick pointing elsewhere: back up while
    // turning (a three-point turn) instead of pushing into the wall forever.
    if (state.contact > 0 && Math.abs(state.speed) < 40 && Math.abs(diff) > .5) state.recover = .8;
    if (state.recover > 0 && !behind) {
      // Reversing turns the nose the other way, so steer against the gap.
      return { throttle: -magnitude, steer: clamp(-diff * 1.6, -1, 1) };
    }
    if (behind && state.speed < 60) {
      // Reverse: steer so the tail swings toward the stick.
      return { throttle: -magnitude, steer: clamp(-wrap(wanted + Math.PI - state.heading) * 1.6, -1, 1) };
    }
    if (behind) return { throttle: -1, steer: 0 }; // brake hard first
    return { throttle: magnitude * clamp(1.15 - Math.abs(diff) / 2.4, .25, 1), steer: clamp(diff * 1.8, -1, 1) };
  }
  return { throttle: clamp(forward, -1, 1), steer: clamp(turn, -1, 1) };
}

/**
 * Advance the car by `dt` seconds.
 * @param {object} position {x,y} mutated in place
 * @param {object} state from createCarState, mutated in place
 * @param {{throttle:number, steer:number, boost?:boolean}} control
 * @param {{blocked:(x:number,y:number)=>boolean, onRoad?:(x:number,y:number)=>boolean, dynamic?:Array<{x:number,y:number,r:number}>}} world
 * @returns {{moved:number, hit:boolean, speed:number}}
 */
export function stepCar(position, state, control, world, dt) {
  dt = clamp(Number(dt) || 0, 0, .1);
  if (!dt) return { moved: 0, hit: false, speed: state.speed };
  state.recover = Math.max(0, (state.recover || 0) - dt);
  const { throttle = 0, steer = 0, boost = false } = control || {};
  const road = world.onRoad ? world.onRoad(position.x, position.y) : true;
  const top = (boost ? CAR.boostSpeed : CAR.topSpeed) * (road ? 1 : CAR.offRoadTop);

  // Longitudinal: accelerate, brake (throttle against motion), coast.
  let speed = state.speed;
  if (throttle > 0.02) {
    if (speed < -5) speed = Math.min(0, speed + CAR.brake * throttle * dt);
    else speed = Math.min(top * throttle + (speed > top * throttle ? speed - top * throttle : 0), speed + (boost ? CAR.boostAccel : CAR.accel) * throttle * dt);
  } else if (throttle < -0.02) {
    if (speed > 5) speed = Math.max(0, speed + CAR.brake * throttle * dt);
    else speed = Math.max(-CAR.reverseSpeed * -throttle, speed + CAR.accel * .7 * throttle * dt);
  } else {
    speed = Math.sign(speed) * Math.max(0, Math.abs(speed) - CAR.coast * dt);
  }
  if (speed > top) speed = Math.max(top, speed - CAR.brake * .6 * dt);
  if (!road) speed *= Math.exp(-CAR.offRoadDrag * dt * Math.min(1, Math.abs(speed) / 200));

  // Steering authority grows with speed, then eases off at the top end.
  const authority = clamp(Math.abs(speed) / CAR.yawSpeed, 0, 1) * (1 - .4 * clamp((Math.abs(speed) - 320) / 420, 0, 1));
  // Steering eases in and self-centres quickly, like a wheel returning.
  state.steer += (steer - state.steer) * (1 - Math.exp(-dt * (Math.abs(steer) > Math.abs(state.steer) ? 7 : 12)));
  state.heading = wrap(state.heading + state.steer * CAR.maxYawRate * authority * Math.sign(speed || 1) * dt);

  // Velocity follows the heading through tyre grip, leaving a small slide.
  const fx = Math.cos(state.heading), fy = Math.sin(state.heading);
  const lateral = -state.vx * fy + state.vy * fx;
  const keepLateral = lateral * Math.exp(-CAR.grip * dt);
  state.vx = fx * speed - fy * keepLateral;
  state.vy = fy * speed + fx * keepLateral;
  state.speed = speed;

  // Move in short sub-steps; slide along whichever axis is still free.
  const dx = state.vx * dt, dy = state.vy * dt, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  // Other cars block only moves that close the gap; once touching (or if one
  // drove into us) any move that opens it is allowed, so nobody gets locked.
  const solid = (x, y) => world.blocked(x, y) || (world.dynamic || []).some(o => { const next = Math.hypot(o.x - x, o.y - y); return next < o.r && next < Math.hypot(o.x - position.x, o.y - position.y) - .01; });
  let hit = false, blockedX = false, blockedY = false;
  const start = { x: position.x, y: position.y };
  for (let i = 0; i < steps; i++) {
    const sx = dx / steps, sy = dy / steps;
    if (!solid(position.x + sx, position.y + sy)) { position.x += sx; position.y += sy; continue; }
    hit = true;
    if (!blockedX && !solid(position.x + sx, position.y)) position.x += sx; else blockedX = true;
    if (!blockedY && !solid(position.x, position.y + sy)) position.y += sy; else blockedY = true;
  }
  if (hit) {
    const along = Math.abs(fx * (blockedX ? 0 : 1)) + Math.abs(fy * (blockedY ? 0 : 1)), fresh = state.contact <= 0;
    if (blockedX && blockedY || along < .25) { state.speed = -state.speed * CAR.bounce; state.vx = state.vy = 0; }
    else {
      // Glancing contact: lose speed once, by how square the hit was, then slide
      // with light friction while the body eases parallel to the wall.
      if (fresh) state.speed *= Math.max(CAR.wallKeep, along);
      state.speed *= Math.exp(-.6 * dt);
      if (blockedX) state.vx = 0; if (blockedY) state.vy = 0;
      const options = blockedY ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2], tangent = options.reduce((best, a) => Math.abs(wrap(a - state.heading)) < Math.abs(wrap(best - state.heading)) ? a : best);
      state.heading = wrap(state.heading + wrap(tangent - state.heading) * (1 - Math.exp(-dt * 3)));
    }
    state.contact = .25;
  } else state.contact = Math.max(0, state.contact - dt);
  return { moved: Math.hypot(position.x - start.x, position.y - start.y), hit, speed: state.speed };
}

/** km/h for the HUD: a 4.5 m car is ~160 units long in street view, so ~35 units to the metre. */
export const speedKmh = speed => Math.round(Math.abs(speed) / 35 * 3.6);

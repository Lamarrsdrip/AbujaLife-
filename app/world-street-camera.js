// Third-person "street view" camera. Pure presentation maths: it never changes
// the authoritative player position, the authored floor or server coordinates.
// World 2D (x, y) maps to 3D (x, up, y * depthScale), matching world-camera.js.
import { WORLD_CAMERA } from './world-camera.js';

const RAD = Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

export const STREET_VIEW = Object.freeze({
  storageKey: 'abujalife:world-view',
  fov: 56, near: 6, far: 16000,
  // distance behind the resident, eye height of the look-at target and resting pitch.
  walk: Object.freeze({distance: 330, target: 104, pitch: 10 * RAD}),
  drive: Object.freeze({distance: 470, target: 80, pitch: 14 * RAD}),
  // Indoors the eye looks over the camera-facing walls, which the scene lowers.
  interior: Object.freeze({distance: 400, target: 78, pitch: 34 * RAD}),
  // Street view draws residents at building scale; the overview keeps its larger figures.
  residentScale: 1.02,
  minPitch: 3 * RAD, maxPitch: 66 * RAD, wallPitch: 72 * RAD, minDistance: 70, minZoom: .5, maxZoom: 2.6,
  followWalk: .9, followPath: 2.2, followDrive: 3.4,
});

/** Portrait phones need a taller field of view to keep a believable horizontal one. */
export function streetFieldOfView(aspect) {
  const ratio = finite(aspect, 1) > 0 ? finite(aspect, 1) : 1;
  return clamp(2 * Math.atan(Math.tan(21 * RAD) / ratio) / RAD, 50, 72);
}

export function streetProfile({driving = false, interior = false} = {}) {
  return driving ? STREET_VIEW.drive : interior ? STREET_VIEW.interior : STREET_VIEW.walk;
}

/** The diorama orbit keeps owning drag state; its elevation becomes a pitch offset here. */
export function streetPitch(elevation, profile = STREET_VIEW.walk) {
  const offset = finite(elevation, WORLD_CAMERA.elevation) - WORLD_CAMERA.elevation;
  return clamp(profile.pitch + offset * 1.25, STREET_VIEW.minPitch, STREET_VIEW.maxPitch);
}

/** Yaw that places the camera directly behind a resident facing `angle` degrees in world 2D. */
export function streetFollowYaw(angle, depthScale = WORLD_CAMERA.depthScale) {
  const radians = finite(angle, 0) * RAD, hx = Math.cos(radians), hz = Math.sin(radians) * depthScale;
  return Math.atan2(-hx, -hz);
}

export function easeYaw(current, target, amount) {
  const delta = ((target - current + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return current + delta * clamp(amount, 0, 1);
}

/**
 * Camera pose behind the resident. `blocked(x, y)` is the scene's own obstacle
 * test, so the eye is pulled in front of a wall instead of ending inside it.
 */
export function streetCameraPose({player, yaw = WORLD_CAMERA.yaw, elevation, zoom = 1, driving = false, interior = false, blocked, depthScale = WORLD_CAMERA.depthScale} = {}) {
  const profile = streetProfile({driving, interior});
  let pitch = streetPitch(elevation, profile);
  const wanted = profile.distance / clamp(finite(zoom, 1), STREET_VIEW.minZoom, STREET_VIEW.maxZoom);
  const px = finite(player?.x, 0), py = finite(player?.y, 0);
  // Unit ground direction from the resident back toward the camera, in 3D then world 2D.
  const backX = Math.sin(yaw), backZ = Math.cos(yaw);
  let distance = wanted;
  if (typeof blocked === 'function') {
    const ground = wanted * Math.cos(pitch), step = 18;
    for (let travelled = step; travelled <= ground; travelled += step) {
      if (!blocked(px + backX * travelled, py + backZ * travelled / depthScale)) continue;
      // Rise over the obstacle before closing in: the eye keeps most of its
      // distance and looks down more steeply, so the resident stays in frame.
      const allowed = Math.max(0, travelled - step - 8), keep = wanted * .6;
      const steep = clamp(Math.acos(clamp(allowed / keep, 0, 1)), pitch, STREET_VIEW.wallPitch);
      pitch = steep; distance = Math.max(STREET_VIEW.minDistance, allowed / Math.max(.2, Math.cos(steep)));
      break;
    }
  }
  const tx = px, ty = profile.target, tz = py * depthScale;
  const ground = distance * Math.cos(pitch);
  return {
    mode: 'street', fov: STREET_VIEW.fov, yaw, pitch, distance, shortened: distance < wanted - .5,
    target: {x: tx, y: ty, z: tz},
    position: {x: tx + backX * ground, y: ty + distance * Math.sin(pitch), z: tz + backZ * ground},
  };
}

/** Re-seat an existing pose at an eased distance so wall avoidance never pops. */
export function streetPoseAtDistance(pose, distance) {
  const reach = Math.max(STREET_VIEW.minDistance, finite(distance, pose.distance));
  const ground = reach * Math.cos(pose.pitch), backX = Math.sin(pose.yaw), backZ = Math.cos(pose.yaw);
  return {...pose, distance: reach, position: {x: pose.target.x + backX * ground, y: pose.target.y + reach * Math.sin(pose.pitch), z: pose.target.z + backZ * ground}};
}

export function readStreetPreference(storage = globalThis.localStorage) {
  try { return storage?.getItem(STREET_VIEW.storageKey) !== 'overview'; } catch { return true; }
}
export function writeStreetPreference(street, storage = globalThis.localStorage) {
  try { storage?.setItem(STREET_VIEW.storageKey, street ? 'street' : 'overview'); } catch {}
}

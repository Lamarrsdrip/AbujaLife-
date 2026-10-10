// Shared shape of an advertising billboard on the Map. Every advertising
// placement, paid or vacant, stands up as a roadside board facing the default
// camera instead of lying flat on the ground. Placement ids, land and pricing
// are unchanged; this is how a placement is presented.
export const MAP_BILLBOARD = Object.freeze({ yaw: .42, tilt: .46, aspect: .56, fill: .92 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Board face size, post height and tier for a placement. */
export function billboardShape(place = {}) {
  const mega = place.format === 'roadside-billboard' || place.kind === 'billboard';
  const span = Math.max(1, Math.min(Number(place.width) || 120, Number(place.height) || 120));
  const width = mega ? clamp(Math.max(Number(place.width) || 0, Number(place.height) || 0) * 1.25, 260, 360) : clamp(span * 1.05, 120, 230);
  return { mega, width, height: width * MAP_BILLBOARD.aspect, lift: mega ? 78 : 46 };
}

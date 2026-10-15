// The free-roam street network: one source of truth for every layer that has
// an opinion about where the road is. The SVG fallback, the WebGL street, the
// procedural city fabric, landmark placement, collision, navigation and
// ambient traffic all read these rectangles. Before this module existed the
// WebGL street drew four full-width boulevards while the landmark quarter was
// laid out against a different (SVG-only) grid, so drivers met solid
// colliders standing on what looked like open tarmac.

export const STREET_WIDTH = 11200;
export const STREET_HEIGHT = 4190;

/** [y, height] of each east–west boulevard. */
export const BOULEVARDS = Object.freeze([[722, 252], [1534, 234], [2284, 234], [3170, 234]].map(Object.freeze));
/** [x, width] of each north–south road: the legacy expressway, then the landmark-quarter avenues. */
export const AVENUES = Object.freeze([[1820, 254], ...[3740, 4440, 5140, 5840, 6540, 7240, 7940, 8540, 9380, 10220, 11000].map(x => [x, 96])].map(Object.freeze));

/** Roundabouts sit on the expressway crossings, as Abuja's big junctions do. */
export const ROUNDABOUTS = Object.freeze([
  Object.freeze({ id: 'roundabout-north', x: 1947, y: 848, island: 34 }),
  Object.freeze({ id: 'roundabout-south', x: 1947, y: 2401, island: 34 }),
]);

export function roadRects(width = STREET_WIDTH, height = STREET_HEIGHT) {
  return [
    ...BOULEVARDS.map(([y, h]) => ({ x: 0, y, w: width, h, axis: 'x' })),
    ...AVENUES.filter(([x]) => x < width).map(([x, w]) => ({ x, y: 0, w: Math.min(w, width - x), h: height, axis: 'y' })),
  ];
}

/** Every junction where an avenue meets a boulevard. */
export function intersections(width = STREET_WIDTH) {
  const out = [];
  for (const [x, w] of AVENUES) if (x < width) for (const [y, h] of BOULEVARDS) out.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2, major: w > 200 });
  return out;
}

/** Solid central islands of the roundabouts, as axis-aligned collision boxes. */
export function roundaboutObstacles() {
  return ROUNDABOUTS.map(r => ({ x: r.x - r.island * .8, y: r.y - r.island * .8, w: r.island * 1.6, h: r.island * 1.6, roundabout: r.id }));
}

export const rectsOverlap = (a, b, margin = 0) => a.x < b.x + b.w + margin && a.x + a.w + margin > b.x && a.y < b.y + b.h + margin && a.y + a.h + margin > b.y;

/** True when a rectangle (plus margin) touches any carriageway. */
export function touchesRoad(rect, margin = 0, width = STREET_WIDTH, height = STREET_HEIGHT) {
  return roadRects(width, height).some(road => rectsOverlap(rect, road, margin));
}

/**
 * Move a footprint the shortest distance that puts it fully inside a city
 * block: clear of every road by `roadMargin`, clear of `solids` by
 * `solidMargin`, and inside the given bounds. Deterministic. Returns the
 * offset to apply, or null when no spot exists within `reach`.
 */
export function fitInsideBlock(rect, { solids = [], roadMargin = 30, solidMargin = 30, bounds = { x: 0, y: 0, w: STREET_WIDTH, h: STREET_HEIGHT }, reach = 900 } = {}) {
  const roads = roadRects(bounds.x + bounds.w, bounds.y + bounds.h);
  const ok = r => r.x >= bounds.x + 40 && r.y >= bounds.y + 40 && r.x + r.w <= bounds.x + bounds.w - 40 && r.y + r.h <= bounds.y + bounds.h - 40
    && !roads.some(road => rectsOverlap(r, road, roadMargin)) && !solids.some(s => rectsOverlap(r, s, solidMargin));
  if (ok(rect)) return { dx: 0, dy: 0 };
  // Roads and solids are axis-aligned, so the nearest legal spot always has an
  // edge flush against some obstacle edge (or stays on the original axis).
  // Testing only those candidate coordinates is exact and fast.
  const xs = new Set([rect.x]), ys = new Set([rect.y]);
  for (const road of roads) {
    if (road.axis === 'y') { xs.add(road.x - roadMargin - rect.w - 1); xs.add(road.x + road.w + roadMargin + 1); }
    else { ys.add(road.y - roadMargin - rect.h - 1); ys.add(road.y + road.h + roadMargin + 1); }
  }
  for (const solid of solids) { xs.add(solid.x - solidMargin - rect.w - 1); xs.add(solid.x + solid.w + solidMargin + 1); ys.add(solid.y - solidMargin - rect.h - 1); ys.add(solid.y + solid.h + solidMargin + 1); }
  xs.add(bounds.x + 41); xs.add(bounds.x + bounds.w - 41 - rect.w); ys.add(bounds.y + 41); ys.add(bounds.y + bounds.h - 41 - rect.h);
  const near = (values, origin) => [...values].map(v => Math.round(v)).filter(v => Math.abs(v - origin) <= reach);
  const candidates = [];
  for (const x of near(xs, rect.x)) for (const y of near(ys, rect.y)) candidates.push({ dx: x - rect.x, dy: y - rect.y, cost: Math.hypot(x - rect.x, (y - rect.y) * 1.15) });
  candidates.sort((a, b) => a.cost - b.cost || a.dy - b.dy || a.dx - b.dx);
  const best = candidates.find(c => ok({ ...rect, x: rect.x + c.dx, y: rect.y + c.dy }));
  return best ? { dx: best.dx, dy: best.dy } : null;
}

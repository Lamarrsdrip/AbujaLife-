// City detail for the 3D Abuja Map: housing in each district's own character,
// roundabouts, street trees, a forest edge, the Aso and Zuma rocks and district
// names laid on the ground. Everything here is scenery. It is generated
// deterministically, kept off roads, landmarks and every advertising plot, and
// drawn with instancing so the Map stays a handful of draw calls.
import { districtCharacter } from './world-city-fabric.js';
import { abujaToWorld } from '../src/shared/abuja-navigation.mjs';

// Visual road widths. Ad plots keep (legacy width / 2 + 32) clear of every road
// centre line, so these stay inside that margin including the kerb.
export const MAP_ROAD_WIDTH = Object.freeze({ major: 72, minor: 60 });
export const mapRoadWidth = roadClass => roadClass === 'landmark-road' ? MAP_ROAD_WIDTH.major : MAP_ROAD_WIDTH.minor;

const CLUSTER = Object.freeze({
  core: { count: 30, radius: 330, step: [78, 74], size: [52, 62], height: [70, 210], pitched: 0, walls: ['#d7dde0', '#c3ced4', '#e3dfd2', '#b7c5cc', '#cdd5cd'], roofs: ['#5f6d74', '#70787c', '#525f65'] },
  commercial: { count: 54, radius: 400, step: [62, 60], size: [40, 50], height: [26, 78], pitched: .1, walls: ['#eadfc6', '#dfd5bd', '#d6dccd', '#efe4ce', '#d2cab5', '#e5d2b3'], roofs: ['#70746b', '#8a6a55', '#62706b', '#9a5f4c'] },
  affluent: { count: 44, radius: 430, step: [84, 78], size: [50, 58], height: [20, 30], pitched: .7, walls: ['#f4eddc', '#ede7d6', '#f6efde', '#e8e2ce'], roofs: ['#9a5642', '#74796b', '#8a6450', '#647069'] },
  satellite: { count: 70, radius: 420, step: [52, 50], size: [30, 40], height: [16, 26], pitched: .85, walls: ['#ead9bb', '#dfcfae', '#d8d3bf', '#ece2ca', '#d0c6ad'], roofs: ['#b04d3a', '#8c4336', '#3f7fa8', '#4f8f63', '#9a9d98', '#bd6b45', '#2f6f8f', '#a8463a'] },
});
// Names laid on the ground, in the manner of a printed city map.
const GROUND_LABELS = Object.freeze({
  'central-area': 'CENTRAL BUSINESS DISTRICT', maitama: 'MAITAMA', asokoro: 'ASOKORO', 'wuse-i': 'WUSE', 'wuse-ii-a07': 'WUSE II', 'garki-i': 'GARKI', 'garki-ii': 'GARKI II',
  jabi: 'JABI', utako: 'UTAKO', wuye: 'WUYE', guzape: 'GUZAPE', katampe: 'KATAMPE', mabushi: 'MABUSHI', 'gwarinpa-i': 'GWARINPA', lugbe: 'LUGBE', kubwa: 'KUBWA',
  nyanya: 'NYANYA', karu: 'KARU', lokogoma: 'LOKOGOMA', galadimawa: 'GALADIMAWA', durumi: 'DURUMI', gudu: 'GUDU', kado: 'KADO', jahi: 'JAHI', dawaki: 'DAWAKI', mpape: 'MPAPE',
  'gwagwalada-town': 'GWAGWALADA', 'kuje-town': 'KUJE', 'bwari-town': 'BWARI', zuba: 'ZUBA',
});
// Granite inselbergs at their real positions relative to the city.
const ROCKS = Object.freeze([
  { id: 'aso-rock', name: 'ASO ROCK', lat: 9.0835, lon: 7.5362, size: [300, 210, 230] },
  { id: 'zuma-rock', name: 'ZUMA ROCK', lat: 9.1262, lon: 7.2343, size: [170, 250, 150] },
]);

function seeded(text) {
  let state = 2166136261;
  for (const char of String(text)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state |= 0; state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Squared distance with an early bounding-box reject: this runs millions of times.
function withinSegment(px, pz, s, reach) {
  if (px < s.minX - reach || px > s.maxX + reach || pz < s.minZ - reach || pz > s.maxZ + reach) return false;
  const t = s.length2 ? Math.max(0, Math.min(1, ((px - s.a.x) * s.dx + (pz - s.a.z) * s.dz) / s.length2)) : 0;
  const ex = px - s.a.x - s.dx * t, ez = pz - s.a.z - s.dz * t;
  return ex * ex + ez * ez < reach * reach;
}

/**
 * @param layout  createLayout() result: {width, depth, districts, landmarks, nightlife, adPlots}
 * @param roads   [{a:{x,z}, b:{x,z}, roadClass}]
 */
export function generateMapDetail({ layout, roads = [], light = false } = {}) {
  const random = seeded('abuja-map-detail-v1'), halfW = layout.width / 2 - 330, halfD = layout.depth / 2 - 330;
  const density = light ? .55 : 1;
  const plots = (layout.adPlots || []).map(p => ({ x0: p.x - p.w / 2 - 16, x1: p.x + p.w / 2 + 16, z0: p.z - p.d / 2 - 16, z1: p.z + p.d / 2 + 16 }));
  const places = [...(layout.landmarks || []), ...(layout.nightlife || [])];
  const rocks = ROCKS.map(rock => { const p = abujaToWorld(rock); return { ...rock, x: p.x, z: p.y }; }).filter(rock => Math.abs(rock.x) < halfW && Math.abs(rock.z) < halfD);
  const segments = roads.map(road => { const dx = road.b.x - road.a.x, dz = road.b.z - road.a.z; return { a: road.a, b: road.b, dx, dz, length2: dx * dx + dz * dz, half: mapRoadWidth(road.roadClass) / 2,
    minX: Math.min(road.a.x, road.b.x), maxX: Math.max(road.a.x, road.b.x), minZ: Math.min(road.a.z, road.b.z), maxZ: Math.max(road.a.z, road.b.z) }; });
  const nearRoad = (x, z, margin) => { for (const s of segments) if (withinSegment(x, z, s, s.half + margin)) return true; return false; };
  const onPlot = (x, z, r) => { for (const p of plots) if (x + r > p.x0 && x - r < p.x1 && z + r > p.z0 && z - r < p.z1) return true; return false; };
  const nearPlace = (x, z, r) => { for (const p of places) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < r * r) return true; } for (const rock of rocks) { const dx = rock.x - x, dz = rock.z - z, reach = rock.size[0] * 1.05 + r; if (dx * dx + dz * dz < reach * reach) return true; } return false; };
  const inside = (x, z, margin = 0) => Math.abs(x) < halfW - margin && Math.abs(z) < halfD - margin;

  // Ground labels first, so housing leaves them readable.
  const labels = [];
  for (const district of layout.districts || []) {
    const text = GROUND_LABELS[district.id]; if (!text) continue;
    const width = Math.min(560, 150 + text.length * 26), label = { text, x: district.x, z: district.z + 150, width, height: 64 };
    if (inside(label.x, label.z, width / 2)) labels.push(label);
  }
  for (const rock of rocks) labels.push({ text: rock.name, x: rock.x, z: rock.z + rock.size[2] + 90, width: 300, height: 56 });
  const assembly = (layout.landmarks || []).find(place => place.id === 'national-assembly-hub');
  if (assembly) labels.push({ text: 'THREE ARMS ZONE', x: assembly.x + 40, z: assembly.z - 200, width: 430, height: 58 });
  const onLabel = (x, z, r) => labels.some(l => Math.abs(x - l.x) < l.width / 2 + r && Math.abs(z - l.z) < l.height / 2 + r);

  const houses = [], taken = new Set(), cell = (x, z) => `${Math.round(x / 46)}:${Math.round(z / 46)}`;
  for (const district of layout.districts || []) {
    if (!inside(district.x, district.z)) continue;
    const rule = CLUSTER[districtCharacter(district.id)], local = seeded(`houses:${district.id}`), wanted = Math.round(rule.count * density);
    const yaw = (local() - .5) * .9, cos = Math.cos(yaw), sin = Math.sin(yaw), reach = Math.ceil(rule.radius / Math.min(...rule.step));
    const spots = [];
    for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) {
      if (i % 4 === 0 || j % 5 === 0) continue; // local streets between rows
      const lx = i * rule.step[0], lz = j * rule.step[1], d = Math.hypot(lx, lz);
      if (d > rule.radius || d < 70) continue;
      spots.push({ x: district.x + lx * cos - lz * sin, z: district.z + lx * sin + lz * cos, d, order: d / rule.radius + local() * .55 });
    }
    spots.sort((a, b) => a.order - b.order);
    let placed = 0;
    for (const spot of spots) {
      if (placed >= wanted) break;
      const w = rule.size[0] + local() * (rule.size[1] - rule.size[0]), d = w * (.78 + local() * .3), r = Math.max(w, d) * .62;
      if (!inside(spot.x, spot.z, 40) || nearRoad(spot.x, spot.z, r + 8) || onPlot(spot.x, spot.z, r) || nearPlace(spot.x, spot.z, 150) || onLabel(spot.x, spot.z, r)) continue;
      const key = cell(spot.x, spot.z); if (taken.has(key)) continue; taken.add(key);
      const h = rule.height[0] + Math.pow(local(), 1.6) * (rule.height[1] - rule.height[0]);
      houses.push({ x: spot.x, z: spot.z, w, d, h, yaw, wall: rule.walls[Math.floor(local() * rule.walls.length)], roof: rule.roofs[Math.floor(local() * rule.roofs.length)], pitched: h < 40 && local() < rule.pitched });
      placed++;
    }
  }

  // Roundabouts where three or more roads meet.
  const degree = new Map();
  for (const road of roads) for (const end of [road.a, road.b]) { const key = `${Math.round(end.x)}:${Math.round(end.z)}`; degree.set(key, { x: end.x, z: end.z, n: (degree.get(key)?.n || 0) + 1 }); }
  const roundabouts = [...degree.values()].filter(node => node.n >= 3 && inside(node.x, node.z) && !onPlot(node.x, node.z, 44)).map(node => ({ x: node.x, z: node.z, r: 40 }));

  const trees = [], tree = (x, z, s) => trees.push({ x, z, s, tint: random() });
  // Street trees on both sides of every road.
  for (const s of segments) {
    const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, length = Math.hypot(dx, dz); if (length < 120) continue;
    const ux = dx / length, uz = dz / length, spacing = light ? 190 : 120;
    for (let t = 60; t < length - 40; t += spacing) for (const side of [-1, 1]) {
      const x = s.a.x + ux * t - uz * (s.half + 24) * side, z = s.a.z + uz * t + ux * (s.half + 24) * side;
      if (inside(x, z) && !onPlot(x, z, 12) && !nearPlace(x, z, 90) && !nearRoad(x, z, 6)) tree(x, z, 19 + random() * 8);
    }
  }
  // Forest belt around the edge of the territory, and clustered woodland in open
  // country. Forest trees are canopy-only: at map scale the trunk is never seen.
  const open = (x, z) => inside(x, z) && !nearRoad(x, z, 18) && !onPlot(x, z, 16) && !nearPlace(x, z, 120) && !onLabel(x, z, 16) && !taken.has(cell(x, z));
  const belt = Math.round(2400 * density), patches = Math.round(64 * density);
  for (let i = 0; i < belt; i++) {
    const along = random(), depth = Math.pow(random(), 1.6) * 760, edge = Math.floor(random() * 4);
    const x = edge < 2 ? (along * 2 - 1) * halfW : (edge === 2 ? -1 : 1) * (halfW - depth), z = edge < 2 ? (edge === 0 ? -1 : 1) * (halfD - depth) : (along * 2 - 1) * halfD;
    if (open(x, z)) trees.push({ x, z, s: 26 + random() * 24, tint: random(), forest: true });
  }
  for (let patch = 0; patch < patches; patch++) {
    const cx = (random() * 2 - 1) * halfW, cz = (random() * 2 - 1) * halfD, spread = 130 + random() * 230, count = 26 + Math.floor(random() * 44);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2, reach = Math.sqrt(random()) * spread, x = cx + Math.cos(angle) * reach, z = cz + Math.sin(angle) * reach * .8;
      if (open(x, z)) trees.push({ x, z, s: 22 + random() * 22, tint: random(), forest: true });
    }
  }
  return { houses, trees, roundabouts, labels, rocks };
}

function labelTexture(T, text) {
  const canvas = globalThis.document?.createElement?.('canvas'); if (!canvas) return null;
  canvas.width = 1024; canvas.height = 128;
  const context = canvas.getContext('2d'); if (!context) return null;
  context.clearRect(0, 0, 1024, 128); context.font = '700 72px system-ui, -apple-system, "Segoe UI", sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
  if ('letterSpacing' in context) context.letterSpacing = '10px';
  context.fillStyle = 'rgba(38, 74, 44, .62)'; context.fillText(text, 512, 68, 990);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4; return texture;
}

export function buildMapDetail(T, world, detail) {
  const group = new T.Group(); group.name = 'Abuja map city detail'; world.add(group);
  const keep = [], matrix = new T.Matrix4(), position = new T.Vector3(), scale = new T.Vector3(), rotation = new T.Quaternion(), tint = new T.Color(), up = new T.Vector3(0, 1, 0);
  const material = (color, options = {}) => { const m = new T.MeshStandardMaterial({ color, roughness: .84, metalness: 0, ...options }); keep.push(m); return m; };
  const instanced = (geometry, mat, count, shadow = false) => { keep.push(geometry); const mesh = new T.InstancedMesh(geometry, mat, Math.max(1, count)); mesh.count = 0; mesh.castShadow = shadow; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh); return mesh; };
  const put = (mesh, x, y, z, sx, sy, sz, color, yaw = 0) => { position.set(x, y, z); scale.set(sx, sy, sz); rotation.setFromAxisAngle(up, yaw); mesh.setMatrixAt(mesh.count, matrix.compose(position, rotation, scale)); if (color) mesh.setColorAt(mesh.count, tint.set(color)); mesh.count++; };

  const box = new T.BoxGeometry(1, 1, 1), bodies = instanced(box, material('#ffffff'), detail.houses.length, true), flats = instanced(box, material('#ffffff'), detail.houses.length);
  const roofGeometry = new T.BufferGeometry();
  roofGeometry.setAttribute('position', new T.Float32BufferAttribute([-.5, 0, -.5, 0, 1, -.5, .5, 0, -.5, -.5, 0, .5, 0, 1, .5, .5, 0, .5], 3));
  roofGeometry.setIndex([0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, 0, 1, 2, 3, 5, 4]); roofGeometry.computeVertexNormals();
  const pitched = instanced(roofGeometry, material('#ffffff', { roughness: .72, side: T.DoubleSide }), detail.houses.length);
  for (const house of detail.houses) {
    put(bodies, house.x, 3 + house.h / 2, house.z, house.w, house.h, house.d, house.wall, -house.yaw);
    if (house.pitched) put(pitched, house.x, 3 + house.h, house.z, house.w + 6, house.w * .3, house.d + 6, house.roof, -house.yaw);
    else put(flats, house.x, 3 + house.h + 2, house.z, house.w + 3, 4, house.d + 3, house.roof, -house.yaw);
  }

  const trunks = instanced(new T.CylinderGeometry(.7, 1, 1, 5), material('#7b6046', { roughness: .95 }), detail.trees.length + detail.roundabouts.length);
  const canopies = instanced(new T.IcosahedronGeometry(1, 0), material('#ffffff', { roughness: .95, flatShading: true }), detail.trees.length + detail.roundabouts.length, true);
  const greens = ['#2f7a34', '#3a8a3c', '#286c30', '#44924a', '#33803a', '#226329'];
  for (const tree of detail.trees) {
    if (tree.forest) { put(canopies, tree.x, 3 + tree.s * .7, tree.z, tree.s, tree.s * .9, tree.s, greens[Math.floor(tree.tint * greens.length)], tree.tint * 6); continue; }
    put(trunks, tree.x, 3 + tree.s * .5, tree.z, tree.s * .16, tree.s, tree.s * .16); put(canopies, tree.x, 3 + tree.s * 1.35, tree.z, tree.s * .95, tree.s * .85, tree.s * .95, greens[Math.floor(tree.tint * greens.length)], tree.tint * 6);
  }

  const rings = instanced(new T.CylinderGeometry(1, 1, 1, 28), material('#56676a', { roughness: .92 }), detail.roundabouts.length);
  const islands = instanced(new T.CylinderGeometry(1, 1, 1, 24), material('#69b356', { roughness: .95 }), detail.roundabouts.length);
  for (const node of detail.roundabouts) { put(rings, node.x, 2.6, node.z, node.r, 4.4, node.r); put(islands, node.x, 5, node.z, node.r * .52, 5, node.r * .52); put(trunks, node.x, 12, node.z, 3, 14, 3); put(canopies, node.x, 27, node.z, 15, 13, 15, '#3f8f3f'); }

  const rockMaterial = material('#8f8c84', { roughness: .97, flatShading: true }), rockGeometry = new T.DodecahedronGeometry(1, 1); keep.push(rockGeometry);
  for (const rock of detail.rocks) for (const [ox, oz, k] of [[0, 0, 1], [-.72, .34, .5], [.66, -.3, .42], [.2, .7, .3]]) {
    const mesh = new T.Mesh(rockGeometry, rockMaterial); mesh.position.set(rock.x + ox * rock.size[0], rock.size[1] * k * .34, rock.z + oz * rock.size[2]);
    mesh.scale.set(rock.size[0] * k, rock.size[1] * k, rock.size[2] * k); mesh.rotation.set(.12 * k, ox * 2 + .4, -.08); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }

  const labelGeometry = new T.PlaneGeometry(1, 1); keep.push(labelGeometry);
  for (const label of detail.labels) {
    const texture = labelTexture(T, label.text); if (!texture) continue; keep.push(texture);
    const mat = new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }); keep.push(mat);
    const mesh = new T.Mesh(labelGeometry, mat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(label.x, 6.5, label.z); mesh.scale.set(label.width, label.height, 1); mesh.renderOrder = 2; group.add(mesh);
  }
  group.traverse(node => { if (node.isInstancedMesh) { node.instanceMatrix.needsUpdate = true; if (node.instanceColor) node.instanceColor.needsUpdate = true; } });
  return { group, stats: { houses: detail.houses.length, trees: detail.trees.length, roundabouts: detail.roundabouts.length, labels: detail.labels.length, rocks: detail.rocks.length },
    dispose() { for (const item of keep) item.dispose(); group.traverse(node => { if (node.isInstancedMesh) node.dispose(); }); world.remove(group); } };
}

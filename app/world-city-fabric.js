// Procedural city fabric for the playable street scene.
//
// The authored scene has a full road grid but only a few dozen hand-placed
// buildings. This layer fills every block between the roads with buildings in
// the character of the district, plus street lights, trees, kiosks and rooftop
// water tanks. Generation is deterministic per district, never covers a road,
// an authored building or the approach to an interaction point, and the 3D side
// draws everything with instancing (about a dozen draw calls in total).

// Road geometry shared with the authored scene (world-city-base.js / world-3d-scenes.js).
export const CITY_ROADS = Object.freeze({
  horizontal: Object.freeze([[722, 252], [1534, 234], [2284, 234], [3170, 234]]),
  vertical: Object.freeze([[1820, 254], ...[3740, 4440, 5140, 5840, 6540, 7240, 7940, 8540, 9380, 10220, 11000].map(x => [x, 96])]),
});

const CORE = new Set(['central-area', 'sector-a', 'sector-b', 'sector-c', 'sector-d', 'sector-e', 'sector-f', 'sector-g', 'sector-h']);
const COMMERCIAL = new Set(['garki-i', 'garki-ii', 'wuse-i', 'wuse-ii-a07', 'wuse-ii-a08', 'utako', 'jabi', 'wuye', 'mabushi', 'kado', 'gudu', 'durumi', 'kukwaba', 'industrial-1', 'industrial-2', 'institution-research']);
const AFFLUENT = new Set(['maitama', 'maitama-ii', 'maitama-extension', 'asokoro', 'asokoro-extension', 'guzape', 'katampe', 'katampe-extension', 'jahi', 'gaduwa', 'kaura']);

/** Built character of a district. Everything not listed is a satellite town or outer estate. */
export function districtCharacter(placeId) {
  const id = String(placeId || '');
  return CORE.has(id) ? 'core' : COMMERCIAL.has(id) ? 'commercial' : AFFLUENT.has(id) ? 'affluent' : 'satellite';
}

const CHARACTER = Object.freeze({
  core: { lot: [240, 400], depth: [200, 270], gap: [56, 100], floors: [4, 14], rows: 2, pitched: 0, tank: 0, trees: 150, kiosks: 14,
    walls: ['#cfd6d8', '#b9c6cc', '#d8d4c6', '#aebbc2', '#c4cbc3', '#e0dccf'], roofs: ['#5d6a70', '#6c7478', '#4f5b60'] },
  commercial: { lot: [250, 400], depth: [200, 280], gap: [56, 96], floors: [2, 6], rows: 2, pitched: .12, tank: .25, trees: 190, kiosks: 46,
    walls: ['#e1d6bd', '#d6cdb6', '#cdd3c4', '#e7dcc6', '#c9c2ad', '#dcc9aa', '#bfcac4'], roofs: ['#6b6f66', '#7a6a58', '#5f6d68', '#8a5f4c'] },
  affluent: { lot: [300, 430], depth: [200, 260], gap: [90, 150], floors: [1, 2], rows: 2, pitched: .55, tank: .3, trees: 420, kiosks: 6,
    walls: ['#efe8d6', '#e8e2d1', '#f1ead9', '#e2dcc8', '#ece3cf'], roofs: ['#8a4f3d', '#6f7466', '#7d5a45', '#5f6a63'] },
  satellite: { lot: [200, 320], depth: [170, 240], gap: [40, 76], floors: [1, 3], rows: 2, pitched: .78, tank: .6, trees: 230, kiosks: 60,
    walls: ['#e3d5b8', '#d9c9a8', '#d2cdb9', '#e6dcc4', '#c9bfa6', '#dfd0b3', '#cfc7b0'], roofs: ['#9a4a38', '#7a3f33', '#3f6f8a', '#4f7d5c', '#8c8f8a', '#a35b3f'] },
});

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
const overlaps = (a, b, margin = 0) => a.x < b.x + b.w + margin && a.x + a.w + margin > b.x && a.y < b.y + b.h + margin && a.y + a.h + margin > b.y;

/**
 * @returns {{character:string, blocks:object[], lamps:object[], trees:object[], kiosks:object[], obstacles:object[]}}
 * Block `y` is the front (southern) edge, matching authored buildings; `top = y - h`.
 */
export function generateCityFabric({ width = 11200, height = 4190, placeId = 'abuja', obstacles = [], interactables = [], spawn = null } = {}) {
  const character = districtCharacter(placeId), rule = CHARACTER[character], random = seeded(`fabric:${placeId}`);
  const between = ([min, max]) => min + random() * (max - min), pick = list => list[Math.floor(random() * list.length)];
  const roads = [
    ...CITY_ROADS.horizontal.map(([y, h]) => ({ x: 0, y, w: width, h })),
    ...CITY_ROADS.vertical.filter(([x]) => x < width).map(([x, w]) => ({ x, y: 0, w, h: height })),
  ];
  // Keep the walk from every door, marker and the spawn point down to its road completely clear.
  const clear = [...interactables.map(point => ({ x: point.x - 130, y: point.y - 70, w: 260, h: 380 })), ...(spawn ? [{ x: spawn.x - 220, y: spawn.y - 200, w: 440, h: 420 }] : [])];
  const solid = obstacles.map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
  const free = (rect, margin) => rect.x >= 40 && rect.y >= 40 && rect.x + rect.w <= width - 40 && rect.y + rect.h <= height - 30
    && !roads.some(road => overlaps(rect, road, 26)) && !solid.some(o => overlaps(rect, o, margin)) && !clear.some(zone => overlaps(rect, zone, 0));

  const blocks = [];
  const bandEdges = [40, ...CITY_ROADS.horizontal.flatMap(([y, h]) => [y, y + h]), height - 30];
  for (let band = 0; band < bandEdges.length; band += 2) {
    const top = bandEdges[band] + 34, bottom = bandEdges[band + 1] - 40;
    let front = bottom;
    for (let row = 0; row < rule.rows + 1 && front - 150 > top; row++) {
      const depthLimit = front - top;
      let rowDepth = 0;
      for (let x = 60 + random() * 80; x < width - 240;) {
        const wanted = Math.round(between(rule.lot)), h = Math.round(Math.min(between(rule.depth), depthLimit));
        // Pack the block: if the preferred plot does not fit before the next road
        // or building, try progressively narrower plots before moving on.
        let rect = null, w = wanted;
        for (const factor of [1, .82, .66, .52]) {
          const width = Math.max(150, Math.round(wanted * factor)), candidate = { x: Math.round(x), y: front - h, w: width, h };
          if (h >= 150 && free(candidate, 26)) { rect = candidate; w = width; break; }
        }
        if (rect) {
          const floors = Math.round(between(rule.floors)), pitched = floors <= 3 && random() < rule.pitched;
          const block = { id: `fabric-${blocks.length}`, x: rect.x, y: front, w, h, floors, wall: pick(rule.walls), roof: pick(rule.roofs), pitched,
            tank: floors <= 4 && random() < rule.tank, shop: character !== 'affluent' && row === 0 && random() < (character === 'satellite' ? .45 : .7), lit: random() };
          blocks.push(block); solid.push(rect); rowDepth = Math.max(rowDepth, h);
          x += w + between(rule.gap);
        } else x += 44;
      }
      if (!rowDepth) break;
      front -= rowDepth + 56; // service lane between rows
    }
  }

  const lamps = [];
  for (const [y, h] of CITY_ROADS.horizontal) for (let x = 130; x < width - 60; x += 250) {
    if (CITY_ROADS.vertical.some(([vx, vw]) => x > vx - 40 && x < vx + vw + 40)) continue;
    lamps.push({ x, y: y - 16, side: -1 }, { x: x + 125, y: y + h + 16, side: 1 });
  }
  for (const [x, w] of CITY_ROADS.vertical.filter(([vx]) => vx < width)) for (let y = 150; y < height - 60; y += 330) {
    if (CITY_ROADS.horizontal.some(([hy, hh]) => y > hy - 40 && y < hy + hh + 40)) continue;
    lamps.push({ x: x - 14, y, side: -1 });
  }

  const trees = [], kiosks = [];
  for (let attempt = 0; trees.length < rule.trees && attempt < rule.trees * 14; attempt++) {
    const size = 30 + random() * 26, spot = { x: 60 + random() * (width - 120), y: 60 + random() * (height - 120), w: 1, h: 1 };
    if (!free({ x: spot.x - 16, y: spot.y - 16, w: 32, h: 32 }, 8)) continue;
    trees.push({ x: Math.round(spot.x), y: Math.round(spot.y), size: Math.round(size), palm: random() < (character === 'affluent' ? .4 : .22), tint: random() });
  }
  // Roadside kiosks stand on the pavement just above each road.
  for (let attempt = 0; kiosks.length < rule.kiosks && attempt < rule.kiosks * 12; attempt++) {
    const [roadY] = CITY_ROADS.horizontal[Math.floor(random() * CITY_ROADS.horizontal.length)];
    const rect = { x: Math.round(80 + random() * (width - 200)), y: roadY - 30 - 62, w: 58, h: 40 };
    if (!free(rect, 14) || kiosks.some(k => Math.abs(k.x - rect.x) < 150 && k.y === rect.y)) continue;
    kiosks.push({ ...rect, color: pick(['#d9a441', '#c8553d', '#3f7f5c', '#2f6f9a', '#e2e0d2', '#7a5c9a']) }); solid.push(rect);
  }

  // Roadside digital billboards stand on the pavement strip between the building
  // line and the kerb, facing the traffic. They keep clear of doors, side roads,
  // kiosks and buildings, but (unlike buildings) are allowed right beside the road.
  const billboards = [], besideRoad = rect => rect.x > 60 && rect.x + rect.w < width - 60 && !solid.some(o => overlaps(rect, o, 6)) && !clear.some(zone => overlaps(rect, zone, 0))
    && !CITY_ROADS.vertical.some(([vx, vw]) => rect.x < vx + vw + 30 && rect.x + rect.w > vx - 30);
  for (const [index, [roadY, roadH]] of CITY_ROADS.horizontal.entries()) for (let x = 520 + index * 230, onRoad = 0; x < width - 300 && onRoad < 4; x += 90) {
    const north = (billboards.length + index) % 2 === 0, y = north ? roadY - 20 : roadY + roadH + 20, rect = { x: x - 95, y: y - 7, w: 190, h: 14 };
    if (!besideRoad(rect)) continue;
    billboards.push({ id: `street-board-${billboards.length + 1}`, x, y, width: 190, facing: north ? 1 : -1, mega: billboards.length % 4 === 0 }); solid.push(rect); onRoad++; x += 2300;
  }

  const fabricObstacles = [
    ...blocks.map(b => ({ x: b.x - 4, y: b.y - b.h - 6, w: b.w + 8, h: b.h + 12, fabric: true })),
    ...kiosks.map(k => ({ x: k.x, y: k.y, w: k.w, h: k.h, fabric: true })),
  ];
  return { character, blocks, lamps, trees, kiosks, billboards, obstacles: fabricObstacles };
}

/** Flat SVG fallback for devices without WebGL: simple footprints, no detail. */
export function cityFabricArt(fabric) {
  return `<g class="city-fabric" aria-hidden="true">${fabric.blocks.map(b => `<rect x="${b.x}" y="${b.y - b.h}" width="${b.w}" height="${b.h}" rx="6" fill="${b.wall}"/><rect x="${b.x - 4}" y="${b.y - b.h}" width="${b.w + 8}" height="9" rx="3" fill="${b.roof}"/>`).join('')}${fabric.kiosks.map(k => `<rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="4" fill="${k.color}"/>`).join('')}</g>`;
}

export const fabricBlockHeight = block => 30 + block.floors * 54;

/** Instanced 3D city fabric. `ds` converts scene y to 3D z, as everywhere else. */
export function buildCityFabric(T, fabric, { ds = Math.SQRT2, light = false } = {}) {
  const group = new T.Group(); group.name = `City fabric: ${fabric.character}`;
  const keep = [], matrix = new T.Matrix4(), position = new T.Vector3(), scale = new T.Vector3(), rotation = new T.Quaternion(), tint = new T.Color(), up = new T.Vector3(0, 1, 0);
  const material = (color, options = {}) => { const m = new T.MeshStandardMaterial({ color, roughness: .86, metalness: .02, ...options }); keep.push(m); return m; };
  const instanced = (geometry, mat, count, { cast = false, receive = true } = {}) => {
    keep.push(geometry);
    const mesh = new T.InstancedMesh(geometry, mat, Math.max(1, count)); mesh.count = 0; mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.frustumCulled = false; group.add(mesh); return mesh;
  };
  const put = (mesh, x, y, z, sx, sy, sz, color, yaw = 0) => {
    position.set(x, y, z); scale.set(sx, sy, sz); rotation.setFromAxisAngle(up, yaw);
    mesh.setMatrixAt(mesh.count, matrix.compose(position, rotation, scale)); if (color) mesh.setColorAt(mesh.count, tint.set(color)); mesh.count++;
  };
  const box = new T.BoxGeometry(1, 1, 1), blocks = fabric.blocks, floors = blocks.reduce((sum, b) => sum + b.floors, 0);
  const bodies = instanced(box, material('#ffffff'), blocks.length, { cast: true });
  const trims = instanced(box, material('#ffffff', { roughness: .8 }), blocks.length * 2);
  const roofGeometry = new T.BufferGeometry();
  roofGeometry.setAttribute('position', new T.Float32BufferAttribute([-.5, 0, -.5, 0, 1, -.5, .5, 0, -.5, -.5, 0, .5, 0, 1, .5, .5, 0, .5], 3));
  roofGeometry.setIndex([0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, 0, 1, 2, 3, 5, 4]); roofGeometry.computeVertexNormals();
  const pitched = instanced(roofGeometry, material('#ffffff', { roughness: .7, metalness: .12, side: T.DoubleSide }), blocks.filter(b => b.pitched).length);
  // Two window sets so only some rooms are lit after dark.
  const glassLit = material('#42606b', { roughness: .25, metalness: .3, emissive: '#ffd28a', emissiveIntensity: 0 });
  const glassDark = material('#3d5661', { roughness: .25, metalness: .3 });
  const perFloor = light ? 2 : 4, litWindows = instanced(box, glassLit, floors * perFloor, { receive: false }), darkWindows = instanced(box, glassDark, floors * perFloor, { receive: false });
  const doors = instanced(box, material('#ffffff', { roughness: .7 }), blocks.length, { receive: false });
  const awnings = instanced(box, material('#ffffff', { roughness: .8 }), blocks.filter(b => b.shop).length);
  const tanks = instanced(new T.CylinderGeometry(1, 1, 1, 10), material('#1d2326', { roughness: .6 }), blocks.filter(b => b.tank).length);

  for (const b of blocks) {
    const height = fabricBlockHeight(b), cx = b.x + b.w / 2, cz = (b.y - b.h / 2) * ds, depth = b.h * ds;
    put(bodies, cx, height / 2, cz, b.w, height, depth, b.wall);
    put(trims, cx, 6, cz, b.w + 6, 12, depth + 6, '#b9b6a4');
    if (b.pitched) { put(pitched, cx, height, cz, b.w + 26, Math.min(58, b.w * .16), depth + 24, b.roof); }
    else put(trims, cx, height + 7, cz, b.w + 10, 14, depth + 10, b.roof);
    for (let floor = 0; floor < b.floors; floor++) {
      const y = 30 + floor * 54 + 30, lit = (b.lit * 7 + floor * .37) % 1 < .55;
      if (floor > 0 || !b.shop) put(lit ? litWindows : darkWindows, cx, y, cz + depth / 2 + 1.5, b.w * .78, 26, 3);
      put((b.lit * 3 + floor * .61) % 1 < .5 ? litWindows : darkWindows, cx, y, cz - depth / 2 - 1.5, b.w * .74, 24, 3);
      if (!light) for (const side of [-1, 1]) put((b.lit * 5 + floor * .29 + side) % 1 < .5 ? litWindows : darkWindows, cx + side * (b.w / 2 + 1.5), y, cz, 3, 24, depth * .7);
    }
    if (b.shop) { put(litWindows, cx, 42, cz + depth / 2 + 1.5, b.w * .82, 46, 3); put(awnings, cx, 74, cz + depth / 2 + 16, b.w * .9, 5, 34, b.roof); }
    put(doors, cx + (b.shop ? 0 : b.w * .22), 36, cz + depth / 2 + 2.5, 38, 72, 4, b.shop ? '#2f4046' : '#6b4a33');
    if (b.tank) { const tx = cx - b.w * .28, ty = height + (b.pitched ? Math.min(58, b.w * .16) * .4 : 14) + 20; put(tanks, tx, ty, cz - depth * .22, 20, 40, 20); }
  }

  const poles = instanced(new T.CylinderGeometry(1, 1, 1, 6), material('#5a6468', { roughness: .5, metalness: .5 }), fabric.lamps.length, { receive: false });
  const lampGlow = material('#f4ecd0', { roughness: .4, emissive: '#ffd9a0', emissiveIntensity: 0 });
  const heads = instanced(box, lampGlow, fabric.lamps.length, { receive: false });
  for (const lamp of fabric.lamps) { put(poles, lamp.x, 72, lamp.y * ds, 3, 144, 3); put(heads, lamp.x, 146, (lamp.y + lamp.side * 16) * ds, 14, 6, 34); }

  const broad = fabric.trees.filter(tree => !tree.palm), palms = fabric.trees.filter(tree => tree.palm);
  const trunks = instanced(new T.CylinderGeometry(.7, 1, 1, 6), material('#7a5f45', { roughness: .95 }), fabric.trees.length, { receive: false });
  const canopies = instanced(new T.IcosahedronGeometry(1, light ? 0 : 1), material('#ffffff', { roughness: .95, flatShading: true }), broad.length, { cast: true, receive: false });
  const fronds = instanced(new T.ConeGeometry(1, 1, 7, 1, true), material('#ffffff', { roughness: .9, flatShading: true, side: T.DoubleSide }), palms.length, { receive: false });
  const greens = ['#4f7a3f', '#5d8a47', '#476c3b', '#6b9150', '#577f4a'];
  for (const tree of broad) { const s = tree.size; put(trunks, tree.x, s * .9, tree.y * ds, s * .14, s * 1.8, s * .14); put(canopies, tree.x, s * 2.3, tree.y * ds, s * 1.25, s * 1.05, s * 1.25, greens[Math.floor(tree.tint * greens.length)], tree.tint * 6); }
  for (const tree of palms) { const s = tree.size; put(trunks, tree.x, s * 1.9, tree.y * ds, s * .1, s * 3.8, s * .1); put(fronds, tree.x, s * 3.75, tree.y * ds, s * 1.7, s * .42, s * 1.7, greens[Math.floor(tree.tint * greens.length)]); }

  const stalls = instanced(box, material('#ffffff'), fabric.kiosks.length, { cast: true });
  const shades = instanced(new T.ConeGeometry(1, 1, 8), material('#ffffff', { roughness: .8 }), fabric.kiosks.length, { receive: false });
  for (const kiosk of fabric.kiosks) { const kx = kiosk.x + kiosk.w / 2, kz = (kiosk.y + kiosk.h / 2) * ds; put(stalls, kx, 24, kz, kiosk.w * .8, 48, kiosk.h * ds * .8, '#e7e1cf'); put(shades, kx, 64, kz, kiosk.w * .75, 26, kiosk.w * .75, kiosk.color); }

  group.traverse(node => {
    if (!node.isInstancedMesh) return;
    node.instanceMatrix.needsUpdate = true; if (node.instanceColor) node.instanceColor.needsUpdate = true;
    node.userData.excludeFromBounds = true;
  });
  let nightKey = null;
  return {
    group,
    stats: { blocks: blocks.length, lamps: fabric.lamps.length, trees: fabric.trees.length, kiosks: fabric.kiosks.length, drawCalls: group.children.length },
    update({ night = false } = {}) { if (night === nightKey) return; nightKey = night; glassLit.emissiveIntensity = night ? .85 : 0; lampGlow.emissiveIntensity = night ? 1.6 : 0; },
    dispose() { for (const item of keep) item.dispose(); group.traverse(node => { if (node.isInstancedMesh) node.dispose(); }); },
  };
}

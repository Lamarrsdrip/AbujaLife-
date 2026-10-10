// Horizon for the third-person street view: sky dome, far ground, a fogged
// Abuja skyline and the granite inselbergs that frame the real city. Everything
// here is distant scenery outside the authored, walkable scene rectangle; it has
// no collision, no gameplay state and uses three instanced draw calls at most.
const DAY = {top: '#3f86d8', horizon: '#cfe3f1', ground: '#7f8d58', fog: '#cfe0ea'};
const DUSK = {top: '#4e629c', horizon: '#f3c498', ground: '#78784f', fog: '#e6c3a2'};
const NIGHT = {top: '#070d1c', horizon: '#1c2740', ground: '#232c2b', fog: '#182236'};
const OVERCAST = {top: '#7f8d99', horizon: '#c3cbd0', ground: '#70805a', fog: '#bcc5ca'};

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

export function skyPalette({daylight = 1, night = false, condition = 'clear'} = {}) {
  if (night) return NIGHT;
  if (condition === 'rain' || condition === 'cloudy') return OVERCAST;
  return daylight < .3 ? DUSK : DAY;
}

export function createStreetBackdrop(T, {width = 1600, depth = 1400, seed = 'abuja', mobile = false} = {}) {
  const group = new T.Group(); group.name = 'AbujaLife street-view horizon'; group.visible = false;
  const random = seeded(seed), centerX = width / 2, centerZ = depth / 2, reach = Math.hypot(width, depth) / 2;
  const disposables = [];
  const keep = item => { disposables.push(item); return item; };

  const skyUniforms = {top: {value: new T.Color(DAY.top)}, horizon: {value: new T.Color(DAY.horizon)}};
  const sky = new T.Mesh(keep(new T.SphereGeometry(13500, 24, 12)), keep(new T.ShaderMaterial({
    uniforms: skyUniforms, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDirection;void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 horizon;varying vec3 vDirection;void main(){float h=clamp(vDirection.y,0.0,1.0);vec3 c=mix(horizon,top,pow(h,0.55));gl_FragColor=vec4(c,1.0);\n#include <colorspace_fragment>\n}',
  })));
  sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);

  const groundMaterial = keep(new T.MeshStandardMaterial({color: DAY.ground, roughness: 1, metalness: 0}));
  const ground = new T.Mesh(keep(new T.CircleGeometry(13000, 40)), groundMaterial);
  ground.rotation.x = -Math.PI / 2; ground.position.set(centerX, -2.5, centerZ); ground.receiveShadow = false; group.add(ground);

  // Distant blocks: denser and taller toward one "city centre" bearing so the
  // skyline reads as a capital rather than an even ring of boxes.
  const towerCount = mobile ? 90 : 150, towerGeometry = keep(new T.BoxGeometry(1, 1, 1));
  const towerMaterial = keep(new T.MeshStandardMaterial({color: '#ffffff', roughness: .82, metalness: .04}));
  const towers = new T.InstancedMesh(towerGeometry, towerMaterial, towerCount);
  const matrix = new T.Matrix4(), position = new T.Vector3(), scale = new T.Vector3(), quaternion = new T.Quaternion(), tint = new T.Color();
  const cityBearing = random() * Math.PI * 2, tones = ['#d9d3c4', '#c9cfd2', '#e4dccb', '#b9c4c8', '#cfc4b2', '#a9b7bd'];
  for (let i = 0; i < towerCount; i++) {
    const bearing = random() * Math.PI * 2, toward = Math.cos(bearing - cityBearing) * .5 + .5;
    const radius = reach + 520 + random() * 3600, tall = random() < .12 + toward * .3;
    const w = 150 + random() * 260, d = 150 + random() * 260, h = tall ? 520 + random() * 760 * (.5 + toward) : 130 + random() * 260;
    position.set(centerX + Math.sin(bearing) * radius, h / 2 - 2, centerZ + Math.cos(bearing) * radius);
    quaternion.setFromAxisAngle(T.Object3D.DEFAULT_UP, random() * Math.PI); scale.set(w, h, d);
    towers.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    towers.setColorAt(i, tint.set(tones[Math.floor(random() * tones.length)]));
  }
  towers.instanceMatrix.needsUpdate = true; if (towers.instanceColor) towers.instanceColor.needsUpdate = true;
  towers.castShadow = false; towers.receiveShadow = false; towers.frustumCulled = false; group.add(towers);

  // Savanna tree line just beyond the playable set softens its rectangular edge.
  const treeCount = mobile ? 110 : 190, treeGeometry = keep(new T.IcosahedronGeometry(1, 1));
  const treeMaterial = keep(new T.MeshStandardMaterial({color: '#ffffff', roughness: .95, flatShading: true}));
  const trees = new T.InstancedMesh(treeGeometry, treeMaterial, treeCount), greens = ['#4f7a3f', '#5d8a47', '#476c3b', '#6b9150', '#577f4a'];
  for (let i = 0; i < treeCount; i++) {
    const bearing = random() * Math.PI * 2, radius = reach + 160 + random() * 1500, size = 70 + random() * 90;
    position.set(centerX + Math.sin(bearing) * radius, size * .78, centerZ + Math.cos(bearing) * radius);
    quaternion.setFromAxisAngle(T.Object3D.DEFAULT_UP, random() * Math.PI); scale.set(size * (1 + random() * .5), size, size * (1 + random() * .5));
    trees.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    trees.setColorAt(i, tint.set(greens[Math.floor(random() * greens.length)]));
  }
  trees.instanceMatrix.needsUpdate = true; if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
  trees.castShadow = false; trees.frustumCulled = false; group.add(trees);

  // Aso Rock and smaller outcrops: broad grey granite domes on the horizon.
  const rockMaterial = keep(new T.MeshStandardMaterial({color: '#8b8a83', roughness: .96, flatShading: true}));
  const rockGeometry = keep(new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const rockBearing = cityBearing + Math.PI * (.55 + random() * .5);
  for (const [offset, radius, w, h, d] of [[0, 7600, 2500, 1500, 1500], [.2, 8200, 1300, 780, 1000], [-.27, 8600, 1500, 620, 1100], [2.6, 9000, 1700, 900, 1200]]) {
    const rock = new T.Mesh(rockGeometry, rockMaterial), bearing = rockBearing + offset;
    rock.position.set(centerX + Math.sin(bearing) * radius, -4, centerZ + Math.cos(bearing) * radius);
    rock.scale.set(w, h, d); rock.rotation.y = bearing; rock.frustumCulled = false; group.add(rock);
  }

  const fog = new T.Fog(DAY.fog, 1500, 9800);
  let paletteKey = '';
  return {
    group, fog,
    update({daylight = 1, night = false, condition = 'clear', eye, distance = 0} = {}) {
      if (eye) sky.position.set(eye.x, 0, eye.z);
      // Haze starts beyond the resident, however far the eye has pulled back, so an
      // aerial view shows the city instead of a wall of fog.
      const rain = condition === 'rain', reach = Math.max(0, Number(distance) || 0);
      fog.near = (rain ? 900 : 1500) + reach * 1.1; fog.far = (rain ? 6200 : 9800) + reach * 2.2;
      const key = `${night ? 'n' : daylight < .3 ? 'k' : 'd'}:${condition}`;
      if (key === paletteKey) return;
      paletteKey = key;
      const palette = skyPalette({daylight, night, condition});
      skyUniforms.top.value.set(palette.top); skyUniforms.horizon.value.set(palette.horizon);
      groundMaterial.color.set(palette.ground); fog.color.set(palette.fog);
    },
    dispose() { for (const item of disposables) item.dispose(); towers.dispose(); trees.dispose(); },
  };
}

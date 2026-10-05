// Small, original procedural surfaces. Each scene owns one library, so a product
// preview cannot dispose textures used by the live world or hold another context.
export function createWorldMaterialLibrary(T, {size = 128} = {}) {
  const textures = new Map(), materials = new Map();
  const clamp = value => Math.max(0, Math.min(255, Math.round(value)));
  function texture(type, repeatX = 1, repeatY = 1) {
    const key = `${type}:${repeatX.toFixed(3)}:${repeatY.toFixed(3)}`;
    if (textures.has(key)) return textures.get(key);
    const baseKey = `${type}:1.000:1.000`;
    if (key !== baseKey) {
      const map = texture(type).clone(); map.repeat.set(repeatX, repeatY);
      textures.set(key, map); return map;
    }
    const data = new Uint8Array(size * size * 4);
    let seed = 9137;
    const noise = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = x / size, ny = y / size, n = noise();
      let shade = 248;
      if (type === 'wood') shade = 243 + Math.sin(ny * 76 + Math.sin(nx * 12) * .9) * 7 + (n - .5) * 5;
      else if (type === 'fabric') shade = 241 + (x % 4 < 2 ? 7 : -3) + (y % 4 < 2 ? 4 : -5) + (n - .5) * 4;
      else if (type === 'stone') shade = 246 - Math.max(0, Math.sin(nx * 17 + ny * 29 + Math.sin(ny * 13) * 2) - .9) * 58 + (n - .5) * 5;
      else if (type === 'tile' || type === 'bath') shade = x % 32 < 1 || y % 32 < 1 ? 198 : 245 + (n - .5) * 5;
      else if (type === 'road') shade = 234 + (n - .5) * 29;
      else if (type === 'grass') shade = 235 + (n - .5) * 28 + Math.sin(nx * 70 + ny * 31) * 5;
      else if (type === 'rug') shade = 229 + (x % 3 ? 8 : -5) + (y % 3 ? 5 : -7) + (n - .5) * 5;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = clamp(shade); data[i + 3] = 255;
    }
    const map = new T.DataTexture(data, size, size, T.RGBAFormat);
    map.name = `AbujaLife authored ${type}`; map.colorSpace = T.SRGBColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping; map.magFilter = T.LinearFilter;
    map.minFilter = T.LinearMipmapLinearFilter; map.generateMipmaps = true; map.needsUpdate = true;
    map.userData = {surface: type, authored: true}; textures.set(key, map); return map;
  }
  const defaults = {
    wood: {roughness: .57, bumpScale: .19}, fabric: {roughness: .94, bumpScale: .11},
    stone: {roughness: .36, bumpScale: .04}, tile: {roughness: .47, bumpScale: .07},
    bath: {roughness: .48, bumpScale: .06}, road: {roughness: .98, bumpScale: .23},
    grass: {roughness: 1, bumpScale: .20}, rug: {roughness: 1, bumpScale: .20},
    ceramic: {roughness: .23, metalness: .05}, metal: {roughness: .28, metalness: .72},
    glass: {roughness: .13, metalness: .08, transparent: true, opacity: .35, depthWrite: false}
  };
  function material(type, color = '#ffffff', extra = {}) {
    const key = JSON.stringify([type, color, extra]);
    if (materials.has(key)) return materials.get(key);
    const {repeatX = 1, repeatY = 1, ...options} = extra;
    const textured = ['wood','fabric','stone','tile','bath','road','grass','rug'].includes(type);
    const map = textured ? texture(type, repeatX, repeatY) : null;
    const result = new T.MeshStandardMaterial({color, metalness: 0, ...defaults[type],
      ...(map ? {map, bumpMap: map} : {}), ...options});
    result.name = `AbujaLife ${type}`; result.userData.surface = type; materials.set(key, result); return result;
  }
  return {texture, material,
    stats: () => ({textures: textures.size, materials: materials.size, size}),
    dispose() { for (const map of textures.values()) map.dispose(); for (const mat of materials.values()) mat.dispose(); textures.clear(); materials.clear(); }
  };
}

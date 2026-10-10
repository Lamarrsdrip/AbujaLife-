// Roadside digital billboards in the playable street. Each board rotates through
// the live advertising campaigns, one every 15 seconds, so a paid campaign is
// seen where residents actually walk and drive. With no campaigns a board shows
// an "advertise here" house panel. Presentation only: it reads the same campaign
// snapshot the Map uses and changes nothing about placements, pricing or payment.
import { adCampaignId, activeAdAt } from './ad-state.js';

export const STREET_BILLBOARD = Object.freeze({ rotateMs: 15000, maxTextures: 8, textureWidth: 512, aspect: .5 });

/** Which campaign a board shows at a given moment. Boards are offset so neighbours differ. */
export function boardCampaign(campaigns, boardIndex, now) {
  if (!campaigns.length) return null;
  return campaigns[(Math.floor(now / STREET_BILLBOARD.rotateMs) + boardIndex) % campaigns.length];
}
export function liveCampaigns(state, now) {
  const seen = new Set();
  return (state?.active || []).filter(ad => activeAdAt(ad, now) && /^data:image\/(?:png|jpeg|webp);base64,/.test(String(ad.imageDataUrl || '')) && !seen.has(adCampaignId(ad)) && seen.add(adCampaignId(ad)));
}

function housePanel(T, makeCanvas) {
  const canvas = makeCanvas(); if (!canvas?.getContext) return null; canvas.width = 512; canvas.height = 256;
  const c = canvas.getContext('2d'); if (!c) return null;
  const g = c.createLinearGradient(0, 0, 512, 256); g.addColorStop(0, '#1f4a3a'); g.addColorStop(1, '#2f7a57'); c.fillStyle = g; c.fillRect(0, 0, 512, 256);
  c.fillStyle = '#ffd35a'; c.font = '800 46px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('ADVERTISE HERE', 256, 112);
  c.fillStyle = '#f6f1df'; c.font = '600 24px system-ui, sans-serif'; c.fillText('Your business · seen across Abuja', 256, 158); c.font = '500 20px system-ui, sans-serif'; c.fillText('abujacity.life', 256, 198);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}

export function buildStreetBillboards(T, boards = [], { ds = Math.SQRT2, now = () => Date.now(), readAds = () => globalThis.__ABJ_ADS__,
  decode = source => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source; }),
  makeCanvas = () => globalThis.document?.createElement?.('canvas') } = {}) {
  const group = new T.Group(); group.name = 'Street digital billboards';
  const box = new T.BoxGeometry(1, 1, 1), plane = new T.PlaneGeometry(1, 1), frame = new T.MeshStandardMaterial({ color: '#1b2624', roughness: .6, metalness: .3 }), post = new T.MeshStandardMaterial({ color: '#5a6468', roughness: .5, metalness: .5 });
  const house = housePanel(T, makeCanvas), cache = new Map(), faces = [];
  let disposed = false, shownKey = '';
  for (const [index, board] of boards.entries()) {
    const width = board.mega ? board.width * 1.35 : board.width, height = width * STREET_BILLBOARD.aspect, lift = board.mega ? 150 : 118, root = new T.Group();
    root.position.set(board.x, 0, board.y * ds); root.rotation.y = board.facing > 0 ? 0 : Math.PI; group.add(root);
    for (const side of [-.3, .3]) { const leg = new T.Mesh(box, post); leg.scale.set(9, lift + height * .5, 9); leg.position.set(side * width, (lift + height * .5) / 2, -6); leg.castShadow = true; root.add(leg); }
    const back = new T.Mesh(box, frame); back.scale.set(width + 14, height + 14, 10); back.position.set(0, lift + height / 2, -6); back.castShadow = true; root.add(back);
    // The face is unlit so a campaign reads the same by day and glows after dark, like a real LED board.
    const face = new T.Mesh(plane, new T.MeshBasicMaterial({ map: house, color: '#ffffff', toneMapped: false, fog: true })); face.scale.set(width, height, 1); face.position.set(0, lift + height / 2, 0); root.add(face);
    face.userData = { boardId: board.id, boardIndex: index, campaignRef: '' }; faces.push(face);
  }
  group.traverse(node => { node.userData.excludeFromBounds = true; });
  function textureFor(ad) {
    const key = adCampaignId(ad); let row = cache.get(key);
    if (row) { cache.delete(key); cache.set(key, row); return row.texture; }
    while (cache.size >= STREET_BILLBOARD.maxTextures) { const [oldKey, old] = cache.entries().next().value; old.texture?.dispose(); cache.delete(oldKey); }
    row = { texture: null }; cache.set(key, row);
    void decode(ad.imageDataUrl).then(image => {
      if (disposed || cache.get(key) !== row) return;
      const canvas = makeCanvas(), w = image.naturalWidth || image.width || 1, h = image.naturalHeight || image.height || 1, target = STREET_BILLBOARD.aspect;
      canvas.width = STREET_BILLBOARD.textureWidth; canvas.height = Math.round(canvas.width * target);
      const c = canvas.getContext('2d'); c.fillStyle = '#10201a'; c.fillRect(0, 0, canvas.width, canvas.height);
      // Contain: the whole creative is always visible, letterboxed on the dark board.
      const scale = Math.min(canvas.width / w, canvas.height / h), dw = w * scale, dh = h * scale; c.drawImage(image, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
      row.texture = new T.CanvasTexture(canvas); row.texture.colorSpace = T.SRGBColorSpace; row.texture.anisotropy = 4; shownKey = '';
    }).catch(() => { cache.delete(key); });
    return null;
  }
  return {
    group,
    get diagnostics() { return { boards: faces.length, textures: cache.size, showing: faces.map(face => face.userData.campaignRef) }; },
    /** Cheap to call every frame: work happens only when the 15-second slot or the campaign list changes. */
    update() {
      if (disposed || !faces.length) return;
      const time = now(), campaigns = liveCampaigns(readAds(), time), slot = Math.floor(time / STREET_BILLBOARD.rotateMs), key = `${slot}:${campaigns.map(adCampaignId).join(',')}`;
      if (key === shownKey) return; shownKey = key;
      for (const face of faces) {
        const ad = boardCampaign(campaigns, face.userData.boardIndex, time), texture = ad ? textureFor(ad) : null;
        if (ad && !texture) shownKey = ''; // still decoding: try again next frame
        const map = texture || house; face.userData.campaignRef = ad && texture ? adCampaignId(ad) : ''; face.userData.ad = ad && texture ? ad : null;
        if (face.material.map !== map) { face.material.map = map; face.material.needsUpdate = true; }
      }
    },
    /** The board under a tap, with the advert it is showing right now (null = the house panel). */
    pick(raycaster) {
      if (disposed || !faces.length) return null;
      const hit = raycaster.intersectObjects(faces, false)[0];
      return hit ? { boardId: hit.object.userData.boardId, ad: hit.object.userData.ad || null, distance: hit.distance } : null;
    },
    dispose() { disposed = true; for (const row of cache.values()) row.texture?.dispose(); cache.clear(); house?.dispose(); for (const face of faces) face.material.dispose(); box.dispose(); plane.dispose(); frame.dispose(); post.dispose(); },
  };
}

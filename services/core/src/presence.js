import { invariant } from './errors.js';
export const heartbeatPresence = ({ store, districts, playerId, districtId, position, now = Date.now() }) => {
  invariant(districts.some(d => d.id === districtId), 'DISTRICT_NOT_FOUND', 'District not found.', 404);
  for (const k of ['x','y','z']) invariant(Number.isFinite(position?.[k]), 'INVALID_POSITION', 'Position is invalid.');
  store.updatePlayer(playerId, { districtId, position });
  return store.setPresence(playerId, { districtId, position: { ...position }, seenAt: now });
};
export const nearbyPlayers = ({ store, playerId, maxDistance = 100 }) => {
  const me = store.presence.get(playerId); if (!me) return [];
  return [...store.presence.entries()].filter(([id,p]) => id !== playerId && p.districtId === me.districtId).map(([id,p]) => ({ playerId:id, ...p, distance: Math.hypot(p.position.x-me.position.x,p.position.y-me.position.y,p.position.z-me.position.z) })).filter(p => p.distance <= maxDistance).sort((a,b)=>a.distance-b.distance);
};

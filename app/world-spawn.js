/**
 * A room exit is a new arrival on its own street, even when a paid journey
 * skipped the city's walking scene. Use the authored entrance, then retain
 * the resident's cosmetic street pose after this transition has been applied.
 */
export function worldEntryState(scene, profile = {}, saved) {
  const entry = profile.location?.kind === 'public' ? profile.location.exteriorEntry : null;
  const valid = entry && typeof entry.venueId === 'string' && entry.venueId.length <= 80 &&
    typeof entry.transitionId === 'string' && entry.transitionId.length > 0 && entry.transitionId.length <= 80;
  const entrance = valid && scene.interactables?.find(point => point.action === 'enter-venue' &&
    point.payload?.venueId === entry.venueId && Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!entrance) return { saved, spawn: scene.spawn, exteriorTransition: null };
  const exteriorTransition = entry.transitionId;
  return {
    saved: saved?.exteriorTransition === exteriorTransition ? saved : undefined,
    spawn: { x: entrance.x, y: entrance.y },
    exteriorTransition,
  };
}

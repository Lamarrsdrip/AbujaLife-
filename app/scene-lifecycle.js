// Only physical scene changes replace the renderer. Wallet, social and presence
// refreshes reconcile the existing scene, including overlapping travel responses.
export function playableSceneKey(view, state) {
  const p = state.profile;
  if (!p?.onboardingComplete || !['world', 'outside'].includes(view)) return null;
  const owner = p.location?.kind === 'visit' ? state.homeVisit?.ownerHome : null;
  const furnishing = owner || p;
  const home = furnishing.home || {};
  return JSON.stringify({
    view, resident: p.id, district: p.district, location: p.location,
    trip: p.activeTrip || null, appearance: p.appearance,
    home: {propertyId: home.propertyId, layoutId: home.layoutId, name: home.name,
      district: home.district, roomStyle: home.roomStyle, furnishingPreset: home.furnishingPreset},
    inventory: furnishing.inventory, layout: furnishing.furnitureLayout,
    stored: furnishing.storedFurniture, upgrades: furnishing.homeUpgrades,
    vehicle: p.vehiclePresence,
  });
}

// Authored game venues and prices, not verified business listings or property quotations.
// Neighbourhood names come from the atlas; the walkable streets are game scenery.
export const GAME_YEAR_MS = 28 * 86400000;
export const GAME_BILL_PERIOD_MS = 7 * 86400000;
export const ECONOMY_META = {
  currency: 'Abuja Naira',
  priceLabel: 'Game prices',
  description: 'Virtual prices are scaled for gameplay. They are not real Abuja market quotations.',
  rentPeriod: 'game year',
  rentPeriodDays: 28,
  billPeriodDays: 7,
};

export const LIFE_GOALS = [
  { id: 'explore', title: 'Find my Abuja rhythm', description: 'Explore the city, eat well and make time for yourself.' },
  { id: 'career', title: 'Build a career', description: 'Earn through work and grow your skills.' },
  { id: 'home', title: 'Create my dream home', description: 'Hunt for a home and furnish it your way.' },
  { id: 'drive', title: 'Own my first car', description: 'Save for your own wheels and explore by road.' },
];

export const VENUE_ACTIONS = [
  { id: 'jollof-chicken', venueId: 'restaurant', name: 'Jollof rice & chicken', cost: 1800, duration: 5, animation: 'eat', effects: { hunger: 42, mood: 5 } },
  { id: 'suya-plate', venueId: 'restaurant', name: 'Suya & a chilled drink', cost: 2200, duration: 5, animation: 'eat', effects: { hunger: 35, fun: 8, social: 5 } },
  { id: 'egusi-pounded-yam', venueId: 'restaurant', name: 'Egusi & pounded yam', cost: 2500, duration: 6, animation: 'eat', effects: { hunger: 52, energy: 5, mood: 5 } },
  { id: 'hotel-rest', venueId: 'hotel', name: 'Book a room & rest', cost: 6500, duration: 7, animation: 'rest', effects: { energy: 60, stress: -22, hunger: -12, mood: 8 } },
  { id: 'hotel-shower', venueId: 'hotel', name: 'Freshen up at the spa', cost: 1900, duration: 5, animation: 'shower', effects: { hygiene: 50, stress: -12, mood: 5 } },
  { id: 'gym-workout', venueId: 'gym', name: 'Train at the gym', cost: 1600, duration: 8, animation: 'exercise', effects: { energy: -16, hunger: -12, hygiene: -12, stress: -18, fun: 20, mood: 8 }, skill: 'Fitness' },
  { id: 'gym-recovery', venueId: 'gym', name: 'Stretch & recovery', cost: 800, duration: 5, animation: 'exercise', effects: { energy: 8, stress: -16, fun: 10 } },
  { id: 'cinema-film', venueId: 'cinema', name: 'Watch a film', cost: 3800, duration: 8, animation: 'watch', effects: { fun: 42, stress: -15, social: 8, hunger: -6 } },
  { id: 'groceries', venueId: 'grocery', name: 'Pick up a meal & essentials', cost: 1400, duration: 4, animation: 'shop', effects: { hunger: 28, mood: 4 } },
  { id: 'park-walk', venueId: 'park', name: 'Take a gentle walk', cost: 0, duration: 6, animation: 'walk', effects: { stress: -14, fun: 14, energy: -3, mood: 5 } },
  { id: 'park-picnic', venueId: 'park', name: 'Relax with a picnic', cost: 1200, duration: 6, animation: 'eat', effects: { hunger: 26, fun: 22, stress: -12 } },
  { id: 'coffee-break', venueId: 'cafe', name: 'Coffee & a small chop plate', cost: 1500, duration: 5, animation: 'eat', effects: { energy: 15, hunger: 20, social: 12, stress: -8 } },
  { id: 'salon-cut', venueId: 'salon', name: 'Grooming & a fresh look', cost: 2100, duration: 5, animation: 'groom', effects: { hygiene: 28, mood: 10, social: 7 } },
];

const venue = (id, name, category, description) => ({
  id, type: id, name, title: name, category, description,
  fictional: true,
  actionIds: VENUE_ACTIONS.filter(action => action.venueId === id).map(action => action.id),
});
export const VENUES = [
  venue('restaurant', 'Courtyard Kitchen', 'Food & dining', 'An authored neighbourhood restaurant serving Nigerian favourites.'),
  venue('hotel', 'Capital Palm Hotel', 'Stay & wellness', 'Book a room to recharge or visit the spa.'),
  venue('gym', 'Neighbourhood Fitness', 'Health & fitness', 'Training equipment, space to stretch and a recovery corner.'),
  venue('cinema', 'City Screen', 'Entertainment', 'A comfortable local cinema for a break from the working week.'),
  venue('grocery', 'Daily Essentials', 'Shopping', 'Pick up a meal and daily essentials.'),
  venue('park', 'Neighbourhood Garden', 'Outdoors', 'A pocket of green for walking, picnics and downtime.'),
  venue('dealership', 'Capital Motors', 'Cars', 'Compare virtual vehicles, buy your own car and take the wheel.'),
  venue('estate-office', 'Abuja Home Finder', 'Homes', 'Compare neighbourhoods, view homes and choose rent or ownership.'),
  venue('furniture-store', 'Room & Living', 'Furniture', 'Buy furniture, then arrange it in your own home.'),
  venue('cafe', 'The Corner Café', 'Food & dining', 'A coffee stop with small chops and a place to unwind.'),
  venue('salon', 'Fresh Studio', 'Personal care', 'Take a little time for grooming and your next look.'),
];

export const venueFor = id => VENUES.find(venue => venue.id === id) || null;
export const actionsForVenue = id => VENUE_ACTIONS.filter(action => action.venueId === id);
export const venueActionFor = id => VENUE_ACTIONS.find(action => action.id === id) || null;
export const ownsVehicle = (profile, catalog, id) => catalog.some(item => item.id === id && item.category === 'vehicle' && profile.inventory.includes(id));

const needs = new Set(['energy', 'hunger', 'hygiene', 'social', 'fun', 'stress', 'mood']);
export function applyNeedEffects(profile, effects) {
  for (const [key, amount] of Object.entries(effects || {})) {
    if (needs.has(key) && Number.isFinite(amount)) profile[key] = Math.max(0, Math.min(100, Math.round((profile[key] || 0) + amount)));
  }
  return profile;
}

// These fractions describe the authored game floor plan, never geographic coordinates.
export function furniturePlacement({ x, y, rotation = 0 } = {}) {
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1 || ![0, 90, 180, 270].includes(rotation)) {
    throw new Error('Choose a position inside your room and a valid furniture rotation');
  }
  return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, rotation };
}

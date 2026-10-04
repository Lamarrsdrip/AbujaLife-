// Authored game venues and prices, not verified business listings or property quotations.
// Neighbourhood names come from the atlas; the walkable streets are game scenery.
export const GAME_YEAR_MS = 28 * 86400000;
export const GAME_BILL_PERIOD_MS = 7 * 86400000;
export const ECONOMY_META = {
  currency: 'Naira',
  currencyCode: 'NGN',
  priceLabel: 'Game prices',
  description: 'Virtual prices are scaled for gameplay. They are not real Abuja market quotations.',
  rentPeriod: 'game year',
  rentPeriodDays: 28,
  billPeriodDays: 7,
};

export const WALLET_META = {
  currency: 'NGN', currencyName: 'Naira', currencyCode: 'NGN', balanceLabel: 'Naira balance', virtual: true, gameMoney: true, transferEnabled: true,
  maxBalance: 100000000, topupMin: 1000, topupMax: 5000000,
  topupDailyLimit: 20000000, topupWindowMs: 86400000,
  topupAmounts: [1000, 10000, 50000, 250000, 1000000, 5000000],
  topupLabel: 'Free game top-up', description: 'Game Naira has no cash value. Top-ups are free virtual funds; there is no payment or withdrawal.',
};
export const INVESTMENT_META = {
  virtual: true, periodMs: 60000, incomeBasisPoints: 20, maxAccruedPeriods: 60,
  sellCooldownMs: 60000, resaleBasisPoints: 9000,
  description: 'Simulated rent accrues every real minute, up to 60 minutes. These are game returns, not property prices or investment forecasts.',
};
export const DICE_META = {
  virtual: true, minStake: 100, maxStake: 5000, payoutMultiplier: 2,
  choices: [{ id: 'low', name: 'Low · 1–3' }, { id: 'high', name: 'High · 4–6' }],
  description: 'A fair six-sided die. Match your half to receive twice your stake; otherwise lose your stake. Game Naira only.',
};
export const HOME_UPGRADES = [
  { id: 'portable-ac', name: 'Portable air conditioner', category: 'furniture', price: 45000, cost: 45000, description: 'Cool down after a hot Abuja afternoon. Adds 6 energy when sleeping and reduces 6 more stress when relaxing.', effects: { sleepEnergy: 6, relaxStressReduction: 6 } },
  { id: 'power-inverter', name: 'Backup power inverter', category: 'furniture', price: 78000, cost: 78000, description: 'Steady backup power for your home. A fixed game benefit reduces weekly home service bills by 15%.', effects: { billDiscountPercent: 15 } },
  { id: 'premium-sofa', name: 'Premium sectional sofa', category: 'furniture', price: 56000, cost: 56000, description: 'A generous lounge setting for your Jabi or Maitama home. Adds 6 fun when relaxing.', effects: { relaxFun: 6 } },
  { id: 'king-bed', name: 'King-size bed', category: 'furniture', price: 65000, cost: 65000, description: 'A spacious upholstered bed for proper rest. Adds 10 energy when sleeping.', effects: { sleepEnergy: 10 } },
  { id: 'pool-table', name: 'Home pool table', category: 'furniture', price: 55000, cost: 55000, description: 'A statement piece for your games room. Place this decorative table wherever it fits.', effects: {} },
  { id: 'gaming-console', name: 'Gaming console & screen', category: 'furniture', price: 42000, cost: 42000, description: 'Set up your entertainment corner. Adds 12 fun when relaxing at home.', effects: { relaxFun: 12 } },
  { id: 'bar-cart', name: 'Hosting drinks trolley', category: 'furniture', price: 18000, cost: 18000, description: 'A polished drinks and serveware trolley for your lounge. A decorative home accent.', effects: {} },
  { id: 'art-piece', name: 'Contemporary art piece', category: 'furniture', price: 24000, cost: 24000, description: 'An original decorative artwork to bring colour and character to your home.', effects: {} },
];
export function homeBenefits(profile, property) {
  const result={sleepEnergyBonus:property?.tier>=3?4:0,relaxFunBonus:property?.tier>=3?4:0,relaxStressReduction:0,billDiscountPercent:0};
  for(const item of HOME_UPGRADES)if(profile?.inventory?.includes(item.id)){
    result.sleepEnergyBonus+=item.effects.sleepEnergy||0;
    result.relaxFunBonus+=item.effects.relaxFun||0;
    result.relaxStressReduction+=item.effects.relaxStressReduction||0;
    result.billDiscountPercent+=item.effects.billDiscountPercent||0;
  }
  return result;
}
export function investmentView(profile, property, now = Date.now()) {
  const investment = profile?.propertyInvestments?.[property?.id];
  if (!investment) return null;
  const incomePerPeriod = investment.incomePerPeriod;
  const periods = Math.max(0, Math.floor((now - investment.lastCollectedAt) / INVESTMENT_META.periodMs));
  return { ...investment, propertyId: property.id,
    incomePerPeriod, collectable: Math.min(periods, INVESTMENT_META.maxAccruedPeriods) * incomePerPeriod,
    canSellAt: investment.boughtAt + INVESTMENT_META.sellCooldownMs,
    resaleValue: investment.resaleValue,
    nextIncomeAt: investment.lastCollectedAt + INVESTMENT_META.periodMs,
  };
}

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
  { id: 'mosque-prayer', venueId: 'mosque', name: 'Take time for prayer', cost: 0, duration: 6, animation: 'pray', effects: { stress: -18, mood: 10 } },
  { id: 'mosque-community', venueId: 'mosque', name: 'Meet the community', cost: 0, duration: 6, animation: 'social', effects: { social: 20, mood: 6 } },
  { id: 'church-reflect', venueId: 'church', name: 'Prayer & quiet reflection', cost: 0, duration: 6, animation: 'pray', effects: { stress: -18, mood: 10 } },
  { id: 'church-community', venueId: 'church', name: 'Spend time with the community', cost: 0, duration: 6, animation: 'social', effects: { social: 20, mood: 6 } },
  { id: 'lake-walk', venueId: 'jabi-lake', name: 'Walk by the lake', cost: 0, duration: 7, animation: 'walk', effects: { stress: -22, fun: 20, energy: -4 } },
  { id: 'lake-picnic', venueId: 'jabi-lake', name: 'Lakeside picnic', cost: 1500, duration: 6, animation: 'eat', effects: { hunger: 28, social: 12, fun: 22 } },
  { id: 'club-dance', venueId: 'club', name: 'Dance to the DJ set', cost: 1800, duration: 8, animation: 'dance', effects: { fun: 35, social: 15, energy: -12, hygiene: -8 } },
  { id: 'club-refreshment', venueId: 'club', name: 'Water & small chops', cost: 1200, duration: 5, animation: 'eat', effects: { hunger: 20, energy: 8 } },
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
  venue('furniture-store', 'Okrika Marketplace', 'Shopping', 'Browse furniture, clothes and home essentials, then arrange your purchases at home.'),
  venue('cafe', 'The Corner Café', 'Food & dining', 'A coffee stop with small chops and a place to unwind.'),
  venue('salon', 'Fresh Studio', 'Personal care', 'Take a little time for grooming and your next look.'),
  venue('mosque', 'Neighbourhood Mosque', 'Faith & community', 'A respectful, peaceful space for prayer and community.'),
  venue('church', 'Community Church', 'Faith & community', 'Make time for prayer, reflection and community.'),
  { ...venue('jabi-lake', 'Jabi Lake', 'Outdoors', 'An authored lakeside game setting for walks, picnics and time by the water.'), districts: ['jabi'] },
  venue('club', 'After Hours Club', 'Nightlife', 'Music, dancing and refreshments in an authored city club.'),
  venue('games-lounge', 'Dice & Chill Lounge', 'Games', 'A simple chance game with virtual Naira, plus space to unwind.'),
];

export const venueFor = id => VENUES.find(venue => venue.id === id) || null;
export const venueAvailable = (id, district) => { const place = venueFor(id); return Boolean(place && (!place.districts || place.districts.includes(district))); };
export const venuesForDistrict = district => VENUES.filter(place => venueAvailable(place.id, district));
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

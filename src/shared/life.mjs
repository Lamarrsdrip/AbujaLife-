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

export const TRANSPORT_MODES = [
  { id: 'walk', name: 'Walk', description: 'Walk to the entrance in your current neighbourhood.' },
  { id: 'bus', name: 'City bus', description: 'A shared ride across the game city.' },
  { id: 'taxi', name: 'Taxi', description: 'A direct trip to your destination.' },
  { id: 'ride', name: 'Ride-hailing', description: 'A car pickup for your journey.' },
  { id: 'bike', name: 'Bike ride', description: 'A simulated motorbike ride in the game.' },
  { id: 'car', name: 'Your car', description: 'Drive a vehicle you own. Your own car has no per-trip game fare.' },
];

// Only registration uses this seed. Existing homes and purchases are never reseeded.
// Gifted-home furniture is resident-owned inventory, never permanent scenery. That means
// every starter piece can be stored, moved, replaced or sold through the normal authority path.
export function starterHomeSeed(origin) {
  const nepo = origin?.id === 'nepo';
  return {
    inventory: nepo ? ['bed', 'sofa', 'dining-table', 'fridge'] : [],
    furnitureLayout: {},
    storedFurniture: [],
    homeStyle: { furnishingPreset: nepo ? 'nepo-furnished' : 'lapo-basic', starterVersion: 1 },
  };
}

export const SYSTEM_RESALE_META = {
  virtual: true, buybackBasisPoints: 5000,
  description: 'The game system buys owned catalog items for 50% of their listed game price.',
};
export function systemResaleValue(item) {
  if (!Number.isSafeInteger(item?.price) || item.price < 0) throw new RangeError('This item has no valid game resale price');
  return Math.floor(item.price / 2);
}

// The server validates ownership and venue availability before quoting these game fares.
// Public transport carries a game fare. Driving a car the resident already owns is free;
// future fuel/maintenance mechanics must be explicit systems, never a hidden travel tax.
export function travelPricing(originPlace, destinationPlace, mode, { venueId = null } = {}) {
  const same = originPlace.id === destinationPlace.id;
  const distance = same ? venueId ? 4 : 0 : Math.max(4, Math.round(((destinationPlace.commute || 35) + (originPlace.commute || 35)) / 3));
  const cost = mode === 'walk' || mode === 'car' || !distance ? 0 : mode === 'bus' ? 250 + distance * 20 : mode === 'taxi' ? 650 + distance * 45 : mode === 'bike' ? 300 + distance * 30 : 900 + distance * 45;
  const seconds = mode === 'walk' || !distance ? 1 : 10 + Math.min(14, Math.max(4, Math.round(distance / (mode === 'bus' ? 2.5 : 4))));
  return { destination: destinationPlace.id, mode, cost, seconds, ...(venueId ? { venueId } : {}) };
}

export const WALLET_META = {
  currency: 'NGN', currencyName: 'Naira', currencyCode: 'NGN', balanceLabel: 'Naira balance', virtual: true, gameMoney: true, transferEnabled: true,
  uncapped: true, maxSafeInteger: Number.MAX_SAFE_INTEGER, topupMin: 1,
  topupAmounts: [1000, 10000, 50000, 250000, 1000000, 5000000],
  topupLabel: 'Free game top-up', description: 'Game Naira has no cash value. Top-ups are free virtual funds; there is no payment or withdrawal.',
};
export const INVESTMENT_META = {
  virtual: true, periodMs: 60000, incomeBasisPoints: 20, uncappedAccrual: true,
  sellCooldownMs: 60000, resaleBasisPoints: 9000,
  description: 'Simulated rent accrues every real minute without an accrual ceiling. These are game returns, not property prices or investment forecasts.',
};
export const DICE_META = {
  virtual: true, minStake: 100, uncappedStake: true, payoutMultiplier: 2,
  choices: [{ id: 'low', name: 'Low · 1–3' }, { id: 'high', name: 'High · 4–6' }],
  description: 'A fair six-sided die. Match your half to receive twice your stake; otherwise lose your stake. Game Naira only.',
};
export const LOAN_META = {
  id: 'lapo-style', name: 'LAPO-style game loan', virtual: true, optional: true,
  consentVersion: 'game-loan-v1', feeBasisPoints: 500, termDays: 28, termMs: 28 * 86400000,
  dailyPrincipalCap: 10_000_000, maxOutstandingPrincipal: 100_000_000, redrawAfterRepaymentPercent: 50,
  description: 'Optional fictional game borrowing: up to ₦10m of new principal per real day, with ₦100m total outstanding. Repay at least 50% before requesting another advance; a one-time 5% fee is due in 28 real days.',
  affiliation: 'This simulated game lender has no affiliation with LAPO Microfinance Bank.',
};
export function loanQuote(amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RangeError('Choose a positive whole Naira loan amount');
  const fee = (BigInt(amount) * BigInt(LOAN_META.feeBasisPoints) + 9999n) / 10000n;
  const total = BigInt(amount) + fee;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('This loan cannot be represented as exact whole Naira');
  return { principal: amount, fee: Number(fee), totalRepayment: Number(total), termDays: LOAN_META.termDays };
}
export function loanView(profile, now = Date.now()) {
  return (profile?.loans || []).map(loan => ({ ...loan, overdue: loan.outstanding > 0 && now >= loan.dueAt, canRepay: loan.outstanding > 0 }));
}
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
  const exactCollectable = BigInt(periods) * BigInt(incomePerPeriod), collectable = Number(exactCollectable);
  return { ...investment, propertyId: property.id,
    incomePerPeriod, collectable, collectableExact: exactCollectable.toString(), representable: Number.isSafeInteger(collectable),
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
  { id: 'jollof-chicken', venueId: 'restaurant', name: 'Jollof rice & chicken', cost: 1800, duration: 15, animation: 'eat', effects: { hunger: 42, mood: 5 } },
  { id: 'suya-plate', venueId: 'restaurant', name: 'Suya & a chilled drink', cost: 2200, duration: 15, animation: 'eat', effects: { hunger: 35, fun: 8, social: 5 } },
  { id: 'egusi-pounded-yam', venueId: 'restaurant', name: 'Egusi & pounded yam', cost: 2500, duration: 16, animation: 'eat', effects: { hunger: 52, energy: 5, mood: 5 } },
  { id: 'hotel-rest', venueId: 'hotel', name: 'Book a room & rest', cost: 6500, duration: 17, animation: 'rest', effects: { energy: 60, stress: -22, hunger: -12, mood: 8 } },
  { id: 'hotel-shower', venueId: 'hotel', name: 'Freshen up at the spa', cost: 1900, duration: 15, animation: 'shower', effects: { hygiene: 50, stress: -12, mood: 5 } },
  { id: 'gym-workout', venueId: 'gym', name: 'Train at the gym', cost: 1600, duration: 18, animation: 'exercise', effects: { energy: -16, hunger: -12, hygiene: -12, stress: -18, fun: 20, mood: 8 }, skill: 'Fitness' },
  { id: 'gym-recovery', venueId: 'gym', name: 'Stretch & recovery', cost: 800, duration: 15, animation: 'exercise', effects: { energy: 8, stress: -16, fun: 10 } },
  { id: 'cinema-film', venueId: 'cinema', name: 'Watch a film', cost: 3800, duration: 18, animation: 'watch', effects: { fun: 42, stress: -15, social: 8, hunger: -6 } },
  { id: 'groceries', venueId: 'grocery', name: 'Pick up a meal & essentials', cost: 1400, duration: 14, animation: 'shop', effects: { hunger: 28, mood: 4 } },
  { id: 'park-walk', venueId: 'park', name: 'Take a gentle walk', cost: 0, duration: 16, animation: 'walk', effects: { stress: -14, fun: 14, energy: -3, mood: 5 } },
  { id: 'park-picnic', venueId: 'park', name: 'Relax with a picnic', cost: 1200, duration: 16, animation: 'eat', effects: { hunger: 26, fun: 22, stress: -12 } },
  { id: 'coffee-break', venueId: 'cafe', name: 'Coffee & a small chop plate', cost: 1500, duration: 15, animation: 'eat', effects: { energy: 15, hunger: 20, social: 12, stress: -8 } },
  { id: 'salon-cut', venueId: 'salon', name: 'Grooming & a fresh look', cost: 2100, duration: 15, animation: 'groom', effects: { hygiene: 28, mood: 10, social: 7 } },
  { id: 'mosque-prayer', venueId: 'mosque', name: 'Take time for prayer', cost: 0, duration: 16, animation: 'pray', effects: { stress: -18, mood: 10 } },
  { id: 'mosque-community', venueId: 'mosque', name: 'Meet the community', cost: 0, duration: 16, animation: 'social', effects: { social: 20, mood: 6 } },
  { id: 'church-reflect', venueId: 'church', name: 'Prayer & quiet reflection', cost: 0, duration: 16, animation: 'pray', effects: { stress: -18, mood: 10 } },
  { id: 'church-community', venueId: 'church', name: 'Spend time with the community', cost: 0, duration: 16, animation: 'social', effects: { social: 20, mood: 6 } },
  { id: 'lake-walk', venueId: 'jabi-lake', name: 'Walk by the lake', cost: 0, duration: 17, animation: 'walk', effects: { stress: -22, fun: 20, energy: -4 } },
  { id: 'lake-picnic', venueId: 'jabi-lake', name: 'Lakeside picnic', cost: 1500, duration: 16, animation: 'eat', effects: { hunger: 28, social: 12, fun: 22 } },
  { id: 'club-dance', venueId: 'club', name: 'Tokyo · dance to the DJ set', cost: 8000, duration: 18, animation: 'dance', effects: { fun: 40, social: 20, energy: -12, hygiene: -8 } },
  { id: 'club-refreshment', venueId: 'club', name: 'Tokyo · refreshments & small chops', cost: 6000, duration: 15, animation: 'eat', effects: { hunger: 25, energy: 8, social: 10 } },
  { id: 'tokyo-vip', venueId: 'club', name: 'Tokyo · VIP lounge & music', cost: 16000, duration: 17, animation: 'social', effects: { fun: 35, social: 30, stress: -12, energy: -4 } },
  { id: 'cage-dance', venueId: 'club-cage', name: 'Cage · dance floor', cost: 4000, duration: 18, animation: 'dance', effects: { fun: 35, social: 18, energy: -12, hygiene: -8 } },
  { id: 'cage-drinks', venueId: 'club-cage', name: 'Cage · drinks & music', cost: 8000, duration: 15, animation: 'eat', effects: { hunger: 18, fun: 20, social: 16, energy: 6 } },
  { id: 'magic-city-stage', venueId: 'magic-city', name: 'Magic City · stage entertainment', cost: 6000, duration: 18, animation: 'watch', effects: { fun: 40, social: 15, stress: -10, energy: -5 } },
  { id: 'magic-city-vip', venueId: 'magic-city', name: 'Magic City · VIP lounge', cost: 12000, duration: 17, animation: 'social', effects: { fun: 30, social: 30, stress: -12, energy: -4 } },
  { id: 'bear-barn-relax', venueId: 'bear-barn', name: 'Bear Barn · unwind with music', cost: 2500, duration: 16, animation: 'social', effects: { fun: 24, social: 20, stress: -16, energy: -3 } },
  { id: 'bear-barn-drinks', venueId: 'bear-barn', name: 'Bear Barn · drinks & small chops', cost: 4500, duration: 15, animation: 'eat', effects: { hunger: 24, fun: 16, social: 12, energy: 6 } },

  // Purposeful Abuja multiplayer hubs. These actions make each destination more than scenery:
  // residents share the same venue zone, can meet there, and have activities that fit the place.
  { id:'city-gate-meet', venueId:'city-gate-plaza', name:'Meet at the City Gate', cost:0, duration:14, animation:'social', effects:{social:20,fun:8,mood:6} },
  { id:'city-gate-photo', venueId:'city-gate-plaza', name:'Take a City Gate photo', cost:0, duration:14, animation:'watch', effects:{fun:12,mood:7} },
  { id:'aso-view-walk', venueId:'aso-rock-view', name:'Walk the Aso Rock viewpoint', cost:0, duration:18, animation:'walk', effects:{stress:-20,fun:18,energy:-4,mood:8} },
  { id:'aso-view-meet', venueId:'aso-rock-view', name:'Meet friends at the viewpoint', cost:0, duration:16, animation:'social', effects:{social:22,stress:-10,fun:12} },
  { id:'cbn-exhibit', venueId:'cbn-experience', name:'Explore money & economic history', cost:0, duration:17, animation:'watch', effects:{fun:8,mood:5} },
  { id:'cbn-career', venueId:'cbn-experience', name:'Attend a finance career session', cost:0, duration:18, animation:'social', effects:{social:10,mood:8} },
  { id:'magicland-rides', venueId:'magicland', name:'Go on the rides', cost:3500, duration:19, animation:'ride', effects:{fun:48,social:14,energy:-8,stress:-18,mood:10} },
  { id:'magicland-arcade', venueId:'magicland', name:'Play in the arcade', cost:2500, duration:18, animation:'play', effects:{fun:38,social:16,energy:-4,mood:8} },
  { id:'magicland-meet', venueId:'magicland', name:'Meet up inside the park', cost:0, duration:15, animation:'social', effects:{social:24,fun:14} },
  { id:'farmcity-meal', venueId:'farm-city', name:'Eat at Farm City', cost:4500, duration:17, animation:'eat', effects:{hunger:48,fun:14,social:12,mood:8} },
  { id:'farmcity-arcade', venueId:'farm-city', name:'Play at the game arcade', cost:2200, duration:17, animation:'play', effects:{fun:34,social:18,stress:-10} },
  { id:'farmcity-hangout', venueId:'farm-city', name:'Hang out with friends', cost:1200, duration:17, animation:'social', effects:{social:30,fun:20,stress:-12} },
  { id:'transcorp-lobby', venueId:'transcorp-hilton-hub', name:'Meet in the lobby', cost:0, duration:16, animation:'social', effects:{social:25,stress:-8,mood:8} },
  { id:'transcorp-pool', venueId:'transcorp-hilton-hub', name:'Spend time by the pool', cost:3500, duration:18, animation:'relax', effects:{fun:28,stress:-24,energy:8,mood:8} },
  { id:'transcorp-dining', venueId:'transcorp-hilton-hub', name:'Dinner at the hotel', cost:5500, duration:18, animation:'eat', effects:{hunger:45,fun:16,social:16,mood:8} },
  { id:'millennium-walk', venueId:'millennium-park-hub', name:'Walk through Millennium Park', cost:0, duration:18, animation:'walk', effects:{stress:-22,fun:18,energy:-4,mood:7} },
  { id:'millennium-picnic', venueId:'millennium-park-hub', name:'Picnic in the park', cost:1200, duration:17, animation:'eat', effects:{hunger:25,fun:24,social:15,stress:-12} },
  { id:'millennium-meet', venueId:'millennium-park-hub', name:'Meet friends on the lawn', cost:0, duration:16, animation:'social', effects:{social:28,fun:12} },
  { id:'eagle-square-meet', venueId:'eagle-square-hub', name:'Meet at Eagle Square', cost:0, duration:16, animation:'social', effects:{social:24,fun:10,mood:6} },
  { id:'eagle-square-event', venueId:'eagle-square-hub', name:'Attend a public city event', cost:0, duration:18, animation:'watch', effects:{fun:24,social:16,mood:8} },
  { id:'national-mosque-prayer', venueId:'national-mosque-hub', name:'Prayer & reflection', cost:0, duration:16, animation:'pray', effects:{stress:-20,mood:10} },
  { id:'national-mosque-community', venueId:'national-mosque-hub', name:'Spend time with the community', cost:0, duration:16, animation:'social', effects:{social:22,mood:6} },
  { id:'national-christian-reflect', venueId:'national-christian-centre-hub', name:'Prayer & reflection', cost:0, duration:16, animation:'pray', effects:{stress:-20,mood:10} },
  { id:'national-christian-community', venueId:'national-christian-centre-hub', name:'Spend time with the community', cost:0, duration:16, animation:'social', effects:{social:22,mood:6} },
  { id:'stadium-train', venueId:'national-stadium-hub', name:'Train at the stadium', cost:800, duration:19, animation:'exercise', effects:{energy:-14,fun:20,stress:-18,mood:8} },
  { id:'stadium-meet', venueId:'national-stadium-hub', name:'Meet on the concourse', cost:0, duration:15, animation:'social', effects:{social:22,fun:10} },
];

const venue = (id, name, category, description) => ({
  id, type: id, name, title: name, category, description,
  fictional: true,
  actionIds: VENUE_ACTIONS.filter(action => action.venueId === id).map(action => action.id),
});
const realVenue = (id,name,type,category,description,districts) => ({
  ...venue(id,name,category,description),type,districts,fictional:false,
  settingSource:'real-world-reference-authored-game-approximation',
  affiliation:'Unofficial AbujaLife game interpretation; no affiliation or endorsement is implied.',
});
export const VENUES = [
  venue('restaurant', 'Courtyard Kitchen', 'Food & dining', 'An authored neighbourhood restaurant serving Nigerian favourites.'),
  venue('hotel', 'Capital Palm Hotel', 'Stay & wellness', 'Book a room to recharge or visit the spa.'),
  venue('gym', 'Neighbourhood Fitness', 'Health & fitness', 'Training equipment, space to stretch and a recovery corner.'),
  venue('cinema', 'City Screen', 'Entertainment', 'A comfortable local cinema for a break from the working week.'),
  venue('grocery', 'Daily Essentials', 'Shopping', 'Pick up a meal and daily essentials.'),
  venue('park', 'Neighbourhood Garden', 'Outdoors', 'A pocket of green for walking, picnics and downtime.'),
  venue('dealership', 'Abuja Car', 'Cars', 'Compare virtual vehicles, buy your own car and take the wheel.'),
  venue('estate-office', 'Abuja Home Finder', 'Homes', 'Compare neighbourhoods, view homes and choose rent or ownership.'),
  venue('furniture-store', 'Okrika Marketplace', 'Shopping', 'Browse furniture, clothes and home essentials, then arrange your purchases at home.'),
  { ...venue('banex', 'Banex Tech Market', 'Tech & shopping', 'Computers, gadgets, repair counters and busy aisles in an original game interpretation of Banex.'), type: 'tech-market', districts: ['wuse-ii-a08'], settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },
  venue('cafe', 'The Corner Café', 'Food & dining', 'A coffee stop with small chops and a place to unwind.'),
  venue('salon', 'Fresh Studio', 'Personal care', 'Take a little time for grooming and your next look.'),
  venue('mosque', 'Neighbourhood Mosque', 'Faith & community', 'A respectful, peaceful space for prayer and community.'),
  venue('church', 'Community Church', 'Faith & community', 'Make time for prayer, reflection and community.'),
  { ...venue('jabi-lake', 'Jabi Lake', 'Outdoors', 'An authored lakeside game setting for walks, picnics and time by the water.'), districts: ['jabi'] },
  { ...venue('club', 'Tokyo', 'Nightlife', 'A late-night AbujaLife club built around a packed LED dance floor, live DJ booth, moving colour, VIP seating and a full bar.'), kind: 'club', style: 'premium', settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },
  { ...venue('club-cage', 'Cage', 'Nightlife', 'A high-energy dance room with a packed floor, lighting rig, DJ sound, drinks bar and nonstop movement.'), kind: 'club', style: 'dance', districts: ['wuse-ii-a07'], settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },
  { ...venue('magic-city', 'Magic City', 'Nightlife', 'A vivid performance club with a lit stage, dancers, audience energy, lounge seating and a premium VIP corner.'), kind: 'club', style: 'stage-lounge', districts: ['garki-ii'], settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },
  { ...venue('bear-barn', 'Bear Barn', 'Nightlife', 'A warm late-night music bar with a busy counter, groups hanging out, small chops, conversation and a relaxed dance corner.'), kind: 'club', style: 'casual-bar', districts: ['jabi'], settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },
  venue('games-lounge', 'Dice & Chill Lounge', 'Games', 'A simple chance game with virtual Naira, plus space to unwind.'),

  realVenue('city-gate-plaza','Abuja City Gate','park','Landmark & social','The ceremonial entrance to Abuja, rebuilt as a public meetup and photo landmark in the game.','kukwaba'.split(',')),
  realVenue('aso-rock-view','Aso Rock Viewpoint','park','Landmark & outdoors','A public AbujaLife viewpoint for the city-defining monolith. The secured government complex is not treated as public access.',['central-area']),
  realVenue('cbn-experience','Central Bank of Nigeria','estate-office','Civic & finance','A game interpretation focused on the institution’s real central-bank purpose: money, financial-system stability, economic history and finance careers.',['central-area']),
  realVenue('magicland','Magicland Amusement Park','park','Entertainment & family','A game interpretation of Abuja’s amusement park with outdoor rides, arcade play and shared social spaces.',['kukwaba']),
  realVenue('farm-city','Farm City Abuja','restaurant','Food, arcade & social','A game interpretation of the Wuse 2 food and social venue, including meals, group hangouts and its game arcade.',['wuse-ii-a07']),
  realVenue('transcorp-hilton-hub','Transcorp Hilton Abuja','hotel','Hospitality & social','A game interpretation of the Maitama hotel as a major social hub for stays, dining, pool time, meetings and lobby meetups.',['maitama']),
  realVenue('millennium-park-hub','Millennium Park','park','Park & social','A spacious green multiplayer meetup for walks, picnics and public gatherings.',['maitama']),
  realVenue('eagle-square-hub','Eagle Square','park','Events & civic','A large public-event plaza for meetups and city events in the AbujaLife world.',['central-area']),
  realVenue('national-mosque-hub','Abuja National Mosque','mosque','Faith & community','A respectful game interpretation centred on prayer, reflection and community.',['central-area']),
  realVenue('national-christian-centre-hub','National Christian Centre','church','Faith & community','A respectful game interpretation centred on prayer, reflection and community.',['central-area']),
  realVenue('national-stadium-hub','Moshood Abiola National Stadium','gym','Sport & events','A multiplayer sport destination for training, meetups and event-day activity.',['kukwaba']),
];

export const NIGHTCLUB_IDS = VENUES.filter(place => place.kind === 'club').map(place => place.id);

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

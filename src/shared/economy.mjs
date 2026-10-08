// Authoritative virtual economy. Catalogues and server actions resolve these prices;
// client-submitted amounts never define the price of a home, car or activity.
const DAY = 86400000;
export const RENT_RULES = Object.freeze({ intervalMs: 7 * DAY, reminderMs: 2 * DAY, depositWeeks: 1 });
export const ECONOMY_CONFIG = Object.freeze({
  version: 2,
  startingMoney: Object.freeze({ lapo: 10_000_000, nepo: 100_000_000 }),
  serviceIntervalMs: 7 * DAY,
  transport: Object.freeze({ bus: { base: 1500, perDistance: 180 }, taxi: { base: 4500, perDistance: 550 }, bike: { base: 2000, perDistance: 250 }, ride: { base: 6500, perDistance: 650 } }),
  investment: Object.freeze({ periodMs: 7 * DAY, incomeBasisPoints: 15, sellCooldownMs: DAY, resaleBasisPoints: 9000 }),
  resale: Object.freeze({ buybackBasisPoints: 5000 }),
  loan: Object.freeze({ feeBasisPoints: 500, termDays: 28, dailyPrincipalCap: 10_000_000, maxOutstandingPrincipal: 100_000_000, redrawAfterRepaymentPercent: 50 }),
  basicActivities: Object.freeze({ eat: 12_000, sleep: 0, shower: 0, relax: 0, hangout: 25_000, exercise: 8_000, cinema: 18_000 }),
});
// [weekly rent, purchase, weekly service charge]. These are authored game prices,
// deliberately spanning attainable accommodation through long-term luxury goals.
export const PROPERTY_ECONOMY = Object.freeze(Object.fromEntries(Object.entries({
  'garki-studio': [0, 0, 0],
  'mpape-self-contained': [120_000, 8_000_000, 8_000],
  'lugbe-flat': [180_000, 14_000_000, 12_000],
  'dawaki-compact': [210_000, 18_000_000, 15_000],
  'kubwa-one-bed': [240_000, 22_000_000, 18_000],
  'karmo-compact': [225_000, 20_000_000, 16_000],
  'lokogoma-two-bed': [450_000, 45_000_000, 28_000],
  'gwarinpa-apartment': [550_000, 60_000_000, 35_000],
  'gudu-family-flat': [620_000, 68_000_000, 38_000],
  'durumi-estate': [720_000, 78_000_000, 45_000],
  'galadimawa-estate': [850_000, 85_000_000, 50_000],
  'jabi-apartment': [1_200_000, 130_000_000, 65_000],
  'wuye-serviced': [1_350_000, 150_000_000, 75_000],
  'utako-serviced': [1_550_000, 180_000_000, 85_000],
  'wuse-two-apartment': [1_800_000, 220_000_000, 95_000],
  'mabushi-townhouse': [2_000_000, 250_000_000, 110_000],
  'guzape-terrace': [2_400_000, 300_000_000, 140_000],
  'jahi-terrace': [2_650_000, 350_000_000, 155_000],
  'kado-townhouse': [2_900_000, 390_000_000, 175_000],
  'gaduwa-duplex': [3_200_000, 430_000_000, 195_000],
  'katampe-penthouse': [3_800_000, 550_000_000, 230_000],
  'maitama-villa': [5_000_000, 850_000_000, 300_000],
  'asokoro-residence': [7_500_000, 1_200_000_000, 380_000],
  'katampe-extension-villa': [9_000_000, 1_500_000_000, 450_000],
}).map(([id, [rent, buy, bills]]) => [id, Object.freeze({ rent, buy, bills })])));
export const VEHICLE_PRICES = Object.freeze({
  'used-hatchback': 3_800_000, 'starter-hatchback': 9_500_000, 'compact-car': 24_000_000,
  'city-sedan': 42_000_000, 'premium-suv': 95_000_000, 'mercedes-c-class': 58_000_000,
  'bmw-x5': 130_000_000, 'mercedes-g63': 500_000_000, 'ferrari-roma': 650_000_000,
  'ferrari-sf90': 1_100_000_000, 'lamborghini-huracan': 850_000_000,
  'lamborghini-urus': 750_000_000, 'bugatti-chiron': 2_200_000_000, 'porsche-911': 480_000_000,
});
export const JOB_PAY = Object.freeze({ 'restaurant-host': 250_000, 'junior-dev': 550_000, 'media-assistant': 350_000, 'property-agent': 650_000, 'site-supervisor': 750_000, 'bank-teller': 450_000 });
export const ITEM_PRICES = Object.freeze({
  'linen-shirt': 45_000, 'office-shirt': 65_000, 'traditional-set': 180_000, 'white-trainers': 85_000,
  'lounge-chair': 220_000, plant: 18_000, bookshelf: 160_000, sofa: 650_000, 'dining-table': 150_000,
  bed: 280_000, fridge: 380_000, 'floor-lamp': 65_000, rug: 45_000, tv: 550_000,
  'portable-ac': 650_000, 'power-inverter': 1_800_000, 'premium-sofa': 2_500_000,
  'king-bed': 1_400_000, 'pool-table': 1_600_000, 'gaming-console': 950_000,
  'bar-cart': 450_000, 'art-piece': 850_000,
  'work-desk': 250_000, wardrobe: 480_000, 'kitchen-unit': 1_200_000, 'washing-machine': 550_000,
  'standing-fan': 65_000, microwave: 180_000, 'shoe-rack': 75_000, 'music-speaker': 220_000,
  'coffee-table': 180_000, 'accent-chair': 260_000, 'office-chair': 150_000, 'bedside-table': 65_000,
  'full-length-mirror': 140_000, 'balcony-bench': 220_000, 'large-rug': 150_000, 'tall-plant': 85_000,
  'storage-drawers': 280_000, 'library-shelf': 350_000, 'table-lamp': 45_000, 'ceramic-vase': 28_000,
  succulent: 18_000, 'book-stack': 22_000, 'vanity-desk': 450_000, 'reading-chair': 320_000,
  'media-sideboard': 550_000, 'kitchen-island': 1_800_000, 'dining-bench': 180_000,
  'entry-console': 220_000, 'tall-bookshelf': 450_000, 'floor-speaker': 850_000,
  'indoor-ficus': 120_000, 'runner-rug': 85_000, 'laundry-cabinet': 350_000,
  'coffee-bar': 650_000, 'window-bench': 240_000, 'console-table': 260_000,
});
// Free civic, faith, walking and social activities remain free. Paid experiences have
// their own price, rather than multiplying every old amount by an arbitrary factor.
export const VENUE_PRICES = Object.freeze({
  'jollof-chicken': 18_000, 'suya-plate': 22_000, 'egusi-pounded-yam': 25_000,
  'hotel-rest': 180_000, 'hotel-shower': 35_000, 'gym-workout': 15_000, 'gym-recovery': 8_000,
  'cinema-film': 18_000, groceries: 14_000, 'park-picnic': 12_000, 'coffee-break': 15_000,
  'salon-cut': 25_000, 'lake-picnic': 18_000, 'club-dance': 150_000, 'club-refreshment': 95_000,
  'tokyo-vip': 650_000, 'cage-dance': 85_000, 'cage-drinks': 180_000,
  'magic-city-stage': 120_000, 'magic-city-vip': 400_000, 'bear-barn-relax': 45_000, 'bear-barn-drinks': 85_000,
  'magicland-rides': 25_000, 'magicland-arcade': 18_000, 'farmcity-meal': 65_000,
  'farmcity-arcade': 18_000, 'farmcity-hangout': 12_000, 'transcorp-pool': 95_000,
  'transcorp-dining': 180_000, 'millennium-picnic': 12_000, 'stadium-train': 8_000,
  'farmcity-social': 12_000, 'jabi-mall-food': 35_000, 'central-park-play': 8_000,
  'sahad-cbd-food': 25_000, 'ceddi-plaza-food': 35_000, 'sahad-area-11-meal': 12_000,
  'grand-square-abuja-meal': 18_000, 'sahad-area-11-arcade': 12_000,
  'ceddi-genesis-film': 25_000, 'ceddi-genesis-popcorn': 8_000, 'ceddi-genesis-screening': 15_000,
  'thought-pyramid-abuja-workshop': 15_000, 'nike-gallery-abuja-workshop': 12_000,
});
export function economyPrice(table, id) {
  const price = table[id];
  if (!Number.isSafeInteger(price) || price < 0) throw new RangeError(`Missing economy price for ${id}`);
  return price;
}
// Immutable legacy server quotes are accepted for existing investment records only.
// A rebalance never deletes an owned property or rewrites money already spent.
export const LEGACY_PROPERTY_BUY = Object.freeze({
  'mpape-self-contained':190000,'lugbe-flat':280000,'dawaki-compact':335000,'kubwa-one-bed':390000,
  'karmo-compact':360000,'lokogoma-two-bed':540000,'gwarinpa-apartment':620000,'gudu-family-flat':680000,
  'durumi-estate':760000,'galadimawa-estate':820000,'jabi-apartment':980000,'wuye-serviced':1080000,
  'utako-serviced':1240000,'wuse-two-apartment':1420000,'mabushi-townhouse':1580000,'guzape-terrace':2200000,
  'jahi-terrace':2460000,'kado-townhouse':2740000,'gaduwa-duplex':3050000,'katampe-penthouse':4700000,
  'maitama-villa':5800000,'asokoro-residence':7600000,'katampe-extension-villa':8300000,
});

import { VEHICLE_PRICES, economyPrice } from './economy.mjs';
// Model names identify original authored approximations of virtual game vehicles.
// Dimensions guide proportions; these are scaled game prices, not offers to buy real cars.
export const VEHICLE_COLORS = [
  { id: 'pearl', name: 'Pearl white', hex: '#ece9df' },
  { id: 'black', name: 'Obsidian black', hex: '#242930' },
  { id: 'silver', name: 'Metallic silver', hex: '#a5afb5' },
  { id: 'blue', name: 'Midnight blue', hex: '#354f7b' },
  { id: 'red', name: 'Ruby red', hex: '#963d41' },
  { id: 'green', name: 'Forest green', hex: '#335f4f' },
  { id: 'sand', name: 'Desert gold', hex: '#b99962' },
];
const car = (id, brand, model, year, bodyStyle, defaultColor, speed, description, modelStyle, dimensions, renderShape) => ({
  id, brand, model, year, bodyStyle, name: `${brand} ${model}`, category: 'vehicle', price: economyPrice(VEHICLE_PRICES, id),
  defaultColor, availableColors: VEHICLE_COLORS.map(color => color.id),
  colour: VEHICLE_COLORS.find(color => color.id === defaultColor).hex, speed, description,
  modelStyle: modelStyle || bodyStyle,
  ...(dimensions ? {dimensions: {lengthMm:dimensions[0],widthMm:dimensions[1],heightMm:dimensions[2],wheelbaseMm:dimensions[3]}} : {}),
  ...(renderShape ? {renderShape} : {}),
});
export const VEHICLE_CATALOG = [
  car('used-hatchback', 'Toyota', 'Corolla', 2008, 'sedan', 'sand', 1, 'A dependable pre-owned Corolla. An attainable first-car goal without spending your entire starting balance.'),
  car('starter-hatchback', 'Toyota', 'Yaris', 2021, 'hatchback', 'blue', 1.1, 'A nimble hatchback for everyday neighbourhood journeys.'),
  car('compact-car', 'Toyota', 'Corolla', 2024, 'sedan', 'pearl', 1.2, 'A modern compact sedan with comfortable everyday road manners.'),
  car('city-sedan', 'BMW', '320i', 2024, 'sedan', 'blue', 1.25, 'A sporty executive sedan for workdays and evenings in the city.'),
  car('premium-suv', 'Toyota', 'Land Cruiser Prado', 2024, 'suv', 'silver', 1.3, 'A spacious four-wheel-drive SUV for your next chapter.'),
  car('mercedes-c-class', 'Mercedes-Benz', 'C-Class', 2024, 'sedan', 'black', 1.3, 'An elegant luxury sedan with a distinct long-bonnet silhouette.'),
  car('bmw-x5', 'BMW', 'X5', 2024, 'suv', 'green', 1.35, 'A premium SUV with a broad stance and room for city adventures.'),
  car('mercedes-g63', 'Mercedes-AMG', 'G 63 · G-Wagon', 2024, 'offroad', 'black', 1.3, 'The unmistakable boxy G-Wagon: a game garage milestone.'),
  // Normalized authored cross-sections: x is rear -0.5 to front +0.5;
  // y values scale with the approximate vehicle height, width with its stance.
  car('ferrari-roma','Ferrari','Roma',2024,'coupe','red',1.5,
    'A virtual long-bonnet Italian GT with flowing shoulders, a compact rear cabin and slim lamps. Original authored approximation; scaled game price.',
    'roma',[4656,1974,1301,2670],{signature:'long-bonnet-gt',angular:false,
      body:[[-.5,.40,.18,.76],[-.38,.52,.18,.98],[-.14,.51,.18,.96],[.08,.46,.18,.94],[.32,.40,.18,.97],[.5,.27,.20,.77]],
      cabin:[[-.31,.54,.48,.65],[-.20,.98,.48,.68],[-.035,1,.46,.64],[.15,.49,.43,.53]],
      roof:[[-.20,.986],[-.11,1.015],[-.035,1.006]],frontAxle:.32,wheelRadius:.26,intake:'slim-wide',rear:'twin-round',vents:'front-fender',spokes:5}),
  car('ferrari-sf90','Ferrari','SF90 Stradale',2024,'supercar','red',1.65,
    'A virtual mid-engine supercar with a forward cabin, sculpted rear deck, side intakes and four rear lamps. Original authored approximation; scaled game price.',
    'sf90',[4710,1972,1186,2650],{signature:'mid-engine-sculpted',angular:false,
      body:[[-.5,.47,.20,.87],[-.34,.63,.17,1],[-.16,.56,.16,.94],[.10,.48,.17,.91],[.32,.37,.19,.97],[.5,.26,.22,.76]],
      cabin:[[-.23,.56,.50,.65],[-.095,.99,.50,.70],[.09,1,.45,.66],[.28,.46,.39,.50]],
      roof:[[-.095,1.002],[.015,1.02],[.09,1.012]],frontAxle:.31,wheelRadius:.28,intake:'split',rear:'four-square',vents:'mid-engine',spokes:5}),
  car('lamborghini-huracan','Lamborghini','Huracán EVO',2024,'supercar','green',1.6,
    'A virtual low wedge with angular glass, Y-shaped lamps, hexagonal intakes and a raised rear engine deck. Original authored approximation; scaled game price.',
    'huracan',[4520,1933,1165,2620],{signature:'sharp-mid-engine-wedge',angular:true,
      body:[[-.5,.49,.18,.91],[-.35,.61,.16,1],[-.12,.53,.16,.94],[.09,.43,.17,.92],[.34,.31,.20,.96],[.5,.245,.205,.78]],
      cabin:[[-.23,.58,.51,.71],[-.13,.98,.48,.74],[.07,1,.42,.64],[.31,.36,.34,.48]],
      roof:[[-.13,.991],[-.025,1.015],[.07,1.011]],frontAxle:.32,wheelRadius:.28,intake:'hexagonal',rear:'slim-wide',vents:'triangular',spokes:5}),
  car('lamborghini-urus','Lamborghini','Urus',2024,'suv','sand',1.45,
    'A virtual performance SUV with a high stance, sloping coupé roof, flared arches and angular Y-shaped lights. Original authored approximation; scaled game price.',
    'urus',[5112,2016,1638,3003],{signature:'coupe-roof-performance-suv',angular:true,
      body:[[-.5,.53,.22,.86],[-.36,.59,.20,1],[-.12,.53,.20,.95],[.16,.51,.20,.95],[.34,.47,.22,1],[.5,.37,.25,.87]],
      cabin:[[-.41,.64,.53,.78],[-.26,.92,.53,.76],[-.12,1,.52,.72],[.13,.97,.50,.71],[.32,.54,.45,.68]],
      roof:[[-.26,.932],[-.12,1.016],[.13,.986]],frontAxle:.32,wheelRadius:.235,intake:'hexagonal',rear:'slim-wide',vents:'front-fender',spokes:6}),
  car('bugatti-chiron','Bugatti','Chiron',2024,'hypercar','blue',1.7,
    'A virtual wide hypercar with sculpted arches, a horseshoe front intake, a bright C-shaped side curve and a continuous rear lamp. Original authored approximation; scaled game price.',
    'chiron',[4544,2038,1212,2711],{signature:'horseshoe-c-curve-hypercar',angular:false,
      body:[[-.5,.46,.18,.88],[-.34,.67,.17,1],[-.12,.52,.17,.87],[.12,.44,.17,.88],[.35,.48,.19,1],[.5,.29,.22,.84]],
      cabin:[[-.29,.61,.52,.66],[-.18,.94,.50,.69],[-.065,1,.48,.67],[.12,.89,.43,.63],[.28,.43,.38,.53]],
      roof:[[-.18,.952],[-.065,1.015],[.12,.901]],frontAxle:.32,wheelRadius:.275,intake:'horseshoe',rear:'continuous-strip',vents:'c-curve',spokes:8}),
  car('porsche-911','Porsche','911 Carrera',2024,'coupe','silver',1.5,
    'A virtual rear-engine coupé with a rounded fastback, broad rear shoulders and oval front lamps. Original authored approximation; scaled game price.',
    '911',[4519,1852,1300,2450],{signature:'rounded-rear-engine-fastback',angular:false,
      body:[[-.5,.40,.19,.80],[-.32,.64,.18,1],[-.08,.49,.18,.90],[.24,.39,.18,.88],[.43,.46,.20,.96],[.5,.29,.22,.77]],
      cabin:[[-.40,.55,.49,.64],[-.25,.90,.49,.68],[-.095,1,.46,.65],[.11,.95,.42,.63],[.29,.39,.35,.48]],
      roof:[[-.25,.912],[-.095,1.016],[.11,.966]],frontAxle:.30,wheelRadius:.255,intake:'slim-wide',rear:'continuous-strip',vents:'rear-engine',spokes:5}),

];
export const vehicleFor = itemOrId => typeof itemOrId === 'object' ? itemOrId : VEHICLE_CATALOG.find(item => item.id === itemOrId);
export function vehicleColorHex(profile, itemOrId) {
  const item = vehicleFor(itemOrId);
  const colorId = profile?.vehicleColors?.[item?.id] || item?.defaultColor;
  return VEHICLE_COLORS.find(color => color.id === colorId)?.hex || item?.colour || '#ece9df';
}
export const vehicleColorFor = id => VEHICLE_COLORS.find(color => color.id === id) || null;

// Model names identify authored game vehicles. Artwork is original; prices are scaled game prices.
export const VEHICLE_COLORS = [
  { id: 'pearl', name: 'Pearl white', hex: '#ece9df' },
  { id: 'black', name: 'Obsidian black', hex: '#242930' },
  { id: 'silver', name: 'Metallic silver', hex: '#a5afb5' },
  { id: 'blue', name: 'Midnight blue', hex: '#354f7b' },
  { id: 'red', name: 'Ruby red', hex: '#963d41' },
  { id: 'green', name: 'Forest green', hex: '#335f4f' },
  { id: 'sand', name: 'Desert gold', hex: '#b99962' },
];
const car = (id, brand, model, year, bodyStyle, price, defaultColor, speed, description) => ({
  id, brand, model, year, bodyStyle, name: `${brand} ${model}`, category: 'vehicle', price,
  defaultColor, availableColors: VEHICLE_COLORS.map(color => color.id),
  colour: VEHICLE_COLORS.find(color => color.id === defaultColor).hex, speed, description,
});
export const VEHICLE_CATALOG = [
  car('used-hatchback', 'Toyota', 'Corolla', 2008, 'sedan', 28000, 'sand', 1, 'A dependable pre-owned Corolla. Your first shift can put this within reach.'),
  car('starter-hatchback', 'Toyota', 'Yaris', 2021, 'hatchback', 95000, 'blue', 1.1, 'A nimble hatchback for everyday neighbourhood journeys.'),
  car('compact-car', 'Toyota', 'Corolla', 2024, 'sedan', 240000, 'pearl', 1.2, 'A modern compact sedan with comfortable everyday road manners.'),
  car('city-sedan', 'BMW', '320i', 2024, 'sedan', 380000, 'blue', 1.25, 'A sporty executive sedan for workdays and evenings in the city.'),
  car('premium-suv', 'Toyota', 'Land Cruiser Prado', 2024, 'suv', 890000, 'silver', 1.3, 'A spacious four-wheel-drive SUV for your next chapter.'),
  car('mercedes-c-class', 'Mercedes-Benz', 'C-Class', 2024, 'sedan', 520000, 'black', 1.3, 'An elegant luxury sedan with a distinct long-bonnet silhouette.'),
  car('bmw-x5', 'BMW', 'X5', 2024, 'suv', 1150000, 'green', 1.35, 'A premium SUV with a broad stance and room for city adventures.'),
  car('mercedes-g63', 'Mercedes-AMG', 'G 63 · G-Wagon', 2024, 'offroad', 1650000, 'black', 1.3, 'The unmistakable boxy G-Wagon: a game garage milestone.'),
];
export const vehicleFor = itemOrId => typeof itemOrId === 'object' ? itemOrId : VEHICLE_CATALOG.find(item => item.id === itemOrId);
export function vehicleColorHex(profile, itemOrId) {
  const item = vehicleFor(itemOrId);
  const colorId = profile?.vehicleColors?.[item?.id] || item?.defaultColor;
  return VEHICLE_COLORS.find(color => color.id === colorId)?.hex || item?.colour || '#ece9df';
}
export const vehicleColorFor = id => VEHICLE_COLORS.find(color => color.id === id) || null;

// Origin is chosen once by the server. These are fictional starting lives,
// not statements about everyone living in an Abuja neighbourhood.
export const ORIGIN_META = {
  random: true, immutable: true, equalProbability: true,
  description: 'Your starting life is assigned at random once, with an equal chance of Nepo or Lapo.',
  options: [
    { id: 'nepo', name: 'Nepo', startingBalance: 1000000, description: 'A family gift: ₦1,000,000 and a home in Jabi, Guzape or Maitama.' },
    { id: 'lapo', name: 'Lapo', startingBalance: 100000, description: '₦100,000 and a practical starter home. Build your own Abuja story.' },
  ],
};

export const ORIGIN_HOMES = {
  nepo: [
    { district: 'jabi', districtName: 'Jabi', layoutId: 'jabi-apartment', name: 'Gifted Jabi apartment' },
    { district: 'guzape', districtName: 'Guzape', layoutId: 'guzape-terrace', name: 'Gifted Guzape terrace' },
    { district: 'maitama', districtName: 'Maitama', layoutId: 'maitama-villa', name: 'Gifted Maitama villa' },
  ],
  lapo: [
    { district: 'lugbe', districtName: 'Lugbe', layoutId: 'garki-studio', name: 'Lugbe starter studio' },
    { district: 'kubwa', districtName: 'Kubwa', layoutId: 'garki-studio', name: 'Kubwa starter studio' },
    { district: 'nyanya', districtName: 'Nyanya', layoutId: 'garki-studio', name: 'Nyanya starter studio' },
    { district: 'bwari-town', districtName: 'Bwari Town', layoutId: 'garki-studio', name: 'Bwari starter studio' },
    { district: 'gwagwalada-town', districtName: 'Gwagwalada Town', layoutId: 'garki-studio', name: 'Gwagwalada starter studio' },
  ],
};

export function createOrigin({ residentId, now, randomInt, properties, atlas }) {
  if (typeof randomInt !== 'function') throw new TypeError('Origin requires server randomness');
  const option = ORIGIN_META.options[randomInt(0, 2)];
  if (!option) throw new RangeError('Invalid origin selection');
  const choices = ORIGIN_HOMES[option.id], choice = choices[randomInt(0, choices.length)];
  if (!choice || !atlas.some(place => place.id === choice.district)) throw new RangeError('Origin home must use an atlas district');
  const layout = properties.find(property => property.id === choice.layoutId);
  if (!layout) throw new RangeError('Origin home must use an authored layout');
  const propertyId = `origin-home-${residentId}`;
  const residence = { ...layout, ...choice, id: propertyId, propertyId, originHome: true, ownerId: residentId,
    gifted: option.id === 'nepo', rent: 0, moveInCost: 0,
    description: option.id === 'nepo' ? `Your family gifted you this home in ${choice.districtName}.` : `Your practical starting home in ${choice.districtName}.`,
  };
  return { id: option.id, name: option.name, assignedAt: now, startingBalance: option.startingBalance,
    giftedHome: option.id === 'nepo', immutable: true, residence,
  };
}

export function originHome(origin) {
  const residence = origin.residence;
  return { propertyId: residence.id, layoutId: residence.layoutId, name: residence.name,
    district: residence.district, tenure: origin.giftedHome ? 'own' : 'starter', gifted: origin.giftedHome, rentDueAt: null };
}

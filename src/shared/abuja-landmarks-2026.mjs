import { VENUES, VENUE_ACTIONS } from './life.mjs';

// AbujaLife game interpretations of real Abuja destinations.
// These records only describe the game world. They do not imply affiliation,
// endorsement, public access to restricted areas, or real-world operating rules.
const landmarkVenues = [
  {
    id:'airport-hub', type:'estate-office', name:'Nnamdi Azikiwe International Airport', title:'Nnamdi Azikiwe International Airport',
    category:'Transport & social', districts:['lugbe'], fictional:false,
    description:'AbujaLife’s public-terminal meetup for arrivals, departures and airport-road social play.',
    settingSource:'real-world-reference-authored-game-approximation',
    affiliation:'Unofficial AbujaLife game interpretation; no affiliation or endorsement is implied.'
  },
  {
    id:'national-assembly-hub', type:'park', name:'National Assembly Complex', title:'National Assembly Complex',
    category:'Civic & public life', districts:['central-area'], fictional:false,
    description:'A respectful AbujaLife civic landmark centred on the public-facing plaza and democratic life, not restricted government interiors.',
    settingSource:'real-world-reference-authored-game-approximation',
    affiliation:'Unofficial AbujaLife game interpretation; no affiliation or endorsement is implied.'
  },
  {
    id:'wtc-abuja-hub', type:'estate-office', name:'World Trade Centre Abuja', title:'World Trade Centre Abuja',
    category:'Business & networking', districts:['central-area'], fictional:false,
    description:'A high-rise AbujaLife business hub for networking, meetings and skyline social play in the CBD.',
    settingSource:'real-world-reference-authored-game-approximation',
    affiliation:'Unofficial AbujaLife game interpretation; no affiliation or endorsement is implied.'
  }
];

const landmarkActions = [
  { id:'airport-arrivals-meet', venueId:'airport-hub', name:'Meet at arrivals', cost:0, duration:16, animation:'social', effects:{social:24,fun:8,mood:6} },
  { id:'airport-plane-watch', venueId:'airport-hub', name:'Watch the runway', cost:0, duration:17, animation:'watch', effects:{fun:18,stress:-10,mood:6} },
  { id:'national-assembly-meet', venueId:'national-assembly-hub', name:'Meet at the civic plaza', cost:0, duration:15, animation:'social', effects:{social:22,fun:8,mood:5} },
  { id:'national-assembly-civic', venueId:'national-assembly-hub', name:'Take the Abuja civic photo', cost:0, duration:14, animation:'watch', effects:{fun:14,mood:7} },
  { id:'wtc-network', venueId:'wtc-abuja-hub', name:'Business networking meetup', cost:0, duration:18, animation:'social', effects:{social:28,mood:8} },
  { id:'wtc-skyline-break', venueId:'wtc-abuja-hub', name:'Take a skyline break', cost:1200, duration:16, animation:'eat', effects:{energy:8,fun:14,stress:-12,social:8} }
];

for (const venue of landmarkVenues) {
  if (!VENUES.some(existing => existing.id === venue.id)) VENUES.push(Object.freeze(venue));
}
for (const action of landmarkActions) {
  if (!VENUE_ACTIONS.some(existing => existing.id === action.id)) VENUE_ACTIONS.push(Object.freeze(action));
}

export const ABUJA_2026_LANDMARK_VENUE_IDS = Object.freeze(landmarkVenues.map(venue => venue.id));
export const ABUJA_2026_LANDMARK_ACTION_IDS = Object.freeze(landmarkActions.map(action => action.id));

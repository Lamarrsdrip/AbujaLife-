import { VENUES, VENUE_ACTIONS } from './life.mjs';

// AbujaLife game interpretations of real Abuja destinations.
// These records only describe the game world. They do not imply affiliation,
// endorsement, public access to restricted areas, or real-world operating rules.
const common={fictional:false,settingSource:'real-world-reference-authored-game-approximation',affiliation:'Unofficial AbujaLife game interpretation; no affiliation or endorsement is implied.'};
const landmarkVenues=[
  {...common,id:'airport-hub',type:'estate-office',name:'Nnamdi Azikiwe International Airport',title:'Nnamdi Azikiwe International Airport',category:'Transport & social',districts:['lugbe'],description:'AbujaLife’s public-terminal meetup for arrivals, departures and airport-road social play.'},
  {...common,id:'national-assembly-hub',type:'park',name:'National Assembly Complex',title:'National Assembly Complex',category:'Civic & public life',districts:['central-area'],description:'A respectful AbujaLife civic landmark centred on the public-facing plaza and democratic life, not restricted government interiors.'},
  {...common,id:'wtc-abuja-hub',type:'estate-office',name:'World Trade Centre Abuja',title:'World Trade Centre Abuja',category:'Business & networking',districts:['central-area'],description:'A high-rise AbujaLife business hub for networking, meetings and skyline social play in the CBD.'},
  {...common,id:'inec-hq',type:'estate-office',name:'INEC Headquarters',title:'INEC Headquarters',category:'Civic & elections',districts:['maitama'],description:'A fictionalized public-facing AbujaLife election destination used for candidate registration and civic education.'},
  {...common,id:'efcc-hq',type:'estate-office',name:'EFCC Headquarters',title:'EFCC Headquarters',category:'Civic & integrity',districts:['jabi'],description:'A fictionalized public-facing AbujaLife integrity destination used for the game’s anti-corruption and financial-transparency storylines.'},
  {...common,id:'federal-high-court-hub',type:'estate-office',name:'Federal High Court Abuja',title:'Federal High Court Abuja',category:'Civic & justice',districts:['central-area'],description:'A respectful public-facing AbujaLife justice destination for fictional civic hearings and due-process storylines.'}
];

const landmarkActions=[
  {id:'airport-arrivals-meet',venueId:'airport-hub',name:'Meet at arrivals',cost:0,duration:16,animation:'social',effects:{social:24,fun:8,mood:6}},
  {id:'airport-plane-watch',venueId:'airport-hub',name:'Watch the runway',cost:0,duration:17,animation:'watch',effects:{fun:18,stress:-10,mood:6}},
  {id:'national-assembly-meet',venueId:'national-assembly-hub',name:'Meet at the civic plaza',cost:0,duration:15,animation:'social',effects:{social:22,fun:8,mood:5}},
  {id:'national-assembly-civic',venueId:'national-assembly-hub',name:'Take the Abuja civic photo',cost:0,duration:14,animation:'watch',effects:{fun:14,mood:7}},
  {id:'wtc-network',venueId:'wtc-abuja-hub',name:'Business networking meetup',cost:0,duration:18,animation:'social',effects:{social:28,mood:8}},
  {id:'wtc-skyline-break',venueId:'wtc-abuja-hub',name:'Take a skyline break',cost:1200,duration:16,animation:'eat',effects:{energy:8,fun:14,stress:-12,social:8}},
  {id:'inec-civic-education',venueId:'inec-hq',name:'Election civic briefing',cost:0,duration:15,animation:'watch',effects:{mood:4,social:8}},
  {id:'inec-meet-candidates',venueId:'inec-hq',name:'Meet other aspiring candidates',cost:0,duration:16,animation:'social',effects:{social:18,fun:6}},
  {id:'efcc-integrity-briefing',venueId:'efcc-hq',name:'Financial integrity briefing',cost:0,duration:15,animation:'watch',effects:{mood:4,stress:-4}},
  {id:'efcc-public-lobby',venueId:'efcc-hq',name:'Visit the public lobby',cost:0,duration:14,animation:'walk',effects:{social:6,mood:3}},
  {id:'court-public-hearing',venueId:'federal-high-court-hub',name:'Attend a public civic hearing',cost:0,duration:18,animation:'watch',effects:{social:8,mood:3}}
];

for(const venue of landmarkVenues)if(!VENUES.some(existing=>existing.id===venue.id))VENUES.push(Object.freeze(venue));
for(const action of landmarkActions)if(!VENUE_ACTIONS.some(existing=>existing.id===action.id))VENUE_ACTIONS.push(Object.freeze(action));

export const ABUJA_2026_LANDMARK_VENUE_IDS=Object.freeze(landmarkVenues.map(venue=>venue.id));
export const ABUJA_2026_LANDMARK_ACTION_IDS=Object.freeze(landmarkActions.map(action=>action.id));

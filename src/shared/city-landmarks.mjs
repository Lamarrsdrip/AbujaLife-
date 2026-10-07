export const CITY_LANDMARKS = Object.freeze([
  {id:'airport-hub',name:'Nnamdi Azikiwe International Airport',short:'Abuja Airport',lat:9.0066,lon:7.2642,districtId:'lugbe',builder:'airport',priority:100,interior:'airport',blurb:'Arrivals, departures and airport-road meetups.'},
  {id:'city-gate-plaza',name:'Abuja City Gate',short:'City Gate',lat:9.0357,lon:7.4486,districtId:'kukwaba',builder:'cityGate',priority:100,interior:'city-gate',blurb:'The ceremonial entrance to Abuja and a public meetup/photo stop.'},
  {id:'national-stadium-hub',name:'Moshood Abiola National Stadium',short:'National Stadium',lat:9.0379,lon:7.4534,districtId:'kukwaba',builder:'stadium',priority:99,interior:'stadium',blurb:'Training, sport and match-day multiplayer gatherings.'},
  {id:'magicland',name:'Magicland Amusement Park',short:'Magicland',lat:9.0428,lon:7.4518,districtId:'kukwaba',builder:'magicland',priority:97,interior:'magicland',blurb:'Rides, arcade play and group hangouts.'},
  {id:'wtc-abuja-hub',name:'World Trade Centre Abuja',short:'WTC Abuja',lat:9.0496,lon:7.4733,districtId:'central-area',builder:'wtc',priority:100,interior:'wtc',blurb:'Twin-tower CBD landmark for business and skyline social play.'},
  {id:'cbn-experience',name:'Central Bank of Nigeria',short:'CBN',lat:9.0509,lon:7.4931,districtId:'central-area',builder:'cbn',priority:99,interior:'cbn',blurb:'Finance, economic history and career activities.'},
  {id:'national-assembly-hub',name:'National Assembly Complex',short:'National Assembly',lat:9.0682,lon:7.5123,districtId:'central-area',builder:'assembly',priority:100,interior:'assembly',blurb:'Civic plaza, election stories and public multiplayer moments.'},
  {id:'eagle-square-hub',name:'Eagle Square',short:'Eagle Square',lat:9.0615,lon:7.4922,districtId:'central-area',builder:'eagle',priority:96,interior:'eagle-square',blurb:'Major rallies, festivals and city events.'},
  {id:'national-mosque-hub',name:'Abuja National Mosque',short:'National Mosque',lat:9.0602,lon:7.4898,districtId:'central-area',builder:'mosque',priority:98,interior:'national-mosque',blurb:'Prayer, reflection and community.'},
  {id:'national-christian-centre-hub',name:'National Christian Centre',short:'National Christian Centre',lat:9.0510,lon:7.4905,districtId:'central-area',builder:'church',priority:94,interior:'national-christian-centre',blurb:'Prayer, reflection and community.'},
  {id:'transcorp-hilton-hub',name:'Transcorp Hilton Abuja',short:'Transcorp Hilton',lat:9.0744,lon:7.4951,districtId:'maitama',builder:'transcorp',priority:99,interior:'transcorp',blurb:'Hotel, pool, dining, meetings and lobby meetups.'},
  {id:'millennium-park-hub',name:'Millennium Park',short:'Millennium Park',lat:9.0707,lon:7.4994,districtId:'maitama',builder:'millennium',priority:95,interior:'millennium-park',blurb:'Walks, picnics and outdoor multiplayer hangouts.'},
  {id:'aso-rock-view',name:'Aso Rock Viewpoint',short:'Aso Rock',lat:9.0698,lon:7.5208,districtId:'central-area',builder:'aso',priority:100,interior:'aso-view',blurb:'Abuja’s defining granite backdrop and viewpoint.'},
  {id:'farm-city',name:'Farm City Abuja',short:'Farm City',lat:9.0800,lon:7.4708,districtId:'wuse-ii-a07',builder:'farmCity',priority:91,interior:'farm-city',blurb:'Food, arcade and Abuja hangout energy.'},
  {id:'jabi-lake',name:'Jabi Lake',short:'Jabi Lake',lat:9.0750,lon:7.4170,districtId:'jabi',builder:'jabiLake',priority:93,interior:'jabi-lake',blurb:'Lakeside walks, picnic and social space.'},
  {id:'jabi-lake-mall',name:'Jabi Lake Mall',short:'Jabi Lake Mall',lat:9.0760,lon:7.4210,districtId:'jabi',builder:'mall',priority:88,interior:'mall',blurb:'Shopping landmark beside Jabi Lake.'},
  {id:'international-conference-centre',name:'International Conference Centre',short:'ICC Abuja',lat:9.0618,lon:7.4862,districtId:'central-area',builder:'conference',priority:94,interior:'conference',blurb:'Town halls, conferences and presidential debates.'},
  {id:'banex',name:'Banex Tech Market',short:'Banex',lat:9.0790,lon:7.4590,districtId:'wuse-ii-a08',builder:'banex',priority:87,interior:'banex',blurb:'Tech shopping, repairs and Abuja hustle.'},
  {id:'inec-hq',name:'INEC Headquarters',short:'INEC HQ',lat:9.0830,lon:7.4970,districtId:'maitama',builder:'inec',priority:97,interior:'inec',blurb:'Candidate registration and AbujaLife election civic play.'},
  {id:'efcc-hq',name:'EFCC Headquarters',short:'EFCC HQ',lat:9.0149,lon:7.4081,districtId:'jabi',builder:'efcc',priority:97,interior:'efcc',blurb:'Fictional integrity investigations and financial-transparency storylines.'},
  {id:'federal-high-court-hub',name:'Federal High Court Abuja',short:'Federal High Court',lat:9.0552,lon:7.5003,districtId:'central-area',builder:'court',priority:95,interior:'court',blurb:'Fictional civic hearings and due-process storylines.'},
  // Game geography is deliberately stylised. These anchors place each added
  // destination in its district; they are not turn-by-turn real-world directions.
  {id:'central-park-abuja',name:'Central Park Abuja',short:'Central Park',lat:9.0600,lon:7.4840,districtId:'central-area',builder:'millennium',priority:90,interior:'park',blurb:'Garden walks, a game playground and outdoor meetups.'},
  {id:'sahad-cbd',name:'Sahad Stores CBD',short:'Sahad CBD',lat:9.0475,lon:7.4910,districtId:'central-area',builder:'mall',priority:87,interior:'mall',blurb:'Browse the retail court, meet friends and stop for food.'},
  {id:'sahad-area-11',name:'Sahad Stores Area 11',short:'Sahad Area 11',lat:9.0360,lon:7.4900,districtId:'garki-i',builder:'grocery',priority:86,interior:'grocery',blurb:'Daily essentials, a meal stop and the game arcade.'},
  {id:'grand-square-abuja',name:'Grand Square Abuja',short:'Grand Square',lat:9.0460,lon:7.4845,districtId:'central-area',builder:'grocery',priority:86,interior:'grocery',blurb:'Browse groceries, take a bakery break and meet in the café.'},
  {id:'ceddi-plaza',name:'Ceddi Plaza',short:'Ceddi Plaza',lat:9.0520,lon:7.4870,districtId:'central-area',builder:'mall',priority:90,interior:'mall',blurb:'Shopping, food and a social stop in the city centre.'},
  {id:'ceddi-genesis-cinema',name:'Genesis Cinema · Ceddi Plaza',short:'Genesis Cinema',lat:9.0524,lon:7.4874,districtId:'central-area',builder:'cinema',priority:89,interior:'cinema',blurb:'Catch a game screening and meet friends in the foyer.'},
  {id:'thought-pyramid-abuja',name:'Thought Pyramid Art Centre',short:'Thought Pyramid',lat:9.0763,lon:7.4606,districtId:'wuse-ii-a08',builder:'gallery',priority:88,interior:'gallery',blurb:'Explore an original game art exhibition and join a creative workshop.'},
  {id:'nike-gallery-abuja',name:'Nike Art Gallery Abuja',short:'Nike Art Gallery',lat:9.0030,lon:7.3900,districtId:'lugbe',builder:'gallery',priority:88,interior:'gallery',blurb:'Discover Nigerian textiles, original game art and a creative workshop.'}
]);

export const CITY_LANDMARK_IDS = Object.freeze(CITY_LANDMARKS.map(place=>place.id));
export const cityLandmark = id => CITY_LANDMARKS.find(place=>place.id===id) || null;

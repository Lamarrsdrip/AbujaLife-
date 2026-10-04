// Point records copied exactly from geonamescache 3.0.2 cities500.json on 2026-10-04.
// These are settlement reference points, never district centroids or legal boundaries.
export const GEOGRAPHY_SOURCES = Object.freeze([
  { id:'geonames', name:'GeoNames', url:'https://www.geonames.org/', license:'CC BY 4.0', licenseUrl:'https://www.geonames.org/about.html', accessedAt:'2026-10-04', retrievedThrough:'geonamescache 3.0.2 / geonamescache/data/cities500.json', packageUrl:'https://pypi.org/project/geonamescache/3.0.2/', packageSha256:'b830e8942f2d58c7e68782dcf4dff2ffe8c4104a35ee881ed1ad4023cefcdba4', originalSnapshotDate:null, status:'packaged-data-inspected' },
  { id:'openstreetmap', name:'OpenStreetMap contributors', url:'https://www.openstreetmap.org/', license:'ODbL', licenseUrl:'https://www.openstreetmap.org/copyright', tileUrl:'https://tile.openstreetmap.org/{z}/{x}/{y}.png', checkedAt:'2026-10-04', accessedAt:null, status:'runtime-proxy-blocked' },
  { id:'fcta', name:'Federal Capital Territory Administration', url:'https://www.fcta.gov.ng/', checkedAt:'2026-10-04', accessedAt:null, status:'runtime-proxy-blocked' },
  { id:'agis', name:'Abuja Geographic Information Systems', url:'https://agis.fcta.gov.ng/', alternateUrl:'https://agis.fct.gov.ng/', checkedAt:'2026-10-04', accessedAt:null, status:'runtime-proxy-blocked' }
]);
const point=(name,lat,lon,geonameid)=>Object.freeze({ name, kind:'settlement-point', coordinates:Object.freeze({lat,lon}), source:Object.freeze({id:'geonames',geonameid,url:`https://www.geonames.org/${geonameid}`,accessedAt:'2026-10-04',recordType:'named-settlement',countrycode:'NG',admin1code:'11'}) });
export const SETTLEMENT_POINTS=Object.freeze({
  abuja:point('Abuja',9.05785,7.49508,2352778),
  'bwari-town':point('Bwari',9.27995,7.38045,2346245),
  'gwagwalada-town':point('Gwagwalada',8.94342,7.08165,2339863),
  'kuje-town':point('Kuje',8.87952,7.22756,2333604),
  'kwali-town':point('Kwali',8.88346,7.01858,2332865),
  'abaji-town':point('Abaji',8.47581,6.94321,2353104)
});

// The browser map renders this attribution for every map state, including source failure.
export const MAP_ATTRIBUTION=Object.freeze([
  Object.freeze({id:'openstreetmap',label:'© OpenStreetMap contributors',url:'https://www.openstreetmap.org/copyright',license:'ODbL'}),
  Object.freeze({id:'geonames',label:'GeoNames',url:'https://www.geonames.org/',license:'CC BY 4.0'})
]);

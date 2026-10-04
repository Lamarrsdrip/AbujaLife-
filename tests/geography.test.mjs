import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABUJA_ATLAS, AREA_COUNCILS, FCC_DISTRICTS, SATELLITE_TOWNS,
  LANDMARKS, ATLAS_META, GEOGRAPHY_HIERARCHY
} from '../src/shared/atlas.mjs';
import { GEOGRAPHY_SOURCES, SETTLEMENT_POINTS, MAP_ATTRIBUTION } from '../src/shared/geography-sources.mjs';

// Independent regression fixture transcribed from the inspected GeoNames cities500
// records in geonamescache 3.0.2. Points are settlements, not legal boundaries.
const sourceRecords=[
  ['abuja',2352778,9.05785,7.49508],
  ['bwari-town',2346245,9.27995,7.38045],
  ['gwagwalada-town',2339863,8.94342,7.08165],
  ['kuje-town',2333604,8.87952,7.22756],
  ['kwali-town',2332865,8.88346,7.01858],
  ['abaji-town',2353104,8.47581,6.94321]
];

test('settlement reference points retain exact inspected GeoNames coordinates and identities',()=>{
  assert.deepEqual(Object.keys(SETTLEMENT_POINTS).sort(),sourceRecords.map(r=>r[0]).sort());
  for(const [id,geonameid,lat,lon] of sourceRecords){
    const p=SETTLEMENT_POINTS[id];
    assert.deepEqual(p.coordinates,{lat,lon},id);
    assert.equal(p.kind,'settlement-point');
    assert.equal(p.source.geonameid,geonameid);
    assert.equal(p.source.id,'geonames');
    assert.equal(p.source.url,`https://www.geonames.org/${geonameid}`);
    assert.equal(p.source.countrycode,'NG');
    assert.equal(p.source.admin1code,'11');
    assert.equal(p.source.recordType,'named-settlement');
    assert.equal(p.source.accessedAt,'2026-10-04');
  }
  const source=GEOGRAPHY_SOURCES.find(s=>s.id==='geonames');
  assert.equal(source.status,'packaged-data-inspected');
  assert.equal(source.packageUrl,'https://pypi.org/project/geonamescache/3.0.2/');
  assert.equal(source.packageSha256,'b830e8942f2d58c7e68782dcf4dff2ffe8c4104a35ee881ed1ad4023cefcdba4');
  assert.equal(source.originalSnapshotDate,null,'An unprovided upstream snapshot date must stay unknown');
});

test('123 unique catalogue entries preserve council, town, district and sector distinctions',()=>{
  assert.equal(ABUJA_ATLAS.length,123);
  assert.equal(new Set(ABUJA_ATLAS.map(p=>p.id)).size,123);
  assert.deepEqual(AREA_COUNCILS.map(p=>p.id).sort(),['abaji','amac','bwari','gwagwalada','kuje','kwali']);
  assert.ok(AREA_COUNCILS.every(p=>p.kind==='area-council'&&p.territory==='fct'));
  assert.equal(FCC_DISTRICTS.length,94);
  assert.equal(SATELLITE_TOWNS.length,29);
  assert.ok(SATELLITE_TOWNS.every(p=>p.kind==='town'&&p.territory==='fct'&&p.phase===null&&p.code===null));
  assert.ok(FCC_DISTRICTS.every(p=>p.kind===(p.id.startsWith('sector-')?'fcc-sector':'fcc-district')&&p.city==='fcc'));
  assert.equal(ABUJA_ATLAS.find(p=>p.id==='kubwa').kind,'town');
  assert.equal(ABUJA_ATLAS.find(p=>p.id==='kuje-town').kind,'town');
  assert.equal(ABUJA_ATLAS.find(p=>p.id==='wuse-ii-a07').kind,'fcc-district');
  const councilIds=new Set(AREA_COUNCILS.map(c=>c.id));
  assert.ok(SATELLITE_TOWNS.every(p=>councilIds.has(p.council)&&p.verification==='official-source-pending'));
  assert.deepEqual(GEOGRAPHY_HIERARCHY,['territory','area-council','city-or-town','district-or-sector','neighbourhood','road-corridor','venue']);
  assert.deepEqual(ATLAS_META.hierarchy,GEOGRAPHY_HIERARCHY);
});

test('unverified FCC cadastral and council claims are withheld from official fields',()=>{
  for(const p of FCC_DISTRICTS){
    assert.equal(p.council,null,p.id);
    assert.equal(p.code,null,p.id);
    assert.equal(p.phase,null,p.id);
    assert.equal(p.verification,'official-source-pending');
    assert.equal(p.legacyAssertions.council,'amac');
    assert.ok(['I','II','III','IV','V'].includes(p.legacyAssertions.phase));
  }
  assert.equal(ATLAS_META.officialGeographyComplete,false);
  assert.equal(ATLAS_META.locationCount,123);
  assert.match(ATLAS_META.sourceModel,/Legacy location catalogue/);
  assert.match(ATLAS_META.sourceModel,/verification pending/);
  for(const id of ['fcta','agis']){
    const source=GEOGRAPHY_SOURCES.find(s=>s.id===id);
    assert.equal(source.accessedAt,null);
    assert.equal(source.status,'runtime-proxy-blocked');
  }
});

test('only cited settlement pins ship; no district, landmark or foreign Karu point is invented',()=>{
  const pinned=ABUJA_ATLAS.filter(p=>p.coordinates);
  assert.equal(pinned.length,5);
  for(const p of pinned){
    assert.equal(p.kind,'town');
    assert.deepEqual(p.coordinates,SETTLEMENT_POINTS[p.id].coordinates);
    assert.deepEqual(p.coordinateSource,SETTLEMENT_POINTS[p.id].source);
  }
  assert.ok(FCC_DISTRICTS.every(p=>p.coordinates===undefined&&p.coordinateSource===undefined));
  assert.ok(LANDMARKS.every(p=>p.coordinates===undefined&&p.kind==='landmark'));
  for(const id of ['karu','wuse-ii-a07','jabi','garki-i'])assert.equal(ABUJA_ATLAS.find(p=>p.id===id).coordinates,undefined,id);
  for(const id of ['aso-rock','airport','rail-hub','abuja-metro-station'])assert.equal(LANDMARKS.find(p=>p.id===id).district,null,id);
  assert.notEqual(LANDMARKS.find(p=>p.id==='rail-hub').id,LANDMARKS.find(p=>p.id==='abuja-metro-station').id);
  assert.equal(ATLAS_META.verifiedCoordinateCount,6,'Includes the Abuja city focus reference, not six verified district centres');
});

test('street map and reference point providers retain linked licensing and visible attribution data',()=>{
  assert.deepEqual(MAP_ATTRIBUTION.map(p=>p.id),['openstreetmap','geonames']);
  const osm=MAP_ATTRIBUTION.find(p=>p.id==='openstreetmap'),gn=MAP_ATTRIBUTION.find(p=>p.id==='geonames');
  assert.equal(osm.label,'© OpenStreetMap contributors');
  assert.equal(osm.url,'https://www.openstreetmap.org/copyright');
  assert.equal(osm.license,'ODbL');
  assert.equal(gn.label,'GeoNames');
  assert.equal(gn.url,'https://www.geonames.org/');
  assert.equal(gn.license,'CC BY 4.0');
  for(const provider of MAP_ATTRIBUTION){
    assert.equal(new URL(provider.url).protocol,'https:');
    assert.equal(GEOGRAPHY_SOURCES.find(s=>s.id===provider.id).license,provider.license);
  }
  const tileSource=GEOGRAPHY_SOURCES.find(s=>s.id==='openstreetmap');
  assert.equal(tileSource.tileUrl,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(tileSource.accessedAt,null,'Blocked tile access is not reported as an inspected map');
});

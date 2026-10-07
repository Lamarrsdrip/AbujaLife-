import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_LANDMARKS } from '../src/shared/city-landmarks.mjs';
import { VENUES, VENUE_ACTIONS, venuesForDistrict } from '../src/shared/life.mjs';
import fs from 'node:fs';

const byId=new Map(VENUES.map(v=>[v.id,v]));
const legacyInteriors=new Set(['banex','jabi-lake']);
const worldCitySource=()=>[
  fs.readFileSync(new URL('../app/world-city.js',import.meta.url),'utf8'),
  fs.readFileSync(new URL('../app/world-city-base.js',import.meta.url),'utf8'),
].join('\n');

test('every Abuja map landmark resolves to a playable venue and a destination-specific interior path',()=>{
  assert.equal(CITY_LANDMARKS.length,21);
  const interiors=fs.readFileSync(new URL('../app/world-interiors.js',import.meta.url),'utf8');
  for(const landmark of CITY_LANDMARKS){
    const venue=byId.get(landmark.id);assert.ok(venue,`${landmark.id} missing from VENUES`);
    assert.ok(!venue.districts||venue.districts.includes(landmark.districtId),`${landmark.id} district mismatch`);
    if(!legacyInteriors.has(landmark.id))assert.equal(venue.landmarkInterior,landmark.interior,`${landmark.id} interior mismatch`);
    else assert.match(interiors,new RegExp(landmark.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('all civic City Story destinations are exact playable landmark venues',()=>{
  for(const id of ['inec-hq','efcc-hq','federal-high-court-hub'])assert.ok(byId.has(id),`${id} is not playable`);
  const civic=fs.readFileSync(new URL('../app/civic-life.js',import.meta.url),'utf8');
  for(const id of ['inec-hq','efcc-hq','federal-high-court-hub'])assert.match(civic,new RegExp(id));
  assert.match(fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8'),/abj:open-map-venue/);
});

test('full-city free roam exposes landmarks and map keeps outer ad space',()=>{
  for(const landmark of CITY_LANDMARKS){
    const ids=new Set(venuesForDistrict(landmark.districtId).map(v=>v.id));
    assert.ok(ids.has(landmark.id),`${landmark.id} missing from its authoritative district`);
  }
  const world=worldCitySource();
  assert.match(world,/CITY_LANDMARKS/);assert.match(world,/airport-plane/);assert.match(world,/width=8500/);assert.match(world,/travel-venue/);
  const map=fs.readFileSync(new URL('../app/outside-city-v4.js',import.meta.url),'utf8');
  assert.match(map,/CITY_LANDMARKS/);assert.match(map,/Advertising plot/);assert.match(map,/minZoom:\.22,maxZoom:24/);
});

test('landmarks have contextual activity instead of empty generic rooms',()=>{
  const actionIds=new Set(VENUE_ACTIONS.map(a=>a.venueId));
  for(const landmark of CITY_LANDMARKS)assert.ok(actionIds.has(landmark.id)||landmark.id==='banex',`${landmark.id} has no contextual activity`);
});

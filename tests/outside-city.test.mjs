import test from 'node:test';
import assert from 'node:assert/strict';
import {ABUJA_ATLAS} from '../src/shared/atlas.mjs';
import {VENUES,venueAvailable} from '../src/shared/life.mjs';
import {createOutsideLayout,outsideDestination} from '../app/outside-city.js';

test('Outside includes every authored district and venue once with unique scenery addresses',()=>{
  const layout=createOutsideLayout(ABUJA_ATLAS,VENUES);
  assert.equal(layout.districts.length,123);assert.equal(layout.venues.length,20);
  assert.deepEqual(layout.districts.map(d=>d.id),ABUJA_ATLAS.map(d=>d.id));
  assert.deepEqual(layout.venues.map(v=>v.id),VENUES.map(v=>v.id));
  assert.equal(new Set([...layout.districts,...layout.venues].map(p=>p.key)).size,143);
  assert.equal(new Set(layout.districts.map(p=>`${p.x},${p.z}`)).size,123);
  for(const place of [...layout.districts,...layout.venues]){assert.ok(Number.isFinite(place.x)&&Number.isFinite(place.z));assert.ok(Math.abs(place.x)<layout.width/2);assert.ok(Math.abs(place.z)<layout.depth/2);}
});

test('restricted destinations preserve their authored district associations',()=>{
  const layout=createOutsideLayout(ABUJA_ATLAS,VENUES);
  for(const venue of layout.venues){assert.ok(venueAvailable(venue.id,venue.districtId));assert.deepEqual(outsideDestination(layout,venue.destination),{districtId:venue.districtId,venueId:venue.id});}
  assert.equal(layout.venues.find(v=>v.id==='banex').districtId,'wuse-ii-a08');
  assert.equal(layout.venues.find(v=>v.id==='club-cage').districtId,'wuse-ii-a07');
  assert.equal(layout.venues.find(v=>v.id==='magic-city').districtId,'garki-ii');
  assert.equal(layout.venues.find(v=>v.id==='jabi-lake').districtId,'jabi');
  assert.equal(layout.venues.find(v=>v.id==='bear-barn').districtId,'jabi');
});

test('destination routing validates identity and returns travel intent without changing resident state',()=>{
  const profile={district:'jabi',location:{kind:'home'},activeTrip:null},before=structuredClone(profile);
  const layout=createOutsideLayout(ABUJA_ATLAS,VENUES),input={districtId:'garki-i',profile,location:{kind:'venue'},teleport:true};
  assert.deepEqual(outsideDestination(layout,input),{districtId:'garki-i'});
  assert.deepEqual(profile,before);assert.deepEqual(input.profile,before);
  assert.equal(outsideDestination(layout,{districtId:'unknown'}),null);
  assert.equal(outsideDestination(layout,{districtId:'garki-i',venueId:'unknown'}),null);
  assert.equal(outsideDestination(layout,{districtId:'garki-i',venueId:'banex'}),null);
  assert.equal(outsideDestination(layout,{districtId:'garki-i',venueId:'jabi-lake'}),null);
  assert.deepEqual(outsideDestination(layout,{districtId:'jabi',venueId:'restaurant'}),{districtId:'jabi',venueId:'restaurant'});
});

test('empty or repeated catalogues do not create duplicate or unavailable destinations',()=>{
  assert.equal(createOutsideLayout([],VENUES).venues.length,0);
  const layout=createOutsideLayout([ABUJA_ATLAS[0],ABUJA_ATLAS[0]],[VENUES[0],VENUES[0],VENUES.find(v=>v.id==='jabi-lake')]);
  assert.equal(layout.districts.length,1);assert.equal(layout.venues.length,1);
  assert.deepEqual(layout.venues[0].destination,{districtId:ABUJA_ATLAS[0].id,venueId:VENUES[0].id});
  const scalar=createOutsideLayout(ABUJA_ATLAS,[{id:'local-place',name:'Local place',district:'jabi'}]);
  assert.equal(scalar.venues[0].districtId,'jabi');
  assert.equal(outsideDestination(scalar,{districtId:'garki-i',venueId:'local-place'}),null);
});

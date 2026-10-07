import test from 'node:test';
import assert from 'node:assert/strict';
import { ABUJA_ATLAS } from '../src/shared/atlas.mjs';
import { VENUES, NIGHTCLUB_IDS, venuesForDistrict, venueAvailable } from '../src/shared/life.mjs';
import { buildCity } from '../app/world-city.js';
import { createOutsideLayout, outsideDestination } from '../app/outside-city.js';

test('each district exposes exactly one working local entrance for every available nightclub',()=>{
  for(const district of ABUJA_ATLAS){
    const scene=buildCity({profile:{district:district.id,home:{district:district.id}},place:district,venues:venuesForDistrict(district.id)});
    for(const venueId of NIGHTCLUB_IDS){
      const doors=scene.interactables.filter(point=>point.payload?.venueId===venueId);
      assert.equal(doors.length,venueAvailable(venueId,district.id)?1:0,`${district.id}: ${venueId}`);
      if(doors.length){
        assert.equal(doors[0].action,'enter-venue');
        assert.ok(scene.art.includes(`data-world-target="${venueId}"`));
        assert.ok(scene.buildings.some(building=>building.id===venueId&&!building.context));
      }else{
        assert.ok(!scene.art.includes(`data-world-target="${venueId}"`),`${district.id} has a dead ${venueId} facade`);
        assert.ok(!scene.buildings.some(building=>building.id===venueId));
      }
    }
  }
});

test('the Outside directory gives every nightclub a valid, unique travel destination',()=>{
  const layout=createOutsideLayout(ABUJA_ATLAS,VENUES);
  for(const venueId of NIGHTCLUB_IDS){
    const destinations=layout.venues.filter(venue=>venue.id===venueId);
    assert.equal(destinations.length,1);
    const venue=destinations[0];
    assert.ok(venueAvailable(venueId,venue.districtId));
    assert.deepEqual(outsideDestination(layout,venue.destination),{districtId:venue.districtId,venueId});
  }
});

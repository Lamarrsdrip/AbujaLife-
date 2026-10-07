import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInterior} from '../app/world-interiors.js';
import {CITY_LANDMARKS} from '../src/shared/city-landmarks.mjs';
import {venueFor} from '../src/shared/life.mjs';

const important=['airport-hub','national-stadium-hub','magicland','wtc-abuja-hub','cbn-experience','national-assembly-hub','transcorp-hilton-hub','international-conference-centre','banex','inec-hq','efcc-hq','federal-high-court-hub'];

test('major Abuja landmarks have authored fixtures and purpose zones rather than renamed generic rooms',()=>{
  const fixtureMarks=new Set();
  for(const id of important){
    const landmark=CITY_LANDMARKS.find(p=>p.id===id),venue=venueFor(id)||{id,name:landmark.name,type:'estate-office'};
    const profile={id:`resident-${id}`,district:landmark.districtId,location:{kind:'venue',district:landmark.districtId,venue:id},appearance:{},inventory:[],furnitureLayout:{}};
    const scene=buildInterior({profile,venue,id:`venue-${id}`});
    assert.equal(scene.venueLayout?.landmark,true,id);
    assert.equal(scene.venueLayout?.authored,true,id);
    assert.ok(scene.venueLayout.zones.length>=3,id);
    assert.ok(scene.art.includes(`data-landmark-interior="${landmark.builder}"`),id);
    assert.ok(scene.objects.some(object=>object.landmarkFixture===true),id);
    fixtureMarks.add(scene.art.match(/data-landmark-interior="([^"]+)/)?.[1]);
  }
  assert.ok(fixtureMarks.size>=10,'different landmarks must not collapse back to one generic room');
});

test('civic interiors expose the correct fictional public-purpose zones',()=>{
  const expected={
    'inec-hq':['registration-desk','voter-information','queue-zone'],
    'efcc-hq':['integrity-gallery','fictional-briefing-room','public-information'],
    'federal-high-court-hub':['bench','public-gallery','counsel-area'],
    'national-assembly-hub':['public-gallery','chamber-view','committee-lobby'],
  };
  for(const [id,zones] of Object.entries(expected)){
    const landmark=CITY_LANDMARKS.find(p=>p.id===id),profile={id:'resident-civic',district:landmark.districtId,location:{kind:'venue',district:landmark.districtId,venue:id},inventory:[],furnitureLayout:{}};
    const scene=buildInterior({profile,venue:venueFor(id)||{id,name:landmark.name,type:'estate-office'}});
    for(const zone of zones)assert.ok(scene.landmarkZones.includes(zone),`${id} missing ${zone}`);
  }
});

test('authored landmark furnishing is part of the physical room rather than a decoration over a generic estate office',()=>{
  const expected={
    'airport-hub':['service-desk','visitor-seat'],
    'inec-hq':['registration-desk','visitor-seat'],
    'international-conference-centre':['conference-stage','conference-seat'],
    'federal-high-court-hub':['bench','court-bench'],
    'jabi-lake-mall':['shopfront'],
  };
  for(const [id,kinds] of Object.entries(expected)){
    const scene=buildInterior({profile:{location:{kind:'venue',venue:id}},venue:venueFor(id)});
    for(const kind of kinds){
      const fixture=scene.objects.find(item=>item.kind===kind);
      assert.ok(fixture,`${id} physical ${kind}`);
      assert.ok(fixture.modelKind,`${id} ${kind} has a native 3D model`);
    }
    assert.doesNotMatch(scene.art,/THE PROPERTY STUDIO|FIND YOUR CORNER OF ABUJA/);
  }
});

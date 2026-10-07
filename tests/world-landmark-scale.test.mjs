import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCity, WORLD_LANDMARK_SIZES } from '../app/world-city.js';
import { CITY_LANDMARKS } from '../src/shared/city-landmarks.mjs';

test('new Abuja landmarks have legacy-city-scale 3D footprints without changing the map registry',()=>{
  const scene=buildCity({profile:{district:'wuse-ii-a07',home:{district:'wuse-ii-a07'}},place:{id:'wuse-ii-a07',name:'Wuse II'},venues:[]});
  const landmarks=scene.buildings.filter(item=>item.landmarkBuilder);
  assert.ok(landmarks.length>=18,landmarks.length);
  assert.equal(scene.landmarkScaleVersion,2);
  for(const building of landmarks){
    const expected=WORLD_LANDMARK_SIZES[building.landmarkBuilder];
    assert.ok(expected,building.landmarkBuilder);
    assert.deepEqual([building.w,building.h],expected,building.id);
    assert.ok(building.w>=390,`${building.id} is too narrow beside legacy city blocks`);
    assert.ok(building.h>=250,`${building.id} is too shallow beside legacy city blocks`);
    assert.equal(building.worldScale,'legacy-city-compatible');
  }
  assert.equal(CITY_LANDMARKS.length>=landmarks.length,true);
});

test('major newer landmark models are no longer miniature beside old hotel/cinema/residence footprints',()=>{
  const sizes=Object.values(WORLD_LANDMARK_SIZES);
  const median=values=>{const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
  assert.ok(median(sizes.map(([w])=>w))>=425);
  assert.ok(median(sizes.map(([,h])=>h))>=300);
  assert.deepEqual(WORLD_LANDMARK_SIZES.transcorp,[460,390]);
  assert.deepEqual(WORLD_LANDMARK_SIZES.wtc,[430,420]);
  assert.deepEqual(WORLD_LANDMARK_SIZES.airport,[560,300]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {ABUJA_ATLAS} from '../src/shared/atlas.mjs';
import {VENUES,actionsForVenue,venueFor} from '../src/shared/life.mjs';
import {createOutsideLayout,outsideDestination} from '../app/outside-city.js';
import {REAL_ABUJA_PLACE_IDS} from '../app/abuja-real-places-3d.js';

const expected={
  'city-gate-plaza':'kukwaba',
  'aso-rock-view':'central-area',
  'cbn-experience':'central-area',
  magicland:'kukwaba',
  'farm-city':'wuse-ii-a07',
  'transcorp-hilton-hub':'maitama',
  'millennium-park-hub':'maitama',
  'eagle-square-hub':'central-area',
  'national-mosque-hub':'central-area',
  'national-christian-centre-hub':'central-area',
  'national-stadium-hub':'kukwaba',
};

test('real Abuja references are first-class playable multiplayer destinations, not synthetic map labels',()=>{
  const layout=createOutsideLayout(ABUJA_ATLAS,VENUES,true);
  for(const [id,districtId] of Object.entries(expected)){
    const venue=venueFor(id),placed=layout.venues.find(place=>place.id===id);
    assert.ok(venue,id);assert.equal(venue.fictional,false,id);assert.ok(actionsForVenue(id).length>0,`${id} needs purposeful activities`);
    assert.ok(placed,id);assert.equal(placed.synthetic,undefined,id);assert.equal(placed.districtId,districtId,id);
    assert.deepEqual(outsideDestination(layout,placed.destination),{districtId,venueId:id});
  }
  assert.deepEqual([...REAL_ABUJA_PLACE_IDS].sort(),Object.keys(expected).sort());
});

test('real destinations model plausible public purpose rather than turning every landmark into a shop',()=>{
  const cbn=venueFor('cbn-experience'),aso=venueFor('aso-rock-view'),farm=venueFor('farm-city'),hotel=venueFor('transcorp-hilton-hub');
  assert.match(cbn.description,/central-bank|financial-system|economic/i);
  assert.doesNotMatch(actionsForVenue(cbn.id).map(action=>action.name).join(' '),/withdraw|deposit cash|open account/i);
  assert.match(aso.description,/viewpoint/i);assert.match(aso.description,/secured/i);
  assert.ok(actionsForVenue(farm.id).some(action=>/eat|meal/i.test(action.name)));
  assert.ok(actionsForVenue(farm.id).some(action=>/arcade/i.test(action.name)));
  assert.ok(actionsForVenue(hotel.id).some(action=>/lobby|pool|dinner/i.test(action.name)));
});

test('the outside world is physically roomier while keeping one canonical shared zone per venue',()=>{
  const layout=createOutsideLayout(ABUJA_ATLAS,VENUES,true);
  assert.equal(layout.cellWidth,520);assert.equal(layout.cellDepth,440);
  assert.ok(layout.width>Math.ceil(Math.sqrt(ABUJA_ATLAS.length*1.18))*430);
  const keys=layout.venues.map(place=>place.key);assert.equal(new Set(keys).size,keys.length);
  for(const id of Object.keys(expected))assert.equal(layout.venues.filter(place=>place.id===id).length,1,id);
});

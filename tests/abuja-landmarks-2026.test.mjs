import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/shared/abuja-landmarks-2026.mjs';
import { VENUES, VENUE_ACTIONS } from '../src/shared/life.mjs';
import { ABUJA_2026_LANDMARK_VENUE_IDS, ABUJA_2026_LANDMARK_ACTION_IDS } from '../src/shared/abuja-landmarks-2026.mjs';

test('2026 Abuja landmarks are registered as playable multiplayer venues',()=>{
  const expected=['airport-hub','national-assembly-hub','wtc-abuja-hub'];
  assert.deepEqual(ABUJA_2026_LANDMARK_VENUE_IDS,expected);
  for(const id of expected){
    const venue=VENUES.find(item=>item.id===id);
    assert.ok(venue,`${id} should be registered`);
    assert.equal(venue.fictional,false);
    assert.ok(Array.isArray(venue.districts)&&venue.districts.length>0);
  }
  assert.equal(new Set(VENUES.map(item=>item.id)).size,VENUES.length,'venue ids stay unique');
});

test('each added landmark has game activities',()=>{
  assert.equal(ABUJA_2026_LANDMARK_ACTION_IDS.length,6);
  for(const venueId of ABUJA_2026_LANDMARK_VENUE_IDS){
    const actions=VENUE_ACTIONS.filter(action=>action.venueId===venueId);
    assert.ok(actions.length>=2,`${venueId} should have at least two activities`);
    for(const action of actions){
      assert.ok(Number.isFinite(action.duration)&&action.duration>0);
      assert.ok(Number.isFinite(action.cost)&&action.cost>=0);
    }
  }
  assert.equal(new Set(VENUE_ACTIONS.map(item=>item.id)).size,VENUE_ACTIONS.length,'action ids stay unique');
});

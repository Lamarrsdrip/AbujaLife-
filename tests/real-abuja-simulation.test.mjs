import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/shared/catalogue.mjs';
import { EXTRA_HOME_ITEMS } from '../src/shared/home-items.mjs';
import {
  VENUES,
  VENUE_ACTIONS,
  starterHomeSeed,
  travelPricing,
  venueAvailable,
  actionsForVenue,
} from '../src/shared/life.mjs';

const byId = id => VENUES.find(venue => venue.id === id);

test('owned cars never charge a hidden per-trip game fare', () => {
  const origin={id:'garki-i',commute:30}, destination={id:'jabi',commute:42};
  assert.equal(travelPricing(origin,destination,'car').cost,0);
  assert.equal(travelPricing(origin,origin,'car',{venueId:'restaurant'}).cost,0);
  assert.ok(travelPricing(origin,destination,'bus').cost>0);
  assert.ok(travelPricing(origin,destination,'taxi').cost>0);
});

test('gifted-home starter furniture is real owned catalogue inventory', () => {
  const seed=starterHomeSeed({id:'nepo'});
  assert.equal(seed.homeStyle.starterVersion,1);
  assert.equal(seed.homeStyle.furnishingPreset,'nepo-furnished');
  assert.deepEqual(seed.inventory,['bed','sofa','dining-table','fridge']);
  for(const itemId of seed.inventory){
    const item=catalog.find(entry=>entry.id===itemId);
    assert.ok(item,`starter item ${itemId} must exist in the catalogue`);
    assert.equal(item.category,'furniture');
    assert.ok(Number.isSafeInteger(item.price)&&item.price>0,`${itemId} must have a resale basis`);
  }
  const basic=starterHomeSeed({id:'lapo'});
  assert.equal(basic.homeStyle.starterVersion,1);
  assert.deepEqual(basic.inventory,[]);
});

test('the richer 3D home catalogue stays resident-owned and model-backed', () => {
  assert.ok(EXTRA_HOME_ITEMS.length>=35);
  for(const item of EXTRA_HOME_ITEMS){
    assert.equal(item.category,'furniture');
    assert.ok(item.modelKind);
    assert.ok(item.width>0&&item.depth>0);
    assert.ok(catalog.some(entry=>entry.id===item.id));
  }
});

test('real Abuja multiplayer hubs have a purpose, a district and playable actions', () => {
  const expected=[
    ['city-gate-plaza','kukwaba'],
    ['aso-rock-view','central-area'],
    ['cbn-experience','central-area'],
    ['magicland','kukwaba'],
    ['farm-city','wuse-ii-a07'],
    ['transcorp-hilton-hub','maitama'],
    ['millennium-park-hub','maitama'],
    ['eagle-square-hub','central-area'],
    ['national-mosque-hub','central-area'],
    ['national-christian-centre-hub','central-area'],
    ['national-stadium-hub','kukwaba'],
  ];
  for(const [id,district] of expected){
    const venue=byId(id);
    assert.ok(venue,`${id} must exist`);
    assert.equal(venue.fictional,false);
    assert.equal(venue.settingSource,'real-world-reference-authored-game-approximation');
    assert.match(venue.affiliation,/no affiliation or endorsement/i);
    assert.ok(venue.districts.includes(district));
    assert.equal(venueAvailable(id,district),true);
    const actions=actionsForVenue(id);
    assert.ok(actions.length>=2,`${id} needs meaningful activities`);
    for(const action of actions){
      assert.equal(action.venueId,id);
      assert.ok(Number.isFinite(action.duration)&&action.duration>=14);
      assert.ok(action.effects&&typeof action.effects==='object');
    }
  }
  assert.equal(new Set(VENUE_ACTIONS.map(action=>action.id)).size,VENUE_ACTIONS.length);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterior, furniturePlacementPreservesRoutes } from '../app/world-interiors.js';
import { catalog, properties } from '../src/server/gameStore.mjs';
import { VENUES } from '../src/shared/life.mjs';

const furniture=catalog.filter(item=>item.category==='furniture').map(item=>item.id);
const homeProfile=(propertyId,extra={})=>({home:{propertyId},location:{kind:'home'},inventory:[],furnitureLayout:{},...extra});
const movedSofa={x:(476-62)/1636,y:(1029-160)/1000,rotation:90};
const doorwayPool={x:(389.5-62)/1636,y:(735-160)/1000,rotation:270};

test('a locally clear pool-table placement cannot seal the Maitama bedroom route',()=>{
  const profile=homeProfile('maitama-villa',{inventory:['sofa'],furnitureLayout:{sofa:movedSofa}});
  const scene=buildInterior({profile});
  assert.equal(furniturePlacementPreservesRoutes(scene,null),true);
  const blockedDoorway={x:317,y:615,w:145,h:240};
  assert.equal(scene.obstacles.some(o=>blockedDoorway.x<o.x+o.w+16&&blockedDoorway.x+blockedDoorway.w>o.x-16&&blockedDoorway.y<o.y+o.h+16&&blockedDoorway.y+blockedDoorway.h>o.y-16),false,'the old local clearance check accepts this footprint');
  assert.equal(furniturePlacementPreservesRoutes(scene,blockedDoorway),false,'placement must keep Sleep and Wardrobe accessible');
  const restored=buildInterior({profile:{...profile,inventory:['sofa','pool-table'],furnitureLayout:{sofa:movedSofa,'pool-table':doorwayPool}}});
  const placed=restored.furniturePlacements.find(item=>item.itemId==='pool-table');
  assert.ok(placed,'the owned table should fit in another safe spot');
  assert.notDeepEqual({x:placed.x,y:placed.y,w:placed.w,h:placed.h},blockedDoorway);
  assert.equal(furniturePlacementPreservesRoutes(restored,null),true);
});

test('explicitly stored furniture stays owned and out of the rendered room after reload',()=>{
  const ids=['plant','sofa','bed','dining-table'];
  const profile=homeProfile('garki-studio',{inventory:ids,storedFurniture:ids});
  for(const resident of [profile,JSON.parse(JSON.stringify(profile)),{...profile,home:{propertyId:'maitama-villa'}}]){
    const scene=buildInterior({profile:resident});
    assert.deepEqual(scene.storedFurniture,ids);
    assert.equal(scene.furniturePlacements.length,0);
    assert.equal(scene.objects.some(item=>ids.includes(item.itemId)),false);
    assert.deepEqual(resident.inventory,ids);
  }
  const returned=buildInterior({profile:{...profile,storedFurniture:ids.filter(id=>id!=='plant')}});
  assert.ok(returned.furniturePlacements.some(item=>item.itemId==='plant'));
  assert.deepEqual(returned.storedFurniture,ids.filter(id=>id!=='plant'));
});

test('every home preserves walking routes with the complete expanded inventory and rotated saved layouts',()=>{
  assert.ok(furniture.length>=54);
  assert.equal(properties.length,6);
  for(const home of properties)for(const mode of ['empty','all','rotated']){
    const profile=homeProfile(home.id,{inventory:mode==='empty'?[]:furniture,furnitureLayout:mode==='rotated'?Object.fromEntries(furniture.map((id,i)=>[id,{x:(i%4+1)/5,y:(Math.floor(i/4)+1)/6,rotation:i%2?90:270}])):{}});
    const scene=buildInterior({profile});
    assert.equal(furniturePlacementPreservesRoutes(scene,null),true,`${home.id}: ${mode}`);
    assert.equal(scene.furniturePlacements.length+scene.storedFurniture.length,profile.inventory.length,`${home.id}: every owned item is placed or stored`);
  }
});

test('every authored and real-purpose Abuja venue has a walkable route to activities and exits',()=>{
  assert.ok(VENUES.length>=31);
  for(const venue of VENUES){
    const scene=buildInterior({profile:{location:{kind:'venue',venue:venue.id}},venue});
    assert.ok(scene.interactables.some(point=>point.action==='exit-venue'),venue.id);
    assert.equal(furniturePlacementPreservesRoutes(scene,null),true,venue.id);
  }
});

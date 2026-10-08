import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildInterior,furniturePlacementPreservesRoutes} from '../app/world-interiors.js';
import {anchorInteriorActivities,interiorExit,interiorPromptPosition} from '../app/world-interior-actions.js';
import {VENUES} from '../src/shared/life.mjs';

const home=(extra={})=>({home:{propertyId:'garki-studio',starterVersion:1,furnishingPreset:'lapo-basic'},location:{kind:'home'},inventory:[],...extra});
const atVenue=id=>buildInterior({profile:{location:{kind:'venue',venue:id}},venue:VENUES.find(venue=>venue.id===id)});

test('all existing venues expose their real server exit and preserve authored walking routes',()=>{
  for(const venue of VENUES){
    const scene=atVenue(venue.id),exit=interiorExit(scene);
    assert.equal(exit?.action,'exit-venue',venue.id);
    assert.equal(furniturePlacementPreservesRoutes(scene,null),true,venue.id);
    assert.equal(new Set(scene.interactables.map(point=>point.id)).size,scene.interactables.length,venue.id);
  }
  assert.equal(interiorExit(buildInterior({profile:home()}))?.action,'leave-home');
  assert.equal(interiorExit({interactables:[{action:'leave-visit',payload:{}}]})?.action,'leave-visit');
  assert.equal(interiorExit({interactables:[]}),null);
});

test('a meal follows a resident-owned kitchen after placement changes and never invents furniture',()=>{
  const bare=buildInterior({profile:home()}),bareMeal=bare.interactables.find(point=>point.action==='eat');
  assert.equal(bare.objects.some(object=>object.kind==='kitchen'),true);
  assert.equal(bareMeal.promptAnchor?.kind,'kitchen','a starter home has a real built-in kitchenette');
  assert.equal(bareMeal.label,'Make something to eat');
  const profile=home({inventory:['kitchen-unit'],furnitureLayout:{'kitchen-unit':{x:.4,y:.55}}});
  const first=buildInterior({profile});
  const changed=buildInterior({profile:{...profile,furnitureLayout:{'kitchen-unit':{x:.12,y:.75,rotation:90}}}});
  for(const scene of [first,changed]){
    const kitchen=scene.objects.find(object=>object.itemId==='kitchen-unit'),meal=scene.interactables.find(point=>point.action==='eat');
    assert.ok(kitchen,'only the actual owned kitchen is used');
    assert.equal(meal.promptAnchor?.itemId,'kitchen-unit');
    assert.equal(meal.promptAnchor.x,kitchen.x+kitchen.w/2);
    assert.equal(meal.promptAnchor.y,kitchen.y+kitchen.h/2);
    assert.equal(meal.label,'Make something to eat');
    assert.equal(furniturePlacementPreservesRoutes(scene,null),true);
    assert.deepEqual(meal.payload,bareMeal.payload,'cosmetic anchoring cannot change the server action');
  }
  assert.notDeepEqual(first.interactables.find(point=>point.action==='eat').promptAnchor,changed.interactables.find(point=>point.action==='eat').promptAnchor);
  const stored=buildInterior({profile:{...profile,storedFurniture:['kitchen-unit']}});
  assert.equal(stored.objects.some(object=>object.kind==='kitchen'),true,'the authored starter kitchenette remains after moving a purchased unit into storage');
  assert.equal(stored.interactables.find(point=>point.action==='eat').promptAnchor?.kind,'kitchen');
});

test('venue meal, screening, snacks, hotel and services use appropriate authored fixtures',()=>{
  const cases=[
    ['restaurant','jollof-chicken','dining-table'],
    ['cinema','cinema-film','cinema-chair'],
    ['ceddi-genesis-cinema','ceddi-genesis-screening','cinema-chair'],
    ['ceddi-genesis-cinema','ceddi-genesis-popcorn','counter'],
    ['hotel','hotel-rest','bed'],['hotel','hotel-shower','shower'],
    ['gym','gym-workout','treadmill'],
  ];
  for(const [venueId,activityId,kind] of cases){
    const scene=atVenue(venueId),point=scene.interactables.find(point=>point.payload?.activityId===activityId);
    assert.ok(point,activityId);
    assert.equal(point.promptAnchor?.kind,kind,activityId);
    assert.equal(point.action,'venue-action');
    assert.deepEqual(point.payload,{venueId,activityId});
  }
  assert.equal(atVenue('gym').interactables.find(point=>point.payload.activityId==='gym-recovery').promptAnchor,undefined,'open recovery area is preserved');
  assert.equal(atVenue('dealership').interactables.find(point=>point.action==='dealership').promptAnchor?.kind,'counter');
});

test('unreachable fixtures retain the authored safe activity target',()=>{
  const point={id:'meal',x:100,y:200,action:'eat',payload:{}},scene={width:900,height:700,obstacles:[],objects:[{kind:'kitchen',x:400,y:300,w:200,h:80}],interactables:[point]};
  anchorInteriorActivities(scene,{home:true,routeValid:()=>false});
  assert.equal(point.x,100);assert.equal(point.y,200);assert.equal(point.promptAnchor,undefined);
});

test('projected prompts stay by the object and yield to controls, cards and player bounds',()=>{
  const options={anchor:{x:190,y:300},width:390,height:600,promptWidth:150,promptHeight:44};
  assert.deepEqual(interiorPromptPosition(options),{x:115,y:242});
  const blocked={x:100,y:225,width:180,height:85};
  const alternative=interiorPromptPosition({...options,blockers:[blocked]});
  assert.equal(alternative,null,'a blocked fixture does not move its prompt to an unrelated HUD edge');
  assert.equal(interiorPromptPosition({...options,anchor:{x:-200,y:300}}),null);
  assert.equal(interiorPromptPosition({...options,blockers:[{x:0,y:0,width:390,height:600}]}),null);
});

test('the visible outside control dispatches the existing exit independently of walking and blocks double submission',async()=>{
  const source=await fs.readFile(new URL('../app/world-simulator.js',import.meta.url),'utf8');
  const handler=source.slice(source.indexOf("if(control==='exit')"),source.indexOf("if(control==='center')"));
  assert.match(source,/class="world-exit-shortcut" data-world-control="exit"[^>]*>.*?Go outside/);
  assert.match(handler,/interiorExit\(scene\)/);
  assert.match(handler,/exiting\|\|activity\|\|furnitureMode\|\|inputBlocked\(\)/);
  assert.match(handler,/dispatch\(exit\.action,exit\.payload/);
  assert.doesNotMatch(handler,/requestPoint|onDestination|return-home/);
  assert.match(source,/prompt\.dataset\.pointId/,'each projected prompt activates its own target, never the nearest unrelated activity');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createLayout,buildCity} from '../app/outside-city-v4.js';
import {routeForJourney} from '../src/shared/abuja-navigation.mjs';
import {CITY_LANDMARKS} from '../src/shared/city-landmarks.mjs';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('exploration and transport use the same authored city, with no generic highway implementation',()=>{
 assert.match(read('app/world-trip.js'),/renderOutside\(container/);
 for(const file of ['app/world-simulator.js','app/world-city-base.js','app/world-city.js'])assert.doesNotMatch(read(file),/buildJourney/);
 assert.equal(fs.existsSync(new URL('../app/world-route-scene.js',import.meta.url)),false);
});

test('the shared city contains real civic landmarks, navigable graph roads and moving ambient traffic',()=>{
 const layout=createLayout(),city=buildCity(layout);
 assert.equal(layout.landmarks.length,CITY_LANDMARKS.length);
 for(const id of ['inec-hq','jabi-lake','cbn-experience','airport-hub'])assert.ok(layout.landmarkById.has(id));
 for(const landmark of layout.landmarks)assert.ok(city.world.children.some(group=>group.children.some(mesh=>mesh.userData.destinationKey===landmark.key)),`${landmark.id} must have authored geometry`);
 assert.ok(city.traffic.length>=4);const before=city.traffic[0].mesh.position.x;city.updateTraffic(5);assert.notEqual(city.traffic[0].mesh.position.x,before);
 city.dispose();
});

test('different journeys follow different real graph nodes instead of a repeated straight corridor',()=>{
 const a=routeForJourney({fromDistrict:'central-area',toDistrict:'lugbe',toVenue:'airport-hub'}),b=routeForJourney({fromDistrict:'central-area',toDistrict:'jabi',toVenue:'jabi-lake'});
 assert.notDeepEqual(a.nodeIds,b.nodeIds);assert.notDeepEqual(a.points,b.points);
 assert.ok(a.points.length>2);assert.ok(b.points.length>2);
});

test('shared renderer uses server-clock progress, actual owned vehicle models and tangent heading without frame persistence',()=>{
 const city=read('app/outside-city-v4.js');
 assert.match(city,/startsAt=Number\(trip\?\.arrivesAt\)-duration/);
 assert.match(city,/fromLocation/);assert.match(city,/sampleRoutePolyline/);assert.match(city,/vehicleColorHex\(profile,vehicleId\)/);
 assert.match(city,/body\.rotation\.y=-journeyAngle/);assert.match(city,/onArrive\?\.\(trip\.id\)/);
 assert.doesNotMatch(city,/localStorage|sessionStorage|fetch\(|api\./);
});

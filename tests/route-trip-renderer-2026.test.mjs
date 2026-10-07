import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildRouteScene} from '../app/world-route-scene.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const entry=read('app/world.js');
const trip=read('app/world-trip.js');
const routeScene=read('app/world-route-scene.js');
const freeRoam=read('app/world-free-roam.js');
const simulator=read('app/world-simulator.js');

test('active trips no longer enter the generic buildJourney highway',()=>{
 assert.match(entry,/renderTripWorld/);
 assert.match(entry,/profile\?\.activeTrip/);
 assert.doesNotMatch(entry,/buildJourney/);
 assert.match(simulator,/buildJourney/); // unreachable for trips; retained until free-roam extraction is fully verified
 assert.match(freeRoam,/vehiclePresence/);
});

test('trip renderer follows graph samples with tangent heading and no artificial shake',()=>{
 assert.match(trip,/sampleRoutePolyline/);
 assert.match(trip,/sample\.angle/);
 assert.match(trip,/Math\.exp\(-10\*dt\)/);
 assert.match(trip,/Math\.exp\(-4\.6\*dt\)/);
 assert.doesNotMatch(trip,/Math\.sin\(elapsed\*\.6\)/);
 assert.doesNotMatch(trip,/angle\s*=\s*0;moving/);
 assert.doesNotMatch(trip,/camera\.x=player\.x;camera\.y=player\.y-55/);
});

test('route corridor comes from one shared Abuja graph and exposes actual node identity',()=>{
 assert.match(routeScene,/routeForJourney/);
 assert.match(routeScene,/routeNodeIds/);
 assert.match(routeScene,/routePoints/);
 assert.match(routeScene,/parkingAnchorFor/);
 assert.doesNotMatch(routeScene,/width\s*:\s*14000/);
});

test('driving scenes retain Abuja buildings, traffic, people and street objects around the route',()=>{
 const profile={id:'resident-route',district:'lugbe',location:{kind:'public',district:'lugbe'},home:{district:'garki-i'},activeTrip:{id:'trip-route',destination:'central-area',venueId:'cbn-experience',mode:'car',arrivesAt:Date.now()+60000}};
 const scene=buildRouteScene({profile,place:{id:'lugbe',name:'Lugbe'},trip:profile.activeTrip});
 assert.ok(scene.routePoints.length>=2);
 assert.ok(scene.routeNodeIds.length>=2);
 assert.ok(scene.buildings.length>=scene.routePoints.length,'every corridor node should retain visible city fabric');
 assert.ok(scene.traffic.length>=4,'trip should have ambient moving traffic');
 assert.ok(scene.pedestrians.length>=2,'trip should have ambient residents');
 assert.ok(scene.objects.length>=4,'trip should keep street furniture/planting');
 assert.ok(scene.art.includes('data-route-building='));
 assert.ok(scene.buildings.some(building=>/Central Bank|CBN/i.test(building.name)),'destination landmark should appear in the journey scene');
 assert.ok(scene.traffic.every(car=>['x','y'].includes(car.axis)&&Number.isFinite(car.lane)&&Number.isFinite(car.speed)));
});

test('different trips produce different populated street corridors rather than one repeated road',()=>{
 const base={id:'resident-route',location:{kind:'public'},home:{district:'garki-i'}};
 const airport=buildRouteScene({profile:{...base,district:'central-area'},trip:{id:'airport-trip',destination:'lugbe',venueId:'airport-hub',mode:'car'}});
 const jabi=buildRouteScene({profile:{...base,district:'central-area'},trip:{id:'jabi-trip',destination:'jabi',venueId:'jabi-lake',mode:'car'}});
 assert.notDeepEqual(airport.routeNodeIds,jabi.routeNodeIds);
 assert.notEqual(airport.art,jabi.art);
 assert.ok(airport.buildings.some(b=>/Airport/i.test(b.name)));
 assert.ok(jabi.buildings.some(b=>/Jabi Lake/i.test(b.name)));
});

test('trip progress stays server-clock authoritative and never persists visual frames',()=>{
 assert.match(trip,/startsAt=Number\(trip\.arrivesAt\)-duration/);
 assert.match(trip,/authoritativeProgress/);
 assert.match(trip,/onArrive\?\.\(trip\.id\)/);
 assert.doesNotMatch(trip,/localStorage|sessionStorage|fetch\(|api\./);
});

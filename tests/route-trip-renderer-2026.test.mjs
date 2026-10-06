import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const entry=read('app/world.js');
const trip=read('app/world-trip.js');
const routeScene=read('app/world-route-scene.js');
const legacy=read('app/world-free-roam.js');

test('active trips no longer enter the generic buildJourney highway',()=>{
 assert.match(entry,/renderTripWorld/);
 assert.match(entry,/profile\?\.activeTrip/);
 assert.doesNotMatch(entry,/buildJourney/);
 assert.match(legacy,/buildJourney/); // retained only inside isolated old free-roam source until safe deletion
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

test('trip progress stays server-clock authoritative and never persists visual frames',()=>{
 assert.match(trip,/startsAt=Number\(trip\.arrivesAt\)-duration/);
 assert.match(trip,/authoritativeProgress/);
 assert.match(trip,/onArrive\?\.\(trip\.id\)/);
 assert.doesNotMatch(trip,/localStorage|sessionStorage|fetch\(|api\./);
});

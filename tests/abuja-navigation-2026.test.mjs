import test from 'node:test';
import assert from 'node:assert/strict';
import {ABUJA_DISTRICT_ANCHORS,ABUJA_LANDMARK_NAV_POINTS,abujaNavigationNodes,abujaNavigationEdges,navigationKeyFor,shortestAbujaRoute,routeForJourney,routeSignature,sampleRoutePolyline,parkingAnchorFor} from '../src/shared/abuja-navigation.mjs';

test('one Abuja navigation graph includes the premium city districts and landmarks',()=>{
 assert.ok(Object.keys(ABUJA_DISTRICT_ANCHORS).length>=35);
 assert.ok(ABUJA_LANDMARK_NAV_POINTS.length>=20);
 assert.ok(abujaNavigationNodes().length>=55);
 assert.ok(abujaNavigationEdges().length>=80);
 for(const id of ['airport-hub','city-gate-plaza','wtc-abuja-hub','cbn-experience','national-assembly-hub','transcorp-hilton-hub','jabi-lake','banex'])assert.ok(navigationKeyFor({venueId:id}),`${id} not routable`);
});

test('very different Abuja journeys no longer collapse to one generic road',()=>{
 const homeToTranscorp=routeForJourney({fromDistrict:'gwarinpa-i',toDistrict:'maitama',toVenue:'transcorp-hilton-hub'});
 const homeToAirport=routeForJourney({fromDistrict:'gwarinpa-i',toDistrict:'lugbe',toVenue:'airport-hub'});
 const wuseToAssembly=routeForJourney({fromDistrict:'wuse-ii-a08',toDistrict:'central-area',toVenue:'national-assembly-hub'});
 const cityGateToAssembly=routeForJourney({fromDistrict:'kukwaba',fromVenue:'city-gate-plaza',toDistrict:'central-area',toVenue:'national-assembly-hub'});
 for(const route of [homeToTranscorp,homeToAirport,wuseToAssembly,cityGateToAssembly]){assert.ok(route?.points.length>=3);assert.ok(route.distance>0);}
 const signatures=new Set([homeToTranscorp,homeToAirport,wuseToAssembly,cityGateToAssembly].map(routeSignature));
 assert.equal(signatures.size,4);
 assert.notEqual(routeSignature(homeToTranscorp),routeSignature(homeToAirport));
});

test('routes have continuous finite positions and tangent headings',()=>{
 const route=shortestAbujaRoute('district:jabi','airport-hub');assert.ok(route);
 let previous=null;
 for(let step=0;step<=100;step++){
  const sample=sampleRoutePolyline(route.points,step/100);assert.ok(Number.isFinite(sample.x));assert.ok(Number.isFinite(sample.y));assert.ok(Number.isFinite(sample.angle));
  if(previous)assert.ok(Math.hypot(sample.x-previous.x,sample.y-previous.y)<route.distance*.25,'route sample teleported');
  previous=sample;
 }
});

test('home routing uses the selected home district and parking anchors are deterministic',()=>{
 const route=routeForJourney({fromDistrict:'central-area',fromVenue:'cbn-experience',toDistrict:'gwarinpa-i',returningHome:true,homeDistrict:'gwarinpa-i'});
 assert.ok(routeSignature(route).endsWith('district:gwarinpa-i'));
 assert.deepEqual(parkingAnchorFor({districtId:'maitama',venueId:'transcorp-hilton-hub'}),parkingAnchorFor({districtId:'maitama',venueId:'transcorp-hilton-hub'}));
});

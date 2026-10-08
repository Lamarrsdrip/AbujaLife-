import {CITY_LANDMARKS} from './city-landmarks.mjs';
// One reusable AbujaLife navigation model for city overview, travel and tests.
// Coordinates are intentionally stylised but preserve the relative relationships
// already authored by the premium Abuja v4 city. They are game coordinates, not GIS.

export const ABUJA_WORLD_CENTER=Object.freeze({lat:9.055,lon:7.47});
export const ABUJA_WORLD_SCALE=Object.freeze({lat:22000,lon:15000});

export const ABUJA_DISTRICT_ANCHORS=Object.freeze({
  'central-area':{lat:9.0555,lon:7.4900},'garki-i':{lat:9.0360,lon:7.4860},'garki-ii':{lat:9.0250,lon:7.4870},'asokoro':{lat:9.0470,lon:7.5350},'maitama':{lat:9.0830,lon:7.4930},'wuse-i':{lat:9.0630,lon:7.4700},'wuse-ii-a07':{lat:9.0770,lon:7.4700},'wuse-ii-a08':{lat:9.0750,lon:7.4590},'guzape':{lat:9.0260,lon:7.5190},'kukwaba':{lat:9.0390,lon:7.4510},'gudu':{lat:9.0200,lon:7.4630},'durumi':{lat:9.0310,lon:7.4530},'wuye':{lat:9.0490,lon:7.4420},'jabi':{lat:9.0690,lon:7.4230},'utako':{lat:9.0670,lon:7.4450},'mabushi':{lat:9.0860,lon:7.4550},'katampe':{lat:9.1020,lon:7.4690},'jahi':{lat:9.1000,lon:7.4400},'kado':{lat:9.0910,lon:7.4320},'gwarinpa-i':{lat:9.1090,lon:7.4080},'gwarinpa-ii':{lat:9.1270,lon:7.4020},'galadimawa':{lat:8.9950,lon:7.4340},'lokogoma':{lat:8.9910,lon:7.4820},'lugbe':{lat:8.9980,lon:7.3770},'chika':{lat:9.0120,lon:7.4050},'kuchigoro':{lat:9.0250,lon:7.4170},'pyakasa':{lat:8.9810,lon:7.4010},'kyami':{lat:9.0000,lon:7.3350},'karmo':{lat:9.1000,lon:7.3660},'dape':{lat:9.1070,lon:7.4210},'mpape':{lat:9.1370,lon:7.4940},'kubwa':{lat:9.1540,lon:7.3220},'dawaki':{lat:9.1390,lon:7.3850},'dei-dei':{lat:9.1300,lon:7.2720},'zuba':{lat:9.1000,lon:7.2170},'karu':{lat:9.0110,lon:7.5720},'nyanya':{lat:9.0280,lon:7.5740},'orozo':{lat:8.9860,lon:7.5580},'gwagwalada-town':{lat:8.9430,lon:7.0790}
});

// Destination identity, coordinates and district come from the existing registry.
// A newly playable landmark automatically gains a route and a local access road.
export const ABUJA_LANDMARK_NAV_POINTS=Object.freeze(CITY_LANDMARKS.map(({id,name,lat,lon,districtId})=>Object.freeze({id,name,lat,lon,districtId})));

// Landmark roads authored by the premium city overview.
export const ABUJA_LANDMARK_ROAD_LINKS=Object.freeze([
 ['airport-hub','city-gate-plaza'],['city-gate-plaza','national-stadium-hub'],['national-stadium-hub','magicland'],['magicland','wtc-abuja-hub'],['wtc-abuja-hub','international-conference-centre'],['international-conference-centre','cbn-experience'],['cbn-experience','national-mosque-hub'],['national-mosque-hub','national-assembly-hub'],['national-assembly-hub','aso-rock-view'],['cbn-experience','transcorp-hilton-hub'],['transcorp-hilton-hub','inec-hq'],['transcorp-hilton-hub','millennium-park-hub'],['wtc-abuja-hub','jabi-lake'],['jabi-lake','farm-city'],['farm-city','banex'],['city-gate-plaza','efcc-hq'],['efcc-hq','jabi-lake'],['cbn-experience','federal-high-court-hub']
]);

// District connectors represent the large Abuja road corridors between authored
// areas. They deliberately form a graph rather than connecting every pair directly.
export const ABUJA_DISTRICT_ROAD_LINKS=Object.freeze([
 ['lugbe','chika'],['chika','galadimawa'],['galadimawa','kukwaba'],['kukwaba','durumi'],['kukwaba','central-area'],
 ['durumi','gudu'],['durumi','wuye'],['gudu','garki-ii'],['garki-ii','garki-i'],['garki-i','central-area'],['garki-i','guzape'],['guzape','asokoro'],['asokoro','central-area'],
 ['central-area','wuse-i'],['central-area','maitama'],['wuse-i','wuse-ii-a07'],['wuse-i','utako'],['wuse-ii-a07','wuse-ii-a08'],['wuse-ii-a07','mabushi'],['wuse-ii-a08','utako'],
 ['utako','jabi'],['utako','mabushi'],['jabi','kado'],['jabi','wuye'],['mabushi','jahi'],['mabushi','katampe'],['jahi','kado'],['jahi','dape'],['kado','gwarinpa-i'],['dape','gwarinpa-i'],['gwarinpa-i','gwarinpa-ii'],
 ['katampe','mpape'],['gwarinpa-ii','dawaki'],['dawaki','kubwa'],['dawaki','karmo'],['karmo','zuba'],['kubwa','dei-dei'],['dei-dei','zuba'],
 ['galadimawa','lokogoma'],['lokogoma','pyakasa'],['pyakasa','orozo'],['orozo','karu'],['karu','nyanya'],['chika','kuchigoro'],['chika','pyakasa'],['lugbe','kyami'],['kyami','airport-hub']
]);

export function abujaToWorld({lat,lon}){
 return {x:(Number(lon)-ABUJA_WORLD_CENTER.lon)*ABUJA_WORLD_SCALE.lon,y:-(Number(lat)-ABUJA_WORLD_CENTER.lat)*ABUJA_WORLD_SCALE.lat};
}

const landmarkById=new Map(ABUJA_LANDMARK_NAV_POINTS.map(point=>[point.id,point]));
const districtKey=id=>`district:${id}`;
const asNode=(id,name,lat,lon,type,districtId)=>Object.freeze({id,name,lat,lon,type,districtId,...abujaToWorld({lat,lon})});

const NODES=new Map();
for(const [id,geo] of Object.entries(ABUJA_DISTRICT_ANCHORS))NODES.set(districtKey(id),asNode(districtKey(id),id,geo.lat,geo.lon,'district',id));
for(const point of ABUJA_LANDMARK_NAV_POINTS)NODES.set(point.id,asNode(point.id,point.name,point.lat,point.lon,'landmark',point.districtId));

const LINKS=[];
for(const [a,b] of ABUJA_DISTRICT_ROAD_LINKS)LINKS.push([districtKey(a),b.startsWith('airport-')?b:districtKey(b),'district-road']);
for(const [a,b] of ABUJA_LANDMARK_ROAD_LINKS)LINKS.push([a,b,'landmark-road']);
// Every landmark also has a local access road to its containing district.
for(const point of ABUJA_LANDMARK_NAV_POINTS)LINKS.push([point.id,districtKey(point.districtId),'access']);

const ADJ=new Map([...NODES.keys()].map(id=>[id,[]]));
const edgeDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
for(const [aId,bId,roadClass] of LINKS){const a=NODES.get(aId),b=NODES.get(bId);if(!a||!b)continue;const distance=edgeDistance(a,b);ADJ.get(aId).push({id:bId,distance,roadClass});ADJ.get(bId).push({id:aId,distance,roadClass});}

export function abujaNavigationNode(id){return NODES.get(id)||null;}
export function abujaNavigationNodes(){return [...NODES.values()];}
export function abujaNavigationEdges(){return LINKS.map(([a,b,roadClass])=>({a,b,roadClass})).filter(edge=>NODES.has(edge.a)&&NODES.has(edge.b));}

export function navigationKeyFor({districtId,venueId,homeDistrict}={}){
 if(venueId&&NODES.has(venueId))return venueId;
 const district=districtId||homeDistrict;
 return district&&NODES.has(districtKey(district))?districtKey(district):districtKey('central-area');
}

export function shortestAbujaRoute(fromKey,toKey){
 const start=NODES.has(fromKey)?fromKey:navigationKeyFor({districtId:fromKey?.replace?.(/^district:/,'')});
 const goal=NODES.has(toKey)?toKey:navigationKeyFor({districtId:toKey?.replace?.(/^district:/,'')});
 if(start===goal){const node=NODES.get(start);return {nodeIds:[start],points:[node],distance:0};}
 const distance=new Map([...NODES.keys()].map(id=>[id,Infinity])),previous=new Map(),open=new Set(NODES.keys());distance.set(start,0);
 while(open.size){let current=null,best=Infinity;for(const id of open){const score=distance.get(id);if(score<best){best=score;current=id;}}if(current===null||best===Infinity)break;open.delete(current);if(current===goal)break;
  for(const edge of ADJ.get(current)||[]){if(!open.has(edge.id))continue;const next=best+edge.distance;if(next<distance.get(edge.id)){distance.set(edge.id,next);previous.set(edge.id,current);}}
 }
 if(!Number.isFinite(distance.get(goal)))return null;
 const nodeIds=[];for(let current=goal;current;current=previous.get(current)){nodeIds.push(current);if(current===start)break;}nodeIds.reverse();
 return {nodeIds,points:nodeIds.map(id=>NODES.get(id)),distance:distance.get(goal)};
}

export function routeForJourney({fromDistrict,fromVenue,toDistrict,toVenue,returningHome=false,homeDistrict}={}){
 const from=navigationKeyFor({districtId:fromDistrict,venueId:fromVenue});
 const to=navigationKeyFor({districtId:returningHome?(homeDistrict||toDistrict):toDistrict,venueId:returningHome?null:toVenue,homeDistrict});
 return shortestAbujaRoute(from,to);
}

export function polylineMetrics(points=[]){
 const list=points.filter(point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y));if(!list.length)return {points:[],segments:[],length:0};
 const segments=[];let length=0;for(let i=1;i<list.length;i++){const a=list[i-1],b=list[i],size=Math.hypot(b.x-a.x,b.y-a.y);if(size>0){segments.push({a,b,start:length,length:size});length+=size;}}
 return {points:list,segments,length};
}

export function sampleRoutePolyline(points,progress){
 const metrics=polylineMetrics(points);if(!metrics.points.length)return null;if(!metrics.segments.length){const point=metrics.points[0];return {...point,angle:0,distance:0,total:0};}
 const wanted=Math.max(0,Math.min(1,Number(progress)||0))*metrics.length;let segment=metrics.segments.at(-1);for(const candidate of metrics.segments)if(wanted<=candidate.start+candidate.length){segment=candidate;break;}
 const local=Math.max(0,Math.min(1,(wanted-segment.start)/segment.length));const x=segment.a.x+(segment.b.x-segment.a.x)*local,y=segment.a.y+(segment.b.y-segment.a.y)*local;
 return {x,y,angle:Math.atan2(segment.b.y-segment.a.y,segment.b.x-segment.a.x)*180/Math.PI,distance:wanted,total:metrics.length};
}

export function routeSignature(route){return route?.nodeIds?.join('>')||'';}

// Useful for arrival/parking without writing visual frames to persistence.
export function parkingAnchorFor({districtId,venueId,index=0}={}){
 const node=NODES.get(venueId)||NODES.get(districtKey(districtId))||NODES.get(districtKey('central-area'));const angle=((String(venueId||districtId||'').length*47+Number(index)*71)%360)*Math.PI/180;
 return {x:node.x+Math.cos(angle)*34,y:node.y+Math.sin(angle)*34,angle:angle*180/Math.PI};
}

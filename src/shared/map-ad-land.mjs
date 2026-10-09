import {ABUJA_DISTRICT_ANCHORS,abujaToWorld,abujaNavigationNodes,abujaNavigationEdges} from './abuja-navigation.mjs';
import {ABUJA_ATLAS} from './atlas.mjs';
import {CITY_LANDMARKS} from './city-landmarks.mjs';

const hash=text=>{let n=2166136261;for(const c of String(text||'')){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
// Shared with the existing city renderer: protect even unbuilt district anchors
// as expansion land. A label/anchor is not evidence that its land is disposable.
export function cityFallbackPosition(place,index){const phase=place?.legacyAssertions?.phase,phaseCenters={I:{x:180,z:-80},II:{x:-500,z:170},III:{x:-1050,z:320},IV:{x:-1800,z:500},V:{x:-2450,z:850}};if(phase&&phaseCenters[phase]){const base=phaseCenters[phase],n=hash(place.id),a=(n%6283)/1000,r=220+n%520;return{x:base.x+Math.cos(a)*r,z:base.z+Math.sin(a)*r};}const councilCenters={amac:{x:250,z:350},bwari:{x:-1450,z:-1500},gwagwalada:{x:-3500,z:1500},kuje:{x:-1900,z:1800},kwali:{x:-4300,z:2300},abaji:{x:-5200,z:2700}};if(place?.council&&councilCenters[place.council]){const base=councilCenters[place.council],n=hash(place.id),a=(n%6283)/1000,r=180+n%420;return{x:base.x+Math.cos(a)*r,z:base.z+Math.sin(a)*r};}const n=hash(`${place?.id}:${index}`),a=(n%6283)/1000,r=1600+n%800;return{x:Math.cos(a)*r,z:Math.sin(a)*r};}
export const boxesOverlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const centered=(x,y,width,height)=>({x:x-width/2,y:y-height/2,width,height});
export const MAP_AD_PROTECTED_LAND=Object.freeze([
 ...ABUJA_ATLAS.map((p,i)=>{const geo=p.coordinates||ABUJA_DISTRICT_ANCHORS[p.id],point=geo?abujaToWorld(geo):cityFallbackPosition(p,i);return {...centered(point.x,point.y??point.z,600,480),reason:`District, housing, access and expansion: ${p.id}`};}),
 ...CITY_LANDMARKS.map(p=>{const point=abujaToWorld(p);return {...centered(point.x,point.y,p.builder==='airport'?660:360,p.builder==='airport'?440:300),reason:`Landmark and visitor access: ${p.id}`};}),
 {...centered(0,460,6600,170),reason:'Ambient traffic corridor'},
]);
const nodes=new Map(abujaNavigationNodes().map(n=>[n.id,n]));
export const MAP_AD_PROTECTED_ROADS=Object.freeze(abujaNavigationEdges().map(e=>({a:nodes.get(e.a),b:nodes.get(e.b),clearance:(e.roadClass==='landmark-road'?42:28)/2+32})).filter(e=>e.a&&e.b));
// Segment versus expanded rectangle (Liang–Barsky), including curbs/walkways.
export function roadIntersectsPlot(box,{a,b,clearance}){
 const minX=box.x-clearance,maxX=box.x+box.width+clearance,minY=box.y-clearance,maxY=box.y+box.height+clearance,dx=b.x-a.x,dy=b.y-a.y;
 let lo=0,hi=1;
 for(const [p,q] of [[-dx,a.x-minX],[dx,maxX-a.x],[-dy,a.y-minY],[dy,maxY-a.y]]){
  if(p===0){if(q<0)return false;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
 }
 return true;
}
export function mapLandConflict(box){const land=MAP_AD_PROTECTED_LAND.find(b=>boxesOverlap(box,b));if(land)return land.reason;return MAP_AD_PROTECTED_ROADS.some(r=>roadIntersectsPlot(box,r))?'Road, walkway or navigation access':null;}

// Keep the authored catalogue bounded. Direct map taps can still resolve safe
// dynamic advertising cells, so revenue does not depend on rendering hundreds of
// extra vacant meshes and DOM labels during Map startup.
const baseCandidates=[];
for(const y of[-3440,-3040,3040,3440])for(let x=-4480;x<=4480;x+=560)baseCandidates.push({...centered(x,y,520,340),format:'ground-billboard',orientation:0});
for(const x of[-5000,-4620,4620,5000])for(let y=-2440;y<=2440;y+=560)baseCandidates.push({...centered(x,y,340,520),format:'ground-billboard',orientation:0});
for(let y=-2300;y<=2300;y+=550)for(let x=-3500;x<=3500;x+=600)baseCandidates.push({...centered(x,y,320,220),format:'map-billboard',orientation:0});
const baseParcels=baseCandidates.filter(box=>!mapLandConflict(box)).reduce((accepted,box)=>{if(!accepted.some(other=>boxesOverlap(box,other)))accepted.push(box);return accepted;},[]);

const roadside=[];
for(const road of MAP_AD_PROTECTED_ROADS){const dx=road.b.x-road.a.x,dy=road.b.y-road.a.y,len=Math.hypot(dx,dy);if(len<500)continue;for(const t of[.25,.5,.75])for(const sign of[-1,1]){const x=road.a.x+dx*t-dy/len*150*sign,y=road.a.y+dy*t+dx/len*150*sign,box=centered(x,y,140,80);if(!mapLandConflict(box)&&!baseParcels.some(p=>boxesOverlap(box,p))&&!roadside.some(p=>boxesOverlap(box,{x:p.x-30,y:p.y-30,width:p.width+60,height:p.height+60})))roadside.push({...box,format:'roadside-billboard',orientation:0});}}
export const MAP_ROADSIDE_PARCELS=Object.freeze(roadside.slice(0,10).map(Object.freeze));

// Preserve original Business Park IDs and earlier checkout cells exactly.
const compatibilityCandidates=[];
for(const y of[-2690,2690,-2500,2500])for(let x=-4750;x<=4750;x+=400)compatibilityCandidates.push({...centered(x,y,320,220),format:'map-billboard',orientation:0});
for(const x of[-4000,4000,-4300,4300])for(let y=-2450;y<=2450;y+=320)compatibilityCandidates.push({...centered(x,y,220,320),format:'map-billboard',orientation:0});
for(let y=-2640;y<=2640;y+=320)for(let x=-4200;x<=4200;x+=400)compatibilityCandidates.push({...centered(x,y,320,220),format:'map-billboard',orientation:0});
const expanded=box=>({x:box.x-24,y:box.y-24,width:box.width+48,height:box.height+48});
const compatibility=[];
for(const box of compatibilityCandidates){
 if(box.x< -5200||box.y< -3800||box.x+box.width>5200||box.y+box.height>3800||mapLandConflict(box))continue;
 if([...baseParcels,...MAP_ROADSIDE_PARCELS,...compatibility].some(p=>boxesOverlap(box,expanded(p))))continue;
 compatibility.push(box);if(compatibility.length===43)break;
}
if(compatibility.length!==43)throw new Error(`AbujaLife advertising compatibility geometry incomplete: ${compatibility.length}/43`);
export const MAP_AD_COMPATIBILITY_PARCELS=Object.freeze(compatibility.map(box=>Object.freeze({...box,priority:8,active:true,inventoryVersion:3})));
export const MAP_AD_PARCELS=Object.freeze(baseParcels.map((box,index)=>Object.freeze({...box,name:`Ad plot ${String(index+1).padStart(3,'0')}`,priority:8,active:true,inventoryVersion:3})));

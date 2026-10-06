from pathlib import Path


def load(path): return Path(path).read_text(encoding='utf-8')
def save(path,text): Path(path).write_text(text,encoding='utf-8')
def replace_once(text,old,new,label,required=True):
    count=text.count(old)
    if count==0 and not required: return text
    if count!=1: raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old,new,1)

# Correct the generated airport animation object-method brace.
p='app/outside-city-v4.js';s=load(p)
s=replace_once(s,"row.mesh.position.z=airport.z+108+Math.sin((row.offset+t*row.speed)*.012)*13;}}},dispose()","row.mesh.position.z=airport.z+108+Math.sin((row.offset+t*row.speed)*.012)*13;}},dispose()",'airport animation brace')
save(p,s)

# Preserve canonical district availability (Banex stays Wuse II A08, etc.). The full
# Outside renderer can show the whole city without pretending every venue belongs to
# the resident's home district.
p='src/shared/life.mjs';s=load(p)
s=replace_once(s,"export const venuesForDistrict = district => VENUES.filter(place => place.outsideWorld || venueAvailable(place.id, district));","export const venuesForDistrict = district => VENUES.filter(place => venueAvailable(place.id, district));",'district venue contract')
# Existing City Gate activities already provide the required contextual photo activity.
needle="  { id:'city-gate-photo', venueId:'city-gate-plaza', name:'Take a City Gate photo', cost:0, duration:12, animation:'watch', effects:{fun:12,social:8,mood:6} },\n"
if needle in s:s=s.replace(needle,'',1)
save(p,s)

# The full-city Outside scene renders all canonical landmarks without rewriting district
# catalogue semantics. Add the SVG ellipse primitive used by landmark silhouettes.
p='app/world-city.js';s=load(p)
if "import { VENUES } from '../src/shared/life.mjs';" not in s:
    s=replace_once(s,"import { CITY_LANDMARKS } from '../src/shared/city-landmarks.mjs';\n","import { CITY_LANDMARKS } from '../src/shared/city-landmarks.mjs';\nimport { VENUES } from '../src/shared/life.mjs';\n",'world venue import')
if 'const ellipse = (cx,cy,rx,ry,fill' not in s:
    s=replace_once(s,"const landmarkWorldPoint=place=>({x:3900+(place.lon-7.2642)*15500,y:430+(9.09-place.lat)*18000});","const ellipse = (cx,cy,rx,ry,fill,extra='') => `<ellipse cx=\"${cx}\" cy=\"${cy}\" rx=\"${rx}\" ry=\"${ry}\" fill=\"${fill}\" ${extra}/>`;\nconst landmarkWorldPoint=place=>({x:3900+(place.lon-7.2642)*15500,y:430+(9.09-place.lat)*18000});",'ellipse helper')
s=replace_once(s,"const fullCityVenues=new Map(venues.filter(v=>v.outsideWorld).map(v=>[v.id,v]));","const landmarkIds=new Set(CITY_LANDMARKS.map(place=>place.id));\n const fullCityVenues=new Map(VENUES.filter(v=>landmarkIds.has(v.id)).map(v=>[v.id,v]));",'full city venue lookup')
s=replace_once(s,"interactables.push({id:landmark.id,x:exterior.entrance.x,y:exterior.entrance.y,label:venue.name||landmark.name,action:'enter-venue',payload:{venueId:landmark.id},radius:92,icon:'◎'});","interactables.push({id:landmark.id,x:exterior.entrance.x,y:exterior.entrance.y,label:venue.name||landmark.name,action:!venue.districts||venue.districts.includes(profile.district)?'enter-venue':'route-venue',payload:{venueId:landmark.id},radius:92,icon:'◎'});",'secure landmark interaction')
save(p,s)

# Reaching an out-of-district landmark opens the exact destination travel flow. It does
# not forge a server-side district change, so transport and location authority stay intact.
p='app/world-simulator.js';s=load(p)
old="const activate=point=>{if(!point||trip||furnitureMode||activity){point?.after?.(false);return;}pending=null;stop();remember();if(driving&&point.action!=='toggle-driving'){say('Park your car and get out to go inside.');return;}const task=point.action==='venue-action'?VENUE_ACTIONS.find(a=>a.id===point.payload?.activityId):null;if(task){animateActivity(task.animation,task.duration,()=>dispatch(point.action,point.payload,point.after),task.name);}else dispatch(point.action,point.payload,point.after);};"
new="const activate=point=>{if(!point||trip||furnitureMode||activity){point?.after?.(false);return;}pending=null;stop();remember();if(driving&&point.action!=='toggle-driving'){say('Park your car and get out to go inside.');return;}if(point.action==='route-venue'){window.dispatchEvent(new CustomEvent('abj:open-map-venue',{detail:{venueId:point.payload?.venueId}}));point.after?.(true);return;}const task=point.action==='venue-action'?VENUE_ACTIONS.find(a=>a.id===point.payload?.activityId):null;if(task){animateActivity(task.animation,task.duration,()=>dispatch(point.action,point.payload,point.after),task.name);}else dispatch(point.action,point.payload,point.after);};"
s=replace_once(s,old,new,'route venue interaction')
save(p,s)

# Keep the later diagnostics contract while restoring the earlier material appearance.
p='app/world-materials.js';s=load(p)
s=s.replace(",premium:true,style:'classic'",",premium:true")
save(p,s)

# Regression coverage follows the architecture: district catalogues stay geographic,
# while the full-city renderer uses the canonical landmark registry directly.
save('tests/city-world-integrity.test.mjs',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_LANDMARKS } from '../src/shared/city-landmarks.mjs';
import { VENUES, VENUE_ACTIONS } from '../src/shared/life.mjs';
import fs from 'node:fs';

const byId=new Map(VENUES.map(v=>[v.id,v]));
const legacyInteriors=new Set(['banex','jabi-lake']);
test('every Abuja map landmark resolves to a playable venue and a destination-specific interior path',()=>{
  assert.equal(CITY_LANDMARKS.length,21);
  const interiors=fs.readFileSync(new URL('../app/world-interiors.js',import.meta.url),'utf8');
  for(const landmark of CITY_LANDMARKS){
    const venue=byId.get(landmark.id);assert.ok(venue,`${landmark.id} missing from VENUES`);
    assert.ok(!venue.districts||venue.districts.includes(landmark.districtId),`${landmark.id} district mismatch`);
    if(!legacyInteriors.has(landmark.id))assert.equal(venue.landmarkInterior,landmark.interior,`${landmark.id} interior mismatch`);
    else assert.match(interiors,new RegExp(landmark.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('all civic City Story destinations are exact playable landmark venues',()=>{
  for(const id of ['inec-hq','efcc-hq','federal-high-court-hub'])assert.ok(byId.has(id),`${id} is not playable`);
  const civic=fs.readFileSync(new URL('../app/civic-life.js',import.meta.url),'utf8');
  for(const id of ['inec-hq','efcc-hq','federal-high-court-hub'])assert.match(civic,new RegExp(id));
  assert.match(fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8'),/abj:open-map-venue/);
});

test('full-city Outside renders the canonical landmarks without weakening district catalogues',()=>{
  const world=fs.readFileSync(new URL('../app/world-city.js',import.meta.url),'utf8');
  assert.match(world,/CITY_LANDMARKS/);assert.match(world,/fullCityVenues/);assert.match(world,/width=8500/);assert.match(world,/airport-plane/);assert.match(world,/route-venue/);
  const simulator=fs.readFileSync(new URL('../app/world-simulator.js',import.meta.url),'utf8');
  assert.match(simulator,/point\.action==='route-venue'/);assert.match(simulator,/abj:open-map-venue/);
  const map=fs.readFileSync(new URL('../app/outside-city-v4.js',import.meta.url),'utf8');
  assert.match(map,/CITY_LANDMARKS/);assert.match(map,/Advertising plot/);assert.match(map,/minZoom:\.22,maxZoom:24/);
});

test('landmarks have contextual activity instead of empty generic rooms',()=>{
  const actionIds=new Set(VENUE_ACTIONS.map(a=>a.venueId));
  for(const landmark of CITY_LANDMARKS)assert.ok(actionIds.has(landmark.id)||landmark.id==='banex',`${landmark.id} has no contextual activity`);
});
''')

print('city world integrity hotfix applied')

from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text): (ROOT/path).write_text(text,encoding='utf-8')
def once(text,old,new,label):
    if old not in text: raise SystemExit(f'missing finalize anchor: {label}')
    if text.count(old)!=1: raise SystemExit(f'non-unique finalize anchor {label}: {text.count(old)}')
    return text.replace(old,new,1)

# Keep server geography authoritative: landmarks are visible from the full city,
# but a venue can only be entered directly in its real game district.
p='src/shared/life.mjs'; s=read(p)
s=s.replace("{ id:'city-gate-photo', venueId:'city-gate-plaza', name:'Take a City Gate photo', cost:0, duration:12,","{ id:'city-gate-landmark-photo', venueId:'city-gate-plaza', name:'Take a City Gate photo', cost:0, duration:14,",1)
s=s.replace("export const venuesForDistrict = district => VENUES.filter(place => place.outsideWorld || venueAvailable(place.id, district));","export const venuesForDistrict = district => VENUES.filter(place => venueAvailable(place.id, district));")
s=s.replace("districts:districts||landmark?.districtId?[landmark?.districtId].filter(Boolean):undefined","districts:districts || (landmark?.districtId ? [landmark.districtId] : undefined)")
write(p,s)

# Keep existing renderer diagnostics stable while restoring the calmer classic response.
p='app/world-materials.js'; s=read(p)
s=s.replace(",premium:true,style:'classic'",",premium:true")
write(p,s)

# Complete the full-city Outside geometry without breaking district authority.
p='app/world-city.js'; s=read(p)
if "const ellipse = " not in s:
    s=once(s,"const rect = (x,y,w,h,fill,r=0,extra='') => `<rect x=\"${x}\" y=\"${y}\" width=\"${w}\" height=\"${h}\" rx=\"${r}\" fill=\"${fill}\" ${extra}/>`;",
        "const rect = (x,y,w,h,fill,r=0,extra='') => `<rect x=\"${x}\" y=\"${y}\" width=\"${w}\" height=\"${h}\" rx=\"${r}\" fill=\"${fill}\" ${extra}/>`;\nconst ellipse = (x,y,rx,ry,fill,extra='') => `<ellipse cx=\"${x}\" cy=\"${y}\" rx=\"${rx}\" ry=\"${ry}\" fill=\"${fill}\" ${extra}/>`;",'ellipse helper')
pattern=r" const landmarkIds=new Set\(CITY_LANDMARKS\.map\(place=>place\.id\)\);\n const fullCityVenues=new Map\(VENUES\.filter\(v=>landmarkIds\.has\(v\.id\)\)\.map\(v=>\[v\.id,v\]\)\);\n const alreadyHere=new Set\(\['banex','jabi-lake'\]\);\n for\(const landmark of CITY_LANDMARKS\)\{.*?\n \}\n"
replacement=""" const localVenueIds=new Set(venues.map(v=>v.id));
 for(const landmark of CITY_LANDMARKS){
  const legacyLocal=['banex','jabi-lake'].includes(landmark.id)&&localVenueIds.has(landmark.id);
  if(legacyLocal)continue;
  const point=landmarkWorldPoint(landmark),exterior=landmarkExterior(landmark,point.x,point.y),local=localVenueIds.has(landmark.id),venue=venues.find(v=>v.id===landmark.id)||landmark;
  art+=exterior.art;obstacles.push(exterior.obstacle);interactables.push({id:landmark.id,x:exterior.entrance.x,y:exterior.entrance.y,label:venue.name||landmark.name,action:local?'enter-venue':'travel-venue',payload:local?{venueId:landmark.id}:{destinationVenueId:landmark.id,districtId:landmark.districtId},radius:92,icon:'◎'});
 }
"""
s,count=re.subn(pattern,replacement,s,count=1,flags=re.S)
if count!=1: raise SystemExit(f'full city venue loop matched {count}')
# The post-finalization renderer no longer needs the temporary full-city VENUES lookup.
s=s.replace("import { VENUES } from '../src/shared/life.mjs';\n",'',1)
write(p,s)

# A remote landmark in the visible city opens the authoritative journey sheet;
# only a landmark in the resident's current district enters directly.
p='app/world-simulator.js'; s=read(p)
old="if(driving&&point.action!=='toggle-driving'){say('Park your car and get out to go inside.');return;}if(point.action==='route-venue'){window.dispatchEvent(new CustomEvent('abj:open-map-venue',{detail:{venueId:point.payload?.venueId}}));point.after?.(true);return;}const task=point.action==='venue-action'?VENUE_ACTIONS.find(a=>a.id===point.payload?.activityId):null;"
new="if(driving&&point.action!=='toggle-driving'){say('Park your car and get out to go inside.');return;}if(point.action==='travel-venue'){onDestination({venueId:point.payload?.destinationVenueId,districtId:point.payload?.districtId});point.after?.(true);return;}const task=point.action==='venue-action'?VENUE_ACTIONS.find(a=>a.id===point.payload?.activityId):null;"
s=once(s,old,new,'remote landmark destination')
write(p,s)

# The regression suite follows the product rule: all landmarks are visible in the
# playable city, while direct server venue entry remains district-scoped.
p='tests/city-world-integrity.test.mjs'; s=read(p)
s=s.replace("import { VENUES, VENUE_ACTIONS } from '../src/shared/life.mjs';","import { VENUES, VENUE_ACTIONS, venuesForDistrict } from '../src/shared/life.mjs';",1)
old=re.search(r"test\('full-city Outside renders the canonical landmarks without weakening district catalogues'.*?\n\}\);",s,re.S)
if not old: raise SystemExit('full-city regression test block not found')
new="""test('full-city free roam exposes landmarks and map keeps outer ad space',()=>{
  for(const landmark of CITY_LANDMARKS){
    const ids=new Set(venuesForDistrict(landmark.districtId).map(v=>v.id));
    assert.ok(ids.has(landmark.id),`${landmark.id} missing from its authoritative district`);
  }
  const world=fs.readFileSync(new URL('../app/world-city.js',import.meta.url),'utf8');
  assert.match(world,/CITY_LANDMARKS/);assert.match(world,/airport-plane/);assert.match(world,/width=8500/);assert.match(world,/travel-venue/);
  const map=fs.readFileSync(new URL('../app/outside-city-v4.js',import.meta.url),'utf8');
  assert.match(map,/CITY_LANDMARKS/);assert.match(map,/Advertising plot/);assert.match(map,/minZoom:\\.22,maxZoom:24/);
});"""
s=s[:old.start()]+new+s[old.end():]
write(p,s)

print('city world integrity finalization applied')

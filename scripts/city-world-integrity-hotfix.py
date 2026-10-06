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

# Preserve canonical district availability (Banex stays Wuse II A08, etc.) while the
# playable Outside renderer can still draw the complete city from the canonical registry.
p='src/shared/life.mjs';s=load(p)
s=replace_once(s,"export const venuesForDistrict = district => VENUES.filter(place => place.outsideWorld || venueAvailable(place.id, district));","export const venuesForDistrict = district => VENUES.filter(place => venueAvailable(place.id, district));",'district venue contract')
s=s.replace(", pricesVerified: false, outsideWorld:true, landmarkInterior:'banex' },",", pricesVerified: false },")
s=s.replace(", districts: ['jabi'], outsideWorld:true, landmarkInterior:'jabi-lake' },",", districts: ['jabi'] },")
# Existing City Gate activities already provide the required contextual photo activity.
# Remove the duplicate injected ID and its too-short duration.
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
save(p,s)

# Keep the later diagnostics contract while restoring the earlier material appearance.
p='app/world-materials.js';s=load(p)
s=s.replace(",premium:true,style:'classic'",",premium:true")
save(p,s)

print('city world integrity hotfix applied')

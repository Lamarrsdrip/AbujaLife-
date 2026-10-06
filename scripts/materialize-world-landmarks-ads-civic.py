from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

def regex_once(text, pattern, replacement, label):
    out, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 regex match, got {count}')
    return out

# 1) Actually load the City Story / INEC phone experience.
p = 'app/index.html'
s = read(p)
if 'src="/civic-life.js"' not in s:
    s = once(
        s,
        '  <script type="module" src="/phone-chat-pro.js"></script>\n',
        '  <script type="module" src="/phone-chat-pro.js"></script>\n  <script type="module" src="/civic-life.js"></script>\n',
        'civic module script'
    )
write(p, s)

# 2) Keep City Story visible on the first phone page instead of appending it off-screen.
p = 'app/civic-life.js'
s = read(p)
s = once(
    s,
    "  grid.append(button);",
    "  const firstPageAnchor=grid.children[3]||null;\n  if(firstPageAnchor)grid.insertBefore(button,firstPageAnchor);else grid.append(button);",
    'civic first-page launcher'
)
write(p, s)

# 3) Let the playable World zoom out far enough to frame the whole 8.5k-wide city.
p = 'app/world-camera.js'
s = read(p)
s = once(
    s,
    "export const WORLD_ZOOM = Object.freeze({min: .28, max: 8, step: 1.24, default: 1});",
    "export const WORLD_ZOOM = Object.freeze({min: .06, max: 10, step: 1.3, default: 1});",
    'world zoom range'
)
write(p, s)

# 4) Make the World zoom-fit button truly show Whole Abuja, not reset to a close player view.
p = 'app/world-simulator.js'
s = read(p)
old = " const resetZoom=()=>{orbit.reset({immediate:false});camera={x:interior?scene.width/2:player.x,y:interior?scene.height/2:player.y-55};updateViewport();remember();return 1;};"
new = """ const resetZoom=()=>{
  if(!interior&&!trip){
   const box=container.getBoundingClientRect(),aspect=Math.max(.45,box.width/Math.max(1,box.height));
   const atOne=worldViewport({pixelWidth:box.width,pixelHeight:box.height,sceneWidth:scene.width,sceneHeight:scene.height,interior:false,transit:false,zoom:1,oblique,...orientation()});
   const fit=clampWorldZoom(atOne.baseWidth/Math.max(scene.width*1.32,scene.height*aspect*1.45));
   orbit.stopMomentum();orbit.setZoom(fit,{immediate:false});zoom=orientation().zoom;camera={x:scene.width/2,y:scene.height/2};updateViewport();remember();return fit;
  }
  orbit.reset({immediate:false});camera={x:interior?scene.width/2:player.x,y:interior?scene.height/2:player.y-55};updateViewport();remember();return 1;
 };"""
s = once(s, old, new, 'whole Abuja zoom fit')
write(p, s)

# 5) Fill the landmark half of the playable World with coherent Abuja context blocks.
#    Canonical landmarks remain the only interactive named destinations; these blocks
#    make the city read as a city rather than a handful of isolated buildings.
p = 'app/world-city.js'
s = read(p)
anchor = """ art+=rect(3540,0,width-3540,height,'#b4c59a')+rect(3600,92,width-3690,2420,'#c8cdb1',60)+rect(3590,2380,width-3650,236,'#718378')+`<path d=\"M3590 2498H${width}\" stroke=\"#e8e0b7\" stroke-width=\"4\" stroke-dasharray=\"52 48\"/>`;
 const localVenueIds=new Set(venues.map(v=>v.id));
"""
insert = """ art+=rect(3540,0,width-3540,height,'#b4c59a')+rect(3600,92,width-3690,2420,'#c8cdb1',60)+rect(3590,2380,width-3650,236,'#718378')+`<path d=\"M3590 2498H${width}\" stroke=\"#e8e0b7\" stroke-width=\"4\" stroke-dasharray=\"52 48\"/>`;
 // Abuja's landmark half needs enough surrounding city fabric to feel inhabited when the camera zooms out.
 // These are intentionally non-interactive context blocks; named destinations below stay canonical.
 for(const avenueX of [3740,4440,5140,5840,6540,7240,7940]){
  art+=rect(avenueX,0,96,height,'#74867a')+`<path d=\"M${avenueX+48} 0V${height}\" stroke=\"#e8e0b7\" stroke-width=\"3\" stroke-dasharray=\"46 44\"/>`;
 }
 const landmarkPoints=CITY_LANDMARKS.map(landmarkWorldPoint),contextPalette=['#ddd6c3','#d2d0bf','#c9c8b6','#e4dcc6','#c7cfbf','#d7ccb6'];
 for(let row=0;row<5;row++)for(let col=0;col<7;col++){
  const cx=3780+col*645+(row%2)*96,groundY=520+row*690;
  if(cx>width-220||groundY>height-150)continue;
  if(landmarkPoints.some(point=>Math.hypot(point.x-cx,point.y-groundY)<380))continue;
  const bw=220+(col%3)*36,bh=145+((row+col)%3)*48,left=cx-bw/2,top=groundY-bh,wall=contextPalette[(row*7+col)%contextPalette.length];
  const windows=Array.from({length:Math.max(2,Math.floor((bw-36)/54))},(_,i)=>rect(left+20+i*54,top+34,31,42,'#6f8d8a',3)+rect(left+20+i*54,top+88,31,31,'#799590',3)).join('');
  art+=`<g class=\"city-context-block\" aria-hidden=\"true\">${rect(left,top,bw,bh,wall,7)}${rect(left-9,top,bw+18,11,'#ede6d2',4)}${windows}<path d=\"M${left+bw} ${top+8}L${left+bw+20} ${top+22}V${groundY+4}L${left+bw} ${groundY}Z\" fill=\"#aeb8a8\"/><rect x=\"${left+bw*.43}\" y=\"${groundY-62}\" width=\"${bw*.18}\" height=\"62\" rx=\"3\" fill=\"#58766d\"/></g>`;
  obstacles.push({x:left-7,y:top-8,w:bw+30,h:bh+20});
  if((row+col)%2===0)art+=cityTree(left-26,groundY-10,.62,(row+col)%5===0);
 }
 const localVenueIds=new Set(venues.map(v=>v.id));
"""
s = once(s, anchor, insert, 'landmark city context')
write(p, s)

# 6) Make the playable airport visibly active as an airport.
p = 'app/world.css'
s = read(p)
if '@keyframes abuja-airport-ground-move' not in s:
    s += r'''

/* Airport movement is lightweight SVG ambience anchored to the actual airport landmark. */
@keyframes abuja-airport-ground-move{0%{transform:translateX(0)}50%{transform:translateX(155px)}100%{transform:translateX(0)}}
.world-scene .airport-plane-a{transform-box:fill-box;transform-origin:center;animation:abuja-airport-ground-move 9s linear infinite}
@media (prefers-reduced-motion:reduce){.world-scene .airport-plane-a{animation:none}}
'''
write(p, s)

# 7) Turn the entire clean outer ring of the premium map into obvious purchasable ad land.
p = 'app/outside-city-v4.js'
s = read(p)
new_layout = r'''function createAdPlots(){
 const plots=[];let n=1;const add=(x,z,w,d)=>{const id=`plot-${String(n).padStart(3,'0')}`;plots.push({id,key:`ad:${id}`,adPlotId:id,name:`Ad plot ${String(n).padStart(3,'0')}`,x,z,w,d,height:8,priority:8,category:'Advertising land',destination:{adPlotId:id}});n++;};
 // Two complete parcel rows above and below Abuja, plus two parcel columns on each side.
 for(const z of[-3440,-3040,3040,3440])for(let x=-4480;x<=4480;x+=560)add(x,z,520,340);
 for(const x of[-5000,-4620,4620,5000])for(let z=-2440;z<=2440;z+=560)add(x,z,340,520);
 return plots;
}
function createLayout(atlas=[],venues=[]){
 const venueMap=new Map(venues.map(v=>[v.id,v])),landmarks=LANDMARKS.map(source=>{const p=toWorld(source),venue=venueMap.get(source.id);return{...source,...p,venueId:venue?.id||null,key:`landmark:${source.id}`,destination:{districtId:source.districtId,...(venue?{venueId:venue.id}:{})}};}),landmarkById=new Map(landmarks.map(v=>[v.id,v])),districts=atlas.map((place,index)=>{const anchor=place.coordinates||DISTRICT_ANCHORS[place.id],p=anchor?toWorld(anchor):fallbackPosition(place,index);return{...place,...p,key:`district:${place.id}`,priority:20,destination:{districtId:place.id}};}),adPlots=createAdPlots();
 return{width:10400,depth:7600,landmarks,landmarkById,districts,adPlots,all:[...landmarks,...districts,...adPlots]};
}

function contactTexture'''
s = regex_once(s, r"function createLayout\(atlas=\[\],venues=\[\]\)\{.*?\}\n\nfunction contactTexture", new_layout, 'outer ad plot layout')

new_base = r'''function basePlot(plot,occupied){const w=plot.w||318,d=plot.d||238,innerW=Math.max(120,w-38),innerD=Math.max(100,d-38);const base=box(world,occupied?'#aed3d5':'#c5e6e8',plot.x,2.5,plot.z,w,4,d,0,{roughness:.86,shadow:false},plot.key);box(world,'#eef8f4',plot.x,5,plot.z,innerW,2,innerD,0,{roughness:.9,shadow:false},plot.key);const edge='#89b9bd';box(world,edge,plot.x,7,plot.z-d/2+8,w-12,4,8,0,{shadow:false},plot.key);box(world,edge,plot.x,7,plot.z+d/2-8,w-12,4,8,0,{shadow:false},plot.key);box(world,edge,plot.x-w/2+8,7,plot.z,8,4,d-12,0,{shadow:false},plot.key);box(world,edge,plot.x+w/2-8,7,plot.z,8,4,d-12,0,{shadow:false},plot.key);if(occupied)box(world,'#668c90',plot.x,20,plot.z-d*.32,Math.max(120,w*.72),29,12,0,{roughness:.55},plot.key);base.userData.destinationKey=plot.key;}'''
s = regex_once(s, r"function basePlot\(plot,occupied\)\{.*?base\.userData\.destinationKey=plot\.key;\}", new_base, 'ad plot geometry')
s = once(s, "if(pinchBase?.distance)target.zoom=clamp(pinchBase.zoom*d/pinchBase.distance,.5,13);", "if(pinchBase?.distance)target.zoom=clamp(pinchBase.zoom*d/pinchBase.distance,.22,24);", 'map pinch zoom parity')
old_click = "const hit=ray.intersectObjects(model.world.children,true).find(h=>h.object.userData.destinationKey);if(hit){const p=all.find(v=>v.key===hit.object.userData.destinationKey);if(p)choose(p);}});"
new_click = """const hits=ray.intersectObjects(model.world.children,true),hit=hits.find(h=>h.object.userData.destinationKey);if(hit){const p=all.find(v=>v.key===hit.object.userData.destinationKey);if(p)choose(p);return;}const ground=hits.find(h=>Math.abs(h.point.y)<40);if(ground){const x=ground.point.x,z=ground.point.z,outer=Math.abs(x)>3550||Math.abs(z)>2580;if(outer){let nearest=null,best=Infinity;for(const plot of layout.adPlots){const d=Math.hypot(plot.x-x,plot.z-z);if(d<best){best=d;nearest=plot;}}if(nearest&&best<720)choose(nearest);}}});"""
s = once(s, old_click, new_click, 'outer ring blank-space ad selection')
write(p, s)

# 8) Regression coverage for the exact gaps caught on localhost.
test = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('City Story and INEC experience is actually loaded into the phone',()=>{
 const index=read('app/index.html'),civic=read('app/civic-life.js');
 assert.match(index,/src="\/civic-life\.js"/);
 assert.match(civic,/City Story/);
 assert.match(civic,/inec-hq/);
 assert.match(civic,/insertBefore\(button,firstPageAnchor\)/);
});

test('playable World can frame the full Abuja landmark city',()=>{
 const camera=read('app/world-camera.js'),sim=read('app/world-simulator.js'),city=read('app/world-city.js');
 assert.match(camera,/min: \.06, max: 10/);
 assert.match(sim,/scene\.width\/2,y:scene\.height\/2/);
 assert.match(sim,/atOne\.baseWidth\/Math\.max\(scene\.width\*1\.32/);
 assert.match(city,/CITY_LANDMARKS\.map\(landmarkWorldPoint\)/);
 assert.match(city,/city-context-block/);
 assert.match(city,/airport-plane-a/);
});

test('outer map surrounding space is dense clickable advertising land',()=>{
 const map=read('app/outside-city-v4.js');
 assert.match(map,/function createAdPlots\(\)/);
 assert.match(map,/width:10400,depth:7600/);
 assert.match(map,/best<720/);
 assert.match(map,/pinchBase\.zoom\*d\/pinchBase\.distance,\.22,24/);
 assert.match(map,/plot\.w\|\|318/);
});
'''
write('tests/world-landmarks-ads-civic.test.mjs', test)

print('world landmarks + ad land + civic phone source implementation applied')

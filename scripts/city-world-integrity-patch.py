from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text()
def write(path,text): (ROOT/path).write_text(text)
def once(text,old,new,label):
    if old not in text: raise SystemExit(f'missing patch anchor: {label}')
    if text.count(old)!=1: raise SystemExit(f'non-unique patch anchor {label}: {text.count(old)}')
    return text.replace(old,new,1)

def regex_once(text,pattern,repl,label):
    out,count=re.subn(pattern,repl,text,count=1,flags=re.S)
    if count!=1: raise SystemExit(f'pattern {label} matched {count}')
    return out

# 1. Make the map use the same landmark registry as gameplay and keep the current layout.
p='app/outside-city-v4.js'; s=read(p)
s=once(s,"import * as THREE from './vendor/three.module.js';\n","import * as THREE from './vendor/three.module.js';\nimport { CITY_LANDMARKS } from '../src/shared/city-landmarks.mjs';\n",'map registry import')
s=regex_once(s,r"const LANDMARKS=\[.*?\]\.map\(\(\[id,name,short,lat,lon,districtId,builder,priority,blurb\]\)=>\(\{id,name,short,lat,lon,districtId,builder,priority,blurb\}\)\);","const LANDMARKS=CITY_LANDMARKS;",'map landmarks block')
s=s.replace("function mat(color,opts={}){return new THREE.MeshStandardMaterial({color,roughness:.68,metalness:0,...opts});}","function mat(color,opts={}){return new THREE.MeshStandardMaterial({color,roughness:.82,metalness:0,...opts});}")
s=s.replace("{minZoom:.5,maxZoom:13,width:layout.width,depth:layout.depth}","{minZoom:.22,maxZoom:24,width:layout.width,depth:layout.depth}")
s=s.replace("clamp(target.zoom*f,.5,13)","clamp(target.zoom*f,.22,24)")
s=s.replace("clamp(pinchBase.zoom*(distance/pinchBase.distance),.5,13)","clamp(pinchBase.zoom*(distance/pinchBase.distance),.22,24)")
s=s.replace("renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;","renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;")
# Moving aircraft are anchored only to the airport premises; they make the destination legible at a glance.
anchor=" const ambient=new THREE.HemisphereLight('#fff1d7','#4f6655',1.45);"
if 'const aircraft=[];' not in s:
    aircraft=""" const aircraft=[];const airport=layout.landmarkById.get('airport-hub');if(airport){for(let i=0;i<3;i++){const plane=new THREE.Group(),body=new THREE.Mesh(new THREE.CapsuleGeometry(5,52,4,10),mat('#ecebe2',{roughness:.74}));body.rotation.z=Math.PI/2;plane.add(body);const wing=new THREE.Mesh(new THREE.BoxGeometry(78,2.5,15),mat('#d4d7cf',{roughness:.8}));plane.add(wing);const tail=new THREE.Mesh(new THREE.BoxGeometry(18,18,3),mat('#58776c',{roughness:.82}));tail.position.x=-25;tail.rotation.z=.55;plane.add(tail);plane.position.set(airport.x-150+i*115,18,airport.z+108+i*18);plane.scale.setScalar(.7);world.add(plane);aircraft.push({mesh:plane,offset:i*310,speed:19+i*4});}}\n"""
    s=once(s,anchor,aircraft+anchor,'map aircraft insertion')
old="row.mesh.position.z=430+(i%3)*19;}}"
new="row.mesh.position.z=430+(i%3)*19;}for(const row of aircraft){const airport=layout.landmarkById.get('airport-hub');if(!airport)continue;row.mesh.position.x=airport.x-230+((row.offset+t*row.speed)%460);row.mesh.position.z=airport.z+108+Math.sin((row.offset+t*row.speed)*.012)*13;}}}"
if old in s: s=s.replace(old,new,1)
write(p,s)

# 2. Restore the earlier, calmer AbujaLife material response while retaining the later correct linear PBR data-map separation.
write('app/world-materials.js',r'''// AbujaLife classic procedural surfaces. The colour/roughness response deliberately
// matches the original readable world style while retaining separate linear data maps.
export function createWorldMaterialLibrary(T, {size = 128} = {}) {
  const textures = new Map(), dataTextures = new Map(), materials = new Map();
  const clamp = value => Math.max(0, Math.min(255, Math.round(value)));
  function texture(type, repeatX = 1, repeatY = 1) {
    const key = `${type}:${repeatX.toFixed(3)}:${repeatY.toFixed(3)}`;
    if (textures.has(key)) return textures.get(key);
    const baseKey = `${type}:1.000:1.000`;
    if (key !== baseKey) {
      const map = texture(type).clone(); map.repeat.set(repeatX, repeatY); map.needsUpdate = true;
      textures.set(key, map); return map;
    }
    const data = new Uint8Array(size * size * 4);
    let seed = 9137;
    const noise = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = x / size, ny = y / size, n = noise(); let shade = 248;
      if (type === 'wood') shade = 243 + Math.sin(ny * 76 + Math.sin(nx * 12) * .9) * 7 + (n - .5) * 5;
      else if (type === 'planks') { const board = Math.floor(nx * 8), seam = x % (size / 8), end = (y + (board % 2) * size / 2) % size; shade = 242 + Math.sin(nx * 190 + Math.sin(ny * 15 + board) * 1.7) * 5 + Math.sin(board * 4.7) * 5 + (n - .5) * 4; if (seam < 1 || end < 1) shade = 196; }
      else if (type === 'plaster') shade = 246 + (n - .5) * 7 + Math.sin(nx * 19 + ny * 23) * 1.5;
      else if (type === 'fabric') shade = 241 + (x % 4 < 2 ? 7 : -3) + (y % 4 < 2 ? 4 : -5) + (n - .5) * 4;
      else if (type === 'stone') shade = 246 - Math.max(0, Math.sin(nx * 17 + ny * 29 + Math.sin(ny * 13) * 2) - .9) * 58 + (n - .5) * 5;
      else if (type === 'tile' || type === 'bath') { const cell = type === 'bath' ? size / 4 : size / 2; shade = x % cell < 1 || y % cell < 1 ? 203 : 246 + (n - .5) * 4; }
      else if (type === 'road') shade = 234 + (n - .5) * 29;
      else if (type === 'grass') shade = 235 + (n - .5) * 28 + Math.sin(nx * 70 + ny * 31) * 5;
      else if (type === 'rug') shade = 229 + (x % 3 ? 8 : -5) + (y % 3 ? 5 : -7) + (n - .5) * 5;
      const i=(y*size+x)*4,c=clamp(shade); data[i]=data[i+1]=data[i+2]=c; data[i+3]=255;
    }
    const map=new T.DataTexture(data,size,size,T.RGBAFormat);map.name=`AbujaLife authored ${type}`;map.colorSpace=T.SRGBColorSpace;
    map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
    map.userData={surface:type,authored:true,usage:'color'};textures.set(key,map);return map;
  }
  function dataTexture(type, repeatX = 1, repeatY = 1) {
    const key=`${type}:${repeatX.toFixed(3)}:${repeatY.toFixed(3)}`;if(dataTextures.has(key))return dataTextures.get(key);
    const map=texture(type,repeatX,repeatY).clone();map.name=`AbujaLife authored ${type} data`;map.colorSpace=T.NoColorSpace ?? '';map.userData={surface:type,authored:true,usage:'data'};map.needsUpdate=true;dataTextures.set(key,map);return map;
  }
  const defaults={wood:{roughness:.57,bumpScale:.12},planks:{roughness:.63,bumpScale:.09},plaster:{roughness:.89,bumpScale:.035},fabric:{roughness:.94,bumpScale:.07},stone:{roughness:.36,bumpScale:.04},tile:{roughness:.47,bumpScale:.07},bath:{roughness:.48,bumpScale:.06},road:{roughness:.98,bumpScale:.23},grass:{roughness:1,bumpScale:.20},rug:{roughness:1,bumpScale:.20},ceramic:{roughness:.23,metalness:.05},metal:{roughness:.28,metalness:.72},glass:{roughness:.13,metalness:.08,transparent:true,opacity:.35,depthWrite:false}};
  function material(type,color='#ffffff',extra={}){const key=JSON.stringify([type,color,extra]);if(materials.has(key))return materials.get(key);const {repeatX=1,repeatY=1,...options}=extra;const textured=['wood','planks','plaster','fabric','stone','tile','bath','road','grass','rug'].includes(type);const map=textured?texture(type,repeatX,repeatY):null,bumpMap=textured?dataTexture(type,repeatX,repeatY):null;const result=new T.MeshStandardMaterial({color,metalness:0,...defaults[type],...(map?{map,bumpMap}:{}),...options});result.name=`AbujaLife ${type}`;result.userData={surface:type,classic:true};materials.set(key,result);return result;}
  return {texture,dataTexture,material,stats:()=>({textures:textures.size+dataTextures.size,materials:materials.size,size,premium:true,style:'classic'}),dispose(){for(const map of textures.values())map.dispose();for(const map of dataTextures.values())map.dispose();for(const mat of materials.values())mat.dispose();textures.clear();dataTextures.clear();materials.clear();}};
}
''')

# 3. Wider practical camera range, same default first appearance.
p='app/world-camera.js'; s=read(p)
s=once(s,"export const WORLD_ZOOM = Object.freeze({min: .8, max: 2.5, step: 1.2, default: 1});","export const WORLD_ZOOM = Object.freeze({min: .28, max: 8, step: 1.24, default: 1});",'world zoom range')
write(p,s)

# 4. Complete the shared venue registry and contextual activities for every map landmark.
p='src/shared/life.mjs'; s=read(p)
if "city-landmarks.mjs" not in s:
    s="import { CITY_LANDMARKS, cityLandmark } from './city-landmarks.mjs';\n"+s
activity_marker="\n];\n\nconst venue = (id, name, category, description) => ({"
activities=r'''
  { id:'airport-checkin', venueId:'airport-hub', name:'Check the departures hall', cost:0, duration:14, animation:'walk', effects:{fun:6,social:5,mood:4} },
  { id:'airport-observe', venueId:'airport-hub', name:'Watch aircraft from the terminal', cost:0, duration:16, animation:'watch', effects:{fun:15,stress:-8,mood:6} },
  { id:'city-gate-photo', venueId:'city-gate-plaza', name:'Take a City Gate photo', cost:0, duration:12, animation:'watch', effects:{fun:12,social:8,mood:6} },
  { id:'stadium-event', venueId:'national-stadium-hub', name:'Join the match-day crowd', cost:0, duration:16, animation:'social', effects:{fun:18,social:18,mood:6} },
  { id:'wtc-network', venueId:'wtc-abuja-hub', name:'Meet in the business lobby', cost:0, duration:15, animation:'social', effects:{social:20,mood:5} },
  { id:'wtc-view', venueId:'wtc-abuja-hub', name:'Take in the CBD skyline', cost:0, duration:14, animation:'watch', effects:{fun:12,stress:-8} },
  { id:'cbn-gallery', venueId:'cbn-experience', name:'Explore the finance gallery', cost:0, duration:16, animation:'watch', effects:{fun:10,mood:5} },
  { id:'cbn-careers', venueId:'cbn-experience', name:'Visit the careers desk', cost:0, duration:14, animation:'social', effects:{social:8,mood:5} },
  { id:'assembly-gallery', venueId:'national-assembly-hub', name:'Visit the civic gallery', cost:0, duration:16, animation:'watch', effects:{fun:10,social:8,mood:5} },
  { id:'assembly-townhall', venueId:'national-assembly-hub', name:'Attend a fictional city town hall', cost:0, duration:18, animation:'social', effects:{social:18,fun:10} },
  { id:'eagle-photo', venueId:'eagle-square-hub', name:'Walk the public square', cost:0, duration:15, animation:'walk', effects:{stress:-10,fun:10} },
  { id:'national-mosque-visit', venueId:'national-mosque-hub', name:'Spend quiet time in the prayer hall', cost:0, duration:16, animation:'pray', effects:{stress:-20,mood:10} },
  { id:'national-christian-visit', venueId:'national-christian-centre-hub', name:'Spend quiet time in the sanctuary', cost:0, duration:16, animation:'pray', effects:{stress:-20,mood:10} },
  { id:'transcorp-meet', venueId:'transcorp-hilton-hub', name:'Meet in the main lobby', cost:0, duration:15, animation:'social', effects:{social:18,mood:5} },
  { id:'millennium-relax', venueId:'millennium-park-hub', name:'Relax on the lawn', cost:0, duration:16, animation:'rest', effects:{stress:-20,fun:12} },
  { id:'aso-viewpoint', venueId:'aso-rock-view', name:'Take in the Aso Rock view', cost:0, duration:16, animation:'watch', effects:{stress:-18,fun:12,mood:8} },
  { id:'farmcity-social', venueId:'farm-city', name:'Join the Farm City hangout', cost:1200, duration:16, animation:'social', effects:{social:22,fun:16,stress:-8} },
  { id:'jabi-lake-view', venueId:'jabi-lake', name:'Watch the water from the promenade', cost:0, duration:15, animation:'watch', effects:{stress:-18,fun:10} },
  { id:'jabi-mall-shop', venueId:'jabi-lake-mall', name:'Browse the mall', cost:0, duration:16, animation:'shop', effects:{fun:14,social:8} },
  { id:'jabi-mall-food', venueId:'jabi-lake-mall', name:'Meet at the food court', cost:2400, duration:16, animation:'eat', effects:{hunger:30,social:15,fun:12} },
  { id:'icc-conference', venueId:'international-conference-centre', name:'Attend a city conference', cost:0, duration:18, animation:'watch', effects:{social:12,fun:10,mood:5} },
  { id:'banex-browse', venueId:'banex', name:'Browse the tech counters', cost:0, duration:15, animation:'shop', effects:{fun:10,social:8} },
  { id:'inec-registration', venueId:'inec-hq', name:'Visit the candidate registration desk', cost:0, duration:14, animation:'social', effects:{social:8,mood:4} },
  { id:'inec-info', venueId:'inec-hq', name:'Read the AbujaLife election information', cost:0, duration:14, animation:'watch', effects:{fun:8,mood:4} },
  { id:'efcc-briefing', venueId:'efcc-hq', name:'Visit the fictional integrity briefing', cost:0, duration:15, animation:'watch', effects:{fun:8,mood:4} },
  { id:'court-gallery', venueId:'federal-high-court-hub', name:'Visit the fictional hearing gallery', cost:0, duration:16, animation:'watch', effects:{fun:8,mood:4} },
'''
if "airport-checkin" not in s:
    s=once(s,activity_marker,"\n"+activities+"];\n\nconst venue = (id, name, category, description) => ({",'landmark activities')
old="""const realVenue = (id,name,type,category,description,districts) => ({
  ...venue(id,name,category,description),type,districts,fictional:false,
  settingSource:'real-world-reference-authored-game-approximation',
  affiliation:'Unofficial AbujaLife game interpretation; no affiliation or endorsement is implied.',
});"""
new="""const realVenue = (id,name,type,category,description,districts) => {
  const landmark=cityLandmark(id);
  return {...venue(id,name,category,description),type,districts:districts||landmark?.districtId?[landmark?.districtId].filter(Boolean):undefined,fictional:false,outsideWorld:true,landmarkInterior:landmark?.interior||id,
    settingSource:'real-world-reference-authored-game-approximation',
    affiliation:'Unofficial AbujaLife game interpretation; no affiliation or endorsement is implied.'};
};"""
s=once(s,old,new,'real venue helper')
# Existing named landmarks that were authored before the shared registry also belong in full-city free roam.
s=s.replace("{ ...venue('banex', 'Banex Tech Market'","{ ...venue('banex', 'Banex Tech Market',") if False else s
s=s.replace("pricesVerified: false },\n  venue('cafe'","pricesVerified: false, outsideWorld:true, landmarkInterior:'banex' },\n  venue('cafe'",1)
s=s.replace("{ ...venue('jabi-lake', 'Jabi Lake', 'Outdoors', 'An authored lakeside game setting for walks, picnics and time by the water.'), districts: ['jabi'] },","{ ...venue('jabi-lake', 'Jabi Lake', 'Outdoors', 'An authored lakeside game setting for walks, picnics and time by the water.'), districts: ['jabi'], outsideWorld:true, landmarkInterior:'jabi-lake' },")
insert_after="  realVenue('national-stadium-hub','Moshood Abiola National Stadium','gym','Sport & events','A multiplayer sport destination for training, meetups and event-day activity.',['kukwaba']),\n"
newvenues="""  realVenue('airport-hub','Nnamdi Azikiwe International Airport','airport','Airport & travel','A recognisable game interpretation of Abuja airport with a terminal, gates, apron and moving aircraft.',['lugbe']),
  realVenue('wtc-abuja-hub','World Trade Centre Abuja','wtc','Business & skyline','A game interpretation of the twin-tower CBD landmark with lobby and business spaces.',['central-area']),
  realVenue('national-assembly-hub','National Assembly Complex','assembly','Civic & public life','A fictional civic gameplay interior inspired by the public-facing National Assembly landmark.',['central-area']),
  realVenue('jabi-lake-mall','Jabi Lake Mall','mall','Shopping & social','A game interpretation of the shopping and food-court destination beside Jabi Lake.',['jabi']),
  realVenue('international-conference-centre','International Conference Centre','conference','Events & conferences','A conference and town-hall destination with an auditorium and meeting foyer.',['central-area']),
  realVenue('inec-hq','INEC Headquarters','inec','Civic & elections','The AbujaLife election registration destination used by the fictional City Story system.',['maitama']),
  realVenue('efcc-hq','EFCC Headquarters','efcc','Civic storyline','A fictional integrity-story destination used only by AbujaLife civic gameplay.',['jabi']),
  realVenue('federal-high-court-hub','Federal High Court Abuja','court','Civic storyline','A fictional hearing destination used only by AbujaLife civic gameplay.',['central-area']),
"""
if "realVenue('airport-hub'" not in s: s=once(s,insert_after,insert_after+newvenues,'missing landmark venues')
s=once(s,"export const venuesForDistrict = district => VENUES.filter(place => venueAvailable(place.id, district));","export const venuesForDistrict = district => VENUES.filter(place => place.outsideWorld || venueAvailable(place.id, district));",'full-city venue exposure')
write(p,s)

# 5. Add every landmark into the walkable Outside world, preserving the existing neighbourhood and map arrangement.
p='app/world-city.js'; s=read(p)
if "city-landmarks.mjs" not in s:
    s="import { CITY_LANDMARKS } from '../src/shared/city-landmarks.mjs';\n"+s
landmark_code=r'''
const landmarkWorldPoint=place=>({x:3900+(place.lon-7.2642)*15500,y:430+(9.09-place.lat)*18000});
function landmarkExterior(place,x,y){
  const id=esc(place.id),label=esc(place.short||place.name),b=place.builder,w=place.id==='airport-hub'?430:place.id==='national-stadium-hub'?330:place.id==='jabi-lake-mall'?320:270,h=['wtc','transcorp'].includes(b)?330:['assembly','mosque','church','inec','efcc','court'].includes(b)?240:190,left=x-w/2,top=y-h;
  let body='';
  if(b==='airport') body=rect(left,top+58,w,112,'#e5e2d1',8)+rect(left+20,top+80,w-40,58,'#73928d',4)+rect(left+w-84,top-8,24,117,'#d7d8ca',8)+ellipse(left+w-72,top-8,20,9,'#59786f')+`<g transform="translate(${left-120} ${y+28})"><g class="airport-plane airport-plane-a"><path d="M0 0L122-10L154 0L122 10Z" fill="#eee9d8"/><path d="M65-4L91-50L112-46L98-1L112 46L91 50L65 4Z" fill="#d6d9ca"/></g></g>`+rect(left-160,y+49,w+350,24,'#606f68',3);
  else if(b==='cityGate') body=`<path d="M${left+42} ${y}Q${left+55} ${top+18} ${x-15} ${top+6}V${y}H${x-55}Z" fill="#e5dfc9"/><path d="M${x+15} ${y}V${top+6}Q${left+w-55} ${top+18} ${left+w-42} ${y}H${x+55}Z" fill="#e5dfc9"/>`+rect(x-62,top+82,124,24,'#557765',4);
  else if(b==='stadium') body=ellipse(x,top+106,w/2,92,'#d5d7c5')+ellipse(x,top+106,w*.39,66,'#66856e')+ellipse(x,top+106,w*.29,45,'#87a77e');
  else if(b==='magicland') body=rect(left,top+80,w*.48,110,'#d7b17f',5)+`<circle cx="${x+70}" cy="${top+91}" r="72" fill="none" stroke="#b77568" stroke-width="9"/><path d="M${x+70} ${top+19}V${top+163}M${x-2} ${top+91}H${x+142}M${x+20} ${top+41}L${x+120} ${top+141}M${x+120} ${top+41}L${x+20} ${top+141}" stroke="#6f7e73" stroke-width="4"/>`;
  else if(b==='wtc') body=rect(x-92,top,76,h,'#547682',4)+rect(x+16,top+58,76,h-58,'#637f87',4)+Array.from({length:5},(_,i)=>rect(x-81,top+34+i*48,54,20,'#a9c1ba',2)).join('');
  else if(b==='assembly') body=rect(left,top+92,w,148,'#e3dcc8',6)+ellipse(x,top+91,92,52,'#b6ad87')+rect(x-35,top+35,70,58,'#c7b36f',8);
  else if(b==='mosque') body=rect(left,top+89,w,151,'#e8e1cd',5)+ellipse(x,top+88,86,56,'#8ca384')+rect(left+24,top+5,24,218,'#e8e1cd',6)+ellipse(left+36,top+4,22,12,'#79956f');
  else if(b==='church') body=rect(left,top+80,w,160,'#e8dec7',5)+`<path d="M${left+35} ${top+80}L${x} ${top+8}L${left+w-35} ${top+80}Z" fill="#9b8f75"/><path d="M${x} ${top-25}V${top+24}M${x-17} ${top-8}H${x+17}" stroke="#f0dfb8" stroke-width="8"/>`;
  else if(b==='aso') body=`<path d="M${left} ${y}Q${left+55} ${top+55} ${x-35} ${top+18}Q${x+18} ${top-26} ${left+w} ${y}Z" fill="#8f9b78"/><path d="M${left+33} ${y-19}Q${x} ${top+49} ${left+w-27} ${y-15}" stroke="#c4c5a2" stroke-width="6" fill="none"/>`;
  else if(b==='jabiLake') body=ellipse(x,top+105,w/2,92,'#75a9a6')+ellipse(x,top+105,w*.38,67,'none','stroke="#c5ded2" stroke-width="5"');
  else if(b==='mall') body=rect(left,top+44,w,h-44,'#ddd7c3',7)+rect(left+21,top+72,w-42,101,'#75948e',4)+rect(x-38,top+5,76,50,'#b88462',8);
  else if(b==='conference') body=rect(left,top+68,w,h-68,'#ded9c6',7)+`<path d="M${left+22} ${top+68}Q${x} ${top-25} ${left+w-22} ${top+68}Z" fill="#82988a"/>`;
  else if(b==='inec') body=rect(left,top+48,w,h-48,'#e6e1cd',7)+rect(left+18,top+75,w-36,57,'#668575',4)+rect(x-56,top+5,112,49,'#6f936e',5)+`<text x="${x}" y="${top+38}" fill="#f1ead5" text-anchor="middle" font-size="21" font-weight="700">INEC</text>`;
  else if(b==='efcc') body=rect(left,top+35,w,h-35,'#d8ded2',6)+rect(left+28,top+62,w-56,h-89,'#5f7d73',4)+rect(x-60,top-7,120,48,'#8d9b77',4);
  else if(b==='court') body=rect(left,top+78,w,h-78,'#e6dfca',4)+Array.from({length:6},(_,i)=>rect(left+28+i*39,top+73,17,145,'#c8bea3',2)).join('')+`<path d="M${left+12} ${top+78}L${x} ${top+13}L${left+w-12} ${top+78}Z" fill="#9d947b"/>`;
  else if(b==='transcorp') body=rect(left+35,top,w-70,h,'#d9d8c9',6)+rect(left+62,top+35,w-124,h-67,'#6e8d88',3)+rect(left,top+142,w,76,'#e4dbc4',5);
  else if(b==='millennium') body=rect(left,top+60,w,h-60,'#a9bb91',20)+cityTree(x-70,y-25,.65)+cityTree(x+72,y-25,.65)+`<path d="M${left+32} ${y-28}Q${x} ${top+52} ${left+w-31} ${y-28}" stroke="#e2d5ae" stroke-width="28" fill="none"/>`;
  else if(b==='farmCity') body=rect(left,top+50,w,h-50,'#d7b889',7)+rect(left+18,top+76,w-36,84,'#718b76',4)+rect(x-68,top+6,136,51,'#906f50',5);
  else if(b==='banex') body=rect(left,top+43,w,h-43,'#d2cbb5',4)+Array.from({length:4},(_,i)=>rect(left+19+i*58,top+78,47,86,i%2?'#6c8985':'#9d8665',3)).join('');
  else body=rect(left,top+46,w,h-46,'#ded8c4',6)+rect(left+24,top+72,w-48,h-98,'#71908a',3)+rect(x-58,top+5,116,49,'#748776',5);
  return {art:`<g class="city-landmark city-landmark-${id}" data-world-target="${id}">${body}<rect x="${left-8}" y="${y+8}" width="${w+16}" height="42" rx="9" fill="#f1ead2"/><text x="${x}" y="${y+35}" text-anchor="middle" fill="#466655" font-size="${label.length>20?13:16}" font-weight="700">${label}</text></g>`,obstacle:{x:left-7,y:top-8,w:w+14,h:h+18},entrance:{x,y:y+84}};
}
'''
if 'function landmarkExterior' not in s:
    s=once(s,'export function buildCity({profile={},place={},id=\'city\',venues=[]}={}) {',landmark_code+"\nexport function buildCity({profile={},place={},id='city',venues=[]}={}) {",'landmark exterior helper')
s=once(s,' const width=3540,height=4190,interactables=[],obstacles=[];',' const width=8500,height=4190,interactables=[],obstacles=[];','full outside dimensions')
insert="""
 // The full-city landmark quarter mirrors the map registry. The legacy neighbourhood remains intact on the left;
 // these recognisable Abuja destinations extend the same walkable world instead of teleporting residents to a fake block.
 art+=rect(3540,0,width-3540,height,'#b4c59a')+rect(3600,92,width-3690,2420,'#c8cdb1',60)+rect(3590,2380,width-3650,236,'#718378')+`<path d=\"M3590 2498H${width}\" stroke=\"#e8e0b7\" stroke-width=\"4\" stroke-dasharray=\"52 48\"/>`;
 const fullCityVenues=new Map(venues.filter(v=>v.outsideWorld).map(v=>[v.id,v]));
 const alreadyHere=new Set(['banex','jabi-lake']);
 for(const landmark of CITY_LANDMARKS){
  if(alreadyHere.has(landmark.id)||!fullCityVenues.has(landmark.id))continue;
  const point=landmarkWorldPoint(landmark),exterior=landmarkExterior(landmark,point.x,point.y),venue=fullCityVenues.get(landmark.id);
  art+=exterior.art;obstacles.push(exterior.obstacle);interactables.push({id:landmark.id,x:exterior.entrance.x,y:exterior.entrance.y,label:venue.name||landmark.name,action:'enter-venue',payload:{venueId:landmark.id},radius:92,icon:'◎'});
 }
"""
ret=" return {width,height,art,obstacles,interactables,buildings:specs.filter(spec=>spec.id==='home'||venues.some(venue=>venue.id===spec.id)),spawn:{x:445,y:679},title:place.name||'Abuja',subtitle:'Neighbourhood · free roam',"
if 'fullCityVenues' not in s: s=once(s,ret,insert+"\n"+ret,'full-city landmarks')
write(p,s)

# Plane motion in the SVG world; keeps the airport readable even before entering it.
p='app/world.css'; s=read(p)
if '@keyframes abujalife-airport-taxi' not in s:
    s += r'''

/* Airport activity belongs to the airport premises, not the generic city traffic. */
.world-art .airport-plane{transform-box:fill-box;transform-origin:center;animation:abujalife-airport-taxi 16s linear infinite;will-change:transform}
.world-art .airport-plane-a{animation-delay:-4s}
@keyframes abujalife-airport-taxi{0%{transform:translateX(0)}48%{transform:translateX(520px)}52%{transform:translateX(520px) rotate(180deg)}100%{transform:translateX(0) rotate(180deg)}}
@media (prefers-reduced-motion:reduce){.world-art .airport-plane{animation:none}}
'''
write(p,s)

# 6. Distinct destination interiors. No civic/landmark ID is allowed to fall through to a random restaurant/shop.
p='app/world-interiors.js'; s=read(p)
landmark_interior=r'''
function buildLandmarkVenue(profile,raw,id){
  const s=sceneBase(1580,1180,id,{floor:['millennium-park-hub','eagle-square-hub','city-gate-plaza','aso-rock-view'].includes(raw.id)?'pave':'tile',name:raw.name});
  s.subtitle=raw.description||'A recognisable Abuja destination.';const anchors=[];let fallbacks=[];
  const sign=(title,subtitle='ABUJA · YOUR CITY')=>wallSign(s,430,110,title,subtitle);
  const desks=(count=4,y=360)=>{for(let i=0;i<count;i++)s.object(160+i*300,y,220,76,deskArt(220),{kind:'service-desk'});};
  const seats=(rows=3,cols=6,startY=480)=>{for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)s.object(160+c*205,startY+r*150,82,72,chairArt(r%2?'#a89474':'#849a88'),{kind:'visitor-seat'});};
  switch(raw.id){
    case'airport-hub': sign('ABUJA AIRPORT','DEPARTURES · ARRIVALS');s.window(125,230);s.window(1115,230);desks(4,320);seats(3,5,520);s.art.push(rect(1170,176,310,220,'#6f908e',8)+path('M1195 340L1450 205','none','stroke="#dce9df" stroke-width="6"')+text(1325,372,'APRON · AIRCRAFT MOVING',13,'#e8ebd6','text-anchor="middle"'));s.pedestrians.push({x:390,y:445,toX:1020,toY:445,role:'Traveller'},{x:1260,y:525,toX:1260,toY:525,stationary:true,role:'Airport staff'});anchors.push({x:470,y:449},{x:1260,y:525});fallbacks=[['airport-checkin','Check the departures hall'],['airport-observe','Watch the aircraft']];break;
    case'city-gate-plaza': sign('ABUJA CITY GATE','THE CITY STARTS HERE');s.art.push(rect(145,190,1290,770,'#a8bb91',34),path('M420 850Q470 230 710 240V850H610V420Q525 420 510 850Z','#e7e0ca'),path('M870 850V240Q1110 230 1160 850H1070Q1050 420 970 420V850Z','#e7e0ca'));for(const [x,y] of [[225,930],[1330,930],[245,310],[1315,310]])s.object(x,y,30,30,group(15,15,gardenTreeArt(1.2)),{solid:false});anchors.push({x:790,y:905});fallbacks=[['city-gate-photo','Take a City Gate photo']];break;
    case'national-stadium-hub': sign('NATIONAL STADIUM','SPORT · MATCH DAY');s.art.push(rect(155,205,1270,745,'#d8d6c2',90),rect(250,295,1080,565,'#71966d',80),rect(390,390,800,375,'#92b77c',28),line(790,390,790,765,'#e7e6cc',5));seats(2,6,870);anchors.push({x:790,y:815},{x:790,y:1010});fallbacks=[['stadium-train','Train at the stadium'],['stadium-event','Join match-day activity']];break;
    case'magicland': sign('MAGICLAND','RIDES · ARCADE · FRIENDS');s.art.push(ellipse(470,485,190,190,'none','stroke="#b97465" stroke-width="18"'),line(470,294,470,677,'#718176',8),line(280,485,660,485,'#718176',8));s.object(850,290,500,210,rect(0,0,500,210,'#526d69',15)+text(250,102,'ARCADE',32,'#f0ddb5','text-anchor="middle" letter-spacing="8"'),{kind:'arcade'});for(const [x,y] of [[860,610],[1120,610],[860,820],[1120,820]])s.object(x,y,160,100,tableArt(130,82));anchors.push({x:470,y:715},{x:1100,y:520});fallbacks=[['magicland-arcade','Play in the arcade'],['magicland-meet','Meet up inside the park']];break;
    case'wtc-abuja-hub': sign('WORLD TRADE CENTRE','BUSINESS · ABUJA SKYLINE');s.window(100,220);s.window(1080,220);s.rug(170,310,1240,420,'#b9bba3');desks(3,420);s.object(180,785,440,86,sofaArt(440,86,'#82998b'));s.object(960,785,440,86,sofaArt(440,86,'#82998b'));s.art.push(rect(650,180,290,126,'#6e9291',5)+text(795,250,'CBD SKYLINE',22,'#e8ead7','text-anchor="middle"'));anchors.push({x:790,y:620},{x:790,y:930});fallbacks=[['wtc-network','Meet in the business lobby'],['wtc-view','Take in the CBD skyline']];break;
    case'cbn-experience': sign('CENTRAL BANK OF NIGERIA','FINANCE · HISTORY · CAREERS');desks(4,760);for(let i=0;i<4;i++)s.art.push(rect(175+i*330,220,250,260,'#e1d9be',8)+rect(195+i*330,245,210,170,['#76928a','#a28e68','#839775','#6e8587'][i],5)+text(300+i*330,445,['MONEY','STABILITY','HISTORY','CAREERS'][i],15,'#52675d','text-anchor="middle"'));anchors.push({x:790,y:640},{x:1040,y:910});fallbacks=[['cbn-gallery','Explore the finance gallery'],['cbn-careers','Visit the careers desk']];break;
    case'national-assembly-hub': sign('NATIONAL ASSEMBLY','FICTIONAL CITY CIVIC PLAY');s.art.push(ellipse(790,245,165,92,'#b7ac83'),rect(250,330,1080,530,'#d9d3bd',20));for(let r=0;r<4;r++)for(let c=0;c<8;c++)s.object(305+c*122,415+r*104,82,66,chairArt('#8d987e'),{kind:'chamber-seat'});s.object(650,860,280,82,counterArt(280,82,'#8c7659'),{kind:'speaker-desk'});anchors.push({x:790,y:965},{x:790,y:705});fallbacks=[['assembly-gallery','Visit the civic gallery'],['assembly-townhall','Attend a fictional town hall']];break;
    case'eagle-square-hub': sign('EAGLE SQUARE','PUBLIC EVENTS · CITY MOMENTS');s.art.push(rect(125,190,1330,840,'#d8d0b4',34),rect(255,305,1070,590,'#b4c39d',28),path('M790 320L842 436L970 449L874 535L900 663L790 596L680 663L706 535L610 449L738 436Z','#d6b676'));for(const [x,y] of [[230,250],[1350,250],[230,960],[1350,960]])s.object(x,y,25,25,group(12,12,gardenTreeArt(1.1)),{solid:false});anchors.push({x:790,y:860});fallbacks=[['eagle-square-meet','Meet at Eagle Square'],['eagle-square-event','Attend a public city event']];break;
    case'national-mosque-hub': sign('ABUJA NATIONAL MOSQUE','PRAYER · REFLECTION · COMMUNITY');s.rug(170,245,1240,600,'#819985');for(let r=0;r<4;r++)for(let c=0;c<8;c++)s.art.push(rect(205+c*145,285+r*125,110,95,'#b9c7ad',4));s.art.push(path('M610 245Q790 50 970 245Z','#8ba081'));anchors.push({x:790,y:900},{x:1180,y:930});fallbacks=[['national-mosque-prayer','Prayer & reflection'],['national-mosque-community','Spend time with the community']];break;
    case'national-christian-centre-hub': sign('NATIONAL CHRISTIAN CENTRE','PRAYER · REFLECTION · COMMUNITY');s.art.push(path('M550 245L790 70L1030 245Z','#9c9077'),line(790,82,790,215,'#eadbb7',10),line(744,132,836,132,'#eadbb7',10));for(let r=0;r<5;r++)for(const x of [240,910])s.object(x,390+r*115,430,42,gardenBenchArt(430),{kind:'pew'});anchors.push({x:790,y:930},{x:1190,y:975});fallbacks=[['national-christian-reflect','Prayer & reflection'],['national-christian-community','Spend time with the community']];break;
    case'transcorp-hilton-hub': sign('TRANSCORP HILTON','LOBBY · DINING · POOL');s.rug(145,245,1290,400,'#c3b99e');s.object(180,315,470,95,sofaArt(470,95,'#9c8464'));s.object(930,315,470,95,sofaArt(470,95,'#87998a'));s.object(590,700,400,98,counterArt(400,98));s.art.push(rect(1040,710,350,255,'#79a8a5',26)+rect(1060,730,310,215,'#9bc4b5',20));anchors.push({x:790,y:615},{x:1190,y:980},{x:790,y:930});fallbacks=[['transcorp-meet','Meet in the main lobby'],['transcorp-pool','Spend time by the pool'],['transcorp-dining','Dinner at the hotel']];break;
    case'millennium-park-hub': sign('MILLENNIUM PARK','WALK · PICNIC · FRIENDS');s.art.push(rect(100,175,1380,900,'#a8bc91',45),path('M180 935Q500 520 790 610T1400 270','none','stroke="#e4d7b1" stroke-width="74"'));for(const [x,y] of [[220,310],[470,820],[970,330],[1320,780],[740,280]])s.object(x,y,25,25,group(12,12,gardenTreeArt(1.25)),{solid:false});s.object(980,770,220,130,tableArt(180,100),{kind:'picnic-table'});anchors.push({x:790,y:900},{x:1080,y:930});fallbacks=[['millennium-walk','Walk through Millennium Park'],['millennium-picnic','Picnic in the park']];break;
    case'aso-rock-view': sign('ASO ROCK VIEWPOINT','ABUJA\'S GRANITE BACKDROP');s.art.push(path('M120 870Q220 420 520 360Q730 75 965 310Q1260 350 1450 870Z','#929b78'),path('M235 870Q410 510 590 480Q790 220 1005 455Q1230 500 1345 870Z','#b7b798'),rect(190,875,1190,90,'#d8c9a5',20));for(const x of [300,1280])s.object(x,900,190,60,gardenBenchArt(190),{kind:'view-bench'});anchors.push({x:790,y:995});fallbacks=[['aso-viewpoint','Take in the Aso Rock view']];break;
    case'farm-city': sign('FARM CITY ABUJA','FOOD · ARCADE · HANGOUT');s.object(150,285,560,100,counterArt(560,100,'#8c7456'),{kind:'food-counter'});for(const [x,y] of [[190,520],[480,520],[190,760],[480,760]])s.object(x,y,190,130,tableArt(150,100));s.object(900,285,480,220,rect(0,0,480,220,'#4f6865',14)+text(240,105,'GAME ARCADE',28,'#f0d9aa','text-anchor="middle" letter-spacing="5"'),{kind:'arcade'});anchors.push({x:470,y:965},{x:1110,y:620});fallbacks=[['farmcity-meal','Eat at Farm City'],['farmcity-arcade','Play at the game arcade']];break;
    case'jabi-lake-mall': sign('JABI LAKE MALL','SHOP · FOOD · MEET');for(let i=0;i<5;i++)s.object(120+i*285,270,235,215,rect(0,0,235,215,['#82998d','#9d8469','#718b8e','#a49273','#7d8e76'][i],8)+rect(18,24,199,130,'#d8d7c4',4)+text(117,190,['STYLE','TECH','HOME','FOOD','LIFE'][i],15,'#f2e8ce','text-anchor="middle"'),{kind:'shopfront'});s.rug(180,650,1220,300,'#c6bda2');for(const x of [260,570,880,1190])s.object(x,725,180,120,tableArt(145,95));anchors.push({x:790,y:615},{x:790,y:980});fallbacks=[['jabi-mall-shop','Browse the mall'],['jabi-mall-food','Meet at the food court']];break;
    case'international-conference-centre': sign('ICC ABUJA','CONFERENCES · TOWN HALLS');s.art.push(rect(160,205,1260,250,'#607d77',12)+rect(205,245,1170,170,'#d5d8c6',7));for(let r=0;r<4;r++)for(let c=0;c<9;c++)s.object(185+c*135,515+r*115,82,66,chairArt(r%2?'#9d8668':'#809489'),{kind:'conference-seat'});s.object(590,430,400,76,counterArt(400,76),{kind:'conference-stage'});anchors.push({x:790,y:1000});fallbacks=[['icc-conference','Attend a city conference']];break;
    case'inec-hq': sign('INEC HEADQUARTERS','ABUJALIFE ELECTION REGISTRATION');s.art.push(rect(140,190,1300,150,'#73916f',10)+text(790,280,'INEC · CITY STORY',34,'#f3ecd4','text-anchor="middle" letter-spacing="7"'));desks(4,475);seats(2,5,680);s.object(1110,895,270,80,counterArt(270,80,'#78906f'),{kind:'registration-desk'});s.label(1090,1010,'CANDIDATE REGISTRATION');s.pedestrians.push({x:1225,y:845,toX:1225,toY:845,stationary:true,role:'Registration desk'});anchors.push({x:1225,y:845},{x:790,y:970});fallbacks=[['inec-registration','Visit the candidate registration desk'],['inec-info','Read election information']];break;
    case'efcc-hq': sign('EFCC HEADQUARTERS','FICTIONAL ABUJALIFE INTEGRITY STORY');desks(3,430);s.art.push(rect(180,670,1220,285,'#d6d9c9',10)+text(790,735,'FICTIONAL GAME STORY ONLY',22,'#597064','text-anchor="middle" letter-spacing="4"'));s.object(610,785,360,90,counterArt(360,90,'#73877b'),{kind:'briefing-desk'});s.pedestrians.push({x:790,y:930,toX:790,toY:930,stationary:true,role:'Story desk'});anchors.push({x:790,y:930});fallbacks=[['efcc-briefing','Visit the fictional integrity briefing']];break;
    case'federal-high-court-hub': sign('FEDERAL HIGH COURT','FICTIONAL ABUJALIFE HEARING');s.art.push(rect(180,190,1220,215,'#ded8c4',9));for(let r=0;r<4;r++)for(const x of [220,930])s.object(x,480+r*115,430,44,gardenBenchArt(430),{kind:'court-bench'});s.object(610,365,360,85,counterArt(360,85,'#8c7659'),{kind:'bench'});s.label(680,338,'FICTIONAL HEARING');anchors.push({x:790,y:1000});fallbacks=[['court-gallery','Visit the fictional hearing gallery']];break;
    default: sign(String(raw.name||'ABUJA').toUpperCase());desks(3,420);seats(2,5,650);anchors.push({x:790,y:930});fallbacks=[['visit','Explore this destination']];
  }
  s.door(s.width/2,'BACK TO THE CITY','exit-venue');venuePoints(s,raw,anchors,fallbacks);return s.finish();
}
'''
if 'function buildLandmarkVenue' not in s:
    s=once(s,'function buildVenue(profile,venue,id) {',landmark_interior+'\nfunction buildVenue(profile,venue,id) {','custom landmark interiors')
raw_anchor="  const raw={...VENUES.find(v=>v.id===incoming.id),...incoming};\n"
if "buildLandmarkVenue(profile,raw,id)" not in s:
    s=once(s,raw_anchor,raw_anchor+"  if(raw.landmarkInterior&&!['banex','jabi-lake'].includes(raw.id))return buildLandmarkVenue(profile,raw,id);\n",'landmark interior routing')
write(p,s)

# 7. City Story travel must resolve the exact venue ID, not silently degrade to a district/random venue.
p='app/app.js'; s=read(p)
travel_handler="""
addEventListener('abj:open-map-venue',event=>{
 const venueId=String(event.detail?.venueId||'');if(!venueId)return;
 const venue=list(state.venues).find(place=>place.id===venueId);
 if(!venue){toast('That Abuja destination is not available.');return;}
 goToVenue(venueId);
});
"""
if "addEventListener('abj:open-map-venue'" not in s:
    target="function openCityPlaces(){"
    s=once(s,target,travel_handler+"\n"+target,'city story travel listener')
write(p,s)

# 8. Regression test: no map-only landmark can ship again, and civic destinations are exact.
test=ROOT/'tests/city-world-integrity.test.mjs'
test.write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_LANDMARKS } from '../src/shared/city-landmarks.mjs';
import { VENUES, VENUE_ACTIONS, venuesForDistrict } from '../src/shared/life.mjs';
import fs from 'node:fs';

const byId=new Map(VENUES.map(v=>[v.id,v]));
test('every Abuja map landmark resolves to a playable venue and matching interior',()=>{
  assert.equal(CITY_LANDMARKS.length,21);
  for(const landmark of CITY_LANDMARKS){
    const venue=byId.get(landmark.id);assert.ok(venue,`${landmark.id} missing from VENUES`);
    assert.equal(venue.outsideWorld,true,`${landmark.id} must render in walkable Outside`);
    assert.equal(venue.landmarkInterior,landmark.interior,`${landmark.id} interior mismatch`);
    assert.ok(!venue.districts||venue.districts.includes(landmark.districtId),`${landmark.id} district mismatch`);
  }
});

test('all civic City Story destinations are real playable landmark venues',()=>{
  for(const id of ['inec-hq','efcc-hq','federal-high-court-hub'])assert.ok(byId.has(id),`${id} is not playable`);
  const source=fs.readFileSync(new URL('../app/civic-life.js',import.meta.url),'utf8');
  for(const id of ['inec-hq','efcc-hq','federal-high-court-hub'])assert.match(source,new RegExp(id));
  assert.match(fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8'),/abj:open-map-venue/);
});

test('full-city free roam exposes landmarks and map keeps outer ad space',()=>{
  for(const district of ['garki-i','maitama','jabi']){
    const ids=new Set(venuesForDistrict(district).map(v=>v.id));
    for(const landmark of CITY_LANDMARKS)assert.ok(ids.has(landmark.id),`${landmark.id} absent from ${district} Outside`);
  }
  const world=fs.readFileSync(new URL('../app/world-city.js',import.meta.url),'utf8');
  assert.match(world,/CITY_LANDMARKS/);assert.match(world,/airport-plane/);assert.match(world,/width=8500/);
  const map=fs.readFileSync(new URL('../app/outside-city-v4.js',import.meta.url),'utf8');
  assert.match(map,/CITY_LANDMARKS/);assert.match(map,/Advertising plot/);assert.match(map,/minZoom:\.22,maxZoom:24/);
});

test('landmarks have contextual activity instead of empty generic rooms',()=>{
  const actionIds=new Set(VENUE_ACTIONS.map(a=>a.venueId));
  for(const landmark of CITY_LANDMARKS)assert.ok(actionIds.has(landmark.id)||['banex'].includes(landmark.id),`${landmark.id} has no contextual activity`);
});
''')

print('city world integrity patch applied')

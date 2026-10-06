from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def once(s,old,new,label):
    c=s.count(old)
    if c!=1: raise SystemExit(f'{label}: expected 1 anchor, got {c}')
    return s.replace(old,new,1)

# Feed the ACTUAL WebGL renderer the same full city the SVG interaction layer already owns.
p='app/world-city.js'; s=read(p)
anchor=" return {width,height,art,obstacles,interactables,buildings:specs.filter(spec=>spec.id==='home'||venues.some(venue=>venue.id===spec.id)),spawn:{x:445,y:679},"
insert=""" const landmarkSizes={airport:[520,220],cityGate:[260,170],stadium:[360,250],magicland:[330,240],wtc:[300,300],cbn:[250,285],assembly:[360,220],eagle:[300,165],mosque:[300,250],church:[270,230],transcorp:[340,240],millennium:[360,250],aso:[320,220],farmCity:[300,205],jabiLake:[430,250],mall:[330,220],conference:[320,225],banex:[320,210],inec:[290,220],efcc:[310,230],court:[310,225]};
 const legacyIds=new Set(specs.map(b=>b.id));
 const contextBuildings=neighbourhoodFabric.map((b,i)=>({id:`context-${i}`,x:b.x,y:b.y,w:b.w,h:b.h,name:'',wall:b.c,floors:2,context:true}));
 const landmarkBuildings=CITY_LANDMARKS.filter(landmark=>!legacyIds.has(landmark.id)).map(landmark=>{const point=landmarkWorldPoint(landmark),size=landmarkSizes[landmark.builder]||[290,210];return{id:landmark.id,x:point.x-size[0]/2,y:point.y+size[1]/2,w:size[0],h:size[1],name:landmark.short||landmark.name,wall:'#d8d3c4',floors:landmark.builder==='wtc'?7:landmark.builder==='cbn'?6:landmark.builder==='transcorp'?4:landmark.builder==='inec'||landmark.builder==='efcc'||landmark.builder==='court'?3:2,landmarkBuilder:landmark.builder,frontY:true};});
 const visibleBuildings=[...specs,...contextBuildings,...landmarkBuildings];

 return {width,height,art,obstacles,interactables,buildings:visibleBuildings,spawn:{x:445,y:679},"""
s=once(s,anchor,insert,'full WebGL building catalogue')
write(p,s)

# Recognisable landmark silhouettes in the live 3D layer. This uses the existing classic material system,
# so it improves the city without reviving the rejected glossy/PBR redesign.
p='app/world-3d-scenes.js'; s=read(p)
anchor="    const buildings=layout.buildings||(layout.obstacles||[]).filter(o=>o.w>200&&o.h>180).map(o=>({...o,y:o.y+o.h,frontY:true,floors:2,name:''}));\n"
helper="""    const renderLandmarkBuilding=(parent,b)=>{
      const w=Math.max(120,b.w||260),d=Math.max(100,(b.h||210)*ds),builder=b.landmarkBuilder,plaster=surfaces.material('plaster','#ded8c8'),glassLandmark=mat('#76979a',.38,.08),greenLandmark=mat('#6f9368'),stone=mat('#b9b19f');
      const slab=(x,y,z,bw,bh,bd,color=plaster)=>box(parent,x,y,z,bw,bh,bd,color,true);
      switch(builder){
        case'airport':slab(0,34,0,w,68,d*.42);slab(0,57,d*.22,w*.82,28,5,glassLandmark);slab(w*.34,82,-d*.18,34,118,34,stone);slab(0,2,d*.62,w*1.35,4,55,mat('#46575a'));for(let i=-4;i<=4;i++)slab(i*44,4,d*.62,22,1,2,cream);break;
        case'cityGate':for(const side of[-1,1]){slab(side*w*.22,55,0,w*.16,110,d*.32,plaster);slab(side*w*.16,102,0,w*.11,26,d*.28,plaster);}slab(0,91,0,w*.58,18,d*.30,plaster);break;
        case'stadium':cylinder(parent,0,34,0,w*.35,58,stone,w*.35,32);cylinder(parent,0,66,0,w*.28,10,greenLandmark,w*.28,32);slab(0,71,0,w*.46,4,d*.18,greenLandmark);break;
        case'magicland':slab(-w*.24,28,0,w*.32,56,d*.35,mat('#d4b27f'));cylinder(parent,w*.16,62,0,5,120,metal,5,12);for(let i=0;i<10;i++){const a=i*Math.PI*2/10;ball(parent,w*.16+Math.cos(a)*w*.18,72+Math.sin(a)*58,0,7,7,7,[mat('#d59f54'),mat('#6f9fa0'),mat('#b8766f')][i%3],8);}break;
        case'wtc':slab(-w*.19,130,0,w*.34,260,d*.46,glassLandmark);slab(w*.19,146,0,w*.30,292,d*.42,glassLandmark);slab(0,9,0,w*.86,18,d*.72,stone);break;
        case'cbn':slab(0,125,0,w*.66,250,d*.52,plaster);slab(0,132,d*.27,w*.52,214,4,glassLandmark);for(const x of[-.27,-.13,0,.13,.27])slab(x*w,134,d*.30,5,220,7,cream);break;
        case'assembly':slab(0,28,0,w*.46,56,d*.44,plaster);slab(-w*.31,22,0,w*.24,44,d*.38,plaster);slab(w*.31,22,0,w*.24,44,d*.38,plaster);ball(parent,0,62,0,w*.15,24,d*.14,greenLandmark,12);break;
        case'eagle':slab(0,5,0,w*.70,10,d*.58,stone);for(const side of[-1,1]){slab(side*w*.24,28,0,w*.13,56,d*.18,plaster);cylinder(parent,side*w*.24,66,0,7,28,mat('#d2aa5c'),7,8);}break;
        case'mosque':slab(0,30,0,w*.42,60,d*.36,plaster);ball(parent,0,70,0,w*.16,30,d*.15,mat('#d7ac4e'),12);for(const x of[-w*.27,w*.27])for(const z of[-d*.20,d*.20]){cylinder(parent,x,64,z,6,128,plaster,6,10);cylinder(parent,x,131,z,9,12,mat('#d7ac4e'),1,10);}break;
        case'church':slab(0,34,0,w*.48,68,d*.40,plaster);slab(0,82,-d*.12,w*.16,96,d*.18,stone);cylinder(parent,0,147,-d*.12,5,34,mat('#9d855f'),1,6);break;
        case'transcorp':slab(0,72,0,w*.82,144,d*.36,plaster);for(let y=24;y<132;y+=24)slab(0,y,d*.19,w*.68,5,4,glassLandmark);slab(0,8,d*.34,w*.48,16,d*.18,mat('#b79b74'));break;
        case'millennium':slab(0,2,0,w*.82,4,d*.76,greenLandmark);for(const[x,z]of[[-.28,-.24],[-.08,.16],[.23,-.12],[.28,.24],[-.30,.22]]){cylinder(parent,x*w,14,z*d,3,28,mat('#765f45'),3,7);ball(parent,x*w,34,z*d,22,18,22,mat('#567d54'),8);}break;
        case'aso':for(const[x,y,z,rx,ry,rz]of[[-.18,55,0,.28,.32,.22],[.10,66,-.08,.34,.38,.27],[.28,42,.12,.21,.24,.18]])ball(parent,x*w,y,z*d,rx*w,ry*150,rz*d,mat('#8e8b78'),9);break;
        case'jabiLake':slab(0,1,0,w*.92,2,d*.76,mat('#78a9a4',.6,0));break;
        case'mall':slab(0,48,0,w*.84,96,d*.48,plaster);slab(0,56,d*.25,w*.70,50,4,glassLandmark);break;
        case'conference':slab(0,36,0,w*.78,72,d*.48,plaster);ball(parent,0,72,0,w*.24,24,d*.20,stone,12);break;
        case'inec':case'efcc':case'court':slab(0,68,0,w*.76,136,d*.46,plaster);slab(0,72,d*.24,w*.58,94,4,glassLandmark);for(const x of[-.28,-.14,0,.14,.28])slab(x*w,74,d*.27,4,100,6,stone);break;
        case'farmCity':case'banex':slab(0,34,0,w*.82,68,d*.50,mat('#d8cbb3'));slab(0,44,d*.26,w*.68,42,4,glassLandmark);break;
        default:slab(0,58,0,w*.76,116,d*.46,plaster);slab(0,62,d*.24,w*.56,72,4,glassLandmark);
      }
    };
"""+anchor
s=once(s,anchor,helper,'landmark 3D renderer anchor')
old="""      p.name=`Authored building: ${b.id||b.name||'residence'}`;
      box(p,0,height/2,0,b.w,height,b.h*ds,surfaces.material('plaster',affluent?'#e5decc':b.wall||'#d6d1bc'));
"""
new="""      p.name=`Authored building: ${b.id||b.name||'residence'}`;
      if(b.landmarkBuilder){renderLandmarkBuilding(p,b);continue;}
      box(p,0,height/2,0,b.w,height,b.h*ds,surfaces.material('plaster',affluent?'#e5decc':b.wall||'#d6d1bc'));
"""
s=once(s,old,new,'use specialised landmark 3D renderer')
write(p,s)

# Strengthen regression coverage: the visible world and WebGL scene must share one city catalogue.
p='tests/final-world-phone-regression.test.mjs'; s=read(p)
addition="""

test('live WebGL Outside receives the complete city and recognisable landmarks',()=>{
  const city=read('app/world-city.js'),three=read('app/world-3d-scenes.js');
  assert.match(city,/const visibleBuildings=\[\.\.\.specs,\.\.\.contextBuildings,\.\.\.landmarkBuildings\]/);
  assert.match(city,/landmarkBuilder:landmark\.builder/);
  assert.match(city,/buildings:visibleBuildings/);
  assert.match(three,/renderLandmarkBuilding/);
  for(const builder of ['airport','cityGate','stadium','wtc','cbn','assembly','mosque','transcorp','inec'])assert.match(three,new RegExp(`case'${builder}'`));
});
"""
if 'live WebGL Outside receives the complete city' not in s:s+=addition
write(p,s)

print('final city visual pass applied')

import * as THREE from './vendor/three.module.js';
import { abujaTime } from '../src/shared/simulation.mjs';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CENTER={lat:9.055,lon:7.47};
const SCALE={lat:22000,lon:15000};
const toWorld=({lat,lon})=>({x:(lon-CENTER.lon)*SCALE.lon,z:-(lat-CENTER.lat)*SCALE.lat});
const hash=text=>{let n=2166136261;for(const c of String(text||'')){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};

const DISTRICT_ANCHORS={
  'central-area':{lat:9.0555,lon:7.4900},'garki-i':{lat:9.0360,lon:7.4860},'garki-ii':{lat:9.0250,lon:7.4870},
  'asokoro':{lat:9.0470,lon:7.5350},'maitama':{lat:9.0830,lon:7.4930},'wuse-i':{lat:9.0630,lon:7.4700},
  'wuse-ii-a07':{lat:9.0770,lon:7.4700},'wuse-ii-a08':{lat:9.0750,lon:7.4590},'guzape':{lat:9.0260,lon:7.5190},
  'kukwaba':{lat:9.0390,lon:7.4510},'gudu':{lat:9.0200,lon:7.4630},'durumi':{lat:9.0310,lon:7.4530},
  'wuye':{lat:9.0490,lon:7.4420},'jabi':{lat:9.0690,lon:7.4230},'utako':{lat:9.0670,lon:7.4450},
  'mabushi':{lat:9.0860,lon:7.4550},'katampe':{lat:9.1020,lon:7.4690},'jahi':{lat:9.1000,lon:7.4400},
  'kado':{lat:9.0910,lon:7.4320},'gwarinpa-i':{lat:9.1090,lon:7.4080},'gwarinpa-ii':{lat:9.1270,lon:7.4020},
  'galadimawa':{lat:8.9950,lon:7.4340},'lokogoma':{lat:8.9910,lon:7.4820},'lugbe':{lat:8.9980,lon:7.3770},
  'chika':{lat:9.0120,lon:7.4050},'kuchigoro':{lat:9.0250,lon:7.4170},'pyakasa':{lat:8.9810,lon:7.4010},
  'kyami':{lat:9.0000,lon:7.3350},'karmo':{lat:9.1000,lon:7.3660},'dape':{lat:9.1070,lon:7.4210},
  'mpape':{lat:9.1370,lon:7.4940},'kubwa':{lat:9.1540,lon:7.3220},'dawaki':{lat:9.1390,lon:7.3850},
  'dei-dei':{lat:9.1300,lon:7.2720},'zuba':{lat:9.1000,lon:7.2170},'karu':{lat:9.0110,lon:7.5720},
  'nyanya':{lat:9.0280,lon:7.5740},'orozo':{lat:8.9860,lon:7.5580},'gwagwalada-town':{lat:8.9430,lon:7.0790}
};

const LANDMARKS=[
  ['airport-hub','Nnamdi Azikiwe International Airport','Abuja Airport',9.00657,7.26419,'lugbe','airport',100,'Arrivals, departures and an Airport Road meetup.'],
  ['city-gate-plaza','Abuja City Gate','City Gate',9.03570,7.44862,'kukwaba','cityGate',100,'The ceremonial entrance to Abuja and a natural meetup/photo stop.'],
  ['national-stadium-hub','Moshood Abiola National Stadium','National Stadium',9.03789,7.45339,'kukwaba','stadium',98,'Sport, training and match-day social play.'],
  ['magicland','Magicland Amusement Park','Magicland',9.04280,7.45184,'kukwaba','magicland',96,'Rides, arcade play and group hangouts.'],
  ['wtc-abuja-hub','World Trade Centre Abuja','WTC Abuja',9.04960,7.47326,'central-area','wtc',100,'Twin-tower CBD landmark for business networking and skyline social play.'],
  ['cbn-experience','Central Bank of Nigeria','CBN',9.05093,7.49307,'central-area','cbn',98,'Finance, economic history and career activities.'],
  ['national-assembly-hub','National Assembly Complex','National Assembly',9.06818,7.51230,'central-area','assembly',100,'A respectful civic plaza and social landmark.'],
  ['eagle-square-hub','Eagle Square','Eagle Square',9.0615,7.4922,'central-area','eagle',92,'Public events, meetups and city moments.'],
  ['national-mosque-hub','Abuja National Mosque','National Mosque',9.0602,7.4898,'central-area','mosque',96,'Prayer, reflection and community.'],
  ['national-christian-centre-hub','National Christian Centre','National Christian Centre',9.0510,7.4905,'central-area','church',92,'Prayer, reflection and community.'],
  ['transcorp-hilton-hub','Transcorp Hilton Abuja','Transcorp Hilton',9.07444,7.49510,'maitama','transcorp',98,'Hotel, pool, dining, meetings and lobby meetups.'],
  ['millennium-park-hub','Millennium Park','Millennium Park',9.07070,7.49939,'maitama','millennium',94,'Walks, picnics and outdoor multiplayer hangouts.'],
  ['aso-rock-view','Aso Rock Viewpoint','Aso Rock',9.06982,7.52083,'central-area','aso',100,'A city-defining viewpoint for walks and meetups.'],
  ['farm-city','Farm City Abuja','Farm City',9.0800,7.4708,'wuse-ii-a07','farmCity',90,'Food, arcade and Abuja hangout energy.'],
  ['jabi-lake','Jabi Lake','Jabi Lake',9.0750,7.4170,'jabi','jabiLake',88,'Lakeside walks, picnic and social space.'],
  ['jabi-lake-mall','Jabi Lake Mall','Jabi Lake Mall',9.0760,7.4210,'jabi','mall',84,'Shopping landmark beside Jabi Lake.'],
  ['international-conference-centre','International Conference Centre','ICC Abuja',9.0618,7.4862,'central-area','conference',82,'Conference and event landmark in the city core.'],
  ['banex','Banex Tech Market','Banex',9.0790,7.4590,'wuse-ii-a08','banex',84,'Tech shopping, repairs and Abuja hustle.']
].map(([id,name,short,lat,lon,districtId,builder,priority,blurb])=>({id,name,short,lat,lon,districtId,builder,priority,blurb}));

const ROAD_LINKS=[
  ['airport-hub','city-gate-plaza'],['city-gate-plaza','national-stadium-hub'],['national-stadium-hub','magicland'],
  ['magicland','wtc-abuja-hub'],['wtc-abuja-hub','cbn-experience'],['cbn-experience','national-mosque-hub'],
  ['national-mosque-hub','national-assembly-hub'],['national-assembly-hub','aso-rock-view'],['cbn-experience','transcorp-hilton-hub'],
  ['transcorp-hilton-hub','millennium-park-hub'],['wtc-abuja-hub','jabi-lake'],['jabi-lake','farm-city'],['farm-city','banex']
];

function material(color,opts={}){return new THREE.MeshStandardMaterial({color,roughness:.78,metalness:0,...opts});}
function box(group,color,x,y,z,w,h,d,r=0,opts){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,opts));m.position.set(x,y,z);m.rotation.y=r;group.add(m);return m;}
function cylinder(group,color,x,y,z,r,h,segments=20,opts){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),material(color,opts));m.position.set(x,y,z);group.add(m);return m;}
function sphere(group,color,x,y,z,rx,ry=rx,rz=rx,opts){const m=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),material(color,opts));m.scale.set(rx,ry,rz);m.position.set(x,y,z);group.add(m);return m;}
function torus(group,color,x,y,z,r,tube,rx=Math.PI/2,rz=0){const m=new THREE.Mesh(new THREE.TorusGeometry(r,tube,10,36),material(color,{roughness:.52,metalness:.06}));m.position.set(x,y,z);m.rotation.x=rx;m.rotation.z=rz;group.add(m);return m;}
function tree(group,x,z,size=1,palm=false){cylinder(group,'#806b4f',x,13*size,z,2.6*size,26*size,10);if(palm){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;sphere(group,'#4f805f',x+Math.cos(a)*9*size,29*size,z+Math.sin(a)*9*size,12*size,3.8*size,5*size);}}else{sphere(group,'#4f7755',x,31*size,z,13*size,14*size,13*size);sphere(group,'#759467',x-5*size,40*size,z+2*size,8*size,8*size,8*size);}}
function pad(group,x,z,w=200,d=150,color='#9caf8f'){return box(group,color,x,1,z,w,2,d);}
function road(group,a,b,width=34){const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;box(group,'#42585c',mx,2,mz,width,4,len,angle);box(group,'#ded3ac',mx,4,mz,2,1,len*.92,angle);box(group,'#b8c6b5',mx+Math.cos(angle)*width*.64,2.5,mz-Math.sin(angle)*width*.64,9,3,len,angle);box(group,'#b8c6b5',mx-Math.cos(angle)*width*.64,2.5,mz+Math.sin(angle)*width*.64,9,3,len,angle);}
function tagMeshes(group,key){group.traverse(o=>{if(o.isMesh)o.userData.destinationKey=key;});}

function buildLandmark(world,item){
  const g=new THREE.Group();g.position.set(item.x,0,item.z);world.add(g);pad(g,0,0,220,165,'#9caf8f');
  const b=(c,x,y,z,w,h,d,r=0,o)=>box(g,c,x,y,z,w,h,d,r,o),cy=(c,x,y,z,r,h,s=20,o)=>cylinder(g,c,x,y,z,r,h,s,o),sp=(c,x,y,z,rx,ry,rz,o)=>sphere(g,c,x,y,z,rx,ry,rz,o);
  switch(item.builder){
    case'airport':{
      b('#e8ece7',0,27,0,220,45,78);b('#84adb5',0,31,40,196,30,3,0,{metalness:.12,roughness:.35});
      b('#f0f0ea',0,52,5,232,9,104);b('#d6dbd6',-76,60,-12,52,24,56);cy('#d8ddd9',82,52,-22,10,92);b('#5c7d83',82,101,-22,34,12,34);
      b('#3d5156',0,2,100,350,3,52);for(let i=-4;i<=4;i++)b('#eee0b7',i*36,4,100,18,1.5,2);item.height=130;break;
    }
    case'cityGate':{
      b('#eff0e8',-34,54,0,17,104,27);b('#eff0e8',34,54,0,17,104,27);b('#f4f3ec',0,49,1,84,10,21);b('#3d7c58',0,66,3,28,15,5);b('#355d53',0,9,-48,132,4,16);for(const side of[-1,1])tree(g,side*68,50,.9,true);item.height=122;break;
    }
    case'stadium':{cy('#dad8cc',0,20,0,84,36,44);cy('#526b62',0,38,0,68,13,44);cy('#6f9d69',0,46,0,47,4,44);b('#d9cba7',0,51,0,35,2,80);item.height=94;break;}
    case'magicland':{b('#d7b37e',-54,24,-28,68,42,48);const cx=42,cz=-18;cy('#7d776b',cx,35,cz,3,70);torus(g,'#c88d70',cx,48,cz,44,3,0,Math.PI/2);for(let i=0;i<12;i++){const a=i*Math.PI*2/12;sp(['#d7b16d','#6e9da0','#b97569','#7d739b'][i%4],cx+Math.cos(a)*44,48+Math.sin(a)*44,cz,6,6,6);}item.height=106;break;}
    case'wtc':{
      b('#4a6771',-34,98,0,66,188,64,0,{metalness:.26,roughness:.28});b('#6f8790',46,110,2,58,212,60,0,{metalness:.2,roughness:.3});
      for(let y=18;y<205;y+=15){b('#d7c69b',-34,y,33,74,2.5,7);b('#d7c69b',46,y,34,72,2.5,7);}b('#c9cbbf',5,5,0,184,8,110);item.height=224;break;
    }
    case'cbn':{
      b('#d8d3c6',0,97,0,148,188,86);b('#3e5d66',0,101,44,118,152,3,0,{metalness:.24,roughness:.26});
      for(const x of[-62,-31,0,31,62])b('#e4dfd2',x,104,46,7,158,7);b('#e9e3d6',0,194,-6,110,10,70);b('#c29a63',0,16,55,138,14,24);item.height=205;break;
    }
    case'assembly':{
      b('#f0f1eb',0,24,8,108,42,60);b('#e9ebe5',-79,21,8,60,35,50);b('#e9ebe5',79,21,8,60,35,50);cy('#ecece4',0,48,8,36,24,32);sp('#2d8b57',0,64,8,33,21,33);b('#d8cba7',0,4,78,190,3,36);for(const side of[-1,1])tree(g,side*86,65,.75,true);item.height=94;break;
    }
    case'eagle':{b('#d8d3be',0,4,0,194,7,140);b('#b8aa84',0,8,0,120,5,84);b('#6f8276',0,20,-30,82,23,28);for(const side of[-1,1]){cy('#667d76',side*58,37,30,2,62);b(side<0?'#2f8557':'#f0efe9',side*54,53,30,14,24,2);}item.height=84;break;}
    case'mosque':{b('#ddd6bd',0,31,0,112,58,80);sp('#c7a65d',0,77,0,40,27,40);for(const side of[-1,1]){cy('#e5dfca',side*58,69,-28,6,132);sp('#c2a05a',side*58,139,-28,10,14,10);}item.height=160;break;}
    case'church':{b('#ddd2b8',0,40,0,108,72,78);b('#e6d6a4',0,112,0,8,72,8);b('#e6d6a4',0,129,0,46,8,8);item.height=145;break;}
    case'transcorp':{b('#c8bea8',0,74,-8,166,136,66);for(let y=18;y<135;y+=17)b('#7fa5a7',0,y,26,148,7,3,0,{metalness:.08,roughness:.4});b('#e0d8c2',54,4,60,92,3,44);b('#6ea5aa',54,7,60,74,4,31);for(let i=0;i<7;i++)tree(g,-78+i*26,65,.7,true);item.height=150;break;}
    case'millennium':{pad(g,0,0,235,178,'#73966d');b('#d9cfad',0,4,0,22,3,168);b('#d9cfad',0,4,0,214,3,17);cy('#d8d1b8',0,8,0,25,5);cy('#70a9ad',0,12,0,20,4);sp('#d7eee2',0,21,0,5,13,5);for(let i=0;i<12;i++){const a=i*Math.PI*2/12;tree(g,Math.cos(a)*90,Math.sin(a)*66,.8,i%4===0);}item.height=56;break;}
    case'aso':{pad(g,0,18,220,124,'#88987f');const rocks=[[-55,45,42,73,48],[-18,59,62,99,66],[33,51,54,84,58],[70,38,38,62,45]];for(const [dx,y,rx,ry,rz] of rocks)sp('#90958a',dx,y,-28,rx,ry,rz);item.height=128;break;}
    case'farmCity':{b('#c7b38e',0,30,-12,142,52,68);b('#8a7557',0,7,52,140,6,40);for(let i=0;i<5;i++)b('#e0d2ad',-52+i*26,14,51,18,5,18);for(const side of[-1,1])tree(g,side*72,54,.8,true);item.height=72;break;}
    case'jabiLake':{pad(g,0,0,255,184,'#809e74');sp('#5a9fac',-5,5,0,108,3,68);b('#d4c29d',50,7,46,90,4,14);for(let i=0;i<8;i++)tree(g,-98+i*28,78,.8,true);item.height=46;break;}
    case'mall':{b('#d8d4c8',0,35,0,152,64,88);b('#6c919a',0,38,45,130,38,3,0,{metalness:.13,roughness:.38});b('#b9905e',0,17,49,92,8,8);item.height=80;break;}
    case'conference':{b('#d4c5aa',0,30,0,136,52,78);b('#718f8e',0,42,41,94,22,3);b('#d9a967',0,59,0,84,8,54);item.height=76;break;}
    case'banex':{for(let i=-1;i<=1;i++){b('#d4bd8f',i*52,28,0,46,50,72);b('#527d88',i*52,24,37,34,28,3);b('#c7af7f',i*52,51,5,50,5,77);}item.height=62;break;}
    default:{b('#d3c8ad',0,30,0,116,54,78);b('#75969a',0,35,40,80,22,3);item.height=72;}
  }
  tagMeshes(g,item.key);return g;
}

function fallbackPosition(place,index){
  const phase=place?.legacyAssertions?.phase;
  const phaseCenters={I:{x:180,z:-80},II:{x:-500,z:170},III:{x:-1050,z:320},IV:{x:-1800,z:500},V:{x:-2450,z:850}};
  if(phase&&phaseCenters[phase]){const base=phaseCenters[phase],n=hash(place.id),a=(n%6283)/1000,r=220+(n%520);return{x:base.x+Math.cos(a)*r,z:base.z+Math.sin(a)*r};}
  const councilCenters={amac:{x:250,z:350},bwari:{x:-1450,z:-1500},gwagwalada:{x:-3500,z:1500},kuje:{x:-1900,z:1800},kwali:{x:-4300,z:2300},abaji:{x:-5200,z:2700}};
  if(place?.council&&councilCenters[place.council]){const base=councilCenters[place.council],n=hash(place.id),a=(n%6283)/1000,r=180+(n%420);return{x:base.x+Math.cos(a)*r,z:base.z+Math.sin(a)*r};}
  const n=hash(`${place?.id}:${index}`),a=(n%6283)/1000,r=1600+(n%800);return{x:Math.cos(a)*r,z:Math.sin(a)*r};
}

function createLayout(atlas=[],venues=[]){
  const venueMap=new Map(venues.map(v=>[v.id,v]));
  const landmarks=LANDMARKS.map(source=>{const p=toWorld(source),venue=venueMap.get(source.id);return{...source,...p,venueId:venue?.id||null,key:`landmark:${source.id}`,destination:{districtId:source.districtId,...(venue?{venueId:venue.id}:{})}};});
  const landmarkById=new Map(landmarks.map(v=>[v.id,v]));
  const districts=atlas.map((place,index)=>{const anchor=place.coordinates||DISTRICT_ANCHORS[place.id],p=anchor?toWorld(anchor):fallbackPosition(place,index);return{...place,...p,key:`district:${place.id}`,priority:24,destination:{districtId:place.id}};});
  const adPlots=[],rows=[{count:16,start:-2850,step:380,z:2450},{count:14,start:-2480,step:385,z:-2200},{count:11,start:-1700,step:360,x:3650,vertical:true},{count:11,start:-1700,step:360,x:-4100,vertical:true}];let n=1;
  for(const row of rows)for(let i=0;i<row.count;i++,n++){const id=`plot-${String(n).padStart(2,'0')}`,x=row.vertical?row.x:row.start+i*row.step,z=row.vertical?row.start+i*row.step:row.z;adPlots.push({id,key:`ad:${id}`,adPlotId:id,name:`Ad plot ${String(n).padStart(2,'0')}`,x,z,height:8,priority:9,category:'Advertising land',destination:{adPlotId:id}});}
  return{width:9200,depth:6500,landmarks,landmarkById,districts,adPlots,all:[...landmarks,...districts,...adPlots]};
}

function buildCity(layout){
  const scene=new THREE.Scene(),world=new THREE.Group();scene.add(world);scene.background=new THREE.Color('#b7d4d0');scene.fog=new THREE.Fog('#b7d4d0',7600,12600);
  box(world,'#afc4ab',0,-13,0,layout.width,22,layout.depth);box(world,'#93ad8a',0,-1,0,layout.width-560,5,layout.depth-560);
  for(const [aId,bId] of ROAD_LINKS){const a=layout.landmarkById.get(aId),b=layout.landmarkById.get(bId);if(a&&b)road(world,a,b,42);}
  const districtMap=new Map(layout.districts.map(v=>[v.id,v])),core=['central-area','wuse-i','wuse-ii-a07','wuse-ii-a08','maitama','asokoro','jabi','utako','wuye','garki-i','garki-ii','mabushi','gwarinpa-i','lugbe','kukwaba'];
  for(let i=0;i<core.length;i++)for(let j=i+1;j<core.length;j++){const a=districtMap.get(core[i]),b=districtMap.get(core[j]);if(a&&b&&Math.hypot(a.x-b.x,a.z-b.z)<760)road(world,a,b,24);}
  for(const id of core){const p=districtMap.get(id);if(!p)continue;pad(world,p.x,p.z,270,198,id==='central-area'?'#a3b798':'#99b08e');const h=id==='central-area'?78:id==='maitama'||id==='asokoro'?56:40;for(let k=0;k<4;k++){const a=k*Math.PI/2+.55;box(world,k%2?'#d9d0ba':'#c9c6b4',p.x+Math.cos(a)*80,h/2+4,p.z+Math.sin(a)*60,55,h+(k%2)*18,43,a*.14);}for(let k=0;k<5;k++)tree(world,p.x-108+k*54,p.z+91,.62,k%4===0);}
  for(const landmark of layout.landmarks)buildLandmark(world,landmark);
  const liveAds=new Map((globalThis.__ABJ_ADS__?.spaces||[]).map(s=>[s.id,s]));
  for(const plot of layout.adPlots){const occupied=liveAds.get(plot.adPlotId)?.available===false;const base=box(world,occupied?'#b9d8d8':'#c7e6e8',plot.x,2.5,plot.z,310,4,235);base.userData.destinationKey=plot.key;const top=box(world,'#eff7f5',plot.x,5,plot.z,280,2,205);top.userData.destinationKey=plot.key;if(occupied){const board=box(world,'#6b8f91',plot.x,18,plot.z-77,225,26,12);board.userData.destinationKey=plot.key;}}
  const carGeo=new THREE.BoxGeometry(22,9,34),carMat=material('#d9c08d',{roughness:.48}),traffic=[];for(let i=0;i<14;i++){const m=new THREE.Mesh(carGeo,carMat);m.position.set(-2400+i*230,8,420+(i%3)*18);world.add(m);traffic.push({mesh:m,offset:i*280,speed:34+(i%4)*7});}
  const ambient=new THREE.HemisphereLight('#fff1d7','#4d6b60',2.15);scene.add(ambient);const sun=new THREE.DirectionalLight('#fff2d4',2.45);sun.position.set(-2500,5200,2200);scene.add(sun);const rim=new THREE.DirectionalLight('#d5eff2',.72);rim.position.set(2500,1800,-2500);scene.add(rim);
  return{scene,world,ambient,sun,traffic,updateTraffic(t){for(const [i,row] of traffic.entries()){row.mesh.position.x=-2800+((row.offset+t*row.speed)%5600);row.mesh.position.z=420+(i%3)*18;}},dispose(){const geos=new Set(),mats=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])mats.add(m);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}

export function renderOutside(root,{atlas=[],venues=[],profile={},onSelect=()=>{},onHome,serverNow}={}){
  const layout=createLayout(atlas,venues),all=layout.all;
  root.innerHTML=`<section class="outside-city outside-city-v2 outside-city-v3" aria-label="AbujaLife 3D Abuja city"><div class="outside-stage" tabindex="0" role="application" aria-label="3D Abuja. Drag to move, pinch or scroll to zoom, tap landmarks and advertising plots."></div><div class="outside-roof-labels"></div><header class="outside-heading"><span class="outside-eyebrow">ABUJA LIFE · CITY</span><h2>Your Abuja, alive.</h2><p>Recognisable places, real Abuja relationships, multiplayer destinations and ad land around the city.</p></header><div class="outside-tools"><button type="button" data-outside-action="overview">↗<span>Abuja</span></button><button type="button" data-outside-action="mode" aria-pressed="false">↻<span>Orbit</span></button><button type="button" data-outside-action="out">−</button><button type="button" data-outside-action="in">+</button>${onHome?'<button type="button" data-outside-action="home">⌂</button>':''}</div><div class="outside-directory"><label class="outside-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Find a landmark, district or ad plot" aria-label="Search Abuja" autocomplete="off"><button type="button" data-outside-action="directory" aria-expanded="false">☷</button></label><div class="outside-results" hidden></div></div><aside class="outside-selection" hidden></aside><p class="outside-hint">Drag to explore · pinch to zoom · tap a landmark or sky-blue ad plot</p><div class="outside-status" aria-live="polite"></div></section>`;
  const shell=root.querySelector('.outside-city'),stage=root.querySelector('.outside-stage'),labelsRoot=root.querySelector('.outside-roof-labels'),input=root.querySelector('.outside-search input'),results=root.querySelector('.outside-results'),selection=root.querySelector('.outside-selection'),status=root.querySelector('.outside-status');
  root.dataset.outsideLandmarks=String(layout.landmarks.length);root.dataset.outsideAdPlots=String(layout.adPlots.length);root.dataset.outsideLimits=JSON.stringify({minZoom:.55,maxZoom:12,width:layout.width,depth:layout.depth});
  const listeners=[],listen=(target,event,fn,opts)=>{target.addEventListener(event,fn,opts);listeners.push(()=>target.removeEventListener(event,fn,opts));};
  let renderer,model,camera,raf=0,disposed=false,last=0,elapsed=0,selected=null,directoryOpen=false,orbitMode=false,pinchBase=null,frame=0,dragDistance=0;
  const home=layout.districts.find(d=>d.id===(profile.home?.district||profile.district));const view={x:home?.x||0,z:home?.z||0,zoom:1.02,yaw:.42,elevation:.82},target={...view};const pointers=new Map(),size={width:1,height:1};
  const labels=[];for(const place of all){const b=document.createElement('button');b.type='button';b.className=`outside-roof-label ${place.adPlotId?'outside-ad-label':place.venueId?'outside-venue-label':place.key.startsWith('district:')?'outside-district-label':'outside-landmark-label'}`;b.textContent=place.adPlotId?`▦ ${place.name}`:(place.short||place.name);b.dataset.destinationKey=place.key;b.setAttribute('aria-label',`${place.name}. ${place.adPlotId?'Advertising plot. ':place.venueId?'Multiplayer destination. ':''}View destination`);labelsRoot.append(b);labels.push({place,button:b,point:new THREE.Vector3(place.x,Number(place.height||50)+18,place.z)});}
  const zoom=f=>{target.zoom=clamp(target.zoom*f,.55,12);};
  const overview=()=>{Object.assign(target,{x:-180,z:120,zoom:.62,yaw:.42,elevation:.82});selected=null;selection.hidden=true;status.textContent='Whole Abuja view';};
  const choose=place=>{selected=place;target.x=place.x;target.z=place.z;target.zoom=Math.max(place.adPlotId?3.4:4.4,target.zoom);const ad=!!place.adPlotId,venue=!!place.venueId;selection.hidden=false;selection.innerHTML=`<button type="button" class="outside-selection-close" data-outside-action="close" aria-label="Close">×</button><span>${ad?'ADVERTISING LAND':venue?'MULTIPLAYER DESTINATION':'ABUJA PLACE'}</span><h3>${esc(place.name)}</h3><p>${esc(ad?'A purchasable display plot outside the playable Abuja footprint.':place.blurb||place.vibe||place.description||'Explore this part of Abuja.')}</p>${venue?'<small class="outside-multiplayer-note">● People here share the same live destination.</small>':''}<button type="button" class="outside-travel" data-outside-action="${ad?'advertise':'travel'}">${ad?'Buy / manage this space':'Choose how to go'} <span>→</span></button>`;status.textContent=`${place.name} selected.`;input.value='';directoryOpen=false;results.hidden=true;shell.querySelector('[data-outside-action="directory"]').setAttribute('aria-expanded','false');};
  const renderDirectory=()=>{const q=input.value.trim().toLowerCase(),matches=all.filter(p=>`${p.name} ${p.short||''} ${p.category||''} ${p.id}`.toLowerCase().includes(q));results.hidden=!q&&!directoryOpen;results.innerHTML=matches.slice(0,80).map(p=>`<button type="button" data-outside-destination="${esc(p.key)}"><strong>${esc(p.name)}</strong><span>${esc(p.adPlotId?'Advertising land':p.multiplayer?'Multiplayer place':p.category||p.vibe||'Abuja')}</span></button>`).join('')||'<p>No match. Try a landmark, district or ad plot.</p>';};listen(input,'input',renderDirectory);
  listen(shell,'click',event=>{const node=event.target.closest('button');if(!node)return;const key=node.dataset.destinationKey||node.dataset.outsideDestination;if(key){const p=all.find(v=>v.key===key);if(p)choose(p);return;}switch(node.dataset.outsideAction){case'overview':overview();break;case'mode':orbitMode=!orbitMode;node.setAttribute('aria-pressed',String(orbitMode));node.querySelector('span').textContent=orbitMode?'Pan':'Orbit';break;case'in':zoom(1.38);break;case'out':zoom(1/1.38);break;case'directory':directoryOpen=!directoryOpen;node.setAttribute('aria-expanded',String(directoryOpen));renderDirectory();break;case'close':selected=null;selection.hidden=true;break;case'home':onHome?.();break;case'travel':if(selected?.destination?.districtId)onSelect(selected.destination);break;case'advertise':if(selected?.adPlotId)onSelect({adPlotId:selected.adPlotId});break;}});
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,globalThis.matchMedia?.('(pointer: coarse)').matches?1.25:1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.domElement.setAttribute('aria-hidden','true');stage.append(renderer.domElement);model=buildCity(layout);camera=new THREE.OrthographicCamera(-1,1,1,-1,1,18000);root.dataset.outsideRenderer='webgl-3d-v3';}catch{renderer?.dispose?.();renderer=null;labelsRoot.hidden=true;stage.innerHTML='<p class="outside-unavailable">3D is unavailable on this device. Use search to move around Abuja.</p>';directoryOpen=true;renderDirectory();}
  const viewport=()=>{const aspect=size.width/size.height,base=Math.max(layout.width,layout.depth*aspect)*1.03;return{width:base/view.zoom,height:base/aspect/view.zoom};};
  const constrain=()=>{target.x=clamp(target.x,-layout.width*.5,layout.width*.5);target.z=clamp(target.z,-layout.depth*.5,layout.depth*.5);target.elevation=clamp(target.elevation,.48,1.18);};
  const pan=(dx,dy)=>{const span=viewport(),sx=-dx*span.width/size.width,sz=-dy*span.height/size.height/Math.max(.45,Math.sin(view.elevation));target.x+=sx*Math.cos(view.yaw)+sz*Math.sin(view.yaw);target.z+=-sx*Math.sin(view.yaw)+sz*Math.cos(view.yaw);constrain();};
  const distance=pts=>Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
  listen(stage,'pointerdown',e=>{if(e.button>0)return;dragDistance=0;stage.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2)pinchBase={distance:distance([...pointers.values()]),zoom:target.zoom};});
  listen(stage,'pointermove',e=>{if(!pointers.has(e.pointerId))return;const before=[...pointers.values()],old=pointers.get(e.pointerId);dragDistance+=Math.hypot(e.clientX-old.x,e.clientY-old.y);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const after=[...pointers.values()];if(pinchBase?.distance>0)target.zoom=clamp(pinchBase.zoom*distance(after)/pinchBase.distance,.55,12);pan((after[0].x+after[1].x-before[0].x-before[1].x)/2,(after[0].y+after[1].y-before[0].y-before[1].y)/2);}else if(orbitMode||e.shiftKey){target.yaw-=(e.clientX-old.x)*.006;target.elevation+=(e.clientY-old.y)*.004;constrain();}else pan(e.clientX-old.x,e.clientY-old.y);});
  const release=e=>{pointers.delete(e.pointerId);pinchBase=null;};listen(stage,'pointerup',release);listen(stage,'pointercancel',release);listen(stage,'lostpointercapture',release);listen(stage,'wheel',e=>{e.preventDefault();zoom(Math.exp(-clamp(e.deltaY,-180,180)*.003));},{passive:false});
  listen(stage,'keydown',e=>{const keys={ArrowLeft:[48,0],ArrowRight:[-48,0],ArrowUp:[0,48],ArrowDown:[0,-48]};if(keys[e.key]){e.preventDefault();pan(...keys[e.key]);}else if(['+','=','-','_'].includes(e.key)){e.preventDefault();zoom(e.key==='-'||e.key==='_'?1/1.25:1.25);}else if(e.key==='Home'){e.preventDefault();overview();}});
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();listen(stage,'click',e=>{if(!renderer||dragDistance>8||e.target!==renderer.domElement)return;const r=renderer.domElement.getBoundingClientRect();mouse.x=((e.clientX-r.left)/r.width)*2-1;mouse.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(model.world.children,true).find(row=>row.object.userData?.destinationKey);if(hit){const p=all.find(v=>v.key===hit.object.userData.destinationKey);if(p)choose(p);}});
  const resize=()=>{const r=stage.getBoundingClientRect();size.width=Math.max(1,r.width);size.height=Math.max(1,r.height);renderer?.setSize(size.width,size.height,false);};const ro=globalThis.ResizeObserver?new ResizeObserver(resize):null;ro?.observe(stage);listen(globalThis,'resize',resize);resize();
  const projected=new THREE.Vector3();let lastPose='';const drawLabels=()=>{const occupied=[],ordered=[...labels].sort((a,b)=>(b.place===selected?1000:0)+(b.place.priority||0)-(a.place===selected?1000:0)-(a.place.priority||0));for(const label of ordered){projected.copy(label.point).project(camera);const x=(projected.x+1)*size.width/2,y=(1-projected.y)*size.height/2,p=label.place,isSelected=p===selected,major=Number(p.priority||0)>=82,ad=!!p.adPlotId,district=p.key.startsWith('district:');let eligible=isSelected||major||view.zoom>3&&!ad&&district||view.zoom<1.05&&ad;if(ad&&view.zoom>1.35&&!isSelected)eligible=false;if(district&&view.zoom<2&&!isSelected)eligible=false;const text=p.short||p.name,w=ad?76:Math.min(235,text.length*7.1+28),h=ad?30:36,rect={left:x-w/2,right:x+w/2,top:y-h,bottom:y};const blocked=occupied.some(r=>rect.left<r.right+6&&rect.right>r.left-6&&rect.top<r.bottom+5&&rect.bottom>r.top-5),underHeading=rect.left<265&&rect.top<150,underTools=rect.right>size.width-190&&rect.top<150;const visible=eligible&&projected.z>=-1&&projected.z<=1&&x>10&&x<size.width-10&&y>55&&y<size.height-54&&!underHeading&&!underTools&&(isSelected||!blocked);label.button.hidden=!visible;if(visible){occupied.push(rect);label.button.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;label.button.classList.toggle('is-selected',isSelected);}}};
  const serverBase=Number(serverNow)||Date.parse(serverNow)||Date.now(),offset=serverBase-Date.now();let clockMinute=-1;
  const tick=t=>{raf=0;if(disposed||document.hidden||!renderer)return;const dt=last?clamp((t-last)/1000,0,.06):0;last=t;elapsed+=dt;const ease=1-Math.exp(-11*dt);for(const k of['x','z','zoom','yaw','elevation'])view[k]+=(target[k]-view[k])*ease;const span=viewport();camera.left=-span.width/2;camera.right=span.width/2;camera.top=span.height/2;camera.bottom=-span.height/2;camera.updateProjectionMatrix();const radius=10000,flat=Math.cos(view.elevation)*radius;camera.position.set(view.x+Math.sin(view.yaw)*flat,Math.sin(view.elevation)*radius,view.z+Math.cos(view.yaw)*flat);camera.lookAt(view.x,0,view.z);camera.updateMatrixWorld();model.updateTraffic(elapsed);const now=Date.now()+offset,minute=Math.floor(now/60000);if(minute!==clockMinute){clockMinute=minute;const c=abujaTime(now);model.ambient.intensity=c.isNight?1.0:2.15;model.sun.intensity=c.isNight?.45:2.45;model.scene.background.set(c.isNight?'#243f4c':'#b7d4d0');model.scene.fog.color.copy(model.scene.background);}renderer.render(model.scene,camera);const pose=[size.width,size.height,view.x.toFixed(1),view.z.toFixed(1),view.zoom.toFixed(3),view.yaw.toFixed(3),view.elevation.toFixed(3),selected?.key].join(':');if(pose!==lastPose){drawLabels();lastPose=pose;}if(frame%12===0){root.dataset.outsideCamera=JSON.stringify(view);root.dataset.outsideDrawCalls=String(renderer.info.render.calls);root.dataset.outsideTriangles=String(renderer.info.render.triangles);}frame++;raf=requestAnimationFrame(tick);};
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else if(!raf&&renderer&&!disposed)raf=requestAnimationFrame(tick);};listen(document,'visibilitychange',visibility);if(renderer)visibility();
  const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);ro?.disconnect();listeners.forEach(fn=>fn());model?.dispose();renderer?.dispose();renderer?.forceContextLoss?.();delete root.dataset.outsideRenderer;root.replaceChildren();};cleanup.focusDistrict=id=>{const p=layout.districts.find(d=>d.id===id)||layout.landmarks.find(d=>d.districtId===id);if(p)choose(p);};cleanup.overview=overview;return cleanup;
}

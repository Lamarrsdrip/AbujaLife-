import * as THREE from './vendor/three.module.js';
import { abujaTime } from '../src/shared/simulation.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CENTER={lat:9.055,lon:7.47};
const SCALE={lat:22000,lon:15000};
const toWorld=({lat,lon})=>({x:(lon-CENTER.lon)*SCALE.lon,z:-(lat-CENTER.lat)*SCALE.lat});
const deterministic=(text='')=>{let n=2166136261;for(const c of text){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return Math.abs(n>>>0);};

// Geographic anchors are used for relative placement only. AbujaLife keeps the
// scene intentionally stylised and playable rather than claiming survey accuracy.
const CORE_DISTRICTS={
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
  {id:'airport-hub',name:'Nnamdi Azikiwe International Airport',short:'Abuja Airport',lat:9.00657,lon:7.26419,districtId:'lugbe',builder:'airport',priority:100,blurb:'Arrivals, departures and an Airport Road meetup.',multiplayer:true},
  {id:'city-gate-plaza',name:'Abuja City Gate',lat:9.03570,lon:7.44862,districtId:'kukwaba',builder:'cityGate',priority:100,blurb:'The ceremonial entrance to Abuja and a public meetup/photo stop.',multiplayer:true},
  {id:'national-stadium-hub',name:'Moshood Abiola National Stadium',short:'National Stadium',lat:9.03789,lon:7.45339,districtId:'kukwaba',builder:'stadium',priority:96,blurb:'Sport, training and match-day social play.',multiplayer:true},
  {id:'magicland',name:'Magicland Amusement Park',short:'Magicland',lat:9.04280,lon:7.45184,districtId:'kukwaba',builder:'magicland',priority:95,blurb:'Rides, arcade play and group hangouts.',multiplayer:true},
  {id:'wtc-abuja-hub',name:'World Trade Centre Abuja',short:'WTC Abuja',lat:9.04960,lon:7.47326,districtId:'central-area',builder:'wtc',priority:100,blurb:'CBD towers for business networking and skyline social play.',multiplayer:true},
  {id:'cbn-experience',name:'Central Bank of Nigeria',short:'CBN',lat:9.05093,lon:7.49307,districtId:'central-area',builder:'cbn',priority:97,blurb:'Finance, economic history and career activities.',multiplayer:true},
  {id:'national-assembly-hub',name:'National Assembly Complex',short:'National Assembly',lat:9.06818,lon:7.51230,districtId:'central-area',builder:'assembly',priority:100,blurb:'A respectful civic plaza and social landmark.',multiplayer:true},
  {id:'eagle-square-hub',name:'Eagle Square',lat:9.0615,lon:7.4922,districtId:'central-area',builder:'eagle',priority:90,blurb:'Public events, meetups and city moments.',multiplayer:true},
  {id:'national-mosque-hub',name:'Abuja National Mosque',short:'National Mosque',lat:9.0602,lon:7.4898,districtId:'central-area',builder:'mosque',priority:94,blurb:'Prayer, reflection and community.',multiplayer:true},
  {id:'national-christian-centre-hub',name:'National Christian Centre',short:'National Christian Centre',lat:9.0510,lon:7.4905,districtId:'central-area',builder:'church',priority:90,blurb:'Prayer, reflection and community.',multiplayer:true},
  {id:'transcorp-hilton-hub',name:'Transcorp Hilton Abuja',short:'Transcorp Hilton',lat:9.07444,lon:7.49510,districtId:'maitama',builder:'transcorp',priority:96,blurb:'Hotel, pool, dining, meetings and lobby meetups.',multiplayer:true},
  {id:'millennium-park-hub',name:'Millennium Park',lat:9.07070,lon:7.49939,districtId:'maitama',builder:'millennium',priority:93,blurb:'Walks, picnics and outdoor multiplayer hangouts.',multiplayer:true},
  {id:'aso-rock-view',name:'Aso Rock Viewpoint',short:'Aso Rock',lat:9.06982,lon:7.52083,districtId:'central-area',builder:'aso',priority:98,blurb:'A city-defining viewpoint for walks and meetups.',multiplayer:true},
  {id:'farm-city',name:'Farm City Abuja',short:'Farm City',lat:9.0800,lon:7.4708,districtId:'wuse-ii-a07',builder:'farmCity',priority:88,blurb:'Food, arcade and Abuja hangout energy.',multiplayer:true},
  {id:'jabi-lake',name:'Jabi Lake',lat:9.0750,lon:7.4170,districtId:'jabi',builder:'jabiLake',priority:84,blurb:'Lakeside walks, picnic and social space.',multiplayer:true},
  {id:'jabi-lake-mall',name:'Jabi Lake Mall',lat:9.0760,lon:7.4210,districtId:'jabi',builder:'mall',priority:80,blurb:'Shopping landmark beside Jabi Lake.'},
  {id:'international-conference-centre',name:'International Conference Centre',short:'ICC Abuja',lat:9.0618,lon:7.4862,districtId:'central-area',builder:'conference',priority:78,blurb:'Conference and event landmark in the city core.'}
];

const SECONDARY_ROADS=[
  ['airport-hub','city-gate-plaza'],['city-gate-plaza','national-stadium-hub'],['national-stadium-hub','magicland'],
  ['magicland','wtc-abuja-hub'],['wtc-abuja-hub','cbn-experience'],['cbn-experience','national-mosque-hub'],
  ['national-mosque-hub','national-assembly-hub'],['national-assembly-hub','aso-rock-view'],['cbn-experience','transcorp-hilton-hub'],
  ['transcorp-hilton-hub','millennium-park-hub'],['wtc-abuja-hub','jabi-lake'],['jabi-lake','farm-city']
];

function makeMaterial(color,{metalness=0,roughness=.78,transparent=false,opacity=1}={}){
  return new THREE.MeshStandardMaterial({color,metalness,roughness,transparent,opacity});
}
function addBox(group,color,x,y,z,w,h,d,rotation=0,opts){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),makeMaterial(color,opts));mesh.position.set(x,y,z);mesh.rotation.y=rotation;group.add(mesh);return mesh;
}
function addCylinder(group,color,x,y,z,r,h,segments=20,opts){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),makeMaterial(color,opts));mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
function addSphere(group,color,x,y,z,rx,ry=rx,rz=rx,opts){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),makeMaterial(color,opts));mesh.scale.set(rx,ry,rz);mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
function addTorus(group,color,x,y,z,r,tube,rotationX=Math.PI/2,rotationZ=0){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,10,36),makeMaterial(color,{metalness:.05,roughness:.58}));mesh.position.set(x,y,z);mesh.rotation.x=rotationX;mesh.rotation.z=rotationZ;group.add(mesh);return mesh;
}
function tree(group,x,z,size=1,palm=false){
  addCylinder(group,'#816b4f',x,14*size,z,2.7*size,28*size,10);
  if(palm){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;addSphere(group,'#4f805f',x+Math.cos(a)*9*size,31*size,z+Math.sin(a)*9*size,12*size,3.8*size,5*size);}}
  else {addSphere(group,'#4f7755',x,34*size,z,14*size,15*size,14*size);addSphere(group,'#6f915f',x-5*size,43*size,z+2*size,9*size,8*size,9*size);}
}
function road(group,a,b,width=34){
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;
  addBox(group,'#43585a',mx,2,mz,width,4,len,angle);
  addBox(group,'#d7c99d',mx,4,mz,2,1,len*.92,angle);
  addBox(group,'#b8c5b2',mx+Math.cos(angle)*width*.62,2.5,mz-Math.sin(angle)*width*.62,9,3,len,angle);
  addBox(group,'#b8c5b2',mx-Math.cos(angle)*width*.62,2.5,mz+Math.sin(angle)*width*.62,9,3,len,angle);
}
function pad(group,x,z,w=180,d=145,color='#9daf8e'){addBox(group,color,x,1,z,w,2,d);}

function landmarkModel(group,item){
  const {x,z,builder}=item;const g=new THREE.Group();g.position.set(x,0,z);group.add(g);
  const b=(color,dx,y,dz,w,h,d,r=0,opts)=>addBox(g,color,dx,y,dz,w,h,d,r,opts);
  const c=(color,dx,y,dz,r,h,s=20,opts)=>addCylinder(g,color,dx,y,dz,r,h,s,opts);
  const s=(color,dx,y,dz,rx,ry,rz,opts)=>addSphere(g,color,dx,y,dz,rx,ry,rz,opts);
  pad(g,0,0,210,160,'#9eaf8e');
  if(builder==='airport'){
    b('#dfe7e2',0,28,0,205,48,74);b('#79aab5',0,31,38,186,32,3,0,{metalness:.16,roughness:.35});
    b('#d7ded8',-70,58,-6,55,22,58);c('#d9ddd6',78,54,-20,11,96);b('#5c7d83',78,104,-20,34,12,34);
    b('#3f5256',0,2,96,320,3,48);for(let i=-3;i<=3;i++)b('#f1e6bf',i*39,4,96,21,1.5,2);
    item.height=128;
  } else if(builder==='cityGate'){
    b('#dfe1d7',-34,54,0,17,104,26);b('#dfe1d7',34,54,0,17,104,26);b('#eff0e7',0,49,1,84,10,20);
    b('#3c7d58',0,65,3,28,16,5);b('#355d53',0,9,-48,132,4,16);for(const side of[-1,1])tree(g,side*68,50,.9,true);item.height=122;
  } else if(builder==='stadium'){
    c('#d9d7cb',0,20,0,82,35,40);c('#536b62',0,37,0,66,13,40);c('#6e9c69',0,45,0,46,4,40);b('#d7c9a5',0,50,0,34,2,78);item.height=92;
  } else if(builder==='magicland'){
    b('#d7b27d',-54,24,-28,67,42,48);const cx=42,cz=-18;c('#7d776b',cx,35,cz,3,70);addTorus(g,'#c4896f',cx,48,cz,44,3,0,Math.PI/2);
    for(let i=0;i<12;i++){const a=i*Math.PI*2/12;s(['#d7b16d','#6e9da0','#b97569','#7d739b'][i%4],cx+Math.cos(a)*44,48+Math.sin(a)*44,cz,6,6,6);}
    for(const side of[-1,1])tree(g,side*78,52,.9,true);item.height=105;
  } else if(builder==='wtc'){
    b('#4e6f7b',-34,92,0,64,176,62,0,{metalness:.28,roughness:.3});b('#d8caa7',-34,184,0,46,8,50);
    b('#6f8f98',46,105,2,56,202,58,0,{metalness:.2,roughness:.32});for(let y=18;y<190;y+=16)b('#dbc89a',46,y,34,72,3,9);
    b('#c8cabd',4,5,0,178,8,105);item.height=214;
  } else if(builder==='cbn'){
    b('#d2c8af',0,90,0,96,176,76);b('#70979a',0,94,39,72,125,3,0,{metalness:.14,roughness:.36});
    b('#b89461',0,16,52,122,14,24);for(const side of[-1,1])b('#e3ded0',side*52,35,37,9,60,9);item.height=194;
  } else if(builder==='assembly'){
    b('#efefe8',0,24,8,105,42,58);b('#e8eae3',-76,21,8,58,35,48);b('#e8eae3',76,21,8,58,35,48);
    c('#e8e8df',0,48,8,35,24,28);s('#2e8b57',0,63,8,32,20,32);b('#d5c8a4',0,4,75,178,3,34);item.height=92;
  } else if(builder==='eagle'){
    b('#d8d3be',0,4,0,190,7,136);b('#b8aa84',0,8,0,120,5,82);b('#6f8276',0,20,-30,80,23,28);
    for(const side of[-1,1]){c('#667d76',side*58,37,30,2,62);b(side<0?'#2f8557':'#f0efe9',side*54,53,30,14,24,2);}item.height=82;
  } else if(builder==='mosque'){
    b('#ddd6bd',0,31,0,112,58,80);s('#c7a65d',0,76,0,40,27,40);for(const side of[-1,1]){c('#e5dfca',side*58,69,-28,6,132);s('#c2a05a',side*58,139,-28,10,14,10);}item.height=160;
  } else if(builder==='church'){
    b('#ddd2b8',0,40,0,108,72,78);b('#e6d6a4',0,112,0,8,72,8);b('#e6d6a4',0,129,0,46,8,8);item.height=145;
  } else if(builder==='transcorp'){
    b('#c8bea8',0,74,-8,164,136,66);for(let y=18;y<135;y+=17)b('#7fa5a7',0,y,26,145,7,3,0,{metalness:.08,roughness:.4});
    b('#e0d8c2',54,4,60,90,3,44);b('#6ea5aa',54,7,60,72,4,31);for(let i=0;i<7;i++)tree(g,-78+i*26,65,.7,true);item.height=150;
  } else if(builder==='millennium'){
    pad(g,0,0,230,175,'#73966d');b('#d9cfad',0,4,0,22,3,165);b('#d9cfad',0,4,0,210,3,17);c('#d8d1b8',0,8,0,25,5);c('#70a9ad',0,12,0,20,4);s('#d7eee2',0,21,0,5,13,5);
    for(let i=0;i<12;i++){const a=i*Math.PI*2/12;tree(g,Math.cos(a)*88,Math.sin(a)*64,.8,i%4===0);}item.height=54;
  } else if(builder==='aso'){
    pad(g,0,18,215,120,'#88987f');const rocks=[[-55,45,42,73,48],[-18,59,62,99,66],[33,51,54,84,58],[70,38,38,62,45]];for(const [dx,y,rx,ry,rz] of rocks)s('#90958a',dx,y,-28,rx,ry,rz);item.height=128;
  } else if(builder==='farmCity'){
    b('#c7b38e',0,30,-12,140,52,68);b('#8a7557',0,7,52,138,6,40);for(let i=0;i<5;i++)b('#e0d2ad',-52+i*26,14,51,18,5,18);for(const side of[-1,1])tree(g,side*72,54,.8,true);item.height=72;
  } else if(builder==='jabiLake'){
    pad(g,0,0,250,180,'#809e74');s('#5a9fac',-5,5,0,105,3,66);b('#d4c29d',50,7,46,88,4,14);for(let i=0;i<8;i++)tree(g,-96+i*27,76,.8,true);item.height=45;
  } else if(builder==='mall'){
    b('#d8d4c8',0,35,0,150,64,88);b('#6c919a',0,38,45,128,38,3,0,{metalness:.13,roughness:.38});b('#b9905e',0,17,49,90,8,8);item.height=78;
  } else if(builder==='conference'){
    b('#d4c5aa',0,30,0,134,52,78);b('#718f8e',0,42,41,92,22,3);b('#d9a967',0,59,0,82,8,54);item.height=75;
  } else {
    b('#d2c8ad',0,30,0,116,54,78);b('#75969a',0,35,40,80,22,3);item.height=72;
  }
  return g;
}

function createLayout(atlas=[],venues=[]){
  const venueMap=new Map(venues.map(v=>[v.id,v]));
  const landmarks=LANDMARKS.map(source=>{const p=toWorld(source),venue=venueMap.get(source.id);return {...source,...p,venueId:venue?.id||null,key:`landmark:${source.id}`,destination:{districtId:source.districtId,...(venue?{venueId:venue.id}:{})}};});
  const landmarkById=new Map(landmarks.map(p=>[p.id,p]));
  const districts=atlas.map((place,index)=>{
    const anchor=place.coordinates||CORE_DISTRICTS[place.id];let pos;
    if(anchor)pos=toWorld(anchor);else {const hash=deterministic(place.id),ring=1700+(hash%1700),a=(hash%6283)/1000;pos={x:Math.cos(a)*ring,z:Math.sin(a)*ring};}
    return {...place,...pos,key:`district:${place.id}`,destination:{districtId:place.id},priority:25};
  });
  const adPlots=[];const rows=[
    {side:'south',count:14,start:-2500,step:380,z:2100},{side:'north',count:12,start:-2100,step:390,z:-1850},
    {side:'east',count:9,start:-1450,step:360,x:3050,vertical:true},{side:'west',count:9,start:-1450,step:360,x:-3500,vertical:true}
  ];
  let n=1;for(const row of rows)for(let i=0;i<row.count;i++,n++){
    const id=`plot-${String(n).padStart(2,'0')}`,x=row.vertical?row.x:row.start+i*row.step,z=row.vertical?row.start+i*row.step:row.z;
    adPlots.push({id,key:`ad:${id}`,adPlotId:id,name:`Ad plot ${String(n).padStart(2,'0')}`,x,z,height:8,priority:10,category:'Advertising land',destination:{adPlotId:id}});
  }
  const width=7600,depth=5000;
  return {width,depth,landmarks,districts,adPlots,landmarkById,all:[...landmarks,...districts,...adPlots]};
}

function buildCity(layout){
  const scene=new THREE.Scene(),world=new THREE.Group();scene.add(world);scene.background=new THREE.Color('#b7d4d0');scene.fog=new THREE.Fog('#b7d4d0',6500,10500);
  addBox(world,'#afc4ab',0,-13,0,layout.width,22,layout.depth);
  addBox(world,'#93ad8a',0,-1,0,layout.width-520,5,layout.depth-520);
  // Major road relationships are drawn from the real landmark order instead of a generic city grid.
  for(const [from,to] of SECONDARY_ROADS){const a=layout.landmarkById.get(from),b=layout.landmarkById.get(to);if(a&&b)road(world,a,b,42);}
  // Recognisable district boulevards around the city core.
  const coreIds=['central-area','wuse-i','wuse-ii-a07','maitama','asokoro','jabi','utako','wuye','garki-i','garki-ii','mabushi','gwarinpa-i','lugbe','kukwaba'];
  const districtMap=new Map(layout.districts.map(p=>[p.id,p]));
  for(let i=0;i<coreIds.length;i++)for(let j=i+1;j<coreIds.length;j++){
    const a=districtMap.get(coreIds[i]),b=districtMap.get(coreIds[j]);if(!a||!b)continue;const d=Math.hypot(a.x-b.x,a.z-b.z);if(d<720)road(world,a,b,24);
  }
  // Low-detail neighbourhood massing gives the city scale without making generic blocks the hero.
  for(const id of coreIds){const p=districtMap.get(id);if(!p)continue;pad(world,p.x,p.z,260,190,id==='central-area'?'#9fb494':'#98af8d');
    const h= id==='central-area'?74:id==='maitama'||id==='asokoro'?52:38;
    for(let k=0;k<4;k++){const angle=k*Math.PI/2+.6,dx=Math.cos(angle)*78,dz=Math.sin(angle)*58;addBox(world,k%2?'#d9d0ba':'#c9c6b4',p.x+dx,h/2+4,p.z+dz,54,h+(k%2)*18,42,angle*.15);}
    for(let k=0;k<5;k++)tree(world,p.x-105+k*52,p.z+88,.62,k%4===0);
  }
  for(const landmark of layout.landmarks)landmarkModel(world,landmark);
  // Advertising is deliberately outside the city footprint: open, pale-blue purchasable land.
  const liveAds=new Map((globalThis.__ABJ_ADS__?.spaces||[]).map(space=>[space.id,space]));
  for(const plot of layout.adPlots){const occupied=liveAds.get(plot.adPlotId)?.available===false;
    addBox(world,occupied?'#b9d8d8':'#c7e6e8',plot.x,2.5,plot.z,310,4,235);addBox(world,'#eff7f5',plot.x,5,plot.z,280,2,205);
    if(occupied)addBox(world,'#6b8f91',plot.x,18,plot.z-77,225,26,12);
  }
  const ambient=new THREE.HemisphereLight('#fff1d7','#4d6b60',2.15);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff2d4',2.4);sun.position.set(-2400,5000,2100);scene.add(sun);
  const rim=new THREE.DirectionalLight('#d5eff2',.7);rim.position.set(2400,1800,-2400);scene.add(rim);
  return {scene,world,ambient,sun,rim,dispose(){scene.traverse(object=>{object.geometry?.dispose?.();const mats=object.material?Array.isArray(object.material)?object.material:[object.material]:[];for(const mat of mats)mat?.dispose?.();});}};
}

export function renderOutside(root,{atlas=[],venues=[],profile={},onSelect=()=>{},onHome,serverNow}={}){
  const layout=createLayout(atlas,venues),all=layout.all;
  root.innerHTML=`<section class="outside-city outside-city-v2" aria-label="AbujaLife 3D Abuja city"><div class="outside-stage" tabindex="0" role="application" aria-label="3D Abuja. Drag to move, pinch or scroll to zoom, or orbit the city."></div><div class="outside-roof-labels"></div><header class="outside-heading"><span class="outside-eyebrow">ABUJA LIFE · CITY</span><h2>Your Abuja, alive.</h2><p>Landmarks where you can actually meet, play and move around the capital.</p></header><div class="outside-tools"><button type="button" data-outside-action="overview" aria-label="Show all Abuja">↗<span>Abuja</span></button><button type="button" data-outside-action="mode" aria-pressed="false">↻<span>Orbit</span></button><button type="button" data-outside-action="out" aria-label="Zoom out">−</button><button type="button" data-outside-action="in" aria-label="Zoom in">+</button>${onHome?'<button type="button" data-outside-action="home" aria-label="Go home">⌂</button>':''}</div><div class="outside-directory"><label class="outside-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Find a landmark, district or ad plot" aria-label="Search Abuja" autocomplete="off"><button type="button" data-outside-action="directory" aria-label="Browse Abuja" aria-expanded="false">☷</button></label><div class="outside-results" hidden></div></div><aside class="outside-selection" hidden></aside><p class="outside-hint">Drag to explore · pinch to zoom · tap a landmark to go there</p><div class="outside-status" aria-live="polite"></div></section>`;
  const shell=root.querySelector('.outside-city'),stage=root.querySelector('.outside-stage'),labelsRoot=root.querySelector('.outside-roof-labels'),input=root.querySelector('.outside-search input'),results=root.querySelector('.outside-results'),selection=root.querySelector('.outside-selection'),status=root.querySelector('.outside-status');
  root.dataset.outsideLandmarks=String(layout.landmarks.length);root.dataset.outsideAdPlots=String(layout.adPlots.length);root.dataset.outsideLimits=JSON.stringify({minZoom:.72,maxZoom:10,width:layout.width,depth:layout.depth});
  const listeners=[],listen=(target,event,fn,options)=>{target.addEventListener(event,fn,options);listeners.push(()=>target.removeEventListener(event,fn,options));};
  let renderer,model,camera,raf=0,disposed=false,last=0,selected=null,directoryOpen=false,orbitMode=false,pinchBase=null,frame=0;
  const homeDistrict=layout.districts.find(d=>d.id===(profile.home?.district||profile.district));
  const view={x:homeDistrict?.x||0,z:homeDistrict?.z||0,zoom:1.08,yaw:.42,elevation:.82},target={...view};
  const pointers=new Map(),size={width:1,height:1};
  const liveAds=new Map((globalThis.__ABJ_ADS__?.spaces||[]).map(space=>[space.id,space]));
  const labels=[];
  for(const place of all){
    if(place.adPlotId&&liveAds.get(place.adPlotId)?.available!==false&&place.adPlotId!=='plot-01'&&place.adPlotId!=='plot-02')continue;
    const button=document.createElement('button');button.type='button';button.className=`outside-roof-label ${place.adPlotId?'outside-ad-label':place.venueId?'outside-venue-label':place.id?.includes?.('area')?'outside-district-label':'outside-landmark-label'}`;
    button.textContent=place.adPlotId?`▦ ${place.name}`:(place.short||place.name);button.dataset.destinationKey=place.key;button.setAttribute('aria-label',`${place.name}. ${place.multiplayer?'Multiplayer destination. ':''}View destination`);labelsRoot.append(button);
    labels.push({place,button,point:new THREE.Vector3(place.x,Number(place.height||48)+18,place.z)});
  }
  const zoom=factor=>{target.zoom=clamp(target.zoom*factor,.72,10);};
  const overview=()=>{Object.assign(target,{x:0,z:80,zoom:.78,yaw:.42,elevation:.82});selected=null;selection.hidden=true;status.textContent='Whole Abuja view';};
  const choose=place=>{
    selected=place;target.x=place.x;target.z=place.z;target.zoom=Math.max(place.adPlotId?3:4.2,target.zoom);
    const ad=Boolean(place.adPlotId),venue=Boolean(place.venueId);
    selection.hidden=false;selection.innerHTML=`<button type="button" class="outside-selection-close" data-outside-action="close" aria-label="Close">×</button><span>${ad?'ADVERTISING LAND':venue?'MULTIPLAYER DESTINATION':'ABUJA LANDMARK'}</span><h3>${esc(place.name)}</h3><p>${esc(ad?'A purchasable display plot outside the playable city footprint.':place.blurb||place.vibe||place.description||'Explore this part of Abuja.')}</p>${venue?'<small class="outside-multiplayer-note">● Residents here share the same destination.</small>':''}<button type="button" class="outside-travel" data-outside-action="${ad?'advertise':'travel'}">${ad?'Buy / manage this space':'Choose how to go'} <span aria-hidden="true">→</span></button>`;
    status.textContent=`${place.name} selected.`;input.value='';directoryOpen=false;results.hidden=true;shell.querySelector('[data-outside-action="directory"]').setAttribute('aria-expanded','false');
  };
  const renderDirectory=()=>{const query=input.value.trim().toLowerCase(),matches=all.filter(p=>`${p.name} ${p.short||''} ${p.category||''} ${p.id}`.toLowerCase().includes(query));results.hidden=!query&&!directoryOpen;results.innerHTML=matches.slice(0,60).map(p=>`<button type="button" data-outside-destination="${esc(p.key)}"><strong>${esc(p.name)}</strong><span>${esc(p.adPlotId?'Advertising land':p.multiplayer?'Multiplayer place':p.category||p.vibe||'Abuja')}</span></button>`).join('')||'<p>No match. Try a landmark or district.</p>';};
  listen(input,'input',renderDirectory);
  listen(shell,'click',event=>{const node=event.target.closest('button');if(!node)return;const key=node.dataset.destinationKey||node.dataset.outsideDestination;if(key){const place=all.find(p=>p.key===key);if(place)choose(place);return;}switch(node.dataset.outsideAction){case'overview':overview();break;case'mode':orbitMode=!orbitMode;node.setAttribute('aria-pressed',String(orbitMode));node.querySelector('span').textContent=orbitMode?'Pan':'Orbit';break;case'in':zoom(1.38);break;case'out':zoom(1/1.38);break;case'directory':directoryOpen=!directoryOpen;node.setAttribute('aria-expanded',String(directoryOpen));renderDirectory();break;case'close':selected=null;selection.hidden=true;break;case'home':onHome?.();break;case'travel':if(selected?.destination?.districtId)onSelect(selected.destination);break;case'advertise':if(selected?.adPlotId)onSelect({adPlotId:selected.adPlotId});break;}});
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,matchMedia?.('(pointer: coarse)').matches?1.25:1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.domElement.setAttribute('aria-hidden','true');stage.append(renderer.domElement);model=buildCity(layout);camera=new THREE.OrthographicCamera(-1,1,1,-1,1,16000);root.dataset.outsideRenderer='webgl-3d-v2';}
  catch{renderer?.dispose?.();renderer=null;labelsRoot.hidden=true;stage.innerHTML='<p class="outside-unavailable">3D is unavailable on this device. Use the destination search to move around Abuja.</p>';directoryOpen=true;renderDirectory();}
  const viewport=()=>{const aspect=size.width/size.height,base=Math.max(layout.width,layout.depth*aspect)*1.04;return{width:base/view.zoom,height:base/aspect/view.zoom};};
  const constrain=()=>{target.x=clamp(target.x,-layout.width*.48,layout.width*.48);target.z=clamp(target.z,-layout.depth*.48,layout.depth*.48);target.elevation=clamp(target.elevation,.48,1.18);};
  const pan=(dx,dy)=>{const span=viewport(),sx=-dx*span.width/size.width,sz=-dy*span.height/size.height/Math.max(.45,Math.sin(view.elevation));target.x+=sx*Math.cos(view.yaw)+sz*Math.sin(view.yaw);target.z+=-sx*Math.sin(view.yaw)+sz*Math.cos(view.yaw);constrain();};
  const distance=points=>Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
  listen(stage,'pointerdown',event=>{if(event.button>0)return;stage.setPointerCapture?.(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2)pinchBase={distance:distance([...pointers.values()]),zoom:target.zoom};});
  listen(stage,'pointermove',event=>{if(!pointers.has(event.pointerId))return;const before=[...pointers.values()],old=pointers.get(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2){const after=[...pointers.values()];if(pinchBase?.distance>0)target.zoom=clamp(pinchBase.zoom*distance(after)/pinchBase.distance,.72,10);pan((after[0].x+after[1].x-before[0].x-before[1].x)/2,(after[0].y+after[1].y-before[0].y-before[1].y)/2);}else if(orbitMode||event.shiftKey){target.yaw-=(event.clientX-old.x)*.006;target.elevation+=(event.clientY-old.y)*.004;constrain();}else pan(event.clientX-old.x,event.clientY-old.y);});
  const release=event=>{pointers.delete(event.pointerId);pinchBase=null;};listen(stage,'pointerup',release);listen(stage,'pointercancel',release);listen(stage,'lostpointercapture',release);
  listen(stage,'wheel',event=>{event.preventDefault();zoom(Math.exp(-clamp(event.deltaY,-180,180)*.003));},{passive:false});
  listen(stage,'keydown',event=>{const keys={ArrowLeft:[48,0],ArrowRight:[-48,0],ArrowUp:[0,48],ArrowDown:[0,-48]};if(keys[event.key]){event.preventDefault();pan(...keys[event.key]);}else if(['+','=','-','_'].includes(event.key)){event.preventDefault();zoom(event.key==='-'||event.key==='_'?1/1.25:1.25);}else if(event.key==='Home'){event.preventDefault();overview();}});
  const resize=()=>{const rect=stage.getBoundingClientRect();size.width=Math.max(1,rect.width);size.height=Math.max(1,rect.height);renderer?.setSize(size.width,size.height,false);};const ro=globalThis.ResizeObserver?new ResizeObserver(resize):null;ro?.observe(stage);listen(globalThis,'resize',resize);resize();
  const projected=new THREE.Vector3();let lastPose='';
  const drawLabels=()=>{const occupied=[];const ordered=[...labels].sort((a,b)=>(b.place===selected?1000:0)+(b.place.priority||0)-(a.place===selected?1000:0)-(a.place.priority||0));for(const label of ordered){projected.copy(label.point).project(camera);const x=(projected.x+1)*size.width/2,y=(1-projected.y)*size.height/2,place=label.place,isSelected=place===selected;const major=Number(place.priority||0)>=78,ad=Boolean(place.adPlotId),district=place.key?.startsWith('district:');let eligible=isSelected||major||view.zoom>3.1&&!ad&&district||view.zoom<1.25&&ad;if(ad&&view.zoom>2.4&&!isSelected)eligible=false;if(district&&view.zoom<2.1&&!isSelected)eligible=false;const text=place.short||place.name,w=ad?92:Math.min(235,text.length*7.2+28),h=ad?35:36,rect={left:x-w/2,right:x+w/2,top:y-h,bottom:y};const underHeading=rect.left<260&&rect.top<150,underTools=rect.right>size.width-190&&rect.top<145,overlap=occupied.some(r=>rect.left<r.right+7&&rect.right>r.left-7&&rect.top<r.bottom+5&&rect.bottom>r.top-5);const visible=eligible&&projected.z>=-1&&projected.z<=1&&x>12&&x<size.width-12&&y>58&&y<size.height-54&&!underHeading&&!underTools&&(isSelected||!overlap);label.button.hidden=!visible;if(visible){occupied.push(rect);label.button.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;label.button.classList.toggle('is-selected',isSelected);}}};
  let clockMinute=-1;
  const tick=time=>{raf=0;if(disposed||document.hidden||!renderer)return;const dt=last?clamp((time-last)/1000,0,.06):0;last=time;const ease=1-Math.exp(-11*dt);for(const key of['x','z','zoom','yaw','elevation'])view[key]+=(target[key]-view[key])*ease;const span=viewport();camera.left=-span.width/2;camera.right=span.width/2;camera.top=span.height/2;camera.bottom=-span.height/2;camera.updateProjectionMatrix();const radius=9000,flat=Math.cos(view.elevation)*radius;camera.position.set(view.x+Math.sin(view.yaw)*flat,Math.sin(view.elevation)*radius,view.z+Math.cos(view.yaw)*flat);camera.lookAt(view.x,0,view.z);camera.updateMatrixWorld();const now=Number(serverNow)||Date.now(),minute=Math.floor(now/60000);if(minute!==clockMinute){clockMinute=minute;const c=abujaTime(now);model.ambient.intensity=c.isNight?1.0:2.15;model.sun.intensity=c.isNight?.45:2.4;model.scene.background.set(c.isNight?'#243f4c':'#b7d4d0');model.scene.fog.color.copy(model.scene.background);}renderer.render(model.scene,camera);const pose=[size.width,size.height,view.x.toFixed(1),view.z.toFixed(1),view.zoom.toFixed(3),view.yaw.toFixed(3),view.elevation.toFixed(3),selected?.key].join(':');if(pose!==lastPose){drawLabels();lastPose=pose;}if(frame%12===0){root.dataset.outsideCamera=JSON.stringify(view);root.dataset.outsideDrawCalls=String(renderer.info.render.calls);root.dataset.outsideTriangles=String(renderer.info.render.triangles);}frame++;raf=requestAnimationFrame(tick);};
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else if(!raf&&renderer&&!disposed)raf=requestAnimationFrame(tick);};listen(document,'visibilitychange',visibility);if(renderer)visibility();
  const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);ro?.disconnect();listeners.forEach(fn=>fn());model?.dispose();renderer?.dispose();renderer?.forceContextLoss?.();delete root.dataset.outsideRenderer;root.replaceChildren();};
  cleanup.focusDistrict=id=>{const place=layout.districts.find(d=>d.id===id)||layout.landmarks.find(d=>d.districtId===id);if(place)choose(place);};cleanup.overview=overview;return cleanup;
}

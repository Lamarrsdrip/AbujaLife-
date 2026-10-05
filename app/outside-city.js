// Original, locally authored game city. Positions describe scenery, not geography.
import * as THREE from './vendor/three.module.js';
import { buildThreeEnvironment, batchRigidMeshes } from './world-3d-scenes.js';
import { abujaTime } from '../src/shared/simulation.mjs';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preferredDistricts = {
  restaurant:'garki-i', hotel:'utako', gym:'gwarinpa-i', cinema:'central-area', grocery:'garki-ii',
  park:'maitama', dealership:'gudu', 'estate-office':'wuye', 'furniture-store':'karmo',
  cafe:'asokoro', salon:'kado', mosque:'central-area', church:'durumi', club:'wuse-ii-a07',
  'games-lounge':'mabushi'
};
const icons = {restaurant:'♨',hotel:'✦',gym:'↗',cinema:'▷',park:'♧','jabi-lake':'≈',dealership:'↔',
  'estate-office':'⌂','furniture-store':'▱',banex:'⌘',cafe:'☕',salon:'✂',mosque:'☾',church:'✝',
  club:'♫','club-cage':'♫','magic-city':'♫','bear-barn':'♫','games-lounge':'⚄',grocery:'✿'};

/** Every atlas identity occurs once; each venue has one valid representative address. */
export function createOutsideLayout(atlas = [], venues = []) {
  const unique = values => [...new Map(values.filter(v => v?.id).map(v => [v.id,v])).values()];
  const places = unique(atlas), columns = Math.max(1, Math.ceil(Math.sqrt(places.length * 1.25)));
  const rows = Math.max(1, Math.ceil(places.length / columns)), width = columns * 430, depth = rows * 365;
  const districts = places.map((place, index) => ({...place, districtId:place.id,
    x:(index % columns + .5) * 430 - width / 2, z:(Math.floor(index / columns) + .5) * 365 - depth / 2,
    height:155, destination:{districtId:place.id}, key:`district:${place.id}`}));
  const byId = new Map(districts.map(d => [d.id,d])), occupancy = new Map();
  const destinations = unique(venues).flatMap(venue => {
    const allowedDistricts=venue.districts?.length?venue.districts:venue.district?[venue.district]:null;
    const district = allowedDistricts ? allowedDistricts.map(id => byId.get(id)).find(Boolean)
      : byId.get(preferredDistricts[venue.id]) || districts[0];
    if (!district) return [];
    const slot = occupancy.get(district.id) || 0; occupancy.set(district.id,slot + 1);
    return [{...venue, ...(allowedDistricts?{districts:allowedDistricts}:{}), key:`venue:${venue.id}`, venueId:venue.id, districtId:district.id,
      districtName:district.name, x:district.x - 104 + (slot % 3) * 101, z:district.z - 75 + Math.floor(slot / 3) * 103,
      height:venue.id === 'hotel' ? 150 : venue.id === 'mosque' ? 136 : 86,
      destination:{districtId:district.id,venueId:venue.id}}];
  });
  return {width,depth,columns,rows,districts,venues:destinations};
}

/** A view selection requests travel. It cannot edit a resident or create a trip. */
export function outsideDestination(layout, input) {
  if (!input || !layout.districts.some(d => d.id === input.districtId)) return null;
  if (input.venueId) {
    const venue = layout.venues.find(v => v.id === input.venueId);
    if (!venue || venue.districts?.length && !venue.districts.includes(input.districtId)) return null;
    return {districtId:input.districtId,venueId:venue.id};
  }
  return {districtId:input.districtId};
}

function buildCity(layout) {
  const scene = new THREE.Scene(), world = new THREE.Group(), buckets = new Map(), authored = [];
  scene.add(world); scene.background = new THREE.Color('#b5d2cf'); scene.fog = new THREE.Fog('#b5d2cf',14000,23500);
  const shapes = {box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,10,7),
    cylinder:new THREE.CylinderGeometry(1,1,1,12),cone:new THREE.ConeGeometry(1,1,10)};
  const materials = new Map(), dummy = new THREE.Object3D();
  const add = (shape,color,x,y,z,w,h,d,rotation=0) => {
    const key = `${shape}:${color}`;
    if (!buckets.has(key)) buckets.set(key,{shape,color,parts:[]});
    buckets.get(key).parts.push({x,y,z,w,h,d,rotation});
  };
  const box = (color,x,y,z,w,h,d,r=0) => add('box',color,x,y,z,w,h,d,r);
  const tree = (x,z,size=1,palm=false) => {
    add('cylinder','#856e4f',x,21*size,z,3*size,42*size,3*size);
    if(palm) for(let i=0;i<5;i++) {const a=i*Math.PI*2/5;add('sphere','#507f61',x+Math.sin(a)*13*size,45*size,z+Math.cos(a)*13*size,19*size,4*size,7*size,-a);}
    else {add('sphere','#527e5b',x,49*size,z,23*size,25*size,23*size);add('sphere','#7c9b64',x-7*size,62*size,z+2*size,16*size,15*size,17*size);}
  };
  const building = (x,z,w,d,height,color,style=0) => {
    box('#bac2b0',x,3,z,w+10,6,d+10);
    box(color,x,height/2+5,z,w,height,d);
    box(style===2?'#ba845d':'#68857c',x,height+9,z,w+7,9,d+7);
    if(style===1) {box('#e9dcc2',x,height+20,z,w*.72,16,d*.72);box('#83b6be',x,height+29,z,w*.56,2,d*.56);}
    if(style===2) {add('cone','#ae7359',x,height+25,z,w*.69,35,d*.69,Math.PI/4);}
    const floors = Math.max(1,Math.floor(height/30));
    for(let floor=0;floor<floors;floor++) for(let col=0;col<3;col++) {
      const wx=x-w*.3+col*w*.3,yy=23+floor*28;
      box('#77a0a5',wx,yy,z+d/2+.7,w*.18,14,1.5);
      box('#dce3d7',wx,yy-9,z+d/2+2,w*.2,2,4);
      box('#82a9aa',x+w/2+.7,yy,z-d*.3+col*d*.3,1.5,14,d*.18);
    }
    box('#445f67',x,17,z+d/2+1,12,25,2);
    if(style===1) for(const side of [-1,1]) {box('#e4d8ba',x+side*w*.43,height*.5,z+d/2+3,5,height,5);}
    box('#91a59b',x-w*.2,height+18,z-d*.15,13,12,12);
  };
  box('#a5b7a0',0,-23,0,layout.width+460,42,layout.depth+460);
  box('#8fa887',0,-1,0,layout.width+420,4,layout.depth+420);
  // Continuous roads connect every neighbourhood, with sidewalks and painted lanes.
  for(let row=0;row<=layout.rows;row++) {
    const z=row*365-layout.depth/2;
    box('#bcc9b8',0,1,z,layout.width+80,3,66);box('#425960',0,3,z,layout.width+80,3,43);
    for(let x=-layout.width/2;x<layout.width/2;x+=67) box('#e5dabc',x,5,z,24,1,2);
  }
  for(let col=0;col<=layout.columns;col++) {
    const x=col*430-layout.width/2;
    box('#bcc9b8',x,1,0,66,3,layout.depth+80);box('#425960',x,3,0,43,3,layout.depth+80);
    for(let z=-layout.depth/2;z<layout.depth/2;z+=67) box('#e5dabc',x,5,z,2,1,24);
  }
  const venueCells = new Map();
  layout.venues.forEach(v => {if(!venueCells.has(v.districtId))venueCells.set(v.districtId,[]);venueCells.get(v.districtId).push(v);});
  for(const [index,district] of layout.districts.entries()) {
    const {x,z}=district, affluent=/premium|diplomatic|hill/.test(district.vibe||''), industrial=/industrial|logistics|utility/.test(district.vibe||'');
    box(index%3?'#aac099':'#9eb78e',x,1,z,352,3,284);
    box('#d1d4bd',x,3,z+118,347,3,16);box('#cdd0b8',x+161,3,z,14,3,268);
    const reserved=venueCells.get(district.id)||[];
    for(let row=0;row<2;row++)for(let col=0;col<3;col++) {
      const bx=x-104+col*101,bz=z-75+row*103;
      if(reserved.some(v=>Math.abs(v.x-bx)<45&&Math.abs(v.z-bz)<45))continue;
      const h=industrial?43:affluent?60+(index+col)%3*24:45+(index*7+col*13+row*19)%83;
      building(bx,bz,industrial?83:66,industrial?77:63,h,['#e4d5bb','#d3c5b0','#dce0d0','#b9c6b8'][index%4],industrial?0:affluent?1:2);
      if(industrial)for(let i=0;i<3;i++)box('#788f91',bx-25+i*25,h+11,bz,16,10,41);
    }
    // Pocket parks, benches, palms, small streetlights and garden paths.
    box('#c4c9ad',x-20,3,z+78,260,3,9);
    for(let i=0;i<5;i++)tree(x-140+i*68,z+100,.75+(index+i)%3*.12,affluent);
    for(const side of [-1,1]) {
      tree(x+side*178,z-116,1.05,affluent);box('#6f7361',x+side*130,12,z+116,27,5,10);
      add('cylinder','#738886',x+side*180,31,z+145,1.4,62,1.4);box('#f2dfad',x+side*180+6,61,z+145,15,3,7);
    }
    if(index%8===0){box('#6eaaa9',x+151,5,z+71,18,4,61);box('#d3d9bc',x+151,3,z+71,27,3,70);box('#6eaaa9',x+151,6,z+71,18,3,61);}
  }
  for(const venue of layout.venues) {
    const {x,z,height:h,id}=venue, club=['club','club-cage','magic-city','bear-barn'].includes(id);
    if(id==='park'||id==='jabi-lake') {
      box('#6f9970',x,4,z,88,6,80);
      if(id==='jabi-lake') {add('sphere','#4b99a7',x,7,z,46,2,31);box('#d5c2a0',x+24,8,z+25,48,3,10);}
      else {add('cylinder','#d6cfb2',x,6,z,21,4,21);add('cylinder','#69a5aa',x,9,z,17,3,17);add('sphere','#c2e3e3',x,15,z,4,9,4);}
      for(let i=0;i<5;i++)tree(x-35+i*16,z-34,1.1);
      venue.height=78;
    } else {
      building(x,z,83,72,h,club?'#566c80':id==='banex'?'#d6b77d':'#ede0c3',id==='hotel'?1:0);
      box(club?'#d69bbf':'#5e878a',x,h*.7,z+38,72,13,4);
      box(club?'#bf83c7':'#c4a568',x,h*.7+12,z+45,90,4,19);
      if(id==='mosque') {add('sphere','#7faba2',x,h+5,z,28,25,27);add('cylinder','#e4dec5',x+35,h*.75,z-24,7,h*1.5,7);add('cone','#75a69b',x+35,h*1.5+9,z-24,11,21,11);}
      if(id==='church') {box('#e9d5a6',x,h+26,z,4,43,4);box('#e9d5a6',x,h+34,z,28,4,4);}
      if(id==='cinema') {box('#364d62',x,h+25,z,65,34,7);box('#dcb37e',x,h+25,z+4,51,23,1);}
      if(id==='banex')for(let i=0;i<3;i++) {box('#517d8a',x-26+i*26,20,z+38,23,28,3);box('#c8b38b',x-26+i*26,39,z+43,25,3,16);}
    }
  }
  // City landmarks on the promenade: a rocky ridge, stadium and water gardens.
  const edgeZ=layout.depth/2+135;
  for(let i=0;i<7;i++)add('sphere',i%2?'#8c9e8b':'#a0ad96',layout.width/2-200+i*69,55+(i%3)*12,-layout.depth/2-90,76,88+(i%3)*25,69);
  add('cylinder','#d2dbc5',-layout.width/2-110,9,0,97,13,140);
  add('cylinder','#7caca1',-layout.width/2-110,17,0,75,7,116);
  box('#71916d',-layout.width/2-110,23,0,77,2,132);
  for(const x of [-layout.width*.3,layout.width*.25]) {
    add('sphere','#72b3b6',x,2,edgeZ,layout.width*.11,3,68);
    for(let i=0;i<8;i++)tree(x-140+i*40,edgeZ+70,.9,true);
  }
  for(const bucket of buckets.values()) {
    if(!materials.has(bucket.color))materials.set(bucket.color,new THREE.MeshStandardMaterial({color:bucket.color,roughness:.83,metalness:bucket.color==='#77a0a5'?.2:0}));
    const mesh=new THREE.InstancedMesh(shapes[bucket.shape],materials.get(bucket.color),bucket.parts.length);
    bucket.parts.forEach((part,index)=>{dummy.position.set(part.x,part.y,part.z);dummy.scale.set(part.w,part.h,part.d);dummy.rotation.set(0,part.rotation,0);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();world.add(mesh);
  }
  const cars=[],carBatches=[];
  const carColors=['#dcbb81','#e9e5d3','#6f939b','#b97864'];
  const carGeometry=new THREE.BoxGeometry(17,9,32),carGlass=new THREE.MeshStandardMaterial({color:'#3c697a',roughness:.3});
  const bodies=carColors.map(color=>new THREE.InstancedMesh(carGeometry,new THREE.MeshStandardMaterial({color,roughness:.5}),6));
  const cabins=new THREE.InstancedMesh(shapes.box,carGlass,24),wheels=new THREE.InstancedMesh(shapes.sphere,new THREE.MeshStandardMaterial({color:'#314a4b',roughness:.9}),96);
  carBatches.push(...bodies,cabins,wheels);carBatches.forEach(mesh=>{mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);world.add(mesh);});
  for(let i=0;i<24;i++) {
    const horizontal=i%2===0,line=i%(horizontal?layout.rows+1:layout.columns+1),offset=i*197;
    cars.push({index:i,body:bodies[i%4],bodyIndex:Math.floor(i/4),horizontal,line,offset,speed:28+(i%5)*8,direction:i%3===0?-1:1});
  }
  // Reuse the authored vehicle modeller for the car showroom's detailed display.
  const dealer=layout.venues.find(v=>v.id==='dealership');
  if(dealer) {
    const vehicle=buildThreeEnvironment(THREE,{modelOnly:{category:'vehicle',id:'city-sedan',bodyStyle:'sedan',color:'#dcc7a0'}});
    batchRigidMeshes(THREE,vehicle.group,{recursive:true});vehicle.group.scale.setScalar(.18);vehicle.group.position.set(dealer.x+58,4,dealer.z+35);world.add(vehicle.group);authored.push(vehicle);
  }
  const ambient=new THREE.HemisphereLight('#fff2da','#587366',2.1);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff0d0',2.6);sun.position.set(-3500,6500,2500);scene.add(sun);
  const rim=new THREE.DirectionalLight('#d8f1fa',.75);rim.position.set(3000,2200,-3000);scene.add(rim);
  return {scene,updateTraffic(elapsed){
    for(const car of cars){
      const length=car.horizontal?layout.width:layout.depth,t=((car.offset+elapsed*car.speed*car.direction)%length+length)%length-length/2;
      const x=car.horizontal?t:car.line*430-layout.width/2+10,z=car.horizontal?car.line*365-layout.depth/2+10:t;
      const yaw=car.horizontal?car.direction*Math.PI/2:car.direction<0?Math.PI:0;
      dummy.rotation.set(0,yaw,0);dummy.scale.set(1,1,1);dummy.position.set(x,10,z);dummy.updateMatrix();car.body.setMatrixAt(car.bodyIndex,dummy.matrix);
      dummy.scale.set(13,8,16);dummy.position.set(x-2*Math.sin(yaw),17,z-2*Math.cos(yaw));dummy.updateMatrix();cabins.setMatrixAt(car.index,dummy.matrix);
      for(let wheel=0;wheel<4;wheel++){const dx=wheel%2?8:-8,dz=wheel<2?-10:10;dummy.scale.set(3,3,3);dummy.position.set(x+dx*Math.cos(yaw)+dz*Math.sin(yaw),6,z-dx*Math.sin(yaw)+dz*Math.cos(yaw));dummy.updateMatrix();wheels.setMatrixAt(car.index*4+wheel,dummy.matrix);}
    }
    carBatches.forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;});
  },updateClock(clock){
    ambient.intensity=clock.isNight?1.05:1.4+clock.sunlight*.7;
    ambient.color.set(clock.isNight?'#c3d4ef':'#fff1d4');sun.intensity=clock.isNight?.42:.8+clock.sunlight*1.8;
    sun.color.set(clock.isNight?'#a2bde3':clock.sunlight<.2?'#ffd2a3':'#fff0d0');
    scene.background.set(clock.isNight?'#253c51':clock.sunlight<.2?'#c3ccc0':'#b5d2cf');scene.fog.color.copy(scene.background);
    for(const color of ['#77a0a5','#82a9aa']){const material=materials.get(color);if(material){material.emissive.set('#ead7a0');material.emissiveIntensity=clock.isNight?.32:.02;}}
  },dispose(){
    authored.forEach(item=>item.dispose?.());const geometries=new Set(Object.values(shapes)),mats=new Set(materials.values()),textures=new Set();
    scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){mats.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
    geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());mats.forEach(m=>m.dispose());
  }};
}

export function renderOutside(root,{atlas=[],venues=[],profile={},onSelect=()=>{},onHome,serverNow}={}) {
  const layout=createOutsideLayout(atlas,venues),all=[...layout.venues,...layout.districts];
  root.innerHTML=`<section class="outside-city" aria-label="Outside · Abuja city"><div class="outside-stage" tabindex="0" role="application" aria-label="3D Abuja city. Drag to pan, use two fingers to zoom, or switch to orbit. Arrow keys pan, plus and minus zoom."></div><div class="outside-roof-labels"></div><header class="outside-heading"><span class="outside-eyebrow">ABUJA LIFE · OUTSIDE</span><h2>Your city, alive.</h2><p>${layout.districts.length} districts & towns · ${layout.venues.length} places</p></header><div class="outside-tools"><button type="button" data-outside-action="overview" aria-label="Show the whole city">↗ <span>Whole city</span></button><button type="button" data-outside-action="mode" aria-pressed="false">↻ <span>Orbit</span></button><button type="button" data-outside-action="in" aria-label="Zoom in">+</button><button type="button" data-outside-action="out" aria-label="Zoom out">−</button>${onHome?'<button type="button" data-outside-action="home" aria-label="Go home">⌂</button>':''}</div><div class="outside-directory"><label class="outside-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Find a place or district" aria-label="Search all city destinations" autocomplete="off"><button type="button" data-outside-action="directory" aria-label="Browse all destinations" aria-expanded="false">☷</button></label><div class="outside-results" hidden></div></div><aside class="outside-selection" hidden></aside><p class="outside-hint">Drag to explore · scroll or pinch to zoom <span>Original Abuja-inspired game city</span></p><div class="outside-status" aria-live="polite"></div></section>`;
  const shell=root.querySelector('.outside-city'),stage=root.querySelector('.outside-stage'),labelsRoot=root.querySelector('.outside-roof-labels'),input=root.querySelector('input'),results=root.querySelector('.outside-results'),selection=root.querySelector('.outside-selection'),status=root.querySelector('.outside-status');
  root.dataset.outsideDistricts=String(layout.districts.length);root.dataset.outsideVenues=String(layout.venues.length);
  root.dataset.outsideLimits=JSON.stringify({minZoom:1,maxZoom:9,minElevation:.5,maxElevation:1.18,width:layout.width,depth:layout.depth});
  const listeners=[],listen=(target,event,fn,options)=>{target.addEventListener(event,fn,options);listeners.push(()=>target.removeEventListener(event,fn,options));};
  let disposed=false,renderer,model,camera,raf=0,last=0,elapsed=0,selected=null,directoryOpen=false,orbitMode=false,pinchBase=null;
  const initialDistrict=layout.districts.find(d=>d.id===(profile.home?.district||profile.district))||layout.districts.find(d=>d.id==='central-area')||layout.districts[0];
  const initialZoom=root.clientWidth<700||root.clientHeight>root.clientWidth?3.5:1.8;
  const pointers=new Map(),size={width:1,height:1},view={
    x:clamp(initialDistrict?.x||0,-layout.width*.3,layout.width*.3),
    z:clamp(initialDistrict?.z||0,-layout.depth*.26,layout.depth*.26),zoom:initialZoom,yaw:.39,elevation:.84},target={...view};
  const bounds=Math.max(layout.width,layout.depth),maxZoom=9;
  const suppliedTime=Number(serverNow)||Date.parse(serverNow),clockOffset=Number.isFinite(suppliedTime)?suppliedTime-Date.now():0;
  let clockMinute=-1;
  const labels=all.map(place=>{
    const button=document.createElement('button');button.type='button';button.className=`outside-roof-label ${place.venueId?'outside-venue-label':'outside-district-label'}`;
    button.textContent=place.venueId?`${icons[place.id]||'•'} ${place.name}`:place.name;
    button.setAttribute('aria-label',`${place.name}${place.districtName?`, ${place.districtName}`:''}. View destination`);button.dataset.destinationKey=place.key;labelsRoot.append(button);
    return {place,button,point:new THREE.Vector3(place.x,place.height+20,place.z)};
  });
  const zoom=(factor)=>{target.zoom=clamp(target.zoom*factor,1,maxZoom);};
  const overview=()=>{Object.assign(target,{x:0,z:0,zoom:1,yaw:.39,elevation:.84});selected=null;selection.hidden=true;status.textContent='Whole city overview';};
  const choose=place=>{
    selected=place;target.x=place.x;target.z=place.z;target.zoom=Math.max(4,target.zoom);
    selection.hidden=false;selection.innerHTML=`<button type="button" class="outside-selection-close" data-outside-action="close" aria-label="Close destination">×</button><span>${place.venueId?esc(place.category||'A place in your city'):'NEIGHBOURHOOD'}</span><h3>${esc(place.name)}</h3><p>${esc(place.districtName||place.vibe||'Explore this neighbourhood')}</p><button type="button" class="outside-travel" data-outside-action="travel">Choose transport <span aria-hidden="true">→</span></button>`;
    input.value='';directoryOpen=false;results.hidden=true;root.querySelector('[data-outside-action="directory"]').setAttribute('aria-expanded','false');status.textContent=`${place.name} selected. Choose transport to travel.`;
  };
  const renderDirectory=()=>{
    const query=input.value.trim().toLocaleLowerCase(),matches=all.filter(p=>`${p.name} ${p.districtName||''} ${p.category||''} ${p.id}`.toLocaleLowerCase().includes(query));
    results.hidden=!query&&!directoryOpen;results.innerHTML=matches.length?matches.map(place=>`<button type="button" data-outside-destination="${esc(place.key)}"><strong>${esc(place.name)}</strong><span>${esc(place.districtName||place.vibe||'District / town')}</span></button>`).join(''):'<p>No destinations match. Try a district or place name.</p>';
  };
  listen(input,'input',renderDirectory);
  listen(shell,'click',event=>{
    const node=event.target.closest('button');if(!node)return;
    const key=node.dataset.destinationKey||node.dataset.outsideDestination;
    if(key){const place=all.find(p=>p.key===key);if(place)choose(place);return;}
    switch(node.dataset.outsideAction) {
      case 'overview':overview();break;
      case 'mode':orbitMode=!orbitMode;node.setAttribute('aria-pressed',String(orbitMode));node.querySelector('span').textContent=orbitMode?'Pan':'Orbit';break;
      case 'in':zoom(1.4);break;case 'out':zoom(1/1.4);break;
      case 'directory':directoryOpen=!directoryOpen;node.setAttribute('aria-expanded',String(directoryOpen));renderDirectory();break;
      case 'close':selected=null;selection.hidden=true;break;
      case 'home':onHome?.();break;
      case 'travel':{const destination=outsideDestination(layout,selected?.destination);if(destination)onSelect(destination);break;}
    }
  });
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,globalThis.matchMedia?.('(pointer: coarse)').matches?1.3:1.7));
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    renderer.domElement.setAttribute('aria-hidden','true');stage.append(renderer.domElement);model=buildCity(layout);
    camera=new THREE.OrthographicCamera(-1,1,1,-1,1,26000);root.dataset.outsideRenderer='webgl-3d';
  } catch {
    model?.dispose();renderer?.dispose();renderer=null;
    labelsRoot.hidden=true;
    stage.innerHTML='<p class="outside-unavailable">Your 3D city needs WebGL. Every destination is available in the directory.</p>';
    directoryOpen=true;root.querySelector('[data-outside-action="directory"]').setAttribute('aria-expanded','true');renderDirectory();
  }
  const viewport=()=>{
    const aspect=size.width/size.height;
    const projectedWidth=Math.cos(.39)*(layout.width+420)+Math.sin(.39)*(layout.depth+420);
    const projectedHeight=Math.sin(.84)*(Math.sin(.39)*(layout.width+420)+Math.cos(.39)*(layout.depth+420))+200;
    const base=Math.max(projectedWidth*1.12,projectedHeight*aspect*1.12,bounds*.98);
    return {width:base/view.zoom,height:base/aspect/view.zoom};
  };
  const constrain=()=>{target.x=clamp(target.x,-layout.width/2,layout.width/2);target.z=clamp(target.z,-layout.depth/2,layout.depth/2);target.elevation=clamp(target.elevation,.5,1.18);};
  const pan=(dx,dy)=>{
    const span=viewport(),sx=-dx*span.width/size.width,sz=-dy*span.height/size.height/Math.sin(view.elevation);
    target.x+=sx*Math.cos(view.yaw)+sz*Math.sin(view.yaw);target.z+=-sx*Math.sin(view.yaw)+sz*Math.cos(view.yaw);constrain();
  };
  const distance=points=>Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
  listen(stage,'pointerdown',event=>{
    if(event.button>0)return;stage.setPointerCapture?.(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2)pinchBase={distance:distance([...pointers.values()]),zoom:target.zoom};
  });
  listen(stage,'pointermove',event=>{
    if(!pointers.has(event.pointerId))return;
    const before=[...pointers.values()],old=pointers.get(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2){const after=[...pointers.values()];if(pinchBase?.distance>0)target.zoom=clamp(pinchBase.zoom*distance(after)/pinchBase.distance,1,maxZoom);pan((after[0].x+after[1].x-before[0].x-before[1].x)/2,(after[0].y+after[1].y-before[0].y-before[1].y)/2);}
    else if(orbitMode||event.shiftKey){target.yaw-=(event.clientX-old.x)*.006;target.elevation+=(event.clientY-old.y)*.004;constrain();}
    else pan(event.clientX-old.x,event.clientY-old.y);
  });
  const release=event=>{pointers.delete(event.pointerId);pinchBase=null;};
  listen(stage,'pointerup',release);listen(stage,'pointercancel',release);listen(stage,'lostpointercapture',release);
  listen(stage,'wheel',event=>{event.preventDefault();zoom(Math.exp(-clamp(event.deltaY,-180,180)*.003));},{passive:false});
  listen(stage,'keydown',event=>{
    const keys={ArrowLeft:[48,0],ArrowRight:[-48,0],ArrowUp:[0,48],ArrowDown:[0,-48]};
    if(keys[event.key]){event.preventDefault();pan(...keys[event.key]);}
    else if(['+','=','-','_'].includes(event.key)){event.preventDefault();zoom(event.key==='-'||event.key==='_'?1/1.25:1.25);}
    else if(event.key==='Home'){event.preventDefault();overview();}
  });
  const resize=()=>{const rect=stage.getBoundingClientRect();size.width=Math.max(1,rect.width);size.height=Math.max(1,rect.height);renderer?.setSize(size.width,size.height,false);};
  const observer=globalThis.ResizeObserver?new ResizeObserver(resize):null;observer?.observe(stage);listen(globalThis,'resize',resize);resize();
  const projected=new THREE.Vector3();let frameCount=0,lastLabelPose='';
  const drawLabels=()=>{
    const occupied=[],ordered=[...labels].sort((a,b)=>(b.place===selected?100:0)+(b.place.venueId?10:0)-(a.place===selected?100:0)-(a.place.venueId?10:0));
    for(const label of ordered){
      projected.copy(label.point).project(camera);const x=(projected.x+1)*size.width/2,y=(1-projected.y)*size.height/2;
      const isSelected=label.place===selected,w=Math.min(260,label.place.name.length*(label.place.venueId?7.5:6.2)+29),h=label.place.venueId?44:25;
      const rect={left:x-w/2,right:x+w/2,top:y-h,bottom:y+3};
      const compact=size.width<700;
      const underHeading=rect.left<(compact?210:340)&&rect.top<133,underTools=rect.right>size.width-(compact?172:290)&&rect.top<(compact?125:80);
      const visible=projected.z>=-1&&projected.z<=1&&x>16&&x<size.width-16&&y>65&&y<size.height-55&&!underHeading&&!underTools&&
        (isSelected||!occupied.some(r=>rect.left<r.right+8&&rect.right>r.left-8&&rect.top<r.bottom+6&&rect.bottom>r.top-6));
      label.button.hidden=!visible;if(visible){occupied.push(rect);label.button.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%, -100%)`;label.button.classList.toggle('is-selected',isSelected);}
    }
  };
  const tick=time=>{
    raf=0;if(disposed||document.hidden||!renderer)return;
    const dt=last?clamp((time-last)/1000,0,.06):0;last=time;elapsed+=dt;const ease=1-Math.exp(-12*dt);
    for(const key of ['x','z','zoom','yaw','elevation'])view[key]+=(target[key]-view[key])*ease;
    const span=viewport();camera.left=-span.width/2;camera.right=span.width/2;camera.top=span.height/2;camera.bottom=-span.height/2;camera.updateProjectionMatrix();
    const radius=12000,flat=Math.cos(view.elevation)*radius;
    camera.position.set(view.x+Math.sin(view.yaw)*flat,Math.sin(view.elevation)*radius,view.z+Math.cos(view.yaw)*flat);camera.lookAt(view.x,0,view.z);camera.updateMatrixWorld();
    model.updateTraffic(elapsed);
    const now=Date.now()+clockOffset,minute=Math.floor(now/60000);
    if(minute!==clockMinute){clockMinute=minute;const clock=abujaTime(now);model.updateClock(clock);root.dataset.outsideClock=JSON.stringify({hour:clock.hour,minute:clock.minute,isNight:clock.isNight,timeZone:clock.timeZone});}
    renderer.render(model.scene,camera);
    const labelPose=[size.width,size.height,view.x.toFixed(1),view.z.toFixed(1),view.zoom.toFixed(4),view.yaw.toFixed(4),view.elevation.toFixed(4),selected?.key].join(':');
    if(labelPose!==lastLabelPose){drawLabels();lastLabelPose=labelPose;}
    if(frameCount%10===0){root.dataset.outsideCamera=JSON.stringify(view);root.dataset.outsideDrawCalls=String(renderer.info.render.calls);root.dataset.outsideTriangles=String(renderer.info.render.triangles);}
    frameCount++;
    raf=requestAnimationFrame(tick);
  };
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else if(!raf&&renderer&&!disposed)raf=requestAnimationFrame(tick);};
  listen(document,'visibilitychange',visibility);
  if(renderer){listen(renderer.domElement,'webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(raf);raf=0;status.textContent='3D rendering paused. The destination directory is still available.';directoryOpen=true;renderDirectory();});listen(renderer.domElement,'webglcontextrestored',()=>{last=0;visibility();});visibility();}
  const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer?.disconnect();listeners.forEach(remove=>remove());model?.dispose();renderer?.dispose();renderer?.forceContextLoss();delete root.dataset.outsideRenderer;root.replaceChildren();};
  cleanup.focusDistrict=id=>{const district=layout.districts.find(d=>d.id===id);if(district)choose(district);};
  cleanup.overview=overview;
  return cleanup;
}

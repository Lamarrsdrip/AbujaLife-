// Real, locally bundled WebGL character meshes over the authored 2.5D game set.
// The orthographic ground projection is aligned with the simulation's SVG coordinates.
import * as THREE from './vendor/three.module.js';
import { buildThreeEnvironment, batchRigidMeshes } from './world-3d-scenes.js';
import { applyWorldCamera } from './world-camera.js';

const DEPTH = Math.SQRT1_2;
const palette = {
  skinTone:{deep:'#694632',brown:'#a06c4b',warm:'#c69069',light:'#ddb28d'},
  top:{ochre:'#bc7848',forest:'#406b57',cream:'#e9e0ca',navy:'#374957',agbada:'#c9ad77'},
  bottom:{charcoal:'#3c4247',denim:'#526a80',cream:'#d7cbbb'},
  shoes:{white:'#efece4',black:'#252b2e'}
};
const pick=(kind,value,fallback)=>palette[kind][value]||fallback;
function material(color,roughness=.76,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
function ellipsoid(parent,mat,x,y,z,rx,ry,rz,segments=16){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,segments,12),mat);mesh.position.set(x,y,z);mesh.scale.set(rx,ry,rz);parent.add(mesh);return mesh;
}
function capsule(parent,mat,r,length,x,y,z){
  const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.01,length-r*2),4,12),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function box(parent,mat,x,y,z,w,h,d){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
function lathe(parent,mat,points,x,y,z){const mesh=new THREE.Mesh(new THREE.LatheGeometry(points.map(([r,h])=>new THREE.Vector2(r,h)),24),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}

function character(appearance={}){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const skin=material(pick('skinTone',appearance.skinTone,'#a06c4b'));
  const shirt=material(pick('top',appearance.top,'#bc7848'));
  const pants=material(pick('bottom',appearance.bottom,'#3c4247'));
  const shoes=material(pick('shoes',appearance.shoes,'#efece4'),.65);
  const hair=material('#29241f',.95),seam=material('#252b29'),sole=material('#d2d1c8'),gold=material('#c5a25c',.3,.55);
  const eye=material('#241c17',.34),white=material('#d9ccb7'),lip=material('#78513e'),trim=material('#ead7ad');
  const broad=appearance.body==='broad'?1.16:appearance.body==='slim'?.88:1;
  const feminine=appearance.presentation==='feminine';
  // Human proportions: the head is one seventh of total height; feet stay grounded.
  const hips=new THREE.Group();hips.position.y=48;body.add(hips);
  const pelvis=lathe(hips,pants,[[8.6,-2.5],[9.2,2],[9,8],[8.7,9]],0,0,0);pelvis.scale.set(broad,1,.71);
  const legs=[];
  for(const side of [-1,1]){
    const upper=new THREE.Group();upper.position.set(side*5.3,0,0);hips.add(upper);
    capsule(upper,pants,4.5,25,0,-10,0);
    const knee=new THREE.Group();knee.position.y=-22;upper.add(knee);
    capsule(knee,pants,3.8,22,0,-9.2,0);
    ellipsoid(knee,shoes,0,-21,3,4.5,3.7,8.8);
    ellipsoid(knee,sole,0,-23,3.1,4.7,1.1,9);
    box(knee,shoes,0,-19.4,4.5,6,1,6);
    legs.push({upper,knee});
  }
  const torso=new THREE.Group();torso.position.y=51;body.add(torso);
  const torsoMesh=lathe(torso,shirt,[[7.8,0],[9,3],[9.6,12],[12.6,24],[11.5,29],[5.2,33]],0,0,0);torsoMesh.scale.set(broad,1,.66);
  ellipsoid(torso,shirt,0,24,0,12.8*broad,7.2,6.7);
  if(feminine){ellipsoid(torso,shirt,-4,21,4.3,5,5.5,3);ellipsoid(torso,shirt,4,21,4.3,5,5.5,3);}
  box(torso,shirt,0,2,5.3,15*broad,2,1);
  const arms=[];
  for(const side of [-1,1]){
    const shoulder=new THREE.Group();shoulder.position.set(side*11.8*broad,25,0);torso.add(shoulder);
    capsule(shoulder,shirt,4.4,13,side*.5,-4,0);
    capsule(shoulder,skin,3.05,17,side*1.4,-11,0);
    const elbow=new THREE.Group();elbow.position.set(side*1.4,-18,0);shoulder.add(elbow);
    capsule(elbow,skin,2.55,16,0,-6.5,.6);
    ellipsoid(elbow,skin,0,-15.6,1,2.65,4.3,2.15);
    ellipsoid(elbow,skin,-side*1.8,-14,2.1,1.1,2.6,1.25);
    arms.push({shoulder,elbow});
  }
  if(appearance.top==='agbada'){
    const robe=lathe(torso,shirt,[[13,-12],[14,0],[13,20],[11,28],[5,32]],0,0,0);robe.scale.z=.7;
    for(const side of [-1,1]){const sleeve=ellipsoid(torso,shirt,side*15,16,0,10,13,5);sleeve.rotation.z=side*.25;box(torso,trim,side*3,15,9.4,1,21,.6);}
    box(torso,trim,0,15,9.7,1,28,.6);
  }
  capsule(body,skin,4.1,12,0,85,0);
  const head=new THREE.Group();head.position.set(0,96,0);body.add(head);
  const faceWidth=appearance.face==='round'?8.2:appearance.face==='angular'?7.3:7.7;
  const face=lathe(head,skin,[[.7,-9.8],[4.4,-8.8],[6.8,-5.1],[faceWidth,.5],[faceWidth,5],[6.5,8.5],[3.4,10.1],[.1,10.6]],0,0,0);face.scale.z=.87;
  for(const side of [-1,1]){
    ellipsoid(head,skin,side*7.7,-1,0,1.5,3.2,2);
    ellipsoid(head,lip,side*8.2,-1,1, .55,1.5,.7);
    ellipsoid(head,white,side*3.15,1.05,6.2,1.8,.85,.45);
    ellipsoid(head,eye,side*3.05,1.1,6.61,.68,.68,.32);
    ellipsoid(head,white,side*3.1+.17,1.3,6.9,.16,.17,.11,8);
    const brow=ellipsoid(head,hair,side*3.15,2.7,6.1,2,.47,.65);brow.rotation.z=side*-.06;
    if(feminine)ellipsoid(head,gold,side*8.3,-3.4,0,.7,1.25,.7);
  }
  ellipsoid(head,skin,0,-.7,6.65,1.45,2.6,1.6);
  ellipsoid(head,skin,0,-2.6,7.1,1.75,1.1,1.4);
  ellipsoid(head,lip,0,-5.4,6.4,2.6,.5,.5);
  ellipsoid(head,skin,0,-6.05,6.2,2.5,.42,.4);
  if(appearance.facialHair==='beard'){
    const beard=lathe(head,hair,[[2.2,-9.9],[5.4,-8],[7.2,-4.8],[7.5,-2.8]],0,0,-.15);beard.scale.z=.89;
    ellipsoid(head,lip,0,-5.4,6.55,2.25,.48,.45);
  }
  const hairstyle=appearance.hair||'crop';
  if(hairstyle!=='bald'){
    const cap=ellipsoid(head,hair,0,5.9,-.8,8.25,5.8,7.4);
    if(hairstyle==='afro'){
      cap.scale.multiplyScalar(1.16);
      for(let i=0;i<24;i++){const a=i*2.39996,y=5+Math.sin(i*1.61)*5;ellipsoid(head,hair,Math.cos(a)*8.1,y,-.6+Math.sin(a)*7.3,3.7,3.8,3.4,10);}
    }else if(hairstyle==='braids'||hairstyle==='locs'){
      for(let i=0;i<11;i++){
        const a=i/11*Math.PI*2,x=Math.sin(a)*7.4,z=Math.cos(a)*6.9;
        const braid=capsule(head,hair,hairstyle==='braids'?1.05:1.7,15+(i%3)*4,x,-1.5,z);braid.rotation.z=-x*.026;
        if(hairstyle==='braids'&&i%2===0)ellipsoid(head,gold,x,-10-(i%3)*2,z,1.1,1.5,1.1,8);
      }
    }
  }
  if(appearance.accessory==='glasses'){
    for(const side of [-1,1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(2.55,.35,6,18),seam);ring.scale.y=.7;ring.position.set(side*3.2,1.15,6.95);head.add(ring);}
    box(head,seam,0,1.25,7,1.6,.45,.5);box(head,seam,-7,1,2.5,.45,.45,9);box(head,seam,7,1,2.5,.45,.45,9);
  }
  root.traverse(part=>{if(part.isMesh){part.castShadow=true;part.receiveShadow=true;}});
  // Merge pieces within each joint, never across an animated shoulder, knee or head.
  const joints=[];root.traverse(part=>{if(part.isGroup)joints.push(part);});
  for(const joint of joints)batchRigidMeshes(THREE,joint,{disposeSources:true});
  const neutral={bodyY:0};
  return {root,body,torso,head,arms,legs,neutral};
}
export function createCharacterModel(appearance={}) {return character(appearance).root;}
function animate(rig,{x,y,angle=90,moving=false,phase=0,time=0,activity=null,scale=1,elevation=0}={}){
  rig.root.position.set(x,elevation,y/DEPTH);rig.root.scale.setScalar(scale);
  if(activity?.object){const o=activity.object;rig.root.position.set(o.x+o.w/2,0,(o.y+o.h/2)/DEPTH);}
  // SVG world angle zero points right; Three local +Z is forward.
  const target=Math.PI/2-angle*Math.PI/180;
  let delta=(target-rig.root.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI;
  rig.root.rotation.y+=delta*.2;
  rig.body.position.set(0,0,0);rig.body.rotation.set(0,0,0);rig.torso.rotation.set(0,0,0);rig.head.rotation.set(0,0,0);
  rig.body.position.y=moving?Math.abs(Math.sin(phase))*1.7:Math.sin(time*2)*.3;
  for(let i=0;i<2;i++){
    const swing=moving?Math.sin(phase+i*Math.PI):0;
    rig.legs[i].upper.rotation.set(swing*.48,0,0);
    rig.legs[i].knee.rotation.set(moving?Math.max(0,-swing)*.68:.04,0,0);
    rig.arms[i].shoulder.rotation.set(-swing*.42,0,(i?-.075:.075));
    rig.arms[i].elbow.rotation.set(-.13-(moving?Math.max(0,swing)*.35:0),0,0);
  }
  if(!activity)return;
  const t=activity.elapsed/1000,beat=Math.sin(t*5);
  if(activity.name==='exercise'&&activity.object?.kind==='treadmill'){
    rig.root.position.y=25;rig.root.rotation.y=Math.PI;rig.body.position.y=Math.abs(Math.sin(t*9))*2;rig.legs.forEach((l,i)=>{const swing=Math.sin(t*9+i*Math.PI);l.upper.rotation.x=swing*.55;l.knee.rotation.x=Math.max(0,-swing)*.95;rig.arms[i].shoulder.rotation.x=-swing*.5;rig.arms[i].elbow.rotation.x=-.7;});
  }else if(activity.name==='exercise'&&activity.object?.kind==='bench-press'){
    rig.root.rotation.y=0;rig.body.rotation.x=-Math.PI/2;rig.body.position.set(0,39,40);rig.arms.forEach((a,i)=>{a.shoulder.rotation.x=-1.1-Math.sin(t*3)*.3;a.shoulder.rotation.z=i?.5:-.5;a.elbow.rotation.x=-.45;});
  }else if(activity.name==='exercise'){
    rig.body.position.y=-(1-beat)*3.4;
    rig.arms.forEach((a,i)=>{a.shoulder.rotation.z=(i?1:-1)*(.5+(beat+1)*.46);a.elbow.rotation.x=-.65;});
    rig.legs.forEach(l=>{l.upper.rotation.x=-.16*(1-beat);l.knee.rotation.x=.33*(1-beat);});
  }else if(activity.name==='dance'){
    rig.body.position.y=Math.abs(beat)*3.4;rig.body.rotation.z=Math.sin(t*3)*.11;rig.torso.rotation.y=Math.sin(t*3)*.2;
    rig.arms.forEach((a,i)=>{a.shoulder.rotation.z=(i?1:-1)*(.48+Math.sin(t*4+i)*.3);a.shoulder.rotation.x=Math.sin(t*4+i*2)*.35;a.elbow.rotation.x=-.7;});
    rig.legs.forEach((l,i)=>{l.upper.rotation.x=Math.sin(t*5+i*Math.PI)*.28;l.knee.rotation.x=Math.max(0,Math.sin(t*5+i*Math.PI))*.5;});
  }else if(activity.name==='pray'){
    rig.root.rotation.y=Math.PI;rig.head.rotation.x=.23;
    rig.arms.forEach((a,i)=>{a.shoulder.rotation.x=-.75;a.shoulder.rotation.z=(i?-.3:.3);a.elbow.rotation.x=-1.12;});
  }else if(activity.name==='eat'||activity.name==='groom'||activity.name==='dice'){
    rig.arms[1].shoulder.rotation.x=-.58-Math.sin(t*3)*.22;rig.arms[1].elbow.rotation.x=-1.4+Math.sin(t*3)*.3;
  }else if(activity.name==='social'){
    rig.arms[1].shoulder.rotation.z=.45+Math.sin(t*3)*.15;rig.arms[1].elbow.rotation.x=-.8;rig.head.rotation.y=Math.sin(t*2)*.12;
  }else if(activity.name==='sleep'){
    rig.root.rotation.y=0;rig.body.rotation.x=-Math.PI/2;rig.body.position.set(0,42,45);rig.arms.forEach((a,i)=>{a.shoulder.rotation.z=i?.16:-.16;a.elbow.rotation.x=-.4;});
  }else if(activity.name==='shower'){
    rig.root.rotation.y=Math.PI;rig.arms.forEach((a,i)=>{a.shoulder.rotation.x=-1.05+Math.sin(t*2.8+i)*.3;a.elbow.rotation.x=-1.3;});rig.head.rotation.x=.14+Math.sin(t*2)*.06;
  }else if(activity.name==='dj'){
    rig.root.rotation.y=0;rig.arms.forEach((a,i)=>{a.shoulder.rotation.x=-.7-Math.sin(t*3+i)*.15;a.elbow.rotation.x=-1.05;});rig.head.rotation.z=Math.sin(t*3)*.08;
  }else if(activity.name==='rest'){
    rig.body.rotation.x=-.1;rig.body.position.y=-15;rig.root.rotation.y=0;rig.legs.forEach(l=>{l.upper.rotation.x=-1.1;l.knee.rotation.x=1.2;});
  }else if(activity.name==='walk'){
    rig.legs.forEach((l,i)=>{l.upper.rotation.x=Math.sin(t*8+i*Math.PI)*.4;l.knee.rotation.x=Math.max(0,-Math.sin(t*8+i*Math.PI))*.5;});
  }
}

export function createCharacterRenderer(container,{appearance={},pedestrians=[],neighbours=[],scene:gameScene,profile,kind,venue,place}={}){
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return null;}
  const mobile=globalThis.matchMedia?.('(pointer: coarse)').matches||container.clientWidth<600;
  const maxPixelRatio=Math.min(globalThis.devicePixelRatio||1,mobile?1.25:1.75);
  renderer.setPixelRatio(maxPixelRatio);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000,0);renderer.domElement.className='world-character-layer';renderer.domElement.setAttribute('aria-hidden','true');
  container.append(renderer.domElement);container.dataset.characterRenderer='webgl-3d';
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-500,500,325,-325,1,12000);
  const environment=gameScene?buildThreeEnvironment(THREE,{scene:gameScene,profile,kind,venue,place,depthScale:1/DEPTH}):null;
  if(environment){scene.add(environment.group||environment);container.dataset.environmentRenderer='webgl-3d';container.dataset.environmentObjects=JSON.stringify(gameScene.objects?.map(o=>o.kind)||[]);let count=0;(environment.group||environment).traverse(o=>{if(o.isMesh)count++;});container.dataset.environmentMeshes=String(count);}
  const ambient=new THREE.HemisphereLight('#fff1d4','#556553',1.65);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff5e4',2.2);sun.position.set(-550,1200,650);sun.castShadow=true;sun.shadow.mapSize.set(mobile?512:1024,mobile?512:1024);sun.shadow.camera.left=-1050;sun.shadow.camera.right=1050;sun.shadow.camera.top=1050;sun.shadow.camera.bottom=-1050;sun.shadow.camera.near=10;sun.shadow.camera.far=3200;sun.shadow.bias=-.00035;sun.shadow.normalBias=.7;sun.shadow.radius=3;scene.add(sun,sun.target);
  const rim=new THREE.DirectionalLight('#ceddec',.75);rim.position.set(300,300,-600);scene.add(rim);
  const own=character(appearance);scene.add(own.root);
  const npcs=pedestrians.map((n,i)=>{const rig=character({skinTone:i%3?'brown':'deep',top:['forest','cream','ochre','navy'][i%4],hair:['crop','braids','afro'][i%3],presentation:i%2?'feminine':'masculine'});scene.add(rig.root);return rig;});
  let online=neighbours.map(p=>{const rig=character(p.appearance);scene.add(rig.root);return rig;});
  const rainGeometry=new THREE.BufferGeometry(),rainPositions=new Float32Array(180*6);rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));const rainMaterial=new THREE.LineBasicMaterial({color:'#c3d9e8',transparent:true,opacity:.36,depthWrite:false});const rain=new THREE.LineSegments(rainGeometry,rainMaterial);rain.frustumCulled=false;scene.add(rain);
  const shower=new THREE.Group();const dropMaterial=new THREE.MeshStandardMaterial({color:'#b3e3ea',transparent:true,opacity:.7,roughness:.1,emissive:'#5c9aa7',emissiveIntensity:.2});for(let i=0;i<28;i++)ellipsoid(shower,dropMaterial,0,0,0,.7,2.8,.7,6);scene.add(shower);
  const isClub=venue?.kind==='club'||['club','club-cage','magic-city','bear-barn'].includes(venue?.id);
  const indoors=kind==='home'||kind==='visit'||kind==='venue'&&!['park','jabi-lake'].includes(venue?.id);
  let previousWidth=0,previousHeight=0,lost=false,disposed=false,frames=0,viewWidth=0,viewHeight=0;
  let qualityStart=performance.now(),qualityFrames=0;
  const bounds=new THREE.Box3(),partBounds=new THREE.Box3(),projected=new THREE.Vector3();
  const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),pickRay=new THREE.Raycaster(),pickPoint=new THREE.Vector3(),pickNdc=new THREE.Vector2();
  const updateCamera=({x,y,width,height})=>{
    if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return false;
    viewWidth=width;viewHeight=height;return applyWorldCamera(camera,{x,y,width,height});
  };
  const lose=()=>{lost=true;container.removeAttribute('data-character-renderer');container.removeAttribute('data-environment-renderer');};renderer.domElement.addEventListener('webglcontextlost',lose);
  let onlineKey=JSON.stringify(neighbours.map(p=>[p.id,p.appearance]));
  return {
    setCameraViewport: updateCamera,
    screenToGround(clientX,clientY){if(lost||disposed||!viewWidth)return null;const rect=container.getBoundingClientRect();pickNdc.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);pickRay.setFromCamera(pickNdc,camera);return pickRay.ray.intersectPlane(groundPlane,pickPoint)?{x:pickPoint.x,y:pickPoint.z*DEPTH}:null;},
    projectGround(point){if(lost||disposed||!viewWidth)return null;const rect=container.getBoundingClientRect();projected.set(point.x,0,point.y/DEPTH).project(camera);return {x:rect.left+(projected.x+1)*rect.width/2,y:rect.top+(1-projected.y)*rect.height/2};},
    setResidents(people){if(disposed)return;const key=JSON.stringify(people.map(p=>[p.id,p.appearance]));if(key===onlineKey)return;onlineKey=key;for(const rig of online){scene.remove(rig.root);rig.root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}online=people.map(p=>{const rig=character(p.appearance);scene.add(rig.root);return rig;});},
    draw({player,camera:position,width,height,angle,phase,time,moving,transport,driving,activity,clock,weather,clubOpen,carColor,carStyle,ownVehicle,parked,trafficPositions,trip,npcPositions=[],onlinePositions=[]}){
      if(lost||disposed)return;
      const rect=container.getBoundingClientRect();
      if(rect.width!==previousWidth||rect.height!==previousHeight){renderer.setSize(rect.width,rect.height,false);previousWidth=rect.width;previousHeight=rect.height;}
      updateCamera({...position,width,height});
      sun.position.set(position.x-550,1200,position.y/DEPTH+650);sun.target.position.set(position.x,0,position.y/DEPTH);
      const daylight=clock?.sunlight??1,night=clock?.isNight??false,cloud=weather?.condition==='rain'?.72:weather?.condition==='cloudy'?.84:1;
      ambient.intensity=(indoors?(isClub&&clubOpen?.92:1.55):.82)+daylight*(indoors?.35:.83)*cloud;ambient.color.set(night?(indoors?'#ecdcc4':'#b8c7e7'):'#fff1d4');ambient.groundColor.set(night?(indoors?'#5d5c54':'#3b4d60'):'#556553');sun.intensity=(night?.26:Math.pow(daylight,.5)*2.2)*cloud;sun.color.set(night?'#96b1e4':daylight<.3?'#edbf91':'#fff5e4');rim.intensity=night?.44:.6;
      rain.visible=!indoors&&weather?.condition==='rain';if(rain.visible){for(let i=0;i<180;i++){const j=i*6,rx=position.x+((i*137.51+time*28)%width)-width/2,rz=position.y/DEPTH+((i*89.23)%(height/DEPTH))-height/DEPTH/2,ry=410-(i*61.5+time*330)%410;rainPositions.set([rx,ry,rz,rx-1.3,ry+16,rz],j);}rainGeometry.attributes.position.needsUpdate=true;}
      own.root.visible=!transport;animate(own,{...player,angle,phase,time,moving,activity,scale:1.45});
      npcPositions.forEach((p,i)=>{const club=isClub;npcs[i].root.visible=!club||clubOpen||i===0;animate(npcs[i],{...p,activity:club&&!clubOpen?null:p.activity,time,scale:1.28});});
      onlinePositions.forEach((p,i)=>{if(online[i])animate(online[i],{...p,time,scale:1.4});});
      shower.visible=activity?.name==='shower';if(shower.visible){shower.position.copy(own.root.position);shower.children.forEach((drop,i)=>{drop.position.set(Math.sin(i*2.4)*13,165-((i*19+time*98)%151),Math.cos(i*2.4)*15);});}
      container.dataset.activityPose=activity?.name||'';
      environment?.update?.({clock,weather,clubOpen,elapsed:time,player,angle,transport,driving,carColor,carStyle,ownVehicle,parked,trafficPositions,trip});
      renderer.render(scene,camera);
      if(mobile&&++qualityFrames>=20&&performance.now()-qualityStart>=2500){
        const fps=qualityFrames*1000/(performance.now()-qualityStart);
        if(fps<28&&renderer.getPixelRatio()>Math.min(maxPixelRatio,1)){renderer.setPixelRatio(Math.min(maxPixelRatio,1));}
        qualityStart=performance.now();qualityFrames=0;
      }
      if(++frames%10===0){
        const model=transport?environment?.playerModel?.():own.root;
        if(model?.visible){bounds.makeEmpty();model.traverse(part=>{if(part.isMesh&&!part.userData.excludeFromBounds){if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();bounds.union(partBounds.copy(part.geometry.boundingBox).applyMatrix4(part.matrixWorld));}});let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){projected.set(x,y,z).project(camera);const sx=rect.left+(projected.x+1)*rect.width/2,sy=rect.top+(1-projected.y)*rect.height/2;minX=Math.min(minX,sx);minY=Math.min(minY,sy);maxX=Math.max(maxX,sx);maxY=Math.max(maxY,sy);}container.dataset.playerModelBounds=JSON.stringify({x:minX,y:minY,width:maxX-minX,height:maxY-minY});}
      }
    },
    dispose(){if(disposed)return;disposed=true;renderer.domElement.removeEventListener('webglcontextlost',lose);renderer.domElement.remove();container.removeAttribute('data-character-renderer');container.removeAttribute('data-environment-renderer');environment?.dispose?.();const geometrySet=new Set(),materialSet=new Set();scene.traverse(o=>{if(o.geometry)geometrySet.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materialSet.add(m);});geometrySet.forEach(g=>g.dispose());materialSet.forEach(m=>m.dispose());sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();}
  };
}

/** Full-body resident preview using the same proportioned, jointed game model. */
export function mountAvatarPreview(container,appearance={}){
  if(!container)return Object.assign(()=>{},{update:()=>{}});
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return Object.assign(()=>{},{update:()=>{}});}
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,2));renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.domElement.className='resident-avatar-3d';renderer.domElement.setAttribute('aria-label','Three-dimensional resident preview');container.append(renderer.domElement);container.dataset.avatarRenderer='webgl-3d';
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-43,43,61,-61,1,1000);
  camera.position.set(95,80,270);camera.lookAt(0,55,0);
  scene.add(new THREE.HemisphereLight('#fff0d7','#57655e',2.6));
  const key=new THREE.DirectionalLight('#fff3df',3.3);key.position.set(-80,170,140);scene.add(key);
  const rim=new THREE.DirectionalLight('#d8dfed',1.6);rim.position.set(90,110,-140);scene.add(rim);
  let rig=character(appearance),raf=0,disposed=false,width=0,height=0;scene.add(rig.root);
  const draw=t=>{if(disposed)return;raf=requestAnimationFrame(draw);if(document.hidden)return;const rect=container.getBoundingClientRect();if(rect.width!==width||rect.height!==height){width=rect.width;height=rect.height;renderer.setSize(width||220,height||300,false);const aspect=(width||220)/(height||300);camera.left=-61*aspect;camera.right=61*aspect;camera.updateProjectionMatrix();}rig.body.position.y=Math.sin(t*.002)*.35;rig.head.rotation.y=Math.sin(t*.0003)*.06;renderer.render(scene,camera);};
  raf=requestAnimationFrame(draw);
  const release=model=>model.traverse(o=>{o.geometry?.dispose();if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();});
  const cleanup=()=>{disposed=true;cancelAnimationFrame(raf);release(rig.root);renderer.domElement.remove();renderer.dispose();renderer.forceContextLoss();container.removeAttribute('data-avatar-renderer');};
  cleanup.update=next=>{scene.remove(rig.root);release(rig.root);rig=character(next);scene.add(rig.root);};
  return cleanup;
}

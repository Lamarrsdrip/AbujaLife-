// Original, articulated residents. The same rig appears in the city, signup and shops.
// Human silhouettes and visible hairstyles use geometry; no downloaded character assets.
import * as THREE from './vendor/three.module.js';
import { batchRigidMeshes } from './world-3d-scenes.js';
import { createWorldMaterialLibrary } from './world-materials.js';

const DEPTH = Math.SQRT1_2;
const palette = {
  skinTone:{deep:'#694632',brown:'#a06c4b',warm:'#c69069',light:'#ddb28d'},
  top:{ochre:'#bc7848',forest:'#406b57',cream:'#e9e0ca',navy:'#374957',agbada:'#c9ad77'},
  bottom:{charcoal:'#3c4247',denim:'#526a80',cream:'#d7cbbb'},
  shoes:{white:'#efece4',black:'#252b2e'}
};
const pick = (kind,value,fallback) => palette[kind][value] || fallback;
function lathe(parent,mat,points,x,y,z) {
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(points.map(([r,h]) => new THREE.Vector2(r,h)),20),mat);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function strand(parent,mat,points,radius) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve,8,radius,5,false),mat);parent.add(mesh);return mesh;
}

export function createCharacter(appearance={}, {materials}={}) {
  const primitives=new Map();
  const geometry=(key,build)=>{if(!primitives.has(key))primitives.set(key,build());return primitives.get(key);};
  function ellipsoid(parent,mat,x,y,z,rx,ry,rz,segments=14){
    const mesh=new THREE.Mesh(geometry(`sphere:${segments}`,()=>new THREE.SphereGeometry(1,segments,10)),mat);
    mesh.position.set(x,y,z);mesh.scale.set(rx,ry,rz);parent.add(mesh);return mesh;
  }
  function capsule(parent,mat,r,length,x,y,z){
    const mesh=new THREE.Mesh(geometry(`capsule:${r}:${length}`,()=>new THREE.CapsuleGeometry(r,Math.max(.01,length-r*2),4,10)),mat);
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function box(parent,mat,x,y,z,w,h,d){
    const mesh=new THREE.Mesh(geometry(`box:${w}:${h}:${d}`,()=>new THREE.BoxGeometry(w,h,d)),mat);
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  const surfaces = materials || createWorldMaterialLibrary(THREE,{size:64});
  const ownedMaterials = new Set();
  const material = (color,roughness=.76,metalness=0) => {
    const value = new THREE.MeshStandardMaterial({color,roughness,metalness});ownedMaterials.add(value);return value;
  };
  const root = new THREE.Group(),body = new THREE.Group();root.add(body);
  root.name = 'AbujaLife resident';body.name = 'Articulated body';
  const skin = material(pick('skinTone',appearance.skinTone,'#a06c4b'),.68);
  const shirt = surfaces.material('fabric',pick('top',appearance.top,'#406b57'),{repeatX:2,repeatY:2,bumpScale:.045});
  const pants = surfaces.material('fabric',pick('bottom',appearance.bottom,'#3c4247'),{bumpScale:.035});
  const shoes = material(pick('shoes',appearance.shoes,'#efece4'),.55);
  const hair = material(appearance.skinTone==='light'?'#352820':'#201b18',.86);
  const hairHighlight = material(appearance.skinTone==='light'?'#473426':'#302824',.8);
  const seam = material('#252b29'),sole = material('#d2d1c8'),gold = material('#c5a25c',.27,.68);
  const eye = material('#241c17',.25),white = material('#d9ccb7'),lip = material('#78513e'),trim = material('#ead7ad');
  const broad = appearance.body==='broad'?1.14:appearance.body==='slim'?.89:1;
  const feminine = appearance.presentation==='feminine',masculine = appearance.presentation==='masculine';
  const hipWidth = (feminine?10.5:masculine?8.9:9.6)*broad;
  const shoulderWidth = (feminine?10.5:masculine?13:11.8)*broad;
  const waistWidth = (feminine?7.3:masculine?8.8:8.1)*broad;
  const legRadius = (feminine?4.55:4.1)*(appearance.body==='broad'?1.08:1);
  // The height remains constant, so activity poses, door clearance and floor picking stay compatible.
  const hips = new THREE.Group();hips.name='Hips';hips.position.y=48;body.add(hips);
  const pelvis = lathe(hips,pants,[[hipWidth*.87,-2.5],[hipWidth,2],[hipWidth*.98,8],[waistWidth,11]],0,0,0);pelvis.scale.z=.70;
  const legs = [];
  for (const side of [-1,1]) {
    const upper = new THREE.Group();upper.name=side<0?'Left hip':'Right hip';upper.position.set(side*(feminine?5.9:5.15)*broad,0,0);hips.add(upper);
    capsule(upper,pants,legRadius,25,0,-10,0);
    const knee = new THREE.Group();knee.name=side<0?'Left knee':'Right knee';knee.position.y=-22;upper.add(knee);
    capsule(knee,pants,legRadius*.80,22,0,-9.2,0);
    ellipsoid(knee,shoes,0,-22.2,3,4.4,2.7,8.5);
    ellipsoid(knee,sole,0,-25.05,3.1,4.55,.95,8.7);
    box(knee,shoes,0,-20.9,4.5,5.5,1,5.6);
    for (const x of [-1.8,0,1.8]) box(knee,trim,x,-20.4,5.8,.45,.35,2.4);
    legs.push({upper,knee});
  }
  const torso = new THREE.Group();torso.name='Torso';torso.position.y=51;body.add(torso);
  const torsoMesh = lathe(torso,shirt,[[waistWidth,0],[waistWidth*.99,5],[waistWidth*1.03,12],[shoulderWidth*.94,24],[shoulderWidth*.87,29],[4.9,33]],0,0,0);torsoMesh.scale.z=feminine?.74:.66;
  ellipsoid(torso,shirt,0,24,0,shoulderWidth,6.7,6.3);
  if (feminine) {
    // Rounded cloth contours, rather than bolted-on spheres, connect chest to waist.
    for (const side of [-1,1]) ellipsoid(torso,shirt,side*3.65,21,3.25,4.3,5.7,2.5);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(4.45,.52,5,18),trim);collar.rotation.x=Math.PI/2;collar.position.set(0,31.5,0);torso.add(collar);
  box(torso,shirt,0,1,5.1,waistWidth*1.8,1.15,.65);
  if (appearance.top==='cream'||appearance.top==='navy') {
    box(torso,trim,0,16,6.4,.7,25,.3);
    for (let h=8;h<=28;h+=6) ellipsoid(torso,trim,0,h,6.7,.44,.44,.28,8);
    box(torso,shirt,-5.9,21,6.2,4.4,4,.65);
  }
  const arms = [];
  for (const side of [-1,1]) {
    const shoulder = new THREE.Group();shoulder.name=side<0?'Left shoulder':'Right shoulder';shoulder.position.set(side*shoulderWidth,25,0);torso.add(shoulder);
    capsule(shoulder,shirt,feminine?3.7:4.4,13,side*.5,-4,0);
    capsule(shoulder,skin,feminine?2.65:3.05,17,side*1.25,-11,0);
    const elbow = new THREE.Group();elbow.name=side<0?'Left elbow':'Right elbow';elbow.position.set(side*1.25,-18,0);shoulder.add(elbow);
    capsule(elbow,skin,feminine?2.3:2.55,16,0,-6.5,.6);
    ellipsoid(elbow,skin,0,-15.6,1,feminine?2.35:2.65,4.1,2.05);
    ellipsoid(elbow,skin,-side*1.65,-14,2.1,1,2.45,1.15);
    arms.push({shoulder,elbow});
  }
  if (appearance.top==='agbada') {
    const robe = lathe(torso,shirt,[[13,-12],[14,0],[13,20],[11,28],[5,32]],0,0,0);robe.scale.z=.7;
    for (const side of [-1,1]) {const sleeve=ellipsoid(torso,shirt,side*15,16,0,10,13,5);sleeve.rotation.z=side*.25;box(torso,trim,side*3,15,9.4,1,21,.6);}
    box(torso,trim,0,15,9.7,1,28,.6);
  }
  capsule(body,skin,feminine?3.5:4.1,12,0,85,0);
  const head = new THREE.Group();head.name='Head and hairstyle';head.position.set(0,96,0);body.add(head);
  const faceWidth = (appearance.face==='round'?8.15:appearance.face==='angular'?7.25:7.65)*(feminine?.96:1);
  const jawWidth = feminine?(appearance.face==='angular'?5.4:4.2):masculine?(appearance.face==='angular'?6.25:5.2):4.7;
  const face = lathe(head,skin,[[.7,-9.8],[jawWidth,-8.7],[6.65,-5.1],[faceWidth,.5],[faceWidth,5],[6.45,8.5],[3.3,10.1],[.1,10.6]],0,0,0);face.scale.z=.87;
  for (const side of [-1,1]) {
    ellipsoid(head,skin,side*7.5,-1,0,1.35,3.0,1.8);
    ellipsoid(head,lip,side*8.0,-1,1,.5,1.4,.6);
    ellipsoid(head,white,side*3.1,1.1,6.25,1.65,.64,.35);
    ellipsoid(head,eye,side*3.0,1.15,6.57,.60,.59,.28);
    ellipsoid(head,white,side*3.05+.16,1.31,6.82,.14,.15,.10,8);
    const brow=ellipsoid(head,hair,side*3.1,2.6,6.2,1.95,feminine?.31:.45,.5);brow.rotation.z=side*-.065;
    if (feminine) {
      const earring = new THREE.Mesh(new THREE.TorusGeometry(.9,.23,5,10),gold);earring.position.set(side*8.15,-3.4,.5);head.add(earring);
      const lash=ellipsoid(head,hair,side*3.1,1.9,6.50,1.8,.17,.25);lash.rotation.z=side*.055;
    }
  }
  ellipsoid(head,skin,0,-.7,6.55,feminine?1.25:1.45,2.4,1.45);
  ellipsoid(head,skin,0,-2.6,6.95,feminine?1.55:1.8,1,1.25);
  ellipsoid(head,lip,0,-5.3,6.4,feminine?2.7:2.4,feminine?.57:.43,.47);
  ellipsoid(head,skin,0,-5.95,6.2,2.45,.36,.36);
  if (appearance.facialHair==='beard') {
    const beard=lathe(head,hair,[[2.2,-9.9],[5.6,-8],[7.15,-4.8],[7.3,-2.8]],0,0,-.15);beard.scale.z=.90;
    ellipsoid(head,lip,0,-5.3,6.62,2.3,.47,.38);
  }
  const hairstyle = appearance.hair || (feminine?'braids':'crop');
  const hairstyleGroup = new THREE.Group();hairstyleGroup.name=`Hairstyle ${hairstyle}`;head.add(hairstyleGroup);
  if (hairstyle!=='bald') {
    const cap = ellipsoid(hairstyleGroup,hair,0,5.9,-.8,8.15,5.6,7.3);
    if (hairstyle==='afro') {
      cap.scale.multiplyScalar(1.22);
      for (let i=0;i<22;i++) {const a=i*2.39996,y=5+Math.sin(i*1.61)*5;ellipsoid(hairstyleGroup,i%4?hair:hairHighlight,Math.cos(a)*8.6,y,-.6+Math.sin(a)*7.7,4.0,4.2,3.7,10);}
    } else if (hairstyle==='braids'||hairstyle==='locs'||hairstyle==='twists') {
      const count=hairstyle==='braids'?14:hairstyle==='twists'?10:12;
      const radius=hairstyle==='braids'?.91:hairstyle==='twists'?1.55:1.42;
      for (let i=0;i<count;i++) {
        const a=i/count*Math.PI*2,x=Math.sin(a)*7.4,z=Math.cos(a)*6.8;
        const length=(hairstyle==='braids'?22:hairstyle==='twists'?15:19)+(i%3)*2;
        strand(hairstyleGroup,i%4?hair:hairHighlight,[[x*.55,8,z*.55],[x,3,z],[x*1.08,-length*.42,z+1],[x*.91,-length+7,z+1.8]],radius);
        if (hairstyle==='braids'&&i%3===0) ellipsoid(hairstyleGroup,gold,x*.91,-length+7,z+1.8,1.0,1.25,1.0,8);
      }
      // Crown parting stays visible when looking down into an Abuja home.
      for (let i=0;i<6;i++) strand(hairstyleGroup,hairHighlight,[[-6+i*2.3,7,-6],[-4+i*1.5,10,0],[-6+i*2.3,6,5]],.33);
    } else if (hairstyle==='bun') {
      const swept=ellipsoid(hairstyleGroup,hair,0,4,-4,8.2,7.1,5.1);swept.rotation.x=-.12;
      ellipsoid(hairstyleGroup,hair,0,10.5,-6,5.9,5.6,5.5);
      const tie=new THREE.Mesh(new THREE.TorusGeometry(4.6,.48,5,16),gold);tie.rotation.x=.7;tie.position.set(0,10.0,-6);hairstyleGroup.add(tie);
      for (let i=0;i<5;i++) strand(hairstyleGroup,hairHighlight,[[-6+i*3,4,5],[-4+i*2,10,-1],[-3+i*1.5,11,-6]],.24);
    } else if (hairstyle==='long') {
      const back=ellipsoid(hairstyleGroup,hair,0,-7,-5,8.65,16,4.9);back.rotation.x=-.10;
      for (const side of [-1,1]) for (let i=0;i<3;i++) strand(hairstyleGroup,i===1?hairHighlight:hair,[[side*(5.6+i*.8),6,1],[side*(8+i*.6),-2,2.8],[side*(8+i*.4),-15,4],[side*(6.7+i*.5),-23,3]],1.2);
      strand(hairstyleGroup,hairHighlight,[[0,10,5],[0,11,0],[0,9,-5]],.26);
    } else {
      // Low cut: defined temples, a fade, and a softly textured crown.
      cap.scale.y *= .55;cap.position.y=7.7;
      for (const side of [-1,1]) ellipsoid(hairstyleGroup,hair,side*7.1,3,-1,1.4,4.3,4.8,10);
      for (let i=0;i<10;i++) {const a=i*2.39996;ellipsoid(hairstyleGroup,i%3?hair:hairHighlight,Math.cos(a)*5.8,10.3,-.6+Math.sin(a)*4.8,2.6,.9,2.1,8);}
    }
  }
  if (appearance.accessory==='glasses') {
    for (const side of [-1,1]) {const ring=new THREE.Mesh(new THREE.TorusGeometry(2.45,.28,5,16),seam);ring.scale.y=.7;ring.position.set(side*3.1,1.15,6.95);head.add(ring);}
    box(head,seam,0,1.25,7,1.4,.4,.45);box(head,seam,-7,1,2.5,.4,.4,9);box(head,seam,7,1,2.5,.4,.4,9);
  }
  root.traverse(part => {if(part.isMesh){part.castShadow=true;part.receiveShadow=true;}});
  // More detail without a draw call per braid: retain the articulated joints.
  const joints=[];root.traverse(part => {if(part.isGroup)joints.push(part);});
  const sources=new Set();root.traverse(part=>{if(part.geometry)sources.add(part.geometry);});
  // Repeated eyes, hair contours, hands and shoes reuse source primitives. A
  // source may still belong to another joint, so release it only after batching.
  for (const joint of joints) batchRigidMeshes(THREE,joint);
  const attached=new Set();root.traverse(part=>{if(part.geometry)attached.add(part.geometry);});
  for(const source of sources)if(!attached.has(source))source.dispose();sources.clear();primitives.clear();
  root.userData = {appearance:{...appearance},proportions:{hipWidth,shoulderWidth,waistWidth},hairstyle};
  let released=false;
  function dispose() {
    if(released)return;released=true;
    const geometries=new Set();root.traverse(part => {if(part.geometry)geometries.add(part.geometry);});
    for (const geometry of geometries) geometry.dispose();
    for (const value of ownedMaterials) value.dispose();
    if(!materials) surfaces.dispose();
  }
  root.dispose=dispose;
  return {root,body,torso,head,arms,legs,neutral:{bodyY:0},dispose};
}
export function animateCharacter(rig,{x,y,angle=90,moving=false,phase=0,time=0,activity=null,scale=1,elevation=0}={}){
  rig.root.position.set(x,elevation,y/DEPTH);rig.root.scale.setScalar(scale);
  if(activity?.object){const o=activity.object;rig.root.position.set(o.x+o.w/2,0,(o.y+o.h/2)/DEPTH);}
  // SVG world angle zero points right; Three local +Z is forward.
  const target=Math.PI/2-angle*Math.PI/180;
  let delta=(target-rig.root.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI;
  const dt=Number.isFinite(rig.animationTime)?Math.max(1/240,Math.min(1/15,time-rig.animationTime)):1/60;
  rig.animationTime=time;
  rig.root.rotation.y+=delta*(1-Math.exp(-13.4*dt));
  rig.body.position.set(0,0,0);rig.body.rotation.set(0,0,0);rig.torso.rotation.set(0,0,0);rig.head.rotation.set(0,0,0);
  rig.body.position.y=moving?Math.abs(Math.sin(phase))*1.7:Math.sin(time*2)*.3;
  for(let i=0;i<2;i++){
    const swing=moving?Math.sin(phase+i*Math.PI):0;
    rig.legs[i].upper.rotation.set(swing*.48,0,0);
    rig.legs[i].knee.rotation.set(moving?Math.max(0,-swing)*.68:0,0,0);
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

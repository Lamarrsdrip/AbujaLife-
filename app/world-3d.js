// Real, locally bundled WebGL characters and original dollhouse environments.
// The SVG interaction plane uses the same oblique floor projection as the camera.
import * as THREE from './vendor/three.module.js';
import { buildThreeEnvironment, batchRigidMeshes } from './world-3d-scenes.js';
import { applyWorldCamera } from './world-camera.js';
import { createCharacter as character, animateCharacter as animate } from './world-character.js';
import { ambientAppearance } from '../src/shared/avatars.mjs';
import { furnitureSurfaceRect } from '../src/shared/furniture-metadata.mjs';
import { createWorldMaterialLibrary } from './world-materials.js';
import { createWorldEnvironmentLighting } from './world-lighting.js';

const DEPTH = Math.SQRT1_2;
const avatarPreviews=new WeakMap();
const palette = {
  skinTone:{deep:'#694632',brown:'#a06c4b',warm:'#c69069',light:'#ddb28d'},
  top:{ochre:'#bc7848',forest:'#406b57',cream:'#e9e0ca',navy:'#374957',agbada:'#c9ad77'},
  bottom:{charcoal:'#3c4247',denim:'#526a80',cream:'#d7cbbb'},
  shoes:{white:'#efece4',black:'#252b2e'}
};
const pick=(kind,value,fallback)=>palette[kind][value]||fallback;
function material(color,roughness=.76,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
function ellipsoid(parent,mat,x,y,z,rx,ry,rz,segments=16){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,segments,12),mat);mesh.position.set(x,y,z);mesh.scale.set(rx,ry,rz);parent.add(mesh);return mesh;}
function capsule(parent,mat,r,length,x,y,z){const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.01,length-r*2),4,12),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
function box(parent,mat,x,y,z,w,h,d){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
function lathe(parent,mat,points,x,y,z){const mesh=new THREE.Mesh(new THREE.LatheGeometry(points.map(([r,h])=>new THREE.Vector2(r,h)),24),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}

export function createCharacterModel(appearance={}) {return character(appearance).root;}

export function createCharacterRenderer(container,{appearance={},pedestrians=[],neighbours=[],scene:gameScene,profile,kind,venue,place}={}){
  let renderer;
  const coarse=globalThis.matchMedia?.('(pointer: coarse)').matches===true||(globalThis.navigator?.maxTouchPoints||0)>0;
  const narrow=(container.clientWidth>0&&container.clientWidth<700)||globalThis.matchMedia?.('(max-width: 700px)').matches===true;
  const memory=Number(globalThis.navigator?.deviceMemory||8);
  const constrained=Number.isFinite(memory)&&memory<=2;
  const mobile=coarse||narrow;
  // Modern phones get the same authored light/shadow model as desktop. Only
  // genuinely constrained devices fall back to the no-shadow path.
  const shadows=!constrained;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:!constrained,powerPreference:constrained?'low-power':'high-performance'});}catch{return null;}
  const maxPixelRatio=Math.min(globalThis.devicePixelRatio||1,constrained?1:mobile?1.3:1.8);
  renderer.setPixelRatio(maxPixelRatio);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.setClearColor(0x000000,0);renderer.domElement.className='world-character-layer';renderer.domElement.setAttribute('aria-hidden','true');
  container.append(renderer.domElement);container.dataset.characterRenderer='webgl-3d';container.dataset.renderQuality=constrained?'compatibility':'premium';
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-500,500,325,-325,1,12000);
  const environment=gameScene?buildThreeEnvironment(THREE,{scene:gameScene,profile,kind,venue,place,depthScale:1/DEPTH}):null;
  if(environment){scene.add(environment.group||environment);container.dataset.environmentRenderer='webgl-3d';container.dataset.environmentObjects=JSON.stringify(gameScene.objects?.map(o=>o.kind)||[]);let count=0;(environment.group||environment).traverse(o=>{if(o.isMesh)count++;});container.dataset.environmentMeshes=String(count);}
  const ambient=new THREE.HemisphereLight('#fff0d7','#586251',1.5);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#ffe9c8',2.65);sun.position.set(-550,1200,650);sun.castShadow=shadows;sun.shadow.mapSize.set(mobile?512:1024,mobile?512:1024);sun.shadow.camera.left=-1050;sun.shadow.camera.right=1050;sun.shadow.camera.top=1050;sun.shadow.camera.bottom=-1050;sun.shadow.camera.near=10;sun.shadow.camera.far=3200;sun.shadow.bias=-.00035;sun.shadow.normalBias=.7;sun.shadow.radius=3;scene.add(sun,sun.target);
  const rim=new THREE.DirectionalLight('#d5e6ee',.68);rim.position.set(300,300,-600);scene.add(rim);
  const characterSurfaces=createWorldMaterialLibrary(THREE,{size:64}),resident=appearance=>character(appearance,{materials:characterSurfaces});
  const own=resident(appearance);scene.add(own.root);
  const npcs=pedestrians.map((n,i)=>{const rig=resident(ambientAppearance(`${gameScene?.title||'Abuja'}:${i}`));scene.add(rig.root);return rig;});
  let online=neighbours.map(p=>{const rig=resident(p.appearance);scene.add(rig.root);return rig;});
  let onlineById=new Map(neighbours.map((person,i)=>[String(person.id),{rig:online[i],appearance:JSON.stringify(person.appearance)}]));
  const syncResidentFallbacks=()=>{
    const ids=new Set(onlineById.keys());
    container.querySelectorAll?.('[data-world-resident]').forEach(node=>node.classList.toggle('has-webgl-resident',!lost&&ids.has(String(node.dataset.worldResident))));
    container.dataset.webglResidents=String(ids.size);
  };
  const rainGeometry=new THREE.BufferGeometry(),rainPositions=new Float32Array(180*6);rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));const rainMaterial=new THREE.LineBasicMaterial({color:'#c3d9e8',transparent:true,opacity:.36,depthWrite:false});const rain=new THREE.LineSegments(rainGeometry,rainMaterial);rain.frustumCulled=false;scene.add(rain);
  const shower=new THREE.Group();const dropMaterial=new THREE.MeshStandardMaterial({color:'#b3e3ea',transparent:true,opacity:.7,roughness:.1,emissive:'#5c9aa7',emissiveIntensity:.2});for(let i=0;i<28;i++)ellipsoid(shower,dropMaterial,0,0,0,.7,2.8,.7,6);scene.add(shower);
  const isClub=venue?.kind==='club'||['club','club-cage','magic-city','bear-barn'].includes(venue?.id);
  const indoors=kind==='home'||kind==='visit'||kind==='venue'&&!['park','jabi-lake'].includes(venue?.id);
  const ibl=createWorldEnvironmentLighting(THREE,renderer,{indoors,constrained});
  if(ibl.texture){scene.environment=ibl.texture;scene.environmentIntensity=indoors?.72:.38;container.dataset.environmentLighting='pmrem';}
  else container.dataset.environmentLighting='compatibility';
  const clubPalette=venue?.id==='club-cage'?['#42ddff','#8e72ff','#ff4d9d','#78f0b0']:venue?.id==='magic-city'?['#ff63ca','#bd8bff','#ffd36c','#70d8ff']:venue?.id==='bear-barn'?['#ffb35d','#d97683','#82a58f','#f0d28e']:['#ff43ad','#5ce2ff','#b27cff','#ffc95f'];
  const clubColors=clubPalette.map(value=>new THREE.Color(value));
  const clubLights=[];
  if(isClub){const lightCount=mobile?2:4;for(let i=0;i<lightCount;i++){const light=new THREE.PointLight(clubPalette[i%clubPalette.length],0,mobile?430:560,2);light.castShadow=false;scene.add(light);clubLights.push(light);}}
  let previousWidth=0,previousHeight=0,lost=false,disposed=false,frames=0,viewWidth=0,viewHeight=0,lastLightKey='';
  let qualityStart=performance.now(),qualityFrames=0;
  let lastRender=-Infinity,lastShadow=-Infinity,shadowDirty=true,cameraDirty=true,previousCamera=null;
  let litDaylight,litNight,litCloud,litClub;
  const bounds=new THREE.Box3(),partBounds=new THREE.Box3(),projected=new THREE.Vector3();
  const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),pickRay=new THREE.Raycaster(),pickPoint=new THREE.Vector3(),pickNdc=new THREE.Vector2();
  const surfacePlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const updateCamera=({x,y,width,height,yaw,elevation})=>{if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return false;viewWidth=width;viewHeight=height;if(previousCamera&&previousCamera.x===x&&previousCamera.y===y&&previousCamera.width===width&&previousCamera.height===height&&previousCamera.yaw===yaw&&previousCamera.elevation===elevation)return true;previousCamera={x,y,width,height,yaw,elevation};cameraDirty=true;return applyWorldCamera(camera,{x,y,width,height,yaw,elevation,oblique:true});};
  const lose=event=>{event.preventDefault();lost=true;container.dataset.webglContext='lost';container.removeAttribute('data-character-renderer');container.removeAttribute('data-environment-renderer');syncResidentFallbacks();};
  const restore=()=>{if(disposed)return;lost=false;previousWidth=0;previousHeight=0;cameraDirty=true;shadowDirty=true;previousCamera=null;container.dataset.webglContext='restored';container.dataset.characterRenderer='webgl-3d';if(environment)container.dataset.environmentRenderer='webgl-3d';syncResidentFallbacks();};
  renderer.domElement.addEventListener('webglcontextlost',lose);renderer.domElement.addEventListener('webglcontextrestored',restore);
  let onlineKey=JSON.stringify(neighbours.map(p=>[p.id,p.appearance]));
  queueMicrotask(syncResidentFallbacks);
  return {
    setCameraViewport:updateCamera,
    setFurniturePreview(item,options){return environment?.setFurniturePreview?.(item,options);},
    setFurnitureHidden(itemId,hidden){environment?.setFurnitureHidden?.(itemId,hidden);shadowDirty=true;},
    pickFurniture(clientX,clientY){if(lost||disposed||!viewWidth)return null;const rect=container.getBoundingClientRect();pickNdc.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);pickRay.setFromCamera(pickNdc,camera);const items=(environment?.furnitureObjects?.()||[]).filter(item=>item.visible);const hit=pickRay.intersectObjects(items,true)[0];if(!hit)return null;for(let object=hit.object;object;object=object.parent)if(object.userData.itemId)return object.userData.itemId;return null;},
    screenToGround(clientX,clientY){if(lost||disposed||!viewWidth)return null;const rect=container.getBoundingClientRect();pickNdc.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);pickRay.setFromCamera(pickNdc,camera);return pickRay.ray.intersectPlane(groundPlane,pickPoint)?{x:pickPoint.x,y:pickPoint.z*DEPTH}:null;},
    screenToFurnitureSurface(clientX,clientY,excludeId){if(lost||disposed||!viewWidth)return null;const rect=container.getBoundingClientRect();pickNdc.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);pickRay.setFromCamera(pickNdc,camera);let nearest=null,best=Infinity;for(const item of environment?.furnitureObjects?.()||[]){if(!item.visible||item.userData.itemId===excludeId)continue;const data=item.userData,area=furnitureSurfaceRect({...data.footprint,itemId:data.itemId});if(!area)continue;const height=area.height+(data.elevation||0);surfacePlane.constant=-height;if(!pickRay.ray.intersectPlane(surfacePlane,pickPoint))continue;const x=pickPoint.x,y=pickPoint.z*DEPTH;if(x<area.x||x>area.x+area.w||y<area.y||y>area.y+area.h)continue;const distance=pickRay.ray.origin.distanceToSquared(pickPoint);if(distance<best){best=distance;nearest={x,y,supportId:data.itemId,elevation:height};}}return nearest;},
    projectWorld(point){if(lost||disposed||!viewWidth)return null;const rect=container.getBoundingClientRect();projected.set(point.x,point.elevation||0,point.y/DEPTH).project(camera);return{x:rect.left+(projected.x+1)*rect.width/2,y:rect.top+(1-projected.y)*rect.height/2,z:projected.z};},
    projectGround(point){if(lost||disposed||!viewWidth)return null;const rect=container.getBoundingClientRect();projected.set(point.x,0,point.y/DEPTH).project(camera);return{x:rect.left+(projected.x+1)*rect.width/2,y:rect.top+(1-projected.y)*rect.height/2};},
    setResidents(people){
      if(disposed)return;
      const key=JSON.stringify(people.map(p=>[p.id,p.appearance]));
      if(key===onlineKey){syncResidentFallbacks();return;}
      onlineKey=key;
      const next=new Map();
      online=people.map(person=>{const id=String(person.id),appearance=JSON.stringify(person.appearance),current=onlineById.get(id);if(current?.appearance===appearance){if(person.pose)animate(current.rig,{...person.pose,scale:1.4,time:0});next.set(id,current);return current.rig;}const rig=resident(person.appearance);if(person.pose)animate(rig,{...person.pose,scale:1.4,time:0});scene.add(rig.root);next.set(id,{rig,appearance});return rig;});
      for(const[id,entry]of onlineById)if(next.get(id)!==entry){scene.remove(entry.rig.root);entry.rig.dispose();}
      onlineById=next;shadowDirty=true;syncResidentFallbacks();
      // A resident may arrive while the main world loop is idle. Paint one
      // authoritative frame immediately so the character appears with the name tag.
      if(!lost&&viewWidth>0&&container.isConnected!==false){renderer.render(scene,camera);}
    },
    draw({player,camera:position,width,height,orientation={},angle,phase,time,moving,transport,driving,activity,clock,weather,clubOpen,carColor,carStyle,ownVehicle,parked,trafficPositions,trip,npcPositions=[],onlinePositions=[]}){
      if(lost||disposed||container.isConnected===false||document.hidden)return;
      const now=performance.now(),cameraChanged=cameraDirty||!previousCamera||previousCamera.x!==position.x||previousCamera.y!==position.y||previousCamera.width!==width||previousCamera.height!==height||previousCamera.yaw!==orientation.yaw||previousCamera.elevation!==orientation.elevation;
      const playerBusy=cameraChanged||moving||transport||activity||environment?.furniturePreview?.();
      const lively=!indoors&&(weather?.condition==='rain'||npcPositions.some(p=>p.moving||p.activity)||isClub&&clubOpen);
      const lightKey=`${clock?.isNight?'n':'d'}:${weather?.condition||'clear'}:${Math.round(Number(clock?.sunlight??1)*4)}`;
      if(frames>0&&!playerBusy&&lightKey===lastLightKey&&!shadowDirty&&(!lively||now-lastRender<80))return;
      lastLightKey=lightKey;const dynamic=playerBusy||lively;if(!dynamic&&!shadowDirty&&now-lastRender<1000/30-1)return;lastRender=now;
      const rect=container.getBoundingClientRect();if(rect.width<2||rect.height<2)return;const renderWidth=Math.round(rect.width),renderHeight=Math.round(rect.height);if(renderWidth!==previousWidth||renderHeight!==previousHeight){renderer.setSize(renderWidth,renderHeight,false);previousWidth=renderWidth;previousHeight=renderHeight;}
      updateCamera({...position,width,height,...orientation});environment?.updateView?.(orientation);sun.position.set(position.x-550,1200,position.y/DEPTH+650);sun.target.position.set(position.x,0,position.y/DEPTH);
      const daylight=clock?.sunlight??1,night=clock?.isNight??false,cloud=weather?.condition==='rain'?.72:weather?.condition==='cloudy'?.84:1;
      if(daylight!==litDaylight||night!==litNight||cloud!==litCloud||clubOpen!==litClub){ambient.intensity=indoors?(isClub&&clubOpen?.48:.74):.55+daylight*.69*cloud;ambient.color.set(indoors?'#f7e6cd':night?'#b8c7e7':'#fff0d4');ambient.groundColor.set(indoors?'#665e51':night?'#3b4d60':'#52604f');sun.intensity=indoors?(isClub&&clubOpen?.75:2.8):(night?.4:Math.pow(daylight,.5)*2.45)*cloud;sun.color.set(indoors?'#ffe4bd':night?'#a6bdea':daylight<.3?'#edbf91':'#ffedcf');rim.intensity=indoors?.62:night?.5:.58;litDaylight=daylight;litNight=night;litCloud=cloud;litClub=clubOpen;}
      if(isClub){const partyOn=Boolean(clubOpen),clubTime=Number(time)||0;renderer.toneMappingExposure=partyOn?1.16:1.06;clubLights.forEach((light,i)=>{light.visible=partyOn;if(!partyOn)return;const phase=(clubTime*.34+i*.83)%clubColors.length,index=Math.floor(phase),mix=phase-index;light.color.copy(clubColors[index]).lerp(clubColors[(index+1)%clubColors.length],mix);light.intensity=(mobile?3.2:4.8)*(.78+Math.sin(clubTime*3.1+i*1.7)*.22);light.position.set(765+Math.sin(clubTime*.72+i*2.05)*430,205+Math.sin(clubTime*1.45+i)*55,(585+Math.cos(clubTime*.88+i*1.31)*285)/DEPTH);});rim.color.set(partyOn?clubPalette[1]:'#ceddec');}else renderer.toneMappingExposure=1.12;
      rain.visible=!indoors&&weather?.condition==='rain';if(rain.visible){for(let i=0;i<180;i++){const j=i*6,rx=position.x+((i*137.51+time*28)%width)-width/2,rz=position.y/DEPTH+((i*89.23)%(height/DEPTH))-height/DEPTH/2,ry=410-(i*61.5+time*330)%410;rainPositions.set([rx,ry,rz,rx-1.3,ry+16,rz],j);}rainGeometry.attributes.position.needsUpdate=true;}
      own.root.visible=!transport;animate(own,{...player,angle,phase,time,moving,activity,scale:1.6});npcPositions.forEach((p,i)=>{const club=isClub;npcs[i].root.visible=!club||clubOpen||i===0;animate(npcs[i],{...p,activity:club&&!clubOpen?null:p.activity,time,scale:1.28});});onlinePositions.forEach((p,i)=>{if(online[i])animate(online[i],{...p,time,scale:1.4});});
      shower.visible=activity?.name==='shower';if(shower.visible){shower.position.copy(own.root.position);shower.children.forEach((drop,i)=>{drop.position.set(Math.sin(i*2.4)*13,165-((i*19+time*98)%151),Math.cos(i*2.4)*15);});}
      container.dataset.activityPose=activity?.name||'';environment?.update?.({clock,weather,clubOpen,elapsed:time,player,angle,transport,driving,carColor,carStyle,ownVehicle,parked,trafficPositions,trip});
      renderer.shadowMap.needsUpdate=shadows&&(shadowDirty||now-lastShadow>=(dynamic?(mobile?80:1000/30):180));if(renderer.shadowMap.needsUpdate){lastShadow=now;shadowDirty=false;}renderer.render(scene,camera);cameraDirty=false;syncResidentFallbacks();
      if(frames%6===0){container.dataset.renderCalls=String(renderer.info.render.calls);container.dataset.renderTriangles=String(renderer.info.render.triangles);const preview=environment?.furniturePreview?.();if(preview){bounds.setFromObject(preview);let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){projected.set(x,y,z).project(camera);const px=rect.left+(projected.x+1)*rect.width/2,py=rect.top+(1-projected.y)*rect.height/2;minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);}container.dataset.furnitureModelBounds=JSON.stringify({x:minX,y:minY,width:maxX-minX,height:maxY-minY});}else delete container.dataset.furnitureModelBounds;}
      if(mobile&&++qualityFrames>=20&&performance.now()-qualityStart>=2500){const fps=qualityFrames*1000/(performance.now()-qualityStart);if(fps<28&&renderer.getPixelRatio()>1)renderer.setPixelRatio(1);qualityStart=performance.now();qualityFrames=0;}
      if(++frames%10===0){const model=transport?environment?.playerModel?.():own.root;if(model?.visible){bounds.makeEmpty();model.traverse(part=>{if(part.isMesh&&!part.userData.excludeFromBounds){if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();bounds.union(partBounds.copy(part.geometry.boundingBox).applyMatrix4(part.matrixWorld));}});let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){projected.set(x,y,z).project(camera);const sx=rect.left+(projected.x+1)*rect.width/2,sy=rect.top+(1-projected.y)*rect.height/2;minX=Math.min(minX,sx);minY=Math.min(minY,sy);maxX=Math.max(maxX,sx);maxY=Math.max(maxY,sy);}container.dataset.playerModelBounds=JSON.stringify({x:minX,y:minY,width:maxX-minX,height:maxY-minY});}}
    },
    dispose(){if(disposed)return;disposed=true;container.querySelectorAll?.('[data-world-resident].has-webgl-resident').forEach(node=>node.classList.remove('has-webgl-resident'));renderer.domElement.removeEventListener('webglcontextlost',lose);renderer.domElement.removeEventListener('webglcontextrestored',restore);renderer.domElement.remove();container.removeAttribute('data-character-renderer');container.removeAttribute('data-environment-renderer');container.removeAttribute('data-webgl-residents');container.removeAttribute('data-environment-lighting');if(environment){scene.remove(environment.group);environment.dispose();}ibl.dispose();scene.environment=null;scene.remove(own.root);own.dispose();for(const rig of[...npcs,...online]){scene.remove(rig.root);rig.dispose();}characterSurfaces.dispose();const geometrySet=new Set(),materialSet=new Set();scene.traverse(o=>{if(o.geometry)geometrySet.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materialSet.add(m);});geometrySet.forEach(g=>g.dispose());materialSet.forEach(m=>m.dispose());sun.shadow.map?.dispose();renderer.dispose();}
  };
}

/** Full-body resident preview using the same proportioned, jointed game model. */
export function mountAvatarPreview(container,appearance={}){
  if(!container)return Object.assign(()=>{},{update:()=>{}});
  avatarPreviews.get(container)?.();
  const lightweight=globalThis.matchMedia?.('(pointer: coarse)').matches===true||(globalThis.navigator?.maxTouchPoints||0)>0||globalThis.matchMedia?.('(max-width: 700px)').matches===true||(globalThis.navigator?.deviceMemory||8)<=4;
  if(lightweight)return Object.assign(()=>{},{update:()=>{}});
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});}catch{return Object.assign(()=>{},{update:()=>{}});}
  renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.domElement.className='resident-avatar-3d';renderer.domElement.setAttribute('aria-label','Three-dimensional resident preview');container.append(renderer.domElement);container.dataset.avatarRenderer='webgl-3d';
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-43,43,61,-61,1,1000);camera.position.set(95,80,270);camera.lookAt(0,55,0);scene.add(new THREE.HemisphereLight('#fff0d7','#57655e',2.6));const key=new THREE.DirectionalLight('#fff3df',3.3);key.position.set(-80,170,140);scene.add(key);const rim=new THREE.DirectionalLight('#d8dfed',1.6);rim.position.set(90,110,-140);scene.add(rim);
  let rig=character(appearance),raf=0,disposed=false,width=0,height=0,visible=true;scene.add(rig.root);const observer=globalThis.IntersectionObserver?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;}):null;observer?.observe(container);
  const draw=()=>{if(disposed||!visible)return;const rect=container.getBoundingClientRect();if(!rect.width||!rect.height)return;if(rect.width!==width||rect.height!==height){width=rect.width;height=rect.height;renderer.setSize(Math.min(width,420),Math.min(height,560),false);const aspect=width/height;camera.left=-61*aspect;camera.right=61*aspect;camera.updateProjectionMatrix();}renderer.render(scene,camera);};raf=requestAnimationFrame(draw);
  const release=model=>model.dispose?.();
  const cleanup=()=>{if(disposed)return;disposed=true;observer?.disconnect();cancelAnimationFrame(raf);try{renderer.forceContextLoss();}catch{}const canvas=renderer.domElement;try{canvas.width=1;canvas.height=1;canvas.remove();}catch{}container.removeAttribute('data-avatar-renderer');if(avatarPreviews.get(container)===cleanup)avatarPreviews.delete(container);const pending=renderer,model=rig.root;setTimeout(()=>{try{release(model);pending.dispose();}catch{}},1200);};
  cleanup.update=next=>{if(disposed)return;scene.remove(rig.root);release(rig.root);rig=character(next);scene.add(rig.root);cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);};avatarPreviews.set(container,cleanup);return cleanup;
}

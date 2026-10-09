import * as THREE from './vendor/three.module.js';

// Vacant advertising inventory is part of the map surface itself. Keep the
// discoverable plot layer deliberately bounded so opening/panning Map stays fast
// on phones; direct-tap monetization does not depend on rendering every plot.
export function createMapAdParcels(world, parcels, {now=Date.now,maxVisible=96}={}){
 const shape=new THREE.Shape();shape.moveTo(-.5,-.5);shape.lineTo(.5,-.5);shape.lineTo(.5,.5);shape.lineTo(-.5,.5);shape.closePath();
 const hole=new THREE.Path();hole.moveTo(-.43,-.43);hole.lineTo(-.43,.43);hole.lineTo(.43,.43);hole.lineTo(.43,-.43);hole.closePath();shape.holes.push(hole);
 const ring=new THREE.ShapeGeometry(shape),plane=new THREE.PlaneGeometry(1,1);
 const borderMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.98,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
 const fillMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.58,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
 const borders=new THREE.InstancedMesh(ring,borderMaterial,maxVisible),fills=new THREE.InstancedMesh(plane,fillMaterial,maxVisible);
 borders.name='advertising-parcel-boundaries';fills.name='advertising-parcel-land';
 for(const mesh of [fills,borders]){mesh.frustumCulled=false;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);world.add(mesh);}
 const point=new THREE.Vector3(),corner=new THREE.Vector3(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)),scale=new THREE.Vector3(),borderColor=new THREE.Color(),fillColor=new THREE.Color();
 let disposed=false,last=-Infinity,signature='',selected=null,advertising=false,known=new Map();
 function update(state){known=new Map((state?.spaces||[]).map(p=>[p.id,p]));last=-Infinity;}
 function setView(camera,size,{selectedId=null,advertiseMode=false}={}){
  if(disposed||!camera)return;
  const clock=now(),mode=`${selectedId||''}:${advertiseMode}`;
  if(clock-last<240&&mode===signature)return;last=clock;signature=mode;selected=selectedId;advertising=advertiseMode;
  const visible=[];
  for(const p of parcels){
   point.set(p.x+p.width/2,4,p.y+p.height/2).project(camera);corner.set(p.x+p.width,4,p.y+p.height).project(camera);
   const pixels=Math.max(Math.abs(corner.x-point.x)*size.width,Math.abs(corner.y-point.y)*size.height),margin=Math.max(.12,pixels/Math.max(1,Math.min(size.width,size.height)));
   if(point.z<-1||point.z>1||Math.abs(point.x)>1+margin||Math.abs(point.y)>1+margin||pixels<3&&p.id!==selectedId)continue;
   visible.push({p,pixels});
  }
  visible.sort((a,b)=>Number(b.p.id===selectedId)-Number(a.p.id===selectedId)||b.pixels-a.pixels);
  const phoneCap=Math.min(maxVisible,size.width<720?64:maxVisible),shown=visible.slice(0,phoneCap),ids=shown.map(({p})=>p.id);
  for(const mesh of [borders,fills])mesh.userData.adParcelIds=ids;
  shown.forEach(({p},index)=>{
   matrix.compose(new THREE.Vector3(p.x+p.width/2,3.5,p.y+p.height/2),rotation,scale.set(p.width,p.height,1));
   fills.setMatrixAt(index,matrix);matrix.elements[13]=4;borders.setMatrixAt(index,matrix);
   const record=known.get(p.id),reserved=record?.available===false&&Number(new Date(record.expiresAt))>clock,isSelected=p.id===selectedId;
   borderColor.set(isSelected?'#b77d20':reserved?'#657467':advertiseMode?'#8d6a2f':'#486651');
   fillColor.set(isSelected?'#f0d27a':reserved?'#aab4a2':advertiseMode?'#e6d59f':'#d7e0c3');
   borders.setColorAt(index,borderColor);fills.setColorAt(index,fillColor);
  });
  for(const mesh of [fills,borders]){mesh.count=shown.length;mesh.instanceMatrix.needsUpdate=true;mesh.boundingSphere=null;}
  if(borders.instanceColor)borders.instanceColor.needsUpdate=true;if(fills.instanceColor)fills.instanceColor.needsUpdate=true;
  borderMaterial.opacity=1;fillMaterial.opacity=advertiseMode?.72:.58;
 }
 return {update,setView,get diagnostics(){return{visibleParcels:borders.count,totalParcels:parcels.length,maxVisible,selectedId:selected,advertiseMode:advertising,drawCalls:2};},dispose(){if(disposed)return;disposed=true;fills.removeFromParent();borders.removeFromParent();fills.dispose();borders.dispose();ring.dispose();plane.dispose();borderMaterial.dispose();fillMaterial.dispose();}};
}

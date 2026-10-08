import * as THREE from './vendor/three.module.js';

// Inventory is land, not a fabricated campaign. Two shared instanced meshes
// outline the authored parcels without images, DOM cards or per-plot queries.
export function createMapAdParcels(world, parcels, {now=Date.now,maxVisible=96}={}){
 const shape=new THREE.Shape();shape.moveTo(-.5,-.5);shape.lineTo(.5,-.5);shape.lineTo(.5,.5);shape.lineTo(-.5,.5);shape.closePath();
 const hole=new THREE.Path();hole.moveTo(-.48,-.48);hole.lineTo(-.48,.48);hole.lineTo(.48,.48);hole.lineTo(.48,-.48);hole.closePath();shape.holes.push(hole);
 const ring=new THREE.ShapeGeometry(shape),plane=new THREE.PlaneGeometry(1,1);
 const borderMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.9,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
 const fillMaterial=new THREE.MeshBasicMaterial({color:'#f4eed6',transparent:true,opacity:.18,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
 const borders=new THREE.InstancedMesh(ring,borderMaterial,maxVisible),fills=new THREE.InstancedMesh(plane,fillMaterial,maxVisible);
 borders.name='advertising-parcel-boundaries';fills.name='advertising-parcel-land';
 for(const mesh of [fills,borders]){mesh.frustumCulled=false;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);world.add(mesh);}
 const point=new THREE.Vector3(),corner=new THREE.Vector3(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)),scale=new THREE.Vector3(),color=new THREE.Color();
 let disposed=false,last=-Infinity,signature='',selected=null,advertising=false,known=new Map();
 function update(state){known=new Map((state?.spaces||[]).map(p=>[p.id,p]));last=-Infinity;}
 function setView(camera,size,{selectedId=null,advertiseMode=false}={}){
  if(disposed||!camera)return;
  const clock=now(),mode=`${selectedId||''}:${advertiseMode}`;
  if(clock-last<200&&mode===signature)return;last=clock;signature=mode;selected=selectedId;advertising=advertiseMode;
  const visible=[];
  for(const p of parcels){
   point.set(p.x+p.width/2,4,p.y+p.height/2).project(camera);corner.set(p.x+p.width,4,p.y+p.height).project(camera);
   const pixels=Math.max(Math.abs(corner.x-point.x)*size.width,Math.abs(corner.y-point.y)*size.height),margin=Math.max(.12,pixels/Math.max(1,Math.min(size.width,size.height)));
   if(point.z<-1||point.z>1||Math.abs(point.x)>1+margin||Math.abs(point.y)>1+margin||pixels<3&&p.id!==selectedId)continue;
   visible.push({p,pixels});
  }
  visible.sort((a,b)=>Number(b.p.id===selectedId)-Number(a.p.id===selectedId)||b.pixels-a.pixels);
  const shown=visible.slice(0,maxVisible),ids=shown.map(({p})=>p.id);
  for(const mesh of [borders,fills])mesh.userData.adParcelIds=ids;
  shown.forEach(({p},index)=>{
   matrix.compose(new THREE.Vector3(p.x+p.width/2,3.5,p.y+p.height/2),rotation,scale.set(p.width,p.height,1));
   fills.setMatrixAt(index,matrix);matrix.elements[13]=4;borders.setMatrixAt(index,matrix);
   const record=known.get(p.id),reserved=record?.available===false&&Number(new Date(record.expiresAt))>clock;
   color.set(p.id===selectedId?'#e6af45':reserved?'#6e8172':'#486d56');borders.setColorAt(index,color);
  });
  // Raycasting caches its instance bounds separately from render culling. The
  // visible batch moves with the camera, so a previous tap's sphere is stale.
  for(const mesh of [fills,borders]){mesh.count=shown.length;mesh.instanceMatrix.needsUpdate=true;mesh.boundingSphere=null;}
  if(borders.instanceColor)borders.instanceColor.needsUpdate=true;
  borderMaterial.opacity=advertiseMode?1:.9;fillMaterial.opacity=advertiseMode?.28:.18;
 }
 return {update,setView,get diagnostics(){return{visibleParcels:borders.count,totalParcels:parcels.length,maxVisible,selectedId:selected,advertiseMode:advertising,drawCalls:2};},dispose(){if(disposed)return;disposed=true;fills.removeFromParent();borders.removeFromParent();fills.dispose();borders.dispose();ring.dispose();plane.dispose();borderMaterial.dispose();fillMaterial.dispose();}};
}

import * as THREE from './vendor/three.module.js';
import {adSpaceFromId} from '../src/shared/advertising.mjs';
import {adCampaignId,activeAdAt} from './ad-state.js';
import {MAP_BILLBOARD,billboardShape} from './map-billboard.js';

function creativeVersion(source=''){let hash=2166136261;for(let i=0;i<source.length;i++)hash=Math.imul(hash^source.charCodeAt(i),16777619);return `${source.length}-${hash>>>0}`;}
const campaignRef=adCampaignId;
const activeAt=activeAdAt;
const creativeSource=ad=>String(ad?.imageDataUrl||'');
export function mapAdPlacements(campaigns=[],now=Date.now()){
 const seen=new Set();
 return campaigns.filter(ad=>activeAt(ad,now)).flatMap(ad=>(ad.slots||[]).flatMap(id=>{
  const space=adSpaceFromId(id);if(!space||space.eligible===false||seen.has(id))return [];seen.add(id);
  const source=creativeSource(ad);
  return [{...space,key:`paid-ad:${id}`,campaign:ad,creativeSource:source,creativeVersion:creativeVersion(source),z:space.y}];
 }));
}
export function fitMapCreative(width,height,imageWidth,imageHeight,fit='contain'){
 const w=Math.max(1,width)*.92,h=Math.max(1,height)*.92,aspect=Math.max(.01,imageWidth/imageHeight||1),scale=fit==='cover'?Math.max(w/imageWidth,h/imageHeight):Math.min(w/imageWidth,h/imageHeight);
 return fit==='cover'?{width:w,height:h,repeatX:w/(imageWidth*scale),repeatY:h/(imageHeight*scale)}:{width:Math.min(w,h*aspect),height:Math.min(h,w/aspect),repeatX:1,repeatY:1};
}
export function mapTextureTier(pixels){return pixels<12?0:pixels<180?256:pixels<420?512:1024;}
export function createMapAdDisplays(world,{now=Date.now,onChange=()=>{},maxTextures=24,maxDisplays=60,decode=source=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=source;}),makeCanvas=()=>document.createElement('canvas')}={}){
 const group=new THREE.Group();group.name='paid-city-displays';world.add(group);
 const plane=new THREE.PlaneGeometry(1,1),box=new THREE.BoxGeometry(1,1,1),frameMaterial=new THREE.MeshBasicMaterial({color:'#16241f',toneMapped:false}),baseMaterial=new THREE.MeshBasicMaterial({color:'#ccd9cd',toneMapped:false}),postMaterial=new THREE.MeshBasicMaterial({color:'#4b5a5c',toneMapped:false});
 const entries=new Map(),cache=new Map(),failed=new Set();let disposed=false,placements=[],lastView=-Infinity,revision=0;
 const point=new THREE.Vector3(),corner=new THREE.Vector3();
 const textureKey=place=>`${campaignRef(place.campaign)}:${place.campaign.fit==='cover'?'board':'contain'}:${place.creativeVersion}`;
 function remove(entry){entry.root.removeFromParent();entry.creative.material.dispose();entries.delete(entry.place.id);}
 // The creative fills the board face (92% of the limiting side, aspect kept); the
 // dark frame is always the full board, as on a real digital billboard.
 function fit(entry,image){const board=entry.board,d=fitMapCreative(board.width,board.height,image.width,image.height,entry.place.campaign.fit||'contain');entry.creative.scale.set(d.width,d.height,1);entry.creative.material.map=image.texture;entry.creative.material.color.set('#ffffff');entry.creative.material.needsUpdate=true;entry.creative.userData.creativeSize={width:d.width,height:d.height};}
 function create(place){const root=new THREE.Group();root.position.set(place.x+place.width/2,0,place.z+place.height/2);root.rotation.y=place.orientation||0;
  const board=billboardShape(place),base=new THREE.Mesh(box,baseMaterial),frame=new THREE.Mesh(box,frameMaterial),creative=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({color:'#b8cbbf',side:THREE.DoubleSide,toneMapped:false}));
  // A low plinth marks the plot; the board stands on two posts above it, turned
  // to the default camera and leaned back so it reads from the Map's high view.
  base.position.y=3;base.scale.set(Math.min(place.width,board.width)*.9,3,Math.min(place.height,board.width*.5)*.9);
  const stand=new THREE.Group();stand.rotation.y=MAP_BILLBOARD.yaw;root.add(stand);
  const face=new THREE.Group();face.position.y=board.lift+board.height/2;face.rotation.x=-MAP_BILLBOARD.tilt;stand.add(face);
  frame.scale.set(board.width+12,board.height+12,7);frame.position.z=-4;creative.scale.set(board.width*MAP_BILLBOARD.fill,board.height*MAP_BILLBOARD.fill,1);creative.position.z=.6;face.add(frame,creative);
  const posts=[-.32,.32].map(side=>{const post=new THREE.Mesh(box,postMaterial);post.scale.set(board.width*.05,board.lift+board.height*.5,board.width*.05);post.position.set(side*board.width,(board.lift+board.height*.5)/2,-10);stand.add(post);return post;});
  root.add(base);
  for(const mesh of [base,frame,creative,...posts])mesh.userData={adSpaceId:place.id,destinationKey:place.key,campaignRef:campaignRef(place.campaign),campaignType:place.campaign.campaignType||'paid',billboard:board.mega?'mega':'standard'};
  group.add(root);const entry={root,base,frame,creative,place,board,key:null};entries.set(place.id,entry);return entry;
 }
 function evict(keep,target=maxTextures){for(const [key,row]of cache){if(cache.size<=target)break;if(keep.has(key))continue;row.cancelled=true;for(const entry of entries.values())if(entry.key===key){entry.key=null;entry.creative.material.map=null;entry.creative.material.needsUpdate=true;}row.texture?.dispose();cache.delete(key);}}
 function load(entry,tier,keep){const ad=entry.place.campaign,cover=ad.fit==='cover',key=textureKey(entry.place),source=entry.place.creativeSource;keep.add(key);
  if(!/^data:image\/(?:png|jpeg|webp);base64,/.test(source))return;
  let row=cache.get(key);if(row){cache.delete(key);cache.set(key,row);if(row.texture)fit(entry,row);entry.key=key;if(row.pending||row.tier===tier||failed.has(key))return;}
  else{if(failed.has(key))return;evict(keep,maxTextures-1);if(cache.size>=maxTextures)return;row={cancelled:false,texture:null,tier:0};cache.set(key,row);entry.key=key;}
  row.pending=true;
  void decode(source).then(image=>{
   if(disposed||row.cancelled)return;
   const originalW=image.naturalWidth||image.width,originalH=image.naturalHeight||image.height,canvas=makeCanvas();
   let cropW=originalW,cropH=originalH;if(cover){const ratio=1/MAP_BILLBOARD.aspect;cropW=Math.min(originalW,originalH*ratio);cropH=cropW/ratio;}
   const scale=Math.min(1,tier/Math.max(cropW,cropH));canvas.width=Math.max(1,Math.round(cropW*scale));canvas.height=Math.max(1,Math.round(cropH*scale));canvas.getContext('2d').drawImage(image,(originalW-cropW)/2,(originalH-cropH)/2,cropW,cropH,0,0,canvas.width,canvas.height);
   const old=row.texture;row.texture=new THREE.CanvasTexture(canvas);row.texture.colorSpace=THREE.SRGBColorSpace;row.texture.anisotropy=4;row.width=originalW;row.height=originalH;row.tier=tier;row.pending=false;
   for(const entry of entries.values())if(entry.key===key)fit(entry,row);old?.dispose();onChange();
  }).catch(()=>{row.pending=false;if(!row.texture)cache.delete(key);failed.add(key);if(failed.size>24)failed.delete(failed.values().next().value);});
 }
 function setView(camera,size){if(disposed||!camera)return;const time=now();if(time-lastView<250)return;lastView=time;const visible=[];
  for(const place of placements){if(!activeAt(place.campaign,time))continue;point.set(place.x+place.width/2,8,place.z+place.height/2).project(camera);corner.set(place.x+place.width,8,place.z+place.height).project(camera);const pixels=Math.max(Math.abs(corner.x-point.x)*size.width,Math.abs(corner.y-point.y)*size.height);const margin=Math.max(.12,pixels/Math.min(size.width,size.height));if(point.z<-1||point.z>1||Math.abs(point.x)>1+margin||Math.abs(point.y)>1+margin)continue;visible.push({place,pixels});}
  visible.sort((a,b)=>b.pixels-a.pixels);const keep=new Set(),ids=new Set(),requests=new Map();
  for(const {place,pixels}of visible.slice(0,maxDisplays)){ids.add(place.id);const entry=entries.get(place.id)||create(place),tier=mapTextureTier(pixels),key=textureKey(place);
   if(tier&&(keep.has(key)||keep.size<maxTextures)){keep.add(key);const request=requests.get(key)||{tier:0,entries:[]};request.tier=Math.max(request.tier,tier);request.entries.push(entry);requests.set(key,request);}
   else if(entry.key){entry.key=null;entry.creative.material.map=null;entry.creative.material.needsUpdate=true;}
  }
  for(const request of requests.values())for(const entry of request.entries)load(entry,request.tier,keep);
  for(const entry of entries.values())if(!ids.has(entry.place.id))remove(entry);evict(keep);
 }
 function update(state){const next=mapAdPlacements(state?.active,now()),byId=new Map(next.map(p=>[p.id,p]));for(const entry of entries.values()){const fresh=byId.get(entry.place.id);if(!fresh||campaignRef(fresh.campaign)!==campaignRef(entry.place.campaign)||fresh.creativeSource!==entry.place.creativeSource)remove(entry);else entry.place=fresh;}placements=next;revision++;lastView=-Infinity;onChange();return placements;}
 return {group,update,setView,get placements(){return placements;},get diagnostics(){return {visibleDisplays:entries.size,cachedTextures:cache.size,revision};},dispose(){disposed=true;for(const entry of entries.values())remove(entry);for(const row of cache.values()){row.cancelled=true;row.texture?.dispose();}cache.clear();failed.clear();plane.dispose();box.dispose();frameMaterial.dispose();baseMaterial.dispose();postMaterial.dispose();group.removeFromParent();}};
}

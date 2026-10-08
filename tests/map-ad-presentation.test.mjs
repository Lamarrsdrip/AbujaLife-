import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../app/vendor/three.module.js';
import {MAP_AD_INVENTORY,adSpaceFromId,adZoneSpaces} from '../src/shared/advertising.mjs';
import {MAP_AD_PROTECTED_LAND,MAP_AD_PROTECTED_ROADS,mapLandConflict,boxesOverlap,roadIntersectsPlot} from '../src/shared/map-ad-land.mjs';
import {fitMapCreative,mapAdPlacements,createMapAdDisplays,mapTextureTier} from '../app/map-ad-displays.js';

test('every authored parcel has one authoritative ID and no land, road or inventory collision',()=>{
 assert.ok(MAP_AD_INVENTORY.length>120);assert.equal(new Set(MAP_AD_INVENTORY.map(p=>p.id)).size,MAP_AD_INVENTORY.length);
 for(const p of MAP_AD_INVENTORY){assert.equal(mapLandConflict(p),null);assert.equal(adSpaceFromId(p.id).width,p.width);assert.equal(adSpaceFromId(p.id).height,p.height);for(const other of MAP_AD_INVENTORY)if(p.id!==other.id)assert.equal(boxesOverlap(p,other),false);}
 for(const box of MAP_AD_PROTECTED_LAND)assert.ok(mapLandConflict(box));
 for(const road of MAP_AD_PROTECTED_ROADS)assert.ok(roadIntersectsPlot({x:road.a.x-1,y:road.a.y-1,width:2,height:2},road));
 for(let i=1;i<=10;i++){const p=adSpaceFromId(`billboard-${String(i).padStart(2,'0')}`);assert.equal(p.eligible,true);assert.equal(mapLandConflict(p),null);}
});
test('square, portrait, landscape and banner preserve creative ratio and use the limiting plot axis',()=>{
 for(const [iw,ih] of [[900,900],[600,900],[900,600],[900,225]]){const f=fitMapCreative(520,340,iw,ih);assert.ok(Math.abs(f.width/f.height-iw/ih)<1e-9);assert.ok(f.width<=520*.92&&f.height<=340*.92);assert.ok(Math.abs(f.width-520*.92)<1e-6||Math.abs(f.height-340*.92)<1e-6);}
 const cover=fitMapCreative(520,340,900,900,'cover');assert.equal(cover.width,520*.92);assert.equal(cover.height,340*.92);assert.ok(cover.repeatY<1);
 assert.equal(mapTextureTier(8),0);assert.equal(mapTextureTier(70),256);assert.equal(mapTextureTier(300),512);assert.equal(mapTextureTier(900),1024);
});
test('the existing live slot expands to its full purchased parcel; no duplicate or unsafe campaign draws',()=>{
 const campaign={txRef:'fixture',slots:['ad:city-frontage:80:25','ad:city-frontage:80:25'],startAt:10,endAt:2000};const p=mapAdPlacements([campaign],1000);assert.equal(p.length,1);assert.equal(p[0].width,520);assert.equal(p[0].height,340);
 const blocked=adZoneSpaces('capital-brand-coast',{limit:180}).find(p=>!p.eligible);assert.ok(blocked);assert.equal(mapAdPlacements([{...campaign,slots:[blocked.id]}],1000).length,0);
 assert.equal(mapAdPlacements([{...campaign,startAt:1500}],1000).length,0);
});
test('viewport culling bounds display/texture memory and repeated state updates reuse texture',async()=>{
 let time=1000,decodes=0;const worlds=new THREE.Group(),camera=new THREE.OrthographicCamera(-6000,6000,4500,-4500,1,20000);camera.position.set(0,9000,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const ads=createMapAdDisplays(worlds,{now:()=>time,maxTextures:4,maxDisplays:8,decode:async()=>{decodes++;return {width:900,height:600};},makeCanvas:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})});
 const state={active:MAP_AD_INVENTORY.slice(0,20).map((p,i)=>({txRef:`fixture-${i}`,slots:[p.id],endAt:100000,imageDataUrl:'data:image/png;base64,fixture'}))};ads.update(state);ads.setView(camera,{width:1440,height:900});await new Promise(resolve=>setImmediate(resolve));assert.ok(decodes>0);assert.ok(ads.diagnostics.visibleDisplays<=8);assert.ok(ads.diagnostics.cachedTextures<=4);
 const before=decodes;ads.update(state);time+=300;ads.setView(camera,{width:1440,height:900});await new Promise(resolve=>setImmediate(resolve));assert.equal(decodes,before);
 camera.position.x=25000;camera.lookAt(25000,0,0);camera.updateMatrixWorld();time+=300;ads.setView(camera,{width:1440,height:900});assert.equal(ads.diagnostics.visibleDisplays,0);ads.dispose();assert.equal(worlds.children.length,0);
});

test('shared creatives remain visible at texture capacity and mixed slots decode once at the largest tier',async()=>{
 let time=1000,decodes=0;const world=new THREE.Group(),camera=new THREE.OrthographicCamera(-6000,6000,4500,-4500,1,20000);camera.position.set(0,9000,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const large=MAP_AD_INVENTORY.filter(p=>p.width===520).slice(0,3),small=MAP_AD_INVENTORY.find(p=>p.width===320);
 const ads=createMapAdDisplays(world,{now:()=>time,maxTextures:2,decode:async()=>{decodes++;return {width:900,height:600};},makeCanvas:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})});
 const state={active:[{txRef:'shared',slots:[large[0].id,large[2].id,small.id],endAt:100000,imageDataUrl:'data:image/png;base64,fixture'},{txRef:'second',slots:[large[1].id],endAt:100000,imageDataUrl:'data:image/png;base64,fixture'}]};
 ads.update(state);ads.setView(camera,{width:6000,height:4500});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(decodes,2);assert.equal(ads.diagnostics.cachedTextures,2);assert.equal(ads.diagnostics.visibleDisplays,4);
 const shared=[];ads.group.traverse(mesh=>{if(mesh.material?.map){assert.ok(mesh.material.map);if(mesh.userData.campaignRef==='shared')shared.push(mesh.material.map);}});assert.equal(shared.length,3);assert.equal(new Set(shared).size,1);
 for(let i=0;i<3;i++){time+=300;ads.setView(camera,{width:6000,height:4500});await new Promise(resolve=>setImmediate(resolve));}assert.equal(decodes,2);ads.dispose();
});

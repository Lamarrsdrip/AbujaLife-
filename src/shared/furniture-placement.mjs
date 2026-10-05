import { furniturePlacement } from './life.mjs';
import { canUseFurnitureSurface, furnitureSurface, furnitureSurfaceRect, SURFACE_ONLY_FURNITURE } from './furniture-metadata.mjs';
import { buildInterior, furnitureDimensions, furniturePlacementPreservesRoutes } from '../../app/world-interiors.js';

const sameRect=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
const overlaps=(a,b,pad=3)=>a.x<b.x+b.w+pad&&a.x+a.w>b.x-pad&&a.y<b.y+b.h+pad&&a.y+a.h>b.y-pad;
const inside=(a,b,pad=2)=>a.x>=b.x+pad&&a.y>=b.y+pad&&a.x+a.w<=b.x+b.w-pad&&a.y+a.h<=b.y+b.h-pad;
const failure=(code,message,extra={})=>({valid:false,code,message,...extra});
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,100}$/.test(value);

export function readFurniturePlacement(value={}) {
  const position=furniturePlacement(value);
  if(value.propertyId!==undefined){if(!validId(value.propertyId))throw new Error('Choose a valid home for this furniture');position.propertyId=value.propertyId;}
  if(value.supportId!==undefined&&value.supportId!==null){if(!validId(value.supportId))throw new Error('Choose a valid furniture surface');position.supportId=value.supportId;}
  // The server derives elevation from support definitions, including on reload.
  return position;
}

export function furnitureFootprint(scene,itemId,placement) {
  const def=furnitureDimensions(itemId),rotation=def.upright?0:placement.rotation;
  const w=rotation%180?def.height:def.width,h=rotation%180?def.width:def.height;
  const area=scene.furnishingArea||{x:0,y:0,w:scene.width,h:scene.height};
  return {x:area.x+placement.x*area.w-w/2,y:area.y+placement.y*area.h-h/2,w,h};
}

// Used by both the live arranging controls and every backend adapter. Renderer
// geometry is authored locally; clients cannot submit their own wall/price maps.
export function furnitureScenePlacementFeedback(scene,itemId,placement,{checkRoutes=true}={}) {
  const footprint=furnitureFootprint(scene,itemId,placement),def=furnitureDimensions(itemId);
  const own=scene.furniturePlacements?.find(item=>item.itemId===itemId);
  const detail={placement,footprint,elevation:0};
  if(footprint.x<=65||footprint.y<=165||footprint.x+footprint.w>=scene.width-65||footprint.y+footprint.h>=scene.height-115)return failure('furniture_outside_floor','Keep the whole item inside your home.',detail);
  const support=placement.supportId?scene.objects?.find(item=>item.itemId===placement.supportId):null;
  if(!placement.supportId&&SURFACE_ONLY_FURNITURE.includes(itemId))return failure('furniture_surface_required','Put this item on a table or counter.',detail);
  if(placement.supportId){
    if(placement.supportId===itemId||!canUseFurnitureSurface(itemId)||!support||support.supportId||!furnitureSurface(support.itemId))return failure('furniture_invalid_surface','Choose a suitable table or counter for this item.',detail);
    const surface=furnitureSurfaceRect(support);
    if(!inside(footprint,surface))return failure('furniture_surface_edge','Keep the whole item on the table or counter.',detail);
    detail.elevation=surface.height;
  }
  const fixedWalls=scene.walls||[];
  if(fixedWalls.some(wall=>overlaps(footprint,wall,2)))return failure('furniture_wall_overlap','Move the item clear of the wall.',detail);
  if(def.solid!==false){
    const replacingMat=['bed','king-bed'].includes(itemId);
    const matRects=replacingMat?(scene.objects||[]).filter(o=>o.kind==='sleeping-mat'):[];
    const obstacles=(scene.obstacles||[]).filter(o=>!sameRect(o,own)&&!sameRect(o,support)&&!matRects.some(mat=>sameRect(o,mat)));
    if(obstacles.some(o=>overlaps(footprint,o,3)))return failure('furniture_object_overlap','Leave a little space between items.',detail);
    if((scene.objects||[]).some(o=>o.itemId!==itemId&&o.supportId&&Math.abs((o.elevation||0)-detail.elevation)<1&&overlaps(footprint,o,2)))return failure('furniture_object_overlap','That surface already has another item there.',detail);
    if(!support){
      const interactionPoints=(scene.interactables||[]).filter(point=>!(replacingMat&&point.action==='sleep'));
      if(interactionPoints.some(point=>overlaps(footprint,{x:point.x,y:point.y,w:0,h:0},25))||Math.hypot(footprint.x+footprint.w/2-scene.spawn.x,footprint.y+footprint.h/2-scene.spawn.y)<80)return failure('furniture_doorway_blocked','Leave the entrance and activity spots clear.',detail);
      const navigationScene={...scene,obstacles,interactables:interactionPoints};
      if(checkRoutes&&!furniturePlacementPreservesRoutes(navigationScene,footprint))return failure('furniture_route_blocked','Leave a walking route into every room.',detail);
    }
  }
  return {valid:true,code:null,message:placement.supportId?'On the surface':'Ready to place',...detail};
}

export function furniturePlacementFeedback(profile,itemId,payload,{scene,checkRoutes=true}={}) {
  if(profile?.location?.kind!=='home'||profile.visitingHome||profile.homeVisit)return failure('furniture_not_home','Go to your own home to arrange furniture.');
  if(!profile.inventory?.includes(itemId))return failure('furniture_not_owned','Buy this furniture before placing it.');
  let placement;try{placement=readFurniturePlacement(payload);}catch(error){return failure('invalid_action',error.message);}
  if(placement.propertyId!==undefined&&placement.propertyId!==profile.home.propertyId)return failure('furniture_wrong_home','Arrange furniture in the home you are currently inside.');
  placement.propertyId=profile.home.propertyId;
  if(placement.supportId){
    if(!profile.inventory.includes(placement.supportId)||profile.storedFurniture?.includes(placement.supportId))return failure('furniture_invalid_surface','Place a table or counter you own first.');
    const saved=profile.furnitureLayout?.[placement.supportId];
    if(saved?.propertyId&&saved.propertyId!==placement.propertyId)return failure('furniture_invalid_surface','That table or counter is in a different home.');
  }
  return furnitureScenePlacementFeedback(scene||buildInterior({profile,id:'authoritative-furniture-check'}),itemId,placement,{checkRoutes});
}

export function validateFurniturePlacement(profile,itemId,payload) {
  const feedback=furniturePlacementFeedback(profile,itemId,payload);
  if(!feedback.valid){const error=new Error(feedback.message);error.code=feedback.code;throw error;}
  return feedback.placement;
}

export function surfaceForFurnitureAt(scene,itemId,point,rotation=0) {
  if(!canUseFurnitureSurface(itemId))return null;
  const area=scene.furnishingArea||{x:0,y:0,w:scene.width,h:scene.height};
  const footprint=furnitureFootprint(scene,itemId,{x:(point.x-area.x)/area.w,y:(point.y-area.y)/area.h,rotation});
  const support=(scene.objects||[]).find(object=>object.itemId!==itemId&&!object.supportId&&furnitureSurface(object.itemId)&&inside(footprint,furnitureSurfaceRect(object)));
  return support?{supportId:support.itemId,elevation:furnitureSurface(support.itemId).height}:null;
}

// Storing or selling a support never discards objects resting on it. Its children
// go back into the same resident's owned storage, ready to place again.
export function storeSupportedFurniture(profile,supportId) {
  for(const [itemId,placement] of Object.entries(profile.furnitureLayout||{}))if(placement.supportId===supportId){delete profile.furnitureLayout[itemId];if(!profile.storedFurniture.includes(itemId))profile.storedFurniture.push(itemId);}
}

export function applyFurniturePlacement(profile,itemId,placement) {
  const previous=profile.furnitureLayout[itemId];
  const children=Object.entries(profile.furnitureLayout).filter(([,position])=>position.supportId===itemId);
  const scene=children.length?buildInterior({profile,id:'move-furniture-support'}):null;
  const area=scene?.furnishingArea;
  const oldSupport=scene?.furniturePlacements.find(item=>item.itemId===itemId);
  const oldCenter=oldSupport?{x:oldSupport.x+oldSupport.w/2,y:oldSupport.y+oldSupport.h/2}:null;
  profile.furnitureLayout[itemId]=placement;
  profile.storedFurniture=profile.storedFurniture.filter(id=>id!==itemId);
  if(area&&oldCenter){
    const radians=(placement.rotation-(previous?.rotation||oldSupport.rotation||0))*Math.PI/180;
    const cos=Math.cos(radians),sin=Math.sin(radians);
    for(const [childId,child] of children){
      const dx=area.x+child.x*area.w-oldCenter.x,dy=area.y+child.y*area.h-oldCenter.y;
      const candidate={...child,x:Math.round((placement.x+(dx*cos-dy*sin)/area.w)*1000)/1000,y:Math.round((placement.y+(dx*sin+dy*cos)/area.h)*1000)/1000,rotation:(child.rotation+placement.rotation-(previous?.rotation||oldSupport.rotation||0)+360)%360,propertyId:placement.propertyId};
      profile.furnitureLayout[childId]=candidate;
    }
    for(const [childId] of children)validateFurniturePlacement(profile,childId,profile.furnitureLayout[childId]);
  }
  return placement;
}

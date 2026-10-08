import { VENUE_ACTIONS } from '../src/shared/life.mjs';

const HOME_OBJECTS = Object.freeze({
  eat:['kitchen','kitchen-unit','kitchen-island','dining-table','fridge'],
  sleep:['bed','king-bed','sleeping-mat'], shower:['shower'],
  relax:['sofa','premium-sofa'], wardrobe:['wardrobe','full-length-mirror'],
});
const VENUE_OBJECTS = Object.freeze({
  eat:['dining-table','picnic-table','food-counter','counter'],
  rest:['bed','sofa','premium-sofa','bench','view-bench'],
  shower:['shower'], exercise:['treadmill','free-weights','bench-press'],
  groom:['chair'], shop:['produce','shopfront','tech-phone-stall','counter'],
  watch:['cinema-chair','gallery-panel','conference-stage','departures-board','view-bench'],
  play:['arcade','dice-table'], social:['sofa','premium-sofa','bench','visitor-seat'],
});
const SERVICE_OBJECTS = Object.freeze({
  dealership:['counter'], 'estate-office':['counter','service-desk','desk'],
  'banex-market':['tech-phone-stall','tech-console-stall','tech-laptop-stall'],
  market:['counter'], 'play-dice':['dice-table'],
});

export function interiorExit(scene) {
  return scene?.interactables?.find(point=>['exit-venue','leave-home','leave-visit'].includes(point.action))||null;
}

function objectKinds(point,home) {
  if(home)return HOME_OBJECTS[point.action]||[];
  if(SERVICE_OBJECTS[point.action])return SERVICE_OBJECTS[point.action];
  const activity=VENUE_ACTIONS.find(entry=>entry.id===point.payload?.activityId&&entry.venueId===point.payload?.venueId);
  // Screening belongs in the auditorium; snacks belong at its existing counter.
  if(activity?.animation==='eat'&&activity.venueId.includes('cinema'))return ['counter'];
  // Stretching uses the authored open recovery area, not a treadmill.
  if(activity?.id==='gym-recovery')return [];
  if(activity?.id==='cbn-careers')return ['service-desk','desk'];
  return VENUE_OBJECTS[activity?.animation]||[];
}

function beside(object,scene) {
  const gap=42,points=[
    {x:object.x+object.w/2,y:object.y+object.h+gap},
    {x:object.x+object.w+gap,y:object.y+object.h/2},
    {x:object.x-gap,y:object.y+object.h/2},
    {x:object.x+object.w/2,y:object.y-gap},
  ];
  return points.filter(point=>point.x>80&&point.x<scene.width-80&&point.y>172&&point.y<scene.height-115&&
    !(scene.obstacles||[]).some(rect=>point.x>rect.x-18&&point.x<rect.x+rect.w+18&&point.y>rect.y-18&&point.y<rect.y+rect.h+18));
}

// Only scene construction/furniture reconciliation runs this. Use existing
// fixtures, owned placements and the existing route guard; no extra polling,
// server actions, room geometry or free furniture is introduced.
export function anchorInteriorActivities(scene,{home=false,routeValid=()=>true}={}) {
  if(!scene)return scene;
  for(const point of scene.interactables||[]) {
    const kinds=objectKinds(point,home,scene);
    if(!kinds.length)continue;
    const previous={x:point.x,y:point.y};
    const objects=(scene.objects||[]).filter(object=>kinds.includes(object.kind)||kinds.includes(object.itemId))
      .sort((a,b)=>{
        const rank=object=>Math.min(...[object.kind,object.itemId].map(kind=>{const index=kinds.indexOf(kind);return index<0?Infinity:index;}));
        return rank(a)-rank(b)||Math.hypot(a.x+a.w/2-previous.x,a.y+a.h/2-previous.y)-Math.hypot(b.x+b.w/2-previous.x,b.y+b.h/2-previous.y);
      });
    let anchored=false;
    for(const object of objects) {
      const candidates=beside(object,scene).sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y));
      for(const candidate of candidates) {
        Object.assign(point,candidate);
        if(!routeValid(scene,null)){Object.assign(point,previous);continue;}
        point.promptAnchor={x:object.x+object.w/2,y:object.y+object.h/2,kind:object.kind,itemId:object.itemId||null};
        if(home&&point.action==='eat')point.label=['kitchen','kitchen-unit','kitchen-island'].includes(object.kind)||['kitchen-unit','kitchen-island'].includes(object.itemId)?'Make something to eat':object.kind==='fridge'||object.itemId==='fridge'?'Get a meal from your fridge':'Eat at your table';
        anchored=true;break;
      }
      if(anchored)break;
    }
    if(!anchored)Object.assign(point,previous);
  }
  return scene;
}

const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

// A prompt stays close to its fixture. If the HUD, another card or the player
// occupies that space, the corner action/tray stays available instead.
export function interiorPromptPosition({anchor,width,height,promptWidth,promptHeight,blockers=[]}) {
  if(!anchor||!Number.isFinite(anchor.x)||!Number.isFinite(anchor.y))return null;
  const margin=12,gap=14;
  const candidates=[
    {x:anchor.x-promptWidth/2,y:anchor.y-promptHeight-gap},
    {x:anchor.x+gap,y:anchor.y-promptHeight/2},
    {x:anchor.x-promptWidth-gap,y:anchor.y-promptHeight/2},
  ];
  return candidates.find(point=>{
    const box={...point,width:promptWidth,height:promptHeight};
    return box.x>=margin&&box.y>=margin&&box.x+box.width<=width-margin&&box.y+box.height<=height-margin&&
      !blockers.some(blocker=>overlaps(box,{x:blocker.x-6,y:blocker.y-6,width:blocker.width+12,height:blocker.height+12}));
  })||null;
}

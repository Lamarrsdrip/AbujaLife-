// Venue-aware routing layer around the authored interior library. The original
// library remains intact in world-interiors-base.js; this file makes sure every
// real Abuja landmark enters an interior whose layout matches what people do
// there instead of falling through to a renamed generic room.
import {buildInterior as buildBaseInterior, furniturePlacementPreservesRoutes} from './world-interiors-base.js';
import {anchorInteriorActivities} from './world-interior-actions.js';
import {cityLandmark} from '../src/shared/city-landmarks.mjs';
import {venueFor} from '../src/shared/life.mjs';

// Preserve the complete long-lived public API (furniture helpers, route guards,
// ghosts, dimensions, etc.) while this module owns only venue-aware buildInterior.
export * from './world-interiors-base.js';

const LANDMARK_TEMPLATE=Object.freeze({
  airport:'estate-office',
  cityGate:'park',
  stadium:'gym',
  magicland:'games-lounge',
  wtc:'estate-office',
  cbn:'estate-office',
  assembly:'estate-office',
  eagle:'park',
  mosque:'mosque',
  church:'church',
  transcorp:'hotel',
  millennium:'park',
  aso:'park',
  farmCity:'restaurant',
  jabiLake:'jabi-lake',
  mall:'furniture-store',
  conference:'cinema',
  banex:'tech-market',
  inec:'estate-office',
  efcc:'estate-office',
  court:'estate-office',
  grocery:'grocery',cinema:'cinema',gallery:'estate-office',
});

const PURPOSE=Object.freeze({
  airport:'TERMINAL · CHECK-IN · DEPARTURES',
  cityGate:'LANDMARK · PHOTOS · MEETUPS',
  stadium:'TRAINING · SPORT · MATCH DAY',
  magicland:'RIDES · ARCADE · FRIENDS',
  wtc:'BUSINESS · LOBBY · SKYLINE',
  cbn:'FINANCE · HISTORY · CAREERS',
  assembly:'CIVIC GALLERY · PUBLIC LIFE',
  eagle:'PUBLIC EVENTS · CITY MOMENTS',
  mosque:'PRAYER · REFLECTION · COMMUNITY',
  church:'PRAYER · REFLECTION · COMMUNITY',
  transcorp:'LOBBY · DINING · POOL · ROOMS',
  millennium:'WALK · PICNIC · FRIENDS',
  aso:'VIEWPOINT · WALK · RELAX',
  farmCity:'FOOD · ARCADE · HANGOUT',
  jabiLake:'LAKESIDE · WALK · PICNIC',
  mall:'SHOP · FOOD · MEET',
  conference:'CONFERENCE · AUDITORIUM · MEETINGS',
  banex:'COMPUTERS · REPAIRS · GADGETS',
  inec:'REGISTRATION · INFORMATION · CITY STORY',
  efcc:'FICTIONAL STORY · BRIEFING · INFORMATION',
  court:'FICTIONAL HEARING · GALLERY · INFORMATION',
});

const LANDMARK_ZONES=Object.freeze({
  airport:['check-in','departures-board','security-queue','gate-lounge','apron-view'],
  cityGate:['monument-plaza','photo-point','visitor-lawn'],
  stadium:['pitch','running-track','training-zone','spectator-stand'],
  magicland:['ride-court','arcade','ticket-zone','hangout'],
  wtc:['business-lobby','reception','meeting-suite','skyline-lounge'],
  cbn:['finance-gallery','currency-history','career-desk','public-lobby'],
  assembly:['public-gallery','chamber-view','committee-lobby','civic-desk'],
  eagle:['event-square','stage','public-stand'],
  mosque:['prayer-hall','ablution-lobby','community-court'],
  church:['sanctuary','welcome-lobby','community-court'],
  transcorp:['reception','lounge','guest-room','pool-club'],
  millennium:['promenade','picnic-lawn','garden-walk'],
  aso:['view-deck','walking-trail','rest-point'],
  farmCity:['dining-yard','games-corner','social-lounge'],
  jabiLake:['waterfront','promenade','picnic-lawn'],
  mall:['retail-court','food-court','social-lounge'],
  conference:['main-stage','auditorium','breakout-lobby','registration'],
  banex:['laptop-row','repair-bench','accessory-row','power-row'],
  inec:['registration-desk','voter-information','queue-zone','city-story-desk'],
  efcc:['integrity-gallery','fictional-briefing-room','public-information','interview-lobby'],
  court:['bench','public-gallery','counsel-area','registry-desk'],
  grocery:['retail-aisles','meal-counter','social-corner'],cinema:['screen','auditorium','foyer'],gallery:['exhibition','textile-displays','creative-workshop'],
});

function replaceAllSafe(value,from,to){return from&&to?String(value).split(from).join(to):value;}

function relabelScene(scene,{name,template,purpose}){
  if(!scene)return scene;
  const title=String(name||scene.title||'Abuja').toUpperCase();
  let art=String(scene.art||'');
  const swaps={
    hotel:[['CAPITAL HOUSE',title],['STAY A LITTLE LONGER',purpose||'LOBBY · ROOMS · SPA']],
    'estate-office':[['THE PROPERTY STUDIO',title],['FIND YOUR CORNER OF ABUJA',purpose||'SERVICE · INFORMATION']],
    park:[['A LITTLE GREEN',title],['TAKE YOUR TIME HERE',purpose||'WALK · MEET · RELAX']],
    gym:[['MOVE WELL',title],['STRENGTH · BREATH · BALANCE',purpose||'TRAIN · MOVE · RECOVER']],
    restaurant:[['THE COURTYARD',title],['A LITTLE TASTE OF ABUJA',purpose||'EAT · GATHER · RELAX']],
    cinema:[['CITY CINEMA',title],['YOUR EVENING, ON THE BIG SCREEN',purpose||'AUDITORIUM · EVENTS']],
    mosque:[['PEACE & COMMUNITY',title]],
    church:[['A MOMENT OF PEACE',title]],
    'furniture-store':[['OKRIKA MARKETPLACE',title],['GOOD FINDS · REAL LIFE',purpose||'SHOP · BROWSE · MEET'],['LIVING','SHOPS & HOME'],['REST','STYLE & LIFE'],['THE READING CORNER','SOCIAL CORNER']],
    'games-lounge':[['DICE & CHILL',title],['A GOOD EVENING STARTS HERE',purpose||'PLAY · MEET · RELAX']],
  }[template]||[];
  for(const [from,to]of swaps)art=replaceAllSafe(art,from,to);
  scene.art=art;
  scene.title=name||scene.title;
  if(purpose)scene.subtitle=purpose.toLowerCase().replace(/^./,c=>c.toUpperCase());
  return scene;
}

function authoredLandmarkScene(scene,landmark){
  if(!scene||!landmark)return scene;
  const zones=LANDMARK_ZONES[landmark.builder]||['public-zone','information-zone'];
  // The existing interior library owns the physical fixtures and their collision
  // footprints. Mark that authored scene without painting a second furniture layer.
  scene.art=`<g data-landmark-interior="${landmark.builder}">${String(scene.art||'')}</g>`;
  scene.landmarkZones=[...zones];
  scene.venueLayout={venueId:landmark.id,template:LANDMARK_TEMPLATE[landmark.builder]||'authored',landmark:true,authored:true,outdoor:['cityGate','stadium','magicland','eagle','millennium','aso','jabiLake'].includes(landmark.builder),zones:[...zones]};
  const models={'service-desk':'counter','visitor-seat':'lounge-chair','chamber-seat':'lounge-chair','speaker-desk':'counter','conference-seat':'cinema-chair','conference-stage':'performance-stage','registration-desk':'counter','briefing-desk':'desk','court-bench':'balcony-bench',bench:'counter','view-bench':'balcony-bench',pew:'balcony-bench',shopfront:'bookshelf',arcade:'tech-console-stall'};
  scene.objects=(scene.objects||[]).map(object=>({...object,modelKind:models[object.kind]||object.kind,landmarkFixture:true}));
  return scene;
}

function venueIdFor({profile={},venue}={}){return typeof venue==='string'?venue:venue?.id||profile.location?.venue||null;}
function currentHomeProfile(profile={}){
  if(profile.location?.kind!=='home'||!profile.home?.propertyId)return profile;
  const propertyId=profile.home.propertyId,layout=profile.furnitureLayout||{};
  const entries=Array.isArray(layout)
    ?layout.map((entry,index)=>[entry?.itemId||String(index),entry])
    :Object.entries(layout);
  const currentEntries=entries.filter(([,entry])=>!entry?.propertyId||entry.propertyId===propertyId);
  const furnitureLayout=Array.isArray(layout)
    ?currentEntries.map(([,entry])=>entry)
    :Object.fromEntries(currentEntries);
  // An owned item that is physically placed in another property is not loose
  // inventory in this room. Treat it as unavailable for this render only until
  // the player intentionally stores/moves it; never mutate the authoritative profile.
  const awayItems=entries
    .filter(([,entry])=>entry?.propertyId&&entry.propertyId!==propertyId)
    .map(([itemId,entry])=>entry?.itemId||itemId);
  const storedFurniture=[...new Set([...(profile.storedFurniture||[]),...awayItems])];
  const purchasedFurnished=profile.home.purchaseFurnishedPropertyId===propertyId;
  return {...profile,furnitureLayout,storedFurniture,home:purchasedFurnished?{...profile.home,furnishingPreset:'lapo-basic'}:profile.home};
}

export function buildInterior(args={}){
  const profile=currentHomeProfile(args.profile||{}),normalizedArgs=profile===args.profile?args:{...args,profile};
  const venueId=venueIdFor(normalizedArgs);
  const landmark=venueId?cityLandmark(venueId):null;
  if(landmark){
    const canonical=typeof normalizedArgs.venue==='object'?normalizedArgs.venue:venueFor(venueId)||{id:venueId,name:landmark.name};
    const template=LANDMARK_TEMPLATE[landmark.builder]||canonical.type||'estate-office';
    const routed={...canonical,id:venueId,name:canonical.name||landmark.name,type:template};
    const scene=buildBaseInterior({...normalizedArgs,venue:routed});
    relabelScene(scene,{name:routed.name,template,purpose:PURPOSE[landmark.builder]||landmark.blurb});
    authoredLandmarkScene(scene,landmark);
    scene.subtitle=landmark.blurb||scene.subtitle;
    return anchorInteriorActivities(scene,{routeValid:furniturePlacementPreservesRoutes});
  }
  const scene=buildBaseInterior(normalizedArgs);
  if(profile.location?.kind==='home'&&profile.home?.purchaseFurnishedPropertyId===profile.home?.propertyId){
    scene.subtitle=`Furnished ${profile.home?.name||'home'} · resident-owned package`;
    scene.homeFurnishingSource='resident-owned-property-package';
  }
  if(venueId==='hotel'){
    relabelScene(scene,{name:'Capital Palm Hotel',template:'hotel',purpose:'RECEPTION · LOUNGE · GUEST ROOMS · SPA'});
    scene.venueLayout={venueId:'hotel',template:'hotel',zones:['reception','lounge','guest-room','spa']};
  }
  return anchorInteriorActivities(scene,{home:profile.location?.kind==='home',routeValid:furniturePlacementPreservesRoutes});
}

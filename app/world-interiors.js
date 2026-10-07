// Venue-aware routing layer around the authored interior library. The original
// library remains intact in world-interiors-base.js; this file makes sure every
// real Abuja landmark enters an interior whose layout matches what people do
// there instead of falling through to the default restaurant scene.
import {buildInterior as buildBaseInterior} from './world-interiors-base.js';
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
  for(const [from,to] of swaps)art=replaceAllSafe(art,from,to);
  scene.art=art;
  scene.title=name||scene.title;
  if(purpose)scene.subtitle=purpose.toLowerCase().replace(/^./,c=>c.toUpperCase());
  return scene;
}

function venueIdFor({profile={},venue}={}){return typeof venue==='string'?venue:venue?.id||profile.location?.venue||null;}

export function buildInterior(args={}){
  const venueId=venueIdFor(args);
  const landmark=venueId?cityLandmark(venueId):null;
  if(landmark){
    const canonical=typeof args.venue==='object'?args.venue:venueFor(venueId)||{id:venueId,name:landmark.name};
    const template=LANDMARK_TEMPLATE[landmark.builder]||canonical.type||'estate-office';
    const routed={...canonical,id:venueId,name:canonical.name||landmark.name,type:template};
    const scene=buildBaseInterior({...args,venue:routed});
    relabelScene(scene,{name:routed.name,template,purpose:PURPOSE[landmark.builder]||landmark.blurb});
    scene.venueLayout={venueId,template,landmark:true};
    scene.subtitle=landmark.blurb||scene.subtitle;
    return scene;
  }
  const scene=buildBaseInterior(args);
  if(venueId==='hotel'){
    relabelScene(scene,{name:'Capital Palm Hotel',template:'hotel',purpose:'RECEPTION · LOUNGE · GUEST ROOMS · SPA'});
    scene.venueLayout={venueId:'hotel',template:'hotel',zones:['reception','lounge','guest-room','spa']};
  }
  return scene;
}

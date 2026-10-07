// Venue-aware routing layer around the authored interior library. The original
// library remains intact in world-interiors-base.js; this file makes sure every
// real Abuja landmark enters an interior whose layout matches what people do
// there instead of falling through to a renamed generic room.
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
});

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rect=(x,y,w,h,fill,r=8,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const text=(x,y,label,size=16,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="700" fill="#35554c">${esc(label)}</text>`;

function landmarkFixtureArt(builder,width,height){
  const w=Math.max(780,Number(width)||1050),h=Math.max(560,Number(height)||650),cx=w/2,back=72;
  const plaque=label=>`${rect(cx-160,back-18,320,38,'#315d50',19)}<text x="${cx}" y="${back+8}" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="2" fill="#f7eccb">${esc(label)}</text>`;
  const rows=(count,startX,y,span,kind='seat')=>Array.from({length:count},(_,i)=>{const x=startX+i*span;return kind==='desk'?`${rect(x,y,92,34,'#9d815f',5)}${rect(x+8,y+8,76,12,'#d7c5a3',3)}`:`${rect(x,y,62,27,'#58776c',8)}${rect(x+7,y-18,48,20,'#789589',7)}`;}).join('');
  const specs={
    airport:()=>`${plaque('ABUJA AIRPORT · DEPARTURES')}${rect(72,120,w-144,76,'#d9ded0',9)}${rows(5,106,145,138,'desk')}${rect(82,250,w-164,62,'#243f49',8)}${text(cx,289,'DEPARTURES · GATE · STATUS',15)}${rows(8,95,420,105)}<path d="M${w-245} 190l126-18 44 13-44 13z" fill="#e4dfcf" stroke="#668078" stroke-width="3"/>`,
    cityGate:()=>`${plaque('ABUJA CITY GATE')}${rect(cx-250,175,500,230,'#b9c696',28)}<path d="M${cx-170} 392Q${cx-120} 170 ${cx-15} 148V392H${cx-96}ZM${cx+15} 148Q${cx+120} 170 ${cx+170} 392H${cx+96}V392H${cx+15}Z" fill="#e3ddc5"/><circle cx="${cx}" cy="310" r="70" fill="#88a27e" opacity=".5"/>`,
    stadium:()=>`${plaque('MOSHOOD ABIOLA NATIONAL STADIUM')}${rect(110,150,w-220,330,'#7da06f',140)}<ellipse cx="${cx}" cy="315" rx="${w*.33}" ry="128" fill="#b6bca8"/><ellipse cx="${cx}" cy="315" rx="${w*.28}" ry="96" fill="#65905d"/><path d="M${cx-w*.28} 315H${cx+w*.28}" stroke="#e5e7ce" stroke-width="4"/><circle cx="${cx}" cy="315" r="36" fill="none" stroke="#e5e7ce" stroke-width="3"/>`,
    magicland:()=>`${plaque('MAGICLAND · RIDES & ARCADE')}<circle cx="${cx-170}" cy="300" r="118" fill="none" stroke="#b86f68" stroke-width="13"/><path d="M${cx-170} 182V418M${cx-288} 300H${cx-52}M${cx-254} 216L${cx-86} 384M${cx-86} 216L${cx-254} 384" stroke="#6f7f77" stroke-width="7"/>${rect(cx+40,190,260,210,'#6b5971',16)}${text(cx+170,245,'ARCADE',22)}${rows(3,cx+75,300,75,'desk')}`,
    wtc:()=>`${plaque('WORLD TRADE CENTRE · BUSINESS LOBBY')}${rect(cx-250,135,190,330,'#9cb4b1',12)}${rect(cx+60,135,190,330,'#9cb4b1',12)}${Array.from({length:6},(_,i)=>`<path d="M${cx-230} ${175+i*44}H${cx-80}M${cx+80} ${175+i*44}H${cx+230}" stroke="#e4e7d5" stroke-width="5"/>`).join('')}${rect(cx-55,280,110,185,'#435f5b',8)}${text(cx,260,'RECEPTION',16)}`,
    cbn:()=>`${plaque('CENTRAL BANK OF NIGERIA')}${rect(90,150,w-180,290,'#e3ddc8',14)}${rect(120,185,210,210,'#486d65',9)}${text(225,232,'NAIRA GALLERY',17)}${rect(cx-95,185,190,210,'#d3b87b',9)}${text(cx,232,'ECONOMY',17)}${rect(w-330,185,210,210,'#6d8981',9)}${text(w-225,232,'CAREERS',17)}`,
    assembly:()=>`${plaque('NATIONAL ASSEMBLY · PUBLIC GALLERY')}${rect(100,145,w-200,330,'#ded7bf',14)}<path d="M170 420Q${cx} 175 ${w-170} 420" fill="none" stroke="#8d7559" stroke-width="55"/>${rect(cx-90,315,180,72,'#785c42',7)}${text(cx,355,'CHAMBER',16)}${rows(7,160,205,105)}`,
    eagle:()=>`${plaque('EAGLE SQUARE · EVENTS')}${rect(110,150,w-220,340,'#d9d4bd',18)}${rect(cx-205,190,410,105,'#496d60',8)}${text(cx,245,'PUBLIC STAGE',20)}${rows(8,115,390,105)}`,
    transcorp:()=>`${plaque('TRANSCORP HILTON · HOTEL')}${rect(100,145,w-200,325,'#d8d0b9',14)}${rect(cx-110,170,220,76,'#57786d',8)}${text(cx,218,'RECEPTION',16)}${rect(140,290,260,120,'#a58c6d',12)}${text(270,350,'LOUNGE',16)}${rect(w-400,290,260,120,'#7ea59b',12)}${text(w-270,350,'POOL CLUB',16)}`,
    conference:()=>`${plaque('ICC ABUJA · MAIN AUDITORIUM')}${rect(90,140,w-180,340,'#4b5b59',18)}${rect(cx-230,165,460,98,'#9c7b5b',8)}${text(cx,220,'MAIN STAGE',20)}${rows(8,120,350,103)}${rows(8,120,405,103)}`,
    inec:()=>`${plaque('INEC · REGISTRATION & VOTER INFORMATION')}${rect(100,145,w-200,325,'#e0dbc5',14)}${rows(4,135,205,185,'desk')}${text(cx,192,'REGISTRATION DESKS',15)}<path d="M150 325H${w-150}" stroke="#56776c" stroke-width="7" stroke-dasharray="28 18"/>${rect(cx-130,350,260,80,'#6c8f84',8)}${text(cx,397,'VOTER INFORMATION',15)}`,
    efcc:()=>`${plaque('EFCC · FICTIONAL INTEGRITY STORY')}${rect(100,145,w-200,325,'#ded9c6',14)}${rect(135,190,250,210,'#4f7267',9)}${text(260,242,'INTEGRITY GALLERY',16)}${rect(cx+20,190,250,95,'#a48a67',9)}${text(cx+145,245,'BRIEFING',16)}${rect(cx+20,305,250,95,'#7f9991',9)}${text(cx+145,360,'PUBLIC INFO',16)}`,
    court:()=>`${plaque('FEDERAL HIGH COURT · FICTIONAL HEARING')}${rect(100,145,w-200,325,'#ded8c3',14)}${rect(cx-210,175,420,80,'#72553f',8)}${text(cx,225,'BENCH',16)}${rows(7,145,350,110)}${rect(135,285,200,48,'#917256',6)}${rect(w-335,285,200,48,'#917256',6)}`,
    banex:()=>`${plaque('BANEX · TECH MARKET')}${rect(95,145,w-190,330,'#d5cfb7',14)}${rows(5,120,205,155,'desk')}${text(cx,190,'LAPTOPS · REPAIRS · GADGETS',15)}${rows(5,120,360,155,'desk')}`,
    farmCity:()=>`${plaque('FARM CITY · FOOD & HANGOUT')}${rect(105,150,w-210,320,'#b1bf92',20)}${Array.from({length:5},(_,i)=>`<circle cx="${170+i*150}" cy="300" r="54" fill="#d8c6a2"/><circle cx="${170+i*150}" cy="300" r="35" fill="#8d7558"/>`).join('')}${rect(cx-120,390,240,48,'#577b69',8)}${text(cx,422,'GAMES & SOCIAL',15)}`,
  };
  return `<g data-landmark-interior="${esc(builder)}">${(specs[builder]||(()=>`${plaque(PURPOSE[builder]||'ABUJA LANDMARK')}${rect(110,155,w-220,300,'#d8d4bf',16)}${text(cx,315,(PURPOSE[builder]||'ABUJA').split(' · ')[0],19)}`))()}</g>`;
}

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
  scene.art=`${String(scene.art||'')}${landmarkFixtureArt(landmark.builder,scene.width,scene.height)}`;
  scene.landmarkZones=[...zones];
  scene.venueLayout={venueId:landmark.id,template:LANDMARK_TEMPLATE[landmark.builder]||'authored',landmark:true,authored:true,zones:[...zones]};
  scene.objects=[...(scene.objects||[])];
  // Lightweight 3D accents use already-supported local object models. They sit
  // against rear/side edges so the base walkable route remains intact.
  const w=Number(scene.width)||1050,h=Number(scene.height)||650;
  const accents=[
    {kind:'plant',x:Math.max(20,w*.11),y:Math.max(20,h*.18),w:38,h:38,landmarkFixture:true},
    {kind:'plant',x:Math.max(20,w*.84),y:Math.max(20,h*.18),w:38,h:38,landmarkFixture:true},
  ];
  if(['airport','wtc','cbn','assembly','conference','inec','efcc','court','transcorp'].includes(landmark.builder))accents.push({kind:'lounge-chair',x:Math.max(25,w*.14),y:Math.max(25,h*.72),w:70,h:70,landmarkFixture:true});
  scene.objects.push(...accents);
  return scene;
}

function venueIdFor({profile={},venue}={}){return typeof venue==='string'?venue:venue?.id||profile.location?.venue||null;}
function currentHomeProfile(profile={}){
  if(profile.location?.kind!=='home'||!profile.home?.propertyId)return profile;
  const propertyId=profile.home.propertyId,layout=profile.furnitureLayout||{};
  const furnitureLayout=Array.isArray(layout)?layout.filter(entry=>!entry?.propertyId||entry.propertyId===propertyId):Object.fromEntries(Object.entries(layout).filter(([,entry])=>!entry?.propertyId||entry.propertyId===propertyId));
  const purchasedFurnished=profile.home.purchaseFurnishedPropertyId===propertyId;
  return {...profile,furnitureLayout,home:purchasedFurnished?{...profile.home,furnishingPreset:'lapo-basic'}:profile.home};
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
    return scene;
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
  return scene;
}

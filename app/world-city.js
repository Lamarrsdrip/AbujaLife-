// Authored Abuja-inspired game blocks. This is a playable set, not a street map.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rect = (x,y,w,h,fill,r=0,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
export function cityTree(x,y,s=1,palm=false) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="15" cy="9" rx="55" ry="19" fill="#173d3020"/>${palm?`<path d="M-3 0Q5-51 0-101" fill="none" stroke="#9b7b55" stroke-width="10"/><g fill="#54815b"><path d="M0-102Q-47-150-72-107Q-29-120 0-99M0-102Q-21-163 17-148Q9-125 0-99M0-102Q60-139 74-90Q42-113 0-99M0-101Q22-113 22-67Q12-90 0-99"/></g>`:`<path d="M-5 2L-2-83H7L8 2" fill="#937455"/><path d="M2-48L-27-78M4-41L28-79" fill="none" stroke="#937455" stroke-width="7"/><g class="world-leaves"><path d="M-59-64Q-78-82-59-101Q-64-131-37-138Q-24-160 0-143Q29-158 46-131Q72-128 67-105Q86-84 57-64Q33-46 6-57Q-25-44-59-64Z" fill="#4d7756"/><path d="M-47-101Q-39-133-8-125Q14-146 35-119Q58-122 57-96Q30-104 9-88Q-20-99-47-82Z" fill="#719266"/><path d="M-36-115Q-14-128 8-117" fill="none" stroke="#9aaf75" stroke-width="8" stroke-linecap="round" opacity=".55"/></g>`}</g>`;
}
export function vehicleArt(color='#e7ded1',type='car') {
  const bus=type==='bus',length=bus?172:124;
  return `<g class="vehicle-figure"><ellipse cx="0" cy="10" rx="${length*.52}" ry="37" fill="#1e33302e"/><rect x="${-length/2+15}" y="-34" width="25" height="68" rx="6" fill="#263933"/><rect x="${length/2-40}" y="-34" width="25" height="68" rx="6" fill="#263933"/><rect x="${-length/2}" y="-30" width="${length}" height="58" rx="${bus?12:20}" fill="${color}" stroke="#20393138" stroke-width="2"/><path d="M${-length/2+8}-23H${length/2-18}Q${length/2-3}-17 ${length/2-3}0" fill="none" stroke="#ffffff80" stroke-width="3"/><rect x="${bus?-62:-30}" y="-23" width="${bus?96:67}" height="44" rx="9" fill="#5c7d78"/><path d="M${bus?20:18}-21L${bus?28:31}-16V15L${bus?20:18}20Z" fill="#bed4c5"/><path d="M${bus?-51:-26}-20H${bus?11:14}V19H${bus?-51:-26}Z" fill="${color}"/><path d="M${bus?-47:-21}-17H${bus?8:9}" stroke="#ffffff90" stroke-width="2"/><rect x="${length/2-5}" y="-21" width="5" height="13" rx="2" fill="#fff3ba"/><rect x="${length/2-5}" y="8" width="5" height="13" rx="2" fill="#fff3ba"/><rect x="${-length/2}" y="-21" width="4" height="12" rx="2" fill="#c87957"/><rect x="${-length/2}" y="9" width="4" height="12" rx="2" fill="#c87957"/><path d="M-3-30V-36M-3 29V35" stroke="${color}" stroke-width="8" stroke-linecap="round"/>${type==='taxi'?'<rect x="-16" y="-10" width="20" height="20" rx="3" fill="#efd695"/><path d="M-13-4H1M-13 2H1" stroke="#617157" stroke-width="3"/>':''}</g>`;
}
function garden(x,y,w,h,water=false){return `<g>${rect(x,y,w,h,'#a8ba8b',24)}${rect(x+13,y+13,w-26,h-26,'#b8c69a',18)}<path d="M${x+w/2} ${y+20}V${y+h-20}M${x+20} ${y+h/2}H${x+w-20}" stroke="#e0d6b5" stroke-width="50"/>${water?`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="95" ry="64" fill="#e1e1c4"/><ellipse cx="${x+w/2}" cy="${y+h/2}" rx="82" ry="51" fill="#83b5ac"/><ellipse cx="${x+w/2}" cy="${y+h/2}" rx="65" ry="37" fill="none" stroke="#bcdbcc" stroke-width="3"/><g class="world-fountain"><path d="M${x+w/2} ${y+h/2}V${y+h/2-45}" stroke="#e6f0d7" stroke-width="6" stroke-linecap="round"/><path d="M${x+w/2-22} ${y+h/2-10}Q${x+w/2} ${y+h/2-63} ${x+w/2+22} ${y+h/2-10}" stroke="#cbe5d1" stroke-width="4" fill="none"/></g>`:''}${cityTree(x+60,y+105,.75)}${cityTree(x+w-60,y+105,.75)}${cityTree(x+60,y+h-20,.75)}${cityTree(x+w-60,y+h-20,.75)}${rect(x+70,y+h/2-15,65,25,'#9c825c',5)}${rect(x+w-130,y+h/2-15,65,25,'#9c825c',5)}</g>`;}
function building({id,x,y,w,h,name,tag,wall='#e7dcc1',accent='#4b705d',floors=1,kind='shop'}) {
  const top=y-h, door=x+w*.5;
  let upper='';
  if(floors>1)upper=Array.from({length:floors-1},(_,r)=>Array.from({length:Math.floor(w/76)},(_,i)=>`${rect(x+24+i*76,top+26+r*61,49,41,'#8da79d',2)}<path d="M${x+48+i*76} ${top+28+r*61}V${top+65+r*61}" stroke="#d1dac5" stroke-width="3"/>`).join('')).join('');
  const facade=kind==='home'?`${rect(x+28,y-121,w*.3,83,'#87a497',4)}${rect(x+w*.64,y-121,w*.26,83,'#87a497',4)}${rect(door-27,y-120,55,121,'#8f7658',3)}<path d="M${door+10} ${y-70}V${y-50}" stroke="#e5c485" stroke-width="4"/>`:`${rect(x+22,y-114,w-44,115,'#54746b',3)}${Array.from({length:4},(_,i)=>`<path d="M${x+28+(w-56)/4*i} ${y-108}V${y-5}" stroke="#c6d2bd" stroke-width="5"/>`).join('')}<path d="M${x+27} ${y-87}H${x+w-27}" stroke="#bcd0bd" stroke-width="3"/><path d="M${x+32} ${y-110}L${x+105} ${y-9}M${x+w-95} ${y-110}L${x+w-30} ${y-25}" stroke="#d2e0cb" stroke-width="16" opacity=".13"/>${rect(door-26,y-97,52,97,'#365d50',2)}<path d="M${door+12} ${y-62}V${y-42}" stroke="#daca9c" stroke-width="4"/>`;
  const marquee=kind==='cinema'?`${rect(x+18,y-172,w-36,49,'#3e5650',3)}<text x="${door}" y="${y-141}" fill="#f2e4b7" text-anchor="middle" font-size="23" letter-spacing="6">THE SCREEN</text><path d="M${x+23} ${y-167}H${x+w-23}M${x+23} ${y-128}H${x+w-23}" stroke="#e0c988" stroke-dasharray="2 13" stroke-width="4"/>`:`${rect(x+15,y-163,w-30,39,accent,3)}<text x="${door}" y="${y-138}" fill="#f5edd6" text-anchor="middle" font-size="${name.length>18?17:20}" font-weight="600" letter-spacing="2">${esc(name.toUpperCase())}</text>`;
  return `<g class="city-building" data-world-target="${esc(id)}"><path d="M${x+14} ${y+12}L${x+w+55} ${y+12}L${x+w+68} ${top+14}L${x+w} ${top-13}Z" fill="#38513b1b"/>${rect(x,top,w,h,wall,4)}<path d="M${x+w} ${top}L${x+w+24} ${top+17}V${y+8}L${x+w} ${y}Z" fill="#b9bda4"/><path d="M${x-12} ${top}L${x+9} ${top-27}H${x+w-3}L${x+w+14} ${top}Z" fill="#c4c9b1"/>${rect(x-12,top,w+26,12,'#f1ead2',3)}${upper}${facade}${marquee}${rect(x+7,y-3,w-14,12,'#eee6cc',2)}<path d="M${door-51} ${y+10}H${door+51}L${door+68} ${y+31}H${door-66}Z" fill="#c1c5af"/><text x="${door}" y="${top-42}" text-anchor="middle" fill="#5e7760" font-size="12" font-weight="600" letter-spacing="3">${esc(tag)}</text>${kind==='restaurant'?`<path d="M${x+8} ${y-121}H${x+w-8}L${x+w+6} ${y-101}H${x-7}Z" fill="#94a77a"/><path d="M${x-7} ${y-101}H${x+w+6}" stroke="#d8ddad" stroke-width="9"/>`:''}</g>`;
}
export function buildCity({profile={},place={},id='city',venues=[]}={}) {
 const width=3540,height=2440,interactables=[],obstacles=[];
 const definitions=`<defs><pattern id="${id}-paving" width="66" height="46" patternUnits="userSpaceOnUse"><path d="M0 0H66V46H0Z" fill="none" stroke="#a9b098" stroke-opacity=".26"/></pattern><pattern id="${id}-asphalt" width="17" height="17" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".8" fill="#e6dfbb" opacity=".2"/></pattern></defs>`;
 let art=definitions+rect(0,0,width,height,'#b4c59a')+rect(70,75,3400,2090,'#c9ceb2',70)+rect(80,80,3380,2070,`url(#${id}-paving)`,60);
 // Wide boulevards give both cars and residents a continuous navigable route.
 for(const [y,h] of [[722,252],[1534,234]]) {
   art+=rect(0,y,width,h,'#728478')+rect(0,y,width,h,`url(#${id}-asphalt)`)+`<path d="M0 ${y}H${width}M0 ${y+h}H${width}" stroke="#efdfb8" stroke-width="9"/><path d="M0 ${y+51}H${width}M0 ${y+h-50}H${width}" stroke="#b5c4a8" stroke-width="2"/><path d="M0 ${y+h/2}H${width}" stroke="#e8e0b7" stroke-width="3" stroke-dasharray="52 48"/>`;
 }
 art+=rect(1820,0,254,height,'#78897a')+`<path d="M1820 0V${height}M2074 0V${height}" stroke="#eee0bb" stroke-width="8"/><path d="M1947 0V${height}" stroke="#e9dfb7" stroke-width="3" stroke-dasharray="46 45"/>`;
 for(const y of [734,909,1546,1700])for(let i=0;i<8;i++)art+=rect(1793+i*39,y,20,51,'#e9e4c7',2);
 for(const x of [600,2720])for(let i=0;i<7;i++)art+=rect(x,741+i*31,80,15,'#e9e4c7',1);
 art+=`<text x="970" y="864" fill="#b4c4ae" font-size="18" letter-spacing="10" text-anchor="middle">ABUJA LIFE</text><text x="2620" y="864" fill="#b4c4ae" font-size="15" letter-spacing="7" text-anchor="middle">THE CITY IS YOURS</text>`;
 const specs=[
  {id:'home',x:190,y:600,w:380,h:255,name:profile.home?.district===profile.district?'Your residence':'City residences',tag:'RESIDENTIAL',wall:'#e1dec6',accent:'#6c7c5a',floors:2,kind:'home'},
  {id:'restaurant',x:752,y:600,w:404,h:256,name:'The Palm Kitchen',tag:'EAT · GATHER · STAY A LITTLE',accent:'#6a7957',kind:'restaurant'},
  {id:'gym',x:1290,y:600,w:380,h:270,name:'Form & Motion',tag:'MOVE WITH PURPOSE',accent:'#5b776e',wall:'#dadfcf'},
  {id:'hotel',x:2210,y:600,w:440,h:410,name:'The Ivory Hotel',tag:'YOUR CITY ESCAPE',accent:'#99815e',wall:'#ece4cc',floors:4},
  {id:'cinema',x:2830,y:600,w:450,h:285,name:'The Screen',tag:'A LITTLE ESCAPE',accent:'#59695e',kind:'cinema',wall:'#d0ccb4'},
  {id:'dealership',x:160,y:1400,w:490,h:242,name:'Capital Motors',tag:'FIND YOUR NEXT DRIVE',accent:'#436b64',wall:'#d9e0cb'},
  {id:'estate-office',x:810,y:1400,w:413,h:306,name:'Abuja Homes',tag:'A PLACE TO CALL YOURS',accent:'#997b55',floors:2,wall:'#e8dcc0'},
  {id:'furniture-store',x:2210,y:1400,w:440,h:265,name:'Space & Form',tag:'GOOD THINGS FOR HOME',accent:'#ab7957',wall:'#e7d4b8'},
  {id:'grocery',x:2820,y:1400,w:456,h:259,name:'Fresh Market',tag:'YOUR EVERYDAY GOOD THINGS',accent:'#6d8658',wall:'#e1dfbf'},
  {id:'cafe',x:870,y:2150,w:355,h:230,name:'The Corner Café',tag:'COFFEE & SMALL CHOPS',accent:'#a1845f',wall:'#e9d7b4',kind:'restaurant'},
  {id:'salon',x:1335,y:2150,w:360,h:236,name:'Fresh Studio',tag:'A LITTLE MORE YOU',accent:'#856e73',wall:'#ded1c5'}
 ];
 for(const spec of specs) {
  spec.name=venues.find(v=>v.id===spec.id)?.name||spec.name;
  art+=building(spec);
  obstacles.push({x:spec.x-4,y:spec.y-spec.h-8,w:spec.w+31,h:spec.h+18});
  const isHome=spec.id==='home',canHome=profile.home?.district===profile.district||!profile.district;
  interactables.push({id:spec.id,x:spec.x+spec.w/2,y:spec.y+58,label:isHome?(canHome?'Your front door':'View homes'):(venues.find(v=>v.id===spec.id)?.name||spec.name),action:isHome?(canHome?'enter-home':'estate-office'):'enter-venue',payload:isHome?{}:{venueId:spec.id},radius:78,icon:isHome?'⌂':({restaurant:'♨',gym:'↗',hotel:'✦',cinema:'▷',dealership:'↔','estate-office':'⌂','furniture-store':'▱',grocery:'✿'}[spec.id])});
 }
 art+=garden(1340,1102,362,352,true)+garden(155,1850,640,280)+garden(2250,1860,1030,280,true);
 obstacles.push({x:1440,y:1216,w:164,h:115});
 interactables.push({id:'park',x:1518,y:1480,label:venues.find(v=>v.id==='park')?.name||'Neighbourhood park',action:'enter-venue',payload:{venueId:'park'},radius:80,icon:'♧'});
 art+=`<text x="1518" y="1090" fill="#5e775a" text-anchor="middle" font-size="15" letter-spacing="4">THE GREEN</text>`;
 // Sidewalk trees and planters frame each block, leaving the street and doors open.
 for(const [x,y,s,palm] of [[93,650,1,0],[655,614,.83,1],[1205,643,.83,1],[1745,633,.94,0],[2152,616,.76,1],[2730,626,.86,0],[3400,643,1.1,0],[80,1441,1,0],[705,1449,.85,1],[1264,1455,.83,1],[1740,1435,.93,0],[2145,1450,.81,1],[2728,1440,.87,0],[3390,1435,1.1,0],[1040,1998,1.2,0],[1710,2010,1.2,1]]) {
  art+=cityTree(x,y,s,!!palm);obstacles.push({x:x-10,y:y-12,w:20,h:25});
 }
 for(const y of [672,1480])for(const x of [570,1160,2660,3270])art+=`<g transform="translate(${x} ${y})"><ellipse cy="7" rx="13" ry="5" fill="#294a3320"/><path d="M0 0V-124Q0-133 12-133H31" stroke="#6e816c" stroke-width="5" fill="none"/><path d="M18-136H44L38-127H18Z" fill="#456955"/><path d="M20-127H36" stroke="#efd9a4" stroke-width="3"/></g>`;
 if(/wuse/i.test(`${place.id||''} ${place.name||''}`)) {
  // The Okrika brand is an in-world advertisement, never a shop or game currency.
  art+=`<g class="city-advertisement" aria-label="Okrika advertisement" transform="translate(628 960)"><ellipse cx="114" cy="149" rx="125" ry="17" fill="#28483219"/><path d="M26 92V148M199 92V148" stroke="#60755f" stroke-width="8"/><rect width="226" height="105" rx="5" fill="#52725b"/><rect x="6" y="6" width="214" height="93" rx="2" fill="#eee5ca"/><path d="M157 6H220V99H157Z" fill="#6b875f"/><path d="M172 31L183 24Q190 32 199 24L210 31L205 51L200 48V77H179V48L174 51Z" fill="#e3dbc0"/><path d="M184 26Q190 39 198 27" fill="none" stroke="#9aaf84" stroke-width="2"/><text x="19" y="45" fill="#365b43" font-family="Georgia,serif" font-size="31">Okrika</text><text x="19" y="64" fill="#63725a" font-size="8" letter-spacing="1.3">GOOD FINDS. REAL LIFE.</text><text x="19" y="85" fill="#8b8d75" font-size="7" letter-spacing="1.8">ADVERTISEMENT</text></g>`;
  obstacles.push({x:646,y:1096,w:18,h:23},{x:819,y:1096,w:18,h:23});
 }
 for(const x of [303,457,570])art+=`<g transform="translate(${x} 1294) scale(.8)">${vehicleArt(x===303?'#ddc5a1':x===457?'#738d83':'#e8e3ce')}</g>`;

 return {width,height,art,obstacles,interactables,spawn:{x:445,y:679},title:place.name||'Abuja',subtitle:'Neighbourhood · free roam',traffic:[{axis:'x',lane:798,speed:115,color:'#d5b88c',type:'taxi',offset:190},{axis:'x',lane:902,speed:-96,color:'#e6dfc9',offset:2350},{axis:'x',lane:1601,speed:106,color:'#8baba2',offset:1200},{axis:'x',lane:1705,speed:-85,color:'#d3cdb0',type:'bus',offset:2780},{axis:'y',lane:1890,speed:94,color:'#b98761',offset:260},{axis:'y',lane:2011,speed:-112,color:'#dfe2d0',offset:1700}],pedestrians:[{x:640,y:681,toX:1190,toY:681},{x:2140,y:677,toX:2760,toY:677},{x:1320,y:1490,toX:1700,toY:1490},{x:2230,y:1490,toX:2800,toY:1490},{x:790,y:1040,toX:1720,toY:1040},{x:2960,y:1040,toX:3310,toY:1040}]};
}
export function buildJourney({profile={},place={},id='journey'}={}) {
 const width=14000,height=1450;
 let art=`<defs><linearGradient id="${id}-horizon" x2="0" y2="1"><stop stop-color="#c6dacf"/><stop offset="1" stop-color="#e7dfb6"/></linearGradient></defs>${rect(0,0,width,height,`url(#${id}-horizon)`)}<path d="M0 370${Array.from({length:30},(_,i)=>`Q${i*500+125} ${180+(i%3)*46} ${i*500+350} 335`).join('')}V760H0Z" fill="#a5b699"/>${rect(0,530,width,140,'#b5c69d')}${rect(0,674,width,317,'#718374')}${rect(0,991,width,459,'#b1c18f')}<path d="M0 674H${width}M0 990H${width}" stroke="#e5dfb6" stroke-width="9"/><path d="M0 824H${width}" stroke="#e9e0b7" stroke-width="4" stroke-dasharray="74 80"/><path d="M0 705H${width}M0 954H${width}" stroke="#b1c1a5" stroke-width="3"/>`;
 for(let x=80;x<width;x+=430){art+=cityTree(x,650,.85,x%860===80)+cityTree(x+190,1180,1.2,x%860!==80);if(x%1290===80)art+=`<g transform="translate(${x} 440)"><path d="M0 0H198V132H0Z" fill="#dbd9bd"/><path d="M-12-6L94-48L210-6V7H-12Z" fill="#8ea084"/><path d="M24 35H74V92H24ZM110 35H162V92H110Z" fill="#83a293"/></g>`;}
 art+=`<g transform="translate(11100 567)"><rect width="560" height="89" rx="10" fill="#54785b"/><text x="280" y="56" text-anchor="middle" fill="#eee8c6" font-size="28" letter-spacing="3">WELCOME TO YOUR NEXT CHAPTER</text></g>`;
 return {width,height,art,obstacles:[],interactables:[],spawn:{x:450,y:889},title:'On the road',subtitle:'A little city between here and there',traffic:[{axis:'x',lane:757,speed:-145,color:'#d3cba9',type:'bus',offset:2300},{axis:'x',lane:756,speed:-110,color:'#78998e',offset:9200}],pedestrians:[]};
}

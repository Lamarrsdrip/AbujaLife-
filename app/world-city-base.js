import { CITY_LANDMARKS } from '../src/shared/city-landmarks.mjs';
import { WORLD_LANDMARK_SIZES } from '../src/shared/world-landmark-sizes.mjs';
// Authored Abuja-inspired game blocks. This is a playable set, not a street map.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lineForShutter = (x,y,w) => `<path d="M${x} ${y}h${w}" stroke="#b0b8a2" stroke-width="2"/>`;
const rect = (x,y,w,h,fill,r=0,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
export function cityTree(x,y,s=1,palm=false) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="15" cy="9" rx="55" ry="19" fill="#173d3020"/>${palm?`<path d="M-3 0Q5-51 0-101" fill="none" stroke="#9b7b55" stroke-width="10"/><g fill="#54815b"><path d="M0-102Q-47-150-72-107Q-29-120 0-99M0-102Q-21-163 17-148Q9-125 0-99M0-102Q60-139 74-90Q42-113 0-99M0-101Q22-113 22-67Q12-90 0-99"/></g>`:`<path d="M-5 2L-2-83H7L8 2" fill="#937455"/><path d="M2-48L-27-78M4-41L28-79" fill="none" stroke="#937455" stroke-width="7"/><g class="world-leaves"><path d="M-59-64Q-78-82-59-101Q-64-131-37-138Q-24-160 0-143Q29-158 46-131Q72-128 67-105Q86-84 57-64Q33-46 6-57Q-25-44-59-64Z" fill="#4d7756"/><path d="M-47-101Q-39-133-8-125Q14-146 35-119Q58-122 57-96Q30-104 9-88Q-20-99-47-82Z" fill="#719266"/><path d="M-36-115Q-14-128 8-117" fill="none" stroke="#9aaf75" stroke-width="8" stroke-linecap="round" opacity=".55"/></g>`}</g>`;
}
export function vehicleArt(color='#e7ded1',type='sedan',model='') {
  const bus=type==='bus',boxy=type==='offroad',suv=type==='suv',hatch=type==='hatchback',bmw=String(model).includes('bmw')||model==='city-sedan',mercedes=String(model).includes('mercedes');
  const length=bus?184:boxy?151:suv?153:hatch?115:mercedes?153:bmw?148:139,width=bus?68:boxy?73:suv?71:hatch?57:62,half=length/2,side=width/2;
  const cabinLeft=bus?-66:boxy?-54:suv?-47:hatch?-40:-34,cabinRight=bus?49:boxy?27:suv?28:hatch?23:19;
  const radius=boxy?7:bus?10:suv?16:hatch?23:21;
  const body=`M${-half+radius} ${-side}H${half-radius}Q${half} ${-side+2} ${half} ${-side+radius}V${side-radius}Q${half} ${side} ${half-radius} ${side}H${-half+radius}Q${-half} ${side} ${-half} ${side-radius}V${-side+radius}Q${-half} ${-side} ${-half+radius} ${-side}Z`;
  return `<g class="vehicle-figure" data-vehicle-body="${type}" data-vehicle-model="${esc(model)}"><ellipse cx="5" cy="12" rx="${half+4}" ry="${side+7}" fill="#172b2b33"/>
  ${[-1,1].map(y=>[-1,1].map(x=>`<rect x="${x*length*.31-12}" y="${y*side-5}" width="26" height="11" rx="4" fill="#202827"/><path d="M${x*length*.31-8} ${y*side}h18" stroke="#78807c" stroke-width="2"/>`).join('')).join('')}
  <path d="${body}" fill="${color}" stroke="#182e314d" stroke-width="1.5"/><path d="M${-half+13} ${-side+5}H${half-23}Q${half-7} ${-side+8} ${half-5} ${-side+19}" fill="none" stroke="#ffffff94" stroke-width="2.4"/>
  <path d="M${-half+9} ${side-5}H${half-11}" stroke="#152e3545" stroke-width="5" stroke-linecap="round"/>
  <path d="M${cabinLeft} ${-side+8}H${cabinRight}L${cabinRight+21} ${-side+17}V${side-17}L${cabinRight} ${side-8}H${cabinLeft}L${cabinLeft-12} ${side-17}V${-side+17}Z" fill="#314c53"/>
  <path d="M${cabinRight} ${-side+10}L${cabinRight+18} ${-side+18}V${side-18}L${cabinRight} ${side-10}Z" fill="#9bb9bd"/>
  <path d="M${cabinLeft+2} ${-side+10}H${cabinRight-4}V${side-10}H${cabinLeft+2}Z" fill="${color}"/>
  <path d="M${cabinLeft+5} ${-side+11}H${cabinRight-7}" stroke="#fff9" stroke-width="2"/>
  <path d="M${cabinLeft-2} ${-side+10}L${cabinLeft-10} ${-side+18}V${side-18}L${cabinLeft-2} ${side-10}Z" fill="#77989f"/>
  <path d="M${cabinRight+26} ${-side+12}L${half-14} ${-side+15}M${cabinRight+26} ${side-12}L${half-14} ${side-15}" stroke="#fff" opacity=".29" stroke-width="1.5"/>
  ${suv||boxy?`<path d="M${cabinLeft+4} ${-side+6}H${cabinRight-4}M${cabinLeft+4} ${side-6}H${cabinRight-4}" stroke="#253c3f" stroke-width="3" stroke-linecap="round"/>`:''}
  ${boxy?`<rect x="${-half-7}" y="-16" width="12" height="32" rx="5" fill="#293335"/><rect x="${-half-5}" y="-12" width="9" height="24" rx="3" fill="${color}"/>`:''}
  <path d="M${cabinRight+9} ${-side+2}V${-side-5}M${cabinRight+9} ${side-2}V${side+5}" stroke="${color}" stroke-width="7" stroke-linecap="round"/>
  <path d="M${half-4} ${-side+12}V${-side+22}M${half-4} ${side-12}V${side-22}" stroke="#f6f6d7" stroke-width="${boxy?6:4}" stroke-linecap="round"/>
  <path d="M${-half+3} ${-side+10}V${-side+20}M${-half+3} ${side-10}V${side-20}" stroke="#be5351" stroke-width="4" stroke-linecap="round"/>
  <path d="M${half-2}-9V9" stroke="#28383c" stroke-width="4"/>
  ${bmw?`<path d="M${half-2}-8V-2M${half-2} 2V8" stroke="#d8dbd1" stroke-width="2"/>`:mercedes?`<circle cx="${half-2}" cy="0" r="3" fill="#b8c3bd"/>`:''}
  <rect x="${half-1}" y="-4" width="2" height="8" rx=".5" fill="#f3ede0"/>
  ${type==='taxi'?'<rect x="-12" y="-8" width="20" height="16" rx="3" fill="#eac974"/><path d="M-10-3H5M-10 2H5" stroke="#304d4c" stroke-width="2"/>':''}
  ${bus?'<path d="M-49-24H32M-49 24H32" stroke="#94b9bb" stroke-width="5" stroke-dasharray="12 4"/><rect x="-21" y="-15" width="25" height="30" rx="4" fill="#ffffff44"/>':''}</g>`;
}

function garden(x,y,w,h,water=false){return `<g>${rect(x,y,w,h,'#a8ba8b',24)}${rect(x+13,y+13,w-26,h-26,'#b8c69a',18)}<path d="M${x+w/2} ${y+20}V${y+h-20}M${x+20} ${y+h/2}H${x+w-20}" stroke="#e0d6b5" stroke-width="50"/>${water?`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="95" ry="64" fill="#e1e1c4"/><ellipse cx="${x+w/2}" cy="${y+h/2}" rx="82" ry="51" fill="#83b5ac"/><ellipse cx="${x+w/2}" cy="${y+h/2}" rx="65" ry="37" fill="none" stroke="#bcdbcc" stroke-width="3"/><g class="world-fountain"><path d="M${x+w/2} ${y+h/2}V${y+h/2-45}" stroke="#e6f0d7" stroke-width="6" stroke-linecap="round"/><path d="M${x+w/2-22} ${y+h/2-10}Q${x+w/2} ${y+h/2-63} ${x+w/2+22} ${y+h/2-10}" stroke="#cbe5d1" stroke-width="4" fill="none"/></g>`:''}${cityTree(x+60,y+105,.75)}${cityTree(x+w-60,y+105,.75)}${cityTree(x+60,y+h-20,.75)}${cityTree(x+w-60,y+h-20,.75)}${rect(x+70,y+h/2-15,65,25,'#9c825c',5)}${rect(x+w-130,y+h/2-15,65,25,'#9c825c',5)}</g>`;}
function building({id,x,y,w,h,name,tag,wall='#e7dcc1',accent='#4b705d',floors=1,kind='shop',context=false}) {
  const top=y-h, door=x+w*.5;
  let upper='';
  if(floors>1)upper=Array.from({length:floors-1},(_,r)=>Array.from({length:Math.floor(w/76)},(_,i)=>`${rect(x+24+i*76,top+26+r*61,49,41,'#8da79d',2)}<path d="M${x+48+i*76} ${top+28+r*61}V${top+65+r*61}" stroke="#d1dac5" stroke-width="3"/>`).join('')).join('');
  const facade=kind==='home'?`${rect(x+28,y-121,w*.3,83,'#87a497',4)}${rect(x+w*.64,y-121,w*.26,83,'#87a497',4)}${rect(door-27,y-120,55,121,'#8f7658',3)}<path d="M${door+10} ${y-70}V${y-50}" stroke="#e5c485" stroke-width="4"/>`:`${rect(x+22,y-114,w-44,115,'#54746b',3)}${Array.from({length:4},(_,i)=>`<path d="M${x+28+(w-56)/4*i} ${y-108}V${y-5}" stroke="#c6d2bd" stroke-width="5"/>`).join('')}<path d="M${x+27} ${y-87}H${x+w-27}" stroke="#bcd0bd" stroke-width="3"/><path d="M${x+32} ${y-110}L${x+105} ${y-9}M${x+w-95} ${y-110}L${x+w-30} ${y-25}" stroke="#d2e0cb" stroke-width="16" opacity=".13"/>${rect(door-26,y-97,52,97,'#365d50',2)}<path d="M${door+12} ${y-62}V${y-42}" stroke="#daca9c" stroke-width="4"/>`;
  const marquee=kind==='cinema'?`${rect(x+18,y-172,w-36,49,'#3e5650',3)}<text x="${door}" y="${y-141}" fill="#f2e4b7" text-anchor="middle" font-size="23" letter-spacing="6">THE SCREEN</text><path d="M${x+23} ${y-167}H${x+w-23}M${x+23} ${y-128}H${x+w-23}" stroke="#e0c988" stroke-dasharray="2 13" stroke-width="4"/>`:`${rect(x+15,y-163,w-30,39,accent,3)}<text x="${door}" y="${y-138}" fill="#f5edd6" text-anchor="middle" font-size="${name.length>18?17:20}" font-weight="600" letter-spacing="2">${esc(name.toUpperCase())}</text>`;
  const techFront=kind==='tech-market'?Array.from({length:3},(_,i)=>{const left=x+24+i*(w-48)/3,span=(w-48)/3-10;return rect(left,y-123,span,18,i%2?'#ad9974':'#486d72',2)+rect(left,y-95,span,52,'#78918a',2)+Array.from({length:4},(_,row)=>lineForShutter(left+3,y-85+row*10,span-6)).join('')+`<text x="${left+span/2}" y="${y-109}" fill="#efe6cf" text-anchor="middle" font-size="10" letter-spacing="1">${['LAPTOPS','REPAIRS','GADGETS'][i]}</text>`;}).join(''):'';
  return `<g class="${context?'city-context-block':'city-building'}" ${context?'aria-hidden="true"':`data-world-target="${esc(id)}"`}><path d="M${x+14} ${y+12}L${x+w+55} ${y+12}L${x+w+68} ${top+14}L${x+w} ${top-13}Z" fill="#38513b1b"/>${rect(x,top,w,h,wall,4)}<path d="M${x+w} ${top}L${x+w+24} ${top+17}V${y+8}L${x+w} ${y}Z" fill="#b9bda4"/><path d="M${x-12} ${top}L${x+9} ${top-27}H${x+w-3}L${x+w+14} ${top}Z" fill="#c4c9b1"/>${rect(x-12,top,w+26,12,'#f1ead2',3)}${upper}${facade}${techFront}${marquee}${kind==='mosque'?`<path d="M${door-72} ${top}Q${door-70} ${top-94} ${door} ${top-101}Q${door+70} ${top-94} ${door+72} ${top}Z" fill="#a4b392"/><path d="M${door} ${top-101}V${top-125}" stroke="#a49157" stroke-width="4"/><circle cx="${door+1}" cy="${top-128}" r="9" fill="#c6b16c"/><circle cx="${door+5}" cy="${top-132}" r="8" fill="#b4c59a"/><path d="M${x+25} ${top}V${top-132}H${x+51}V${top}" fill="#e9e3cc"/><path d="M${x+21} ${top-131}L${x+38} ${top-157}L${x+55} ${top-131}Z" fill="#809b79"/>`:kind==='church'?`<path d="M${door-51} ${top}L${door} ${top-110}L${door+51} ${top}Z" fill="#9b947b"/><path d="M${door} ${top-144}V${top-107}M${door-12} ${top-131}H${door+12}" stroke="#f2e5c4" stroke-width="6"/>`:kind==='club'?`<path d="M${x+17} ${top+17}H${x+w-17}" stroke="#ddd5f3" stroke-width="4"/><path d="M${x+17} ${top+23}H${x+w-17}" stroke="#8b7696" stroke-width="3"/>`:''}${rect(x+7,y-3,w-14,12,'#eee6cc',2)}<path d="M${door-51} ${y+10}H${door+51}L${door+68} ${y+31}H${door-66}Z" fill="#c1c5af"/><text x="${door}" y="${top-42}" text-anchor="middle" fill="#5e7760" font-size="12" font-weight="600" letter-spacing="3">${esc(tag)}</text>${kind==='restaurant'?`<path d="M${x+8} ${y-121}H${x+w-8}L${x+w+6} ${y-101}H${x-7}Z" fill="#94a77a"/><path d="M${x-7} ${y-101}H${x+w+6}" stroke="#d8ddad" stroke-width="9"/>`:''}</g>`;
}

const ellipse = (cx,cy,rx,ry,fill,extra='') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const WORLD_LANDMARK_LAYOUT=Object.freeze({
  'airport-hub':[4050,3800],'efcc-hq':[4850,3720],
  'city-gate-plaza':[4020,3010],'national-stadium-hub':[4800,3000],'magicland':[5580,3010],
  'jabi-lake':[6380,3180],'jabi-lake-mall':[7160,3180],
  'banex':[4700,2200],'farm-city':[5480,2180],'federal-high-court-hub':[6280,2190],
  'wtc-abuja-hub':[4040,1510],'cbn-experience':[4820,1510],'national-christian-centre-hub':[5600,1510],
  'international-conference-centre':[6380,1510],'eagle-square-hub':[7160,1510],'aso-rock-view':[7980,1510],
  'national-mosque-hub':[4060,680],'national-assembly-hub':[5000,680],'transcorp-hilton-hub':[5940,690],
  'millennium-park-hub':[6880,680],'inec-hq':[7900,690]
});
const landmarkWorldPoint=place=>{const point=WORLD_LANDMARK_LAYOUT[place.id];return point?{x:point[0],y:point[1]}:{x:3900+(place.lon-7.2642)*15500,y:430+(9.09-place.lat)*18000};};
export function landmarkExterior(place,x,y,size=null){
  const id=esc(place.id),label=esc(place.short||place.name),b=place.builder,w=size?.[0]||(place.id==='airport-hub'?430:place.id==='national-stadium-hub'?330:place.id==='jabi-lake-mall'?320:270),h=size?.[1]||(['wtc','transcorp'].includes(b)?330:['assembly','mosque','church','inec','efcc','court'].includes(b)?240:190),left=x-w/2,top=y-h;
  let body='';
  if(b==='airport') body=rect(left,top+58,w,112,'#e5e2d1',8)+rect(left+20,top+80,w-40,58,'#73928d',4)+rect(left+w-84,top-8,24,117,'#d7d8ca',8)+ellipse(left+w-72,top-8,20,9,'#59786f')+`<g transform="translate(${left-120} ${y+28})"><g class="airport-plane airport-plane-a"><path d="M0 0L122-10L154 0L122 10Z" fill="#eee9d8"/><path d="M65-4L91-50L112-46L98-1L112 46L91 50L65 4Z" fill="#d6d9ca"/></g></g>`+rect(left-160,y+49,w+350,24,'#606f68',3);
  else if(b==='cityGate') body=`<path d="M${left+42} ${y}Q${left+55} ${top+18} ${x-15} ${top+6}V${y}H${x-55}Z" fill="#e5dfc9"/><path d="M${x+15} ${y}V${top+6}Q${left+w-55} ${top+18} ${left+w-42} ${y}H${x+55}Z" fill="#e5dfc9"/>`+rect(x-62,top+82,124,24,'#557765',4);
  else if(b==='stadium') body=ellipse(x,top+106,w/2,92,'#d5d7c5')+ellipse(x,top+106,w*.39,66,'#66856e')+ellipse(x,top+106,w*.29,45,'#87a77e');
  else if(b==='magicland') body=rect(left,top+80,w*.48,110,'#d7b17f',5)+`<circle cx="${x+70}" cy="${top+91}" r="72" fill="none" stroke="#b77568" stroke-width="9"/><path d="M${x+70} ${top+19}V${top+163}M${x-2} ${top+91}H${x+142}M${x+20} ${top+41}L${x+120} ${top+141}M${x+120} ${top+41}L${x+20} ${top+141}" stroke="#6f7e73" stroke-width="4"/>`;
  else if(b==='wtc') body=rect(x-92,top,76,h,'#547682',4)+rect(x+16,top+58,76,h-58,'#637f87',4)+Array.from({length:5},(_,i)=>rect(x-81,top+34+i*48,54,20,'#a9c1ba',2)).join('');
  else if(b==='assembly') body=rect(left,top+92,w,148,'#e3dcc8',6)+ellipse(x,top+91,92,52,'#b6ad87')+rect(x-35,top+35,70,58,'#c7b36f',8);
  else if(b==='mosque') body=rect(left,top+89,w,151,'#e8e1cd',5)+ellipse(x,top+88,86,56,'#8ca384')+rect(left+24,top+5,24,218,'#e8e1cd',6)+ellipse(left+36,top+4,22,12,'#79956f');
  else if(b==='church') body=rect(left,top+80,w,160,'#e8dec7',5)+`<path d="M${left+35} ${top+80}L${x} ${top+8}L${left+w-35} ${top+80}Z" fill="#9b8f75"/><path d="M${x} ${top-25}V${top+24}M${x-17} ${top-8}H${x+17}" stroke="#f0dfb8" stroke-width="8"/>`;
  else if(b==='aso') body=`<path d="M${left} ${y}Q${left+55} ${top+55} ${x-35} ${top+18}Q${x+18} ${top-26} ${left+w} ${y}Z" fill="#8f9b78"/><path d="M${left+33} ${y-19}Q${x} ${top+49} ${left+w-27} ${y-15}" stroke="#c4c5a2" stroke-width="6" fill="none"/>`;
  else if(b==='jabiLake') body=ellipse(x,top+105,w/2,92,'#75a9a6')+ellipse(x,top+105,w*.38,67,'none','stroke="#c5ded2" stroke-width="5"');
  else if(b==='mall') body=rect(left,top+44,w,h-44,'#ddd7c3',7)+rect(left+21,top+72,w-42,101,'#75948e',4)+rect(x-38,top+5,76,50,'#b88462',8);
  else if(b==='conference') body=rect(left,top+68,w,h-68,'#ded9c6',7)+`<path d="M${left+22} ${top+68}Q${x} ${top-25} ${left+w-22} ${top+68}Z" fill="#82988a"/>`;
  else if(b==='inec') body=rect(left,top+48,w,h-48,'#e6e1cd',7)+rect(left+18,top+75,w-36,57,'#668575',4)+rect(x-56,top+5,112,49,'#6f936e',5)+`<text x="${x}" y="${top+38}" fill="#f1ead5" text-anchor="middle" font-size="21" font-weight="700">INEC</text>`;
  else if(b==='efcc') body=rect(left,top+35,w,h-35,'#d8ded2',6)+rect(left+28,top+62,w-56,h-89,'#5f7d73',4)+rect(x-60,top-7,120,48,'#8d9b77',4);
  else if(b==='court') body=rect(left,top+78,w,h-78,'#e6dfca',4)+Array.from({length:6},(_,i)=>rect(left+28+i*39,top+73,17,145,'#c8bea3',2)).join('')+`<path d="M${left+12} ${top+78}L${x} ${top+13}L${left+w-12} ${top+78}Z" fill="#9d947b"/>`;
  else if(b==='transcorp') body=rect(left+35,top,w-70,h,'#d9d8c9',6)+rect(left+62,top+35,w-124,h-67,'#6e8d88',3)+rect(left,top+142,w,76,'#e4dbc4',5);
  else if(b==='millennium') body=rect(left,top+60,w,h-60,'#a9bb91',20)+cityTree(x-70,y-25,.65)+cityTree(x+72,y-25,.65)+`<path d="M${left+32} ${y-28}Q${x} ${top+52} ${left+w-31} ${y-28}" stroke="#e2d5ae" stroke-width="28" fill="none"/>`;
  else if(b==='farmCity') body=rect(left,top+50,w,h-50,'#d7b889',7)+rect(left+18,top+76,w-36,84,'#718b76',4)+rect(x-68,top+6,136,51,'#906f50',5);
  else if(b==='banex') body=rect(left,top+43,w,h-43,'#d2cbb5',4)+Array.from({length:4},(_,i)=>rect(left+19+i*58,top+78,47,86,i%2?'#6c8985':'#9d8665',3)).join('');
  else body=rect(left,top+46,w,h-46,'#ded8c4',6)+rect(left+24,top+72,w-48,h-98,'#71908a',3)+rect(x-58,top+5,116,49,'#748776',5);
  return {art:`<g class="city-landmark city-landmark-${id}" data-world-target="${id}">${body}<rect x="${left-8}" y="${y+8}" width="${w+16}" height="42" rx="9" fill="#f1ead2"/><text x="${x}" y="${y+35}" text-anchor="middle" fill="#466655" font-size="${label.length>20?13:16}" font-weight="700">${label}</text></g>`,obstacle:{x:left-7,y:top-8,w:w+14,h:h+18},entrance:{x,y:y+84}};
}

export function buildCity({profile={},place={},id='city',venues=[]}={}) {
 const width=8500,height=4190,interactables=[],obstacles=[];
 const definitions=`<defs><pattern id="${id}-paving" width="66" height="46" patternUnits="userSpaceOnUse"><path d="M0 0H66V46H0Z" fill="none" stroke="#a9b098" stroke-opacity=".26"/></pattern><pattern id="${id}-asphalt" width="17" height="17" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".8" fill="#e6dfbb" opacity=".2"/></pattern></defs>`;
 let art=definitions+rect(0,0,width,height,'#b4c59a')+rect(70,75,3400,3980,'#c9ceb2',70)+rect(80,80,3380,3960,`url(#${id}-paving)`,60);
 // Wide boulevards give both cars and residents a continuous navigable route.
 for(const [y,h] of [[722,252],[1534,234],[2284,234],[3170,234]]) {
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
  {id:'dealership',x:160,y:1400,w:490,h:242,name:'Abuja Car',tag:'FIND YOUR NEXT DRIVE',accent:'#436b64',wall:'#d9e0cb'},
  {id:'estate-office',x:810,y:1400,w:413,h:306,name:'Abuja Homes',tag:'A PLACE TO CALL YOURS',accent:'#997b55',floors:2,wall:'#e8dcc0'},
  {id:'furniture-store',x:2210,y:1400,w:440,h:265,name:'Okrika Marketplace',tag:'GOOD FINDS · REAL LIFE',accent:'#ab7957',wall:'#e7d4b8'},
  {id:'grocery',x:2820,y:1400,w:456,h:259,name:'Fresh Market',tag:'YOUR EVERYDAY GOOD THINGS',accent:'#6d8658',wall:'#e1dfbf'},
  {id:'cafe',x:870,y:2150,w:355,h:230,name:'The Corner Café',tag:'COFFEE & SMALL CHOPS',accent:'#a1845f',wall:'#e9d7b4',kind:'restaurant'},
  {id:'salon',x:1335,y:2150,w:360,h:236,name:'Fresh Studio',tag:'A LITTLE MORE YOU',accent:'#856e73',wall:'#ded1c5'},
  {id:'mosque',x:185,y:3030,w:450,h:335,name:'Neighbourhood Mosque',tag:'PRAYER & COMMUNITY',accent:'#577e68',wall:'#eee8d5',kind:'mosque'},
  {id:'church',x:880,y:3030,w:465,h:335,name:'Community Church',tag:'A MOMENT OF PEACE',accent:'#a38c6b',wall:'#eee4cb',kind:'church'},
  {id:'club',x:2240,y:3030,w:425,h:286,name:'Tokyo',tag:'A LITTLE AFTER DARK',accent:'#6b6a89',wall:'#b5b4b3',kind:'club'},
  {id:'games-lounge',x:2840,y:3030,w:440,h:270,name:'Dice & Chill',tag:'GOOD GAMES · GOOD COMPANY',accent:'#647e78',wall:'#dce0cd'},
  {id:'banex',x:865,y:3970,w:700,h:345,name:'Banex Tech Market',tag:'COMPUTERS · REPAIRS · ACCESSORIES',accent:'#3c626d',wall:'#c7c4ad',kind:'tech-market'},
  {id:'club-cage',x:185,y:3970,w:465,h:300,name:'Cage',tag:'MOVE TO YOUR OWN RHYTHM',accent:'#657185',wall:'#acb3b1',kind:'club'},
  {id:'magic-city',x:2230,y:3970,w:465,h:315,name:'Magic City',tag:'THE STAGE IS SET',accent:'#8d677a',wall:'#cfb6bc',kind:'club'},
  {id:'bear-barn',x:2840,y:3970,w:440,h:284,name:'Bear Barn',tag:'YOUR PEOPLE · YOUR EVENING',accent:'#99784e',wall:'#d1bf9f',kind:'restaurant'}
 ];
 for(const spec of specs) {
  const localVenue=venues.find(venue=>venue.id===spec.id);
  spec.name=localVenue?.name||spec.name;
  // Distant venues keep city fabric, but their named entrance exists only in
  // their own district. SVG fallback and WebGL share the same local contract.
  art+=building(spec.id==='home'||localVenue?spec:{...spec,name:'',tag:'',kind:'shop',context:true});
  obstacles.push({x:spec.x-4,y:spec.y-spec.h-8,w:spec.w+31,h:spec.h+18});
  const isHome=spec.id==='home',canHome=profile.home?.district===profile.district||!profile.district;
  // A venue listed for another district stays on the skyline, but its door starts
  // the real cross-neighbourhood journey instead of pretending the player can walk in.
  const remote=localVenue?.districts&&!localVenue.districts.includes(profile.district);
  if(isHome||localVenue)interactables.push({id:spec.id,x:spec.x+spec.w/2,y:spec.y+58,label:isHome?(canHome?'Your front door':'View homes'):(localVenue?.name||spec.name),action:isHome?(canHome?'enter-home':'estate-office'):remote?'travel-venue':'enter-venue',payload:isHome?{}:remote?{destinationVenueId:spec.id,districtId:localVenue.districts[0]}:{venueId:spec.id},radius:78,icon:isHome?'⌂':({restaurant:'♨',gym:'↗',hotel:'✦',cinema:'▷',dealership:'↔','estate-office':'⌂','furniture-store':'▱',grocery:'✿'}[spec.id])});
 }
 const neighbourhoodFabric=[
  {x:40,y:1188,w:330,h:145,c:'#d9d1be'},{x:430,y:1200,w:285,h:132,c:'#c9cfbf'},{x:820,y:1192,w:310,h:150,c:'#e0d7c2'},
  {x:2140,y:1200,w:320,h:145,c:'#d2c9b6'},{x:2570,y:1200,w:300,h:138,c:'#c8d0c0'},{x:2960,y:1200,w:315,h:150,c:'#ddd4be'},
  {x:820,y:2840,w:325,h:154,c:'#d4cbb8'},{x:1370,y:2840,w:315,h:146,c:'#cad1c1'},{x:2160,y:2840,w:330,h:150,c:'#e0d6c0'},
  {x:2700,y:2840,w:310,h:142,c:'#cdd0bd'},{x:3050,y:3650,w:300,h:148,c:'#d9ceb9'},{x:1710,y:3650,w:330,h:150,c:'#c9d0bf'}
 ];
 for(const [i,b] of neighbourhoodFabric.entries()){
  const top=b.y-b.h,windows=Array.from({length:4},(_,k)=>rect(b.x+28+k*(b.w-62)/4,top+38,34,42,'#76918b',3)+rect(b.x+28+k*(b.w-62)/4,top+91,34,28,'#829a91',3)).join('');
  art+=`<g class="city-neighbourhood-fabric" aria-hidden="true">${rect(b.x,top,b.w,b.h,b.c,7)}${rect(b.x-7,top,b.w+14,10,'#eee7d4',4)}${windows}${rect(b.x+b.w*.44,b.y-58,b.w*.14,58,'#617a70',3)}</g>`;
  obstacles.push({x:b.x-5,y:top-6,w:b.w+20,h:b.h+14});
  if(i%2===0)art+=cityTree(b.x-24,b.y-8,.58,i%4===0);
 }
 art+=garden(1340,1102,362,352,true)+garden(155,1850,640,280)+garden(2250,1860,1030,280,true);
 obstacles.push({x:1440,y:1216,w:164,h:115});
 interactables.push({id:'park',x:1518,y:1480,label:venues.find(v=>v.id==='park')?.name||'Neighbourhood park',action:'enter-venue',payload:{venueId:'park'},radius:80,icon:'♧'});
 art+=`<text x="1518" y="1090" fill="#5e775a" text-anchor="middle" font-size="15" letter-spacing="4">THE GREEN</text>`;
 if(venues.some(v=>v.id==='jabi-lake')){
  art+=rect(2220,1850,1070,290,'#9fb8a0',29)+rect(2240,1865,1030,205,'#78aaa6',26)+`<path d="M2280 1930Q2420 1910 2570 1930T2860 1930T3170 1930M2340 1990Q2480 1970 2630 1990T2920 1990T3210 1990" stroke="#d2e1cf" stroke-width="3" opacity=".5" fill="none"/><path d="M2600 2050H2810V2086H2600Z" fill="#c2aa7a"/><text x="2755" y="2117" text-anchor="middle" fill="#466f66" font-size="16" letter-spacing="4">JABI LAKE</text>`;
  obstacles.push({x:2240,y:1865,w:1030,h:205});
  interactables.push({id:'jabi-lake',x:2755,y:2200,label:'Jabi Lake',action:'enter-venue',payload:{venueId:'jabi-lake'},radius:90});
 }
 // Sidewalk trees and planters frame each block, leaving the street and doors open.
 for(const [x,y,s,palm] of [[93,650,1,0],[655,614,.83,1],[1205,643,.83,1],[1745,633,.94,0],[2152,616,.76,1],[2730,626,.86,0],[3400,643,1.1,0],[80,1441,1,0],[705,1449,.85,1],[1264,1455,.83,1],[1740,1435,.93,0],[2145,1450,.81,1],[2728,1440,.87,0],[3390,1435,1.1,0],[1040,1998,1.2,0],[1710,2010,1.2,1]]) {
  art+=cityTree(x,y,s,!!palm);obstacles.push({x:x-10,y:y-12,w:20,h:25});
 }
 for(const y of [672,1480,3090])for(const x of [570,1160,2660,3270])art+=`<g transform="translate(${x} ${y})"><ellipse cy="7" rx="13" ry="5" fill="#294a3320"/><path d="M0 0V-124Q0-133 12-133H31" stroke="#6e816c" stroke-width="5" fill="none"/><path d="M18-136H44L38-127H18Z" fill="#456955"/><path d="M20-127H36" stroke="#efd9a4" stroke-width="3"/></g>`;
 if(/wuse/i.test(`${place.id||''} ${place.name||''}`)) {
  // Okrika appears as an independent brand advertisement; no commerce integration.
  art+=`<g class="city-advertisement" aria-label="Okrika advertisement" transform="translate(628 960)"><ellipse cx="114" cy="149" rx="125" ry="17" fill="#28483219"/><path d="M26 92V148M199 92V148" stroke="#60755f" stroke-width="8"/><rect width="226" height="105" rx="5" fill="#52725b"/><rect x="6" y="6" width="214" height="93" rx="2" fill="#eee5ca"/><path d="M157 6H220V99H157Z" fill="#6b875f"/><path d="M172 31L183 24Q190 32 199 24L210 31L205 51L200 48V77H179V48L174 51Z" fill="#e3dbc0"/><path d="M184 26Q190 39 198 27" fill="none" stroke="#9aaf84" stroke-width="2"/><text x="19" y="45" fill="#365b43" font-family="Georgia,serif" font-size="31">Okrika</text><text x="19" y="64" fill="#63725a" font-size="8" letter-spacing="1.3">GOOD FINDS. REAL LIFE.</text><text x="19" y="85" fill="#8b8d75" font-size="7" letter-spacing="1.8">ADVERTISEMENT</text></g>`;
  obstacles.push({x:646,y:1096,w:18,h:23},{x:819,y:1096,w:18,h:23});
 }
 for(const x of [303,457,570])art+=`<g transform="translate(${x} 1294) scale(.8)">${vehicleArt(x===303?'#ddc5a1':x===457?'#738d83':'#e8e3ce')}</g>`;


 // The full-city landmark quarter mirrors the map registry. The legacy neighbourhood remains intact on the left;
 // these recognisable Abuja destinations extend the same walkable world instead of teleporting residents to a fake block.
 art+=rect(3540,0,width-3540,height,'#b4c59a')+rect(3600,92,width-3690,2420,'#c8cdb1',60)+rect(3590,2380,width-3650,236,'#718378')+`<path d="M3590 2498H${width}" stroke="#e8e0b7" stroke-width="4" stroke-dasharray="52 48"/>`;
 // Abuja's landmark half needs enough surrounding city fabric to feel inhabited when the camera zooms out.
 // These are intentionally non-interactive context blocks; named destinations below stay canonical.
 for(const avenueX of [3740,4440,5140,5840,6540,7240,7940]){
  art+=rect(avenueX,0,96,height,'#74867a')+`<path d="M${avenueX+48} 0V${height}" stroke="#e8e0b7" stroke-width="3" stroke-dasharray="46 44"/>`;
 }
 const landmarkPoints=CITY_LANDMARKS.map(landmarkWorldPoint),contextPalette=['#ddd6c3','#d2d0bf','#c9c8b6','#e4dcc6','#c7cfbf','#d7ccb6'];
 for(let row=0;row<5;row++)for(let col=0;col<7;col++){
  const cx=3780+col*645+(row%2)*96,groundY=520+row*690;
  if(cx>width-220||groundY>height-150)continue;
  if(landmarkPoints.some(point=>Math.hypot(point.x-cx,point.y-groundY)<380))continue;
  const bw=220+(col%3)*36,bh=145+((row+col)%3)*48,left=cx-bw/2,top=groundY-bh,wall=contextPalette[(row*7+col)%contextPalette.length];
  const windows=Array.from({length:Math.max(2,Math.floor((bw-36)/54))},(_,i)=>rect(left+20+i*54,top+34,31,42,'#6f8d8a',3)+rect(left+20+i*54,top+88,31,31,'#799590',3)).join('');
  art+=`<g class="city-context-block" aria-hidden="true">${rect(left,top,bw,bh,wall,7)}${rect(left-9,top,bw+18,11,'#ede6d2',4)}${windows}<path d="M${left+bw} ${top+8}L${left+bw+20} ${top+22}V${groundY+4}L${left+bw} ${groundY}Z" fill="#aeb8a8"/><rect x="${left+bw*.43}" y="${groundY-62}" width="${bw*.18}" height="62" rx="3" fill="#58766d"/></g>`;
  obstacles.push({x:left-7,y:top-8,w:bw+30,h:bh+20});
  if((row+col)%2===0)art+=cityTree(left-26,groundY-10,.62,(row+col)%5===0);
 }
 const localVenueIds=new Set(venues.map(v=>v.id));
 for(const landmark of CITY_LANDMARKS){
  const legacyLocal=['banex','jabi-lake'].includes(landmark.id)&&localVenueIds.has(landmark.id);
  if(legacyLocal)continue;
  const point=landmarkWorldPoint(landmark),size=WORLD_LANDMARK_SIZES[landmark.builder]||[390,280],exterior=landmarkExterior(landmark,point.x,point.y+size[1]/2,size),local=localVenueIds.has(landmark.id),venue=venues.find(v=>v.id===landmark.id)||landmark;
  art+=exterior.art;obstacles.push(exterior.obstacle);interactables.push({id:landmark.id,x:exterior.entrance.x,y:exterior.entrance.y,label:venue.name||landmark.name,action:local?'enter-venue':'travel-venue',payload:local?{venueId:landmark.id}:{destinationVenueId:landmark.id,districtId:landmark.districtId},radius:92,icon:'◎'});
 }

 const landmarkSizes=WORLD_LANDMARK_SIZES;
 const legacyIds=new Set(specs.map(b=>b.id));
 const contextBuildings=neighbourhoodFabric.map((b,i)=>({id:`context-${i}`,x:b.x,y:b.y,w:b.w,h:b.h,name:'',wall:b.c,floors:2,context:true}));
 const landmarkBuildings=CITY_LANDMARKS.filter(landmark=>!legacyIds.has(landmark.id)).map(landmark=>{const point=landmarkWorldPoint(landmark),size=landmarkSizes[landmark.builder]||[290,210];return{id:landmark.id,x:point.x-size[0]/2,y:point.y+size[1]/2,w:size[0],h:size[1],name:landmark.short||landmark.name,wall:'#d8d3c4',floors:landmark.builder==='wtc'?7:landmark.builder==='cbn'?6:landmark.builder==='transcorp'?4:landmark.builder==='inec'||landmark.builder==='efcc'||landmark.builder==='court'?3:2,landmarkBuilder:landmark.builder,frontY:true};});
 const visibleLegacyBuildings=specs.map(spec=>spec.id==='home'||localVenueIds.has(spec.id)?spec:{...spec,id:`context-spec-${spec.id}`,name:'',context:true});
 const safeLandmarkBuildings=landmarkBuildings.map(b=>localVenueIds.has(b.id)?b:{...b,id:`context-landmark-${b.id}`,name:'',context:true});
 const visibleBuildings=[...visibleLegacyBuildings,...contextBuildings,...safeLandmarkBuildings];

 return {width,height,art,obstacles,interactables,buildings:visibleBuildings,spawn:{x:445,y:679},title:place.name||'Abuja',subtitle:'Neighbourhood · free roam',traffic:[{axis:'x',lane:798,speed:115,color:'#d5b88c',type:'taxi',offset:190},{axis:'x',lane:902,speed:-96,color:'#e6dfc9',offset:2350},{axis:'x',lane:1601,speed:106,color:'#8baba2',offset:1200},{axis:'x',lane:1705,speed:-85,color:'#d3cdb0',type:'bus',offset:2780},{axis:'y',lane:1890,speed:94,color:'#b98761',offset:260},{axis:'y',lane:2011,speed:-112,color:'#dfe2d0',offset:1700},{axis:'x',lane:902,speed:78,color:'#f1f3e9',type:'suv',offset:3200,role:'FCT Patrol'}],pedestrians:[{x:640,y:681,toX:1190,toY:681},{x:2140,y:677,toX:2760,toY:677},{x:1320,y:1490,toX:1700,toY:1490},{x:2230,y:1490,toX:2800,toY:1490},{x:790,y:1040,toX:1720,toY:1040},{x:2960,y:1040,toX:3310,toY:1040},{x:1030,y:1040,toX:1180,toY:1040,role:'FCT Patrol'},{x:2470,y:1490,toX:2590,toY:1490,role:'City Security'}]};
}
export function buildJourney({profile={},place={},id='journey'}={}) {
 const width=14000,height=1450;
 let art=`<defs><linearGradient id="${id}-horizon" x2="0" y2="1"><stop stop-color="#c6dacf"/><stop offset="1" stop-color="#e7dfb6"/></linearGradient></defs>${rect(0,0,width,height,`url(#${id}-horizon)`)}<path d="M0 370${Array.from({length:30},(_,i)=>`Q${i*500+125} ${180+(i%3)*46} ${i*500+350} 335`).join('')}V760H0Z" fill="#a5b699"/>${rect(0,530,width,140,'#b5c69d')}${rect(0,674,width,317,'#718374')}${rect(0,991,width,459,'#b1c18f')}<path d="M0 674H${width}M0 990H${width}" stroke="#e5dfb6" stroke-width="9"/><path d="M0 824H${width}" stroke="#e9e0b7" stroke-width="4" stroke-dasharray="74 80"/><path d="M0 705H${width}M0 954H${width}" stroke="#b1c1a5" stroke-width="3"/>`;
 for(let x=80;x<width;x+=430){art+=cityTree(x,650,.85,x%860===80)+cityTree(x+190,1180,1.2,x%860!==80);if(x%1290===80)art+=`<g transform="translate(${x} 440)"><path d="M0 0H198V132H0Z" fill="#dbd9bd"/><path d="M-12-6L94-48L210-6V7H-12Z" fill="#8ea084"/><path d="M24 35H74V92H24ZM110 35H162V92H110Z" fill="#83a293"/></g>`;}
 art+=`<g transform="translate(11100 567)"><rect width="560" height="89" rx="10" fill="#54785b"/><text x="280" y="56" text-anchor="middle" fill="#eee8c6" font-size="28" letter-spacing="3">WELCOME TO YOUR NEXT CHAPTER</text></g>`;
 return {width,height,art,obstacles:[],interactables:[],spawn:{x:450,y:889},title:'On the road',subtitle:'A little city between here and there',traffic:[{axis:'x',lane:757,speed:-145,color:'#d3cba9',type:'bus',offset:2300},{axis:'x',lane:756,speed:-110,color:'#78998e',offset:9200}],pedestrians:[]};
}

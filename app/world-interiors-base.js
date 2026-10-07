// AbujaLife's authored, walkable cutaway interiors. Coordinates describe the floor,
// including furniture footprints; raised furniture is drawn above those footprints.
import { EXTRA_HOME_ITEMS } from '../src/shared/home-items.mjs';
import { furnitureSurface, SURFACE_ONLY_FURNITURE } from '../src/shared/furniture-metadata.mjs';
import { VENUE_ACTIONS, VENUES } from '../src/shared/life.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rect = (x,y,w,h,fill,rx=0,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const path = (d,fill,extra='') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (x1,y1,x2,y2,stroke,width=2,extra='') => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
const ellipse = (x,y,rx,ry,fill,extra='') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const text = (x,y,value,size=13,fill='#66705e',extra='') => `<text x="${x}" y="${y}" font-family="Inter,Arial,sans-serif" font-size="${size}" fill="${fill}" ${extra}>${esc(value)}</text>`;
const group = (x,y,art,extra='') => `<g transform="translate(${x} ${y})" ${extra}>${art}</g>`;
const shadow = (x,y,w,h) => rect(x+5,y+7,w,h,'#394a3d',8,'opacity=".12"');

function definitions(id) {
  return `<defs>
    <pattern id="${id}-oak" width="100" height="32" patternUnits="userSpaceOnUse"><rect width="100" height="32" fill="#d4bea0"/><path d="M0 0H100M0 32H100M50 0V32" stroke="#bba383" stroke-width="1"/><path d="M7 8H41M59 22H92M10 25H36" stroke="#ead6b7" opacity=".55"/></pattern>
    <pattern id="${id}-darkoak" width="112" height="34" patternUnits="userSpaceOnUse"><rect width="112" height="34" fill="#b89d7b"/><path d="M0 0H112M56 0V34" stroke="#9b8367"/><path d="M5 9H48M64 22H105" stroke="#cdb290" opacity=".5"/></pattern>
    <pattern id="${id}-tile" width="58" height="58" patternUnits="userSpaceOnUse"><rect width="58" height="58" fill="#e1dfce"/><path d="M0 0H58V58" fill="none" stroke="#c6caba" stroke-width="2"/></pattern>
    <pattern id="${id}-bath" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#bacfc4"/><path d="M0 0H32V32" fill="none" stroke="#d9e4d9" stroke-width="1.5"/></pattern>
    <pattern id="${id}-pave" width="82" height="55" patternUnits="userSpaceOnUse"><rect width="82" height="55" fill="#d4d2b8"/><path d="M0 0H82V55M41 0V55" fill="none" stroke="#b9bda2" stroke-width="2"/></pattern>
    <pattern id="${id}-rug" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 14L14 0L28 14L14 28Z" fill="none" stroke="#ead7b2" stroke-width="2" opacity=".4"/></pattern>
    <linearGradient id="${id}-glass" x2=".5" y2="1"><stop stop-color="#bbd6cc"/><stop offset="1" stop-color="#759c99"/></linearGradient>
    <linearGradient id="${id}-water" x2=".3" y2="1"><stop stop-color="#6ca7a2"/><stop offset="1" stop-color="#a3c9b5"/></linearGradient>
    <linearGradient id="${id}-light" x2=".7" y2="1"><stop stop-color="#fff4ca" stop-opacity=".32"/><stop offset="1" stop-color="#fff4ca" stop-opacity="0"/></linearGradient>
  </defs>`;
}

function bedArt(w=160,h=210,color='#799282') {
  return '<desc data-scene-prop="bed"/>'+shadow(0,0,w,h)+rect(0,-47,w,66,'#967b5c',7)+rect(9,-37,w-18,48,'#b79a73',4)+rect(0,0,w,h,'#856e53',5)+rect(7,-6,w-14,h-15,'#ece4cf',9)+rect(7,48,w-14,h-68,color,5)+rect(7,48,w-14,18,'#b8c4ae',3)+rect(15,4,w/2-21,34,'#faf2df',8)+rect(w/2+5,4,w/2-20,34,'#faf2df',8)+line(17,91,w-17,91,'#ffffff',2,'opacity=".15"')+line(17,126,w-17,126,'#ffffff',2,'opacity=".15"')+rect(3,h-18,w-6,21,'#927453',3)+line(14,h+2,14,h+12,'#5e5745',7)+line(w-14,h+2,w-14,h+12,'#5e5745',7);
}
function sofaArt(w=240,h=86,color='#849b86') {
  return '<desc data-scene-prop="sofa"/>'+shadow(0,0,w,h)+rect(4,-43,w-8,85,'#5c7667',13)+rect(13,-34,(w-32)/2,65,color,8)+rect(w/2+3,-34,(w-32)/2,65,color,8)+rect(9,21,w-18,h-28,'#a5b5a0',9)+rect(9,h-24,w-18,30,color,7)+line(w/2,23,w/2,h-24,'#728e77',2)+rect(-4,-4,24,h+3,color,8)+rect(w-20,-4,24,h+3,color,8)+rect(30,-21,41,37,'#d9b984',7,'transform="rotate(-12 49 -2)"')+rect(w-77,-20,43,37,'#e4dfc5',7,'transform="rotate(12 '+(w-55)+' -2)"')+line(14,h+2,14,h+13,'#625946',7)+line(w-14,h+2,w-14,h+13,'#625946',7);
}
function chairArt(color='#c59a73') {
  return '<desc data-scene-prop="chair"/>'+shadow(0,0,82,78)+rect(2,-25,78,57,'#937553',10)+rect(9,-18,64,48,color,8)+rect(6,25,70,45,'#ddbd94',7)+rect(-3,10,14,61,color,5)+rect(71,10,14,61,color,5)+rect(9,68,64,12,'#a5845f',3)+line(13,79,10,92,'#5f604c',5)+line(67,79,70,92,'#5f604c',5);
}
function coffeeArt(w=130,h=70) {
  return '<desc data-scene-prop="coffee-table"/>'+shadow(0,0,w,h)+line(13,h-5,10,h+14,'#695c48',7)+line(w-13,h-5,w-10,h+14,'#695c48',7)+rect(0,-5,w,h,'#a58660',13)+rect(0,-14,w,h,'#c8a778',13)+rect(15,4,47,31,'#ebe1c6',2,'transform="rotate(-7 39 18)"')+rect(18,8,38,5,'#789382')+ellipse(w-29,15,13,9,'#89674e')+ellipse(w-29,11,13,9,'#e7d5b4')+ellipse(w-29,11,9,6,'#8d6148');
}
function wardrobeArt(w=120,h=70) {
  return '<desc data-scene-prop="wardrobe"/>'+shadow(0,0,w,h)+rect(0,-92,w,h+92,'#927c5d',3)+rect(5,-87,w-10,h+78,'#b99d75',2)+line(w/2,-85,w/2,h-12,'#816c4f',3)+rect(w/2-13,-12,4,23,'#635d49',2)+rect(w/2+9,-12,4,23,'#635d49',2)+rect(0,h-10,w,12,'#7d684c',2)+line(9,-78,w-9,-78,'#d9c199',3);
}
function shelfArt(w=120,h=56) {
  let art=shadow(0,0,w,h)+rect(0,-98,w,h+98,'#997e5e',3)+rect(8,-89,w-16,h+73,'#78664f');
  for(let row=0;row<3;row++) {
    const y=-83+row*43;
    for(let i=0;i<7;i++) art+=rect(13+i*13,y+((i+row)%3)*4,9,31-((i+row)%3)*4,['#a9b997','#d4b889','#bc8668','#d5d4b9'][i%4],1);
    art+=rect(5,y+31,w-10,7,'#c8aa7d');
  }
  return '<desc data-scene-prop="shelf"/>'+art;
}
function plantArt(scale=1) {
  return '<desc data-scene-prop="plant"/>'+`<g transform="scale(${scale})">${ellipse(0,3,28,12,'#334e38','opacity=".14"')}${path('M-22-30H22L17 10H-17Z','#bf9770')}${ellipse(0,-30,22,8,'#d6b68f')}${path('M0-27V-100M0-48Q-37-64-29-89Q-3-80 0-59M0-66Q39-77 31-102Q5-95 0-74M0-86Q-18-112-7-131Q13-111 0-90','#4b7752','stroke="#4b7752" stroke-width="4" stroke-linejoin="round"')}${path('M-3-60Q-12-75-23-79M4-82Q18-90 25-95','none','stroke="#7e9b65" stroke-width="2"')}</g>`;
}
function kitchenArt(w=270,h=80) {
  let art=shadow(0,0,w,h)+rect(0,-11,w,h+12,'#98a58d',4)+rect(6,6,w-12,h-16,'#acb79d',2);
  for(let i=1;i<4;i++) art+=line(i*w/4,7,i*w/4,h-10,'#7e927b',2)+rect(i*w/4+8,23,19,4,'#5e7061',2);
  art+=rect(-5,-24,w+10,37,'#e3ddc7',4)+ellipse(48,-5,31,12,'#94aaa0')+ellipse(48,-6,24,8,'#728f86')+path('M48-11V-31Q48-44 62-38V-24','none','stroke="#81968b" stroke-width="5"')+rect(w-101,-18,78,29,'#3d5049',3)+ellipse(w-80,-10,12,5,'#84938b')+ellipse(w-43,0,12,5,'#84938b')+rect(w-84,-25,24,18,'#bc805c',3)+ellipse(w-72,-25,12,5,'#d1a27a')+rect(110,-15,27,19,'#c8ad80',3)+path('M123-15L116-50L125-44L130-15','#628459');
  return '<desc data-scene-prop="kitchen"/>'+art;
}
function fridgeArt() { return '<desc data-scene-prop="fridge"/>'+shadow(0,0,66,74)+rect(0,-91,66,165,'#bdc5b6',5)+rect(5,-85,56,53,'#e0e2d2',3)+rect(5,-24,56,92,'#d5d9c9',3)+rect(11,-67,4,24,'#718779',2)+rect(11,-8,4,35,'#718779',2); }
function showerArt(id,w=115,h=120) {
  return '<desc data-scene-prop="shower"/>'+shadow(0,0,w,h)+rect(0,0,w,h,'#e7ede0',5)+rect(8,8,w-16,h-16,`url(#${id}-bath)`,4)+rect(5,-67,w-10,155,`url(#${id}-glass)`,2,'opacity=".38"')+line(5,-67,5,h-10,'#75998d',4)+line(w-5,-67,w-5,h-10,'#75998d',4)+line(5,-67,w-5,-67,'#75998d',4)+path(`M27-49V-22Q27-12 49-12`,'none','stroke="#799187" stroke-width="5"')+ellipse(54,-11,17,5,'#6b857b')+line(w/2,-62,w/2,h-16,'#eaf3e4',3)+line(w/2+11,32,w/2+11,54,'#79958a',4)+ellipse(w/2,h-24,7,3,'#839c8f');
}
function basinArt() { return '<desc data-scene-prop="basin"/>'+shadow(0,0,67,58)+rect(0,-25,67,80,'#96aa98',3)+rect(-5,-39,77,49,'#e4e7d7',7)+ellipse(34,-14,25,13,'#9bb4a4')+ellipse(34,-15,19,9,'#c9d7c5')+path('M34-24V-43H43','none','stroke="#7b9386" stroke-width="4"')+rect(8,20,51,30,'#b8c5ac',2)+rect(26,29,14,3,'#6b8271',2); }
function toiletArt() { return '<desc data-scene-prop="toilet"/>'+shadow(0,0,55,77)+rect(3,-27,49,47,'#eef0e1',6)+rect(37,-19,8,4,'#94aba0',2)+ellipse(27,34,28,36,'#e7ecdc')+ellipse(27,30,21,26,'#c2d2c1')+ellipse(27,31,15,19,'#98b2a4')+rect(14,58,27,17,'#d9e1d0',3); }
function tableArt(w=155,h=110) {
  return '<desc data-scene-prop="dining-table"/>'+shadow(-25,-10,w+50,h+30)+rect(-27,18,32,58,'#a5835f',7)+rect(w-5,18,32,58,'#a5835f',7)+rect(w/2-29,-32,58,34,'#b4946d',7)+rect(w/2-29,h-4,58,34,'#b4946d',7)+rect(0,3,w,h,'#947757',12)+rect(0,-8,w,h,'#c1a176',12)+ellipse(31,28,22,15,'#efe6cd')+ellipse(w-31,63,22,15,'#efe6cd')+ellipse(w/2,47,17,11,'#b58a66')+ellipse(w/2,42,16,10,'#6b8653')+line(59,23,59,45,'#76836d',2)+line(w-58,53,w-58,77,'#76836d',2);
}
function deskArt(w=190,h=75) {
  return '<desc data-scene-prop="desk"/>'+shadow(0,0,w,h)+rect(8,0,47,h+7,'#9f8665',3)+rect(w-55,0,47,h+7,'#9f8665',3)+rect(-3,-20,w+6,h,'#ceb289',5)+rect(54,-71,85,57,'#40554f',4)+rect(59,-65,75,43,'#89aba3',2)+line(95,-15,95,-2,'#5d6f62',7)+rect(76,-1,39,5,'#667e6b',2)+rect(55,12,85,21,'#eee5cd',3)+rect(14,1,25,32,'#f5ead1',1)+line(20,8,34,8,'#a3b198',2)+line(20,15,32,15,'#a3b198',2);
}
function floorLampArt() { return '<desc data-scene-prop="floor-lamp"/>'+ellipse(0,0,23,9,'#8e8f6f')+line(0,0,0,-112,'#6e7760',6)+path('M-27-113L-18-157H18L27-113Z','#edddba')+ellipse(0,-113,27,8,'#d3be96'); }
function gardenBenchArt(w=166) {
  let art=shadow(0,0,w,58)+line(11,0,11,65,'#5e7260',7)+line(w-11,0,w-11,65,'#5e7260',7);
  for(let i=0;i<3;i++)art+=rect(0,-35+i*13,w,10,'#af9367',2);
  for(let i=0;i<3;i++)art+=rect(-4,10+i*13,w+8,10,'#c3a474',2);
  return '<desc data-scene-prop="bench"/>'+art+line(1,-4,1,29,'#62735c',6)+line(w-1,-4,w-1,29,'#62735c',6);
}
function gardenTreeArt(scale=1) {
  return '<desc data-scene-prop="tree"/>'+`<g transform="scale(${scale})">${ellipse(6,5,70,24,'#4e714c','opacity=".12"')}${path('M-7 0L-3-125H7L10 0Z','#8b7958')}${path('M1-73L-34-111M1-59L38-109','none','stroke="#8b7958" stroke-width="8"')}${ellipse(-39,-118,43,41,'#749261')}${ellipse(32,-121,49,43,'#759465')}${ellipse(-5,-153,51,43,'#829c66')}${ellipse(-16,-94,53,37,'#6f8f5f')}${ellipse(36,-104,40,30,'#769664')}${path('M-39-146Q-19-160 3-154M13-111Q38-124 53-117','none','stroke="#a1b07a" stroke-width="7" stroke-linecap="round" opacity=".45"')}</g>`;
}

function sceneBase(width,height,id,{floor='oak',name='',accent='#e9e6d7'}={}) {
  const art=[definitions(id),rect(0,0,width,height,'#b9c5b1'),rect(35,110,width-70,height-160,'#718375',22,'opacity=".16"'),rect(48,118,width-96,height-187,'#b2aa90',9),rect(60,140,width-120,height-220,`url(#${id}-${floor})`),rect(48,76,width-96,70,accent,4),rect(48,139,width-96,11,'#b3b5a0'),rect(48,76,width-96,9,'#f7f0dc'),rect(48,140,13,height-210,'#cbc9b3'),rect(width-61,140,13,height-210,'#cbc9b3')];
  const obstacles=[{x:0,y:0,w:width,h:142},{x:0,y:140,w:62,h:height-140},{x:width-62,y:140,w:62,h:height-140},{x:0,y:height-81,w:width,h:81}];
  const items=[],interactables=[],objects=[],walls=[],floorAreas=[],pedestrians=[];
  const s={width,height,id,art,items,objects,walls,floorAreas,pedestrians,obstacles,interactables,title:name,subtitle:'',spawn:{x:width/2,y:height-145},
    floor(x,y,w,h,material='tile'){floorAreas.push({x,y,w,h,material});art.push(rect(x,y,w,h,`url(#${id}-${material})`));},
    label(x,y,label){art.push(text(x,y,label,12,'#6d755e','letter-spacing="2" opacity=".65"'));},
    wall(x,y,w,h=15){walls.push({x,y,w,h});obstacles.push({x,y,w,h});items.push({y:y+h,art:rect(x+6,y+4,w,h,'#5c6c53',2,'opacity=".1"')+rect(x,y-40,w,h+40,'#d1d0ba',2)+rect(x,y-43,w,h,'#f2ecd9',2)+rect(x,y+h-8,w,8,'#b2b89c')});},
    object(x,y,w,h,content,{solid=true,sort=y+h,kind}={}){objects.push({x,y,w,h,kind:kind||content.match(/data-scene-prop="([^"]+)"/)?.[1]||content.match(/data-furniture-item="([^"]+)"/)?.[1]||'fixture',itemId:content.match(/data-furniture-item="([^"]+)"/)?.[1],rotation:Number(content.match(/data-placement-rotation="(\d+)"/)?.[1]||0),solid});if(solid)obstacles.push({x,y,w,h});items.push({y:sort,x,footY:y,w,h,art:`<g data-world-object="${esc(objects.at(-1).kind)}" role="img" aria-label="${esc(objects.at(-1).kind.replaceAll('-',' '))}">${group(x,y,content)}</g>`});},
    point(key,x,y,label,action,payload={}){interactables.push({id:`${id}-${key}`,x,y,label,action,payload,radius:85});},
    plant(x,y,scale=1){this.object(x-20*scale,y-22*scale,40*scale,37*scale,group(20*scale,22*scale,plantArt(scale)));},
    rug(x,y,w,h,color='#b1b59a'){floorAreas.push({x,y,w,h,material:'rug',color});art.push(rect(x,y,w,h,color,7)+rect(x+9,y+9,w-18,h-18,`url(#${id}-rug)`,3)+rect(x+8,y+8,w-16,h-16,'none',3,'stroke="#e4d3ac" stroke-width="3" opacity=".65"'));},
    window(x,w=220,view='garden'){art.push(group(x,84,rect(0,0,w,54,`url(#${id}-glass)`,2)+path(`M3 33Q${w/4} 12 ${w/2} 28Q${w*.8} 9 ${w-3} 29V51H3Z`,view==='lake'?'#699a92':'#7c9d74')+line(w/2,0,w/2,54,'#f1ebd5',5)+rect(-5,-5,w+10,64,'none',1,'stroke="#f3eedb" stroke-width="7"')+rect(-8,54,w+16,8,'#b4bba5')));art.push(path(`M${x} 149H${x+w}L${x+w+170} 470H${x+105}Z`,`url(#${id}-light)`));},
    door(x=width/2,label='OUTSIDE',action='leave-home'){
      // The exit is a real, readable piece of the room rather than a tiny
      // interaction dot. It stays visible in the wide camera view so new
      // residents can immediately understand where the street is.
      const sign=label==='OUTSIDE'?'EXIT · HEAD OUTSIDE':label;
      art.push(`<g class="world-front-door" data-scene-prop="front-door" role="img" aria-label="${esc(sign)}">`+
        shadow(x-82,height-126,164,43)+
        rect(x-78,height-132,156,45,'#315943',8,'stroke="#f2e5bd" stroke-width="4"')+
        rect(x-60,height-239,120,112,'#315943',8,'stroke="#f6e9c0" stroke-width="6"')+
        rect(x-48,height-226,96,99,'#8fb39a',5)+
        rect(x-38,height-214,76,39,'#a9c7aa',3,'opacity=".72"')+
        line(x,height-226,x,height-127,'#577d67',3)+
        line(x-48,height-177,x+48,height-177,'#577d67',3)+
        ellipse(x+28,height-178,6,6,'#e8d09a')+
        rect(x-104,height-288,208,37,'#f2dfaa',9,'stroke="#315943" stroke-width="4"')+
        text(x,height-264,sign,12,'#315943','text-anchor="middle" font-weight="800" letter-spacing="1.3"')+
        path(`M${x-19} ${height-111}L${x} ${height-96}L${x+19} ${height-111}`,'none','stroke="#d8ba72" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"')+
        text(x,height-82,label,10,'#315943','text-anchor="middle" letter-spacing="2" font-weight="800"')+
      `</g>`);
      this.spawn={x,y:height-170};
      this.point('exit',x,height-137,'Head outside',action);
    },
    finish(){for(const item of [...objects,...(this.furniturePlacements||[])])if(item.itemId){item.surfaceHeight=furnitureSurface(item.itemId)?.height||0;item.elevation||=0;item.propertyId||=this.homePropertyId;}this.art.push(...this.items.sort((a,b)=>a.y-b.y).map(item=>item.art));this.art.push(rect(48,height-83,width-96,14,'#ece5cb',2));return {width,height,floorMaterial:floor,spawn:this.spawn,objects,walls,floorAreas,pedestrians,art:this.art.join(''),obstacles,interactables,title:this.title,subtitle:this.subtitle,furnishingArea:this.furnishingArea,furniturePlacements:this.furniturePlacements||[],storedFurniture:this.storedFurniture||[],homePropertyId:this.homePropertyId};}
  };
  return s;
}

function bedroom(s,x,y,{w=160,h=210,color='#799282',main=true,pointSide='bottom'}={}) {
  s.rug(x-22,y-14,w+44,h+48,'#c8c4a7');s.object(x,y,w,h,bedArt(w,h,color));
  s.object(x+w+24,y+18,51,49,coffeeArt(51,49));
  if(main)s.point('sleep',pointSide==='left'?x-45:x+w/2,pointSide==='left'?y+h*.65:y+h+51,'Sleep in bed','sleep');
}
function bathroom(s,x,y,{large=false}={}) {
  s.object(x,y,115,120,showerArt(s.id));s.point('shower',x+55,y+161,'Take a shower','shower');
  s.object(x+156,y+8,55,77,toiletArt());
  if(large)s.object(x+147,y+149,67,58,basinArt());
  else s.object(x+151,y+145,67,58,basinArt());
}
function kitchen(s,x,y,w=270) {s.object(x,y,w,80,kitchenArt(w));s.object(x+w+18,y-4,66,74,fridgeArt());s.point('eat',x+w*.5,y+130,'Make something to eat','eat');}
function lounge(s,x,y,{w=240,color='#849b86',table=true}={}) {
  s.rug(x-33,y-10,w+66,252,'#a7b39a');s.object(x,y,w,86,sofaArt(w,86,color));
  if(table)s.object(x+w/2-65,y+158,130,70,coffeeArt());
  s.point('relax',x+w/2,y+118,'Settle on the sofa','relax');
}
function wardrobe(s,x,y,w=120){s.object(x,y,w,70,wardrobeArt(w));s.point('wardrobe',x+w/2,y+116,'Choose an outfit','wardrobe');}

const HOME_META={
  'garki-studio':['Garki starter studio','A cosy first place · Studio'],
  'lugbe-flat':['Lugbe one-bedroom','Room to settle in · One bedroom'],
  'gwarinpa-apartment':['Gwarinpa apartment','Space for company · Two bedrooms'],
  'jabi-apartment':['Jabi lake-side apartment','Light, water and open space · Lake balcony'],
  'guzape-terrace':['Guzape terrace','Above the city · Split-level terrace'],
  'maitama-villa':['Maitama villa','Your own quiet corner · Garden courtyard']
};

function buildStarterHome(profile,id,key,dimensions,owned) {
  const bare=profile.home.furnishingPreset==='lapo-basic';
  const s=sceneBase(...dimensions,id,{name:profile.home.name||HOME_META[key][0],floor:['oak','darkoak','tile'].includes(profile.home?.roomStyle?.floor)?profile.home.roomStyle.floor:bare?'tile':key==='jabi-apartment'||key==='maitama-villa'?'tile':'oak',accent:({sand:'#e9e0cf',ivory:'#eeeade',sage:'#c4d1bc',clay:'#c9a48f'})[profile.home?.roomStyle?.wall]||(bare?'#c9c5b5':'#e9e6d7')});
  s.subtitle=bare?'A basic room · Build it your way':'A furnished start · Make it your own';
  let bath;
  if(key==='garki-studio') {
    s.window(110,210);s.window(470,190);s.floor(762,145,296,320,'bath');
    s.wall(747,143,15,324);s.wall(762,466,64);s.wall(944,466,114);
    bath={x:788,y:190};s.label(805,432,'BATH');
  } else if(key==='lugbe-flat') {
    s.window(113,296);s.window(616,228);s.floor(946,144,273,325,'bath');
    s.wall(543,143,15,397);s.wall(62,530,297);s.wall(476,530,82);s.wall(932,143,15,326);s.wall(947,468,66);s.wall(1126,468,93);
    bath={x:968,y:188};s.label(95,501,'BEDROOM');
  } else if(key==='gwarinpa-apartment') {
    s.window(114,305);s.window(978,275);s.floor(548,145,318,408,'bath');
    s.wall(529,143,16,416);s.wall(871,143,16,416);s.wall(62,556,287);s.wall(461,556,86);
    s.wall(547,556,90);s.wall(756,556,133);s.wall(886,556,94);s.wall(1105,556,283);
    bath={x:582,y:214};s.label(100,518,'BEDROOM');s.label(947,518,'SPARE ROOM');
  } else if(key==='jabi-apartment') {
    s.floor(63,146,1294,133,'pave');s.art.push(rect(68,147,1284,31,'#85aaa0'));
    s.wall(64,284,530);s.wall(748,284,607);s.window(140,355,'lake');s.window(788,404,'lake');
    s.floor(1054,303,303,278,'bath');s.wall(1039,299,15,286);s.wall(1054,581,62);s.wall(1233,581,124);
    s.wall(854,664,502);s.wall(843,664,15,63);s.wall(843,856,15,139);
    bath={x:1080,y:332};s.label(510,234,'LAKE BALCONY');s.label(1095,982,'BEDROOM');
  } else if(key==='guzape-terrace') {
    s.window(128,303);s.window(1000,310);s.floor(611,145,306,422,'bath');
    s.wall(591,143,15,429);s.wall(925,143,15,429);s.wall(62,570,341);s.wall(520,570,88);
    s.wall(608,570,82);s.wall(805,570,136);s.wall(941,570,148);s.wall(1210,570,268);
    bath={x:650,y:212};s.label(1135,534,'SPARE ROOM');s.label(176,534,'BEDROOM');
  } else {
    s.window(119,307);s.window(997,280);s.window(1380,245);s.floor(583,145,331,417,'bath');s.floor(1274,671,423,523,'pave');
    s.wall(565,144,15,417);s.wall(922,144,15,417);s.wall(1328,144,15,417);
    s.wall(62,562,300);s.wall(482,562,99);s.wall(581,562,95);s.wall(798,562,139);
    s.wall(937,562,132);s.wall(1190,562,154);s.wall(1344,562,78);s.wall(1547,562,149);
    s.wall(1259,672,15,152);s.wall(1259,965,15,228);
    bath={x:625,y:205};s.label(1020,518,'SPARE ROOM');s.label(1385,1161,'COURTYARD');
  }
  bathroom(s,bath.x,bath.y);
  s.door(s.width/2);
  s.furnishingArea={x:62,y:160,w:s.width-124,h:s.height-280};
  // Free fixtures are plumbing and the basic sleeping mat, never catalog gifts.
  const needsMat=bare&&!['bed','king-bed'].some(itemId=>owned.has(itemId)&&!profile.storedFurniture?.includes(itemId)&&(!profile.furnitureLayout?.[itemId]?.propertyId||profile.furnitureLayout[itemId].propertyId===profile.home.propertyId));
  if(needsMat) {
    const mat=shadow(0,0,125,190)+rect(0,0,125,190,'#928c72',4)+rect(5,5,115,180,'#bdb69a',4)+rect(14,13,97,32,'#d8d1b9',6);
    const position=({'garki-studio':{x:115,y:235},'lugbe-flat':{x:148,y:220},'gwarinpa-apartment':{x:142,y:233},'jabi-apartment':{x:1070,y:715},'guzape-terrace':{x:151,y:241},'maitama-villa':{x:133,y:239}})[key];
    s.object(position.x,position.y,125,190,mat,{kind:'sleeping-mat'});
    s.point('sleep',position.x+62,position.y+235,'Rest on your sleeping mat','sleep');
  }
  s.point('eat',s.spawn.x-118,s.spawn.y-34,'Get a simple meal','eat');
  s.point('furnish',s.spawn.x+114,s.spawn.y-2,'Arrange your home','furnish');
  s.furnitureAnchors=({
    'garki-studio':[{x:115,y:235},{x:438,y:432},{x:115,y:630},{x:550,y:185}],
    'lugbe-flat':[{x:148,y:220},{x:143,y:635},{x:826,y:619},{x:587,y:191}],
    'gwarinpa-apartment':[{x:142,y:233},{x:151,y:668},{x:687,y:765},{x:1020,y:684}],
    'jabi-apartment':[{x:1070,y:715},{x:212,y:432},{x:211,y:798},{x:653,y:345}],
    'guzape-terrace':[{x:151,y:241},{x:166,y:697},{x:783,y:780},{x:705,y:718}],
    'maitama-villa':[{x:133,y:239},{x:175,y:714},{x:968,y:950},{x:873,y:710}],
  })[key]||[{x:115,y:235},{x:150,y:s.height-430},{x:s.width*.45,y:s.height-425},{x:s.width*.55,y:210}];
  s.homePropertyId=profile.home?.propertyId;
  addOwnedFurniture(s,profile,owned);
  const pointByFurniture=(placement,action,label)=>{
    const candidates=[{x:placement.x+placement.w/2,y:placement.y+placement.h+46},{x:placement.x+placement.w+46,y:placement.y+placement.h/2},{x:placement.x-46,y:placement.y+placement.h/2},{x:placement.x+placement.w/2,y:placement.y-46}];
    const point=candidates.find(p=>p.x>80&&p.x<s.width-80&&p.y>172&&p.y<s.height-115&&!s.obstacles.some(b=>p.x>b.x-24&&p.x<b.x+b.w+24&&p.y>b.y-24&&p.y<b.y+b.h+24));
    if(point)s.point(action,point.x,point.y,label,action);
  };
  const bed=s.furniturePlacements.find(item=>['bed','king-bed'].includes(item.itemId)),sofa=s.furniturePlacements.find(item=>['sofa','premium-sofa'].includes(item.itemId));
  if(bed)pointByFurniture(bed,'sleep','Sleep in your bed');
  if(sofa)pointByFurniture(sofa,'relax','Rest on your sofa');
  if(!s.interactables.some(point=>point.action==='sleep'))s.point('sleep',s.spawn.x,s.spawn.y-95,'Get some rest','sleep');
  for(const partition of profile.home?.roomStyle?.partitions||[]){const r=partitionRect(s,partition);s.wall(r.x,r.y,r.w,r.h);s.walls.at(-1).custom=true;s.walls.at(-1).id=partition.id;}
  return s.finish();
}

function buildHome(profile,id) {
  const property=profile.home?.propertyId||'garki-studio';
  const layout=profile.home?.layoutId||property;
  const key=HOME_META[layout]?layout:'garki-studio';
  const dimensions={'garki-studio':[1120,900],'lugbe-flat':[1280,1000],'gwarinpa-apartment':[1450,1100],'jabi-apartment':[1420,1080],'guzape-terrace':[1540,1160],'maitama-villa':[1760,1280]}[key];
  const owned=new Set((Array.isArray(profile.inventory)?profile.inventory:[]).map(v=>typeof v==='string'?v:v.itemId||v.id));
  if(profile.home?.starterVersion===1&&['lapo-basic','nepo-furnished'].includes(profile.home.furnishingPreset))return buildStarterHome(profile,id,key,dimensions,owned);
  const s=sceneBase(...dimensions,id,{name:profile.home?.name||HOME_META[key][0],floor:['oak','darkoak','tile'].includes(profile.home?.roomStyle?.floor)?profile.home.roomStyle.floor:key==='maitama-villa'||key==='jabi-apartment'?'tile':'oak',accent:({sand:'#e9e0cf',ivory:'#eeeade',sage:'#c4d1bc',clay:'#c9a48f'})[profile.home?.roomStyle?.wall]||'#e9e6d7'});
  s.subtitle=HOME_META[key][1];const sofaColor=owned.has('sofa')?'#b68b6b':'#849b86';
  if(key==='garki-studio') {
    s.window(95,247);s.window(473,220);s.floor(762,145,296,320,'bath');
    s.wall(747,143,15,324);s.wall(762,466,64);s.wall(944,466,114);
    s.label(90,765,'YOUR FIRST PLACE');s.label(805,432,'BATH');
    bedroom(s,115,255,{w:160,h:200});wardrobe(s,317,166,105);kitchen(s,475,182,170);
    bathroom(s,788,190);lounge(s,438,432,{w:232,color:sofaColor});
    s.plant(710,694,.85);s.object(92,630,20,20,group(10,10,floorLampArt()));
    s.door(556);s.furnitureAnchors=[{x:834,y:690},{x:170,y:710},{x:945,y:560},{x:329,y:612}];
  } else if(key==='lugbe-flat') {
    s.window(113,296);s.window(616,228);s.floor(946,144,273,325,'bath');s.floor(568,144,364,290,'tile');
    s.wall(543,143,15,397);s.wall(62,530,297);s.wall(476,530,82);s.wall(932,143,15,326);s.wall(947,468,66);s.wall(1126,468,93);
    bedroom(s,148,220,{w:175,h:222});wardrobe(s,392,188,115);bathroom(s,968,188);
    kitchen(s,587,191,235);lounge(s,143,635,{w:255,color:sofaColor});
    s.object(826,619,197,152,tableArt(145,110));s.rug(672,794,399,61,'#c3b194');
    s.label(95,501,'BEDROOM');s.label(613,413,'KITCHEN');s.label(1080,858,'DINING');
    s.plant(1180,834,1);s.door(662);s.furnitureAnchors=[{x:493,y:669},{x:1145,y:595},{x:101,y:838},{x:680,y:514}];
  } else if(key==='gwarinpa-apartment') {
    s.window(114,305);s.window(978,275);s.floor(548,145,318,408,'bath');
    s.wall(529,143,16,416);s.wall(871,143,16,416);s.wall(62,556,287);s.wall(461,556,86);s.wall(547,556,90);s.wall(756,556,133);s.wall(886,556,94);s.wall(1105,556,283);
    bedroom(s,142,233,{w:181,h:219});wardrobe(s,369,181,125);bathroom(s,582,214,{large:true});
    bedroom(s,958,223,{w:151,h:205,color:'#b89b73',main:false});s.object(1160,195,170,75,deskArt(170));
    lounge(s,151,668,{w:278,color:sofaColor});kitchen(s,1020,684,240);s.object(687,765,202,154,tableArt(150,112));
    s.label(100,518,'MAIN BEDROOM');s.label(947,518,'GUEST ROOM & STUDY');s.label(1040,957,'KITCHEN');
    s.plant(541,855,.95);s.plant(1329,964,1.1);s.door(711);s.furnitureAnchors=[{x:81,y:949},{x:497,y:684},{x:1199,y:917},{x:911,y:697}];
  } else if(key==='jabi-apartment') {
    s.floor(63,146,1294,133,'pave');s.art.push(rect(68,147,1284,31,`url(#${id}-water)`));
    s.art.push(line(63,177,1357,177,'#8baca0',5));for(let x=95;x<1350;x+=95)s.art.push(line(x,146,x,178,'#bcd1bd',4));
    s.wall(64,284,530);s.wall(748,284,607);s.window(140,355,'lake');s.window(788,404,'lake');
    s.object(240,198,82,60,chairArt('#b3bca2'));s.object(1060,198,82,60,chairArt('#b3bca2'));s.plant(1267,232,.8);
    s.floor(1054,303,303,278,'bath');s.wall(1039,299,15,286);s.wall(1054,581,62);s.wall(1233,581,124);
    s.wall(854,664,502);s.wall(843,664,15,63);s.wall(843,856,15,139);
    bathroom(s,1080,332);kitchen(s,653,345,244);lounge(s,212,432,{w:284,color:'#8ba7a1'});
    bedroom(s,1070,715,{w:188,h:213,color:'#81a3a2',pointSide:'left'});wardrobe(s,898,677,120);
    s.object(211,798,220,145,tableArt(166,110));s.label(510,234,'LAKE BALCONY');s.label(1095,982,'BEDROOM');
    s.plant(110,720,1.05);s.door(675);s.furnitureAnchors=[{x:509,y:757},{x:750,y:649},{x:1257,y:704},{x:467,y:900}];
  } else if(key==='guzape-terrace') {
    s.window(128,303);s.window(1000,310);s.floor(611,145,306,422,'bath');s.floor(684,685,410,268,'tile');
    s.wall(591,143,15,429);s.wall(925,143,15,429);s.wall(62,570,341);s.wall(520,570,88);s.wall(608,570,82);s.wall(805,570,136);s.wall(941,570,148);s.wall(1210,570,268);
    bedroom(s,151,241,{w:192,h:225,color:'#ab9479'});wardrobe(s,408,180,129);bathroom(s,650,212,{large:true});
    bedroom(s,999,224,{w:167,h:222,color:'#a5aa8d',main:false});s.object(1250,195,164,75,deskArt(164));
    lounge(s,166,697,{w:292,color:sofaColor});kitchen(s,705,718,265);
    s.object(1163,758,269,228,stairArt(269,228));s.object(783,938,164,84,coffeeArt(164,84));
    s.label(1155,1046,'UPPER LANDING');s.label(951,534,'GUEST SUITE');s.plant(548,995,1.1);s.door(666);
    s.furnitureAnchors=[{x:87,y:960},{x:519,y:683},{x:1377,y:650},{x:1092,y:977}];
  } else {
    s.window(119,307);s.window(997,280);s.window(1380,245);s.floor(583,145,331,417,'bath');s.floor(1274,671,423,523,'pave');
    s.wall(565,144,15,417);s.wall(922,144,15,417);s.wall(1328,144,15,417);
    s.wall(62,562,300);s.wall(482,562,99);s.wall(581,562,95);s.wall(798,562,139);s.wall(937,562,132);s.wall(1190,562,154);s.wall(1344,562,78);s.wall(1547,562,149);
    bedroom(s,133,239,{w:213,h:229,color:'#557d70'});wardrobe(s,409,191,122);bathroom(s,625,205,{large:true});
    s.object(1007,241,223,90,deskArt(223,90));s.object(992,416,82,78,chairArt('#af9773'));s.object(1193,173,115,56,shelfArt(115));
    bedroom(s,1407,241,{w:160,h:219,color:'#b59e7a',main:false});
    lounge(s,175,714,{w:302,color:'#678a7c'});s.object(541,800,82,78,chairArt('#c6ac85'));
    kitchen(s,873,710,245);s.object(968,950,216,155,tableArt(162,113));
    s.wall(1259,672,15,152);s.wall(1259,965,15,228);s.art.push(rect(1322,753,316,290,'#e7e6d2',14));
    s.object(1337,767,286,263,rect(0,0,286,263,`url(#${id}-water)`,10)+rect(10,10,266,243,'none',8,'stroke="#c6e0cc" stroke-width="3"')+path('M25 63Q84 50 146 64T259 62M24 123Q90 139 156 122T260 123M25 202Q104 187 175 202T260 203','none','stroke="#daeddb" stroke-width="3" opacity=".4"'),{kind:'lake'});
    s.plant(1350,1110,1.15);s.plant(1652,718,1.05);s.label(980,520,'STUDY');s.label(1385,1161,'GARDEN COURTYARD');s.plant(724,965,1.2);s.door(857);
    s.furnitureAnchors=[{x:79,y:1079},{x:548,y:971},{x:1172,y:848},{x:751,y:734}];
  }
  s.furnishingArea={x:62,y:160,w:s.width-124,h:s.height-280};
  s.homePropertyId=profile.home?.propertyId;
  addOwnedFurniture(s,profile,owned);
  const furnishPoint=[{x:s.spawn.x+114,y:s.spawn.y-2},{x:s.spawn.x-114,y:s.spawn.y-2},{x:s.spawn.x,y:s.spawn.y-74}].find(p=>!s.obstacles.some(b=>p.x>b.x-32&&p.x<b.x+b.w+32&&p.y>b.y-32&&p.y<b.y+b.h+32))||{x:s.spawn.x,y:s.spawn.y};
  s.point('furnish',furnishPoint.x,furnishPoint.y,'Arrange your home','furnish');
  for(const partition of profile.home?.roomStyle?.partitions||[]){const r=partitionRect(s,partition);s.wall(r.x,r.y,r.w,r.h);s.walls.at(-1).custom=true;s.walls.at(-1).id=partition.id;}
  return s.finish();
}

function stairArt(w,h) {
  let art=shadow(0,0,w,h)+rect(0,0,w,h,'#8c8068',3);
  for(let i=0;i<9;i++){const y=i*h/9;art+=rect(0,y-18,w,h/9,'#c6b393',2)+rect(0,y+h/9-22,w,5,'#e7d8b9');}
  return '<desc data-scene-prop="stairs"/>'+art+line(14,-25,14,h-6,'#607461',6)+line(w-14,-25,w-14,h-6,'#607461',6);
}

// Round-based upright decor keeps its elevation art vertical when its yaw changes.
const FURNITURE={
  'portable-ac':{w:52,h:55,upright:true,art:()=>rect(0,-56,52,109,'#d9dfd2',6)+rect(7,-39,38,32,'#718d84',3)+line(12,-25,40,-25,'#d9e5d8',3)},
  'power-inverter':{w:75,h:48,upright:true,art:()=>rect(0,-24,75,73,'#81938a',4)+rect(7,-53,61,38,'#d9decb',4)+rect(20,-42,35,14,'#6d9684',2)},
  'premium-sofa':{w:270,h:94,art:()=>sofaArt(270,94,'#96755c')},
  'king-bed':{w:200,h:228,art:()=>bedArt(200,228,'#516e79')},
  'pool-table':{w:240,h:145,art:()=>rect(0,-17,240,162,'#826340',9)+rect(12,-9,216,142,'#56775c',5)+ellipse(155,55,5,5,'#eadbc0')+ellipse(72,65,5,5,'#b98762')},
  'gaming-console':{w:90,h:45,art:()=>deskArt(90,45)},
  'bar-cart':{w:96,h:60,art:()=>counterArt(96,60,'#9d8966')},
  'art-piece':{w:30,h:22,upright:true,art:()=>rect(-25,-100,80,110,'#a08661',3)+rect(-18,-93,66,96,'#d9cca7')+rect(-7,-72,22,57,'#739180')},
  plant:{w:44,h:38,upright:true,art:()=>group(22,27,plantArt(.95))},
  bookshelf:{w:116,h:56,art:()=>shelfArt(116)},
  'lounge-chair':{w:82,h:78,art:()=>chairArt()},
  desk:{w:164,h:75,art:()=>deskArt(164)},
  'dining-table':{w:205,h:170,art:()=>group(27,32,tableArt(150,110))},
  sofa:{w:232,h:86,art:()=>sofaArt(232,86,'#b68b6b')},
  bed:{w:170,h:214,art:()=>bedArt(170,214,'#8a9e88')},
  fridge:{w:66,h:74,art:()=>fridgeArt()},
  'floor-lamp':{w:38,h:24,upright:true,art:()=>group(19,12,floorLampArt())},
  rug:{w:224,h:142,solid:false,art:()=>rect(0,0,224,142,'#bda37d',5)+rect(9,9,206,124,'none',3,'stroke="#e3cdab" stroke-width="4"')+path('M22 71L69 26L112 71L156 26L201 71L156 116L112 71L69 116Z','none','stroke="#e4cba8" stroke-width="3" opacity=".6"')},
  tv:{w:146,h:51,art:()=>shadow(0,0,146,51)+rect(0,0,146,51,'#9e8661',4)+rect(8,-87,130,83,'#40554d',4)+rect(14,-81,118,69,'#769790',2)+path('M17-15L66-54L100-27L130-60V-15Z','#acc2ab')+line(74,-3,74,9,'#536c5d',7)+rect(52,9,45,5,'#536c5d',2)}
};
function extraFurnitureArt(item){
  const w=item.width,h=item.depth,c=item.color||'#ae9474';
  switch(item.modelKind){
    case 'desk':return deskArt(w,h);
    case 'bookshelf':return shelfArt(w);
    case 'wardrobe':return wardrobeArt(w);
    case 'lounge-chair':case 'office-chair':return chairArt(c);
    case 'plant':return group(w/2,h*.75,plantArt(1.18));
    case 'rug':return rect(0,0,w,h,c,5)+rect(9,9,w-18,h-18,'none',3,'stroke="#ded5b9" stroke-width="4"');
    case 'kitchen':return counterArt(w,h,'#87958a');
    case 'coffee-table':case 'bedside-table':case 'balcony-bench':return coffeeArt(w,h);
    case 'washing-machine':return rect(0,-58,w,h+58,'#d6dbd5',6)+rect(7,-48,w-14,17,'#6c7a74',2)+ellipse(w/2,18,w*.32,w*.32,'#788d8d')+ellipse(w/2,18,w*.24,w*.24,'#bacac9');
    case 'standing-fan':return ellipse(w/2,h*.8,w*.46,8,'#7d8b80')+line(w/2,h*.8,w/2,-42,'#657971',6)+ellipse(w/2,-55,28,28,'#b7c9bf')+ellipse(w/2,-55,23,23,'none','stroke="#658176" stroke-width="3"')+line(w/2-20,-55,w/2+20,-55,'#668776',4)+line(w/2,-75,w/2,-35,'#668776',4);
    case 'full-length-mirror':return rect(-5,-120,w+10,134,'#92795d',4)+rect(1,-113,w-2,119,'#b4d0ce',2)+path(`M4-104L${w-8}-48V-83L4-111Z`,'#dbe8e1');
    case 'table-lamp':return ellipse(w/2,h/2,w*.3,h*.24,'#9a886b')+line(w/2,h/2,w/2,-30,'#997f58',4)+path(`M${w*.08}-30L${w*.22}-56H${w*.78}L${w*.92}-30Z`,'#eadbc1');
    case 'vase':return ellipse(w/2,h/2,w*.38,h*.3,'#657f7c')+ellipse(w/2,-14,w*.24,5,'#a5beb3')+path(`M${w*.26}-14Q${w*.1} 10 ${w*.13} ${h/2}H${w*.87}Q${w*.9} 10 ${w*.74}-14Z`,'#91aaa0');
    case 'succulent':return ellipse(w/2,h/2,w*.43,7,'#ad8763')+path(`M${w*.15} 0H${w*.85}L${w*.75} ${h/2}H${w*.25}Z`,'#c5a27b')+ellipse(w/2,-4,w*.35,9,'#74966f')+ellipse(w/2,-10,w*.18,10,'#8fa97d');
    case 'book-stack':return rect(0,-4,w,h,'#657b77',2)+rect(3,-9,w-4,h-2,'#d5c9ae',2)+rect(0,-14,w-1,h-4,'#ad8567',2);
    case 'music-speaker':return rect(0,-80,w,h+80,'#394744',5)+ellipse(w/2,-48,w*.3,w*.3,'#152320')+ellipse(w/2,-8,w*.32,w*.32,'#677d72');
    case 'microwave':return coffeeArt(w,h)+rect(4,-48,w-8,45,'#c7ceca',4)+rect(10,-41,w*.63,28,'#354b44',2)+ellipse(w-13,-24,4,4,'#708f7d');
    case 'shoe-rack':return rect(0,-36,w,65,'#9c8361',3)+line(6,-14,w-6,-14,'#d4c3a2',4)+line(6,14,w-6,14,'#d4c3a2',4);
    default:return rect(0,-55,w,h+55,c,5)+rect(5,-46,w-10,28,'#bdaa8a',2)+rect(5,-9,w-10,28,'#bdaa8a',2)+line(w*.42,-30,w*.58,-30,'#655d4e',3)+line(w*.42,7,w*.58,7,'#655d4e',3);
  }
}
for(const item of EXTRA_HOME_ITEMS)FURNITURE[item.id]={w:item.width,h:item.depth,upright:!!item.upright,solid:item.solid,art:()=>extraFurnitureArt(item)};
export function furnitureGhost(itemId) {
  const def=FURNITURE[itemId]||FURNITURE.plant;
  return {art:def.art(),...furnitureDimensions(itemId)};
}
export function furnitureDimensions(itemId) {
  const def=FURNITURE[itemId]||FURNITURE.plant;
  return {width:def.w,height:def.h,upright:!!def.upright,solid:def.solid!==false,surfaceHeight:furnitureSurface(itemId)?.height||0,requiresSurface:SURFACE_ONLY_FURNITURE.includes(itemId)};
}

function partitionRect(scene,partition){
  const area=scene.furnishingArea||{x:62,y:160,w:scene.width-124,h:scene.height-280};
  return {x:area.x+partition.x*area.w,y:area.y+partition.y*area.h,w:partition.w*area.w,h:partition.h*area.h};
}
export function homeDesignPreservesRoutes(profile,roomStyle){
  if(!roomStyle||!Array.isArray(roomStyle.partitions))return false;
  const base=buildHome({...profile,home:{...profile.home,roomStyle:{...roomStyle,partitions:[]}}},'design-route-check');
  for(const p of roomStyle.partitions){
    if(!['x','y','w','h'].every(k=>Number.isFinite(p[k]))||p.x<0||p.y<0||p.w<.008||p.h<.008||p.w>1||p.h>1||Math.min(p.w,p.h)>.07||p.x+p.w>1||p.y+p.h>1)return false;
    const r=partitionRect(base,p),overlaps=(b,pad=12)=>r.x<b.x+b.w+pad&&r.x+r.w>b.x-pad&&r.y<b.y+b.h+pad&&r.y+r.h>b.y-pad;
    if((base.objects||[]).some(o=>o.solid!==false&&overlaps(o)))return false;
    if(base.interactables.some(p=>overlaps({x:p.x,y:p.y,w:0,h:0},46))||overlaps({x:base.spawn.x,y:base.spawn.y,w:0,h:0},70))return false;
    base.obstacles.push(r);
  }
  return furniturePlacementPreservesRoutes(base,null);
}

// Match the playable world's navigation grid. Local clearance alone can leave a
// narrow doorway with no usable walking route after arranging large furniture.
const furnitureNavigationCache=new WeakMap();
export function furniturePlacementPreservesRoutes(scene,footprint,previousPlacement=null) {
  const step=26,radius=10,cols=Math.ceil(scene.width/step),rows=Math.ceil(scene.height/step);
  const sameRect=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
  const obstacles=(scene.obstacles||[]).filter(o=>!sameRect(o,previousPlacement));
  const signature=JSON.stringify([scene.width,scene.height,obstacles]);
  let cached=furnitureNavigationCache.get(scene);
  if(cached?.signature!==signature) {
    const blocked=new Uint8Array(cols*rows);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
      const px=(x+.5)*step,py=(y+.5)*step;
      blocked[y*cols+x]=px<radius+12||py<radius+12||px>scene.width-radius-12||py>scene.height-radius-12||obstacles.some(o=>px>o.x-radius&&px<o.x+o.w+radius&&py>o.y-radius&&py<o.y+o.h+radius)?1:0;
    }
    cached={signature,blocked};furnitureNavigationCache.set(scene,cached);
  }
  const covered=(x,y)=>footprint&&(x+.5)*step>footprint.x-radius&&(x+.5)*step<footprint.x+footprint.w+radius&&(y+.5)*step>footprint.y-radius&&(y+.5)*step<footprint.y+footprint.h+radius;
  const free=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&!cached.blocked[y*cols+x]&&!covered(x,y);
  const nearest=point=>{
    const ox=Math.max(0,Math.min(cols-1,Math.floor(point.x/step))),oy=Math.max(0,Math.min(rows-1,Math.floor(point.y/step)));
    if(free(ox,oy))return oy*cols+ox;
    for(let r=1;r<16;r++)for(let y=oy-r;y<=oy+r;y++)for(let x=ox-r;x<=ox+r;x++)if((Math.abs(x-ox)===r||Math.abs(y-oy)===r)&&free(x,y))return y*cols+x;
    return -1;
  };
  const start=nearest(scene.spawn),targets=new Set((scene.interactables||[]).map(nearest));
  if(start<0||targets.has(-1))return false;
  targets.delete(start);if(!targets.size)return true;
  const visited=new Uint8Array(cols*rows),queue=new Int32Array(cols*rows);let head=0,tail=1;queue[0]=start;visited[start]=1;
  while(head<tail) {
    const index=queue[head++],x=index%cols,y=Math.floor(index/cols);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const nx=x+dx,ny=y+dy,next=ny*cols+nx;
      if(!free(nx,ny)||visited[next]||(dx&&dy&&(!free(x+dx,y)||!free(x,y+dy))))continue;
      visited[next]=1;queue[tail++]=next;targets.delete(next);if(!targets.size)return true;
    }
  }
  return false;
}

function addOwnedFurniture(s,profile,owned) {
  const configured=profile.furnitureLayout||profile.home?.furnitureLayout||profile.home?.furniture||{};
  const rawEntries=Array.isArray(configured)?configured:Object.entries(configured).map(([itemId,value])=>({itemId,...(typeof value==='object'?value:{slot:value})}));
  const currentProperty=profile.home?.propertyId,entryByItem=new Map();
  for(const entry of rawEntries){
    const itemId=entry?.itemId||entry?.id;if(!itemId)continue;
    const previous=entryByItem.get(itemId),isCurrent=!entry.propertyId||entry.propertyId===currentProperty,previousCurrent=previous&&(!previous.propertyId||previous.propertyId===currentProperty);
    if(!previous||isCurrent&&!previousCurrent)entryByItem.set(itemId,{...entry,itemId});
  }
  const entries=[...entryByItem.values()];
  s.furniturePlacements=[];
  s.storedFurniture=[];
  const baseFor=itemId=>s.items.find(v=>itemId==='bed'?v.art.includes('#faf2df'):itemId==='dining-table'?v.art.includes('#6b8653')&&v.art.includes('#efe6cd'):itemId==='sofa'?v.art.includes('#d9b984')&&v.art.includes('#e4dfc5'):false);
  const removeBase=itemId=>{
    const base=baseFor(itemId);if(!base)return false;
    s.items.splice(s.items.indexOf(base),1);
    const objectIndex=s.objects.findIndex(o=>o.x===base.x&&o.y===base.footY&&o.w===base.w&&o.h===base.h);if(objectIndex>=0)s.objects.splice(objectIndex,1);
    const obstacleIndex=s.obstacles.findIndex(b=>b.x===base.x&&b.y===base.footY&&b.w===base.w&&b.h===base.h);if(obstacleIndex>=0)s.obstacles.splice(obstacleIndex,1);
    return true;
  };
  const adoptBase=itemId=>{
    const base=baseFor(itemId);
    if(!base)return false;
    const area=s.furnishingArea,px=(base.x+base.w/2-area.x)/area.w,py=(base.footY+base.h/2-area.y)/area.h;
    let art=base.art;
    if(itemId==='bed')art=art.replace(/(<rect x="7" y="48"[^>]*fill=")[^"]+("[^>]*\/?>)/,'$1#628779$2')+group(base.x,base.footY,rect(13,base.h-74,base.w-26,29,'#cfb081',3)+line(20,base.h-67,base.w-20,base.h-67,'#e8d3a9',2)+line(20,base.h-52,base.w-20,base.h-52,'#e8d3a9',2));
    else art=art.replaceAll('#c1a176','#ccaa79').replaceAll('#947757','#8f7252').replaceAll('#efe6cd','#f6ebce');
    base.art=`<g data-home-item="${itemId}" data-furniture-item="${itemId}" data-placement-x="${px.toFixed(3)}" data-placement-y="${py.toFixed(3)}" data-placement-rotation="0">${art}</g>`;
    const object=s.objects.find(o=>o.x===base.x&&o.y===base.footY&&o.w===base.w&&o.h===base.h);if(object)Object.assign(object,{itemId,kind:itemId,rotation:0});
    s.furniturePlacements.push({itemId,x:base.x,y:base.footY,w:base.w,h:base.h,rotation:0});return true;
  };
  let next=0;
  for(const itemId of [...owned].sort((a,b)=>Number(Boolean(entries.find(v=>(v.itemId||v.id)===a)?.supportId))-Number(Boolean(entries.find(v=>(v.itemId||v.id)===b)?.supportId)))) {
    const def=FURNITURE[itemId];if(!def)continue;
    if(profile.storedFurniture?.includes(itemId)){s.storedFurniture.push(itemId);continue;}
    const stored=entries.find(v=>(v.itemId||v.id)===itemId);
    if(stored?.propertyId&&stored.propertyId!==profile.home?.propertyId){s.storedFurniture.push(itemId);continue;}
    if(SURFACE_ONLY_FURNITURE.includes(itemId)&&!stored?.supportId){s.storedFurniture.push(itemId);continue;}
    if(!stored&&['bed','dining-table'].includes(itemId)&&adoptBase(itemId))continue;
    if(stored&&['bed','dining-table'].includes(itemId))removeBase(itemId);
    if(itemId==='sofa') {
      const base=baseFor('sofa');
      if(base&&!stored){
        const area=s.furnishingArea,px=(base.x+base.w/2-area.x)/area.w,py=(base.footY+base.h/2-area.y)/area.h;
        base.art=`<g data-home-item="sofa" data-furniture-item="sofa" data-placement-x="${px.toFixed(3)}" data-placement-y="${py.toFixed(3)}" data-placement-rotation="0">${base.art}</g>`;
        const object=s.objects.find(o=>o.x===base.x&&o.y===base.footY&&o.w===base.w&&o.h===base.h);if(object)Object.assign(object,{itemId:'sofa',kind:'sofa',rotation:0});
        s.furniturePlacements.push({itemId:'sofa',x:base.x,y:base.footY,w:base.w,h:base.h,rotation:0});continue;
      }
      if(base&&stored)removeBase('sofa');
    }
    let anchor=s.furnitureAnchors[(Number(stored?.slot)||next)%s.furnitureAnchors.length];next++;
    const rotation=[0,90,180,270].includes(stored?.rotation)?stored.rotation:0;
    const artRotation=def.upright?0:rotation;
    const w=artRotation%180?def.h:def.w,h=artRotation%180?def.w:def.h;
    const storedX=Number(stored?.x),storedY=Number(stored?.y),area=s.furnishingArea;
    const x=storedX>=0&&storedX<=1?area.x+storedX*area.w-w/2:storedX;
    const y=storedY>=0&&storedY<=1?area.y+storedY*area.h-h/2:storedY;
    if(Number.isFinite(x)&&Number.isFinite(y)&&x>65&&x+w<s.width-65&&y>165&&y+h<s.height-115)anchor={x,y};
    const overlaps=(a,b,pad=16)=>a.x<b.x+b.w+pad&&a.x+a.w>b.x-pad&&a.y<b.y+b.h+pad&&a.y+a.h>b.y-pad;
    let candidates=[anchor,...s.furnitureAnchors];
    const clear=a=>(def.solid===false||!s.obstacles.some(b=>overlaps({...a,w,h},b)))&&!s.interactables.some(p=>p.x>a.x-45&&p.x<a.x+w+45&&p.y>a.y-45&&p.y<a.y+h+45)&&Math.hypot(a.x+w/2-s.spawn.x,a.y+h/2-s.spawn.y)>110&&(def.solid===false||furniturePlacementPreservesRoutes(s,{...a,w,h}));
    const authoritative=stored?.propertyId===profile.home?.propertyId;
    let placement=authoritative&&Number.isFinite(x)&&Number.isFinite(y)?{x,y}:candidates.find(clear);
    if(!placement&&!authoritative)for(let y=s.height-135-h;y>174&&!placement;y-=58)for(let x=85;x<s.width-85-w&&!placement;x+=58){const candidate={x,y};if(clear(candidate))placement=candidate;}
    if(!placement){if(!adoptBase(itemId))s.storedFurniture.push(itemId);continue;}
    const support=stored?.supportId?s.furniturePlacements.find(placed=>placed.itemId===stored.supportId):null;
    if(stored?.supportId&&(!support||!furnitureSurface(support.itemId))){s.storedFurniture.push(itemId);continue;}
    const elevation=support?furnitureSurface(support.itemId).height:0;
    const normalizedX=(placement.x+w/2-area.x)/area.w,normalizedY=(placement.y+h/2-area.y)/area.h;
    const art=`<g data-home-item="${esc(itemId)}" data-furniture-item="${esc(itemId)}" data-placement-x="${normalizedX.toFixed(3)}" data-placement-y="${normalizedY.toFixed(3)}" data-placement-rotation="${rotation}" transform="translate(${w/2} ${h/2}) rotate(${artRotation}) translate(${-def.w/2} ${-def.h/2})">${def.art()}</g>`;
    if(def.solid===false||support){s.art.push(group(placement.x,placement.y,art));s.objects.push({x:placement.x,y:placement.y,w,h,kind:itemId,itemId,rotation,solid:false});}else s.object(placement.x,placement.y,w,h,art,{kind:itemId});
    const metadata={propertyId:stored?.propertyId||profile.home?.propertyId,supportId:stored?.supportId||null,elevation,surfaceHeight:furnitureSurface(itemId)?.height||0};
    Object.assign(s.objects.at(-1),metadata);
    s.furniturePlacements.push({itemId,x:placement.x,y:placement.y,w,h,rotation,...metadata});
    if(itemId==='sofa') {
      const old=s.interactables.find(p=>p.action==='relax');
      const candidates=[{x:placement.x+w/2,y:placement.y+h+38},{x:placement.x+w+38,y:placement.y+h/2},{x:placement.x-38,y:placement.y+h/2},{x:placement.x+w/2,y:placement.y-38}];
      const p=candidates.find(p=>!s.obstacles.some(b=>p.x>b.x-15&&p.x<b.x+b.w+15&&p.y>b.y-15&&p.y<b.y+b.h+15));
      if(old&&p)Object.assign(old,p);
    }
  }
}

function counterArt(w=330,h=93,color='#719280') {
  return '<desc data-scene-prop="counter"/>'+shadow(0,0,w,h)+rect(0,-12,w,h+12,color,5)+rect(12,13,w-24,h-22,'#a1af90',3)+rect(-6,-29,w+12,48,'#dfd2ae',5)+line(11,3,w-11,3,'#f1e3c5',3)+rect(w-94,-62,54,35,'#435b51',4)+rect(w-90,-57,46,23,'#91b8a8',2)+rect(w-84,-27,35,4,'#485e53',2)+rect(28,-15,40,25,'#eae1c8',2);
}
function techStallArt(w,h,kind,label) {
  let art=shadow(0,0,w,h)+rect(0,-16,w,h+16,'#716f61',3)+rect(8,8,w-16,h-19,'#acac98',2)+rect(-4,-27,w+8,30,'#c9baa0',3);
  art+=rect(10,-102,w-20,42,'#3c626d',2)+text(w/2,-76,label,12,'#eee7d3','text-anchor="middle" font-weight="600" letter-spacing="1"');
  const laptop=x=>rect(x-29,-49,58,39,'#293a42',3)+rect(x-24,-44,48,29,'#79a9a7',1)+rect(x-31,-7,62,24,'#abb4b1',2)+rect(x-25,-2,50,12,'#53666a',1)+line(x-20,2,x+20,2,'#9ba9a4',1)+line(x-20,7,x+20,7,'#9ba9a4',1);
  if(kind==='tech-laptop-stall')for(const x of[w*.19,w*.5,w*.81])art+=laptop(x);
  else if(kind==='tech-repair-bench'){
    art+=laptop(w*.22)+rect(w*.49,-7,w*.25,33,'#557a5e',2)+rect(w*.56,1,20,15,'#263d3b')+line(w*.44,3,w*.73,30,'#ad9b65',3)+rect(w*.76,-20,39,38,'#d0a763',3)+rect(w*.79,-14,22,14,'#607f78',1)+path(`M${w*.82} 16Q${w*.92} 52 ${w*.61} 40`,'none','stroke="#3d4d4a" stroke-width="2"');
  }else if(kind==='tech-accessory-stall'||kind==='tech-parts-shelf'){
    for(let row=0;row<3;row++)for(let col=0;col<8;col++){const x=18+col*(w-35)/8,y=-44+row*33;art+=rect(x,y,25,28,['#bec1a8','#779e97','#bb976d','#8c9caa'][(row+col)%4],2)+rect(x+5,y+4,15,17,'#3e5354',1);}
  }else if(kind==='tech-console-stall'){
    art+=rect(w*.30,-55,w*.40,46,'#263b40',3)+rect(w*.33,-50,w*.34,35,'#79a69b',2)+rect(w*.48,-9,12,17,'#6f7f79')+rect(w*.22,6,w*.38,12,'#b8c3bd',2)+rect(w*.70,-38,25,51,'#d8daca',3);
    for(const x of[28,w-60])art+=rect(x,-30,33,54,'#3b4848',2)+ellipse(x+16,-13,10,10,'#192d30')+ellipse(x+16,11,7,7,'#71847f');
  }else{
    art+=rect(30,-46,66,87,'#c5ccc0',4)+line(40,-29,86,-29,'#5e7674',3)+line(40,-19,86,-19,'#5e7674',3)+rect(w*.40,-20,w*.28,52,'#778b82',3)+rect(w*.45,-9,w*.17,13,'#abd0b1',1)+ellipse(w*.82,-13,30,30,'#93ada1')+line(w*.82,-2,w*.82,48,'#617971',5)+ellipse(w*.82,49,26,8,'#6c8071');
  }
  return '<desc data-scene-prop="'+kind+'"/>'+art;
}
function wallSign(s,x,y,title,subtitle='') {s.art.push(rect(x-8,y-29,Math.max(185,title.length*13+36),subtitle?71:47,'#f5ecd6',3)+text(x+8,y,title,21,'#3c6555','font-weight="600" letter-spacing="3"')+(subtitle?text(x+9,y+24,subtitle,11,'#8d886b','letter-spacing="2"'):''));}
function venueActivities(venue) {
  const entries=venue?.activities||venue?.actions||VENUE_ACTIONS.filter(a=>a.venueId===venue?.id||(venue?.actionIds||[]).includes(a.id));
  return Array.isArray(entries)?entries.map(v=>typeof v==='string'?{id:v,name:v.replaceAll('-',' ')}:v):Object.entries(entries).map(([id,v])=>typeof v==='object'?{id,...v}:{id,name:String(v)});
}
function venuePoints(s,venue,anchors,fallbacks=[]) {
  const activities=venueActivities(venue);const points=activities.length?activities:fallbacks.map(([id,name])=>({id,name}));
  const action={'dealership':'dealership','estate-office':'estate-office','furniture-store':'market'}[venue.id];
  if(venue.id==='banex'){anchors.forEach((p,i)=>s.point(`browse-${i}`,p.x,p.y,i===0?'Browse Banex tech':'Browse this tech counter','banex-market',{venueId:'banex'}));return;}
  if(action){const p=anchors[0];s.point('browse',p.x,p.y,venue.id==='dealership'?'Find your next car':venue.id==='estate-office'?'Find your next home':'Browse Okrika Marketplace',action,{});return;}
  points.forEach((a,i)=>{const p=anchors[i%anchors.length];s.point(`activity-${a.id}`,p.x,p.y,a.name||a.label||a.title||'Take part','venue-action',{venueId:venue.id,activityId:a.id});});
}
function treadmillArt() {
  return '<desc data-scene-prop="treadmill"/>'+shadow(0,0,92,158)+rect(5,0,82,149,'#4d665d',8)+rect(15,16,62,112,'#324941',7)+line(23,40,69,40,'#71887b',3)+line(23,105,69,105,'#71887b',3)+path('M2 77L6-24H86L90 77','none','stroke="#98a99c" stroke-width="8"')+rect(12,-42,68,36,'#4d685d',7)+rect(21,-35,50,20,'#9cc1a4',3)+line(43,-30,43,-19,'#edf2ce',3)+line(54,-30,54,-19,'#edf2ce',3);
}
function carArt(color='#d8d4c2') {
  return '<desc data-scene-prop="car"/>'+shadow(0,0,245,127)+rect(31,6,35,24,'#354039',6)+rect(183,6,35,24,'#354039',6)+rect(31,113,35,22,'#354039',6)+rect(183,113,35,22,'#354039',6)+path('M11 23Q12 5 36 1H201Q230 1 237 24L244 94Q244 113 220 119H28Q3 115 3 94Z',color)+path('M76 10H160L184 35L182 84L156 108H72L51 87L53 33Z','#68877d')+path('M85 16H155L170 36H67Z','#bfd1c2')+path('M68 83H170L153 103H84Z','#aec4b9')+rect(80,38,76,44,color,7)+line(181,38,228,38,'#a9b4a3',2)+line(182,84,231,84,'#a9b4a3',2)+rect(224,21,12,24,'#fff2bc',4)+rect(224,83,12,24,'#fff2bc',4)+rect(8,27,8,22,'#bf8161',3)+rect(8,80,8,22,'#bf8161',3);
}
function produceArt(w=205,h=103,type=0) {
  let art=shadow(0,0,w,h)+rect(0,-20,w,h+22,'#9c8763',5)+rect(7,-28,w-14,h+3,'#c5ac7e',3);
  const colors=type?['#e6d395','#c18d5a','#a9bb83']:['#be765b','#789259','#d5ba6b'];
  for(let row=0;row<3;row++)for(let col=0;col<7;col++)art+=ellipse(22+col*(w-43)/6,-8+row*29,10,9,colors[(col+row)%3])+ellipse(20+col*(w-43)/6,-11+row*29,3,2,'#f5e4b9','opacity=".4"');
  return '<desc data-scene-prop="produce"/>'+art+line(w/3,-20,w/3,h-21,'#a1875f',3)+line(w*2/3,-20,w*2/3,h-21,'#a1875f',3);
}
function cinemaChair(x,y) {return '<desc data-scene-prop="cinema-chair"/>'+group(x,y,shadow(0,0,61,55)+rect(3,-28,55,52,'#865f58',9)+rect(9,-22,43,42,'#a57768',7)+rect(3,20,55,34,'#b28873',7)+rect(-3,9,10,47,'#6e5c52',4)+rect(54,9,10,47,'#6e5c52',4));}


function buildLandmarkVenue(profile,raw,id){
  const s=sceneBase(1580,1180,id,{floor:['millennium-park-hub','eagle-square-hub','city-gate-plaza','aso-rock-view'].includes(raw.id)?'pave':'tile',name:raw.name});
  s.subtitle=raw.description||'A recognisable Abuja destination.';const anchors=[];let fallbacks=[];
  const sign=(title,subtitle='ABUJA · YOUR CITY')=>wallSign(s,430,110,title,subtitle);
  const desks=(count=4,y=360)=>{for(let i=0;i<count;i++)s.object(160+i*300,y,220,76,deskArt(220),{kind:'service-desk'});};
  const seats=(rows=3,cols=6,startY=480)=>{for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)s.object(160+c*205,startY+r*150,82,72,chairArt(r%2?'#a89474':'#849a88'),{kind:'visitor-seat'});};
  switch(raw.id){
    case'airport-hub': sign('ABUJA AIRPORT','DEPARTURES · ARRIVALS');s.window(125,230);s.window(1115,230);desks(4,320);seats(3,5,520);s.art.push(rect(1170,176,310,220,'#6f908e',8)+path('M1195 340L1450 205','none','stroke="#dce9df" stroke-width="6"')+text(1325,372,'APRON · AIRCRAFT MOVING',13,'#e8ebd6','text-anchor="middle"'));s.pedestrians.push({x:390,y:445,toX:1020,toY:445,role:'Traveller'},{x:1260,y:525,toX:1260,toY:525,stationary:true,role:'Airport staff'});anchors.push({x:470,y:449},{x:1260,y:525});fallbacks=[['airport-checkin','Check the departures hall'],['airport-observe','Watch the aircraft']];break;
    case'city-gate-plaza': sign('ABUJA CITY GATE','THE CITY STARTS HERE');s.art.push(rect(145,190,1290,770,'#a8bb91',34),path('M420 850Q470 230 710 240V850H610V420Q525 420 510 850Z','#e7e0ca'),path('M870 850V240Q1110 230 1160 850H1070Q1050 420 970 420V850Z','#e7e0ca'));for(const [x,y] of [[225,930],[1330,930],[245,310],[1315,310]])s.object(x,y,30,30,group(15,15,gardenTreeArt(1.2)),{solid:false});anchors.push({x:790,y:905});fallbacks=[['city-gate-photo','Take a City Gate photo']];break;
    case'national-stadium-hub': sign('NATIONAL STADIUM','SPORT · MATCH DAY');s.art.push(rect(155,205,1270,745,'#d8d6c2',90),rect(250,295,1080,565,'#71966d',80),rect(390,390,800,375,'#92b77c',28),line(790,390,790,765,'#e7e6cc',5));seats(2,6,870);anchors.push({x:790,y:815},{x:790,y:1010});fallbacks=[['stadium-train','Train at the stadium'],['stadium-event','Join match-day activity']];break;
    case'magicland': sign('MAGICLAND','RIDES · ARCADE · FRIENDS');s.art.push(ellipse(470,485,190,190,'none','stroke="#b97465" stroke-width="18"'),line(470,294,470,677,'#718176',8),line(280,485,660,485,'#718176',8));s.object(850,290,500,210,rect(0,0,500,210,'#526d69',15)+text(250,102,'ARCADE',32,'#f0ddb5','text-anchor="middle" letter-spacing="8"'),{kind:'arcade'});for(const [x,y] of [[860,610],[1120,610],[860,820],[1120,820]])s.object(x,y,160,100,tableArt(130,82));anchors.push({x:470,y:715},{x:1100,y:520});fallbacks=[['magicland-arcade','Play in the arcade'],['magicland-meet','Meet up inside the park']];break;
    case'wtc-abuja-hub': sign('WORLD TRADE CENTRE','BUSINESS · ABUJA SKYLINE');s.window(100,220);s.window(1080,220);s.rug(170,310,1240,420,'#b9bba3');desks(3,420);s.object(180,785,440,86,sofaArt(440,86,'#82998b'));s.object(960,785,440,86,sofaArt(440,86,'#82998b'));s.art.push(rect(650,180,290,126,'#6e9291',5)+text(795,250,'CBD SKYLINE',22,'#e8ead7','text-anchor="middle"'));anchors.push({x:790,y:620},{x:790,y:930});fallbacks=[['wtc-network','Meet in the business lobby'],['wtc-view','Take in the CBD skyline']];break;
    case'cbn-experience': sign('CENTRAL BANK OF NIGERIA','FINANCE · HISTORY · CAREERS');desks(4,760);for(let i=0;i<4;i++)s.art.push(rect(175+i*330,220,250,260,'#e1d9be',8)+rect(195+i*330,245,210,170,['#76928a','#a28e68','#839775','#6e8587'][i],5)+text(300+i*330,445,['MONEY','STABILITY','HISTORY','CAREERS'][i],15,'#52675d','text-anchor="middle"'));anchors.push({x:790,y:640},{x:1040,y:910});fallbacks=[['cbn-gallery','Explore the finance gallery'],['cbn-careers','Visit the careers desk']];break;
    case'national-assembly-hub': sign('NATIONAL ASSEMBLY','FICTIONAL CITY CIVIC PLAY');s.art.push(ellipse(790,245,165,92,'#b7ac83'),rect(250,330,1080,530,'#d9d3bd',20));for(let r=0;r<4;r++)for(let c=0;c<8;c++)s.object(305+c*122,415+r*104,82,66,chairArt('#8d987e'),{kind:'chamber-seat'});s.object(650,860,280,82,counterArt(280,82,'#8c7659'),{kind:'speaker-desk'});anchors.push({x:790,y:965},{x:790,y:705});fallbacks=[['assembly-gallery','Visit the civic gallery'],['assembly-townhall','Attend a fictional town hall']];break;
    case'eagle-square-hub': sign('EAGLE SQUARE','PUBLIC EVENTS · CITY MOMENTS');s.art.push(rect(125,190,1330,840,'#d8d0b4',34),rect(255,305,1070,590,'#b4c39d',28),path('M790 320L842 436L970 449L874 535L900 663L790 596L680 663L706 535L610 449L738 436Z','#d6b676'));for(const [x,y] of [[230,250],[1350,250],[230,960],[1350,960]])s.object(x,y,25,25,group(12,12,gardenTreeArt(1.1)),{solid:false});anchors.push({x:790,y:860});fallbacks=[['eagle-square-meet','Meet at Eagle Square'],['eagle-square-event','Attend a public city event']];break;
    case'national-mosque-hub': sign('ABUJA NATIONAL MOSQUE','PRAYER · REFLECTION · COMMUNITY');s.rug(170,245,1240,600,'#819985');for(let r=0;r<4;r++)for(let c=0;c<8;c++)s.art.push(rect(205+c*145,285+r*125,110,95,'#b9c7ad',4));s.art.push(path('M610 245Q790 50 970 245Z','#8ba081'));anchors.push({x:790,y:900},{x:1180,y:930});fallbacks=[['national-mosque-prayer','Prayer & reflection'],['national-mosque-community','Spend time with the community']];break;
    case'national-christian-centre-hub': sign('NATIONAL CHRISTIAN CENTRE','PRAYER · REFLECTION · COMMUNITY');s.art.push(path('M550 245L790 70L1030 245Z','#9c9077'),line(790,82,790,215,'#eadbb7',10),line(744,132,836,132,'#eadbb7',10));for(let r=0;r<5;r++)for(const x of [240,910])s.object(x,390+r*115,430,42,gardenBenchArt(430),{kind:'pew'});anchors.push({x:790,y:930},{x:1190,y:975});fallbacks=[['national-christian-reflect','Prayer & reflection'],['national-christian-community','Spend time with the community']];break;
    case'transcorp-hilton-hub': sign('TRANSCORP HILTON','LOBBY · DINING · POOL');s.rug(145,245,1290,400,'#c3b99e');s.object(180,315,470,95,sofaArt(470,95,'#9c8464'));s.object(930,315,470,95,sofaArt(470,95,'#87998a'));s.object(590,700,400,98,counterArt(400,98));s.art.push(rect(1040,710,350,255,'#79a8a5',26)+rect(1060,730,310,215,'#9bc4b5',20));anchors.push({x:790,y:615},{x:1190,y:980},{x:790,y:930});fallbacks=[['transcorp-meet','Meet in the main lobby'],['transcorp-pool','Spend time by the pool'],['transcorp-dining','Dinner at the hotel']];break;
    case'millennium-park-hub': sign('MILLENNIUM PARK','WALK · PICNIC · FRIENDS');s.art.push(rect(100,175,1380,900,'#a8bc91',45),path('M180 935Q500 520 790 610T1400 270','none','stroke="#e4d7b1" stroke-width="74"'));for(const [x,y] of [[220,310],[470,820],[970,330],[1320,780],[740,280]])s.object(x,y,25,25,group(12,12,gardenTreeArt(1.25)),{solid:false});s.object(980,770,220,130,tableArt(180,100),{kind:'picnic-table'});anchors.push({x:790,y:900},{x:1080,y:930});fallbacks=[['millennium-walk','Walk through Millennium Park'],['millennium-picnic','Picnic in the park']];break;
    case'aso-rock-view': sign('ASO ROCK VIEWPOINT','ABUJA\'S GRANITE BACKDROP');s.art.push(path('M120 870Q220 420 520 360Q730 75 965 310Q1260 350 1450 870Z','#929b78'),path('M235 870Q410 510 590 480Q790 220 1005 455Q1230 500 1345 870Z','#b7b798'),rect(190,875,1190,90,'#d8c9a5',20));for(const x of [300,1280])s.object(x,900,190,60,gardenBenchArt(190),{kind:'view-bench'});anchors.push({x:790,y:995});fallbacks=[['aso-viewpoint','Take in the Aso Rock view']];break;
    case'farm-city': sign('FARM CITY ABUJA','FOOD · ARCADE · HANGOUT');s.object(150,285,560,100,counterArt(560,100,'#8c7456'),{kind:'food-counter'});for(const [x,y] of [[190,520],[480,520],[190,760],[480,760]])s.object(x,y,190,130,tableArt(150,100));s.object(900,285,480,220,rect(0,0,480,220,'#4f6865',14)+text(240,105,'GAME ARCADE',28,'#f0d9aa','text-anchor="middle" letter-spacing="5"'),{kind:'arcade'});anchors.push({x:470,y:965},{x:1110,y:620});fallbacks=[['farmcity-meal','Eat at Farm City'],['farmcity-arcade','Play at the game arcade']];break;
    case'jabi-lake-mall': sign('JABI LAKE MALL','SHOP · FOOD · MEET');for(let i=0;i<5;i++)s.object(120+i*285,270,235,215,rect(0,0,235,215,['#82998d','#9d8469','#718b8e','#a49273','#7d8e76'][i],8)+rect(18,24,199,130,'#d8d7c4',4)+text(117,190,['STYLE','TECH','HOME','FOOD','LIFE'][i],15,'#f2e8ce','text-anchor="middle"'),{kind:'shopfront'});s.rug(180,650,1220,300,'#c6bda2');for(const x of [260,570,880,1190])s.object(x,725,180,120,tableArt(145,95));anchors.push({x:790,y:615},{x:790,y:980});fallbacks=[['jabi-mall-shop','Browse the mall'],['jabi-mall-food','Meet at the food court']];break;
    case'international-conference-centre': sign('ICC ABUJA','CONFERENCES · TOWN HALLS');s.art.push(rect(160,205,1260,250,'#607d77',12)+rect(205,245,1170,170,'#d5d8c6',7));for(let r=0;r<4;r++)for(let c=0;c<9;c++)s.object(185+c*135,515+r*115,82,66,chairArt(r%2?'#9d8668':'#809489'),{kind:'conference-seat'});s.object(590,430,400,76,counterArt(400,76),{kind:'conference-stage'});anchors.push({x:790,y:1000});fallbacks=[['icc-conference','Attend a city conference']];break;
    case'inec-hq': sign('INEC HEADQUARTERS','ABUJALIFE ELECTION REGISTRATION');s.art.push(rect(140,190,1300,150,'#73916f',10)+text(790,280,'INEC · CITY STORY',34,'#f3ecd4','text-anchor="middle" letter-spacing="7"'));desks(4,475);seats(2,5,680);s.object(1110,895,270,80,counterArt(270,80,'#78906f'),{kind:'registration-desk'});s.label(1090,1010,'CANDIDATE REGISTRATION');s.pedestrians.push({x:1225,y:845,toX:1225,toY:845,stationary:true,role:'Registration desk'});anchors.push({x:1225,y:845},{x:790,y:970});fallbacks=[['inec-registration','Visit the candidate registration desk'],['inec-info','Read election information']];break;
    case'efcc-hq': sign('EFCC HEADQUARTERS','FICTIONAL ABUJALIFE INTEGRITY STORY');desks(3,430);s.art.push(rect(180,670,1220,285,'#d6d9c9',10)+text(790,735,'FICTIONAL GAME STORY ONLY',22,'#597064','text-anchor="middle" letter-spacing="4"'));s.object(610,785,360,90,counterArt(360,90,'#73877b'),{kind:'briefing-desk'});s.pedestrians.push({x:790,y:930,toX:790,toY:930,stationary:true,role:'Story desk'});anchors.push({x:790,y:930});fallbacks=[['efcc-briefing','Visit the fictional integrity briefing']];break;
    case'federal-high-court-hub': sign('FEDERAL HIGH COURT','FICTIONAL ABUJALIFE HEARING');s.art.push(rect(180,190,1220,215,'#ded8c4',9));for(let r=0;r<4;r++)for(const x of [220,930])s.object(x,480+r*115,430,44,gardenBenchArt(430),{kind:'court-bench'});s.object(610,365,360,85,counterArt(360,85,'#8c7659'),{kind:'bench'});s.label(680,338,'FICTIONAL HEARING');anchors.push({x:790,y:1000});fallbacks=[['court-gallery','Visit the fictional hearing gallery']];break;
    default: sign(String(raw.name||'ABUJA').toUpperCase());desks(3,420);seats(2,5,650);anchors.push({x:790,y:930});fallbacks=[['visit','Explore this destination']];
  }
  s.door(s.width/2,'BACK TO THE CITY','exit-venue');venuePoints(s,raw,anchors,fallbacks);return s.finish();
}

function buildVenue(profile,venue,id) {
  const incoming=typeof venue==='string'?{id:venue}:venue||{id:profile.location?.venue};
  const raw={...VENUES.find(v=>v.id===incoming.id),...incoming};
  const key=raw.kind==='club'?'club':raw.type||raw.kind||raw.id||'restaurant';
  const type=['restaurant','hotel','gym','cinema','grocery','park','dealership','estate-office','furniture-store','tech-market','cafe','salon','mosque','church','jabi-lake','club','games-lounge'].find(v=>key===v||String(key).endsWith(`-${v}`)||String(key).startsWith(`${v}-`))||'restaurant';
  const names={restaurant:'The courtyard kitchen',hotel:'Capital House Hotel',gym:'Neighbourhood fitness',cinema:'City cinema',grocery:'Fresh market',park:'The neighbourhood garden',dealership:'Abuja Car','estate-office':'Abuja property studio','furniture-store':'Home & living',cafe:'The Corner Café',salon:'Fresh Studio'};
  const dims={restaurant:[1360,1060],hotel:[1570,1180],gym:[1400,1080],cinema:[1430,1100],grocery:[1400,1080],park:[1560,1150],dealership:[1570,1130],'estate-office':[1390,1050],'furniture-store':[1540,1160],'tech-market':[1650,1220],cafe:[1210,990],salon:[1260,1010],mosque:[1480,1140],church:[1450,1190],'jabi-lake':[1760,1290],club:[1530,1190],'games-lounge':[1410,1100]}[type];
  const s=sceneBase(...dims,id,{floor:type==='gym'?'darkoak':type==='park'?'pave':'tile',name:raw.name||names[type]});s.subtitle=raw.description||raw.subtitle||'Step inside. Make a little time for yourself.';
  const anchors=[];let fallbacks=[];
  if(type==='restaurant') {
    s.window(122,270);s.window(620,260);s.floor(967,144,331,475,'oak');s.wall(952,143,15,270);s.wall(952,537,15,83);
    wallSign(s,430,110,'THE COURTYARD','A LITTLE TASTE OF ABUJA');
    s.object(1006,222,230,80,kitchenArt(230));s.object(967,614,330,88,counterArt(330,88));s.object(1018,407,220,83,kitchenArt(220));
    for(const [x,y] of [[165,263],[513,263],[165,548],[513,548]]){s.rug(x-51,y-52,268,215,'#c5bea0');s.object(x-28,y-31,211,159,group(28,31,tableArt()));}
    s.object(149,828,430,64,sofaArt(430,64,'#8f9c78'));s.plant(805,310,1.2);s.plant(893,791,1);
    anchors.push({x:404,y:393},{x:754,y:677},{x:1133,y:754});fallbacks=[['dine','Order a meal'],['hangout','Share a table'],['coffee','Order a drink']];
    s.label(1022,567,'OPEN KITCHEN');
  } else if(type==='hotel') {
    s.window(170,325);s.window(765,247);s.floor(1165,145,343,386,'bath');s.wall(1148,143,15,402);s.wall(62,552,447);s.wall(658,552,368);s.wall(1162,545,99);s.wall(1389,545,119);
    wallSign(s,533,111,'CAPITAL HOUSE','STAY A LITTLE LONGER');
    bedroom(s,153,231,{w:184,h:225,main:false});s.object(435,231,82,78,chairArt());s.object(761,217,220,75,deskArt(220));bathroom(s,1195,207);
    // Hotel furniture offers venue activities, rather than residents' home actions.
    s.interactables.length=0;s.object(749,703,354,98,counterArt(354,98));s.label(807,838,'RECEPTION');
    lounge(s,174,720,{w:281,color:'#809886'});s.interactables.length=0;
    s.rug(1169,646,286,369,'#c2c7ac');s.object(1208,729,82,78,chairArt());s.object(1341,729,82,78,chairArt());s.plant(1449,1015,1.1);
    anchors.push({x:475,y:460},{x:1250,y:368},{x:1304,y:900});fallbacks=[['check-in','Book a room'],['rest','Rest in your room'],['lounge','Enjoy the lounge']];
  } else if(type==='gym') {
    wallSign(s,503,111,'MOVE WELL','STRENGTH · BREATH · BALANCE');s.window(134,237);s.window(1039,215);
    s.art.push(rect(105,164,508,90,`url(#${id}-glass)`,3)+line(274,165,274,253,'#dee6d3',5)+line(444,165,444,253,'#dee6d3',5));
    [156,343,529].forEach(x=>s.object(x,315,92,158,treadmillArt()));
    s.rug(814,282,385,377,'#809487');for(let i=0;i<3;i++)s.art.push(rect(843+i*114,329,83,219,['#b7c2a0','#ccb68f','#a2b6b0'][i],8)+line(850+i*114,340,918+i*114,340,'#e0dbc0',3));
    s.object(163,647,429,92,rect(0,-47,429,108,'#9b9d84',4)+rect(8,-41,413,47,'#c5c6ac',3)+Array.from({length:8},(_,i)=>group(22+i*51,-17,rect(0,-3,39,7,'#4a5d50',2)+rect(-3,-12,9,25,'#53675b',2)+rect(33,-12,9,25,'#53675b',2))).join(''),{kind:'free-weights'});
    s.object(865,806,322,86,counterArt(322,86));s.plant(725,223,.9);
    s.object(695,554,74,160,rect(8,15,58,110,'#374a45',8)+line(0,17,0,125,'#a6b2a9',7)+line(74,17,74,125,'#a6b2a9',7)+line(-21,3,95,3,'#aebbb3',6)+rect(-25,-14,15,34,'#3b4946',3)+rect(84,-14,15,34,'#3b4946',3)+line(12,130,12,160,'#8fa396',6)+line(63,130,63,160,'#8fa396',6),{kind:'bench-press'});
    anchors.push({x:389,y:528},{x:1008,y:700},{x:373,y:794},{x:1024,y:940});fallbacks=[['workout','Start a workout'],['yoga','Stretch and reset'],['weights','Lift weights']];
  } else if(type==='cinema') {
    s.art.push(rect(70,155,1290,682,'#8e8978'),rect(129,157,1172,128,'#576e66',7),rect(151,175,1128,95,'#dce0c7',5),path('M151 258Q360 209 492 250T852 247T1279 244V270H151Z','#a1b59b'),ellipse(970,205,24,24,'#dfc484'),text(715,226,'ABUJA AFTER HOURS',27,'#587566','text-anchor="middle" letter-spacing="6"'));
    for(let row=0;row<4;row++)for(let col=0;col<12;col++){const x=150+col*82+(col>5?60:0),y=354+row*119;s.object(x,y,61,55,cinemaChair(0,0));}
    s.art.push(rect(668,304,88,525,'#b3a282'),line(682,315,682,820,'#d6c496',3),line(741,315,741,820,'#d6c496',3));
    s.object(106,908,293,69,counterArt(293,69,'#917a63'));s.object(1008,908,298,69,counterArt(298,69,'#917a63'));
    wallSign(s,511,110,'CITY CINEMA','YOUR EVENING, ON THE BIG SCREEN');
    anchors.push({x:714,y:792},{x:429,y:938},{x:970,y:938});fallbacks=[['watch','Watch a film'],['snacks','Pick up popcorn']];
  } else if(type==='grocery') {
    wallSign(s,502,110,'FRESH MARKET','EVERYDAY GOOD THINGS');s.window(136,221);s.window(1060,201);
    for(const [x,y,i] of [[139,300,0],[477,300,1],[812,300,0],[139,584,1],[477,584,0],[812,584,1]])s.object(x,y,205,103,produceArt(205,103,i));
    s.object(1133,200,167,409,rect(0,-30,167,439,'#a6b3a0',7)+rect(9,-19,149,408,`url(#${id}-glass)`,3)+Array.from({length:6},(_,row)=>rect(15,10+row*64,137,8,'#e4dfc6')+Array.from({length:5},(_,col)=>rect(24+col*25,-12+row*64,16,23,['#dbc692','#b4c1a3','#cf9b79'][col%3],3)).join('')).join(''));
    s.object(850,849,404,90,counterArt(404,90));s.object(152,850,205,77,produceArt(205,77));s.label(147,246,'FROM THE MARKET');s.label(901,803,'CHECKOUT');
    anchors.push({x:409,y:462},{x:743,y:744},{x:1054,y:984});fallbacks=[['groceries','Shop for groceries'],['snack','Grab a snack']];
  } else if(type==='park') {
    // The park is a bounded garden scene, with broad continuous walking paths.
    s.art.push(rect(63,145,1434,924,'#aebc94'),rect(646,145,269,924,`url(#${id}-pave)`),rect(64,569,1432,178,`url(#${id}-pave)`),ellipse(780,663,229,158,`url(#${id}-pave)`));
    s.object(699,588,162,146,ellipse(81,78,86,72,'#9fac8e')+ellipse(81,63,82,66,'#e7ddbc')+ellipse(81,61,69,53,`url(#${id}-water)`)+ellipse(81,59,40,29,'#b0c9b2')+path('M74 57V1H87V57Z','#d5d5b9')+ellipse(81,0,31,10,'#eee3bf')+path('M80-4Q38-14 36 23M81-4Q126-11 128 26','none','stroke="#d8ebcc" stroke-width="3" opacity=".8"'));
    for(const [x,y] of [[197,339],[1197,355],[263,899],[1240,944]])s.object(x,y,166,59,gardenBenchArt());
    for(const [x,y] of [[186,257],[400,327],[1104,277],[1373,361],[472,987],[1086,972],[153,937],[1409,536]])s.object(x-12,y-16,24,28,group(12,16,gardenTreeArt(1.15)));
    s.art.push(ellipse(368,446,194,83,'#99b080'),ellipse(1203,478,177,56,'#98ad7f'),ellipse(337,471,135,43,'#b6c698'),ellipse(1207,466,95,40,'#b1c696'));
    for(let i=0;i<22;i++){const x=222+(i*73)%260,y=426+(i*31)%57;s.art.push(ellipse(x,y,5,4,['#d9bd8d','#b58a78','#f0dfb2'][i%3]));}
    wallSign(s,532,111,'A LITTLE GREEN','TAKE YOUR TIME HERE');anchors.push({x:461,y:641},{x:1044,y:653},{x:788,y:870});fallbacks=[['walk','Take a slow walk'],['picnic','Enjoy a picnic'],['relax','Sit in the garden']];
  } else if(type==='dealership') {
    s.window(151,342);s.window(1059,317);wallSign(s,620,111,'ABUJA CAR','YOUR NEXT CHAPTER');
    for(const [x,y,c] of [[187,306,'#ddd6bd'],[696,306,'#789489'],[187,696,'#b89176'],[696,696,'#c0c8b3']]){s.rug(x-28,y-32,300,195,'#bbc7b0');s.object(x,y,245,127,carArt(c));s.art.push(text(x+120,y+174,'ABUJA COLLECTION',10,'#68806a','letter-spacing="2" text-anchor="middle"'));}
    s.object(1190,410,224,89,counterArt(224,89));s.object(1230,730,82,78,chairArt());s.plant(1451,887,1.2);
    anchors.push({x:487,y:447},{x:997,y:447},{x:1300,y:561},{x:977,y:889});fallbacks=[['browse','Explore the collection'],['buy-car','Buy a city compact'],['test-drive','Take a test drive']];
  } else if(type==='tech-market') {
    // An original playable tech arcade. Stacked stock stays on counters and
    // shelves; the two long aisles and three cross aisles remain clear.
    wallSign(s,530,111,'BANEX TECH MARKET','COMPUTERS · REPAIRS · GADGETS');
    s.floor(490,145,140,890,'pave');s.floor(1020,145,100,890,'pave');
    s.art.push(rect(85,163,1480,17,'#b29f79',2));
    const stalls=[
      [110,220,370,145,'tech-laptop-stall','LAPTOPS & SCREENS'],
      [640,225,365,145,'tech-console-stall','CONSOLES & SOUND'],
      [1135,220,360,145,'tech-accessory-stall','CABLES & ACCESSORIES'],
      [110,530,370,145,'tech-repair-bench','REPAIR WORKBENCH'],
      [640,530,365,145,'tech-laptop-stall','WORK & STUDY SETUPS'],
      [1135,530,360,145,'tech-power-stall','POWER & COOLING'],
      [110,840,370,145,'tech-parts-shelf','PARTS & PACKED STOCK'],
      [1135,840,360,145,'tech-console-stall','GAMING CORNER'],
    ];
    for(const[x,y,w,h,kind,label]of stalls){s.object(x,y,w,h,techStallArt(w,h,kind,label),{kind});s.label(x+18,y+h+27,label);}
    s.label(678,1020,'FIND YOUR NEXT SETUP');
    s.pedestrians.push(
      {x:285,y:395,toX:285,toY:395,stationary:true,activity:'social'},
      {x:1320,y:745,toX:1320,toY:745,stationary:true,activity:'social'},
      {x:545,y:425,toX:545,toY:980},
      {x:700,y:1030,toX:1100,toY:1030},
    );
    anchors.push({x:825,y:805},{x:285,y:450},{x:825,y:450},{x:1320,y:795});
  } else if(type==='estate-office') {
    s.window(128,273);s.window(998,230);wallSign(s,490,111,'THE PROPERTY STUDIO','FIND YOUR CORNER OF ABUJA');
    s.object(855,346,347,94,counterArt(347,94));s.object(166,338,222,86,deskArt(222,86));s.object(183,525,82,78,chairArt());s.object(332,525,82,78,chairArt());
    s.rug(791,603,440,216,'#b6baa1');s.object(855,652,267,85,sofaArt(267,85));s.object(544,342,125,56,shelfArt(125));
    for(let i=0;i<3;i++)s.art.push(group(166+i*179,177,rect(0,0,137,85,'#b69d74',2)+rect(6,6,125,73,'#e7dec4')+path('M22 48L66 22L111 48V70H22Z',['#a8b797','#c3b18f','#8da998'][i])+rect(54,46,22,24,'#68846e')+rect(28,50,15,13,'#bfd0b6')+rect(87,50,15,13,'#bfd0b6')));
    s.plant(1295,884,1.2);s.plant(112,855,1);anchors.push({x:1033,y:497},{x:489,y:563},{x:675,y:718});fallbacks=[['browse-properties','Explore homes'],['rent-home','Find a place to rent'],['buy-home','Buy a home']];
  } else if(type==='cafe') {
    s.window(115,278);s.window(852,226);wallSign(s,480,111,'THE CORNER','COFFEE & GOOD COMPANY');
    s.floor(705,145,444,354,'oak');s.object(752,230,306,90,counterArt(306,90));
    s.object(873,175,145,30,rect(0,-42,145,63,'#7b8f7c',5)+rect(8,-34,96,44,'#bdc8b0',3)+rect(19,-26,30,20,'#648578',3)+rect(61,-26,30,20,'#648578',3)+line(31,-2,31,17,'#617c69',5)+line(75,-2,75,17,'#617c69',5)+ellipse(30,17,11,5,'#e7dabb')+ellipse(74,17,11,5,'#e7dabb'));
    s.object(132,289,170,125,tableArt(130,95));s.object(398,289,170,125,tableArt(130,95));
    s.rug(135,577,448,228,'#bbc0a1');s.object(176,613,281,84,sofaArt(281,84,'#ad9372'));s.object(543,617,82,78,chairArt('#99ab8a'));
    s.object(865,622,170,125,tableArt(130,95));s.plant(720,715,1.2);s.plant(1093,829,1);
    s.label(780,445,'SMALL CHOPS · SLOW MOMENTS');anchors.push({x:902,y:378});fallbacks=[['coffee-break','Coffee & small chops']];
  } else if(type==='salon') {
    s.window(115,240);s.window(916,230);wallSign(s,425,111,'FRESH STUDIO','A LITTLE TIME FOR YOU');
    s.floor(81,178,727,409,'darkoak');
    for(const x of [154,383,611]){
      s.object(x,219,150,62,rect(-7,-84,164,139,'#bcaa88',5)+rect(3,-77,144,115,`url(#${id}-glass)`,4)+rect(-11,39,172,27,'#e2d1ab',4)+rect(12,28,13,21,'#b98061',2)+rect(34,22,12,27,'#95a888',2));
      s.object(x+34,406,82,78,chairArt('#7e9b8d'));
    }
    s.object(907,312,166,103,rect(12,-30,145,110,'#879e8b',14)+ellipse(85,-7,82,37,'#e5e7d6')+ellipse(85,-9,65,25,'#aec3b1')+path('M88-23V-61H113','none','stroke="#758e7c" stroke-width="7"')+rect(56,76,57,22,'#647d68',7));
    s.object(159,723,258,82,sofaArt(258,82,'#b49a78'));s.object(865,744,271,83,counterArt(271,83));s.plant(682,764,1.2);
    s.label(277,593,'CUT · CARE · CONFIDENCE');anchors.push({x:459,y:536});fallbacks=[['salon-cut','Grooming & a fresh look']];
  } else if(type==='mosque') {
    s.window(125,260);s.window(1080,235);wallSign(s,537,110,'PEACE & COMMUNITY');
    s.rug(186,234,1100,530,'#809887');
    for(let row=0;row<4;row++)for(let col=0;col<9;col++){
      const x=218+col*118,y=273+row*116;s.art.push(rect(x,y,85,89,'#b8c7af',4)+path(`M${x+12} ${y+69}V${y+30}Q${x+42} ${y+3} ${x+72} ${y+30}V${y+69}`,'none','stroke="#e5e4cd" stroke-width="2"'));
    }
    s.object(629,172,221,50,path('M0 50V-8Q110-128 221-8V50Z','#d7d4bb')+path('M23 50V3Q110-90 198 3V50Z','#9aac94')+rect(88,-11,44,61,'#809783',3),{kind:'prayer-alcove'});
    s.object(111,866,205,61,shelfArt(205,61));s.object(1078,878,221,58,gardenBenchArt(221));s.plant(1338,928,.9);
    s.label(239,817,'PRAYER HALL');s.label(118,984,'SHOE STORAGE');
    s.pedestrians.push({x:349,y:433,toX:349,toY:433,stationary:true,activity:'pray'},{x:1104,y:953,toX:1210,toY:953,activity:'social'});
    anchors.push({x:740,y:795},{x:958,y:968});
  } else if(type==='church') {
    wallSign(s,507,110,'A MOMENT OF PEACE');s.window(123,230);s.window(1080,224);
    s.art.push(rect(528,166,399,167,'#ded4b6',8)+path('M726 167V257M689 197H763','none','stroke="#967c52" stroke-width="9"'));
    s.object(629,277,194,65,counterArt(194,65,'#a78e66'),{kind:'altar'});
    for(let row=0;row<5;row++)for(const x of [155,902])s.object(x,437+row*92,351,42,gardenBenchArt(351),{kind:'pew'});
    s.rug(596,374,260,616,'#b9aa8a');s.object(121,1000,82,65,chairArt());s.plant(1292,1041,1);
    s.pedestrians.push({x:723,y:539,toX:723,toY:539,stationary:true,activity:'pray'},{x:492,y:998,toX:576,toY:998,activity:'social'});
    anchors.push({x:723,y:391},{x:911,y:998});
  } else if(type==='jabi-lake') {
    // The water has a real collision footprint; its promenade stays continuously walkable.
    s.art.push(rect(63,145,1634,1059,'#b5c79b'),rect(92,181,1049,690,`url(#${id}-water)`,80),path('M166 311Q351 282 529 308T962 309M219 439Q409 411 601 437T1031 438M153 601Q341 628 525 604T1028 604M244 761Q462 734 679 758T1052 759','none','class="world-lake-ripple" stroke="#d6e6d4" stroke-width="6"'),rect(1150,168,202,952,`url(#${id}-pave)`,24),rect(83,910,1464,188,`url(#${id}-pave)`,20));
    s.obstacles.push({x:92,y:181,w:1049,h:690});s.objects.push({x:92,y:181,w:1049,h:690,kind:'lake',solid:true});
    s.object(945,716,250,58,rect(0,0,250,58,'#b79b71',3)+Array.from({length:15},(_,i)=>line(i*17,0,i*17,58,'#897e64',2)).join(''),{solid:false,kind:'dock'});
    for(const [x,y,c] of [[315,418,'#e5d9b9'],[782,646,'#8aaba1']])s.object(x,y,164,65,path('M0 32Q40-4 147 10L164 32L147 54Q40 69 0 32Z',c)+path('M27 32Q73 8 133 20V46Q73 57 27 32Z','#6a908d')+rect(79,11,13,42,'#c0a576'),{kind:'boat'});
    for(const [x,y] of [[1415,333],[1415,644],[387,1126]])s.object(x,y,166,58,gardenBenchArt());
    for(const [x,y] of [[1486,260],[1497,870],[125,1157],[1628,1139],[741,1158]])s.object(x-12,y-16,24,28,group(12,16,gardenTreeArt(1.2)));
    s.object(1370,956,168,110,tableArt(168,110),{kind:'picnic-table'});s.label(1201,852,'THE LAKE WALK');
    s.pedestrians.push({x:1247,y:304,toX:1247,toY:809},{x:281,y:1005,toX:1028,toY:1005});
    anchors.push({x:1242,y:861},{x:1448,y:1113});
  } else if(type==='club') {
    const tokyo=raw.id==='club',cage=raw.id==='club-cage',magic=raw.id==='magic-city',bear=raw.id==='bear-barn';
    const title=bear?'BEAR BARN':magic?'MAGIC CITY':cage?'CAGE':'TOKYO';
    const accent=bear?'#8e795c':magic?'#99758f':cage?'#798c98':'#7d8171';
    s.art.push(rect(63,145,1404,964,bear?`url(#${id}-darkoak)`:'#26353a'));
    if(!bear){
      s.art.push(rect(371,393,696,455,accent,18,'opacity=".3"'),rect(395,417,648,8,'#f7d6ff',4,'opacity=".8"'),rect(395,806,648,8,'#a8ecff',4,'opacity=".8"'));
      for(let x=419;x<=1019;x+=120)s.art.push(line(x,430,x,790,x%240===179?'#ff8fd1':'#85dfff',3,'opacity=".45"'));
      for(let y=454;y<=766;y+=78)s.art.push(line(410,y,1028,y,y%156===142?'#ccb0ff':'#ffd58a',3,'opacity=".38"'));
    }
    wallSign(s,485,110,title,bear?'A GOOD EVENING · GOOD COMPANY':magic?'LIVE PERFORMANCE · LOUNGE':cage?'MUSIC · MOVEMENT':'THE LATE LOUNGE');
    if(bear){
      s.floor(63,145,1404,964,'darkoak');s.object(388,244,684,100,counterArt(684,100,'#8d795d'),{kind:'pub-bar'});
      for(const x of [410,594,778,962])s.object(x,404,64,66,chairArt('#967f61'));
      for(const [x,y] of [[199,648],[674,648],[1120,648]])s.object(x,y,185,139,tableArt(137,106));
      s.object(156,930,290,86,sofaArt(290,86,'#957451'));s.object(1080,930,290,86,sofaArt(290,86,'#8b997c'));
      s.pedestrians.push({x:741,y:208,toX:741,toY:208,stationary:true,activity:'social'},{x:537,y:722,toX:537,toY:722,stationary:true,activity:'social'},{x:1012,y:862,toX:1012,toY:862,stationary:true,activity:'social'},{x:823,y:704,toX:823,toY:704,stationary:true,activity:'social'},{x:1164,y:718,toX:1164,toY:718,stationary:true,activity:'dance'},{x:337,y:830,toX:337,toY:830,stationary:true,activity:'social'});
      anchors.push({x:727,y:879},{x:1158,y:438});
    }else{
      s.rug(371,393,696,455,accent);
      if(magic){
        s.object(428,270,650,268,rect(0,0,650,268,'#81667c',17)+rect(12,-20,626,258,'#b68a9d',15),{kind:'performance-stage'});
        s.object(125,643,213,120,tableArt(165,92));s.object(1162,643,213,120,tableArt(165,92));
        s.pedestrians.push({x:575,y:401,toX:575,toY:401,stationary:true,activity:'dance',elevation:36},{x:706,y:392,toX:706,toY:392,stationary:true,activity:'dance',elevation:36},{x:837,y:402,toX:837,toY:402,stationary:true,activity:'dance',elevation:36},{x:959,y:391,toX:959,toY:391,stationary:true,activity:'dance',elevation:36});
      }else{
        s.object(477,221,486,97,counterArt(486,97,tokyo?'#666854':'#4d6064'),{kind:'dj-booth'});
        s.pedestrians.push({x:720,y:220,toX:720,toY:220,stationary:true,activity:'dj'});
        if(cage){s.object(366,355,705,38,rect(0,-85,705,10,'#65737a')+rect(0,-85,10,123,'#89949a')+rect(695,-85,10,123,'#89949a'),{solid:false,kind:'lighting-truss'});}
      }
      for(const x of [355,1104])s.object(x,199,73,135,rect(0,-82,73,210,'#34444a',6)+ellipse(36,-21,23,23,'#566771')+ellipse(36,68,28,28,'#263c42'),{kind:'speaker'});
      s.object(1110,880,264,88,counterArt(264,88));s.object(122,879,270,83,sofaArt(270,83,tokyo?'#b69a72':'#8d7c90'),{kind:tokyo?'premium-sofa':'sofa'});
      if(tokyo){s.object(107,490,230,83,sofaArt(230,83,'#ab9675'),{kind:'premium-sofa'});s.object(1162,490,230,83,sofaArt(230,83,'#ab9675'),{kind:'premium-sofa'});s.label(133,646,'VIP LOUNGE');}
      s.pedestrians.push({x:470,y:730,toX:470,toY:730,stationary:true,activity:'dance'},{x:585,y:635,toX:585,toY:635,stationary:true,activity:'dance'},{x:700,y:748,toX:700,toY:748,stationary:true,activity:'dance'},{x:817,y:622,toX:817,toY:622,stationary:true,activity:'dance'},{x:934,y:733,toX:934,toY:733,stationary:true,activity:'dance'},{x:611,y:822,toX:611,toY:822,stationary:true,activity:'social'},{x:883,y:824,toX:883,toY:824,stationary:true,activity:'social'});
      anchors.push({x:738,y:905},{x:1233,y:1018});
    }
  } else if(type==='games-lounge') {
    s.window(128,265);s.window(1000,260);wallSign(s,446,110,'DICE & CHILL','A GOOD EVENING STARTS HERE');
    for(const [x,y] of [[203,341],[858,341]]){
      s.rug(x-50,y-45,374,277,'#aaa98c');
      s.object(x,y,274,154,rect(0,0,274,154,'#a48960',24)+rect(12,-6,250,144,'#4e786c',22)+rect(24,6,226,121,'none',17,'stroke="#c2bd95" stroke-width="2"')+group(93,45,rect(0,0,29,29,'#f0e6cf',5)+ellipse(8,8,2,2,'#5e6d61')+ellipse(21,21,2,2,'#5e6d61'))+group(150,73,rect(0,0,29,29,'#f0e6cf',5)+ellipse(8,8,2,2,'#5e6d61')+ellipse(21,8,2,2,'#5e6d61')+ellipse(14,15,2,2,'#5e6d61')+ellipse(8,22,2,2,'#5e6d61')+ellipse(21,22,2,2,'#5e6d61')),{kind:'dice-table'});
      s.object(x+94,y+202,82,72,chairArt('#a69370'));
    }
    s.object(173,802,327,83,sofaArt(327,83));s.object(1023,760,251,86,counterArt(251,86));s.plant(758,872,1.1);
    s.pedestrians.push({x:996,y:604,toX:996,toY:604,stationary:true,activity:'dice'});
    s.point('dice',590,460,'Play a round of dice','dice');
    anchors.push({x:595,y:460});
  } else {
    s.window(120,295);s.window(1055,305);wallSign(s,509,111,'OKRIKA MARKETPLACE','GOOD FINDS · REAL LIFE');
    s.rug(116,231,431,340,'#b7c0a0');s.object(159,285,282,86,sofaArt(282,86,'#b18a70'));s.object(222,473,133,67,coffeeArt(133,67));
    s.rug(719,233,391,331,'#c4baa1');s.object(773,297,185,218,bedArt(185,218,'#a1b39a'));s.object(1135,249,142,70,wardrobeArt(142));
    s.object(1203,468,116,56,shelfArt(116));s.object(157,750,82,78,chairArt());s.object(297,750,82,78,chairArt('#9eab8b'));
    s.object(584,731,120,56,shelfArt());s.plant(495,818,1.1);s.plant(781,793,1.05);s.object(1009,895,389,91,counterArt(389,91));
    s.label(155,610,'LIVING');s.label(776,610,'REST');s.label(180,889,'THE READING CORNER');
    anchors.push({x:594,y:465},{x:1019,y:604},{x:445,y:871},{x:1208,y:1040});fallbacks=[['browse-furniture','Explore furniture'],['buy-furniture','Choose something for home']];
  }
  s.door(s.width/2,'BACK TO THE CITY','exit-venue');
  venuePoints(s,raw,anchors,fallbacks);
  return s.finish();
}

export function buildInterior({profile={},venue,id='interior'}={}) {
  const safeId=String(id).replace(/[^a-zA-Z0-9_-]/g,'-');
  const location=profile.location||{};
  if(venue||location.kind==='venue'||(location.venue&&location.venue!=='home'&&location.kind!=='home'))return buildVenue(profile,venue||{id:location.venue},safeId);
  return buildHome(profile,safeId);
}

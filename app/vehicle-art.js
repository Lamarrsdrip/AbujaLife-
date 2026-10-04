import { VEHICLE_COLORS } from '../src/shared/vehicles.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let illustrationId = 0;

export const vehicleColorHex = colorId => VEHICLE_COLORS.find(color => color.id === colorId)?.hex || '#a5afb5';

/** A shared side profile keeps original fallback art proportional to the 3D model. */
function sculptedVehicleIllustration(item,colorId) {
  const id=`vehicle-art-${++illustrationId}`,shape=item.renderShape,d=item.dimensions;
  const paint=VEHICLE_COLORS.find(color=>color.id===colorId)?.hex||item.colour||'#a5afb5',colorName=VEHICLE_COLORS.find(color=>color.id===colorId)?.name||'Custom paint';
  const length=246,height=d.heightMm/d.lengthMm*length,ground=133,X=x=>150+x*length,Y=y=>ground-y*height;
  const point=([x,y])=>`${X(x).toFixed(2)} ${Y(y).toFixed(2)}`;
  function line(points,close=false,smooth=false){
    if(!smooth)return`M${points.map(point).join('L')}${close?'Z':''}`;
    let path=`M${point(points[0])}`;
    for(let i=0;i<points.length-1;i++){const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];const one=[b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6],two=[c[0]-(d[0]-b[0])/6,c[1]-(d[1]-b[1])/6];path+=`C${point(one)} ${point(two)} ${point(c)}`;}
    return path+(close?'Z':'');
  }
  const outline=sections=>line([...sections.map(s=>[s[0],s[1]]),...sections.slice().reverse().map(s=>[s[0],s[2]])],true,!shape.angular);
  const radius=height*shape.wheelRadius,frontAxle=shape.frontAxle,rearAxle=frontAxle-d.wheelbaseMm/d.lengthMm;
  const archRadius=radius*1.08;
  const samples=[...shape.body.map(s=>s[0]),...[rearAxle,frontAxle].flatMap(x=>[-1,-.72,-.4,0,.4,.72,1].map(n=>x+n*archRadius/length))].filter(x=>x>=-.5&&x<=.5).sort((a,b)=>a-b);
  const bodySections=[...new Set(samples)].map(x=>{let i=0;while(i<shape.body.length-2&&x>shape.body[i+1][0])i++;const a=shape.body[i],b=shape.body[i+1],t=(x-a[0])/(b[0]-a[0]);let top=a[1]+(b[1]-a[1])*t;for(const axle of[rearAxle,frontAxle]){const dx=(x-axle)*length;if(Math.abs(dx)<archRadius)top=Math.max(top,(radius+Math.sqrt(archRadius*archRadius-dx*dx)+1.6)/height);}return[x,top,a[2]+(b[2]-a[2])*t];});
  const body=outline(bodySections),glass=outline(shape.cabin);
  const wheel=x=>`<g transform="translate(${X(x).toFixed(2)} ${(ground-radius).toFixed(2)})"><circle r="${radius.toFixed(2)}" fill="url(#${id}-tire)" stroke="#111b23" stroke-width="2.2"/><circle r="${(radius*.66).toFixed(2)}" fill="#bbc5cb"/><circle r="${(radius*.55).toFixed(2)}" fill="#263841"/>${Array.from({length:shape.spokes*2},(_,i)=>`<path d="M-1.1 ${-radius*.53}H1.1L2 -2H-2Z" fill="#d7e0e3" transform="rotate(${i*180/shape.spokes})"/>`).join('')}<circle r="2.6" fill="#a6b5bd"/><circle r="${(radius*.85).toFixed(2)}" fill="none" stroke="#52616a" stroke-width=".7"/></g>`;
  const path=(points,stroke,width=1.3,smooth=false)=>`<path d="${line(points,false,smooth)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  let details='';
  if(shape.vents==='c-curve')details+=`<path d="M${point([.12,.86])}C${point([-.20,1.04])} ${point([-.38,.77])} ${point([-.32,.44])}S${point([-.09,.21])} ${point([.14,.24])}" fill="none" stroke="#d0dadd" stroke-width="2.3"/><path d="${line([[-.30,.45],[-.12,.47],[-.23,.29]],true)}" fill="#1c2e39"/>`;
  else if(shape.vents==='mid-engine'||shape.vents==='triangular')details+=`<path d="${line([[-.25,.51],[-.08,.47],[-.21,.25]],true)}" fill="#1a2c35" stroke="#60707a" stroke-width=".8"/>`;
  else if(shape.vents==='front-fender')for(let i=0;i<3;i++)details+=path([[.23-i*.015,.41],[.22-i*.015,.31]],'#22363f',1.2);
  else if(shape.vents==='rear-engine')for(let i=0;i<7;i++)details+=path([[-.37+i*.013,.57],[-.37+i*.013,.62]],'#20353c',1.1);
  if(shape.intake==='horseshoe')details+=`<path d="M${X(.498)} ${Y(.23)}V${Y(.35)}Q${X(.51)} ${Y(.43)} ${X(.522)} ${Y(.35)}V${Y(.23)}" fill="#203440" stroke="#c2d0d4" stroke-width="1.7"/>`;
  else if(shape.intake==='hexagonal')details+=`<path d="${line([[.43,.24],[.445,.36],[.52,.35],[.55,.24],[.43,.24]],true)}" fill="#1d2f39"/>`;
  else details+=path([[.45,.29],[.54,.29]],'#20353d',4.5);
  if(item.modelStyle==='911')details+=`<ellipse cx="${X(.425)}" cy="${Y(.455)}" rx="5" ry="4.5" fill="#f0f4e5" stroke="#97a9b2" stroke-width="1.2"/><ellipse cx="${X(.425)+1.5}" cy="${Y(.455)-1}" rx="1.6" ry="2.6" fill="#fff" opacity=".7"/>`;
  else if(['huracan','urus'].includes(item.modelStyle))details+=path([[.43,.44],[.48,.40],[.515,.43]],'#eff7e9',2)+path([[.48,.40],[.515,.365]],'#eff7e9',2);
  else if(item.modelStyle==='chiron')for(let i=0;i<4;i++)details+=`<rect x="${X(.44)+i*3.4}" y="${Y(.455)}" width="2.3" height="2.9" rx=".5" fill="#f1f7ed"/>`;
  else details+=path([[.44,item.modelStyle==='roma'?.40:.405],[.515,item.modelStyle==='roma'?.385:.40]],'#f2f7e7',2.8);
  if(shape.rear==='four-square')details+=`<rect x="${X(-.505)}" y="${Y(.46)}" width="3.8" height="4.8" rx="1" fill="#dc5658"/><rect x="${X(-.484)}" y="${Y(.46)}" width="3.8" height="4.8" rx="1" fill="#dc5658"/>`;
  else if(shape.rear==='twin-round')details+=`<ellipse cx="${X(-.5)}" cy="${Y(.42)}" rx="3.6" ry="4.2" fill="#d45452" stroke="#843c43" stroke-width="1"/>`;
  else details+=path([[-.515,.43],[-.47,.43]],'#d85554',2);
  if(['sf90','huracan','chiron'].includes(item.modelStyle))details+=path([[-.46,.67],[-.35,.67]],paint,3)+path([[-.405,.61],[-.405,.66]],'#253a44',1.5);
  const cabin=shape.cabin,first=cabin[0],second=cabin[1],last=cabin.at(-1),beforeLast=cabin.at(-2);
  const arches=[rearAxle,frontAxle].map(x=>`<path d="M${X(x)-radius*1.06} ${ground-radius}A${radius*1.08} ${radius*1.08} 0 0 1 ${X(x)+radius*1.06} ${ground-radius}" fill="none" stroke="#223641" stroke-width="2.6"/>`).join('');
  return `<svg class="vehicle-illustration ph-product-illustration" viewBox="0 0 300 160" role="img" aria-label="${esc(item.name)} in ${esc(colorName)}" data-vehicle-body="${esc(item.bodyStyle)}" data-vehicle-model="${esc(item.modelStyle)}" data-vehicle-color="${esc(colorId||'')}"><defs><linearGradient id="${id}-paint" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#fff" stop-opacity=".45"/><stop offset=".24" stop-color="${paint}"/><stop offset=".66" stop-color="${paint}"/><stop offset="1" stop-color="#112331"/></linearGradient><linearGradient id="${id}-glass" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#557583"/><stop offset=".55" stop-color="#263e4d"/><stop offset="1" stop-color="#152c38"/></linearGradient><radialGradient id="${id}-tire"><stop stop-color="#3c4a51"/><stop offset=".82" stop-color="#1d2a33"/><stop offset="1" stop-color="#0d1820"/></radialGradient></defs><ellipse cx="150" cy="138" rx="127" ry="6" fill="#183c44" opacity=".13"/><path d="${body}" fill="${paint}" stroke="#233a46" stroke-width="1.1"/><path d="${body}" fill="url(#${id}-paint)"/><path d="${glass}" fill="url(#${id}-glass)" stroke="#374f5d" stroke-width="1.2"/>${path([[first[0],first[1]],[second[0],second[1]]],paint,2.4)}${path([[beforeLast[0],beforeLast[1]],[last[0],last[1]]],paint,2.4)}${path(shape.roof.map(([x,y])=>[x,y]),paint,2.7,!shape.angular)}${path([[second[0]+.025,second[1]-.07],[beforeLast[0]-.025,beforeLast[1]-.065]],'#b7d0d8',1.1,true)}<path d="${line([[-.17,.48],[.15,.44],[.14,.26],[-.18,.26]])}" fill="none" stroke="#263f4c" stroke-opacity=".46" stroke-width=".8"/>${path([[-.06,.42],[.005,.42]],'#d0dce0',1.7)}${path([[-.24,.23],[.23,.23]],'#172d37',2)}<path d="${line([[beforeLast[0]+.035,.64],[beforeLast[0]+.09,.615],[beforeLast[0]+.08,.57],[beforeLast[0]+.025,.59]],true)}" fill="${paint}" stroke="#384e5b" stroke-width=".8"/>${details}${arches}${wheel(rearAxle)}${wheel(frontAxle)}</svg>`;
}

/** Original showroom artwork. Model names describe game vehicles, never licensed brand artwork. */
export function vehicleIllustration(item = {}, colorId = item.defaultColor) {
  if(item.renderShape&&item.dimensions)return sculptedVehicleIllustration(item,colorId);
  const id = `vehicle-art-${++illustrationId}`;
  const paint = VEHICLE_COLORS.find(color => color.id === colorId)?.hex || item.colour || '#a5afb5';
  const colorName = VEHICLE_COLORS.find(color => color.id === colorId)?.name || 'Custom paint';
  const style = item.bodyStyle || (item.id?.includes('suv') ? 'suv' : item.id?.includes('hatchback') ? 'hatchback' : 'sedan');
  const boxy = ['offroad','gwagon'].includes(style), suv = style === 'suv', hatch = style === 'hatchback';
  const modern = Number(item.year || 2024) >= 2020;
  const mercedes = /mercedes/i.test(item.brand || item.name || ''), bmw = /bmw/i.test(item.brand || item.name || '');
  const wheelY = boxy || suv ? 109 : 111, wheelR = boxy || suv ? 20 : 18;
  const front = boxy ? 222 : 232, rear = 69;
  const outline = boxy
    ? 'M43 102V53q0-9 9-9h114q7 0 12 7l18 27h38q12 0 17 10l6 11v21H44Z'
    : suv
      ? 'M34 105 43 76 78 70l25-29h71q11 0 18 11l19 25 29 9q14 5 19 16v19H34Z'
      : hatch
        ? 'M36 105 46 78l28-8 29-30h47q13 0 24 13l20 23 45 12q17 4 22 17v17H34Z'
        : 'M28 106q5-16 21-20l29-7 34-31q7-6 19-6h41q10 0 18 8l29 29 38 9q12 4 15 17v16H28Z';
  const glass = boxy
    ? '<path d="M53 52h51v30H53Zm58 0h48l20 30h-68Z"/><path d="M57 57h43v4H57Zm58 0h42l4 5h-46Z" class="vehicle-glass-shine"/>'
    : suv
      ? '<path d="m61 77 23-28h29v29Zm59-29h48l20 30h-68Zm75 9 14 20h-14Z"/><path d="m86 52 21 0-18 23H67Zm39 0h39l4 6h-43Z" class="vehicle-glass-shine"/>'
      : hatch
        ? '<path d="m82 76 25-28h25v29Zm57-28h9q10 0 17 9l16 20h-42Z"/><path d="m110 51 15 0-18 23H89Zm35 0h7l9 7h-16Z" class="vehicle-glass-shine"/>'
        : '<path d="m86 77 29-27h27v28Zm63-27h22q7 0 13 7l21 21h-56Z"/><path d="m119 53 17 0-21 22H96Zm35 0h16l6 5h-22Z" class="vehicle-glass-shine"/>';
  const wheel = x => `<g transform="translate(${x} ${wheelY})"><circle r="${wheelR+3}" fill="#172329"/><circle r="${wheelR}" fill="url(#${id}-tire)"/><circle r="${wheelR-6}" fill="#9da8ad"/><circle r="${wheelR-8}" fill="#34444c"/>${Array.from({length:5},(_,i)=>`<path d="m-2-10 4 0 1 7-3 3-3-3Z" fill="#d7dce0" transform="rotate(${i*72})"/>`).join('')}<circle r="3" fill="#dbe1e1"/><circle r="${wheelR-1}" fill="none" stroke="#46535a" stroke-width="1"/></g>`;
  const grille = mercedes
    ? '<path d="M247 94h15v15h-15Z" fill="#18262b"/><path d="M250 96v11m4-11v11m4-11v11" stroke="#cad3d4" stroke-width="1.3"/>'
    : bmw
      ? '<path d="M247 95h6v12h-6Zm8 0h6v12h-6Z" fill="#17242c" stroke="#aebfc3" stroke-width="1"/>'
      : '<path d="M247 97h15v10h-15Z" fill="#27383d"/><path d="M249 100h11m-11 3h11" stroke="#9ab0b6" stroke-width="1"/>';
  return `<svg class="vehicle-illustration ph-product-illustration" viewBox="0 0 300 160" role="img" aria-label="${esc(item.name || 'Vehicle')} in ${esc(colorName)}" data-vehicle-body="${esc(style)}" data-vehicle-color="${esc(colorId || '')}"><defs><linearGradient id="${id}-paint" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#fff" stop-opacity=".42"/><stop offset=".34" stop-color="${paint}"/><stop offset=".75" stop-color="${paint}"/><stop offset="1" stop-color="#081b25" stop-opacity=".65"/></linearGradient><linearGradient id="${id}-glass" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#526d7b"/><stop offset="1" stop-color="#172b36"/></linearGradient><radialGradient id="${id}-tire"><stop stop-color="#3c474c"/><stop offset="1" stop-color="#0f171c"/></radialGradient></defs><ellipse cx="149" cy="136" rx="127" ry="8" fill="#183c44" opacity=".12"/><path d="${outline}" fill="${paint}" stroke="#172c35" stroke-opacity=".4" stroke-width="1.5"/><path d="${outline}" fill="url(#${id}-paint)"/><g fill="url(#${id}-glass)" stroke="#3f525b" stroke-width="2">${glass}</g><g fill="none" stroke="#29404b" stroke-opacity=".5" stroke-width="1"><path d="M${boxy?107:hatch?135:146} 82v31m${boxy?70:hatch?51:64}-31v31M46 91l194 1M41 118h217"/><path d="M91 97h18m49 0h15" stroke="#e3e9e9" stroke-width="2.6" stroke-linecap="round"/></g><path d="M187 78h14q6 0 6 5v6h-19Z" fill="${paint}" stroke="#52636b" stroke-width="1"/><path d="M191 80h13" stroke="#ffffff" opacity=".45"/><path d="m${modern?236:233} 89 24 4-2 6h-19Z" fill="#eff5de" stroke="#afbac0" stroke-width="1"/><path d="M${modern?242:241} 93h14" stroke="#fff" stroke-width="2"/><path d="M33 96h11v9H31Z" fill="#923e3d"/><path d="M31 98h10" stroke="#ef8c78" stroke-width="2"/>${grille}<path d="M252 112h13v5h-13Z" fill="#0b2027"/><path d="M128 121h57" stroke="#c0ced0" stroke-width="2" opacity=".6"/>${boxy?'<path d="M45 49V39h121v6M72 88v26M108 85v29M177 87v27" fill="none" stroke="#1d303a" stroke-width="2"/><path d="M38 55h7v39h-7Z" fill="#203138"/><circle cx="43" cy="79" r="15" fill="#1d2b32" stroke="#46555c" stroke-width="3"/>':suv?'<path d="M104 38h67" stroke="#4c5a60" stroke-width="3"/><path d="M111 37v-5m51 5v-5" stroke="#4c5a60" stroke-width="2"/>':''}${wheel(rear)}${wheel(front)}<style>.vehicle-glass-shine{fill:#c0d4d9;opacity:.28;stroke:none}</style></svg>`;
}

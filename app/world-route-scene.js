import {routeForJourney,parkingAnchorFor} from '../src/shared/abuja-navigation.mjs';
import {cityLandmark} from '../src/shared/city-landmarks.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=text=>{let value=2166136261;for(const c of String(text||'')){value^=c.charCodeAt(0);value=Math.imul(value,16777619);}return value>>>0;};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function roadsideBlock({point,index,width,height,seed,nodeId}){
 const landmark=cityLandmark(nodeId),side=index%2?-1:1,blockW=landmark?300:170+((seed+index*31)%80),blockH=landmark?210:120+((seed+index*17)%55),x=clamp(point.x+side*(landmark?300:220)-blockW/2,28,width-blockW-28),y=clamp(point.y+(index%3-1)*105-blockH/2,28,height-blockH-28),floors=landmark?4:2+((seed+index)%3),name=landmark?.short||point.name||String(nodeId||'').replace(/^district:/,'').replaceAll('-',' ');
 const facade=Array.from({length:floors},(_,floor)=>Array.from({length:Math.max(2,Math.floor(blockW/54))},(_,col)=>`<rect x="${(x+16+col*48).toFixed(0)}" y="${(y+18+floor*40).toFixed(0)}" width="27" height="20" rx="3" fill="${landmark?'#83a7a1':'#91aaa0'}" opacity=".92"/>`).join('')).join('');
 return{building:{id:`route-${nodeId||index}`,name,x,y:y+blockH,w:blockW,h:blockH,frontY:false,floors},art:`<g data-route-building="${esc(nodeId||String(index))}"><ellipse cx="${(x+blockW/2+13).toFixed(0)}" cy="${(y+blockH+16).toFixed(0)}" rx="${(blockW*.58).toFixed(0)}" ry="22" fill="#183b3023"/><rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${blockW.toFixed(0)}" height="${blockH.toFixed(0)}" rx="${landmark?12:7}" fill="${landmark?'#ded5bc':'#d1c8ae'}" stroke="#64766c" stroke-width="3"/>${facade}<rect x="${(x+blockW*.38).toFixed(0)}" y="${(y+blockH-47).toFixed(0)}" width="${(blockW*.24).toFixed(0)}" height="47" rx="4" fill="#3d625a"/>${landmark?`<rect x="${(x+15).toFixed(0)}" y="${(y+12).toFixed(0)}" width="${(blockW-30).toFixed(0)}" height="34" rx="17" fill="#315d50"/><text x="${(x+blockW/2).toFixed(0)}" y="${(y+35).toFixed(0)}" text-anchor="middle" fill="#f4e8c5" font-size="15" font-weight="800">${esc(name.slice(0,30).toUpperCase())}</text>`:''}</g>`};
}

/**
 * A streamed journey corridor cut from the same navigation graph as the full
 * Abuja overview. It is route-specific, but it now keeps recognisable Abuja
 * streets, buildings, traffic and street furniture around the car instead of
 * replacing the city with an empty road ribbon.
 */
export function buildRouteScene({profile={},place={},trip=profile.activeTrip,id='journey'}={}){
 const route=routeForJourney({
  fromDistrict:profile.district||place.id,
  fromVenue:profile.location?.kind==='venue'?profile.location?.venue:null,
  toDistrict:trip?.destination,
  toVenue:trip?.venueId,
  returningHome:trip?.returningHome===true,
  homeDistrict:profile.home?.district||trip?.destination
 });
 const source=route?.points?.length>=2?route.points:[{id:`district:${profile.district||'central-area'}`,x:0,y:0,name:place.name||'Abuja'},{id:trip?.venueId||`district:${trip?.destination||'central-area'}`,x:900,y:0,name:trip?.destination||'Destination'}];
 const minX=Math.min(...source.map(p=>p.x)),maxX=Math.max(...source.map(p=>p.x)),minY=Math.min(...source.map(p=>p.y)),maxY=Math.max(...source.map(p=>p.y));
 const margin=520,shift={x:margin-minX,y:margin-minY},routePoints=source.map(point=>({...point,x:point.x+shift.x,y:point.y+shift.y}));
 const width=Math.max(1900,maxX-minX+margin*2),height=Math.max(1350,maxY-minY+margin*2),seed=hash(trip?.id||id);
 const routeD=routePoints.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
 const trees=Array.from({length:Math.min(52,14+routePoints.length*5)},(_,i)=>{const point=routePoints[i%routePoints.length],angle=((seed+i*137)%360)*Math.PI/180,spread=155+((seed>>i%16)+i*31)%210,x=clamp(point.x+Math.cos(angle)*spread,45,width-45),y=clamp(point.y+Math.sin(angle)*spread,45,height-45);return `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><ellipse rx="25" ry="9" fill="#173d3020"/><rect x="-3" y="-31" width="6" height="31" rx="3" fill="#8b6e4e"/><circle cy="-38" r="20" fill="${i%3?'#5f865d':'#769467'}"/></g>`;}).join('');
 const roadside=routePoints.map((point,index)=>roadsideBlock({point,index,width,height,seed,nodeId:route?.nodeIds?.[index]||point.id})),buildings=roadside.map(row=>row.building),buildingArt=roadside.map(row=>row.art).join('');
 const labels=routePoints.map((point,i)=>{if(i!==0&&i!==routePoints.length-1&&i%2)return '';const text=point.name||String(point.id||'').replace(/^district:/,'').replaceAll('-',' ');return `<g transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})"><circle r="12" fill="#f0d895" stroke="#3d5b53" stroke-width="4"/><rect x="-88" y="-64" width="176" height="34" rx="17" fill="#f6f0df" stroke="#d9cba9"/><text y="-42" text-anchor="middle" font-size="16" font-weight="700" fill="#29483f">${esc(text.slice(0,28))}</text></g>`;}).join('');
 const traffic=Array.from({length:Math.min(10,Math.max(4,routePoints.length+2))},(_,i)=>{const point=routePoints[i%routePoints.length],next=routePoints[Math.min(routePoints.length-1,(i%routePoints.length)+1)],horizontal=Math.abs((next?.x??point.x)-point.x)>=Math.abs((next?.y??point.y)-point.y);return{axis:horizontal?'x':'y',lane:horizontal?clamp(point.y+(i%2?28:-28),60,height-60):clamp(point.x+(i%2?28:-28),60,width-60),offset:(seed+i*317)%(horizontal?width:height),speed:(i%2?-1:1)*(24+(i*7)%19),color:['#d9d7cf','#52716b','#9b6a5f','#c3a75f','#334c58'][i%5],type:i%7===0?'bus':i%5===0?'taxi':'sedan'};});
 const objects=routePoints.flatMap((point,i)=>[-1,1].map((side,j)=>({kind:'plant',x:clamp(point.x+side*115-18,12,width-48),y:clamp(point.y+(i%2?68:-68)+j*20-18,12,height-48),w:36,h:36,routeStreetObject:true})));
 const pedestrians=routePoints.slice(0,8).map((point,i)=>({x:clamp(point.x-80,30,width-30),y:clamp(point.y+95,30,height-30),toX:clamp(point.x+80,30,width-30),toY:clamp(point.y+95,30,height-30),role:i%3===0?'Resident':'',stationary:false}));
 const destination=routePoints.at(-1),start=routePoints[0],parking=parkingAnchorFor({districtId:trip?.destination,venueId:trip?.venueId});
 return {
  id:`${id}-route`,title:trip?.returningHome?'Driving home':trip?.venueId?'Driving through Abuja':'Across Abuja',width,height,
  art:`<defs><linearGradient id="${id}-land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9dbb86"/><stop offset="1" stop-color="#789a70"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#${id}-land)"/>${buildingArt}<path d="${routeD}" fill="none" stroke="#c7d0c1" stroke-width="100" stroke-linecap="round" stroke-linejoin="round"/><path d="${routeD}" fill="none" stroke="#43565b" stroke-width="72" stroke-linecap="round" stroke-linejoin="round"/><path d="${routeD}" fill="none" stroke="#eadba8" stroke-width="3" stroke-dasharray="20 18" stroke-linecap="round"/>${trees}${labels}`,
  obstacles:[],interactables:[],pedestrians,traffic,buildings,objects,
  spawn:{x:start.x,y:start.y},routePoints,routeNodeIds:route?.nodeIds||[],routeDistance:route?.distance||Math.hypot(destination.x-start.x,destination.y-start.y),
  arrival:{x:destination.x,y:destination.y,angle:parking.angle},parkingAnchor:parking
 };
}

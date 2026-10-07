export const PLOT_IDS = Object.freeze(Array.from({ length: 40 }, (_, index) => `plot-${String(index + 1).padStart(2, '0')}`));
export const BILLBOARD_IDS = Object.freeze(Array.from({ length: 10 }, (_, index) => `billboard-${String(index + 1).padStart(2, '0')}`));
export const ALL_SPACES = Object.freeze([
  ...PLOT_IDS.map((id, index) => ({ id, kind: 'plot', row: Math.floor(index / 8), column: index % 8 })),
  ...BILLBOARD_IDS.map((id, index) => ({ id, kind: 'billboard', roadIndex: index })),
]);

export const AD_TIERS = Object.freeze({
  standard: Object.freeze({ id:'standard', label:'Standard', multiplier:1, footprint:'1x1' }),
  featured: Object.freeze({ id:'featured', label:'Featured', multiplier:1.75, footprint:'2x1' }),
  premium: Object.freeze({ id:'premium', label:'Premium', multiplier:3, footprint:'2x2' }),
  landmark: Object.freeze({ id:'landmark', label:'Landmark', multiplier:6, footprint:'4x2' }),
});
export const AD_ZONES = Object.freeze([
  Object.freeze({id:'sky-displays',name:'Sky-blue surrounds',subtitle:'Floating displays around the Abuja map',region:'surrounds',x:-40000,y:-40000,width:80000,height:80000,tier:'standard',seed:107}),
  Object.freeze({id:'city-frontage',name:'Across Abuja',subtitle:'City display placements throughout the map',region:'city',x:-7000,y:-5000,width:14000,height:10000,tier:'standard',seed:97}),
  Object.freeze({ id:'capital-brand-coast', name:'Capital Brand Coast', subtitle:'High-visibility displays beside Abuja', region:'north', x:-2400, y:-1200, width:2600, height:1800, tier:'premium', seed:11 }),
  Object.freeze({ id:'business-bay', name:'Business Bay', subtitle:'Professional services and commerce', region:'east', x:1200, y:-1200, width:3000, height:1800, tier:'featured', seed:23 }),
  Object.freeze({ id:'event-strip', name:'Event Strip', subtitle:'Launches, culture and nightlife', region:'south', x:-2400, y:1100, width:2600, height:1800, tier:'standard', seed:37 }),
  Object.freeze({ id:'creator-coast', name:'Creator Coast', subtitle:'Creators, fashion and local brands', region:'west', x:1200, y:1100, width:3000, height:1800, tier:'standard', seed:41 }),
  Object.freeze({ id:'prime-abuja-displays', name:'Prime Abuja Displays', subtitle:'Limited landmark frontage', region:'ring', x:-500, y:-2600, width:1000, height:600, tier:'landmark', seed:53 }),
  Object.freeze({ id:'property-district', name:'Property District', subtitle:'Homes, land and interiors', region:'south-east', x:4400, y:50, width:2200, height:1400, tier:'featured', seed:61 }),
  Object.freeze({ id:'automotive-zone', name:'Automotive Zone', subtitle:'Cars, mobility and transport', region:'south-west', x:-6600, y:50, width:2200, height:1400, tier:'featured', seed:71 }),
  Object.freeze({ id:'abuja-creator-zone', name:'Abuja Creator Zone', subtitle:'Community campaigns and events', region:'outer', x:-1000, y:3200, width:2200, height:1200, tier:'standard', seed:83 }),
]);
const dynamicPlot = (zone,row,column) => `ad:${zone.id}:${row}:${column}`;
export const dynamicPlotParts = id => /^ad:([a-z0-9-]+):(\d+):(\d+)$/.exec(String(id||''));
export const zoneFor = id => AD_ZONES.find(zone=>zone.id===id) || null;
const contains=(zone,x,y)=>x>=zone.x&&y>=zone.y&&x<zone.x+zone.width&&y<zone.y+zone.height;
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const boundsFor=(zone,row,column)=>({x:zone.x+column*120+18,y:zone.y+row*100+18,width:96,height:70});
// Existing district inventory keeps its coordinates and IDs. The broader city
// and surrounds fill the gaps; they must not sell a second copy of those cells.
const allowed=(zone,box)=>zone.id==='sky-displays'?!overlaps(box,zoneFor('city-frontage')):zone.id==='city-frontage'?!AD_ZONES.slice(2).some(other=>overlaps(box,other)):true;
export function adZonePageCount(zoneId,limit=96){const z=zoneFor(zoneId);return z?Math.ceil(Math.floor(z.width/120)*Math.floor(z.height/100)/limit):0;}
export function adZoneSpaces(zoneId,{page=0,limit=96}={}) {
  const zone=zoneFor(zoneId); if(!zone)return [];
  const safePage=Math.max(0,Math.floor(Number(page)||0)),safeLimit=Math.min(180,Math.max(12,Math.floor(Number(limit)||96)));
  const cols=Math.max(1,Math.floor(zone.width/120)),rows=Math.max(1,Math.floor(zone.height/100));
  const start=safePage*safeLimit,end=Math.min(rows*cols,start+safeLimit),spaces=[];
  for(let index=start;index<end;index++) { const row=Math.floor(index/cols),column=index%cols,box=boundsFor(zone,row,column);if(!allowed(zone,box))continue; const tier=(row+column)%17===0?'landmark':(row+column)%7===0?'premium':zone.tier; spaces.push({id:dynamicPlot(zone,row,column),kind:'plot',zoneId:zone.id,zone:zone.name,tier,row,column,...box,available:true}); }
  return spaces;
}
export function adSpaceFromId(id){
 const legacy=ALL_SPACES.find(space=>space.id===id);if(legacy)return {...legacy};
 const parts=dynamicPlotParts(id),zone=parts&&zoneFor(parts[1]);if(!zone)return null;
 const row=Number(parts[2]),column=Number(parts[3]),cols=Math.floor(zone.width/120),rows=Math.floor(zone.height/100);
 if(!Number.isSafeInteger(row)||!Number.isSafeInteger(column)||row<0||column<0||row>=rows||column>=cols)return null;
 return adZoneSpaces(zone.id,{page:Math.floor((row*cols+column)/96),limit:96}).find(space=>space.id===id)||null;
}
export function adSpaceAt(x,y,zoneId='city-frontage'){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 if(zoneId==='city-frontage'){const district=AD_ZONES.slice(2).find(zone=>contains(zone,x,y));if(district)zoneId=district.id;}
 let zone=zoneFor(zoneId);if(!zone||x<zone.x||y<zone.y||x>=zone.x+zone.width||y>=zone.y+zone.height){if(zoneId==='city-frontage')return adSpaceAt(x,y,'sky-displays');return null;}
 const row=Math.floor((y-zone.y)/100),column=Math.floor((x-zone.x)/120),space=adSpaceFromId(dynamicPlot(zone,row,column));if(space)return space;
 // Zone borders can intersect a grid cell. Choose the nearest valid neighbour
 // without minting another ID for the same advertising surface.
 const candidates=[];for(let r=row-2;r<=row+2;r++)for(let c=column-2;c<=column+2;c++){const candidate=adSpaceFromId(dynamicPlot(zone,r,c));if(candidate)candidates.push(candidate);}
 return candidates.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||null;
}
export function adSpacePage(id,limit=96){const space=adSpaceFromId(id),zone=space&&zoneFor(space.zoneId);return zone?Math.floor((space.row*Math.floor(zone.width/120)+space.column)/limit):0;}

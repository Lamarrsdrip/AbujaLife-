import { ABUJA_ATLAS } from '../src/shared/atlas.mjs';
import { SETTLEMENT_POINTS, MAP_ATTRIBUTION } from '../src/shared/geography-sources.mjs';

const TILE_SIZE=256;
const CACHE_KEY='abujalife.osm-places.v1';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const safeCoordinate=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180;
const project=(p,z)=>{const n=TILE_SIZE*2**z;const sin=Math.sin(clamp(p.lat,-85,85)*Math.PI/180);return {x:(p.lon+180)/360*n,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*n};};
const unproject=(p,z)=>{const n=TILE_SIZE*2**z;return {lon:p.x/n*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*p.y/n)))*180/Math.PI};};
const element=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
const normalize=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const currentId=p=>p?.district||p?.location?.id||p?.location;

/** Render source-backed OSM tiles and location selection. Call cleanup before removing the host.
 * onSelect receives the atlas record; onTravel receives its id and is allowed to return a Promise.
 * Source points are location reference points, never a claim about player GPS or legal boundaries.
 */
export function renderMap(container,{atlas=ABUJA_ATLAS,profile={},onTravel,onSelect}={}){
  if(!document.querySelector('link[data-abuja-map-styles]')){
    const link=element('link');link.rel='stylesheet';link.href=new URL('./map.css',import.meta.url).href;link.dataset.abujaMapStyles='';document.head.append(link);
  }
  let disposed=false,zoom=12,center={...SETTLEMENT_POINTS.abuja.coordinates},selectedId=currentId(profile),filter='',frame=0,tilesLoaded=0,tilesFailed=0,travelBusy=false,travelError='';
  const positions=new Map(),requests=new Map(),attempted=new Set(),listeners=[],tiles=new Map();
  for(const place of atlas){if(safeCoordinate(place.coordinates)&&place.coordinateSource?.id)positions.set(place.id,{coordinates:place.coordinates,source:place.coordinateSource});}
  try{const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');for(const [id,p] of Object.entries(cached))if(atlas.some(a=>a.id===id)&&safeCoordinate(p.coordinates)&&p.source?.id==='openstreetmap'&&Number.isInteger(p.source.osmId)&&['node','way','relation'].includes(p.source.osmType))positions.set(id,p);}catch{}
  if(positions.has(selectedId))center={...positions.get(selectedId).coordinates};
  const root=element('section','abuja-map');root.setAttribute('aria-label','Abuja and FCT map');
  const viewport=element('div','abuja-map-viewport');viewport.tabIndex=0;viewport.setAttribute('role','application');viewport.setAttribute('aria-label','Street map. Drag to pan. Use plus and minus to zoom, or arrow keys to move.');
  const tileLayer=element('div','abuja-map-tiles'),markerLayer=element('div','abuja-map-markers');
  const controls=element('div','abuja-map-controls');
  const control=(label,text)=>{const b=element('button','abuja-map-control',text);b.type='button';b.setAttribute('aria-label',label);b.title=label;controls.append(b);return b;};
  const zoomIn=control('Zoom in','+'),zoomOut=control('Zoom out','−'),recenter=control('Show my area','⌖');
  const compass=element('div','abuja-map-compass','N');compass.setAttribute('aria-label','North is up');
  const sourceState=element('div','abuja-map-source-state');sourceState.setAttribute('role','status');
  const sourceMessage=element('p','','Loading Abuja streets…'),retry=element('button','abuja-map-retry','Try map again');retry.type='button';retry.hidden=true;sourceState.append(sourceMessage,retry);
  const attribution=element('div','abuja-map-attribution');
  for(const {label,url} of MAP_ATTRIBUTION){const a=element('a','',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';attribution.append(a,document.createTextNode(' '));}
  viewport.append(tileLayer,markerLayer,controls,compass,sourceState,attribution);
  const panel=element('div','abuja-map-panel'),searchBox=element('div','abuja-map-search');
  const input=element('input');input.type='search';input.placeholder='Search Abuja & FCT';input.setAttribute('aria-label','Find a district or town');searchBox.append(input);
  const list=element('div','abuja-map-place-list');list.setAttribute('aria-label','Locations');
  const selected=element('div','abuja-map-selected');
  panel.append(searchBox,list,selected);root.append(viewport,panel);container.replaceChildren(root);
  const listen=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);listeners.push(()=>target.removeEventListener(type,fn,opts));};
  const selectedPlace=()=>atlas.find(a=>a.id===selectedId);
  const description=p=>{const kind=p.kind==='town'?'Town / community':p.kind==='fcc-sector'?'Sector centre':'City area';return `${kind} · ${positions.has(p.id)?'sourced map pin':'location catalogue'}`;};
  function updateSourceState(){
    if(disposed)return;
    tilesLoaded=[...tiles.values()].filter(tile=>tile.dataset.state==='loaded').length;
    tilesFailed=[...tiles.values()].filter(tile=>tile.dataset.state==='failed').length;
    tileLayer.style.visibility=tilesLoaded?'visible':'hidden';
    sourceState.hidden=tilesLoaded>0;
    retry.hidden=tilesFailed===0;
    sourceMessage.textContent=tilesFailed?'Street map unavailable. You can still choose a destination.':'Loading Abuja streets…';
    markerLayer.hidden=!tilesLoaded;
  }
  function updateList(){
    const matchRank=p=>{const name=normalize(p.name);return name===filter?0:name.startsWith(filter)?1:name.includes(filter)?2:3;};
    const result=atlas.filter(p=>!filter||normalize(`${p.name} ${p.vibe||''} ${p.council||''}`).includes(filter));
    if(filter)result.sort((a,b)=>matchRank(a)-matchRank(b));
    const fragment=document.createDocumentFragment();
    const shown=filter?result.slice(0,30):result.filter(p=>positions.has(p.id)||p.id===selectedId).slice(0,12);
    for(const p of shown){const b=element('button','abuja-map-place');b.type='button';b.classList.toggle('is-selected',p.id===selectedId);const name=element('strong','',p.name),detail=element('small','',description(p));b.append(name,detail);b.setAttribute('aria-pressed',String(p.id===selectedId));b.addEventListener('click',()=>selectPlace(p));fragment.append(b);}
    if(!shown.length)fragment.append(element('p','abuja-map-empty',filter?'No places match that search.':'Search for a district or town.'));
    list.replaceChildren(fragment);
    const p=selectedPlace();selected.replaceChildren();
    if(p){const info=element('div','abuja-map-selected-info');info.append(element('strong','',p.name),element('small','',p.id===currentId(profile)?'Your current area':description(p)));if(!positions.has(p.id))info.append(element('small','abuja-map-pin-note','No precise map pin available yet.'));if(travelError){const error=element('small','abuja-map-pin-note',travelError);error.setAttribute('role','alert');info.append(error);}const b=element('button','abuja-map-travel',travelBusy?'Opening ride…':'Plan a journey');b.type='button';b.disabled=travelBusy||typeof onTravel!=='function'||p.id===currentId(profile);if(p.id===currentId(profile))b.textContent='You are here';b.addEventListener('click',async()=>{if(travelBusy||typeof onTravel!=='function')return;travelBusy=true;travelError='';updateList();try{await onTravel(p.id);}catch{travelError='Journey could not open. Try again.';}finally{if(!disposed){travelBusy=false;updateList();}}});selected.append(info,b);}
    else selected.append(element('p','abuja-map-empty','Choose somewhere to go.'));
  }
  function savePosition(id,position){positions.set(id,position);try{const cached={};for(const [key,value]of positions)if(value.source?.id==='openstreetmap')cached[key]=value;localStorage.setItem(CACHE_KEY,JSON.stringify(cached));}catch{}}
  async function locatePlace(place){
    if(!place||positions.has(place.id)||attempted.has(place.id)||disposed)return;
    attempted.add(place.id);
    const aliases=[place.name.replace(/\s+Town$/i,'')];if(place.id.startsWith('wuse-ii'))aliases.push('Wuse 2');if(place.id==='wuse-i')aliases.push('Wuse');if(place.id==='garki-i')aliases.push('Garki');
    const regex=aliases.map(a=>a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    // Search envelope around a source-backed Abuja settlement point; this is not a boundary.
    const focus=SETTLEMENT_POINTS.abuja.coordinates,box=[focus.lat-.3,focus.lon-.6,focus.lat+.35,focus.lon+.35].join(',');
    const query=`[out:json][timeout:12];nwr["place"]["name"~"^(${regex})$",i](${box});out center tags;`;
    const abort=new AbortController();requests.set(place.id,abort);const timeout=setTimeout(()=>abort.abort(),15000);
    try{
      const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`data=${encodeURIComponent(query)}`,signal:abort.signal});
      if(!response.ok)throw new Error('Place source unavailable');
      const data=await response.json();if(disposed)return;
      const matches=(data.elements||[]).filter(e=>aliases.some(a=>normalize(a)===normalize(e.tags?.name))&&e.tags?.place&&['node','way','relation'].includes(e.type)&&Number.isInteger(e.id)&&safeCoordinate({lat:e.lat??e.center?.lat,lon:e.lon??e.center?.lon}));
      // Ambiguous exact-name results must not become an arbitrary district pin.
      if(matches.length!==1)return;
      const e=matches[0],position={coordinates:{lat:e.lat??e.center.lat,lon:e.lon??e.center.lon},source:{id:'openstreetmap',osmType:e.type,osmId:e.id,url:`https://www.openstreetmap.org/${e.type}/${e.id}`,accessedAt:new Date().toISOString(),recordType:'named-place',name:e.tags.name}};
      savePosition(place.id,position);if(selectedId===place.id){center={...position.coordinates};zoom=13;}updateList();schedule();
    }catch{/* A failed source lookup leaves the point unknown; do not invent one. */}
    finally{clearTimeout(timeout);if(requests.get(place.id)===abort)requests.delete(place.id);}
  }
  function selectPlace(p){selectedId=p.id;travelError='';const position=positions.get(p.id);if(position){center={...position.coordinates};zoom=p.kind==='town'?12:14;}updateList();schedule();if(typeof onSelect==='function')onSelect(p);void locatePlace(p);}
  function renderMarkers(w,h,origin){
    const fragment=document.createDocumentFragment();
    const known=[{id:'__abuja-city',name:'Abuja',kind:'city-reference',coordinates:SETTLEMENT_POINTS.abuja.coordinates},...atlas.filter(p=>positions.has(p.id)).map(p=>({...p,coordinates:positions.get(p.id).coordinates}))];
    const seen=new Set();
    for(const p of known){const point=project(p.coordinates,zoom),x=point.x-origin.x+w/2,y=point.y-origin.y+h/2;if(x<0||x>w||y<0||y>h)continue;const key=`${p.coordinates.lat},${p.coordinates.lon}`;if(seen.has(key))continue;seen.add(key);const marker=element('button','abuja-map-marker');marker.type='button';marker.style.transform=`translate(${Math.round(x-7)}px,${Math.round(y-19)}px)`;marker.classList.toggle('is-selected',p.id===selectedId);marker.classList.toggle('is-current',p.id===currentId(profile));marker.setAttribute('aria-label',p.kind==='city-reference'?'Abuja city reference point':p.name);marker.title=p.name;marker.append(element('span','abuja-map-pin'),element('span','abuja-map-marker-label',p.name));marker.addEventListener('click',()=>{const place=atlas.find(a=>a.id===p.id);if(place)selectPlace(place);else{center={...p.coordinates};zoom=12;schedule();}});fragment.append(marker);}
    markerLayer.replaceChildren(fragment);
  }
  function render(){
    if(disposed)return;
    frame=0;const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;
    const origin=project(center,zoom),left=origin.x-w/2,top=origin.y-h/2,n=2**zoom,visible=new Set();
    for(let tx=Math.floor(left/TILE_SIZE);tx<=Math.floor((left+w)/TILE_SIZE);tx++)for(let ty=Math.floor(top/TILE_SIZE);ty<=Math.floor((top+h)/TILE_SIZE);ty++){
      if(ty<0||ty>=n)continue;const x=((tx%n)+n)%n,key=`${zoom}/${x}/${ty}`;visible.add(key);let tile=tiles.get(key);
      if(!tile){tile=element('img','abuja-map-tile');tile.alt='';tile.setAttribute('aria-hidden','true');tile.draggable=false;tile.decoding='async';tile.onload=()=>{if(disposed)return;tile.dataset.state='loaded';updateSourceState();};tile.onerror=()=>{if(disposed)return;tile.dataset.state='failed';tile.style.opacity='0';updateSourceState();};tile.src=`https://tile.openstreetmap.org/${key}.png`;tiles.set(key,tile);tileLayer.append(tile);}
      tile.style.transform=`translate(${Math.round(tx*TILE_SIZE-left)}px,${Math.round(ty*TILE_SIZE-top)}px)`;
    }
    for(const [key,tile] of tiles)if(!visible.has(key)){tile.onload=null;tile.onerror=null;tile.remove();tiles.delete(key);}
    renderMarkers(w,h,origin);zoomOut.disabled=zoom<=7;zoomIn.disabled=zoom>=17;updateSourceState();
  }
  function schedule(){if(!frame&&!disposed)frame=requestAnimationFrame(render);}
  function changeZoom(delta,screenPoint){const next=clamp(zoom+delta,7,17);if(next===zoom)return;if(screenPoint){const w=viewport.clientWidth,h=viewport.clientHeight,old=project(center,zoom),under=unproject({x:old.x+screenPoint.x-w/2,y:old.y+screenPoint.y-h/2},zoom),now=project(under,next);center=unproject({x:now.x-screenPoint.x+w/2,y:now.y-screenPoint.y+h/2},next);}zoom=next;schedule();}
  listen(zoomIn,'click',()=>changeZoom(1));listen(zoomOut,'click',()=>changeZoom(-1));listen(recenter,'click',()=>{const p=atlas.find(a=>a.id===currentId(profile));if(p)selectPlace(p);else{center={...SETTLEMENT_POINTS.abuja.coordinates};zoom=12;schedule();}});
  listen(input,'input',()=>{filter=normalize(input.value);updateList();});
  listen(retry,'click',()=>{for(const tile of tiles.values()){tile.onload=null;tile.onerror=null;tile.remove();}tiles.clear();tilesLoaded=0;tilesFailed=0;for(const request of requests.values())request.abort();requests.clear();attempted.clear();sourceMessage.textContent='Loading Abuja streets…';retry.hidden=true;schedule();void locatePlace(selectedPlace());});
  const pointers=new Map();let drag=null,pinchDistance=0;
  listen(viewport,'pointerdown',e=>{if(e.target.closest('button,a'))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);if(pointers.size===1)drag={x:e.clientX,y:e.clientY,origin:project(center,zoom)};if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);drag=null;}});
  listen(viewport,'pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(Math.abs(d-pinchDistance)>45){const rect=viewport.getBoundingClientRect();changeZoom(d>pinchDistance?1:-1,{x:(p[0].x+p[1].x)/2-rect.left,y:(p[0].y+p[1].y)/2-rect.top});pinchDistance=d;}}else if(drag){center=unproject({x:drag.origin.x-(e.clientX-drag.x),y:drag.origin.y-(e.clientY-drag.y)},zoom);schedule();}});
  const endPointer=e=>{pointers.delete(e.pointerId);drag=null;pinchDistance=0;};listen(viewport,'pointerup',endPointer);listen(viewport,'pointercancel',endPointer);
  listen(viewport,'wheel',e=>{e.preventDefault();const rect=viewport.getBoundingClientRect();changeZoom(e.deltaY<0?1:-1,{x:e.clientX-rect.left,y:e.clientY-rect.top});},{passive:false});
  listen(viewport,'keydown',e=>{if(e.target!==viewport)return;if(['+','=','-','_'].includes(e.key)){e.preventDefault();changeZoom(['+','='].includes(e.key)?1:-1);return;}const offset={ArrowLeft:[-100,0],ArrowRight:[100,0],ArrowUp:[0,-100],ArrowDown:[0,100]}[e.key];if(offset){e.preventDefault();const p=project(center,zoom);center=unproject({x:p.x+offset[0],y:p.y+offset[1]},zoom);schedule();}});
  const observer=new ResizeObserver(schedule);observer.observe(viewport);updateList();schedule();void locatePlace(selectedPlace());
  return ()=>{if(disposed)return;disposed=true;observer.disconnect();if(frame)cancelAnimationFrame(frame);for(const off of listeners)off();for(const request of requests.values())request.abort();for(const tile of tiles.values()){tile.onload=null;tile.onerror=null;}root.remove();};
}

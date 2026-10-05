import { apiFetch, createApiEventSource } from './api-client.js';

const residents=new Map();
let refreshTimer=null,lastRefresh=0,worldStream=null,currentWorld=null,clubMenu=null,statsPopover=null,residentCard=null,refreshing=false;
const money=value=>'₦'+new Intl.NumberFormat('en-NG',{maximumFractionDigits:0}).format(Number(value)||0);
const compact=value=>new Intl.NumberFormat('en-NG',{notation:'compact',maximumFractionDigits:1}).format(Math.max(0,Number(value)||0));
const date=value=>new Intl.DateTimeFormat('en-NG',{dateStyle:'medium',timeZone:'Africa/Lagos'}).format(new Date(value||Date.now()));
const requestKey=()=>globalThis.crypto?.randomUUID?.()||`live-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CLUBS=new Set(['Tokyo','Cage','Magic City','Bear Barn']);
const MAX_REAL_RESIDENTS=50;
const MAX_LOD_RESIDENTS=38;
const APPEARANCE={
  skinTone:{deep:'#694632',brown:'#a06c4b',warm:'#c69069',light:'#ddb28d'},
  top:{ochre:'#bc7848',forest:'#406b57',cream:'#e9e0ca',navy:'#374957',agbada:'#c9ad77'},
  bottom:{charcoal:'#3c4247',denim:'#526a80',cream:'#d7cbbb'},
};

async function json(path,options={}){
  const response=await apiFetch(path,options);const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload.ok===false)throw Object.assign(new Error(payload.error||'Please try again.'),{status:response.status,code:payload.code});
  return payload;
}
function toast(message){const node=document.querySelector('#toast');if(!node)return;node.textContent=message;node.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('visible'),2600);}
function activeWorld(){return document.querySelector('.world-canvas.world-playable:not(.world-preview)');}
function isClub(world){return world&&CLUBS.has(world.dataset.sceneName||'');}
function validPose(pose){return pose&&Number.isFinite(pose.x)&&Number.isFinite(pose.y)&&Number.isFinite(pose.angle)&&pose.x>=0&&pose.y>=0&&pose.x<=20000&&pose.y<=20000;}
function playerPosition(world){return{x:Number(world?.dataset.playerX)||0,y:Number(world?.dataset.playerY)||0};}
function residentDistance(world,resident){const p=playerPosition(world);return validPose(resident.pose)?Math.hypot(resident.pose.x-p.x,resident.pose.y-p.y):Infinity;}
function appearanceColor(resident,kind,fallback){return APPEARANCE[kind]?.[resident?.appearance?.[kind]]||fallback;}

function labelResident(node,resident){
  if(!resident?.username)return;
  const label=node.querySelector('.online-resident-label'),text=label?.querySelector('text'),rect=label?.querySelector('rect');if(!text)return;
  const value=`@${resident.username}`.slice(0,22);text.textContent=value;node.setAttribute('aria-label',`${value} — live resident`);
  node.dataset.presenceState=resident.pose?.moving?'moving':resident.pose?.activity||'online';
  if(rect){const width=Math.max(76,Math.min(150,34+value.length*5.6));rect.setAttribute('x',String(-width/2));rect.setAttribute('width',String(width));}
}
function lodMarkup(resident){
  const skin=appearanceColor(resident,'skinTone','#a06c4b'),top=appearanceColor(resident,'top','#406b57'),bottom=appearanceColor(resident,'bottom','#3c4247'),username=`@${resident.username||'resident'}`.slice(0,22),width=Math.max(78,Math.min(152,34+username.length*5.6));
  return `<ellipse class="live-lod-shadow" cx="0" cy="2" rx="16" ry="6"/><g class="live-lod-body"><path d="M-9-28H-1L-3-6H-12Z" fill="${bottom}"/><path d="M1-28H10L12-6H3Z" fill="${bottom}"/><path d="M-10-53Q0-58 10-53L14-31Q0-25-14-31Z" fill="${top}"/><path d="M-10-49Q-18-42-17-30M10-49Q18-42 17-30" fill="none" stroke="${skin}" stroke-width="6" stroke-linecap="round"/><circle cy="-65" r="12" fill="${skin}"/><path d="M-11-68Q-8-81 1-80Q13-79 12-66Q3-72-10-67Z" fill="#302b26"/></g><g class="online-resident-label"><rect x="${-width/2}" y="-98" width="${width}" height="20" rx="10"/><circle cx="${-width/2+11}" cy="-88" r="3"/><text x="4" y="-84" text-anchor="middle">${esc(username)}</text></g><rect x="-28" y="-102" width="56" height="108" fill="transparent"/>`;
}
function ensureLodResident(world,resident){
  const layer=world.querySelector('.world-online');if(!layer||!validPose(resident.pose))return null;
  let node=layer.querySelector(`[data-world-live-resident="${CSS.escape(String(resident.id))}"]`);
  if(!node){node=document.createElementNS('http://www.w3.org/2000/svg','g');node.classList.add('world-live-lod');node.dataset.worldLiveResident=String(resident.id);node.setAttribute('role','button');node.setAttribute('tabindex','0');node.innerHTML=lodMarkup(resident);layer.append(node);}
  node.dataset.presenceState=resident.pose.moving?'moving':resident.pose.activity||'online';node.setAttribute('aria-label',`@${resident.username||'resident'} — live resident`);node.setAttribute('transform',`translate(${resident.pose.x} ${resident.pose.y})`);return node;
}
function syncResidentLayer(world=activeWorld()){
  if(!world)return;
  const layer=world.querySelector('.world-online');if(!layer)return;
  const highDetail=new Set();
  for(const node of layer.querySelectorAll('[data-world-resident]')){const id=String(node.dataset.worldResident);highDetail.add(id);const resident=residents.get(id);if(resident){labelResident(node,resident);if(validPose(resident.pose))node.setAttribute('transform',`translate(${resident.pose.x} ${resident.pose.y})`);}}
  const visible=[...residents.values()].filter(r=>validPose(r.pose)).sort((a,b)=>residentDistance(world,a)-residentDistance(world,b)).slice(0,MAX_REAL_RESIDENTS);
  const desired=new Set();let extras=0;
  for(const resident of visible){const id=String(resident.id);if(highDetail.has(id))continue;if(extras>=MAX_LOD_RESIDENTS)break;desired.add(id);ensureLodResident(world,resident);extras++;}
  for(const node of layer.querySelectorAll('[data-world-live-resident]'))if(!desired.has(String(node.dataset.worldLiveResident)))node.remove();
  world.dataset.realResidentsVisible=String(highDetail.size+desired.size);
}
function updatePose(data){
  const id=String(data?.residentId||''),pose=data?.pose;if(!id||!validPose(pose))return;
  const resident=residents.get(id);if(!resident){scheduleNearby(80);return;}
  resident.pose={...resident.pose,...pose};residents.set(id,resident);
  const world=activeWorld();if(!world)return;
  const node=world.querySelector(`[data-world-resident="${CSS.escape(id)}"],[data-world-live-resident="${CSS.escape(id)}"]`);if(node){node.dataset.presenceState=pose.moving?'moving':pose.activity||'online';node.setAttribute('transform',`translate(${pose.x} ${pose.y})`);}else syncResidentLayer(world);
}

function closeStatsPopover(){statsPopover?.remove();statsPopover=null;}
function showStats(world,stats){
  if(!world||!stats)return;
  let dock=world.querySelector('.world-live-stats');
  if(!dock){
    dock=document.createElement('button');dock.type='button';dock.className='world-live-stats';dock.innerHTML='<strong><i></i><span data-city-online>0 online</span></strong><span data-city-here>0 here</span><span data-city-visits>0 visits today</span>';world.append(dock);world.dataset.livingStats='1';
    dock.addEventListener('click',event=>{event.stopPropagation();if(statsPopover){closeStatsPopover();return;}const latest=dock.cityStats||{};statsPopover=document.createElement('div');statsPopover.className='world-live-popover';statsPopover.innerHTML=`<small>ABUJA LIVE</small><div><span>Online now</span><strong>${compact(latest.onlineNow)}</strong></div><div><span>Here with you</span><strong>${compact(latest.hereNow)}</strong></div><div><span>Residents</span><strong>${compact(latest.totalPlayers)}</strong></div><div><span>Visits today</span><strong>${compact(latest.visitsToday)}</strong></div><div><span>Recorded visits</span><strong>${compact(latest.visitsAllTime)}</strong></div><p>Online means active presence right now. Visit tracking started ${date(latest.trackingSince)}.</p>`;dock.after(statsPopover);});
  }
  dock.cityStats=stats;dock.querySelector('[data-city-online]').textContent=`${compact(stats.onlineNow)} online`;dock.querySelector('[data-city-here]').textContent=`${compact(stats.hereNow)} here`;dock.querySelector('[data-city-visits]').textContent=`${compact(stats.visitsToday)} visits today`;dock.setAttribute('aria-label',`${stats.onlineNow||0} residents online now. ${stats.hereNow||0} in this area. ${stats.visitsToday||0} city visits today. Open live city details.`);if(statsPopover)closeStatsPopover();
}
async function refreshNearby({force=false}={}){
  const world=activeWorld();if(!world||document.hidden||refreshing)return;
  const now=Date.now();if(!force&&now-lastRefresh<2500)return;refreshing=true;
  try{const result=await json('/api/presence/nearby');lastRefresh=Date.now();const present=new Set();for(const resident of result.nearby||[]){const id=String(resident.id);present.add(id);residents.set(id,resident);}for(const id of residents.keys())if(!present.has(id))residents.delete(id);syncResidentLayer(world);showStats(world,result.stats);}
  catch(error){if(![404,405,501,401].includes(error.status))console.warn('AbujaLife nearby presence refresh failed',error.code||error.message);}
  finally{refreshing=false;}
}
function scheduleNearby(delay=100){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refreshNearby(),delay);}

function closeResidentCard(){residentCard?.remove();residentCard=null;}
function openResidentCard(resident){
  const world=activeWorld();if(!world||!resident)return;closeResidentCard();const username=`@${resident.username||'resident'}`;
  residentCard=document.createElement('div');residentCard.className='world-resident-actions';residentCard.setAttribute('role','dialog');residentCard.setAttribute('aria-label',`Interact with ${username}`);
  residentCard.innerHTML=`<button class="world-resident-close" type="button" aria-label="Close">×</button><div><span class="world-resident-dot"></span><strong>${esc(resident.displayName||resident.username||'Resident')}</strong><small>${esc(username)} · here now</small></div><nav><button type="button" data-live-action="wave">Wave</button><button type="button" data-live-action="message">Message</button><button type="button" data-live-action="friend">Add friend</button><button type="button" data-live-action="visit">Visit</button></nav>`;
  world.append(residentCard);residentCard.querySelector('.world-resident-close').onclick=closeResidentCard;
  const act=async(action,button)=>{button.disabled=true;try{
    if(action==='wave'){await json('/api/presence/emote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({emote:'wave'})});showEmote({residentId:'self',emote:'wave'});toast(`You waved to ${username}.`);}
    if(action==='friend'){await json('/api/friends/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({residentId:resident.id})});toast(`Friend request sent to ${username}.`);}
    if(action==='message'){await json('/api/conversations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({residentId:resident.id})});toast(`Conversation with ${username} is ready in Messages.`);}
    if(action==='visit'){await json('/api/home/visits/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ownerId:resident.id,note:'Can I come through?',idempotencyKey:requestKey()})});toast(`Visit request sent to ${username}.`);}
    if(action!=='wave')closeResidentCard();
  }catch(error){toast(error.message);}finally{button.disabled=false;}};
  residentCard.querySelectorAll('[data-live-action]').forEach(button=>button.onclick=event=>{event.stopPropagation();void act(button.dataset.liveAction,button);});
}
function showEmote(data){
  const world=activeWorld();if(!world)return;const id=String(data?.residentId||''),anchor=id==='self'?world.querySelector('[data-world-player]'):world.querySelector(`[data-world-resident="${CSS.escape(id)}"],[data-world-live-resident="${CSS.escape(id)}"]`);if(!anchor)return;
  const worldBox=world.getBoundingClientRect(),box=anchor.getBoundingClientRect(),node=document.createElement('div');node.className='world-player-emote';node.textContent=data.emote==='cheer'?'🙌':'👋';node.style.left=`${Math.max(22,Math.min(worldBox.width-22,box.left+box.width/2-worldBox.left))}px`;node.style.top=`${Math.max(68,Math.min(worldBox.height-110,box.top-worldBox.top+8))}px`;node.setAttribute('aria-hidden','true');world.append(node);setTimeout(()=>node.remove(),1450);
}

function startWorldAudio(world){if(world.dataset.livingAudioBound==='1')return;world.dataset.livingAudioBound='1';world.addEventListener('pointerdown',()=>{const button=world.querySelector('.world-sound-toggle');if(button&&!button.disabled&&button.getAttribute('aria-pressed')!=='true')button.click();},{once:true,capture:true});}
function burst(data){
  const world=activeWorld();if(!world||!isClub(world))return;let anchor=world.querySelector(`[data-world-resident="${CSS.escape(String(data.residentId||''))}"],[data-world-live-resident="${CSS.escape(String(data.residentId||''))}"]`);if(!anchor)anchor=world.querySelector('[data-world-player]');const worldBox=world.getBoundingClientRect(),box=anchor?.getBoundingClientRect?.()||worldBox,x=box.left+box.width/2-worldBox.left,y=box.top+Math.min(box.height*.45,110)-worldBox.top;const layer=document.createElement('div');layer.className='club-money-burst';layer.style.left=`${Math.max(30,Math.min(worldBox.width-30,x))}px`;layer.style.top=`${Math.max(80,Math.min(worldBox.height-120,y))}px`;layer.setAttribute('aria-hidden','true');const symbols=['₦','₦','💸','₦','₦','💸','₦','₦','₦','💸','₦','₦'];layer.innerHTML=symbols.map((symbol,index)=>`<i style="--i:${index};--x:${((index*47)%120)-60}px;--r:${((index*37)%70)-35}deg">${symbol}</i>`).join('');world.append(layer);setTimeout(()=>layer.remove(),1800);if(data.username)toast(`@${data.username} sprayed ${money(data.amount)} at ${data.venueName||'the club'}`);
}
function closeWorldStream(){worldStream?.close();worldStream=null;}
function openWorldStream(){
  if(worldStream||!activeWorld())return;
  try{worldStream=createApiEventSource('/api/realtime');worldStream.addEventListener('world-pose',event=>{try{updatePose(JSON.parse(event.data));}catch{}});worldStream.addEventListener('presence',()=>scheduleNearby(70));worldStream.addEventListener('player-emote',event=>{try{showEmote(JSON.parse(event.data));}catch{}});worldStream.addEventListener('club-spray',event=>{try{burst(JSON.parse(event.data));}catch{}});worldStream.addEventListener('ready',()=>void refreshNearby({force:true}));}
  catch{worldStream=null;}
}
function clubDock(world){
  if(!isClub(world)){world?.querySelector('.club-life-dock')?.remove();clubMenu?.remove();clubMenu=null;return;}
  if(world.querySelector('.club-life-dock'))return;
  const dock=document.createElement('div');dock.className='club-life-dock';dock.innerHTML='<button type="button" class="club-spray-button" aria-expanded="false"><span>₦</span> Spray</button>';world.append(dock);const button=dock.querySelector('button');
  button.onclick=event=>{event.stopPropagation();if(clubMenu){clubMenu.remove();clubMenu=null;button.setAttribute('aria-expanded','false');return;}clubMenu=document.createElement('div');clubMenu.className='club-spray-menu';clubMenu.innerHTML=`<small>SPRAY GAME NAIRA</small>${[1000,5000,10000,50000].map(amount=>`<button type="button" data-spray="${amount}">${money(amount)}</button>`).join('')}`;dock.append(clubMenu);button.setAttribute('aria-expanded','true');clubMenu.querySelectorAll('[data-spray]').forEach(choice=>choice.onclick=async e=>{e.stopPropagation();if(choice.disabled)return;const amount=Number(choice.dataset.spray);clubMenu.querySelectorAll('button').forEach(item=>item.disabled=true);try{const result=await json('/api/club/spray',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount,idempotencyKey:requestKey()})});burst(result.clubSpray||{residentId:result.profile?.id,username:result.profile?.username,amount,venueName:world.dataset.sceneName});const wallet=document.querySelector('.wallet-button strong');if(wallet&&result.profile)wallet.textContent=money(result.profile.wallet);clubMenu?.remove();clubMenu=null;button.setAttribute('aria-expanded','false');}catch(error){toast(error.message);clubMenu?.querySelectorAll('button').forEach(item=>item.disabled=false);}});};
}
function syncWorld(){
  const world=activeWorld();if(world!==currentWorld){closeWorldStream();closeStatsPopover();closeResidentCard();clubMenu?.remove();clubMenu=null;currentWorld=world;if(world){startWorldAudio(world);openWorldStream();void refreshNearby({force:true});}}
  if(world){syncResidentLayer(world);clubDock(world);}
}

const observer=new MutationObserver(()=>{syncWorld();scheduleNearby(180);});observer.observe(document.body,{childList:true,subtree:true});
addEventListener('focus',()=>{syncWorld();openWorldStream();void refreshNearby({force:true});});
addEventListener('visibilitychange',()=>{if(document.hidden){closeWorldStream();closeStatsPopover();closeResidentCard();return;}syncWorld();openWorldStream();void refreshNearby({force:true});});
addEventListener('pointerdown',event=>{const live=event.target.closest?.('[data-world-live-resident]');if(live){event.preventDefault();event.stopPropagation();const resident=residents.get(String(live.dataset.worldLiveResident));if(resident)openResidentCard(resident);return;}if(statsPopover&&!event.target.closest?.('.world-live-stats')&&!event.target.closest?.('.world-live-popover'))closeStatsPopover();if(residentCard&&!event.target.closest?.('.world-resident-actions'))closeResidentCard();},{capture:true});
addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const live=event.target.closest?.('[data-world-live-resident]');if(!live)return;event.preventDefault();const resident=residents.get(String(live.dataset.worldLiveResident));if(resident)openResidentCard(resident);});
setInterval(()=>{if(activeWorld()&&!document.hidden)void refreshNearby();},5000);
syncWorld();

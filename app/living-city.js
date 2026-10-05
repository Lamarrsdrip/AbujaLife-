import { apiFetch, createApiEventSource } from './api-client.js';

const residents=new Map();
let refreshTimer=null,lastRefresh=0,clubStream=null,currentWorld=null,clubMenu=null,statsPopover=null,refreshing=false;
const money=value=>'₦'+new Intl.NumberFormat('en-NG',{maximumFractionDigits:0}).format(Number(value)||0);
const compact=value=>new Intl.NumberFormat('en-NG',{notation:'compact',maximumFractionDigits:1}).format(Math.max(0,Number(value)||0));
const date=value=>new Intl.DateTimeFormat('en-NG',{dateStyle:'medium',timeZone:'Africa/Lagos'}).format(new Date(value||Date.now()));
const requestKey=()=>globalThis.crypto?.randomUUID?.()||`club-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const CLUBS=new Set(['Tokyo','Cage','Magic City','Bear Barn']);

async function json(path,options={}){
  const response=await apiFetch(path,options);const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload.ok===false)throw Object.assign(new Error(payload.error||'Please try again.'),{status:response.status,code:payload.code});
  return payload;
}
function toast(message){const node=document.querySelector('#toast');if(!node)return;node.textContent=message;node.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('visible'),2600);}
function activeWorld(){return document.querySelector('.world-canvas.world-playable:not(.world-preview)');}
function isClub(world){return world&&CLUBS.has(world.dataset.sceneName||'');}

function labelResident(node,resident){
  if(!resident?.username)return;
  const label=node.querySelector('.online-resident-label'),text=label?.querySelector('text'),rect=label?.querySelector('rect');if(!text)return;
  const value=`@${resident.username}`.slice(0,22);text.textContent=value;node.setAttribute('aria-label',`${value} — online resident`);
  node.dataset.presenceState=resident.pose?.moving?'moving':resident.pose?.activity||'online';
  if(rect){const width=Math.max(76,Math.min(150,34+value.length*5.6));rect.setAttribute('x',String(-width/2));rect.setAttribute('width',String(width));}
}
function decorateResidents(){
  const world=activeWorld();if(!world)return;
  world.querySelectorAll('[data-world-resident]').forEach(node=>{const resident=residents.get(String(node.dataset.worldResident));if(resident)labelResident(node,resident);});
}
function closeStatsPopover(){statsPopover?.remove();statsPopover=null;}
function showStats(world,stats){
  if(!world||!stats)return;
  let dock=world.querySelector('.world-live-stats');
  if(!dock){
    dock=document.createElement('button');dock.type='button';dock.className='world-live-stats';dock.innerHTML='<strong><i></i><span data-city-online>0 online</span></strong><span data-city-here>0 here</span><span data-city-visits>0 visits today</span>';world.append(dock);world.dataset.livingStats='1';
    dock.addEventListener('click',event=>{
      event.stopPropagation();
      if(statsPopover){closeStatsPopover();return;}
      const latest=dock.cityStats||{};statsPopover=document.createElement('div');statsPopover.className='world-live-popover';
      statsPopover.innerHTML=`<small>ABUJA LIVE</small><div><span>Online now</span><strong>${compact(latest.onlineNow)}</strong></div><div><span>Here with you</span><strong>${compact(latest.hereNow)}</strong></div><div><span>Residents</span><strong>${compact(latest.totalPlayers)}</strong></div><div><span>Visits today</span><strong>${compact(latest.visitsToday)}</strong></div><div><span>Recorded visits</span><strong>${compact(latest.visitsAllTime)}</strong></div><p>Live counts use active resident presence. Visit tracking is recorded from ${date(latest.trackingSince)}.</p>`;
      dock.after(statsPopover);
    });
  }
  dock.cityStats=stats;
  dock.querySelector('[data-city-online]').textContent=`${compact(stats.onlineNow)} online`;
  dock.querySelector('[data-city-here]').textContent=`${compact(stats.hereNow)} here`;
  dock.querySelector('[data-city-visits]').textContent=`${compact(stats.visitsToday)} visits today`;
  dock.setAttribute('aria-label',`${stats.onlineNow||0} residents online now. ${stats.hereNow||0} in this area. ${stats.visitsToday||0} city visits today. Open live city details.`);
  if(statsPopover){closeStatsPopover();}
}
async function refreshNearby({force=false}={}){
  const world=activeWorld();if(!world||document.hidden||refreshing)return;
  const now=Date.now();if(!force&&now-lastRefresh<2500)return;refreshing=true;
  try{
    const result=await json('/api/presence/nearby');lastRefresh=Date.now();const present=new Set();
    for(const resident of result.nearby||[]){const id=String(resident.id);present.add(id);residents.set(id,resident);}
    for(const id of residents.keys())if(!present.has(id))residents.delete(id);
    decorateResidents();showStats(world,result.stats);
  }
  catch(error){if(![404,405,501,401].includes(error.status))console.warn('AbujaLife nearby presence refresh failed',error.code||error.message);}
  finally{refreshing=false;}
}
function scheduleNearby(delay=100){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refreshNearby(),delay);}

function startWorldAudio(world){
  if(world.dataset.livingAudioBound==='1')return;world.dataset.livingAudioBound='1';
  world.addEventListener('pointerdown',()=>{const button=world.querySelector('.world-sound-toggle');if(button&&!button.disabled&&button.getAttribute('aria-pressed')!=='true')button.click();},{once:true,capture:true});
}
function burst(data){
  const world=activeWorld();if(!world||!isClub(world))return;
  let anchor=world.querySelector(`[data-world-resident="${CSS.escape(String(data.residentId||''))}"]`);if(!anchor)anchor=world.querySelector('[data-world-player]');
  const worldBox=world.getBoundingClientRect(),box=anchor?.getBoundingClientRect?.()||worldBox,x=(box.left+box.width/2-worldBox.left),y=(box.top+Math.min(box.height*.45,110)-worldBox.top);
  const layer=document.createElement('div');layer.className='club-money-burst';layer.style.left=`${Math.max(30,Math.min(worldBox.width-30,x))}px`;layer.style.top=`${Math.max(80,Math.min(worldBox.height-120,y))}px`;layer.setAttribute('aria-hidden','true');
  const symbols=['₦','₦','💸','₦','₦','💸','₦','₦','₦','💸','₦','₦'];layer.innerHTML=symbols.map((symbol,index)=>`<i style="--i:${index};--x:${((index*47)%120)-60}px;--r:${((index*37)%70)-35}deg">${symbol}</i>`).join('');world.append(layer);setTimeout(()=>layer.remove(),1800);
  if(data.username)toast(`@${data.username} sprayed ${money(data.amount)} at ${data.venueName||'the club'}`);
}
function closeClubStream(){clubStream?.close();clubStream=null;}
function openClubStream(){
  if(clubStream||!isClub(activeWorld()))return;
  try{
    clubStream=createApiEventSource('/api/realtime');
    clubStream.addEventListener('club-spray',event=>{try{burst(JSON.parse(event.data));}catch{}});
    clubStream.addEventListener('presence',()=>scheduleNearby(80));
    clubStream.addEventListener('ready',()=>void refreshNearby({force:true}));
  }catch{clubStream=null;}
}
function clubDock(world){
  if(!isClub(world)){world?.querySelector('.club-life-dock')?.remove();clubMenu?.remove();clubMenu=null;closeClubStream();return;}
  if(world.querySelector('.club-life-dock')){openClubStream();return;}
  const dock=document.createElement('div');dock.className='club-life-dock';dock.innerHTML='<button type="button" class="club-spray-button" aria-expanded="false"><span>₦</span> Spray</button>';
  world.append(dock);const button=dock.querySelector('button');
  button.onclick=event=>{event.stopPropagation();if(clubMenu){clubMenu.remove();clubMenu=null;button.setAttribute('aria-expanded','false');return;}clubMenu=document.createElement('div');clubMenu.className='club-spray-menu';clubMenu.innerHTML=`<small>SPRAY GAME NAIRA</small>${[1000,5000,10000,50000].map(amount=>`<button type="button" data-spray="${amount}">${money(amount)}</button>`).join('')}`;dock.append(clubMenu);button.setAttribute('aria-expanded','true');
    clubMenu.querySelectorAll('[data-spray]').forEach(choice=>choice.onclick=async e=>{e.stopPropagation();if(choice.disabled)return;const amount=Number(choice.dataset.spray);clubMenu.querySelectorAll('button').forEach(item=>item.disabled=true);try{const result=await json('/api/club/spray',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount,idempotencyKey:requestKey()})});burst(result.clubSpray||{residentId:result.profile?.id,username:result.profile?.username,amount,venueName:world.dataset.sceneName});const wallet=document.querySelector('.wallet-button strong');if(wallet&&result.profile)wallet.textContent=money(result.profile.wallet);clubMenu?.remove();clubMenu=null;button.setAttribute('aria-expanded','false');}catch(error){toast(error.message);clubMenu?.querySelectorAll('button').forEach(item=>item.disabled=false);}});
  };
  openClubStream();
}
function syncWorld(){
  const world=activeWorld();if(world!==currentWorld){closeClubStream();closeStatsPopover();clubMenu?.remove();clubMenu=null;currentWorld=world;if(world){startWorldAudio(world);void refreshNearby({force:true});}}
  if(world){decorateResidents();clubDock(world);}
}

const observer=new MutationObserver(()=>{syncWorld();scheduleNearby(180);});observer.observe(document.body,{childList:true,subtree:true});
addEventListener('focus',()=>{syncWorld();void refreshNearby({force:true});});
addEventListener('visibilitychange',()=>{if(document.hidden){closeClubStream();closeStatsPopover();return;}syncWorld();void refreshNearby({force:true});});
addEventListener('pointerdown',event=>{if(statsPopover&&!event.target.closest('.world-live-stats')&&!event.target.closest('.world-live-popover'))closeStatsPopover();},{capture:true});
setInterval(()=>{if(activeWorld()&&!document.hidden)void refreshNearby();},5000);
syncWorld();

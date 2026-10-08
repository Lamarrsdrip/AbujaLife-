import {locationActivities} from '../src/shared/location-activities.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createLocationTray({read,run,more,host}){
 let key=null,mode='open',node=null,signature='';
 let saved=null;try{saved=JSON.parse(sessionStorage.getItem('abujalife.location-tray')||'null');}catch{}
 const remember=()=>{try{sessionStorage.setItem('abujalife.location-tray',JSON.stringify({key,mode}));}catch{}};
 const dispose=()=>{node?.remove();node=null;signature='';};
 function sync(){
  const context=locationActivities(read()),root=host();
  if(!context||!root){dispose();if(!context){key=null;saved=null;remember();}return;}
  if(key!==context.key){key=context.key;mode=saved?.key===key&&['dismissed','minimized'].includes(saved.mode)?saved.mode:'open';saved=null;remember();dispose();}
  if(!node?.isConnected){node=document.createElement('aside');node.className='location-activity-tray';node.setAttribute('aria-label','Activities available here');root.append(node);signature='';}
  const limit=read().profile?.location?.kind==='home'?4:3;
  const next=JSON.stringify([mode,context.name,context.items.map(a=>[a.id,a.cost,a.unavailable])]);
  if(next===signature)return;signature=next;
  node.dataset.mode=mode;
  if(mode!=='open'){
   node.innerHTML='<button class="location-tray-reopen" type="button">Activities here <span>↑</span></button>';
   node.querySelector('button').onclick=()=>{mode='open';remember();signature='';sync();};return;
  }
  node.innerHTML=`<header><div><small>AVAILABLE HERE</small><strong>${esc(context.name)}</strong></div><button type="button" data-tray-minimize aria-label="Minimize activities">−</button><button type="button" data-tray-dismiss aria-label="Dismiss activities">×</button></header><div class="location-tray-actions">${context.items.slice(0,limit).map(a=>`<button type="button" data-location-activity="${esc(a.id)}" ${a.unavailable?'disabled':''} title="${esc(a.unavailable||a.name)}"><strong>${esc(a.name)}</strong><small>${esc(a.unavailable|| (a.cost?`₦${new Intl.NumberFormat('en-NG').format(a.cost)} · game Naira`:'Free'))}</small></button>`).join('')}${context.items.length>limit?'<button type="button" data-tray-more><strong>More</strong><small>All activities →</small></button>':''}</div>`;
  node.querySelector('[data-tray-minimize]').onclick=()=>minimize('minimized');
  node.querySelector('[data-tray-dismiss]').onclick=()=>minimize('dismissed');
  node.querySelector('[data-tray-more]')?.addEventListener('click',more);
  node.querySelectorAll('[data-location-activity]').forEach(button=>button.onclick=()=>{
   // Revalidate from the newest local authoritative state before starting.
   const item=locationActivities(read())?.items.find(a=>a.id===button.dataset.locationActivity);
   if(item&&!item.unavailable){minimize('minimized');run(item);}
  });
 }
 function minimize(next='minimized'){if(mode!=='open')return;mode=next;remember();signature='';sync();}
 const onMove=event=>{if(event.target.closest?.('.world-joystick,.world-sprint-button'))minimize();};
 const onKey=event=>{if(/^(w|a|s|d|arrowup|arrowdown|arrowleft|arrowright)$/i.test(event.key)&&event.target.closest?.('#world-scene'))minimize();};
 document.addEventListener('pointerdown',onMove,{passive:true});document.addEventListener('keydown',onKey);
 return {sync,minimize,isExpanded:()=>!!node?.isConnected&&mode==='open',dispose(){dispose();document.removeEventListener('pointerdown',onMove);document.removeEventListener('keydown',onKey);}};
}

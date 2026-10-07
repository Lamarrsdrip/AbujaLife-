import {selectActivity,activityCandidates} from '../src/shared/activity-discovery.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createActivityDirector({read,now,quiet,record,run,host,random=Math.random}){
 let owner=null,enteredAt=0,card=null,suggestion=null,stats={},lastShown=0;
 const remove=()=>{card?.remove();card=null;suggestion=null;};
 const track=(item,event)=>{void record({activityId:item.id,event}).then(result=>{if(event==='shown'&&result?.suppressed&&suggestion?.id===item.id)remove();}).catch(()=>{if(event==='shown'&&suggestion?.id===item.id)remove();});};
 function check(){
  const context=read(),time=now();if(context.profile?.id!==owner){owner=context.profile?.id;enteredAt=time;lastShown=0;remove();}
  if(!owner||!quiet()){remove();return;}
  if(card){if(!card.isConnected||time>=suggestion.expiresAt||!activityCandidates({...context,profile:{...context.profile,discovery:{...context.profile.discovery,entries:{...context.profile.discovery?.entries,[suggestion.id]:{...context.profile.discovery?.entries?.[suggestion.id],shownAt:0}},categories:{...context.profile.discovery?.categories,[suggestion.category]:0}}},now:time,stats}).some(a=>a.id===suggestion.id))remove();return;}
  const history=context.profile.discovery||{};
  if(time-enteredAt<90000||time-Math.max(lastShown,history.lastShownAt||0)<5*60000)return;
  const selected=selectActivity({...context,now:time,stats},random);if(!selected)return;
  const root=host();if(!root)return;suggestion=selected;lastShown=time;
  card=document.createElement('aside');card.className='activity-discovery-card';card.setAttribute('aria-label','An idea for your Abuja day');
  card.innerHTML=`<button type="button" class="discovery-dismiss" aria-label="Dismiss suggestion">×</button><small>YOUR ABUJA DAY</small><strong>${esc(selected.headline)}</strong><p>${esc(selected.description)}</p><button type="button" class="discovery-go">${esc(selected.cta)} →</button>`;
  card.querySelector('.discovery-dismiss').onclick=()=>{track(selected,'dismissed');remove();};
  card.querySelector('.discovery-go').onclick=()=>{track(selected,'clicked');remove();run(selected.action);};
  root.append(card);track(selected,'shown');
 }
 const timer=setInterval(check,45000);
 const onStats=event=>{if(event.detail?.stats)stats=event.detail.stats;};
 addEventListener('abujalife:living-city',onStats);
 return {check,dispose(){clearInterval(timer);removeEventListener('abujalife:living-city',onStats);remove();}};
}

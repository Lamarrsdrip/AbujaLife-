import {selectActivity,activityCandidates} from '../src/shared/activity-discovery.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createActivityDirector({read,now,quiet,record,run,host,random=Math.random}){
 let owner=null,enteredAt=0,card=null,suggestion=null,stats={},lastShown=0,pending=null,generation=0,disposed=false;
 const remove=()=>{generation++;card?.remove();card=null;suggestion=null;};
 const track=(item,event)=>{void record({activityId:item.id,event}).catch(()=>{});};
 async function check(){
  if(disposed)return;
  const context=read(),time=now();if(context.profile?.id!==owner){owner=context.profile?.id;enteredAt=time;lastShown=0;remove();}
  if(!owner||!quiet()){remove();return;}
  if(card){if(!card.isConnected||time>=suggestion.expiresAt||!activityCandidates({...context,profile:{...context.profile,discovery:{...context.profile.discovery,entries:{...context.profile.discovery?.entries,[suggestion.id]:{...context.profile.discovery?.entries?.[suggestion.id],shownAt:0}},categories:{...context.profile.discovery?.categories,[suggestion.category]:0}}},now:time,stats}).some(a=>a.id===suggestion.id))remove();return;}
  if(pending)return;
  const history=context.profile.discovery||{};
  if(time-enteredAt<90000||time-Math.max(lastShown,history.lastShownAt||0)<5*60000)return;
  const selected=selectActivity({...context,now:time,stats},random);if(!selected)return;
  if(!host())return;
  // Claim through the existing authoritative progression owner before showing
  // anything. A second tab can lose the claim without flashing a competing card.
  const claim={owner,generation};pending=claim;
  try{
   const result=await record({activityId:selected.id,event:'shown'});
   if(disposed||claim.owner!==owner||claim.owner!==read().profile?.id||claim.generation!==generation||result?.suppressed||!quiet()||now()>=selected.expiresAt)return;
   const root=host();if(!root)return;suggestion=selected;lastShown=now();
  card=document.createElement('aside');card.className='activity-discovery-card';card.setAttribute('aria-label','An idea for your Abuja day');
  card.innerHTML=`<button type="button" class="discovery-dismiss" aria-label="Dismiss suggestion">×</button><small>YOUR ABUJA DAY</small><strong>${esc(selected.headline)}</strong><p>${esc(selected.description)}</p><button type="button" class="discovery-go">${esc(selected.cta)} →</button>`;
  const cardOwner=owner;
  card.querySelector('.discovery-dismiss').onclick=()=>{if(read().profile?.id!==cardOwner)return;track(selected,'dismissed');remove();};
  card.querySelector('.discovery-go').onclick=()=>{if(read().profile?.id!==cardOwner)return;track(selected,'clicked');remove();run(selected.action);};
   root.append(card);
  }catch{
   // No confirmed claim means no suggestion. The next bounded quiet-state
   // check can retry naturally after connectivity returns.
  }finally{if(pending===claim)pending=null;}
 }
 const timer=setInterval(check,45000);
 const onStats=event=>{if(event.detail?.stats)stats=event.detail.stats;};
 addEventListener('abujalife:living-city',onStats);
 return {check,dispose(){disposed=true;clearInterval(timer);removeEventListener('abujalife:living-city',onStats);remove();}};
}

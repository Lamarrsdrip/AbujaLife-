/** Server-owned housing rules. Times are elapsed UTC milliseconds, never browser sessions. */
import { RENT_RULES } from './economy.mjs';
export const TENANCY_RULES = Object.freeze({
  version: 1, ...RENT_RULES,
  warningAfterMs: 7 * 86400000, seriousAfterMs: 14 * 86400000,
  finalAfterMs: 21 * 86400000, finalNoticeMs: 7 * 86400000,
  storyCooldownMs: 20 * 3600000, increaseAfterPayments: 8,
  increaseNoticeMs: 14 * 86400000, increaseCooldownMs: 12 * 7 * 86400000,
  temporaryPropertyId: 'garki-studio'
});
export const LANDLORD_PERSONALITIES = Object.freeze({
  relaxed: { name: 'Relaxed', graceDays: 4, extensionDays: 5, negotiationChance: .85 },
  strict: { name: 'Strict', graceDays: 1, extensionDays: 2, negotiationChance: .35 },
  business: { name: 'Business-minded', graceDays: 2, extensionDays: 3, negotiationChance: .6 },
  friendly: { name: 'Friendly', graceDays: 3, extensionDays: 4, negotiationChance: .8 },
  dramatic: { name: 'Dramatic', graceDays: 2, extensionDays: 3, negotiationChance: .5 }
});
const DAY=86400000, active=t=>t&&!t.endedAt, whole=n=>Number.isSafeInteger(n)&&n>=0;
function roll(seed) { let n=2166136261; for(const c of String(seed)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return(n>>>0)/4294967296; }
function choice(rows,seed){const total=rows.reduce((n,r)=>n+r[1],0);let point=roll(seed)*total;for(const[text,weight]of rows){point-=weight;if(point<0)return text;}return rows.at(-1)[0];}
export function createTenancy({id,property,residentId,now,seed=id,migrated=false}) {
  if(!whole(property?.rent)||property.rent<=0)throw Object.assign(new Error('This home is not available to rent.'),{code:'home_not_rentable'});
  const personality=Object.keys(LANDLORD_PERSONALITIES)[Math.floor(roll(`${seed}:personality`)*5)];
  return {version:TENANCY_RULES.version,id,propertyId:property.id,ownerId:property.ownerId||null,residentId,
    startAt:now,weeklyRent:property.rent,nextRentDueAt:now+TENANCY_RULES.intervalMs,lastPaidAt:now,
    outstanding:0,missedPayments:0,onTimePayments:0,status:'current',graceUntil:null,
    landlord:{id:`landlord:${property.id}`,personality,name:property.landlordName||'Your landlord'},
    storySeed:String(seed),story:null,lastStoryAt:0,...(migrated?{migratedAt:now}:{})};
}
const templates={
 upcoming:[['Your landlord sent a quiet reminder: rent is due this week.',3],['A quick message from the caretaker: your next rent date is approaching.',1]],
 due:[['Rent is due. You can pay now or talk to your landlord about a little more time.',3],['Your landlord called about this week’s rent. There is time to sort it out.',1]],
 grace:[['Your landlord is giving you a little time to arrange the rent.',3],['The caretaker says your landlord is waiting for an update about rent.',1]],
 overdue:[['Your rent is overdue. Pay the balance or speak to your landlord.',3],['Your landlord wants to know when the outstanding rent will arrive.',1]],
 warning:[['Your landlord has sent a rent warning. You still have time to settle or move.',3],['The caretaker checked in: please sort the arrears before things escalate.',1]],
 serious:[['The rent balance is growing. Consider paying, a cheaper home or a game loan.',3],['Your landlord wants a plan for the arrears. A cheaper place is still an option.',1]],
 final:[['Final notice: settle the arrears before the deadline, or plan your move.',3],['Your landlord needs the outstanding rent cleared before the final date.',1]],
 evicted:[['Your tenancy has ended. Your belongings are safe in a temporary studio while you find your next home.',3],['Landlord don finally lose patience. Your belongings are safe; a temporary studio gives you room to rebuild.',1]]
};
function storyFor(t,status,now){const id=`${t.id}:${status}:${t.missedPayments}`,text=choice(templates[status]||templates.due,`${t.storySeed}:${id}`);return{id,kind:status,title:status==='evicted'?'Time for a fresh start':status==='final'?'Final rent notice':status==='upcoming'?'Rent is coming up':'Home & landlord',text,createdAt:now,actions:status==='evicted'?['view-homes','view-home']:['pay-rent','talk-landlord','view-home','move-out'],...(t.finalNoticeAt?{deadline:t.finalNoticeAt+TENANCY_RULES.finalNoticeMs}:{}),acknowledgedAt:null};}
/** Mutates only housing records; accrual never silently takes money. */
export function advanceTenancy(t,now,{allowStories=true}={}) {
  if(!active(t))return false;const before=JSON.stringify(t);
  if(now>=t.nextRentDueAt){
    const periods=Math.floor((now-t.nextRentDueAt)/TENANCY_RULES.intervalMs)+1;
    const first=t.nextRentDueAt;t.firstMissedAt??=first;
    let amount=periods*t.weeklyRent;
    // An accepted increase starts on the first billing boundary after its notice, never retrospectively.
    if(t.rentIncrease?.acceptedAt&&t.rentIncrease.effectiveAt<=now){
      const oldPeriods=Math.max(0,Math.min(periods,Math.ceil((t.rentIncrease.effectiveAt-first)/TENANCY_RULES.intervalMs)));
      amount=oldPeriods*t.weeklyRent+(periods-oldPeriods)*t.rentIncrease.amount;
      t.weeklyRent=t.rentIncrease.amount;t.lastIncreaseAt=t.rentIncrease.effectiveAt;t.rentIncrease.appliedAt=now;
      delete t.rentIncrease;
    }
    if(!whole(amount)||!whole(t.outstanding+amount))throw Object.assign(new Error('This rent balance is too large. Please contact support.'),{code:'numeric_limit'});
    t.outstanding+=amount;t.missedPayments+=periods;t.nextRentDueAt+=periods*TENANCY_RULES.intervalMs;
    t.graceUntil??=first+(LANDLORD_PERSONALITIES[t.landlord.personality].graceDays+Math.min(2,Math.floor(t.onTimePayments/8)))*DAY;
  }
  let status='current';
  if(t.outstanding>0){
    const late=now-t.firstMissedAt;
    status=now<=t.graceUntil?'grace':late<TENANCY_RULES.warningAfterMs?'overdue':late<TENANCY_RULES.seriousAfterMs?'warning':late<TENANCY_RULES.finalAfterMs?'serious':'final';
    if(late<DAY&&now<=t.graceUntil&&t.extensionCycle!==t.firstMissedAt)status='due';
    if(status==='final')t.finalNoticeAt??=now;
    if(t.finalNoticeAt&&now>=t.finalNoticeAt+TENANCY_RULES.finalNoticeMs){status='evicted';t.endedAt=now;t.endReason='rent-arrears';}
  }else if(t.nextRentDueAt-now<=TENANCY_RULES.reminderMs)status='upcoming';
  if(status!==t.status){t.status=status;if(allowStories&&status!=='current'){t.story=storyFor(t,status,now);t.lastStoryAt=now;}}
  return before!==JSON.stringify(t);
}
export function payTenancy(t,now,{early=false}={}) {
  if(!active(t))throw Object.assign(new Error('Choose an active tenancy.'),{code:'tenancy_inactive'});
  advanceTenancy(t,now);if(!active(t))throw Object.assign(new Error('This tenancy has ended. You can settle the arrears from your housing history.'),{code:'tenancy_inactive'});
  const amount=t.outstanding||t.weeklyRent;
  if(!t.outstanding){
    if(!early||t.nextRentDueAt-now>TENANCY_RULES.reminderMs)throw Object.assign(new Error('Your rent is up to date. Early payment opens two days before it is due.'),{code:'rent_not_due'});
    t.nextRentDueAt+=TENANCY_RULES.intervalMs;t.onTimePayments++;
  }else if(now-t.firstMissedAt<=DAY)t.onTimePayments++;
  t.outstanding=0;t.missedPayments=0;t.lastPaidAt=now;t.firstMissedAt=null;t.graceUntil=null;t.finalNoticeAt=null;t.extensionCycle=null;t.ignoreCount=0;t.status='current';
  t.story={id:`${t.id}:paid:${now}`,kind:'paid',title:'Rent sorted',text:t.onTimePayments>=8?'Eight prompt rent payments. Your landlord knows you are reliable and can offer a little extra grace when needed.':t.onTimePayments>0?'Your landlord appreciates the prompt payment. Your home is sorted.':'Your rent balance is clear. Enjoy your home.',createdAt:now,actions:['view-home'],acknowledgedAt:null};t.lastStoryAt=now;
  return amount;
}
export function askForTime(t,now){
  advanceTenancy(t,now);if(!active(t)||!t.outstanding)throw Object.assign(new Error('Your rent is up to date.'),{code:'rent_not_due'});
  if(t.extensionCycle===t.firstMissedAt)throw Object.assign(new Error('You already agreed a little more time for this rent balance.'),{code:'grace_already_used'});
  if(t.finalNoticeAt)throw Object.assign(new Error('The final notice is already in place. Settle the balance or plan to move.'),{code:'final_notice'});
  t.extensionCycle=t.firstMissedAt;t.graceUntil=Math.max(t.graceUntil||now,now)+LANDLORD_PERSONALITIES[t.landlord.personality].extensionDays*DAY;t.status='grace';
  t.story={id:`${t.id}:extension:${t.firstMissedAt}`,kind:'grace',title:'A little breathing room',text:'You told your landlord money is coming. Your agreed grace period is saved.',createdAt:now,deadline:t.graceUntil,actions:['pay-rent','view-homes'],acknowledgedAt:null};t.lastStoryAt=now;
}
export function talkToLandlord(t,now){
  advanceTenancy(t,now);if(!active(t))throw Object.assign(new Error('This tenancy has ended.'),{code:'tenancy_inactive'});
  if(t.outstanding){t.story=storyFor(t,t.status,now);t.story.actions=['pay-rent',...(t.extensionCycle!==t.firstMissedAt&&!t.finalNoticeAt?['ask-rent-time']:[]),'view-homes','consider-loan'];}
  else t.story={id:`${t.id}:good:${Math.floor(now/TENANCY_RULES.storyCooldownMs)}`,kind:'good-tenant',title:'A quiet home',text:t.onTimePayments>=8?'Eight prompt rent payments. Your landlord knows you are reliable.':'Your rent is up to date. Your landlord says to enjoy the home.',createdAt:now,actions:['view-home'],acknowledgedAt:null};
  t.lastStoryAt=now;return t.story;
}
export function maybeProposeIncrease(t,now){
  if(!active(t)||t.outstanding||t.rentIncrease||t.onTimePayments<TENANCY_RULES.increaseAfterPayments||now-(t.lastIncreaseAt||t.lastIncreaseOfferedAt||t.startAt)<TENANCY_RULES.increaseCooldownMs)return;
  // Resident-specific stable weekly draw prevents retries from rerolling the landlord.
  const window=Math.floor(now/TENANCY_RULES.intervalMs);if(t.lastIncreaseDraw===window)return;t.lastIncreaseDraw=window;
  if(roll(`${t.storySeed}:increase:${window}`)>.12)return;
  const percent=t.landlord.personality==='strict'?12:8,amount=Math.ceil(t.weeklyRent*(100+percent)/100/1000)*1000;
  t.rentIncrease={previousAmount:t.weeklyRent,amount,offeredAt:now,effectiveAt:now+TENANCY_RULES.increaseNoticeMs,acceptedAt:null,negotiated:false};t.lastIncreaseOfferedAt=now;
  t.story={id:`${t.id}:increase:${now}`,kind:'rent-increase',title:'A proposed rent change',text:'Your landlord is proposing a new weekly rent. Review it before deciding; it does not apply until you accept.',createdAt:now,actions:['accept-rent-increase','negotiate-rent','plan-move'],acknowledgedAt:null};t.lastStoryAt=now;
}
export function answerIncrease(t,action,now){
  const offer=t.rentIncrease;if(!offer||offer.acceptedAt)throw Object.assign(new Error('There is no open rent proposal.'),{code:'rent_offer_unavailable'});
  if(action==='accept-rent-increase'){offer.acceptedAt=now;offer.effectiveAt=Math.max(offer.effectiveAt,now+TENANCY_RULES.increaseNoticeMs);}
  else if(action==='negotiate-rent'){
    if(offer.negotiated)throw Object.assign(new Error('Your landlord has already reviewed this proposal.'),{code:'rent_negotiated'});
    offer.negotiated=true;offer.negotiationSucceeded=roll(`${t.storySeed}:negotiate:${offer.offeredAt}`)<LANDLORD_PERSONALITIES[t.landlord.personality].negotiationChance;
    if(offer.negotiationSucceeded)offer.amount=Math.ceil((offer.previousAmount+(offer.amount-offer.previousAmount)*.5)/1000)*1000;
  }else if(action==='plan-move'){offer.declinedAt=now;t.planningMove=true;}
  t.story={id:`${t.id}:offer:${action}:${now}`,kind:'rent-increase',title:action==='plan-move'?'Plan your next home':action==='accept-rent-increase'?'Rent change agreed':'Landlord replied',text:action==='plan-move'?'You can compare cheaper homes. Your existing rent stays the same.':action==='accept-rent-increase'?'The new weekly amount starts after the notice period.':offer.negotiationSucceeded?'Your landlord agreed to reduce the proposed increase. You can review and accept it.':'Your landlord is keeping the proposal. You can accept it or plan to move.',createdAt:now,actions:action==='plan-move'?['view-homes']:offer.acceptedAt?['view-home']:['accept-rent-increase','plan-move'],acknowledgedAt:null};t.lastStoryAt=now;
}
export function endTenancy(t,now,reason='moved-out') {if(active(t)){advanceTenancy(t,now);t.endedAt??=now;t.endReason=reason;t.status=reason==='rent-arrears'?'evicted':'moved-out';}return t;}
export function syncHomeTenancy(profile,{property,temporaryProperty,now,id,seed,migrate=true}={}) {
  const home=profile.home;let changed=false;
  if(home.tenure==='temporary'&&home.temporaryHotelId&&now>=home.temporaryUntil){moveToTemporary(profile,temporaryProperty,now,'short-stay-ended');profile.home.housingStory={id:`hotel-ended:${home.temporarySince}`,kind:'short-stay-ended',title:'Your next chapter',text:'Your hotel stay has ended. A temporary city studio is ready while you choose your next home.',createdAt:now,actions:['view-homes'],acknowledgedAt:null};return true;}
  if(home.tenure==='rent'&&!home.tenancy&&migrate){home.tenancy=createTenancy({id,property,residentId:profile.id,now,seed,migrated:true});changed=true;}
  if(home.tenure==='rent'&&home.tenancy){changed=advanceTenancy(home.tenancy,now,{allowStories:profile.onboardingComplete!==false})||changed;maybeProposeIncrease(home.tenancy,now);home.rentDueAt=home.tenancy.nextRentDueAt;
    if(home.tenancy.status==='evicted'){moveToTemporary(profile,temporaryProperty,now,'rent-arrears');changed=true;}}
  return changed;
}
export function archiveTenancy(home,now,reason){
  if(!home.tenancy)return {depositRefund:0,depositApplied:0};
  const t=endTenancy(home.tenancy,now,reason);let depositRefund=0,depositApplied=0;
  if(!t.depositSettledAt){
    const deposit=whole(t.deposit)?t.deposit:0;depositApplied=Math.min(deposit,t.outstanding);depositRefund=deposit-depositApplied;
    t.outstanding-=depositApplied;t.depositApplied=depositApplied;t.depositRefund=depositRefund;t.depositSettledAt=now;
  }
  const previous=structuredClone(t);home.housingHistory=[previous,...(home.housingHistory||[])].slice(0,32);
  if(previous.outstanding>0&&!home.housingDebts?.some(row=>row.id===previous.id))home.housingDebts=[previous,...(home.housingDebts||[])];
  return {depositRefund,depositApplied};
}
export function packTenancyFurniture(profile,propertyId){
  const stored=profile.storedFurniture||=[];const shouldPack=value=>!value?.propertyId||value.propertyId===propertyId;
  if(Array.isArray(profile.furnitureLayout)){profile.furnitureLayout=profile.furnitureLayout.filter(value=>{if(!shouldPack(value))return true;const itemId=value.itemId||value.id;if(itemId&&!stored.includes(itemId))stored.push(itemId);return false;});}
  else {const remaining={};for(const [itemId,value] of Object.entries(profile.furnitureLayout||{})){if(shouldPack(value)){if(!stored.includes(itemId))stored.push(itemId);}else remaining[itemId]=value;}profile.furnitureLayout=remaining;}
}
export function moveToTemporary(profile,property,now,reason='moved-out'){
  const previous=profile.home,settlement=archiveTenancy(previous,now,reason);profile.wallet+=settlement.depositRefund;
  packTenancyFurniture(profile,previous.propertyId);profile.home={propertyId:property.id,layoutId:property.layoutId||property.id,name:'Temporary city studio',district:property.district,tenure:'temporary',gifted:false,rentDueAt:null,temporarySince:now,previousPropertyId:previous.propertyId,housingHistory:previous.housingHistory||[],housingDebts:previous.housingDebts||[],housingStory:previous.tenancy?.story||null,...(previous.starterVersion===1?{starterVersion:1,furnishingPreset:'lapo'}:{})};
  if(profile.location.kind==='home'){profile.district=property.district;profile.location={kind:'home',district:property.district,venue:'home'};profile.drivingVehicle=null;}
  // A pending return must not spawn the resident back into a ended tenancy.
  if(profile.activeTrip?.returningHome){profile.activeTrip.destination=property.district;}
  profile.billsPaidAt=now;profile.rentPaidAt=now;return settlement;
}
/** Quiet, resident-specific money moments from committed actions, never a separate polling stream. */
export function recordHousingLifeEvent(profile,{kind,extra={},now,beforeBalance}){
  const t=profile.home?.tenancy;if(!active(t)||profile.onboardingComplete===false||now-(t.lastStoryAt||0)<TENANCY_RULES.storyCooldownMs||['warning','serious','final'].includes(t.status))return;
  const approaching=t.nextRentDueAt-now<=TENANCY_RULES.reminderMs,spent=Math.max(0,beforeBalance-profile.wallet),earned=Math.max(0,profile.wallet-beforeBalance);
  if(!(t.outstanding||approaching)||roll(`${t.storySeed}:life:${kind}:${now}`)>.35)return;
  let text,title;
  if(spent&&extra.item?.category==='vehicle'&&t.outstanding){title='A car, and a rent balance';text='Your landlord noticed the new car. Enjoy the upgrade, and keep a plan for the outstanding rent.';}
  else if(spent&&extra.activity?.venueId?.startsWith('club')&&spent>=t.weeklyRent/4){title='After a good night out';text='A good night in Abuja. Keep this week’s rent in your spending plan before the next outing.';}
  else if(earned&&['complete-shift','collect-rent'].includes(kind)){title='Good timing';text=kind==='collect-rent'?'Your property income arrived with rent approaching. You can settle home first, then enjoy the city.':'Your shift paid just before rent. A little planning leaves room for your next Abuja outing.';}
  if(!text)return;t.story={id:`${t.id}:life:${kind}:${now}`,kind:'money-life',title,text,createdAt:now,actions:['pay-rent','view-home'],acknowledgedAt:null};t.lastStoryAt=now;
}
export function nextTenancyCheck(tenancy,now){
  if(!active(tenancy))return null;const t=tenancy;
  const candidates=[t.nextRentDueAt-TENANCY_RULES.reminderMs,t.nextRentDueAt,t.graceUntil,t.firstMissedAt? t.firstMissedAt+DAY:null,t.firstMissedAt?t.firstMissedAt+TENANCY_RULES.warningAfterMs:null,t.firstMissedAt?t.firstMissedAt+TENANCY_RULES.seriousAfterMs:null,t.firstMissedAt?t.firstMissedAt+TENANCY_RULES.finalAfterMs:null,t.finalNoticeAt?t.finalNoticeAt+TENANCY_RULES.finalNoticeMs:null].filter(value=>Number.isFinite(value)&&value>now);
  return candidates.length?Math.max(now+60000,Math.min(...candidates)):now+TENANCY_RULES.intervalMs;
}

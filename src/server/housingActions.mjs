import { GameError } from './errors.mjs';
import { TENANCY_RULES, createTenancy, payTenancy, askForTime, talkToLandlord, answerIncrease, archiveTenancy, packTenancyFurniture, moveToTemporary } from '../shared/tenancy.mjs';
import { investmentView, venueFor, venueAvailable, venueActionFor } from '../shared/life.mjs';
export const HOUSING_ACTIONS = new Set(['move-home','move-out','pay-rent','renew-rent','ask-rent-time','talk-landlord','ignore-landlord','accept-rent-increase','negotiate-rent','plan-move','dismiss-housing-story','temporary-stay']);
export const HOUSING_MONEY_ACTIONS = new Set(['move-home','move-out','pay-rent','renew-rent','temporary-stay']);
const check=(v,text,code='invalid_housing_action')=>{if(!v)throw new GameError(text,409,code);};
/** Shared by both persistence stores; this only mutates inside their existing atomic operation. */
export function applyHousingAction(profile,action,payload,{now,properties}) {
  const p=profile,t=p.home.tenancy,temporary=properties.find(row=>row.id===TENANCY_RULES.temporaryPropertyId);
  const debit=amount=>{check(Number.isSafeInteger(amount)&&amount>=0,'Choose a home with a valid listed price.','numeric_limit');check(p.wallet>=amount,'You need more Naira for this home payment.','insufficient_balance');p.wallet-=amount;};
  const result=(amount=0,extra={})=>({housing:{action,amount,tenancy:p.home.tenancy||null,story:p.home.tenancy?.story||p.home.housingStory||null,...extra},ledgerReason:action==='move-home'?'Home move-in':action==='temporary-stay'?'Temporary hotel stay':'Weekly rent payment',ledgerType:action==='move-home'?(payload.tenure==='own'?'PROPERTY_PURCHASE':'PROPERTY_DEPOSIT'):action==='temporary-stay'?'HOTEL_PAYMENT':action==='move-out'?'PROPERTY_DEPOSIT_REFUND':'RENT_PAYMENT'});
  check(temporary,'Temporary accommodation is unavailable.','storage_incomplete');
  try {
    if(action==='move-home'){
      check(!p.activeTrip,'Finish your journey before moving home.','trip_in_progress');check(p.location.kind!=='visit','Leave your visit before moving home.','visit_active');
      const property=properties.find(row=>row.id===payload.propertyId);
      check(property&&(property.tier>0||property.originHome),'Choose a listed home.','invalid_property');
      check(['rent','own'].includes(payload.tenure),'Choose rent or ownership.');check(!property.originHome||payload.tenure==='own','Your starting home is available without rent.');
      check(p.home.propertyId!==property.id||p.home.tenure!==payload.tenure,'You already live here.','already_home');
      check(!(payload.tenure==='rent'&&p.ownedProperties.includes(property.id)),'You own this property. Choose Move in.','already_owned');
      check(!t?.outstanding||payload.confirm===true,'Outstanding rent stays on your housing account after moving. Confirm the move to continue.','housing_debt_confirmation');
      const deposit=payload.tenure==='rent'?property.cautionDeposit||0:0,cost=property.originHome?0:payload.tenure==='rent'?property.rent+deposit:p.ownedProperties.includes(property.id)?0:property.buy;
      check(Number.isSafeInteger(cost)&&cost>=0,'Choose a home with a valid listed price.','numeric_limit');
      const refundableDeposit=Math.max(0,(t?.deposit||0)-(t?.outstanding||0)),nextBalance=BigInt(p.wallet)+BigInt(refundableDeposit)-BigInt(cost);
      check(nextBalance>=0n,'You need more Naira for this home payment.','insufficient_balance');check(nextBalance<=BigInt(Number.MAX_SAFE_INTEGER),'This home payment is outside the supported Naira balance.','numeric_limit');p.wallet=Number(nextBalance);
      if(payload.tenure==='own'&&!p.ownedProperties.includes(property.id))p.ownedProperties.push(property.id);
      let settledIncome=0;if(p.propertyInvestments[property.id]){settledIncome=investmentView(p,property,now).collectable;check(Number.isSafeInteger(settledIncome),'Your investment needs a valid income balance.','numeric_limit');p.wallet+=settledIncome;delete p.propertyInvestments[property.id];}
      const previous=p.home,settlement=archiveTenancy(previous,now,'moved-out');if(previous.tenure==='rent')packTenancyFurniture(p,previous.propertyId);check(settlement.depositRefund===refundableDeposit,'Your home deposit needs to be reviewed.','deposit_conflict');
      const tenure=property.originHome?property.gifted?'own':'starter':payload.tenure;
      p.home={propertyId:property.id,layoutId:property.layoutId||property.id,name:property.name,district:property.district,tenure,gifted:Boolean(property.gifted),rentDueAt:null,housingHistory:previous.housingHistory||[],housingDebts:previous.housingDebts||[],...(previous.starterVersion===1?{starterVersion:1,furnishingPreset:previous.furnishingPreset}:{}),...(previous.roomStyle&&(previous.layoutId||previous.propertyId)===(property.layoutId||property.id)?{roomStyle:previous.roomStyle}:{})};
      if(tenure==='rent'){p.home.tenancy=createTenancy({id:globalThis.crypto.randomUUID(),property,residentId:p.id,now});p.home.tenancy.deposit=deposit;p.home.rentDueAt=p.home.tenancy.nextRentDueAt;}
      if(p.district===property.district){p.drivingVehicle=null;p.location={kind:'home',district:p.district,venue:'home'};}else if(p.location.kind==='home')p.location={kind:'public',district:p.district,venue:'neighbourhood'};
      p.billsPaidAt=now;p.rentPaidAt=now;return {...result(cost,{deposit,settledIncome,...settlement}),settledIncome};
    }
    if(action==='move-out'){
      check(!p.activeTrip&&p.location.kind!=='visit','Finish your journey or visit before moving.','visit_active');check(p.home.tenure==='rent','You can move out of a rented home.','not_rented');
      check(!t.outstanding||payload.confirm===true,'Outstanding rent stays on your housing account after moving. Confirm the move to continue.','housing_debt_confirmation');
      const settlement=moveToTemporary(p,temporary,now);return result(0,{movedOut:true,debts:p.home.housingDebts,...settlement});
    }
    if(action==='temporary-stay'){
      check(p.home.tenure==='temporary','Your permanent home is ready. Use the hotel activity for a short visit.','permanent_home');
      const venue=venueFor(payload.venueId||'hotel'),activity=venueActionFor('hotel-rest');
      check(venue?.id==='hotel'&&venueAvailable(venue.id,p.district),'Choose an available hotel in your neighbourhood.','invalid_hotel');
      check(p.location.kind==='venue'&&p.location.venue===venue.id,'Enter the hotel before booking your temporary stay.','hotel_location');
      debit(activity.cost);p.home.name=`${venue.name} · short stay`;p.home.district=p.district;p.home.temporarySince=now;p.home.temporaryUntil=now+TENANCY_RULES.intervalMs;p.home.temporaryHotelId=venue.id;p.energy=Math.min(100,p.energy+50);return result(activity.cost,{temporary:true});
    }
    if(action==='pay-rent'||action==='renew-rent'){
      if(payload.tenancyId&&payload.tenancyId!==t?.id){
        const debt=p.home.housingDebts?.find(row=>row.id===payload.tenancyId);check(debt?.outstanding>0,'This housing balance has already been settled.','rent_not_due');
        const amount=debt.outstanding;debit(amount);debt.outstanding=0;debt.debtSettledAt=now;return result(amount,{settledTenancyId:debt.id});
      }
      check(p.home.tenure==='rent'&&t,'Your current home is not rented.','not_rented');
      // Mutate a copy first so insufficient funds cannot clear arrears even in dev storage.
      const paid=structuredClone(t),amount=payTenancy(paid,now,{early:payload.early===true});debit(amount);p.home.tenancy=paid;p.home.rentDueAt=paid.nextRentDueAt;p.rentPaidAt=now;return result(amount);
    }
    if(action==='dismiss-housing-story'){const story=t?.story||p.home.housingStory;check(story,'There is no new housing message.','story_unavailable');check(!payload.storyId||payload.storyId===story.id,'A new housing message is ready.','story_changed');story.acknowledgedAt=now;return result();}
    check(t&&p.home.tenure==='rent','Your current home is not rented.','not_rented');
    if(action==='ask-rent-time')askForTime(t,now);
    else if(action==='talk-landlord')talkToLandlord(t,now);
    else if(action==='ignore-landlord'){t.ignoreCount=(t.ignoreCount||0)+1;if(t.story)t.story.acknowledgedAt=now;}
    else answerIncrease(t,action,now);
    return result();
  } catch(error) {if(error instanceof GameError)throw error;throw new GameError(error.message,409,error.code||'invalid_housing_action');}
}

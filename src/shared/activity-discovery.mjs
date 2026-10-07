import {VENUES,VENUE_ACTIONS,venueAvailable} from './life.mjs';
import {CITY_LANDMARKS} from './city-landmarks.mjs';
import {jobSchedule,clubSchedule,abujaTime} from './simulation.mjs';

const MINUTE=60000,HOUR=60*MINUTE;
const categoryFor=venue=>venue.kind==='club'?'nightlife':/gym|fitness/i.test(venue.category||venue.name)?'fitness':/food|dining/i.test(venue.category||'')?'food':/shopping|cars|homes|tech/i.test(venue.category||'')?'explore':'social';
const landmarkById=new Map(CITY_LANDMARKS.map(place=>[place.id,place]));
const needs=[['sleep','energy','Time to recharge','Get some sleep',0],['eat','hunger','A meal would help','Eat at home',1200],['shower','hygiene','Freshen up before heading out','Take a shower',0],['relax','fun','Take a moment for yourself','Relax',0]];
export const ACTIVITY_REGISTRY=Object.freeze([
 ...needs.map(([action,need,headline,cta,cost])=>({id:`need:${action}`,category:'needs',feature:action,headline,cta,action:{kind:'home',action},need,cost,cooldown:2*HOUR})),
 {id:'career:shift',category:'career',feature:'work',headline:'Your shift is ready',cta:'Go to work',action:{kind:'work'},cooldown:HOUR},
 {id:'career:discover',category:'career',feature:'career',headline:'Find your rhythm in Abuja',cta:'Explore jobs',action:{kind:'page',page:'work'},cooldown:24*HOUR},
 ...VENUES.map(venue=>({id:`venue:${venue.id}`,category:categoryFor(venue),feature:`visit:${venue.id}`,headline:venue.name,description:venue.description,cta:venue.kind==='club'?'Plan a night out':'Choose a route',venueId:venue.id,action:{kind:'travel',venueId:venue.id},cooldown:24*HOUR})),
 ...VENUE_ACTIONS.map(activity=>({id:`activity:${activity.id}`,category:'activity',feature:activity.id,headline:activity.name,cta:'Try it here',cost:activity.cost,venueId:activity.venueId,action:{kind:'activity',activityId:activity.id},cooldown:3*HOUR})),
 {id:'feature:phone',category:'feature',feature:'phone',headline:'Your city fits in your pocket',description:'Messages, friends and plans are on your phone.',cta:'Open Phone',action:{kind:'phone'},cooldown:24*HOUR},
 {id:'feature:visits',category:'social',feature:'visits',headline:'Make room for your people',description:'Invite a friend over or request a home visit.',cta:'See visits',action:{kind:'visits'},cooldown:24*HOUR},
 {id:'feature:story',category:'story',feature:'story',headline:'The city has a story',description:'See the current city cycle and your role in it.',cta:'City Story',action:{kind:'story'},cooldown:24*HOUR},
 {id:'feature:jackpot',category:'jackpot',feature:'jackpot',headline:'See today’s Jackpot',description:'Optional paid play. Prizes are never guaranteed.',cta:'See eligibility & rooms',action:{kind:'jackpot'},cooldown:48*HOUR},
]);
export const discoveryActivity=id=>ACTIVITY_REGISTRY.find(activity=>activity.id===id)||null;
export function activityCandidates({profile,now,stats={},jackpotEligible=false}){
 if(!profile?.id||profile.activeTrip)return [];
 const hour=abujaTime(now).hour??new Date(now+HOUR).getUTCHours(),history=profile.discovery||{},loc=profile.location||{};
 return ACTIVITY_REGISTRY.flatMap(activity=>{
  const previous=history.entries?.[activity.id];if(now-Math.max(previous?.shownAt||0,previous?.dismissedAt||0,previous?.completedAt||0)<activity.cooldown)return [];
  if(now-(history.categories?.[activity.category]||0)<(activity.category==='jackpot'?48*HOUR:20*MINUTE))return [];
  let weight=history.features?.[activity.feature]?1:2.8,description=activity.description||'';
  if(activity.need){if(loc.kind!=='home'||profile[activity.need]>45||profile.wallet<activity.cost)return [];weight+=5+(45-profile[activity.need])/10;description='A little care makes the next move easier.';}
  else if(activity.id==='career:shift'){if(!profile.job)return [];const schedule=jobSchedule(profile.job,profile,now);if(!schedule.canStart)return [];description=`${schedule.currentSlot} shift · Abuja time`;weight+=6;}
  else if(activity.id==='career:discover'){if(profile.job||history.features?.career)return [];weight+=hour<17?2:0;}
  else if(activity.action.kind==='activity'){const a=VENUE_ACTIONS.find(a=>a.id===activity.action.activityId);if(loc.kind!=='venue'||loc.venue!==a.venueId||profile.wallet<a.cost||a.effects.energy<0&&profile.energy< -a.effects.energy)return [];if(VENUES.find(v=>v.id===a.venueId)?.kind==='club'&&!clubSchedule(now).isOpen)return [];}
  else if(activity.action.kind==='travel'){
   if(loc.kind==='visit'||loc.venue===activity.venueId)return [];
   const venue=VENUES.find(v=>v.id===activity.venueId),landmark=landmarkById.get(venue.id),district=landmark?.districtId|| (venueAvailable(venue.id,profile.district)?profile.district:venue.districts?.[0]);if(!district)return [];
   if(activity.category==='nightlife'&&!clubSchedule(now).isOpen)return [];
   if(activity.category==='nightlife')weight*=hour>=18||hour<5?2:0.3;
   if(activity.category==='food')weight*=hour>=11&&hour<15||hour>=18&&hour<22?1.8:0.8;
   if(activity.category==='fitness')weight*=hour<11||hour>=16&&hour<20?1.5:.7;
   const publicActivity=(stats.hotPlaces||[]).find(place=>place.venueId===venue.id&&place.district===district);
   if(publicActivity?.online>1){weight+=Math.min(4,publicActivity.online/2);description=`${publicActivity.online} visible residents at this public venue.`;}
   return [{...activity,description,weight,action:{...activity.action,districtId:district},expiresAt:now+2*MINUTE}];
  }
  else if(activity.id==='feature:jackpot'&&!jackpotEligible)return [];
  else if(history.features?.[activity.feature]&&activity.category==='feature')return [];
  return [{...activity,description,weight,expiresAt:now+2*MINUTE}];
 });
}
export function selectActivity(context,random=Math.random){
 if(random()>.55)return null;
 const candidates=activityCandidates(context),sum=candidates.reduce((total,item)=>total+item.weight,0);let chosen=random()*sum;
 return candidates.find(item=>(chosen-=item.weight)<0)||null;
}
export function discoveryCompletedFeatures(action,payload={},profile={}){
 const keys=[];if(['eat','sleep','shower','relax'].includes(action))keys.push(action);
 if(action==='venue-action')keys.push(payload.activityId);
 if(['arrive','enter-venue'].includes(action)&&profile.location?.kind==='venue')keys.push(`visit:${profile.location.venue}`);
 if(action==='arrive')keys.push('travel');if(action==='toggle-driving'&&profile.drivingVehicle)keys.push('driving');
 if(action==='take-job')keys.push('career');if(action==='complete-shift')keys.push('work');
 return keys.filter(Boolean);
}

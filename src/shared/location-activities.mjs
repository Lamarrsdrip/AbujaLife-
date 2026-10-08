// The tray and menus consume the same authoritative catalogue as the world.
// This is a pure projection of bootstrap state; no requests or presence claims.
export const HOME_ACTIVITIES=Object.freeze([
 {id:'sleep',name:'Rest',action:'sleep',animation:'sleep',duration:18},
 {id:'eat',name:'Make a meal',action:'eat',animation:'eat',duration:15},
 {id:'shower',name:'Freshen up',action:'shower',animation:'shower',duration:16},
 {id:'relax',name:'Relax',action:'relax',animation:'rest',duration:16},
]);
const services=Object.freeze({
 dealership:{name:'Browse cars',action:'dealership'},
 'estate-office':{name:'Explore homes',action:'estate-office'},
 banex:{name:'Browse tech',action:'banex-market'},
 'furniture-store':{name:'Browse the marketplace',action:'furniture-store'},
 'games-lounge':{name:'Game Naira dice',action:'play-dice'},
});
export function locationActivities(state){
 const profile=state.profile,location=profile?.location;
 if(!profile?.onboardingComplete||profile.activeTrip||!location)return null;
 const venue=state.venues?.find(v=>v.id===(location.venueId||location.venue));
 let items=[],name='',key=[profile.id,profile.district,location.kind,location.venueId||location.venue||'',location.ownerId||location.residentId||location.visitId||''].join(':');
 if(location.kind==='home'){
  name=profile.home?.name||'Home';
  items=HOME_ACTIVITIES.map(item=>({...item,cost:state.activities?.[item.action]?.cost||0,effects:state.activities?.[item.action]?.effects||{}}));
 }else if(location.kind==='venue'&&venue){
  name=venue.name;
  items=(state.venueActions||[]).filter(a=>a.venueId===venue.id||(venue.activities||venue.actions||[]).includes(a.id)).map(a=>({...a,action:'venue-action',payload:{activityId:a.id}}));
  const service=services[venue.id];if(service)items.unshift({id:`service:${venue.id}`,cost:0,...service});
 }else return null;
 items=items.map(item=>{
  const closed=venue?.kind==='club'&&!state.clubSchedule?.isOpen;
  const energy=Math.max(0,-Number(item.effects?.energy||0));
  const unavailable=closed?'Opens '+(state.clubSchedule?.openingHours||'Wed, Fri & Sat · 20:00–02:00 WAT'):
   profile.wallet<item.cost?'Need ₦'+new Intl.NumberFormat('en-NG').format(item.cost):profile.energy<energy?'Rest first':null;
  return {...item,unavailable};
 });
 return items.length?{key,name,items}:null;
}

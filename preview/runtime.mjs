/** Browser-only public preview. This adapter never connects to the game server. */
import data from './data.mjs';
import { LIFE_GOALS, GAME_YEAR_MS, GAME_BILL_PERIOD_MS, WALLET_META, INVESTMENT_META, DICE_META, homeBenefits, investmentView, venueFor, venueAvailable, venueActionFor, applyNeedEffects, furniturePlacement, ownsVehicle } from '../src/shared/life.mjs';
import { vehicleColorFor } from '../src/shared/vehicles.mjs';

const STORAGE_KEY = 'abujalife.browser-preview.v1';
const PLAYER_ID = 'browser-preview';
const publicData = data.bootstrap || data;
const allJobs = data.jobs || publicData.jobs || {};
const atlas = new Map((publicData.atlas || []).map(place => [place.id, place]));
const catalog = publicData.catalog || [];
const properties = publicData.properties || [];
const appearanceOptions = publicData.appearanceOptions || {};
const clone = value => structuredClone(value);
const uid = () => globalThis.crypto?.randomUUID?.() || `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clamp = value => Math.max(0, Math.min(100, Math.round(value)));
const clean = (value, max = 80) => String(value ?? '').trim().slice(0, max);
const streams = new Set();
let storageAvailable = true;

class PreviewError extends Error {
  constructor(message, status = 400, code = 'invalid_action') { super(message); this.status = status; this.code = code; }
}
function check(condition, message, status = 400, code) { if (!condition) throw new PreviewError(message, status, code); }
function unavailable() { throw new PreviewError('Public multiplayer is unavailable in this browser preview. No message, invitation or event was sent.', 503, 'browser_preview_only'); }

function initialState() {
  const timestamp = Date.now();
  return {
    version: 1,
    profile: {
      id: PLAYER_ID, username: 'preview_resident', displayName: 'Preview resident',
      appearance: { skinTone:'brown', face:'oval', body:'regular', hair:'crop', facialHair:'none', presentation:'neutral', top:'forest', bottom:'charcoal', shoes:'white', accessory:'none' },
      wallet:26000, energy:82, hunger:72, hygiene:88, social:58, fun:64, stress:12, mood:76, reputation:0,
      district:'garki-i', location:{kind:'home',district:'garki-i',venue:'home'},
      home:{propertyId:'garki-studio',name:'Garki starter studio',district:'garki-i',tenure:'starter'},
      job:null, careerLevel:1, skills:{}, inventory:[], ownedProperties:[],
      onboardingComplete:false, lifeGoal:'explore', drivingVehicle:null, furnitureLayout:{},storedFurniture:[],
      propertyInvestments:{},vehicleColors:{},gambleHistory:[],lastGambleRound:null,
      settings:{presenceVisible:false,allowInvites:false,soundEnabled:true},
      activeTrip:null, activeShift:null, completedShifts:0, nextShiftAt:0,
      lastActionAt:timestamp, billsPaidAt:timestamp, rentPaidAt:timestamp, createdAt:timestamp
    },
    challenge:null, completedChallenges:{},economyOperations:{},
    notifications:[{id:uid(),kind:'preview',title:'Your browser preview',body:'Explore on your own. Progress saves in this browser; public multiplayer is unavailable.',link:'home',createdAt:timestamp,readAt:null}],
    transactions:[{id:uid(),amount:26000,reason:'Preview starting balance',createdAt:timestamp}]
  };
}
function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || saved.profile?.id !== PLAYER_ID || !atlas.has(saved.profile.district) || !Number.isSafeInteger(saved.profile.wallet) || saved.profile.wallet < 0) return initialState();
    const initial = initialState();
    const restored = {...initial,...saved,profile:{...initial.profile,...saved.profile}};
    restored.profile.appearance = {...initial.profile.appearance,...saved.profile.appearance};
    restored.profile.settings = {...initial.profile.settings,...saved.profile.settings};
    restored.profile.inventory = (saved.profile.inventory || []).filter(id=>catalog.some(item=>item.id===id));
    restored.profile.ownedProperties = (saved.profile.ownedProperties || []).filter(id=>properties.some(item=>item.id===id));
    restored.profile.vehicleColors={};
    for(const [itemId,color] of Object.entries(saved.profile.vehicleColors||{}))if(ownsVehicle(restored.profile,catalog,itemId)&&vehicleColorFor(color))restored.profile.vehicleColors[itemId]=color;
    restored.profile.propertyInvestments={};
    for(const [propertyId,investment] of Object.entries(saved.profile.propertyInvestments||{})) {
      if(restored.profile.ownedProperties.includes(propertyId)&&properties.some(item=>item.id===propertyId)&&investment&&['boughtAt','lastCollectedAt','incomePerPeriod','resaleValue'].every(key=>Number.isSafeInteger(investment[key])&&investment[key]>=0))restored.profile.propertyInvestments[propertyId]=investment;
    }
    restored.profile.gambleHistory=Array.isArray(saved.profile.gambleHistory)?saved.profile.gambleHistory.slice(-20):[];
    restored.profile.lastGambleRound=saved.profile.lastGambleRound||null;
    // Existing visitors keep their money, home and purchases, and get the new
    // resident questions once. No preview save is wiped by this upgrade.
    restored.profile.onboardingComplete = saved.profile.onboardingComplete === true;
    restored.profile.lifeGoal = LIFE_GOALS.some(goal=>goal.id===saved.profile.lifeGoal)?saved.profile.lifeGoal:'explore';
    restored.profile.rentPaidAt=saved.profile.rentPaidAt??saved.profile.billsPaidAt??saved.profile.createdAt??initial.profile.rentPaidAt;
    restored.profile.drivingVehicle = restored.profile.location?.kind==='public'&&ownsVehicle(restored.profile,catalog,saved.profile.drivingVehicle)?saved.profile.drivingVehicle:null;
    restored.profile.storedFurniture=[...new Set((saved.profile.storedFurniture||[]).filter(id=>catalog.some(item=>item.id===id&&item.category==='furniture'&&restored.profile.inventory.includes(id))))];
    restored.profile.furnitureLayout={};
    for(const [itemId,placement] of Object.entries(saved.profile.furnitureLayout||{})) {
      if(!catalog.some(item=>item.id===itemId&&item.category==='furniture'&&restored.profile.inventory.includes(itemId)))continue;
      try {restored.profile.furnitureLayout[itemId]=furniturePlacement(placement);}catch {/* Discard only the invalid placement. */}
    }
    if(restored.profile.location?.kind==='venue'&&!venueFor(restored.profile.location.venue))restored.profile.location={kind:'public',district:restored.profile.district,venue:'neighbourhood'};
    if (restored.profile.job && !Object.hasOwn(allJobs,restored.profile.job)) { restored.profile.job=null; restored.profile.activeShift=null; restored.challenge=null; }
    if (!Array.isArray(restored.notifications) || !Array.isArray(restored.transactions)) return initialState();
    if (restored.challenge && !Object.hasOwn(allJobs,restored.challenge.jobId)) { restored.challenge=null; restored.profile.activeShift=null; }
    if (!restored.completedChallenges || typeof restored.completedChallenges!=='object') restored.completedChallenges={};
    if(!restored.economyOperations||typeof restored.economyOperations!=='object'||Array.isArray(restored.economyOperations))restored.economyOperations={};
    return restored;
  } catch { return initialState(); }
}
let state = restore();
function persist() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); storageAvailable=true; }
  catch { storageAvailable=false; document.documentElement.dataset.previewStorage='memory'; dispatchEvent(new Event('abujalife:preview-storage-unavailable')); }
}
function emit(type, value) { for (const stream of streams) if (stream.readyState===1) stream.dispatchEvent(new MessageEvent(type,{data:JSON.stringify(value)})); }
function publicJobs() { return Object.fromEntries(Object.entries(allJobs).map(([id,{tasks,...job}])=>[id,job])); }
function challengeView() {
  if (!state.challenge) return null;
  const job=allJobs[state.challenge.jobId];
  return {...state.challenge,title:job.title,tasks:(job.tasks||[]).map(({answer,...task})=>clone(task))};
}
function bootstrap() {
  return {
    ...clone(publicData), walletMeta:{...clone(WALLET_META),transferEnabled:false}, jobs:publicJobs(), authenticated:true, profile:clone(state.profile), activeChallenge:challengeView(),
    people:[],friends:[],friendRequests:[],conversations:[],nearby:[],invitations:[],events:[],blocked:[],muted:[],
    notifications:clone(state.notifications),transactions:clone(state.transactions).slice(-60).reverse(),
    preview:{mode:'browser',multiplayer:false,storage:storageAvailable?'localStorage':'memory'}
  };
}
function updateAppearance(profile, incoming) {
  if (!incoming || typeof incoming!=='object') return;
  for (const key of Object.keys(profile.appearance)) if (incoming[key] !== undefined) {
    const values=appearanceOptions[key];
    check(typeof incoming[key]==='string'&&(!values||values.includes(incoming[key])),`Choose a supported ${key}`);
    if(key==='top'&&!['forest','ochre'].includes(incoming[key])) {
      const item=catalog.find(item=>item.category==='clothing'&&item.slot==='top'&&item.value===incoming[key]);
      check(item&&profile.inventory.includes(item.id),'Buy this outfit in Okrika Marketplace before wearing it',403,'outfit_not_owned');
    }
    profile.appearance[key]=incoming[key];
  }
}
function quote(payload) {
  const destination=clean(payload.district),mode=clean(payload.mode||'bus',16),profile=state.profile;
  check(atlas.has(destination),'Choose a location from the Abuja atlas');
  check(['walk','bus','taxi','ride','car'].includes(mode),'Choose a supported transport mode');
  check(mode!=='walk'||destination===profile.district,'Walking is available within your neighbourhood; choose transport for this trip');
  check(mode!=='car'||catalog.some(item=>ownsVehicle(profile,catalog,item.id)),'Buy a car before choosing your own vehicle');
  const same=destination===profile.district,distance=same?0:Math.max(4,Math.round(((atlas.get(destination).commute||35)+(atlas.get(profile.district).commute||35))/3));
  const cost=same?0:mode==='bus'?250+distance*20:mode==='car'?350+distance*20:mode==='taxi'?650+distance*45:900+distance*45;
  const seconds=same?1:Math.min(14,Math.max(4,Math.round(distance/(mode==='bus'?2.5:4))));
  return {destination,mode,cost,seconds};
}
function economyOperation(kind,payload,normalized,mutate) {
  const key=payload.idempotencyKey;
  check(typeof key==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(key),'Use a valid idempotency key for this money action',400,'idempotency_required');
  const fingerprint=JSON.stringify(normalized),existing=Object.hasOwn(state.economyOperations,key)?state.economyOperations[key]:null;
  if(existing) {
    check(existing.kind===kind&&existing.fingerprint===fingerprint,'This request key was already used for a different action',409,'idempotency_conflict');
    return{ok:true,profile:clone(state.profile),...clone(existing.result),replayed:true};
  }
  const next=clone(state),profile=next.profile,timestamp=Date.now(),before=profile.wallet;
  const extra=mutate(profile,timestamp,next);
  check(Number.isSafeInteger(profile.wallet)&&profile.wallet>=0&&profile.wallet<=WALLET_META.maxBalance,'This action would exceed your game wallet limit',409,'wallet_limit');
  profile.lastActionAt=timestamp;
  if(profile.wallet!==before)next.transactions.push({id:uid(),amount:profile.wallet-before,reason:extra.ledgerReason||kind,createdAt:timestamp});
  next.transactions=next.transactions.slice(-100);
  const {ledgerReason,...publicExtra}=extra;
  // Keep request results across reloads: a repeated tap never charges twice or rerolls.
  Object.defineProperty(next.economyOperations,key,{value:{kind,fingerprint,result:clone(publicExtra),amount:kind==='demo-topup'?normalized.amount:0,createdAt:timestamp},enumerable:true,writable:true,configurable:true});
  state=next;persist();queueMicrotask(()=>emit('profile',{profile:clone(state.profile)}));
  return{ok:true,profile:clone(profile),...publicExtra,replayed:false};
}
function topup(payload) {
  check(!Object.hasOwn(payload,'verified'),'Real-money payments require a verified payment provider; use a free game top-up',403,'payments_unavailable');
  const amount=payload.amount;
  check(Number.isSafeInteger(amount)&&amount>=WALLET_META.topupMin&&amount<=WALLET_META.topupMax,`Choose a free game top-up of ₦${WALLET_META.topupMin.toLocaleString()}–₦${WALLET_META.topupMax.toLocaleString()}`,400,'invalid_topup');
  return economyOperation('demo-topup',payload,{amount},(profile,timestamp,next)=>{
    const used=Object.values(next.economyOperations).filter(operation=>operation.kind==='demo-topup'&&operation.createdAt>timestamp-WALLET_META.topupWindowMs).reduce((total,operation)=>total+operation.amount,0);
    check(used+amount<=WALLET_META.topupDailyLimit,'Your free game top-up limit is ₦20,000,000 in 24 hours',409,'topup_limit');
    profile.wallet+=amount;
    return{topup:{id:uid(),amount,virtual:true,createdAt:timestamp},ledgerReason:'Free game Naira top-up'};
  });
}
function vehicleAction(name,payload) {
  const item=catalog.find(item=>item.id===payload.itemId&&item.category==='vehicle');
  check(item,'Choose a car from the garage');const color=payload.color??item.defaultColor;
  check(vehicleColorFor(color)&&item.availableColors.includes(color),'Choose an available car colour');
  return economyOperation(name,payload,{itemId:item.id,color},profile=>{
    if(name==='purchase') {
      check(!profile.inventory.includes(item.id),'You already own this item',409,'item_owned');
      check(profile.wallet>=item.price,'You need more Naira for this',409,'insufficient_balance');profile.wallet-=item.price;profile.inventory.push(item.id);
    }else check(profile.inventory.includes(item.id),'You can repaint a car you own',403,'vehicle_not_owned');
    profile.vehicleColors[item.id]=color;
    return{item:clone(item),ledgerReason:name==='purchase'?`Car purchase · ${item.name}`:'Car repaint'};
  });
}
function investmentAction(name,payload) {
  const property=properties.find(item=>item.id===payload.propertyId&&item.tier>0);
  check(property,'Choose a listed investment property');
  return economyOperation(name,payload,{propertyId:property.id},(profile,timestamp)=>{
    check(!profile.activeTrip,'Finish your journey before changing property ownership');
    check(profile.home.propertyId!==property.id,'Your current home cannot be rented out or sold',409,'primary_home');
    if(name==='buy-investment') {
      check(!profile.propertyInvestments[property.id],'You already rent out this property',409,'investment_owned');
      const alreadyOwned=profile.ownedProperties.includes(property.id),cost=alreadyOwned?0:property.buy;
      check(profile.wallet>=cost,'You need more Naira to buy this property',409,'insufficient_balance');profile.wallet-=cost;
      if(!alreadyOwned)profile.ownedProperties.push(property.id);
      profile.propertyInvestments[property.id]={propertyId:property.id,boughtAt:timestamp,lastCollectedAt:timestamp,purchasePrice:property.buy,incomePerPeriod:property.investmentIncome,resaleValue:property.investmentResale};
      return{investment:investmentView(profile,property,timestamp),ledgerReason:`Investment purchase · ${property.name}`};
    }
    check(profile.ownedProperties.includes(property.id)&&profile.propertyInvestments[property.id],'You do not own this rental investment',403,'investment_not_owned');
    const investment=investmentView(profile,property,timestamp);
    if(name==='collect-rent') {
      check(investment.collectable>0,'Rent is not ready yet; it accrues every minute',409,'rent_not_ready');
      profile.wallet+=investment.collectable;
      const periods=Math.max(0,Math.floor((timestamp-investment.lastCollectedAt)/INVESTMENT_META.periodMs));
      profile.propertyInvestments[property.id].lastCollectedAt+=periods*INVESTMENT_META.periodMs;
      return{income:{propertyId:property.id,amount:investment.collectable,createdAt:timestamp},investment:investmentView(profile,property,timestamp),ledgerReason:`Rental income · ${property.name}`};
    }
    check(timestamp>=investment.canSellAt,'Hold the investment for one minute before selling',409,'investment_cooldown');
    const amount=investment.resaleValue+investment.collectable;profile.wallet+=amount;
    delete profile.propertyInvestments[property.id];profile.ownedProperties=profile.ownedProperties.filter(item=>item!==property.id);
    return{sale:{propertyId:property.id,amount,resaleValue:investment.resaleValue,rentalIncome:investment.collectable,createdAt:timestamp},ledgerReason:`Investment sale · ${property.name}`};
  });
}
function playDice(payload) {
  const stake=payload.stake,choice=payload.choice;
  check(Number.isSafeInteger(stake)&&stake>=DICE_META.minStake&&stake<=DICE_META.maxStake,'Choose a whole Naira stake of ₦100–₦5,000',400,'invalid_stake');
  check(DICE_META.choices.some(item=>item.id===choice),'Choose low (1–3) or high (4–6)',400,'invalid_choice');
  return economyOperation('play-dice',payload,{stake,choice},(profile,timestamp)=>{
    check(!profile.activeTrip&&profile.location.kind==='venue'&&profile.location.venue==='games-lounge','Enter Dice & Chill Lounge before playing',400,'wrong_venue');
    check(profile.wallet>=stake,'You need more Naira for this stake',409,'insufficient_balance');
    const random=new Uint32Array(1),ceiling=Math.floor(4294967296/6)*6;
    do{globalThis.crypto.getRandomValues(random);}while(random[0]>=ceiling);
    const die=random[0]%6+1,won=choice==='low'?die<=3:die>=4,payout=won?stake*DICE_META.payoutMultiplier:0;
    const round={id:uid(),stake,choice,die,won,payout,net:payout-stake,createdAt:timestamp,virtual:true};profile.wallet+=round.net;
    profile.gambleHistory=[round,...profile.gambleHistory].slice(0,20);profile.lastGambleRound=round;
    return{round,ledgerReason:won?'Dice lounge · win':'Dice lounge · loss'};
  });
}
function action(name,payload={}) {
  if(name==='topup'||name==='demo-topup')return topup(payload);
  if(name==='transfer-naira')throw new PreviewError('Naira transfers connect registered residents in the full game. This browser preview has no shared wallet or other residents.',503,'browser_preview_only');
  if(['buy-investment','collect-rent','sell-investment'].includes(name))return investmentAction(name,payload);
  if(name==='play-dice')return playDice(payload);
  if(payload.idempotencyKey&&(name==='paint-vehicle'||(name==='purchase'&&catalog.some(item=>item.id===payload.itemId&&item.category==='vehicle'))))return vehicleAction(name,payload);
  // Work on a copy so rejected purchases or task submissions leave progress intact.
  const next=clone(state),profile=next.profile,before=profile.wallet,timestamp=Date.now(),comfort=homeBenefits(profile,properties.find(item=>item.id===profile.home.propertyId));let extra={};
  const debit=amount=>{check(Number.isSafeInteger(amount)&&amount>=0,'Invalid cost');check(profile.wallet>=amount,'You need more Naira for this');profile.wallet-=amount;};
  const home=()=>check(profile.location.kind==='home','Go home to use this object');
  const outside=()=>check(profile.location.kind==='public'&&!profile.activeTrip,'Head out into your neighbourhood first');
  if(profile.activeTrip&&!['arrive','topup'].includes(name))throw new PreviewError('Your journey is still in progress');
  const elapsed=Math.min(120,Math.max(0,(timestamp-profile.lastActionAt)/60000));
  if(elapsed>1) {profile.energy=clamp(profile.energy-elapsed*.10);profile.hunger=clamp(profile.hunger-elapsed*.12);profile.social=clamp(profile.social-elapsed*.05);}
  switch(name) {
    case 'eat':home();debit(publicData.activities?.eat?.cost??1200);profile.hunger=clamp(profile.hunger+34);profile.mood=clamp(profile.mood+4);break;
    case 'sleep':home();profile.energy=clamp(profile.energy+46+comfort.sleepEnergyBonus);profile.hunger=clamp(profile.hunger-9);profile.stress=clamp(profile.stress-12);break;
    case 'shower':home();profile.hygiene=clamp(profile.hygiene+42);profile.mood=clamp(profile.mood+2);break;
    case 'relax':home();profile.fun=clamp(profile.fun+22+comfort.relaxFunBonus);profile.stress=clamp(profile.stress-14-comfort.relaxStressReduction);profile.energy=clamp(profile.energy+8);break;
    case 'hangout':outside();debit(publicData.activities?.hangout?.cost??2400);profile.social=clamp(profile.social+28);profile.fun=clamp(profile.fun+20);profile.energy=clamp(profile.energy-8);break;
    case 'exercise':outside();debit(publicData.activities?.exercise?.cost??800);profile.fun=clamp(profile.fun+12);profile.stress=clamp(profile.stress-18);profile.energy=clamp(profile.energy-14);profile.hygiene=clamp(profile.hygiene-10);break;
    case 'cinema':outside();debit(publicData.activities?.cinema?.cost??3800);profile.fun=clamp(profile.fun+34);profile.stress=clamp(profile.stress-16);profile.energy=clamp(profile.energy-5);break;
    case 'leave-home':home();profile.drivingVehicle=null;profile.location={kind:'public',district:profile.district,venue:'neighbourhood'};break;
    case 'enter-home':check(profile.district===profile.home.district,'Travel to your home neighbourhood first');check(!profile.drivingVehicle,'Park your car before entering');check(['public','home'].includes(profile.location.kind),'Head outside before entering your home');profile.location={kind:'home',district:profile.district,venue:'home'};break;
    case 'enter-venue': {
      outside();const venue=venueFor(payload.venueId);check(venue&&venueAvailable(venue.id,profile.district),'Choose a place in your neighbourhood');
      check(!payload.district||payload.district===profile.district,'Travel to this neighbourhood first');
      check(!profile.drivingVehicle,'Park your car before entering');
      profile.location={kind:'venue',district:profile.district,venue:venue.id};extra.venue=clone(venue);break;
    }
    case 'exit-venue':check(profile.location.kind==='venue','You are already outside');profile.drivingVehicle=null;profile.location={kind:'public',district:profile.district,venue:'neighbourhood'};break;
    case 'venue-action': {
      const activity=venueActionFor(payload.activityId);
      check(activity,'Choose an activity from this place');
      check(profile.location.kind==='venue'&&profile.location.venue===activity.venueId,'Enter this place before using its facilities');
      check(!(activity.effects.energy<0)||profile.energy>=-activity.effects.energy,'Rest before doing this activity');
      debit(activity.cost);applyNeedEffects(profile,activity.effects);
      if(activity.skill)profile.skills[activity.skill]=(profile.skills[activity.skill]||0)+1;
      extra.activity={...clone(activity),startedAt:timestamp};break;
    }
    case 'toggle-driving': {
      outside();const vehicleId=payload.vehicleId??null;
      check(vehicleId===null||ownsVehicle(profile,catalog,vehicleId),'Buy this car before taking the wheel');
      profile.drivingVehicle=vehicleId;if(vehicleId)extra.vehicle=clone(catalog.find(item=>item.id===vehicleId));break;
    }
    case 'place-furniture': {
      home();const item=catalog.find(item=>item.id===payload.itemId);
      check(item?.category==='furniture'&&profile.inventory.includes(item.id),'Buy this furniture before placing it');
      let placement;try{placement=furniturePlacement(payload);}catch(error){throw new PreviewError(error.message);}
      profile.furnitureLayout||={};profile.furnitureLayout[item.id]=placement;profile.storedFurniture=profile.storedFurniture.filter(id=>id!==item.id);extra.placement={itemId:item.id,...clone(placement)};break;
    }
    case 'store-furniture': {home();const item=catalog.find(item=>item.id===payload.itemId);check(item?.category==='furniture'&&profile.inventory.includes(item.id),'You can store furniture you own');delete profile.furnitureLayout[item.id];if(!profile.storedFurniture.includes(item.id))profile.storedFurniture.push(item.id);extra.storedItemId=item.id;break;}
    case 'return-home':case 'travel': {
      const destination=name==='return-home'?profile.home.district:payload.district;
      if(name==='return-home'&&destination===profile.district) { profile.drivingVehicle=null;profile.location={kind:'home',district:profile.district,venue:'home'};break; }
      const fare=quote({district:destination,mode:payload.mode});debit(fare.cost);
      const vehicleId=fare.mode==='car'?(ownsVehicle(profile,catalog,profile.drivingVehicle)?profile.drivingVehicle:catalog.find(item=>ownsVehicle(profile,catalog,item.id))?.id):null;
      profile.activeTrip={id:uid(),...fare,vehicleId,arrivesAt:timestamp+fare.seconds*1000,returningHome:name==='return-home'};
      profile.drivingVehicle=null;
      profile.location={kind:'transit',district:profile.district,venue:'journey'};extra.trip=clone(profile.activeTrip);break;
    }
    case 'arrive': {
      const trip=profile.activeTrip;check(trip&&trip.id===payload.tripId,'This journey is no longer active');check(timestamp>=trip.arrivesAt,'Your journey is still in progress',409,'trip_in_progress');
      profile.district=trip.destination;profile.location={kind:trip.returningHome?'home':'public',district:trip.destination,venue:trip.returningHome?'home':'neighbourhood'};profile.drivingVehicle=!trip.returningHome&&trip.mode==='car'&&ownsVehicle(profile,catalog,trip.vehicleId)?trip.vehicleId:null;profile.activeTrip=null;profile.energy=clamp(profile.energy-3);break;
    }
    case 'take-job':check(typeof payload.jobId==='string'&&Object.hasOwn(allJobs,payload.jobId),'Choose a listed job');check(!next.challenge,'Finish your current shift before switching careers');profile.job=payload.jobId;break;
    case 'start-shift': {
      const job=allJobs[profile.job];check(job,'Choose a job before starting a shift');outside();check(profile.district===job.district,`Travel to ${atlas.get(job.district)?.name||job.district} for your shift`);
      if(next.challenge) { extra.challenge=challengeView();break; }
      check(timestamp>=profile.nextShiftAt,'Take a moment between shifts',409,'shift_cooldown');check(profile.energy>=job.energy,'Rest before starting another shift');check(Array.isArray(job.tasks)&&job.tasks.length>0,'This job is unavailable in the preview');
      next.challenge={id:uid(),jobId:profile.job,startedAt:timestamp};profile.activeShift=next.challenge.id;
      extra.challenge={...next.challenge,title:job.title,tasks:job.tasks.map(({answer,...task})=>clone(task))};break;
    }
    case 'complete-shift': {
      if(Object.hasOwn(next.completedChallenges,payload.challengeId||'')) {extra.result=next.completedChallenges[payload.challengeId];break;}
      const challenge=next.challenge;check(challenge&&challenge.id===payload.challengeId,'Shift not found');const job=allJobs[challenge.jobId];
      check(profile.district===job.district&&profile.location.kind==='public','Complete your shift at the workplace');check(timestamp-challenge.startedAt>=1500,'Read the tasks before submitting your shift',409,'shift_too_fast');
      check(Array.isArray(payload.answers)&&payload.answers.length===job.tasks.length,'Answer each shift task');const answers=new Map(payload.answers.map(answer=>[answer.taskId,answer.optionId]));
      check(answers.size===job.tasks.length&&job.tasks.every(task=>task.options.some(option=>option.id===answers.get(task.id))),'Choose one valid answer for every task');
      const correct=job.tasks.filter(task=>answers.get(task.id)===task.answer).length,pay=Math.round(job.pay*(.4+.6*correct/job.tasks.length));
      profile.wallet+=pay;profile.energy=clamp(profile.energy-job.energy);profile.hunger=clamp(profile.hunger-10);profile.stress=clamp(profile.stress+8);profile.reputation+=correct===job.tasks.length?2:1;profile.completedShifts++;profile.skills[job.skill]=(profile.skills[job.skill]||0)+correct;profile.careerLevel=1+Math.floor(profile.completedShifts/5);profile.activeShift=null;profile.nextShiftAt=timestamp+20000;
      extra.result={challengeId:challenge.id,pay,correct,total:job.tasks.length,careerLevel:profile.careerLevel};next.completedChallenges[challenge.id]=extra.result;next.challenge=null;
      const old=Object.keys(next.completedChallenges);if(old.length>200)delete next.completedChallenges[old[0]];break;
    }
    case 'work-shift':throw new PreviewError('Start a shift and complete its work tasks to earn your salary');
    case 'purchase': {const item=catalog.find(item=>item.id===payload.itemId);check(item,'Choose an item from Okrika Marketplace');check(!profile.inventory.includes(item.id),'You already own this item',409);if(item.category==='vehicle'){const color=payload.color??item.defaultColor;check(vehicleColorFor(color)&&item.availableColors.includes(color),'Choose an available car colour');profile.vehicleColors[item.id]=color;}debit(item.price);profile.inventory.push(item.id);extra.item=clone(item);break;}
    case 'paint-vehicle': {const item=catalog.find(item=>item.id===payload.itemId&&item.category==='vehicle');check(item&&profile.inventory.includes(item.id),'You can repaint a car you own',403,'vehicle_not_owned');check(vehicleColorFor(payload.color)&&item.availableColors.includes(payload.color),'Choose an available car colour');profile.vehicleColors[item.id]=payload.color;extra.item=clone(item);break;}
    case 'equip': {const item=catalog.find(item=>item.id===payload.itemId);check(item?.category==='clothing'&&profile.inventory.includes(item.id),'You can wear clothing you own');profile.appearance[item.slot]=item.value;break;}
    case 'move-home': {
      const property=properties.find(item=>item.id===payload.propertyId);check(property&&property.tier>0,'Choose a listed home');check(['rent','own'].includes(payload.tenure),'Choose rent or ownership');check(profile.home.propertyId!==property.id||profile.home.tenure!==payload.tenure,'You already live here');
      check(!(payload.tenure==='rent'&&profile.ownedProperties.includes(property.id)),'You already own this property; choose Move in',409,'already_owned');
      debit(payload.tenure==='rent'?property.rent:profile.ownedProperties.includes(property.id)?0:property.buy??property.price);if(payload.tenure==='own'&&!profile.ownedProperties.includes(property.id))profile.ownedProperties.push(property.id);
      if(profile.propertyInvestments[property.id]){const investment=investmentView(profile,property,timestamp);profile.wallet+=investment.collectable;extra.settledIncome=investment.collectable;delete profile.propertyInvestments[property.id];}
      profile.home={propertyId:property.id,name:property.name,district:property.district,tenure:payload.tenure,rentDueAt:payload.tenure==='rent'?timestamp+GAME_YEAR_MS:null};
      if(profile.district===property.district){profile.drivingVehicle=null;profile.location={kind:'home',district:profile.district,venue:'home'};}else if(profile.location.kind==='home')profile.location={kind:'public',district:profile.district,venue:'neighbourhood'};profile.billsPaidAt=timestamp;profile.rentPaidAt=timestamp;break;
    }
    case 'pay-bills': {check(timestamp-profile.billsPaidAt>=GAME_BILL_PERIOD_MS,'Your home bills are up to date');const property=properties.find(item=>item.id===profile.home.propertyId);check(property,'Your home listing is unavailable');const amount=Math.round(property.bills*(100-comfort.billDiscountPercent)/100);debit(amount);profile.billsPaidAt=timestamp;extra.bill={amount,baseAmount:property.bills,discountPercent:comfort.billDiscountPercent};break;}
    case 'renew-rent': {
      check(profile.home.tenure==='rent','Only a rented home needs a rent renewal');
      const property=properties.find(item=>item.id===profile.home.propertyId);check(property,'Your home listing is unavailable');
      check(timestamp-profile.rentPaidAt>=GAME_YEAR_MS,'Your rent is already paid for this game year');
      debit(property.rent);profile.rentPaidAt=timestamp;profile.home.rentDueAt=timestamp+GAME_YEAR_MS;break;
    }
    default:throw new PreviewError('Unknown preview action');
  }
  check(Number.isSafeInteger(profile.wallet)&&profile.wallet>=0&&profile.wallet<=WALLET_META.maxBalance,'This action would exceed your game wallet limit',409,'wallet_limit');profile.lastActionAt=timestamp;if(profile.wallet!==before)next.transactions.push({id:uid(),amount:profile.wallet-before,reason:name,createdAt:timestamp});next.transactions=next.transactions.slice(-100);
  state=next;persist();queueMicrotask(()=>emit('profile',{profile:clone(state.profile)}));return{ok:true,profile:clone(profile),...extra};
}
function handleApi(url,method,body) {
  const route=url.pathname;
  if(route==='/api/health'&&method==='GET')return{ok:true,service:'AbujaLife browser preview',storage:storageAvailable?'localStorage':'memory'};
  if(route==='/api/bootstrap'&&method==='GET')return bootstrap();
  if(route==='/api/wallet'&&method==='GET')return{ok:true,profile:clone(state.profile),transactions:clone(state.transactions).slice(-60).reverse(),walletMeta:{...clone(WALLET_META),transferEnabled:false}};
  if(route==='/api/wallet/topup'&&method==='POST')return action('demo-topup',body);
  if(route==='/api/wallet/transfer'&&method==='POST')throw new PreviewError('Naira transfers connect registered residents in the full game. This browser preview has no shared wallet or other residents.',503,'browser_preview_only');
  if(route==='/api/travel/quote'&&method==='GET')return{ok:true,quote:quote({district:url.searchParams.get('district'),mode:url.searchParams.get('mode')||'bus'})};
  if(route==='/api/action'&&method==='POST')return action(body.action,body.payload||{});
  if(route==='/api/profile'&&method==='POST') {
    const profile=clone(state.profile);
    if(body.displayName!==undefined){check(clean(body.displayName,40).length>=2,'Display name must have at least two characters');profile.displayName=clean(body.displayName,40);}
    updateAppearance(profile,body.appearance);
    if(body.lifeGoal!==undefined){check(LIFE_GOALS.some(goal=>goal.id===body.lifeGoal),'Choose a listed life goal');profile.lifeGoal=body.lifeGoal;}
    if(body.onboardingComplete!==undefined){check(typeof body.onboardingComplete==='boolean','Choose a valid onboarding state');profile.onboardingComplete=body.onboardingComplete;}
    if(body.settings&&typeof body.settings==='object')for(const key of ['presenceVisible','allowInvites','soundEnabled'])if(typeof body.settings[key]==='boolean')profile.settings[key]=body.settings[key];
    state.profile=profile;persist();queueMicrotask(()=>emit('profile',{profile:clone(profile)}));return{ok:true,profile:clone(profile)};
  }
  if(route==='/api/notifications/read'&&method==='POST'){for(const notice of state.notifications)if(!body.id||notice.id===body.id)notice.readAt=Date.now();persist();return{ok:true,notifications:clone(state.notifications)};}
  if(route==='/api/presence'&&method==='POST')return{ok:true,people:[],nearby:[],preview:true};
  if(route==='/api/chat/location'&&method==='GET')return{ok:true,messages:[],preview:true};
  // A preview has no credential session. Sign-out leaves the local preview intact.
  if(route==='/api/auth/logout'&&method==='POST')return{ok:true,authenticated:true,preview:true};
  if(route.startsWith('/api/auth/'))throw new PreviewError('This preview opens without an account. Your progress belongs to this browser only.',400,'browser_preview_only');
  if(['/api/chat/','/api/friends/','/api/conversations','/api/invitations','/api/events','/api/moderation/','/api/typing'].some(prefix=>route.startsWith(prefix)))unavailable();
  throw new PreviewError('This feature is unavailable in the browser preview',404,'preview_not_found');
}

const realFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=async(input,options={})=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return realFetch(input,options);
  try {
    const signal=options.signal||(input instanceof Request?input.signal:undefined);if(signal?.aborted)throw new DOMException('The operation was aborted','AbortError');
    const method=(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();let body={};
    const raw=options.body??(input instanceof Request&&method!=='GET'?await input.clone().text():undefined);
    if(raw!==undefined&&raw!==null){try{body=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw new PreviewError('Use valid JSON for this preview action');}check(body&&typeof body==='object'&&!Array.isArray(body),'Use a JSON object for this preview action');}
    const result=handleApi(url,method,body);return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  } catch(error) {
    if(error.name==='AbortError')throw error;
    return new Response(JSON.stringify({ok:false,error:error instanceof PreviewError?error.message:'This preview could not complete the action. Try resetting the preview.',code:error.code||'preview_error'}),{status:error.status||500,headers:{'content-type':'application/json; charset=utf-8'}});
  }
};

const RealEventSource=globalThis.EventSource;
class LocalPreviewEvents extends EventTarget {
  static CONNECTING=0;static OPEN=1;static CLOSED=2;
  constructor(url){
    super();this.url=new URL(url,location.href).href;this.readyState=0;this.withCredentials=false;streams.add(this);
    queueMicrotask(()=>{if(this.readyState===2)return;this.readyState=1;this.dispatchEvent(new Event('open'));this.onopen?.(new Event('open'));document.documentElement.dataset.connection='preview';this.dispatchEvent(new MessageEvent('ready',{data:JSON.stringify({residentId:PLAYER_ID,preview:true,multiplayer:false})}));});
  }
  close(){this.readyState=2;streams.delete(this);}
}
globalThis.EventSource=class {
  static CONNECTING=0;static OPEN=1;static CLOSED=2;
  constructor(url,options){const parsed=new URL(url,location.href);if(parsed.origin===location.origin&&parsed.pathname==='/api/realtime')return new LocalPreviewEvents(url);return new RealEventSource(url,options);}
};

export function resetPreview(){state=initialState();persist();location.hash='#world';location.reload();}
addEventListener('abujalife:reset-preview',resetPreview);
addEventListener('storage',event=>{if(event.key===STORAGE_KEY){state=restore();emit('profile',{profile:clone(state.profile)});}});
document.documentElement.dataset.preview='browser';
persist();
await import('../app/app.js');

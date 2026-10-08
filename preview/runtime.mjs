/** Browser-only public preview. This adapter never connects to the game server. */
import data from './data.mjs';
import { LIFE_GOALS, GAME_YEAR_MS, GAME_BILL_PERIOD_MS, WALLET_META, INVESTMENT_META, DICE_META, LOAN_META, TRANSPORT_MODES, travelPricing, starterHomeSeed, systemResaleValue, homeBenefits, investmentView, loanQuote, loanView, venueFor, venueAvailable, venueActionFor, applyNeedEffects, furniturePlacement, ownsVehicle } from '../src/shared/life.mjs';
import { syncHomeTenancy, TENANCY_RULES } from '../src/shared/tenancy.mjs';
import { HOUSING_ACTIONS, applyHousingAction } from '../src/server/housingActions.mjs';
import { vehicleColorFor } from '../src/shared/vehicles.mjs';
import { ORIGIN_META, createOrigin, originHome } from '../src/shared/origins.mjs';
import { abujaTime, jobSchedule, clubSchedule, seasonalWeather, JOB_SCHEDULES } from '../src/shared/simulation.mjs';
import { variedAppearance } from '../src/shared/avatars.mjs';
import { validateFurniturePlacement, applyFurniturePlacement, storeSupportedFurniture, readFurniturePlacement } from '../src/shared/furniture-placement.mjs';
import { validateHomeDesign } from '../src/shared/home-design.mjs';
import { homeDesignPreservesRoutes } from '../app/world-interiors.js';

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
function randomInt(min, max) {
  const span=max-min;check(Number.isSafeInteger(span)&&span>0&&span<=4294967296,'Choose a valid random range');
  const value=new Uint32Array(1),ceiling=Math.floor(4294967296/span)*span;
  do{globalThis.crypto.getRandomValues(value);}while(value[0]>=ceiling);
  return min+value[0]%span;
}
function propertiesFor(profile=state.profile) {return profile.origin?.residence?[...properties,profile.origin.residence]:properties;}
function propertyFor(profile,propertyId=profile.home.propertyId){return propertiesFor(profile).find(item=>item.id===propertyId);}

function initialState({assignOrigin=true}={}) {
  const timestamp = Date.now();
  const origin=assignOrigin?createOrigin({residentId:PLAYER_ID,now:timestamp,randomInt,properties,atlas:[...atlas.values()]}):null;
  const seed=origin?starterHomeSeed(origin):{inventory:[],furnitureLayout:{},storedFurniture:[],homeStyle:{}};
  const home=origin?{...originHome(origin),...seed.homeStyle}:{propertyId:'garki-studio',layoutId:'garki-studio',name:'Garki starter studio',district:'garki-i',tenure:'starter'};
  const wallet=origin?.startingBalance??ORIGIN_META.options.find(option=>option.id==='lapo').startingBalance;
  return {
    version: 1,
    origin,
    profile: {
      id: PLAYER_ID, username: 'preview_resident', displayName: 'Preview resident',
      appearance: assignOrigin?variedAppearance({presentation:'neutral',randomInt:max=>randomInt(0,max)}):{skinTone:'brown',face:'oval',body:'regular',hair:'crop',facialHair:'none',presentation:'neutral',top:'forest',bottom:'charcoal',shoes:'white',accessory:'none'},
      origin,wallet, energy:82, hunger:72, hygiene:88, social:58, fun:64, stress:12, mood:76, reputation:0,
      district:home.district, location:{kind:'home',district:home.district,venue:'home'},home,
      job:null, careerLevel:1, skills:{}, inventory:seed.inventory, ownedProperties:origin?.giftedHome?[home.propertyId]:[],
      onboardingComplete:false, lifeGoal:'explore', drivingVehicle:null, furnitureLayout:seed.furnitureLayout,storedFurniture:seed.storedFurniture,
      propertyInvestments:{},vehicleColors:{},gambleHistory:[],lastGambleRound:null,loans:[],workDays:{},
      settings:{presenceVisible:false,allowInvites:false,soundEnabled:true},
      activeTrip:null, activeShift:null, completedShifts:0, nextShiftAt:0,
      lastActionAt:timestamp, billsPaidAt:timestamp, rentPaidAt:timestamp, createdAt:timestamp
    },
    challenge:null, completedChallenges:{},economyOperations:{},socialPosts:[],socialComments:[],socialOperations:{},
    notifications:[{id:uid(),kind:'preview',title:'Your browser preview',body:'Explore on your own. Progress saves in this browser; public multiplayer is unavailable.',link:'home',createdAt:timestamp,readAt:null}],
    transactions:[{id:uid(),amount:wallet,reason:'Preview starting balance',createdAt:timestamp}]
  };
}
function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || saved.profile?.id !== PLAYER_ID || !atlas.has(saved.profile.district) || !Number.isSafeInteger(saved.profile.wallet) || saved.profile.wallet < 0) return initialState();
    const initial = initialState({assignOrigin:false});
    const restored = {...initial,...saved,profile:{...initial.profile,...saved.profile}};
    restored.origin=saved.origin||saved.profile.origin||null;restored.profile.origin=clone(restored.origin);
    restored.profile.appearance = {...initial.profile.appearance,...saved.profile.appearance};
    restored.profile.settings = {...initial.profile.settings,...saved.profile.settings};
    restored.profile.inventory = (saved.profile.inventory || []).filter(id=>catalog.some(item=>item.id===id));
    restored.profile.ownedProperties = (saved.profile.ownedProperties || []).filter(id=>propertiesFor(restored.profile).some(item=>item.id===id));
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
      try {restored.profile.furnitureLayout[itemId]=readFurniturePlacement(placement);}catch {/* Discard only the invalid placement. */}
    }
    if(restored.profile.location?.kind==='venue'&&!venueFor(restored.profile.location.venue))restored.profile.location={kind:'public',district:restored.profile.district,venue:'neighbourhood'};
    if(restored.profile.location?.kind==='visit')restored.profile.location={kind:'public',district:restored.profile.district,venue:'neighbourhood'};
    if (restored.profile.job && !Object.hasOwn(allJobs,restored.profile.job)) { restored.profile.job=null; restored.profile.activeShift=null; restored.challenge=null; }
    if (!Array.isArray(restored.notifications) || !Array.isArray(restored.transactions)) return initialState();
    if (restored.challenge && !Object.hasOwn(allJobs,restored.challenge.jobId)) { restored.challenge=null; restored.profile.activeShift=null; }
    if(restored.challenge&&(!restored.challenge.dateKey||!restored.challenge.expiresAt||restored.challenge.expiresAt<=Date.now())){restored.challenge=null;restored.profile.activeShift=null;}
    if (!restored.completedChallenges || typeof restored.completedChallenges!=='object') restored.completedChallenges={};
    if(!restored.economyOperations||typeof restored.economyOperations!=='object'||Array.isArray(restored.economyOperations))restored.economyOperations={};
    if(!Array.isArray(restored.profile.loans))restored.profile.loans=[];
    if(!restored.profile.workDays||typeof restored.profile.workDays!=='object'||Array.isArray(restored.profile.workDays))restored.profile.workDays={};
    restored.socialPosts=(Array.isArray(saved.socialPosts)?saved.socialPosts:[]).filter(post=>post.userId===PLAYER_ID);
    restored.socialComments=(Array.isArray(saved.socialComments)?saved.socialComments:[]).filter(comment=>comment.userId===PLAYER_ID);
    if(!restored.socialOperations||typeof restored.socialOperations!=='object'||Array.isArray(restored.socialOperations))restored.socialOperations={};
    return restored;
  } catch { return initialState(); }
}
let state = restore();
function persist() {
  state.profile.origin=clone(state.origin);
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); storageAvailable=true; }
  catch { storageAvailable=false; document.documentElement.dataset.previewStorage='memory'; dispatchEvent(new Event('abujalife:preview-storage-unavailable')); }
}
function emit(type, value) { for (const stream of streams) if (stream.readyState===1) stream.dispatchEvent(new MessageEvent(type,{data:JSON.stringify(value)})); }
function publicJobs() { return Object.fromEntries(Object.entries(allJobs).map(([id,{tasks,...job}])=>[id,{...job,schedule:{...JOB_SCHEDULES[id],timeZone:'Africa/Lagos',maxDailyShifts:2}}])); }
function challengeView() {
  if (!state.challenge||state.challenge.expiresAt<=Date.now()) return null;
  const job=allJobs[state.challenge.jobId];
  return {...state.challenge,title:job.title,tasks:(job.tasks||[]).map(({answer,...task})=>clone(task))};
}
function reconcileHousing() {
  const next=clone(state), profile=next.profile;
  if(syncHomeTenancy(profile,{property:propertyFor(profile),temporaryProperty:properties.find(p=>p.id===TENANCY_RULES.temporaryPropertyId),now:Date.now(),id:uid(),seed:profile.id})) { state=next;persist(); }
}
function bootstrap() {
  reconcileHousing();
  const now=Date.now(),clock=abujaTime(now),workSchedules=Object.fromEntries(Object.keys(allJobs).map(id=>[id,jobSchedule(id,state.profile,now)]));
  return {
    ...clone(publicData), walletMeta:{...clone(WALLET_META),transferEnabled:false,topupMode:'preview',demoTopupEnabled:true}, jobs:publicJobs(), authenticated:true, profile:clone(state.profile), activeChallenge:challengeView(),
    properties:clone(propertiesFor()),originMeta:clone(ORIGIN_META),loanMeta:clone(LOAN_META),loans:loanView(state.profile,now),workSchedule:jobSchedule(state.profile.job,state.profile,now),workSchedules,serverTime:now,clock,weather:seasonalWeather(now),clubSchedule:clubSchedule(now),visit:null,homeVisit:null,homeVisitRequests:[],homeVisitors:[],payments:previewPayments(),admin:{ok:true,role:null,permissions:[],bootstrapConfigured:false},
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
  const destination=clean(payload.district),mode=clean(payload.mode||'bus',16),venueId=payload.venueId==null?null:clean(payload.venueId),profile=state.profile;
  check(atlas.has(destination),'Choose a location from the Abuja atlas');
  check(TRANSPORT_MODES.some(item=>item.id===mode),'Choose a supported transport mode');
  check(mode!=='walk'||destination===profile.district,'Walking is available within your neighbourhood; choose transport for this trip');
  check(mode!=='car'||catalog.some(item=>ownsVehicle(profile,catalog,item.id)),'Buy a car before choosing your own vehicle');
  if(venueId!==null)check(venueId&&venueAvailable(venueId,destination),'Choose a place available in your destination neighbourhood');
  return travelPricing(atlas.get(profile.district),atlas.get(destination),mode,{venueId});
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
  check(Number.isSafeInteger(profile.wallet)&&profile.wallet>=0,'This action cannot be represented as exact whole Naira',409,'numeric_limit');
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
  check(Number.isSafeInteger(amount)&&amount>0,'Choose a positive whole Naira game top-up',400,'invalid_topup');
  return economyOperation('demo-topup',payload,{amount},(profile,timestamp,next)=>{
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
    check(investment.representable,'This rental income cannot be represented as exact whole Naira',409,'numeric_limit');
    if(name==='collect-rent') {
      check(investment.collectable>0,'Rental income is not ready yet; it accrues weekly',409,'rent_not_ready');
      profile.wallet+=investment.collectable;
      const periods=Math.max(0,Math.floor((timestamp-investment.lastCollectedAt)/INVESTMENT_META.periodMs));
      profile.propertyInvestments[property.id].lastCollectedAt+=periods*INVESTMENT_META.periodMs;
      return{income:{propertyId:property.id,amount:investment.collectable,createdAt:timestamp},investment:investmentView(profile,property,timestamp),ledgerReason:`Rental income · ${property.name}`};
    }
    check(timestamp>=investment.canSellAt,'Hold the investment for one week before selling',409,'investment_cooldown');
    const amount=investment.resaleValue+investment.collectable;profile.wallet+=amount;
    delete profile.propertyInvestments[property.id];profile.ownedProperties=profile.ownedProperties.filter(item=>item!==property.id);
    return{sale:{propertyId:property.id,amount,resaleValue:investment.resaleValue,rentalIncome:investment.collectable,createdAt:timestamp},ledgerReason:`Investment sale · ${property.name}`};
  });
}
function playDice(payload) {
  const stake=payload.stake,choice=payload.choice;
  check(Number.isSafeInteger(stake)&&stake>=DICE_META.minStake,'Choose a whole Naira stake of at least ₦100',400,'invalid_stake');
  check(DICE_META.choices.some(item=>item.id===choice),'Choose low (1–3) or high (4–6)',400,'invalid_choice');
  return economyOperation('play-dice',payload,{stake,choice},(profile,timestamp)=>{
    check(!profile.activeTrip&&profile.location.kind==='venue'&&profile.location.venue==='games-lounge','Enter Dice & Chill Lounge before playing',400,'wrong_venue');
    check(profile.wallet>=stake,'You need more Naira for this stake',409,'insufficient_balance');
    const die=randomInt(1,7),won=choice==='low'?die<=3:die>=4,payout=won?stake*DICE_META.payoutMultiplier:0;
    check(Number.isSafeInteger(payout),'This dice payout cannot be represented as exact whole Naira',409,'numeric_limit');
    const round={id:uid(),stake,choice,die,won,payout,net:payout-stake,createdAt:timestamp,virtual:true};profile.wallet+=round.net;
    profile.gambleHistory=[round,...profile.gambleHistory].slice(0,20);profile.lastGambleRound=round;
    return{round,ledgerReason:won?'Dice lounge · win':'Dice lounge · loss'};
  });
}
function loanAction(name,payload) {
  const amount=payload.amount;check(Number.isSafeInteger(amount)&&amount>0,'Choose a positive whole Naira amount',400,'invalid_amount');
  if(name==='borrow-loan'){
    check(payload.consent===true&&payload.consentVersion===LOAN_META.consentVersion,'Read and accept the game loan terms before borrowing',400,'loan_consent_required');
    let quote;try{quote=loanQuote(amount);}catch(error){throw new PreviewError(error.message,409,'numeric_limit');}
    return economyOperation(name,payload,{amount,consent:true,consentVersion:LOAN_META.consentVersion},(profile,timestamp)=>{
      check(!profile.loans.some(loan=>loan.outstanding>0),'Repay your current game loan before borrowing again',409,'active_loan');
      const loan={id:uid(),lenderId:LOAN_META.id,...quote,outstanding:quote.totalRepayment,repaid:0,borrowedAt:timestamp,dueAt:timestamp+LOAN_META.termMs,consentVersion:LOAN_META.consentVersion,consentedAt:timestamp,virtual:true};
      profile.wallet+=amount;profile.loans=[loan,...profile.loans.filter(item=>item.outstanding===0).slice(0,49)];return{loan,loans:loanView(profile,timestamp),ledgerReason:'Game loan · borrowed principal'};
    });
  }
  const loanId=payload.loanId;check(typeof loanId==='string'&&loanId.length>0&&loanId.length<=80,'Choose a game loan',400,'invalid_loan');
  return economyOperation(name,payload,{loanId,amount},(profile,timestamp)=>{
    const loan=profile.loans.find(item=>item.id===loanId);check(loan,'Game loan not found',404,'loan_not_found');check(loan.outstanding>0,'This game loan has been repaid',409,'loan_repaid');
    check(amount<=loan.outstanding,'Repay no more than the outstanding amount',400,'invalid_repayment');check(profile.wallet>=amount,'You need more Naira for this repayment',409,'insufficient_balance');
    profile.wallet-=amount;loan.outstanding-=amount;loan.repaid+=amount;loan.lastRepaidAt=timestamp;if(loan.outstanding===0)loan.repaidAt=timestamp;
    return{loan,loans:loanView(profile,timestamp),repayment:{id:uid(),loanId,amount,createdAt:timestamp},ledgerReason:'Game loan · repayment'};
  });
}
function sellItem(payload={}) {
  const itemId=clean(payload.itemId),item=catalog.find(item=>item.id===itemId);
  check(item,'Choose an item from your inventory',400,'invalid_item');
  return economyOperation('sell-item',payload,{itemId},(profile,timestamp)=>{
    check(!profile.activeTrip,'Finish your journey before selling items',409,'trip_active');
    check(profile.inventory.includes(itemId),'You can only sell an item you own',403,'item_not_owned');
    check(profile.drivingVehicle!==itemId,'Park your car before selling it',409,'vehicle_driving');
    const amount=systemResaleValue(item);profile.wallet+=amount;
    profile.inventory=profile.inventory.filter(id=>id!==itemId);storeSupportedFurniture(profile,itemId);delete profile.furnitureLayout[itemId];profile.storedFurniture=profile.storedFurniture.filter(id=>id!==itemId);delete profile.vehicleColors[itemId];
    if(item.category==='clothing'&&item.slot&&profile.appearance[item.slot]===item.value&&!catalog.some(other=>other.id!==itemId&&profile.inventory.includes(other.id)&&other.category==='clothing'&&other.slot===item.slot&&other.value===item.value)){
      const defaults={top:'forest',bottom:'charcoal',shoes:'white'};profile.appearance[item.slot]=defaults[item.slot]??profile.appearance[item.slot];
    }
    return{sale:{itemId,amount,createdAt:timestamp,virtual:true},item:clone(item),ledgerReason:'System resale · '+item.name};
  });
}
function action(name,payload={}) {
  reconcileHousing();
  if(HOUSING_ACTIONS.has(name)) return economyOperation(name,payload,{propertyId:payload.propertyId,tenure:payload.tenure,tenancyId:payload.tenancyId,early:payload.early===true,confirm:payload.confirm===true,venueId:payload.venueId,storyId:payload.storyId},(profile,now)=>applyHousingAction(profile,name,payload,{now,properties:propertiesFor(profile)}));
  if(name==='purchase'&&payload.idempotencyKey&&catalog.some(item=>item.id===payload.itemId&&item.category==='furniture')){
    const item=catalog.find(item=>item.id===payload.itemId);
    return economyOperation('purchase',payload,{itemId:item.id},profile=>{
      check(!profile.activeTrip,'Your journey is still in progress');
      check(!profile.inventory.includes(item.id),'You already own this item',409,'item_owned');
      check(profile.wallet>=item.price,'You need more Naira for this',409,'insufficient_balance');
      profile.wallet-=item.price;profile.inventory.push(item.id);profile.storedFurniture.push(item.id);
      return{item:clone(item),ledgerReason:`Furniture purchase · ${item.name}`};
    });
  }
  if(name==='sell-item')return sellItem(payload);
  if(name==='topup'||name==='demo-topup')return topup(payload);
  if(name==='transfer-naira')throw new PreviewError('Naira transfers connect registered residents in the full game. This browser preview has no shared wallet or other residents.',503,'browser_preview_only');
  if(['buy-investment','collect-rent','sell-investment'].includes(name))return investmentAction(name,payload);
  if(name==='play-dice')return playDice(payload);
  if(['borrow-loan','repay-loan'].includes(name))return loanAction(name,payload);
  if(payload.idempotencyKey&&(name==='paint-vehicle'||(name==='purchase'&&catalog.some(item=>item.id===payload.itemId&&item.category==='vehicle'))))return vehicleAction(name,payload);
  // Work on a copy so rejected purchases or task submissions leave progress intact.
  const next=clone(state),profile=next.profile,before=profile.wallet,timestamp=Date.now(),comfort=homeBenefits(profile,propertyFor(profile));let extra={};
  if(name!=='complete-shift'&&next.challenge&&next.challenge.expiresAt<=timestamp){next.challenge=null;profile.activeShift=null;}
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
    case 'exit-venue': {
      check(profile.location.kind==='venue','You are already outside');
      const venueId=profile.location.venue;
      profile.drivingVehicle=null;
      profile.location={kind:'public',district:profile.district,venue:'neighbourhood',exteriorEntry:{venueId,transitionId:uid()}};
      break;
    }
    case 'venue-action': {
      const activity=venueActionFor(payload.activityId);
      check(activity,'Choose an activity from this place');
      check(profile.location.kind==='venue'&&profile.location.venue===activity.venueId,'Enter this place before using its facilities');
      if(venueFor(activity.venueId)?.kind==='club'&&activity.cost>0)check(clubSchedule(timestamp).isOpen,clubSchedule(timestamp).reason,409,'venue_closed');
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
      let placement;try{placement=validateFurniturePlacement(profile,item.id,payload);profile.furnitureLayout||={};applyFurniturePlacement(profile,item.id,placement);}catch(error){throw new PreviewError(error.message,400,error.code);}extra.placement={itemId:item.id,...clone(placement)};break;
    }
    case 'store-furniture': {home();const item=catalog.find(item=>item.id===payload.itemId);check(item?.category==='furniture'&&profile.inventory.includes(item.id),'You can store furniture you own');storeSupportedFurniture(profile,item.id);delete profile.furnitureLayout[item.id];if(!profile.storedFurniture.includes(item.id))profile.storedFurniture.push(item.id);extra.storedItemId=item.id;break;}
    case 'design-home':{
      home();let roomStyle;try{roomStyle=validateHomeDesign(payload.roomStyle);}catch(error){throw new PreviewError(error.message);}
      check(homeDesignPreservesRoutes(profile,roomStyle),'Keep the entrance, furnishings and activity routes clear',400,'home_route_blocked');profile.home.roomStyle=roomStyle;extra.roomStyle=clone(roomStyle);break;
    }
    case 'return-home':case 'travel': {
      const destination=name==='return-home'?profile.home.district:payload.district;
      if(name==='return-home'&&destination===profile.district) { profile.drivingVehicle=null;profile.location={kind:'home',district:profile.district,venue:'home'};break; }
      const venueId=name==='travel'&&payload.venueId!=null?clean(payload.venueId):null;
      if(venueId!==null)outside();
      const fare=quote({district:destination,mode:payload.mode,venueId});debit(fare.cost);
      const vehicleId=fare.mode==='car'?(ownsVehicle(profile,catalog,profile.drivingVehicle)?profile.drivingVehicle:catalog.find(item=>ownsVehicle(profile,catalog,item.id))?.id):null;
      profile.activeTrip={id:uid(),...fare,vehicleId,arrivesAt:timestamp+fare.seconds*1000,returningHome:name==='return-home'};
      profile.drivingVehicle=null;
      profile.location={kind:'transit',district:profile.district,venue:'journey'};extra.trip=clone(profile.activeTrip);break;
    }
    case 'arrive': {
      const trip=profile.activeTrip;check(trip&&trip.id===payload.tripId,'This journey is no longer active');check(timestamp>=trip.arrivesAt,'Your journey is still in progress',409,'trip_in_progress');
      if(trip.venueId)check(venueAvailable(trip.venueId,trip.destination),'This destination is no longer available');
      profile.district=trip.destination;profile.location={kind:trip.returningHome?'home':trip.venueId?'venue':'public',district:trip.destination,venue:trip.returningHome?'home':trip.venueId||'neighbourhood'};profile.drivingVehicle=!trip.returningHome&&!trip.venueId&&trip.mode==='car'&&ownsVehicle(profile,catalog,trip.vehicleId)?trip.vehicleId:null;profile.activeTrip=null;profile.energy=clamp(profile.energy-3);break;
    }
    case 'take-job':check(typeof payload.jobId==='string'&&Object.hasOwn(allJobs,payload.jobId),'Choose a listed job');check(!next.challenge,'Finish your current shift before switching careers');profile.job=payload.jobId;break;
    case 'start-shift': {
      const job=allJobs[profile.job];check(job,'Choose a job before starting a shift');outside();check(profile.district===job.district,`Travel to ${atlas.get(job.district)?.name||job.district} for your shift`);
      if(next.challenge) { extra.challenge=challengeView();break; }
      check(timestamp>=profile.nextShiftAt,'Take a moment between shifts',409,'shift_cooldown');
      const schedule=jobSchedule(profile.job,profile,timestamp);check(schedule.canStart,schedule.reason,409,schedule.remainingToday===0?'daily_shift_limit':!schedule.isWorkDay||!schedule.isOpen?'workplace_closed':'shift_slot_completed');
      check(profile.energy>=job.energy,'Rest before starting another shift');check(Array.isArray(job.tasks)&&job.tasks.length>0,'This job is unavailable in the preview');
      const slot=schedule.slots.find(item=>item.id===schedule.availableSlot);
      next.challenge={id:uid(),jobId:profile.job,startedAt:timestamp,dateKey:schedule.dateKey,slotId:slot.id,expiresAt:slot.endsAt};profile.activeShift=next.challenge.id;
      extra.challenge={...next.challenge,title:job.title,tasks:job.tasks.map(({answer,...task})=>clone(task))};extra.workSchedule=schedule;break;
    }
    case 'complete-shift': {
      if(Object.hasOwn(next.completedChallenges,payload.challengeId||'')) {extra.result=next.completedChallenges[payload.challengeId];extra.workSchedule=jobSchedule(profile.job,profile,timestamp);break;}
      const challenge=next.challenge;check(challenge&&challenge.id===payload.challengeId,'Shift not found');const job=allJobs[challenge.jobId];
      check(profile.district===job.district&&profile.location.kind==='public','Complete your shift at the workplace');
      check(timestamp<challenge.expiresAt&&abujaTime(timestamp).dateKey===challenge.dateKey,'This shift has ended; start an available shift',409,'shift_expired');
      const schedule=jobSchedule(challenge.jobId,profile,timestamp);check(schedule.remainingToday>0,'You have finished today’s two shifts. Come back tomorrow.',409,'daily_shift_limit');check(!schedule.slots.find(slot=>slot.id===challenge.slotId)?.completed,'This shift slot has already been completed',409,'shift_slot_completed');
      check(timestamp-challenge.startedAt>=1500,'Read the tasks before submitting your shift',409,'shift_too_fast');
      check(Array.isArray(payload.answers)&&payload.answers.length===job.tasks.length,'Answer each shift task');check(payload.answers.every(answer=>answer&&typeof answer==='object'&&typeof answer.taskId==='string'&&typeof answer.optionId==='string'),'Choose valid shift answers');const answers=new Map(payload.answers.map(answer=>[answer.taskId,answer.optionId]));
      check(answers.size===job.tasks.length&&job.tasks.every(task=>task.options.some(option=>option.id===answers.get(task.id))),'Choose one valid answer for every task');
      const correct=job.tasks.filter(task=>answers.get(task.id)===task.answer).length,pay=Math.round(job.pay*(.4+.6*correct/job.tasks.length));
      profile.wallet+=pay;profile.energy=clamp(profile.energy-job.energy);profile.hunger=clamp(profile.hunger-10);profile.stress=clamp(profile.stress+8);profile.reputation+=correct===job.tasks.length?2:1;profile.completedShifts++;profile.skills[job.skill]=(profile.skills[job.skill]||0)+correct;profile.careerLevel=1+Math.floor(profile.completedShifts/5);profile.activeShift=null;profile.nextShiftAt=timestamp+20000;
      const record=profile.workDays[challenge.dateKey]||{completed:0,slots:[]};profile.workDays[challenge.dateKey]={completed:record.completed+1,slots:[...new Set([...record.slots,challenge.slotId])]};profile.workDays=Object.fromEntries(Object.entries(profile.workDays).sort(([a],[b])=>b.localeCompare(a)).slice(0,8));
      extra.result={challengeId:challenge.id,pay,correct,total:job.tasks.length,careerLevel:profile.careerLevel,dateKey:challenge.dateKey,slotId:challenge.slotId};next.completedChallenges[challenge.id]=extra.result;next.challenge=null;extra.workSchedule=jobSchedule(profile.job,profile,timestamp);
      const old=Object.keys(next.completedChallenges);if(old.length>200)delete next.completedChallenges[old[0]];break;
    }
    case 'work-shift':throw new PreviewError('Start a shift and complete its work tasks to earn your salary');
    case 'purchase': {const item=catalog.find(item=>item.id===payload.itemId);check(item,'Choose an item from Okrika Marketplace');check(!profile.inventory.includes(item.id),'You already own this item',409);if(item.category==='vehicle'){const color=payload.color??item.defaultColor;check(vehicleColorFor(color)&&item.availableColors.includes(color),'Choose an available car colour');profile.vehicleColors[item.id]=color;}debit(item.price);profile.inventory.push(item.id);if(item.category==='furniture'&&!profile.storedFurniture.includes(item.id))profile.storedFurniture.push(item.id);extra.item=clone(item);break;}
    case 'paint-vehicle': {const item=catalog.find(item=>item.id===payload.itemId&&item.category==='vehicle');check(item&&profile.inventory.includes(item.id),'You can repaint a car you own',403,'vehicle_not_owned');check(vehicleColorFor(payload.color)&&item.availableColors.includes(payload.color),'Choose an available car colour');profile.vehicleColors[item.id]=payload.color;extra.item=clone(item);break;}
    case 'equip': {const item=catalog.find(item=>item.id===payload.itemId);check(item?.category==='clothing'&&profile.inventory.includes(item.id),'You can wear clothing you own');profile.appearance[item.slot]=item.value;break;}
    case 'pay-bills': {check(timestamp-profile.billsPaidAt>=GAME_BILL_PERIOD_MS,'Your home bills are up to date');const property=propertyFor(profile);check(property,'Your home listing is unavailable');const amount=Math.round(property.bills*(100-comfort.billDiscountPercent)/100);debit(amount);profile.billsPaidAt=timestamp;extra.bill={amount,baseAmount:property.bills,discountPercent:comfort.billDiscountPercent};break;}
    default:throw new PreviewError('Unknown preview action');
  }
  check(Number.isSafeInteger(profile.wallet)&&profile.wallet>=0,'This action cannot be represented as exact whole Naira',409,'numeric_limit');profile.lastActionAt=timestamp;if(profile.wallet!==before)next.transactions.push({id:uid(),amount:profile.wallet-before,reason:name,createdAt:timestamp});next.transactions=next.transactions.slice(-100);
  state=next;persist();queueMicrotask(()=>emit('profile',{profile:clone(state.profile)}));return{ok:true,profile:clone(profile),...extra};
}
function localResident(){const {id,username,displayName,appearance,reputation}=state.profile;return{id,username,displayName,appearance:clone(appearance),reputation,online:false,district:null,location:null,local:true};}
function socialPostView(post){return{...clone(post),resident:localResident(),likes:post.likedByMe?1:0,commentCount:state.socialComments.filter(comment=>comment.postId===post.id).length,local:true};}
function postAccess(postId){const post=state.socialPosts.find(post=>post.id===postId&&post.userId===PLAYER_ID&&!post.deletedAt&&(!post.expiresAt||post.expiresAt>Date.now()));check(post,'Post is unavailable',404,'post_unavailable');return post;}
function socialText(value,max,label){check(value===undefined||typeof value==='string',`${label} must be text`);const text=(value||'').trim();check(text.length<=max,`${label} is too long`,413,'content_too_large');return text;}
function socialKey(key){check(typeof key==='string'&&/^[A-Za-z0-9:_-]{8,128}$/.test(key),'Include a unique idempotency key',400,'idempotency_required');return key;}
function socialPage(rows,url,field){
  const requested=url.searchParams.get('limit'),limit=requested===null?20:Number(requested);check(Number.isSafeInteger(limit)&&limit>=1&&limit<=50,'Choose a page size of 1–50');
  const cursor=url.searchParams.get('cursor');let after=null;
  if(cursor){try{check(cursor.length<=256,'Invalid page cursor');after=JSON.parse(atob(cursor.replace(/-/g,'+').replace(/_/g,'/')));check(Array.isArray(after)&&after.length===2&&Number.isSafeInteger(after[0])&&typeof after[1]==='string','Invalid page cursor');}catch{throw new PreviewError('Invalid page cursor',400,'invalid_cursor');}}
  const ordered=rows.filter(row=>!after||row.createdAt<after[0]||(row.createdAt===after[0]&&row.id<after[1])).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)),items=ordered.slice(0,limit),last=items.at(-1);
  const nextCursor=ordered.length>limit?btoa(JSON.stringify([last.createdAt,last.id])).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''):null;
  return{ok:true,[field]:items.map(row=>field==='comments'?{...clone(row),resident:localResident(),local:true}:socialPostView(row)),nextCursor,serverTime:Date.now(),local:true};
}
async function socialImage(value){
  if(value===undefined||value===null||value==='')return null;
  check(typeof value==='string'&&value.length<=Math.ceil(524288/3)*4+40,'Use an image smaller than 512 KiB',413,'image_too_large');
  const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);check(match&&match[2].length%4===0,'Upload a PNG, JPEG or WebP image',400,'invalid_image');
  let decoded;try{decoded=atob(match[2]);}catch{throw new PreviewError('Invalid image encoding',400,'invalid_image');}
  check(decoded.length<=524288&&btoa(decoded)===match[2],'Invalid image encoding',400,'invalid_image');
  const bytes=Uint8Array.from(decoded,char=>char.charCodeAt(0));
  const valid=match[1]==='png'?bytes.length>24&&[137,80,78,71,13,10,26,10].every((byte,i)=>bytes[i]===byte):match[1]==='jpeg'?bytes.length>12&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217:bytes.length>=30&&decoded.slice(0,4)==='RIFF'&&decoded.slice(8,12)==='WEBP';
  check(valid,'Invalid image data',400,'invalid_image');
  try{const bitmap=await createImageBitmap(new Blob([bytes],{type:`image/${match[1]}`})),width=bitmap.width,height=bitmap.height;bitmap.close();check(width>0&&height>0&&width<=4096&&height<=4096&&width*height<=16777216,'Use an image no larger than 4096 pixels per side',413,'image_dimensions');}catch(error){if(error instanceof PreviewError)throw error;throw new PreviewError('Invalid image data',400,'invalid_image');}
  return value;
}
async function socialCreatePost(body){
  const text=socialText(body.text,4000,'Post'),kind=body.kind??'post',key=socialKey(body.idempotencyKey),imageDataUrl=await socialImage(body.imageDataUrl);
  check(kind==='post'||kind==='status','Choose a post or 24-hour status');check(text.length||imageDataUrl,'Write something or choose an image');
  const fingerprint=JSON.stringify({text,imageDataUrl,kind}),prior=Object.hasOwn(state.socialOperations,key)?state.socialOperations[key]:null;
  if(prior){check(prior.kind==='post'&&prior.fingerprint===fingerprint,'This idempotency key was already used for different content',409,'idempotency_conflict');return{ok:true,post:socialPostView(postAccess(prior.itemId)),replayed:true,local:true};}
  const next=clone(state),createdAt=Date.now(),post={id:uid(),userId:PLAYER_ID,text,imageDataUrl,kind,createdAt,expiresAt:kind==='status'?createdAt+86400000:null,likedByMe:false};
  next.socialPosts.push(post);Object.defineProperty(next.socialOperations,key,{value:{kind:'post',fingerprint,itemId:post.id},enumerable:true,writable:true,configurable:true});state=next;persist();const view=socialPostView(post);queueMicrotask(()=>emit('social-post',{post:view}));return{ok:true,post:view,replayed:false,local:true};
}
function socialPostAction(postId,kind,method,url,body){
  if(kind==='delete'&&method==='POST'){
    const post=state.socialPosts.find(post=>post.id===postId&&post.userId===PLAYER_ID);check(post,'Your post was not found',404,'post_unavailable');const replayed=Boolean(post.deletedAt);
    if(!replayed){const next=clone(state);next.socialPosts.find(row=>row.id===postId).deletedAt=Date.now();state=next;persist();queueMicrotask(()=>emit('social-delete',{postId}));}return{ok:true,postId,deleted:true,replayed,local:true};
  }
  const post=postAccess(postId);
  if(kind==='comments'&&method==='GET')return socialPage(state.socialComments.filter(comment=>comment.postId===postId&&comment.userId===PLAYER_ID),url,'comments');
  if(kind==='comments'&&method==='POST'){
    const text=socialText(body.text,2000,'Comment'),key=socialKey(body.idempotencyKey);check(text.length,'Write a comment first');
    const fingerprint=JSON.stringify({postId,text}),prior=Object.hasOwn(state.socialOperations,key)?state.socialOperations[key]:null;
    if(prior){check(prior.kind==='comment'&&prior.fingerprint===fingerprint,'This idempotency key was already used for a different comment',409,'idempotency_conflict');const comment=state.socialComments.find(row=>row.id===prior.itemId);check(comment,'Comment unavailable',404);return{ok:true,comment:{...clone(comment),resident:localResident(),local:true},replayed:true,local:true};}
    const next=clone(state),comment={id:uid(),postId,userId:PLAYER_ID,text,createdAt:Date.now()};next.socialComments.push(comment);Object.defineProperty(next.socialOperations,key,{value:{kind:'comment',fingerprint,itemId:comment.id},enumerable:true,writable:true,configurable:true});state=next;persist();const view={...clone(comment),resident:localResident(),local:true};queueMicrotask(()=>emit('social-comment',{comment:view}));return{ok:true,comment:view,replayed:false,local:true};
  }
  if(kind==='like'&&method==='POST'){const next=clone(state),row=next.socialPosts.find(row=>row.id===postId);row.likedByMe=!row.likedByMe;state=next;persist();const view=socialPostView(row);queueMicrotask(()=>emit('social-post',{post:view}));return{ok:true,post:view,local:true};}
  throw new PreviewError('Choose a supported post action',404,'preview_not_found');
}
function previewPayments(){return{ok:true,enabled:false,provider:'Flutterwave',mode:'preview',currency:'NGN',creditRate:1,reason:'This local browser preview cannot make payments. Free game funds have no cash value.',local:true};}
async function handleApi(url,method,body) {
  const route=url.pathname;
  if(route==='/api/health'&&method==='GET')return{ok:true,service:'AbujaLife browser preview',storage:storageAvailable?'localStorage':'memory'};
  if(route==='/api/bootstrap'&&method==='GET')return bootstrap();
  if(route==='/api/wallet'&&method==='GET')return{ok:true,profile:clone(state.profile),transactions:clone(state.transactions).slice(-60).reverse(),walletMeta:{...clone(WALLET_META),transferEnabled:false,topupMode:'preview',demoTopupEnabled:true},loanMeta:clone(LOAN_META),loans:loanView(state.profile,Date.now()),workSchedule:jobSchedule(state.profile.job,state.profile,Date.now())};
  if(route==='/api/residents'&&method==='GET')return{ok:true,people:[],nextCursor:null,local:true};
  if(route==='/api/home/visits'&&method==='GET')return{ok:true,requests:[],visitors:[],visit:null,nextRequestsCursor:null,nextVisitorsCursor:null,serverTime:Date.now(),local:true};
  if(route.startsWith('/api/home/visits/')&&method==='POST')unavailable();
  if(route==='/api/payments/config'&&method==='GET')return previewPayments();
  if(route.startsWith('/api/payments/'))throw new PreviewError('Payments are unavailable in the local browser preview. No payment was made.',503,'browser_preview_only');
  if(route.startsWith('/api/admin/'))throw new PreviewError('Administration requires a connected administrator account.',403,'admin_permission_required');
  if((route==='/api/social/feed'||route==='/api/social/statuses')&&method==='GET'){const kind=route.endsWith('statuses')?'status':'post';return socialPage(state.socialPosts.filter(post=>post.userId===PLAYER_ID&&post.kind===kind&&!post.deletedAt&&(!post.expiresAt||post.expiresAt>Date.now())),url,kind==='status'?'statuses':'posts');}
  if(route==='/api/social/posts'&&method==='POST')return socialCreatePost(body);
  const socialRoute=route.match(/^\/api\/social\/posts\/([^/]+)\/(like|comments|delete)$/);if(socialRoute)return socialPostAction(decodeURIComponent(socialRoute[1]),socialRoute[2],method,url,body);
  if(route==='/api/wallet/topup'&&method==='POST')return action('demo-topup',body);
  if(route==='/api/wallet/transfer'&&method==='POST')throw new PreviewError('Naira transfers connect registered residents in the full game. This browser preview has no shared wallet or other residents.',503,'browser_preview_only');
  if(route==='/api/travel/quote'&&method==='GET')return{ok:true,quote:quote({district:url.searchParams.get('district'),mode:url.searchParams.get('mode')||'bus',venueId:url.searchParams.get('venueId')})};
  if(route==='/api/action'&&method==='POST')return action(body.action,body.payload||{});
  if(route==='/api/profile'&&method==='POST') {
    const profile=clone(state.profile);
    if(body.displayName!==undefined){check(clean(body.displayName,40).length>=2,'Display name must have at least two characters');profile.displayName=clean(body.displayName,40);}
    updateAppearance(profile,body.appearance);
    if(body.lifeGoal!==undefined){check(LIFE_GOALS.some(goal=>goal.id===body.lifeGoal),'Choose a listed life goal');profile.lifeGoal=body.lifeGoal;}
    if(body.onboardingComplete!==undefined){check(typeof body.onboardingComplete==='boolean','Choose a valid onboarding state');if(body.onboardingComplete===true&&profile.home.starterVersion===1)check(['feminine','masculine'].includes(profile.appearance.presentation),'Choose Female or Male before starting',400,'gender_required');profile.onboardingComplete=body.onboardingComplete;}
    if(body.settings&&typeof body.settings==='object')for(const key of ['presenceVisible','allowInvites','soundEnabled','allowHomeVisits','homeVisitsFriendsOnly'])if(typeof body.settings[key]==='boolean')profile.settings[key]=body.settings[key];
    state.profile=profile;persist();queueMicrotask(()=>emit('profile',{profile:clone(profile)}));return{ok:true,profile:clone(profile)};
  }
  if(route==='/api/notifications/read'&&method==='POST'){for(const notice of state.notifications)if(!body.id||notice.id===body.id)notice.readAt=Date.now();persist();return{ok:true,notifications:clone(state.notifications)};}
  if(route==='/api/presence'&&method==='POST')return{ok:true,people:[],nearby:[],preview:true};
  if(route==='/api/chat/location'&&method==='GET')return{ok:true,messages:[],preview:true};
  if(route==='/api/conversations'&&method==='GET')return{...socialPage([],url,'conversations'),preview:true};
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
    const result=await handleApi(url,method,body);return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
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

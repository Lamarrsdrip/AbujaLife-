import crypto from 'node:crypto';
import { ECONOMY_CONFIG } from '../../shared/economy.mjs';
import { economyTransactionType } from '../../shared/transactions.mjs';
import { TENANCY_RULES, recordHousingLifeEvent, syncHomeTenancy, nextTenancyCheck } from '../../shared/tenancy.mjs';
import { HOUSING_ACTIONS, HOUSING_MONEY_ACTIONS, applyHousingAction } from '../housingActions.mjs';
import { ABUJA_ATLAS } from '../../shared/atlas.mjs';
import * as life from '../../shared/life.mjs';
import { vehicleColorFor } from '../../shared/vehicles.mjs';
import { ORIGIN_META, createOrigin, originHome } from '../../shared/origins.mjs';
import { abujaTime, jobSchedule, JOB_SCHEDULES, clubSchedule } from '../../shared/simulation.mjs';
import { variedAppearance } from '../../shared/avatars.mjs';
import { validateFurniturePlacement, applyFurniturePlacement, storeSupportedFurniture, readFurniturePlacement } from '../../shared/furniture-placement.mjs';
import { validateHomeDesign } from '../../shared/home-design.mjs';
import { homeDesignPreservesRoutes } from '../../../app/world-interiors.js';
import { jobs, catalog, properties, appearanceOptions, transportModes, resalePrice } from '../../shared/catalogue.mjs';
import { GameError } from '../errors.mjs';
import { MongoAuthStore } from './authStore.mjs';
import { residentSearchPrefixes } from './directoryStore.mjs';
const { LIFE_GOALS, GAME_BILL_PERIOD_MS, WALLET_META, INVESTMENT_META, DICE_META, LOAN_META, travelPricing, homeBenefits, investmentView, normalizeInvestmentRecords, loanView, loanQuote, venueFor, venueAvailable, venueActionFor, ownsVehicle, applyNeedEffects, furniturePlacement } = life;
export { jobs, catalog, properties, appearanceOptions, GameError, transportModes };
const uid=()=>crypto.randomUUID(),clean=(value,max=80)=>String(value??'').trim().slice(0,max),clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
const locations=new Map(ABUJA_ATLAS.map(place=>[place.id,place]));
const check=(condition,message,status=400,code='invalid_action')=>{if(!condition)throw new GameError(message,status,code);};
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const initialAppearance={skinTone:'brown',face:'oval',body:'regular',hair:'crop',facialHair:'none',presentation:'neutral',top:'forest',bottom:'charcoal',shoes:'white',accessory:'none'};
const stateMetadata=new WeakMap();
function appearance(current,incoming,inventory=[]){
  check(incoming===undefined||(incoming&&typeof incoming==='object'&&!Array.isArray(incoming)),'Choose valid appearance settings');
  for(const [key,values] of Object.entries(appearanceOptions))if(incoming?.[key]!==undefined){
    check(values.includes(incoming[key]),`Choose a supported ${key}`);
    if(key==='top'&&!['forest','ochre'].includes(incoming[key]))check(catalog.some(item=>item.category==='clothing'&&item.slot==='top'&&item.value===incoming[key]&&inventory.includes(item.id)),'Buy this outfit before wearing it',403,'outfit_not_owned');
    current[key]=incoming[key];
  }return current;
}
const pick=(source,keys)=>Object.fromEntries(keys.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]));
const needsKeys=['energy','hunger','hygiene','social','fun','stress','mood','lastActionAt'];
const progressionKeys=['reputation','careerLevel','skills','completedShifts','nextShiftAt','job','activeShift'];
const stateKeys=['district','location','activeTrip','drivingVehicle'];
const residentKeys=['displayName','settings','lifeGoal','onboardingComplete'];

/** All gameplay mutations run in Mongo transactions. Public profile is assembled from normalized records. */
export class MongoGameStore {
  constructor({client,db,clock=Date.now,originRandomInt=crypto.randomInt,production=true,allowGameTopups=false,auth}={}){
    check(client&&db,'A MongoDB connection is required',503,'storage_unavailable');this.client=client;this.db=db;this.clock=clock;this.originRandomInt=originRandomInt;this.production=production;this.allowGameTopups=!production&&allowGameTopups===true;
    this.auth=auth||new MongoAuthStore({client,db,clock});this.emitUser=()=>{};this.emitZone=()=>{};this.isOnline=()=>false;this.onlineInZone=()=>null;
  }
  collection(name){return this.db.collection(name);}
  async close(){await this.client.close();}
  async transaction(fn){const session=this.client.startSession();try{return await session.withTransaction(()=>fn(session),{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},readPreference:'primary'});}finally{await session.endSession();}}
  async profile(id,{session=null,reconcileHousing=true}={}){
    check(typeof id==='string'&&id.length>0&&id.length<=80,'Choose a valid resident');const opts=session?{session}:{};
    // A driver session cannot run parallel transaction operations.
    const resident=await this.collection('residents').findOne({id},opts);check(resident,'Resident not found',404);
    const entities={};const entityNames=['appearances','needs','progression','player_state','homes','origins','wallets'];
    const entityRows=session?[]:await Promise.all(entityNames.map(name=>this.collection(name).findOne({residentId:id},opts)));
    if(session)for(const name of entityNames)entities[name]=await this.collection(name).findOne({residentId:id},opts);else for(const [index,name] of entityNames.entries())entities[name]=entityRows[index];
    check(Object.values(entities).every(Boolean),'Resident persistence is incomplete',503,'storage_incomplete');
    const rowNames=['inventory','vehicles','properties','loans','gamble_rounds'];const rowQueries=session?null:[
      ...rowNames.slice(0,3).map(name=>this.collection(name).find({residentId:id},opts).toArray()),
      this.collection('loans').find({residentId:id},opts).sort({borrowedAt:-1,_id:-1}).limit(51).toArray(),
      this.collection('gamble_rounds').find({residentId:id},opts).sort({sequence:-1,createdAt:-1,_id:-1}).limit(20).toArray()
    ];const rowResults=session?[]:await Promise.all(rowQueries);
    if(session)for(const name of rowNames.slice(0,3))rowResults.push(await this.collection(name).find({residentId:id},opts).toArray());
    if(session){rowResults.push(await this.collection('loans').find({residentId:id},opts).sort({borrowedAt:-1,_id:-1}).limit(51).toArray());rowResults.push(await this.collection('gamble_rounds').find({residentId:id},opts).sort({sequence:-1,createdAt:-1,_id:-1}).limit(20).toArray());}
    const rows={inventory:rowResults[0],vehicles:rowResults[1],properties:rowResults[2],loans:rowResults[3]},rounds=rowResults[4];
    const strip=row=>{const {_id,residentId,sequence,...value}=row;return value;};
    const home=strip(entities.homes),{furnitureLayout={},storedFurniture=[],billsPaidAt,rentPaidAt,...homeFields}=home;
    const p={id,username:resident.username,...pick(resident,residentKeys),createdAt:resident.createdAt,origin:entities.origins.origin,appearance:strip(entities.appearances),...strip(entities.needs),...strip(entities.progression),...strip(entities.player_state),home:homeFields,wallet:entities.wallets.balance,inventory:rows.inventory.map(row=>row.itemId),vehicleColors:Object.fromEntries(rows.vehicles.map(row=>[row.itemId,row.color])),ownedProperties:rows.properties.filter(row=>row.owned).map(row=>row.propertyId),propertyInvestments:Object.fromEntries(rows.properties.filter(row=>row.investment).map(row=>[row.propertyId,row.investment])),loans:rows.loans.sort((a,b)=>b.borrowedAt-a.borrowedAt).map(strip),gambleHistory:rounds.map(strip),lastGambleRound:rounds[0]?strip(rounds[0]):null,workDays:{},furnitureLayout,storedFurniture,billsPaidAt,rentPaidAt};
    p.propertyInvestments=normalizeInvestmentRecords(p,properties);
    stateMetadata.set(p,{walletVersion:entities.wallets.version,initialBalance:p.wallet});
    if(reconcileHousing){
      const changed=this.syncHousing(p);
      if(changed&&!session)return this.reconcileHousing(id);
    }return p;
  }
  async save(p,{session=null,persistEconomy=false}={}){
    check(session,'Profile writes require a MongoDB transaction',500,'transaction_required');
    const opts={session};check(integer(p.wallet),'Wallet must use exact whole Naira',409,'numeric_limit');
    await this.collection('residents').updateOne({id:p.id},{$set:{...pick(p,residentKeys),searchPrefixes:residentSearchPrefixes(p.username,p.displayName)}},opts);
    for(const [name,value] of [['appearances',p.appearance],['needs',pick(p,needsKeys)],['progression',pick(p,progressionKeys)],['player_state',pick(p,stateKeys)]])await this.collection(name).updateOne({residentId:p.id},{$set:value},opts);
    await this.collection('homes').replaceOne({residentId:p.id},{_id:p.id,residentId:p.id,...p.home,nextTenancyCheckAt:p.home.tenancy?nextTenancyCheck(p.home.tenancy,this.clock()):null,furnitureLayout:p.furnitureLayout,storedFurniture:p.storedFurniture,billsPaidAt:p.billsPaidAt,rentPaidAt:p.rentPaidAt},opts);
    if(persistEconomy){
      const meta=stateMetadata.get(p);check(meta,'Load the persisted wallet before changing it',500,'wallet_not_loaded');
      const changed=await this.collection('wallets').updateOne({residentId:p.id,version:meta.walletVersion,balance:meta.initialBalance},{$set:{balance:p.wallet},$inc:{version:1}},opts);
      check(changed.modifiedCount===1,'Wallet changed; retry this request',409,'wallet_conflict');meta.walletVersion++;meta.initialBalance=p.wallet;
      await this.collection('inventory').deleteMany({residentId:p.id,itemId:{$nin:p.inventory}},opts);
      await this.collection('vehicles').deleteMany({residentId:p.id,itemId:{$nin:Object.keys(p.vehicleColors)}},opts);
      for(const itemId of p.inventory){const item=catalog.find(item=>item.id===itemId);check(item,'Inventory item is not in the server catalogue',500,'inventory_invalid');await this.collection('inventory').updateOne({residentId:p.id,itemId},{$setOnInsert:{_id:`${p.id}:${itemId}`,residentId:p.id,itemId,category:item.category,acquiredAt:this.clock()}},{...opts,upsert:true});}
      for(const [itemId,color] of Object.entries(p.vehicleColors))await this.collection('vehicles').updateOne({residentId:p.id,itemId},{$set:{color},$setOnInsert:{_id:`${p.id}:${itemId}`,residentId:p.id,itemId}},{...opts,upsert:true});
      const propertyIds=[...new Set([...p.ownedProperties,...Object.keys(p.propertyInvestments)])];
      await this.collection('properties').deleteMany({residentId:p.id,propertyId:{$nin:propertyIds}},opts);
      for(const propertyId of propertyIds)await this.collection('properties').replaceOne({residentId:p.id,propertyId},{_id:`${p.id}:${propertyId}`,residentId:p.id,propertyId,owned:p.ownedProperties.includes(propertyId),...(p.propertyInvestments[propertyId]?{investment:p.propertyInvestments[propertyId]}:{})},{...opts,upsert:true});
      for(const loan of p.loans)await this.collection('loans').replaceOne({_id:loan.id,residentId:p.id},{_id:loan.id,residentId:p.id,...loan},{...opts,upsert:true});
      if(p.lastGambleRound)await this.collection('gamble_rounds').updateOne({_id:p.lastGambleRound.id},{$setOnInsert:{_id:p.lastGambleRound.id,residentId:p.id,...p.lastGambleRound,sequence:meta.walletVersion}},{...opts,upsert:true});
    }
    return structuredClone(p);
  }
  propertiesFor(id){if(typeof id==='string')return this.profile(id).then(p=>this.propertiesFor(p));return id?.origin?.residence?[...properties,id.origin.residence]:[...properties];}
  propertyFor(p,propertyId=p.home.propertyId){return this.propertiesFor(p).find(item=>item.id===propertyId);}
  syncHousing(p){
    const before=JSON.stringify(p.home),property=this.propertyFor(p),temporaryProperty=properties.find(row=>row.id===TENANCY_RULES.temporaryPropertyId);
    syncHomeTenancy(p,{property,temporaryProperty,now:this.clock(),id:uid(),seed:uid()});
    return before!==JSON.stringify(p.home);
  }
  async initHousing(){
    const indexes=await this.collection('homes').listIndexes().toArray();
    check(indexes.some(row=>row.name==='tenancy_check_due'),'Housing migration must run before startup',503,'housing_migration_required');
    return this;
  }
  async reconcileHousing(id){
    let changed=false;
    const result=await this.transaction(async session=>{const p=await this.profile(id,{session,reconcileHousing:false}),before=p.wallet;changed=this.syncHousing(p);const homeRecord=await this.collection('homes').findOne({residentId:id},{session,projection:{nextTenancyCheckAt:1}});if(changed||p.home.tenure==='rent'&&(!homeRecord.nextTenancyCheckAt||homeRecord.nextTenancyCheckAt<=this.clock()))await this.save(p,{session,persistEconomy:p.wallet!==before});if(p.wallet!==before)await this.appendLedger(id,p.wallet-before,'Housing deposit returned',this.clock(),`${p.home.housingHistory?.[0]?.id}:deposit-return`,stateMetadata.get(p).walletVersion,session,'PROPERTY_DEPOSIT_REFUND');return p;});
    if(changed){await this.emitUser(id,'profile',{profile:result});await this.social?.reconcileVisits?.(id);}
    return result;
  }
  async reconcileHousingBatch({limit=50}={}){
    const now=this.clock(),size=Math.min(100,Math.max(1,limit));
    const filter={tenure:'rent',$or:[{nextTenancyCheckAt:{$lte:now}},{nextTenancyCheckAt:{$exists:false}}]};
    const rows=await this.collection('homes').find(filter,{projection:{residentId:1}}).sort({tenure:1,nextTenancyCheckAt:1,residentId:1}).limit(size).toArray();
    for(const row of rows){if(this.housingStopping)break;await this.reconcileHousing(row.residentId);}
    return {checked:rows.length};
  }
  startHousingReconciliation({log=()=>{}}={}){
    if(this.housingTimer)return;this.housingStopping=false;
    const run=()=>{if(this.housingRun)return;this.housingRun=this.reconcileHousingBatch().catch(error=>log('housing_reconciliation_failure',{code:error.code||'storage_error'})).finally(()=>{this.housingRun=null;});};
    this.housingTimer=setInterval(run,60000);this.housingTimer.unref?.();run();
  }
  async stopHousingReconciliation(){this.housingStopping=true;clearInterval(this.housingTimer);this.housingTimer=null;await this.housingRun;}
  async housingAction(id,action,payload={}){
    const kind=action==='renew-rent'?'pay-rent':action;
    const normalized=Object.fromEntries(Object.entries(payload).filter(([key])=>key!=='idempotencyKey').sort(([a],[b])=>a.localeCompare(b)));
    const result=await this.economyOperation(id,kind,payload,normalized,(p,now)=>applyHousingAction(p,kind,payload,{now,properties:this.propertiesFor(p)}),{requireKey:HOUSING_MONEY_ACTIONS.has(action)});
    if(!result.replayed&&['move-home','move-out'].includes(kind))await this.social?.reconcileVisits?.(id);return result;
  }
  async register(body={}){
    const credentials=await this.auth.credentials(body),id=uid(),timestamp=this.clock();
    check(body.originId===undefined||ORIGIN_META.options.some(option=>option.id===body.originId),'Choose a listed life background',400,'invalid_origin');
    const origin=createOrigin({residentId:id,now:timestamp,originId:body.originId,randomInt:this.originRandomInt,properties,atlas:ABUJA_ATLAS}),home=originHome(origin),seed=life.starterHomeSeed(origin);
    const p={id,username:credentials.username,displayName:credentials.displayName,origin,appearance:appearance(variedAppearance({presentation:appearanceOptions.presentation.includes(body.appearance?.presentation)?body.appearance.presentation:'neutral',randomInt:max=>crypto.randomInt(max)}),body.appearance),wallet:origin.startingBalance,energy:82,hunger:72,hygiene:88,social:58,fun:64,stress:12,mood:76,reputation:0,district:home.district,location:{kind:'home',district:home.district,venue:'home'},home:{...home,...seed.homeStyle},job:null,careerLevel:1,skills:{},inventory:seed.inventory,ownedProperties:origin.giftedHome?[home.propertyId]:[],propertyInvestments:{},vehicleColors:{},gambleHistory:[],lastGambleRound:null,loans:[],workDays:{},furnitureLayout:seed.furnitureLayout,storedFurniture:seed.storedFurniture,drivingVehicle:null,onboardingComplete:false,lifeGoal:'explore',settings:{presenceVisible:true,allowInvites:true,soundEnabled:true},activeTrip:null,activeShift:null,completedShifts:0,nextShiftAt:0,lastActionAt:timestamp,billsPaidAt:timestamp,rentPaidAt:timestamp,createdAt:timestamp};
    let token;try{token=await this.transaction(async session=>{
      await this.collection('residents').insertOne({_id:id,id,...credentials,...pick(p,residentKeys),searchPrefixes:residentSearchPrefixes(p.username,p.displayName),createdAt:timestamp},{session});
      for(const [name,value] of [['appearances',p.appearance],['needs',pick(p,needsKeys)],['progression',pick(p,progressionKeys)],['player_state',pick(p,stateKeys)],['homes',{...p.home,furnitureLayout:p.furnitureLayout,storedFurniture:p.storedFurniture,billsPaidAt:timestamp,rentPaidAt:timestamp}],['origins',{origin}],['wallets',{balance:p.wallet,version:0}]])await this.collection(name).insertOne({_id:id,residentId:id,...value},{session});
      for(const itemId of p.inventory){const item=catalog.find(item=>item.id===itemId);await this.collection('inventory').insertOne({_id:`${id}:${itemId}`,residentId:id,itemId,category:item.category,acquiredAt:timestamp},{session});}
      for(const propertyId of p.ownedProperties)await this.collection('properties').insertOne({_id:`${id}:${propertyId}`,residentId:id,propertyId,owned:true},{session});
      const referrerId=/^[A-Za-z0-9:_-]{1,80}$/.test(String(body.referrerId||''))?String(body.referrerId):null;
      if(referrerId&&referrerId!==id&&await this.collection('residents').findOne({id:referrerId},{session}))await this.collection('friendships').updateOne({pair:[referrerId,id].sort().join(':')},{$set:{sender:referrerId,recipient:id,status:'accepted',createdAt:timestamp},$setOnInsert:{id:uid(),pair:[referrerId,id].sort().join(':')}},{upsert:true,session});
      await this.appendLedger(id,p.wallet,'Resident starting balance',timestamp,`registration:${id}`,0,session,'STARTING_MONEY');
      return this.auth.createSession(id,{session});
    });}catch(error){if(error.code===11000)throw new GameError('That username or email is already taken',409,'account_exists');throw error;}
    if(this.notify)await this.notify(id,'welcome','Welcome home',`Your ${home.name} is ready. Settle in, then explore your neighbourhood.`,'home');
    if(credentials.email&&this.auth.deliverEmailVerification)await this.auth.requestEmailVerification(id);
    return token;
  }
  async login(body){return this.auth.login(body);}async session(token){return this.auth.session(token);}async logout(token){return this.auth.logout(token);}async refreshSession(token){return this.auth.refreshSession(token);}async logoutAll(id){return this.auth.logoutAll(id);}
  async updateProfile(id,body={}){return this.transaction(async session=>{const p=await this.profile(id,{session});if(body.displayName!==undefined){check(clean(body.displayName,40).length>=2,'Display name must have at least two characters');p.displayName=clean(body.displayName,40);}appearance(p.appearance,body.appearance,p.inventory);if(body.settings&&typeof body.settings==='object')for(const key of ['presenceVisible','allowInvites','soundEnabled','allowHomeVisits','homeVisitsFriendsOnly'])if(typeof body.settings[key]==='boolean')p.settings[key]=body.settings[key];if(body.lifeGoal!==undefined){check(LIFE_GOALS.some(goal=>goal.id===body.lifeGoal),'Choose a listed life goal');p.lifeGoal=body.lifeGoal;}if(body.onboardingComplete!==undefined){check(typeof body.onboardingComplete==='boolean','Choose a valid onboarding state');if(body.onboardingComplete&&p.home.starterVersion===1)check(['feminine','masculine'].includes(p.appearance.presentation),'Choose Female or Male before completing your setup',400,'gender_required');p.onboardingComplete=body.onboardingComplete;}return this.save(p,{session});});}
  decay(p){const mins=Math.min(120,Math.max(0,(this.clock()-p.lastActionAt)/60000));if(mins>1){p.energy=clamp(p.energy-mins*.10);p.hunger=clamp(p.hunger-mins*.12);p.social=clamp(p.social-mins*.05);}}
  publicJobs(){return Object.fromEntries(Object.entries(jobs).map(([id,{tasks,...job}])=>[id,{...job,schedule:{...JOB_SCHEDULES[id],timeZone:'Africa/Lagos',maxDailyShifts:2}}]));}
  async workSchedule(id,now=this.clock(),{session=null}={}){const p=typeof id==='string'?await this.profile(id,{session}):id,dateKey=abujaTime(now).dateKey;const rows=await this.collection('challenges').find({residentId:p.id,workDate:dateKey,completedAt:{$ne:null}},session?{session}:{}).toArray();p.workDays[dateKey]={completed:rows.length,slots:[...new Set(rows.map(row=>row.shiftSlot).filter(Boolean))]};return jobSchedule(p.job,p,now);}
  async activeChallenge(id,{session=null}={}){const row=await this.collection('challenges').findOne({residentId:id,completedAt:null,cancelledAt:null,shiftEndsAt:{$gt:this.clock()}},{sort:{startedAt:-1},...(session?{session}:{})});return row?this.challengeView(row):null;}
  challengeView(row){return{id:row.id,jobId:row.jobId,title:jobs[row.jobId].title,startedAt:row.startedAt,dateKey:row.workDate,slotId:row.shiftSlot,expiresAt:row.shiftEndsAt,tasks:jobs[row.jobId].tasks.map(({answer,...task})=>task)};}
  async quoteTravel(id,payload={}){const p=typeof id==='string'?await this.profile(id):id,destination=clean(payload.district,80),mode=clean(payload.mode||'bus',16),venueId=payload.venueId==null?null:clean(payload.venueId,80);check(locations.has(destination),'Choose a location from the Abuja atlas');check(transportModes.some(item=>item.id===mode),'Choose a supported transport mode');check(mode!=='walk'||destination===p.district,'Walking is available within your neighbourhood; choose transport for this trip');check(mode!=='car'||catalog.some(item=>ownsVehicle(p,catalog,item.id)),'Buy a car before choosing your own vehicle');if(venueId!==null)check(venueId&&venueAvailable(venueId,destination),'Choose a place available in your destination neighbourhood');return travelPricing(locations.get(p.district),locations.get(destination),mode,{venueId});}
  async appendLedger(residentId,amount,reason,createdAt,operationId,sequence,session,type='economy',metadata={}){check(Number.isSafeInteger(amount),'Ledger amount must use exact whole Naira',409,'numeric_limit');const wallet=await this.collection('wallets').findOne({residentId},{session});check(wallet&&integer(wallet.balance),'Wallet audit balance is unavailable',503,'storage_incomplete');const id=uid();await this.collection('ledger').insertOne({_id:id,id,residentId,amount,reason,type,balanceAfter:wallet.balance,createdAt,operationId,sequence,...(metadata.transferId?{transferId:metadata.transferId}:{})},{session});}
  async economyOperation(id,kind,payload,normalized,mutate,{requireKey=true}={}){
    const key=payload.idempotencyKey;check(!requireKey||(typeof key==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(key)),'Use a valid idempotency key for this money action',400,'idempotency_required');
    check(key===undefined||typeof key==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(key),'Use a valid request key',400,'idempotency_required');const operationKey=key||uid(),fingerprint=JSON.stringify(normalized);let replayed=false;
    const result=await this.transaction(async session=>{
      const existing=await this.collection('economy_operations').findOne({residentId:id,operationKey},{session});if(existing){check(existing.kind===kind&&existing.fingerprint===fingerprint,'This request key was already used for a different action',409,'idempotency_conflict');replayed=true;return{ok:true,profile:await this.profile(id,{session}),...existing.result};}
      const p=await this.profile(id,{session}),before=p.wallet,timestamp=this.clock();const extra=await mutate(p,timestamp,session,operationKey);recordHousingLifeEvent(p,{kind,extra,now:timestamp,beforeBalance:before});check(integer(p.wallet),'This action cannot be represented as exact whole Naira',409,'numeric_limit');p.lastActionAt=timestamp;await this.save(p,{session,persistEconomy:true});
      const {ledgerReason,ledgerTransferId,ledgerType,...publicExtra}=extra||{};if(p.wallet!==before)await this.appendLedger(id,p.wallet-before,ledgerReason||kind,timestamp,operationKey,stateMetadata.get(p).walletVersion,session,ledgerType||economyTransactionType(kind,normalized,catalog),ledgerTransferId?{transferId:ledgerTransferId}:{});
      await this.collection('economy_operations').insertOne({_id:`${id}:${operationKey}`,residentId:id,operationKey,kind,fingerprint,result:publicExtra,createdAt:timestamp},{session});return{ok:true,profile:p,...publicExtra};
    });if(!replayed)await this.emitUser(id,'profile',{profile:result.profile});return{...result,replayed};
  }
  async transactions(id){return(await this.collection('ledger').find({residentId:id}).sort({createdAt:-1,sequence:-1,_id:-1}).limit(60).toArray()).map(({id,amount,reason,createdAt,type,balanceAfter,operationId})=>({id,amount,reason,createdAt,type,balanceAfter,operationId}));}
  async wallet(id){const p=await this.profile(id);return{ok:true,profile:p,walletMeta:{...WALLET_META,demoTopupEnabled:this.allowGameTopups},loanMeta:LOAN_META,loans:loanView(p,this.clock()),workSchedule:await this.workSchedule(p),transactions:await this.transactions(id)};}
  async topup(id,payload={}){check(this.allowGameTopups,'Client balance grants are disabled in production',403,'topup_disabled');check(!Object.hasOwn(payload,'verified'),'Real-money payments require a verified payment provider',403,'payments_unavailable');check(Number.isSafeInteger(payload.amount)&&payload.amount>0,'Choose a positive whole Naira game top-up',400,'invalid_topup');return this.economyOperation(id,'demo-topup',payload,{amount:payload.amount},(p,timestamp)=>{p.wallet+=payload.amount;return{topup:{id:uid(),amount:payload.amount,virtual:true,createdAt:timestamp},ledgerReason:'Free game Naira top-up'};});}
  async transfer(id,payload={}){
    const residentId=payload.residentId,amount=payload.amount,note=clean(payload.note,120),conversationId=payload.conversationId??null;
    check(typeof residentId==='string'&&residentId.length>0&&residentId.length<=80,'Choose a registered resident',400,'invalid_recipient');
    check(residentId!==id,'Choose another resident to send Naira to',400,'self_transfer');
    check(Number.isSafeInteger(amount)&&amount>0,'Enter a positive whole Naira amount',400,'invalid_amount');
    check(conversationId===null||typeof conversationId==='string'&&/^[A-Za-z0-9:_-]{1,80}$/.test(conversationId),'Choose a valid direct conversation',400,'invalid_conversation');
    const normalized={residentId,amount,note,...(conversationId?{conversationId}:{})};let notice=null,messageRow=null;
    const result=await this.economyOperation(id,'transfer-naira',payload,normalized,async(p,timestamp,session,operationKey)=>{
      notice=null;messageRow=null;
      const recipient=await this.profile(residentId,{session});
      check(!await this.blocked(id,residentId,{session}),'This resident is unavailable',403,'recipient_unavailable');
      check(p.wallet>=amount,'You need more Naira for this transfer',409,'insufficient_balance');
      check(Number.isSafeInteger(recipient.wallet+amount),'The recipient balance cannot represent this amount as exact whole Naira',409,'numeric_limit');
      const transfer={id:uid(),residentId,recipientId:residentId,senderId:id,senderName:p.displayName,recipientName:recipient.displayName,amount,note,createdAt:timestamp,virtual:true,currency:'game-naira'};
      let receipt=null;
      p.wallet-=amount;recipient.wallet+=amount;
      await this.save(recipient,{session,persistEconomy:true});
      const recipientOperationId=`transfer:${id}:${operationKey}`;
      await this.appendLedger(residentId,amount,`Naira from ${p.displayName}${note?` · ${note}`:''}`,timestamp,recipientOperationId,stateMetadata.get(recipient).walletVersion,session,'transfer_credit',{transferId:transfer.id});
      if(conversationId){
        check(this.social&&typeof this.social.recordTransferReceipt==='function','Chat transfer receipts are unavailable',503,'receipt_unavailable');
        messageRow=await this.social.recordTransferReceipt(id,residentId,conversationId,transfer,session);
        receipt=this.social.messageEvent(messageRow);
      }
      await this.collection('wallet_transfers').insertOne({_id:transfer.id,id:transfer.id,senderId:id,recipientId:residentId,amount,note,conversationId,operationKey,senderLedgerOperationId:operationKey,recipientLedgerOperationId:recipientOperationId,createdAt:timestamp,virtual:true,currency:'game-naira',...(messageRow?{messageId:messageRow.id}:{})},{session});
      if(!await this.muted(residentId,id,{session})){
        notice={id:uid(),kind:'transfer',title:'Naira received',body:`${p.displayName} sent you ₦${amount.toLocaleString()} in game Naira${note?` · ${note}`:''}.`,link:conversationId?`conversation:${conversationId}`:'wallet',createdAt:timestamp,readAt:null};
        await this.collection('notifications').insertOne({...notice,residentId,senderId:id},{session});
      }
      return{transfer,...(receipt?{receipt}:{}),ledgerTransferId:transfer.id,ledgerReason:`Naira to ${recipient.displayName}${note?` · ${note}`:''}`};
    });
    if(!result.replayed){
      await this.emitUser(residentId,'profile',{profile:await this.profile(residentId)});
      if(notice)await this.emitUser(residentId,'notification',notice);
      if(messageRow)await this.social.publishTransferReceipt(id,conversationId,messageRow);
    }
    return {...result,...(result.receipt?{message:result.receipt}:{})};
  }
  async vehicleAction(id,action,payload={}) {
    const item=catalog.find(item=>item.id===payload.itemId&&item.category==='vehicle');
    check(item,'Choose a car from the garage');const color=payload.color??item.defaultColor;
    check(vehicleColorFor(color)&&item.availableColors.includes(color),'Choose an available car colour');
    return this.economyOperation(id,action,payload,{itemId:item.id,color},p=>{
      if(action==='purchase'){
        check(!p.inventory.includes(item.id),'You already own this item',409,'item_owned');
        check(p.wallet>=item.price,'You need more Naira for this',409,'insufficient_balance');p.wallet-=item.price;p.inventory.push(item.id);
      }else check(p.inventory.includes(item.id),'You can repaint a car you own',403,'vehicle_not_owned');
      p.vehicleColors[item.id]=color;
      return{item,ledgerReason:action==='purchase'?`Car purchase · ${item.name}`:'Car repaint'};
    });
  }
  async investmentAction(id,action,payload={}) {
    const property=properties.find(item=>item.id===payload.propertyId&&item.tier>0);
    check(property,'Choose a listed investment property');
    return this.economyOperation(id,action,payload,{propertyId:property.id},(p,timestamp)=>{
      check(!p.activeTrip,'Finish your journey before changing property ownership');
      const primary=p.home.propertyId===property.id;
      check(!primary,'Your current home cannot be rented out or sold',409,'primary_home');
      if(action==='buy-investment'){
        check(!p.propertyInvestments[property.id],'You already rent out this property',409,'investment_owned');
        const alreadyOwned=p.ownedProperties.includes(property.id),cost=alreadyOwned?0:property.buy;
        check(p.wallet>=cost,'You need more Naira to buy this property',409,'insufficient_balance');p.wallet-=cost;
        if(!alreadyOwned)p.ownedProperties.push(property.id);
        const investment={propertyId:property.id,boughtAt:timestamp,lastCollectedAt:timestamp,purchasePrice:property.buy,incomePerPeriod:property.investmentIncome,resaleValue:property.investmentResale};
        p.propertyInvestments[property.id]=investment;
        return{investment:investmentView(p,property,timestamp),ledgerReason:`Investment purchase · ${property.name}`};
      }
      check(p.ownedProperties.includes(property.id)&&p.propertyInvestments[property.id],'You do not own this rental investment',403,'investment_not_owned');
      const investment=investmentView(p,property,timestamp);
      check(investment.representable,'This rental income cannot be represented as exact whole Naira',409,'numeric_limit');
      if(action==='collect-rent'){
        check(investment.collectable>0,'Rent is not ready yet; it accrues every minute',409,'rent_not_ready');
        p.wallet+=investment.collectable;
        const periods=Math.max(0,Math.floor((timestamp-investment.lastCollectedAt)/INVESTMENT_META.periodMs));
        p.propertyInvestments[property.id].lastCollectedAt+=periods*INVESTMENT_META.periodMs;
        return{income:{propertyId:property.id,amount:investment.collectable,createdAt:timestamp},investment:investmentView(p,property,timestamp),ledgerReason:`Rental income · ${property.name}`};
      }
      check(timestamp>=investment.canSellAt,'Hold the investment for one minute before selling',409,'investment_cooldown');
      const amount=investment.resaleValue+investment.collectable;p.wallet+=amount;
      delete p.propertyInvestments[property.id];p.ownedProperties=p.ownedProperties.filter(item=>item!==property.id);
      return{sale:{propertyId:property.id,amount,resaleValue:investment.resaleValue,rentalIncome:investment.collectable,createdAt:timestamp},ledgerReason:`Investment sale · ${property.name}`};
    });
  }
  async playDice(id,payload={}) {
    const stake=payload.stake,choice=payload.choice;
    check(Number.isSafeInteger(stake)&&stake>=DICE_META.minStake,'Choose a whole Naira stake of at least ₦100',400,'invalid_stake');
    check(DICE_META.choices.some(item=>item.id===choice),'Choose low (1–3) or high (4–6)',400,'invalid_choice');
    return this.economyOperation(id,'play-dice',payload,{stake,choice},(p,timestamp)=>{
      check(!p.activeTrip&&p.location.kind==='venue'&&p.location.venue==='games-lounge','Enter Dice & Chill Lounge before playing',400,'wrong_venue');
      check(p.wallet>=stake,'You need more Naira for this stake',409,'insufficient_balance');
      const die=crypto.randomInt(1,7),won=choice==='low'?die<=3:die>=4,payout=won?stake*DICE_META.payoutMultiplier:0;
      check(Number.isSafeInteger(payout),'This dice payout cannot be represented as exact whole Naira',409,'numeric_limit');
      const round={id:uid(),stake,choice,die,won,payout,net:payout-stake,createdAt:timestamp,virtual:true};p.wallet+=round.net;
      p.gambleHistory=[round,...p.gambleHistory].slice(0,20);p.lastGambleRound=round;
      return{round,ledgerReason:won?'Dice lounge · win':'Dice lounge · loss'};
    });
  }
  async loanAction(id,action,payload={}) {
    const amount=payload.amount;
    check(Number.isSafeInteger(amount)&&amount>0,'Choose a positive whole Naira amount',400,'invalid_amount');
    if(action==='borrow-loan'){
      check(payload.consent===true&&payload.consentVersion===LOAN_META.consentVersion,'Read and accept the game loan terms before borrowing',400,'loan_consent_required');
      let quote;try{quote=loanQuote(amount);}catch(error){throw new GameError(error.message,409,'numeric_limit');}
      return this.economyOperation(id,action,payload,{amount,consent:true,consentVersion:LOAN_META.consentVersion},(p,timestamp)=>{
        const active=p.loans.find(loan=>loan.outstanding>0);
        if(active)check(active.repaid*100>=active.principal*LOAN_META.redrawAfterRepaymentPercent,'Repay at least 50% of your current game loan before requesting more',409,'active_loan');
        check(amount<=LOAN_META.maxOutstandingPrincipal,'The largest game loan is ₦100m',400,'loan_limit');
        const day=abujaTime(timestamp).dateKey;
        const borrowedToday=p.loans.filter(loan=>abujaTime(loan.borrowedAt).dateKey===day).reduce((sum,loan)=>sum+loan.principal,0);
        check(borrowedToday+amount<=LOAN_META.dailyPrincipalCap,'Your new borrowing is capped at ₦10m per day',409,'daily_loan_limit');
        const principalOutstanding=p.loans.reduce((sum,loan)=>sum+Math.max(0,loan.principal-Math.min(loan.principal,loan.repaid)),0);
        check(principalOutstanding+amount<=LOAN_META.maxOutstandingPrincipal,'Your total outstanding game loans cannot exceed ₦100m',409,'loan_limit');
        const loan={id:uid(),lenderId:LOAN_META.id,...quote,outstanding:quote.totalRepayment,repaid:0,borrowedAt:timestamp,dueAt:timestamp+LOAN_META.termMs,consentVersion:LOAN_META.consentVersion,consentedAt:timestamp,virtual:true};
        p.wallet+=amount;p.loans=[loan,...p.loans.filter(item=>item.outstanding===0).slice(0,49)];
        return{loan,loans:loanView(p,timestamp),ledgerReason:'Game loan · borrowed principal'};
      });
    }
    const loanId=payload.loanId;check(typeof loanId==='string'&&loanId.length>0&&loanId.length<=80,'Choose a game loan',400,'invalid_loan');
    return this.economyOperation(id,action,payload,{loanId,amount},(p,timestamp)=>{
      const loan=p.loans.find(item=>item.id===loanId);check(loan,'Game loan not found',404,'loan_not_found');
      check(loan.outstanding>0,'This game loan has been repaid',409,'loan_repaid');
      check(amount<=loan.outstanding,'Repay no more than the outstanding amount',400,'invalid_repayment');
      check(p.wallet>=amount,'You need more Naira for this repayment',409,'insufficient_balance');
      p.wallet-=amount;loan.outstanding-=amount;loan.repaid+=amount;loan.lastRepaidAt=timestamp;if(loan.outstanding===0)loan.repaidAt=timestamp;
      return{loan,loans:loanView(p,timestamp),repayment:{id:uid(),loanId,amount,createdAt:timestamp},ledgerReason:'Game loan · repayment'};
    });
  }
  async sellItem(id,payload={}){
    const item=catalog.find(item=>item.id===payload.itemId);check(item,'Choose an item from the server catalogue',400,'invalid_item');
    return this.economyOperation(id,'sell-item',payload,{itemId:item.id},(p,timestamp)=>{
      check(p.inventory.includes(item.id),'Choose an item you own to sell',403,'item_not_owned');check(!p.activeTrip,'Finish your journey before selling an item',409,'trip_active');check(p.drivingVehicle!==item.id,'Park this car before selling it',409,'vehicle_driving');
      const amount=resalePrice(item);check(Number.isSafeInteger(amount)&&amount>0,'This item cannot be sold',400,'item_not_resellable');
      p.wallet+=amount;p.inventory=p.inventory.filter(id=>id!==item.id);storeSupportedFurniture(p,item.id);delete p.furnitureLayout[item.id];p.storedFurniture=p.storedFurniture.filter(id=>id!==item.id);delete p.vehicleColors[item.id];
      if(item.category==='clothing'&&p.appearance[item.slot]===item.value&&!catalog.some(other=>other.id!==item.id&&other.category==='clothing'&&other.slot===item.slot&&other.value===item.value&&p.inventory.includes(other.id)))p.appearance[item.slot]=initialAppearance[item.slot];
      return{sale:{itemId:item.id,amount,createdAt:timestamp,virtual:true},item,ledgerReason:`System resale · ${item.name}`};
    });
  }
  async action(id,action,payload={}) {
    if(action==='topup'||action==='demo-topup')return this.topup(id,payload);
    if(action==='transfer-naira')return this.transfer(id,payload);
    if(action==='sell-item')return this.sellItem(id,payload);
    if(['buy-investment','collect-rent','sell-investment'].includes(action))return this.investmentAction(id,action,payload);
    if(action==='play-dice')return this.playDice(id,payload);
    if(['borrow-loan','repay-loan'].includes(action))return this.loanAction(id,action,payload);
    if(HOUSING_ACTIONS.has(action))return this.housingAction(id,action,payload);
    if(['paint-vehicle'].includes(action)||(action==='purchase'&&catalog.some(item=>item.id===payload.itemId&&item.category==='vehicle')))return this.vehicleAction(id,action,payload);
    const moneyActions=new Set(['eat','hangout','exercise','cinema','venue-action','travel','return-home','purchase','sell-item','move-home','pay-bills','renew-rent']);
    const normalized=Object.fromEntries(Object.entries(payload).filter(([key])=>key!=='idempotencyKey').sort(([a],[b])=>a.localeCompare(b)));
    const result=await this.economyOperation(id,action,payload,normalized,async(p,timestamp,session)=>{
      this.decay(p);const comfort=homeBenefits(p,this.propertyFor(p));let extra={};
      const debit=amount=>{check(Number.isSafeInteger(amount)&&amount>=0,'Invalid cost');check(p.wallet>=amount,'You need more Naira for this');p.wallet-=amount;};const home=()=>check(p.location.kind==='home','Go home to use this object');const publicPlace=()=>check(p.location.kind==='public'&&!p.activeTrip,'Head out into your neighbourhood first');
      if(p.activeTrip&&!['arrive','topup'].includes(action))throw new GameError('Your journey is still in progress');
      if(p.location.kind==='visit'&&['travel','return-home','move-home'].includes(action))throw new GameError('Leave your visit before travelling or moving home',409,'visit_active');
      switch(action){
        case 'eat':home();debit(ECONOMY_CONFIG.basicActivities.eat);p.hunger=clamp(p.hunger+34);p.mood=clamp(p.mood+4);break;
        case 'sleep':home();p.energy=clamp(p.energy+46+comfort.sleepEnergyBonus);p.hunger=clamp(p.hunger-9);p.stress=clamp(p.stress-12);break;
        case 'shower':home();p.hygiene=clamp(p.hygiene+42);p.mood=clamp(p.mood+2);break;
        case 'relax':home();p.fun=clamp(p.fun+22+comfort.relaxFunBonus);p.stress=clamp(p.stress-14-comfort.relaxStressReduction);p.energy=clamp(p.energy+8);break;
        case 'hangout':publicPlace();debit(ECONOMY_CONFIG.basicActivities.hangout);p.social=clamp(p.social+28);p.fun=clamp(p.fun+20);p.energy=clamp(p.energy-8);break;
        case 'exercise':publicPlace();debit(ECONOMY_CONFIG.basicActivities.exercise);p.fun=clamp(p.fun+12);p.stress=clamp(p.stress-18);p.energy=clamp(p.energy-14);p.hygiene=clamp(p.hygiene-10);break;
        case 'cinema':publicPlace();debit(ECONOMY_CONFIG.basicActivities.cinema);p.fun=clamp(p.fun+34);p.stress=clamp(p.stress-16);p.energy=clamp(p.energy-5);break;
        case 'leave-home':home();p.drivingVehicle=null;p.location={kind:'public',district:p.district,venue:'neighbourhood'};break;
        case 'enter-home':check(p.district===p.home.district,'Travel to your home neighbourhood first');check(!p.drivingVehicle,'Park your car before entering');check(['public','home'].includes(p.location.kind),'Head outside before entering your home');p.location={kind:'home',district:p.district,venue:'home'};break;
        case 'enter-venue':{publicPlace();const venue=venueFor(payload.venueId);check(venue&&venueAvailable(venue.id,p.district),'Choose a place in your neighbourhood');check(!payload.district||payload.district===p.district,'Travel to this neighbourhood first');check(!p.drivingVehicle,'Park your car before entering');p.location={kind:'venue',district:p.district,venue:venue.id};extra.venue=venue;break;}
        case 'exit-venue':{
          check(p.location.kind==='venue','You are already outside');
          const venueId=p.location.venue;
          p.drivingVehicle=null;
          p.location={kind:'public',district:p.district,venue:'neighbourhood',exteriorEntry:{venueId,transitionId:uid()}};
          break;
        }
        case 'venue-action':{const activity=venueActionFor(payload.activityId);check(activity,'Choose an activity from this place');check(p.location.kind==='venue'&&p.location.venue===activity.venueId,'Enter this place before using its facilities');if(venueFor(activity.venueId)?.kind==='club'&&activity.cost>0)check(clubSchedule(timestamp).isOpen,clubSchedule(timestamp).reason,409,'venue_closed');check(!(activity.effects.energy<0)||p.energy>=-activity.effects.energy,'Rest before doing this activity');debit(activity.cost);applyNeedEffects(p,activity.effects);if(activity.skill)p.skills[activity.skill]=(p.skills[activity.skill]||0)+1;extra.activity={...activity,startedAt:timestamp};break;}
        case 'toggle-driving':{publicPlace();const vehicleId=payload.vehicleId??null;if(vehicleId===null){p.drivingVehicle=null;break;}check(ownsVehicle(p,catalog,vehicleId),'Buy this car before taking the wheel');p.drivingVehicle=vehicleId;extra.vehicle=catalog.find(item=>item.id===vehicleId);break;}
        case 'place-furniture':{home();const item=catalog.find(item=>item.id===payload.itemId);check(item?.category==='furniture'&&p.inventory.includes(item.id),'Buy this furniture before placing it');let placement;try{placement=validateFurniturePlacement(p,item.id,payload);applyFurniturePlacement(p,item.id,placement);}catch(error){throw new GameError(error.message,400,error.code);}extra.placement={itemId:item.id,...placement};break;}
        case 'store-furniture':{home();const item=catalog.find(item=>item.id===payload.itemId);check(item?.category==='furniture'&&p.inventory.includes(item.id),'You can store furniture you own');storeSupportedFurniture(p,item.id);delete p.furnitureLayout[item.id];if(!p.storedFurniture.includes(item.id))p.storedFurniture.push(item.id);extra.storedItemId=item.id;break;}
        case 'design-home':{
          home();let roomStyle;try{roomStyle=validateHomeDesign(payload.roomStyle);}catch(error){throw new GameError(error.message);}
          check(homeDesignPreservesRoutes(p,roomStyle),'Keep the entrance, furnishings and activity routes clear',400,'home_route_blocked');p.home.roomStyle=roomStyle;extra.roomStyle=roomStyle;break;
        }
        case 'return-home':case 'travel':{
          const destination=action==='return-home'?p.home.district:clean(payload.district,80);check(locations.has(destination),'Choose a location from the Abuja atlas');
          if(destination===p.district&&action==='return-home'){p.drivingVehicle=null;p.location={kind:'home',district:destination,venue:'home'};break;}
          const venueId=action==='travel'&&payload.venueId!=null?clean(payload.venueId,80):null;
          if(venueId!==null)publicPlace();
          const {mode,cost,seconds}=await this.quoteTravel(p,{district:destination,mode:payload.mode,venueId});
          const requestedVehicle=payload.vehicleId??p.drivingVehicle??(p.vehiclePresence?.district===p.district?p.vehiclePresence.vehicleId:null);
          if(mode==='car'&&payload.vehicleId!=null)check(ownsVehicle(p,catalog,payload.vehicleId),'Buy this car before choosing it');
          const vehicleId=mode==='car'?(ownsVehicle(p,catalog,requestedVehicle)?requestedVehicle:catalog.find(item=>ownsVehicle(p,catalog,item.id))?.id):null;
          debit(cost);p.drivingVehicle=null;p.activeTrip={id:uid(),fromLocation:{...p.location},destination,mode,cost,seconds,vehicleId,...(venueId?{venueId}:{}),arrivesAt:timestamp+seconds*1000,returningHome:action==='return-home'};extra.trip=p.activeTrip;p.location={kind:'transit',district:p.district,venue:'journey'};break;
        }
        case 'arrive':{const trip=p.activeTrip;check(trip&&trip.id===payload.tripId,'This journey is no longer active',409,'trip_not_active');check(timestamp>=trip.arrivesAt,'Your journey is still in progress',409,'trip_in_progress');if(trip.venueId)check(venueAvailable(trip.venueId,trip.destination),'This destination is no longer available');p.district=trip.destination;p.location={kind:trip.returningHome?'home':trip.venueId?'venue':'public',district:trip.destination,venue:trip.returningHome?'home':trip.venueId||'neighbourhood'};p.drivingVehicle=!trip.returningHome&&!trip.venueId&&trip.mode==='car'&&ownsVehicle(p,catalog,trip.vehicleId)?trip.vehicleId:null;p.activeTrip=null;p.energy=clamp(p.energy-3);break;}
        case 'take-job':check(typeof payload.jobId==='string'&&Object.hasOwn(jobs,payload.jobId),'Choose a listed job');check(!await this.activeChallenge(id,{session}),'Finish your current shift before switching careers');p.job=payload.jobId;break;
        case 'start-shift':{
          const job=jobs[p.job];check(job,'Choose a job before starting a shift');publicPlace();check(p.district===job.district,`Travel to ${locations.get(job.district)?.name||job.district} for your shift`);
          const active=await this.activeChallenge(id,{session});if(active){extra.challenge=active;break;}
          await this.collection('challenges').updateMany({residentId:id,completedAt:null,cancelledAt:null,shiftEndsAt:{$lte:timestamp}},{$set:{cancelledAt:timestamp}},{session});
          check(timestamp>=p.nextShiftAt,'Take a moment between shifts',409,'shift_cooldown');
          const schedule=await this.workSchedule(p,timestamp,{session});check(schedule.canStart,schedule.reason,409,schedule.remainingToday===0?'daily_shift_limit':!schedule.isWorkDay||!schedule.isOpen?'workplace_closed':'shift_slot_completed');
          check(p.energy>=job.energy,'Rest before starting another shift');
          const slot=schedule.slots.find(item=>item.id===schedule.availableSlot),row={id:uid(),residentId:id,jobId:p.job,startedAt:timestamp,workDate:schedule.dateKey,shiftSlot:slot.id,shiftEndsAt:slot.endsAt,completedAt:null,cancelledAt:null,result:null};
          await this.collection('challenges').insertOne({_id:row.id,...row},{session});extra.challenge=this.challengeView(row);extra.workSchedule=schedule;p.activeShift=row.id;break;
        }
        case 'complete-shift':{
          const row=await this.collection('challenges').findOne({id:clean(payload.challengeId,80),residentId:id},{session});check(row,'Shift not found');
          if(row.completedAt){extra.result=row.result;extra.workSchedule=await this.workSchedule(p,timestamp,{session});break;}
          const job=jobs[row.jobId];check(p.district===job.district&&p.location.kind==='public','Complete your shift at the workplace');
          check(!row.cancelledAt&&(!row.shiftEndsAt||timestamp<row.shiftEndsAt)&&(!row.workDate||abujaTime(timestamp).dateKey===row.workDate),'This shift has ended; start an available shift',409,'shift_expired');
          const schedule=await this.workSchedule({...p,job:row.jobId},timestamp,{session});check(schedule.remainingToday>0,'You have finished today’s two shifts. Come back tomorrow.',409,'daily_shift_limit');check(!row.shiftSlot||!schedule.slots.find(slot=>slot.id===row.shiftSlot)?.completed,'This shift slot has already been completed',409,'shift_slot_completed');
          check(timestamp-row.startedAt>=1500,'Read the tasks before submitting your shift',409,'shift_too_fast');check(Array.isArray(payload.answers)&&payload.answers.length===job.tasks.length,'Answer each shift task');
          check(payload.answers.every(answer=>answer&&typeof answer==='object'&&typeof answer.taskId==='string'&&typeof answer.optionId==='string'),'Choose valid shift answers');const answers=new Map(payload.answers.map(a=>[a.taskId,a.optionId]));check(answers.size===job.tasks.length&&job.tasks.every(t=>answers.has(t.id)&&t.options.some(o=>o.id===answers.get(t.id))),'Choose one valid answer for every task');
          const correct=job.tasks.filter(t=>answers.get(t.id)===t.answer).length,pay=Math.round(job.pay*(.4+.6*correct/job.tasks.length));p.wallet+=pay;p.energy=clamp(p.energy-job.energy);p.hunger=clamp(p.hunger-10);p.stress=clamp(p.stress+8);p.reputation+=correct===job.tasks.length?2:1;p.completedShifts++;p.skills[job.skill]=(p.skills[job.skill]||0)+correct;p.careerLevel=1+Math.floor(p.completedShifts/5);p.activeShift=null;p.nextShiftAt=timestamp+20000;
          extra.result={challengeId:row.id,pay,correct,total:job.tasks.length,careerLevel:p.careerLevel,dateKey:row.workDate,slotId:row.shiftSlot};await this.collection('challenges').updateOne({_id:row.id,completedAt:null},{$set:{completedAt:timestamp,result:extra.result}},{session});
          extra.workSchedule=await this.workSchedule(p,timestamp,{session});p.workDays=Object.fromEntries(Object.entries(p.workDays).sort(([a],[b])=>b.localeCompare(a)).slice(0,8));break;
        }
        case 'work-shift':throw new GameError('Start a shift and complete its work tasks to earn your salary');
        case 'purchase':{const item=catalog.find(item=>item.id===payload.itemId);check(item,'Choose an item from Okrika Marketplace');check(!p.inventory.includes(item.id),'You already own this item',409);if(item.category==='vehicle'){const color=payload.color??item.defaultColor;check(vehicleColorFor(color)&&item.availableColors.includes(color),'Choose an available car colour');p.vehicleColors[item.id]=color;}debit(item.price);p.inventory.push(item.id);if(item.category==='furniture'&&!p.storedFurniture.includes(item.id))p.storedFurniture.push(item.id);extra.item=item;break;}
        case 'paint-vehicle':{const item=catalog.find(item=>item.id===payload.itemId&&item.category==='vehicle');check(item&&p.inventory.includes(item.id),'You can repaint a car you own',403,'vehicle_not_owned');check(vehicleColorFor(payload.color)&&item.availableColors.includes(payload.color),'Choose an available car colour');p.vehicleColors[item.id]=payload.color;extra.item=item;break;}
        case 'equip':{const item=catalog.find(item=>item.id===payload.itemId);check(item?.category==='clothing'&&p.inventory.includes(item.id),'You can wear clothing you own');p.appearance[item.slot]=item.value;break;}
        case 'pay-bills':{check(timestamp-p.billsPaidAt>=GAME_BILL_PERIOD_MS,'Your home bills are up to date');const property=this.propertyFor(p);check(property,'Home property not found',404);const amount=Math.round(property.bills*(100-comfort.billDiscountPercent)/100);debit(amount);p.billsPaidAt=timestamp;extra.bill={amount,baseAmount:property.bills,discountPercent:comfort.billDiscountPercent};break;}
        default:throw new GameError('Unknown action');
      }
      return {...extra,ledgerReason:action};
    },{requireKey:moneyActions.has(action)});return result;
  }
  async blocked(a,b,{session=null}={}){return Boolean(await this.collection('moderation').findOne({kind:'block',$or:[{owner:a,target:b},{owner:b,target:a}]},session?{session}:{}));}
  async muted(a,b,{session=null}={}){return Boolean(await this.collection('moderation').findOne({kind:'mute',owner:a,target:b},session?{session}:{}));}
  async resident(viewer,id){
    check(typeof id==='string'&&id.length>0&&id.length<=80,'Choose a valid resident');
    const [identity,look,state,progress]=await Promise.all([
      this.collection('residents').findOne({_id:id},{projection:{username:1,displayName:1,'settings.presenceVisible':1}}),
      this.collection('appearances').findOne({residentId:id},{projection:{_id:0,residentId:0}}),
      this.collection('player_state').findOne({residentId:id},{projection:{district:1,location:1}}),
      this.collection('progression').findOne({residentId:id},{projection:{reputation:1}})
    ]);check(identity,'Resident not found',404);const visible=identity.settings?.presenceVisible!==false&&(!viewer||!await this.blocked(viewer,id));
    return{id,username:identity.username,displayName:identity.displayName,appearance:look,reputation:progress?.reputation||0,online:visible&&this.isOnline(id),district:visible?state?.district||null:null,location:visible?state?.location||null:null};
  }
  async zone(id){const p=typeof id==='string'?await this.collection('player_state').findOne({residentId:id},{projection:{district:1,location:1}}):id;check(p?.location,'Resident location not found',404);const residentId=typeof id==='string'?id:id.id;return p.location.kind==='home'?`home:${residentId}`:p.location.kind==='visit'?`home:${p.location.ownerId}`:p.location.kind==='venue'?`venue:${p.district}:${p.location.venue}`:p.location.kind==='public'?`district:${p.district}`:`transit:${residentId}`;}
  async bootstrap(id,{startup=false}={}){
    const profile=await this.profile(id);
    if(startup){
      const [workSchedule,activeChallenge]=await Promise.all([this.workSchedule(profile),this.activeChallenge(id)]);
      return{authenticated:true,startup:true,profile,originMeta:ORIGIN_META,loanMeta:LOAN_META,loans:loanView(profile,this.clock()),workSchedule,properties:this.propertiesFor(profile),activeChallenge,people:[],friends:[],friendRequests:[],conversations:[],notifications:[],invitations:[],nearby:[],events:[],blocked:[],muted:[],transactions:[]};
    }
    const workSchedule=await this.workSchedule(profile);
    const socialNames=['people','friends','friendRequests','conversations','notifications','invitations','nearby','events'];
    const [socialResults,moderation,activeChallenge,transactions]=await Promise.all([
      Promise.all(socialNames.map(name=>typeof this[name]==='function'?this[name](id):[])),
      this.collection('moderation').find({owner:id}).toArray(),
      this.activeChallenge(id),
      this.transactions(id)
    ]);
    const social=Object.fromEntries(socialNames.map((name,index)=>[name,socialResults[index]]));
    return{authenticated:true,profile,originMeta:ORIGIN_META,loanMeta:LOAN_META,loans:loanView(profile,this.clock()),workSchedule,properties:this.propertiesFor(profile),activeChallenge,...social,blocked:moderation.filter(row=>row.kind==='block').map(row=>row.target),muted:moderation.filter(row=>row.kind==='mute').map(row=>row.target),transactions};
  }
}

import crypto from 'node:crypto';
import { ECONOMY_CONFIG } from '../shared/economy.mjs';
import { economyTransactionType } from '../shared/transactions.mjs';
import { TENANCY_RULES, recordHousingLifeEvent, syncHomeTenancy } from '../shared/tenancy.mjs';
import { HOUSING_ACTIONS, HOUSING_MONEY_ACTIONS, applyHousingAction } from './housingActions.mjs';
import { GIG_ACTIONS, GIG_MONEY_ACTIONS, applyServerGigAction } from './streetGigs.mjs';
import { HUSTLE_ACTIONS, HUSTLE_MONEY_ACTIONS, applyServerHustleAction, recordHustleProgress } from './dailyHustle.mjs';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { ABUJA_ATLAS } from '../shared/atlas.mjs';
import { LIFE_GOALS, GAME_BILL_PERIOD_MS, WALLET_META, INVESTMENT_META, DICE_META, LOAN_META, HOME_UPGRADES, TRANSPORT_MODES, travelPricing, starterHomeSeed, systemResaleValue, homeBenefits, investmentView, normalizeInvestmentRecords, loanView, loanQuote, venueFor, venueAvailable, venueActionFor, ownsVehicle, applyNeedEffects, furniturePlacement } from '../shared/life.mjs';
import { VEHICLE_CATALOG, vehicleColorFor } from '../shared/vehicles.mjs';
import { ORIGIN_META, createOrigin, originHome } from '../shared/origins.mjs';
import { abujaTime, jobSchedule, clubSchedule, JOB_SCHEDULES } from '../shared/simulation.mjs';
import { variedAppearance } from '../shared/avatars.mjs';
import { validateFurniturePlacement, applyFurniturePlacement, storeSupportedFurniture, readFurniturePlacement } from '../shared/furniture-placement.mjs';
import { validateHomeDesign } from '../shared/home-design.mjs';
import { homeDesignPreservesRoutes } from '../../app/world-interiors.js';
const scrypt = promisify(crypto.scrypt);
const uid = () => crypto.randomUUID();
const clean = (value, max = 80) => String(value ?? '').trim().slice(0, max);
const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
const locations = new Map(ABUJA_ATLAS.map(place => [place.id, place]));
import { GameError } from './errors.mjs';
export { GameError };
const check = (condition, message, status = 400, code) => { if (!condition) throw new GameError(message, status, code); };
import { jobs, catalog, properties, activities, transportModes, appearanceOptions } from '../shared/catalogue.mjs';
export { jobs, catalog, properties, activities, transportModes, appearanceOptions };
const initialAppearance = {skinTone:'brown',face:'oval',body:'regular',hair:'crop',facialHair:'none',presentation:'neutral',top:'forest',bottom:'charcoal',shoes:'white',accessory:'none'};
function updateAppearance(current, incoming, inventory=[]) { if(incoming&&typeof incoming==='object')for(const [key,values] of Object.entries(appearanceOptions))if(incoming[key]!==undefined){check(values.includes(incoming[key]),`Choose a supported ${key}`);if(key==='top'&&!['forest','ochre'].includes(incoming[key])){const item=catalog.find(item=>item.category==='clothing'&&item.slot==='top'&&item.value===incoming[key]);check(item&&inventory.includes(item.id),'Buy this outfit in Okrika Marketplace before wearing it',403,'outfit_not_owned');}current[key]=incoming[key];}return current; }

export class GameStore {
  constructor({dataDir=process.env.ABUJALIFE_DATA_DIR||path.resolve('.local'),clock=Date.now,originRandomInt=crypto.randomInt,gigRandomInt=crypto.randomInt}={}) {
    fs.mkdirSync(dataDir,{recursive:true});this.db=new DatabaseSync(path.join(dataDir,'abujalife.sqlite'));this.clock=clock;this.originRandomInt=originRandomInt;this.gigRandomInt=gigRandomInt;this.emitUser=()=>{};this.emitZone=()=>{};this.isOnline=()=>false;this.onlineInZone=()=>null;
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS residents(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,profile TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS resident_origins(resident_id TEXT PRIMARY KEY REFERENCES residents(id),origin TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,resident_id TEXT NOT NULL REFERENCES residents(id),expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,resident_id TEXT NOT NULL REFERENCES residents(id),amount INTEGER NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS economy_operations(resident_id TEXT NOT NULL REFERENCES residents(id),operation_key TEXT NOT NULL,kind TEXT NOT NULL,fingerprint TEXT NOT NULL,result TEXT NOT NULL,amount INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,PRIMARY KEY(resident_id,operation_key));
      CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,resident_id TEXT NOT NULL,job_id TEXT NOT NULL,started_at INTEGER NOT NULL,completed_at INTEGER,result TEXT);
      CREATE TABLE IF NOT EXISTS friendship(id TEXT PRIMARY KEY,sender TEXT NOT NULL,recipient TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(sender,recipient));
      CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,kind TEXT NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS members(conversation_id TEXT NOT NULL REFERENCES conversations(id),resident_id TEXT NOT NULL REFERENCES residents(id),joined_at INTEGER NOT NULL,read_at INTEGER NOT NULL DEFAULT 0,delivered_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(conversation_id,resident_id));
      CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id),sender_id TEXT NOT NULL REFERENCES residents(id),text TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS message_operations(sender_id TEXT NOT NULL REFERENCES residents(id),operation_key TEXT NOT NULL,fingerprint TEXT NOT NULL,message_id TEXT NOT NULL UNIQUE REFERENCES messages(id),created_at INTEGER NOT NULL,PRIMARY KEY(sender_id,operation_key));
      CREATE TABLE IF NOT EXISTS message_transfers(message_id TEXT PRIMARY KEY REFERENCES messages(id),transfer_id TEXT NOT NULL UNIQUE,amount INTEGER NOT NULL CHECK(amount>0),note TEXT NOT NULL,from_id TEXT NOT NULL REFERENCES residents(id),to_id TEXT NOT NULL REFERENCES residents(id),created_at INTEGER NOT NULL,sender_name TEXT NOT NULL,recipient_name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS location_messages(id TEXT PRIMARY KEY,zone TEXT NOT NULL,sender_id TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,resident_id TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,link TEXT,created_at INTEGER NOT NULL,read_at INTEGER);
      CREATE TABLE IF NOT EXISTS moderation(owner TEXT NOT NULL,target TEXT NOT NULL,kind TEXT NOT NULL,PRIMARY KEY(owner,target,kind));
      CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,reporter TEXT NOT NULL,resident_id TEXT,message_id TEXT,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY,sender TEXT NOT NULL,recipient TEXT NOT NULL,kind TEXT NOT NULL,district TEXT NOT NULL,activity TEXT,note TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,host_id TEXT NOT NULL,title TEXT NOT NULL,district TEXT NOT NULL,starts_at INTEGER NOT NULL,description TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS rsvps(event_id TEXT NOT NULL REFERENCES events(id),resident_id TEXT NOT NULL,PRIMARY KEY(event_id,resident_id));
      CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id,created_at);
      CREATE INDEX IF NOT EXISTS notices_resident ON notifications(resident_id,created_at);
      CREATE INDEX IF NOT EXISTS location_messages_zone ON location_messages(zone,created_at);`);
    if(!this.all('PRAGMA table_info(notifications)').some(column=>column.name==='sender_id'))this.db.exec('ALTER TABLE notifications ADD COLUMN sender_id TEXT');
    const challengeColumns=new Set(this.all('PRAGMA table_info(challenges)').map(column=>column.name));
    for(const [name,type] of [['work_date','TEXT'],['shift_slot','TEXT'],['shift_ends_at','INTEGER'],['cancelled_at','INTEGER']])if(!challengeColumns.has(name))this.db.exec(`ALTER TABLE challenges ADD COLUMN ${name} ${type}`);
    this.db.exec('CREATE INDEX IF NOT EXISTS challenges_work_date ON challenges(resident_id,work_date,completed_at)');
    const ledgerColumns=new Set(this.all('PRAGMA table_info(ledger)').map(column=>column.name));
    for(const [name,type] of [['type',"TEXT NOT NULL DEFAULT 'LEGACY'"],['balance_after','INTEGER'],['operation_id','TEXT']])if(!ledgerColumns.has(name))this.db.exec(`ALTER TABLE ledger ADD COLUMN ${name} ${type}`);
    // Older pending tasks have no real-calendar reservation and cannot be redeemed.
    this.run('UPDATE challenges SET cancelled_at=? WHERE completed_at IS NULL AND cancelled_at IS NULL AND work_date IS NULL',this.clock());
  }
  close(){this.db.close();}
  get(sql,...args){return this.db.prepare(sql).get(...args);}
  all(sql,...args){return this.db.prepare(sql).all(...args);}
  run(sql,...args){return this.db.prepare(sql).run(...args);}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const value=fn();this.db.exec('COMMIT');return value;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  profile(id){check(typeof id==='string'&&id.length>0&&id.length<=80,'Choose a valid resident');const row=this.get('SELECT profile FROM residents WHERE id=?',id);check(row,'Resident not found',404);const p=JSON.parse(row.profile);const origin=this.get('SELECT origin FROM resident_origins WHERE resident_id=?',id);if(origin)p.origin=JSON.parse(origin.origin);p.furnitureLayout ||= {};p.storedFurniture ||= [];p.drivingVehicle ??= null;p.onboardingComplete ??= false;p.lifeGoal ||= 'explore';p.ownedProperties ||= [];p.vehicleColors ||= {};p.propertyInvestments=normalizeInvestmentRecords(p,this.propertiesFor(p));p.gambleHistory ||= [];p.lastGambleRound ??= null;p.loans ||= [];p.workDays ||= {};p.rentPaidAt ??= p.billsPaidAt??p.createdAt;const before=JSON.stringify(p.home);syncHomeTenancy(p,{property:this.propertyFor(p),temporaryProperty:properties.find(row=>row.id===TENANCY_RULES.temporaryPropertyId),now:this.clock(),id:uid(),seed:uid()});if(before!==JSON.stringify(p.home))this.run('UPDATE residents SET profile=? WHERE id=?',JSON.stringify(p),p.id);return p;}
  save(profile){const origin=this.get('SELECT origin FROM resident_origins WHERE resident_id=?',profile.id);if(origin)profile.origin=JSON.parse(origin.origin);this.run('UPDATE residents SET profile=? WHERE id=?',JSON.stringify(profile),profile.id);return structuredClone(profile);}
  propertiesFor(id){const p=typeof id==='string'?this.profile(id):id;return p?.origin?.residence?[...properties,p.origin.residence]:[...properties];}
  propertyFor(profile,propertyId=profile.home.propertyId){return this.propertiesFor(profile).find(item=>item.id===propertyId);}
  // Street gigs (ride-hailing, deliveries, errands). The payout is a normal ledger
  // entry inside the same atomic, idempotent economy operation as every wage.
  // Today's Hustle: claiming a finished mission, the daily check-in and one swap a day.
  hustleAction(id,action,payload={}){
    const normalized=Object.fromEntries(Object.entries(payload).filter(([key])=>key!=='idempotencyKey').sort(([a],[b])=>a.localeCompare(b)));
    return this.economyOperation(id,action,payload,normalized,(p,now)=>applyServerHustleAction(p,action,payload,{now}),{requireKey:HUSTLE_MONEY_ACTIONS.has(action)});
  }
  gigAction(id,action,payload={}){
    const normalized=Object.fromEntries(Object.entries(payload).filter(([key])=>key!=='idempotencyKey').sort(([a],[b])=>a.localeCompare(b)));
    return this.economyOperation(id,action,payload,normalized,(p,now)=>applyServerGigAction(p,action,payload,{now,randomInt:this.gigRandomInt}),{requireKey:GIG_MONEY_ACTIONS.has(action)});
  }
  housingAction(id,action,payload={}){
    const kind=action==='renew-rent'?'pay-rent':action,normalized=Object.fromEntries(Object.entries(payload).filter(([key])=>key!=='idempotencyKey').sort(([a],[b])=>a.localeCompare(b)));
    return this.economyOperation(id,kind,payload,normalized,(p,now)=>applyHousingAction(p,kind,payload,{now,properties:this.propertiesFor(p)}),{requireKey:HOUSING_MONEY_ACTIONS.has(action)});
  }
  async register({username,displayName,password,appearance,referrerId,originId}) {
    username=clean(username,24).toLowerCase();displayName=clean(displayName,40)||username;check(/^[a-z0-9_]{3,24}$/.test(username),'Use 3–24 letters, numbers or underscores for your username');check(typeof password==='string'&&password.length>=8&&password.length<=128,'Choose a password of 8–128 characters');check(!this.get('SELECT id FROM residents WHERE username=?',username),'That username is already taken',409);
    referrerId=/^[A-Za-z0-9:_-]{1,80}$/.test(String(referrerId||''))?String(referrerId):null;
    const salt=crypto.randomBytes(16).toString('hex');const hash=(await scrypt(password,salt,64)).toString('hex');const id=uid(),timestamp=this.clock();
    check(originId===undefined||ORIGIN_META.options.some(option=>option.id===originId),'Choose a listed life background',400,'invalid_origin');
    const origin=createOrigin({residentId:id,now:timestamp,originId,randomInt:this.originRandomInt,properties,atlas:ABUJA_ATLAS}),seed=starterHomeSeed(origin),home={...originHome(origin),...seed.homeStyle};
    const profile={id,username,displayName,origin,appearance:updateAppearance(variedAppearance({presentation:appearanceOptions.presentation.includes(appearance?.presentation)?appearance.presentation:'neutral',randomInt:max=>crypto.randomInt(max)}),appearance),wallet:origin.startingBalance,energy:82,hunger:72,hygiene:88,social:58,fun:64,stress:12,mood:76,reputation:0,district:home.district,location:{kind:'home',district:home.district,venue:'home'},home,job:null,careerLevel:1,skills:{},inventory:seed.inventory,ownedProperties:origin.giftedHome?[home.propertyId]:[],propertyInvestments:{},vehicleColors:{},gambleHistory:[],lastGambleRound:null,loans:[],workDays:{},furnitureLayout:seed.furnitureLayout,storedFurniture:seed.storedFurniture,drivingVehicle:null,onboardingComplete:false,lifeGoal:'explore',settings:{presenceVisible:true,allowInvites:true,soundEnabled:true},activeTrip:null,activeShift:null,completedShifts:0,nextShiftAt:0,lastActionAt:timestamp,billsPaidAt:timestamp,rentPaidAt:timestamp,createdAt:timestamp};
    try{this.transaction(()=>{this.run('INSERT INTO residents VALUES(?,?,?,?,?)',id,username,`${salt}:${hash}`,JSON.stringify(profile),timestamp);this.run('INSERT INTO resident_origins VALUES(?,?,?)',id,JSON.stringify(origin),timestamp);this.appendLedger(id,origin.startingBalance,'Resident starting balance',timestamp,`registration:${id}`,'STARTING_MONEY',origin.startingBalance);if(referrerId&&referrerId!==id&&this.get('SELECT id FROM residents WHERE id=?',referrerId))this.run("INSERT OR IGNORE INTO friendship VALUES(?,?,?,'accepted',?)",uid(),referrerId,id,timestamp);});}catch(error){if(error.message.includes('UNIQUE'))throw new GameError('That username is already taken',409);throw error;}
    this.notify(id,'welcome','Welcome home',`Your ${home.name} is ready. Settle in, then explore your neighbourhood.`,'home');return this.createSession(id);
  }
  async login({username,password}) {
    const row=this.get('SELECT id,password FROM residents WHERE username=?',clean(username,24).toLowerCase());const [salt,stored]=(row?.password||`${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');const hash=await scrypt(typeof password==='string'?password.slice(0,128):'',salt,64);check(row&&crypto.timingSafeEqual(hash,Buffer.from(stored,'hex')),'Username or password is incorrect',401,'invalid_credentials');return this.createSession(row.id);
  }
  hashToken(token){return crypto.createHash('sha256').update(token).digest('hex');}
  createSession(residentId){const token=crypto.randomBytes(32).toString('hex');this.run('DELETE FROM sessions WHERE expires_at<?',this.clock());this.run('INSERT INTO sessions VALUES(?,?,?)',this.hashToken(token),residentId,this.clock()+30*86400000);return{residentId,token};}
  session(token){return typeof token==='string'&&token?this.get('SELECT resident_id FROM sessions WHERE hash=? AND expires_at>?',this.hashToken(token),this.clock())?.resident_id||null:null;}
  logout(token){if(token)this.run('DELETE FROM sessions WHERE hash=?',this.hashToken(token));}
  updateProfile(id,body){const p=this.profile(id);if(body.displayName!==undefined){check(clean(body.displayName,40).length>=2,'Display name must have at least two characters');p.displayName=clean(body.displayName,40);}updateAppearance(p.appearance,body.appearance,p.inventory);if(body.settings&&typeof body.settings==='object')for(const key of ['presenceVisible','allowInvites','soundEnabled','allowHomeVisits','homeVisitsFriendsOnly'])if(typeof body.settings[key]==='boolean')p.settings[key]=body.settings[key];if(body.lifeGoal!==undefined){check(LIFE_GOALS.some(goal=>goal.id===body.lifeGoal),'Choose a listed life goal');p.lifeGoal=body.lifeGoal;}if(body.onboardingComplete!==undefined){check(typeof body.onboardingComplete==='boolean','Choose a valid onboarding state');if(body.onboardingComplete===true&&p.home.starterVersion===1)check(['feminine','masculine'].includes(p.appearance.presentation),'Choose Female or Male before starting',400,'gender_required');p.onboardingComplete=body.onboardingComplete;}return this.save(p);}
  decay(p){const mins=Math.min(120,Math.max(0,(this.clock()-p.lastActionAt)/60000));if(mins>1){p.energy=clamp(p.energy-mins*.10);p.hunger=clamp(p.hunger-mins*.12);p.social=clamp(p.social-mins*.05);}}
  publicJobs(){return Object.fromEntries(Object.entries(jobs).map(([id,{tasks,...job}])=>[id,{...job,schedule:{...JOB_SCHEDULES[id],timeZone:'Africa/Lagos',maxDailyShifts:2}}]));}
  workSchedule(id,now=this.clock()) {
    const p=typeof id==='string'?this.profile(id):id,dateKey=abujaTime(now).dateKey,start=Date.parse(`${dateKey}T00:00:00+01:00`);
    const rows=this.all('SELECT job_id,started_at,shift_slot FROM challenges WHERE resident_id=? AND completed_at IS NOT NULL AND (work_date=? OR (work_date IS NULL AND completed_at>=? AND completed_at<?))',p.id,dateKey,start,start+86400000);
    p.workDays[dateKey]={completed:rows.length,slots:[...new Set(rows.map(row=>row.shift_slot||jobSchedule(row.job_id,{},row.started_at).currentSlot).filter(Boolean))]};
    return jobSchedule(p.job,p,now);
  }
  activeChallenge(id){const row=this.get('SELECT * FROM challenges WHERE resident_id=? AND completed_at IS NULL AND cancelled_at IS NULL AND (shift_ends_at IS NULL OR shift_ends_at>?) ORDER BY started_at DESC LIMIT 1',id,this.clock());return row?this.challengeView(row):null;}
  challengeView(row){return{id:row.id,jobId:row.job_id,title:jobs[row.job_id].title,startedAt:row.started_at,dateKey:row.work_date,slotId:row.shift_slot,expiresAt:row.shift_ends_at,tasks:jobs[row.job_id].tasks.map(({answer,...task})=>task)};}
  quoteTravel(id,payload={}) {
    const p=this.profile(id),destination=clean(payload.district,80),mode=clean(payload.mode||'bus',16),venueId=payload.venueId==null?null:clean(payload.venueId,80);
    check(locations.has(destination),'Choose a location from the Abuja atlas');check(transportModes.some(item=>item.id===mode),'Choose a supported transport mode');check(mode!=='walk'||destination===p.district,'Walking is available within your neighbourhood; choose transport for this trip');check(mode!=='car'||catalog.some(item=>ownsVehicle(p,catalog,item.id)),'Buy a car before choosing your own vehicle');
    if(venueId!==null)check(venueId&&venueAvailable(venueId,destination),'Choose a place available in your destination neighbourhood');
    return travelPricing(locations.get(p.district),locations.get(destination),mode,{venueId});
  }
  economyOperation(id,kind,payload,normalized,mutate,{requireKey=true}={}) {
    const key=payload.idempotencyKey===undefined?(!requireKey?uid():undefined):payload.idempotencyKey;
    check(typeof key==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(key),'Use a valid idempotency key for this money action',400,'idempotency_required');
    const fingerprint=JSON.stringify(normalized);let replayed=false;
    const result=this.transaction(()=>{
      const existing=this.get('SELECT * FROM economy_operations WHERE resident_id=? AND operation_key=?',id,key);
      if(existing){check(existing.kind===kind&&existing.fingerprint===fingerprint,'This request key was already used for a different action',409,'idempotency_conflict');replayed=true;return{...JSON.parse(existing.result),profile:this.profile(id)};}
      const p=this.profile(id),timestamp=this.clock(),before=p.wallet;
      const extra=mutate(p,timestamp);recordHousingLifeEvent(p,{kind,extra,now:timestamp,beforeBalance:before});recordHustleProgress(p,{kind,payload,extra,now:timestamp});
      check(Number.isSafeInteger(p.wallet)&&p.wallet>=0,'This action cannot be represented as exact whole Naira',409,'numeric_limit');
      p.lastActionAt=timestamp;this.save(p);
      if(p.wallet!==before)this.appendLedger(id,p.wallet-before,extra.ledgerReason||kind,timestamp,key,extra.ledgerType||economyTransactionType(kind,normalized,catalog),p.wallet);
      const {ledgerReason,ledgerType,...publicExtra}=extra;
      const response={ok:true,profile:p,...publicExtra};
      this.run('INSERT INTO economy_operations VALUES(?,?,?,?,?,?,?)',id,key,kind,fingerprint,JSON.stringify(response),kind==='demo-topup'?normalized.amount:0,timestamp);
      return response;
    });
    if(!replayed)this.emitUser(id,'profile',{profile:result.profile});
    return{...result,replayed};
  }
  wallet(id){const p=this.profile(id),workSchedule=this.workSchedule(p);return{ok:true,profile:p,walletMeta:WALLET_META,loanMeta:LOAN_META,loans:loanView(p,this.clock()),workSchedule,transactions:this.transactions(id)};}
  appendLedger(id,amount,reason,createdAt,operationId,type,balanceAfter){this.run('INSERT INTO ledger(id,resident_id,amount,reason,created_at,type,balance_after,operation_id) VALUES(?,?,?,?,?,?,?,?)',uid(),id,amount,reason,createdAt,type,balanceAfter,operationId);}
  transactions(id){return this.all('SELECT * FROM ledger WHERE resident_id=? ORDER BY created_at DESC,rowid DESC LIMIT 60',id).map(row=>({id:row.id,amount:row.amount,reason:row.reason,createdAt:row.created_at,type:row.type,balanceAfter:row.balance_after,operationId:row.operation_id}));}
  topup(id,payload={}) {
    check(!Object.hasOwn(payload,'verified'),'Real-money payments require a verified payment provider; use a free game top-up',403,'payments_unavailable');
    const amount=payload.amount;
    check(Number.isSafeInteger(amount)&&amount>0,'Choose a positive whole Naira game top-up',400,'invalid_topup');
    return this.economyOperation(id,'demo-topup',payload,{amount},(p,timestamp)=>{
      p.wallet+=amount;
      return{topup:{id:uid(),amount,virtual:true,createdAt:timestamp},ledgerReason:'Free game Naira top-up'};
    });
  }
  transfer(id,payload={}) {
    const residentId=payload.residentId,amount=payload.amount,note=clean(payload.note,120),conversationId=payload.conversationId??null;
    let notice;
    check(typeof residentId==='string'&&residentId.length>0&&residentId.length<=80,'Choose a registered resident',400,'invalid_recipient');
    check(residentId!==id,'Choose another resident to send Naira to',400,'self_transfer');
    check(Number.isSafeInteger(amount)&&amount>0,'Enter a positive whole Naira amount',400,'invalid_amount');
    check(conversationId===null||typeof conversationId==='string'&&conversationId.length>0&&conversationId.length<=80,'Choose the direct conversation for this transfer',400,'transfer_conversation_mismatch');
    const result=this.economyOperation(id,'transfer-naira',payload,{residentId,amount,note,...(conversationId?{conversationId}:{})},(p,timestamp)=>{
      const recipient=this.profile(residentId);
      check(!this.blocked(id,residentId),'This resident is unavailable',403,'recipient_unavailable');
      if(conversationId)this.transferConversation(id,residentId,conversationId);
      check(p.wallet>=amount,'You need more Naira for this transfer',409,'insufficient_balance');
      check(Number.isSafeInteger(recipient.wallet+amount),'The recipient balance cannot represent this amount as exact whole Naira',409,'numeric_limit');
      p.wallet-=amount;recipient.wallet+=amount;this.save(recipient);
      const transfer={id:uid(),residentId,recipientName:recipient.displayName,amount,note,createdAt:timestamp,virtual:true};
      this.appendLedger(residentId,amount,`Naira from ${p.displayName}${note?` · ${note}`:''}`,timestamp,`transfer:${transfer.id}:recipient`,'TRANSFER',recipient.wallet);
      if(!this.muted(residentId,id)){
        notice={id:uid(),kind:'transfer',title:'Naira received',body:`${p.displayName} sent you ₦${amount.toLocaleString()} in game Naira${note?` · ${note}`:''}.`,link:conversationId?`conversation:${conversationId}`:'wallet',createdAt:timestamp,readAt:null};
        this.run('INSERT INTO notifications(id,resident_id,kind,title,body,link,created_at,read_at,sender_id) VALUES(?,?,?,?,?,?,?,NULL,?)',notice.id,residentId,notice.kind,notice.title,notice.body,notice.link,timestamp,id);
      }
      let message;
      if(conversationId){
        const saved=this.insertConversationMessage(id,conversationId,`Sent ₦${amount.toLocaleString()} in game Naira${note?` · ${note}`:''}.`,timestamp);
        this.run('INSERT INTO message_transfers VALUES(?,?,?,?,?,?,?,?,?)',saved.row.id,transfer.id,amount,note,id,residentId,timestamp,p.displayName,recipient.displayName);
        message=this.messageView(saved.row);
      }
      return{transfer,...(message?{message,receipt:message}:{}),ledgerReason:`Naira to ${recipient.displayName}${note?` · ${note}`:''}`};
    });
    if(!result.replayed){this.emitUser(residentId,'profile',{profile:this.profile(residentId)});if(notice)this.emitUser(residentId,'notification',notice);if(result.message)for(const target of [id,residentId])this.emitUser(target,'message',result.message);}
    return result;
  }
  vehicleAction(id,action,payload={}) {
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
  investmentAction(id,action,payload={}) {
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
        check(investment.collectable>0,'Rent is not ready yet; it accrues every week',409,'rent_not_ready');
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
  playDice(id,payload={}) {
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
  loanAction(id,action,payload={}) {
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
  action(id,action,payload={}) {
    if(action==='purchase'&&payload.idempotencyKey&&catalog.some(item=>item.id===payload.itemId&&item.category==='furniture')){
      const item=catalog.find(item=>item.id===payload.itemId);
      return this.economyOperation(id,'purchase',payload,{itemId:item.id},p=>{
        check(!p.activeTrip,'Your journey is still in progress');
        check(!p.inventory.includes(item.id),'You already own this item',409,'item_owned');
        check(p.wallet>=item.price,'You need more Naira for this',409,'insufficient_balance');
        p.wallet-=item.price;p.inventory.push(item.id);p.storedFurniture.push(item.id);
        return{item,ledgerReason:`Furniture purchase · ${item.name}`};
      });
    }
    if(action==='sell-item')return this.sellItem(id,payload);
    if(action==='topup'||action==='demo-topup')return this.topup(id,payload);
    if(action==='transfer-naira')return this.transfer(id,payload);
    if(['buy-investment','collect-rent','sell-investment'].includes(action))return this.investmentAction(id,action,payload);
    if(action==='play-dice')return this.playDice(id,payload);
    if(['borrow-loan','repay-loan'].includes(action))return this.loanAction(id,action,payload);
    if(HOUSING_ACTIONS.has(action))return this.housingAction(id,action,payload);
    if(GIG_ACTIONS.has(action))return this.gigAction(id,action,payload);
    if(HUSTLE_ACTIONS.has(action))return this.hustleAction(id,action,payload);
    if(payload.idempotencyKey&&(['paint-vehicle'].includes(action)||(action==='purchase'&&catalog.some(item=>item.id===payload.itemId&&item.category==='vehicle'))))return this.vehicleAction(id,action,payload);
    const normalized=Object.fromEntries(Object.entries(payload).filter(([key])=>key!=='idempotencyKey').sort(([a],[b])=>a.localeCompare(b)));
    const result=this.economyOperation(id,action,payload,normalized,(p,timestamp)=>{
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
          const {mode,cost,seconds}=this.quoteTravel(id,{district:destination,mode:payload.mode,venueId});
          const requestedVehicle=payload.vehicleId??p.drivingVehicle??(p.vehiclePresence?.district===p.district?p.vehiclePresence.vehicleId:null);
          if(mode==='car'&&payload.vehicleId!=null)check(ownsVehicle(p,catalog,payload.vehicleId),'Buy this car before choosing it');
          const vehicleId=mode==='car'?(ownsVehicle(p,catalog,requestedVehicle)?requestedVehicle:catalog.find(item=>ownsVehicle(p,catalog,item.id))?.id):null;
          debit(cost);p.drivingVehicle=null;p.activeTrip={id:uid(),fromLocation:{...p.location},destination,mode,cost,seconds,vehicleId,...(venueId?{venueId}:{}),arrivesAt:timestamp+seconds*1000,returningHome:action==='return-home'};extra.trip=p.activeTrip;p.location={kind:'transit',district:p.district,venue:'journey'};break;
        }
        case 'arrive':{const trip=p.activeTrip;check(trip&&trip.id===payload.tripId,'This journey is no longer active',409,'trip_not_active');check(timestamp>=trip.arrivesAt,'Your journey is still in progress',409,'trip_in_progress');if(trip.venueId)check(venueAvailable(trip.venueId,trip.destination),'This destination is no longer available');p.district=trip.destination;p.location={kind:trip.returningHome?'home':trip.venueId?'venue':'public',district:trip.destination,venue:trip.returningHome?'home':trip.venueId||'neighbourhood'};p.drivingVehicle=!trip.returningHome&&!trip.venueId&&trip.mode==='car'&&ownsVehicle(p,catalog,trip.vehicleId)?trip.vehicleId:null;p.activeTrip=null;p.energy=clamp(p.energy-3);break;}
        case 'take-job':check(typeof payload.jobId==='string'&&Object.hasOwn(jobs,payload.jobId),'Choose a listed job');check(!this.activeChallenge(id),'Finish your current shift before switching careers');p.job=payload.jobId;break;
        case 'start-shift':{
          const job=jobs[p.job];check(job,'Choose a job before starting a shift');publicPlace();check(p.district===job.district,`Travel to ${locations.get(job.district)?.name||job.district} for your shift`);
          const active=this.activeChallenge(id);if(active){extra.challenge=active;break;}
          this.run('UPDATE challenges SET cancelled_at=? WHERE resident_id=? AND completed_at IS NULL AND cancelled_at IS NULL AND shift_ends_at<=?',timestamp,id,timestamp);
          check(timestamp>=p.nextShiftAt,'Take a moment between shifts',409,'shift_cooldown');
          const schedule=this.workSchedule(p,timestamp);check(schedule.canStart,schedule.reason,409,schedule.remainingToday===0?'daily_shift_limit':!schedule.isWorkDay||!schedule.isOpen?'workplace_closed':'shift_slot_completed');
          check(p.energy>=job.energy,'Rest before starting another shift');
          const slot=schedule.slots.find(item=>item.id===schedule.availableSlot),row={id:uid(),resident_id:id,job_id:p.job,started_at:timestamp,work_date:schedule.dateKey,shift_slot:slot.id,shift_ends_at:slot.endsAt};
          this.run('INSERT INTO challenges(id,resident_id,job_id,started_at,work_date,shift_slot,shift_ends_at) VALUES(?,?,?,?,?,?,?)',row.id,id,row.job_id,timestamp,row.work_date,row.shift_slot,row.shift_ends_at);extra.challenge=this.challengeView(row);extra.workSchedule=schedule;p.activeShift=row.id;break;
        }
        case 'complete-shift':{
          const row=this.get('SELECT * FROM challenges WHERE id=? AND resident_id=?',clean(payload.challengeId,80),id);check(row,'Shift not found');
          if(row.completed_at){extra.result=JSON.parse(row.result);extra.workSchedule=this.workSchedule(p,timestamp);break;}
          const job=jobs[row.job_id];check(p.district===job.district&&p.location.kind==='public','Complete your shift at the workplace');
          check(!row.cancelled_at&&(!row.shift_ends_at||timestamp<row.shift_ends_at)&&(!row.work_date||abujaTime(timestamp).dateKey===row.work_date),'This shift has ended; start an available shift',409,'shift_expired');
          const schedule=this.workSchedule({...p,job:row.job_id},timestamp);check(schedule.remainingToday>0,'You have finished today’s two shifts. Come back tomorrow.',409,'daily_shift_limit');check(!row.shift_slot||!schedule.slots.find(slot=>slot.id===row.shift_slot)?.completed,'This shift slot has already been completed',409,'shift_slot_completed');
          check(timestamp-row.started_at>=1500,'Read the tasks before submitting your shift',409,'shift_too_fast');check(Array.isArray(payload.answers)&&payload.answers.length===job.tasks.length,'Answer each shift task');
          check(payload.answers.every(answer=>answer&&typeof answer==='object'&&typeof answer.taskId==='string'&&typeof answer.optionId==='string'),'Choose valid shift answers');const answers=new Map(payload.answers.map(a=>[a.taskId,a.optionId]));check(answers.size===job.tasks.length&&job.tasks.every(t=>answers.has(t.id)&&t.options.some(o=>o.id===answers.get(t.id))),'Choose one valid answer for every task');
          const correct=job.tasks.filter(t=>answers.get(t.id)===t.answer).length,pay=Math.round(job.pay*(.4+.6*correct/job.tasks.length));p.wallet+=pay;p.energy=clamp(p.energy-job.energy);p.hunger=clamp(p.hunger-10);p.stress=clamp(p.stress+8);p.reputation+=correct===job.tasks.length?2:1;p.completedShifts++;p.skills[job.skill]=(p.skills[job.skill]||0)+correct;p.careerLevel=1+Math.floor(p.completedShifts/5);p.activeShift=null;p.nextShiftAt=timestamp+20000;
          extra.result={challengeId:row.id,pay,correct,total:job.tasks.length,careerLevel:p.careerLevel,dateKey:row.work_date,slotId:row.shift_slot};this.run('UPDATE challenges SET completed_at=?,result=? WHERE id=?',timestamp,JSON.stringify(extra.result),row.id);
          extra.workSchedule=this.workSchedule(p,timestamp);p.workDays=Object.fromEntries(Object.entries(p.workDays).sort(([a],[b])=>b.localeCompare(a)).slice(0,8));break;
        }
        case 'work-shift':throw new GameError('Start a shift and complete its work tasks to earn your salary');
        case 'purchase':{const item=catalog.find(item=>item.id===payload.itemId);check(item,'Choose an item from Okrika Marketplace');check(!p.inventory.includes(item.id),'You already own this item',409);if(item.category==='vehicle'){const color=payload.color??item.defaultColor;check(vehicleColorFor(color)&&item.availableColors.includes(color),'Choose an available car colour');p.vehicleColors[item.id]=color;}debit(item.price);p.inventory.push(item.id);if(item.category==='furniture'&&!p.storedFurniture.includes(item.id))p.storedFurniture.push(item.id);extra.item=item;break;}
        case 'paint-vehicle':{const item=catalog.find(item=>item.id===payload.itemId&&item.category==='vehicle');check(item&&p.inventory.includes(item.id),'You can repaint a car you own',403,'vehicle_not_owned');check(vehicleColorFor(payload.color)&&item.availableColors.includes(payload.color),'Choose an available car colour');p.vehicleColors[item.id]=payload.color;extra.item=item;break;}
        case 'equip':{const item=catalog.find(item=>item.id===payload.itemId);check(item?.category==='clothing'&&p.inventory.includes(item.id),'You can wear clothing you own');p.appearance[item.slot]=item.value;break;}
        case 'pay-bills':{check(timestamp-p.billsPaidAt>=GAME_BILL_PERIOD_MS,'Your home bills are up to date');const property=this.propertyFor(p);check(property,'Home property not found',404);const amount=Math.round(property.bills*(100-comfort.billDiscountPercent)/100);debit(amount);p.billsPaidAt=timestamp;extra.bill={amount,baseAmount:property.bills,discountPercent:comfort.billDiscountPercent};break;}
        default:throw new GameError('Unknown action');
      }
      return {...extra,ledgerReason:action};
    },{requireKey:false});return result;
  }
  sellItem(id,payload={}) {
    const itemId=clean(payload.itemId,80),item=catalog.find(item=>item.id===itemId);
    check(item,'Choose an item from your inventory',400,'invalid_item');
    return this.economyOperation(id,'sell-item',payload,{itemId},(p,timestamp)=>{
      check(!p.activeTrip,'Finish your journey before selling items',409,'trip_active');
      check(p.inventory.includes(itemId),'You can only sell an item you own',403,'item_not_owned');
      check(p.drivingVehicle!==itemId,'Park your car before selling it',409,'vehicle_driving');
      const amount=systemResaleValue(item);p.wallet+=amount;
      p.inventory=p.inventory.filter(id=>id!==itemId);storeSupportedFurniture(p,itemId);delete p.furnitureLayout[itemId];p.storedFurniture=p.storedFurniture.filter(id=>id!==itemId);delete p.vehicleColors[itemId];
      if(item.category==='clothing'&&item.slot&&p.appearance[item.slot]===item.value&&!catalog.some(other=>other.id!==itemId&&p.inventory.includes(other.id)&&other.category==='clothing'&&other.slot===item.slot&&other.value===item.value))p.appearance[item.slot]=initialAppearance[item.slot]??p.appearance[item.slot];
      return{sale:{itemId,amount,createdAt:timestamp,virtual:true},item,ledgerReason:'System resale · '+item.name};
    });
  }
  blocked(a,b){return Boolean(this.get("SELECT 1 FROM moderation WHERE kind='block' AND ((owner=? AND target=?) OR (owner=? AND target=?))",a,b,b,a));}
  muted(a,b){return Boolean(this.get("SELECT 1 FROM moderation WHERE kind='mute' AND owner=? AND target=?",a,b));}
  resident(viewer,id){const p=this.profile(id),visible=p.settings.presenceVisible&&(!viewer||!this.blocked(viewer,id));return{id,username:p.username,displayName:p.displayName,appearance:p.appearance,reputation:p.reputation,online:visible&&this.isOnline(id),district:visible?p.district:null,location:visible?p.location:null};}
  people(id){return this.all('SELECT id FROM residents WHERE id<>? ORDER BY created_at DESC LIMIT 200',id).filter(row=>!this.blocked(id,row.id)).map(row=>this.resident(id,row.id));}
  nearby(id){const zone=this.zone(id),online=this.onlineInZone(zone),ids=Array.isArray(online)?online:this.people(id).filter(person=>person.online).map(person=>person.id);return ids.filter(target=>target!==id&&!this.blocked(id,target)).map(target=>this.resident(id,target)).filter(person=>person.online&&person.location&&this.zone(person.id)===zone);}
  friendIds(id){return this.all("SELECT sender,recipient FROM friendship WHERE status='accepted' AND (sender=? OR recipient=?)",id,id).map(row=>row.sender===id?row.recipient:row.sender).filter(target=>!this.blocked(id,target));}
  friends(id){return this.friendIds(id).map(target=>this.resident(id,target));}
  friendRequests(id){return this.all("SELECT * FROM friendship WHERE status='pending' AND (sender=? OR recipient=?) ORDER BY created_at DESC",id,id).filter(row=>!this.blocked(id,row.sender===id?row.recipient:row.sender)).map(row=>({id:row.id,from:row.sender,to:row.recipient,status:row.status,createdAt:row.created_at,resident:this.resident(id,row.sender===id?row.recipient:row.sender)}));}
  socialState(id){return{ok:true,friends:this.friends(id),friendRequests:this.friendRequests(id),conversations:this.conversations(id),notifications:this.notifications(id)};}
  requestFriend(id,target){check(target!==id,'You cannot send yourself a friend request');this.profile(target);check(!this.blocked(id,target),'This resident is unavailable',403);const existing=this.get('SELECT * FROM friendship WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',id,target,target,id);if(existing?.status==='accepted'||existing?.status==='pending')return this.socialState(id);const requestId=existing?.id||uid();if(existing)this.run("UPDATE friendship SET sender=?,recipient=?,status='pending',created_at=? WHERE id=?",id,target,this.clock(),requestId);else this.run("INSERT INTO friendship VALUES(?,?,?,'pending',?)",requestId,id,target,this.clock());this.notify(target,'friend-request','New friend request',`${this.profile(id).displayName} would like to connect.`,'friends',id);return this.socialState(id);}
  respondFriend(id,requestId,accept){check(typeof requestId==='string','Choose a friend request');const row=this.get("SELECT * FROM friendship WHERE id=? AND recipient=? AND status='pending'",requestId,id);check(row,'Friend request not found',404);check(!this.blocked(id,row.sender),'This resident is unavailable',403);this.run('UPDATE friendship SET status=? WHERE id=?',accept?'accepted':'declined',row.id);if(accept)this.notify(row.sender,'friend-accepted','Friend request accepted',`${this.profile(id).displayName} is now your friend.`,'friends',id);return this.socialState(id);}
  removeFriend(id,target){this.profile(target);this.run('DELETE FROM friendship WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',id,target,target,id);return this.socialState(id);}
  notify(id,kind,title,body,link=null,sender=null){if(sender&&this.muted(id,sender))return;const notice={id:uid(),kind,title,body,link,createdAt:this.clock(),readAt:null};this.run('INSERT INTO notifications(id,resident_id,kind,title,body,link,created_at,read_at,sender_id) VALUES(?,?,?,?,?,?,?,NULL,?)',notice.id,id,kind,title,body,link,notice.createdAt,sender);this.emitUser(id,'notification',notice);return notice;}
  notifications(id){return this.all('SELECT * FROM notifications WHERE resident_id=? ORDER BY created_at DESC LIMIT 100',id).filter(row=>!row.sender_id||!this.blocked(id,row.sender_id)).map(row=>({id:row.id,kind:row.kind,title:row.title,body:row.body,link:row.link,createdAt:row.created_at,readAt:row.read_at}));}
  readNotifications(id,noticeId){check(noticeId===undefined||typeof noticeId==='string','Choose a valid notification');if(noticeId)this.run('UPDATE notifications SET read_at=? WHERE resident_id=? AND id=?',this.clock(),id,noticeId);else this.run('UPDATE notifications SET read_at=? WHERE resident_id=? AND read_at IS NULL',this.clock(),id);return{ok:true,notifications:this.notifications(id)};}
  conversationAccess(id,conversationId){check(typeof conversationId==='string'&&conversationId.length>0,'Choose a conversation');const member=this.get('SELECT * FROM members WHERE resident_id=? AND conversation_id=?',id,conversationId);check(member,'Conversation not found',404);return member;}
  conversation(id,conversationId){const me=this.conversationAccess(id,conversationId),row=this.get('SELECT * FROM conversations WHERE id=?',conversationId),members=this.all('SELECT resident_id FROM members WHERE conversation_id=?',conversationId).map(row=>this.resident(id,row.resident_id));const visible="NOT EXISTS(SELECT 1 FROM moderation d WHERE d.kind='block' AND ((d.owner=? AND d.target=m.sender_id) OR (d.owner=m.sender_id AND d.target=?)))";const last=this.get(`SELECT m.* FROM messages m WHERE m.conversation_id=? AND ${visible} ORDER BY m.created_at DESC,m.id DESC LIMIT 1`,conversationId,id,id),unread=this.get(`SELECT count(*) n FROM messages m WHERE m.conversation_id=? AND m.sender_id<>? AND m.created_at>? AND ${visible}`,conversationId,id,me.read_at,id,id).n;return{id:row.id,kind:row.kind,name:row.kind==='dm'?(members.find(member=>member.id!==id)?.displayName||'Conversation'):row.name,members,unread,lastMessage:last?this.messageView(last):null};}
  conversations(id){return this.all('SELECT conversation_id FROM members WHERE resident_id=? ORDER BY joined_at DESC',id).map(row=>this.conversation(id,row.conversation_id)).filter(c=>c.kind!=='dm'||!c.members.some(member=>member.id!==id&&this.blocked(id,member.id)));}
  createConversation(id,body){const kind=body.kind==='group'?'group':'dm';let targets;if(kind==='dm'){const target=clean(body.residentId,80);check(target!==id,'Choose another resident');this.profile(target);check(!this.blocked(id,target),'This resident is unavailable',403);targets=[target];const existing=this.get("SELECT c.id FROM conversations c JOIN members a ON a.conversation_id=c.id JOIN members b ON b.conversation_id=c.id WHERE c.kind='dm' AND a.resident_id=? AND b.resident_id=?",id,target);if(existing)return{ok:true,conversation:this.conversation(id,existing.id)};}else{check(Array.isArray(body.memberIds)&&body.memberIds.length>=1,'Choose friends for your group');targets=[...new Set(body.memberIds)].filter(target=>target!==id);check(targets.length>0,'Choose another friend');const friends=new Set(this.friendIds(id));check(targets.every(target=>friends.has(target)),'Group members must be accepted friends');check(clean(body.name,60).length>=2,'Give your group a name');}const conversationId=uid(),timestamp=this.clock();this.transaction(()=>{this.run('INSERT INTO conversations VALUES(?,?,?,?)',conversationId,kind,kind==='group'?clean(body.name,60):'',timestamp);for(const target of [id,...targets])this.run('INSERT INTO members(conversation_id,resident_id,joined_at) VALUES(?,?,?)',conversationId,target,timestamp);});if(kind==='group')for(const target of targets)this.notify(target,'group','New group',`${this.profile(id).displayName} added you to ${clean(body.name,60)}.`,`conversation:${conversationId}`,id);return{ok:true,conversation:this.conversation(id,conversationId)};}
  messageView(row){
    const members=this.all('SELECT * FROM members WHERE conversation_id=?',row.conversation_id),receipt=this.get('SELECT * FROM message_transfers WHERE message_id=?',row.id);
    const transfer=receipt?{id:receipt.transfer_id,amount:receipt.amount,note:receipt.note,fromId:receipt.from_id,toId:receipt.to_id,from:receipt.from_id,to:receipt.to_id,senderId:receipt.from_id,recipientId:receipt.to_id,createdAt:receipt.created_at,senderName:receipt.sender_name,recipientName:receipt.recipient_name,virtual:true,currency:'game-naira'}:null;
    return{id:row.id,conversationId:row.conversation_id,senderId:row.sender_id,kind:transfer?'transfer':'text',text:row.text,createdAt:row.created_at,...(transfer?{transferId:transfer.id,transfer}:{}),deliveredTo:members.filter(m=>m.resident_id!==row.sender_id&&m.delivered_at>=row.created_at).map(m=>m.resident_id),readBy:members.filter(m=>m.resident_id!==row.sender_id&&m.read_at>=row.created_at).map(m=>m.resident_id)};
  }
  messages(id,conversationId){this.conversationAccess(id,conversationId);this.readConversation(id,conversationId);const rows=this.all('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 100',conversationId).reverse().filter(row=>!this.blocked(id,row.sender_id));return{ok:true,conversation:this.conversation(id,conversationId),messages:rows.map(row=>this.messageView(row))};}
  transferConversation(id,residentId,conversationId){
    this.conversationAccess(id,conversationId);
    const conversation=this.get('SELECT kind FROM conversations WHERE id=?',conversationId),members=this.all('SELECT resident_id FROM members WHERE conversation_id=?',conversationId).map(row=>row.resident_id);
    check(conversation?.kind==='dm'&&members.length===2&&members.includes(id)&&members.includes(residentId),'Choose the direct conversation with this recipient',400,'transfer_conversation_mismatch');
  }
  insertConversationMessage(id,conversationId,text,at=this.clock()){
    const members=this.all('SELECT resident_id FROM members WHERE conversation_id=?',conversationId).map(row=>row.resident_id),latest=this.get('SELECT MAX(created_at) last FROM messages WHERE conversation_id=?',conversationId).last||0,lastRead=this.get('SELECT MAX(read_at) last FROM members WHERE conversation_id=?',conversationId).last||0;
    const timestamp=Math.max(at,latest+1,lastRead+1),row={id:uid(),conversation_id:conversationId,sender_id:id,text,created_at:timestamp};
    this.run('INSERT INTO messages VALUES(?,?,?,?,?)',row.id,conversationId,id,text,timestamp);
    this.run('UPDATE members SET read_at=?,delivered_at=? WHERE resident_id=? AND conversation_id=?',timestamp,timestamp,id,conversationId);
    for(const target of members)if(target!==id&&!this.blocked(id,target)&&this.isOnline(target))this.run('UPDATE members SET delivered_at=? WHERE resident_id=? AND conversation_id=?',timestamp,target,conversationId);
    return{row,members};
  }
  sendMessage(id,conversationId,input,body={}){
    if(input&&typeof input==='object'){body=input;input=input.text;}
    this.conversationAccess(id,conversationId);
    const text=clean(input,4000);check(text.length>0,'Write a message first');
    const key=body.idempotencyKey;check(key===undefined||typeof key==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(key),'Use a valid message idempotency key',400,'idempotency_required');
    const fingerprint=JSON.stringify({conversationId,text}),notices=[];let members=[],replayed=false;
    const message=this.transaction(()=>{
      const conversation=this.get('SELECT kind FROM conversations WHERE id=?',conversationId),targets=this.all('SELECT resident_id FROM members WHERE conversation_id=?',conversationId).map(row=>row.resident_id);
      check(conversation.kind!=='dm'||targets.every(target=>target===id||!this.blocked(id,target)),'This conversation is unavailable',403);
      if(key!==undefined){const prior=this.get('SELECT * FROM message_operations WHERE sender_id=? AND operation_key=?',id,key);if(prior){check(prior.fingerprint===fingerprint,'This message key was already used for different content',409,'idempotency_conflict');replayed=true;return this.messageView(this.get('SELECT * FROM messages WHERE id=?',prior.message_id));}}
      const saved=this.insertConversationMessage(id,conversationId,text);members=saved.members;
      if(key!==undefined)this.run('INSERT INTO message_operations VALUES(?,?,?,?,?)',id,key,fingerprint,saved.row.id,saved.row.created_at);
      for(const target of members)if(target!==id&&!this.blocked(id,target)&&!this.muted(target,id)){
        const notice={id:uid(),kind:'message',title:this.profile(id).displayName,body:text.slice(0,140),link:`conversation:${conversationId}`,createdAt:saved.row.created_at,readAt:null};
        this.run('INSERT INTO notifications(id,resident_id,kind,title,body,link,created_at,read_at,sender_id) VALUES(?,?,?,?,?,?,?,NULL,?)',notice.id,target,notice.kind,notice.title,notice.body,notice.link,notice.createdAt,id);notices.push({target,notice});
      }
      return this.messageView(saved.row);
    });
    if(!replayed){for(const target of members)if(!this.blocked(id,target))this.emitUser(target,'message',message);for(const{target,notice}of notices)this.emitUser(target,'notification',notice);}
    return{ok:true,message,replayed};
  }
  readConversation(id,conversationId){this.conversationAccess(id,conversationId);const latest=this.get('SELECT MAX(created_at) last FROM messages WHERE conversation_id=?',conversationId).last||0;const timestamp=Math.max(this.clock(),latest);this.run('UPDATE members SET read_at=?,delivered_at=? WHERE resident_id=? AND conversation_id=?',timestamp,timestamp,id,conversationId);const receipt={conversationId,residentId:id,readAt:timestamp,receipt:true};for(const member of this.all('SELECT resident_id FROM members WHERE conversation_id=?',conversationId))if(!this.blocked(id,member.resident_id))this.emitUser(member.resident_id,'message',receipt);this.run('UPDATE notifications SET read_at=? WHERE resident_id=? AND link=? AND read_at IS NULL',timestamp,id,`conversation:${conversationId}`);return{ok:true};}
  delivered(id,conversationId,body={}){
    if(conversationId===undefined){for(const row of this.all('SELECT conversation_id FROM members WHERE resident_id=?',id)){const latest=this.get('SELECT MAX(created_at) last FROM messages WHERE conversation_id=?',row.conversation_id).last||0;const timestamp=Math.max(this.clock(),latest);this.run('UPDATE members SET delivered_at=MAX(delivered_at,?) WHERE resident_id=? AND conversation_id=?',timestamp,id,row.conversation_id);for(const member of this.all('SELECT resident_id FROM members WHERE conversation_id=?',row.conversation_id))if(member.resident_id!==id&&!this.blocked(id,member.resident_id))this.emitUser(member.resident_id,'message',{conversationId:row.conversation_id,residentId:id,deliveredAt:timestamp,receipt:true});}return{ok:true};}
    const me=this.conversationAccess(id,conversationId),conversation=this.get('SELECT kind FROM conversations WHERE id=?',conversationId),members=this.all('SELECT resident_id FROM members WHERE conversation_id=?',conversationId).map(row=>row.resident_id);
    check(conversation.kind!=='dm'||members.every(target=>target===id||!this.blocked(id,target)),'This conversation is unavailable',403);
    const latest=this.get('SELECT MAX(created_at) last,count(*) count FROM messages WHERE conversation_id=?',conversationId),last=latest.last||0,requested=[];
    if(body.uptoMessageId!==undefined){
      check(typeof body.uptoMessageId==='string'&&body.uptoMessageId.length>0&&body.uptoMessageId.length<=80,'Invalid receipt watermark',400,'invalid_receipt_watermark');
      const row=this.get('SELECT sender_id,created_at FROM messages WHERE conversation_id=? AND id=?',conversationId,body.uptoMessageId);
      check(row&&!this.blocked(id,row.sender_id),'Invalid receipt watermark',400,'invalid_receipt_watermark');requested.push(row.created_at);
    }
    if(body.createdAt!==undefined){check(Number.isSafeInteger(body.createdAt)&&body.createdAt>=0&&body.createdAt<=last,'Invalid receipt watermark',400,'invalid_receipt_watermark');requested.push(body.createdAt);}
    if(body.uptoSeq!==undefined){
      check(Number.isSafeInteger(body.uptoSeq)&&body.uptoSeq>=0&&body.uptoSeq<=latest.count,'Invalid receipt watermark',400,'invalid_receipt_watermark');
      const row=body.uptoSeq===0?null:this.get('SELECT created_at FROM messages WHERE conversation_id=? ORDER BY created_at,id LIMIT 1 OFFSET ?',conversationId,body.uptoSeq-1);requested.push(row?.created_at||0);
    }
    check(requested.every(value=>value===requested[0]),'Receipt watermarks must refer to the same message',400,'invalid_receipt_watermark');
    const timestamp=Math.max(me.delivered_at,requested.length?requested[0]:last);
    if(timestamp>me.delivered_at){this.run('UPDATE members SET delivered_at=MAX(delivered_at,?) WHERE resident_id=? AND conversation_id=?',timestamp,id,conversationId);for(const target of members)if(target!==id&&!this.blocked(id,target))this.emitUser(target,'message',{conversationId,residentId:id,deliveredAt:timestamp,receipt:true});}
    return{ok:true,conversationId,deliveredAt:timestamp};
  }
  zone(id){const p=this.profile(id);return p.location.kind==='home'?`home:${id}`:p.location.kind==='visit'?`home:${p.location.ownerId}`:p.location.kind==='venue'?`venue:${p.district}:${p.location.venue}`:p.location.kind==='public'?`district:${p.district}`:`transit:${id}`;}
  locationMessages(id){return{ok:true,messages:this.all('SELECT * FROM location_messages WHERE zone=? ORDER BY created_at DESC,id DESC LIMIT 60',this.zone(id)).reverse().filter(row=>!this.blocked(id,row.sender_id)).map(row=>({id:row.id,senderId:row.sender_id,resident:this.resident(id,row.sender_id),text:row.text,createdAt:row.created_at,zone:row.zone}))};}
  sendLocationMessage(id,text){check(['public','home','visit','venue'].includes(this.profile(id).location.kind),'Local chat is unavailable during a journey');text=clean(text,2000);check(text.length>0,'Write a message first');const message={id:uid(),senderId:id,resident:this.resident(id,id),text,createdAt:this.clock(),zone:this.zone(id)};this.run('INSERT INTO location_messages VALUES(?,?,?,?,?)',message.id,message.zone,id,text,message.createdAt);this.emitZone(id,'location-chat',message);return{ok:true,message};}
  typing(id,conversationId){const event={residentId:id,displayName:this.profile(id).displayName,conversationId:conversationId||null,at:this.clock()};if(conversationId){this.conversationAccess(id,conversationId);for(const member of this.all('SELECT resident_id FROM members WHERE conversation_id=?',conversationId))if(member.resident_id!==id&&!this.blocked(id,member.resident_id))this.emitUser(member.resident_id,'typing',event);}else this.emitZone(id,'typing',event);return{ok:true};}
  moderate(id,kind,target,enabled){check(['block','mute'].includes(kind),'Invalid moderation control');check(target!==id,'Choose another resident');this.profile(target);if(enabled)this.run('INSERT OR IGNORE INTO moderation VALUES(?,?,?)',id,target,kind);else this.run('DELETE FROM moderation WHERE owner=? AND target=? AND kind=?',id,target,kind);return{ok:true,blocked:this.all("SELECT target FROM moderation WHERE owner=? AND kind='block'",id).map(row=>row.target),muted:this.all("SELECT target FROM moderation WHERE owner=? AND kind='mute'",id).map(row=>row.target)};}
  report(id,body){const reason=clean(body.reason,1000);check(reason.length>=5,'Tell us what happened');let target=null,messageId=null;if(body.residentId){this.profile(body.residentId);target=body.residentId;}if(body.messageId){const row=this.get('SELECT * FROM messages WHERE id=?',body.messageId);check(row,'Message not found',404);this.conversationAccess(id,row.conversation_id);messageId=row.id;target=row.sender_id;}check(target||messageId,'Choose a resident or message to report');const reportId=uid();this.run('INSERT INTO reports VALUES(?,?,?,?,?,?)',reportId,id,target,messageId,reason,this.clock());return{ok:true,reportId};}
  invitations(id){return this.all('SELECT * FROM invitations WHERE sender=? OR recipient=? ORDER BY created_at DESC LIMIT 100',id,id).filter(row=>!this.blocked(id,row.sender===id?row.recipient:row.sender)).map(row=>({id:row.id,from:row.sender,to:row.recipient,kind:row.kind,district:row.district,activity:row.activity,note:row.note,status:row.status,createdAt:row.created_at,resident:this.resident(id,row.sender===id?row.recipient:row.sender)}));}
  invite(id,body){const target=clean(body.residentId,80);check(target!==id,'Choose another resident');const p=this.profile(id),other=this.profile(target);check(other.settings.allowInvites&&!this.blocked(id,target),'This resident is not accepting invitations',403);check(['meetup','home','activity'].includes(body.kind),'Choose an invitation type');const district=body.kind==='home'?p.home.district:clean(body.district||p.district,80);check(locations.has(district),'Choose a location from the atlas');const inviteId=uid();this.run("INSERT INTO invitations VALUES(?,?,?,?,?,?,?,'pending',?)",inviteId,id,target,body.kind,district,clean(body.activity,60),clean(body.note,300),this.clock());const invitation=this.invitations(id).find(row=>row.id===inviteId);this.emitUser(target,'invitation',this.invitations(target).find(row=>row.id===inviteId));this.notify(target,'invitation','You are invited',`${p.displayName} sent you a ${body.kind} invitation.`,'invitations',id);return{ok:true,invitation};}
  respondInvite(id,inviteId,accept){check(typeof inviteId==='string','Choose an invitation');const row=this.get("SELECT * FROM invitations WHERE id=? AND recipient=? AND status='pending'",inviteId,id);check(row,'Invitation not found',404);check(!this.blocked(id,row.sender),'This invitation is unavailable',403);this.run('UPDATE invitations SET status=? WHERE id=?',accept?'accepted':'declined',inviteId);this.notify(row.sender,'invitation-response','Invitation update',`${this.profile(id).displayName} ${accept?'accepted':'declined'} your invitation.`,'invitations',id);return{ok:true,invitations:this.invitations(id)};}
  events(id){return this.all('SELECT * FROM events WHERE starts_at>? ORDER BY starts_at LIMIT 100',this.clock()-86400000).filter(row=>!this.blocked(id,row.host_id)).map(row=>({id:row.id,host:this.resident(id,row.host_id),title:row.title,district:row.district,startsAt:row.starts_at,description:row.description,attendeeIds:this.all('SELECT resident_id FROM rsvps WHERE event_id=?',row.id).map(m=>m.resident_id)}));}
  createEvent(id,body){const title=clean(body.title,80),district=clean(body.district,80),startsAt=body.startsAt;check(title.length>=3,'Give your event a title');check(locations.has(district),'Choose a location from the atlas');check(Number.isSafeInteger(startsAt)&&startsAt>this.clock()&&Number.isFinite(new Date(startsAt).getTime()),'Choose a valid future event time');const eventId=uid();this.transaction(()=>{this.run('INSERT INTO events VALUES(?,?,?,?,?,?,?)',eventId,id,title,district,startsAt,clean(body.description,600),this.clock());this.run('INSERT INTO rsvps VALUES(?,?)',eventId,id);});return{ok:true,event:this.events(id).find(event=>event.id===eventId)};}
  rsvp(id,eventId,attending){const row=this.get('SELECT * FROM events WHERE id=?',eventId);check(row,'Event not found',404);check(!this.blocked(id,row.host_id),'This event is unavailable',403);if(attending)this.run('INSERT OR IGNORE INTO rsvps VALUES(?,?)',eventId,id);else this.run('DELETE FROM rsvps WHERE event_id=? AND resident_id=?',eventId,id);return{ok:true,events:this.events(id)};}
  bootstrap(id){const profile=this.profile(id),workSchedule=this.workSchedule(profile);return{authenticated:true,profile,originMeta:ORIGIN_META,loanMeta:LOAN_META,loans:loanView(profile,this.clock()),workSchedule,properties:this.propertiesFor(profile),activeChallenge:this.activeChallenge(id),people:this.people(id),friends:this.friends(id),friendRequests:this.friendRequests(id),conversations:this.conversations(id),notifications:this.notifications(id),invitations:this.invitations(id),nearby:this.nearby(id),events:this.events(id),blocked:this.all("SELECT target FROM moderation WHERE owner=? AND kind='block'",id).map(row=>row.target),muted:this.all("SELECT target FROM moderation WHERE owner=? AND kind='mute'",id).map(row=>row.target),transactions:this.transactions(id)};}
}

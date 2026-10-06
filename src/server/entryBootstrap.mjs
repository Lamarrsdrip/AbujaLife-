import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../shared/atlas.mjs';
import { VENUES, VENUE_ACTIONS, LIFE_GOALS, ECONOMY_META, WALLET_META, INVESTMENT_META, DICE_META, LOAN_META, HOME_UPGRADES } from '../shared/life.mjs';
import { VEHICLE_COLORS } from '../shared/vehicles.mjs';
import { ORIGIN_META } from '../shared/origins.mjs';
import { catalog, properties, transportModes, appearanceOptions, activities } from '../shared/catalogue.mjs';
import { abujaTime, clubSchedule, seasonalWeather } from '../shared/simulation.mjs';

const COOKIE='abujalife_session=';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'};
const cleanOrigin=value=>{try{return new URL(value).origin;}catch{return '';}};
const strip=(row,extra=[])=>{if(!row)return{};const copy={...row};for(const key of ['_id','residentId',...extra])delete copy[key];return copy;};

function tokenFor(req){
 const bearer=/^Bearer ([A-Za-z0-9_-]{32,160})$/.exec(req.headers.authorization||'');
 if(bearer)return bearer[1];
 return(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(COOKIE))?.slice(COOKIE.length)||null;
}
function send(res,status,body){if(res.writableEnded)return;res.writeHead(status,JSON_HEADERS);res.end(JSON.stringify(body));}

async function mongoEntryProfile(store,id){
 const rows=await store.db.collection('residents').aggregate([
  {$match:{_id:id}},{$limit:1},
  {$lookup:{from:'appearances',localField:'_id',foreignField:'residentId',as:'appearanceRows'}},
  {$lookup:{from:'needs',localField:'_id',foreignField:'residentId',as:'needsRows'}},
  {$lookup:{from:'progression',localField:'_id',foreignField:'residentId',as:'progressionRows'}},
  {$lookup:{from:'player_state',localField:'_id',foreignField:'residentId',as:'stateRows'}},
  {$lookup:{from:'homes',localField:'_id',foreignField:'residentId',as:'homeRows'}},
  {$lookup:{from:'origins',localField:'_id',foreignField:'residentId',as:'originRows'}},
  {$lookup:{from:'wallets',localField:'_id',foreignField:'residentId',as:'walletRows'}},
  {$lookup:{from:'inventory',localField:'_id',foreignField:'residentId',as:'inventoryRows'}},
  {$lookup:{from:'vehicles',localField:'_id',foreignField:'residentId',as:'vehicleRows'}},
  {$lookup:{from:'properties',localField:'_id',foreignField:'residentId',as:'propertyRows'}},
  {$project:{passwordHash:0,password:0,authEpoch:0,searchPrefixes:0}}
 ]).toArray();
 const row=rows[0];
 if(!row)throw Object.assign(new Error('Resident not found'),{status:404,code:'resident_not_found'});
 const required=['appearanceRows','needsRows','progressionRows','stateRows','homeRows','originRows','walletRows'];
 if(required.some(key=>row[key]?.length!==1))throw Object.assign(new Error('Resident persistence is incomplete'),{status:503,code:'storage_incomplete'});
 const home=strip(row.homeRows[0]),{furnitureLayout={},storedFurniture=[],billsPaidAt,rentPaidAt,...homeFields}=home;
 const propertyRows=row.propertyRows||[];
 return{
  id:row.id||row._id,username:row.username,displayName:row.displayName,settings:row.settings||{},lifeGoal:row.lifeGoal||'explore',onboardingComplete:row.onboardingComplete===true,createdAt:row.createdAt,
  origin:row.originRows[0].origin,appearance:strip(row.appearanceRows[0]),...strip(row.needsRows[0]),...strip(row.progressionRows[0]),...strip(row.stateRows[0]),
  home:homeFields,wallet:row.walletRows[0].balance,
  inventory:(row.inventoryRows||[]).map(item=>item.itemId),vehicleColors:Object.fromEntries((row.vehicleRows||[]).map(item=>[item.itemId,item.color])),
  ownedProperties:propertyRows.filter(item=>item.owned).map(item=>item.propertyId),propertyInvestments:Object.fromEntries(propertyRows.filter(item=>item.investment).map(item=>[item.propertyId,item.investment])),
  furnitureLayout,storedFurniture,billsPaidAt,rentPaidAt,
  loans:[],gambleHistory:[],lastGambleRound:null,workDays:{}
 };
}

async function entryProfile(store,id){
 if(store.db?.collection&&typeof store.db.collection==='function')return mongoEntryProfile(store,id);
 return store.profile(id);
}

export function createEntryBootstrap({store,admin,social=null,corsOrigins=[],publicWebUrl=''}={}){
 if(!store||!admin)throw new Error('Entry bootstrap requires the game and admin stores.');
 const allowed=new Set([cleanOrigin(publicWebUrl),...corsOrigins.map(cleanOrigin)].filter(Boolean));
 function cors(req,res){
  const origin=req.headers.origin;if(!origin)return true;
  if(!allowed.has(cleanOrigin(origin))){send(res,403,{ok:false,error:'This origin is not permitted',code:'cross_origin'});return false;}
  res.setHeader('access-control-allow-origin',origin);res.setHeader('access-control-allow-credentials','true');res.setHeader('vary','Origin');return true;
 }
 async function state(id){
  const now=Number(store.clock?.()||Date.now());
  if(!id)return{authenticated:false,startup:true,entry:true,serverTime:now};
  let profile=await entryProfile(store,id),homeVisit=null;
  if(profile?.location?.kind==='visit'){
   if(!social?.reconcileVisits||!social?.visitState)throw Object.assign(new Error('This home visit is unavailable'),{status:403,code:'visit_unavailable'});
   await social.reconcileVisits(id);
   profile=await entryProfile(store,id);
   if(profile?.location?.kind==='visit'){
    const visitState=await social.visitState(id);homeVisit=visitState?.visit||null;
    if(!homeVisit)throw Object.assign(new Error('This home visit is unavailable'),{status:403,code:'visit_unavailable'});
   }
  }
  const residentProperties=profile?.origin?.residence?[...properties,profile.origin.residence]:properties;
  return{
   authenticated:true,startup:true,entry:true,profile,
   atlas:ABUJA_ATLAS,councils:AREA_COUNCILS,landmarks:LANDMARKS,atlasMeta:ATLAS_META,
   jobs:store.publicJobs(),catalog,properties:residentProperties,transportModes,appearanceOptions,activities,
   venues:VENUES,venueActions:VENUE_ACTIONS,lifeGoals:LIFE_GOALS,economyMeta:ECONOMY_META,
   walletMeta:{...WALLET_META,topupMode:'flutterwave',demoTopupEnabled:false},investmentMeta:INVESTMENT_META,diceMeta:DICE_META,loanMeta:LOAN_META,
   vehicleColors:VEHICLE_COLORS,homeUpgrades:HOME_UPGRADES,originMeta:ORIGIN_META,
   serverTime:now,clock:abujaTime(now),weather:seasonalWeather(now),clubSchedule:clubSchedule(now),
   loans:[],workSchedule:null,workSchedules:{},activeChallenge:null,
   people:[],friends:[],friendRequests:[],conversations:[],notifications:[],invitations:[],nearby:[],events:[],blocked:[],muted:[],transactions:[],
   homeVisit,homeVisitRequests:[],homeVisitors:[],admin:null,payments:null
  };
 }
 async function handle(req,res){
  let url;try{url=new URL(req.url,'https://api.abujacity.life');}catch{return false;}
  if(url.pathname!=='/api/entry'||req.method!=='GET')return false;
  try{
   if(!cors(req,res))return true;
   const token=tokenFor(req),id=await store.session(token);
   if(id&&await admin.isSuspended(id))throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});
   send(res,200,await state(id));return true;
  }catch(error){send(res,error.status||500,{ok:false,error:error.message||'Please try again.',code:error.code||'entry_failed'});return true;}
 }
 return{handle,state};
}

export function attachEntryBootstrap(server,options={}){
 const runtime=createEntryBootstrap(options),listeners=server.listeners('request');
 if(!listeners.length)throw new Error('Cannot attach entry bootstrap before the HTTP request handler exists.');
 server.removeAllListeners('request');
 server.on('request',(req,res)=>{
  let url;try{url=new URL(req.url,'https://api.abujacity.life');}catch{}
  if(url?.pathname==='/api/entry'&&req.method==='GET'){void runtime.handle(req,res);return;}
  for(const listener of listeners)listener.call(server,req,res);
 });
 return runtime;
}

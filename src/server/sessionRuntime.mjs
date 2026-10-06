import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../shared/atlas.mjs';
import { VENUES, VENUE_ACTIONS, LIFE_GOALS, ECONOMY_META, WALLET_META, INVESTMENT_META, DICE_META, LOAN_META, HOME_UPGRADES } from '../shared/life.mjs';
import { VEHICLE_COLORS } from '../shared/vehicles.mjs';
import { ORIGIN_META } from '../shared/origins.mjs';
import { catalog, properties, transportModes, appearanceOptions, activities } from '../shared/catalogue.mjs';
import { abujaTime, clubSchedule, seasonalWeather } from '../shared/simulation.mjs';

const COOKIE='abujalife_session=';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'};
const AUTH_PATHS=new Set(['/api/auth/login','/api/auth/register','/api/auth/logout']);
const cleanOrigin=value=>{try{return new URL(value).origin;}catch{return '';}};
const principal=value=>String(value??'').trim().toLowerCase().slice(0,254)||'unknown';
const strip=(row,extra=[])=>{if(!row)return{};const copy={...row};for(const key of ['_id','residentId',...extra])delete copy[key];return copy;};

function tokenFor(req){
 const bearer=/^Bearer ([A-Za-z0-9_-]{32,160})$/.exec(req.headers.authorization||'');
 if(bearer)return bearer[1];
 return(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(COOKIE))?.slice(COOKIE.length)||null;
}
function sessionCookie(token,{secureCookies=true}={}){
 return `${COOKIE}${token||''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?2592000:0}${secureCookies?'; Secure':''}`;
}
function send(res,status,body,extra={}){if(res.writableEnded)return;res.writeHead(status,{...JSON_HEADERS,...extra});res.end(JSON.stringify(body));}
async function readBody(req,maxBytes=32768){
 let size=0,parts=[];
 for await(const part of req){size+=part.length;if(size>maxBytes)throw Object.assign(new Error('Request body is too large'),{status:413,code:'body_too_large'});parts.push(part);}
 try{const value=JSON.parse(Buffer.concat(parts).toString()||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}
 catch(error){if(error.status)throw error;throw Object.assign(new Error('Send valid JSON'),{status:400,code:'invalid_json'});}
}

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
  id:row.id||row._id,username:row.username,displayName:row.displayName,email:row.email||undefined,emailVerified:row.emailVerified===true,
  settings:row.settings||{},lifeGoal:row.lifeGoal||'explore',onboardingComplete:row.onboardingComplete===true,createdAt:row.createdAt,
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

export function createSessionRuntime({store,admin,social=null,corsOrigins=[],publicWebUrl='',secureCookies=true,log=()=>{}}={}){
 if(!store||!admin)throw new Error('Session runtime requires the game store and admin store.');
 const allowed=new Set([cleanOrigin(publicWebUrl),...corsOrigins.map(cleanOrigin)].filter(Boolean));
 const limits=new Map();
 function clientKey(req){return String(req.socket?.remoteAddress||'unknown').slice(0,100);}
 function rateLimit(key,limit){
  const now=Date.now(),old=limits.get(key),bucket=old&&now-old.at<60000?old:{at:now,count:0};bucket.count++;limits.set(key,bucket);
  if(bucket.count>limit)throw Object.assign(new Error('Please wait before trying again'),{status:429,code:'rate_limited'});
  if(limits.size>10000)for(const[k,v]of limits)if(now-v.at>60000)limits.delete(k);
 }
 function cors(req,res){
  const origin=req.headers.origin;if(!origin)return true;
  if(!allowed.has(cleanOrigin(origin))){send(res,403,{ok:false,error:'This origin is not permitted',code:'cross_origin'});return false;}
  res.setHeader('access-control-allow-origin',origin);res.setHeader('access-control-allow-credentials','true');res.setHeader('vary','Origin');return true;
 }
 function requireJson(req){
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Send JSON for this action'),{status:415,code:'invalid_content_type'});
  if(req.headers['sec-fetch-site']==='cross-site')throw Object.assign(new Error('Open AbujaLife directly to perform this action'),{status:403,code:'cross_origin'});
 }
 async function state(id){
  const now=Number(store.clock?.()||Date.now());
  if(!id)return{authenticated:false,entry:true,serverTime:now};
  let profile=await entryProfile(store,id),homeVisit=null;
  if(profile?.location?.kind==='visit'){
   if(!social?.reconcileVisits||!social?.visitState)throw Object.assign(new Error('This home visit is unavailable'),{status:403,code:'visit_unavailable'});
   await social.reconcileVisits(id);profile=await entryProfile(store,id);
   if(profile?.location?.kind==='visit'){
    const visitState=await social.visitState(id);homeVisit=visitState?.visit||null;
    if(!homeVisit)throw Object.assign(new Error('This home visit is unavailable'),{status:403,code:'visit_unavailable'});
   }
  }
  const residentProperties=profile?.origin?.residence?[...properties,profile.origin.residence]:properties;
  return{
   authenticated:true,entry:true,profile,
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
 async function residentFromRequest(req){
  const token=tokenFor(req),id=await store.session(token);
  if(id&&await admin.isSuspended(id))throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});
  return{token,id};
 }
 async function handle(req,res){
  let url;try{url=new URL(req.url,'https://api.abujacity.life');}catch{return false;}
  const entry=url.pathname==='/api/entry'&&req.method==='GET';
  const auth=AUTH_PATHS.has(url.pathname)&&req.method==='POST';
  if(!entry&&!auth)return false;
  try{
   if(!cors(req,res))return true;
   if(entry){const{id}=await residentFromRequest(req);send(res,200,await state(id));return true;}
   requireJson(req);const payload=await readBody(req);
   if(url.pathname==='/api/auth/logout'){
    const{token}=await residentFromRequest(req);if(token)await store.logout(token);
    log('logout',{});send(res,200,{ok:true,authenticated:false,entry:true},{'set-cookie':sessionCookie('',{secureCookies})});return true;
   }
   const ip=clientKey(req),who=principal(payload.username||payload.email);rateLimit(`${url.pathname}:${ip}`,120);rateLimit(`${url.pathname}:${who}`,12);
   if(url.pathname==='/api/auth/register'){
    const settings=await admin.publicSettings();if(settings?.registrationOpen===false)throw Object.assign(new Error('Registration is temporarily paused'),{status:503,code:'registration_paused'});
   }
   const session=url.pathname==='/api/auth/login'?await store.login(payload):await store.register(payload);
   if(await admin.isSuspended(session.residentId)){await store.logout(session.token);throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});}
   const entryState=await state(session.residentId);
   log(url.pathname==='/api/auth/login'?'login':'signup',{residentId:session.residentId});
   send(res,url.pathname==='/api/auth/login'?200:201,{...entryState,ok:true,residentId:session.residentId},{'set-cookie':sessionCookie(session.token,{secureCookies})});return true;
  }catch(error){send(res,error.status||500,{ok:false,error:error.message||'Please try again.',code:error.code||'session_runtime_failed'});return true;}
 }
 return{handle,state};
}

export function attachSessionRuntime(server,options={}){
 const runtime=createSessionRuntime(options),listeners=server.listeners('request');
 if(!listeners.length)throw new Error('Cannot attach session runtime before the HTTP request handler exists.');
 server.removeAllListeners('request');
 server.on('request',(req,res)=>{
  let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{}
  if((pathname==='/api/entry'&&req.method==='GET')||(AUTH_PATHS.has(pathname)&&req.method==='POST')){void runtime.handle(req,res);return;}
  for(const listener of listeners)listener.call(server,req,res);
 });
 return runtime;
}

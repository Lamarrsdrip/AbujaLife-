import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../shared/atlas.mjs';
import { VENUES, VENUE_ACTIONS, LIFE_GOALS, ECONOMY_META, WALLET_META, INVESTMENT_META, DICE_META, LOAN_META, HOME_UPGRADES } from '../shared/life.mjs';
import { VEHICLE_COLORS } from '../shared/vehicles.mjs';
import { ORIGIN_META } from '../shared/origins.mjs';
import { catalog, properties, transportModes, appearanceOptions, activities } from '../shared/catalogue.mjs';
import { abujaTime, clubSchedule, seasonalWeather } from '../shared/simulation.mjs';

const COOKIE='abujalife_session=';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'};
const cleanOrigin=value=>{try{return new URL(value).origin;}catch{return '';}};
const principal=value=>String(value??'').trim().toLowerCase().slice(0,254)||'unknown';

function tokenFor(req){
 const bearer=/^Bearer ([A-Za-z0-9_-]{32,160})$/.exec(req.headers.authorization||'');
 if(bearer)return bearer[1];
 return(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(COOKIE))?.slice(COOKIE.length)||null;
}
function sessionCookie(token,{secureCookies=true}={}){return `${COOKIE}${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureCookies?'; Secure':''}`;}
function send(res,status,body,extra={}){if(res.writableEnded)return;res.writeHead(status,{...JSON_HEADERS,...extra});res.end(JSON.stringify(body));}
async function readBody(req,maxBytes=32768){
 let size=0,parts=[];
 for await(const part of req){size+=part.length;if(size>maxBytes)throw Object.assign(new Error('Request body is too large'),{status:413,code:'body_too_large'});parts.push(part);}
 try{const value=JSON.parse(Buffer.concat(parts).toString()||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}
 catch(error){if(error.status)throw error;throw Object.assign(new Error('Send valid JSON'),{status:400,code:'invalid_json'});}
}

export function createCoreEntry({store,admin,social=null,corsOrigins=[],publicWebUrl='',secureCookies=true,entryState=null,log=()=>{}}={}){
 if(!store||!admin)throw new Error('Core entry requires the game store and admin store.');
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
 async function startupState(id){
  const now=Number(store.clock?.()||Date.now());
  if(!id)return{authenticated:false,startup:true,serverTime:now};
  let profile=await store.profile(id),homeVisit=null;
  if(profile?.location?.kind==='visit'){
   if(!social?.reconcileVisits||!social?.visitState)throw Object.assign(new Error('This home visit is unavailable'),{status:403,code:'visit_unavailable'});
   await social.reconcileVisits(id);
   profile=await store.profile(id);
   if(profile?.location?.kind==='visit'){
    const visitState=await social.visitState(id);
    homeVisit=visitState?.visit||null;
    if(!homeVisit)throw Object.assign(new Error('This home visit is unavailable'),{status:403,code:'visit_unavailable'});
   }
  }
  const residentProperties=profile?.origin?.residence?[...properties,profile.origin.residence]:properties;
  return{
   authenticated:true,startup:true,profile,
   atlas:ABUJA_ATLAS,councils:AREA_COUNCILS,landmarks:LANDMARKS,atlasMeta:ATLAS_META,
   jobs:store.publicJobs(),catalog,properties:residentProperties,transportModes,appearanceOptions,activities,
   venues:VENUES,venueActions:VENUE_ACTIONS,lifeGoals:LIFE_GOALS,economyMeta:ECONOMY_META,
   walletMeta:{...WALLET_META,topupMode:'flutterwave',demoTopupEnabled:false},investmentMeta:INVESTMENT_META,diceMeta:DICE_META,loanMeta:LOAN_META,
   vehicleColors:VEHICLE_COLORS,homeUpgrades:HOME_UPGRADES,originMeta:ORIGIN_META,
   serverTime:now,clock:abujaTime(now),weather:seasonalWeather(now),clubSchedule:clubSchedule(now),
   loans:Array.isArray(profile.loans)?profile.loans:[],workSchedule:null,workSchedules:{},activeChallenge:null,
   people:[],friends:[],friendRequests:[],conversations:[],notifications:[],invitations:[],nearby:[],events:[],blocked:[],muted:[],transactions:[],
   homeVisit,homeVisitRequests:[],homeVisitors:[],admin:null,payments:null
  };
 }
 async function handle(req,res){
  let url;try{url=new URL(req.url,'https://api.abujacity.life');}catch{return false;}
  const startup=url.pathname==='/api/bootstrap'&&url.searchParams.get('startup')==='1'&&req.method==='GET';
  const sessionAuth=(url.pathname==='/api/auth/login'||url.pathname==='/api/auth/register')&&url.searchParams.get('session')==='1'&&req.method==='POST';
  if(!startup&&!sessionAuth)return false;
  try{
   if(!cors(req,res))return true;
   if(startup){
    const token=tokenFor(req),id=await store.session(token);
    if(id&&await admin.isSuspended(id))throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});
    return send(res,200,await startupState(id)),true;
   }
   requireJson(req);const payload=await readBody(req),ip=clientKey(req),who=principal(payload.username||payload.email);
   rateLimit(`${url.pathname}:${ip}`,120);rateLimit(`${url.pathname}:${who}`,12);
   if(url.pathname==='/api/auth/register'){
    const settings=await admin.publicSettings();if(settings?.registrationOpen===false)throw Object.assign(new Error('Registration is temporarily paused'),{status:503,code:'registration_paused'});
   }
   const session=url.pathname==='/api/auth/login'?await store.login(payload):await store.register(payload);
   if(await admin.isSuspended(session.residentId)){await store.logout(session.token);throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});}
   log(url.pathname==='/api/auth/login'?'login_core':'signup_core',{residentId:session.residentId});
   let entry=null;
   if(typeof entryState==='function'){
    try{entry=await entryState(session.residentId);}catch(error){log('entry_handshake_deferred',{residentId:session.residentId,code:error?.code||'entry_failed'});}
   }
   const body=entry?.authenticated&&entry?.profile?.id===session.residentId
    ?{...entry,ok:true,residentId:session.residentId}
    :{ok:true,authenticated:true,residentId:session.residentId};
   return send(res,url.pathname==='/api/auth/login'?200:201,body,{'set-cookie':sessionCookie(session.token,{secureCookies})}),true;
  }catch(error){send(res,error.status||500,{ok:false,error:error.message||'Please try again.',code:error.code||'core_entry_failed'});return true;}
 }
 return{handle,startupState};
}

export function attachCoreEntry(server,options={}){
 const runtime=createCoreEntry(options),listeners=server.listeners('request');if(!listeners.length)throw new Error('Cannot attach core entry before the HTTP request handler exists.');
 server.removeAllListeners('request');
 server.on('request',(req,res)=>{
  let url;try{url=new URL(req.url,'https://api.abujacity.life');}catch{}
  const startup=url?.pathname==='/api/bootstrap'&&url.searchParams.get('startup')==='1'&&req.method==='GET';
  const sessionAuth=(url?.pathname==='/api/auth/login'||url?.pathname==='/api/auth/register')&&url.searchParams.get('session')==='1'&&req.method==='POST';
  if(startup||sessionAuth){void runtime.handle(req,res);return;}
  for(const listener of listeners)listener.call(server,req,res);
 });
 return runtime;
}

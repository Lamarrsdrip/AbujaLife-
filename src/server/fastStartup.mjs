import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../shared/atlas.mjs';
import { VENUES, VENUE_ACTIONS, LIFE_GOALS, ECONOMY_META, WALLET_META, INVESTMENT_META, DICE_META, HOME_UPGRADES } from '../shared/life.mjs';
import { VEHICLE_COLORS } from '../shared/vehicles.mjs';
import { catalog, properties, transportModes, appearanceOptions, activities } from '../shared/catalogue.mjs';
import { abujaTime, jobSchedule, clubSchedule, seasonalWeather } from '../shared/simulation.mjs';
import { createCityStats } from './cityStats.mjs';

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','strict-transport-security':'max-age=31536000','content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
const COOKIE='abujalife_session=';
const SPRAY_AMOUNTS=new Set([1000,5000,10000,50000]);
const EMOTES=new Set(['wave','cheer']);
const FAST_PATHS=new Set(['/api/bootstrap/fast','/api/auth/login/fast','/api/presence/nearby','/api/presence/emote','/api/club/spray']);
const originOf=value=>{try{return new URL(value).origin;}catch{return '';}};
function tokenFor(req){const bearer=/^Bearer ([A-Za-z0-9_-]{32,160})$/.exec(req.headers.authorization||'');if(bearer)return bearer[1];return(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE))?.slice(COOKIE.length)||null;}
function sessionCookie(token){return `${COOKIE}${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;}
function send(res,status,body,extra={}){if(res.writableEnded)return;res.writeHead(status,{...HEADERS,...extra});res.end(JSON.stringify(body));}
async function body(req,max=32768){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>max)throw Object.assign(new Error('Request body is too large'),{status:413,code:'body_too_large'});parts.push(part);}try{const value=JSON.parse(Buffer.concat(parts).toString()||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw Object.assign(new Error('Send valid JSON'),{status:400,code:'invalid_json'});}}

export function createFastStartup({store,admin,corsOrigins=[],publicWebUrl,log=()=>{}}={}){
  const allowed=new Set([originOf(publicWebUrl),...corsOrigins.map(originOf)].filter(Boolean));
  const cityStats=createCityStats(store);
  const publicState=now=>({atlas:ABUJA_ATLAS,councils:AREA_COUNCILS,landmarks:LANDMARKS,atlasMeta:ATLAS_META,jobs:store.publicJobs(),catalog,properties,transportModes,appearanceOptions,activities,venues:VENUES,venueActions:VENUE_ACTIONS,lifeGoals:LIFE_GOALS,economyMeta:ECONOMY_META,walletMeta:{...WALLET_META,topupMode:'flutterwave',demoTopupEnabled:false},investmentMeta:INVESTMENT_META,diceMeta:DICE_META,vehicleColors:VEHICLE_COLORS,homeUpgrades:HOME_UPGRADES,serverTime:now,clock:abujaTime(now),weather:seasonalWeather(now),clubSchedule:clubSchedule(now)});
  async function fastState(id){
    const now=store.clock(),shared=publicState(now);
    if(!id)return{authenticated:false,...shared,events:[]};
    const profile=await store.profile(id);
    return{authenticated:true,...shared,profile,properties:store.propertiesFor(profile),workSchedule:jobSchedule(profile.job,profile,now),workSchedules:profile.job?{[profile.job]:jobSchedule(profile.job,profile,now)}:{},nearby:[],people:[],friends:[],friendRequests:[],conversations:[],notifications:[],invitations:[],events:[],blocked:[],muted:[],transactions:[],activeChallenge:null,homeVisit:null,homeVisitRequests:[],homeVisitors:[],admin:null,payments:{deferred:true},fastBootstrap:true};
  }
  async function requireResident(req){const token=tokenFor(req),id=await store.session(token);if(!id)throw Object.assign(new Error('Sign in to your resident account'),{status:401,code:'authentication_required'});if(await admin.isSuspended(id))throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});return{id,token};}
  async function nearby(id){const [people,stats]=await Promise.all([store.presence.nearby(id),cityStats.snapshot(id)]);return{ok:true,nearby:people,stats,serverTime:store.clock()};}
  async function emote(id,payload){
    const emote=String(payload?.emote||'');if(!EMOTES.has(emote))throw Object.assign(new Error('Choose a supported reaction'),{status:400,code:'invalid_emote'});
    const targetResidentId=typeof payload?.targetResidentId==='string'?payload.targetResidentId:null;
    if(targetResidentId){if(targetResidentId===id)throw Object.assign(new Error('Choose another resident'),{status:400,code:'invalid_target'});const nearby=await store.presence.nearby(id);if(!nearby.some(person=>person.id===targetResidentId))throw Object.assign(new Error('That resident is no longer nearby'),{status:409,code:'resident_not_nearby'});}
    const profile=await store.profile(id),event={residentId:id,targetResidentId,username:profile.username,displayName:profile.displayName,emote,createdAt:store.clock()};
    await store.emitZone(id,'player-emote',event);return{ok:true,emote:event};
  }
  async function spray(id,payload){
    const amount=Number(payload.amount);if(!SPRAY_AMOUNTS.has(amount))throw Object.assign(new Error('Choose a listed spray amount'),{status:400,code:'invalid_amount'});
    const result=await store.economyOperation(id,'club_spray',payload,{amount},async(profile,timestamp)=>{
      const venueId=profile.location?.venue||profile.location?.venueId,venue=VENUES.find(item=>item.id===venueId);
      if(profile.location?.kind!=='venue'||venue?.kind!=='club')throw Object.assign(new Error('Enter a club before spraying Game Naira'),{status:409,code:'club_required'});
      const schedule=clubSchedule(timestamp);if(!schedule.isOpen)throw Object.assign(new Error(schedule.reason||'The club is closed right now'),{status:409,code:'venue_closed'});
      if(profile.wallet<amount)throw Object.assign(new Error('You need more Game Naira for that'),{status:409,code:'insufficient_balance'});
      profile.wallet-=amount;profile.fun=Math.min(100,Number(profile.fun||0)+Math.min(8,Math.ceil(amount/10000)));profile.social=Math.min(100,Number(profile.social||0)+Math.min(6,Math.ceil(amount/15000)));profile.mood=Math.min(100,Number(profile.mood||0)+3);
      return{ledgerReason:`${venue.name} · sprayed Game Naira`,clubSpray:{residentId:id,username:profile.username,displayName:profile.displayName,venueId,venueName:venue.name,amount,createdAt:timestamp}};
    });
    if(!result.replayed&&result.clubSpray)await store.emitZone(id,'club-spray',result.clubSpray);
    return result;
  }
  function noteVisit(token,id){if(!token||!id)return;void cityStats.recordVisit(token,id).catch(error=>log('city_visit_error',{code:error.code||'city_visit_failed'}));}
  function cors(req,res){const origin=req.headers.origin;if(!origin)return true;if(!allowed.has(origin)){send(res,403,{ok:false,error:'This origin is not permitted',code:'cross_origin'});return false;}res.setHeader('access-control-allow-origin',origin);res.setHeader('access-control-allow-credentials','true');res.setHeader('vary','Origin');return true;}
  async function handle(req,res){
    let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{return false;}
    if(!FAST_PATHS.has(pathname))return false;
    try{
      if(!cors(req,res))return true;
      if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':req.headers.origin||originOf(publicWebUrl),'access-control-allow-credentials':'true','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization','access-control-max-age':'600','cache-control':'no-store'});res.end();return true;}
      if(pathname==='/api/bootstrap/fast'&&req.method==='GET'){
        const token=tokenFor(req),id=await store.session(token);if(id&&await admin.isSuspended(id))throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});
        noteVisit(token,id);return send(res,200,await fastState(id)),true;
      }
      if(pathname==='/api/auth/login/fast'&&req.method==='POST'){
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Send JSON for this action'),{status:415,code:'invalid_content_type'});
        if(req.headers.cookie&&!req.headers.authorization){const origin=req.headers.origin;if(!origin||!allowed.has(origin))throw Object.assign(new Error('This action must originate from AbujaLife'),{status:403,code:'cross_origin'});}
        const session=await store.login(await body(req));if(await admin.isSuspended(session.residentId)){await store.logout(session.token);throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});}
        noteVisit(session.token,session.residentId);log('login_fast',{residentId:session.residentId});return send(res,200,await fastState(session.residentId),{'set-cookie':sessionCookie(session.token)}),true;
      }
      const {id}=await requireResident(req);
      if(pathname==='/api/presence/nearby'&&req.method==='GET')return send(res,200,await nearby(id)),true;
      if(pathname==='/api/presence/emote'&&req.method==='POST'){
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Send JSON for this action'),{status:415,code:'invalid_content_type'});
        return send(res,200,await emote(id,await body(req))),true;
      }
      if(pathname==='/api/club/spray'&&req.method==='POST'){
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Send JSON for this action'),{status:415,code:'invalid_content_type'});
        return send(res,200,await spray(id,await body(req))),true;
      }
      send(res,405,{ok:false,error:'Method is not permitted',code:'method_not_allowed'});return true;
    }catch(error){send(res,error.status||500,{ok:false,error:error.message||'Please try again.',code:error.code||'fast_start_failed'});return true;}
  }
  return{handle,fastState,cityStats};
}

export function attachFastStartup(server,options={}){
  const runtime=createFastStartup(options),listeners=server.listeners('request');if(!listeners.length)throw new Error('Cannot attach fast startup before the HTTP request handler exists');
  server.removeAllListeners('request');server.on('request',(req,res)=>{let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{}if(FAST_PATHS.has(pathname)){void runtime.handle(req,res);return;}for(const listener of listeners)listener.call(server,req,res);});
  return runtime;
}

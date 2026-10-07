import { VENUES } from '../shared/life.mjs';
import { clubSchedule } from '../shared/simulation.mjs';
import { createCityStats } from './cityStats.mjs';

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'};
const COOKIE='abujalife_session=';
const LIVE_PATHS=new Set(['/api/presence/nearby','/api/presence/emote','/api/club/spray']);
const SPRAY_AMOUNTS=new Set([1000,5000,10000,50000]);
const EMOTES=new Set(['wave','cheer']);
const originOf=value=>{try{return new URL(value).origin;}catch{return '';}};
function tokenFor(req){const bearer=/^Bearer ([A-Za-z0-9_-]{32,160})$/.exec(req.headers.authorization||'');if(bearer)return bearer[1];return(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE))?.slice(COOKIE.length)||null;}
function send(res,status,body,extra={}){if(res.writableEnded)return;res.writeHead(status,{...HEADERS,...extra});res.end(JSON.stringify(body));}
async function body(req,max=32768){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>max)throw Object.assign(new Error('Request body is too large'),{status:413,code:'body_too_large'});parts.push(part);}try{const value=JSON.parse(Buffer.concat(parts).toString()||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw Object.assign(new Error('Send valid JSON'),{status:400,code:'invalid_json'});}}

export function createLiveActions({store,admin,corsOrigins=[],publicWebUrl='',trustProxy=false,log=()=>{}}={}){
 if(!store||!admin)throw new Error('Live actions require the game store and admin store.');
 const allowed=new Set([originOf(publicWebUrl),...corsOrigins.map(originOf)].filter(Boolean));
 const limits=new Map(),cityStats=createCityStats(store);
 function cors(req,res){const origin=req.headers.origin;if(!origin)return true;if(!allowed.has(originOf(origin))){send(res,403,{ok:false,error:'This origin is not permitted',code:'cross_origin'});return false;}res.setHeader('access-control-allow-origin',origin);res.setHeader('access-control-allow-credentials','true');res.setHeader('vary','Origin');return true;}
 function rateLimit(key,limit){const now=Date.now(),old=limits.get(key),bucket=old&&now-old.at<60000?old:{at:now,count:0};bucket.count++;limits.set(key,bucket);if(bucket.count>limit)throw Object.assign(new Error('Please wait before trying again'),{status:429,code:'rate_limited'});if(limits.size>100000)for(const[k,v]of limits)if(now-v.at>60000)limits.delete(k);}
 function requireJson(req){if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Send JSON for this action'),{status:415,code:'invalid_content_type'});if(req.headers.cookie&&!req.headers.authorization){const origin=req.headers.origin;if(!origin||!allowed.has(originOf(origin)))throw Object.assign(new Error('This action must originate from AbujaLife'),{status:403,code:'cross_origin'});}}
 async function requireResident(req){const token=tokenFor(req),id=await store.session(token);if(!id)throw Object.assign(new Error('Sign in to your resident account'),{status:401,code:'authentication_required'});if(await admin.isSuspended(id))throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});return{id,token};}
 async function nearby(id){const [people,stats]=await Promise.all([store.presence.nearby(id),cityStats.snapshot(id)]);return{ok:true,nearby:people,stats,serverTime:store.clock()};}
 async function emote(id,payload){
  const emote=String(payload?.emote||'');if(!EMOTES.has(emote))throw Object.assign(new Error('Choose a supported reaction'),{status:400,code:'invalid_emote'});
  const targetResidentId=typeof payload?.targetResidentId==='string'?payload.targetResidentId:null;
  if(targetResidentId){if(targetResidentId===id)throw Object.assign(new Error('Choose another resident'),{status:400,code:'invalid_target'});const people=await store.presence.nearby(id);if(!people.some(person=>person.id===targetResidentId))throw Object.assign(new Error('That resident is no longer nearby'),{status:409,code:'resident_not_nearby'});}
  const profile=await store.profile(id),event={residentId:id,targetResidentId,username:profile.username,displayName:profile.displayName,emote,createdAt:store.clock()};await store.emitZone(id,'player-emote',event);return{ok:true,emote:event};
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
  if(!result.replayed&&result.clubSpray)await store.emitZone(id,'club-spray',result.clubSpray);return result;
 }
 async function handle(req,res){
  let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{return false;}
  if(!LIVE_PATHS.has(pathname))return false;
  try{
   if(!cors(req,res))return true;
   if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':req.headers.origin||originOf(publicWebUrl),'access-control-allow-credentials':'true','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization','access-control-max-age':'600','cache-control':'no-store'});res.end();return true;}
   const{id,token}=await requireResident(req);rateLimit(`resident:${id}:${pathname}`,pathname==='/api/presence/nearby'?600:180);
   if(pathname==='/api/presence/nearby'&&req.method==='GET')return send(res,200,await nearby(id)),true;
   if(pathname==='/api/presence/emote'&&req.method==='POST'){requireJson(req);return send(res,200,await emote(id,await body(req))),true;}
   if(pathname==='/api/club/spray'&&req.method==='POST'){requireJson(req);return send(res,200,await spray(id,await body(req))),true;}
   send(res,405,{ok:false,error:'Method is not permitted',code:'method_not_allowed'});return true;
  }catch(error){log('live_action_error',{path:pathname,code:error.code||'live_action_failed'});send(res,error.status||500,{ok:false,error:error.message||'Please try again.',code:error.code||'live_action_failed'});return true;}
 }
 return{handle,cityStats};
}

export function attachLiveActions(server,options={}){
 const runtime=createLiveActions(options),listeners=server.listeners('request');if(!listeners.length)throw new Error('Cannot attach live actions before the HTTP request handler exists.');
 if(options.store)options.store.cityStats=runtime.cityStats;
 server.removeAllListeners('request');server.on('request',(req,res)=>{let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{}if(LIVE_PATHS.has(pathname)){void runtime.handle(req,res);return;}for(const listener of listeners)listener.call(server,req,res);});return runtime;
}

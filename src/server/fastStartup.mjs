import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../shared/atlas.mjs';
import { VENUES, VENUE_ACTIONS, LIFE_GOALS, ECONOMY_META, WALLET_META, INVESTMENT_META, DICE_META, HOME_UPGRADES } from '../shared/life.mjs';
import { VEHICLE_COLORS } from '../shared/vehicles.mjs';
import { catalog, properties, transportModes, appearanceOptions, activities } from '../shared/catalogue.mjs';
import { abujaTime, jobSchedule, clubSchedule, seasonalWeather } from '../shared/simulation.mjs';

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','strict-transport-security':'max-age=31536000','content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
const COOKIE='abujalife_session=';
const originOf=value=>{try{return new URL(value).origin;}catch{return '';}};
function tokenFor(req){const bearer=/^Bearer ([A-Za-z0-9_-]{32,160})$/.exec(req.headers.authorization||'');if(bearer)return bearer[1];return(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE))?.slice(COOKIE.length)||null;}
function sessionCookie(token){return `${COOKIE}${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;}
function send(res,status,body,extra={}){if(res.writableEnded)return;res.writeHead(status,{...HEADERS,...extra});res.end(JSON.stringify(body));}
async function body(req,max=32768){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>max)throw Object.assign(new Error('Request body is too large'),{status:413,code:'body_too_large'});parts.push(part);}try{const value=JSON.parse(Buffer.concat(parts).toString()||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw Object.assign(new Error('Send valid JSON'),{status:400,code:'invalid_json'});}}

export function createFastStartup({store,admin,corsOrigins=[],publicWebUrl,log=()=>{}}={}){
  const allowed=new Set([originOf(publicWebUrl),...corsOrigins.map(originOf)].filter(Boolean));
  const publicState=now=>({atlas:ABUJA_ATLAS,councils:AREA_COUNCILS,landmarks:LANDMARKS,atlasMeta:ATLAS_META,jobs:store.publicJobs(),catalog,properties,transportModes,appearanceOptions,activities,venues:VENUES,venueActions:VENUE_ACTIONS,lifeGoals:LIFE_GOALS,economyMeta:ECONOMY_META,walletMeta:{...WALLET_META,topupMode:'flutterwave',demoTopupEnabled:false},investmentMeta:INVESTMENT_META,diceMeta:DICE_META,vehicleColors:VEHICLE_COLORS,homeUpgrades:HOME_UPGRADES,serverTime:now,clock:abujaTime(now),weather:seasonalWeather(now),clubSchedule:clubSchedule(now)});
  async function fastState(id){
    const now=store.clock(),shared=publicState(now);
    if(!id)return{authenticated:false,...shared,events:[]};
    const profile=await store.profile(id);
    return{authenticated:true,...shared,profile,properties:store.propertiesFor(profile),workSchedule:jobSchedule(profile.job,profile,now),workSchedules:profile.job?{[profile.job]:jobSchedule(profile.job,profile,now)}:{},nearby:[],people:[],friends:[],friendRequests:[],conversations:[],notifications:[],invitations:[],events:[],blocked:[],muted:[],transactions:[],activeChallenge:null,homeVisit:null,homeVisitRequests:[],homeVisitors:[],admin:null,payments:{deferred:true},fastBootstrap:true};
  }
  function cors(req,res){const origin=req.headers.origin;if(!origin)return true;if(!allowed.has(origin)){send(res,403,{ok:false,error:'This origin is not permitted',code:'cross_origin'});return false;}res.setHeader('access-control-allow-origin',origin);res.setHeader('access-control-allow-credentials','true');res.setHeader('vary','Origin');return true;}
  async function handle(req,res){
    let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{return false;}
    if(pathname!=='/api/bootstrap/fast'&&pathname!=='/api/auth/login/fast')return false;
    try{
      if(!cors(req,res))return true;
      if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':req.headers.origin||originOf(publicWebUrl),'access-control-allow-credentials':'true','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization','access-control-max-age':'600','cache-control':'no-store'});res.end();return true;}
      if(pathname==='/api/bootstrap/fast'&&req.method==='GET'){
        const token=tokenFor(req),id=await store.session(token);if(id&&await admin.isSuspended(id))throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});
        return send(res,200,await fastState(id)),true;
      }
      if(pathname==='/api/auth/login/fast'&&req.method==='POST'){
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Send JSON for this action'),{status:415,code:'invalid_content_type'});
        if(req.headers.cookie&&!req.headers.authorization){const origin=req.headers.origin;if(!origin||!allowed.has(origin))throw Object.assign(new Error('This action must originate from AbujaLife'),{status:403,code:'cross_origin'});}
        const session=await store.login(await body(req));if(await admin.isSuspended(session.residentId)){await store.logout(session.token);throw Object.assign(new Error('This account is suspended'),{status:403,code:'account_suspended'});}
        log('login_fast',{residentId:session.residentId});return send(res,200,await fastState(session.residentId),{'set-cookie':sessionCookie(session.token)}),true;
      }
      send(res,405,{ok:false,error:'Method is not permitted',code:'method_not_allowed'});return true;
    }catch(error){send(res,error.status||500,{ok:false,error:error.message||'Please try again.',code:error.code||'fast_start_failed'});return true;}
  }
  return{handle,fastState};
}

export function attachFastStartup(server,options={}){
  const runtime=createFastStartup(options),listeners=server.listeners('request');if(!listeners.length)throw new Error('Cannot attach fast startup before the HTTP request handler exists');
  server.removeAllListeners('request');server.on('request',(req,res)=>{let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{}if(pathname==='/api/bootstrap/fast'||pathname==='/api/auth/login/fast'){void runtime.handle(req,res);return;}for(const listener of listeners)listener.call(server,req,res);});
  return runtime;
}

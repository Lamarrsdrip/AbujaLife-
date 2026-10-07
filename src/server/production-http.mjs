import http from 'node:http';
import crypto from 'node:crypto';
import { AuthError } from './mongo/authStore.mjs';
import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../shared/atlas.mjs';
import { VENUES, VENUE_ACTIONS, LIFE_GOALS, ECONOMY_META, WALLET_META, INVESTMENT_META, DICE_META, HOME_UPGRADES } from '../shared/life.mjs';
import { VEHICLE_COLORS } from '../shared/vehicles.mjs';
import { GameError } from './errors.mjs';
import { createSessionRuntime } from './sessionRuntime.mjs';
import { catalog, properties, transportModes, appearanceOptions, activities } from '../shared/catalogue.mjs';
import { abujaTime, jobSchedule, clubSchedule, seasonalWeather } from '../shared/simulation.mjs';

const SECURITY_HEADERS = {'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':"default-src 'none'; frame-ancestors 'none'",'strict-transport-security':'max-age=31536000','cache-control':'no-store'};
function fail(condition,message,status=400,code='invalid_request'){if(!condition)throw new GameError(message,status,code);}
function json(res,status,body){if(res.writableEnded)return;res.writeHead(status,{'content-type':'application/json; charset=utf-8',...SECURITY_HEADERS});res.end(JSON.stringify(body));}
function rawBody(req,maxBytes=65536){return new Promise((resolve,reject)=>{let bytes=0,parts=[],failed=false;req.on('data',part=>{bytes+=part.length;if(bytes>maxBytes){if(!failed)reject(new GameError('Request body is too large',413,'body_too_large'));failed=true;parts=[];}else if(!failed)parts.push(part);});req.on('end',()=>{if(!failed)resolve(Buffer.concat(parts));});req.on('error',reject);req.on('aborted',()=>reject(new GameError('Request was interrupted')));});}
async function readBody(req,maxBytes=65536){const raw=await rawBody(req,maxBytes);try{const body=JSON.parse(raw.toString()||'{}');fail(body&&typeof body==='object'&&!Array.isArray(body),'Send a JSON object');return body;}catch(error){if((error instanceof GameError||error instanceof AuthError))throw error;throw new GameError('Send valid JSON');}}
function tokenFor(req){const bearer=/^Bearer ([A-Za-z0-9_-]{32,160})$/.exec(req.headers.authorization||'');if(bearer)return bearer[1];return(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('abujalife_session='))?.slice(18)||null;}
function setSession(res,token){res.setHeader('set-cookie',`abujalife_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${token?2592000:0}`);}
export function productionLog(event,fields={}){console.log(JSON.stringify({time:new Date().toISOString(),service:'abujalife-api',event,...fields}));}

/** API-only listener. The static game is independently hosted by Hostinger. */
export function createProductionServer({store,social,directory,presence,admin,payments,rewards,ads,database,corsOrigins,publicWebUrl,trustProxy=false,log=productionLog,env=process.env,fetchImpl=fetch}){
  fail(store&&social&&directory&&admin&&payments&&rewards&&database,'Production stores are required',500);
  const allowedOrigins=new Set(corsOrigins);fail(allowedOrigins.size>0,'Configure permitted web origins',500);
  const clients=new Map(),byUser=new Map(),byZone=new Map(),lastSeen=new Map(),poses=new Map(),limits=new Map();let closed=false;
  let publicSettingsCache=null,publicSettingsAt=0;
  async function currentPublicSettings(){
    const now=Date.now();
    if(publicSettingsCache && now-publicSettingsAt<1000)return publicSettingsCache;
    publicSettingsCache=await admin.publicSettings();publicSettingsAt=now;return publicSettingsCache;
  }
  const safeTask=promise=>Promise.resolve(promise).catch(error=>log('realtime_error',{code:(error instanceof GameError||error instanceof AuthError)?error.code:'internal_error'}));
  const indexAdd=(map,key,res)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(res);};
  const indexRemove=(map,key,res)=>{const set=map.get(key);set?.delete(res);if(!set?.size)map.delete(key);};
  function writeEvent(res,event,data){if(res.writableEnded||res.destroyed)return;if(res.writableLength>262144){res.end();return;}res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);}
  async function reindex(id){const zone=await store.zone(id);for(const res of byUser.get(id)||[]){const client=clients.get(res);if(client&&client.zone!==zone){indexRemove(byZone,client.zone,res);client.zone=zone;indexAdd(byZone,zone,res);}}if(poses.get(id)?.zone!==zone)poses.delete(id);return zone;}
  function sendUser(id,event,data){safeTask((async()=>{if(['profile','home-visit'].includes(event))await reindex(id);for(const res of byUser.get(id)||[])writeEvent(res,event,data);})());}
  const online=id=>byUser.has(id)||Date.now()-(lastSeen.get(id)||0)<45000;
  store.isOnline=online;store.emitUser=sendUser;store.onlineInZone=zone=>[...new Set([...byZone.get(zone)||[]].map(res=>clients.get(res)?.id).filter(Boolean))];
  store.emitZone=(id,event,data)=>safeTask((async()=>{const zone=await reindex(id);for(const res of byZone.get(zone)||[]){const target=clients.get(res)?.id;if(target&&!(await store.blocked(id,target)))writeEvent(res,event,data);}})());
  let cityStatsTimer;
  async function emitCityStats(){
    if(!store.cityStats)return;
    store.cityStats.invalidate?.();
    const stats=await store.cityStats.globalSnapshot();
    for(const res of clients.keys())writeEvent(res,'city-stats',{stats,serverTime:store.clock()});
  }
  store.emitCityStats=()=>safeTask(emitCityStats());
  function scheduleCityStatsBroadcast(){if(!store.cityStats)return;clearTimeout(cityStatsTimer);cityStatsTimer=setTimeout(()=>safeTask(emitCityStats()),120);cityStatsTimer.unref?.();}
  async function broadcastPresence(id,previousZone=null){
    const zone=await reindex(id);
    // Persist the live connection's new zone before notifying peers to fetch
    // nearby. Otherwise the arrival event can precede the next heartbeat lease.
    const stream=[...(byUser.get(id)||[])].find(res=>!res.destroyed&&!res.writableEnded),client=stream&&clients.get(stream);
    if(presence&&client)await presence.touch(id,{connectionId:client.connectionId,zone});
    const targets=new Set([...(byZone.get(zone)||[]),...(byZone.get(previousZone)||[])]);
    for(const friend of await store.friendIds(id))for(const res of byUser.get(friend)||[])targets.add(res);
    for(const res of targets){const target=clients.get(res)?.id;if(target&&target!==id&&!(await store.blocked(id,target)))writeEvent(res,'presence',{resident:await store.resident(target,id)});}
    scheduleCityStatsBroadcast();
  }
  function rateLimit(req,kind,limit=90,principal=''){const forwarded=trustProxy?req.headers['x-forwarded-for']?.split(',').at(-1)?.trim():null;const ip=forwarded&&/^[\da-fA-F:.]+$/.test(forwarded)?forwarded:req.socket.remoteAddress;const key=`${principal||ip}:${kind}`,now=Date.now(),previous=limits.get(key),bucket=previous&&now-previous.at<60000?previous:{at:now,count:0};bucket.count++;limits.set(key,bucket);if(bucket.count>limit)throw new GameError('Please wait before trying again',429,'rate_limited');if(limits.size>5000)for(const[k,v]of limits)if(now-v.at>60000)limits.delete(k);}
  async function publicBootstrap(){const now=store.clock();return{authenticated:false,atlas:ABUJA_ATLAS,councils:AREA_COUNCILS,landmarks:LANDMARKS,atlasMeta:ATLAS_META,jobs:store.publicJobs(),catalog,properties,events:[],transportModes,appearanceOptions,activities,venues:VENUES,venueActions:VENUE_ACTIONS,lifeGoals:LIFE_GOALS,economyMeta:ECONOMY_META,walletMeta:{...WALLET_META,topupMode:'flutterwave',demoTopupEnabled:false},investmentMeta:INVESTMENT_META,diceMeta:DICE_META,vehicleColors:VEHICLE_COLORS,homeUpgrades:HOME_UPGRADES,payments:await payments.publicConfig(),serverTime:now,clock:abujaTime(now),weather:seasonalWeather(now),clubSchedule:clubSchedule(now)};}
  async function bootstrap(id){const publicState=await publicBootstrap();if(!id)return publicState;await social.reconcileVisits(id);const [base,visits,zone,adminState]=await Promise.all([store.bootstrap(id),social.visitState(id),store.zone(id),admin.status(id)]);return{...publicState,...base,nearby:(base.nearby||[]).map(person=>({...person,pose:poses.get(person.id)?.zone===zone?poses.get(person.id).pose:null})),properties:base.properties||properties,workSchedules:Object.fromEntries(Object.keys(store.publicJobs()).map(key=>[key,jobSchedule(key,base.profile,store.clock())])),homeVisit:visits.visit,homeVisitRequests:visits.requests,homeVisitors:visits.visitors,admin:adminState};}
  const sessionRuntime=createSessionRuntime({store,admin,social,directory,corsOrigins,publicWebUrl,secureCookies:true,log,env,fetchImpl});
  const server=http.createServer(async(req,res)=>{
    if(await sessionRuntime.handle(req,res))return;
    const requestId=crypto.randomUUID();res.setHeader('x-request-id',requestId);let pathname='';
    try{
      const url=new URL(req.url,'https://api.abujacity.life');pathname=url.pathname;const method=req.method||'GET',origin=req.headers.origin;
      if(origin){fail(allowedOrigins.has(origin),'This origin is not permitted',403,'cross_origin');res.setHeader('access-control-allow-origin',origin);res.setHeader('access-control-allow-credentials','true');res.setHeader('vary','Origin');}
      if(method==='OPTIONS'){fail(origin&&allowedOrigins.has(origin),'This origin is not permitted',403,'cross_origin');const wanted=(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);fail(wanted.every(v=>['content-type','authorization','x-request-id'].includes(v)),'Requested headers are not permitted',403);res.writeHead(204,{...SECURITY_HEADERS,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization, X-Request-ID','access-control-max-age':'600'});res.end();return;}
      if(['/health','/api/health'].includes(pathname)&&method==='GET'){const result=await database.health(),healthy=typeof result==='boolean'?result:result.ok===true;return json(res,healthy?200:503,{ok:healthy,service:'AbujaLife API',storage:'mongodb'});}
      if(pathname==='/api/payments/webhook'&&method==='POST'){rateLimit(req,'webhook',120);return json(res,200,await payments.handleWebhook(await rawBody(req),req.headers['flutterwave-signature']));}
      fail(['GET','POST'].includes(method),'Method is not permitted',405);
      if(method==='POST'){fail((req.headers['content-type']||'').toLowerCase().startsWith('application/json'),'Send JSON for this action',415);if(req.headers.cookie&&!req.headers.authorization)fail(origin&&allowedOrigins.has(origin),'This action must originate from AbujaLife',403,'cross_origin');if(req.headers['sec-fetch-site']==='cross-site')fail(origin&&allowedOrigins.has(origin),'Open AbujaLife to perform this action',403,'cross_origin');}
      const token=tokenFor(req),id=await store.session(token);
      // Shared mobile-network IPs must not pool authenticated residents' game
      // traffic. Anonymous and invalid sessions still share the strict IP cap.
      rateLimit(req,'requests',360,id||'');
      if(id&&await admin.isSuspended(id))throw new GameError('This account is suspended',403,'account_suspended');
      if(pathname==='/api/bootstrap'&&method==='GET')return json(res,200,await bootstrap(id));
      if(pathname==='/api/payments/config'&&method==='GET')return json(res,200,await payments.publicConfig());
      // Ad World is intentionally discoverable before sign-in; checkout and
      // ownership still require an authenticated resident below.
      if(pathname==='/api/ads/world'&&method==='GET')return json(res,200,await ads.world({zoneId:url.searchParams.get('zone'),page:url.searchParams.get('page'),limit:url.searchParams.get('limit'),zoom:url.searchParams.get('zoom'),bounds:url.searchParams.has('x')?Object.fromEntries(['x','y','width','height'].map(key=>[key,url.searchParams.get(key)])):null}));
      if(pathname==='/api/auth/config'&&method==='GET')return json(res,200,store.auth.configuration());
      if(pathname==='/payments/return'&&method==='GET'){const query=new URLSearchParams({payment:'return',transaction_id:(url.searchParams.get('transaction_id')||'').slice(0,100),tx_ref:(url.searchParams.get('tx_ref')||'').slice(0,160),status:(url.searchParams.get('status')||'').slice(0,40)});res.writeHead(303,{...SECURITY_HEADERS,location:`${publicWebUrl}/?${query}`});res.end();return;}
      if(pathname==='/api/auth/refresh'&&method==='POST'){await readBody(req);const session=await store.refreshSession(token);setSession(res,session.token);for(const[stream,client]of clients)if(client.token===token)stream.end();return json(res,200,{ok:true});}
      if(pathname==='/api/auth/logout-all'&&method==='POST'){fail(id,'Sign in',401,'authentication_required');await readBody(req);await store.logoutAll(id);for(const stream of byUser.get(id)||[])stream.end();setSession(res,'');return json(res,200,{ok:true});}
      if(pathname==='/api/auth/sessions'&&method==='GET'){fail(id,'Sign in',401,'authentication_required');return json(res,200,await store.auth.sessions(id,token));}
      if(pathname==='/api/auth/sessions/revoke'&&method==='POST'){fail(id,'Sign in',401,'authentication_required');const body=await readBody(req);return json(res,200,await store.auth.revokeSession(id,body.sessionId));}
      if(pathname==='/api/auth/password/reset'&&method==='POST'){rateLimit(req,'reset',5);return json(res,200,await store.auth.requestPasswordReset(await readBody(req)));}
      if(pathname==='/api/auth/password/reset/complete'&&method==='POST'){rateLimit(req,'reset',5);return json(res,200,await store.auth.completePasswordReset(await readBody(req)));}
      if(pathname==='/api/auth/email/verify'&&method==='POST'){rateLimit(req,'verification',10);return json(res,200,await store.auth.verifyEmail(await readBody(req)));}
      if(pathname==='/api/auth/email/status'&&method==='GET'){fail(id,'Sign in',401,'authentication_required');return json(res,200,await store.auth.emailStatus(id));}
      if(pathname==='/api/auth/email/request'&&method==='POST'){fail(id,'Sign in',401,'authentication_required');rateLimit(req,'verification-send',5,id);return json(res,200,await store.auth.requestEmailVerification(id,await readBody(req)));}
      if(pathname.startsWith('/api/')){
        fail(id,'Sign in to your resident account',401,'authentication_required');
        if(pathname==='/api/realtime'&&method==='GET'){
          rateLimit(req,'realtime-connections',30,id);
          const zone=await store.zone(id),connectionId=crypto.randomUUID();
          fail((byUser.get(id)?.size||0)<5,'Too many active connections for this account',429,'connection_limit');fail(clients.size<5000,'Realtime is at capacity; please reconnect shortly',503,'realtime_capacity');
          res.writeHead(200,{...SECURITY_HEADERS,'content-type':'text/event-stream','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});res.flushHeaders();
          clients.set(res,{id,token,zone,connectionId});indexAdd(byUser,id,res);indexAdd(byZone,zone,res);lastSeen.set(id,Date.now());
          req.on('close',()=>{const client=clients.get(res);clients.delete(res);indexRemove(byUser,id,res);indexRemove(byZone,client?.zone||zone,res);if(!byUser.has(id)){lastSeen.delete(id);poses.delete(id);}if(presence)safeTask(presence.disconnect(id,connectionId));if(!closed)safeTask(broadcastPresence(id,client?.zone||zone));});
          await store.delivered(id);if(!clients.has(res)||res.destroyed)return;
          if(presence)await presence.touch(id,{connectionId});
          if(!clients.has(res)||res.destroyed){if(presence)await presence.disconnect(id,connectionId);return;}
          writeEvent(res,'ready',{residentId:id,serverTime:store.clock()});safeTask(broadcastPresence(id));return;

        }
        if(method==='POST')rateLimit(req,pathname.includes('messages')||pathname.includes('chat')?'messages':'writes',pathname.includes('typing')||pathname==='/api/presence'?180:90,id);
        const body=method==='POST'?await readBody(req,pathname==='/api/social/posts'?786432:65536):{};
        if((await currentPublicSettings()).maintenance&&!pathname.startsWith('/api/admin/')&&method==='POST'&&!pathname.startsWith('/api/payments/'))throw new GameError('The game is undergoing maintenance. Your progress is saved.',503,'maintenance');
        if(pathname==='/api/residents'&&method==='GET')return json(res,200,(await directory.people(id,{q:url.searchParams.get('q')||'',cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined})));
        if(pathname==='/api/conversations'&&method==='GET')return json(res,200,await social.conversationPage(id,{cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined}));
        if(pathname==='/api/notifications'&&method==='GET')return json(res,200,await social.notificationPage(id,{cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined}));
        if(pathname==='/api/social/follows'&&method==='GET')return json(res,200,await social.follows(id,{cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined}));
        if(pathname==='/api/social/follows'&&method==='POST')return json(res,200,await social.follow(id,body.residentId,body.following!==false));
        if(pathname==='/api/groups'&&method==='GET')return json(res,200,await social.groups(id,{cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined}));
        if(pathname==='/api/groups'&&method==='POST')return json(res,201,await social.createGroup(id,body));
        const groupRoute=pathname.match(/^\/api\/groups\/([^/]+)\/(join|leave)$/);if(groupRoute&&method==='POST')return json(res,200,groupRoute[2]==='join'?await social.joinGroup(id,groupRoute[1]):await social.leaveGroup(id,groupRoute[1]));
        const groupMembersRoute=pathname.match(/^\/api\/groups\/([^/]+)\/members$/);if(groupMembersRoute&&method==='GET')return json(res,200,await social.groupMembers(id,groupMembersRoute[1],{cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined}));
        const messageReceiptsRoute=pathname.match(/^\/api\/conversations\/([^/]+)\/messages\/([^/]+)\/receipts$/);if(messageReceiptsRoute&&method==='GET')return json(res,200,await social.messageReceipts(id,messageReceiptsRoute[1],messageReceiptsRoute[2],{cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined}));
        const groupManagerRoute=pathname.match(/^\/api\/groups\/([^/]+)\/(members|members\/remove|update)$/);if(groupManagerRoute&&method==='POST'){const groupId=groupManagerRoute[1];return json(res,200,groupManagerRoute[2]==='members'?await social.addGroupMember(id,groupId,body.residentId):groupManagerRoute[2]==='update'?await social.updateGroup(id,groupId,body):await social.removeGroupMember(id,groupId,body.residentId));}
        if(pathname==='/api/social/feed'&&method==='GET')return json(res,200,(await social.feed(id,{cursor:url.searchParams.get('cursor')})));
        if(pathname==='/api/social/statuses'&&method==='GET')return json(res,200,(await social.statuses(id,{cursor:url.searchParams.get('cursor')})));
        if(pathname==='/api/social/posts'&&method==='POST')return json(res,201,(await social.createPost(id,body)));
        const socialRoute=pathname.match(/^\/api\/social\/posts\/([^/]+)(?:\/(like|comments|delete))?$/);
        if(socialRoute){const[,postId,kind]=socialRoute;if(kind==='like'&&method==='POST')return json(res,200,(await social.toggleLike(id,postId)));if(kind==='comments'&&method==='GET')return json(res,200,(await social.comments(id,postId,{cursor:url.searchParams.get('cursor')})));if(kind==='comments'&&method==='POST')return json(res,201,(await social.addComment(id,postId,body)));if(kind==='delete'&&method==='POST')return json(res,200,(await social.deleteOwnPost(id,postId)));}
        if(pathname==='/api/home/visits'&&method==='GET')return json(res,200,(await social.visitState(id,{cursor:url.searchParams.get('cursor'),visitorsCursor:url.searchParams.get('visitorsCursor'),limit:url.searchParams.get('limit')??undefined})));
        if(pathname==='/api/home/visits/request'&&method==='POST')return json(res,201,(await social.requestVisit(id,body)));
        if(pathname==='/api/home/visits/respond'&&method==='POST'){const result=(await social.answerVisit(id,body.requestId,body.accept===true));for(const residentId of new Set([id,result.visit?.guestId,...(result.visitors||[]).map(v=>v.guestId)].filter(Boolean)))safeTask(broadcastPresence(residentId));return json(res,200,result);}
        if(pathname==='/api/home/visits/leave'&&method==='POST'){const oldZone=(await store.zone(id)),result=(await social.leaveVisit(id));safeTask(broadcastPresence(id,oldZone));return json(res,200,result);}
        if(pathname==='/api/rewards/share/start'&&method==='POST')return json(res,200,await rewards.start(id,body));
        if(pathname==='/api/rewards/share/complete'&&method==='POST')return json(res,200,await rewards.complete(id,body));
        if(pathname==='/api/rewards/earn'&&method==='GET')return json(res,200,await rewards.earnOverview(id));
        if(pathname==='/api/rewards/activity/start'&&method==='POST')return json(res,200,await rewards.startActivity(id,body));
        if(pathname==='/api/rewards/activity/complete'&&method==='POST')return json(res,200,await rewards.completeActivity(id,body));
        if(pathname==='/api/rewards/campaigns'&&method==='GET')return json(res,200,await rewards.campaigns(id));
        if(pathname==='/api/ads/mine'&&method==='GET')return json(res,200,await ads.mine(id,{status:url.searchParams.get('status')}));
        if(pathname==='/api/payments/checkout'&&method==='POST')return json(res,200,await (await payments.checkout(id,body)));
        if(pathname==='/api/payments/verify'&&method==='POST')return json(res,200,await (await payments.verify(id,body)));
        if(pathname==='/api/payments/store/verify'&&method==='POST')return json(res,200,await payments.verifyStoreReceipt(id,body));
        if(pathname==='/api/payments/status'&&method==='GET')return json(res,200,(await payments.status(id,url.searchParams.get('txRef'))));
        if(pathname==='/api/admin/status'&&method==='GET')return json(res,200,(await admin.status(id)));
        if(pathname==='/api/admin/overview'&&method==='GET')return json(res,200,(await admin.overview(id)));
        if(pathname==='/api/admin/residents'&&method==='GET')return json(res,200,(await admin.residents(id,{query:url.searchParams.get('query')||url.searchParams.get('q'),cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined})));
        if(pathname==='/api/admin/resident'&&method==='GET')return json(res,200,(await admin.resident(id,url.searchParams.get('residentId'))));
        const adminResident=pathname.match(/^\/api\/admin\/residents\/([^/]+)$/);if(adminResident&&method==='GET')return json(res,200,(await admin.resident(id,adminResident[1])));
        if(pathname==='/api/admin/roles'&&method==='POST')return json(res,200,(await admin.assignRole(id,body)));
        if(['/api/admin/suspension','/api/admin/residents/suspend'].includes(pathname)&&method==='POST'){const result=(await admin.setSuspension(id,body));if((await admin.isSuspended(body.residentId)))for(const stream of byUser.get(body.residentId)||[])stream.end();return json(res,200,result);}
        if(['/api/admin/wallet','/api/admin/wallet/adjust'].includes(pathname)&&method==='POST')return json(res,200,(await admin.adjustWallet(id,body)));
        if(pathname==='/api/admin/reports'&&method==='GET')return json(res,200,(await admin.reports(id,{cursor:url.searchParams.get('cursor')})));
        if(['/api/admin/reports','/api/admin/reports/review'].includes(pathname)&&method==='POST')return json(res,200,(await admin.reviewReport(id,body)));
        if(pathname==='/api/admin/audit'&&method==='GET')return json(res,200,(await admin.audit(id,{cursor:url.searchParams.get('cursor')})));
        if(pathname==='/api/admin/settings'&&method==='GET')return json(res,200,(await admin.settings(id)));
        if(pathname==='/api/admin/settings'&&method==='POST'){const result=await admin.saveSettings(id,body);publicSettingsCache=null;publicSettingsAt=0;return json(res,200,result);}
        if(pathname==='/api/admin/payments/config'&&method==='GET')return json(res,200,(await payments.adminConfig(id)));
        if(pathname==='/api/admin/payments/config'&&method==='POST')return json(res,200,(await payments.configure(id,body)));
        if(pathname==='/api/admin/payments'&&method==='GET')return json(res,200,(await payments.list(id,{cursor:url.searchParams.get('cursor')})));
        if(pathname==='/api/admin/payments/verify'&&method==='POST')return json(res,200,await (await payments.adminVerify(id,body)));
        if(pathname==='/api/admin/rewards/campaigns'&&method==='GET')return json(res,200,await rewards.adminList(id));
        if(pathname==='/api/admin/rewards/campaigns'&&method==='POST')return json(res,200,await rewards.adminSave(id,body));
        if(pathname==='/api/admin/social/posts'&&method==='GET')return json(res,200,(await social.moderationPosts(id,{cursor:url.searchParams.get('cursor'),includeDeleted:url.searchParams.get('includeDeleted')==='true',limit:url.searchParams.get('limit')??undefined})));
        if(pathname==='/api/admin/social/delete'&&method==='POST')return json(res,200,(await social.moderateDeletePost(id,body.postId,body)));
        const adminSocialDelete=pathname.match(/^\/api\/admin\/social\/posts\/([^/]+)\/delete$/);if(adminSocialDelete&&method==='POST')return json(res,200,(await social.moderateDeletePost(id,adminSocialDelete[1],body)));
        if(pathname==='/api/profile'&&method==='POST'){
          const profile=await store.updateProfile(id,body);
          if(presence)await presence.refreshProfile(id,profile);
          await social.reconcileVisits(id);await broadcastPresence(id);return json(res,200,{ok:true,profile});
        }
        if(pathname==='/api/wallet'&&method==='GET')return json(res,200,(await store.wallet(id)));
        if(pathname==='/api/wallet/topup'&&method==='POST')throw new GameError('Use a verified payment provider to top up',403,'provider_required');
        if(pathname==='/api/wallet/transfer'&&method==='POST')return json(res,200,(await store.transfer(id,body)));
        if(pathname==='/api/action'&&method==='POST'){(await social.reconcileVisits(id));if(['topup','demo-topup'].includes(body.action))throw new GameError('Use the configured payment provider to add game Naira.',403,'provider_required');const oldZone=(await store.zone(id)),result=(await store.action(id,body.action,body.payload||{}));(await social.reconcileVisits(id));if((await store.zone(id))!==oldZone)safeTask(broadcastPresence(id,oldZone));return json(res,200,result);}
        if(pathname==='/api/presence'&&method==='POST'){lastSeen.set(id,Date.now());await reindex(id);if(body.heartbeat===true){if(presence)await presence.touch(id,{connectionId:'heartbeat',zone:await store.zone(id)});return json(res,200,{ok:true,serverTime:store.clock()});}if(body.pose){const raw=body.pose;const valid=raw&&['x','y','angle'].every(key=>Number.isFinite(raw[key]))&&raw.x>=0&&raw.y>=0&&raw.x<=20000&&raw.y<=20000&&Math.abs(raw.angle)<=36000;if(!valid)throw new GameError('Invalid world position');const allowedActivities=new Set(['walk','exercise','eat','dance','social','rest','sit','shop','watch','pray','groom','shower']),activity=typeof raw.activity==='string'&&allowedActivities.has(raw.activity)?raw.activity:null;const pose={x:raw.x,y:raw.y,angle:raw.angle,moving:raw.moving===true,driving:raw.driving===true,...(activity?{activity}:{})},zone=(await store.zone(id));if(presence)await presence.touch(id,{pose,connectionId:'heartbeat',zone});poses.set(id,{zone,pose});const resident=await store.collection('residents').findOne({id},{projection:{'settings.presenceVisible':1}});if(resident&&resident.settings?.presenceVisible!==false)(await store.emitZone(id,'world-pose',{residentId:id,pose,zone,at:store.clock()}));return json(res,200,{ok:true});}if(presence)await presence.touch(id,{connectionId:'heartbeat'});await broadcastPresence(id);return json(res,200,{ok:true,people:(await store.people(id)),nearby:(await store.nearby(id))});}
        if(pathname==='/api/travel/quote'&&method==='GET')return json(res,200,{ok:true,quote:(await store.quoteTravel(id,{district:url.searchParams.get('district'),mode:url.searchParams.get('mode')||'bus',venueId:url.searchParams.get('venueId')}))});
        if(pathname==='/api/chat/location'&&method==='GET')return json(res,200,(await store.locationMessages(id)));
        if(pathname==='/api/chat/location'&&method==='POST')return json(res,200,(await store.sendLocationMessage(id,body.text)));
        if(pathname==='/api/typing'&&method==='POST')return json(res,200,(await store.typing(id,body.conversationId)));
        if(pathname==='/api/friends/request'&&method==='POST')return json(res,200,(await store.requestFriend(id,body.residentId)));
        if(pathname==='/api/friends/respond'&&method==='POST')return json(res,200,(await store.respondFriend(id,body.requestId,body.accept===true)));
        if(pathname==='/api/friends/remove'&&method==='POST')return json(res,200,(await store.removeFriend(id,body.residentId)));
        if(pathname==='/api/conversations'&&method==='POST')return json(res,201,(await store.createConversation(id,body)));
        const conversationRoute=pathname.match(/^\/api\/conversations\/([^/]+)\/(messages|read|delivered)$/);
        if(conversationRoute){const [,conversationId,kind]=conversationRoute;if(kind==='messages'&&method==='GET')return json(res,200,(await directory.messages(id,conversationId,{cursor:url.searchParams.get('cursor')})));if(kind==='messages'&&method==='POST')return json(res,201,(await store.sendMessage(id,conversationId,body.text,body)));if(kind==='read'&&method==='POST')return json(res,200,(await store.readConversation(id,conversationId)));if(kind==='delivered'&&method==='POST')return json(res,200,await social.receipt(id,conversationId,false,body.uptoSeq??null));}
        if(pathname==='/api/moderation/block'&&method==='POST'){const result=(await store.moderate(id,'block',body.residentId,body.blocked!==false));(await social.reconcileVisits(id));await broadcastPresence(id);return json(res,200,result);}
        if(pathname==='/api/moderation/mute'&&method==='POST')return json(res,200,(await store.moderate(id,'mute',body.residentId,body.muted!==false)));
        if(pathname==='/api/moderation/report'&&method==='POST')return json(res,201,(await store.report(id,body)));
        if(pathname==='/api/notifications/read'&&method==='POST')return json(res,200,(await store.readNotifications(id,body.id)));
        if(pathname==='/api/invitations'&&method==='POST')return json(res,201,(await store.invite(id,body)));
        if(pathname==='/api/invitations/respond'&&method==='POST')return json(res,200,(await store.respondInvite(id,body.id,body.accept===true)));
        if(pathname==='/api/events'&&method==='POST')return json(res,201,(await store.createEvent(id,body)));
        const eventRoute=pathname.match(/^\/api\/events\/([^/]+)\/rsvp$/);if(eventRoute&&method==='POST')return json(res,200,(await store.rsvp(id,eventRoute[1],body.attending!==false)));
        return json(res,404,{ok:false,error:'Not found',code:'not_found'});
      }
      return json(res,404,{ok:false,error:'Not found',code:'not_found'});
    }catch(error){
      const status=(error instanceof GameError||error instanceof AuthError)?error.status:500;
      log(status===401?'authentication_failure':status>=500?'request_error':'request_rejected',{requestId,status,code:(error instanceof GameError||error instanceof AuthError)?error.code:'internal_error',method:req.method,path:pathname});
      if(res.headersSent){res.end();return;}if(status===429)res.setHeader('retry-after','60');json(res,status,{ok:false,error:(error instanceof GameError||error instanceof AuthError)?error.message:'Something went wrong. Please try again.',code:(error instanceof GameError||error instanceof AuthError)?error.code:'server_error'});
    }
  });
  let heartbeatRunning=false;
  const heartbeat=setInterval(()=>safeTask((async()=>{if(heartbeatRunning||closed)return;heartbeatRunning=true;try{for(const[res,client]of clients){if(!(await store.session(client.token))||await admin.isSuspended(client.id)){res.end();continue;}lastSeen.set(client.id,Date.now());if(presence)await presence.touch(client.id,{connectionId:client.connectionId});res.write(': heartbeat\n\n');}for(const[id,time]of lastSeen)if(Date.now()-time>45000){lastSeen.delete(id);await broadcastPresence(id);}}finally{heartbeatRunning=false;}})()),20000);heartbeat.unref();
  server.requestTimeout=30000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
  server.sessionRuntime=sessionRuntime;server.store=store;server.admin=admin;server.social=social;server.payments=payments;
  server.closeRealtime=()=>{closed=true;clearInterval(heartbeat);clearTimeout(cityStatsTimer);for(const res of clients.keys())res.end();};
  server.on('close',server.closeRealtime);return server;
}

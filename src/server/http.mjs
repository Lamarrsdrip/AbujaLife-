import {installActivityDiscovery} from './activityDiscovery.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../shared/atlas.mjs';
import { VENUES, VENUE_ACTIONS, LIFE_GOALS, ECONOMY_META, WALLET_META, INVESTMENT_META, DICE_META, HOME_UPGRADES } from '../shared/life.mjs';
import { VEHICLE_COLORS } from '../shared/vehicles.mjs';
import { GameStore, GameError, catalog, properties, transportModes, appearanceOptions, activities } from './gameStore.mjs';
import { SocialStore } from './socialStore.mjs';
import { AdminStore } from './adminStore.mjs';
import { createSessionRuntime } from './sessionRuntime.mjs';
import { PaymentStore } from './paymentStore.mjs';
import { RewardStore } from './rewardStore.mjs';
import { ResidentDirectory } from './residentDirectory.mjs';
import { abujaTime, jobSchedule, clubSchedule, seasonalWeather } from '../shared/simulation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const appRoot=path.join(root,'app'), sharedRoot=path.join(root,'src/shared');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.wav':'audio/wav'};
const headers={'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'DENY'};
const json=(res,status,body)=>{if(res.writableEnded)return;res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body));};
function readRawBody(req,maxBytes=786432){return new Promise((resolve,reject)=>{let bytes=0,parts=[],failed=false;req.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxBytes){if(!failed)reject(new GameError('Request body is too large',413));failed=true;parts=[];}else if(!failed)parts.push(chunk);});req.on('end',()=>{if(!failed)resolve(Buffer.concat(parts));});req.on('error',reject);});}
async function readBody(req,maxBytes=65536){const raw=await readRawBody(req,maxBytes);try{const value=JSON.parse(raw.toString()||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new GameError('Use a JSON object for this request');}}
function tokenFor(req){const entry=(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('abujalife_session='));return entry?.slice('abujalife_session='.length)||null;}
function secureCookie(req){return Boolean(req.socket.encrypted||req.headers['x-forwarded-proto']==='https');}
function setSession(res,req,token){res.setHeader('set-cookie',`abujalife_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?2592000:0}${secureCookie(req)?'; Secure':''}`);}
function writeAllowed(req){if(req.headers['sec-fetch-site']==='cross-site')throw new GameError('Open AbujaLife directly to perform this action',403,'cross_origin');if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw new GameError('Invalid origin',403);}if(origin.host!==req.headers.host||!['http:','https:'].includes(origin.protocol))throw new GameError('This action must come from AbujaLife',403,'cross_origin');}if(!(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new GameError('Send this action as JSON',415);}

export function createServer(options={}) {
  const store=options.store||new GameStore(options),clients=new Map(),lastSeen=new Map(),limits=new Map(),byUser=new Map(),byZone=new Map(),poses=new Map();
  const admin=options.admin||new AdminStore({store,bootstrapUsername:options.adminUsername}),social=options.social||new SocialStore(store),directory=new ResidentDirectory(store);
  const payments=options.payments||new PaymentStore({store,admin,fetchImpl:options.paymentFetch||fetch,configKey:options.configKey,publicOrigin:options.publicOrigin});
  const rewards=options.rewards||new RewardStore({store,admin,publicWebUrl:options.publicOrigin||'https://abujacity.life'});
  installActivityDiscovery(store);
  social.authorizeModeration=id=>admin.requirePermission(id,'moderation');
  let closed=false;
  const writeEvent=(res,event,data)=>{if(!res.writableEnded)res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);};
  const indexAdd=(index,key,res)=>{if(!index.has(key))index.set(key,new Set());index.get(key).add(res);};
  const indexRemove=(index,key,res)=>{const set=index.get(key);set?.delete(res);if(!set?.size)index.delete(key);};
  const reindex=id=>{const zone=store.zone(id);for(const res of byUser.get(id)||[]){const client=clients.get(res);if(client.zone!==zone){indexRemove(byZone,client.zone,res);client.zone=zone;indexAdd(byZone,zone,res);}}if(poses.get(id)?.zone!==zone)poses.delete(id);};
  const sendUser=(id,event,data)=>{if(['profile','home-visit'].includes(event))reindex(id);for(const res of byUser.get(id)||[])writeEvent(res,event,data);};
  const online=id=>byUser.has(id)||(Date.now()-(lastSeen.get(id)||0)<45000);
  store.isOnline=online;store.emitUser=sendUser;
  store.onlineInZone=zone=>[...new Set([...byZone.get(zone)||[]].map(res=>clients.get(res)?.id).filter(Boolean))];
  store.emitZone=(sender,event,data)=>{reindex(sender);const zone=store.zone(sender);for(const res of byZone.get(zone)||[]){const client=clients.get(res);if(!store.blocked(sender,client.id))writeEvent(res,event,data);}};
  function broadcastPresence(id,previousZone=null){reindex(id);const targets=new Set([...(byZone.get(store.zone(id))||[]),...(byZone.get(previousZone)||[])]);for(const friend of store.friendIds(id))for(const res of byUser.get(friend)||[])targets.add(res);for(const res of targets){const client=clients.get(res);if(client&&client.id!==id&&!store.blocked(id,client.id))writeEvent(res,'presence',{resident:store.resident(client.id,id)});}}
  function rateLimit(req,kind,limit=90){const key=`${req.socket.remoteAddress}:${kind}`,timestamp=Date.now(),old=limits.get(key),bucket=old&&timestamp-old.at<60000?old:{at:timestamp,count:0};bucket.count++;limits.set(key,bucket);if(bucket.count>limit)throw new GameError('Please wait a moment before trying again',429,'rate_limited');if(limits.size>5000)for(const [key,value] of limits)if(timestamp-value.at>60000)limits.delete(key);}
  const publicBootstrap=()=>({authenticated:false,atlas:ABUJA_ATLAS,councils:AREA_COUNCILS,landmarks:LANDMARKS,atlasMeta:ATLAS_META,jobs:store.publicJobs(),catalog,properties,events:[],transportModes,appearanceOptions,activities,venues:VENUES,venueActions:VENUE_ACTIONS,lifeGoals:LIFE_GOALS,economyMeta:ECONOMY_META,walletMeta:{...WALLET_META,topupMode:'flutterwave',demoTopupEnabled:options.allowGameTopups===true||admin.publicSettings().gameTopupsEnabled},investmentMeta:INVESTMENT_META,diceMeta:DICE_META,vehicleColors:VEHICLE_COLORS,homeUpgrades:HOME_UPGRADES,payments:payments.publicConfig(),serverTime:store.clock(),clock:abujaTime(store.clock()),weather:seasonalWeather(store.clock()),clubSchedule:clubSchedule(store.clock())});
  const bootstrap=id=>{
    if(!id)return publicBootstrap();
    social.reconcileVisits(id);
    const base=store.bootstrap(id),visits=social.visitState(id);
    return {...publicBootstrap(),...base,nearby:base.nearby.map(person=>({...person,pose:poses.get(person.id)?.zone===store.zone(id)?poses.get(person.id).pose:null})),properties:store.propertiesFor?.(id)||properties,workSchedules:Object.fromEntries(Object.keys(store.publicJobs()).map(key=>[key,jobSchedule(key,base.profile,store.clock())])),homeVisit:visits.visit,homeVisitRequests:visits.requests,homeVisitors:visits.visitors,admin:admin.status(id)};
  };
  const sessionOrigin=options.publicWebUrl||'http://localhost';
  const sessionRuntime=createSessionRuntime({store,admin,social,directory,corsOrigins:options.corsOrigins||[sessionOrigin],publicWebUrl:sessionOrigin,secureCookies:false,env:options.env||process.env,fetchImpl:options.fetchImpl||fetch});
  const server=http.createServer(async(req,res)=>{
    if(await sessionRuntime.handle(req,res))return;
    try{
      const url=new URL(req.url,'http://localhost'),pathname=url.pathname,method=req.method||'GET';
      if(pathname==='/api/payments/webhook'&&method==='POST')return json(res,200,await payments.handleWebhook(await readRawBody(req),req.headers['flutterwave-signature'],req.headers['verif-hash']));
      if(method==='POST')writeAllowed(req);
      const token=tokenFor(req),id=store.session(token);
      if(id&&admin.isSuspended(id))throw new GameError('This account is suspended. Contact the game administrator.',403,'account_suspended');
      if(pathname==='/api/health'&&method==='GET')return json(res,200,{ok:true,service:'AbujaLife',storage:'sqlite'});
      if(pathname==='/api/bootstrap'&&method==='GET')return json(res,200,bootstrap(id));
      if(pathname==='/api/payments/config'&&method==='GET')return json(res,200,payments.publicConfig());
      // Same public contract as production: account flags and the ad directory
      // are readable before sign-in so the city shell does not log failed loads.
      if(pathname==='/api/auth/config'&&method==='GET')return json(res,200,{ok:true,emailVerificationEnabled:false,passwordResetEnabled:false});
      if(pathname==='/api/ads/world'&&method==='GET')return json(res,200,{ok:true,spaces:[],active:[]});
      if(pathname==='/payments/return'&&method==='GET'){const query=new URLSearchParams({payment:'return',transaction_id:(url.searchParams.get('transaction_id')||'').slice(0,100),tx_ref:(url.searchParams.get('tx_ref')||'').slice(0,160),status:(url.searchParams.get('status')||'').slice(0,40)});res.writeHead(303,{location:`/?${query}`,...headers});res.end();return;}
      if(pathname.startsWith('/api/')){
        if(!id)throw new GameError('Sign in to your resident account',401,'authentication_required');
        if(pathname==='/api/realtime'&&method==='GET'){
          const zone=store.zone(id);res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no',...headers});res.flushHeaders();clients.set(res,{id,token,zone});indexAdd(byUser,id,res);indexAdd(byZone,zone,res);lastSeen.set(id,Date.now());store.delivered(id);writeEvent(res,'ready',{residentId:id,serverTime:store.clock()});broadcastPresence(id);
          req.on('close',()=>{const client=clients.get(res);clients.delete(res);indexRemove(byUser,id,res);indexRemove(byZone,client?.zone||zone,res);if(!byUser.has(id)){lastSeen.delete(id);poses.delete(id);}if(!closed)broadcastPresence(id,client?.zone||zone);});return;
        }
        if(method==='POST')rateLimit(req,pathname.includes('messages')||pathname.includes('chat')?'messages':'writes',pathname.includes('typing')?180:90);
        const body=method==='POST'?await readBody(req,pathname==='/api/social/posts'?786432:65536):{};
        if(admin.publicSettings().maintenance&&!pathname.startsWith('/api/admin/')&&method==='POST'&&!pathname.startsWith('/api/payments/'))throw new GameError('The game is undergoing maintenance. Your progress is saved.',503,'maintenance');
        if(pathname==='/api/residents'&&method==='GET')return json(res,200,directory.people(id,{q:url.searchParams.get('q')||'',cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined}));
        if(pathname==='/api/social/feed'&&method==='GET')return json(res,200,social.feed(id,{cursor:url.searchParams.get('cursor')}));
        if(pathname==='/api/social/statuses'&&method==='GET')return json(res,200,social.statuses(id,{cursor:url.searchParams.get('cursor')}));
        if(pathname==='/api/social/posts'&&method==='POST')return json(res,201,social.createPost(id,body));
        const socialRoute=pathname.match(/^\/api\/social\/posts\/([^/]+)(?:\/(like|comments|delete))?$/);
        if(socialRoute){const[,postId,kind]=socialRoute;if(kind==='like'&&method==='POST')return json(res,200,social.toggleLike(id,postId));if(kind==='comments'&&method==='GET')return json(res,200,social.comments(id,postId,{cursor:url.searchParams.get('cursor')}));if(kind==='comments'&&method==='POST')return json(res,201,social.addComment(id,postId,body));if(kind==='delete'&&method==='POST')return json(res,200,social.deleteOwnPost(id,postId));}
        if(pathname==='/api/home/visits'&&method==='GET')return json(res,200,social.visitState(id,{cursor:url.searchParams.get('cursor'),visitorsCursor:url.searchParams.get('visitorsCursor'),limit:url.searchParams.get('limit')??undefined}));
        if(pathname==='/api/home/visits/request'&&method==='POST')return json(res,201,social.requestVisit(id,body));
        if(pathname==='/api/home/visits/respond'&&method==='POST'){const result=social.answerVisit(id,body.requestId,body.accept===true);for(const residentId of new Set([id,result.visit?.guestId,...(result.visitors||[]).map(v=>v.guestId)].filter(Boolean)))broadcastPresence(residentId);return json(res,200,result);}
        if(pathname==='/api/home/visits/leave'&&method==='POST'){const oldZone=store.zone(id),result=social.leaveVisit(id);broadcastPresence(id,oldZone);return json(res,200,result);}
        if(pathname==='/api/payments/checkout'&&method==='POST')return json(res,200,await payments.checkout(id,body));
        if(pathname==='/api/rewards/share/start'&&method==='POST')return json(res,200,await rewards.start(id,body));
        if(pathname==='/api/rewards/share/complete'&&method==='POST')return json(res,200,await rewards.complete(id,body));
        if(pathname==='/api/rewards/earn'&&method==='GET')return json(res,200,await rewards.earnOverview(id));
        if(pathname==='/api/rewards/activity/start'&&method==='POST')return json(res,200,await rewards.startActivity(id,body));
        if(pathname==='/api/rewards/activity/complete'&&method==='POST')return json(res,200,await rewards.completeActivity(id,body));
        if(pathname==='/api/rewards/campaigns'&&method==='GET')return json(res,200,rewards.campaigns(id));
        if(pathname==='/api/payments/verify'&&method==='POST')return json(res,200,await payments.verify(id,body));
        if(pathname==='/api/payments/status'&&method==='GET')return json(res,200,payments.status(id,url.searchParams.get('txRef')));
        if(pathname==='/api/admin/status'&&method==='GET')return json(res,200,admin.status(id));
        if(pathname==='/api/admin/overview'&&method==='GET')return json(res,200,admin.overview(id));
        if(pathname==='/api/admin/residents'&&method==='GET')return json(res,200,admin.residents(id,{query:url.searchParams.get('query')||url.searchParams.get('q'),cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined}));
        if(pathname==='/api/admin/resident'&&method==='GET')return json(res,200,admin.resident(id,url.searchParams.get('residentId')));
        const adminResident=pathname.match(/^\/api\/admin\/residents\/([^/]+)$/);if(adminResident&&method==='GET')return json(res,200,admin.resident(id,adminResident[1]));
        if(pathname==='/api/admin/roles'&&method==='POST')return json(res,200,admin.assignRole(id,body));
        if(['/api/admin/suspension','/api/admin/residents/suspend'].includes(pathname)&&method==='POST'){const result=admin.setSuspension(id,body);if(admin.isSuspended(body.residentId))for(const stream of byUser.get(body.residentId)||[])stream.end();return json(res,200,result);}
        if(['/api/admin/wallet','/api/admin/wallet/adjust'].includes(pathname)&&method==='POST')return json(res,200,admin.adjustWallet(id,body));
        if(pathname==='/api/admin/reports'&&method==='GET')return json(res,200,admin.reports(id,{cursor:url.searchParams.get('cursor')}));
        if(['/api/admin/reports','/api/admin/reports/review'].includes(pathname)&&method==='POST')return json(res,200,admin.reviewReport(id,body));
        if(pathname==='/api/admin/audit'&&method==='GET')return json(res,200,admin.audit(id,{cursor:url.searchParams.get('cursor')}));
        if(pathname==='/api/admin/settings'&&method==='GET')return json(res,200,admin.settings(id));
        if(pathname==='/api/admin/settings'&&method==='POST')return json(res,200,admin.saveSettings(id,body));
        if(pathname==='/api/admin/payments/config'&&method==='GET')return json(res,200,payments.adminConfig(id));
        if(pathname==='/api/admin/payments/config'&&method==='POST')return json(res,200,payments.configure(id,body));
        if(pathname==='/api/admin/payments'&&method==='GET')return json(res,200,payments.list(id,{cursor:url.searchParams.get('cursor')}));
        if(pathname==='/api/admin/payments/verify'&&method==='POST')return json(res,200,await payments.adminVerify(id,body));
        if(pathname==='/api/admin/rewards/campaigns'&&method==='GET')return json(res,200,await rewards.adminList(id));
        if(pathname==='/api/admin/rewards/campaigns'&&method==='POST')return json(res,200,await rewards.adminSave(id,body));
        if(pathname==='/api/admin/social/posts'&&method==='GET')return json(res,200,social.moderationPosts(id,{cursor:url.searchParams.get('cursor'),includeDeleted:url.searchParams.get('includeDeleted')==='true',limit:url.searchParams.get('limit')??undefined}));
        if(pathname==='/api/admin/social/delete'&&method==='POST')return json(res,200,social.moderateDeletePost(id,body.postId,body));
        const adminSocialDelete=pathname.match(/^\/api\/admin\/social\/posts\/([^/]+)\/delete$/);if(adminSocialDelete&&method==='POST')return json(res,200,social.moderateDeletePost(id,adminSocialDelete[1],body));
        if(pathname==='/api/profile'&&method==='POST'){const profile=store.updateProfile(id,body);social.reconcileVisits(id);broadcastPresence(id);return json(res,200,{ok:true,profile});}
        if(pathname==='/api/wallet'&&method==='GET')return json(res,200,store.wallet(id));
        if(pathname==='/api/wallet/topup'&&method==='POST'){if(options.allowGameTopups!==true&&!admin.publicSettings().gameTopupsEnabled)throw new GameError('Free funds are available in the browser preview. Use Flutterwave for a full-game top-up when configured.',403,'provider_required');return json(res,200,store.topup(id,body));}
        if(pathname==='/api/wallet/transfer'&&method==='POST')return json(res,200,store.transfer(id,body));
        if(pathname==='/api/action'&&method==='POST'){social.reconcileVisits(id);if(['topup','demo-topup'].includes(body.action)&&options.allowGameTopups!==true&&!admin.publicSettings().gameTopupsEnabled)throw new GameError('Use the configured payment provider to add game Naira.',403,'provider_required');const oldZone=store.zone(id),result=store.action(id,body.action,body.payload||{});social.reconcileVisits(id);if(store.zone(id)!==oldZone)broadcastPresence(id,oldZone);return json(res,200,result);}
        if(pathname==='/api/presence'&&method==='POST'){lastSeen.set(id,Date.now());reindex(id);if(body.heartbeat===true)return json(res,200,{ok:true,serverTime:store.clock()});if(body.pose){const raw=body.pose;const valid=raw&&['x','y','angle'].every(key=>Number.isFinite(raw[key]))&&raw.x>=0&&raw.y>=0&&raw.x<=20000&&raw.y<=20000&&Math.abs(raw.angle)<=36000;if(!valid)throw new GameError('Invalid world position');const pose={x:raw.x,y:raw.y,angle:raw.angle,moving:raw.moving===true,driving:raw.driving===true},zone=store.zone(id);poses.set(id,{zone,pose});if(store.profile(id).settings.presenceVisible)store.emitZone(id,'world-pose',{residentId:id,pose,zone,at:store.clock()});return json(res,200,{ok:true});}broadcastPresence(id);return json(res,200,{ok:true,people:store.people(id),nearby:store.nearby(id)});}
        if(pathname==='/api/presence/nearby'&&method==='GET'){
          const nearbyPeople=store.nearby(id),nowMs=Date.now(),onlineIds=new Set([id]);
          for(const [residentId,seen] of lastSeen)if(nowMs-seen<45000)onlineIds.add(residentId);
          const totalPlayers=Number(store.get('SELECT count(*) AS n FROM residents')?.n||0);
          return json(res,200,{ok:true,nearby:nearbyPeople,stats:{onlineNow:onlineIds.size,totalPlayers,visitsToday:0,visitsAllTime:totalPlayers,trackingSince:store.clock(),hereNow:nearbyPeople.length+1},serverTime:store.clock()});
        }
        if(pathname==='/api/travel/quote'&&method==='GET')return json(res,200,{ok:true,quote:store.quoteTravel(id,{district:url.searchParams.get('district'),mode:url.searchParams.get('mode')||'bus',venueId:url.searchParams.get('venueId')})});
        if(pathname==='/api/chat/location'&&method==='GET')return json(res,200,store.locationMessages(id));
        if(pathname==='/api/chat/location'&&method==='POST')return json(res,200,store.sendLocationMessage(id,body.text));
        if(pathname==='/api/typing'&&method==='POST')return json(res,200,store.typing(id,body.conversationId));
        if(pathname==='/api/friends/request'&&method==='POST')return json(res,200,store.requestFriend(id,body.residentId));
        if(pathname==='/api/friends/respond'&&method==='POST')return json(res,200,store.respondFriend(id,body.requestId,body.accept===true));
        if(pathname==='/api/friends/remove'&&method==='POST')return json(res,200,store.removeFriend(id,body.residentId));
        if(pathname==='/api/conversations'&&method==='POST')return json(res,201,store.createConversation(id,body));
        if(pathname==='/api/conversations'&&method==='GET')return json(res,200,directory.conversations(id,{cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined}));
        const conversationRoute=pathname.match(/^\/api\/conversations\/([^/]+)\/(messages|read|delivered)$/);
        if(conversationRoute){const [,conversationId,kind]=conversationRoute;if(kind==='messages'&&method==='GET')return json(res,200,directory.messages(id,conversationId,{cursor:url.searchParams.get('cursor')}));if(kind==='messages'&&method==='POST')return json(res,201,store.sendMessage(id,conversationId,body.text,body));if(kind==='read'&&method==='POST')return json(res,200,store.readConversation(id,conversationId));if(kind==='delivered'&&method==='POST')return json(res,200,store.delivered(id,conversationId,body));}
        if(pathname==='/api/moderation/block'&&method==='POST'){const result=store.moderate(id,'block',body.residentId,body.blocked!==false);social.reconcileVisits(id);broadcastPresence(id);return json(res,200,result);}
        if(pathname==='/api/moderation/mute'&&method==='POST')return json(res,200,store.moderate(id,'mute',body.residentId,body.muted!==false));
        if(pathname==='/api/moderation/report'&&method==='POST')return json(res,201,store.report(id,body));
        if(pathname==='/api/notifications/read'&&method==='POST')return json(res,200,store.readNotifications(id,body.id));
        if(pathname==='/api/invitations'&&method==='POST')return json(res,201,store.invite(id,body));
        if(pathname==='/api/invitations/respond'&&method==='POST')return json(res,200,store.respondInvite(id,body.id,body.accept===true));
        if(pathname==='/api/events'&&method==='POST')return json(res,201,store.createEvent(id,body));
        const eventRoute=pathname.match(/^\/api\/events\/([^/]+)\/rsvp$/);if(eventRoute&&method==='POST')return json(res,200,store.rsvp(id,eventRoute[1],body.attending!==false));
        return json(res,404,{ok:false,error:'Not found',code:'not_found'});
      }
      if(!['GET','HEAD'].includes(method))return json(res,405,{ok:false,error:'Method not allowed'});
      if(pathname==='/admin'){res.writeHead(303,{location:'/admin.html',...headers});res.end();return;}
      let rel;try{rel=decodeURIComponent(pathname);}catch{throw new GameError('Invalid URL');}
      let base=appRoot;
      // Shared browser modules resolve authored helpers under /app/.
      // Both routes expose only the same already-public app directory.
      if(rel.startsWith('/app/'))rel=rel.slice(4);
      if(rel.startsWith('/src/shared/')){base=sharedRoot;rel=rel.slice('/src/shared'.length);if(path.extname(rel)!=='.mjs')return json(res,404,{error:'Not found'});}
      if(rel==='/')rel='/index.html';const target=path.resolve(base,`.${rel}`);if(target!==base&&!target.startsWith(base+path.sep))return json(res,403,{error:'Forbidden'});
      let data;try{data=await fs.readFile(target);}catch(error){if(error.code!=='ENOENT'&&error.code!=='EISDIR')throw error;if(base===sharedRoot||path.extname(rel))return json(res,404,{error:'Not found'});data=await fs.readFile(path.join(appRoot,'index.html'));rel='/index.html';}
      const ext=path.extname(rel);res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':!options.production||ext==='.html'?'no-store':'public, max-age=300',...headers});res.end(method==='HEAD'?undefined:data);
    }catch(error){if(res.headersSent){res.end();return;}if(!(error instanceof GameError))console.error('AbujaLife request error:',error);json(res,error.status||500,{ok:false,error:error instanceof GameError?error.message:'Something went wrong. Please try again.',code:error.code||'server_error'});}
  });
  const heartbeat=setInterval(()=>{for(const [res,client] of clients){if(!store.session(client.token)||admin.isSuspended(client.id)){res.end();continue;}lastSeen.set(client.id,Date.now());res.write(': heartbeat\n\n');}for(const [id,time] of lastSeen)if(Date.now()-time>45000){lastSeen.delete(id);broadcastPresence(id);}},20000);heartbeat.unref();
  server.sessionRuntime=sessionRuntime;server.store=store;server.admin=admin;server.social=social;server.payments=payments;server.rewards=rewards;server.closeRealtime=()=>{for(const res of clients.keys())res.end();};server.on('close',()=>{closed=true;clearInterval(heartbeat);store.close();});return server;
}

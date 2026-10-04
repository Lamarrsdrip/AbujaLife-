import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../shared/atlas.mjs';
import { VENUES, VENUE_ACTIONS, LIFE_GOALS, ECONOMY_META } from '../shared/life.mjs';
import { GameStore, GameError, catalog, properties, transportModes, appearanceOptions, activities } from './gameStore.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const appRoot=path.join(root,'app'), sharedRoot=path.join(root,'src/shared');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.wav':'audio/wav'};
const headers={'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'DENY'};
const json=(res,status,body)=>{if(res.writableEnded)return;res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body));};
function readBody(req){return new Promise((resolve,reject)=>{let bytes=0,parts=[],failed=false;req.on('data',chunk=>{bytes+=chunk.length;if(bytes>65536){if(!failed)reject(new GameError('Request body is too large',413));failed=true;parts=[];}else if(!failed)parts.push(chunk);});req.on('end',()=>{if(failed)return;try{const value=JSON.parse(Buffer.concat(parts).toString()||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();resolve(value);}catch{reject(new GameError('Use a JSON object for this request'));}});req.on('error',reject);});}
function tokenFor(req){const entry=(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('abujalife_session='));return entry?.slice('abujalife_session='.length)||null;}
function secureCookie(req){return Boolean(req.socket.encrypted||req.headers['x-forwarded-proto']==='https');}
function setSession(res,req,token){res.setHeader('set-cookie',`abujalife_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?2592000:0}${secureCookie(req)?'; Secure':''}`);}
function writeAllowed(req){if(req.headers['sec-fetch-site']==='cross-site')throw new GameError('Open AbujaLife directly to perform this action',403,'cross_origin');if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw new GameError('Invalid origin',403);}if(origin.host!==req.headers.host||!['http:','https:'].includes(origin.protocol))throw new GameError('This action must come from AbujaLife',403,'cross_origin');}if(!(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new GameError('Send this action as JSON',415);}

export function createServer(options={}) {
  const store=options.store||new GameStore(options),clients=new Map(),lastSeen=new Map(),limits=new Map();
  let closed=false;
  const writeEvent=(res,event,data)=>{if(!res.writableEnded)res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);};
  const sendUser=(id,event,data)=>{for(const [res,client] of clients)if(client.id===id)writeEvent(res,event,data);};
  const online=id=>[...clients.values()].some(client=>client.id===id)||(Date.now()-(lastSeen.get(id)||0)<45000);
  store.isOnline=online;store.emitUser=sendUser;
  store.emitZone=(sender,event,data)=>{const zone=store.zone(sender);for(const [res,client] of clients)if(store.zone(client.id)===zone&&!store.blocked(sender,client.id))writeEvent(res,event,data);};
  function broadcastPresence(id,previousZone=null){const friends=store.friendIds(id),zone=store.zone(id);for(const [res,client] of clients){if(client.id===id||store.blocked(id,client.id))continue;if(friends.includes(client.id)||store.zone(client.id)===zone||store.zone(client.id)===previousZone)writeEvent(res,'presence',{resident:store.resident(client.id,id)});}}
  function rateLimit(req,kind,limit=90){const key=`${req.socket.remoteAddress}:${kind}`,timestamp=Date.now(),old=limits.get(key),bucket=old&&timestamp-old.at<60000?old:{at:timestamp,count:0};bucket.count++;limits.set(key,bucket);if(bucket.count>limit)throw new GameError('Please wait a moment before trying again',429,'rate_limited');if(limits.size>5000)for(const [key,value] of limits)if(timestamp-value.at>60000)limits.delete(key);}
  const publicBootstrap=()=>({authenticated:false,atlas:ABUJA_ATLAS,councils:AREA_COUNCILS,landmarks:LANDMARKS,atlasMeta:ATLAS_META,jobs:store.publicJobs(),catalog,properties,events:[],transportModes,appearanceOptions,activities,venues:VENUES,venueActions:VENUE_ACTIONS,lifeGoals:LIFE_GOALS,economyMeta:ECONOMY_META});
  const bootstrap=id=>({...publicBootstrap(),...(id?store.bootstrap(id):{})});
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost'),pathname=url.pathname,method=req.method||'GET';
      if(method==='POST')writeAllowed(req);
      const token=tokenFor(req),id=store.session(token);
      if(pathname==='/api/health'&&method==='GET')return json(res,200,{ok:true,service:'AbujaLife',storage:'sqlite'});
      if(pathname==='/api/bootstrap'&&method==='GET')return json(res,200,bootstrap(id));
      if(pathname==='/api/auth/register'&&method==='POST'){rateLimit(req,'auth',12);const session=await store.register(await readBody(req));setSession(res,req,session.token);return json(res,201,bootstrap(session.residentId));}
      if(pathname==='/api/auth/login'&&method==='POST'){rateLimit(req,'auth',12);const session=await store.login(await readBody(req));setSession(res,req,session.token);return json(res,200,bootstrap(session.residentId));}
      if(pathname==='/api/auth/logout'&&method==='POST'){await readBody(req);store.logout(token);setSession(res,req,'');if(id){for(const [stream,client] of clients)if(client.token===token)stream.end();if(![...clients.values()].some(client=>client.id===id))lastSeen.delete(id);broadcastPresence(id);}return json(res,200,{ok:true,authenticated:false});}
      if(pathname.startsWith('/api/')){
        if(!id)throw new GameError('Sign in to your resident account',401,'authentication_required');
        if(pathname==='/api/realtime'&&method==='GET'){
          if([...clients.values()].filter(client=>client.id===id).length>=6)throw new GameError('Close another AbujaLife tab before opening this one',429);
          res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no',...headers});res.flushHeaders();clients.set(res,{id,token});lastSeen.set(id,Date.now());store.delivered(id);writeEvent(res,'ready',{residentId:id,serverTime:Date.now()});broadcastPresence(id);
          req.on('close',()=>{clients.delete(res);if(![...clients.values()].some(client=>client.id===id))lastSeen.delete(id);if(!closed)broadcastPresence(id);});return;
        }
        if(method==='POST')rateLimit(req,pathname.includes('messages')||pathname.includes('chat')?'messages':'writes',pathname.includes('typing')?180:90);
        const body=method==='POST'?await readBody(req):{};
        if(pathname==='/api/profile'&&method==='POST'){const profile=store.updateProfile(id,body);broadcastPresence(id);return json(res,200,{ok:true,profile});}
        if(pathname==='/api/action'&&method==='POST'){const oldZone=store.zone(id),result=store.action(id,body.action,body.payload||{});if(store.zone(id)!==oldZone)broadcastPresence(id,oldZone);return json(res,200,result);}
        if(pathname==='/api/presence'&&method==='POST'){lastSeen.set(id,Date.now());broadcastPresence(id);return json(res,200,{ok:true,people:store.people(id),nearby:store.nearby(id)});}
        if(pathname==='/api/travel/quote'&&method==='GET')return json(res,200,{ok:true,quote:store.quoteTravel(id,{district:url.searchParams.get('district'),mode:url.searchParams.get('mode')||'bus'})});
        if(pathname==='/api/chat/location'&&method==='GET')return json(res,200,store.locationMessages(id));
        if(pathname==='/api/chat/location'&&method==='POST')return json(res,200,store.sendLocationMessage(id,body.text));
        if(pathname==='/api/typing'&&method==='POST')return json(res,200,store.typing(id,body.conversationId));
        if(pathname==='/api/friends/request'&&method==='POST')return json(res,200,store.requestFriend(id,body.residentId));
        if(pathname==='/api/friends/respond'&&method==='POST')return json(res,200,store.respondFriend(id,body.requestId,body.accept===true));
        if(pathname==='/api/friends/remove'&&method==='POST')return json(res,200,store.removeFriend(id,body.residentId));
        if(pathname==='/api/conversations'&&method==='POST')return json(res,201,store.createConversation(id,body));
        const conversationRoute=pathname.match(/^\/api\/conversations\/([^/]+)\/(messages|read)$/);
        if(conversationRoute){const [,conversationId,kind]=conversationRoute;if(kind==='messages'&&method==='GET')return json(res,200,store.messages(id,conversationId));if(kind==='messages'&&method==='POST')return json(res,201,store.sendMessage(id,conversationId,body.text));if(kind==='read'&&method==='POST')return json(res,200,store.readConversation(id,conversationId));}
        if(pathname==='/api/moderation/block'&&method==='POST'){const result=store.moderate(id,'block',body.residentId,body.blocked!==false);broadcastPresence(id);return json(res,200,result);}
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
      let rel;try{rel=decodeURIComponent(pathname);}catch{throw new GameError('Invalid URL');}
      let base=appRoot;
      if(rel.startsWith('/src/shared/')){base=sharedRoot;rel=rel.slice('/src/shared'.length);if(path.extname(rel)!=='.mjs')return json(res,404,{error:'Not found'});}
      if(rel==='/')rel='/index.html';const target=path.resolve(base,`.${rel}`);if(target!==base&&!target.startsWith(base+path.sep))return json(res,403,{error:'Forbidden'});
      let data;try{data=await fs.readFile(target);}catch(error){if(error.code!=='ENOENT'&&error.code!=='EISDIR')throw error;if(base===sharedRoot||path.extname(rel))return json(res,404,{error:'Not found'});data=await fs.readFile(path.join(appRoot,'index.html'));rel='/index.html';}
      const ext=path.extname(rel);res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':!options.production||ext==='.html'?'no-store':'public, max-age=300',...headers});res.end(method==='HEAD'?undefined:data);
    }catch(error){if(res.headersSent){res.end();return;}if(!(error instanceof GameError))console.error('AbujaLife request error:',error);json(res,error.status||500,{ok:false,error:error instanceof GameError?error.message:'Something went wrong. Please try again.',code:error.code||'server_error'});}
  });
  const heartbeat=setInterval(()=>{for(const [res,client] of clients){if(!store.session(client.token)){res.end();continue;}lastSeen.set(client.id,Date.now());res.write(': heartbeat\n\n');}for(const [id,time] of lastSeen)if(Date.now()-time>45000){lastSeen.delete(id);broadcastPresence(id);}},20000);heartbeat.unref();
  server.store=store;server.closeRealtime=()=>{for(const res of clients.keys())res.end();};server.on('close',()=>{closed=true;clearInterval(heartbeat);store.close();});return server;
}

import crypto from 'node:crypto';
import { GameError } from './errors.mjs';

const HEADERS={
  'cache-control':'no-cache, no-transform','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  'x-frame-options':'DENY','strict-transport-security':'max-age=31536000','x-accel-buffering':'no'
};
const COOKIE='abujalife_session=';
const originOf=value=>{try{return new URL(value).origin;}catch{return '';}};
function tokenFor(req){const bearer=/^Bearer ([A-Za-z0-9_-]{32,160})$/.exec(req.headers.authorization||'');if(bearer)return bearer[1];return(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE))?.slice(COOKIE.length)||null;}
async function readBody(req,max=65536){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>max)throw new GameError('Request body is too large',413,'body_too_large');parts.push(part);}try{const value=JSON.parse(Buffer.concat(parts).toString()||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch(error){if(error instanceof GameError)throw error;throw new GameError('Send valid JSON',400,'invalid_json');}}
function send(res,status,body){if(res.writableEnded)return;res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));}
function writeEvent(res,event,data){if(res.writableEnded||res.destroyed)return;if(res.writableLength>512*1024){res.end();return;}res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);}

/**
 * Realtime sockets remain local to each API process, while Mongo change streams
 * fan events across every process. There is deliberately no shared hardcoded
 * resident/connection ceiling; horizontal infrastructure carries the scale.
 */
export function attachClusterRealtime(server,{store,presence,realtime,admin,corsOrigins=[],publicWebUrl,trustProxy=false,log=()=>{}}={}){
  if(!server||!store||!presence||!realtime||!admin)throw new TypeError('Cluster realtime dependencies are required');
  const allowed=new Set([originOf(publicWebUrl),...corsOrigins.map(originOf)].filter(Boolean));
  const clients=new Map(),byUser=new Map(),byZone=new Map(),limits=new Map();let closed=false;
  const add=(map,key,res)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(res);};
  const remove=(map,key,res)=>{const set=map.get(key);set?.delete(res);if(!set?.size)map.delete(key);};
  const safe=promise=>Promise.resolve(promise).catch(error=>log('cluster_realtime_error',{code:error?.code||'realtime_error'}));
  const clientIp=req=>{const forwarded=trustProxy?String(req.headers['x-forwarded-for']||'').split(',').map(v=>v.trim()).find(Boolean):'';return forwarded||req.socket.remoteAddress||'unknown';};
  const rate=(req,kind,limit)=>{const now=Date.now(),key=`${clientIp(req)}:${kind}`,prior=limits.get(key),bucket=prior&&now-prior.at<60000?prior:{at:now,count:0};bucket.count++;limits.set(key,bucket);if(bucket.count>limit)throw new GameError('Please wait before trying again',429,'rate_limited');if(limits.size>50000)for(const[k,v]of limits)if(now-v.at>60000)limits.delete(k);};
  const cors=(req,res)=>{const origin=req.headers.origin;if(!origin)return true;if(!allowed.has(origin)){send(res,403,{ok:false,error:'This origin is not permitted',code:'cross_origin'});return false;}res.setHeader('access-control-allow-origin',origin);res.setHeader('access-control-allow-credentials','true');res.setHeader('vary','Origin');return true;};
  async function zoneFor(id){const zone=await store.zone(id);for(const res of byUser.get(id)||[]){const client=clients.get(res);if(client&&client.zone!==zone){remove(byZone,client.zone,res);client.zone=zone;add(byZone,zone,res);}}return zone;}
  async function broadcastPresence(id,previousZone=null){
    const zone=await zoneFor(id);
    const jobs=[realtime.publishZone(zone,'presence-resident',{residentId:id},{senderId:id})];
    if(previousZone&&previousZone!==zone)jobs.push(realtime.publishZone(previousZone,'presence-resident',{residentId:id},{senderId:id}));
    for(const friendId of await store.friendIds(id))jobs.push(realtime.publishUser(friendId,'presence-resident',{residentId:id},{senderId:id}));
    await Promise.all(jobs);
  }
  async function recipients(document){
    if(document.kind==='user')return new Set(byUser.get(document.userId)||[]);
    if(document.kind==='zone')return new Set(byZone.get(document.zone)||[]);
    return new Set();
  }
  const unsubscribe=realtime.subscribe(async document=>{
    const targets=await recipients(document);if(!targets.size)return;
    if(document.event==='presence-resident'){
      const residentId=String(document.data?.residentId||document.senderId||'');if(!residentId)return;
      for(const res of targets){const target=clients.get(res)?.id;if(!target||target===residentId)continue;try{if(await store.blocked(residentId,target))continue;const resident=await store.resident(target,residentId);writeEvent(res,'presence',{resident});}catch(error){if(![403,404].includes(error?.status))throw error;}}
      return;
    }
    for(const res of targets){const target=clients.get(res)?.id;if(!target)continue;if(document.kind==='zone'&&document.senderId&&await store.blocked(document.senderId,target))continue;writeEvent(res,document.event,document.data);}
  });

  // All chat/profile/notification fan-out goes through the broker. The presence
  // store remains the cross-instance source of online truth.
  store.isOnline=presence.isOnline.bind(presence);
  store.onlineInZone=presence.onlineInZone.bind(presence);
  store.emitUser=(id,event,data)=>safe((async()=>{if(['profile','home-visit'].includes(event))await zoneFor(id);await realtime.publishUser(id,event,data,{senderId:id});if(['profile','home-visit'].includes(event))await broadcastPresence(id);})());
  store.emitZone=(id,event,data)=>safe((async()=>{const zone=await zoneFor(id);await realtime.publishZone(zone,event,data,{senderId:id});})());

  async function handle(req,res){
    let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{return false;}
    if(!['/api/realtime','/api/presence'].includes(pathname))return false;
    try{
      if(!cors(req,res))return true;
      if(req.method==='OPTIONS'){res.writeHead(204,{...HEADERS,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization','access-control-max-age':'600'});res.end();return true;}
      const token=tokenFor(req),id=await store.session(token);if(!id)throw new GameError('Sign in to your resident account',401,'authentication_required');if(await admin.isSuspended(id))throw new GameError('This account is suspended',403,'account_suspended');
      if(pathname==='/api/realtime'&&req.method==='GET'){
        rate(req,'realtime-connect',120);
        const zone=await store.zone(id),connectionId=crypto.randomUUID();
        res.writeHead(200,{...HEADERS,'content-type':'text/event-stream','connection':'keep-alive'});res.flushHeaders?.();
        clients.set(res,{id,token,zone,connectionId});add(byUser,id,res);add(byZone,zone,res);
        req.on('close',()=>{const client=clients.get(res);clients.delete(res);remove(byUser,id,res);remove(byZone,client?.zone||zone,res);safe(presence.disconnect(id,connectionId));if(!closed)safe(broadcastPresence(id,client?.zone||zone));});
        await store.delivered(id);if(!clients.has(res)||res.destroyed)return true;
        await presence.touch(id,{connectionId,zone});
        writeEvent(res,'ready',{residentId:id,serverTime:store.clock()});safe(broadcastPresence(id));return true;
      }
      if(pathname==='/api/presence'&&req.method==='POST'){
        rate(req,'presence',360);
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw new GameError('Send JSON for this action',415,'invalid_content_type');
        if(req.headers.cookie&&!req.headers.authorization){const origin=req.headers.origin;if(!origin||!allowed.has(origin))throw new GameError('This action must originate from AbujaLife',403,'cross_origin');}
        const body=await readBody(req),zone=await zoneFor(id);
        if(body.pose){const pose=presence.validatePose(body.pose);await presence.touch(id,{pose,connectionId:'heartbeat',zone});await realtime.publishZone(zone,'world-pose',{residentId:id,pose,zone,at:store.clock()},{senderId:id});return send(res,200,{ok:true}),true;}
        await presence.touch(id,{connectionId:'heartbeat',zone});await broadcastPresence(id);return send(res,200,{ok:true,people:await store.people(id),nearby:await store.nearby(id)}),true;
      }
      send(res,405,{ok:false,error:'Method is not permitted',code:'method_not_allowed'});return true;
    }catch(error){const status=error?.status||500;if(status===429)res.setHeader('retry-after','60');send(res,status,{ok:false,error:error?.message||'Please try again.',code:error?.code||'cluster_realtime_error'});return true;}
  }

  const listeners=server.listeners('request');if(!listeners.length)throw new Error('Cannot attach cluster realtime before the HTTP handler exists');
  server.removeAllListeners('request');server.on('request',(req,res)=>{let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{}if(['/api/realtime','/api/presence'].includes(pathname)){void handle(req,res);return;}for(const listener of listeners)listener.call(server,req,res);});

  const heartbeat=setInterval(()=>safe((async()=>{for(const[res,client]of clients){if(!(await store.session(client.token))||await admin.isSuspended(client.id)){res.end();continue;}const zone=await zoneFor(client.id);await presence.touch(client.id,{connectionId:client.connectionId,zone});if(!res.writableEnded)res.write(': heartbeat\n\n');}})()),20000);heartbeat.unref();
  const priorClose=server.closeRealtime?.bind(server)||(()=>{});
  server.closeRealtime=()=>{if(closed)return;closed=true;clearInterval(heartbeat);unsubscribe();for(const res of clients.keys())res.end();clients.clear();byUser.clear();byZone.clear();priorClose();};
  return{handle,broadcastPresence,close:server.closeRealtime,connections:()=>clients.size};
}

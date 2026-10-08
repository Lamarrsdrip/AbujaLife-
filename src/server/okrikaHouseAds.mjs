import crypto from 'node:crypto';
import {adSpaceFromId} from '../shared/advertising.mjs';
import {normalizeAdImage,normalizeAdLink} from './mongo/adStore.mjs';
import {GameError} from './errors.mjs';

const TOKEN_COOKIE='abujalife_session=';
const PLATFORM_SECRET='platform-admin-no-billing';
const PLATFORM_END_AT=Date.UTC(9999,11,31,23,59,59,999);
const SECURITY_HEADERS=Object.freeze({'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','strict-transport-security':'max-age=31536000','cache-control':'no-store'});
const clean=(value,max=200)=>String(value??'').trim().slice(0,max);
const fail=(condition,message,status=400,code='invalid_request')=>{if(!condition)throw new GameError(message,status,code);};
const requestKey=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(value);
const slotPosition=id=>{const space=adSpaceFromId(id);return space?{mapX:space.x,mapY:space.y}:{};};

function normalizeSelection(kind,raw){
 fail(['plot','billboard'].includes(kind),'Choose advertising land or a roadside billboard',400,'invalid_ad_kind');
 const slots=[...new Set((Array.isArray(raw)?raw:[]).map(value=>clean(value,120)).filter(Boolean))];
 fail(slots.length===1,'Choose one advertising placement',400,'invalid_ad_space');
 const space=adSpaceFromId(slots[0]);
 fail(space&&space.kind===kind&&space.eligible!==false,'That location cannot be used for advertising. Choose open land away from roads and buildings.',400,'invalid_ad_space');
 return slots;
}
function platformView(row){
 return {txRef:row.txRef,campaignType:'platform',ownerType:'platform',billing:false,permanent:true,kind:row.kind,slots:row.slots,title:row.title,link:row.link,imageDataUrl:row.imageDataUrl,startAt:row.startAt,endAt:row.endAt,createdAt:row.createdAt,createdBy:row.residentId,placements:row.slots.map(adSpaceFromId).filter(Boolean)};
}

// Keep the historical installer name so production startup remains compatible,
// but do not seed or inject any automatic campaigns. Admin campaigns now use
// the same ad_orders/ad_slots engine as customer campaigns and therefore render
// exactly like uploaded paid creatives.
export async function installOkrikaHouseAds(ads,{database,log=()=>{}}={}){
 if(!ads||ads.__platformAdsInstalled)return ads;
 const db=database?.db||ads.db;
 fail(db?.collection&&ads.store?.transaction&&ads.admin,'Advertising requires the production database and admin store',500,'ads_unavailable');
 const orders=db.collection('ad_orders'),slotsCollection=db.collection('ad_slots');

 ads.platformCampaigns=async id=>{
  await ads.admin.requirePermission(id,'payments');
  await ads.purgeExpiredSlots();
  const now=ads.clock();
  const rows=await orders.find({platform:true,status:'active',endAt:{$gt:now}}).sort({createdAt:-1}).limit(500).toArray();
  return {ok:true,billing:false,count:rows.length,campaigns:rows.map(platformView),serverTime:now};
 };

 ads.publishPlatformCampaign=async(id,body={})=>{
  await ads.admin.requirePermission(id,'payments');
  fail(!await ads.admin.isSuspended(id),'This administrator account is suspended',403,'account_suspended');
  const kind=clean(body.kind,20)||'plot',selected=normalizeSelection(kind,body.slots),title=clean(body.title,70);
  fail(title.length>=2,'Add the campaign or business name');
  const link=normalizeAdLink(body.link),image=normalizeAdImage(body.imageDataUrl),idempotencyKey=clean(body.idempotencyKey,100);
  fail(requestKey(idempotencyKey),'Use a valid publishing request key');
  const fingerprint=JSON.stringify({kind,slots:selected,title,link,imageHash:image.sha256});
  let created=false,row;
  try{
   row=await ads.store.transaction(async session=>{
    const prior=await orders.findOne({residentId:id,operationKey:idempotencyKey},{session});
    if(prior){
     fail(prior.platform===true&&prior.fingerprint===fingerprint,'This publishing request key was already used for another campaign',409,'idempotency_conflict');
     return prior;
    }
    await ads.purgeExpiredSlots({session});
    const txRef='abjl_ad_admin_'+crypto.randomUUID(),started=ads.clock(),expiresAt=new Date(PLATFORM_END_AT);
    try{
     await slotsCollection.insertMany(selected.map(slotId=>({_id:slotId,...slotPosition(slotId),kind,txRef,residentId:id,state:'active',expiresAt})),{session,ordered:true});
    }catch(error){
     if(error.code===11000)throw new GameError('That advertising spot is already occupied. Choose another open area.',409,'ad_space_taken');
     throw error;
    }
    const next={_id:txRef,txRef,residentId:id,operationKey:idempotencyKey,fingerprint,amount:0,mode:'live',status:'active',kind,slots:selected,title,link,imageDataUrl:image.dataUrl,imageHash:image.sha256,encryptedSecret:PLATFORM_SECRET,checkoutUrl:null,transactionId:null,createdAt:started,startAt:started,endAt:PLATFORM_END_AT,platform:true,billing:false,ownerType:'platform'};
    await orders.insertOne(next,{session});
    await ads.admin.record(id,'publish-platform-ad','platform',{txRef,kind,slots:selected,title,link,billing:false},{session});
    created=true;return next;
   });
  }catch(error){
   if(error.code!==11000)throw error;
   row=await orders.findOne({residentId:id,operationKey:idempotencyKey});
   fail(row?.platform===true&&row.fingerprint===fingerprint,'This publishing request key was already used for another campaign',409,'idempotency_conflict');
  }
  log(created?'platform_ad_published':'platform_ad_replayed',{actor:id,reference:row.txRef,slots:row.slots});
  return {ok:true,replayed:!created,campaign:platformView(row)};
 };

 ads.removePlatformCampaign=async(id,body={})=>{
  await ads.admin.requirePermission(id,'payments');
  const txRef=clean(body.txRef,120);fail(txRef,'Choose a platform campaign',400,'invalid_ad');
  let removed;
  await ads.store.transaction(async session=>{
   const row=await orders.findOne({txRef,platform:true},{session});fail(row,'Platform campaign not found',404,'ad_not_found');
   await slotsCollection.deleteMany({txRef},{session});
   const ended=ads.clock();await orders.updateOne({_id:row._id},{$set:{endAt:ended,removedAt:ended,removedBy:id}},{session});
   await ads.admin.record(id,'remove-platform-ad','platform',{txRef,title:row.title,slots:row.slots},{session});removed={...row,endAt:ended};
  });
  log('platform_ad_removed',{actor:id,reference:txRef});return {ok:true,campaign:platformView(removed)};
 };

 ads.__platformAdsInstalled=true;
 return ads;
}

const normalizedOrigin=value=>{try{return new URL(value).origin;}catch{return '';}};
function tokenFor(req){const bearer=/^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(req.headers.authorization||'');if(bearer)return bearer[1];return(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(TOKEN_COOKIE))?.slice(TOKEN_COOKIE.length)||null;}
function json(res,status,body,headers={}){if(res.writableEnded)return;res.writeHead(status,{'content-type':'application/json; charset=utf-8',...SECURITY_HEADERS,...headers});res.end(JSON.stringify(body));}
async function readJSON(req,max=262144){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>max)throw new GameError('Request body is too large',413,'body_too_large');parts.push(part);}try{const body=JSON.parse(Buffer.concat(parts).toString()||'{}');fail(body&&typeof body==='object'&&!Array.isArray(body),'Send a JSON object');return body;}catch(error){if(error instanceof GameError)throw error;throw new GameError('Send valid JSON');}}

export function attachOkrikaHouseAdRuntime(server,{ads,store,publicWebUrl,corsOrigins=[],log=()=>{}}={}){
 if(!server||!ads?.platformCampaigns||!store)throw new Error('Platform ads require the installed advertising runtime');
 const listeners=server.listeners('request');if(!listeners.length)throw new Error('Cannot attach platform ads before the HTTP request handler exists');
 const allowed=new Set([normalizedOrigin(publicWebUrl),...corsOrigins.map(normalizedOrigin)].filter(Boolean));
 const corsHeaders=req=>{const origin=req.headers.origin;return origin&&allowed.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-credentials':'true','vary':'Origin'}:{}};
 server.removeAllListeners('request');
 server.on('request',(req,res)=>{
  let url;try{url=new URL(req.url,'https://api.abujacity.life');}catch{for(const listener of listeners)listener.call(server,req,res);return;}
  if(url.pathname!=='/api/admin/ads/platform'){for(const listener of listeners)listener.call(server,req,res);return;}
  void (async()=>{
   try{
    const origin=req.headers.origin;if(origin)fail(allowed.has(origin),'This origin is not permitted',403,'cross_origin');
    if(req.method==='OPTIONS'){res.writeHead(204,{...corsHeaders(req),'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,authorization','access-control-max-age':'600',...SECURITY_HEADERS});res.end();return;}
    const token=tokenFor(req),id=token?await store.session(token):null;fail(id,'Sign in to your resident account',401,'authentication_required');
    if(req.method==='GET'){json(res,200,await ads.platformCampaigns(id),corsHeaders(req));return;}
    if(req.method==='POST'){
     if(req.headers.cookie&&!req.headers.authorization)fail(origin&&allowed.has(origin),'This action must originate from AbujaLife',403,'cross_origin');
     fail(/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''),'Send JSON for this action',415,'content_type');
     const body=await readJSON(req);const result=body.action==='remove'?await ads.removePlatformCampaign(id,body):await ads.publishPlatformCampaign(id,body);json(res,200,result,corsHeaders(req));return;
    }
    json(res,405,{ok:false,error:'Method not allowed'},corsHeaders(req));
   }catch(error){const status=Number(error.status)||500;log('platform_ads_http_error',{status,code:error.code||'server_error'});json(res,status,{ok:false,error:status>=500?'Something went wrong. Please try again.':error.message,code:error.code||'platform_ads_error'},corsHeaders(req));}
  })();
 });
 return {close(){},configured:true};
}

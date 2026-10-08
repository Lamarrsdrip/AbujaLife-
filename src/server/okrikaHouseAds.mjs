import {OKRIKA_HOUSE_CAMPAIGNS,okrikaHouseCampaignById,isSafeHouseSlot} from '../shared/okrika-house-ads.mjs';
import {adSpaceFromId} from '../shared/advertising.mjs';

const COLLECTION='ad_house_campaigns';
const TOKEN_COOKIE='abujalife_session=';
const SECURITY_HEADERS=Object.freeze({'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','strict-transport-security':'max-age=31536000','cache-control':'no-store'});
const clean=(value,max=200)=>String(value??'').trim().slice(0,max);
const fail=(condition,message,status=400,code='invalid_request')=>{if(!condition)throw Object.assign(new Error(message),{status,code});};
const boundsHit=(space,bounds)=>space&&bounds&&space.x<bounds.x+bounds.width&&space.x+space.width>bounds.x&&space.y<bounds.y+bounds.height&&space.y+space.height>bounds.y;

function normalizeLink(value){
 const raw=clean(value,500);let url;try{url=new URL(raw);}catch{throw Object.assign(new Error('Use a valid HTTPS campaign link'),{status:400});}
 fail(url.protocol==='https:'&&!url.username&&!url.password,'Use a valid HTTPS campaign link');
 return url.href;
}
function normalizeEmail(value){const email=clean(value,254);fail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Use a valid campaign email');return email;}
function normalizeDomain(value){const domain=clean(value,120).toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'');fail(/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain),'Use a valid campaign domain');return domain;}
function normalizeImage(value){
 if(value===null||value==='')return null;
 const data=String(value||'');fail(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data),'Choose a PNG, JPEG or WebP creative');
 const encoded=data.slice(data.indexOf(',')+1);let bytes;try{bytes=Buffer.from(encoded,'base64');}catch{bytes=null;}
 fail(bytes&&bytes.length>0&&bytes.length<=48*1024,'House-ad creative must be 48 KB or smaller after optimization');
 return data;
}
function publicCampaign(row){
 return {
  campaignId:row.campaignId,id:row.id,campaignType:'house',ownerType:'platform',sponsor:'Okrika',brand:'Okrika',kind:'plot',
  slots:[row.slotId],slotId:row.slotId,title:row.title,eyebrow:row.eyebrow,headline:row.headline,body:row.body,cta:row.cta,
  link:row.link,domain:row.domain,email:row.email,creativeType:'okrika-house',creativeVariant:row.creativeVariant,fit:row.fit||'contain',
  ...(row.imageDataUrl?{imageDataUrl:row.imageDataUrl}:{}),enabled:row.enabled!==false,billing:false,permanent:true,startAt:null,endAt:null,
 };
}
function merged(defaultRow,override){
 if(!override)return {...defaultRow};
 const row={...defaultRow};
 for(const key of ['enabled','title','eyebrow','headline','body','cta','link','domain','email','slotId','imageDataUrl','fit'])if(Object.hasOwn(override,key))row[key]=override[key];
 row.slots=[row.slotId];return row;
}

export async function installOkrikaHouseAds(ads,{database,log=()=>{}}={}){
 if(!ads||ads.__okrikaHouseAdsInstalled)return ads;
 const db=database?.db||ads.db;fail(db?.collection,'House ads require the production database',500,'house_ads_unavailable');
 const collection=db.collection(COLLECTION);
 try{await collection.createIndex({updatedAt:-1});}catch(error){log('house_ads_index_error',{code:error.code||'index_failed'});}
 let cache={at:0,rows:null};
 async function campaigns({fresh=false}={}){
  const now=Date.now();
  if(!fresh&&cache.rows&&now-cache.at<5000)return cache.rows;
  let overrides=[];
  try{overrides=await collection.find({_id:{$in:OKRIKA_HOUSE_CAMPAIGNS.map(c=>c.id)}}).toArray();}
  catch(error){log('house_ads_read_error',{code:error.code||'read_failed'});}
  const byId=new Map(overrides.map(row=>[row._id,row]));
  const rows=OKRIKA_HOUSE_CAMPAIGNS.map(item=>merged(item,byId.get(item.id))).map(publicCampaign);
  cache={at:now,rows};return rows;
 }
 const baseWorld=ads.world.bind(ads),basePublicState=ads.publicState.bind(ads),baseInventory=ads.inventory.bind(ads);

 ads.houseCampaigns=campaigns;
 ads.world=async options=>{
  const result=await baseWorld(options),all=(await campaigns()).filter(c=>c.enabled);
  const paid=result.active||[],paidSlots=new Set(paid.flatMap(c=>c.slots||[]));
  let house=all.filter(c=>!paidSlots.has(c.slotId));
  if(options?.bounds&&['x','y','width','height'].every(k=>Number.isFinite(Number(options.bounds[k])))){
   const b={x:Number(options.bounds.x),y:Number(options.bounds.y),width:Number(options.bounds.width),height:Number(options.bounds.height)};
   house=house.filter(c=>boundsHit(adSpaceFromId(c.slotId),b));
  }
  result.active=[...paid,...house];
  if(Array.isArray(result.spaces)&&result.spaces.length){
   const bySlot=new Map(house.map(c=>[c.slotId,c]));
   result.spaces=result.spaces.map(space=>{
    if(space.available===false||space.ad?.txRef)return space;
    const campaign=bySlot.get(space.id);if(!campaign)return space;
    return {...space,houseAd:true,ad:{campaignId:campaign.campaignId,campaignType:'house',ownerType:'platform',sponsor:'Okrika',title:campaign.title,headline:campaign.headline,body:campaign.body,cta:campaign.cta,link:campaign.link,domain:campaign.domain,email:campaign.email,creativeType:campaign.creativeType,creativeVariant:campaign.creativeVariant,...(campaign.imageDataUrl?{imageDataUrl:campaign.imageDataUrl}:{})}};
   });
  }
  result.houseCampaigns=all.length;
  result.inventory={...(result.inventory||{}),houseCampaigns:all.length};
  return result;
 };
 ads.publicState=async()=>{
  const result=await basePublicState(),all=(await campaigns()).filter(c=>c.enabled),paid=result.active||[],paidSlots=new Set(paid.flatMap(c=>c.slots||[])),house=all.filter(c=>!paidSlots.has(c.slotId));
  return {...result,houseCampaigns:all.length,inventory:{...(result.inventory||{}),houseCampaigns:all.length},active:[...paid,...house]};
 };
 ads.inventory=async id=>{
  const result=await baseInventory(id),house=await campaigns();
  return {...result,houseCampaigns:house.map(c=>({...c,placement:adSpaceFromId(c.slotId)}))};
 };
 ads.houseInventory=async id=>{
  await ads.admin.requirePermission(id,'payments');
  const rows=await campaigns({fresh:true});
  return {ok:true,ownerType:'platform',campaignType:'house',billing:false,count:rows.length,enabled:rows.filter(c=>c.enabled).length,campaigns:rows.map(c=>({...c,placement:adSpaceFromId(c.slotId)}))};
 };
 ads.saveHouseCampaign=async(id,body={})=>{
  await ads.admin.requirePermission(id,'payments');
  const base=okrikaHouseCampaignById(clean(body.id,80));fail(base,'Choose a valid Okrika house campaign',404,'house_campaign_not_found');
  const current=(await campaigns({fresh:true})).find(c=>c.id===base.id),next={...current};
  if(Object.hasOwn(body,'enabled')){fail(typeof body.enabled==='boolean','Choose whether this campaign is enabled');next.enabled=body.enabled;}
  if(Object.hasOwn(body,'title')){next.title=clean(body.title,70);fail(next.title.length>=2,'Add a campaign title');}
  if(Object.hasOwn(body,'eyebrow'))next.eyebrow=clean(body.eyebrow,36);
  if(Object.hasOwn(body,'headline')){next.headline=clean(body.headline,90);fail(next.headline.length>=2,'Add a campaign headline');}
  if(Object.hasOwn(body,'body'))next.body=clean(body.body,140);
  if(Object.hasOwn(body,'cta')){next.cta=clean(body.cta,50);fail(next.cta.length>=2,'Add a campaign call to action');}
  if(Object.hasOwn(body,'link'))next.link=normalizeLink(body.link);
  if(Object.hasOwn(body,'domain'))next.domain=normalizeDomain(body.domain);
  if(Object.hasOwn(body,'email'))next.email=normalizeEmail(body.email);
  if(Object.hasOwn(body,'slotId')){next.slotId=clean(body.slotId,120);fail(isSafeHouseSlot(next.slotId),'Choose an eligible Advertising Land placement');}
  if(Object.hasOwn(body,'imageDataUrl'))next.imageDataUrl=normalizeImage(body.imageDataUrl);
  const others=(await campaigns({fresh:true})).filter(c=>c.id!==next.id&&c.enabled);
  if(next.enabled)fail(!others.some(c=>c.slotId===next.slotId),'Another enabled house campaign already uses this placement',409,'house_slot_conflict');
  const stored={_id:next.id,enabled:next.enabled,title:next.title,eyebrow:next.eyebrow,headline:next.headline,body:next.body,cta:next.cta,link:next.link,domain:next.domain,email:next.email,slotId:next.slotId,imageDataUrl:next.imageDataUrl||null,fit:'contain',updatedAt:Date.now(),updatedBy:id};
  await collection.updateOne({_id:next.id},{$set:stored},{upsert:true});cache={at:0,rows:null};
  await ads.admin.record(id,'update-house-ad',next.id,{enabled:next.enabled,slotId:next.slotId,title:next.title,link:next.link,customCreative:Boolean(next.imageDataUrl)});
  log('house_ad_updated',{campaignId:next.id,actor:id,enabled:next.enabled,slotId:next.slotId});
  return {ok:true,campaign:(await campaigns({fresh:true})).find(c=>c.id===next.id)};
 };
 ads.__okrikaHouseAdsInstalled=true;
 return ads;
}

const normalizedOrigin=value=>{try{return new URL(value).origin;}catch{return '';}};
function tokenFor(req){const bearer=/^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(req.headers.authorization||'');if(bearer)return bearer[1];return(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(TOKEN_COOKIE))?.slice(TOKEN_COOKIE.length)||null;}
function json(res,status,body,headers={}){if(res.writableEnded)return;res.writeHead(status,{'content-type':'application/json; charset=utf-8',...SECURITY_HEADERS,...headers});res.end(JSON.stringify(body));}
async function readJSON(req,max=131072){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>max)throw Object.assign(new Error('Request body is too large'),{status:413});parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{throw Object.assign(new Error('Send valid JSON'),{status:400});}}

export function attachOkrikaHouseAdRuntime(server,{ads,store,publicWebUrl,corsOrigins=[],log=()=>{}}={}){
 if(!server||!ads?.houseInventory||!store)throw new Error('House-ad runtime requires installed ads, store and server');
 const listeners=server.listeners('request');if(!listeners.length)throw new Error('Cannot attach house ads before the HTTP request handler exists');
 const allowed=new Set([normalizedOrigin(publicWebUrl),...corsOrigins.map(normalizedOrigin)].filter(Boolean));
 const corsHeaders=req=>{const origin=req.headers.origin;return origin&&allowed.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-credentials':'true','vary':'Origin'}:{}};
 server.removeAllListeners('request');
 server.on('request',(req,res)=>{
  let url;try{url=new URL(req.url,'https://api.abujacity.life');}catch{for(const listener of listeners)listener.call(server,req,res);return;}
  if(url.pathname!=='/api/admin/ads/house'){for(const listener of listeners)listener.call(server,req,res);return;}
  void (async()=>{
   try{
    const origin=req.headers.origin;if(origin&&!allowed.has(origin))throw Object.assign(new Error('This origin is not permitted'),{status:403});
    if(req.method==='OPTIONS'){res.writeHead(204,{...corsHeaders(req),'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,authorization','access-control-max-age':'600',...SECURITY_HEADERS});res.end();return;}
    const token=tokenFor(req),id=token?await store.session(token):null;fail(id,'Sign in to your resident account',401,'authentication_required');
    if(req.method==='GET'){json(res,200,await ads.houseInventory(id),corsHeaders(req));return;}
    if(req.method==='POST'){
     if(req.headers.cookie&&!req.headers.authorization){fail(origin&&allowed.has(origin),'This action must originate from AbujaLife',403,'cross_origin');}
     fail(/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''),'Send JSON for this action',415,'content_type');
     json(res,200,await ads.saveHouseCampaign(id,await readJSON(req)),corsHeaders(req));return;
    }
    json(res,405,{ok:false,error:'Method not allowed'},corsHeaders(req));
   }catch(error){const status=Number(error.status)||500;log('house_ads_http_error',{status,code:error.code||'server_error'});json(res,status,{ok:false,error:status>=500?'Something went wrong. Please try again.':error.message,code:error.code||'house_ads_error'},corsHeaders(req));}
  })();
 });
 return {close(){},configured:true};
}

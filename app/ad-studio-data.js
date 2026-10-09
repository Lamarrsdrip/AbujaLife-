// Data helpers for the advertising studio. They only decide how inventory is
// fetched, cached and presented; pricing, reservation and payment verification
// stay authoritative on the server.
import {adCampaignId} from './ad-state.js';

export const AD_STUDIO={
  // Presentation page size only. Every placement stays reachable with
  // Previous/More spaces; nothing here caps or removes inventory.
  narrowPageSize:24,widePageSize:48,firstBatch:12,batch:12,
  pageFreshMs:5000,pageKeepMs:120000,maxCachedPages:40,
  configFreshMs:60000,pricingKey:'abujalife.ad-pricing.v1',pricingKeepMs:24*60*60*1000,
};

export function studioPageSize(width=globalThis.innerWidth){
  return Number(width)>=701?AD_STUDIO.widePageSize:AD_STUDIO.narrowPageSize;
}

/** Listing requests never need campaign artwork: zoom 1 omits image payloads. */
export function studioPageUrl(zoneId,page,size){
  return `/api/ads/world?zone=${encodeURIComponent(zoneId)}&page=${Math.max(0,Math.floor(Number(page)||0))}&limit=${size}&zoom=1`;
}

/** Changes only when something a player or the world renderer can see changes. */
export function adStateSignature(state){
  if(!state)return'';
  return JSON.stringify([
    state.pricing?.amount??null,state.pricing?.plotPackSize??null,
    (state.active||[]).map(ad=>[adCampaignId(ad),ad.endAt??null,ad.startAt??null,Array.isArray(ad.slots)?ad.slots.join(','):'',ad.title||'',ad.link||'',(ad.imageDataUrl||'').length]),
    (state.spaces||[]).map(space=>[space.id,space.available===false?0:1,space.ad?.txRef||'',(space.ad?.imageDataUrl||'').length]),
  ]);
}

export function pageSignature(spaces=[]){
  return spaces.map(space=>`${space.id}:${space.eligible===false?'x':space.available?'a':space.ad?'l':'r'}`).join('|');
}

/** Stale-while-revalidate cache for inventory pages, bounded and time-limited. */
export function createPageCache({now=()=>Date.now()}={}){
  const pages=new Map();
  return{
    key:(zoneId,page,size)=>`${zoneId}|${page}|${size}`,
    read(key){
      const hit=pages.get(key);if(!hit)return null;
      const age=now()-hit.at;
      if(age>AD_STUDIO.pageKeepMs){pages.delete(key);return null;}
      return{...hit,fresh:age<=AD_STUDIO.pageFreshMs};
    },
    write(key,value){
      pages.delete(key);pages.set(key,{spaces:value.spaces,nextPage:value.nextPage,signature:pageSignature(value.spaces),at:now()});
      while(pages.size>AD_STUDIO.maxCachedPages)pages.delete(pages.keys().next().value);
    },
    clear(){pages.clear();},
    get size(){return pages.size;},
  };
}

/** Display-only pricing cache. The server still prices and verifies every checkout. */
export function readCachedPricing(storage=globalThis.localStorage,now=Date.now()){
  try{
    const saved=JSON.parse(storage?.getItem(AD_STUDIO.pricingKey)||'null');
    if(!saved||now-Number(saved.at)>AD_STUDIO.pricingKeepMs)return null;
    const amount=Number(saved.pricing?.amount),plotPackSize=Number(saved.pricing?.plotPackSize);
    if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(plotPackSize)||plotPackSize<1)return null;
    return{pricing:saved.pricing,enabled:saved.enabled===true};
  }catch{return null;}
}
export function writeCachedPricing(pricing,enabled,storage=globalThis.localStorage,now=Date.now()){
  try{if(pricing)storage?.setItem(AD_STUDIO.pricingKey,JSON.stringify({pricing,enabled:enabled===true,at:now}));}catch{}
}

/** First batch paints with the sheet; the rest follows one frame at a time. */
export function renderBatches(items,{first=AD_STUDIO.firstBatch,size=AD_STUDIO.batch}={}){
  const batches=[];
  for(let start=0;start<items.length;start+=batches.length?size:first)batches.push(items.slice(start,start+(batches.length?size:first)));
  return batches;
}

export const isAbort=error=>error?.name==='AbortError';

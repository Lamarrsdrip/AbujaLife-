// Paid campaigns expire; platform fill has a separate, permanent identity.
export const adCampaignId=ad=>String(ad?.txRef||ad?.campaignId||ad?.id||'');
export const isHouseAd=ad=>ad?.campaignType==='house';
export function activeAdAt(ad,now){
 return Boolean(ad&&ad.enabled!==false&&(ad.startAt==null||Number(ad.startAt)<=now)&&(ad.endAt==null?isHouseAd(ad):Number(ad.endAt)>now));
}
export function mergeAdCampaigns(prior=[],snapshot={}){
 const now=Number(snapshot.serverTime)||Date.now(),incoming=snapshot.active||[];
 // This small authoritative manifest also invalidates offscreen disabled/moved
 // fill without downloading every creative during each viewport request.
 const placements=Array.isArray(snapshot.housePlacements)?new Map(snapshot.housePlacements.map(p=>[adCampaignId(p),p.slotId])):null;
 const retained=prior.filter(ad=>!isHouseAd(ad)||placements?.get(adCampaignId(ad))===ad.slotId);
 const byId=new Map([...retained,...incoming].filter(ad=>adCampaignId(ad)&&activeAdAt(ad,now)).map(ad=>[adCampaignId(ad),ad]));
 return [...byId.values()].sort((a,b)=>Number(isHouseAd(a))-Number(isHouseAd(b))).slice(0,240);
}
export function mergeAdSnapshot(prior={},snapshot={}){
 prior=prior||{};
 if(Number(snapshot.houseRevision)<Number(prior.houseRevision)){
  // A slower viewport request cannot undo a newer admin change.
  snapshot={...snapshot,houseRevision:prior.houseRevision,housePlacements:prior.housePlacements,active:(snapshot.active||[]).filter(ad=>!isHouseAd(ad))};
 }
 return {...prior,...snapshot,active:mergeAdCampaigns(prior.active,snapshot)};
}

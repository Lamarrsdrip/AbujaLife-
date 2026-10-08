export const adCampaignId=ad=>String(ad?.txRef||ad?.campaignId||ad?.id||'');
export const isHouseAd=ad=>ad?.campaignType==='house';
export function activeAdAt(ad,now){
 return Boolean(ad&&ad.enabled!==false&&(ad.startAt==null||Number(ad.startAt)<=now)&&(ad.endAt==null?ad.permanent===true:Number(ad.endAt)>now));
}
export function mergeAdCampaigns(prior=[],snapshot={}){
 const now=Number(snapshot.serverTime)||Date.now(),incoming=snapshot.active||[];
 // /api/payments/config carries pricing and is the authoritative full campaign
 // snapshot. Viewport streams are intentionally partial and retain off-screen
 // campaigns until the next full refresh or their server end time.
 const source=snapshot.pricing?incoming:[...prior,...incoming];
 const byId=new Map(source.filter(ad=>adCampaignId(ad)&&activeAdAt(ad,now)).map(ad=>[adCampaignId(ad),ad]));
 return [...byId.values()].slice(0,240);
}
export function mergeAdSnapshot(prior={},snapshot={}){
 prior=prior||{};
 return {...prior,...snapshot,active:mergeAdCampaigns(prior.active,snapshot)};
}

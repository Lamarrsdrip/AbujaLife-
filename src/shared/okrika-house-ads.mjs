import {MAP_AD_INVENTORY,adSpaceFromId} from './advertising.mjs';

export const OKRIKA_HOUSE_DOMAIN='okrika.store';
export const OKRIKA_HOUSE_EMAIL='hello@okrika.store';

const SPECS=[
 {slug:'okrika',title:'Okrika',eyebrow:'MARKETPLACE',headline:'BUY. SELL. DISCOVER.',body:'Everything starts with what you need.',cta:'Visit Okrika'},
 {slug:'hunt',title:'Okrika Hunt',eyebrow:'HUNT',headline:'TELL US WHAT YOU WANT',body:'Describe it. Hunt it. Find it.',cta:'Try Okrika Hunt'},
 {slug:'ai',title:'Okrika AI',eyebrow:'OKRIKA AI',headline:'ASK. SEARCH. DISCOVER.',body:'Your marketplace assistant, built into Okrika.',cta:'Meet Okrika AI'},
 {slug:'delivery',title:'Okrika Delivery',eyebrow:'DELIVERY',headline:'MOVE IT WITH OKRIKA',body:'From seller to buyer, with a clearer journey.',cta:'Explore Delivery'},
 {slug:'sell',title:'Sell on Okrika',eyebrow:'SELL',headline:'TURN IT INTO MONEY',body:'That thing you no longer use could be somebody’s next find.',cta:'Start selling'},
 {slug:'buy',title:'Buy on Okrika',eyebrow:'BUY',headline:'FIND YOUR NEXT THING',body:'Discover listings from real people and shops.',cta:'Browse Okrika'},
 {slug:'chat',title:'Okrika Chat',eyebrow:'CONNECT',headline:'CHAT. OFFER. SWAP.',body:'See something you like? Talk directly.',cta:'Open Okrika'},
 {slug:'status',title:'Okrika Status',eyebrow:'STATUS',headline:'SHOW WHAT’S MOVING',body:'Share what you’re selling, buying or discovering.',cta:'See Okrika Status'},
 {slug:'video',title:'Okrika Video Listings',eyebrow:'VIDEO LISTINGS',headline:'SEE MORE THAN A PHOTO',body:'Watch products before you make your move.',cta:'Watch on Okrika'},
 {slug:'swap',title:'Swap on Okrika',eyebrow:'SWAP',headline:'GOT ONE? WANT ANOTHER?',body:'Find listings open to swapping where available.',cta:'Explore swaps'},
 {slug:'search',title:'Okrika Smart Search',eyebrow:'SMART SEARCH',headline:'JUST SAY WHAT YOU NEED',body:'Search naturally instead of fighting filters.',cta:'Search Okrika'},
 {slug:'people',title:'Okrika People',eyebrow:'PEOPLE',headline:'FOLLOW THE GOOD STUFF',body:'Keep up with people, sellers and shops you rate.',cta:'Find people'},
 {slug:'fresh',title:'Fresh on Okrika',eyebrow:'FRESH',headline:'NEW FINDS KEEP LANDING',body:'See what people are listing right now.',cta:'See what’s fresh'},
 {slug:'seller',title:'Okrika Seller',eyebrow:'SELLER',headline:'BUILD YOUR PRESENCE',body:'Sell, chat and grow your profile in one place.',cta:'Sell on Okrika'},
 {slug:'seller-pro',title:'Okrika Seller Pro',eyebrow:'SELLER PRO',headline:'MORE FOR SERIOUS SELLERS',body:'A sharper storefront and advanced seller tools.',cta:'Explore Seller Pro'},
 {slug:'verified-shops',title:'Verified Shops',eyebrow:'VERIFIED SHOPS',headline:'KNOW WHO YOU’RE DEALING WITH',body:'Look for stronger verification on shop profiles.',cta:'Find verified shops'},
 {slug:'ads-studio',title:'Okrika Ads Studio',eyebrow:'ADS STUDIO',headline:'MAKE THE LISTING LOOK READY',body:'Turn Okrika listings into polished promo creative.',cta:'Explore Ads Studio'},
 {slug:'abuja',title:'Okrika for Abuja',eyebrow:'OKRIKA × ABUJA',headline:'ABUJA, FIND IT HERE',body:'Buy, sell and discover around the city.',cta:'Open Okrika'},
 {slug:'next-find',title:'Your next find is on Okrika',eyebrow:'DISCOVER',headline:'YOUR NEXT FIND IS CLOSER',body:'Good finds can come from someone nearby.',cta:'Discover Okrika'},
 {slug:'visit',title:'Visit Okrika',eyebrow:'OKRIKA',headline:'ONE APP. PLENTY TO DO.',body:'Buy. Sell. Hunt. Chat. Discover.',cta:'Visit okrika.store'},
];

function spreadSlots(inventory=MAP_AD_INVENTORY,count=SPECS.length){
 const pool=inventory.filter(p=>p?.eligible!==false&&Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(pool.length<count)throw new Error(`Okrika house ads need ${count} safe advertising parcels`);
 const center=pool.reduce((best,p)=>Math.hypot(p.x+p.width/2,p.y+p.height/2)<best.distance?{p,distance:Math.hypot(p.x+p.width/2,p.y+p.height/2)}:best,{p:pool[0],distance:Infinity}).p;
 const chosen=[center],remaining=new Set(pool.filter(p=>p.id!==center.id).map(p=>p.id));
 while(chosen.length<count){
  let best=null,bestScore=-1;
  for(const p of pool){
   if(!remaining.has(p.id))continue;
   const px=p.x+p.width/2,py=p.y+p.height/2;
   const score=Math.min(...chosen.map(q=>Math.hypot(px-(q.x+q.width/2),py-(q.y+q.height/2))));
   if(score>bestScore||(score===bestScore&&p.id<(best?.id||'\uffff'))){best=p;bestScore=score;}
  }
  chosen.push(best);remaining.delete(best.id);
 }
 return chosen.map(p=>p.id);
}

export const OKRIKA_HOUSE_SLOTS=Object.freeze(spreadSlots());

export const OKRIKA_HOUSE_CAMPAIGNS=Object.freeze(SPECS.map((s,index)=>Object.freeze({
 id:`okrika-${s.slug}`,
 campaignId:`house:okrika:${s.slug}`,
 campaignType:'house',
 ownerType:'platform',
 sponsor:'Okrika',
 brand:'Okrika',
 kind:'plot',
 slotId:OKRIKA_HOUSE_SLOTS[index],
 slots:Object.freeze([OKRIKA_HOUSE_SLOTS[index]]),
 title:s.title,
 eyebrow:s.eyebrow,
 headline:s.headline,
 body:s.body,
 cta:s.cta,
 creativeVariant:index,
 creativeType:'okrika-house',
 fit:'contain',
 domain:OKRIKA_HOUSE_DOMAIN,
 email:OKRIKA_HOUSE_EMAIL,
 link:'https://okrika.store/',
 enabled:true,
 billing:false,
 permanent:true,
})));

export function okrikaHouseCampaignById(id){return OKRIKA_HOUSE_CAMPAIGNS.find(c=>c.id===id)||null;}
export function isSafeHouseSlot(id){const p=adSpaceFromId(id);return Boolean(p&&p.eligible!==false);}

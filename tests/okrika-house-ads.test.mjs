import test from 'node:test';
import assert from 'node:assert/strict';
import {OKRIKA_HOUSE_CAMPAIGNS,OKRIKA_HOUSE_DOMAIN,OKRIKA_HOUSE_EMAIL,isSafeHouseSlot} from '../src/shared/okrika-house-ads.mjs';
import {okrikaHouseCreativeDataUrl} from '../app/okrika-house-creative.js';
import {mapAdPlacements} from '../app/map-ad-displays.js';

test('Okrika house inventory is exactly twenty permanent non-billing campaigns on unique safe parcels',()=>{
 assert.equal(OKRIKA_HOUSE_CAMPAIGNS.length,20);
 assert.equal(new Set(OKRIKA_HOUSE_CAMPAIGNS.map(c=>c.id)).size,20);
 assert.equal(new Set(OKRIKA_HOUSE_CAMPAIGNS.map(c=>c.slotId)).size,20);
 assert.equal(new Set(OKRIKA_HOUSE_CAMPAIGNS.map(c=>c.title)).size,20);
 for(const campaign of OKRIKA_HOUSE_CAMPAIGNS){
  assert.equal(campaign.campaignType,'house');assert.equal(campaign.ownerType,'platform');assert.equal(campaign.sponsor,'Okrika');
  assert.equal(campaign.billing,false);assert.equal(campaign.permanent,true);assert.equal(campaign.domain,OKRIKA_HOUSE_DOMAIN);assert.equal(campaign.email,OKRIKA_HOUSE_EMAIL);
  assert.equal(Object.hasOwn(campaign,'txRef'),false);assert.equal(Object.hasOwn(campaign,'amount'),false);assert.equal(Object.hasOwn(campaign,'transactionId'),false);
  assert.ok(isSafeHouseSlot(campaign.slotId));assert.match(campaign.link,/^https:\/\/okrika\.store\//);
 }
});

test('all twenty built-in creatives are unique, compact SVGs with domain and contact',()=>{
 const sources=OKRIKA_HOUSE_CAMPAIGNS.map(okrikaHouseCreativeDataUrl);assert.equal(new Set(sources).size,20);
 for(const source of sources){assert.match(source,/^data:image\/svg\+xml;charset=utf-8,/);const svg=decodeURIComponent(source.split(',').slice(1).join(','));assert.match(svg,/okrika\.store/);assert.match(svg,/hello@okrika\.store/);assert.ok(source.length<15000);}
});

test('house campaigns do not expire and paid inventory wins a shared slot without duplicate draw',()=>{
 const house=OKRIKA_HOUSE_CAMPAIGNS[0],slot=house.slotId;
 const alone=mapAdPlacements([house],Date.now());assert.equal(alone.length,1);assert.equal(alone[0].campaign.campaignType,'house');
 const paid={txRef:'abjl_ad_test',kind:'plot',slots:[slot],title:'Paid advertiser',imageDataUrl:'data:image/png;base64,fixture',startAt:1,endAt:Date.now()+60000};
 const mixed=mapAdPlacements([paid,house],Date.now());assert.equal(mixed.length,1);assert.equal(mixed[0].campaign.txRef,'abjl_ad_test');
});

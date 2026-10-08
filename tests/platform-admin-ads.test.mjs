import test from 'node:test';
import assert from 'node:assert/strict';
import {installOkrikaHouseAds} from '../src/server/okrikaHouseAds.mjs';
import {MAP_AD_INVENTORY} from '../src/shared/advertising.mjs';

const copy=value=>structuredClone(value);
const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
function matches(row,filter){return Object.entries(filter).every(([key,value])=>value&&typeof value==='object'&&'$gt'in value?row[key]>value.$gt:row[key]===value);}
class Collection{
 constructor(){this.rows=new Map();}
 async findOne(filter){return copy([...this.rows.values()].find(row=>matches(row,filter))||null);}
 find(filter){let rows=[...this.rows.values()].filter(row=>matches(row,filter));const cursor={sort(spec){const [key,dir]=Object.entries(spec)[0];rows.sort((a,b)=>(a[key]-b[key])*dir);return cursor;},limit(n){rows=rows.slice(0,n);return cursor;},async toArray(){return rows.map(copy);}};return cursor;}
 async insertOne(row){if(this.rows.has(row._id))throw Object.assign(new Error('duplicate'),{code:11000});this.rows.set(row._id,copy(row));return{insertedId:row._id};}
 async insertMany(rows){for(const row of rows)if(this.rows.has(row._id))throw Object.assign(new Error('duplicate'),{code:11000});for(const row of rows)this.rows.set(row._id,copy(row));return{insertedCount:rows.length};}
 async updateOne(filter,update){const row=[...this.rows.values()].find(value=>matches(value,filter));if(!row)return{matchedCount:0};Object.assign(row,copy(update.$set||{}));this.rows.set(row._id,row);return{matchedCount:1};}
 async deleteMany(filter){let count=0;for(const [key,row]of [...this.rows])if(matches(row,filter)){this.rows.delete(key);count++;}return{deletedCount:count};}
}
function fixture(){
 const collections=new Map(),audits=[];const db={collection(name){if(!collections.has(name))collections.set(name,new Collection());return collections.get(name);}};
 let now=Date.parse('2026-10-08T18:00:00Z');
 const ads={db,clock:()=>now,store:{transaction:async fn=>fn(undefined)},admin:{requirePermission:async()=>true,isSuspended:async()=>false,record:async(...args)=>audits.push(args)},purgeExpiredSlots:async()=>{}};
 return{ads,db,collections,audits,advance(ms){now+=ms;}};
}

test('admin publishes unlimited no-charge campaigns through ad_orders and ad_slots without provider billing',async()=>{
 const f=fixture();await installOkrikaHouseAds(f.ads,{database:{db:f.db}});
 const [a,b]=MAP_AD_INVENTORY.slice(0,2),base={kind:'plot',title:'Okrika premium banner',link:'https://okrika.store',imageDataUrl:tinyPng};
 const first=await f.ads.publishPlatformCampaign('admin',{...base,slots:[a.id],idempotencyKey:'admin-ad-0001'});
 assert.equal(first.ok,true);assert.equal(first.campaign.billing,false);assert.equal(first.campaign.permanent,true);assert.equal(first.campaign.slots[0],a.id);
 const order=[...f.collections.get('ad_orders').rows.values()][0];assert.equal(order.amount,0);assert.equal(order.status,'active');assert.equal(order.platform,true);assert.equal(order.billing,false);
 assert.equal(f.collections.get('ad_slots').rows.get(a.id).state,'active');
 const replay=await f.ads.publishPlatformCampaign('admin',{...base,slots:[a.id],idempotencyKey:'admin-ad-0001'});assert.equal(replay.replayed,true);assert.equal(f.collections.get('ad_orders').rows.size,1);
 await f.ads.publishPlatformCampaign('admin',{...base,title:'Second banner',slots:[b.id],idempotencyKey:'admin-ad-0002'});assert.equal((await f.ads.platformCampaigns('admin')).count,2);
 await f.ads.removePlatformCampaign('admin',{txRef:first.campaign.txRef});assert.equal(f.collections.get('ad_slots').rows.has(a.id),false);assert.equal((await f.ads.platformCampaigns('admin')).count,1);assert.equal(f.audits.filter(row=>row[1]==='publish-platform-ad').length,2);
});

test('admin publishing keeps road/building safety and occupied-slot protection',async()=>{
 const f=fixture();await installOkrikaHouseAds(f.ads,{database:{db:f.db}});const slot=MAP_AD_INVENTORY[0].id,body={kind:'plot',slots:[slot],title:'Safe banner',link:'https://example.com',imageDataUrl:tinyPng,idempotencyKey:'admin-safe-001'};
 await f.ads.publishPlatformCampaign('admin',body);
 await assert.rejects(f.ads.publishPlatformCampaign('admin',{...body,idempotencyKey:'admin-safe-002'}),error=>error.status===409&&error.code==='ad_space_taken');
 await assert.rejects(f.ads.publishPlatformCampaign('admin',{...body,slots:['ad:city-frontage:999:999'],idempotencyKey:'admin-safe-003'}),error=>error.status===400&&error.code==='invalid_ad_space');
});

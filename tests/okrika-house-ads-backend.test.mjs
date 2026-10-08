import test from 'node:test';
import assert from 'node:assert/strict';
import {installOkrikaHouseAds} from '../src/server/okrikaHouseAds.mjs';
import {OKRIKA_HOUSE_CAMPAIGNS} from '../src/shared/okrika-house-ads.mjs';
import {MAP_AD_INVENTORY,adSpaceFromId} from '../src/shared/advertising.mjs';

const copy=value=>structuredClone(value);
const matches=(row,filter)=>Object.entries(filter).every(([key,value])=>{
 if(value&&typeof value==='object'&&!(value instanceof Date)){
  if('$in' in value)return value.$in.includes(row[key]);
  if('$gt' in value)return row[key]>value.$gt;
 }
 return row[key]===value;
});
class MemoryCollection{
 constructor(){this.rows=new Map();this.reads=0;this.writes=0;this.failReads=false;}
 async findOne(filter){this.reads++;if(this.failReads)throw new Error('database offline');return copy([...this.rows.values()].find(row=>matches(row,filter))||null);}
 find(filter){return {toArray:async()=>{this.reads++;if(this.failReads)throw new Error('database offline');return [...this.rows.values()].filter(row=>matches(row,filter)).map(copy);}};}
 async updateOne(filter,update,{upsert=false}={}){
  // Yield before the atomic operation so competing installs/edits race as they
  // would over the network, while matching and updating remain one operation.
  await Promise.resolve();
  const current=[...this.rows.values()].find(row=>matches(row,filter));
  if(!current&&!upsert)return {matchedCount:0,modifiedCount:0};
  if(!current&&this.rows.has(filter._id))throw Object.assign(new Error('duplicate id'),{code:11000});
  const row=current?copy(current):{_id:filter._id,...copy(update.$setOnInsert||{})};
  Object.assign(row,copy(update.$set||{}));for(const [key,value] of Object.entries(update.$inc||{}))row[key]=(row[key]||0)+value;
  this.rows.set(row._id,row);this.writes++;return {matchedCount:current?1:0,modifiedCount:current?1:0,upsertedCount:current?0:1};
 }
}
function databaseFixture(){
 const collections=new Map(),used=[];
 return {collections,used,db:{collection(name){used.push(name);if(!collections.has(name))collections.set(name,new MemoryCollection());return collections.get(name);}}};
}
async function fixture({database=databaseFixture(),paid=[],spaces=[],canAdmin=true}={}){
 let now=Date.parse('2026-10-08T12:00:00Z');const audits=[];
 const ads={db:database.db,clock:()=>now,admin:{requirePermission:async()=>{if(!canAdmin)throw Object.assign(new Error('No access'),{status:403,code:'forbidden'});},record:async(...args)=>audits.push(args)},world:async()=>({ok:true,active:copy(paid),spaces:copy(spaces)}),publicState:async()=>({active:copy(paid),spaces:copy(spaces),activeCampaigns:paid.length}),inventory:async()=>({summary:{available:197},revenue:{live:{fulfilledNgn:2000}}}),checkout:async body=>{
  database.db.collection('ad_slots').rows.set(body.slotId,{_id:body.slotId,state:'reserved',expiresAt:new Date(now+60000)});return {ok:true};
 }};
 await installOkrikaHouseAds(ads,{database});
 return {ads,database,audits,advance(ms){now+=ms;},now:()=>now};
}
const spareSlot=()=>MAP_AD_INVENTORY.find(row=>!OKRIKA_HOUSE_CAMPAIGNS.some(campaign=>campaign.slotId===row.id)).id;
const conflict=error=>error.status===409&&error.code==='house_slot_conflict';

test('concurrent house placement edits across processes grant a free slot to one campaign only',async()=>{
 const database=databaseFixture(),a=await fixture({database}),b=await fixture({database});await a.ads.houseCampaigns();
 const slotId=spareSlot(),results=await Promise.allSettled([a.ads.saveHouseCampaign('admin',{id:OKRIKA_HOUSE_CAMPAIGNS[0].id,slotId}),b.ads.saveHouseCampaign('admin',{id:OKRIKA_HOUSE_CAMPAIGNS[1].id,slotId})]);
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
 assert.equal(results.filter(row=>row.status==='rejected'&&conflict(row.reason)).length,1);
 const rows=await b.ads.houseCampaigns({fresh:true});assert.equal(rows.filter(row=>row.enabled&&row.slotId===slotId).length,1);
 assert.equal(new Set(rows.filter(row=>row.enabled).map(row=>row.slotId)).size,20);
});

test('concurrent edits to different and shared campaigns preserve both admins changes',async()=>{
 const database=databaseFixture(),a=await fixture({database}),b=await fixture({database});await a.ads.houseCampaigns();
 const id=OKRIKA_HOUSE_CAMPAIGNS[0].id;
 await Promise.all([a.ads.saveHouseCampaign('admin',{id,title:'Fresh Okrika title'}),b.ads.saveHouseCampaign('admin',{id,enabled:false})]);
 let rows=await a.ads.houseCampaigns({fresh:true});assert.equal(rows[0].title,'Fresh Okrika title');assert.equal(rows[0].enabled,false);
 await Promise.all([a.ads.saveHouseCampaign('admin',{id:rows[1].id,title:'Hunt updated'}),b.ads.saveHouseCampaign('admin',{id:rows[2].id,title:'AI updated'})]);
 rows=await b.ads.houseCampaigns({fresh:true});assert.equal(rows[1].title,'Hunt updated');assert.equal(rows[2].title,'AI updated');
});

test('concurrent first reads safely migrate legacy settings without resetting or removing them',async()=>{
 const database=databaseFixture(),legacy={_id:OKRIKA_HOUSE_CAMPAIGNS[0].id,enabled:false,title:'Disabled by owner',slotId:spareSlot()};
 database.db.collection('ad_house_campaigns').rows.set(legacy._id,copy(legacy));
 const a=await fixture({database}),b=await fixture({database});
 const snapshots=await Promise.all([a.ads.houseCampaigns(),b.ads.houseCampaigns()]);
 for(const rows of snapshots){assert.equal(rows.length,20);assert.equal(rows[0].enabled,false);assert.equal(rows[0].title,legacy.title);assert.equal(rows[0].slotId,legacy.slotId);}
 assert.deepEqual(database.db.collection('ad_house_campaigns').rows.get(legacy._id),legacy);
 const documents=[...database.db.collection('ad_house_campaigns').rows.values()];assert.equal(documents.filter(row=>Array.isArray(row.campaigns)).length,1);
});

test('database read failure retains verified disabled settings and rejects stale admin writes',async()=>{
 const f=await fixture(),id=OKRIKA_HOUSE_CAMPAIGNS[0].id;await f.ads.saveHouseCampaign('admin',{id,enabled:false});
 const collection=f.database.db.collection('ad_house_campaigns'),writes=collection.writes;collection.failReads=true;f.advance(6000);
 const rows=await f.ads.houseCampaigns({fresh:true});assert.equal(rows.length,20);assert.equal(rows.find(row=>row.id===id).enabled,false);
 await assert.rejects(f.ads.saveHouseCampaign('admin',{id,enabled:true}),error=>error.status===503&&error.code==='house_ads_unavailable');
 await assert.rejects(f.ads.houseInventory('admin'),error=>error.status===503&&error.code==='house_ads_unavailable');assert.equal(collection.writes,writes);
});

test('a cold database failure never substitutes enabled house defaults',async()=>{
 const f=await fixture();f.database.db.collection('ad_house_campaigns').failReads=true;
 assert.deepEqual(await f.ads.houseCampaigns(),[]);
 const world=await f.ads.world();assert.deepEqual(world.active,[]);assert.deepEqual(world.housePlacements,[]);
});

test('paid reservations suppress house display and global compact placement snapshot immediately',async()=>{
 const f=await fixture(),house=OKRIKA_HOUSE_CAMPAIGNS[0];
 assert.equal((await f.ads.world()).active.filter(row=>row.campaignType==='house').length,20);
 await f.ads.checkout({slotId:house.slotId});
 const world=await f.ads.world();assert.equal(world.active.filter(row=>row.campaignType==='house').length,19);assert.ok(!world.active.some(row=>row.id===house.id));assert.ok(!world.housePlacements.some(row=>row.slotId===house.slotId));
 const publicState=await f.ads.publicState();assert.ok(!publicState.active.some(row=>row.id===house.id));assert.equal(publicState.activeCampaigns,0);
 f.advance(61000);assert.ok((await f.ads.world()).housePlacements.some(row=>row.slotId===house.slotId));
});

test('paid active campaigns and unavailable spaces always take precedence over house fill',async()=>{
 const a=OKRIKA_HOUSE_CAMPAIGNS[0],b=OKRIKA_HOUSE_CAMPAIGNS[1],paid={txRef:'abjl_paid',slots:[a.slotId],title:'Paid customer'};
 const f=await fixture({paid:[paid],spaces:[{id:b.slotId,available:false}]});
 const world=await f.ads.world();assert.deepEqual(world.active[0],paid);assert.ok(!world.active.some(row=>row.id===a.id||row.id===b.id));assert.equal(world.housePlacements.length,18);
});

test('viewport responses send only local house creative while snapshot covers all effective placements',async()=>{
 const f=await fixture(),space=adSpaceFromId(OKRIKA_HOUSE_CAMPAIGNS[0].slotId);
 const world=await f.ads.world({bounds:{x:space.x,y:space.y,width:space.width,height:space.height}});
 assert.equal(world.active.length,1);assert.equal(world.housePlacements.length,20);
 assert.ok(world.housePlacements.every(row=>Object.keys(row).sort().join(',')==='campaignId,id,slotId'));
 const id=OKRIKA_HOUSE_CAMPAIGNS[0].id;await f.ads.saveHouseCampaign('admin',{id,enabled:false});
 assert.ok(!(await f.ads.world()).housePlacements.some(row=>row.id===id));
});

test('house reads are bounded and reservation read failure hides house fill safely',async()=>{
 const f=await fixture();await f.ads.world();const locks=f.database.db.collection('ad_slots'),reads=locks.reads;
 await Promise.all(Array.from({length:12},()=>f.ads.world()));assert.equal(locks.reads,reads);
 f.advance(6000);locks.failReads=true;
 const world=await f.ads.world();assert.equal(world.houseCampaigns,20);assert.deepEqual(world.active,[]);assert.deepEqual(world.housePlacements,[]);
 locks.failReads=false;assert.equal((await f.ads.world()).active.length,20);
});

test('house administration is permission checked and does not write payment or revenue collections',async()=>{
 const f=await fixture();await f.ads.saveHouseCampaign('admin',{id:OKRIKA_HOUSE_CAMPAIGNS[0].id,title:'Premium Okrika'});
 const inventory=await f.ads.inventory('admin');assert.equal(inventory.revenue.live.fulfilledNgn,2000);assert.equal(inventory.houseCampaigns.length,20);assert.equal(f.audits.length,1);
 assert.deepEqual([...new Set(f.database.used)],['ad_house_campaigns']);
 const unauthorized=await fixture({canAdmin:false});await assert.rejects(unauthorized.ads.saveHouseCampaign('resident',{id:OKRIKA_HOUSE_CAMPAIGNS[0].id,enabled:false}),error=>error.status===403);
 assert.equal(unauthorized.database.db.collection('ad_house_campaigns').writes,0);
});

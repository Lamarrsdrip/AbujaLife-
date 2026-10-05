import test from 'node:test';
import assert from 'node:assert/strict';
import { abujaDateKey, createCityStats } from '../src/server/cityStats.mjs';

test('Abuja visit day uses WAT rather than server UTC date',()=>{
  assert.equal(abujaDateKey(Date.parse('2026-10-05T22:30:00Z')),'2026-10-05');
  assert.equal(abujaDateKey(Date.parse('2026-10-05T23:30:00Z')),'2026-10-06');
});

test('city visit counting deduplicates the same resident session inside a 30 minute window',async()=>{
  const now=Date.parse('2026-10-05T13:00:00Z');
  const session={_id:'hash:token-a',residentId:'resident-a'};
  const settings={_id:'city-traffic'};
  const collections={
    sessions:{
      async updateOne(filter,update){
        if(session._id!==filter._id||session.residentId!==filter.residentId||session.cityVisitBucket===filter.cityVisitBucket.$ne)return{modifiedCount:0};
        Object.assign(session,update.$set);return{modifiedCount:1};
      }
    },
    admin_settings:{
      async updateOne(filter,update){
        assert.equal(filter._id,'city-traffic');
        settings.trackingSince??=update.$setOnInsert.trackingSince;
        settings.updatedAt=update.$set.updatedAt;
        for(const [key,value] of Object.entries(update.$inc||{})){
          if(key==='visitsAllTime')settings.visitsAllTime=(settings.visitsAllTime||0)+value;
          else if(key.startsWith('visitDays.')){settings.visitDays??={};const day=key.slice('visitDays.'.length);settings.visitDays[day]=(settings.visitDays[day]||0)+value;}
        }
        return{matchedCount:1};
      },
      async findOne(){return settings;}
    },
    presence_sessions:{aggregate(){return{toArray:async()=>[{count:1}]};}},
    residents:{countDocuments:async()=>1},
  };
  const store={clock:()=>now,auth:{hashToken:token=>`hash:${token}`},collection:name=>collections[name],presence:{zone:async()=> 'district:garki-i'}};
  const stats=createCityStats(store,{globalCacheMs:0,zoneCacheMs:0});
  assert.equal(await stats.recordVisit('token-a','resident-a'),true);
  assert.equal(await stats.recordVisit('token-a','resident-a'),false);
  assert.equal(settings.visitsAllTime,1);
  assert.equal(settings.visitDays['2026-10-05'],1);
});

test('city stats keep online, current-zone, residents and visits as separate truthful metrics',async()=>{
  const now=Date.parse('2026-10-05T13:00:00Z');
  const traffic={visitsAllTime:1534,visitDays:{'2026-10-05':87},trackingSince:Date.parse('2026-10-01T00:00:00Z')};
  let globalQueries=0,zoneQueries=0;
  const collections={
    presence_sessions:{aggregate(pipeline){
      const zone=pipeline[0]?.$match?.zone;
      if(typeof zone==='string'){
        zoneQueries++;
        return{toArray:async()=>[{count:11}]};
      }
      if(zone instanceof RegExp)return{toArray:async()=>[]};
      globalQueries++;
      return{toArray:async()=>[{count:46}]};
    }},
    residents:{countDocuments:async()=>798},
    admin_settings:{findOne:async()=>traffic},
  };
  const store={clock:()=>now,collection:name=>collections[name],presence:{zone:async id=>{assert.equal(id,'resident-a');return'district:wuse-ii-a07';}}};
  const city=createCityStats(store,{globalCacheMs:5000,zoneCacheMs:5000});
  const result=await city.snapshot('resident-a');
  assert.deepEqual(result,{onlineNow:46,totalPlayers:798,visitsToday:87,visitsAllTime:1534,trackingSince:traffic.trackingSince,hereNow:11});
  await city.snapshot('resident-a');
  assert.equal(globalQueries,1,'global counts should be cached');
  assert.equal(zoneQueries,1,'zone counts should be cached');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoPresenceStore } from '../src/server/mongo/presenceStore.mjs';

test('frequent movement does not renew stale profile and privacy data indefinitely',async()=>{
  let now=100000,reads=0,visible=true;
  const sessions=[];
  const game={clock:()=>now,db:{collection:name=>name==='residents'?{async findOne(){reads++;return{id:'resident-a',settings:{presenceVisible:visible}};}}:name==='player_state'?{async findOne(){return{district:'jabi',location:{kind:'public'}};}}:{async updateOne(filter,update){sessions.push(update.$set);},async updateMany(){}}}};
  const social={zone:async()=> 'district:jabi',rate:()=>{}};
  const presence=new MongoPresenceStore(game,social);
  for(let i=0;i<7;i++){await presence.touch('resident-a',{pose:{x:500,y:500,angle:0},connectionId:'heartbeat',zone:'district:jabi'});now+=1000;visible=false;}
  assert.ok(reads>=2,'profile cache must expire despite continuous movement');
  assert.equal(presence.profiles.get('resident-a').value.settings.presenceVisible,false);
});

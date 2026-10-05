import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldPresencePublisher} from '../app/world-presence.js';
function fixture(){
 let now=0,snapshot={key:'one:district:garki',pose:{x:100,y:200,angle:0,moving:false,driving:false}};
 const calls=[];let send=async pose=>{calls.push(pose);};
 const publisher=createWorldPresencePublisher({read:()=>snapshot,clock:()=>now,send:pose=>send(pose)});
 return{publisher,calls,setTime:value=>now=value,setSnapshot:value=>snapshot=value,getSnapshot:()=>snapshot,setSend:value=>send=value};
}
test('stationary players publish immediately and remain visible through idle lease renewal',async()=>{
 const f=fixture();assert.equal(await f.publisher.publish(),true);
 f.setTime(14000);assert.equal(await f.publisher.publish(),false);
 for(const now of [15000,30000,45000,60000]){f.setTime(now);assert.equal(await f.publisher.publish(),true);}
 assert.equal(f.calls.length,5);
});
test('movement, turning, actions and real location transitions publish without waiting for idle timeout',async()=>{
 const f=fixture();await f.publisher.publish();
 for(const changes of [{moving:true,x:110},{moving:false},{angle:1},{activity:'dance'},{activity:undefined,driving:true}]){
  f.setSnapshot({...f.getSnapshot(),pose:{...f.getSnapshot().pose,...changes}});assert.equal(await f.publisher.publish(),true);
 }
 f.setSnapshot({...f.getSnapshot(),key:'one:venue:garki:club'});assert.equal(await f.publisher.publish(),true);
});
test('failed pose writes retry, and overlapping ticks never queue duplicate network work',async()=>{
 const f=fixture();f.setSend(async()=>{throw new Error('Offline');});assert.equal(await f.publisher.publish(),false);
 let release;f.setSend(()=>new Promise(resolve=>{release=resolve;}));
 const pending=f.publisher.publish();assert.equal(await f.publisher.publish(),false);release();assert.equal(await pending,true);
 assert.equal(await f.publisher.publish(),false);
});
test('closed or hidden worlds do not share fabricated poses',async()=>{
 const f=fixture();f.setSnapshot(null);assert.equal(await f.publisher.publish(),false);assert.equal(f.calls.length,0);
});

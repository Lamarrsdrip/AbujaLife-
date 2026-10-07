import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTripWorld} from '../app/world-trip.js';

function fixture(t,mode='car'){
  let clock=0,frame;
  t.mock.method(performance,'now',()=>clock);
  const previous={requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,document:globalThis.document,ResizeObserver:globalThis.ResizeObserver};
  globalThis.requestAnimationFrame=fn=>{frame=fn;return 1;};
  globalThis.cancelAnimationFrame=()=>{};
  globalThis.document={addEventListener(){},removeEventListener(){},hidden:false};
  globalThis.ResizeObserver=undefined;
  const element=()=>({attributes:{},style:{},setAttribute(name,value){this.attributes[name]=value;},addEventListener(){},removeEventListener(){}});
  const nodes=new Map(['.world-scene','[data-world-player]','.world-player-car','.world-route-progress','.world-motion-status'].map(selector=>[selector,element()]));
  const traffic=[],people=[];
  const container={dataset:{},classList:{add(){},remove(){}},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({width:1050,height:650}),querySelector:selector=>nodes.get(selector),querySelectorAll:selector=>selector==='[data-trip-traffic]'?traffic:people,
    set innerHTML(value){this.html=value;for(const _ of value.matchAll(/data-trip-traffic="\d+"/g))traffic.push(element());for(const _ of value.matchAll(/data-trip-pedestrian="\d+"/g))people.push(element());}};
  const cleanup=renderTripWorld(container,{profile:{district:'lugbe',location:{kind:'public'},home:{district:'garki-i'},appearance:{},activeTrip:{id:'rendered-trip',destination:'central-area',venueId:'cbn-experience',mode,seconds:60,arrivesAt:160000}},serverNow:100000});
  t.after(()=>{cleanup();Object.assign(globalThis,previous);});
  return{container,traffic,people,cleanup,tick(time){clock=time;frame(time);}};
}

test('the actual journey renderer draws moving traffic and roadside residents',t=>{
  const f=fixture(t);
  assert.ok(f.traffic.length>=4);
  assert.ok(f.people.length>=2);
  f.tick(1000);
  const first=f.traffic[0].attributes.transform;
  f.tick(2000);
  assert.notEqual(f.traffic[0].attributes.transform,first);
  assert.ok(f.people.every(person=>person.attributes.transform?.startsWith('translate(')));
});

test('the journey camera keeps moving with the vehicle using the animation frame delta',t=>{
  const f=fixture(t),before=f.cleanup.getCameraState();
  for(let time=1000;time<=12000;time+=100)f.tick(time);
  const after=f.cleanup.getCameraState(),motion=f.cleanup.getMotionState();
  assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>120,'camera follows the road rather than stopping behind the car');
  assert.ok(Math.hypot(after.x-motion.x,after.y-motion.y)<250,'resident remains in view');
});

test('a walking journey renders the resident rather than a personal car',t=>{
  const f=fixture(t,'walk');
  assert.match(f.container.html,/resident-figure/);
  assert.match(f.container.html,/WALKING ROUTE/);
  assert.equal(f.cleanup.getMotionState().driving,false);
});

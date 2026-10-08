import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTripWorld} from '../app/world-trip.js';

// The CPU harness deliberately exercises WebGL-unavailable recovery with the
// actual renderer. Real Three.js geometry is tested separately, plus browser QA.
function fixture(t,mode='car'){
 let clock=0,frame,arrivals=0;
 t.mock.method(performance,'now',()=>clock);
 const keys=['requestAnimationFrame','cancelAnimationFrame','document','window','ResizeObserver'],saved=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
 globalThis.requestAnimationFrame=fn=>{frame=fn;return 1;};globalThis.cancelAnimationFrame=()=>{};
 const element=()=>({value:'',dataset:{},style:{},classList:{add(){},remove(){}},addEventListener(){},removeEventListener(){},setAttribute(){},querySelector:()=>element(),querySelectorAll:()=>[],append(){},getBoundingClientRect:()=>({width:1050,height:650})});
 globalThis.document={createElement:()=>element(),createElementNS(){throw new Error('WebGL unavailable in CPU harness');}};globalThis.window=element();
 globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 const nodes=new Map(),container={...element(),querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);}};
 const cleanup=renderTripWorld(container,{profile:{district:'lugbe',location:{kind:'public'},home:{district:'garki-i'},appearance:{},activeTrip:{id:'trip',fromLocation:{kind:'public',district:'lugbe'},destination:'central-area',venueId:'cbn-experience',mode,seconds:60,arrivesAt:160000}},serverNow:100000,onArrive(){arrivals++;}});
 t.after(()=>{cleanup();for(const key of keys)if(saved[key]===undefined)delete globalThis[key];else globalThis[key]=saved[key];});
 return{container,cleanup,get arrivals(){return arrivals;},tick(time){clock=time;frame(time);}};
}

test('actual journey renderer keeps moving its camera along the authoritative road path',t=>{
 const f=fixture(t),before=f.cleanup.getCameraState();for(let time=0;time<=12000;time+=100)f.tick(time);
 const after=f.cleanup.getCameraState(),motion=f.cleanup.getMotionState();
 assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>120);
 assert.equal(Number(f.container.dataset.cameraX),Number(after.x.toFixed(2)));
 assert.equal(Number(f.container.dataset.cameraY),Number(after.y.toFixed(2)));
 assert.ok(Math.hypot(after.x-motion.x,after.y-motion.y)<250);
 assert.ok(motion.routeNodeIds.length>2);assert.ok(motion.routeProgress>.19&&motion.routeProgress<.21);
});

test('a walking journey follows the same city and does not report a driven car',t=>{
 const f=fixture(t,'walk');f.tick(1000);assert.equal(f.cleanup.getMotionState().driving,false);assert.equal(f.cleanup.getMotionState().scene,'transit');
});

test('the renderer requests arrival once even if WebGL fails and frames continue after the deadline',t=>{
 const f=fixture(t);for(let time=0;time<=63000;time+=100)f.tick(time);
 assert.equal(f.arrivals,1);assert.equal(f.cleanup.getMotionState().routeProgress,1);assert.equal(f.cleanup.getMotionState().moving,false);
});

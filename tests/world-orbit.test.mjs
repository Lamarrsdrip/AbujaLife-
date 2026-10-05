import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_CAMERA,WORLD_ZOOM} from '../app/world-camera.js';
import {WORLD_ORBIT,createWorldOrbit} from '../app/world-orbit.js';

test('a held drag follows the pointer immediately without starting an independent animation loop',()=>{
  const orbit=createWorldOrbit(),initial=orbit.getState();assert.equal(initial.yaw,WORLD_CAMERA.yaw);assert.equal(initial.elevation,WORLD_CAMERA.elevation);assert.equal(initial.zoom,1);
  const dragged=orbit.drag(60,10,.02);assert.ok(Math.abs(dragged.yaw-(initial.yaw-60*WORLD_ORBIT.yawPerPixel))<1e-12);assert.ok(Math.abs(dragged.elevation-(initial.elevation+10*WORLD_ORBIT.elevationPerPixel))<1e-12);assert.equal(dragged.dragging,true);assert.equal(dragged.changed,true);
  const frame=orbit.tick(1/60);assert.equal(frame.yaw,dragged.yaw);assert.equal(frame.elevation,dragged.elevation);assert.equal(frame.changed,true);assert.equal(orbit.tick(1/60).changed,false);
});

test('released momentum decays with time rather than frame count',()=>{
  const run=fps=>{const orbit=createWorldOrbit();orbit.drag(-80,5,.02);orbit.release();for(let i=0;i<fps*1.2;i++)orbit.tick(1/fps);return orbit.getState();};
  const results=[30,60,120].map(run);for(const result of results){assert.ok(Math.abs(result.yaw-results[0].yaw)<1e-10);assert.ok(Math.abs(result.elevation-results[0].elevation)<1e-10);assert.ok(result.yaw>WORLD_CAMERA.yaw+.48,'release continues smoothly in the same direction');}
  const orbit=createWorldOrbit();orbit.drag(-80,0,.02);orbit.release();let prior=orbit.getState().yaw,lastGap=Infinity;
  for(let i=0;i<120;i++){const next=orbit.tick(1/60),gap=next.yaw-prior;assert.ok(gap>=0&&gap<=lastGap+1e-12);lastGap=gap;prior=next.yaw;}
});

test('elevation and pinch remain bounded through extreme input, inertia and invalid values',()=>{
  const orbit=createWorldOrbit();orbit.drag(10000,10000,.000001);orbit.release();for(let i=0;i<120;i++)orbit.tick(1/60);assert.equal(orbit.getState().elevation,WORLD_CAMERA.maxElevation);
  orbit.drag(-10000,-10000,.000001);orbit.release();for(let i=0;i<120;i++)orbit.tick(1/60);assert.equal(orbit.getState().elevation,WORLD_CAMERA.minElevation);
  orbit.pinch(Number.MAX_VALUE,2.5);assert.equal(orbit.getState().targetZoom,WORLD_ZOOM.max);for(let i=0;i<120;i++)orbit.tick(1/60);assert.equal(orbit.getState().zoom,WORLD_ZOOM.max);
  orbit.pinch(Number.MIN_VALUE,1);assert.equal(orbit.getState().targetZoom,WORLD_ZOOM.min);for(let i=0;i<120;i++)orbit.tick(1/60);assert.equal(orbit.getState().zoom,WORLD_ZOOM.min);
  const previous=orbit.getState();orbit.drag(NaN,Infinity);orbit.pinch(-1);orbit.tick(NaN);assert.equal(orbit.getState().yaw,previous.yaw);assert.equal(orbit.getState().elevation,previous.elevation);assert.equal(orbit.getState().zoom,previous.zoom);
});

test('joystick cancellation stops camera momentum without snapping its viewing angle',()=>{
  const orbit=createWorldOrbit();orbit.drag(-100,12,.02);orbit.release();orbit.tick(.04);const before=orbit.getState();orbit.stopMomentum();
  for(let i=0;i<90;i++)orbit.tick(1/60);const after=orbit.getState();assert.equal(after.yaw,before.yaw);assert.equal(after.elevation,before.elevation);assert.equal(after.dragging,false);assert.equal(after.active,false);
});

test('holding a stationary pointer removes fling velocity, and a long paused frame cannot cause a large jump',()=>{
  const held=createWorldOrbit();held.drag(-100,0,.02);for(let i=0;i<120;i++)held.tick(1/60);const before=held.getState().yaw;held.release();held.tick(.1);assert.ok(Math.abs(held.getState().yaw-before)<.00001);
  const paused=createWorldOrbit();paused.drag(-100,0,.02);paused.release();const initial=paused.getState().yaw;paused.tick(120);assert.ok(Math.abs(paused.getState().yaw-initial)<WORLD_ORBIT.maxYawVelocity*WORLD_ORBIT.maxStep);
});

test('wide view can reset immediately or ease through the shortest yaw arc',()=>{
  const orbit=createWorldOrbit({yaw:WORLD_CAMERA.yaw+Math.PI*2-.1,elevation:1,zoom:2});const initial=orbit.getState();orbit.reset({immediate:false});
  const next=orbit.tick(1/60);assert.ok(next.yaw>initial.yaw&&next.yaw<WORLD_CAMERA.yaw,'reset avoids a full revolution');assert.ok(next.zoom<2&&next.zoom>1);assert.ok(next.elevation<1);
  for(let i=0;i<150;i++)orbit.tick(1/60);const settled=orbit.getState();assert.ok(Math.abs(settled.yaw-WORLD_CAMERA.yaw)<1e-12);assert.equal(settled.elevation,WORLD_CAMERA.elevation);assert.equal(settled.zoom,1);assert.equal(settled.active,false);
  orbit.drag(120,20,.02);orbit.setZoom(2.5,{immediate:true});const reset=orbit.reset();assert.equal(reset.yaw,WORLD_CAMERA.yaw);assert.equal(reset.elevation,WORLD_CAMERA.elevation);assert.equal(reset.zoom,1);assert.equal(reset.active,false);
});

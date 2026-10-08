import test from 'node:test';
import assert from 'node:assert/strict';
import {installPageViewport} from '../app/page-viewport.js';
test('visual viewport resizes coalesce and every listener is disposed',()=>{
 const listeners=new Map(),visualListeners=new Map(),styles=new Map(),frames=new Map();let serial=0;
 const visualViewport={height:844,offsetTop:0,scale:1,addEventListener:(n,f)=>visualListeners.set(n,f),removeEventListener:n=>visualListeners.delete(n)};
 const win={visualViewport,innerHeight:844,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n),requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},cancelAnimationFrame:id=>frames.delete(id)};
 const docListeners=new Map(),doc={defaultView:win,documentElement:{style:{setProperty:(k,v)=>styles.set(k,v)}},addEventListener:(n,f)=>docListeners.set(n,f),removeEventListener:n=>docListeners.delete(n)};
 const dispose=installPageViewport(doc);assert.equal(styles.get('--game-viewport-height'),'844px');
 visualViewport.height=420;visualViewport.offsetTop=24;visualListeners.get('resize')();visualListeners.get('scroll')();assert.equal(frames.size,1);
 frames.values().next().value();frames.clear();assert.equal(styles.get('--game-viewport-height'),'420px');assert.equal(styles.get('--game-viewport-top'),'24px');
 visualViewport.scale=2;visualViewport.height=200;listeners.get('resize')();frames.values().next().value();frames.clear();assert.equal(styles.get('--game-viewport-height'),'420px');
 dispose();assert.equal(listeners.size,0);assert.equal(visualListeners.size,0);assert.equal(docListeners.size,0);
});

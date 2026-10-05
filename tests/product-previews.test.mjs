import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../app/vendor/three.module.js';

// Run the production queue with real Three scene objects and a measured renderer;
// no browser or GPU is required to verify when expensive rendering happens.
const source=readFileSync(new URL('../app/product-3d.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function enhanceProductPreviews','function enhanceProductPreviews');
function fixture({intersection=true,failRender=false,failEncode=false}={}) {
  let now=1000,sequence=0;
  const idle=new Map(),frames=new Map(),timers=new Map(),events=new Map(),documentEvents=new Map();
  const stats={renders:0,models:0,renderers:0,modelDisposals:0,geometryDisposals:0,materialDisposals:0,rendererDisposals:0,shadows:0,renderLists:0,outfits:[]};
  function listen(map,name,fn){const listeners=map.get(name)||[];listeners.push(fn);map.set(name,listeners);}
  const document={hidden:false,documentElement:{},addEventListener:(name,fn)=>listen(documentEvents,name,fn),createElement:()=>({dataset:{},style:{}})};
  let visibility,removals;
  class IntersectionObserver {
    constructor(callback,options){this.callback=callback;this.options=options;this.targets=new Set();visibility=this;}
    observe(node){this.targets.add(node);}
    unobserve(node){this.targets.delete(node);}
    notify(entries){this.callback(entries.map(([target,isIntersecting])=>({target,isIntersecting})));}
  }
  class MutationObserver {constructor(callback){removals=callback;}observe(){}}
  const window={innerHeight:800,innerWidth:1200,IntersectionObserver:intersection?IntersectionObserver:undefined,MutationObserver,
    addEventListener:(name,fn)=>listen(events,name,fn),requestIdleCallback:fn=>{const id=++sequence;idle.set(id,fn);return id;},cancelIdleCallback:id=>idle.delete(id),
    requestAnimationFrame:fn=>{const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
  class WebGLRenderer {
    constructor(){stats.renderers++;this.shadowMap={};this.renderLists={dispose(){stats.renderLists++;}};this.domElement={toDataURL(){if(failEncode)throw Error('encode failed');return `data:image/png;render=${stats.renders}`;}};}
    setSize(){}setPixelRatio(){}setClearColor(){}
    render(scene){stats.renders++;scene.traverse(node=>{if(node.shadow)node.shadow.map={dispose(){stats.shadows++;}};});if(failRender)throw Error('render failed');}
    dispose(){stats.rendererDisposals++;}
  }
  function model(){
    stats.models++;const group=new THREE.Group(),geometry=new THREE.BoxGeometry(10,20,10),material=new THREE.MeshStandardMaterial();
    geometry.addEventListener('dispose',()=>stats.geometryDisposals++);material.addEventListener('dispose',()=>stats.materialDisposals++);
    group.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
    return {group,dispose(){stats.modelDisposals++;geometry.dispose();material.dispose();}};
  }
  const context=vm.createContext({window,document,THREE:{...THREE,WebGLRenderer},VEHICLE_COLORS:[],vehicleFor:()=>null,HOME_ITEM_MODELS:{},
    buildThreeEnvironment:model,buildInterior:()=>({}),createCharacterModel:appearance=>{stats.outfits.push(appearance);const built=model();built.group.dispose=built.dispose;return built.group;},Date:class extends Date {static now(){return now;}}});
  vm.runInContext(source+'\nglobalThis.enhance=enhanceProductPreviews;',context);
  function node(item='plant',top=20){return {dataset:{productModel:item},isConnected:true,style:{},children:[{style:{}}],querySelector(){return this.children.find(child=>child.dataset?.product3d);},append(child){this.children.push(child);},getBoundingClientRect(){return {top,bottom:top+150,left:0,right:200};}};}
  function flush(){const entry=idle.entries().next().value||frames.entries().next().value;if(!entry)return false;idle.delete(entry[0]);frames.delete(entry[0]);entry[1]({didTimeout:false,timeRemaining:()=>50});return true;}
  function emit(name,event={}){for(const fn of events.get(name)||[])fn(event);}
  function tick(ms){now+=ms;for(const [id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}}
  return {stats,node,document,window,enhance:context.enhance,scope:nodes=>({querySelectorAll:()=>nodes}),flush,tick,emit,
    visibility:()=>visibility,removed:()=>removals([{removedNodes:[{}]}]),hidden(value){document.hidden=value;for(const fn of documentEvents.get('visibilitychange')||[])fn();},jobs:()=>idle.size+frames.size+timers.size};
}

test('offscreen catalogue models are lazy, and all catalogues share one render per idle slot',()=>{
  const f=fixture(),nodes=Array.from({length:100},()=>f.node());f.enhance(f.scope(nodes));
  assert.equal(f.stats.renderers,0);assert.equal(f.jobs(),0);assert.equal(f.visibility().options.rootMargin,'160px 0px');
  f.visibility().notify([[nodes[0],true],[nodes[1],true]]);
  const sofa=f.node('sofa');f.enhance(f.scope([sofa]));f.visibility().notify([[sofa,true]]);
  assert.equal(f.jobs(),1);f.flush();assert.equal(f.stats.renders,1);assert.equal(f.jobs(),1);
  f.flush();assert.equal(f.stats.renders,1,'same-model image reuses the cache');f.flush();assert.equal(f.stats.renders,2);assert.equal(f.stats.renderers,1);assert.equal(f.jobs(),0);
  assert.equal(nodes[99].querySelector(),undefined,'remaining catalogue cards retain their fallback');
});

test('rerenders cancel obsolete work and cached markup is applied synchronously',()=>{
  const f=fixture(),old=f.node('sofa'),nodes=[old],scope=f.scope(nodes);f.enhance(scope);f.visibility().notify([[old,true]]);
  const current=f.node();nodes.splice(0,1,current);f.enhance(scope);assert.equal(f.jobs(),0);assert.equal(f.visibility().targets.has(old),false);
  f.visibility().notify([[current,true]]);f.flush();assert.equal(f.stats.renders,1);
  const cached=f.node();f.enhance(f.scope([cached]));assert.equal(cached.querySelector().src,current.querySelector().src);assert.equal(f.jobs(),0);
  assert.equal(cached.dataset.productRenderer,'webgl-3d');assert.equal(cached.children[0].style.visibility,'hidden');
});

test('nested enhancements deduplicate nodes, and removed or recoloured cards do not render stale models',()=>{
  const f=fixture(),node=f.node();f.enhance(f.scope([node]));f.visibility().notify([[node,true]]);
  f.enhance(f.scope([node]));f.visibility().notify([[node,true]]);assert.equal(f.jobs(),1);
  node.dataset.productColor='blue';f.flush();assert.equal(f.stats.renders,0);assert.equal(f.jobs(),0);
  f.enhance(f.scope([node]));f.visibility().notify([[node,true]]);node.isConnected=false;f.removed();assert.equal(f.jobs(),0);assert.equal(f.visibility().targets.size,0);
});

test('input, pointer drags and hidden tabs pause work and resume after interaction settles',()=>{
  const f=fixture(),node=f.node();f.enhance(f.scope([node]));f.visibility().notify([[node,true]]);
  f.emit('pointerdown',{pointerId:7});assert.equal(f.jobs(),0);f.tick(1000);assert.equal(f.flush(),false);
  f.emit('pointerup',{pointerId:7});assert.equal(f.flush(),false);f.tick(140);assert.equal(f.jobs(),1);
  f.emit('scroll');assert.equal(f.flush(),false);f.tick(140);f.hidden(true);assert.equal(f.jobs(),0);assert.equal(f.stats.renders,0);
  f.hidden(false);f.flush();assert.equal(f.stats.renders,1);
});

for(const failure of ['failRender','failEncode'])test(`${failure} releases owned scene resources, stops GPU retries and preserves fallbacks`,()=>{
  const f=fixture({[failure]:true}),node=f.node(),queued=f.node('sofa');f.enhance(f.scope([node,queued]));f.visibility().notify([[node,true],[queued,true]]);f.flush();
  assert.equal(f.jobs(),0);assert.equal(f.visibility().targets.size,0);
  assert.equal(f.stats.modelDisposals,1);assert.equal(f.stats.geometryDisposals,1);assert.equal(f.stats.materialDisposals,1);assert.equal(f.stats.shadows,1);assert.equal(f.stats.rendererDisposals,1);assert.equal(node.querySelector(),undefined);
  const next=f.node('sofa');f.enhance(f.scope([next]));assert.equal(f.jobs(),0);assert.equal(f.stats.renders,1);
});

test('successful thumbnails release resources immediately, and observer-free fallback stays lazy',()=>{
  const f=fixture({intersection:false}),visible=f.node(),distant=f.node('sofa',1500);f.enhance(f.scope([visible,distant]));f.flush();
  assert.equal(f.stats.renders,1);assert.equal(f.stats.modelDisposals,1);assert.equal(f.stats.geometryDisposals,1);assert.equal(f.stats.materialDisposals,1);assert.equal(f.stats.renderLists,1);assert.equal(f.jobs(),0);assert.equal(distant.querySelector(),undefined);
  distant.getBoundingClientRect=()=>({top:100,bottom:200,left:0,right:200});f.emit('scroll');f.tick(140);f.flush();assert.equal(f.stats.renders,2);
});


test('paint and outfit variations keep separate cached images and queued appearance snapshots',()=>{
  const f=fixture(),paint=f.node();paint.dataset.productColor='red';f.enhance(f.scope([paint]));f.visibility().notify([[paint,true]]);f.flush();
  const red=paint.querySelector().src;paint.dataset.productColor='blue';f.enhance(f.scope([paint]));f.visibility().notify([[paint,true]]);f.flush();assert.notEqual(paint.querySelector().src,red);
  paint.dataset.productColor='red';f.enhance(f.scope([paint]));assert.equal(paint.querySelector().src,red);assert.equal(f.jobs(),0);
  const outfit=f.node('wear:linen-shirt'),appearance={hair:'crop',skinTone:'brown'};f.enhance(f.scope([outfit]),{appearance});appearance.hair='braids';f.visibility().notify([[outfit,true]]);f.flush();
  assert.equal(f.stats.outfits[0].hair,'crop');const first=outfit.querySelector().src;
  f.enhance(f.scope([outfit]),{appearance});f.visibility().notify([[outfit,true]]);f.flush();assert.notEqual(outfit.querySelector().src,first);assert.equal(f.stats.outfits[1].hair,'braids');
  assert.equal(f.stats.modelDisposals,4);assert.equal(f.stats.geometryDisposals,4);
});

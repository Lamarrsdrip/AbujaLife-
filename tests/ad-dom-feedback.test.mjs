import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PLOT_IDS} from '../src/shared/advertising.mjs';
// The client's imports are stripped for this sandbox, so its studio data helpers are supplied explicitly.
import * as studioData from '../app/ad-studio-data.js';

const source=readFileSync(new URL('../app/ads.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
async function fixture({renderer}={}){
  const observers=[],pending=new Set(),stats={mutations:0,bounds:0,callbacks:0};
  function mutation(target){
    stats.mutations++;
    for(const observer of observers)for(const entry of observer.targets){
      if(entry.target===target||(entry.options.subtree&&target.ancestors().includes(entry.target)))pending.add(observer);
    }
  }
  class Element{
    constructor(tag='g',classes=''){this.tagName=tag;this.nodeType=1;this.parent=null;this.children=[];this.dataset={};this.attributes={};this.classes=new Set(classes.split(' ').filter(Boolean));this.isConnected=true;this.classList={add:value=>this.classes.add(value),contains:value=>this.classes.has(value)};}
    ancestors(){const nodes=[];for(let p=this.parent;p;p=p.parent)nodes.push(p);return nodes;}
    matches(selector){
      const classes=[...selector.matchAll(/\.([\w-]+)/g)].map(match=>match[1]);
      if(classes.some(value=>!this.classes.has(value)))return false;
      if(selector.includes('[data-world-target]')&&!this.attributes['data-world-target'])return false;
      if(selector.includes('[data-abj-ads]')&&!('abjAds'in this.dataset))return false;
      return true;
    }
    querySelectorAll(selector){
      if(selector.includes(' .world-scene')){
        const excluded=selector.includes(':not')?['home','interior','transit']:[];
        return this.querySelectorAll('.world-canvas').filter(node=>!excluded.includes(node.dataset.sceneKind)).flatMap(node=>node.querySelectorAll('.world-scene'));
      }
      return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);
    }
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    closest(selector){return[this,...this.ancestors()].find(node=>node.matches(selector))||null;}
    set className(value){this.classes=new Set(value.split(' '));}
    setAttribute(name,value){this.attributes[name]=value;}
    getAttribute(name){return this.attributes[name]||null;}
    getBBox(){stats.bounds++;return{x:10,y:20,width:150,height:100};}
    append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}mutation(this);}
    after(node){const parent=this.parent;node.parent=parent;parent.children.splice(parent.children.indexOf(this)+1,0,node);mutation(parent);}
    remove(){const parent=this.parent;if(!parent)return;parent.children.splice(parent.children.indexOf(this),1);this.parent=null;mutation(parent);}
    set innerHTML(value){this.html=value;mutation(this);}
    set textContent(value){this.text=value;mutation(this);}
    addEventListener(){}
  }
  class MutationObserver{
    constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}
    observe(target,options){this.targets.push({target,options});}
    disconnect(){this.targets=[];pending.delete(this);}
  }
  const app=new Element('main'),sheet=new Element('main'),body=new Element('body');
  function scene(){const canvas=new Element('div','world-canvas');canvas.dataset.sceneKind='public';if(renderer)canvas.dataset.environmentRenderer=renderer;const svg=new Element('svg','world-scene world-public'),art=new Element('g','world-art'),building=new Element('g','city-building');building.setAttribute('data-world-target','garki-home');art.append(building);svg.append(art);canvas.append(svg);return{canvas,svg,art,building};}
  const current=scene();app.append(current.canvas);
  const context=vm.createContext({...studioData,PLOT_IDS,document:{hidden:false,body,querySelector:selector=>selector==='#app'?app:selector==='#sheet-root'?sheet:null,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)},MutationObserver,WeakMap,Intl,URL,URLSearchParams,AbortSignal,location:{search:'',href:'https://abujacity.life/'},history:{},window:{},addEventListener(){},setInterval(){},setTimeout(){},clearTimeout(){},apiFetch:async()=>({ok:true,json:async()=>({enabled:false,ads:{spaces:[]}})})});
  await vm.runInContext(`(async()=>{${source}\nglobalThis.controls={decorateWorld,observeWorldBoundary,renderWorldAds,setState:value=>{adsState=value}};})()`,context);
  function flush(){let count=0;while(pending.size){if(++count>20)throw Error('Decoration observer did not settle');const batch=[...pending];pending.clear();for(const observer of batch){stats.callbacks++;observer.callback([]);}}}
  flush();
  return{app,sheet,stats,current,scene,flush,Element,...context.controls};
}

test('public district decorations settle and repeated gameplay ticks do not rewrite DOM',async()=>{
  const f=await fixture(),{svg,building}=f.current;
  assert.equal(svg.querySelectorAll('.world-ad-layer').length,1);
  assert.equal(building.querySelectorAll('.world-roof-label').length,1);
  const mutations=f.stats.mutations,bounds=f.stats.bounds;
  for(let tick=0;tick<100;tick++){f.decorateWorld();f.flush();}
  assert.equal(f.stats.mutations,mutations);
  assert.equal(f.stats.bounds,bounds,'unchanged buildings need no repeated layout reads');
  const status=new f.Element('text');svg.append(status);f.flush();
  const callbacks=f.stats.callbacks;
  for(let tick=0;tick<100;tick++){status.textContent=`Walking ${tick}`;f.flush();}
  assert.equal(f.stats.callbacks,callbacks,'animation descendants do not wake boundary observers');
});

test('ad state updates once, and travel to a replacement district decorates its new SVG',async()=>{
  const f=await fixture(),first=f.current.svg.querySelector('.world-ad-layer');
  f.setState({spaces:[{kind:'plot',id:'plot-01',available:false,row:0,column:0}]});f.renderWorldAds();f.flush();
  const replacement=f.current.svg.querySelector('.world-ad-layer');
  assert.notEqual(replacement,first);
  assert.equal(replacement.querySelectorAll('.is-taken').length,1);
  f.renderWorldAds();f.flush();assert.equal(f.current.svg.querySelector('.world-ad-layer'),replacement);
  const destination=f.scene();f.current.canvas.remove();f.app.append(destination.canvas);f.flush();
  assert.equal(destination.svg.querySelectorAll('.world-ad-layer').length,1);
  assert.equal(destination.building.querySelectorAll('.world-roof-label').length,1);
});

test('3D roof geometry stays untouched and the independent Life advertising entry remains',async()=>{
  const f=await fixture({renderer:'webgl-3d'});
  assert.equal(f.stats.bounds,0);
  assert.equal(f.current.building.querySelector('.world-roof-label'),null);
  assert.equal(f.current.svg.querySelectorAll('.world-ad-layer').length,1,'interactive billboard overlay is retained');
  const grid=new f.Element('div','life-menu-grid');f.sheet.append(grid);f.flush();
  assert.equal(grid.querySelectorAll('[data-abj-ads]').length,1);
  const mutations=f.stats.mutations;f.flush();assert.equal(f.stats.mutations,mutations);
});

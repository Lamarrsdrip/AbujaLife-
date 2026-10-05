import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app/living-city.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function fixture(){
 const observers=[],pending=new Set(),microtasks=[],events=new Map(),stats={writes:0};
 function changed(node){stats.writes++;for(const observer of observers)for(const entry of observer.entries)if(entry.node===node||(entry.options.subtree&&node.parents().includes(entry.node)))pending.add(observer);}
 class Element{
  constructor(classes=''){this.classes=new Set(classes.split(' '));this.parent=null;this.children=[];this.dataset={};this.attributes={};this.isConnected=true;}
  parents(){const result=[];for(let p=this.parent;p;p=p.parent)result.push(p);return result;}
  set className(value){this.classes=new Set(value.split(' '));}
  matches(selector){if(selector==='[data-world-resident]')return this.attributes['data-world-resident']!==undefined;return selector.startsWith('.')&&this.classes.has(selector.slice(1));}
  querySelectorAll(selector){return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  append(node){node.parent=this;this.children.push(node);changed(this);}
  remove(){if(!this.parent)return;const p=this.parent;p.children.splice(p.children.indexOf(this),1);this.parent=null;changed(p);}
  setAttribute(key,value){this.attributes[key]=value;changed(this);}
  getAttribute(key){return this.attributes[key]??null;}
  set innerHTML(value){this.html=value;changed(this);}
  get innerHTML(){return this.html;}
  set textContent(value){this.text=value;changed(this);}
  get textContent(){return this.text||'';}
 }
 class Observer{
  constructor(callback){this.callback=callback;this.entries=[];observers.push(this);}
  observe(node,options){this.entries.push({node,options});}
  disconnect(){this.entries=[];pending.delete(this);}
 }
 const root=new Element();let current;
 function scene(){const host=new Element('world-canvas world-playable');host.dataset.sceneKind='public';const online=new Element('world-online');host.append(online);return{host,online};}
 function replace(){current=scene();root.children=[];root.append(current.host);return current;}
 replace();
 const context=vm.createContext({document:{querySelector:selector=>selector==='#app'?root:selector.startsWith('#world-scene')?current.host:null,createElement:()=>new Element()},MutationObserver:Observer,queueMicrotask:callback=>microtasks.push(callback),addEventListener:(event,handler)=>events.set(event,handler),setTimeout(){},clearTimeout(){},Intl,Map,Set,URL,CSS:{escape:String}});
 vm.runInContext(source+'\nglobalThis.sync=syncWorld;',context);
 function flush(){for(let round=0;pending.size||microtasks.length;round++){if(round>20)throw Error('Living-city render loop never settled');const batch=[...pending];pending.clear();for(const observer of batch)observer.callback([]);for(const callback of microtasks.splice(0))callback();}}
 flush();
 return{stats,root,scene,replace,flush,events,sync:context.sync,current:()=>current};
}
const snapshot=(f,onlineNow=2)=>f.events.get('abujalife:living-city')({detail:{type:'snapshot',nearby:[],stats:{onlineNow,hereNow:2,totalPlayers:3500,visitsToday:4}}});
test('live counts settle without a self-triggering observer loop or animation work',()=>{
 const f=fixture();snapshot(f);f.flush();const writes=f.stats.writes;
 for(let i=0;i<100;i++){f.sync();f.flush();}
 assert.equal(f.stats.writes,writes);
 const button=f.current().host.querySelector('.world-live-stats');assert.match(button.innerHTML,/2 online/);assert.doesNotMatch(button.innerHTML,/3500 online/);
 const observerWork=f.stats.writes;f.current().online.children.push({matches:()=>false,querySelectorAll:()=>[]});f.sync();f.flush();assert.equal(f.stats.writes,observerWork);
});
test('changed counts and a replacement street render update once and remain responsive',()=>{
 const f=fixture();snapshot(f);f.flush();snapshot(f,3);f.flush();
 assert.match(f.current().host.querySelector('.world-live-stats').innerHTML,/3 online/);
 f.replace();f.flush();assert.equal(f.current().host.querySelectorAll('.world-live-stats').length,1);
 const writes=f.stats.writes;for(let i=0;i<20;i++){f.sync();f.flush();}assert.equal(f.stats.writes,writes);
});

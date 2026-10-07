import test from 'node:test';
import assert from 'node:assert/strict';
import {createActivityDirector} from '../app/activity-director.js';

function fixture(t,record){
 const previous={document:globalThis.document,add:globalThis.addEventListener,remove:globalThis.removeEventListener};
 const root={children:[],append(node){node.isConnected=true;this.children.push(node);}};
 globalThis.document={createElement(){const buttons={};return{isConnected:false,setAttribute(){},querySelector(key){return buttons[key]||=( {} );},remove(){this.isConnected=false;root.children=root.children.filter(node=>node!==this);}};}};
 globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};
 let time=Date.parse('2026-10-07T20:30:00Z'),isQuiet=true;
 let profile={id:'a',district:'garki-i',location:{kind:'home'},wallet:100000,energy:30,hunger:90,hygiene:90,fun:90,discovery:{}};
 const director=createActivityDirector({read:()=>({profile}),now:()=>time,quiet:()=>isQuiet,record,run:()=>{},host:()=>root,random:()=>0});
 t.after(()=>{director.dispose();globalThis.document=previous.document;globalThis.addEventListener=previous.add;globalThis.removeEventListener=previous.remove;});
 return{director,root,advance(){time+=90001;},changeOwner(){profile={...profile,id:'b'};},interrupt(){isQuiet=false;}};
}
test('suggestions await the cross-tab server claim and rejected claims never appear',async t=>{
 let resolve,calls=0;const f=fixture(t,()=>{calls++;return new Promise(done=>resolve=done);});
 await f.director.check();f.advance();const waiting=f.director.check();await f.director.check();
 assert.equal(calls,1);assert.equal(f.root.children.length,0);
 resolve({suppressed:true});await waiting;assert.equal(f.root.children.length,0);
});
test('a late suggestion cannot appear after account switching or quiet-state interruption',async t=>{
 let resolve;const f=fixture(t,()=>new Promise(done=>resolve=done));
 await f.director.check();f.advance();const waiting=f.director.check();f.changeOwner();await f.director.check();
 resolve({});await waiting;assert.equal(f.root.children.length,0);
 f.advance();const interrupted=f.director.check();f.interrupt();resolve({});await interrupted;assert.equal(f.root.children.length,0);
});
test('a confirmed suggestion mounts once and disposal removes the card and rejects late work',async t=>{
 const f=fixture(t,async()=>({}));await f.director.check();f.advance();await f.director.check();
 assert.equal(f.root.children.length,1);await f.director.check();assert.equal(f.root.children.length,1);
 f.director.dispose();assert.equal(f.root.children.length,0);await f.director.check();assert.equal(f.root.children.length,0);
});

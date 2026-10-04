import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPhone,mergePhoneMessages,phoneMessageReceipt,phoneUnreadAnchor,phoneDMPeer,phoneConversationPreview} from '../app/phone.js';
import {GameStore} from '../src/server/gameStore.mjs';
import {ResidentDirectory} from '../src/server/residentDirectory.mjs';

const decode=s=>String(s || '').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
const classList=()=>{const values=new Set();return{add:(...v)=>v.forEach(x=>values.add(x)),remove:(...v)=>v.forEach(x=>values.delete(x)),contains:v=>values.has(v),toggle(v,on){on?values.add(v):values.delete(v);}};};
// CPU DOM adapter exercises the actual phone's delegated handlers. Layout numbers
// stand in for browser measurements; visual/device checks remain browser QA.
class PhoneRoot {
  constructor(){this.listeners={};this.classList=classList();this.style={setProperty(){},removeProperty(){}};this.nodes=[];this.scroll=null;this.html='';}
  addEventListener(type,fn){this.listeners[type]=fn;}removeEventListener(type){delete this.listeners[type];}
  contains(node){return node?.root===this;}
  set innerHTML(html){
    this.html=html;this.nodes=[];const make=(attrs={},value='')=>({root:this,id:attrs.id,name:attrs.name,type:attrs.type || '',value:decode(value),disabled:attrs.disabled!==undefined,dataset:{},style:{},scrollHeight:44,selectionStart:0,selectionEnd:0,isConnected:true,classList:classList(),focus(){document.activeElement=this;},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},getClientRects:()=>[{}]});
    const attrs=str=>Object.fromEntries([...str.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m=>[m[1],m[2]??'']));
    for(const m of html.matchAll(/<(input|textarea)\b([^>]*)>([\s\S]*?)(?:<\/textarea>)?/g)){const a=attrs(m[2]);let value=a.value || '';if(m[1]==='textarea')value=html.slice(m.index+m[0].indexOf('>')+1).split('</textarea>')[0];this.nodes.push(make(a,value));}
    this.nodes.push({...make({id:'back'}),selector:'.ph-back'});
    if(html.includes('ph-scroll')){const count=[...html.matchAll(/data-message-id=/g)].length;let top=0;this.scroll={root:this,classList:classList(),scrollHeight:180+count*70,clientHeight:210,get scrollTop(){return top;},set scrollTop(v){top=Math.max(0,Math.min(Number(v),this.scrollHeight-this.clientHeight));},scrollTo(x,y){this.scrollTop=y;}};this.scroll.classList.add('ph-thread-scroll');}else this.scroll=null;
    let index=0;for(const m of html.matchAll(/data-message-id="([^"]+)"/g)){const el=make();el.dataset.messageId=decode(m[1]);el.offsetTop=170+index++*70;el.offsetHeight=60;this.nodes.push(el);}
    if(html.includes('id="ph-unread-anchor"')){const before=html.split('id="ph-unread-anchor"')[0],el=make({id:'ph-unread-anchor'});el.offsetTop=170+[...before.matchAll(/data-message-id=/g)].length*70;this.nodes.push(el);}
    if(html.includes('ph-send"'))this.nodes.push({...make(),selector:'.ph-send'});
    if(html.includes('ph-new-messages"'))this.nodes.push({...make(),selector:'.ph-new-messages',remove:()=>{}});
  }
  get innerHTML(){return this.html;}
  querySelector(selector){if(selector==='.ph-scroll' || selector==='.ph-thread-scroll')return this.scroll;if(selector.startsWith('#'))return this.nodes.find(n=>n.id===selector.slice(1)) || null;const attr=selector.match(/^\[data-message-id="([^"]+)"\]$/);if(attr)return this.nodes.find(n=>n.dataset.messageId===attr[1]) || null;const name=selector.match(/^\[name="([^"]+)"\]$/);if(name)return this.nodes.find(n=>n.name===name[1]) || null;return this.nodes.find(n=>n.selector===selector) || null;}
  querySelectorAll(selector){if(selector==='[data-product-model]')return[];if(selector==='[data-message-id]')return this.nodes.filter(n=>n.dataset.messageId);if(selector.includes('input') || selector.includes('textarea'))return this.nodes.filter(n=>n.name);return[];}
}
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function browserStubs(t){const saved={};for(const key of ['document','window','CSS','requestAnimationFrame','FormData','localStorage'])saved[key]=globalThis[key];globalThis.document={activeElement:null,hidden:false,body:{classList:classList()},documentElement:{dataset:{}},addEventListener(){},removeEventListener(){}};globalThis.window={};globalThis.CSS={escape:String};globalThis.requestAnimationFrame=()=>0;globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.FormData=class{constructor(form){this.values=form.values;}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}};return()=>{for(const key of Object.keys(saved)){if(saved[key]===undefined)delete globalThis[key];else globalThis[key]=saved[key];}};}
async function fixture(t){
  const restore=browserStubs(t);const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-phone-inbox-'));let clock=Date.parse('2026-10-05T10:00:00Z');const store=new GameStore({dataDir,clock:()=>clock++,originRandomInt:()=>1}),directory=new ResidentDirectory(store),ids=[];
  for(const [username,displayName] of [['inbox_ada','Ada'],['inbox_bayo','Bayo'],['inbox_chi','Chi']])ids.push((await store.register({username,displayName,password:'test-inbox-password'})).residentId);
  const [a,b,c]=ids,conversation=store.createConversation(a,{residentId:b}).conversation,second=store.createConversation(a,{residentId:c}).conversation;
  let owner=a,snapshot={},lost=false,failTransfer=false,failMessageLoad=false,sendHold=null;const root=new PhoneRoot(),calls=[],notices=[],navigations=[];
  const refresh=async()=>{snapshot={...store.bootstrap(owner),serverTime:store.clock(),walletMeta:{transferEnabled:true}};};await refresh();
  const api=async(url,options={})=>{calls.push({url,body:options.body});const u=new URL(url,'http://game.test'),kind=u.pathname;let result;
    if(kind==='/api/wallet')return{ok:true,profile:store.profile(owner),walletMeta:{transferEnabled:true}};
    if(kind==='/api/wallet/transfer'){if(failTransfer)throw new Error('You need more Naira for this transfer');return store.transfer(owner,options.body);}
    if(kind==='/api/conversations' && options.method==='POST')return store.createConversation(owner,options.body);
    if(kind==='/api/conversations')return{ok:true,conversations:store.conversations(owner),nextCursor:null};
    if(kind==='/api/residents')return directory.residents(owner,{query:u.searchParams.get('q'),cursor:u.searchParams.get('cursor')});
    if(kind==='/api/typing')return{ok:true};
    const match=kind.match(/^\/api\/conversations\/([^/]+)\/(messages|read)$/);if(match){if(match[2]==='read')return store.readConversation(owner,match[1]);if(options.method==='POST'){if(sendHold)await sendHold;result=store.sendMessage(owner,match[1],options.body);if(lost){lost=false;throw new Error('Response interrupted');}return result;}if(failMessageLoad)throw new Error('Messages could not refresh');return directory.messages(owner,match[1],{cursor:u.searchParams.get('cursor')});}
    throw new Error('Unexpected route '+url);
  };
  const phone=createPhone({root,getState:()=>snapshot,api,onUpdate:refresh,onNavigate:(...args)=>navigations.push(args),toast:m=>notices.push(m)});
  t.after(()=>{try{phone.dispose();store.close();fs.rmSync(dataDir,{recursive:true,force:true});}finally{restore();}});
  const click=async(action,data={})=>{const el={root,dataset:{phAction:action,...data},classList:classList(),closest:()=>el};root.listeners.click({target:el});await settle();};
  const input=(name,value)=>{const el=root.querySelector(`[name="${name}"]`);assert.ok(el,'Missing '+name);el.value=value;root.listeners.input({target:el});return el;};
  const submit=async(kind,values)=>{const form={dataset:{phForm:kind},values,closest:()=>form};await root.listeners.submit({target:form,preventDefault(){}});await settle();};
  return{store,directory,a,b,c,conversation,second,root,phone,calls,notices,navigations,click,input,submit,refresh,loseNextSend:()=>{lost=true;},failTransfers:value=>{failTransfer=value;},failMessageLoads:value=>{failMessageLoad=value;},holdSend:promise=>{sendHold=promise;},async switchOwner(id){owner=id;await refresh();phone.render();},get snapshot(){return snapshot;}};
}

test('message merge, unread anchor and receipt labels use actual IDs and server receipts',()=>{
  const a={id:'a',senderId:'them',createdAt:1,text:'hello'},b={id:'b',senderId:'me',createdAt:2,text:'reply'},c={id:'c',senderId:'them',createdAt:3,text:'again'};
  assert.deepEqual(mergePhoneMessages([c,a],[b,{...a,readBy:['me']}]).map(m=>m.id),['a','b','c']);assert.equal(phoneUnreadAnchor([a,b,c],1,'me'),'c');assert.equal(phoneUnreadAnchor([a,b,c],50,'me'),'a');assert.equal(phoneUnreadAnchor([a,b,c],0,'me'),null);
  assert.equal(phoneMessageReceipt(b,'me'),'Sent');assert.equal(phoneMessageReceipt({...b,deliveredTo:['them']},'me'),'Delivered');assert.equal(phoneMessageReceipt({...b,readBy:['them']},'me'),'Read');
  assert.equal(phoneDMPeer({kind:'group',members:[{id:'me'},{id:'them'}]},'me'),null);assert.equal(phoneDMPeer({kind:'dm',members:[{id:'them'},{id:'stranger'}]},'me'),null);assert.equal(phoneDMPeer({kind:'dm',members:[{id:'me'},{id:'them'}]},'me',['them']),null);
});

test('actual inbox shows unread and initial anchor, drafts survive conversation switches and clear on logout',async t=>{
  const f=await fixture(t);f.store.sendMessage(f.b,f.conversation.id,'Meet at the café');await f.refresh();await f.phone.open('messages');assert.match(f.root.innerHTML,/1 unread message/);assert.match(f.root.innerHTML,/Meet at the café/);
  await f.click('thread',{id:f.conversation.id});assert.match(f.root.innerHTML,/id="ph-unread-anchor"/);assert.equal(f.store.conversation(f.a,f.conversation.id).unread,0);f.input('message','A draft for Bayo');
  await f.phone.open('messages',{conversationId:f.second.id});f.input('message','A draft for Chi');await f.phone.open('messages',{conversationId:f.conversation.id});assert.equal(f.root.querySelector('#ph-message').value,'A draft for Bayo');
  await f.click('back');await f.phone.open('messages');assert.match(f.root.innerHTML,/<b>Draft<\/b> A draft for Bayo/);
  await f.switchOwner(f.b);await f.switchOwner(f.a);await f.phone.open('messages',{conversationId:f.conversation.id});assert.equal(f.root.querySelector('#ph-message').value,'');
});

test('lost acknowledgement preserves text and key, retry returns one authoritative message',async t=>{
  const f=await fixture(t);await f.phone.open('messages',{conversationId:f.conversation.id});f.input('message','Can we meet tomorrow?');f.loseNextSend();await f.submit('message',{message:'Can we meet tomorrow?'});assert.match(f.root.innerHTML,/Not sent/);assert.match(f.root.innerHTML,/Retry send/);assert.equal(f.root.querySelector('#ph-message').value,'Can we meet tomorrow?');
  const first=f.calls.find(c=>c.body?.text==='Can we meet tomorrow?');assert.ok(first.body.idempotencyKey);await f.click('message-retry',{key:first.body.idempotencyKey});const sends=f.calls.filter(c=>c.body?.text==='Can we meet tomorrow?');assert.equal(sends.length,2);assert.deepEqual(sends[0].body,sends[1].body);assert.equal(f.store.all('SELECT * FROM messages WHERE conversation_id=?',f.conversation.id).length,1);assert.doesNotMatch(f.root.innerHTML,/Not sent|Sending…/);assert.equal(f.root.querySelector('#ph-message').value,'');
});

test('sending across threads retains a newly typed draft and account changes cannot inherit outbox',async t=>{
  const f=await fixture(t);await f.phone.open('messages',{conversationId:f.conversation.id});let release;f.holdSend(new Promise(resolve=>{release=resolve;}));f.input('message','First body');const send=f.submit('message',{message:'First body'});await settle();assert.match(f.root.innerHTML,/Sending…/);f.input('message','Next body');await f.phone.open('messages',{conversationId:f.second.id});f.input('message','Chi draft');release();await send;await f.phone.open('messages',{conversationId:f.conversation.id});assert.equal(f.root.querySelector('#ph-message').value,'Next body');assert.match(f.root.innerHTML,/First body/);assert.doesNotMatch(f.root.innerHTML,/Sending…/);
  await f.switchOwner(f.b);await f.phone.open('messages',{conversationId:f.conversation.id});assert.equal(f.root.querySelector('#ph-message').value,'');
});

test('new messages leave historical scroll in place until the reader chooses latest; older pages keep an anchor',async t=>{
  const f=await fixture(t);for(let i=0;i<65;i++)f.store.sendMessage(f.b,f.conversation.id,`Real message ${i}`);await f.refresh();await f.phone.open('messages',{conversationId:f.conversation.id});assert.match(f.root.innerHTML,/Earlier messages/);f.root.scroll.scrollTop=110;const top=f.root.scroll.scrollTop;
  const incoming=f.store.sendMessage(f.b,f.conversation.id,'A new message').message;f.phone.handleEvent('message',incoming);assert.equal(f.root.scroll.scrollTop,top);assert.match(f.root.innerHTML,/1 new message/);
  await f.click('messages-latest');assert.doesNotMatch(f.root.innerHTML,/ph-new-messages"/);assert.equal(f.store.conversation(f.a,f.conversation.id).unread,0);
  f.root.scroll.scrollTop=100;const old=f.root.scroll.scrollTop,height=f.root.scroll.scrollHeight;await f.click('messages-older');assert.ok(f.root.scroll.scrollHeight>height);assert.equal(f.root.scroll.scrollTop,old+f.root.scroll.scrollHeight-height);assert.match(f.root.innerHTML,/Real message 0/);
});

test('DM money uses verified partner, review and exact request key, then returns an actual receipt to chat',async t=>{
  const f=await fixture(t);await f.phone.open('messages',{conversationId:f.conversation.id});f.input('message','Keep this draft');await f.click('chat-send-money',{id:f.b});assert.match(f.root.innerHTML,/Bayo/);assert.match(f.root.innerHTML,/No transfer fee/);await f.click('chat-money-max');assert.equal(Number(f.root.querySelector('#ph-transferAmount').value),f.store.profile(f.a).wallet);await f.click('chat-money-amount',{amount:'1000'});f.input('transferNote','Lunch');await f.submit('wallet-transfer',{transferAmount:'1000',transferNote:'Lunch'});assert.match(f.root.innerHTML,/Review transfer/);assert.match(f.root.innerHTML,/Confirm &amp; send|Confirm & send/);assert.equal(f.store.profile(f.b).wallet,100000);
  f.failTransfers(true);await f.click('wallet-confirm');assert.match(f.root.innerHTML,/You need more Naira/);const first=f.calls.find(c=>c.url==='/api/wallet/transfer');f.failTransfers(false);await f.click('wallet-confirm');const attempts=f.calls.filter(c=>c.url==='/api/wallet/transfer');assert.equal(attempts.length,2);assert.deepEqual(attempts[0].body,attempts[1].body);assert.equal(first.body.residentId,f.b);assert.equal(first.body.conversationId,f.conversation.id);assert.equal(f.store.profile(f.b).wallet,101000);assert.match(f.root.innerHTML,/YOU SENT NAIRA/);assert.match(f.root.innerHTML,/Lunch/);assert.equal(f.root.querySelector('#ph-message').value,'Keep this draft');assert.equal(f.store.all('SELECT * FROM message_transfers').length,1);
  const receipt=f.store.conversation(f.a,f.conversation.id).lastMessage;assert.match(phoneConversationPreview({lastMessage:receipt},f.a),/You sent ₦1,000/);assert.equal(receipt.transfer.amount,1000);
});

test('blocked and group conversations never offer an ambiguous money recipient',async t=>{
  const f=await fixture(t);f.store.requestFriend(f.a,f.b);const request=f.store.friendRequests(f.b)[0];f.store.respondFriend(f.b,request.id,true);const group=f.store.createConversation(f.a,{kind:'group',name:'Real friends',memberIds:[f.b]}).conversation;await f.refresh();await f.phone.open('messages',{conversationId:group.id});assert.doesNotMatch(f.root.innerHTML,/data-ph-action="chat-send-money"/);assert.doesNotMatch(f.root.innerHTML,/data-ph-action="chat-visit"/);
  f.store.moderate(f.a,'block',f.b,true);await f.refresh();await f.phone.open('messages',{conversationId:f.conversation.id});assert.doesNotMatch(f.root.innerHTML,/data-ph-action="chat-send-money"/);
});


test('actual server delivery/read events update labels and stale or blocked typing never appears',async t=>{
  const f=await fixture(t);f.store.isOnline=id=>id===f.b;await f.phone.open('messages',{conversationId:f.conversation.id});f.input('message','A real receipt');await f.submit('message',{message:'A real receipt'});assert.match(f.root.innerHTML,/ph-message-receipt">Delivered/);
  f.store.emitUser=(id,type,data)=>{if(id===f.a)f.phone.handleEvent(type,data);};f.store.readConversation(f.b,f.conversation.id);assert.match(f.root.innerHTML,/ph-message-receipt">Read/);
  f.phone.handleEvent('typing',{residentId:f.b,displayName:'Bayo',conversationId:f.conversation.id,at:f.snapshot.serverTime-4000});assert.doesNotMatch(f.root.innerHTML,/is typing…/);
  f.phone.handleEvent('typing',{residentId:f.b,displayName:'Bayo',conversationId:f.conversation.id,at:f.snapshot.serverTime});assert.match(f.root.innerHTML,/Bayo is typing…/);
  f.store.moderate(f.a,'block',f.b,true);await f.refresh();f.phone.handleEvent('message',{id:'blocked-content',conversationId:f.conversation.id,senderId:f.b,text:'Never show this',createdAt:f.snapshot.serverTime});assert.doesNotMatch(f.root.innerHTML,/Never show this/);
  f.phone.close();await f.phone.open('messages');assert.equal(f.root.innerHTML.includes(`data-id="${f.conversation.id}"`),false);
});


test('confirmed chat transfer stays visible if refreshing the conversation fails',async t=>{
  const f=await fixture(t);await f.phone.open('messages',{conversationId:f.conversation.id});await f.click('chat-send-money',{id:f.b});f.input('transferAmount','1000');await f.submit('wallet-transfer',{transferAmount:'1000',transferNote:''});f.failMessageLoads(true);await f.click('wallet-confirm');assert.match(f.root.innerHTML,/Messages could not refresh/);assert.match(f.root.innerHTML,/YOU SENT NAIRA/);assert.equal(f.store.profile(f.b).wallet,101000);assert.equal(f.calls.filter(c=>c.url==='/api/wallet/transfer').length,1);
});

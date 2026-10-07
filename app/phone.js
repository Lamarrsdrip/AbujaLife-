import { avatarSVG } from './world.js';
import { vehicleIllustration } from './vehicle-art.js';
import { enhanceProductPreviews } from './product-3d.js';
import { VEHICLE_COLORS } from '../src/shared/vehicles.mjs';
import { systemResaleValue } from '../src/shared/life.mjs';
import { createPhoneBrowser, normalizeCheckoutURL } from './phone-browser.js';
import { createPhoneSocial, createAdvancingServerClock } from './phone-social.js';
import { renderPhoneHome, bindPhoneHome } from './phone-home.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency = value => `${Number(value)<0?'-':''}₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Math.abs(Number(value) || 0))}`;
const dateTime = value => { const d = new Date(value); return Number.isNaN(d.valueOf()) ? '' : d.toLocaleString('en-NG', { timeZone:'Africa/Lagos', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); };
const timeOnly = value => { const d = new Date(value); return Number.isNaN(d.valueOf()) ? '' : d.toLocaleTimeString('en-NG', { timeZone:'Africa/Lagos', hour:'2-digit', minute:'2-digit', hour12:false }); };
const entries = value => Array.isArray(value) ? value : Object.entries(value || {}).map(([id, row]) => ({id,...row}));
const paths = {
  messages:'<path d="M20 11a8 8 0 0 1-8 8H5l-4 3 1.5-6A8 8 0 1 1 20 11Z"/><path d="M7 10h8M7 14h5"/>',
  contacts:'<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="10" r="3"/><path d="M7 18c0-4 10-4 10 0M1 7h4M1 12h4M1 17h4"/>',
  calls:'<path d="m5 3 4 4-2 3c2 3 4 5 7 6l3-2 4 4-2 3C9 23 1 15 2 5Z"/>',
  map:'<path d="m2 5 6-2 8 3 6-2v15l-6 2-8-3-6 2ZM8 3v15M16 6v15"/><circle cx="12" cy="10" r="2"/>',
  ride:'<path d="m4 11 2-6h12l2 6v8H4ZM4 11h16M7 15h2M15 15h2M7 19v2M17 19v2"/>',
  jobs:'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M3 13h18M10 12v3h4v-3"/>',
  wallet:'<path d="M20 7H5a2 2 0 0 1 0-4h13v4M4 7v14h17V7"/><path d="M21 12h-7v5h7M17 14.5h.1"/>',
  earn:'<path d="M12 2v20M17 5.5C15.9 4.6 14.2 4 12 4c-3.3 0-5.5 1.5-5.5 3.7 0 5.6 11 2.1 11 7.8 0 2.4-2.3 4.5-5.8 4.5-2.2 0-4-.7-5.2-1.8"/>',
  property:'<path d="M2 11 12 3l10 8M5 9v12h14V9M9 21v-8h6v8"/>',
  market:'<path d="M4 8h16l1 14H3ZM8 8V5a4 4 0 0 1 8 0v3"/>',
  events:'<rect x="3" y="5" width="18" height="17" rx="3"/><path d="M7 2v6M17 2v6M3 11h18M7 15h2M13 15h2M7 19h2"/>',
  profile:'<rect x="2" y="6" width="20" height="15" rx="3"/><path d="m7 6 2-4h6l2 4"/><circle cx="12" cy="13" r="4"/>',
  friends:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="3"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M16 15a5 5 0 0 1 6 5"/>',
  groups:'<circle cx="12" cy="6" r="3"/><circle cx="4" cy="11" r="2"/><circle cx="20" cy="11" r="2"/><path d="M6 22v-5a6 6 0 0 1 12 0v5M1 21v-4h3M23 21v-4h-3"/>',
  notifications:'<path d="M4 17h16l-2-4V9a6 6 0 1 0-12 0v4ZM9 21h6"/>',
  settings:'<path d="m10 2 4 0 1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1Z"/><circle cx="12" cy="12" r="4"/>',
  arrow:'<path d="m9 5 7 7-7 7"/>', back:'<path d="m15 5-7 7 7 7"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>', plus:'<path d="M12 4v16M4 12h16"/>', send:'<path d="m3 3 19 9-19 9 4-9ZM7 12h15"/>', lock:'<rect x="6" y="10" width="12" height="12" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>', search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>', check:'<path d="m4 12 5 5 11-11"/>', heart:'<path d="M12 21 3 12C-2 6 7 0 12 7c5-7 14-1 9 5Z"/>', signal:'<path d="M3 20v-3M8 20v-7M13 20V9M18 20V4"/>', wifi:'<path d="M2 8a17 17 0 0 1 20 0M5 12a12 12 0 0 1 14 0M9 16a5 5 0 0 1 6 0M12 20h.1"/>', volume:'<path d="m4 9 5 0 5-5v16l-5-5H4ZM18 8a6 6 0 0 1 0 8"/>', globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c-7 7-7 13 0 20 7-7 7-13 0-20"/>', shield:'<path d="m12 2 9 4v7c-1 5-5 8-9 10-4-2-8-5-9-10V6Z"/>', home:'<path d="M2 11 12 3l10 8M5 10v11h14V10M9 21v-7h6v7"/>'
};
const icon = (name, extra='') => `<svg class="ph-icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.globe}</svg>`;
paths.browser=paths.globe;paths.social=paths.heart;paths.xshare=paths.profile;
paths.x='<path d="m4 3 16 18M20 3 4 21M3 3h5l13 18h-5Z"/>';
paths.tiktok='<path d="M14 3v13a4 4 0 1 1-4-4M14 3c1 4 3 5 7 5"/>';
const apps = [
  ['messages','Messages','green'],['contacts','Contacts','sand'],['map','Outside','blue'],
  ['ride','Ride','ink'],['jobs','Jobs','blue'],['wallet','Wallet','ink'],['earn','Earn','green'],['property','Property','amber'],
  ['market','Marketplace','orange'],['events','Events','cream'],['profile','Camera','ink'],['friends','Friends','coral'],
  ['groups','Groups','violet'],['social','City Circle','orange'],['browser','Browser','blue'],['x','X','ink'],
  ['tiktok','TikTok','ink'],['xshare','Xshare','coral'],['notifications','Activity','coral'],['settings','Settings','silver']
];

function portrait(resident, className='') {
  const initials=(resident?.displayName || resident?.username || 'Resident').split(/\s+/).map(n=>n[0]).slice(0,2).join('').toUpperCase();
  return `<span class="ph-avatar ${className}" aria-label="${esc(resident?.displayName || 'Resident')}">${avatarSVG(resident?.appearance || {},{size:60})}<span class="ph-avatar-fallback">${esc(initials)}</span>${resident?.online?'<i class="ph-online"></i>':''}</span>`;
}

// Conversation state stays in memory and is scoped to the signed-in resident.
export function mergePhoneMessages(previous, incoming) {
  return [...new Map([...previous,...incoming].filter(m=>m?.id).map(m=>[m.id,m])).values()].sort((a,b)=>Number(a.createdAt)-Number(b.createdAt) || String(a.id).localeCompare(String(b.id)));
}
export function phoneMessageReceipt(message, ownerId) {
  return (message.readBy || []).some(id=>id!==ownerId)?'Read':(message.deliveredTo || []).some(id=>id!==ownerId)?'Delivered':'Sent';
}
export function phoneUnreadAnchor(messages, unread, ownerId) {
  const incoming=messages.filter(m=>m.senderId!==ownerId),count=Math.max(0,Math.floor(Number(unread) || 0));
  return count?incoming[Math.max(0,incoming.length-count)]?.id || null:null;
}
export function phoneDMPeer(conversation, ownerId, blocked=[]) {
  if(conversation?.kind!=='dm' || conversation.members?.length!==2 || !conversation.members.some(m=>(m.id || m.residentId)===ownerId))return null;
  const peer=conversation.members.find(m=>(m.id || m.residentId)!==ownerId),id=peer?.id || peer?.residentId;
  return id && !blocked.includes(id)?{...peer,id}:null;
}
export function phoneConversationPreview(conversation, ownerId) {
  const m=conversation.lastMessage;
  if(!m)return 'Say hello';
  if(m.deleted || m.kind==='deleted')return 'Message deleted';
  if(m.transfer)return `${m.transfer.fromId===ownerId?'You sent':'Received'} ${currency(m.transfer.amount)}${m.transfer.note?` · ${m.transfer.note}`:''}`;
  const mine=m.senderId===ownerId, prefix=mine?'You: ':'';
  if(m.kind==='image' || m.media?.kind==='image')return `${prefix}Photo${m.text && m.text!=='📷 Photo'?` · ${m.text}`:''}`;
  if(m.kind==='voice' || m.media?.kind==='voice')return `${prefix}Voice note`;
  return typeof m==='string'?m:m.text?`${prefix}${m.text}`:'Say hello';
}
const conversationTime=(timestamp, now)=>{
  if(!timestamp)return '';
  const date=new Date(timestamp);if(Number.isNaN(date.valueOf()))return '';
  const day=d=>new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  return day(date)===day(new Date(now))?timeOnly(timestamp):date.toLocaleDateString('en-NG',{timeZone:'Africa/Lagos',day:'numeric',month:'short'});
};

export function createPhone({ root, getState, api, onUpdate, onNavigate, toast }) {
  let opened=false, locked=true, screen='home', history=[], selected=null, busy=false, search='', thread=null, messages=[], typing=null, incoming=null, priorFocus=null, requestSequence=0, groupMembers=new Set();
  const drafts=new Map(), threadDrafts=new Map(), knownResidents=new Map(), vehicleRequests=new Map(), messageOutbox=new Map(), threadScrolls=new Map(),cachedConversations=new Map();
  let inboxCursor=null,inboxLoading=false,inboxSequence=0,inboxError='';
  let threadLoading=false,threadError='',unreadAnchor=null,newMessageCount=0,chatTransfer=null,inboxFilter='all',readPending=false;
  let accountId=null;
  let homePage=0,homePaging=null;
  let walletData=null, walletLoading=false, walletError='', walletSequence=0, pendingWallet=null, walletReceipt=null;
  let earnData=null, earnBusy=false, earnMessage='', earnActivity=null, earnTimer=null;
  let paymentConfig=null, paymentLoading=false, paymentError='', checkout=null;
  let residentResults=null, residentCursor=null, residentLoading=false, residentSequence=0, residentSearchTimer, messageCursor=null, olderLoading=false;
  const isBrowserPreview=()=>state().preview?.mode==='browser' || document.documentElement.dataset.preview==='browser';
  const walletProfile=()=>walletData?.profile && walletData.sourceWallet===profile().wallet?walletData.profile:profile();
  const walletMeta=()=>walletData?.walletMeta || state().walletMeta || {};
  const eligibleRecipients=()=>[...new Map([...friends(),...people(),...(residentResults || [])].filter(r=>r?.id && r.id!==profile().id && !(state().blocked || []).includes(r.id)).map(r=>[r.id,r])).values()];
  const makeRequestKey=()=>globalThis.crypto?.randomUUID?.() || `phone-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const threadKey=id=>`${profile().id}:${id}`;
  const pendingMessages=id=>[...messageOutbox.values()].filter(m=>m.ownerId===profile().id && m.conversationId===id);
  const chatPeer=()=>phoneDMPeer(thread,profile().id,state().blocked || []);
  const transferRecipient=id=>eligibleRecipients().find(r=>r.id===id) || (chatTransfer?.ownerId===profile().id && chatTransfer.peer.id===id && !(state().blocked || []).includes(id)?chatTransfer.peer:null);
  const vehicleRequestKey=(action,itemId,color)=>{const key=`${action}:${itemId}:${color}`;if(!vehicleRequests.has(key))vehicleRequests.set(key,makeRequestKey());return vehicleRequests.get(key);};
  let travelQuote=null, quoteLoading=false, quoteError='', quoteSequence=0;
  let clockTimer, typingTimer, bannerTimer, typingSentAt=0, backgroundRefreshPromise=null;
  const state=()=>getState() || {};
  const profile=()=>state().profile || {};
  const people=()=>entries(state().people);
  const friends=()=>entries(state().friends).map(r=>r.resident || r.profile || (typeof r==='string'?people().find(p=>p.id===r):r)).filter(Boolean);
  const resident=id=>{const r=people().find(r=>r.id===id) || friends().find(r=>r.id===id) || knownResidents.get(id) || social.findResident(id) || (id===profile().id?profile():null);return (state().blocked || []).includes(id) && r?{...r,online:false,district:null,location:null}:r;};
  const place=id=>entries(state().atlas).find(r=>r.id===id);
  const locationLabel=()=>profile().activeTrip?'On the road':profile().location?.kind==='home'?'At home':profile().location?.kind==='venue'?(entries(state().venues).find(v=>v.id===profile().location.venue)?.name || 'Inside a venue'):profile().drivingVehicle?'Driving your car':'Out in the city';
  const ownsCar=()=>entries(state().catalog).some(i=>i.category==='vehicle'&&(profile().inventory || []).includes(i.id));
  const conversations=()=>[...new Map([...cachedConversations.values(),...entries(state().conversations)].map(c=>[c.id,c])).values()].filter(c=>c.kind!=='dm' || !(c.members || []).some(m=>(state().blocked || []).includes(m.id || m.residentId)));
  const unread=()=>conversations().reduce((n,c)=>n+Number(c.unread || 0),0);
  const pendingInvites=()=>entries(state().invitations).filter(i=>(i.to===profile().id || i.toId===profile().id) && i.status==='pending');
  const requests=()=>entries(state().friendRequests).filter(r=>(r.to===profile().id || r.toId===profile().id) && r.status==='pending');
  const noticeCount=()=>entries(state().notifications).filter(n=>!n.read && !n.readAt).length + pendingInvites().length;
  const appTitle=()=>({home:'',thread:conversationName(thread),person:resident(selected)?.displayName || 'Resident',compose:'New message',newgroup:'New group',invite:'Invite a resident',report:'Report',event:'Event',newevent:'Create event',item:'Okrika Marketplace',homeproperty:'Property',blocked:'Blocked residents',muted:'Muted residents',profile:'Camera & profile',notifications:'Activity',ride:'Ride & transport',market:'Okrika Marketplace',wallet:'Naira wallet',earn:'Earn Game Naira',topup:'Add Naira',transfer:'Send Naira',transferform:'Send Naira',walletreview:'Review',walletreceipt:'Receipt',paymentcheckout:'Hosted checkout',socialcompose:'Share a moment',socialpost:'City Circle conversation',socialstatuses:'24-hour statuses',socialstatus:'Status'}[screen] || apps.find(a=>a[0]===screen)?.[1] || 'Phone');
  const conversationName=c=>c?.kind && c.kind!=='dm'?c.name || 'Group':c?.members?.filter(m=>(m.id || m.residentId)!==profile().id).map(m=>m.displayName || resident(m.id || m.residentId)?.displayName || 'Resident').join(', ') || c?.name || 'Conversation';
  const badge=id=>id==='messages'?unread():id==='notifications'?noticeCount():id==='friends'?requests().length:0;
  const nameById=id=>resident(id)?.displayName || 'Resident';
  const button=(label,action,extra='',kind='')=>`<button type="button" class="ph-button ${kind}" data-ph-action="${action}" ${extra}>${label}</button>`;
  const empty=(name,text,action='',label='')=>`<div class="ph-empty">${icon(name)}<strong>${esc(text)}</strong>${action?button(label,action):''}</div>`;
  const headline=(eyebrow,title,description='')=>`<div class="ph-page-intro"><small>${esc(eyebrow)}</small><h2>${esc(title)}</h2>${description?`<p>${esc(description)}</p>`:''}</div>`;
  const searchField=placeholder=>`<label class="ph-search">${icon('search')}<input id="ph-search" name="search" aria-label="${esc(placeholder)}" placeholder="${esc(placeholder)}" value="${esc(search)}" autocomplete="off"></label>`;
  const match=r=>!search || `${r.displayName || ''} ${r.username || ''} ${r.name || ''} ${r.title || ''}`.toLowerCase().includes(search.toLowerCase());
  const draft=(key,fallback='')=>drafts.get(key) ?? fallback;
  const field=(name,label,value='',type='text',attrs='')=>`<label class="ph-field"><span>${esc(label)}</span><input id="ph-${name}" name="${name}" type="${type}" value="${esc(draft(name,value))}" ${attrs}></label>`;
  const browser=createPhoneBrowser({getAccountId:()=>profile().id,render:()=>render({browserRefresh:true}),toast,esc,icon,button});
  const serverNow=createAdvancingServerClock({getServerTime:()=>state().serverTime});
  const social=createPhoneSocial({getProfile:profile,getNow:serverNow,isPreview:isBrowserPreview,api,navigate,render,toast,esc,icon,button,headline,portrait,dateTime,makeRequestKey});
  const districtOptions=selectedId=>entries(state().atlas).map(p=>`<option value="${esc(p.id)}" ${p.id===selectedId?'selected':''}>${esc(p.name)}${p.kind==='town'?' · FCT town':''}</option>`).join('');
  function captureInputs() {
    browser.capture(root);social.capture(root);
    root.querySelectorAll('input[name],textarea[name],select[name]').forEach(el=>{ if(el.type!=='checkbox' && (el.type!=='radio' || el.checked)) {drafts.set(el.name,el.value);if(el.name==='message' && screen==='thread' && thread?.id)threadDrafts.set(threadKey(thread.id),el.value);} });
  }
  function syncAccount() {
    if((profile().id || null)!==accountId){homePaging?.destroy();homePaging=null;homePage=0;}
    const next=profile().id || null;if(next===accountId)return;accountId=next;locked=true;screen='home';history=[];selected=null;thread=null;messages=[];typing=null;incoming=null;drafts.clear();threadDrafts.clear();messageOutbox.clear();threadScrolls.clear();cachedConversations.clear();inboxCursor=null;inboxLoading=false;inboxSequence++;inboxError='';threadLoading=false;threadError='';unreadAnchor=null;newMessageCount=0;chatTransfer=null;inboxFilter='all';readPending=false;busy=false;earnData=null;earnBusy=false;earnMessage='';earnActivity=null;clearTimeout(earnTimer);clearTimeout(typingTimer);clearTimeout(bannerTimer);knownResidents.clear();vehicleRequests.clear();groupMembers.clear();travelQuote=null;quoteError='';quoteLoading=false;requestSequence++;quoteSequence++;walletSequence++;walletData=null;walletLoading=false;walletError='';pendingWallet=null;walletReceipt=null;paymentConfig=null;paymentLoading=false;paymentError='';checkout=null;residentResults=null;residentCursor=null;residentSequence++;messageCursor=null;browser.reset();social.reset();root.innerHTML='';
  }
  function render({browserRefresh=false}={}) {
    syncAccount();
    serverNow();
    if(typing && (state().blocked || []).includes(typing.residentId || typing.userId || typing.senderId)){typing=null;clearTimeout(typingTimer);}
    if(!profile().id){opened=false;document.body.classList.remove('phone-is-open');}
    for(const r of [...people(),...friends(),...(residentResults || []),...conversations().flatMap(c=>c.members || [])])if(r?.id)knownResidents.set(r.id,r);
    if(!opened) {homePage=homePaging?.getPage() ?? homePage;homePaging?.destroy();homePaging=null;root.innerHTML=''; root.hidden=true;root.classList.remove('phone-chat-open');return; }
    captureInputs();
    // Keep an embedded website alive when resident presence or messages refresh.
    if(!browserRefresh && !locked && screen==='browser' && root.querySelector('.ph-browser'))return;
    const active=root.contains(document.activeElement)?document.activeElement:null;
    homePage=homePaging?.getPage() ?? homePage;homePaging?.destroy();homePaging=null;
    const focusedId=active?.id, start=active?.selectionStart, end=active?.selectionEnd;
    const scroll=root.querySelector('.ph-scroll'), scrollTop=scroll?.scrollTop || 0, atBottom=scroll && scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<64;
    const anchor=screen==='thread' && scroll?[...root.querySelectorAll('[data-message-id]')].find(el=>el.offsetTop+el.offsetHeight>scrollTop):null,anchorOffset=anchor?anchor.offsetTop-scrollTop:null;
    root.hidden=false;
    root.innerHTML=`<div class="ph-backdrop" data-ph-action="dismiss"><section class="ph-device" role="dialog" aria-modal="true" aria-labelledby="ph-device-name"><span class="ph-hardware ph-action-button" aria-hidden="true"></span><button class="ph-hardware ph-volume" data-ph-action="sound" aria-label="${profile().settings?.soundEnabled===false?'Enable':'Mute'} phone sounds"></button><button class="ph-hardware ph-power" data-ph-action="lock" aria-label="Lock phone"></button><div class="ph-screen ${locked?'ph-locked':screen==='home'?'ph-home':'ph-app'}"><div class="ph-wallpaper"><i></i><i></i><i></i><i></i><i></i><span></span></div><div class="ph-statusbar"><span class="ph-clock">${timeOnly(new Date())}</span><span class="ph-status-icons" aria-label="Mobile signal, 5G, battery">${icon('signal')}<span class="ph-network-type">5G</span><span class="ph-battery" aria-hidden="true"></span></span></div><button class="ph-island ${incoming?'ph-island-active':''}" data-ph-action="${incoming?'incoming':'home'}" aria-label="${incoming?'Open incoming activity':'Go to phone home'}">${incoming?`${icon('messages')}<span>${esc(incoming.name || 'New activity')}</span>`:'<i></i>'}</button>${locked?lockScreen():screen==='home'?homeScreen():appScreen()}<button class="ph-home-indicator" data-ph-action="${locked?'unlock':'home'}" aria-label="${locked?'Unlock phone':'Go to phone home'}"></button></div><div class="ph-device-caption"><span id="ph-device-name">AbujaLife Phone</span><button data-ph-action="close" aria-label="Put your phone away">${icon('close')}<span>Close</span></button></div></section></div>`;
    enhanceProductPreviews(root);
    if(!locked && screen==='home')homePaging=bindPhoneHome(root,{page:homePage,onPageChange:page=>{homePage=page;}});
    if(!locked && screen==='browser')browser.afterRender(root);
    const nextScroll=root.querySelector('.ph-scroll');
    root.classList.toggle('phone-chat-open',!locked && screen==='thread');syncChatViewport();
    if(nextScroll){const nextAnchor=anchor && root.querySelector(`[data-message-id="${CSS.escape(anchor.dataset.messageId)}"]`);nextScroll.scrollTop=screen==='thread' && atBottom?nextScroll.scrollHeight:nextAnchor && anchorOffset!==null?nextAnchor.offsetTop-anchorOffset:scrollTop;}
    resizeComposer();
    const restore=focusedId && root.querySelector(`#${CSS.escape(focusedId)}`);
    if(restore) { restore.focus({preventScroll:true}); try {restore.setSelectionRange(start,end);} catch {} }
  }
  function lockScreen() {
    const now=new Date(), notifs=entries(state().notifications).filter(n=>!n.read && !n.readAt).slice(0,2);
    return `<div class="ph-lock-content">${icon('lock','ph-lock-symbol')}<div class="ph-lock-date">${now.toLocaleDateString('en-NG',{timeZone:'Africa/Lagos',weekday:'long',month:'long',day:'numeric'})}</div><div class="ph-lock-time">${timeOnly(now)}</div><div class="ph-lock-location">${esc(place(profile().district)?.name || 'Abuja')}<span>Your life, connected.</span></div><div class="ph-lock-notices">${unread()?`<button class="ph-lock-notice" data-ph-action="app" data-app="messages"><span class="ph-mini-app green">${icon('messages')}</span><span><strong>Messages</strong><small>${unread()} unread message${unread()===1?'':'s'}</small></span>${icon('arrow')}</button>`:''}${notifs.map(n=>`<button class="ph-lock-notice" data-ph-action="app" data-app="notifications"><span class="ph-mini-app coral">${icon('notifications')}</span><span><strong>${esc(n.title || 'AbujaLife')}</strong><small>${esc(n.text || n.body || 'New activity')}</small></span></button>`).join('')}</div><button class="ph-unlock" data-ph-action="unlock">${icon('lock')} Tap to unlock</button><div class="ph-lock-shortcuts"><button data-ph-action="app" data-app="notifications" aria-label="Open activity">${icon('notifications')}</button><button data-ph-action="app" data-app="profile" aria-label="Open camera and profile">${icon('profile')}</button></div></div>`;
  }
  function appIcon(id,label,color) { const b=badge(id);return `<button class="ph-launcher" data-ph-action="app" data-app="${id}"><span class="ph-app-icon ${color}">${icon(id)}${b?`<i class="ph-badge">${b>99?'99+':b}</i>`:''}</span><span class="ph-app-label">${esc(label)}</span></button>`; }
  function homeScreen() {
    return renderPhoneHome({apps,renderApp:appIcon,page:homePage,widgets:`<div class="ph-widget-row"><button class="ph-widget ph-place-widget" data-ph-action="app" data-app="map"><small>${icon('map')} NOW IN</small><strong>${esc(place(profile().district)?.name || 'Abuja')}</strong><span>${esc(locationLabel())}</span></button><button class="ph-widget ph-wallet-widget" data-ph-action="app" data-app="wallet"><small>NAIRA BALANCE</small><strong>${currency(profile().wallet)}</strong><span>Naira (NGN) ${icon('arrow')}</span></button></div><button class="ph-earn-compact" data-ph-action="app" data-app="earn"><span>${icon('earn')}<strong>Earn Game Naira</strong></span><small>Share AbujaLife · +₦100K ${icon('arrow')}</small></button>`,dock:`${appIcon('messages','Messages','green')}${appIcon('contacts','Contacts','sand')}${appIcon('map','Map','blue')}${appIcon('profile','Profile','ink')}`});
  }
  function appScreen() {
    return `<div class="ph-app-content ${['messages','compose','thread'].includes(screen)?'ph-chat-app':''} ${screen==='thread'?'ph-chat-thread':''}"><header class="ph-app-header"><button data-ph-action="back" class="ph-back" aria-label="Back">${icon('back')}<span>${history.length?'Back':'Home'}</span></button><strong>${esc(appTitle())}</strong><button class="ph-header-close" data-ph-action="close" aria-label="Put phone away">${icon('close')}</button></header><div class="ph-scroll ${screen==='thread'?'ph-thread-scroll':screen==='browser'?'ph-browser-scroll':''}">${content()}</div>${screen==='thread'?`${newMessageCount?`<button class="ph-new-messages" data-ph-action="messages-latest">${newMessageCount} new message${newMessageCount===1?'':'s'} ↓</button>`:''}${chatComposer()}`:''}</div>`;
  }
  function content() {
    if(['social','socialcompose','socialpost','socialstatuses','socialstatus','xshare'].includes(screen))return social.markup(screen,selected);
    if(screen==='browser')return browser.markup();
    if(screen==='paymentcheckout')return paymentCheckoutScreen();
    if(screen==='x' || screen==='tiktok')return officialSiteScreen(screen);
    const views={messages:messagesScreen,thread:threadScreen,compose:composeScreen,contacts:contactsScreen,person:personScreen,friends:friendsScreen,groups:groupsScreen,newgroup:newGroupScreen,notifications:notificationsScreen,wallet:walletScreen,earn:earnScreen,topup:topupScreen,transfer:transferScreen,transferform:transferFormScreen,walletreview:walletReviewScreen,walletreceipt:walletReceiptScreen,jobs:jobsScreen,map:mapScreen,ride:rideScreen,property:propertyScreen,homeproperty:propertyDetail,market:marketScreen,item:itemScreen,events:eventsScreen,event:eventScreen,newevent:newEventScreen,profile:profileScreen,settings:settingsScreen,blocked:moderationList,muted:moderationList,invite:inviteScreen,report:reportScreen,calls:callsScreen};
    return (views[screen] || (()=>empty('globe','Choose an app')))();
  }
  function officialSiteScreen(app) {
    const x=app==='x',name=x?'X':'TikTok',url=x?'https://x.com/':'https://www.tiktok.com/';
    return `${headline('OFFICIAL WEBSITE',name,x?'Follow the conversations you care about.':'Discover videos on the official TikTok website.')}<div class="ph-official-site"><span class="ph-official-mark">${x?'𝕏':'♪'}</span><strong>${esc(new URL(url).hostname)}</strong><p>${name} restricts embedded browsing. Continue on its official website in a new tab to browse or sign in.</p><a class="ph-button wide" href="${url}" target="_blank" rel="noopener noreferrer">Open ${name} ↗</a></div>${x?button('Share my Abuja home','app','data-app="xshare"','secondary wide'):''}<p class="ph-quiet-note">Your account stays with ${name}. AbujaLife does not read your login or post for you.</p>`;
  }
  function conversationRow(c) {
    const other=c.members?.find(m=>(m.id || m.residentId)!==profile().id),last=c.lastMessage,body=threadDrafts.get(threadKey(c.id)),count=Math.max(0,Number(c.unread) || 0);
    return `<button class="ph-list-row ph-conversation ${count?'has-unread':''}" data-ph-action="thread" data-id="${esc(c.id)}" aria-label="${esc(conversationName(c))}${count?`, ${count} unread messages`:''}">${c.kind!=='dm'?`<span class="ph-group-avatar">${icon('groups')}</span>`:portrait(other || resident(c.residentId))}<span class="ph-row-copy"><strong>${esc(conversationName(c))}</strong><small class="${body?'ph-draft-preview':''}">${body?`<b>Draft</b> ${esc(body)}`:esc(phoneConversationPreview(c,profile().id))}</small></span><span class="ph-row-end"><time datetime="${last?.createdAt?new Date(last.createdAt).toISOString():''}">${conversationTime(last?.createdAt,serverNow())}</time>${count?`<i class="ph-unread">${count>99?'99+':count}</i>`:''}</span></button>`;
  }
  function messagesScreen() {
    const rows=conversations().filter(c=>(inboxFilter!=='unread' || c.unread>0) && (!search || `${conversationName(c)} ${c.members?.map(m=>m.username || '').join(' ') || ''} ${c.lastMessage?.text || ''}`.toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>(b.lastMessage?.createdAt || 0)-(a.lastMessage?.createdAt || 0));
    return `<div class="ph-inbox-title"><div><small>YOUR CITY, CONNECTED</small><h2>Messages</h2><p>${unread()?`${unread()} unread message${unread()===1?'':'s'}`:'Pick up where you left off'}</p></div><button class="ph-compose-new" data-ph-action="compose" aria-label="New message">${icon('plus')}<span>New</span></button></div>${searchField('Search names or messages')}<div class="ph-inbox-filters" aria-label="Conversation filters">${[['all','All conversations'],['unread','Unread']].map(([id,label])=>`<button data-ph-action="inbox-filter" data-value="${id}" aria-pressed="${inboxFilter===id}">${label}${id==='unread' && unread()?` <span>${unread()}</span>`:''}</button>`).join('')}</div><div class="ph-list ph-inbox-list">${rows.map(conversationRow).join('') || empty('messages',search?'No matching conversations':inboxFilter==='unread'?'You’re all caught up':'Your next conversation starts here','compose','Find a resident')}</div>${inboxLoading?'<p class="ph-quiet-note" role="status">Refreshing conversations…</p>':''}${inboxError?`<p class="ph-chat-error" role="alert">${esc(inboxError)}${button('Try again','inbox-refresh','','subtle')}</p>`:''}${inboxCursor?button(inboxLoading?'Loading…':'More conversations','inbox-more',inboxLoading?'disabled':'','secondary wide'):''}${search?button('Search registered residents','compose-search','','secondary wide'):''}`;
  }
  const residentPager=()=>`${residentLoading?'<p class="ph-quiet-note" role="status">Finding residents…</p>':''}${residentCursor?button('More residents','residents-more',residentLoading?'disabled':'','secondary wide'):''}`;
  function composeScreen() { const rows=(residentResults || people()).filter(r=>r.id!==profile().id && !(state().blocked || []).includes(r.id)).filter(match); return `${headline('NEW CONVERSATION','Find your people','Search a registered resident’s name or username.')} ${searchField('Search residents')}<div class="ph-list">${rows.map(r=>residentRow(r,'dm')).join('') || empty('contacts',residentLoading?'Finding residents…':'No residents found')}</div>${residentPager()}`; }
  function messageMarkup(m,group) {
    const mine=m.senderId===profile().id,transfer=m.transfer;
    const body=transfer?`<div class="ph-transfer-message">${icon('wallet')}<small>${transfer.fromId===profile().id?'YOU SENT NAIRA':'NAIRA RECEIVED'}</small><strong>${currency(transfer.amount)}</strong><span>${transfer.fromId===profile().id?`To ${esc(transfer.recipientName || nameById(transfer.toId))}`:`From ${esc(transfer.senderName || nameById(transfer.fromId))}`}</span>${transfer.note?`<p>${esc(transfer.note)}</p>`:''}<small>Transfer confirmed · No fee</small></div>`:`<div class="ph-bubble">${esc(m.text)}</div>`;
    return `<div class="ph-message ${mine?'mine':''} ${transfer?'ph-money-message':''}" data-message-id="${esc(m.id)}">${group && !mine?`<small class="ph-message-sender">${esc(nameById(m.senderId))}</small>`:''}${body}<span><time datetime="${new Date(m.createdAt).toISOString()}">${timeOnly(m.createdAt)}</time>${mine?` · <span class="ph-message-receipt">${phoneMessageReceipt(m,profile().id)}</span>`:''}</span></div>`;
  }
  function threadScreen() {
    if(!thread)return empty('messages','Opening conversation…');
    const peer=chatPeer(),member=peer || thread.members?.find(m=>(m.id || m.residentId)!==profile().id),other=member && (state().blocked || []).includes(member.id || member.residentId)?{...member,online:false}:member,group=thread.kind!=='dm';
    let priorDay='';const timeline=messages.map(m=>{const day=new Date(m.createdAt).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos',day:'numeric',month:'long',year:'numeric'}),divider=day!==priorDay?`<div class="ph-message-day">${esc(day)}</div>`:'';priorDay=day;return `${divider}${m.id===unreadAnchor?'<div class="ph-unread-divider" id="ph-unread-anchor">New messages</div>':''}${messageMarkup(m,group)}`;}).join('');
    return `<div class="ph-thread-profile"><button class="ph-thread-person" data-ph-action="${group?'noop':'person'}" data-id="${esc(other?.id || '')}">${group?`<span class="ph-group-avatar">${icon('groups')}</span>`:portrait(other)}<span><strong>${esc(conversationName(thread))}</strong><small class="${typing?.state==='recording'?'is-recording':''}">${typing?.state==='recording'?'Recording a voice note…':typing?`${esc(typing.displayName || nameById(typing.residentId || typing.userId))} is typing…`:group?`${thread.memberCount ?? thread.members?.length ?? 0} members`:other?.username?`@${esc(other.username)}${other.online?' · Online now':''}`:'Private conversation'}</small></span></button>${peer?`<div class="ph-chat-shortcuts">${button(`${icon('home')} Invite over`,'chat-invite',`data-id="${esc(peer.id)}"`,'secondary')}${button(`${icon('map')} Visit them`,'chat-visit',`data-id="${esc(peer.id)}"`,'secondary')}${button(`${icon('wallet')} Send Naira`,'chat-send-money',`data-id="${esc(peer.id)}" aria-expanded="${Boolean(chatTransfer?.conversationId===thread.id)}" ${isBrowserPreview() || walletMeta().transferEnabled===false?'disabled':''}`,'ph-money-shortcut')}</div>`:''}</div>${chatMoneyPanel()}${threadLoading?'<p class="ph-quiet-note" role="status">Opening conversation…</p>':''}${threadError?`<div class="ph-chat-error" role="alert">${esc(threadError)}${button('Try again','thread',`data-id="${esc(thread.id)}"`,'subtle')}</div>`:''}${messageCursor?button(olderLoading?'Loading earlier messages…':'Earlier messages','messages-older',olderLoading?'disabled':'','subtle wide'):''}<div class="ph-bubbles">${timeline}${pendingMessages(thread.id).filter(p=>p.status==='failed'||!messages.some(m=>m.senderId===profile().id&&m.text===p.text&&!m.deleted)).map(p=>`<div class="ph-message mine ph-message-pending" data-pending-key="${esc(p.idempotencyKey)}"><div class="ph-bubble">${esc(p.text)}</div><span role="status">${p.status==='sending'?'Sending…':'Not sent'}</span>${p.status==='failed'?`<div class="ph-send-error"><small>${esc(p.error)}</small><button data-ph-action="message-retry" data-key="${esc(p.idempotencyKey)}">Retry send</button></div>`:''}</div>`).join('')}${typing && typing.state!=='recording'?'<div class="ph-typing" aria-label="Someone is typing"><i></i><i></i><i></i></div>':''}</div>${!messages.length && !threadLoading && !threadError?'<p class="ph-chat-start">Say hello. Make plans. Stay in touch.</p>':''}`;
  }
  function chatComposer() {
    const sending=pendingMessages(thread?.id).some(p=>p.status==='sending');
    return `<form class="ph-composer" data-ph-form="message"><label class="ph-sr-only" for="ph-message">Message ${esc(conversationName(thread))}</label><textarea id="ph-message" name="message" rows="1" maxlength="2000" enterkeyhint="send" placeholder="Write a message…" ${threadLoading || threadError?'disabled':''}>${esc(threadDrafts.get(threadKey(thread?.id)) ?? draft('message'))}</textarea><button type="submit" class="ph-send" aria-label="${sending?'Sending message':'Send message'}" ${sending || threadLoading || threadError || !draft('message').trim()?'disabled':''}>${icon('send')}</button></form>`;
  }
  function residentRow(r,action='person') {return `<button class="ph-list-row" data-ph-action="${action}" data-id="${esc(r.id)}">${portrait(r)}<span class="ph-row-copy"><strong>${esc(r.displayName || r.username || 'Resident')}</strong><small>${esc(r.online?'Online now':`@${r.username || 'resident'}`)}</small></span>${icon('arrow')}</button>`;}
  function contactsScreen() {return `${headline('YOUR CITY','Contacts')} ${searchField('Search residents')}<div class="ph-list">${(residentResults || people()).filter(r=>r.id!==profile().id).filter(match).map(r=>residentRow(r)).join('') || empty('contacts',residentLoading?'Finding residents…':'Other residents will appear here when they join')}</div>${residentPager()}`;}
  function friendsScreen() {
    const pending=requests();
    return `${headline('GOOD COMPANY','Friends')} ${pending.length?`<h3 class="ph-section-label">Friend requests · ${pending.length}</h3><div class="ph-list">${pending.map(r=>`<div class="ph-request-row">${portrait(r.resident || resident(r.from))}<span><strong>${esc(r.resident?.displayName || nameById(r.from))}</strong><small>Wants to be your friend</small></span><div>${button('Accept','friend-respond',`data-id="${esc(r.id)}" data-accept="true"`)}${button('Decline','friend-respond',`data-id="${esc(r.id)}" data-accept="false"`,'subtle')}</div></div>`).join('')}</div>`:''}<h3 class="ph-section-label">Your friends · ${friends().length}</h3><div class="ph-list">${friends().map(r=>residentRow(r)).join('') || empty('friends','A city feels better with friends')}</div>${button('Find residents','app','data-app="contacts"','wide')}`;
  }
  function personScreen() {
    const r=resident(selected); if(!r) return empty('contacts','Resident unavailable');
    const friend=friends().some(f=>f.id===r.id), pending=entries(state().friendRequests).some(f=>f.status==='pending' && ((f.to===r.id && f.from===profile().id)||(f.to===profile().id && f.from===r.id)));
    const blocked=(state().blocked || profile().settings?.blockedResidentIds || profile().settings?.blocked || []).includes(r.id), muted=(state().muted || profile().settings?.mutedResidentIds || profile().settings?.muted || []).includes(r.id);
    return `<div class="ph-contact-hero">${portrait(r,'large')}<h2>${esc(r.displayName)}</h2><p>@${esc(r.username)}${r.online?' · Online now':''}</p>${r.district?`<small>${esc(place(r.district)?.name || 'Abuja')}</small>`:''}</div><div class="ph-contact-actions">${button(`${icon('messages')} Message`,'dm',`data-id="${esc(r.id)}"`)}${button(`${icon('events')} Invite`,'invite',`data-id="${esc(r.id)}"`,'secondary')}</div><div class="ph-setting-list">${settingRow(friend?'Remove friend':pending?'Friend request pending':'Add friend','friends',pending?'noop':friend?'friend-remove':'friend-request',`data-id="${esc(r.id)}"`,friend?'Your friendship is connected':'Connect in AbujaLife')}${settingRow(muted?'Unmute resident':'Mute notifications','volume','mute',`data-id="${esc(r.id)}" data-value="${!muted}"`,'Messages remain readable')}${settingRow(blocked?'Unblock resident':'Block resident','shield','block',`data-id="${esc(r.id)}" data-value="${!blocked}"`,'Control who can contact you')}${settingRow('Report resident','shield','report',`data-id="${esc(r.id)}"`,'Tell the moderation team what happened')}</div>`;
  }
  function groupsScreen() {const rows=conversations().filter(c=>c.kind==='group');return `${headline('YOUR PEOPLE','Groups','Keep plans and conversations together.')} ${button(`${icon('plus')} Create a group`,'newgroup','','wide')}<div class="ph-list">${rows.map(conversationRow).join('') || empty('groups','Your groups will appear here')}</div>`;}
  function newGroupScreen() {return `${headline('BRING FRIENDS TOGETHER','Create a group')}<form class="ph-form" data-ph-form="group">${field('groupName','Group name','','text','required maxlength="60"')}<h3 class="ph-section-label">Invite accepted friends</h3><div class="ph-list">${friends().map(r=>`<label class="ph-list-row ph-check-row">${portrait(r)}<span class="ph-row-copy"><strong>${esc(r.displayName)}</strong><small>@${esc(r.username)}</small></span><input type="checkbox" name="groupMember" value="${esc(r.id)}" ${groupMembers.has(r.id)?'checked':''}></label>`).join('') || '<p class="ph-quiet-note">Add friends first to create a group.</p>'}</div><button class="ph-button wide" type="submit" ${friends().length?'':'disabled'}>Create group</button></form>`;}
  function notificationsScreen() {
    const invites=pendingInvites(), notices=entries(state().notifications);
    return `${headline('IN THE LOOP','Activity')} ${notices.some(n=>!n.read && !n.readAt)?button('Mark notifications read','read-all','','subtle wide'):''}${invites.length?`<h3 class="ph-section-label">Invitations</h3>${invites.map(i=>`<article class="ph-invite"><span class="ph-mini-app amber">${icon('events')}</span><div><strong>${esc(i.resident?.displayName || i.fromResident?.displayName || i.sender?.displayName || nameById(i.from || i.fromId))} invited you</strong><p>${esc(i.note || ({home:'Visit their home',meetup:'Meet up in the city',activity:'Join an activity'}[i.kind]) || 'Join them in Abuja')}</p><small>${esc(place(i.district)?.name || '')}</small><div class="ph-inline-actions">${button('Accept','invite-respond',`data-id="${esc(i.id)}" data-accept="true"`)}${button('Decline','invite-respond',`data-id="${esc(i.id)}" data-accept="false"`,'subtle')}</div></div></article>`).join('')}`:''}<h3 class="ph-section-label">Notifications</h3><div class="ph-list">${notices.map(n=>`<button class="ph-list-row ${!n.read && !n.readAt?'ph-notice-unread':''}" data-ph-action="notice" data-id="${esc(n.id)}"><span class="ph-mini-app ${n.kind==='message'?'green':'coral'}">${icon(n.kind==='message'?'messages':'notifications')}</span><span class="ph-row-copy"><strong>${esc(n.title || 'AbujaLife')}</strong><small class="ph-wrap">${esc(n.text || n.body || n.message || 'New activity')}</small><time>${dateTime(n.createdAt)}</time></span>${icon('arrow')}</button>`).join('') || empty('notifications','You’re all caught up')}</div>`;
  }
  function walletScreen() {
    const rows=entries(walletData?.transactions || state().transactions).slice(0,30), balance=walletProfile().wallet;
    const transferUnavailable=isBrowserPreview() || walletMeta().transferEnabled===false;
    return `${headline('YOUR MONEY','Naira wallet')}<div class="ph-bank-card"><div><span>NAIRA</span><small>NGN · GAME MONEY</small></div><small>Naira balance</small><strong>${currency(balance)}</strong><footer><span>${esc(profile().displayName)}</span><span>Everyday account</span></footer></div><div class="ph-wallet-actions">${button(`${icon('plus')} Top up`,'wallet-topup','', 'wallet-primary')}${button(`${icon('send')} Send`,'wallet-send',transferUnavailable?'disabled':'','secondary')}</div><p class="ph-quiet-note">${transferUnavailable?'Chat and transfers connect registered residents in the full game. This preview saves your game money on this device.':'Send Naira to real residents. Your purchases, earnings and transfers appear below.'}</p>${walletError?`<div class="ph-wallet-error" role="alert">${esc(walletError)}${button('Refresh','wallet-refresh','','subtle')}</div>`:''}<div class="ph-ledger-heading"><h3 class="ph-section-label">Recent activity</h3>${walletLoading?'<span class="ph-loading-note" role="status">Updating…</span>':button('Refresh','wallet-refresh','','subtle')}</div><div class="ph-list">${rows.map(t=>{const amount=Number(t.amount || t.delta || 0), credit=amount>0;return `<div class="ph-list-row"><span class="ph-transaction-icon ${credit?'credit':''}">${icon(credit?'plus':'wallet')}</span><span class="ph-row-copy"><strong>${esc(t.reason || t.description || t.label || t.kind || t.type || 'Transaction')}</strong><small>${dateTime(t.createdAt)}</small></span><strong class="ph-amount ${credit?'credit':''}">${credit?'+':''}${currency(amount)}</strong></div>`;}).join('') || empty('wallet','Your saved transactions appear here')}</div>`;
  }
  function earnCampaign() { return earnData?.campaigns?.find(c => c.id === 'share-abuja-life') || earnData?.campaigns?.[0] || null; }
  function earnScreen() {
    const campaign = earnCampaign(), reward = campaign?.rewardGameNaira || 100000, claimed = Boolean(campaign?.claimed), activities=earnData?.activities || [], active=earnActivity, ready=active && Date.now()>=Number(active.readyAt);
    return `${headline('LIVE YOUR ABUJA STORY','Earn Game Naira','Meaningful city life unlocks more of AbujaLife. Jobs, exploration and social moments build your balance.')}<section class="ph-earn-hero"><div><small>SHARE & EARN</small><strong>${claimed ? 'Reward collected ✓' : `+${currency(reward)}`}</strong><p>${esc(campaign?.description || 'Share AbujaLife with your people through your phone’s native share sheet.')}</p></div>${claimed ? '<span class="ph-earn-check">✓</span>' : button(earnBusy ? 'Opening share…' : 'Share & earn', 'earn-share', earnBusy ? 'disabled' : '', 'ph-earn-primary')}</section>${earnMessage ? `<p class="ph-success" role="status">${esc(earnMessage)}</p>` : ''}<h3 class="ph-section-label">Today</h3><div class="ph-earn-list"><button class="ph-list-row" data-ph-action="app" data-app="jobs"><span class="ph-mini-app blue">${icon('jobs')}</span><span class="ph-row-copy"><strong>Available jobs</strong><small>Complete a shift and get paid from the server.</small></span>${icon('arrow')}</button>${activities.map(activity=>active?.activityId===activity.id?`<div class="ph-list-row ph-earn-activity-active"><span class="ph-mini-app green">${icon('earn')}</span><span class="ph-row-copy"><strong>${esc(activity.title)}</strong><small>${ready?'Your session is complete. Settle it now.':`In progress · ready at ${timeOnly(active.readyAt)}`}</small></span>${button(ready?'Collect reward':'In progress','earn-activity-complete',ready?'': 'disabled','subtle')}</div>`:`<button class="ph-list-row" data-ph-action="earn-activity" data-id="${esc(activity.id)}"><span class="ph-mini-app green">${icon('earn')}</span><span class="ph-row-copy"><strong>${esc(activity.title)}</strong><small>${esc(activity.description)} · +${currency(activity.rewardGameNaira)}</small></span>${icon('arrow')}</button>`).join('')}<button class="ph-list-row" data-ph-action="app" data-app="map"><span class="ph-mini-app green">${icon('map')}</span><span class="ph-row-copy"><strong>Explore & earn</strong><small>Discover neighbourhoods, venues and city opportunities.</small></span>${icon('arrow')}</button><button class="ph-list-row" data-ph-action="app" data-app="events"><span class="ph-mini-app amber">${icon('events')}</span><span class="ph-row-copy"><strong>City activities</strong><small>Join events and meaningful social activities.</small></span>${icon('arrow')}</button></div><p class="ph-quiet-note">Game Naira is virtual and stays separate from Jackpot and real money. Rewards are settled once in the server ledger.</p>`;
  }
  function topupScreen() {
    if(!isBrowserPreview()) {
      const min=paymentConfig?.minAmount || 100,max=paymentConfig?.maxAmount || Number.MAX_SAFE_INTEGER,rate=Number(paymentConfig?.creditRate) || 1;
      return `${headline('MORE ROOM TO PLAY','Buy game credits','Pay through the provider’s secure checkout. Your balance updates after server verification.')}<div class="ph-wallet-summary"><span>Game Naira balance</span><strong>${currency(walletProfile().wallet)}</strong></div>${paymentLoading?'<p class="ph-quiet-note" role="status">Checking payment availability…</p>':''}${paymentConfig?.enabled?`<p class="ph-quiet-note">${esc(paymentConfig.provider || 'Flutterwave')} · ${paymentConfig.mode==='test'?'TEST CHECKOUT · no live payment':'Live checkout'} · ₦1 buys ${rate} game Naira.</p><form class="ph-form ph-wallet-form" data-ph-form="wallet-payment">${field('topupAmount','Payment amount (NGN)',String(min),'number',`required min="${min}" max="${max}" step="1" inputmode="numeric"`)}${field('paymentEmail','Receipt email',profile().email || '','email','required maxlength="254" autocomplete="email"')}<p class="ph-quiet-note">Game credits have no cash value and cannot be withdrawn. Review the amount before paying.</p><button type="submit" class="ph-button wide" ${busy?'disabled':''}>Review payment ${icon('arrow')}</button></form>`:`<p class="ph-wallet-error" role="status">${esc(paymentError || paymentConfig?.reason || 'Payments are not enabled for this game yet.')}</p>${button('Check again','payment-config-refresh','','secondary wide')}`}${checkout?button('Resume pending checkout','payment-resume','','subtle wide'):''}`;
    }
    const amounts=walletMeta().topupAmounts || [10000,50000,100000,500000], min=walletMeta().topupMin || 1000,max=Number.MAX_SAFE_INTEGER;
    return `${headline('LOCAL PREVIEW FUNDS','Top up Naira','Add free game money to play on this device.')}<div class="ph-wallet-summary"><span>Naira balance</span><strong>${currency(walletProfile().wallet)}</strong></div><form class="ph-form ph-wallet-form" data-ph-form="wallet-topup"><div class="ph-amount-options" aria-label="Suggested top-up amounts">${amounts.map(amount=>button(currency(amount),'wallet-amount',`data-amount="${amount}"`,'secondary')).join('')}</div>${field('topupAmount','Amount (NGN)',draft('topupAmount',String(amounts[0])),'number',`required min="${min}" max="${max}" step="1" inputmode="numeric"`)}<p class="ph-quiet-note">Local preview only. These free game funds stay on this device and cannot be withdrawn as cash.</p><button type="submit" class="ph-button wide" ${busy?'disabled':''}>Review top-up ${icon('arrow')}</button></form>`;
  }
  function transferScreen() {
    if(isBrowserPreview() || walletMeta().transferEnabled===false)return `${headline('STAY CONNECTED','Send Naira')}<div class="ph-wallet-summary"><span>Game preview</span><strong>Play on this device</strong></div><p class="ph-quiet-note">Transfers and chat are shared between real, registered residents in the full game. No one else is connected to this browser preview.</p>${button('Back to wallet','app','data-app="wallet"','wide')}`;
    const recipients=(residentResults || eligibleRecipients()).filter(r=>r.id!==profile().id && !(state().blocked || []).includes(r.id)).filter(match);
    return `${headline('SEND TO A RESIDENT','Who’s it for?','Choose their name, then review the amount before sending.')} ${searchField('Search names or usernames')}<div class="ph-list">${recipients.map(r=>residentRow(r,'wallet-recipient')).join('') || empty('contacts','No residents found. Invite a friend to join AbujaLife.')}</div>${residentPager()}`;
  }
  function transferFormScreen() {
    const recipient=transferRecipient(selected);if(!recipient || (state().blocked || []).includes(selected))return empty('contacts','This resident is unavailable','wallet-home','Back to wallet');
    return `${headline('SEND NAIRA','A little goes a long way')}<div class="ph-transfer-person">${portrait(recipient)}<div><strong>${esc(recipient.displayName || recipient.username)}</strong><span>@${esc(recipient.username || 'resident')}</span></div></div><form class="ph-form ph-wallet-form" data-ph-form="wallet-transfer">${chatTransfer?`<div class="ph-chat-amounts">${[1000,10000,100000,1000000,10000000,100000000].map(amount=>button(currency(amount),'chat-money-amount',`data-amount="${amount}" ${amount>Math.floor(walletProfile().wallet || 0)?'disabled':''}`,'secondary')).join('')}${button('Max','chat-money-max','','secondary')}</div>`:''}${field('transferAmount','Amount (NGN)','','number',`required min="1" max="${Math.floor(walletProfile().wallet || 0)}" step="1" inputmode="numeric"`)}${field('transferNote','Note (optional)','','text','maxlength="120" placeholder="What’s it for?"')}<p class="ph-quiet-note">Available: ${currency(walletProfile().wallet)} · No transfer fee.</p><button type="submit" class="ph-button wide" ${busy?'disabled':''}>Review transfer ${icon('arrow')}</button></form>`;
  }
  function chatMoneyPanel() {
    if(!chatTransfer || chatTransfer.ownerId!==profile().id || chatTransfer.conversationId!==thread?.id || !chatPeer())return '';
    const recipient=chatTransfer.peer, reviewing=chatTransfer.stage==='review' && pendingWallet?.conversationId===thread.id;
    const available=Math.floor(walletProfile().wallet || 0), amount=reviewing?pendingWallet.amount:Number(draft('transferAmount')) || 0;
    return `<section class="ph-money-panel ${reviewing?'is-review':''}" aria-label="${reviewing?'Review transfer':'Send Naira in this conversation'}">
      <div class="ph-money-heading"><span class="ph-money-emblem">${icon('wallet')}</span><div><small>NAIRA · BETWEEN FRIENDS</small><strong>${reviewing?'Review transfer':'Send a little love'}</strong></div><button type="button" data-ph-action="chat-money-close" aria-label="Close money panel" ${busy?'disabled':''}>${icon('close')}</button></div>
      ${reviewing?`<div class="ph-money-review-amount"><small>YOU’RE SENDING</small><strong>${currency(amount)}</strong></div><div class="ph-money-recipient">${portrait(recipient)}<span><strong>${esc(recipient.displayName || recipient.username)}</strong><small>@${esc(recipient.username || 'resident')}</small></span>${icon('check')}</div><dl class="ph-money-breakdown"><div><dt>Transfer fee</dt><dd>${currency(0)}</dd></div><div><dt>Balance after</dt><dd>${currency(available-amount)}</dd></div></dl>${pendingWallet.note?`<p class="ph-money-note">${esc(pendingWallet.note)}</p>`:''}${walletError?`<p class="ph-wallet-error" role="alert">${esc(walletError)}<small>You can retry this transfer safely.</small></p>`:''}${button(busy?'Sending…':walletError?'Retry transfer':`Confirm & send ${currency(amount)}`,'wallet-confirm',busy?'disabled':'','ph-money-submit wide')}${button('Edit amount or note','wallet-edit',busy?'disabled':'','ph-money-edit wide')}`:
      `<form class="ph-money-form" data-ph-form="wallet-transfer"><div class="ph-money-available"><span>To <strong>@${esc(recipient.username || 'resident')}</strong></span><span>${currency(available)} available</span></div><label class="ph-money-amount"><span class="ph-sr-only">Amount in Naira</span><span aria-hidden="true">₦</span><input id="ph-transferAmount" name="transferAmount" type="number" value="${esc(draft('transferAmount'))}" required min="1" max="${available}" step="1" inputmode="numeric" placeholder="0" aria-label="Amount in Naira"><button type="button" data-ph-action="chat-money-max" ${available<1?'disabled':''}>Max</button></label><div class="ph-chat-amounts">${[1000,10000,100000,1000000,10000000,100000000].map(value=>button(value>=1000000?`₦${value/1000000}M`:`₦${value/1000}k`,'chat-money-amount',`data-amount="${value}" ${value>available?'disabled':''}`,'secondary')).join('')}</div><label class="ph-money-note-field"><span class="ph-sr-only">Note (optional)</span><input id="ph-transferNote" name="transferNote" type="text" value="${esc(draft('transferNote'))}" maxlength="120" placeholder="Add a note · for lunch, transport, anything"></label>${walletError?`<p class="ph-wallet-error" role="alert">${esc(walletError)}</p>`:''}<button id="ph-money-review" type="submit" class="ph-button ph-money-submit wide" ${busy?'disabled':''}>${icon('send')}<span>Review ${amount>0?currency(amount):'transfer'}</span>${icon('arrow')}</button></form>`}
      <p class="ph-money-footnote">${icon('shield')} Game Naira · No transfer fee</p>
    </section>`;
  }
  function walletReviewScreen() {
    if(!pendingWallet)return empty('wallet','Choose an amount first','wallet-home','Back to wallet');
    if(pendingWallet.kind==='payment')return `${headline('ONE LAST LOOK','Review payment')}<div class="ph-review-card">${icon('wallet')}<strong>${currency(pendingWallet.amount)}</strong><span>Pay ${esc(paymentConfig?.provider || 'Flutterwave')}</span><small>${paymentConfig?.mode==='test'?'Test checkout':'Live checkout'}</small></div><div class="ph-review-details"><div><span>Game credits</span><strong>${currency(pendingWallet.credits)}</strong></div><div><span>Receipt email</span><strong>${esc(pendingWallet.email)}</strong></div></div>${walletError?`<p class="ph-wallet-error" role="alert">${esc(walletError)}</p>`:''}${button(busy?'Opening checkout…':'Continue to secure checkout','wallet-confirm',busy?'disabled':'','wide')}${button('Change details','wallet-edit',busy?'disabled':'','subtle wide')}<p class="ph-quiet-note">The provider handles your card details. Your game balance is credited only after the server verifies payment.</p>`;
    const transfer=pendingWallet.kind==='transfer', recipient=resident(pendingWallet.residentId);
    return `${headline('ONE LAST LOOK',transfer?'Review transfer':'Review top-up')}<div class="ph-review-card">${icon(transfer?'send':'plus')}<strong>${currency(pendingWallet.amount)}</strong><span>${transfer?`To ${esc(recipient?.displayName || pendingWallet.recipientName)}`:'Free game Naira top-up'}</span>${transfer?`<small>@${esc(recipient?.username || pendingWallet.recipientUsername || 'resident')}</small>`:''}</div><div class="ph-review-details"><div><span>Fee</span><strong>${currency(0)}</strong></div><div><span>${transfer?'Total sent':'Added to your balance'}</span><strong>${currency(pendingWallet.amount)}</strong></div>${pendingWallet.note?`<div><span>Note</span><strong>${esc(pendingWallet.note)}</strong></div>`:''}</div>${walletError?`<p class="ph-wallet-error" role="alert">${esc(walletError)}<small>Retrying this request will never charge you twice.</small></p>`:''}${button(walletError?'Try again':transfer?'Confirm & send':'Confirm top-up','wallet-confirm',busy?'disabled':'','wide')}${button('Change details','wallet-edit',busy?'disabled':'','subtle wide')}<p class="ph-quiet-note">${transfer?'Game money is shared with this resident immediately after confirmation.':'Naira for your life in the game. No card details or payment required.'}</p>`;
  }
  function walletReceiptScreen() {
    if(!walletReceipt)return empty('wallet','Your receipt is unavailable','wallet-home','Back to wallet');
    const transfer=walletReceipt.kind==='transfer';
    if(walletReceipt.kind==='payment')return `<div class="ph-wallet-receipt"><span class="ph-receipt-check">${icon('check')}</span><small>PAYMENT VERIFIED</small><h2>${currency(walletReceipt.credits)}</h2><p>Game credits added to your balance</p><time>${dateTime(walletReceipt.createdAt)}</time></div><div class="ph-review-details"><div><span>Amount paid</span><strong>${currency(walletReceipt.amount)}</strong></div><div><span>Payment reference</span><strong>${esc(walletReceipt.txRef)}</strong></div></div>${button('Done','app','data-app="wallet"','wide')}`;
    return `<div class="ph-wallet-receipt"><span class="ph-receipt-check">${icon('check')}</span><small>${transfer?'TRANSFER COMPLETE':'TOP-UP COMPLETE'}</small><h2>${currency(walletReceipt.amount)}</h2><p>${transfer?`Sent to ${esc(walletReceipt.recipientName)}`:'Added to your Naira balance'}</p><time>${dateTime(walletReceipt.createdAt)}</time></div><div class="ph-wallet-summary"><span>Naira balance</span><strong>${currency(walletProfile().wallet)}</strong></div>${walletReceipt.conversationId?button('Back to conversation','chat-return',`data-id="${esc(walletReceipt.conversationId)}"`,'wide'):button('Done','app','data-app="wallet"','wide')}`;
  }
  function paymentCheckoutScreen() {
    if(!checkout)return empty('wallet','Choose a payment amount first','wallet-topup','Buy game credits');
    const checkoutUrl=checkout.checkoutUrl?normalizeCheckoutURL(checkout.checkoutUrl):null;
    return `${headline('SECURE HOSTED CHECKOUT','Complete your payment','Finish checkout in the provider’s tab, then verify your payment here.')}<div class="ph-wallet-summary"><span>Payment amount</span><strong>${currency(checkout.amount)}</strong></div>${checkout.mode==='test'?'<p class="ph-social-local">Test checkout · no live payment.</p>':''}${checkoutUrl?`<a class="ph-button wide" href="${esc(checkoutUrl)}" target="_blank" rel="noopener noreferrer">Open checkout ↗</a>`:''}<p class="ph-quiet-note">Reference: ${esc(checkout.txRef)}. Closing checkout does not confirm payment.</p><form class="ph-form ph-wallet-form" data-ph-form="payment-verify">${field('paymentTransactionId','Provider transaction ID',checkout.transactionId || '','text','required inputmode="numeric" pattern="[0-9]+" maxlength="24"')}<button type="submit" class="ph-button wide" ${busy?'disabled':''}>${busy?'Verifying…':'Verify payment'}</button></form>${button('Check payment status','payment-status',busy?'disabled':'','secondary wide')}${walletError?`<p class="ph-wallet-error" role="alert">${esc(walletError)}</p>`:''}<p class="ph-quiet-note">Your receipt shows the transaction ID. Credits are added once, after the provider confirms the amount, currency and reference.</p>`;
  }
  function jobsScreen() {
    const current=entries(state().jobs).find(j=>j.id===profile().job);
    return `${headline('BUILD YOUR CAREER','Jobs',current?`Your current role: ${current.title}`:'Find your next step in Abuja.')}<div class="ph-list">${entries(state().jobs).map(j=>`<button class="ph-list-row" data-ph-action="navigate" data-view="work" data-id="${esc(j.id)}"><span class="ph-mini-app blue">${icon('jobs')}</span><span class="ph-row-copy"><strong>${esc(j.title)}</strong><small>${esc(place(j.district)?.name || 'Abuja')} · ${esc(j.skill || 'Career')}</small><span class="ph-job-pay">${currency(j.pay || j.salary)} / shift</span></span>${icon('arrow')}</button>`).join('')}</div><p class="ph-quiet-note">Travel to work and complete the job’s tasks to earn your shift pay.</p>`;
  }
  function mapScreen() {const rows=entries(state().atlas).filter(match).slice(0,60);return `${headline('ONE CONNECTED CITY','Your map',`${place(profile().district)?.name || 'Abuja'} · ${locationLabel()}`)}<button class="ph-map-preview" data-ph-action="navigate" data-view="map"><div class="ph-map-cover">${icon('map')}<strong>${esc(place(profile().district)?.name || 'Abuja')}</strong><small>YOUR CURRENT NEIGHBOURHOOD</small></div><span>Open Abuja map ${icon('arrow')}</span></button><p class="ph-quiet-note">Explore the street map, neighbourhood catalogue and journey planner.</p><h3 class="ph-section-label">Around your neighbourhood</h3><div class="ph-list">${entries(state().venues).map(v=>`<button class="ph-list-row" data-ph-action="navigate" data-view="world" data-venue-id="${esc(v.id)}"><span class="ph-mini-app sage">${icon(v.id==='estate-office'?'property':v.id==='dealership'?'ride':'map')}</span><span class="ph-row-copy"><strong>${esc(v.name)}</strong><small>${esc(v.category)} · Walk there</small></span>${icon('arrow')}</button>`).join('')}</div>${searchField('Search places')}<div class="ph-list">${rows.map(p=>`<button class="ph-list-row" data-ph-action="navigate" data-view="map" data-id="${esc(p.id)}"><span class="ph-mini-app sage">${icon('map')}</span><span class="ph-row-copy"><strong>${esc(p.name)}</strong><small>${esc(p.id===profile().district?'You are here':p.kind==='town'?'FCT town':p.kind==='fcc-district'?'Abuja city district':p.kind || 'Place')}</small></span>${icon('arrow')}</button>`).join('')}</div>`;}
  function rideScreen() {
    const trip=profile().activeTrip;
    if(trip) return `${headline('ON THE MOVE','Your journey')}<div class="ph-trip"><span class="ph-mini-app ink">${icon('ride')}</span><strong>To ${esc(place(trip.destination)?.name || trip.destination)}</strong><p>${esc(trip.mode)} · ${currency(trip.cost)}</p><small>Arrival ${timeOnly(trip.arrivesAt)}</small></div>${button('View journey','navigate','data-view="world"','wide')}`;
    return `${headline('LET’S GO','Ride & transport','Choose a destination and how you’ll get there.')}<form class="ph-form" data-ph-form="travel"><label class="ph-field"><span>Destination</span><select id="ph-destination" name="destination">${districtOptions(draft('destination',profile().district))}</select></label><fieldset class="ph-mode-options"><legend>Travel mode</legend>${[['walk','Walk','Within this neighbourhood'],['bus','Bus','Shared city transport'],['taxi','Taxi','Direct city travel'],['ride','Ride-hailing','A direct pickup'],['car','Your car','Owned vehicle required']].map(([id,label,desc])=>`<label><input type="radio" name="mode" value="${id}" ${draft('mode','bus')===id?'checked':''} ${id==='car'&&!ownsCar()?'disabled':''}><span>${icon(id==='walk'?'map':'ride')}<strong>${label}</strong><small>${desc}</small></span></label>`).join('')}</fieldset><div class="ph-fare" role="status">${quoteLoading?'<span>Checking your route…</span>':quoteError?`<p>${esc(quoteError)}</p>`:travelQuote?`<span><small>FARE</small><strong>${currency(travelQuote.cost)}</strong></span><span><small>JOURNEY</small><strong>${travelQuote.seconds<60?`${travelQuote.seconds}s`:`${Math.ceil(travelQuote.seconds/60)} min`}</strong></span>`:'<span>Choose a route to see your fare.</span>'}</div><p class="ph-quiet-note">${travelQuote?.cost>profile().wallet?'You need more Naira for this fare.':`Wallet: ${currency(profile().wallet)}. This fare is charged when you start. Travel times are compressed for gameplay.`}</p><button type="submit" class="ph-button wide" ${!travelQuote || quoteLoading || travelQuote.cost>profile().wallet?'disabled':''}>${travelQuote?.cost?`Pay ${currency(travelQuote.cost)} & travel`:'Start journey'}</button></form>`;
  }
  function propertyScreen() {return `${headline('FIND YOUR PLACE','Property',profile().home?.name?`Home: ${profile().home.name}`:'Start modestly. Make it yours.')}${button(`${icon('property')} Property investments`,'property-investments','','secondary wide')}<div class="ph-list">${entries(state().properties).map(p=>`<button class="ph-property-row" data-ph-action="homeproperty" data-id="${esc(p.id)}"><span class="ph-property-art">${icon('property')}</span><span class="ph-row-copy"><strong>${esc(p.name)}</strong><small>${esc(place(p.district)?.name || p.district)}</small><span class="ph-property-price">${p.rent?`${currency(p.rent)} / game year`:'Starter home'}</span></span>${icon('arrow')}</button>`).join('') || empty('property','No properties available right now')}</div>`;}
  function propertyDetail() {
    const p=entries(state().properties).find(p=>p.id===selected); if(!p) return empty('property','Property unavailable');
    const current=profile().home?.propertyId===p.id;
    return `<div class="ph-property-art ph-property-large">${icon('property')}</div>${headline(place(p.district)?.name || 'ABUJA',p.name,p.description || 'Your next home in the city.')}<p class="ph-quiet-note">${p.bedrooms===0?'Studio':p.bedrooms?`${p.bedrooms} bedroom${p.bedrooms===1?'':'s'}`:''}${p.bedrooms!==undefined?' · ':''}Virtual game prices</p><div class="ph-facts">${p.rent?`<span><small>RENT / GAME YEAR</small><strong>${currency(p.rent)}</strong></span>`:''}${p.price || p.buyPrice?`<span><small>OWN</small><strong>${currency(p.price || p.buyPrice)}</strong></span>`:''}</div>${current?'<div class="ph-success">This is your current home.</div>':`${p.rent?button('Rent this home','move-home',`data-id="${esc(p.id)}" data-tenure="rent"`,'wide'):''}${p.price || p.buyPrice?button('Buy this home','move-home',`data-id="${esc(p.id)}" data-tenure="own"`,'secondary wide'):''}`} ${button('View on map','navigate',`data-view="map" data-id="${esc(p.district)}"`,'subtle wide')}<p class="ph-quiet-note">Rent is paid upfront for a game year (28 real days). Service bills are weekly. Prices are scaled for the game. Travel to your new neighbourhood to move in.</p>`;
  }
  function productArt(item) {
    const model=item.category==='clothing'?`wear:${item.id}`:item.id,color=profile().vehicleColors?.[item.id]||draft(`vehicleColor-${item.id}`,item.defaultColor)||'';
    return `<span class="ph-3d-product" data-product-model="${esc(model)}" data-product-color="${esc(color)}" data-product-name="${esc(item.name)}">${productFallbackArt(item)}</span>`;
  }
  function productFallbackArt(item) {
    if(item.category==='vehicle')return vehicleIllustration(item,profile().vehicleColors?.[item.id] || draft(`vehicleColor-${item.id}`,item.defaultColor));
    const color={cream:'#e5ddc9',navy:'#3d4c59',agbada:'#bba06b'}[item.value] || '#b9c4a2';
    const drawings={
      'linen-shirt':`<path d="m39 28 17-10h18l17 10 16 20-17 13-9-12v57H49V49l-9 12-17-13Z" fill="${color}" stroke="#9c967f" stroke-width="2"/><path d="m56 18 9 17 9-17M65 35v67M52 64h8" fill="none" stroke="#b8ad93" stroke-width="2"/>`,
      'office-shirt':`<path d="m39 28 17-10h18l17 10 16 20-17 13-9-12v57H49V49l-9 12-17-13Z" fill="${color}" stroke="#334450" stroke-width="2"/><path d="m56 18 9 17 9-17M65 35v67M72 53h7" fill="none" stroke="#849293" stroke-width="2"/>`,
      'traditional-set':`<path d="m53 22 12 8 12-8 28 20-10 54-20-8v23H53V88l-20 8-9-54Z" fill="${color}" stroke="#9f8555" stroke-width="2"/><path d="M65 33v68M57 45v34M73 45v34" fill="none" stroke="#e3d2aa" stroke-width="3"/>`,
      'white-trainers':'<path d="m32 52 21-5 11 12 27 12q16 2 17 18H27q-10-20 5-37Z" fill="#f3efe2" stroke="#b3b8a6" stroke-width="2"/><path d="M28 83h76M59 62l14-5M67 66l14-4M76 69l13-3" stroke="#a0a991" stroke-width="2" fill="none"/>',
      'plant':'<path d="m47 77 5 33h27l5-33Z" fill="#b99670"/><path d="M65 80V41" stroke="#799259" stroke-width="3"/><path d="M65 66q-34-1-27-23 28-1 27 23M65 59q27-1 24-24-30 0-24 24M65 46q-17-23 1-35 15 15-1 35" fill="#6b8756"/>',
      'bookshelf':'<path d="M37 18h57v93H37Z" fill="#b3a07e"/><path d="M43 25h45v22H43ZM43 54h45v21H43ZM43 83h45v21H43Z" fill="#d0c3a5"/><path d="M50 32v14M57 29v17M68 32v14M75 30v16M49 62v12M57 60v14M65 63v11M49 88v15M61 89v14" stroke="#7b906c" stroke-width="7"/>',
      'lounge-chair':'<path d="M46 31q19-9 38 0v44H46Z" fill="#789173"/><path d="M41 65h47v26H41Z" fill="#8ba482"/><path d="M33 61h12v30H33ZM85 61h12v30H85Z" fill="#677e62"/><path d="M39 90v20M91 90v20" stroke="#9d8564" stroke-width="5"/>',
      'sofa':'<rect x="26" y="37" width="78" height="43" rx="9" fill="#8c9c7c"/><path d="M23 70h86v27H23Z" fill="#a2ad8d"/><rect x="16" y="62" width="16" height="36" rx="5" fill="#788a6b"/><rect x="99" y="62" width="16" height="36" rx="5" fill="#788a6b"/><path d="M27 99v10M104 99v10M64 42v43" stroke="#80906d" stroke-width="4"/>',
      'compact-car':'<path d="m18 74 18-6 18-20h31l17 20 18 8v21H16Z" fill="#c3c7b5" stroke="#94a28c" stroke-width="2"/><path d="m47 66 11-13h13v13Zm29-13h7l12 13H76Z" fill="#6b8b86"/><circle cx="38" cy="95" r="11" fill="#56665a"/><circle cx="99" cy="95" r="11" fill="#56665a"/><circle cx="38" cy="95" r="5" fill="#c4ccb9"/><circle cx="99" cy="95" r="5" fill="#c4ccb9"/>'
    };
    return (drawings[item.id] || (item.category==='vehicle'?drawings['compact-car']:null))?`<svg class="ph-product-illustration" viewBox="0 0 130 130" role="img" aria-label="${esc(item.name)}">${drawings[item.id] || drawings['compact-car']}</svg>`:icon(item.category==='vehicle'?'ride':item.category==='furniture'?'property':'market');
  }
  function marketScreen() {return `${headline('MAKE IT YOURS','Okrika Marketplace','Furniture, fashion and cars for your life in Abuja.')}<button class="ph-market-wallet" data-ph-action="app" data-app="wallet" aria-label="Open Naira wallet"><span><small>YOUR ABUJA NAIRA</small><strong>${currency(profile().wallet)}</strong></span><i>${icon('wallet')}</i><em>Open wallet</em></button>${searchField('Search Okrika Marketplace')}<div class="ph-market-grid">${entries(state().catalog).filter(match).map(i=>`<button class="ph-product" data-ph-action="item" data-id="${esc(i.id)}"><span class="ph-product-art ${esc(i.kind || i.category || '')}">${productArt(i)}</span><small>${esc(i.category || i.kind || 'VIRTUAL ITEM')}</small><strong>${esc(i.name || i.title)}</strong><span>${currency(i.price || i.cost)}</span></button>`).join('')}</div>`;}
  function itemScreen() {
    const i=entries(state().catalog).find(i=>i.id===selected); if(!i) return empty('market','Item unavailable');
    const own=entries(profile().inventory).some(r=>r.id===i.id || r.itemId===i.id) || (profile().inventory || []).includes?.(i.id);
    const colorId=profile().vehicleColors?.[i.id] || draft(`vehicleColor-${i.id}`,i.defaultColor), selectedColor=VEHICLE_COLORS.find(c=>c.id===colorId);
    const paint=i.category==='vehicle'?`<section class="ph-car-paint"><div><span>Paint colour</span><strong>${esc(selectedColor?.name || 'Choose your colour')}</strong></div><div class="ph-paint-options" aria-label="Car paint colour">${VEHICLE_COLORS.filter(c=>!i.availableColors || i.availableColors.includes(c.id)).map(c=>`<button type="button" class="ph-paint-swatch ${c.id===colorId?'selected':''}" data-ph-action="vehicle-color" data-id="${esc(i.id)}" data-color="${esc(c.id)}" aria-label="${esc(c.name)}" aria-pressed="${c.id===colorId}" ${busy?'disabled':''}><span style="background:${c.hex}"></span>${c.id===colorId?icon('check'):''}</button>`).join('')}</div>${own?'<small>Repaint your owned car for free.</small>':''}</section>`:'';
    return `<div class="ph-product-art ph-product-large">${productArt(i)}</div>${headline(i.category==='vehicle'?`${i.year || ''} · ${i.brand || 'YOUR NEXT CAR'}`:i.category || i.kind || 'ITEM',i.name || i.title,i.description || 'An item for your life in Abuja.')}<div class="ph-item-price">${currency(i.price || i.cost)}<small>Naira (NGN) · Game price</small></div>${paint}${own?`<div class="ph-success">You own this item.</div>${i.kind==='clothing' || i.category==='clothing'?button('Wear this item','equip',`data-id="${esc(i.id)}"`,'wide'):i.category==='furniture'?button('Arrange in your home','furnish',`data-id="${esc(i.id)}"`,'wide'):i.category==='vehicle'?button(profile().drivingVehicle===i.id?'Get out of your car':profile().location?.kind==='public'?'Take the wheel':'Step outside to drive','drive',`data-id="${esc(i.id)}" ${profile().location?.kind==='public'&&!profile().activeTrip?'':'disabled'}`,'wide'):''}`:button(i.category==='vehicle'?'Buy this car':'Buy this item','purchase',`data-id="${esc(i.id)}" ${profile().wallet<(i.price || i.cost)?'disabled':''}`,'wide')}<p class="ph-quiet-note">${own?'Furniture can be arranged at home. Drive your owned cars outdoors.':profile().wallet<(i.price || i.cost)?'Add Naira in your wallet or complete a shift to afford this item.':'Your purchase is saved to your resident inventory.'}</p>${own?button(`Sell for ${currency(systemResaleValue(i))}`,'sell-item',`data-id="${esc(i.id)}"`,'secondary wide'):''}${!own && profile().wallet<(i.price || i.cost)?button('Open Naira wallet','app','data-app="wallet"','secondary wide'):''}`;
  }
  function eventsScreen() {return `${headline('MAKE A MOMENT','Events')} ${button(`${icon('plus')} Create an event`,'newevent','','wide')}<div class="ph-list">${entries(state().events).map(e=>`<button class="ph-list-row" data-ph-action="event" data-id="${esc(e.id)}"><span class="ph-event-date"><strong>${new Date(e.startsAt).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos',day:'numeric'})}</strong><small>${new Date(e.startsAt).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos',month:'short'})}</small></span><span class="ph-row-copy"><strong>${esc(e.title)}</strong><small>${esc(place(e.district)?.name || e.district)} · ${timeOnly(e.startsAt)}</small>${(e.attendeeIds || []).includes(profile().id)?'<span class="ph-attending">You’re attending</span>':''}</span>${icon('arrow')}</button>`).join('') || empty('events','Make the first plan in your city')}</div>`;}
  function eventScreen() {const e=entries(state().events).find(e=>e.id===selected);if(!e)return empty('events','Event unavailable');const attending=(e.attendeeIds || []).includes(profile().id);return `${headline(place(e.district)?.name || 'ABUJA',e.title)}<div class="ph-event-time">${icon('events')}<strong>${dateTime(e.startsAt)}</strong></div><p class="ph-detail-text">${esc(e.description || 'A chance to spend time together in the city.')}</p><div class="ph-event-host">Hosted by ${esc(e.host?.displayName || nameById(e.hostId))}</div><small class="ph-quiet-note">${(e.attendeeIds || []).length} resident${(e.attendeeIds || []).length===1?'':'s'} attending</small>${button(attending?'Cancel RSVP':'I’m attending','rsvp',`data-id="${esc(e.id)}" data-value="${!attending}"`,'wide')}${button('View location','navigate',`data-view="map" data-id="${esc(e.district)}"`,'secondary wide')}<p class="ph-quiet-note">An RSVP saves your place. Travel there when it’s time.</p>`;}
  function newEventScreen() {return `${headline('GIVE THE CITY A REASON TO MEET','Create an event')}<form class="ph-form" data-ph-form="event">${field('eventTitle','Event name','','text','required maxlength="80"')}<label class="ph-field"><span>Where</span><select id="ph-eventDistrict" name="eventDistrict">${districtOptions(draft('eventDistrict',profile().district))}</select></label>${field('eventDate','Date & time (Abuja)','','datetime-local','required')}<label class="ph-field"><span>About your event</span><textarea id="ph-eventDescription" name="eventDescription" rows="4" maxlength="500" placeholder="What’s the plan?">${esc(draft('eventDescription'))}</textarea></label><button type="submit" class="ph-button wide">Create event</button></form>`;}
  function profileScreen() {return `${headline('YOUR SIDE OF THE CITY','Camera & profile')}<div class="ph-camera-view">${portrait(profile(),'ph-camera-portrait')}<span class="ph-camera-corner tl"></span><span class="ph-camera-corner tr"></span><span class="ph-camera-corner bl"></span><span class="ph-camera-corner br"></span><small>RESIDENT PORTRAIT</small></div><div class="ph-profile-name"><strong>${esc(profile().displayName)}</strong><span>@${esc(profile().username)}</span></div>${button('Edit appearance & profile','navigate','data-view="profile"','wide')}${button('Capture & share my home','app','data-app="xshare"','secondary wide')}<p class="ph-quiet-note">Your portrait follows your saved appearance. Xshare captures your actual home and lets you edit the caption.</p>`;}
  function settingRow(title,ic,action,attrs='',subtitle='',enabled) {return `<button class="ph-setting-row" data-ph-action="${action}" ${attrs}><span class="ph-mini-app silver">${icon(ic)}</span><span><strong>${esc(title)}</strong>${subtitle?`<small>${esc(subtitle)}</small>`:''}</span>${enabled!==undefined?`<i class="ph-switch ${enabled?'on':''}" aria-hidden="true"></i>`:icon('arrow')}</button>`;}
  function settingsScreen() {
    const s=profile().settings || {};
    return `${headline('MAKE IT YOURS','Settings')}<div class="ph-setting-list">${settingRow('Presence visibility','globe','setting','data-key="presenceVisible"',s.presenceVisible===false?'Your online presence is private':'Friends can see when you’re online',s.presenceVisible!==false)}${settingRow('Allow invitations','events','setting','data-key="allowInvites"','Meetups, home visits and activities',s.allowInvites!==false)}${settingRow('Phone sounds','volume','sound','','Message and activity sounds',s.soundEnabled!==false)}</div><h3 class="ph-section-label">Your boundaries</h3><div class="ph-setting-list">${settingRow('Blocked residents','shield','app','data-app="blocked"','Manage who can contact you')}${settingRow('Muted residents','volume','app','data-app="muted"','Control notification delivery')}</div><div class="ph-about"><strong>AbujaLife Phone</strong><span>AbujaLife edition</span><p>Your virtual phone keeps your conversations, plans and city life together.</p></div>${button(`${icon('lock')} Lock phone`,'lock','','secondary wide')}`;
  }
  function moderationList() {const s=profile().settings || {}, ids=screen==='blocked'?(state().blocked || s.blockedResidentIds || s.blocked || []):(state().muted || s.mutedResidentIds || s.muted || []);return `${headline('YOUR BOUNDARIES',screen==='blocked'?'Blocked residents':'Muted residents')}<div class="ph-list">${ids.map(id=>{const r=resident(id);return `<div class="ph-list-row">${portrait(r)}<span class="ph-row-copy"><strong>${esc(r?.displayName || 'Resident')}</strong></span>${button(screen==='blocked'?'Unblock':'Unmute',screen==='blocked'?'block':'mute',`data-id="${esc(id)}" data-value="false"`,'subtle')}</div>`;}).join('') || empty('shield',screen==='blocked'?'You haven’t blocked anyone':'You haven’t muted anyone')}</div>`;}
  function inviteScreen() {return `${headline('SPEND TIME TOGETHER',`Invite ${resident(selected)?.displayName || 'a resident'}`)}<form class="ph-form" data-ph-form="invite"><label class="ph-field"><span>Invitation</span><select id="ph-inviteKind" name="inviteKind">${[['meetup','Meetup'],['home','Visit my home'],['activity','Do an activity']].map(([id,label])=>`<option value="${id}" ${draft('inviteKind','meetup')===id?'selected':''}>${label}</option>`).join('')}</select></label><label class="ph-field"><span>Where</span><select id="ph-inviteDistrict" name="inviteDistrict">${districtOptions(draft('inviteDistrict',profile().district))}</select></label>${field('inviteActivity','Activity (optional)','','text','maxlength="60"')}<label class="ph-field"><span>A note</span><textarea id="ph-inviteNote" name="inviteNote" rows="3" maxlength="300" placeholder="Want to meet up?">${esc(draft('inviteNote'))}</textarea></label><button type="submit" class="ph-button wide">Send invitation</button></form>`;}
  function reportScreen() {return `${headline('KEEP THE CITY RESPECTFUL','Report resident')}<form class="ph-form" data-ph-form="report"><p class="ph-detail-text">Your report about ${esc(resident(selected)?.displayName || 'this resident')} will be saved for moderation review.</p><label class="ph-field"><span>What happened?</span><textarea id="ph-reportReason" name="reportReason" rows="5" maxlength="1000" required placeholder="Describe the behaviour you’re reporting…">${esc(draft('reportReason'))}</textarea></label><button class="ph-button wide" type="submit">Send report</button></form>`;}
  function callsScreen() {return `${headline('A VOICE IN YOUR CITY','Calls')}<div class="ph-call-unavailable">${icon('calls')}<strong>Voice calls aren’t available yet</strong><p>Stay connected with real messages and invitations. Calls will appear here when voice service is ready.</p></div>${button('Open Messages','app','data-app="messages"','wide')}`;}
  async function refresh(options) {await onUpdate?.(options);render();}
  // Action responses are authoritative. Refresh the wider account state in
  // the background and coalesce bursts so the phone never waits on bootstrap.
  function refreshInBackground(options={render:false}) {
    if(backgroundRefreshPromise)return backgroundRefreshPromise;
    backgroundRefreshPromise=Promise.resolve().then(()=>onUpdate?.(options)).catch(()=>{}).finally(()=>{backgroundRefreshPromise=null;});
    return backgroundRefreshPromise;
  }
  async function mutate(path,body,success) {
    if(busy)return;
    busy=true;render();
    try {
      const result=await api(path,{method:'POST',body});
      if(result?.profile && result.profile.id===profile().id)Object.assign(profile(),result.profile);
      refreshInBackground();
      if(success)toast?.(success);
      return result;
    }
    catch(error) {toast?.(error.message || 'Please try again.');return null;}
    finally {busy=false;render();}
  }
  function navigate(next,selection=null,push=true) {
    captureInputs();saveThreadScroll();
    if(push && screen!==next)history.push({screen,selected,search,thread});
    screen=next;selected=selection;search='';locked=false;incoming=null;render();
    root.querySelector('.ph-scroll')?.scrollTo(0,0);
    if(next==='ride')void loadTravelQuote();
    if(next==='wallet')void loadWallet();
    if(next==='earn')void loadEarn();
    if(next==='messages')void loadConversations();
    if(next==='topup' && !isBrowserPreview())void loadPayments();
    if(['contacts','compose','transfer'].includes(next)){residentResults=null;residentCursor=null;void loadResidents();}
    if(['social','socialstatuses'].includes(next))void social.load();
  }
  function goBack() {captureInputs();saveThreadScroll();const prev=history.pop();if(prev){screen=prev.screen;selected=prev.selected;search=prev.search;if(prev.screen==='thread' && prev.thread?.id){void openThread(prev.thread.id,false);return;}thread=prev.thread;}else screen='home';if(['contacts','compose','transfer'].includes(screen)){residentResults=null;residentCursor=null;void loadResidents();}render();if(screen==='messages')void loadConversations();}
  async function loadConversations({more=false}={}) {
    if(inboxLoading || isBrowserPreview())return;
    const sequence=++inboxSequence,owner=profile().id;inboxLoading=true;inboxError='';render();
    try{const result=await api(`/api/conversations${more && inboxCursor?`?cursor=${encodeURIComponent(inboxCursor)}`:''}`);if(sequence!==inboxSequence || profile().id!==owner)return;for(const c of result.conversations || [])cachedConversations.set(c.id,c);inboxCursor=result.nextCursor || null;}
    catch(error){if(sequence===inboxSequence && profile().id===owner)inboxError=error.message || 'Conversations could not refresh.';}
    finally{if(sequence===inboxSequence && profile().id===owner){inboxLoading=false;if(opened && screen==='messages')render();}}
  }
  async function loadWallet({quiet=false}={}) {
    const sequence=++walletSequence, owner=profile().id;walletLoading=true;if(!quiet)walletError='';if(opened)render();
    try {const result=await api('/api/wallet');if(sequence!==walletSequence || profile().id!==owner)return;walletData={...result,sourceWallet:profile().wallet};}
    catch(error){if(sequence===walletSequence && !quiet)walletError=error.message || 'Your balance could not refresh. Please try again.';}
    finally{if(sequence===walletSequence){walletLoading=false;if(opened)render();}}
  }
  async function loadEarn() {
    if (isBrowserPreview()) { earnData={campaigns:[{id:'share-abuja-life',title:'Share AbujaLife',description:'Open AbujaLife on your phone to share and earn Game Naira.',rewardGameNaira:100000,claimed:false}],activities:[]}; render(); return; }
    const owner=profile().id;
    try { earnData=await api('/api/rewards/earn'); if(profile().id===owner && opened && screen==='earn')render(); }
    catch(error){ if(profile().id===owner){ earnMessage=error.message || 'Earning opportunities could not load.'; render(); } }
  }
  async function startEarnShare() {
    if(earnBusy || earnCampaign()?.claimed)return;
    if(isBrowserPreview()){ earnMessage='Connect to AbujaLife to share and earn Game Naira.'; render(); return; }
    if(typeof navigator.share!=='function'){ earnMessage='Open AbujaLife on your phone to claim this sharing reward.'; render(); return; }
    earnBusy=true;earnMessage='';render();
    try {
      const started=await api('/api/rewards/share/start',{method:'POST',body:{campaignId:earnCampaign()?.id || 'share-abuja-life'}});
      if(started.claimed){earnMessage='Reward collected ✓';earnData={campaigns:(earnData?.campaigns||[]).map(c=>c.id===started.campaign.id?{...c,claimed:true}:c)};return;}
      try { await navigator.share({title:started.share?.title || 'AbujaLife',text:started.share?.text || 'Join me in AbujaLife.',url:started.share?.url || location.origin}); }
      catch(error){ if(error?.name==='AbortError')return; throw error; }
      const settled=await api('/api/rewards/share/complete',{method:'POST',body:{shareSessionId:started.shareSessionId}});
      earnMessage=`SHARED ✓ +${currency(settled.rewardGameNaira || started.campaign.rewardGameNaira)} Game Naira added.`;
      earnData={campaigns:(earnData?.campaigns||[]).map(c=>c.id===started.campaign.id?{...c,claimed:true}:c)};
      refreshInBackground();
    } catch(error) { earnMessage=error.message || 'The share did not complete. No reward was added.'; }
    finally { earnBusy=false;render(); }
  }
  async function startEarnActivity(activityId) {
    if(earnBusy || earnActivity)return; earnBusy=true;earnMessage='';render();
    try { const result=await api('/api/rewards/activity/start',{method:'POST',body:{activityId}}); earnActivity={...result.activity,activityId,activitySessionId:result.activitySessionId}; earnMessage=`${result.activity.title} started. Stay with it until ${timeOnly(result.activity.readyAt)}.`; clearTimeout(earnTimer); earnTimer=setTimeout(()=>{if(opened&&screen==='earn')render();},Math.max(0,Number(result.activity.readyAt)-Date.now())); }
    catch(error){earnMessage=error.message || 'This activity could not start.';}
    finally{earnBusy=false;render();}
  }
  async function completeEarnActivity() {
    if(!earnActivity || earnBusy)return; earnBusy=true;render();
    try { const result=await api('/api/rewards/activity/complete',{method:'POST',body:{activitySessionId:earnActivity.activitySessionId}}); earnMessage=`+${currency(result.rewardGameNaira)} Game Naira earned.`;earnActivity=null;refreshInBackground(); }
    catch(error){earnMessage=error.message || 'Keep going until the activity is complete.';}
    finally{earnBusy=false;render();}
  }
  async function loadResidents({more=false}={}) {
    if(isBrowserPreview())return;
    const sequence=++residentSequence,owner=profile().id,query=search;residentLoading=true;render();
    try{const result=await api(`/api/residents?q=${encodeURIComponent(query)}${more && residentCursor?`&cursor=${encodeURIComponent(residentCursor)}`:''}`);if(sequence!==residentSequence || profile().id!==owner || search!==query)return;const rows=result.people || [];residentResults=more?[...new Map([...(residentResults || []),...rows].map(r=>[r.id,r])).values()]:rows;residentCursor=result.nextCursor || null;for(const r of rows)if(r?.id)knownResidents.set(r.id,r);}
    catch(error){if(sequence===residentSequence && profile().id===owner)toast?.(error.message || 'Residents could not load.');}
    finally{if(sequence===residentSequence && profile().id===owner){residentLoading=false;render();}}
  }
  async function loadOlderMessages() {
    if(!thread?.id || !messageCursor || olderLoading)return;
    const id=thread.id,sequence=requestSequence,owner=profile().id,scroll=root.querySelector('.ph-scroll'),height=scroll?.scrollHeight || 0,top=scroll?.scrollTop || 0;olderLoading=true;render();
    try{const result=await api(`/api/conversations/${encodeURIComponent(id)}/messages?cursor=${encodeURIComponent(messageCursor)}`);if(sequence!==requestSequence || thread?.id!==id || profile().id!==owner)return;messages=mergePhoneMessages(result.messages || [],messages);messageCursor=result.nextCursor || null;}
    catch(error){if(sequence===requestSequence)toast?.(error.message || 'Earlier messages could not load.');}
    finally{if(sequence===requestSequence && thread?.id===id){olderLoading=false;render();const next=root.querySelector('.ph-scroll');if(next)next.scrollTop=top+next.scrollHeight-height;}}
  }
  const checkoutStorageKey=()=>`abujalife-payment:${profile().id}`;
  function saveCheckout(){try{if(checkout)localStorage.setItem(checkoutStorageKey(),JSON.stringify(checkout));else localStorage.removeItem(checkoutStorageKey());}catch{}}
  async function loadPayments() {
    if(paymentLoading || isBrowserPreview())return;
    const owner=profile().id;paymentLoading=true;paymentError='';render();
    try{const result=await api('/api/payments/config');if(profile().id!==owner)return;paymentConfig=result;
      if(!checkout){try{const saved=JSON.parse(localStorage.getItem(checkoutStorageKey()) || 'null');if(saved?.txRef && typeof saved.txRef==='string'){checkout={...saved,checkoutUrl:saved.checkoutUrl?normalizeCheckoutURL(saved.checkoutUrl):undefined};}}catch{}}
      const params=new URLSearchParams(location.search),ref=params.get('tx_ref') || params.get('payment_ref');
      if(ref && ref.length<200){checkout=checkout?.txRef===ref?checkout:{txRef:ref};const id=params.get('transaction_id');if(id && /^\d{1,24}$/.test(id)){checkout.transactionId=id;drafts.set('paymentTransactionId',id);}saveCheckout();}
      if(checkout?.txRef){const pending=checkout;try{const status=await api(`/api/payments/status?txRef=${encodeURIComponent(pending.txRef)}`);if(profile().id!==owner)return;if(status.payment?.txRef===pending.txRef){const saved=status.payment;checkout={...pending,...saved,transactionId:saved.transactionId || pending.transactionId,checkoutUrl:saved.checkoutUrl?normalizeCheckoutURL(saved.checkoutUrl):undefined};saveCheckout();}}catch(error){if(profile().id===owner){walletError=error.message || 'The pending payment could not load.';if(error.status===404){checkout=null;saveCheckout();}}}}
    }catch(error){if(profile().id===owner)paymentError=error.message || 'Payment availability could not load.';}
    finally{if(profile().id===owner){paymentLoading=false;render();}}
  }
  async function startCheckout(request) {
    if(!paymentConfig?.enabled){walletError='Payments are currently unavailable.';render();return;}
    const owner=profile().id;
    const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
    busy=true;walletError='';render();
    try{const result=await api('/api/payments/checkout',{method:'POST',body:{amount:request.amount,email:request.email,idempotencyKey:request.idempotencyKey}});if(profile().id!==owner){popup?.close();return;}const saved=result.checkout;if(!saved?.txRef || !saved.checkoutUrl)throw new Error('The provider did not return a checkout link.');const url=normalizeCheckoutURL(saved.checkoutUrl);checkout={...saved,checkoutUrl:url};saveCheckout();if(popup)popup.location.replace(url);else toast?.('Use “Open checkout” to finish payment.');navigate('paymentcheckout');}
    catch(error){popup?.close();if(profile().id===owner)walletError=error.message || 'Checkout could not start. Your game balance has not changed.';}
    finally{if(profile().id===owner){busy=false;render();}}
  }
  async function verifyPayment(transactionId) {
    if(busy || !checkout?.txRef)return;
    const id=String(transactionId || '').trim(),owner=profile().id;if(!/^\d{1,24}$/.test(id)){toast?.('Enter the provider’s numeric transaction ID.');return;}
    busy=true;walletError='';checkout.transactionId=id;saveCheckout();render();
    try{const result=await api('/api/payments/verify',{method:'POST',body:{transactionId:id,txRef:checkout.txRef}});if(profile().id!==owner)return;if(result.payment?.status!=='credited'){walletError=`Payment status: ${result.payment?.status || 'pending'}. Your balance has not been credited yet.`;return;}walletReceipt={kind:'payment',...result.payment,createdAt:result.payment.creditedAt || Date.now()};checkout=null;pendingWallet=null;saveCheckout();refreshInBackground();void loadWallet({quiet:true});navigate('walletreceipt',null,false);}
    catch(error){if(profile().id===owner)walletError=error.message || 'Payment could not be verified yet. You can retry safely.';}
    finally{if(profile().id===owner){busy=false;render();}}
  }
  async function checkPaymentStatus() {
    if(busy || !checkout?.txRef)return;const owner=profile().id;busy=true;walletError='';render();
    try{const result=await api(`/api/payments/status?txRef=${encodeURIComponent(checkout.txRef)}`);if(profile().id!==owner)return;if(result.payment?.status==='credited'){walletReceipt={kind:'payment',...result.payment,createdAt:result.payment.creditedAt || Date.now()};checkout=null;pendingWallet=null;saveCheckout();refreshInBackground();void loadWallet({quiet:true});navigate('walletreceipt',null,false);}else walletError=`Payment is ${result.payment?.status || 'pending'}. Complete checkout, then enter the transaction ID to verify.`;}
    catch(error){if(profile().id===owner)walletError=error.message;}
    finally{if(profile().id===owner){busy=false;render();}}
  }
  async function confirmWallet() {
    if(busy || !pendingWallet)return;
    if(pendingWallet.kind==='payment'){await startCheckout({...pendingWallet});return;}
    const request={...pendingWallet}, owner=profile().id;busy=true;walletError='';render();
    let saved;
    try {
      const body={amount:request.amount,idempotencyKey:request.idempotencyKey,...(request.kind==='transfer'?{residentId:request.residentId,note:request.note || '',...(request.conversationId?{conversationId:request.conversationId}:{})}:{})};
      saved=await api(`/api/wallet/${request.kind==='transfer'?'transfer':'topup'}`,{method:'POST',body});
    } catch(error) {
      if(profile().id===owner)walletError=error.message || 'We could not confirm this request. Try again.';
    } finally {busy=false;}
    if(profile().id!==owner)return;
    if(!saved){render();return;}
    walletReceipt={...request,...saved.transfer,createdAt:saved.transfer?.createdAt || saved.transaction?.createdAt || saved.transaction?.at || Date.now()};if(saved.message?.id && saved.message.conversationId===thread?.id)messages=mergePhoneMessages(messages,[saved.message]);pendingWallet=null;screen='walletreceipt';selected=null;history=[{screen:'wallet',selected:null,search:'',thread:null}];
    if(saved.profile)walletData={...walletData,profile:saved.profile,sourceWallet:profile().wallet};
    // The server already confirmed the operation. Refresh failures must not turn a saved transfer into a retry.
    refreshInBackground();
    void loadWallet({quiet:true});
    for(const name of ['topupAmount','transferAmount','transferNote']){const input=root.querySelector(`[name="${name}"]`);if(input)input.value='';drafts.delete(name);}
    if(request.conversationId){chatTransfer=null;history=[];await openThread(request.conversationId,false);toast?.(`${currency(saved.transfer?.amount ?? request.amount)} sent`);}else navigate('walletreceipt',null,false);
  }
  async function loadTravelQuote() {
    if(profile().activeTrip)return;captureInputs();
    const destination=draft('destination',profile().district),mode=draft('mode','bus'),sequence=++quoteSequence;
    quoteLoading=true;travelQuote=null;quoteError='';render();
    try {const result=await api(`/api/travel/quote?district=${encodeURIComponent(destination)}&mode=${encodeURIComponent(mode)}`);if(sequence!==quoteSequence)return;travelQuote=result.quote || null;}catch(error){if(sequence===quoteSequence)quoteError=error.message || 'Your route is unavailable.';}finally{if(sequence===quoteSequence){quoteLoading=false;if(opened && screen==='ride')render();}}
  }
  function saveThreadScroll() {
    if(screen!=='thread' || !thread?.id)return;
    const scroll=root.querySelector('.ph-thread-scroll');if(scroll)threadScrolls.set(threadKey(thread.id),{top:scroll.scrollTop,bottom:scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<64});
  }
  function resizeComposer() {
    const input=root.querySelector('#ph-message');if(!input)return;
    input.style.height='auto';input.style.height=`${Math.min(120,Math.max(44,input.scrollHeight || 44))}px`;
  }
  function scrollLatest({focus=false,markRead=true}={}) {
    newMessageCount=0;const scroll=root.querySelector('.ph-thread-scroll');if(scroll)scroll.scrollTop=scroll.scrollHeight;
    if(markRead)void markThreadRead();
    render();if(focus)root.querySelector('#ph-message')?.focus({preventScroll:true});
  }
  async function markThreadRead() {
    if(readPending || !opened || screen!=='thread' || !thread?.id || document.hidden)return;
    const owner=profile().id,id=thread.id;readPending=true;
    try{await api(`/api/conversations/${encodeURIComponent(id)}/read`,{method:'POST',body:{}});if(profile().id===owner){const c=cachedConversations.get(id);if(c)cachedConversations.set(id,{...c,unread:0});refreshInBackground();}}
    catch{}finally{if(profile().id===owner)readPending=false;}
  }
  async function openThread(id,push=true) {
    const sequence=++requestSequence,owner=profile().id;
    captureInputs();saveThreadScroll();
    if(push && screen==='thread' && thread?.id!==id)history.push({screen,selected,search,thread});
    const nextDraft=threadDrafts.get(threadKey(id)) || '',saved=threadScrolls.get(threadKey(id)),previousMessages=thread?.id===id?[...messages]:[];
    const input=root.querySelector('#ph-message');if(input)input.value=nextDraft;
    thread=conversations().find(c=>c.id===id) || {id,members:[]};const unreadCount=Number(thread.unread) || 0;
    messages=previousMessages;messageCursor=null;olderLoading=false;typing=null;clearTimeout(typingTimer);typingSentAt=0;threadLoading=true;threadError='';unreadAnchor=null;newMessageCount=0;drafts.set('message',nextDraft);navigate('thread',id,push);
    try {
      const result=await api(`/api/conversations/${encodeURIComponent(id)}/messages`);if(sequence!==requestSequence || profile().id!==owner)return;
      thread=result.conversation || thread;cachedConversations.set(thread.id,thread);for(const r of thread.members || [])if(r.id)knownResidents.set(r.id,r);
      messages=mergePhoneMessages(messages,result.messages || []);messageCursor=result.nextCursor || null;unreadAnchor=phoneUnreadAnchor(messages,unreadCount,owner);threadLoading=false;render();
      const scroll=root.querySelector('.ph-thread-scroll'),anchor=root.querySelector('#ph-unread-anchor');
      if(scroll)scroll.scrollTop=anchor?Math.max(0,anchor.offsetTop-70):saved && !saved.bottom?saved.top:scroll.scrollHeight;
      refreshInBackground();
    } catch(error){if(sequence===requestSequence && profile().id===owner){threadLoading=false;threadError=error.message || 'This conversation could not open.';render();}}
  }
  async function sendChatMessage(request) {
    if(request.status==='sending' || request.ownerId!==profile().id)return;
    request.status='sending';request.error='';render();
    try {
      const result=await api(`/api/conversations/${encodeURIComponent(request.conversationId)}/messages`,{method:'POST',body:{text:request.text,idempotencyKey:request.idempotencyKey}});
      if(profile().id!==request.ownerId)return;
      if(!result.message?.id)throw new Error('The server did not confirm this message. Retry the same send.');
      messageOutbox.delete(request.idempotencyKey);
      if(thread?.id===request.conversationId)messages=mergePhoneMessages(messages,[result.message]);
      const key=threadKey(request.conversationId),current=threadDrafts.get(key);
      if(current===request.draftText){threadDrafts.delete(key);if(thread?.id===request.conversationId){drafts.delete('message');const input=root.querySelector('#ph-message');if(input)input.value='';}}
      // The message response is authoritative for this thread. Refresh the
      // wider bootstrap state in the background so a slow dashboard request
      // never holds the sent bubble or keyboard hostage.
      refreshInBackground();
      if(profile().id!==request.ownerId)return;
      render();if(opened && screen==='thread' && thread?.id===request.conversationId)scrollLatest({focus:true,markRead:false});
    }catch(error){if(profile().id===request.ownerId){request.status='failed';request.error=error.message || 'Connection interrupted. Retry when you’re ready.';render();}}
  }
  async function startDM(id) {
    const existing=conversations().find(c=>c.kind==='dm'&&(c.members||[]).some(m=>(m.id||m.residentId)===id));
    if(existing?.id){void openThread(existing.id);return;}
    const owner=profile().id,peer=resident(id),pendingId=`pending-dm:${id}`;
    // Paint the conversation immediately. Creating the server conversation can
    // finish behind this shell instead of making a resident card feel dead.
    navigate('thread',id);
    thread={id:pendingId,kind:'dm',members:[{id:owner,displayName:profile().displayName,username:profile().username,appearance:profile().appearance},...(peer?[{...peer,id}]:[])]};
    messages=[];messageCursor=null;olderLoading=false;typing=null;clearTimeout(typingTimer);threadLoading=true;threadError='';unreadAnchor=null;newMessageCount=0;render();
    try{
      const result=await api('/api/conversations',{method:'POST',body:{residentId:id}});
      if(profile().id!==owner||thread?.id!==pendingId)return;
      if(!result?.conversation?.id)throw new Error('This conversation could not open.');
      cachedConversations.set(result.conversation.id,result.conversation);
      await openThread(result.conversation.id,false);
    }catch(error){if(profile().id===owner&&thread?.id===pendingId){threadLoading=false;threadError=error.message||'This conversation could not open.';render();}}
  }
  async function handleAction(el) {
    const {phAction:action,id,app,view,value,accept,tenure,key,venueId}=el.dataset;
    if(browser.handleAction(el))return;
    if(await social.action(el))return;
    if(action==='noop')return;
    if(action==='dismiss' && el!==eventTargetBackdrop)return;
    switch(action) {
      case 'close':case 'dismiss':close();break;
      case 'unlock':locked=false;screen='home';history=[];render();break;
      case 'lock':locked=true;render();break;
      case 'home':locked=false;screen='home';history=[];render();break;
      case 'back':goBack();break;
      case 'app':if(screen==='walletreceipt' && app==='wallet'){history=[];navigate(app,null,false);}else navigate(app);break;
      case 'property-investments':close();onNavigate?.('property',{tab:'investments',source:'phone'});break;
      case 'wallet-topup':walletError='';navigate('topup');break;
      case 'wallet-send':chatTransfer=null;walletError='';refreshInBackground();navigate('transfer');break;
      case 'wallet-home':navigate('wallet');break;
      case 'wallet-refresh':await loadWallet();break;
      case 'earn-share':await startEarnShare();break;
      case 'earn-activity':await startEarnActivity(id);break;
      case 'earn-activity-complete':await completeEarnActivity();break;
      case 'residents-more':await loadResidents({more:true});break;
      case 'messages-older':await loadOlderMessages();break;
      case 'messages-latest':scrollLatest();break;
      case 'inbox-filter':inboxFilter=value;render();break;
      case 'inbox-more':await loadConversations({more:true});break;
      case 'inbox-refresh':await loadConversations();break;
      case 'compose-search':{const query=search;navigate('compose');search=query;render();void loadResidents();break;}
      case 'message-retry':{const request=messageOutbox.get(key);if(request)await sendChatMessage(request);break;}
      case 'chat-invite':if(chatPeer()?.id===id){drafts.set('inviteKind','home');navigate('invite',id);}break;
      case 'chat-visit':{const peer=chatPeer();if(peer?.id===id){close();onNavigate?.('world',{homeVisits:true,visitResidentId:id,visitSearch:peer.username || peer.displayName,source:'phone'});}break;}
      case 'chat-send-money':{const peer=chatPeer();if(!peer || peer.id!==id || isBrowserPreview() || walletMeta().transferEnabled===false)break;if(chatTransfer?.conversationId===thread.id){if(!busy){chatTransfer=null;pendingWallet=null;render();}break;}captureInputs();chatTransfer={ownerId:profile().id,conversationId:thread.id,peer,stage:'entry'};selected=id;walletError='';pendingWallet=null;drafts.delete('transferAmount');drafts.delete('transferNote');render();root.querySelector('.ph-scroll')?.scrollTo(0,0);await loadWallet({quiet:true});break;}
      case 'chat-money-close':if(!busy){captureInputs();chatTransfer=null;pendingWallet=null;walletError='';render();}break;
      case 'chat-money-amount':case 'chat-money-max':{const amount=action==='chat-money-max'?Math.floor(walletProfile().wallet || 0):Number(el.dataset.amount);if(Number.isSafeInteger(amount) && amount>0 && amount<=Math.floor(walletProfile().wallet || 0)){drafts.set('transferAmount',String(amount));const input=root.querySelector('#ph-transferAmount');if(input)input.value=String(amount);updateMoneyAmount();}break;}
      case 'chat-return':await openThread(id,false);break;
      case 'payment-config-refresh':await loadPayments();break;
      case 'payment-resume':navigate('paymentcheckout');break;
      case 'payment-status':await checkPaymentStatus();break;
      case 'wallet-amount':{const input=root.querySelector('#ph-topupAmount');drafts.set('topupAmount',el.dataset.amount);if(input)input.value=el.dataset.amount;break;}
      case 'wallet-recipient':chatTransfer=null;walletError='';navigate('transferform',id);break;
      case 'wallet-confirm':await confirmWallet();break;
      case 'wallet-edit':if(pendingWallet){walletError='';if(chatTransfer?.conversationId===thread?.id && screen==='thread'){chatTransfer.stage='entry';render();}else navigate(pendingWallet.kind==='transfer'?'transferform':'topup',pendingWallet.residentId || null,false);}break;
      case 'vehicle-color':{const color=el.dataset.color;const item=entries(state().catalog).find(i=>i.id===id);if(!item || !VEHICLE_COLORS.some(c=>c.id===color))break;drafts.set(`vehicleColor-${id}`,color);if((profile().inventory || []).includes(id)){const result=await mutate('/api/action',{action:'paint-vehicle',payload:{itemId:id,color,idempotencyKey:vehicleRequestKey('paint',id,color)}},'Paint colour updated');if(result)vehicleRequests.delete(`paint:${id}:${color}`);else await refresh().catch(()=>{});}else render();break;}
      case 'compose':navigate('compose');break;
      case 'thread':await openThread(id);break;
      case 'dm':await startDM(id);break;
      case 'person':case 'item':case 'homeproperty':case 'event':case 'invite':case 'report':navigate(action,id);break;
      case 'newgroup':groupMembers.clear();drafts.delete('groupName');navigate('newgroup');break;
      case 'newevent':navigate('newevent');break;
      case 'navigate':close();onNavigate?.(view,{id,district:id,venueId,source:'phone'});break;
      case 'friend-request':await mutate('/api/friends/request',{residentId:id},'Friend request sent');break;
      case 'friend-remove':await mutate('/api/friends/remove',{residentId:id},'Friend removed');break;
      case 'friend-respond':await mutate('/api/friends/respond',{requestId:id,accept:accept==='true'},accept==='true'?'Friend request accepted':'Request declined');break;
      case 'block':await mutate('/api/moderation/block',{residentId:id,blocked:value==='true'},value==='true'?'Resident blocked':'Resident unblocked');break;
      case 'mute':await mutate('/api/moderation/mute',{residentId:id,muted:value==='true'},value==='true'?'Resident muted':'Resident unmuted');break;
      case 'setting':await mutate('/api/profile',{settings:{[key]:profile().settings?.[key]===false}},'Settings saved');break;
      case 'sound':await mutate('/api/profile',{settings:{soundEnabled:profile().settings?.soundEnabled===false}},'Sound setting saved');break;
      case 'read-all':await mutate('/api/notifications/read',{});break;
      case 'notice': {
        const n=entries(state().notifications).find(n=>n.id===id);
        const convId=n?.conversationId || n?.data?.conversationId || n?.payload?.conversationId || (n?.link?.startsWith('conversation:')?n.link.slice(13):null);
        // Navigate first. Marking a notification read is housekeeping and must
        // never sit between a tap and the destination screen.
        if(convId)void openThread(convId);else if(n?.link==='friends' || n?.kind==='friend-request')navigate('friends');else if(n?.eventId)navigate('event',n.eventId);
        void api('/api/notifications/read',{method:'POST',body:{id}}).then(()=>refreshInBackground()).catch(()=>{});
        break;
      }
      case 'invite-respond':await mutate('/api/invitations/respond',{id,accept:accept==='true'},accept==='true'?'Invitation accepted. Travel when you’re ready.':'Invitation declined');break;
      case 'rsvp':await mutate(`/api/events/${encodeURIComponent(id)}/rsvp`,{attending:value==='true'},value==='true'?'Your RSVP is saved':'RSVP cancelled');break;
      case 'purchase':{const item=entries(state().catalog).find(i=>i.id===id),color=draft(`vehicleColor-${id}`,item?.defaultColor);const result=await mutate('/api/action',{action:'purchase',payload:{itemId:id,...(item?.category==='vehicle'?{color,idempotencyKey:vehicleRequestKey('purchase',id,color)}:{})}},'Item added to your inventory');if(result){vehicleRequests.delete(`purchase:${id}:${color}`);if(item?.category==='furniture'){close();onNavigate?.('world',{furnishItemId:id,source:'phone'});}}else await refresh().catch(()=>{});break;}
      case 'sell-item':close();onNavigate?.('world',{sellItemId:id,source:'phone'});break;
      case 'equip':await mutate('/api/action',{action:'equip',payload:{itemId:id}},'Outfit updated');break;
      case 'furnish':close();onNavigate?.('world',{furnishItemId:id,source:'phone'});break;
      case 'drive':{const r=await mutate('/api/action',{action:'toggle-driving',payload:{vehicleId:profile().drivingVehicle===id?null:id}},profile().drivingVehicle===id?'You are on foot':'You are at the wheel');if(r){close();onNavigate?.('world',{source:'phone'});}break;}
      case 'move-home':{const r=await mutate('/api/action',{action:'move-home',payload:{propertyId:id,tenure}},'Your new home is secured. Choose transport to move in.');if(r){close();onNavigate?.('world',{source:'phone'});}break;}
      case 'incoming': {const convId=incoming?.conversationId || (incoming?.link?.startsWith('conversation:')?incoming.link.slice(13):null);incoming=null;locked=false;if(convId)await openThread(convId);else navigate('notifications');break;}
    }
  }
  let eventTargetBackdrop=null;
  function updateMoneyAmount(){const label=root.querySelector('#ph-money-review span');if(label){const value=Number(draft('transferAmount'));label.textContent=`Review ${Number.isSafeInteger(value)&&value>0?currency(value):'transfer'}`;}}
  const onClick=e=>{const el=e.target.closest('[data-ph-action]');if(!el || !root.contains(el))return;eventTargetBackdrop=e.target.classList.contains('ph-backdrop')?e.target:null;void handleAction(el);};
  const onInput=e=>{
    const el=e.target;
    social.input(el);
    if(el.name && el.type!=='checkbox')drafts.set(el.name,el.value);
    if(el.name==='transferAmount')updateMoneyAmount();
    if(el.name==='search'){search=el.value;render();if(['contacts','compose','transfer'].includes(screen)){residentSequence++;residentResults=null;residentCursor=null;clearTimeout(residentSearchTimer);residentSearchTimer=setTimeout(()=>void loadResidents(),250);}}
    if(el.name==='message' && thread && screen==='thread'){threadDrafts.set(threadKey(thread.id),el.value);resizeComposer();const send=root.querySelector('.ph-send');if(send)send.disabled=!el.value.trim();if(el.value.trim() && Date.now()-typingSentAt>1800){typingSentAt=Date.now();api('/api/typing',{method:'POST',body:{conversationId:thread.id}}).catch(()=>{});}}
  };
  const onChange=e=>{if(e.target.name==='socialPhoto'){void social.change(e.target);return;}if(e.target.name==='groupMember'){e.target.checked?groupMembers.add(e.target.value):groupMembers.delete(e.target.value);}else if(e.target.name)drafts.set(e.target.name,e.target.value);if(screen==='ride' && ['destination','mode'].includes(e.target.name))void loadTravelQuote();};
  const onSubmit=async e=>{
    const form=e.target.closest('[data-ph-form]');if(!form)return;e.preventDefault();captureInputs();const values=Object.fromEntries(new FormData(form));
    if(browser.handleSubmit(form,values))return;
    if(await social.submit(form,values))return;
    if(form.dataset.phForm==='payment-verify'){await verifyPayment(values.paymentTransactionId);return;}
    if(form.dataset.phForm==='wallet-payment'){
      if(busy || !paymentConfig?.enabled || isBrowserPreview())return;
      const amount=Number(values.topupAmount),min=paymentConfig.minAmount || 100,max=paymentConfig.maxAmount || Number.MAX_SAFE_INTEGER,email=String(values.paymentEmail || '').trim(),credits=Math.round(amount*(Number(paymentConfig.creditRate) || 1));
      if(!Number.isSafeInteger(amount) || amount<min || amount>max || !Number.isSafeInteger(credits) || !email){toast?.('Choose a valid whole Naira amount and receipt email.');return;}
      const same=pendingWallet?.kind==='payment' && pendingWallet.amount===amount && pendingWallet.email===email;
      pendingWallet={kind:'payment',amount,email,credits,idempotencyKey:same?pendingWallet.idempotencyKey:makeRequestKey()};walletError='';navigate('walletreview');return;
    }
    if(form.dataset.phForm==='wallet-topup' || form.dataset.phForm==='wallet-transfer') {
      if(busy)return;const transfer=form.dataset.phForm==='wallet-transfer', amount=Number(values[transfer?'transferAmount':'topupAmount']);
      const min=transfer?1:walletMeta().topupMin || 1000,max=transfer?Math.floor(walletProfile().wallet || 0):Number.MAX_SAFE_INTEGER;
      if(!Number.isSafeInteger(amount) || amount<min || amount>max){toast?.(`Choose a whole Naira amount between ${currency(min)} and ${currency(max)}.`);return;}
      const recipient=transfer?transferRecipient(selected):null;
      if(transfer && (!recipient || isBrowserPreview())){toast?.('Choose a registered resident to receive your transfer.');return;}
      const note=(values.transferNote || '').trim().slice(0,120);
      const same=pendingWallet?.kind===(transfer?'transfer':'topup') && pendingWallet.amount===amount && pendingWallet.residentId===(recipient?.id || undefined) && (pendingWallet.note || '')===note && (pendingWallet.conversationId || null)===(chatTransfer?.conversationId || null);
      pendingWallet={kind:transfer?'transfer':'topup',amount,...(recipient?{residentId:recipient.id,recipientName:recipient.displayName || recipient.username,recipientUsername:recipient.username,note,...(chatTransfer?.ownerId===profile().id?{conversationId:chatTransfer.conversationId}:{})}:{}),idempotencyKey:same?pendingWallet.idempotencyKey:makeRequestKey()};
      walletError='';if(transfer && chatTransfer?.conversationId===thread?.id && screen==='thread'){chatTransfer.stage='review';render();root.querySelector('.ph-scroll')?.scrollTo(0,0);}else navigate('walletreview');return;
    }
    if(form.dataset.phForm==='message') {
      const submitted=String(values.message || ''),text=submitted.trim();if(!text || !thread || threadLoading || threadError)return;
      const existing=pendingMessages(thread.id).find(p=>p.text===text && p.status==='failed');
      if(!existing && pendingMessages(thread.id).some(p=>p.text===text && p.status!=='failed'))return;
      const request=existing || {ownerId:profile().id,conversationId:thread.id,text,draftText:submitted,idempotencyKey:makeRequestKey(),status:'queued',error:''};
      messageOutbox.set(request.idempotencyKey,request);void sendChatMessage(request);return;
    }
    if(form.dataset.phForm==='group') {if(!groupMembers.size){toast?.('Choose at least one friend.');return;}const r=await mutate('/api/conversations',{kind:'group',name:values.groupName.trim(),memberIds:[...groupMembers]},'Group created');if(r?.conversation)await openThread(r.conversation.id);}
    if(form.dataset.phForm==='travel') {if(!travelQuote || quoteLoading || travelQuote.destination!==values.destination || travelQuote.mode!==(values.mode || 'bus')){await loadTravelQuote();return;}const r=await mutate('/api/action',{action:'travel',payload:{district:values.destination,mode:values.mode || 'bus'}},'Your journey has started');if(r){close();onNavigate?.('world',{source:'phone'});}}
    if(form.dataset.phForm==='event') {const startsAt=new Date(`${values.eventDate}:00+01:00`).getTime();if(!Number.isFinite(startsAt)){toast?.('Choose a valid event time.');return;}const r=await mutate('/api/events',{title:values.eventTitle.trim(),district:values.eventDistrict,startsAt,description:values.eventDescription},'Event created');if(r){for(const key of ['eventTitle','eventDescription','eventDate']){const input=root.querySelector(`#ph-${key}`);if(input)input.value='';drafts.delete(key);}navigate('events');}}
    if(form.dataset.phForm==='invite') {const r=await mutate('/api/invitations',{residentId:selected,kind:values.inviteKind,district:values.inviteDistrict,activity:values.inviteActivity,note:values.inviteNote},'Invitation sent');if(r)goBack();}
    if(form.dataset.phForm==='report') {const r=await mutate('/api/moderation/report',{residentId:selected,reason:values.reportReason.trim()},'Report saved for moderation review');if(r){const input=root.querySelector('#ph-reportReason');if(input)input.value='';drafts.delete('reportReason');goBack();}}
  };
  const onKey=e=>{
    if(!opened)return;
    if(e.key==='Escape'){e.preventDefault();screen!=='home' && !locked?goBack():close();}
    if(e.key==='Enter' && !e.shiftKey && !e.isComposing && e.target.id==='ph-message'){e.preventDefault();e.target.form?.requestSubmit();}
    if(e.key==='Tab') {const els=[...root.querySelectorAll('button:not([disabled]),input,textarea,select,[tabindex="0"]')].filter(el=>el.getClientRects().length);if(!els.length)return;const first=els[0],last=els.at(-1);if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}}
  };
  async function open(app,details={}) {syncAccount();priorFocus=document.activeElement;opened=true;document.body.classList.add('phone-is-open');if(app){locked=false;screen=app;history=[];search='';}render();root.querySelector(locked?'.ph-unlock':screen==='home'?'.ph-app-grid .ph-launcher':'.ph-back')?.focus({preventScroll:true});clockTimer ||= setInterval(()=>{if(opened){const el=root.querySelector('.ph-clock');if(el)el.textContent=timeOnly(new Date());const lockTime=root.querySelector('.ph-lock-time');if(lockTime)lockTime.textContent=timeOnly(new Date());if(['social','socialstatuses','socialstatus'].includes(screen) && Math.floor(serverNow()/1000)%30===0)social.expire();}},1000);if(app==='messages' && details.conversationId)await openThread(details.conversationId);else if(app==='messages')await loadConversations();else if(app==='ride')await loadTravelQuote();else if(app==='wallet')await loadWallet();else if(app==='topup' || app==='paymentcheckout')await loadPayments();else if(['contacts','compose','transfer'].includes(app))await loadResidents();else if(['social','socialstatuses'].includes(app))await social.load();}
  function close() {captureInputs();saveThreadScroll();opened=false;document.body.classList.remove('phone-is-open');render();if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true});}
  function sound() {if(profile().settings?.soundEnabled===false)return;try {const Context=window.AudioContext || window.webkitAudioContext;if(!Context)return;const ctx=new Context(), osc=ctx.createOscillator(), gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.type='sine';osc.frequency.setValueAtTime(880,ctx.currentTime);osc.frequency.setValueAtTime(1174,ctx.currentTime+.07);gain.gain.setValueAtTime(.025,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.18);osc.start();osc.stop(ctx.currentTime+.2);osc.onended=()=>ctx.close();}catch{}}
  function handleEvent(type,data) {
    syncAccount();if(!profile().id)return;
    if(type==='presence'&&data.resident?.id){const live=data.resident;knownResidents.set(live.id,{...knownResidents.get(live.id),...live});if(residentResults)residentResults=residentResults.map(row=>row.id===live.id?{...row,...live}:row);}
    social.handleEvent(type,data);
    if((type==='profile' || type==='notification' && /transfer/i.test(data.notification?.kind || data.kind || '')) && opened && ['wallet','topup','transfer','transferform','walletreview','walletreceipt'].includes(screen))void loadWallet({quiet:true});
    if(type==='typing' && screen==='thread' && data.conversationId===thread?.id && (data.residentId || data.userId || data.senderId)!==profile().id && !(state().blocked || []).includes(data.residentId || data.userId || data.senderId)){const who=data.residentId || data.userId || data.senderId;if(data.state==='idle'){if(typing && (typing.residentId || typing.userId || typing.senderId)===who){typing=null;clearTimeout(typingTimer);if(opened)render();}return;}const windowMs=data.state==='recording'?8000:3500;const expires=Number(data.at || data.createdAt || serverNow())+windowMs-serverNow();if(expires>0){typing=data;clearTimeout(typingTimer);typingTimer=setTimeout(()=>{typing=null;if(opened)render();},Math.min(windowMs,expires));if(opened)render();}}
    if(type==='message' || type==='receipt') {
      const m=data.message || data;if((state().blocked || []).includes(m.senderId))return;
      if(m.receipt || type==='receipt' && (m.readAt || m.deliveredAt)){if(thread?.id===m.conversationId){messages=messages.map(row=>({...row,...(row.createdAt<=m.readAt?{readBy:[...new Set([...(row.readBy || []),m.residentId])]}:{}),...(row.createdAt<=m.deliveredAt?{deliveredTo:[...new Set([...(row.deliveredTo || []),m.residentId])]}:{})}));if(opened)render();}return;}
      if(m.id && m.conversationId===thread?.id){const existed=messages.some(row=>row.id===m.id),scroll=root.querySelector('.ph-thread-scroll'),atBottom=scroll && scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<64;messages=mergePhoneMessages(messages,[m]);typing=null;clearTimeout(typingTimer);if(opened && screen==='thread'){if(!existed && m.senderId!==profile().id && !atBottom)newMessageCount++;render();if(atBottom && !document.hidden)void markThreadRead();}}
      if(m.senderId && m.senderId!==profile().id && !(state().blocked || []).includes(m.senderId) && !(state().muted || []).includes(m.senderId) && !(opened && screen==='thread' && m.conversationId===thread?.id)){incoming={name:nameById(m.senderId),conversationId:m.conversationId};sound();clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>{incoming=null;if(opened)render();},7000);}
    }
    if((type==='notification' || type==='invitation') && !(state().muted || []).includes(data.actorId || data.notification?.actorId || data.fromId || data.invitation?.fromId)){const n=data.notification || data.invitation || data;if(type==='notification' && n.link===`conversation:${thread?.id}` && opened && screen==='thread')return;incoming={name:type==='invitation'?'New invitation':n.title || 'New activity',...n};if(type==='invitation' || n.kind!=='message')sound();clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>{incoming=null;if(opened)render();},7000);}
    if(opened && type!=='typing')render();
  }
  const onScroll=e=>{
    if(screen!=='thread' || !e.target.classList?.contains('ph-thread-scroll'))return;
    saveThreadScroll();const scroll=e.target;
    if(newMessageCount && scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<64){newMessageCount=0;void markThreadRead();const indicator=root.querySelector('.ph-new-messages');indicator?.remove();}
  };
  function syncChatViewport() {
    const viewport=window.visualViewport;
    if(!opened || screen!=='thread' || !viewport){
      root.style.removeProperty('--ph-chat-viewport-height');root.style.removeProperty('--ph-chat-viewport-top');
      root.style.removeProperty('--ph-chat-device-height');root.classList.remove('phone-keyboard-open');return;
    }
    root.style.setProperty('--ph-chat-viewport-height',`${viewport.height}px`);root.style.setProperty('--ph-chat-viewport-top',`${viewport.offsetTop}px`);
    // Keep the device frame at its normal size. Only the conversation column is
    // resized when iOS reduces the visual viewport for the native keyboard.
    const keyboardOpen=Boolean(document.activeElement?.matches?.('#ph-message')) && viewport.height < Math.max(520,window.innerHeight-120);
    if(keyboardOpen && !root.style.getPropertyValue('--ph-chat-device-height')){
      const device=root.querySelector('.ph-device');
      const height=device?.getBoundingClientRect?.().height;
      if(height)root.style.setProperty('--ph-chat-device-height',`${height}px`);
    }
    if(!keyboardOpen)root.style.removeProperty('--ph-chat-device-height');
    root.classList.toggle('phone-keyboard-open',keyboardOpen);
  }
  const onViewport=()=>{syncChatViewport();const input=root.querySelector('#ph-message');if(document.activeElement===input)resizeComposer();};
  const onFocusIn=event=>{if(event.target?.matches?.('#ph-message')){syncChatViewport();requestAnimationFrame(()=>{const scroll=root.querySelector('.ph-thread-scroll');if(scroll && scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<96)scroll.scrollTop=scroll.scrollHeight;});}};
  root.hidden=true;root.classList.add('phone-root');root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onChange);root.addEventListener('submit',onSubmit);root.addEventListener('scroll',onScroll,true);root.addEventListener('focusin',onFocusIn);window.visualViewport?.addEventListener('resize',onViewport);window.visualViewport?.addEventListener('scroll',onViewport);document.addEventListener('keydown',onKey);
  return {open,close,render,handleEvent,dispose(){close();clearInterval(clockTimer);clearTimeout(typingTimer);clearTimeout(bannerTimer);clearTimeout(residentSearchTimer);root.removeEventListener('click',onClick);root.removeEventListener('input',onInput);root.removeEventListener('change',onChange);root.removeEventListener('submit',onSubmit);root.removeEventListener('scroll',onScroll,true);root.removeEventListener('focusin',onFocusIn);window.visualViewport?.removeEventListener('resize',onViewport);window.visualViewport?.removeEventListener('scroll',onViewport);document.removeEventListener('keydown',onKey);}};
}

import { avatarSVG } from './world.js';
import { vehicleIllustration } from './vehicle-art.js';
import { enhanceProductPreviews } from './product-3d.js';
import { VEHICLE_COLORS } from '../src/shared/vehicles.mjs';

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
const apps = [
  ['messages','Messages','green'],['contacts','Contacts','sand'],['calls','Calls','green'],['map','Map','blue'],
  ['ride','Ride','ink'],['jobs','Jobs','blue'],['wallet','Wallet','ink'],['property','Property','amber'],
  ['market','Okrika','orange'],['events','Events','cream'],['profile','Camera','ink'],['friends','Friends','coral'],
  ['groups','Groups','violet'],['notifications','Activity','coral'],['settings','Settings','silver']
];

function portrait(resident, className='') {
  const initials=(resident?.displayName || resident?.username || 'Resident').split(/\s+/).map(n=>n[0]).slice(0,2).join('').toUpperCase();
  return `<span class="ph-avatar ${className}" aria-label="${esc(resident?.displayName || 'Resident')}">${avatarSVG(resident?.appearance || {},{size:60})}<span class="ph-avatar-fallback">${esc(initials)}</span>${resident?.online?'<i class="ph-online"></i>':''}</span>`;
}

export function createPhone({ root, getState, api, onUpdate, onNavigate, toast }) {
  let opened=false, locked=true, screen='home', history=[], selected=null, busy=false, search='', thread=null, messages=[], typing=null, incoming=null, priorFocus=null, requestSequence=0, groupMembers=new Set();
  const drafts=new Map(), threadDrafts=new Map(), knownResidents=new Map(), vehicleRequests=new Map();
  let accountId=null;
  let walletData=null, walletLoading=false, walletError='', walletSequence=0, pendingWallet=null, walletReceipt=null;
  const isBrowserPreview=()=>state().preview?.mode==='browser' || document.documentElement.dataset.preview==='browser';
  const walletProfile=()=>walletData?.profile && walletData.sourceWallet===profile().wallet?walletData.profile:profile();
  const walletMeta=()=>walletData?.walletMeta || state().walletMeta || {};
  const eligibleRecipients=()=>[...new Map([...friends(),...people()].filter(r=>r?.id && r.id!==profile().id && !(state().blocked || []).includes(r.id)).map(r=>[r.id,r])).values()];
  const makeRequestKey=()=>globalThis.crypto?.randomUUID?.() || `wallet-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const vehicleRequestKey=(action,itemId,color)=>{const key=`${action}:${itemId}:${color}`;if(!vehicleRequests.has(key))vehicleRequests.set(key,makeRequestKey());return vehicleRequests.get(key);};
  let travelQuote=null, quoteLoading=false, quoteError='', quoteSequence=0;
  let clockTimer, typingTimer, bannerTimer, typingSentAt=0;
  const state=()=>getState() || {};
  const profile=()=>state().profile || {};
  const people=()=>entries(state().people);
  const friends=()=>entries(state().friends).map(r=>r.resident || r.profile || (typeof r==='string'?people().find(p=>p.id===r):r)).filter(Boolean);
  const resident=id=>{const r=people().find(r=>r.id===id) || friends().find(r=>r.id===id) || knownResidents.get(id) || (id===profile().id?profile():null);return (state().blocked || []).includes(id) && r?{...r,online:false,district:null,location:null}:r;};
  const place=id=>entries(state().atlas).find(r=>r.id===id);
  const locationLabel=()=>profile().activeTrip?'On the road':profile().location?.kind==='home'?'At home':profile().location?.kind==='venue'?(entries(state().venues).find(v=>v.id===profile().location.venue)?.name || 'Inside a venue'):profile().drivingVehicle?'Driving your car':'Out in the city';
  const ownsCar=()=>entries(state().catalog).some(i=>i.category==='vehicle'&&(profile().inventory || []).includes(i.id));
  const conversations=()=>entries(state().conversations);
  const unread=()=>conversations().reduce((n,c)=>n+Number(c.unread || 0),0);
  const pendingInvites=()=>entries(state().invitations).filter(i=>(i.to===profile().id || i.toId===profile().id) && i.status==='pending');
  const requests=()=>entries(state().friendRequests).filter(r=>(r.to===profile().id || r.toId===profile().id) && r.status==='pending');
  const noticeCount=()=>entries(state().notifications).filter(n=>!n.read && !n.readAt).length + pendingInvites().length;
  const appTitle=()=>({home:'',thread:conversationName(thread),person:resident(selected)?.displayName || 'Resident',compose:'New message',newgroup:'New group',invite:'Invite a resident',report:'Report',event:'Event',newevent:'Create event',item:'Okrika Marketplace',homeproperty:'Property',blocked:'Blocked residents',muted:'Muted residents',profile:'Camera & profile',notifications:'Activity',ride:'Ride & transport',market:'Okrika Marketplace',wallet:'Naira wallet',topup:'Add Naira',transfer:'Send Naira',transferform:'Send Naira',walletreview:'Review',walletreceipt:'Receipt'}[screen] || apps.find(a=>a[0]===screen)?.[1] || 'Phone');
  const conversationName=c=>c?.kind==='group'?c.name || 'Group':c?.members?.filter(m=>(m.id || m.residentId)!==profile().id).map(m=>m.displayName || resident(m.id || m.residentId)?.displayName || 'Resident').join(', ') || c?.name || 'Conversation';
  const badge=id=>id==='messages'?unread():id==='notifications'?noticeCount():id==='friends'?requests().length:0;
  const nameById=id=>resident(id)?.displayName || 'Resident';
  const button=(label,action,extra='',kind='')=>`<button type="button" class="ph-button ${kind}" data-ph-action="${action}" ${extra}>${label}</button>`;
  const empty=(name,text,action='',label='')=>`<div class="ph-empty">${icon(name)}<strong>${esc(text)}</strong>${action?button(label,action):''}</div>`;
  const headline=(eyebrow,title,description='')=>`<div class="ph-page-intro"><small>${esc(eyebrow)}</small><h2>${esc(title)}</h2>${description?`<p>${esc(description)}</p>`:''}</div>`;
  const searchField=placeholder=>`<label class="ph-search">${icon('search')}<input id="ph-search" name="search" aria-label="${esc(placeholder)}" placeholder="${esc(placeholder)}" value="${esc(search)}" autocomplete="off"></label>`;
  const match=r=>!search || `${r.displayName || ''} ${r.username || ''} ${r.name || ''} ${r.title || ''}`.toLowerCase().includes(search.toLowerCase());
  const draft=(key,fallback='')=>drafts.get(key) ?? fallback;
  const field=(name,label,value='',type='text',attrs='')=>`<label class="ph-field"><span>${esc(label)}</span><input id="ph-${name}" name="${name}" type="${type}" value="${esc(draft(name,value))}" ${attrs}></label>`;
  const districtOptions=selectedId=>entries(state().atlas).map(p=>`<option value="${esc(p.id)}" ${p.id===selectedId?'selected':''}>${esc(p.name)}${p.kind==='town'?' · FCT town':''}</option>`).join('');
  function captureInputs() {
    root.querySelectorAll('input[name],textarea[name],select[name]').forEach(el=>{ if(el.type!=='checkbox' && (el.type!=='radio' || el.checked)) {drafts.set(el.name,el.value);if(el.name==='message' && thread?.id)threadDrafts.set(thread.id,el.value);} });
  }
  function syncAccount() {
    const next=profile().id || null;if(next===accountId)return;accountId=next;locked=true;screen='home';history=[];selected=null;thread=null;messages=[];typing=null;incoming=null;drafts.clear();threadDrafts.clear();knownResidents.clear();vehicleRequests.clear();groupMembers.clear();travelQuote=null;quoteError='';quoteLoading=false;requestSequence++;quoteSequence++;walletSequence++;walletData=null;walletLoading=false;walletError='';pendingWallet=null;walletReceipt=null;root.innerHTML='';
  }
  function render() {
    syncAccount();
    if(!profile().id){opened=false;document.body.classList.remove('phone-is-open');}
    for(const r of [...people(),...friends(),...conversations().flatMap(c=>c.members || [])])if(r?.id)knownResidents.set(r.id,r);
    if(!opened) { root.innerHTML=''; root.hidden=true; return; }
    captureInputs();
    const active=root.contains(document.activeElement)?document.activeElement:null;
    const focusedId=active?.id, start=active?.selectionStart, end=active?.selectionEnd;
    const scroll=root.querySelector('.ph-scroll'), scrollTop=scroll?.scrollTop || 0, atBottom=scroll && scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<80;
    root.hidden=false;
    root.innerHTML=`<div class="ph-backdrop" data-ph-action="dismiss"><section class="ph-device" role="dialog" aria-modal="true" aria-labelledby="ph-device-name"><span class="ph-hardware ph-action-button" aria-hidden="true"></span><button class="ph-hardware ph-volume" data-ph-action="sound" aria-label="${profile().settings?.soundEnabled===false?'Enable':'Mute'} phone sounds"></button><button class="ph-hardware ph-power" data-ph-action="lock" aria-label="Lock phone"></button><div class="ph-screen ${locked?'ph-locked':screen==='home'?'ph-home':'ph-app'}"><div class="ph-wallpaper"><i></i><i></i><i></i><i></i><i></i><span></span></div><div class="ph-statusbar"><span class="ph-clock">${timeOnly(new Date())}</span><span class="ph-status-icons">${icon('signal')}${icon('wifi')}<span class="ph-battery" aria-label="Virtual phone"></span></span></div><button class="ph-island ${incoming?'ph-island-active':''}" data-ph-action="${incoming?'incoming':'home'}" aria-label="${incoming?'Open incoming activity':'Go to phone home'}">${incoming?`${icon('messages')}<span>${esc(incoming.name || 'New activity')}</span>`:'<i></i>'}</button>${locked?lockScreen():screen==='home'?homeScreen():appScreen()}<button class="ph-home-indicator" data-ph-action="${locked?'unlock':'home'}" aria-label="${locked?'Unlock phone':'Go to phone home'}"></button></div><div class="ph-device-caption"><span id="ph-device-name">iPhone 18 Pro Max</span><button data-ph-action="close" aria-label="Put your phone away">Put away ${icon('close')}</button></div>${busy?'<div class="ph-working" role="status">Working…</div>':''}</section></div>`;
    enhanceProductPreviews(root);
    const nextScroll=root.querySelector('.ph-scroll');
    if(nextScroll) nextScroll.scrollTop=screen==='thread' && atBottom?nextScroll.scrollHeight:scrollTop;
    const restore=focusedId && root.querySelector(`#${CSS.escape(focusedId)}`);
    if(restore) { restore.focus({preventScroll:true}); try {restore.setSelectionRange(start,end);} catch {} }
  }
  function lockScreen() {
    const now=new Date(), notifs=entries(state().notifications).filter(n=>!n.read && !n.readAt).slice(0,2);
    return `<div class="ph-lock-content">${icon('lock','ph-lock-symbol')}<div class="ph-lock-date">${now.toLocaleDateString('en-NG',{timeZone:'Africa/Lagos',weekday:'long',month:'long',day:'numeric'})}</div><div class="ph-lock-time">${timeOnly(now)}</div><div class="ph-lock-location">${esc(place(profile().district)?.name || 'Abuja')}<span>Your life, connected.</span></div><div class="ph-lock-notices">${unread()?`<button class="ph-lock-notice" data-ph-action="app" data-app="messages"><span class="ph-mini-app green">${icon('messages')}</span><span><strong>Messages</strong><small>${unread()} unread message${unread()===1?'':'s'}</small></span>${icon('arrow')}</button>`:''}${notifs.map(n=>`<button class="ph-lock-notice" data-ph-action="app" data-app="notifications"><span class="ph-mini-app coral">${icon('notifications')}</span><span><strong>${esc(n.title || 'AbujaLife')}</strong><small>${esc(n.text || n.body || 'New activity')}</small></span></button>`).join('')}</div><button class="ph-unlock" data-ph-action="unlock">${icon('lock')} Tap to unlock</button><div class="ph-lock-shortcuts"><button data-ph-action="app" data-app="notifications" aria-label="Open activity">${icon('notifications')}</button><button data-ph-action="app" data-app="profile" aria-label="Open camera and profile">${icon('profile')}</button></div></div>`;
  }
  function appIcon(id,label,color) { const b=badge(id);return `<button class="ph-launcher" data-ph-action="app" data-app="${id}"><span class="ph-app-icon ${color}">${icon(id)}${b?`<i class="ph-badge">${b>99?'99+':b}</i>`:''}</span><span class="ph-app-label">${esc(label)}</span></button>`; }
  function homeScreen() {
    return `<div class="ph-home-content"><div class="ph-widget-row"><button class="ph-widget ph-place-widget" data-ph-action="app" data-app="map"><small>${icon('map')} NOW IN</small><strong>${esc(place(profile().district)?.name || 'Abuja')}</strong><span>${esc(locationLabel())}</span></button><button class="ph-widget ph-wallet-widget" data-ph-action="app" data-app="wallet"><small>NAIRA BALANCE</small><strong>${currency(profile().wallet)}</strong><span>Naira (NGN) ${icon('arrow')}</span></button></div><div class="ph-app-grid">${apps.map(a=>appIcon(...a)).join('')}</div><div class="ph-page-dots"><i></i><span>AbujaLife</span></div><div class="ph-dock">${appIcon('calls','Calls','green')}${appIcon('messages','Messages','green')}${appIcon('map','Map','blue')}${appIcon('profile','Camera','ink')}</div></div>`;
  }
  function appScreen() {
    return `<div class="ph-app-content"><header class="ph-app-header"><button data-ph-action="back" class="ph-back" aria-label="Back">${icon('back')}<span>${history.length?'Back':'Home'}</span></button><strong>${esc(appTitle())}</strong><button class="ph-header-close" data-ph-action="close" aria-label="Put phone away">${icon('close')}</button></header><div class="ph-scroll ${screen==='thread'?'ph-thread-scroll':''}">${content()}</div>${screen==='thread'?chatComposer():''}</div>`;
  }
  function content() {
    const views={messages:messagesScreen,thread:threadScreen,compose:composeScreen,contacts:contactsScreen,person:personScreen,friends:friendsScreen,groups:groupsScreen,newgroup:newGroupScreen,notifications:notificationsScreen,wallet:walletScreen,topup:topupScreen,transfer:transferScreen,transferform:transferFormScreen,walletreview:walletReviewScreen,walletreceipt:walletReceiptScreen,jobs:jobsScreen,map:mapScreen,ride:rideScreen,property:propertyScreen,homeproperty:propertyDetail,market:marketScreen,item:itemScreen,events:eventsScreen,event:eventScreen,newevent:newEventScreen,profile:profileScreen,settings:settingsScreen,blocked:moderationList,muted:moderationList,invite:inviteScreen,report:reportScreen,calls:callsScreen};
    return (views[screen] || (()=>empty('globe','Choose an app')))();
  }
  function conversationRow(c) {
    const other=c.members?.find(m=>(m.id || m.residentId)!==profile().id), last=c.lastMessage;
    return `<button class="ph-list-row ph-conversation" data-ph-action="thread" data-id="${esc(c.id)}">${c.kind==='group'?`<span class="ph-group-avatar">${icon('groups')}</span>`:portrait(other || resident(c.residentId))}<span class="ph-row-copy"><strong>${esc(conversationName(c))}</strong><small>${esc(typeof last==='string'?last:last?.text || 'Start a conversation')}</small></span><span class="ph-row-end"><time>${timeOnly(last?.createdAt)}</time>${c.unread?`<i class="ph-unread">${c.unread}</i>`:icon('arrow')}</span></button>`;
  }
  function messagesScreen() {
    const rows=conversations().filter(c=>match({name:conversationName(c)}));
    return `${headline('STAY CLOSE','Messages')}<div class="ph-toolbar">${searchField('Search conversations')}<button class="ph-square" data-ph-action="compose" aria-label="Compose message">${icon('plus')}</button></div><div class="ph-list">${rows.map(conversationRow).join('') || empty('messages','Your conversations start here','compose','New message')}</div>`;
  }
  function composeScreen() { const rows=people().filter(r=>r.id!==profile().id).filter(match); return `${headline('A REAL CONNECTION','Who’s on your mind?','Messages go to registered AbujaLife residents.')} ${searchField('Search residents')}<div class="ph-list">${rows.map(r=>residentRow(r,'dm')).join('') || empty('contacts','No residents found')}</div>`; }
  function threadScreen() {
    if(!thread) return empty('messages','Opening conversation…');
    const other=thread.members?.find(m=>m.id!==profile().id), group=thread.kind==='group';
    return `<button class="ph-thread-person" data-ph-action="${group?'noop':'person'}" data-id="${esc(other?.id || '')}">${group?`<span class="ph-group-avatar">${icon('groups')}</span>`:portrait(other)}<span><strong>${esc(conversationName(thread))}</strong><small>${typing?`${esc(typing.displayName || nameById(typing.residentId || typing.userId))} is typing…`:group?`${thread.members?.length || 0} members`:other?.online?'Online now':'Messages stay here when you’re away'}</small></span></button><div class="ph-message-day">${messages.length?dateTime(messages[0].createdAt).split(',')[0]:'Beginning of your conversation'}</div><div class="ph-bubbles">${messages.map(m=>{ const mine=m.senderId===profile().id, receipt=(m.readBy || []).some(id=>id!==profile().id)?'Read':(m.deliveredTo || []).some(id=>id!==profile().id)?'Delivered':'Sent';return `<div class="ph-message ${mine?'mine':''}">${group && !mine?`<small class="ph-message-sender">${esc(nameById(m.senderId))}</small>`:''}<div class="ph-bubble">${esc(m.text).replace(/\n/g,'<br>')}</div><span>${timeOnly(m.createdAt)}${mine?` · ${receipt}`:''}</span></div>`; }).join('')}${typing?'<div class="ph-typing" aria-label="Typing"><i></i><i></i><i></i></div>':''}</div>${!messages.length?'<p class="ph-quiet-note">Say hello. This conversation is shared with real residents.</p>':''}`;
  }
  function chatComposer() {return `<form class="ph-composer" data-ph-form="message"><label class="ph-sr-only" for="ph-message">Message</label><textarea id="ph-message" name="message" rows="1" maxlength="2000" placeholder="Message…">${esc(draft('message'))}</textarea><button type="submit" class="ph-send" aria-label="Send message" ${busy?'disabled':''}>${icon('send')}</button></form>`;}
  function residentRow(r,action='person') {return `<button class="ph-list-row" data-ph-action="${action}" data-id="${esc(r.id)}">${portrait(r)}<span class="ph-row-copy"><strong>${esc(r.displayName || r.username || 'Resident')}</strong><small>${esc(r.online?'Online now':`@${r.username || 'resident'}`)}</small></span>${icon('arrow')}</button>`;}
  function contactsScreen() {return `${headline('YOUR CITY','Contacts')} ${searchField('Search residents')}<div class="ph-list">${people().filter(r=>r.id!==profile().id).filter(match).map(r=>residentRow(r)).join('') || empty('contacts','Other residents will appear here when they join')}</div>`;}
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
  function topupScreen() {
    const amounts=walletMeta().topupAmounts || [10000,50000,100000,500000], min=walletMeta().topupMin || 1000,max=walletMeta().topupMax || 1000000;
    return `${headline('READY FOR YOUR NEXT CHAPTER','Top up Naira','Add free game money to your balance.')}<div class="ph-wallet-summary"><span>Naira balance</span><strong>${currency(walletProfile().wallet)}</strong></div><form class="ph-form ph-wallet-form" data-ph-form="wallet-topup"><div class="ph-amount-options" aria-label="Suggested top-up amounts">${amounts.map(amount=>button(currency(amount),'wallet-amount',`data-amount="${amount}"`,'secondary')).join('')}</div>${field('topupAmount','Amount (NGN)',draft('topupAmount',String(amounts[0])),'number',`required min="${min}" max="${max}" step="1" inputmode="numeric"`)}<p class="ph-quiet-note">Game money only. This top-up is free and cannot be withdrawn as cash.</p><button type="submit" class="ph-button wide" ${busy?'disabled':''}>Review top-up ${icon('arrow')}</button></form>`;
  }
  function transferScreen() {
    if(isBrowserPreview() || walletMeta().transferEnabled===false)return `${headline('STAY CONNECTED','Send Naira')}<div class="ph-wallet-summary"><span>Game preview</span><strong>Play on this device</strong></div><p class="ph-quiet-note">Transfers and chat are shared between real, registered residents in the full game. No one else is connected to this browser preview.</p>${button('Back to wallet','app','data-app="wallet"','wide')}`;
    const recipients=eligibleRecipients().filter(match);
    return `${headline('SEND TO A RESIDENT','Who’s it for?','Choose their name, then review the amount before sending.')} ${searchField('Search names or usernames')}<div class="ph-list">${recipients.map(r=>residentRow(r,'wallet-recipient')).join('') || empty('contacts','No residents found. Invite a friend to join AbujaLife.')}</div>`;
  }
  function transferFormScreen() {
    const recipient=resident(selected);if(!recipient || !eligibleRecipients().some(r=>r.id===selected))return empty('contacts','This resident is unavailable','wallet-home','Back to wallet');
    return `${headline('SEND NAIRA','A little goes a long way')}<div class="ph-transfer-person">${portrait(recipient)}<div><strong>${esc(recipient.displayName || recipient.username)}</strong><span>@${esc(recipient.username || 'resident')}</span></div></div><form class="ph-form ph-wallet-form" data-ph-form="wallet-transfer">${field('transferAmount','Amount (NGN)','','number',`required min="1" max="${Math.floor(walletProfile().wallet || 0)}" step="1" inputmode="numeric"`)}${field('transferNote','Note (optional)','','text','maxlength="160" placeholder="What’s it for?"')}<p class="ph-quiet-note">Available: ${currency(walletProfile().wallet)} · No transfer fee.</p><button type="submit" class="ph-button wide" ${busy?'disabled':''}>Review transfer ${icon('arrow')}</button></form>`;
  }
  function walletReviewScreen() {
    if(!pendingWallet)return empty('wallet','Choose an amount first','wallet-home','Back to wallet');
    const transfer=pendingWallet.kind==='transfer', recipient=resident(pendingWallet.residentId);
    return `${headline('ONE LAST LOOK',transfer?'Review transfer':'Review top-up')}<div class="ph-review-card">${icon(transfer?'send':'plus')}<strong>${currency(pendingWallet.amount)}</strong><span>${transfer?`To ${esc(recipient?.displayName || pendingWallet.recipientName)}`:'Free game Naira top-up'}</span>${transfer?`<small>@${esc(recipient?.username || pendingWallet.recipientUsername || 'resident')}</small>`:''}</div><div class="ph-review-details"><div><span>Fee</span><strong>${currency(0)}</strong></div><div><span>${transfer?'Total sent':'Added to your balance'}</span><strong>${currency(pendingWallet.amount)}</strong></div>${pendingWallet.note?`<div><span>Note</span><strong>${esc(pendingWallet.note)}</strong></div>`:''}</div>${walletError?`<p class="ph-wallet-error" role="alert">${esc(walletError)}<small>Retrying this request will never charge you twice.</small></p>`:''}${button(walletError?'Try again':transfer?'Confirm & send':'Confirm top-up','wallet-confirm',busy?'disabled':'','wide')}${button('Change details','wallet-edit',busy?'disabled':'','subtle wide')}<p class="ph-quiet-note">${transfer?'Game money is shared with this resident immediately after confirmation.':'Naira for your life in the game. No card details or payment required.'}</p>`;
  }
  function walletReceiptScreen() {
    if(!walletReceipt)return empty('wallet','Your receipt is unavailable','wallet-home','Back to wallet');
    const transfer=walletReceipt.kind==='transfer';
    return `<div class="ph-wallet-receipt"><span class="ph-receipt-check">${icon('check')}</span><small>${transfer?'TRANSFER COMPLETE':'TOP-UP COMPLETE'}</small><h2>${currency(walletReceipt.amount)}</h2><p>${transfer?`Sent to ${esc(walletReceipt.recipientName)}`:'Added to your Naira balance'}</p><time>${dateTime(walletReceipt.createdAt)}</time></div><div class="ph-wallet-summary"><span>Naira balance</span><strong>${currency(walletProfile().wallet)}</strong></div>${button('Done','app','data-app="wallet"','wide')}`;
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
  function marketScreen() {return `${headline('MAKE IT YOURS','Okrika Marketplace','Furniture, fashion and cars for your life in Abuja.')} ${searchField('Search Okrika Marketplace')}<div class="ph-market-grid">${entries(state().catalog).filter(match).map(i=>`<button class="ph-product" data-ph-action="item" data-id="${esc(i.id)}"><span class="ph-product-art ${esc(i.kind || i.category || '')}">${productArt(i)}</span><small>${esc(i.category || i.kind || 'VIRTUAL ITEM')}</small><strong>${esc(i.name || i.title)}</strong><span>${currency(i.price || i.cost)}</span></button>`).join('')}</div>`;}
  function itemScreen() {
    const i=entries(state().catalog).find(i=>i.id===selected); if(!i) return empty('market','Item unavailable');
    const own=entries(profile().inventory).some(r=>r.id===i.id || r.itemId===i.id) || (profile().inventory || []).includes?.(i.id);
    const colorId=profile().vehicleColors?.[i.id] || draft(`vehicleColor-${i.id}`,i.defaultColor), selectedColor=VEHICLE_COLORS.find(c=>c.id===colorId);
    const paint=i.category==='vehicle'?`<section class="ph-car-paint"><div><span>Paint colour</span><strong>${esc(selectedColor?.name || 'Choose your colour')}</strong></div><div class="ph-paint-options" aria-label="Car paint colour">${VEHICLE_COLORS.filter(c=>!i.availableColors || i.availableColors.includes(c.id)).map(c=>`<button type="button" class="ph-paint-swatch ${c.id===colorId?'selected':''}" data-ph-action="vehicle-color" data-id="${esc(i.id)}" data-color="${esc(c.id)}" aria-label="${esc(c.name)}" aria-pressed="${c.id===colorId}" ${busy?'disabled':''}><span style="background:${c.hex}"></span>${c.id===colorId?icon('check'):''}</button>`).join('')}</div>${own?'<small>Repaint your owned car for free.</small>':''}</section>`:'';
    return `<div class="ph-product-art ph-product-large">${productArt(i)}</div>${headline(i.category==='vehicle'?`${i.year || ''} · ${i.brand || 'YOUR NEXT CAR'}`:i.category || i.kind || 'ITEM',i.name || i.title,i.description || 'An item for your life in Abuja.')}<div class="ph-item-price">${currency(i.price || i.cost)}<small>Naira (NGN) · Game price</small></div>${paint}${own?`<div class="ph-success">You own this item.</div>${i.kind==='clothing' || i.category==='clothing'?button('Wear this item','equip',`data-id="${esc(i.id)}"`,'wide'):i.category==='furniture'?button('Arrange in your home','furnish',`data-id="${esc(i.id)}"`,'wide'):i.category==='vehicle'?button(profile().drivingVehicle===i.id?'Get out of your car':profile().location?.kind==='public'?'Take the wheel':'Step outside to drive','drive',`data-id="${esc(i.id)}" ${profile().location?.kind==='public'&&!profile().activeTrip?'':'disabled'}`,'wide'):''}`:button(i.category==='vehicle'?'Buy this car':'Buy this item','purchase',`data-id="${esc(i.id)}" ${profile().wallet<(i.price || i.cost)?'disabled':''}`,'wide')}<p class="ph-quiet-note">${own?'Furniture can be arranged at home. Drive your owned cars outdoors.':profile().wallet<(i.price || i.cost)?'Add Naira in your wallet or complete a shift to afford this item.':'Your purchase is saved to your resident inventory.'}</p>${!own && profile().wallet<(i.price || i.cost)?button('Open Naira wallet','app','data-app="wallet"','secondary wide'):''}`;
  }
  function eventsScreen() {return `${headline('MAKE A MOMENT','Events')} ${button(`${icon('plus')} Create an event`,'newevent','','wide')}<div class="ph-list">${entries(state().events).map(e=>`<button class="ph-list-row" data-ph-action="event" data-id="${esc(e.id)}"><span class="ph-event-date"><strong>${new Date(e.startsAt).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos',day:'numeric'})}</strong><small>${new Date(e.startsAt).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos',month:'short'})}</small></span><span class="ph-row-copy"><strong>${esc(e.title)}</strong><small>${esc(place(e.district)?.name || e.district)} · ${timeOnly(e.startsAt)}</small>${(e.attendeeIds || []).includes(profile().id)?'<span class="ph-attending">You’re attending</span>':''}</span>${icon('arrow')}</button>`).join('') || empty('events','Make the first plan in your city')}</div>`;}
  function eventScreen() {const e=entries(state().events).find(e=>e.id===selected);if(!e)return empty('events','Event unavailable');const attending=(e.attendeeIds || []).includes(profile().id);return `${headline(place(e.district)?.name || 'ABUJA',e.title)}<div class="ph-event-time">${icon('events')}<strong>${dateTime(e.startsAt)}</strong></div><p class="ph-detail-text">${esc(e.description || 'A chance to spend time together in the city.')}</p><div class="ph-event-host">Hosted by ${esc(e.host?.displayName || nameById(e.hostId))}</div><small class="ph-quiet-note">${(e.attendeeIds || []).length} resident${(e.attendeeIds || []).length===1?'':'s'} attending</small>${button(attending?'Cancel RSVP':'I’m attending','rsvp',`data-id="${esc(e.id)}" data-value="${!attending}"`,'wide')}${button('View location','navigate',`data-view="map" data-id="${esc(e.district)}"`,'secondary wide')}<p class="ph-quiet-note">An RSVP saves your place. Travel there when it’s time.</p>`;}
  function newEventScreen() {return `${headline('GIVE THE CITY A REASON TO MEET','Create an event')}<form class="ph-form" data-ph-form="event">${field('eventTitle','Event name','','text','required maxlength="80"')}<label class="ph-field"><span>Where</span><select id="ph-eventDistrict" name="eventDistrict">${districtOptions(draft('eventDistrict',profile().district))}</select></label>${field('eventDate','Date & time (Abuja)','','datetime-local','required')}<label class="ph-field"><span>About your event</span><textarea id="ph-eventDescription" name="eventDescription" rows="4" maxlength="500" placeholder="What’s the plan?">${esc(draft('eventDescription'))}</textarea></label><button type="submit" class="ph-button wide">Create event</button></form>`;}
  function profileScreen() {return `${headline('YOUR SIDE OF THE CITY','Camera & profile')}<div class="ph-camera-view">${portrait(profile(),'ph-camera-portrait')}<span class="ph-camera-corner tl"></span><span class="ph-camera-corner tr"></span><span class="ph-camera-corner bl"></span><span class="ph-camera-corner br"></span><small>RESIDENT PORTRAIT</small></div><div class="ph-profile-name"><strong>${esc(profile().displayName)}</strong><span>@${esc(profile().username)}</span></div>${button('Edit appearance & profile','navigate','data-view="profile"','wide')}<p class="ph-quiet-note">Your resident portrait updates with your appearance. Personal photos and camera capture aren’t available yet.</p>`;}
  function settingRow(title,ic,action,attrs='',subtitle='',enabled) {return `<button class="ph-setting-row" data-ph-action="${action}" ${attrs}><span class="ph-mini-app silver">${icon(ic)}</span><span><strong>${esc(title)}</strong>${subtitle?`<small>${esc(subtitle)}</small>`:''}</span>${enabled!==undefined?`<i class="ph-switch ${enabled?'on':''}" aria-hidden="true"></i>`:icon('arrow')}</button>`;}
  function settingsScreen() {
    const s=profile().settings || {};
    return `${headline('MAKE IT YOURS','Settings')}<div class="ph-setting-list">${settingRow('Presence visibility','globe','setting','data-key="presenceVisible"',s.presenceVisible===false?'Your online presence is private':'Friends can see when you’re online',s.presenceVisible!==false)}${settingRow('Allow invitations','events','setting','data-key="allowInvites"','Meetups, home visits and activities',s.allowInvites!==false)}${settingRow('Phone sounds','volume','sound','','Message and activity sounds',s.soundEnabled!==false)}</div><h3 class="ph-section-label">Your boundaries</h3><div class="ph-setting-list">${settingRow('Blocked residents','shield','app','data-app="blocked"','Manage who can contact you')}${settingRow('Muted residents','volume','app','data-app="muted"','Control notification delivery')}</div><div class="ph-about"><strong>iPhone 18 Pro Max</strong><span>AbujaLife edition</span><p>Your virtual phone keeps your conversations, plans and city life together.</p></div>${button(`${icon('lock')} Lock phone`,'lock','','secondary wide')}`;
  }
  function moderationList() {const s=profile().settings || {}, ids=screen==='blocked'?(state().blocked || s.blockedResidentIds || s.blocked || []):(state().muted || s.mutedResidentIds || s.muted || []);return `${headline('YOUR BOUNDARIES',screen==='blocked'?'Blocked residents':'Muted residents')}<div class="ph-list">${ids.map(id=>{const r=resident(id);return `<div class="ph-list-row">${portrait(r)}<span class="ph-row-copy"><strong>${esc(r?.displayName || 'Resident')}</strong></span>${button(screen==='blocked'?'Unblock':'Unmute',screen==='blocked'?'block':'mute',`data-id="${esc(id)}" data-value="false"`,'subtle')}</div>`;}).join('') || empty('shield',screen==='blocked'?'You haven’t blocked anyone':'You haven’t muted anyone')}</div>`;}
  function inviteScreen() {return `${headline('SPEND TIME TOGETHER',`Invite ${resident(selected)?.displayName || 'a resident'}`)}<form class="ph-form" data-ph-form="invite"><label class="ph-field"><span>Invitation</span><select id="ph-inviteKind" name="inviteKind">${[['meetup','Meetup'],['home','Visit my home'],['activity','Do an activity']].map(([id,label])=>`<option value="${id}" ${draft('inviteKind','meetup')===id?'selected':''}>${label}</option>`).join('')}</select></label><label class="ph-field"><span>Where</span><select id="ph-inviteDistrict" name="inviteDistrict">${districtOptions(draft('inviteDistrict',profile().district))}</select></label>${field('inviteActivity','Activity (optional)','','text','maxlength="60"')}<label class="ph-field"><span>A note</span><textarea id="ph-inviteNote" name="inviteNote" rows="3" maxlength="300" placeholder="Want to meet up?">${esc(draft('inviteNote'))}</textarea></label><button type="submit" class="ph-button wide">Send invitation</button></form>`;}
  function reportScreen() {return `${headline('KEEP THE CITY RESPECTFUL','Report resident')}<form class="ph-form" data-ph-form="report"><p class="ph-detail-text">Your report about ${esc(resident(selected)?.displayName || 'this resident')} will be saved for moderation review.</p><label class="ph-field"><span>What happened?</span><textarea id="ph-reportReason" name="reportReason" rows="5" maxlength="1000" required placeholder="Describe the behaviour you’re reporting…">${esc(draft('reportReason'))}</textarea></label><button class="ph-button wide" type="submit">Send report</button></form>`;}
  function callsScreen() {return `${headline('A VOICE IN YOUR CITY','Calls')}<div class="ph-call-unavailable">${icon('calls')}<strong>Voice calls aren’t available yet</strong><p>Stay connected with real messages and invitations. Calls will appear here when voice service is ready.</p></div>${button('Open Messages','app','data-app="messages"','wide')}`;}
  async function refresh(options) {await onUpdate?.(options);render();}
  async function mutate(path,body,success) {
    if(busy)return;
    busy=true;render();
    try { const result=await api(path,{method:'POST',body}); await refresh(); if(success)toast?.(success);return result; }
    catch(error) {toast?.(error.message || 'Please try again.');return null;}
    finally {busy=false;render();}
  }
  function navigate(next,selection=null,push=true) {
    captureInputs();
    if(push && screen!==next)history.push({screen,selected,search,thread});
    screen=next;selected=selection;search='';locked=false;incoming=null;render();
    root.querySelector('.ph-scroll')?.scrollTo(0,0);
    if(next==='ride')void loadTravelQuote();
    if(next==='wallet')void loadWallet();
  }
  function goBack() {const prev=history.pop();if(prev){screen=prev.screen;selected=prev.selected;search=prev.search;thread=prev.thread;}else screen='home';render();}
  async function loadWallet({quiet=false}={}) {
    const sequence=++walletSequence, owner=profile().id;walletLoading=true;if(!quiet)walletError='';if(opened)render();
    try {const result=await api('/api/wallet');if(sequence!==walletSequence || profile().id!==owner)return;walletData={...result,sourceWallet:profile().wallet};}
    catch(error){if(sequence===walletSequence && !quiet)walletError=error.message || 'Your balance could not refresh. Please try again.';}
    finally{if(sequence===walletSequence){walletLoading=false;if(opened)render();}}
  }
  async function confirmWallet() {
    if(busy || !pendingWallet)return;
    const request={...pendingWallet}, owner=profile().id;busy=true;walletError='';render();
    let saved;
    try {
      const body={amount:request.amount,idempotencyKey:request.idempotencyKey,...(request.kind==='transfer'?{residentId:request.residentId,note:request.note || ''}:{})};
      saved=await api(`/api/wallet/${request.kind==='transfer'?'transfer':'topup'}`,{method:'POST',body});
    } catch(error) {
      if(profile().id===owner)walletError=error.message || 'We could not confirm this request. Try again.';
    } finally {busy=false;}
    if(profile().id!==owner)return;
    if(!saved){render();return;}
    walletReceipt={...request,createdAt:Date.now()};pendingWallet=null;screen='walletreceipt';selected=null;history=[{screen:'wallet',selected:null,search:'',thread:null}];
    if(saved.profile)walletData={...walletData,profile:saved.profile,sourceWallet:profile().wallet};
    // The server already confirmed the operation. Refresh failures must not turn a saved transfer into a retry.
    try {await onUpdate?.();}catch{}
    await loadWallet({quiet:true});
    for(const name of ['topupAmount','transferAmount','transferNote']){const input=root.querySelector(`[name="${name}"]`);if(input)input.value='';drafts.delete(name);}
    navigate('walletreceipt',null,false);
  }
  async function loadTravelQuote() {
    if(profile().activeTrip)return;captureInputs();
    const destination=draft('destination',profile().district),mode=draft('mode','bus'),sequence=++quoteSequence;
    quoteLoading=true;travelQuote=null;quoteError='';render();
    try {const result=await api(`/api/travel/quote?district=${encodeURIComponent(destination)}&mode=${encodeURIComponent(mode)}`);if(sequence!==quoteSequence)return;travelQuote=result.quote || null;}catch(error){if(sequence===quoteSequence)quoteError=error.message || 'Your route is unavailable.';}finally{if(sequence===quoteSequence){quoteLoading=false;if(opened && screen==='ride')render();}}
  }
  async function openThread(id,push=true) {
    const sequence=++requestSequence;
    captureInputs();const nextDraft=threadDrafts.get(id) || '';const input=root.querySelector('#ph-message');if(input)input.value=nextDraft;thread=conversations().find(c=>c.id===id) || {id,members:[]};messages=[];typing=null;typingSentAt=0;drafts.set('message',nextDraft);navigate('thread',id,push);
    try {const result=await api(`/api/conversations/${encodeURIComponent(id)}/messages`);if(sequence!==requestSequence)return;thread=result.conversation || thread;messages=result.messages || [];render();root.querySelector('.ph-scroll')?.scrollTo(0,100000);await onUpdate?.();}
    catch(error){toast?.(error.message);}
  }
  async function startDM(id) { const result=await mutate('/api/conversations',{residentId:id});if(result?.conversation)await openThread(result.conversation.id); }
  async function handleAction(el) {
    const {phAction:action,id,app,view,value,accept,tenure,key,venueId}=el.dataset;
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
      case 'wallet-send':walletError='';busy=true;render();try{await refresh({render:false});navigate('transfer');}catch(error){walletError=error.message;toast?.(error.message);}finally{busy=false;render();}break;
      case 'wallet-home':navigate('wallet');break;
      case 'wallet-refresh':await loadWallet();break;
      case 'wallet-amount':{const input=root.querySelector('#ph-topupAmount');drafts.set('topupAmount',el.dataset.amount);if(input)input.value=el.dataset.amount;break;}
      case 'wallet-recipient':walletError='';navigate('transferform',id);break;
      case 'wallet-confirm':await confirmWallet();break;
      case 'wallet-edit':if(pendingWallet){walletError='';navigate(pendingWallet.kind==='transfer'?'transferform':'topup',pendingWallet.residentId || null,false);}break;
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
      case 'notice': { const n=entries(state().notifications).find(n=>n.id===id);await mutate('/api/notifications/read',{id});const convId=n?.conversationId || n?.data?.conversationId || n?.payload?.conversationId || (n?.link?.startsWith('conversation:')?n.link.slice(13):null); if(convId)await openThread(convId);else if(n?.link==='friends' || n?.kind==='friend-request')navigate('friends');else if(n?.eventId)navigate('event',n.eventId);break; }
      case 'invite-respond':await mutate('/api/invitations/respond',{id,accept:accept==='true'},accept==='true'?'Invitation accepted. Travel when you’re ready.':'Invitation declined');break;
      case 'rsvp':await mutate(`/api/events/${encodeURIComponent(id)}/rsvp`,{attending:value==='true'},value==='true'?'Your RSVP is saved':'RSVP cancelled');break;
      case 'purchase':{const item=entries(state().catalog).find(i=>i.id===id),color=draft(`vehicleColor-${id}`,item?.defaultColor);const result=await mutate('/api/action',{action:'purchase',payload:{itemId:id,...(item?.category==='vehicle'?{color,idempotencyKey:vehicleRequestKey('purchase',id,color)}:{})}},'Item added to your inventory');if(result)vehicleRequests.delete(`purchase:${id}:${color}`);else await refresh().catch(()=>{});break;}
      case 'equip':await mutate('/api/action',{action:'equip',payload:{itemId:id}},'Outfit updated');break;
      case 'furnish':close();onNavigate?.('world',{furnishItemId:id,source:'phone'});break;
      case 'drive':{const r=await mutate('/api/action',{action:'toggle-driving',payload:{vehicleId:profile().drivingVehicle===id?null:id}},profile().drivingVehicle===id?'You are on foot':'You are at the wheel');if(r){close();onNavigate?.('world',{source:'phone'});}break;}
      case 'move-home':{const r=await mutate('/api/action',{action:'move-home',payload:{propertyId:id,tenure}},'Your new home is secured. Choose transport to move in.');if(r){close();onNavigate?.('world',{source:'phone'});}break;}
      case 'incoming': {const convId=incoming?.conversationId || (incoming?.link?.startsWith('conversation:')?incoming.link.slice(13):null);incoming=null;locked=false;if(convId)await openThread(convId);else navigate('notifications');break;}
    }
  }
  let eventTargetBackdrop=null;
  const onClick=e=>{const el=e.target.closest('[data-ph-action]');if(!el || !root.contains(el))return;eventTargetBackdrop=e.target.classList.contains('ph-backdrop')?e.target:null;void handleAction(el);};
  const onInput=e=>{
    const el=e.target;
    if(el.name && el.type!=='checkbox')drafts.set(el.name,el.value);
    if(el.name==='search'){search=el.value;render();}
    if(el.name==='message' && thread && Date.now()-typingSentAt>1800){typingSentAt=Date.now();api('/api/typing',{method:'POST',body:{conversationId:thread.id}}).catch(()=>{});}
  };
  const onChange=e=>{if(e.target.name==='groupMember'){e.target.checked?groupMembers.add(e.target.value):groupMembers.delete(e.target.value);}else if(e.target.name)drafts.set(e.target.name,e.target.value);if(screen==='ride' && ['destination','mode'].includes(e.target.name))void loadTravelQuote();};
  const onSubmit=async e=>{
    const form=e.target.closest('[data-ph-form]');if(!form)return;e.preventDefault();captureInputs();const values=Object.fromEntries(new FormData(form));
    if(form.dataset.phForm==='wallet-topup' || form.dataset.phForm==='wallet-transfer') {
      if(busy)return;const transfer=form.dataset.phForm==='wallet-transfer', amount=Number(values[transfer?'transferAmount':'topupAmount']);
      const min=transfer?1:walletMeta().topupMin || 1000,max=transfer?Math.floor(walletProfile().wallet || 0):walletMeta().topupMax || 1000000;
      if(!Number.isSafeInteger(amount) || amount<min || amount>max){toast?.(`Choose a whole Naira amount between ${currency(min)} and ${currency(max)}.`);return;}
      const recipient=transfer?eligibleRecipients().find(r=>r.id===selected):null;
      if(transfer && (!recipient || isBrowserPreview())){toast?.('Choose a registered resident to receive your transfer.');return;}
      const note=(values.transferNote || '').trim().slice(0,160);
      const same=pendingWallet?.kind===(transfer?'transfer':'topup') && pendingWallet.amount===amount && pendingWallet.residentId===(recipient?.id || undefined) && (pendingWallet.note || '')===note;
      pendingWallet={kind:transfer?'transfer':'topup',amount,...(recipient?{residentId:recipient.id,recipientName:recipient.displayName || recipient.username,recipientUsername:recipient.username,note}:{}),idempotencyKey:same?pendingWallet.idempotencyKey:makeRequestKey()};
      walletError='';navigate('walletreview');return;
    }
    if(form.dataset.phForm==='message') {
      const submitted=values.message || '', text=submitted.trim();if(!text || !thread || busy)return;
      const conversationId=thread.id,senderAccount=profile().id;
      busy=true;render();
      try {
        const result=await api(`/api/conversations/${encodeURIComponent(conversationId)}/messages`,{method:'POST',body:{text}});
        if(profile().id!==senderAccount)return;
        if(thread?.id===conversationId) {
          if(result.message && !messages.some(m=>m.id===result.message.id))messages.push(result.message);
          const input=root.querySelector('#ph-message'),current=input?.value ?? draft('message');
          if(current===submitted){drafts.delete('message');threadDrafts.delete(conversationId);typingSentAt=0;if(input)input.value='';}
        } else if(threadDrafts.get(conversationId)===submitted)threadDrafts.delete(conversationId);
        await onUpdate?.();render();
        if(opened && screen==='thread' && thread?.id===conversationId){root.querySelector('.ph-scroll')?.scrollTo(0,100000);root.querySelector('#ph-message')?.focus({preventScroll:true});}
      }catch(error){toast?.(error.message);}finally{busy=false;render();}
      return;
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
    if(e.key==='Enter' && !e.shiftKey && e.target.id==='ph-message'){e.preventDefault();e.target.form?.requestSubmit();}
    if(e.key==='Tab') {const els=[...root.querySelectorAll('button:not([disabled]),input,textarea,select,[tabindex="0"]')].filter(el=>el.getClientRects().length);if(!els.length)return;const first=els[0],last=els.at(-1);if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}}
  };
  async function open(app,details={}) {syncAccount();priorFocus=document.activeElement;opened=true;document.body.classList.add('phone-is-open');if(app){locked=false;screen=app;history=[];search='';}render();root.querySelector(locked?'.ph-unlock':screen==='home'?'.ph-app-grid .ph-launcher':'.ph-back')?.focus({preventScroll:true});clockTimer ||= setInterval(()=>{if(opened){const el=root.querySelector('.ph-clock');if(el)el.textContent=timeOnly(new Date());const lockTime=root.querySelector('.ph-lock-time');if(lockTime)lockTime.textContent=timeOnly(new Date());}},1000);if(app==='messages' && details.conversationId)await openThread(details.conversationId);else if(app==='ride')await loadTravelQuote();else if(app==='wallet')await loadWallet();}
  function close() {captureInputs();opened=false;document.body.classList.remove('phone-is-open');render();if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true});}
  function sound() {if(profile().settings?.soundEnabled===false)return;try {const Context=window.AudioContext || window.webkitAudioContext;if(!Context)return;const ctx=new Context(), osc=ctx.createOscillator(), gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.type='sine';osc.frequency.setValueAtTime(880,ctx.currentTime);osc.frequency.setValueAtTime(1174,ctx.currentTime+.07);gain.gain.setValueAtTime(.025,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.18);osc.start();osc.stop(ctx.currentTime+.2);osc.onended=()=>ctx.close();}catch{}}
  function handleEvent(type,data) {
    if((type==='profile' || type==='notification' && /transfer/i.test(data.notification?.kind || data.kind || '')) && opened && ['wallet','topup','transfer','transferform','walletreview','walletreceipt'].includes(screen))void loadWallet({quiet:true});
    if(type==='typing' && screen==='thread' && (data.conversationId===thread?.id) && (data.residentId || data.userId || data.senderId)!==profile().id){typing=data;clearTimeout(typingTimer);typingTimer=setTimeout(()=>{typing=null;render();},3500);if(opened)render();}
    if(type==='message') {
      const m=data.message || data;
      if(m.receipt){if(thread?.id===m.conversationId){messages=messages.map(row=>({...row,...(row.createdAt<=m.readAt?{readBy:[...new Set([...(row.readBy || []),m.residentId])]}:{}),...(row.createdAt<=m.deliveredAt?{deliveredTo:[...new Set([...(row.deliveredTo || []),m.residentId])]}:{})}));if(opened)render();}return;}
      if(m.conversationId===thread?.id && !messages.some(row=>row.id===m.id)){messages.push(m);typing=null;if(opened && screen==='thread'){render();root.querySelector('.ph-scroll')?.scrollTo(0,100000);api(`/api/conversations/${encodeURIComponent(thread.id)}/read`,{method:'POST',body:{}}).catch(()=>{});}}
      if(m.senderId && m.senderId!==profile().id && !(opened && screen==='thread' && m.conversationId===thread?.id)){incoming={name:nameById(m.senderId),conversationId:m.conversationId};sound();clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>{incoming=null;if(opened)render();},7000);}
    }
    if(type==='notification' || type==='invitation'){const n=data.notification || data.invitation || data;if(type==='notification' && n.link===`conversation:${thread?.id}` && opened && screen==='thread')return;incoming={name:type==='invitation'?'New invitation':n.title || 'New activity',...n};if(type==='invitation' || n.kind!=='message')sound();clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>{incoming=null;if(opened)render();},7000);}
    if(opened && type!=='typing')render();
  }
  root.hidden=true;root.classList.add('phone-root');root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onChange);root.addEventListener('submit',onSubmit);document.addEventListener('keydown',onKey);
  return {open,close,render,handleEvent,dispose(){close();clearInterval(clockTimer);clearTimeout(typingTimer);clearTimeout(bannerTimer);root.removeEventListener('click',onClick);root.removeEventListener('input',onInput);root.removeEventListener('change',onChange);root.removeEventListener('submit',onSubmit);document.removeEventListener('keydown',onKey);}};
}

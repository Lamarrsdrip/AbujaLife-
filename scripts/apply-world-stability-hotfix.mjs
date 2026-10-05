import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const write=(file,content)=>fs.writeFileSync(path.join(root,file),content);

function replaceExact(source,search,replacement,label){
  const first=source.indexOf(search);
  if(first<0)throw new Error(`Missing target: ${label}`);
  if(source.indexOf(search,first+search.length)>=0)throw new Error(`Ambiguous target: ${label}`);
  return source.slice(0,first)+replacement+source.slice(first+search.length);
}
function replaceRange(source,start,end,replacement,label){
  const from=source.indexOf(start);
  if(from<0)throw new Error(`Missing start marker: ${label}`);
  const to=source.indexOf(end,from+start.length);
  if(to<0)throw new Error(`Missing end marker: ${label}`);
  if(source.indexOf(start,from+start.length)>=0)throw new Error(`Ambiguous start marker: ${label}`);
  return source.slice(0,from)+replacement+source.slice(to);
}

let app=read('app/app.js');
app=replaceExact(
  app,
  "const place = id => state.atlas?.find(p=>p.id===id);\n",
  `const place = id => state.atlas?.find(p=>p.id===id);\nfunction locationKey(profile=state.profile){\n const location=profile?.location||{};\n return [profile?.district||'',location.kind||'',location.venueId||location.venue||'',location.ownerId||location.residentId||location.visitId||''].join(':');\n}\n`,
  'location identity helper'
);

const realtimeBlock=`function scheduleRealtimeRefresh(){
 const previousLocation=locationKey(state.profile);
 clearTimeout(refreshTimer);
 refreshTimer=setTimeout(()=>{
  refresh({render:false}).then(next=>{
   const locationChanged=previousLocation!==locationKey(next.profile);
   if(locationChanged&&view==='world'){renderMain();return;}
   if(!['world','outside'].includes(view)&&!document.querySelector('.sheet')&&!root.contains(document.activeElement))renderMain();
  }).catch(()=>{});
 },250);
}
function connectRealtime(){
 stream?.close();if(!state.authenticated||authRecovery.snapshot().kind&&!['idle','complete'].includes(authRecovery.snapshot().status))return;stream=createApiEventSource('/api/realtime');
 for(const type of ['ready','presence','event','location-chat','typing','message','notification','invitation','profile','receipt','world-pose','social-post','social-like','social-comment','home-visit','home-visit-request','home-visit-ended'])stream.addEventListener(type,event=>{
  let data;try{data=JSON.parse(event.data);}catch{return;}phone.handleEvent(type,data);
  if(type==='message'&&!data.receipt&&data.senderId!==state.profile?.id&&data.conversationId)api(\`/api/conversations/\${encodeURIComponent(data.conversationId)}/delivered\`,{method:'POST',body:{...(Number.isSafeInteger(data.seq)?{uptoSeq:data.seq}:{}),createdAt:data.createdAt,uptoMessageId:data.id}}).catch(()=>{});
  if(type==='world-pose'){if(data.residentId!==state.profile?.id)cleanup?.updateResidentPose?.(data);return;}
  if(type==='location-chat'){chatMessages.push(data.message||data);chatMessages=chatMessages.slice(-60);if(chatOpen)renderChat();}
  if(['presence','event','profile','message','notification','invitation','receipt','home-visit','home-visit-request','home-visit-ended'].includes(type))scheduleRealtimeRefresh();
 });
 stream.onopen=()=>{document.documentElement.dataset.connection='online';};stream.onerror=()=>{document.documentElement.dataset.connection='reconnecting';};
}
`;
app=replaceRange(app,'function connectRealtime(){','async function action(name,payload={}){',realtimeBlock,'realtime world refresh');

const actionBlock=`async function action(name,payload={}){
 if(busy)return;busy=true;const previousLocation=locationKey(state.profile);
 try{
  const result=await api('/api/action',{method:'POST',body:{action:name,payload}});
  // The action response is authoritative. Apply it immediately. Only a real
  // location transition is allowed to rebuild the world; ordinary state
  // changes reconcile in place so the WebGL scene never flashes away.
  if(result.profile){
   state.profile=result.profile;
   if(previousLocation!==locationKey(result.profile)&&view==='world')renderMain();
   else syncProfileChrome();
  }
  void refresh({render:false}).catch(()=>{});
  return result;
 }
 catch(error){toast(error.message);return null;}finally{busy=false;}
}
`;
app=replaceRange(app,'async function action(name,payload={}){','function syncProfileChrome(){',actionBlock,'action location transition');

const travelStart=" const form=sheetRoot.querySelector('#travel-form');let quoteSequence=0,quote=null,submitting=false;\n";
const travelEnd=" form.querySelectorAll('[name=mode]').forEach(input=>input.onchange=getQuote);void getQuote();\n";
const travelQuote=` const form=sheetRoot.querySelector('#travel-form');let quoteSequence=0,quote=null,submitting=false;
 const getQuote=async()=>{
  const sequence=++quoteSequence,mode=form.elements.mode.value,button=form.querySelector('[type=submit]');quote=null;button.disabled=true;form.querySelector('#travel-quote').textContent='Checking your fare…';
  // Walking to a venue in the neighbourhood is local gameplay. It does not
  // need a network round trip just to enable the button.
  if(mode==='walk'&&sameDistrict&&(venueId||returningHome)){
   quote={district,mode,cost:0,seconds:0,...(venueId?{venueId}:{})};
   form.querySelector('#travel-quote').innerHTML='<span>Walk to the entrance</span><strong>Free</strong>';
   form.querySelector('#travel-fare-note').textContent='Within your neighbourhood · ready now.';
   button.innerHTML=\`Walk there\${icon('arrow')}\`;button.disabled=false;return;
  }
  try{
   const result=await api(\`/api/travel/quote?district=\${encodeURIComponent(district)}&mode=\${encodeURIComponent(mode)}\${venueId?\`&venueId=\${encodeURIComponent(venueId)}\`:''}\`);
   if(sequence!==quoteSequence||!form.isConnected)return;
   quote=result.quote;const walk=mode==='walk',affordable=quote.cost<=state.profile.wallet;
   form.querySelector('#travel-quote').innerHTML=\`<span>\${walk?'Walk to the entrance':\`\${quote.seconds}s journey\`}</span><strong>\${quote.cost?\`₦\${money(quote.cost)}\`:'Free'}</strong>\`;
   form.querySelector('#travel-fare-note').textContent=affordable?'Game Naira · charged when you start. Journey times are compressed.':'You need more game Naira for this fare. Choose Walk or another ride.';
   button.innerHTML=\`\${walk?'Walk there':quote.cost?\`Pay ₦\${money(quote.cost)} & go\`:'Start journey'}\${icon('arrow')}\`;button.disabled=!affordable;
  }catch(error){if(sequence===quoteSequence&&form.isConnected)form.querySelector('#travel-quote').textContent=error.message;}
 };
`;
app=replaceRange(app,travelStart,travelEnd,travelQuote,'same-district venue quote');
write('app/app.js',app);

let phone=read('app/phone.js');
phone=replaceExact(
  phone,
  "  async function startDM(id) { const result=await mutate('/api/conversations',{residentId:id});if(result?.conversation?.id)void openThread(result.conversation.id); }\n",
  `  async function startDM(id) {\n    const existing=conversations().find(c=>c.kind==='dm'&&(c.members||[]).some(m=>(m.id||m.residentId)===id));\n    if(existing?.id){void openThread(existing.id);return;}\n    const owner=profile().id,peer=resident(id),pendingId=\`pending-dm:\${id}\`;\n    // Paint the conversation immediately. Creating the server conversation can\n    // finish behind this shell instead of making a resident card feel dead.\n    navigate('thread',id);\n    thread={id:pendingId,kind:'dm',members:[{id:owner,displayName:profile().displayName,username:profile().username,appearance:profile().appearance},...(peer?[{...peer,id}]:[])]};\n    messages=[];messageCursor=null;olderLoading=false;typing=null;clearTimeout(typingTimer);threadLoading=true;threadError='';unreadAnchor=null;newMessageCount=0;render();\n    try{\n      const result=await api('/api/conversations',{method:'POST',body:{residentId:id}});\n      if(profile().id!==owner||thread?.id!==pendingId)return;\n      if(!result?.conversation?.id)throw new Error('This conversation could not open.');\n      cachedConversations.set(result.conversation.id,result.conversation);\n      await openThread(result.conversation.id,false);\n    }catch(error){if(profile().id===owner&&thread?.id===pendingId){threadLoading=false;threadError=error.message||'This conversation could not open.';render();}}\n  }\n`,
  'optimistic direct message open'
);

const oldNotice="      case 'notice': { const n=entries(state().notifications).find(n=>n.id===id);await mutate('/api/notifications/read',{id});const convId=n?.conversationId || n?.data?.conversationId || n?.payload?.conversationId || (n?.link?.startsWith('conversation:')?n.link.slice(13):null); if(convId)await openThread(convId);else if(n?.link==='friends' || n?.kind==='friend-request')navigate('friends');else if(n?.eventId)navigate('event',n.eventId);break; }\n";
const newNotice=`      case 'notice': {\n        const n=entries(state().notifications).find(n=>n.id===id);\n        const convId=n?.conversationId || n?.data?.conversationId || n?.payload?.conversationId || (n?.link?.startsWith('conversation:')?n.link.slice(13):null);\n        // Navigate first. Marking a notification read is housekeeping and must\n        // never sit between a tap and the destination screen.\n        if(convId)void openThread(convId);else if(n?.link==='friends' || n?.kind==='friend-request')navigate('friends');else if(n?.eventId)navigate('event',n.eventId);\n        void api('/api/notifications/read',{method:'POST',body:{id}}).then(()=>refreshInBackground()).catch(()=>{});\n        break;\n      }\n`;
phone=replaceExact(phone,oldNotice,newNotice,'notification navigation first');
write('app/phone.js',phone);

let world=read('app/world-3d.js');
world=replaceExact(
  world,
  "  const lose=()=>{lost=true;container.removeAttribute('data-character-renderer');container.removeAttribute('data-environment-renderer');};renderer.domElement.addEventListener('webglcontextlost',lose);\n",
  `  const lose=event=>{event.preventDefault();lost=true;container.dataset.webglContext='lost';container.removeAttribute('data-character-renderer');container.removeAttribute('data-environment-renderer');};\n  const restore=()=>{if(disposed)return;lost=false;previousWidth=0;previousHeight=0;container.dataset.webglContext='restored';container.dataset.characterRenderer='webgl-3d';if(environment)container.dataset.environmentRenderer='webgl-3d';};\n  renderer.domElement.addEventListener('webglcontextlost',lose);renderer.domElement.addEventListener('webglcontextrestored',restore);\n`,
  'recoverable WebGL context'
);
world=replaceExact(
  world,
  "      const rect=container.getBoundingClientRect();\n      if(rect.width!==previousWidth||rect.height!==previousHeight){renderer.setSize(rect.width,rect.height,false);previousWidth=rect.width;previousHeight=rect.height;}\n",
  `      const rect=container.getBoundingClientRect();\n      // iOS can briefly report a zero-sized visual viewport while browser\n      // chrome/standalone UI changes. Never resize the drawing buffer to zero.\n      if(rect.width<2||rect.height<2)return;\n      const renderWidth=Math.round(rect.width),renderHeight=Math.round(rect.height);\n      if(renderWidth!==previousWidth||renderHeight!==previousHeight){renderer.setSize(renderWidth,renderHeight,false);previousWidth=renderWidth;previousHeight=renderHeight;}\n`,
  'zero-size viewport guard'
);
const oldDispose="    dispose(){if(disposed)return;disposed=true;renderer.domElement.removeEventListener('webglcontextlost',lose);renderer.domElement.remove();container.removeAttribute('data-character-renderer');container.removeAttribute('data-environment-renderer');environment?.dispose?.();own.dispose?.();for(const rig of [...npcs,...online])rig.dispose?.();const geometrySet=new Set(),materialSet=new Set();scene.traverse(o=>{if(o.geometry)geometrySet.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materialSet.add(m);});geometrySet.forEach(g=>g.dispose());materialSet.forEach(m=>m.dispose());sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();}\n";
const newDispose="    dispose(){if(disposed)return;disposed=true;renderer.domElement.removeEventListener('webglcontextlost',lose);renderer.domElement.removeEventListener('webglcontextrestored',restore);renderer.domElement.remove();container.removeAttribute('data-character-renderer');container.removeAttribute('data-environment-renderer');environment?.dispose?.();own.dispose?.();for(const rig of [...npcs,...online])rig.dispose?.();const geometrySet=new Set(),materialSet=new Set();scene.traverse(o=>{if(o.geometry)geometrySet.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materialSet.add(m);});geometrySet.forEach(g=>g.dispose());materialSet.forEach(m=>m.dispose());sun.shadow.map?.dispose();renderer.dispose();}\n";
world=replaceExact(world,oldDispose,newDispose,'world renderer disposal without forced context loss');
write('app/world-3d.js',world);

let sw=read('app/sw.js');
sw=replaceExact(sw,"const CACHE='abujalife-outside-native-v12';","const CACHE='abujalife-outside-native-v13';",'PWA cache revision');
write('app/sw.js',sw);

const regression=`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');\nconst phone=fs.readFileSync(new URL('../app/phone.js',import.meta.url),'utf8');\nconst world=fs.readFileSync(new URL('../app/world-3d.js',import.meta.url),'utf8');\n\ntest('live 3D views reconcile realtime data without rebuilding the world',()=>{\n  assert.match(app,/function scheduleRealtimeRefresh\\(\\)/);\n  assert.match(app,/!\\['world','outside'\\]\\.includes\\(view\\)/);\n  assert.doesNotMatch(app,/refresh\\(\\{render:!document\\.querySelector\\('\\.sheet'\\)&&!root\\.contains\\(document\\.activeElement\\)\\}\\)/);\n});\n\ntest('only real location transitions rebuild the playable world',()=>{\n  assert.match(app,/previousLocation!==locationKey\\(result\\.profile\\)&&view==='world'/);\n  assert.match(app,/mode==='walk'&&sameDistrict&&\\(venueId\\|\\|returningHome\\)/);\n});\n\ntest('phone destination paints before notification read housekeeping',()=>{\n  const notice=phone.indexOf(\"case 'notice'\");\n  const open=phone.indexOf('if(convId)void openThread(convId)',notice);\n  const read=phone.indexOf(\"api('/api/notifications/read'\",notice);\n  assert.ok(notice>=0&&open>notice&&read>open);\n  assert.match(phone,/pending-dm:/);\n});\n\ntest('main world WebGL context can recover and is not forcibly lost on teardown',()=>{\n  const main=world.slice(0,world.indexOf('/** Full-body resident preview'));\n  assert.match(main,/webglcontextrestored/);\n  assert.match(main,/event\\.preventDefault\\(\\)/);\n  assert.doesNotMatch(main,/forceContextLoss\\(\\)/);\n  assert.match(main,/rect\\.width<2\\|\\|rect\\.height<2/);\n});\n`;
write('tests/world-stability.test.mjs',regression);

console.log('Applied AbujaLife world stability + immediate interaction hotfix.');

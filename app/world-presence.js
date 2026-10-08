// Share genuine poses, including stationary players, without overlapping writes.
export function createWorldPresencePublisher({read,send,clock=Date.now,idleMs=15000}) {
  let pending=false,last=null,failure=null;
  async function publish() {
    const snapshot=read();
    if(!snapshot?.key||!snapshot.pose||pending)return false;
    const {key,pose}=snapshot,now=clock(),before=last?.pose;
    if(failure?.key===key&&now<failure.retryAt)return false;
    const changed=!last||last.key!==key||!before||pose.moving!==before.moving||
      pose.driving!==before.driving||pose.activity!==before.activity||
      Math.abs((pose.angle||0)-(before.angle||0))>.02||
      Math.hypot(pose.x-before.x,pose.y-before.y)>=1;
    if(!changed&&now-last.at<idleMs)return false;
    pending=true;
    try{await send({...pose});failure=null;last={key,pose:{...pose},at:clock()};return true;}
    catch{const attempts=failure?.key===key?failure.attempts+1:1;failure={key,attempts,retryAt:clock()+Math.min(idleMs,1000*2**Math.min(attempts-1,4))};return false;}
    finally{pending=false;}
  }
  return {publish};
}

// Multiplayer presentation policy:
// - public World streets: lightweight live name tags only
// - homes / buildings: the existing simulator renders full residents + head tags
// Presence, poses and profile actions still use the same realtime backend.
const MAX_STREET_TAGS=50;
let streetStyleInstalled=false;
const usableStreetPose=pose=>pose&&Number.isFinite(Number(pose.x))&&Number.isFinite(Number(pose.y));
const streetUsername=person=>`@${String(person?.username||'resident').replace(/^@+/, '').slice(0,22)}`;

export function streetPresenceMode(profile={}){
  if(profile.activeTrip)return false;
  return (profile.location?.kind||'public')==='public';
}

export function streetResidentSnapshot(people=[],profileId=''){
  return (Array.isArray(people)?people:[])
    .filter(person=>person&&person.online&&String(person.id)!==String(profileId)&&usableStreetPose(person.pose))
    .slice(0,MAX_STREET_TAGS)
    .map(person=>({...person,pose:{...person.pose}}));
}

function installStreetPresenceStyle(){
  if(streetStyleInstalled||typeof document==='undefined')return;
  streetStyleInstalled=true;
  const style=document.createElement('style');
  style.dataset.abujalifeStreetPresence='';
  style.textContent=`
    .world-street-presence{position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden}
    .world-street-resident-tag{position:absolute;display:inline-flex;align-items:center;gap:5px;max-width:146px;min-height:25px;padding:4px 8px 4px 6px;border:1px solid #fff9;border-radius:999px;background:#f7f2e5ee;color:#335844;box-shadow:0 4px 14px #173b2924;backdrop-filter:blur(8px);font:700 9px/1.1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;transform:translate(-50%,-112%);touch-action:manipulation}
    .world-street-resident-tag::after{content:"";position:absolute;left:50%;bottom:-5px;width:8px;height:8px;background:#f7f2e5ee;border-right:1px solid #fff9;border-bottom:1px solid #fff9;transform:translateX(-50%) rotate(45deg)}
    .world-street-resident-tag>i{width:6px;height:6px;flex:0 0 auto;border-radius:50%;background:#5f9c68;box-shadow:0 0 0 3px #5f9c6818}
    .world-street-resident-tag>span{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis}
    .world-street-resident-tag:focus-visible{outline:2px solid #315c42;outline-offset:2px}
    @media(max-width:600px){.world-street-resident-tag{max-width:122px;min-height:23px;padding:4px 7px 4px 6px;font-size:8px}}
  `;
  document.head.append(style);
}

export function createStreetPresenceLayer(container,{people=[],profileId='',onResident=()=>{},project}={}){
  if(!container||typeof document==='undefined'||typeof project!=='function')return {updateResidents(){},updateResidentPose(){return false;},dispose(){}};
  installStreetPresenceStyle();
  const root=document.createElement('div');
  root.className='world-street-presence';
  root.setAttribute('aria-label','Residents currently around this street');
  container.append(root);
  container.dataset.multiplayerPresence='street-tags';
  let residents=streetResidentSnapshot(people,profileId),disposed=false,raf=0,lastPaint=0;
  const nodes=new Map();

  const syncNodes=()=>{
    const present=new Set(residents.map(person=>String(person.id)));
    for(const [id,node] of nodes)if(!present.has(id)){node.remove();nodes.delete(id);}
    for(const person of residents){
      const id=String(person.id);
      let button=nodes.get(id);
      if(!button){
        button=document.createElement('button');
        button.type='button';
        button.className='world-street-resident-tag';
        button.dataset.worldStreetResident=id;
        button.innerHTML='<i aria-hidden="true"></i><span></span>';
        button.addEventListener('click',()=>{const current=residents.find(item=>String(item.id)===id);if(current)onResident(current);});
        root.append(button);nodes.set(id,button);
      }
      const label=streetUsername(person);
      button.querySelector('span').textContent=label;
      button.setAttribute('aria-label',`${label} — live resident nearby`);
    }
  };

  const paint=time=>{
    raf=0;if(disposed||container.isConnected===false)return;
    if(typeof document!=='undefined'&&document.hidden){raf=requestAnimationFrame(paint);return;}
    if(time-lastPaint>=80){
      lastPaint=time;const bounds=container.getBoundingClientRect();
      for(const person of residents){
        const button=nodes.get(String(person.id));if(!button)continue;
        const screen=project(person.pose),x=screen?.x-bounds.left,y=screen?.y-bounds.top;
        const visible=Number.isFinite(x)&&Number.isFinite(y)&&x>18&&x<bounds.width-18&&y>80&&y<bounds.height-86;
        button.hidden=!visible;
        if(visible){button.style.left=`${x}px`;button.style.top=`${y-5}px`;}
      }
    }
    raf=requestAnimationFrame(paint);
  };

  const updateResidents=next=>{residents=streetResidentSnapshot(next,profileId);syncNodes();};
  const updateResidentPose=data=>{
    const id=String(data?.residentId||''),pose=data?.pose;if(!id||!usableStreetPose(pose))return false;
    const index=residents.findIndex(person=>String(person.id)===id);if(index<0)return false;
    residents[index]={...residents[index],pose:{...pose}};return true;
  };
  const dispose=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);root.remove();if(container.dataset.multiplayerPresence==='street-tags')delete container.dataset.multiplayerPresence;};
  syncNodes();raf=requestAnimationFrame(paint);
  return {updateResidents,updateResidentPose,dispose};
}

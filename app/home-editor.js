import { HOME_WALL_COLORS, HOME_FLOORS, DEFAULT_HOME_DESIGN, validateHomeDesign, readHomeDesign } from '../src/shared/home-design.mjs';
import { buildInterior, homeDesignPreservesRoutes } from './world-interiors.js';
import { captureHomeImage } from './home-share.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => structuredClone(value);
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const newId = () => `p-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
const icon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m6 6 12 12M6 18 18 6"/></svg>';

export function createHomeEditor({getState,api,onUpdate,onClose,onArrange,toast} = {}) {
  const root=document.createElement('div');root.className='home-editor-root';root.hidden=true;document.body.append(root);
  let profile,design,baseline,history=[],selected=null,tab='surfaces',opened=false,busy=false,error='',image='',captureSequence=0,captureTimer,priorFocus,drag=null;
  const ownedHome = () => profile?.location?.kind==='home' && !profile?.visitingHome && !profile?.homeVisit;
  const editedProfile = () => ({...profile,location:{kind:'home',district:profile.home?.district,venue:'home'},home:{...profile.home,roomStyle:design}});
  const scene = () => buildInterior({profile:editedProfile(),id:'home-editor-plan'});
  const changed = () => JSON.stringify(design)!==JSON.stringify(baseline);
  function remember() {history.push(clone(design));}
  function put(next,{record=true,photo=true}={}) {
    try {
      next=validateHomeDesign(next);
      if(JSON.stringify(next)===JSON.stringify(design)){error='';render();return true;}
      if(!homeDesignPreservesRoutes(profile,next))throw new Error('Leave your doors, furniture and walking routes clear. Try a shorter divider or another position.');
      if(record)remember();design=next;error='';render();if(photo)queuePhoto();return true;
    } catch(caught) {error=caught.message || 'That design cannot be used here.';render();return false;}
  }
  function queuePhoto() {clearTimeout(captureTimer);captureTimer=setTimeout(()=>void updatePhoto(),180);}
  async function updatePhoto() {
    const sequence=++captureSequence;
    try {const url=await captureHomeImage({profile:editedProfile()});if(opened && sequence===captureSequence){image=url;if(tab==='surfaces')render();}}
    catch(caught){if(opened && sequence===captureSequence && !image){error=caught.message;render();}}
  }
  function planMarkup(layout) {
    const area=layout.furnishingArea;
    return `<svg class="home-editor-plan" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Your home floor plan. Select a room divider and drag it to move.">${layout.art}<g>${design.partitions.map(partition=>`<rect id="home-divider-${esc(partition.id)}" data-home-divider="${esc(partition.id)}" x="${area.x+partition.x*area.w}" y="${area.y+partition.y*area.h}" width="${partition.w*area.w}" height="${partition.h*area.h}" rx="4" class="${selected===partition.id?'selected':''}" tabindex="0" role="button" aria-label="${esc(`Room divider ${design.partitions.indexOf(partition)+1}`)}"/><rect data-home-divider-art="${esc(partition.id)}" x="${area.x+partition.x*area.w}" y="${area.y+partition.y*area.h}" width="${partition.w*area.w}" height="${partition.h*area.h}" rx="4" class="${selected===partition.id?'selected':''}"/>`).join('')}</g></svg>`;
  }
  function render() {
    if(!opened)return;
    const layout=scene(),divider=design.partitions.find(partition=>partition.id===selected),horizontal=divider && divider.w>=divider.h;
    const oldFocus=root.contains(document.activeElement)?document.activeElement.id:null;
    root.innerHTML=`<div class="home-editor-backdrop" data-home-editor="backdrop"><section class="home-editor" role="dialog" aria-modal="true" aria-labelledby="home-editor-title"><header><div><small>YOUR SPACE</small><h2 id="home-editor-title">Home studio</h2><p>${esc(profile.home?.name || 'Your home')}${!ownedHome()?' · View only':''}</p></div><button type="button" class="home-editor-close" data-home-editor="close" aria-label="Close home studio">${icon}</button></header><div class="home-editor-body"><div class="home-editor-view ${tab==='rooms'?'is-plan':''}">${tab==='rooms'||!image?planMarkup(layout):`<img src="${image}" alt="Your actual 3D home with the selected surfaces and saved furnishings">`}<span>${tab==='rooms'?'Drag a divider. Leave a clear path.':image?'Your home · Full 3D view':'Preparing your home view…'}</span></div><div class="home-editor-options"><div class="home-editor-tabs" role="tablist" aria-label="Home design controls"><button type="button" id="home-surfaces-tab" role="tab" aria-selected="${tab==='surfaces'}" data-home-editor="tab" data-tab="surfaces">Surfaces</button><button type="button" id="home-rooms-tab" role="tab" aria-selected="${tab==='rooms'}" data-home-editor="tab" data-tab="rooms">Room dividers</button></div>${tab==='surfaces'?`<fieldset class="home-style-choices"><legend>Wall colour</legend>${HOME_WALL_COLORS.map(option=>`<button type="button" data-home-editor="wall" data-value="${option.id}" class="${design.wall===option.id?'selected':''}" aria-pressed="${design.wall===option.id}"><i style="background:${option.hex}"></i><span>${esc(option.name)}</span></button>`).join('')}</fieldset><fieldset class="home-style-choices floors"><legend>Floor finish</legend>${HOME_FLOORS.map(option=>`<button type="button" data-home-editor="floor" data-value="${option.id}" class="${design.floor===option.id?'selected':''}" aria-pressed="${design.floor===option.id}"><i style="background:${option.hex}"></i><span>${esc(option.name)}</span></button>`).join('')}</fieldset><button type="button" class="home-editor-arrange" data-home-editor="arrange">Arrange your furniture <span>↗</span></button>`:`<div class="home-divider-toolbar"><span>${design.partitions.length} custom ${design.partitions.length===1?'divider':'dividers'}</span><button type="button" data-home-editor="add">＋ Add divider</button></div>${design.partitions.length?`<div class="home-divider-list" aria-label="Select a room divider">${design.partitions.map((partition,i)=>`<button type="button" data-home-editor="select" data-id="${esc(partition.id)}" aria-pressed="${selected===partition.id}">Divider ${i+1}</button>`).join('')}</div>`:''}${divider?`<div class="home-divider-controls"><div class="home-divider-actions"><strong>Selected divider</strong><button type="button" data-home-editor="rotate">Rotate</button><button type="button" data-home-editor="remove">Remove</button></div><label>Length <input type="range" id="home-divider-length" data-home-divider-control="length" min=".06" max="1" step=".01" value="${horizontal?divider.w:divider.h}"></label><div class="home-divider-position"><label>Across <input type="range" id="home-divider-x" data-home-divider-control="x" min="0" max="${1-divider.w}" step=".01" value="${divider.x}"></label><label>Down <input type="range" id="home-divider-y" data-home-divider-control="y" min="0" max="${1-divider.h}" step=".01" value="${divider.y}"></label></div></div>`:`<p class="home-editor-note">Add a divider to create a reading nook or a separate corner. Select it on the floor plan to move, resize or remove it.</p>`}<p class="home-editor-note">Your home's outer walls and original rooms stay in place. Custom dividers must leave every door and facility reachable.</p>`}${!ownedHome()?'<p class="home-editor-warning">Go to your own home to save a design. Visitors can look around, while the owner controls the layout.</p>':''}<p class="home-editor-error" role="alert">${esc(error)}</p></div></div><footer><div><button type="button" data-home-editor="undo" ${!history.length||busy?'disabled':''}>Undo</button><button type="button" data-home-editor="reset" ${busy?'disabled':''}>Reset</button></div><button type="button" class="home-editor-save" data-home-editor="save" ${busy||!changed()||!ownedHome()?'disabled':''}>${busy?'Saving…':'Save design'}</button></footer></section></div>`;
    if(oldFocus)root.querySelector(`#${CSS.escape(oldFocus)}`)?.focus({preventScroll:true});
  }
  function addDivider() {
    for(const y of [.62,.72,.42,.82,.22])for(const x of [.32,.12,.52,.72])for(const length of [.18,.12,.08]) {
      const next={...design,partitions:[...design.partitions,{id:newId(),x,y,w:length,h:.018}]};
      if(homeDesignPreservesRoutes(profile,next)){selected=next.partitions.at(-1).id;put(next);return;}
    }
    error='There is no clear space for another divider in this layout. Move or store some furniture, or try a larger home.';render();
  }
  async function save() {
    if(busy || !ownedHome() || !changed())return;
    let next;
    try {next=validateHomeDesign(design);if(!homeDesignPreservesRoutes(profile,next))throw new Error('Leave every door and facility reachable.');}catch(caught){error=caught.message;render();return;}
    busy=true;error='';render();
    try {await api('/api/action',{method:'POST',body:{action:'design-home',payload:{roomStyle:next}}});baseline=clone(next);profile.home.roomStyle=clone(next);try{await onUpdate?.();}catch{}toast?.('Your home design is saved.');close(true);}
    catch(caught){error=caught.message || 'Your design could not be saved. Try again.';}
    finally {busy=false;if(opened)render();}
  }
  function onClick(event) {
    const control=event.target.closest('[data-home-editor]'),value=control?.dataset.value;
    if(!control || busy)return;
    switch(control.dataset.homeEditor) {
      case 'close':close();break;
      case 'backdrop':if(event.target===control)close();break;
      case 'tab':tab=control.dataset.tab;error='';render();break;
      case 'wall':put({...design,wall:value});break;
      case 'floor':put({...design,floor:value});break;
      case 'add':addDivider();break;
      case 'select':selected=control.dataset.id;error='';render();break;
      case 'remove':put({...design,partitions:design.partitions.filter(partition=>partition.id!==selected)});selected=null;render();break;
      case 'rotate':{const next=clone(design),divider=next.partitions.find(partition=>partition.id===selected);if(divider){const cx=divider.x+divider.w/2,cy=divider.y+divider.h/2;[divider.w,divider.h]=[divider.h,divider.w];divider.x=clamp(cx-divider.w/2,0,1-divider.w);divider.y=clamp(cy-divider.h/2,0,1-divider.h);put(next);}break;}
      case 'undo':if(history.length){design=history.pop();selected=design.partitions.some(partition=>partition.id===selected)?selected:design.partitions.at(-1)?.id || null;error='';render();queuePhoto();}break;
      case 'reset':put(clone(DEFAULT_HOME_DESIGN));selected=null;render();break;
      case 'save':void save();break;
      case 'arrange':close();onArrange?.();break;
    }
  }
  function onChange(event) {
    if(busy)return;
    const key=event.target.dataset.homeDividerControl;if(!key)return;
    const next=clone(design),divider=next.partitions.find(partition=>partition.id===selected);if(!divider)return;
    const value=Number(event.target.value);
    if(key==='length'){const dimension=divider.w>=divider.h?'w':'h';divider[dimension]=value;divider.x=Math.min(divider.x,1-divider.w);divider.y=Math.min(divider.y,1-divider.h);}else divider[key]=value;
    put(next);
  }
  function onPointerDown(event) {
    const target=event.target.closest('[data-home-divider]');if(!target || busy)return;
    event.preventDefault();selected=target.dataset.homeDivider;render();
    const divider=design.partitions.find(partition=>partition.id===selected),svg=root.querySelector('.home-editor-plan'),layout=scene();
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()),area=layout.furnishingArea;
    drag={pointer:event.pointerId,start:clone(design),divider:clone(divider),offsetX:(point.x-area.x)/area.w-divider.x,offsetY:(point.y-area.y)/area.h-divider.y};
    root.setPointerCapture(event.pointerId);root.querySelector(`[data-home-divider="${CSS.escape(selected)}"]`)?.focus({preventScroll:true});
  }
  function onPointerMove(event) {
    if(!drag || drag.pointer!==event.pointerId)return;
    const svg=root.querySelector('.home-editor-plan'),matrix=svg?.getScreenCTM();if(!matrix)return;
    const area=scene().furnishingArea,point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    const divider=design.partitions.find(partition=>partition.id===selected);
    divider.x=clamp((point.x-area.x)/area.w-drag.offsetX,0,1-divider.w);divider.y=clamp((point.y-area.y)/area.h-drag.offsetY,0,1-divider.h);
    const node=root.querySelector(`[data-home-divider="${CSS.escape(selected)}"]`);node?.setAttribute('x',area.x+divider.x*area.w);node?.setAttribute('y',area.y+divider.y*area.h);const art=root.querySelector(`[data-home-divider-art="${CSS.escape(selected)}"]`);art?.setAttribute('x',area.x+divider.x*area.w);art?.setAttribute('y',area.y+divider.y*area.h);
  }
  function onPointerUp(event) {
    if(!drag || drag.pointer!==event.pointerId)return;
    const next=clone(design),previous=drag.start;drag=null;if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);design=previous;put(next);
  }
  function onKey(event) {
    if(!opened)return;
    if(event.key==='Escape'){event.preventDefault();if(!busy)close();return;}
    if(event.key==='Tab'){const controls=[...root.querySelectorAll('button:not([disabled]),input,svg rect[tabindex="0"]')].filter(node=>node.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}
    const dividerId=event.target.dataset.homeDivider;if(!dividerId || busy)return;
    if(['Enter',' '].includes(event.key)){event.preventDefault();selected=dividerId;render();}
    const offsets={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]};
    if(offsets[event.key]){event.preventDefault();selected=dividerId;const next=clone(design),divider=next.partitions.find(partition=>partition.id===selected),[dx,dy]=offsets[event.key];divider.x=clamp(divider.x+dx,0,1-divider.w);divider.y=clamp(divider.y+dy,0,1-divider.h);put(next);}
  }
  function open() {
    profile=clone(getState?.()?.profile || {});
    if(!profile.id || !profile.home?.propertyId){toast?.('Load your resident and home first.');return false;}
    priorFocus=document.activeElement;design=readHomeDesign(profile);baseline=clone(design);history=[];selected=null;tab='surfaces';error='';image='';opened=true;root.hidden=false;document.body.classList.add('home-editor-is-open');render();root.querySelector('.home-editor-close')?.focus({preventScroll:true});void updatePhoto();return true;
  }
  function close(saved=false) {if(!opened)return;opened=false;captureSequence++;clearTimeout(captureTimer);root.hidden=true;root.innerHTML='';document.body.classList.remove('home-editor-is-open');drag=null;priorFocus?.isConnected&&priorFocus.focus({preventScroll:true});onClose?.({saved});}
  root.addEventListener('click',onClick);root.addEventListener('change',onChange);root.addEventListener('pointerdown',onPointerDown);root.addEventListener('pointermove',onPointerMove);root.addEventListener('pointerup',onPointerUp);root.addEventListener('pointercancel',onPointerUp);document.addEventListener('keydown',onKey);
  return {open,close,dispose(){close();root.remove();document.removeEventListener('keydown',onKey);}};
}

import {apiFetch} from './api-client.js';
import {optimizeAdImage} from './ad-creative.js';
import {showGameToast as toast} from './game-toast.js';

const sheetRoot=document.querySelector('#sheet-root');
let accessPromise=null;
const access=()=>accessPromise||(accessPromise=(async()=>{try{const response=await apiFetch('/api/admin/status',{timeoutMs:7000});if(!response.ok)return null;const body=await response.json();return body?.role&&body?.permissions?.includes('payments')?body:null;}catch{return null;}})());

const ADMIN_SUBMIT_LABEL='Publish to AbujaLife · No charge',ADMIN_READY_NOTE='Ready to publish. This administrator placement is free and stays live until you remove it.';
const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
function selectedIds(studio){return [...studio.querySelectorAll('[data-ad-selected] [data-ad-remove]')].map(node=>node.dataset.adRemove).filter(Boolean);}
function validAdminForm(form,studio){
 const title=form.elements.title?.value.trim()||'',link=form.elements.link?.value.trim()||'',file=form.elements.image?.files?.[0];
 let secure=false;try{secure=new URL(link).protocol==='https:';}catch{}
 return selectedIds(studio).length===1&&title.length>=2&&Boolean(file)&&secure;
}
function refresh(form,studio){
 if(form.dataset.adminAdMode!=='1'||form.dataset.adminBusy==='1')return;
 const submit=form.querySelector('.abj-ad-submit');if(!submit)return;
 // refresh() runs from a MutationObserver on this studio. Assigning textContent
 // always records a new mutation, even when the text is identical, so every
 // write here must be conditional or the observer re-triggers itself forever.
 const valid=validAdminForm(form,studio);if(submit.disabled===valid)submit.disabled=!valid;setText(submit,ADMIN_SUBMIT_LABEL);
 const note=form.querySelector('[data-ad-note]');if(note&&valid)setText(note,ADMIN_READY_NOTE);
}
async function publish(form,studio){
 if(form.dataset.adminBusy==='1'||!validAdminForm(form,studio))return;
 const submit=form.querySelector('.abj-ad-submit'),file=form.elements.image.files[0];form.dataset.adminBusy='1';submit.disabled=true;submit.textContent='Publishing…';
 try{
  const imageDataUrl=await optimizeAdImage(file),slots=selectedIds(studio),kind=studio.querySelector('[data-ad-kind].active')?.dataset.adKind||'plot';
  const response=await apiFetch('/api/admin/ads/platform',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,slots,title:form.elements.title.value.trim(),link:form.elements.link.value.trim(),imageDataUrl,idempotencyKey:form.dataset.adminAdKey||=crypto.randomUUID()}),timeoutMs:25000});
  let body={};try{body=await response.json();}catch{}
  if(!response.ok||body.ok===false)throw new Error(body.error||'Could not publish this advert.');
  sheetRoot.replaceChildren();toast('Advert published to AbujaLife. No charge.');
  setTimeout(()=>window.dispatchEvent(new Event('focus')),50);
 }catch(error){form.dataset.adminBusy='0';submit.disabled=false;submit.textContent='Publish to AbujaLife · No charge';toast(error.message);refresh(form,studio);}
}
async function decorate(studio){
 if(studio.dataset.adminChecked==='1')return;studio.dataset.adminChecked='1';
 const admin=await access();if(!admin||!studio.isConnected)return;
 const form=studio.querySelector('[data-ad-form]');if(!form)return;form.dataset.adminAdMode='1';form.dataset.adminBusy='0';form.dataset.adminAdKey=crypto.randomUUID();
 const eyebrow=studio.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='ABUJALIFE ADMIN · PLATFORM CAMPAIGN';
 const intro=studio.querySelector('#ad-title + .muted');if(intro)intro.textContent='Choose a real map placement and upload the finished banner. Admin placements use the same premium display engine as paid campaigns, with no checkout.';
 const summary=studio.querySelector('.abj-ad-summary');if(summary)summary.innerHTML='<small>ADMIN PLACEMENT</small><strong>No charge</strong><p>Publish as many platform campaigns as you need. Each banner uses a real safe city placement and stays live until an administrator removes it.</p><small>Customer advertising remains ₦2,000 for 7 days.</small>';
 const email=form.elements.email;if(email){email.required=false;const label=email.closest('label');if(label)label.hidden=true;}
 const submit=form.querySelector('.abj-ad-submit');if(submit)submit.textContent='Publish to AbujaLife · No charge';
 form.addEventListener('submit',event=>{if(form.dataset.adminAdMode!=='1')return;event.preventDefault();event.stopImmediatePropagation();void publish(form,studio);},true);
 for(const type of ['input','change'])form.addEventListener(type,()=>queueMicrotask(()=>refresh(form,studio)),true);
 studio.addEventListener('click',()=>queueMicrotask(()=>refresh(form,studio)),true);
 const observer=new MutationObserver(()=>queueMicrotask(()=>refresh(form,studio)));observer.observe(studio,{subtree:true,childList:true});
 refresh(form,studio);
}
function scan(){const studio=sheetRoot?.querySelector('.abj-ad-studio');if(studio)void decorate(studio);}
const observer=new MutationObserver(scan);if(sheetRoot)observer.observe(sheetRoot,{subtree:true,childList:true});
window.addEventListener('abujalife:auth',()=>{accessPromise=null;});
scan();

import {apiFetch} from './api-client.js';
import {optimizeAdImage} from './ad-creative.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=()=>document.querySelector('#admin-app'),dialogRoot=()=>document.querySelector('#admin-dialog'),toastNode=()=>document.querySelector('#admin-toast');
let active=false,loading=false;

async function api(path,{body,...options}={}){
 const response=await apiFetch(path,{...options,headers:{...(body?{'content-type':'application/json'}:{}),...options.headers},...(body?{body:JSON.stringify(body)}:{}),timeoutMs:25000});
 const result=await response.json();if(!response.ok||result.ok===false)throw Object.assign(new Error(result.error||'Please try again.'),{status:response.status});return result;
}
function toast(message){const node=toastNode();if(!node)return;node.textContent=message;node.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('visible'),4000);}
function setNavState(button){document.querySelectorAll('.admin-sidebar nav button').forEach(node=>node.classList.toggle('active',node===button));}
function closeDialog(){dialogRoot().replaceChildren();}
function openDialog(markup){const host=dialogRoot();host.innerHTML=`<div class="admin-modal-backdrop"><section class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="house-ad-dialog-title"><button class="admin-close" aria-label="Close">×</button>${markup}<p class="admin-error" data-house-error hidden></p></section></div>`;host.querySelector('.admin-close').onclick=closeDialog;host.querySelector('.admin-modal-backdrop').onclick=e=>{if(e.target===e.currentTarget)closeDialog();};}

async function render(){
 if(loading)return;loading=true;active=true;
 const content=root()?.querySelector('#admin-content');if(!content){loading=false;return;}
 content.innerHTML='<div class="admin-empty">Loading Okrika house campaigns…</div>';
 try{
  const result=await api('/api/admin/ads/house');
  content.innerHTML=`<div class="admin-title"><span class="eyebrow">PLATFORM INVENTORY</span><h1>Okrika house ads.</h1><p>Permanent first-party fill campaigns. They never bill AbujaLife and a paid advertiser always takes the slot first.</p></div>
  <div class="admin-stats"><article class="admin-stat"><small>House campaigns</small><strong>${result.count}</strong></article><article class="admin-stat"><small>Enabled</small><strong>${result.enabled}</strong></article><article class="admin-stat"><small>Billing</small><strong>OFF</strong></article></div>
  <section class="admin-card" style="margin-bottom:24px"><h2>Platform / House Campaigns</h2><p>These creatives fill unused Advertising Land only. Paid reservations keep normal priority, duration and revenue tracking.</p></section>
  <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>CAMPAIGN</th><th>PLACEMENT</th><th>DESTINATION</th><th>STATUS</th><th></th></tr></thead><tbody>${result.campaigns.map(c=>`<tr><td>${esc(c.title)}<small>${esc(c.headline)}</small></td><td>${esc(c.placement?.name||c.slotId)}<small>${esc(c.slotId)}</small></td><td>${esc(c.domain)}<small>${esc(c.email)}</small></td><td><span class="admin-tag ${c.enabled?'':'alert'}">${c.enabled?'House · live':'Disabled'}</span></td><td><button data-house-edit="${esc(c.id)}">Manage</button></td></tr>`).join('')}</tbody></table></div>`;
  content.querySelectorAll('[data-house-edit]').forEach(button=>button.onclick=()=>edit(result.campaigns.find(c=>c.id===button.dataset.houseEdit)));
 }catch(error){content.innerHTML=`<div class="admin-title"><span class="eyebrow">PLATFORM INVENTORY</span><h1>House ads unavailable.</h1><p>${esc(error.message)}</p></div><button class="admin-action" data-retry-house>Try again</button>`;content.querySelector('[data-retry-house]').onclick=render;}
 finally{loading=false;}
}
function edit(c){
 openDialog(`<h2 id="house-ad-dialog-title">${esc(c.title)}</h2><p class="admin-note">Platform / House Campaign · never billed</p>
 <form class="admin-form" data-house-form>
 <label><input name="enabled" type="checkbox" ${c.enabled?'checked':''}> Campaign enabled</label>
 <label>Campaign title<input name="title" value="${esc(c.title)}" maxlength="70" required></label>
 <label>Eyebrow<input name="eyebrow" value="${esc(c.eyebrow||'')}" maxlength="36"></label>
 <label>Headline<input name="headline" value="${esc(c.headline)}" maxlength="90" required></label>
 <label>Supporting copy<textarea name="body" maxlength="140">${esc(c.body||'')}</textarea></label>
 <label>Call to action<input name="cta" value="${esc(c.cta)}" maxlength="50" required></label>
 <label>Destination URL<input name="link" type="url" value="${esc(c.link)}" maxlength="500" required></label>
 <label>Domain shown on creative<input name="domain" value="${esc(c.domain)}" maxlength="120" required></label>
 <label>Contact email<input name="email" type="email" value="${esc(c.email)}" maxlength="254" required></label>
 <label>Advertising Land placement<input name="slotId" value="${esc(c.slotId)}" maxlength="120" required><small>${esc(c.placement?.name||'Eligible advertising parcel')}</small></label>
 <label>Replace creative (optional)<input name="creative" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPEG or WebP. It is optimized before upload.</small></label>
 ${c.imageDataUrl?'<label><input name="resetCreative" type="checkbox"> Return to the built-in Okrika creative</label>':''}
 <button class="admin-action" type="submit">Save house campaign</button>
 </form>`);
 const form=dialogRoot().querySelector('[data-house-form]');
 form.onsubmit=async e=>{
  e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
  try{
   let imageDataUrl;if(form.elements.resetCreative?.checked)imageDataUrl=null;
   else if(form.elements.creative.files[0])imageDataUrl=await optimizeAdImage(form.elements.creative.files[0]);
   const body={id:c.id,enabled:form.elements.enabled.checked,title:form.elements.title.value,eyebrow:form.elements.eyebrow.value,headline:form.elements.headline.value,body:form.elements.body.value,cta:form.elements.cta.value,link:form.elements.link.value,domain:form.elements.domain.value,email:form.elements.email.value,slotId:form.elements.slotId.value,...(imageDataUrl!==undefined?{imageDataUrl}:{})};
   await api('/api/admin/ads/house',{method:'POST',body});toast('House campaign saved.');closeDialog();await render();
  }catch(error){const note=dialogRoot().querySelector('[data-house-error]');note.hidden=false;note.textContent=error.message;button.disabled=false;}
 };
}

function installButton(){
 const nav=document.querySelector('.admin-sidebar nav'),anchor=nav?.querySelector('[data-admin-view="advertising"]');if(!nav||!anchor||nav.querySelector('[data-house-ads]'))return;
 const button=document.createElement('button');button.dataset.houseAds='';button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21v-4M16 21v-4M7 9h10M7 13h7"/></svg>Okrika house ads';
 button.onclick=()=>{setNavState(button);void render();};anchor.insertAdjacentElement('afterend',button);
}
const observer=new MutationObserver(()=>{installButton();if(active&&!document.querySelector('[data-house-ads].active'))active=false;});
observer.observe(document.documentElement,{subtree:true,childList:true});
installButton();

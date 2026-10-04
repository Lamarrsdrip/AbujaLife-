// The phone browser opens official websites; it never proxies platform accounts.
const OFFICIAL = [
  {name:'X',url:'https://x.com/',label:'Posts, conversations and your account'},
  {name:'TikTok',url:'https://www.tiktok.com/',label:'Videos on the official website'},
  {name:'Wikipedia',url:'https://en.wikipedia.org/wiki/Abuja',label:'Read about Abuja'},
];
export function normalizeBrowserURL(input) {
  const value=String(input || '').trim();
  if(!value || /[\u0000-\u001f\u007f\\]/.test(value))throw new Error('Enter a website address such as https://example.com.');
  if(/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value))throw new Error('Only HTTP and HTTPS websites can open here.');
  if(value.startsWith('/') || value.startsWith('.') || value.startsWith('?') || value.startsWith('#'))throw new Error('Enter a complete website address.');
  let url;
  try{url=new URL(/^https?:\/\//i.test(value)?value:`https://${value}`);}catch{throw new Error('That website address is invalid.');}
  if(!['http:','https:'].includes(url.protocol) || !url.hostname || url.username || url.password)throw new Error('Use an HTTP or HTTPS website without account details in the address.');
  return url.href;
}
export function browserPolicy(value, pageProtocol='https:') {
  const url=new URL(normalizeBrowserURL(value));
  const official=['x.com','twitter.com','tiktok.com'].some(host=>url.hostname===host || url.hostname.endsWith(`.${host}`));
  if(official)return {canEmbed:false,reason:'This website restricts embedded browsers. Open its official website in a new tab to sign in or browse.'};
  if(pageProtocol==='https:' && url.protocol==='http:')return {canEmbed:false,reason:'This HTTP address cannot display inside a secure page. Try HTTPS or open it in a new tab.'};
  return {canEmbed:true,reason:'Some websites block embedded browsing. If the page is blank or a sign-in does not work, open it in a new tab.'};
}
export function normalizeCheckoutURL(value){
  const url=new URL(normalizeBrowserURL(value));
  if(url.protocol!=='https:' || !(url.hostname==='checkout.flutterwave.com' || url.hostname.endsWith('.flutterwave.com')))throw new Error('The payment provider returned an invalid checkout address.');
  return url.href;
}
export function createPhoneBrowser({getAccountId,render,toast,esc,icon,button}) {
  let pages=[],index=-1,address='',bookmarks=[],owner=null,root=null;
  const current=()=>pages[index] || '';
  function storageKey(){return `abujalife-browser:${owner || 'guest'}`;}
  function reset(){owner=getAccountId();pages=[];index=-1;address='';try{const rows=JSON.parse(localStorage.getItem(storageKey()) || '[]');bookmarks=Array.isArray(rows)?rows.map(r=>({name:String(r.name || '').slice(0,80),url:normalizeBrowserURL(r.url)})):[];}catch{bookmarks=[];}}
  function capture(host){const input=host.querySelector('#ph-browserAddress');if(input)address=input.value;}
  const officialRows=()=>OFFICIAL.map(site=>`<button type="button" class="ph-browser-bookmark" data-ph-action="browser-go" data-url="${esc(site.url)}"><span class="ph-site-letter">${esc(site.name[0])}</span><span><strong>${esc(site.name)}</strong><small>${esc(site.label)}</small></span>${icon('arrow')}</button>`).join('');
  function toolbar(){const url=current(),saved=bookmarks.some(b=>b.url===url);return `<form class="ph-browser-address" data-ph-form="browser-address"><label class="ph-sr-only" for="ph-browserAddress">Website address</label><input id="ph-browserAddress" name="browserAddress" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="Search by website address" value="${esc(address || url)}"><button type="submit" aria-label="Go to website">${icon('arrow')}</button></form><div class="ph-browser-toolbar"><button type="button" data-ph-action="browser-prev" aria-label="Previous website" ${index>0?'':'disabled'}>${icon('back')}</button><button type="button" data-ph-action="browser-next" aria-label="Next website" ${index<pages.length-1?'':'disabled'}>${icon('arrow')}</button><button type="button" data-ph-action="browser-reload" aria-label="Reload website" ${url?'':'disabled'}>↻</button><button type="button" data-ph-action="browser-bookmark" aria-label="${saved?'Remove bookmark':'Bookmark website'}" ${url?'':'disabled'}>${saved?'★':'☆'}</button>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="ph-browser-external">Open in browser ↗</a>`:''}</div>`;}
  function body(){const url=current();if(!url)return `<div class="ph-browser-start"><small>YOUR WINDOW TO THE WEB</small><h2>Browser</h2><p>Enter a website address, or choose an official website below.</p>${officialRows()}${bookmarks.length?`<h3 class="ph-section-label">Your bookmarks</h3>${bookmarks.map(b=>`<button type="button" class="ph-browser-bookmark" data-ph-action="browser-go" data-url="${esc(b.url)}"><span class="ph-site-letter">☆</span><span><strong>${esc(b.name)}</strong><small>${esc(b.url)}</small></span>${icon('arrow')}</button>`).join('')}`:''}</div>`;
    const policy=browserPolicy(url,location.protocol);return `<p class="ph-browser-note">${esc(policy.reason)}</p>${policy.canEmbed?'<div class="ph-browser-frame-host"></div>':`<div class="ph-browser-blocked">${icon('globe')}<strong>${esc(new URL(url).hostname)}</strong><p>Continue on the official website with your usual browser.</p><a class="ph-button wide" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open website ↗</a></div>`}`;
  }
  function markup(){return `<div class="ph-browser"><div class="ph-browser-controls">${toolbar()}</div><div class="ph-browser-body">${body()}</div></div>`;}
  function afterRender(host){root=host;const slot=host.querySelector('.ph-browser-frame-host');if(!slot || slot.querySelector('iframe'))return;const frame=document.createElement('iframe');frame.title=`Website: ${new URL(current()).hostname}`;frame.setAttribute('sandbox','allow-scripts allow-forms allow-popups');frame.referrerPolicy='no-referrer';frame.allow='';frame.src=current();slot.append(frame);}
  function update({replaceFrame=false}={}){const el=root?.querySelector('.ph-browser');if(!el){render();return;}el.querySelector('.ph-browser-controls').innerHTML=toolbar();if(replaceFrame)el.querySelector('.ph-browser-body').innerHTML=body();afterRender(root);}
  function go(value){try{const url=normalizeBrowserURL(value);pages=pages.slice(0,index+1);pages.push(url);index=pages.length-1;address=url;update({replaceFrame:true});return true;}catch(error){toast?.(error.message);return false;}}
  function handleAction(el){const action=el.dataset.phAction;if(!action?.startsWith('browser-'))return false;capture(root || document);if(action==='browser-go')go(el.dataset.url);if(action==='browser-prev' && index>0){index--;address=current();update({replaceFrame:true});}if(action==='browser-next' && index<pages.length-1){index++;address=current();update({replaceFrame:true});}if(action==='browser-reload')update({replaceFrame:true});if(action==='browser-bookmark' && current()){const url=current();bookmarks=bookmarks.some(b=>b.url===url)?bookmarks.filter(b=>b.url!==url):[...bookmarks,{url,name:new URL(url).hostname}];try{localStorage.setItem(storageKey(),JSON.stringify(bookmarks));}catch{}update();}return true;}
  function handleSubmit(form,values){if(form.dataset.phForm!=='browser-address')return false;go(values.browserAddress);return true;}
  return {markup,afterRender,capture,reset,handleAction,handleSubmit,go};
}

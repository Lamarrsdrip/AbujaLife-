const icon = name => {
  const map = {
    home:'<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    city:'<path d="M4 21V9l5-3v15M9 21V3l6 3v15M15 21V10l5-3v14M2 21h20"/>',
    brief:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/>',
    phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
    bag:'<path d="M5 8h14l1 13H4zM9 8V6a3 3 0 0 1 6 0v2"/>',
    map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
    car:'<path d="M5 17h14l-1-6-2-3H8l-2 3zM7 17v2M17 17v2M6 13h12"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>',
    msg:'<path d="M4 4h16v12H8l-4 4z"/>',
    wallet:'<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M15 10h6v5h-6a2 2 0 1 1 0-5"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    people:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c1-5 3-7 6-7s6 2 7 7M14 14c3 0 5 2 6 6"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${map[name]||map.home}</svg>`;
};

let data = { profile:null, atlas:[], councils:[], landmarks:[], jobs:{} };
let view = 'home';
let scope = 'city';
let council = 'all';
let query = '';
let modal = null;
let toastTimer;

async function api(path, opts) {
  const res = await fetch(path,{headers:{'content-type':'application/json'},...opts});
  const body = await res.json();
  if (!res.ok || body.ok === false) throw new Error(body.error || 'Something went wrong');
  return body;
}
const money = n => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(n||0);
const placeById = id => data.atlas.find(x=>x.id===id);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

function toast(msg){clearTimeout(toastTimer);document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=msg;document.body.appendChild(el);toastTimer=setTimeout(()=>el.remove(),2450)}
async function act(action,payload={}){try{const r=await api('/api/action',{method:'POST',body:JSON.stringify({action,payload})});data.profile=r.profile;render();return r.profile}catch(e){toast(e.message)}}

function shell(content){
  const p=data.profile||{}; const loc=placeById(p.district);
  return `<div class="phone-frame">
    <header class="topbar">
      <div class="brand"><div class="brand-mark"></div><span>AbujaLife</span></div>
      <div class="city-chip"><i class="live-dot"></i><span>${esc(loc?.name||'Abuja')}</span></div>
    </header>
    ${content}
    <nav class="bottom-nav">
      ${nav('home','Home','home')}${nav('city','City','city')}${nav('work','Work','brief')}${nav('phone','Phone','phone')}${nav('okrika','Okrika','bag')}
    </nav>
    ${modalMarkup()}
  </div>`;
}
function nav(id,label,ic){return `<button class="nav-btn ${view===id?'active':''}" data-view="${id}">${icon(ic)}<span>${label}</span></button>`}

function home(){
  const p=data.profile; const loc=placeById(p.district);
  const now=new Date();
  return shell(`<main class="screen">
    <div class="hero-strip">
      <div><div class="time">${now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div><div class="weather">Abuja • warm daylight • your day is moving</div></div>
      <div class="wallet"><div><small>Abuja Naira</small><strong>${money(p.wallet)}</strong></div><button class="plus" data-modal="topup">+</button></div>
    </div>
    <section class="world-card">
      <div class="skyline"></div>
      <div class="location-pill">${esc(loc?.name||'Abuja')}<small>${esc(p.home)} • Reputation ${p.reputation}</small></div>
      <div class="room"><div class="floor"></div><div class="wall-a"></div><div class="wall-b"></div><div class="window"></div><div class="rug"></div><div class="bed"></div><div class="sofa"></div><div class="table"></div><div class="kitchen"></div><div class="plant"></div><div class="tv"></div></div>
      <div class="avatar-wrap"><div class="avatar"><div class="hair"></div><div class="head"></div><div class="body"></div><div class="leg l"><div class="shoe"></div></div><div class="leg r"><div class="shoe"></div></div></div></div>
      <button class="object-chip sleep-chip" data-action="sleep"><span>●</span>Sleep</button>
      <button class="object-chip shower-chip" data-action="shower"><span>●</span>Shower</button>
      <button class="object-chip eat-chip" data-action="eat"><span>●</span>Eat ₦2,200</button>
      <div class="ambient-card"><div class="ambient-icon">◌</div><div class="ambient-copy"><strong>Abuja is alive around you</strong>Traffic is building toward Wuse and the city centre. Jabi gets busier after work.</div></div>
    </section>
    ${needs(p)}
  </main>`);
}
function needs(p){const arr=[['Energy',p.energy],['Food',p.hunger],['Clean',p.hygiene],['Social',p.social]];return `<section class="needs"><div class="needs-head"><strong>Your day</strong><span>Mood ${p.mood}%</span></div><div class="need-grid">${arr.map(([n,v])=>`<div class="need"><label>${n}</label><div class="bar ${v<35?'low':''}"><i style="width:${v}%"></i></div></div>`).join('')}</div></section>`}

function city(){
  const inScope = p => scope==='city' ? p.kind==='fcc-district' : p.kind==='town';
  const filtered=data.atlas.filter(p=>inScope(p)&&(scope==='city'||council==='all'||p.council===council)&&(!query||`${p.name} ${p.vibe} ${p.code||''}`.toLowerCase().includes(query.toLowerCase()))).slice(0,90);
  return shell(`<main class="screen">
    <section class="city-hero"><h1>${scope==='city'?'Abuja City.':'Greater FCT.'}<br>One connected life.</h1><p>${scope==='city'?'The Federal Capital City is the heart of Abuja: its phases, districts, sector centres and everyday neighbourhoods.':'Satellite towns and Area Councils sit outside the FCC core but remain connected to work, family, trade and travel.'}</p></section>
    <div class="scope-switch"><button class="filter-chip ${scope==='city'?'active':''}" data-scope="city">Abuja City</button><button class="filter-chip ${scope==='fct'?'active':''}" data-scope="fct">Greater FCT</button></div>
    ${scope==='fct'?`<div class="council-row"><button class="filter-chip ${council==='all'?'active':''}" data-council="all">All councils</button>${data.councils.map(c=>`<button class="filter-chip ${council===c.id?'active':''}" data-council="${c.id}">${esc(c.short)}</button>`).join('')}</div>`:''}
    <input class="searchbox" id="placeSearch" placeholder="${scope==='city'?'Search Wuse, Garki, Maitama, Jabi, Gwarinpa…':'Search Kubwa, Kuje, Gwagwalada, Bwari, Abaji…'}" value="${esc(query)}" />
    <h2 class="section-title">${filtered.length} ${scope==='city'?'city places':'FCT places'}</h2><p class="section-sub">${scope==='city'?'FCC geography stays separate from satellite towns so Abuja never becomes a random list of FCT names.':'The wider territory is available for commuting, family, businesses, events and expansion without pretending every FCT town is an Abuja city district.'}</p>
    <div class="place-list">${filtered.map(placeCard).join('')}</div>
  </main>`);
}
function placeCard(p){const here=p.id===data.profile.district;return `<article class="place-card"><div class="place-art"></div><div class="place-main"><strong>${esc(p.name)}</strong><span>${esc(p.vibe)}${p.phase?` • Phase ${p.phase}`:''}${p.code?` • ${p.code}`:''}</span></div><div class="place-meta">${p.commute} min${here?'<div style="color:#0d8a5c;font-weight:900;margin-top:6px">YOU ARE HERE</div>':`<button class="travel-btn" data-travel="${p.id}">Travel</button>`}</div></article>`}

function work(){
  const p=data.profile;
  return shell(`<main class="screen"><h1 class="section-title">Build a life</h1><p class="section-sub">Work is not a tap-to-win button. Jobs have districts, energy cost, pay and progression. Businesses and contracts plug into the same economy later.</p><div class="cards">${Object.entries(data.jobs).map(([id,j])=>`<article class="glass-card job-card"><div><span class="job-tag">${esc(j.skill)} • ${esc(placeById(j.district)?.name||'Abuja')}</span><div class="job-title">${esc(j.title)}</div><div class="job-sub">Shift energy ${j.energy}% • pays after completing work</div></div><div><div class="job-pay">${money(j.pay)}</div>${p.job===id?`<button class="job-action" data-work="1">Work shift</button>`:`<button class="job-action secondary" data-job="${id}">Take job</button>`}</div></article>`).join('')}</div><div class="glass-card" style="margin-top:10px"><strong>Current path</strong><div class="tiny-line"></div><div style="font-size:11px;color:var(--muted)">${p.job?`You are working as ${esc(data.jobs[p.job]?.title)}. Earn reputation, unlock higher roles, then choose employment or your own business.`:'You are currently between jobs. Pick work that fits the life you want.'}</div></div></main>`)
}

function phone(){return shell(`<main class="screen"><section class="phone-shell"><div class="phone-top"><strong>Your Phone</strong><span>AbujaLife OS</span></div><div class="app-grid">${phoneApp('map','Map')}${phoneApp('brief','Jobs')}${phoneApp('car','Transport')}${phoneApp('home','Property')}${phoneApp('bag','City Market')}${phoneApp('people','Friends')}${phoneApp('msg','Messages')}${phoneApp('wallet','Wallet')}${phoneApp('gear','Settings')}</div></section><h2 class="section-title">Tonight in Abuja</h2><p class="section-sub">Phone apps become the control centre for work, rides, social life, homes and businesses without covering the world in floating UI.</p><div class="glass-card"><strong>Nearby friends</strong><div class="tiny-line"></div><div style="display:flex;gap:8px"><div class="filter-chip active">Tunde • Wuse II</div><div class="filter-chip">Zara • Jabi</div><div class="filter-chip">Amaka • Garki</div></div></div></main>`)}
function phoneApp(ic,label){return `<div class="phone-app"><div class="app-icon">${icon(ic)}</div><span>${label}</span></div>`}

function okrika(){return shell(`<main class="screen"><section class="market-hero"><div><h2>Okrika, in real life.</h2><p>Discover actual items around Abuja without confusing real commerce with AbujaLife game money.</p></div><div class="market-visual"></div></section><div class="market-note"><strong>Two economies, one audience.</strong><br>Abuja Naira buys virtual game items. Okrika listings use real-world checkout. The game can send demand to Okrika without turning AbujaLife into an ad.</div><h2 class="section-title">Around Abuja</h2><div class="listing-grid">${listing('iPhone 15 Pro','Wuse II','₦920,000')}${listing('Clean sofa set','Gwarinpa','₦180,000')}${listing('Nike trainers','Jabi','₦42,000')}${listing('Dining set','Lokogoma','₦135,000')}</div></main>`)}
function listing(n,l,p){return `<article class="listing"><div class="listing-img"></div><div class="listing-body"><strong>${n}</strong><span>${l} • real listing</span><span class="listing-price">${p}</span></div></article>`}

function modalMarkup(){if(modal!=='topup')return '';return `<div class="modal-backdrop"><section class="modal"><h2>Add Abuja Naira</h2><p>This demo simulates server-verified digital currency. Production iOS uses Apple IAP, Android uses Play Billing, and web uses approved web payments.</p><div class="topup-grid">${[10000,25000,50000,100000].map(n=>`<button class="money-pack" data-topup="${n}"><strong>${money(n)}</strong><span>game money pack</span></button>`).join('')}</div><button class="close-btn" data-close>Close</button></section></div>`}

function render(){
  const fn={home,city,work,phone,okrika}[view]||home;
  document.getElementById('app').innerHTML=fn();
  bind();
}
function bind(){
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>act(b.dataset.action));
  document.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.scope;council='all';query='';render()});
  document.querySelectorAll('[data-council]').forEach(b=>b.onclick=()=>{council=b.dataset.council;render()});
  document.querySelectorAll('[data-travel]').forEach(b=>b.onclick=async()=>{await act('travel',{district:b.dataset.travel});toast(`Arrived in ${placeById(b.dataset.travel)?.name}`)});
  document.querySelectorAll('[data-job]').forEach(b=>b.onclick=async()=>{await act('take-job',{jobId:b.dataset.job});toast('Job accepted')});
  document.querySelectorAll('[data-work]').forEach(b=>b.onclick=async()=>{await act('work-shift');toast('Shift complete — you got paid')});
  document.querySelectorAll('[data-modal]').forEach(b=>b.onclick=()=>{modal=b.dataset.modal;render()});
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{modal=null;render()});
  document.querySelectorAll('[data-topup]').forEach(b=>b.onclick=async()=>{const amount=Number(b.dataset.topup);await act('topup',{amount,verified:true,receipt:`demo-${Date.now()}-${amount}`});modal=null;render();toast(`${money(amount)} added`)});
  const s=document.querySelector('#placeSearch');if(s)s.oninput=e=>{query=e.target.value;render()};
}

(async()=>{try{data=await api('/api/bootstrap');render()}catch(e){document.getElementById('app').innerHTML=`<div class="phone-frame"><div class="empty"><h2>AbujaLife could not start</h2><p>${esc(e.message)}</p></div></div>`}})();

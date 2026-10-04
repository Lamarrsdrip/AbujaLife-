export const INSTALL_STORAGE_KEY='abujalife-install-v1';
export const INSTALL_COOLDOWN_MS=7*24*60*60*1000;

export function isIOSSafari(navigator={}) {
 const ua=navigator.userAgent||'';
 const ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 return ios&&/Safari/.test(ua)&&!/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo)/.test(ua);
}

export function isInstalled(window) {
 return !!(window.navigator?.standalone||window.matchMedia?.('(display-mode: standalone)').matches||window.matchMedia?.('(display-mode: fullscreen)').matches);
}

export function trustedInstallContext({pageUrl,manifestUrl,registrationScope,secure,topLevel=true}) {
 if(!secure||!topLevel||!manifestUrl||!registrationScope)return false;
 try {
  const page=new URL(pageUrl),manifest=new URL(manifestUrl,page),scope=new URL(registrationScope);
  const scopePath=scope.pathname.endsWith('/')?scope.pathname:`${scope.pathname}/`;
  return page.origin===manifest.origin&&page.origin===scope.origin&&manifest.pathname==='/manifest.webmanifest'&&page.pathname.startsWith(scopePath);
 }catch{return false;}
}

export function installCooldownActive(storage,now=Date.now()) {
 try {
  const until=JSON.parse(storage?.getItem(INSTALL_STORAGE_KEY)||'null')?.dismissedUntil;
  return typeof until==='number'&&Number.isFinite(until)&&until>now;
 }catch{return false;}
}

/** Native browser installation is intentionally unavailable in the static CDN preview. */
export function createInstallController({window:win=globalThis.window,document:doc=win?.document,storage,now=Date.now,shouldShow=()=>true,onAvailabilityChange=()=>{},localProgress=false,promptDelayMs=20000}={}) {
 if(!win||!doc)return {show:async()=>false,refresh:async()=>false,destroy(){},get available(){return false;}};
 if(storage===undefined){try{storage=win.localStorage;}catch{storage=null;}}
 let deferredPrompt=null,eligible=false,installed=isInstalled(win),destroyed=false,timer=null,sheet=null,lastFocus=null,showing=false,opening=false,dismissedUntil=0;
 const listeners=[];
 const listen=(target,type,handler)=>{target?.addEventListener?.(type,handler);listeners.push(()=>target?.removeEventListener?.(type,handler));};
 const clearTimer=()=>{if(timer!==null){win.clearTimeout(timer);timer=null;}};
 const cooldownActive=()=>dismissedUntil>now()||installCooldownActive(storage,now());
 const rememberDismissal=()=>{dismissedUntil=now()+INSTALL_COOLDOWN_MS;try{storage?.setItem(INSTALL_STORAGE_KEY,JSON.stringify({dismissedUntil}));}catch{}};
 const close=({remember=true,restoreFocus=true}={})=>{
  if(remember)rememberDismissal();
  showing=false;sheet?.remove();sheet=null;
  if(restoreFocus&&lastFocus?.isConnected)lastFocus.focus();
  lastFocus=null;
 };
 const schedule=()=>{
  clearTimer();
  if(destroyed||installed||!eligible||cooldownActive())return;
  timer=win.setTimeout(async()=>{
   timer=null;
   if(destroyed||doc.hidden)return;
   if(!shouldShow()){timer=win.setTimeout(schedule,60000);return;}
   await show();
  },promptDelayMs);
 };
 const refresh=async()=>{
  if(destroyed)return false;
  installed=installed||isInstalled(win);
  let registration=null,topLevel=false;
  try{registration=await win.navigator.serviceWorker?.getRegistration(win.location.href);topLevel=win.top===win.self;}catch{}
  if(destroyed)return false;
  const manifest=doc.querySelector('link[rel="manifest"]');
  const trusted=trustedInstallContext({pageUrl:win.location.href,manifestUrl:manifest?.getAttribute('href'),registrationScope:registration?.active?registration.scope:null,secure:win.isSecureContext,topLevel});
  const next=trusted&&!installed&&(!!deferredPrompt||isIOSSafari(win.navigator));
  if(next!==eligible){eligible=next;onAvailabilityChange(eligible);}
  if(!eligible&&sheet)close({remember:false});
  schedule();
  return eligible;
 };
 const show=async({manual=false}={})=>{
  if(destroyed||opening||showing||installed||(!manual&&cooldownActive())||!shouldShow())return false;
  opening=true;
  await refresh();clearTimer();
  opening=false;
  if(!eligible||destroyed||!shouldShow())return false;
  showing=true;lastFocus=doc.activeElement;
  sheet=doc.createElement('div');sheet.className='install-backdrop';
  const native=!!deferredPrompt;
  const local=typeof localProgress==='function'?localProgress():localProgress;
  sheet.innerHTML=`<section class="install-card" role="dialog" aria-modal="true" aria-labelledby="install-title" aria-describedby="install-detail" tabindex="-1"><button class="install-close" type="button" aria-label="Close installation suggestion">×</button><div class="install-identity"><img src="/icons/icon-192.png" width="56" height="56" alt="" /><div><span class="install-kicker">YOUR CITY. ONE TAP AWAY.</span><h2 id="install-title">Take AbujaLife with you</h2></div></div><p id="install-detail">Add your city to your Home Screen for a clean, full-screen game experience.</p>${native?'<button class="install-primary" type="button">Add to Home Screen <span aria-hidden="true">↗</span></button>':'<ol class="install-steps"><li><span>1</span>Tap Safari’s <strong>Share</strong> button <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M8 10H5v11h14V10h-3" /></svg></li><li><span>2</span>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li></ol>'}<button class="install-later" type="button">Maybe later</button><p class="install-hint">${local?'This preview saves on this device. Home Screen storage may be separate from Safari.':'Your resident and Naira balance stay with your account.'}</p></section>`;
  doc.body.append(sheet);
  const card=sheet.querySelector('.install-card');card.focus();
  sheet.querySelector('.install-close').onclick=()=>close();
  sheet.querySelector('.install-later').onclick=()=>close();
  sheet.onclick=event=>{if(event.target===sheet)close();};
  sheet.onkeydown=event=>{
   if(event.key==='Escape'){event.preventDefault();close();return;}
   if(event.key==='Tab'){
    const controls=[...sheet.querySelectorAll('button:not([disabled])')];
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&(doc.activeElement===first||doc.activeElement===card)){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  const primary=sheet.querySelector('.install-primary');
  if(primary)primary.onclick=async()=>{
   const prompt=deferredPrompt;if(!prompt)return;
   primary.disabled=true;
   try{
    // prompt() must run directly from this actual click, before any awaited work.
    const result=prompt.prompt();
    deferredPrompt=null;
    await result;
    await prompt.userChoice;
    close();
   }catch{close();}
   await refresh();
  };
  return true;
 };
 listen(win,'beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;void refresh();});
 listen(win,'appinstalled',()=>{installed=true;deferredPrompt=null;eligible=false;clearTimer();close({remember:false});onAvailabilityChange(false);});
 listen(win.navigator.serviceWorker,'controllerchange',()=>void refresh());
 listen(doc,'visibilitychange',()=>{if(!doc.hidden)void refresh();});
 void refresh();
 return {show,refresh,get available(){return eligible;},destroy(){destroyed=true;clearTimer();close({remember:false,restoreFocus:false});for(const remove of listeners)remove();}};
}

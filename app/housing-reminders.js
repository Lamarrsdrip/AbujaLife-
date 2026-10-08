// A single existing toast lane carries home stories. No floating card or polling
// endpoint is introduced: this controller only consumes the latest server profile.
const relevant=new Set(['upcoming','due','grace','overdue','warning','serious','final','evicted','rent-increase']);
export function createHousingReminders({read,quiet,now=Date.now,show,acknowledge,storage=globalThis.sessionStorage,setTimer=setTimeout,clearTimer=clearTimeout}) {
  let timer=null,disposed=false,lastShown=0,owner=null;const seen=new Set(),pending=new Set();
  const story=profile=>profile?.home?.tenancy?.story||profile?.home?.housingStory;
  const storageKey=p=>`abujalife:housing-story:${p.id}`;
  function remember(p,s){const key=`${p.id}:${s.id}`;seen.add(key);if(seen.size>32)seen.delete(seen.values().next().value);try{storage?.setItem(storageKey(p),s.id);}catch{}return key;}
  function wasSeen(p,s){try{if(storage?.getItem(storageKey(p))===s.id)return true;}catch{}return seen.has(`${p.id}:${s.id}`);}
  async function acknowledgeVisible(){const p=read(),s=story(p);if(!p?.id||!s?.id||s.acknowledgedAt)return;const key=remember(p,s);if(pending.has(key))return;pending.add(key);try{await acknowledge(p.id,s.id);}catch{/* A saved local seen marker prevents repeated prompts during reconnect. */}finally{pending.delete(key);}}
  function check(){
    clearTimer(timer);timer=null;if(disposed)return;
    const p=read(),s=story(p);if(owner!==p?.id){owner=p?.id;lastShown=0;}
    if(!p?.onboardingComplete||!s?.id||s.acknowledgedAt||!relevant.has(s.kind)||wasSeen(p,s))return;
    if(!quiet()||(lastShown&&now()-lastShown<5*60000)){timer=setTimer(check,30000);return;}
    lastShown=now();remember(p,s);show(`${s.title}. ${s.text} Open My life → Home & bills.`);void acknowledgeVisible();
  }
  return {check,acknowledgeVisible,pause(){clearTimer(timer);timer=null;},dispose(){disposed=true;clearTimer(timer);timer=null;pending.clear();}};
}

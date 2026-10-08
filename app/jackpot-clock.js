export function createServerClock({wallNow=()=>Date.now(),monotonicNow=()=>performance.now()}={}){
  let serverAt=0,observedAt=0;
  return Object.freeze({
    observe(serverTime){const value=Number(serverTime);if(!Number.isFinite(value)||value<=0)return false;serverAt=value;observedAt=monotonicNow();return true;},
    now(){return serverAt?serverAt+Math.max(0,monotonicNow()-observedAt):null;},
    secondsUntil(timestamp){const current=this.now(),target=Number(timestamp);if(current===null||!Number.isFinite(target))return null;return Math.max(0,Math.ceil((target-current)/1000));},
    wallNow,
  });
}

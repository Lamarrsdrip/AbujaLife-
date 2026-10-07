// One arrival intent owns timers, animation callbacks and the Arrive button.
// Provider/network retries retain their operation key; reads reconcile a journey
// completed by another tab before another mutation is attempted.
export function createJourneyArrival({ readTrip, now, request, reconcile, isBusy=()=>false, onComplete=()=>{}, onError=()=>{}, clock=()=>performance.now(), schedule=setTimeout, cancel=clearTimeout, newKey=()=>crypto.randomUUID() }) {
 let timer=null, flight=null, intent=null, disposed=false;
 const clear=()=>{if(timer!==null)cancel(timer);timer=null;};
 function sync(){
  clear();if(disposed)return;
  const trip=readTrip();if(!trip){intent=null;return;}
  if(intent?.id!==trip.id)intent={id:trip.id,key:newKey(),attempts:0,retryAt:0};
  if(flight)return;
  const wait=Math.max(0,Number(trip.arrivesAt)-now(),intent.retryAt-clock());
  timer=schedule(()=>{timer=null;void complete(trip.id);},wait+50);
 }
 async function complete(id){
  const trip=readTrip();if(disposed||!trip||trip.id!==id)return !trip;
  if(intent?.id!==id)intent={id,key:newKey(),attempts:0,retryAt:0};
  if(flight)return flight;
  if(now()<Number(trip.arrivesAt)||clock()<intent.retryAt){sync();return false;}
  if(isBusy()){intent.retryAt=clock()+1000;sync();return false;}
  clear();const current=intent;
  flight=(async()=>{
   try {
    const result=await request({tripId:id,idempotencyKey:current.key});
    if(!result)throw Object.assign(new Error('Journey is waiting for the current action'),{code:'action_busy'});
    if(readTrip()?.id===id)await reconcile();
    if(readTrip()?.id!==id){onComplete(result);return true;}
    throw Object.assign(new Error('Confirming your arrival'),{code:'arrival_pending'});
   } catch(error) {
    // A lost response or another device may already have completed this trip.
    try{await reconcile();}catch{/* Keep the same intent until connectivity returns. */}
    if(readTrip()?.id!==id)return true;
    current.attempts++;
    current.retryAt=clock()+Math.max(Number(error.retryAfterMs)||0,Math.min(30000,2000*2**Math.min(4,current.attempts-1)));
    if(!['trip_in_progress','trip_not_active','action_busy','arrival_pending'].includes(error.code)&&current.attempts===1)onError(error);
    return false;
   } finally {flight=null;sync();}
  })();return flight;
 }
 return {sync,complete,snapshot:()=>({phase:flight?'arriving':readTrip()?'travelling':'idle',tripId:intent?.id||null,attempts:intent?.attempts||0}),dispose(){disposed=true;clear();}};
}

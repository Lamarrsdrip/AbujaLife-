// Abuja follows real West Africa Time (UTC+1), without daylight saving.
export const ABUJA_TIME_ZONE = 'Africa/Lagos';
const HOUR = 3600000, DAY = 24 * HOUR;
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const timestamp = now => { const n = now instanceof Date ? now.getTime() : Number(now); return Number.isFinite(n) ? n : Date.now(); };
const pad = n => String(n).padStart(2,'0');
export function abujaTime(now = Date.now()) {
  const serverTime=timestamp(now), date=new Date(serverTime+HOUR), hour=date.getUTCHours(),minute=date.getUTCMinutes();
  const fraction=hour+minute/60+date.getUTCSeconds()/3600;
  const sunlight=clamp(Math.sin((fraction-6.25)/12.25*Math.PI),0,1);
  return {serverTime,timeZone:ABUJA_TIME_ZONE,dateKey:`${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`,dayIndex:date.getUTCDay(),dayName:days[date.getUTCDay()],hour,minute,second:date.getUTCSeconds(),month:date.getUTCMonth()+1,isNight:fraction<6.25||fraction>=18.5,sunlight,label:`${pad(hour)}:${pad(minute)}`};
}
const office={days:[1,2,3,4,5],ranges:[[8,12],[12,17]],label:'Mon–Fri · 08:00–17:00'};
export const JOB_SCHEDULES={
  'junior-dev':office,'media-assistant':office,'bank-teller':office,
  'restaurant-host':{days:[0,1,2,3,4,5,6],ranges:[[10,16],[16,23]],label:'Every day · 10:00–23:00'},
  'property-agent':{days:[1,2,3,4,5,6],ranges:[[9,13],[13,18]],label:'Mon–Sat · 09:00–18:00'},
  'site-supervisor':{days:[1,2,3,4,5,6],ranges:[[8,12],[12,17]],label:'Mon–Sat · 08:00–17:00'},
};
function midnight(time){return Date.parse(`${time.dateKey}T00:00:00+01:00`);}
function slotsFor(config,time,record={}){
  const start=midnight(time),taken=Array.isArray(record.slots)?record.slots:[];
  return config.ranges.map(([from,to],i)=>({id:i?'afternoon':'morning',label:i?'Afternoon shift':'Morning shift',startsAt:start+from*HOUR,endsAt:start+to*HOUR,completed:taken.includes(i?'afternoon':'morning'),available:config.days.includes(time.dayIndex)&&!taken.includes(i?'afternoon':'morning')&&time.serverTime>=start+from*HOUR&&time.serverTime<start+to*HOUR}));
}
export function jobSchedule(jobId,profile={},now=Date.now()) {
  const time=abujaTime(now),config=JOB_SCHEDULES[jobId],record=profile.workDays?.[time.dateKey]||{};
  const completedToday=Math.max(0,Math.floor(Number(record.completed)||0)),remainingToday=Math.max(0,2-completedToday);
  if(!config)return {...time,dayOfWeek:time.dayIndex,isWorkDay:false,isOpen:false,canStart:false,reason:'Choose a listed job.',maxDailyShifts:2,completedToday,remainingToday,remaining:remainingToday,slots:[],availableSlot:null,currentSlot:null,openingHours:'',opensAt:null,closesAt:null,nextAvailableAt:null};
  const isWorkDay=config.days.includes(time.dayIndex),slots=slotsFor(config,time,record);
  if(remainingToday===0)for(const slot of slots)slot.available=false;
  const activeSlot=slots.find(slot=>time.serverTime>=slot.startsAt&&time.serverTime<slot.endsAt)||null;
  const availableSlot=remainingToday>0?slots.find(slot=>slot.available)||null:null;
  const isOpen=isWorkDay&&!!activeSlot,canStart=!!availableSlot;
  let nextAvailableAt=canStart?time.serverTime:null;
  if(!canStart)for(let offset=0;offset<9&&nextAvailableAt===null;offset++){
    const candidate=abujaTime(midnight(time)+offset*DAY+12*HOUR),history=profile.workDays?.[candidate.dateKey]||{};
    if((Number(history.completed)||0)>=2)continue;
    const next=slotsFor(config,candidate,history).find(slot=>!slot.completed&&config.days.includes(candidate.dayIndex)&&slot.endsAt>time.serverTime);
    if(next)nextAvailableAt=Math.max(time.serverTime,next.startsAt);
  }
  const reason=canStart?'Your shift is ready.':remainingToday===0?'You have finished today’s two shifts. Come back tomorrow.':!isWorkDay?'Your workplace is closed today.':!isOpen?`Work hours are ${config.label} (Abuja time).`:'You have already completed this shift. Your next shift opens later.';
  return {...time,dayOfWeek:time.dayIndex,isWorkDay,isOpen,canStart,reason,maxDailyShifts:2,completedToday,remainingToday,remaining:remainingToday,slots,availableSlot:availableSlot?.id||null,currentSlot:activeSlot?.id||null,openingHours:config.label,opensAt:slots[0].startsAt,closesAt:slots.at(-1).endsAt,nextAvailableAt};
}
export function clubSchedule(now=Date.now()) {
  const time=abujaTime(now),minutes=time.hour*60+time.minute,nights=[3,5,6];
  const previousDay=(time.dayIndex+6)%7;
  const isOpen=(nights.includes(time.dayIndex)&&minutes>=20*60)||(nights.includes(previousDay)&&minutes<2*60);
  const activeStart=midnight(time)+(minutes<120?-DAY:0)+20*HOUR;
  let nextAvailableAt=isOpen?time.serverTime:null;
  for(let offset=0;offset<8&&nextAvailableAt===null;offset++){
    const t=abujaTime(midnight(time)+offset*DAY+20*HOUR);
    if(nights.includes(t.dayIndex)&&t.serverTime>time.serverTime)nextAvailableAt=t.serverTime;
  }
  return {...time,isOpen,canEnter:true,canDance:isOpen,openingHours:'Wed, Fri & Sat · 20:00–02:00',opensAt:isOpen?activeStart:nextAvailableAt,closesAt:isOpen?activeStart+6*HOUR:nextAvailableAt+6*HOUR,nextAvailableAt,reason:isOpen?'The DJ set is on.':'The lounge is open to visit. DJ nights run Wednesday, Friday and Saturday, 20:00–02:00 Abuja time.'};
}
// Deterministic seasonal atmosphere, explicitly not a measured weather forecast.
export function seasonalWeather(now=Date.now()) {
  const time=abujaTime(now),period=Math.floor(time.hour/3),seed=[...`${time.dateKey}:${period}`].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,2166136261);
  const rainChance=[.03,.05,.12,.27,.42,.5,.6,.65,.6,.36,.1,.04][time.month-1],sample=(seed%1000)/1000;
  const condition=sample<rainChance?'rain':sample<rainChance+.23?'cloudy':[11,12,1,2].includes(time.month)&&sample>.72?'hazy':'clear';
  const temperatureC=Math.round((time.month>=5&&time.month<=10?25:28)+Math.sin((time.hour-9)/24*Math.PI*2)*4-(condition==='rain'?3:0));
  return {condition,temperatureC,source:'seasonal-simulation',verified:false,label:'Seasonal game weather',observedAt:null,generatedAt:time.serverTime,cloudCover:condition==='rain'?.85:condition==='cloudy'?.65:condition==='hazy'?.35:.1,rain:condition==='rain'};
}

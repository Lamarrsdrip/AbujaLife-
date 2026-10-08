import { ECONOMY_CONFIG, RENT_RULES, PROPERTY_ECONOMY, ITEM_PRICES, JOB_PAY, economyPrice } from './economy.mjs';
import { HOME_UPGRADES, TRANSPORT_MODES, INVESTMENT_META, systemResaleValue } from './life.mjs';
import { VEHICLE_CATALOG } from './vehicles.mjs';
import { EXTRA_HOME_ITEMS } from './home-items.mjs';
const task = (id,prompt,options,answer) => ({id,prompt,options:options.map(([id,label])=>({id,label})),answer});
export const jobs = {
  'restaurant-host': {id:'restaurant-host',title:'Restaurant host',district:'garki-i',energy:12,skill:'Hospitality',description:'Welcome guests and coordinate service.',tasks:[
    task('arrival','A party of four arrives. Only a table for two is ready.',[['join','Check whether two tables can be joined'],['split','Seat them apart without asking'],['ignore','Leave them waiting without an update']],'join'),
    task('allergy','A guest mentions a groundnut allergy.',[['guess','Assume the sauce is safe'],['kitchen','Confirm ingredients and preparation with the kitchen'],['remove','Remove the garnish and serve']],'kitchen'),
    task('order','One meal is delayed while the rest are ready.',[['update','Give a clear update and coordinate service'],['hide','Avoid the table'],['promise','Promise it is ready without checking']],'update')]},
  'junior-dev': {id:'junior-dev',title:'Junior developer',district:'wuse-ii-a07',energy:18,skill:'Technology',description:'Triage a customer issue and ship a careful fix.',tasks:[
    task('reproduce','A customer says checkout fails on mobile. Your first step?',[['reproduce','Reproduce the issue on a mobile viewport'],['rewrite','Rewrite checkout immediately'],['dismiss','Close the report']],'reproduce'),
    task('money','The browser submits its own account balance.',[['trust','Trust the value'],['server','Calculate balances on the server'],['round','Round the submitted number']],'server'),
    task('release','Your fix passes locally. Before release?',[['check','Run relevant checks and review the change'],['ship','Skip tests'],['delete','Delete the failing checks']],'check')]},
  'media-assistant': {id:'media-assistant',title:'Creative assistant',district:'garki-ii',energy:15,skill:'Creative',description:'Prepare and deliver a campaign.',tasks:[
    task('brief','A client requests an event flyer. What do you confirm?',[['facts','Date, venue, audience and approval contact'],['colour','Only their favourite colour'],['guess','Invent missing details']],'facts'),
    task('rights','You find a photographer’s image online.',[['copy','Copy it without asking'],['license','Use an image with permission or a suitable licence'],['crop','Crop away the watermark']],'license'),
    task('delivery','The client approves the final design.',[['source','Deliver agreed formats and keep a versioned copy'],['small','Send only a blurry screenshot'],['edit','Change the approved text']],'source')]},
  'property-agent': {id:'property-agent',title:'Property assistant',district:'jabi',energy:20,skill:'Sales',description:'Match a home to a resident and verify details.',tasks:[
    task('needs','A resident wants an apartment. Start with?',[['budget','Their budget, commute and household needs'],['luxury','The highest commission property'],['rush','Ask them to pay before viewing']],'budget'),
    task('listing','A listing has unclear ownership documents.',[['verify','Verify documentation before recommending it'],['hide','Hide that concern'],['guess','Assume it is fine']],'verify'),
    task('viewing','The resident asks about service charges.',[['total','Explain rent and all disclosed recurring charges'],['omit','Mention only the rent'],['avoid','Avoid the question']],'total')]},
  'site-supervisor': {id:'site-supervisor',title:'Site coordinator',district:'guzape',energy:24,skill:'Construction',description:'Coordinate a safe site handover.',tasks:[
    task('safety','A contractor arrives without protective gear.',[['ppe','Check suitable protection before entering the work zone'],['ignore','Let them start immediately'],['photo','Take a photo and walk away']],'ppe'),
    task('delivery','A material delivery does not match the order.',[['record','Record the mismatch and confirm with the supplier'],['accept','Accept everything without checking'],['discard','Throw it away']],'record'),
    task('handover','Before handing over a room, you should?',[['inspect','Inspect the work and record unresolved defects'],['paint','Cover defects with paint'],['sign','Sign without inspecting']],'inspect')]},
  'bank-teller': {id:'bank-teller',title:'Bank teller',district:'central-area',energy:16,skill:'Finance',description:'Help customers with accurate, secure account transactions.',tasks:[
    task('identity','A customer requests an account withdrawal. Start with?', [['verify','Verify their identity through the approved procedure'],['skip','Skip verification to shorten the queue'],['ask-pin','Ask them to say their secret PIN aloud']],'verify'),
    task('difference','The cash count differs from the transaction record.',[['reconcile','Recount and reconcile the record before continuing'],['hide','Hide the difference'],['guess','Change the record to a guessed amount']],'reconcile'),
    task('privacy','Another customer asks for their neighbour’s balance.',[['private','Protect the account holder’s confidential information'],['share','Read the balance aloud'],['photo','Send a screenshot']],'private')]}
};
for(const job of Object.values(jobs))job.pay=economyPrice(JOB_PAY,job.id);
export const catalog = [
  {id:'linen-shirt',name:'Linen shirt',category:'clothing',slot:'top',value:'cream',description:'An easy neutral shirt for warm afternoons.'},
  {id:'office-shirt',name:'Office shirt',category:'clothing',slot:'top',value:'navy',description:'A clean fit for work and city evenings.'},
  {id:'traditional-set',name:'Agbada set',category:'clothing',slot:'top',value:'agbada',description:'A contemporary traditional outfit.'},
  {id:'white-trainers',name:'White trainers',category:'clothing',slot:'shoes',value:'white',description:'Everyday city footwear.'},
  {id:'lounge-chair',name:'Lounge chair',category:'furniture',description:'A comfortable chair for your living room.'},
  {id:'plant',name:'Indoor plant',category:'furniture',description:'A little green for your home.'},
  {id:'bookshelf',name:'Bookshelf',category:'furniture',description:'A quiet corner to read and unwind.'},
  {id:'sofa',name:'Two-seat sofa',category:'furniture',description:'Room for a visitor and a conversation.'},
  {id:'dining-table',name:'Dining table',category:'furniture',description:'A compact timber table for meals and visitors.'},
  {id:'bed',name:'Upholstered bed',category:'furniture',description:'A comfortable upgrade for your bedroom.'},
  {id:'fridge',name:'Kitchen fridge',category:'furniture',description:'Make the kitchen your own with a full-size fridge.'},
  {id:'floor-lamp',name:'Floor lamp',category:'furniture',description:'Warm light beside your favourite chair.'},
  {id:'rug',name:'Woven rug',category:'furniture',description:'Colour and texture for your living space.'},
  {id:'tv',name:'Living-room TV',category:'furniture',description:'Build a proper entertainment corner.'},
  ...HOME_UPGRADES,
  ...EXTRA_HOME_ITEMS,
  ...VEHICLE_CATALOG
].map(item=>item.category==='vehicle'?item:{...item,price:economyPrice(ITEM_PRICES,item.id)});

const PROPERTY_LAYOUTS=Object.freeze({
  0:'garki-studio',1:'lugbe-flat',2:'gwarinpa-apartment',3:'jabi-apartment',4:'guzape-terrace',5:'maitama-villa'
});
const PROPERTY_TIER_LABELS=Object.freeze(['Starter','Entry','Established','Premium','Executive','Luxury']);
const property=item=>{
  const pricing=PROPERTY_ECONOMY[item.id];if(!pricing)throw new RangeError(`Missing property economy for ${item.id}`);item={...item,...pricing};
  const layoutId=item.layoutId||PROPERTY_LAYOUTS[item.tier],features=item.features||[];
  return {...item,layoutId,area:item.area||item.name.split(' ')[0],price:item.buy,rentPeriod:'week',rentPeriodDays:RENT_RULES.intervalMs/86400000,billPeriodDays:ECONOMY_CONFIG.serviceIntervalMs/86400000,weeklyRent:item.rent,serviceCharge:item.bills,agencyFee:0,cautionDeposit:item.rent*RENT_RULES.depositWeeks,moveInCost:item.rent*(1+RENT_RULES.depositWeeks),capacity:Math.max(2,(item.bedrooms||0)*2),prestige:item.tier*20,priceLabel:'Game prices',fictional:true,tierLabel:PROPERTY_TIER_LABELS[item.tier]||'Luxury',furnishingTier:item.tier,comfortBonus:item.tier>=3?4:0,comfortDescription:item.tier>=3?'Fitted comfort adds 4 sleep energy and 4 relaxation fun.':'Practical starter comfort.',investmentIncome:Math.floor(item.buy*INVESTMENT_META.incomeBasisPoints/10000),investmentResale:Math.floor(item.buy*INVESTMENT_META.resaleBasisPoints/10000),features:[...features,item.tier>=2?'Visitor parking':'Street parking',item.tier>=4?'Private or gated compound':'Shared or estate compound',item.tier>=3?'Balcony, terrace or view treatment':'Practical kitchen'],viewing:{free:true,description:'Inspect the authored floor plan before spending any game Naira.'}};
};

export const properties = [
  property({id:'garki-studio',name:'Garki starter studio',area:'Garki I',district:'garki-i',tier:0,type:'Studio',bedrooms:0,bathrooms:1,areaM2:32,stylePreset:'garki-starter',description:'A modest central studio shell with the essentials and space to make it yours.',features:['Central starter location']}),
  property({id:'mpape-self-contained',name:'Mpape hillside self-contained',area:'Mpape',district:'mpape',tier:1,type:'Self-contained',bedrooms:0,bathrooms:1,areaM2:36,stylePreset:'hillside-compact',description:'A compact hillside home for a resident building from the ground up.',features:['Hillside neighbourhood']}),
  property({id:'lugbe-flat',name:'Lugbe one-bedroom',area:'Lugbe',district:'lugbe',tier:1,type:'1-bedroom flat',bedrooms:1,bathrooms:1,areaM2:58,stylePreset:'airport-corridor',description:'More space along the airport corridor with a proper bedroom and living room.',features:['Airport corridor access']}),
  property({id:'dawaki-compact',name:'Dawaki compact apartment',area:'Dawaki',district:'dawaki',tier:1,type:'1-bedroom apartment',bedrooms:1,bathrooms:1,areaM2:61,stylePreset:'dawaki-warm',description:'An easy everyday apartment with a calm residential feel.',features:['Quiet residential setting']}),
  property({id:'kubwa-one-bed',name:'Kubwa city one-bedroom',area:'Kubwa',district:'kubwa',tier:1,type:'1-bedroom flat',bedrooms:1,bathrooms:1,areaM2:64,stylePreset:'kubwa-city',description:'A practical home close to the energy and convenience of Kubwa.',features:['Satellite-city convenience']}),
  property({id:'karmo-compact',name:'Karmo compact flat',area:'Karmo',district:'karmo',tier:1,type:'Compact flat',bedrooms:1,bathrooms:1,areaM2:60,stylePreset:'karmo-compact',description:'A straightforward compact flat on Abuja’s western residential edge.',features:['Value-focused location']}),
  property({id:'lokogoma-two-bed',name:'Lokogoma two-bedroom',area:'Lokogoma',district:'lokogoma',tier:2,type:'2-bedroom estate flat',bedrooms:2,bathrooms:2,areaM2:92,stylePreset:'estate-modern',description:'A family-sized estate flat with comfortable shared living space.',features:['Estate living']}),
  property({id:'gwarinpa-apartment',name:'Gwarinpa apartment',area:'Gwarinpa I',district:'gwarinpa-i',tier:2,type:'2-bedroom apartment',bedrooms:2,bathrooms:2,areaM2:105,stylePreset:'gwarinpa-family',description:'A residential base with room for friends and everyday family life.',features:['Large residential district']}),
  property({id:'gudu-family-flat',name:'Gudu family flat',area:'Gudu',district:'gudu',tier:2,type:'2-bedroom flat',bedrooms:2,bathrooms:2,areaM2:99,stylePreset:'gudu-neutral',description:'A balanced two-bedroom close to Gudu’s mixed residential and commercial life.',features:['Mixed-use neighbourhood']}),
  property({id:'durumi-estate',name:'Durumi estate apartment',area:'Durumi',district:'durumi',tier:2,type:'2-bedroom estate apartment',bedrooms:2,bathrooms:2,areaM2:108,stylePreset:'durumi-estate',description:'A composed estate apartment with a larger kitchen and living area.',features:['Estate setting']}),
  property({id:'galadimawa-estate',name:'Galadimawa estate home',area:'Galadimawa',district:'galadimawa',tier:2,type:'2-bedroom estate home',bedrooms:2,bathrooms:2,areaM2:112,stylePreset:'galadimawa-light',description:'A roomy estate home with expressway access and clean contemporary finishes.',features:['Expressway access']}),
  property({id:'jabi-apartment',name:'Jabi lake-side apartment',area:'Jabi',district:'jabi',tier:3,type:'2-bedroom serviced apartment',bedrooms:2,bathrooms:2,areaM2:125,stylePreset:'jabi-lakeside',description:'A modern apartment close to the lake, mall and city life.',features:['Lake-side district']}),
  property({id:'wuye-serviced',name:'Wuye serviced apartment',area:'Wuye',district:'wuye',tier:3,type:'2-bedroom serviced apartment',bedrooms:2,bathrooms:2,areaM2:132,stylePreset:'wuye-serviced',description:'A polished serviced home in a planned central residential district.',features:['Serviced residence']}),
  property({id:'utako-serviced',name:'Utako executive apartment',area:'Utako',district:'utako',tier:3,type:'3-bedroom apartment',bedrooms:3,bathrooms:2,areaM2:145,stylePreset:'utako-executive',description:'An executive apartment near transport, offices and city hotels.',features:['Central transport access']}),
  property({id:'wuse-two-apartment',name:'Wuse II city apartment',area:'Wuse II',district:'wuse-ii-a08',tier:3,type:'3-bedroom city apartment',bedrooms:3,bathrooms:2,areaM2:148,stylePreset:'wuse-city',description:'A confident city apartment near retail, restaurants and nightlife.',features:['Walkable city lifestyle']}),
  property({id:'mabushi-townhouse',name:'Mabushi townhouse',area:'Mabushi',district:'mabushi',tier:3,type:'Townhouse',bedrooms:3,bathrooms:3,areaM2:158,stylePreset:'mabushi-townhouse',description:'A warm townhouse with stronger separation between social and private rooms.',features:['Townhouse layout']}),
  property({id:'guzape-terrace',name:'Guzape terrace',area:'Guzape',district:'guzape',tier:4,type:'3-bedroom terrace',bedrooms:3,bathrooms:3,areaM2:215,stylePreset:'guzape-hillside',description:'A hillside terrace with a generous living room and executive finish.',features:['Hillside outlook']}),
  property({id:'jahi-terrace',name:'Jahi garden terrace',area:'Jahi',district:'jahi',tier:4,type:'3-bedroom terrace',bedrooms:3,bathrooms:3,areaM2:224,stylePreset:'jahi-garden',description:'A modern terrace with a garden-facing lounge and calm private rooms.',features:['Garden-facing lounge']}),
  property({id:'kado-townhouse',name:'Kado executive townhouse',area:'Kado',district:'kado',tier:4,type:'Executive townhouse',bedrooms:4,bathrooms:4,areaM2:238,stylePreset:'kado-executive',description:'An executive townhouse built for hosting without sacrificing private space.',features:['Hosting-friendly plan']}),
  property({id:'gaduwa-duplex',name:'Gaduwa detached duplex',area:'Gaduwa',district:'gaduwa',tier:4,type:'Detached duplex',bedrooms:4,bathrooms:4,areaM2:255,stylePreset:'gaduwa-duplex',description:'A detached estate duplex with a larger dining and family-lounge footprint.',features:['Detached estate home']}),
  property({id:'katampe-penthouse',name:'Katampe hill penthouse',area:'Katampe',district:'katampe',tier:5,type:'Penthouse',bedrooms:3,bathrooms:4,areaM2:310,stylePreset:'katampe-penthouse',description:'A high-end hill apartment with premium entertaining space and broad views.',features:['Hill view','Premium entertaining space']}),
  property({id:'maitama-villa',name:'Maitama villa',area:'Maitama',district:'maitama',tier:5,type:'Private villa',bedrooms:5,bathrooms:5,areaM2:420,stylePreset:'maitama-villa',description:'A landscaped private compound with multiple lounge and study zones.',features:['Landscaped compound','Private study']}),
  property({id:'asokoro-residence',name:'Asokoro diplomatic residence',area:'Asokoro',district:'asokoro',tier:5,type:'Luxury residence',bedrooms:5,bathrooms:6,areaM2:455,stylePreset:'asokoro-residence',description:'A formal luxury residence with generous reception, dining and private living areas.',features:['Formal reception','Luxury compound']}),
  property({id:'katampe-extension-villa',name:'Katampe Extension sky villa',area:'Katampe Extension',district:'katampe-extension',tier:5,type:'Luxury villa',bedrooms:5,bathrooms:6,areaM2:480,stylePreset:'katampe-sky-villa',description:'A statement hilltop villa with premium lounge, study and outdoor living zones.',features:['Hilltop setting','Outdoor lounge']})
];
export const activities = {eat:{cost: 0,location:'home'},sleep:{cost: 0,location:'home'},shower:{cost: 0,location:'home'},relax:{cost: 0,location:'home'},hangout:{cost: 0,location:'public'},exercise:{cost: 0,location:'public'},cinema:{cost: 0,location:'public'}};
for(const [id,activity] of Object.entries(activities))activity.cost=economyPrice(ECONOMY_CONFIG.basicActivities,id);
export const transportModes = TRANSPORT_MODES;
export const appearanceOptions = {skinTone:['deep','brown','warm','light'],hair:['crop','locs','afro','braids','bun','long','twists','bald'],top:['ochre','forest','cream','navy','agbada'],body:['regular','slim','broad'],face:['oval','round','angular'],presentation:['neutral','feminine','masculine'],facialHair:['none','beard'],bottom:['charcoal','denim','cream'],shoes:['white','black'],accessory:['none','glasses']};

export function resalePrice(itemOrId){const item=typeof itemOrId==='string'?catalog.find(value=>value.id===itemOrId):itemOrId;return systemResaleValue(item);}

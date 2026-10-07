import { HOME_UPGRADES, TRANSPORT_MODES, INVESTMENT_META, systemResaleValue } from './life.mjs';
import { VEHICLE_CATALOG } from './vehicles.mjs';
import { EXTRA_HOME_ITEMS } from './home-items.mjs';
const task = (id,prompt,options,answer) => ({id,prompt,options:options.map(([id,label])=>({id,label})),answer});
export const jobs = {
  'restaurant-host': {id:'restaurant-host',title:'Restaurant host',district:'garki-i',pay:5600,energy:12,skill:'Hospitality',description:'Welcome guests and coordinate service.',tasks:[
    task('arrival','A party of four arrives. Only a table for two is ready.',[['join','Check whether two tables can be joined'],['split','Seat them apart without asking'],['ignore','Leave them waiting without an update']],'join'),
    task('allergy','A guest mentions a groundnut allergy.',[['guess','Assume the sauce is safe'],['kitchen','Confirm ingredients and preparation with the kitchen'],['remove','Remove the garnish and serve']],'kitchen'),
    task('order','One meal is delayed while the rest are ready.',[['update','Give a clear update and coordinate service'],['hide','Avoid the table'],['promise','Promise it is ready without checking']],'update')]},
  'junior-dev': {id:'junior-dev',title:'Junior developer',district:'wuse-ii-a07',pay:8500,energy:18,skill:'Technology',description:'Triage a customer issue and ship a careful fix.',tasks:[
    task('reproduce','A customer says checkout fails on mobile. Your first step?',[['reproduce','Reproduce the issue on a mobile viewport'],['rewrite','Rewrite checkout immediately'],['dismiss','Close the report']],'reproduce'),
    task('money','The browser submits its own account balance.',[['trust','Trust the value'],['server','Calculate balances on the server'],['round','Round the submitted number']],'server'),
    task('release','Your fix passes locally. Before release?',[['check','Run relevant checks and review the change'],['ship','Skip tests'],['delete','Delete the failing checks']],'check')]},
  'media-assistant': {id:'media-assistant',title:'Creative assistant',district:'garki-ii',pay:6200,energy:15,skill:'Creative',description:'Prepare and deliver a campaign.',tasks:[
    task('brief','A client requests an event flyer. What do you confirm?',[['facts','Date, venue, audience and approval contact'],['colour','Only their favourite colour'],['guess','Invent missing details']],'facts'),
    task('rights','You find a photographer’s image online.',[['copy','Copy it without asking'],['license','Use an image with permission or a suitable licence'],['crop','Crop away the watermark']],'license'),
    task('delivery','The client approves the final design.',[['source','Deliver agreed formats and keep a versioned copy'],['small','Send only a blurry screenshot'],['edit','Change the approved text']],'source')]},
  'property-agent': {id:'property-agent',title:'Property assistant',district:'jabi',pay:9800,energy:20,skill:'Sales',description:'Match a home to a resident and verify details.',tasks:[
    task('needs','A resident wants an apartment. Start with?',[['budget','Their budget, commute and household needs'],['luxury','The highest commission property'],['rush','Ask them to pay before viewing']],'budget'),
    task('listing','A listing has unclear ownership documents.',[['verify','Verify documentation before recommending it'],['hide','Hide that concern'],['guess','Assume it is fine']],'verify'),
    task('viewing','The resident asks about service charges.',[['total','Explain rent and all disclosed recurring charges'],['omit','Mention only the rent'],['avoid','Avoid the question']],'total')]},
  'site-supervisor': {id:'site-supervisor',title:'Site coordinator',district:'guzape',pay:11000,energy:24,skill:'Construction',description:'Coordinate a safe site handover.',tasks:[
    task('safety','A contractor arrives without protective gear.',[['ppe','Check suitable protection before entering the work zone'],['ignore','Let them start immediately'],['photo','Take a photo and walk away']],'ppe'),
    task('delivery','A material delivery does not match the order.',[['record','Record the mismatch and confirm with the supplier'],['accept','Accept everything without checking'],['discard','Throw it away']],'record'),
    task('handover','Before handing over a room, you should?',[['inspect','Inspect the work and record unresolved defects'],['paint','Cover defects with paint'],['sign','Sign without inspecting']],'inspect')]},
  'bank-teller': {id:'bank-teller',title:'Bank teller',district:'central-area',pay:7800,energy:16,skill:'Finance',description:'Help customers with accurate, secure account transactions.',tasks:[
    task('identity','A customer requests an account withdrawal. Start with?', [['verify','Verify their identity through the approved procedure'],['skip','Skip verification to shorten the queue'],['ask-pin','Ask them to say their secret PIN aloud']],'verify'),
    task('difference','The cash count differs from the transaction record.',[['reconcile','Recount and reconcile the record before continuing'],['hide','Hide the difference'],['guess','Change the record to a guessed amount']],'reconcile'),
    task('privacy','Another customer asks for their neighbour’s balance.',[['private','Protect the account holder’s confidential information'],['share','Read the balance aloud'],['photo','Send a screenshot']],'private')]}
};
export const catalog = [
  {id:'linen-shirt',name:'Linen shirt',category:'clothing',slot:'top',value:'cream',price:4200,description:'An easy neutral shirt for warm afternoons.'},
  {id:'office-shirt',name:'Office shirt',category:'clothing',slot:'top',value:'navy',price:5800,description:'A clean fit for work and city evenings.'},
  {id:'traditional-set',name:'Agbada set',category:'clothing',slot:'top',value:'agbada',price:12000,description:'A contemporary traditional outfit.'},
  {id:'white-trainers',name:'White trainers',category:'clothing',slot:'shoes',value:'white',price:4800,description:'Everyday city footwear.'},
  {id:'lounge-chair',name:'Lounge chair',category:'furniture',price:7500,description:'A comfortable chair for your living room.'},
  {id:'plant',name:'Indoor plant',category:'furniture',price:2300,description:'A little green for your home.'},
  {id:'bookshelf',name:'Bookshelf',category:'furniture',price:6500,description:'A quiet corner to read and unwind.'},
  {id:'sofa',name:'Two-seat sofa',category:'furniture',price:18000,description:'Room for a visitor and a conversation.'},
  {id:'dining-table',name:'Dining table',category:'furniture',price:4200,description:'A compact timber table for meals and visitors.'},
  {id:'bed',name:'Upholstered bed',category:'furniture',price:11000,description:'A comfortable upgrade for your bedroom.'},
  {id:'fridge',name:'Kitchen fridge',category:'furniture',price:9800,description:'Make the kitchen your own with a full-size fridge.'},
  {id:'floor-lamp',name:'Floor lamp',category:'furniture',price:3200,description:'Warm light beside your favourite chair.'},
  {id:'rug',name:'Woven rug',category:'furniture',price:2600,description:'Colour and texture for your living space.'},
  {id:'tv',name:'Living-room TV',category:'furniture',price:14500,description:'Build a proper entertainment corner.'},
  ...HOME_UPGRADES,
  ...EXTRA_HOME_ITEMS,
  ...VEHICLE_CATALOG
];

const PROPERTY_LAYOUTS=Object.freeze({
  0:'garki-studio',1:'lugbe-flat',2:'gwarinpa-apartment',3:'jabi-apartment',4:'guzape-terrace',5:'maitama-villa'
});
const PROPERTY_TIER_LABELS=Object.freeze(['Starter','Entry','Established','Premium','Executive','Luxury']);
const property=item=>{
  const layoutId=item.layoutId||PROPERTY_LAYOUTS[item.tier],features=item.features||[];
  return {...item,layoutId,area:item.area||item.name.split(' ')[0],price:item.buy,rentPeriod:'game year',rentPeriodDays:28,billPeriodDays:7,serviceCharge:item.bills,agencyFee:0,cautionDeposit:0,moveInCost:item.rent,priceLabel:'Game prices',fictional:true,tierLabel:PROPERTY_TIER_LABELS[item.tier]||'Luxury',furnishingTier:item.tier,comfortBonus:item.tier>=3?4:0,comfortDescription:item.tier>=3?'Fitted comfort adds 4 sleep energy and 4 relaxation fun.':'Practical starter comfort.',investmentIncome:Math.floor(item.buy*INVESTMENT_META.incomeBasisPoints/10000),investmentResale:Math.floor(item.buy*INVESTMENT_META.resaleBasisPoints/10000),features:[...features,item.tier>=2?'Visitor parking':'Street parking',item.tier>=4?'Private or gated compound':'Shared or estate compound',item.tier>=3?'Balcony, terrace or view treatment':'Practical kitchen'],viewing:{free:true,description:'Inspect the authored floor plan before spending any game Naira.'}};
};

export const properties = [
  property({id:'garki-studio',name:'Garki starter studio',area:'Garki I',district:'garki-i',tier:0,type:'Studio',bedrooms:0,bathrooms:1,areaM2:32,rent:0,buy:0,bills:450,stylePreset:'garki-starter',description:'A modest central studio shell with the essentials and space to make it yours.',features:['Central starter location']}),
  property({id:'mpape-self-contained',name:'Mpape hillside self-contained',area:'Mpape',district:'mpape',tier:1,type:'Self-contained',bedrooms:0,bathrooms:1,areaM2:36,rent:12000,buy:190000,bills:850,stylePreset:'hillside-compact',description:'A compact hillside home for a resident building from the ground up.',features:['Hillside neighbourhood']}),
  property({id:'lugbe-flat',name:'Lugbe one-bedroom',area:'Lugbe',district:'lugbe',tier:1,type:'1-bedroom flat',bedrooms:1,bathrooms:1,areaM2:58,rent:18000,buy:280000,bills:1200,stylePreset:'airport-corridor',description:'More space along the airport corridor with a proper bedroom and living room.',features:['Airport corridor access']}),
  property({id:'dawaki-compact',name:'Dawaki compact apartment',area:'Dawaki',district:'dawaki',tier:1,type:'1-bedroom apartment',bedrooms:1,bathrooms:1,areaM2:61,rent:21000,buy:335000,bills:1300,stylePreset:'dawaki-warm',description:'An easy everyday apartment with a calm residential feel.',features:['Quiet residential setting']}),
  property({id:'kubwa-one-bed',name:'Kubwa city one-bedroom',area:'Kubwa',district:'kubwa',tier:1,type:'1-bedroom flat',bedrooms:1,bathrooms:1,areaM2:64,rent:24000,buy:390000,bills:1450,stylePreset:'kubwa-city',description:'A practical home close to the energy and convenience of Kubwa.',features:['Satellite-city convenience']}),
  property({id:'karmo-compact',name:'Karmo compact flat',area:'Karmo',district:'karmo',tier:1,type:'Compact flat',bedrooms:1,bathrooms:1,areaM2:60,rent:22500,buy:360000,bills:1350,stylePreset:'karmo-compact',description:'A straightforward compact flat on Abuja’s western residential edge.',features:['Value-focused location']}),
  property({id:'lokogoma-two-bed',name:'Lokogoma two-bedroom',area:'Lokogoma',district:'lokogoma',tier:2,type:'2-bedroom estate flat',bedrooms:2,bathrooms:2,areaM2:92,rent:34000,buy:540000,bills:2050,stylePreset:'estate-modern',description:'A family-sized estate flat with comfortable shared living space.',features:['Estate living']}),
  property({id:'gwarinpa-apartment',name:'Gwarinpa apartment',area:'Gwarinpa I',district:'gwarinpa-i',tier:2,type:'2-bedroom apartment',bedrooms:2,bathrooms:2,areaM2:105,rent:38000,buy:620000,bills:2300,stylePreset:'gwarinpa-family',description:'A residential base with room for friends and everyday family life.',features:['Large residential district']}),
  property({id:'gudu-family-flat',name:'Gudu family flat',area:'Gudu',district:'gudu',tier:2,type:'2-bedroom flat',bedrooms:2,bathrooms:2,areaM2:99,rent:41000,buy:680000,bills:2450,stylePreset:'gudu-neutral',description:'A balanced two-bedroom close to Gudu’s mixed residential and commercial life.',features:['Mixed-use neighbourhood']}),
  property({id:'durumi-estate',name:'Durumi estate apartment',area:'Durumi',district:'durumi',tier:2,type:'2-bedroom estate apartment',bedrooms:2,bathrooms:2,areaM2:108,rent:46000,buy:760000,bills:2700,stylePreset:'durumi-estate',description:'A composed estate apartment with a larger kitchen and living area.',features:['Estate setting']}),
  property({id:'galadimawa-estate',name:'Galadimawa estate home',area:'Galadimawa',district:'galadimawa',tier:2,type:'2-bedroom estate home',bedrooms:2,bathrooms:2,areaM2:112,rent:50000,buy:820000,bills:2850,stylePreset:'galadimawa-light',description:'A roomy estate home with expressway access and clean contemporary finishes.',features:['Expressway access']}),
  property({id:'jabi-apartment',name:'Jabi lake-side apartment',area:'Jabi',district:'jabi',tier:3,type:'2-bedroom serviced apartment',bedrooms:2,bathrooms:2,areaM2:125,rent:62000,buy:980000,bills:3200,stylePreset:'jabi-lakeside',description:'A modern apartment close to the lake, mall and city life.',features:['Lake-side district']}),
  property({id:'wuye-serviced',name:'Wuye serviced apartment',area:'Wuye',district:'wuye',tier:3,type:'2-bedroom serviced apartment',bedrooms:2,bathrooms:2,areaM2:132,rent:68000,buy:1080000,bills:3500,stylePreset:'wuye-serviced',description:'A polished serviced home in a planned central residential district.',features:['Serviced residence']}),
  property({id:'utako-serviced',name:'Utako executive apartment',area:'Utako',district:'utako',tier:3,type:'3-bedroom apartment',bedrooms:3,bathrooms:2,areaM2:145,rent:76000,buy:1240000,bills:3900,stylePreset:'utako-executive',description:'An executive apartment near transport, offices and city hotels.',features:['Central transport access']}),
  property({id:'wuse-two-apartment',name:'Wuse II city apartment',area:'Wuse II',district:'wuse-ii-a08',tier:3,type:'3-bedroom city apartment',bedrooms:3,bathrooms:2,areaM2:148,rent:85000,buy:1420000,bills:4300,stylePreset:'wuse-city',description:'A confident city apartment near retail, restaurants and nightlife.',features:['Walkable city lifestyle']}),
  property({id:'mabushi-townhouse',name:'Mabushi townhouse',area:'Mabushi',district:'mabushi',tier:3,type:'Townhouse',bedrooms:3,bathrooms:3,areaM2:158,rent:90000,buy:1580000,bills:4600,stylePreset:'mabushi-townhouse',description:'A warm townhouse with stronger separation between social and private rooms.',features:['Townhouse layout']}),
  property({id:'guzape-terrace',name:'Guzape terrace',area:'Guzape',district:'guzape',tier:4,type:'3-bedroom terrace',bedrooms:3,bathrooms:3,areaM2:215,rent:115000,buy:2200000,bills:6200,stylePreset:'guzape-hillside',description:'A hillside terrace with a generous living room and executive finish.',features:['Hillside outlook']}),
  property({id:'jahi-terrace',name:'Jahi garden terrace',area:'Jahi',district:'jahi',tier:4,type:'3-bedroom terrace',bedrooms:3,bathrooms:3,areaM2:224,rent:126000,buy:2460000,bills:6600,stylePreset:'jahi-garden',description:'A modern terrace with a garden-facing lounge and calm private rooms.',features:['Garden-facing lounge']}),
  property({id:'kado-townhouse',name:'Kado executive townhouse',area:'Kado',district:'kado',tier:4,type:'Executive townhouse',bedrooms:4,bathrooms:4,areaM2:238,rent:139000,buy:2740000,bills:7100,stylePreset:'kado-executive',description:'An executive townhouse built for hosting without sacrificing private space.',features:['Hosting-friendly plan']}),
  property({id:'gaduwa-duplex',name:'Gaduwa detached duplex',area:'Gaduwa',district:'gaduwa',tier:4,type:'Detached duplex',bedrooms:4,bathrooms:4,areaM2:255,rent:152000,buy:3050000,bills:7600,stylePreset:'gaduwa-duplex',description:'A detached estate duplex with a larger dining and family-lounge footprint.',features:['Detached estate home']}),
  property({id:'katampe-penthouse',name:'Katampe hill penthouse',area:'Katampe',district:'katampe',tier:5,type:'Penthouse',bedrooms:3,bathrooms:4,areaM2:310,rent:215000,buy:4700000,bills:9800,stylePreset:'katampe-penthouse',description:'A high-end hill apartment with premium entertaining space and broad views.',features:['Hill view','Premium entertaining space']}),
  property({id:'maitama-villa',name:'Maitama villa',area:'Maitama',district:'maitama',tier:5,type:'Private villa',bedrooms:5,bathrooms:5,areaM2:420,rent:240000,buy:5800000,bills:11000,stylePreset:'maitama-villa',description:'A landscaped private compound with multiple lounge and study zones.',features:['Landscaped compound','Private study']}),
  property({id:'asokoro-residence',name:'Asokoro diplomatic residence',area:'Asokoro',district:'asokoro',tier:5,type:'Luxury residence',bedrooms:5,bathrooms:6,areaM2:455,rent:300000,buy:7600000,bills:13500,stylePreset:'asokoro-residence',description:'A formal luxury residence with generous reception, dining and private living areas.',features:['Formal reception','Luxury compound']}),
  property({id:'katampe-extension-villa',name:'Katampe Extension sky villa',area:'Katampe Extension',district:'katampe-extension',tier:5,type:'Luxury villa',bedrooms:5,bathrooms:6,areaM2:480,rent:335000,buy:8300000,bills:14800,stylePreset:'katampe-sky-villa',description:'A statement hilltop villa with premium lounge, study and outdoor living zones.',features:['Hilltop setting','Outdoor lounge']})
];
export const activities = {eat:{cost:1200,location:'home'},sleep:{cost:0,location:'home'},shower:{cost:0,location:'home'},relax:{cost:0,location:'home'},hangout:{cost:2400,location:'public'},exercise:{cost:800,location:'public'},cinema:{cost:3800,location:'public'}};
export const transportModes = TRANSPORT_MODES;
export const appearanceOptions = {skinTone:['deep','brown','warm','light'],hair:['crop','locs','afro','braids','bun','long','twists','bald'],top:['ochre','forest','cream','navy','agbada'],body:['regular','slim','broad'],face:['oval','round','angular'],presentation:['neutral','feminine','masculine'],facialHair:['none','beard'],bottom:['charcoal','denim','cream'],shoes:['white','black'],accessory:['none','glasses']};

export function resalePrice(itemOrId){const item=typeof itemOrId==='string'?catalog.find(value=>value.id===itemOrId):itemOrId;return systemResaleValue(item);}

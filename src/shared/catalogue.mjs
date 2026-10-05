import { HOME_UPGRADES, TRANSPORT_MODES, INVESTMENT_META, systemResaleValue } from './life.mjs';
import { VEHICLE_CATALOG } from './vehicles.mjs';
import { EXTRA_HOME_ITEMS } from './home-items.mjs';
const task = (id,prompt,options,answer) => ({id,prompt,options:options.map(([id,label])=>({id,label})),answer});
const ITEM_PRICE_MULTIPLIER = 10;
const scaleCatalogItem = item => {
  if (!Number.isSafeInteger(item?.price) || item.price < 0) throw new RangeError(`Invalid catalogue price for ${item?.id || 'item'}`);
  const price = item.price * ITEM_PRICE_MULTIPLIER;
  if (!Number.isSafeInteger(price)) throw new RangeError(`Catalogue price overflow for ${item.id}`);
  const next = { ...item, price };
  if (Number.isSafeInteger(item.cost)) {
    const cost = item.cost * ITEM_PRICE_MULTIPLIER;
    if (!Number.isSafeInteger(cost)) throw new RangeError(`Catalogue cost overflow for ${item.id}`);
    next.cost = cost;
  }
  return next;
};
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
].map(scaleCatalogItem);
export const properties = [
  {id:'garki-studio',name:'Garki starter studio',district:'garki-i',tier:0,rent:0,buy:0,bills:450,description:'A modest studio shell with a bathroom, ready to make your own.'},
  {id:'lugbe-flat',name:'Lugbe one-bedroom',district:'lugbe',tier:1,rent:18000,buy:280000,bills:1200,description:'More space along the airport corridor.'},
  {id:'gwarinpa-apartment',name:'Gwarinpa apartment',district:'gwarinpa-i',tier:2,rent:38000,buy:620000,bills:2300,description:'A residential base with room for friends.'},
  {id:'jabi-apartment',name:'Jabi lake-side apartment',district:'jabi',tier:3,rent:62000,buy:980000,bills:3200,description:'A modern apartment close to city life.'},
  {id:'guzape-terrace',name:'Guzape terrace',district:'guzape',tier:4,rent:115000,buy:2200000,bills:6200,description:'A hillside terrace with a generous living room.'},
  {id:'maitama-villa',name:'Maitama villa',district:'maitama',tier:5,rent:240000,buy:5800000,bills:11000,description:'A landscaped private compound.'}
].map(item=>{
  const plans=[['studio',0,1,32],['flat',1,1,58],['apartment',2,1,105],['apartment',1,1,125],['terrace',2,1,215],['villa',2,1,420]];
  const [type,bedrooms,bathrooms,areaM2]=plans[item.tier];
  return {...item,price:item.buy,type,bedrooms,bathrooms,areaM2,rentPeriod:'game year',rentPeriodDays:28,billPeriodDays:7,serviceCharge:item.bills,agencyFee:0,cautionDeposit:0,moveInCost:item.rent,priceLabel:'Game prices',fictional:true,comfortBonus:item.tier>=3?4:0,comfortDescription:item.tier>=3?'Fitted comfort adds 4 sleep energy and 4 relaxation fun.':'Practical starter comfort.',investmentIncome:Math.floor(item.buy*INVESTMENT_META.incomeBasisPoints/10000),investmentResale:Math.floor(item.buy*INVESTMENT_META.resaleBasisPoints/10000),features:[item.tier===0?'Starter studio shell':'Separate living space',item.tier>=2?'Visitor parking':'Street parking',item.tier>=4?'Private compound':'Shared compound',item.tier>=3?'Balcony or terrace':'Practical kitchen'],viewing:{free:true,description:'Inspect the authored floor plan before spending any game Naira.'}};
});
export const activities = {eat:{cost:1200,location:'home'},sleep:{cost:0,location:'home'},shower:{cost:0,location:'home'},relax:{cost:0,location:'home'},hangout:{cost:2400,location:'public'},exercise:{cost:800,location:'public'},cinema:{cost:3800,location:'public'}};
export const transportModes = TRANSPORT_MODES;
export const appearanceOptions = {skinTone:['deep','brown','warm','light'],hair:['crop','locs','afro','braids','bun','long','twists','bald'],top:['ochre','forest','cream','navy','agbada'],body:['regular','slim','broad'],face:['oval','round','angular'],presentation:['neutral','feminine','masculine'],facialHair:['none','beard'],bottom:['charcoal','denim','cream'],shoes:['white','black'],accessory:['none','glasses']};

export function resalePrice(itemOrId){const item=typeof itemOrId==='string'?catalog.find(value=>value.id===itemOrId):itemOrId;return systemResaleValue(item);}

// Original virtual home goods. Prices are game Naira and carry no real-goods entitlement.
export const EXTRA_HOME_ITEMS = Object.freeze([
  {id:'work-desk',name:'Home office desk',price:18000,modelKind:'desk',width:164,depth:75,description:'Make a work corner of your own.'},
  {id:'wardrobe',name:'Bedroom wardrobe',price:22000,modelKind:'wardrobe',width:126,depth:58,description:'A full-height timber wardrobe for your bedroom.'},
  {id:'kitchen-unit',name:'Fitted kitchen counter',price:35000,modelKind:'kitchen',width:235,depth:84,description:'A kitchen unit with a sink and cooker for your next home.'},
  {id:'washing-machine',name:'Front-load washing machine',price:46000,modelKind:'washing-machine',width:72,depth:74,description:'A proper laundry corner after a busy Abuja day.'},
  {id:'standing-fan',name:'Standing fan',price:6500,modelKind:'standing-fan',width:44,depth:42,upright:true,description:'A cooling companion for warm afternoons.'},
  {id:'microwave',name:'Microwave & stand',price:16500,modelKind:'microwave',width:89,depth:57,description:'A compact stand and microwave for your kitchen.'},
  {id:'shoe-rack',name:'Entryway shoe rack',price:6500,modelKind:'shoe-rack',width:102,depth:42,description:'Keep your trainers and slippers by the door.'},
  {id:'music-speaker',name:'Home music speaker',price:12000,modelKind:'music-speaker',width:45,depth:43,upright:true,description:'Give your lounge an entertainment corner.'},
  {id:'coffee-table',name:'Timber coffee table',price:8000,modelKind:'coffee-table',width:148,depth:76,description:'A low table to finish the space beside your sofa.'},
  {id:'accent-chair',name:'Terracotta accent chair',price:14000,modelKind:'lounge-chair',width:87,depth:83,color:'#ad785f',description:'A warm statement chair for a quiet corner.'},
  {id:'office-chair',name:'Home office chair',price:8500,modelKind:'office-chair',width:71,depth:72,description:'A swivel chair to pair with your desk.'},
  {id:'bedside-table',name:'Bedside table',price:4800,modelKind:'bedside-table',width:61,depth:56,description:'A place for your phone and reading light.'},
  {id:'full-length-mirror',name:'Full-length mirror',price:12000,modelKind:'full-length-mirror',width:47,depth:35,upright:true,description:'An upright framed mirror for getting ready.'},
  {id:'balcony-bench',name:'Balcony timber bench',price:16500,modelKind:'balcony-bench',width:186,depth:69,description:'Sit out and enjoy your own view of the capital.'},
  {id:'large-rug',name:'Large sage rug',price:7800,modelKind:'rug',width:286,depth:184,solid:false,color:'#8a9b83',description:'A larger soft rug to define your living area.'},
  {id:'tall-plant',name:'Tall indoor palm',price:6800,modelKind:'plant',width:63,depth:57,upright:true,description:'Bring a little green into a spacious room.'},
  {id:'storage-drawers',name:'Chest of drawers',price:18500,modelKind:'storage-drawers',width:134,depth:57,description:'A tidy home starts with storage of your own.'},
  {id:'library-shelf',name:'Wide library shelf',price:21000,modelKind:'bookshelf',width:183,depth:58,description:'Build a reading corner with a generous timber shelf.'}
].map(item=>Object.freeze({...item,category:'furniture'})));
export const HOME_ITEM_MODELS=Object.freeze(Object.fromEntries(EXTRA_HOME_ITEMS.map(item=>[item.id,item])));

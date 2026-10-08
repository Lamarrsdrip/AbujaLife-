import { ITEM_PRICES, economyPrice } from './economy.mjs';
// Original virtual home goods. Prices are game Naira and carry no real-goods entitlement.
export const EXTRA_HOME_ITEMS = Object.freeze([
  {id:'work-desk',name:'Home office desk',modelKind:'desk',width:164,depth:75,description:'Make a work corner of your own.'},
  {id:'wardrobe',name:'Bedroom wardrobe',modelKind:'wardrobe',width:126,depth:58,description:'A full-height timber wardrobe for your bedroom.'},
  {id:'kitchen-unit',name:'Fitted kitchen counter',modelKind:'kitchen',width:235,depth:84,description:'A kitchen unit with a sink and cooker for your next home.'},
  {id:'washing-machine',name:'Front-load washing machine',modelKind:'washing-machine',width:72,depth:74,description:'A proper laundry corner after a busy Abuja day.'},
  {id:'standing-fan',name:'Standing fan',modelKind:'standing-fan',width:44,depth:42,upright:true,description:'A cooling companion for warm afternoons.'},
  {id:'microwave',name:'Microwave & stand',modelKind:'microwave',width:89,depth:57,description:'A compact stand and microwave for your kitchen.'},
  {id:'shoe-rack',name:'Entryway shoe rack',modelKind:'shoe-rack',width:102,depth:42,description:'Keep your trainers and slippers by the door.'},
  {id:'music-speaker',name:'Home music speaker',modelKind:'music-speaker',width:45,depth:43,upright:true,description:'Give your lounge an entertainment corner.'},
  {id:'coffee-table',name:'Timber coffee table',modelKind:'coffee-table',width:148,depth:76,description:'A low table to finish the space beside your sofa.'},
  {id:'accent-chair',name:'Terracotta accent chair',modelKind:'lounge-chair',width:87,depth:83,color:'#ad785f',description:'A warm statement chair for a quiet corner.'},
  {id:'office-chair',name:'Home office chair',modelKind:'office-chair',width:71,depth:72,description:'A swivel chair to pair with your desk.'},
  {id:'bedside-table',name:'Bedside table',modelKind:'bedside-table',width:61,depth:56,description:'A place for your phone and reading light.'},
  {id:'full-length-mirror',name:'Full-length mirror',modelKind:'full-length-mirror',width:47,depth:35,upright:true,description:'An upright framed mirror for getting ready.'},
  {id:'balcony-bench',name:'Balcony timber bench',modelKind:'balcony-bench',width:186,depth:69,description:'Sit out and enjoy your own view of the capital.'},
  {id:'large-rug',name:'Large sage rug',modelKind:'rug',width:286,depth:184,solid:false,color:'#8a9b83',description:'A larger soft rug to define your living area.'},
  {id:'tall-plant',name:'Tall indoor palm',modelKind:'plant',width:63,depth:57,upright:true,description:'Bring a little green into a spacious room.'},
  {id:'storage-drawers',name:'Chest of drawers',modelKind:'storage-drawers',width:134,depth:57,description:'A tidy home starts with storage of your own.'},
  {id:'library-shelf',name:'Wide library shelf',modelKind:'bookshelf',width:183,depth:58,description:'Build a reading corner with a generous timber shelf.'},
  {id:'table-lamp',name:'Warm bedside lamp',modelKind:'table-lamp',width:40,depth:32,placement:'surface',description:'Place a warm reading light on a table or counter.'},
  {id:'ceramic-vase',name:'Hand-finished ceramic vase',modelKind:'vase',width:28,depth:28,placement:'surface',description:'A sculpted vase for your sideboard or coffee table.'},
  {id:'succulent',name:'Potted succulent',modelKind:'succulent',width:30,depth:30,placement:'surface',description:'A little green for a bedside table or kitchen counter.'},
  {id:'book-stack',name:'Coffee-table books',modelKind:'book-stack',width:44,depth:32,placement:'surface',description:'A thoughtful finishing touch for your table or sideboard.'},

  // Richer resident-owned 3D pieces. These are proper inventory items: residents can buy,
  // place, store, move and resell them instead of living with permanently baked-in decor.
  {id:'vanity-desk',name:'Bedroom vanity desk',modelKind:'desk',width:146,depth:69,description:'A clean dressing and getting-ready station for the bedroom.'},
  {id:'reading-chair',name:'Deep reading chair',modelKind:'lounge-chair',width:94,depth:88,color:'#8d765f',description:'A relaxed reading chair for a quiet corner.'},
  {id:'media-sideboard',name:'Media sideboard',modelKind:'storage-drawers',width:176,depth:52,description:'A low storage unit for the living-room media wall.'},
  {id:'kitchen-island',name:'Kitchen island',modelKind:'kitchen',width:212,depth:91,description:'A proper prep island that makes a larger kitchen feel lived in.'},
  {id:'dining-bench',name:'Dining bench',modelKind:'balcony-bench',width:172,depth:61,description:'A timber bench that works beside a dining table or against a wall.'},
  {id:'entry-console',name:'Entry console table',modelKind:'coffee-table',width:132,depth:49,description:'A slim console for keys, bags and the first corner guests see.'},
  {id:'tall-bookshelf',name:'Tall statement bookshelf',modelKind:'bookshelf',width:142,depth:54,description:'A taller shelf for books, objects and a more finished room.'},
  {id:'floor-speaker',name:'Floor-standing speaker',modelKind:'music-speaker',width:52,depth:48,upright:true,description:'A larger speaker for residents building a proper entertainment setup.'},
  {id:'indoor-ficus',name:'Indoor ficus tree',modelKind:'plant',width:71,depth:63,upright:true,description:'A fuller indoor tree for large rooms, corners and balconies.'},
  {id:'runner-rug',name:'Hallway runner rug',modelKind:'rug',width:246,depth:86,solid:false,color:'#9b8269',description:'A long woven runner for hallways and entry spaces.'},
  {id:'laundry-cabinet',name:'Laundry storage cabinet',modelKind:'storage-drawers',width:118,depth:54,description:'Closed storage for laundry supplies and household essentials.'},
  {id:'coffee-bar',name:'Home coffee bar',modelKind:'kitchen',width:168,depth:67,description:'A compact drinks and coffee station for hosting at home.'},
  {id:'window-bench',name:'Window bench',modelKind:'balcony-bench',width:181,depth:66,description:'A low bench for a bright window or balcony corner.'},
  {id:'console-table',name:'Slim console table',modelKind:'coffee-table',width:158,depth:48,description:'A narrow table for a hallway, mirror wall or lounge edge.'}
].map(item=>Object.freeze({...item,price:economyPrice(ITEM_PRICES,item.id),category:'furniture'})));
export const HOME_ITEM_MODELS=Object.freeze(Object.fromEntries(EXTRA_HOME_ITEMS.map(item=>[item.id,item])));

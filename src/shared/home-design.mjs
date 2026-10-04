// Resident choices for the authored cutaway home. These colours are local game
// materials; partitions use the same normalised floor coordinates as furniture.
export const HOME_WALL_COLORS = [
  {id:'sand',name:'Warm sand',hex:'#c4b096'},
  {id:'ivory',name:'Soft ivory',hex:'#e8e3d5'},
  {id:'sage',name:'Quiet sage',hex:'#9eae9c'},
  {id:'clay',name:'Terracotta',hex:'#be9277'},
];
export const HOME_FLOORS = [
  {id:'oak',name:'Natural oak',hex:'#b39472'},
  {id:'darkoak',name:'Dark oak',hex:'#765b43'},
  {id:'tile',name:'Stone tile',hex:'#d8d3c8'},
];
export const HOME_DESIGN_LIMITS = Object.freeze({minThickness:.008,maxThickness:.07,maxLength:1});
export const DEFAULT_HOME_DESIGN = Object.freeze({wall:'sand',floor:'oak',partitions:Object.freeze([])});

const object = value => value && typeof value==='object' && !Array.isArray(value) && (Object.getPrototypeOf(value)===Object.prototype || Object.getPrototypeOf(value)===null);
const fail = message => {throw new Error(message);};
const hasOnly = (value,keys) => Object.keys(value).every(key=>keys.includes(key));

export function validateHomeDesign(value = {}) {
  if(!object(value) || !hasOnly(value,['wall','floor','partitions']))fail('Choose a valid home design.');
  const wall=value.wall ?? DEFAULT_HOME_DESIGN.wall, floor=value.floor ?? DEFAULT_HOME_DESIGN.floor;
  if(!HOME_WALL_COLORS.some(option=>option.id===wall))fail('Choose a wall colour from your home studio.');
  if(!HOME_FLOORS.some(option=>option.id===floor))fail('Choose a floor from your home studio.');
  const partitions=value.partitions ?? [];
  if(!Array.isArray(partitions))fail('Choose a valid list of room dividers.');
  const ids=new Set();
  const checked=partitions.map(partition=>{
    if(!object(partition) || !hasOnly(partition,['id','x','y','w','h']))fail('Choose a valid room divider.');
    if(typeof partition.id!=='string' || !/^[a-z0-9_-]{1,40}$/.test(partition.id) || ids.has(partition.id))fail('Each room divider needs its own valid ID.');
    ids.add(partition.id);
    const {id,x,y,w,h}=partition;
    if(![x,y,w,h].every(n=>typeof n==='number' && Number.isFinite(n)))fail('Room divider positions must be finite numbers.');
    if(x<0 || y<0 || x>1 || y>1 || w<HOME_DESIGN_LIMITS.minThickness || h<HOME_DESIGN_LIMITS.minThickness || w>HOME_DESIGN_LIMITS.maxLength || h>HOME_DESIGN_LIMITS.maxLength || x+w>1 || y+h>1)fail('Keep each room divider inside your home floor.');
    if(Math.min(w,h)>HOME_DESIGN_LIMITS.maxThickness)fail('A room divider must be a thin wall.');
    return {id,x,y,w,h};
  });
  return {wall,floor,partitions:checked};
}

export function readHomeDesign(profile) {
  const fallback={floor:['jabi-apartment','maitama-villa'].includes(profile?.home?.layoutId || profile?.home?.propertyId)?'tile':'oak'};
  try{return validateHomeDesign(profile?.home?.roomStyle || profile?.roomStyle || fallback);}catch{return validateHomeDesign(fallback);}
}

export const homeWallColor = design => HOME_WALL_COLORS.find(option=>option.id===design?.wall)?.hex || HOME_WALL_COLORS[0].hex;
export const homeFloorColor = design => HOME_FLOORS.find(option=>option.id===design?.floor)?.hex || HOME_FLOORS[0].hex;

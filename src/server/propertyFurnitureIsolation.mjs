import { GameError } from './errors.mjs';
import { catalog } from '../shared/catalogue.mjs';

const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const safeItemId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const furnitureIds=new Set(catalog.filter(item=>item.category==='furniture').map(item=>item.id));

export function scopeFurnitureLayout(layout,currentPropertyId){
  if(!currentPropertyId)return{layout:layout||{},changed:false};
  if(Array.isArray(layout)){
    let changed=false;
    const next=layout.map(entry=>{
      if(!object(entry)||entry.propertyId||!safeItemId(entry.itemId||entry.id))return entry;
      changed=true;return{...entry,propertyId:currentPropertyId};
    });
    return{layout:next,changed};
  }
  if(!object(layout))return{layout:{},changed:Boolean(layout)};
  let changed=false;const next={};
  for(const [itemId,value] of Object.entries(layout)){
    if(!safeItemId(itemId)){next[itemId]=value;continue;}
    if(object(value)&&!value.propertyId){next[itemId]={...value,propertyId:currentPropertyId};changed=true;}
    else if(Number.isFinite(value)){next[itemId]={slot:value,propertyId:currentPropertyId};changed=true;}
    else next[itemId]=value;
  }
  return{layout:next,changed};
}

export function furnitureForProperty(layout,propertyId){
  const scoped=scopeFurnitureLayout(layout,propertyId).layout;
  if(Array.isArray(scoped))return scoped.filter(entry=>!entry?.propertyId||entry.propertyId===propertyId);
  return Object.fromEntries(Object.entries(scoped||{}).filter(([,entry])=>!object(entry)||!entry.propertyId||entry.propertyId===propertyId));
}

export function installPropertyFurnitureIsolation(store){
  if(!store||typeof store.profile!=='function'||typeof store.action!=='function'||typeof store.collection!=='function')throw new GameError('Property furniture isolation requires the persistent game store',500,'storage_unavailable');
  if(store.propertyFurnitureIsolationInstalled)return store;
  const baseProfile=store.profile.bind(store),baseAction=store.action.bind(store);

  store.profile=async(residentId,options={})=>{
    const profile=await baseProfile(residentId,options),propertyId=profile?.home?.propertyId;
    const scoped=scopeFurnitureLayout(profile?.furnitureLayout,propertyId);
    // Default placements are physical furniture too. Anchor owned pieces that
    // have never been moved in Studio before a change of home, while explicitly
    // stored items remain loose inventory available for intentional placement.
    if(propertyId){
      const entries=Array.isArray(scoped.layout)?scoped.layout:Object.entries(scoped.layout||{}).map(([itemId,value])=>({itemId,...value}));
      const placedIds=new Set(entries.map(entry=>entry?.itemId||entry?.id));
      const storedIds=new Set(profile.storedFurniture||[]);
      for(const item of profile.inventory||[]){
        const itemId=typeof item==='string'?item:item?.itemId||item?.id;
        if(!furnitureIds.has(itemId)||storedIds.has(itemId)||placedIds.has(itemId))continue;
        const entry={itemId,propertyId};
        if(Array.isArray(scoped.layout))scoped.layout.push(entry);
        else scoped.layout[itemId]={propertyId};
        placedIds.add(itemId);scoped.changed=true;
      }
    }
    if(scoped.changed){
      const dbOptions=options?.session?{session:options.session}:{};
      const previous=profile.furnitureLayout;
      const filter={residentId,propertyId};
      // Mongo profiles normalise absent legacy layouts to an empty object.
      // Permit that first migration without matching a newer, nonempty layout.
      if(object(previous)&&Object.keys(previous).length===0)filter.$or=[{furnitureLayout:previous},{furnitureLayout:{$exists:false}}];
      else filter.furnitureLayout=previous===undefined?{$exists:false}:previous;
      const result=await store.collection('homes').updateOne(filter,{$set:{furnitureLayout:scoped.layout}},dbOptions);
      // A concurrent move or Studio edit wins over this lazy migration. Re-read
      // its authoritative profile instead of overwriting the newer coordinates.
      if(result?.matchedCount===0)return baseProfile(residentId,options);
      profile.furnitureLayout=scoped.layout;
      profile.legacyFurnitureScopedToProperty=propertyId;
    }
    return profile;
  };

  store.action=async(residentId,action,payload={})=>{
    // Force the one-time legacy migration before a home transition. The existing
    // action then changes only the active home; prior placements keep their old
    // propertyId and therefore cannot render in the destination.
    if(action==='move-home')await store.profile(residentId);
    return baseAction(residentId,action,payload);
  };
  store.propertyFurnitureIsolationInstalled=true;
  return store;
}

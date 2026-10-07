import { GameError } from './errors.mjs';

const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const safeItemId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);

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
    if(scoped.changed){
      const dbOptions=options?.session?{session:options.session}:{};
      await store.collection('homes').updateOne({residentId},{$set:{furnitureLayout:scoped.layout}},dbOptions);
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

import {discoveryActivity,discoveryCompletedFeatures,activitiesForFeature} from '../shared/activity-discovery.mjs';
import {GameError} from './errors.mjs';

// Discovery is part of existing resident progression. It never grants money,
// opens a second realtime channel, or writes a parallel player profile.
export function installActivityDiscovery(store,{log=()=>{}}={}){
 if(store.discoveryInstalled)return;store.discoveryInstalled=true;
 function recordLocal(id,values,{claimAfter=null}={}){const p=store.profile(id);if(claimAfter!==null&&p.discovery?.lastShownAt>claimAfter)return false;p.discovery||={};for(const [path,value] of Object.entries(values)){const parts=path.split('.');let target=p.discovery;for(const part of parts.slice(0,-1)){target[part]||={};target=target[part];}target[parts.at(-1)]=value;}store.save(p);return true;}
 async function record(id,values,{claimAfter=null}={}){
  if(store.collection){const result=await store.collection('progression').updateOne({residentId:id,...(claimAfter===null?{}:{$or:[{'discovery.lastShownAt':{$exists:false}},{'discovery.lastShownAt':{$lte:claimAfter}}]})},{$set:Object.fromEntries(Object.entries(values).map(([key,value])=>['discovery.'+key,value]))});return result.modifiedCount===1;}
  else return recordLocal(id,values,{claimAfter});
 }
 const action=store.action.bind(store);
 async function discoveryEvent(id,payload){
   const activity=discoveryActivity(payload.activityId),event=payload.event;
   if(!activity||!['shown','clicked','dismissed','discovered'].includes(event))throw new GameError('Choose a valid discovery event',400,'invalid_discovery');
   const profile=await store.profile(id),now=store.clock(),last=profile.discovery?.entries?.[activity.id]||{};
   if(last[event+'At']&&now-last[event+'At']<30000)return {ok:true,...(event==='shown'?{suppressed:true}:{}),discovery:profile.discovery};
   const values={...(event==='discovered'?{[`features.${activity.feature}`]:now}:{}),[`entries.${activity.id}.${event}At`]:now,...(event==='shown'?{[`categories.${activity.category}`]:now,lastShownAt:now}:{})};
   const accepted=await record(id,values,{claimAfter:event==='shown'?now-300000:null});if(!accepted)return {ok:true,suppressed:true,discovery:(await store.profile(id)).discovery};log('activity_discovery',{residentId:id,activityId:activity.id,event});
   return {ok:true,discovery:(await store.profile(id)).discovery};
 }
 async function complete(id,name,payload,result){
  const features=discoveryCompletedFeatures(name,payload,result?.profile);
  if(features.length&&!result?.replayed){try{const now=store.clock(),values=Object.fromEntries(features.map(feature=>[`features.${feature}`,now]));
   for(const feature of features)for(const activity of activitiesForFeature(feature))values[`entries.${activity.id}.completedAt`]=now;
   await record(id,values);if(result?.profile)result.profile.discovery=(await store.profile(id)).discovery;
   log('activity_discovery',{residentId:id,features,event:'completed'});
  }catch(error){log('activity_discovery_failure',{code:error.code||'storage_error'});}}
  return result;
 }
 store.action=(id,name,payload={})=>{
  if(name==='discovery-event')return discoveryEvent(id,payload);
  const result=action(id,name,payload);
  if(store.collection)return Promise.resolve(result).then(value=>complete(id,name,payload,value));
  // SQLite's game owner intentionally has a synchronous action contract.
  // Preserve it for local gameplay and existing consumers.
  const features=discoveryCompletedFeatures(name,payload,result?.profile);
  if(features.length&&!result?.replayed){try{const now=store.clock();const values=Object.fromEntries(features.map(feature=>['features.'+feature,now]));for(const feature of features)for(const activity of activitiesForFeature(feature))values[`entries.${activity.id}.completedAt`]=now;recordLocal(id,values);if(result?.profile)result.profile.discovery=store.profile(id).discovery;log('activity_discovery',{residentId:id,features,event:'completed'});}catch(error){log('activity_discovery_failure',{code:error.code||'storage_error'});}}
  return result;
 };
}

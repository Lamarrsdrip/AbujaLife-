import crypto from 'node:crypto';
import { check, identifier } from './socialStore.mjs';
export const MONGO_PRESENCE_INDEXES={presence_sessions:[[{residentId:1,connectionId:1},{unique:true}],[{residentId:1,expiresAt:1},{}],[{zone:1,expiresAt:1,residentId:1},{}],[{expiresAt:1},{expireAfterSeconds:0}]]};
export async function ensureMongoPresenceSchema(db){for(const [name,indexes]of Object.entries(MONGO_PRESENCE_INDEXES))for(const [keys,options]of indexes)await db.collection(name).createIndex(keys,options);}
const PRESENCE_ACTIVITIES=new Set(['walk','exercise','eat','dance','social','rest','sit','shop','watch','pray','groom','shower']);
const hashResident=value=>{let hash=2166136261;for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;};
function provisionalPose(anchor,residentId,index=0){
  if(!anchor)return null;
  const hash=hashResident(residentId),angle=((hash%360)+index*47)%360,radius=44+(hash%5)*14,indexAngle=angle*Math.PI/180;
  return{x:Math.max(0,Math.min(20000,anchor.x+Math.cos(indexAngle)*radius)),y:Math.max(0,Math.min(20000,anchor.y+Math.sin(indexAngle)*radius)),angle:(angle+180)%360,moving:false,driving:false,provisional:true};
}
/** Presence is a TTL lease; poses remain ephemeral and only publish to authorized peers. */
export class MongoPresenceStore {
  constructor(game,social=game.social,{leaseMs=45000,maxNearby=50}={}){this.game=game;this.social=social;this.db=game.db;this.leaseMs=leaseMs;this.maxNearby=maxNearby;this.poses=new Map();this.local=new Map();this.lastPersisted=new Map();this.profiles=new Map();this.connections=new Map();game.presence=this;game.isOnline=this.isOnline.bind(this);game.onlineInZone=this.onlineInZone.bind(this);game.nearby=this.nearby.bind(this);}
  async init({ensureIndexes=true}={}){if(ensureIndexes)await ensureMongoPresenceSchema(this.db);return this;}
  clock(){return this.game.clock();}
  async isOnline(id){const now=this.clock(),entry=this.local.get(id);if(entry&&entry.expiresAt>now)return true;return Boolean(await this.db.collection('presence_sessions').findOne({residentId:id,expiresAt:{$gt:new Date(now)}},{projection:{_id:1}}));}
  async zone(id){return this.social.zone(id);}
  async canShare(id,viewer,zone){if(id===viewer)return true;if(await this.social.blocked(id,viewer))return false;const p=await this.db.collection('residents').findOne({id},{projection:{settings:1}});if(!p||p.settings?.presenceVisible===false)return false;try{return await this.zone(id)===zone&&await this.zone(viewer)===zone;}catch(error){if([401,403,404].includes(error.status))return false;throw error;}}
  validatePose(raw){check(raw&&typeof raw==='object'&&!Array.isArray(raw)&&['x','y','angle'].every(k=>typeof raw[k]==='number'&&Number.isFinite(raw[k]))&&raw.x>=0&&raw.y>=0&&raw.x<=20000&&raw.y<=20000&&Math.abs(raw.angle)<=36000,'Invalid world position');const activity=typeof raw.activity==='string'&&PRESENCE_ACTIVITIES.has(raw.activity)?raw.activity:null;return{x:raw.x,y:raw.y,angle:raw.angle,moving:raw.moving===true,driving:raw.driving===true,...(activity?{activity}:{})};}
  async minimalProfile(id){identifier(id);const [r,state]=await Promise.all([this.db.collection('residents').findOne({id},{projection:{id:1,settings:1}}),this.db.collection('player_state').findOne({residentId:id},{projection:{district:1,location:1,drivingVehicle:1}})]);check(r&&state,'Resident not found',404);return{...r,...state};}
  async touch(id,{pose,connectionId='heartbeat',profile=null,zone:trustedZone=null}={}){identifier(id);identifier(connectionId,'Choose a valid presence connection');const now=this.clock(),cached=this.profiles.get(id),initialProfile=profile||(cached&&now-cached.at<5000?cached.value:await this.minimalProfile(id));let p=initialProfile;check(p.id===id&&p.location&&p.settings,'Invalid presence context');this.profiles.set(id,{at:now,value:p});let derived=p.location.kind==='home'?`home:${id}`:p.location.kind==='venue'?`venue:${p.district}:${p.location.venue}`:p.location.kind==='public'?`district:${p.district}`:p.location.kind==='visit'?await this.zone(id):`transit:${id}`;if(!trustedZone)derived=await this.zone(id);if(trustedZone&&trustedZone!==derived){p=await this.minimalProfile(id);this.profiles.set(id,{at:now,value:p});derived=await this.zone(id);}check(!trustedZone||trustedZone===derived,'Presence zone is unavailable',403,'presence_unavailable');const zone=derived,prior=this.local.get(id),record={zone,expiresAt:now+this.leaseMs};check(typeof zone==='string'&&zone.length<=180,'Invalid presence zone');if(!this.connections.has(id))this.connections.set(id,new Set());this.connections.get(id).add(connectionId);this.local.set(id,record);if(prior?.zone!==zone)this.poses.delete(id);if(pose!==undefined){this.social.rate(id,'pose',240);const validated=this.validatePose(pose);if(validated.driving){const state=await this.db.collection('player_state').findOne({residentId:id},{projection:{drivingVehicle:1}});check(state?.drivingVehicle&&await this.db.collection('vehicles').findOne({residentId:id,itemId:state.drivingVehicle},{projection:{_id:1}}),'You must own and drive a car before sharing a driving pose',403,'vehicle_required');}this.poses.set(id,{zone,pose:validated,expiresAt:record.expiresAt});}
    else if(this.poses.has(id)){
      const previousPose=this.poses.get(id),resident=await this.db.collection('residents').findOne({id},{projection:{'settings.presenceVisible':1}});
      // Only an unexpired pose in the same authoritative zone may be renewed.
      // Privacy changes or a lapsed connection discard it instead of reviving it.
      if(resident&&resident.settings?.presenceVisible!==false&&prior?.expiresAt>now&&previousPose.zone===zone&&previousPose.expiresAt>now)previousPose.expiresAt=record.expiresAt;
      else this.poses.delete(id);
    }
    const key=`${id}:${connectionId}`,last=this.lastPersisted.get(key);if(!last||now-last.at>=15000||last.zone!==zone){await this.db.collection('presence_sessions').updateOne({residentId:id,connectionId},{$set:{zone,expiresAt:new Date(record.expiresAt),touchedAt:now,presenceVisible:p.settings.presenceVisible!==false},$setOnInsert:{createdAt:now}},{upsert:true});this.lastPersisted.set(key,{at:now,zone});}this.prune();return{ok:true};}
  async connect(id,connectionId=crypto.randomUUID()){await this.touch(id,{connectionId});return{connectionId};}
  async disconnect(id,connectionId=null){identifier(id);const selected=connectionId?[identifier(connectionId)]:[...(this.connections.get(id)||[])];if(selected.length)await this.db.collection('presence_sessions').deleteMany({residentId:id,connectionId:{$in:selected}});for(const conn of selected){this.connections.get(id)?.delete(conn);this.lastPersisted.delete(`${id}:${conn}`);}if(!this.connections.get(id)?.size){this.connections.delete(id);this.local.delete(id);this.profiles.delete(id);this.poses.delete(id);}}
  async onlineInZone(zone){check(typeof zone==='string'&&zone.length<=180,'Invalid presence zone');const rows=await this.db.collection('presence_sessions').aggregate([{$match:{zone,presenceVisible:true,expiresAt:{$gt:new Date(this.clock())}}},{$group:{_id:'$residentId'}},{$limit:this.maxNearby+1}]).toArray();return rows.map(r=>r._id);}
  async nearby(id){
    await this.social.authenticate(id);
    const now=this.clock(),zone=await this.zone(id),blocked=await this.social.blockedIds(id);
    const rows=await this.db.collection('presence_sessions').aggregate([{$match:{zone,presenceVisible:true,residentId:{$nin:[id,...blocked]},expiresAt:{$gt:new Date(now)}}},{$group:{_id:'$residentId'}},{$limit:this.maxNearby}]).toArray();
    const ids=rows.map(row=>row._id),views=await Promise.all(ids.map(residentId=>this.social.resident(id,residentId).catch(error=>{if([401,403,404].includes(error.status))return null;throw error;})));
    const selfPose=this.poses.get(id)?.zone===zone&&this.poses.get(id)?.expiresAt>now?this.poses.get(id).pose:null;
    // A lease can outlive the player's last state write by up to 45 seconds.
    // Re-check both authoritative zones and visibility. The same rule supports
    // streets, venue interiors and consented home visits without leaking a
    // stale lease after travel, departure, blocking or a privacy change.
    const people=(await Promise.all(views.map(async(person,index)=>{
      if(!person?.online||!person.location||!await this.canShare(person.id,id,zone))return null;
      const live=this.poses.get(person.id),livePose=live?.zone===zone&&live.expiresAt>now?live.pose:null;
      // Presence and 3D rendering must not disagree. When a same-zone lease is
      // valid but the short-lived movement pose is temporarily unavailable
      // (fresh join, reconnect, process handoff), give the authorised peer a
      // deterministic nearby provisional spawn. The first real pose atomically
      // replaces it; nothing is persisted and no private location is invented.
      const pose=livePose||provisionalPose(selfPose,person.id,index);
      return{...person,pose,...(!livePose&&pose?{poseProvisional:true}:{})};
    }))).filter(Boolean);
    if(selfPose)people.sort((a,b)=>{const ap=a.pose?Math.hypot(a.pose.x-selfPose.x,a.pose.y-selfPose.y):Infinity,bp=b.pose?Math.hypot(b.pose.x-selfPose.x,b.pose.y-selfPose.y):Infinity;return ap-bp;});
    return people;
  }
  async invalidatePair(a,b){this.poses.delete(a);this.poses.delete(b);}
  poseFor(viewer,id){return this.poseView(viewer,id);}
  async poseView(viewer,id){const value=this.poses.get(id);return value&&value.expiresAt>this.clock()&&await this.canShare(id,viewer,value.zone)?structuredClone(value.pose):null;}
  prune(){const now=this.clock();for(const [id,value]of this.local)if(value.expiresAt<=now){this.local.delete(id);this.profiles.delete(id);this.connections.delete(id);this.poses.delete(id);}for(const [key,value]of this.lastPersisted)if(now-value.at>2*this.leaseMs)this.lastPersisted.delete(key);}
}

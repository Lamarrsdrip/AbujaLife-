import { id } from './id.js';
import { invariant } from './errors.js';

const key = (a,b) => `${a}:${b}`;

export class MemoryStore {
  constructor() {
    this.players = new Map();
    this.inventory = new Map();
    this.jobRuns = new Map();
    this.messages = [];
    this.events = [];
    this.homes = new Map();
    this.vehicles = new Map();
    this.businesses = new Map();
    this.relationships = new Map();
    this.presence = new Map();
    this.eventJoins = new Map();
    this.mayorCandidates = new Map();
    this.mayorVotes = new Map();
    this.ads = new Map();
  }
  createPlayer({ displayName = 'New Resident', avatar = {} } = {}) {
    const player = {
      id: id('plr'), displayName: String(displayName).trim().slice(0, 30) || 'New Resident',
      districtId: 'wuse2', position: { x: 0, y: 0, z: 0 },
      reputation: 0, xp: 0, level: 1,
      needs: { hunger: 88, energy: 82, hygiene: 90, social: 74 },
      homeId: 'starter-wuse-studio', avatar: { body:'standard', skin:'deep', hair:'fade', outfit:'starter', ...avatar },
      createdAt: new Date().toISOString()
    };
    this.players.set(player.id, player); this.inventory.set(player.id, new Map()); this.vehicles.set(player.id, new Map());
    this.homes.set(player.id, { propertyId:'starter-wuse-studio', districtId:'wuse1', mode:'starter', acquiredAt:player.createdAt });
    return structuredClone(player);
  }
  getPlayer(playerId) { const p=this.players.get(playerId); invariant(p,'PLAYER_NOT_FOUND','Player does not exist.',404); return p; }
  updatePlayer(playerId, patch) { const p=this.getPlayer(playerId); Object.assign(p,patch); p.level=Math.max(1,Math.floor((p.xp ?? 0)/500)+1); return structuredClone(p); }
  addItem(playerId,itemId,quantity=1){ this.getPlayer(playerId); const inv=this.inventory.get(playerId); inv.set(itemId,(inv.get(itemId)??0)+quantity); return {itemId,quantity:inv.get(itemId)}; }
  inventoryFor(playerId){ this.getPlayer(playerId); return [...this.inventory.get(playerId)].map(([itemId,quantity])=>({itemId,quantity})); }
  setJobRun(playerId,jobId,at){this.jobRuns.set(`${playerId}:${jobId}`,at);} getJobRun(playerId,jobId){return this.jobRuns.get(`${playerId}:${jobId}`);}
  addMessage(message){this.messages.push(message);return message;} messagesFor(playerId){return this.messages.filter(m=>m.from===playerId||m.to===playerId);}
  setHome(playerId,home){this.getPlayer(playerId);this.homes.set(playerId,{...home});this.updatePlayer(playerId,{homeId:home.propertyId,districtId:home.districtId});return structuredClone(this.homes.get(playerId));}
  homeFor(playerId){this.getPlayer(playerId);return structuredClone(this.homes.get(playerId));}
  addVehicle(playerId,vehicle){this.getPlayer(playerId);this.vehicles.get(playerId).set(vehicle.id,vehicle);return structuredClone(vehicle);}
  getVehicle(playerId,vehicleId){this.getPlayer(playerId);const v=this.vehicles.get(playerId).get(vehicleId);invariant(v,'OWNED_VEHICLE_NOT_FOUND','Owned vehicle not found.',404);return v;}
  updateVehicle(playerId,vehicleId,patch){const v=this.getVehicle(playerId,vehicleId);Object.assign(v,patch);return structuredClone(v);} vehiclesFor(playerId){this.getPlayer(playerId);return [...this.vehicles.get(playerId).values()].map(structuredClone);}
  addBusiness(b){this.businesses.set(b.id,b);return structuredClone(b);} getBusiness(id){const b=this.businesses.get(id);invariant(b,'BUSINESS_NOT_FOUND','Business not found.',404);return b;} updateBusiness(id,patch){const b=this.getBusiness(id);Object.assign(b,patch);return structuredClone(b);} businessesFor(ownerId){return [...this.businesses.values()].filter(b=>b.ownerId===ownerId).map(structuredClone);}
  setRelationship(a,b,status){const r={from:a,to:b,status,updatedAt:new Date().toISOString()};this.relationships.set(key(a,b),r);return structuredClone(r);} getRelationship(a,b){const r=this.relationships.get(key(a,b));return r?structuredClone(r):null;} relationshipsFor(playerId){return [...this.relationships.values()].filter(r=>r.from===playerId||r.to===playerId).map(structuredClone);}
  setPresence(playerId,p){this.getPlayer(playerId);const v={...p};this.presence.set(playerId,v);return structuredClone(v);}
  joinEvent(playerId,eventId){const k=key(playerId,eventId);const j={playerId,eventId,joinedAt:new Date().toISOString()};this.eventJoins.set(k,j);return structuredClone(j);}
  setMayorCandidate(playerId,manifesto){const c={playerId,manifesto,votes:0,createdAt:new Date().toISOString()};this.mayorCandidates.set(playerId,c);return structuredClone(c);} castMayorVote(voterId,candidateId){this.mayorVotes.set(voterId,candidateId);for(const c of this.mayorCandidates.values())c.votes=0;for(const cid of this.mayorVotes.values()){const c=this.mayorCandidates.get(cid);if(c)c.votes++;}return {voterId,candidateId};}
  addAd(ad){this.ads.set(ad.id,ad);return structuredClone(ad);} adsForDistrict(districtId){return [...this.ads.values()].filter(a=>a.districtId===districtId).map(structuredClone);}
}

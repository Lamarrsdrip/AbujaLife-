import { check, cursorFor, keyset, pageOptions } from './socialStore.mjs';
export function residentSearchPrefixes(username,displayName){const words=`${username} ${displayName}`.normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu)||[];return[...new Set(words.flatMap(word=>Array.from({length:Math.min(word.length,80)},(_,i)=>word.slice(0,i+1))))];}
export const MONGO_DIRECTORY_INDEXES={residents:[[{createdAt:-1,id:-1},{}],[{searchPrefixes:1,createdAt:-1,id:-1},{}]]};
export async function ensureMongoDirectorySchema(db){for(const [name,indexes] of Object.entries(MONGO_DIRECTORY_INDEXES))for(const [keys,options] of indexes)await db.collection(name).createIndex(keys,options);}
/** Queries only normalized public resident fields; homes and wallet are never projected. */
export class MongoDirectoryStore {
  constructor(game,social=game.social){this.game=game;this.social=social;this.db=game.db;game.directory=this;}
  async init({ensureIndexes=true}={}){if(ensureIndexes)await ensureMongoDirectorySchema(this.db);return this;}
  async people(id,{q='',cursor,limit=40}={}){await this.social.authenticate(id);check(typeof q==='string'&&q.length<=80,'Search must be text up to 80 characters');const {limit:size,after}=pageOptions({cursor,limit}),tokens=q.normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu)||[],filter={id:{$nin:[id,...await this.social.blockedIds(id)]},...keyset(after)};if(q.trim()&&!tokens.length)return{ok:true,people:[],nextCursor:null};if(tokens.length)filter.searchPrefixes={$all:[...new Set(tokens)]};const rows=await this.db.collection('residents').find(filter,{projection:{id:1,createdAt:1}}).sort({createdAt:-1,id:-1}).limit(size+1).toArray();return{ok:true,people:await Promise.all(rows.slice(0,size).map(r=>this.social.resident(id,r.id))),nextCursor:rows.length>size?cursorFor(rows[size-1]):null};}
  messages(id,conversationId,options={}){return this.social.messages(id,conversationId,options);}
}
export { MongoDirectoryStore as ResidentDirectory };

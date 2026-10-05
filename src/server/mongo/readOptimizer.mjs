import { GameError } from '../errors.mjs';
import { cursorFor, keyset, pageOptions } from './socialStore.mjs';

const validId=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,80}$/.test(value);
const stripAppearance=row=>{if(!row)return null;const {_id,residentId,...appearance}=row;return appearance;};

/**
 * Collapse the social graph's N+1 resident lookups into bulk reads and make
 * inbox/bootstrap conversation summaries come from one aggregation instead of
 * rebuilding every conversation independently. The detailed thread endpoint
 * remains authoritative when a conversation is opened.
 */
export function installMongoReadOptimizer({store,social}) {
  let residentQueue=new Map();
  let residentFlushScheduled=false;

  async function flushResidentQueue(){
    residentFlushScheduled=false;
    const queued=residentQueue;residentQueue=new Map();
    for(const [viewer,requests] of queued){
      try{
        const ids=[...new Set(requests.map(request=>request.id))];
        const blocked=viewer?new Set(await social.blockedIds(viewer)):new Set();
        const [residents,appearances,states,progressions]=await Promise.all([
          social.collection('residents').find({id:{$in:ids}},{projection:{_id:0,id:1,username:1,displayName:1,settings:1}}).toArray(),
          social.collection('appearances').find({residentId:{$in:ids}}).toArray(),
          social.collection('player_state').find({residentId:{$in:ids}},{projection:{_id:0,residentId:1,district:1,location:1}}).toArray(),
          social.collection('progression').find({residentId:{$in:ids}},{projection:{_id:0,residentId:1,reputation:1}}).toArray()
        ]);
        const residentById=new Map(residents.map(row=>[row.id,row]));
        const appearanceById=new Map(appearances.map(row=>[row.residentId,row]));
        const stateById=new Map(states.map(row=>[row.residentId,row]));
        const progressById=new Map(progressions.map(row=>[row.residentId,row]));
        const views=new Map();
        for(const id of ids){
          const resident=residentById.get(id),appearance=stripAppearance(appearanceById.get(id)),state=stateById.get(id);
          if(!resident||!appearance||!state)continue;
          const allowed=!viewer||!blocked.has(id),visible=allowed&&resident.settings?.presenceVisible!==false;
          views.set(id,{id,username:resident.username,displayName:resident.displayName,appearance,reputation:progressById.get(id)?.reputation??0,online:visible&&Boolean(store.isOnline?.(id)),district:visible?state.district:null,location:visible?social.publicLocation(state,viewer):null});
        }
        for(const request of requests){const view=views.get(request.id);if(view)request.resolve(structuredClone(view));else request.reject(new GameError('Resident not found',404,'resident_not_found'));}
      }catch(error){for(const request of requests)request.reject(error);}
    }
  }

  social.resident=function resident(viewer,id){
    if(!validId(id))return Promise.reject(new GameError('Choose a valid resident',400,'invalid_social_action'));
    const key=viewer||'';
    return new Promise((resolve,reject)=>{
      if(!residentQueue.has(key))residentQueue.set(key,[]);
      residentQueue.get(key).push({id,resolve,reject});
      if(!residentFlushScheduled){residentFlushScheduled=true;queueMicrotask(flushResidentQueue);}
    });
  };
  // attachToGame() runs before this optimizer in production. Rebind the direct
  // store entry too so presence and HTTP callers get the same batched path.
  store.resident=social.resident.bind(social);

  social.conversationPage=async function conversationPage(id,options={}){
    await this.authenticate(id);
    const {limit,after}=pageOptions(options),blocked=await this.blockedIds(id),blockedWithSelf=[...new Set([...blocked,id])];
    const pipeline=[
      {$match:{residentId:id,leftAt:null,...keyset(after,'updatedAt')}},
      {$sort:{updatedAt:-1,id:-1}},
      {$lookup:{from:'conversations',localField:'conversationId',foreignField:'id',as:'conv'}},
      {$unwind:'$conv'},
      {$match:{$and:[{$or:[{'conv.kind':{$ne:'dm'}},{'conv.participantIds':{$nin:blocked}}]},{$or:[{'conv.kind':{$ne:'community'}},{'conv.ownerId':{$nin:blocked}}]}]}},
      {$limit:limit+1},
      {$lookup:{from:'messages',let:{cid:'$conversationId',joined:{$ifNull:['$joinSeq',0]}},pipeline:[{$match:{$expr:{$and:[{$eq:['$conversationId','$$cid']},{$gt:['$seq','$$joined']},{$eq:[{$in:['$senderId',blocked]},false]}]}}},{$sort:{seq:-1}},{$limit:1}],as:'latest'}},
      {$lookup:{from:'messages',let:{cid:'$conversationId',seen:{$max:[{$ifNull:['$readSeq',0]},{$ifNull:['$joinSeq',0]}]}},pipeline:[{$match:{$expr:{$and:[{$eq:['$conversationId','$$cid']},{$gt:['$seq','$$seen']},{$eq:[{$in:['$senderId',blockedWithSelf]},false]}]}}},{$count:'n'}],as:'unreadRows'}}
    ];
    const rows=await this.collection('members').aggregate(pipeline).toArray(),selected=rows.slice(0,limit);
    const participantIds=[...new Set(selected.flatMap(row=>Array.isArray(row.conv?.participantIds)?row.conv.participantIds:[]).filter(memberId=>validId(memberId)&&!blocked.includes(memberId)))];
    const participantViews=participantIds.length?await Promise.all(participantIds.map(memberId=>this.resident(id,memberId))):[];
    const participantById=new Map(participantViews.map(view=>[view.id,view]));
    const conversations=selected.map(row=>{
      const conv=row.conv||{},memberIds=(conv.participantIds||[]).filter(memberId=>!blocked.includes(memberId)),members=memberIds.map(memberId=>participantById.get(memberId)).filter(Boolean),last=row.latest?.[0];
      return{id:conv.id||row.conversationId,kind:conv.kind||'group',name:conv.kind==='dm'?(members.find(member=>member.id!==id)?.displayName||'Conversation'):(conv.name||'Conversation'),members,memberCount:memberIds.length||members.length,nextMembersCursor:null,unread:Number(row.unreadRows?.[0]?.n||0),lastMessage:last?{...this.messageEvent(last),deliveredTo:[],readBy:[],deliveredCount:0,readCount:0,nextReceiptsCursor:null}:null};
    });
    return{ok:true,conversations,nextCursor:rows.length>limit?cursorFor(selected.at(-1),'updatedAt'):null};
  };

  return{store,social};
}

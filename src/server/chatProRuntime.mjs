import crypto from 'node:crypto';
import { GameError } from './errors.mjs';
import { ChatMediaStore, CHAT_MEDIA_LIMITS } from './chatMediaStore.mjs';

const safeId=(value,label='Choose a valid item')=>{if(typeof value!=='string'||!/^[A-Za-z0-9:_-]{1,80}$/.test(value))throw new GameError(label,400,'invalid_chat_item');return value;};
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const keyValue=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9:_-]{8,128}$/.test(value))throw new GameError('Include a unique message request key',400,'idempotency_required');return value;};
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const isMongo=(store,social)=>Boolean(social?.collection&&store?.db?.collection&&typeof store.db.collection==='function');
const mediaURL=id=>`/api/chat-pro/media/${encodeURIComponent(id)}`;
const parseJSON=value=>{try{return value?JSON.parse(value):{};}catch{return{};}};

function decorate(base,meta={}){
  if(!base)return base;
  if(meta.deletedAt)return{...base,kind:'deleted',text:'This message was deleted',deleted:true,deletedAt:meta.deletedAt,replyTo:null,media:null};
  const replyTo=meta.replyTo&&typeof meta.replyTo==='object'?{id:meta.replyTo.id,senderId:meta.replyTo.senderId,text:meta.replyTo.text,kind:meta.replyTo.kind||'text'}:null;
  const media=meta.media&&typeof meta.media==='object'?{id:meta.media.id,kind:meta.media.kind,mime:meta.media.mime,size:meta.media.size,durationMs:meta.media.durationMs||0,width:meta.media.width||null,height:meta.media.height||null,url:mediaURL(meta.media.id)}:null;
  return{...base,...(replyTo?{replyTo}:{}),...(media?{media,kind:media.kind}:{}),deleted:false};
}

async function rawBody(req,maxBytes){
  let size=0,parts=[];
  for await(const part of req){size+=part.length;if(size>maxBytes)throw new GameError('Chat media is too large',413,'media_too_large');parts.push(part);}
  return Buffer.concat(parts);
}

export function createChatProRuntime({store,social=null,directory=null,authenticate,send,readJson,env=process.env,fetchImpl=fetch,log=()=>{}}={}){
  if(!store||!directory||typeof authenticate!=='function'||typeof send!=='function'||typeof readJson!=='function')throw new Error('Chat Pro runtime requires store, directory, authentication and response helpers.');
  const mongo=isMongo(store,social),mediaStore=new ChatMediaStore({env,fetchImpl}),buckets=new Map();
  const originalMessageView=!mongo&&typeof store.messageView==='function'?store.messageView.bind(store):null;
  if(!mongo){
    store.db.exec(`CREATE TABLE IF NOT EXISTS chat_message_meta(message_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_id TEXT NOT NULL, meta TEXT NOT NULL, updated_at INTEGER NOT NULL);`);
    if(!store.__chatProMessageView){
      store.messageView=row=>{const base=originalMessageView(row),saved=store.get('SELECT meta FROM chat_message_meta WHERE message_id=?',row.id);return decorate(base,parseJSON(saved?.meta));};
      store.__chatProMessageView=true;
    }
  }else if(social&&!social.__chatProMessageEvent){
    const original=social.messageEvent.bind(social);
    social.messageEvent=row=>decorate(original(row),row);
    social.__chatProMessageEvent=true;
  }
  function rate(id,limit=100){const now=Date.now(),prior=buckets.get(id),bucket=prior&&now-prior.at<60000?prior:{at:now,count:0};bucket.count++;buckets.set(id,bucket);if(bucket.count>limit)throw new GameError('Please wait before sending more messages',429,'rate_limited');if(buckets.size>10000)for(const[k,v]of buckets)if(now-v.at>60000)buckets.delete(k);}
  function writeGuard(req){if(req.headers['sec-fetch-site']==='cross-site')throw new GameError('Open AbujaLife directly to send messages',403,'cross_origin');}
  async function access(id,conversationId){safeId(conversationId,'Choose a conversation');return await store.conversationAccess(id,conversationId);}
  function sqliteMeta(messageId){return parseJSON(store.get('SELECT meta FROM chat_message_meta WHERE message_id=?',messageId)?.meta);}
  function saveSqliteMeta(messageId,conversationId,senderId,meta){store.run('INSERT INTO chat_message_meta(message_id,conversation_id,sender_id,meta,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(message_id) DO UPDATE SET meta=excluded.meta,updated_at=excluded.updated_at',messageId,conversationId,senderId,JSON.stringify(meta),Date.now());}
  async function rowFor(id,conversationId,messageId){
    await access(id,conversationId);safeId(messageId,'Choose a message');
    if(mongo){const row=await social.collection('messages').findOne({id:messageId,conversationId});if(!row)throw new GameError('Message not found',404,'message_not_found');return row;}
    const row=store.get('SELECT * FROM messages WHERE id=? AND conversation_id=?',messageId,conversationId);if(!row)throw new GameError('Message not found',404,'message_not_found');return row;
  }
  async function isHidden(id,messageId){
    if(mongo){const row=await social.collection('messages').findOne({id:messageId},{projection:{hiddenFor:1}});return row?.hiddenFor?.includes(id)===true;}
    return Array.isArray(sqliteMeta(messageId).hiddenFor)&&sqliteMeta(messageId).hiddenFor.includes(id);
  }
  async function previousVisible(id,conversationId){
    if(mongo){
      const me=await social.conversationAccess(id,conversationId),blocked=await social.blockedIds(id),row=await social.collection('messages').find({conversationId,seq:{$gt:me.joinSeq??0},senderId:{$nin:blocked},hiddenFor:{$ne:id}}).sort({seq:-1}).limit(1).next();return row?await social.messageView(row,id):null;
    }
    const rows=store.all('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 100',conversationId);
    for(const row of rows){if(await store.blocked(id,row.sender_id))continue;if(sqliteMeta(row.id).hiddenFor?.includes(id))continue;return store.messageView(row);}return null;
  }
  async function sanitizeConversation(id,conversation){if(!conversation?.lastMessage?.id||!await isHidden(id,conversation.lastMessage.id))return conversation;return{...conversation,lastMessage:await previousVisible(id,conversation.id)};}
  async function replySnapshot(id,conversationId,replyToMessageId){
    if(!replyToMessageId)return null;const row=await rowFor(id,conversationId,replyToMessageId),meta=mongo?row:sqliteMeta(row.id);if(meta.deletedAt)throw new GameError('That message was deleted',409,'reply_unavailable');if(meta.hiddenFor?.includes(id))throw new GameError('That message is no longer visible to you',409,'reply_unavailable');
    const view=mongo?social.messageEvent(row):store.messageView(row),kind=view.kind||'text';let text=clean(view.text,180);if(kind==='image')text='Photo';else if(kind==='voice')text='Voice note';else if(kind==='transfer')text='Naira transfer';return{id:view.id,senderId:view.senderId,text:text||'Message',kind};
  }
  async function existingOperation(id,key){if(!key)return null;if(mongo)return social.collection('messages').findOne({senderId:id,operationKey:key});const prior=store.get('SELECT * FROM message_operations WHERE sender_id=? AND operation_key=?',id,key);return prior?store.get('SELECT * FROM messages WHERE id=?',prior.message_id):null;}
  async function enhancedSend(id,conversationId,{text,kind='text',replyToMessageId=null,media=null,uploadFingerprint=null,idempotencyKey}){
    await access(id,conversationId);rate(id);kind=['text','image','voice'].includes(kind)?kind:'text';const key=keyValue(idempotencyKey),replyTo=await replySnapshot(id,conversationId,replyToMessageId),messageText=clean(text,kind==='text'?4000:500)||({image:'📷 Photo',voice:'🎤 Voice note'}[kind]||'');if(!messageText)throw new GameError('Write a message first');
    const fingerprint=hash({conversationId,text:messageText,kind,replyToMessageId:replyTo?.id||null,media:media?{id:media.contentHash||media.id,kind:media.kind,mime:media.mime,size:media.size,durationMs:media.durationMs||0}:null});
    if(mongo){
      let row,replayed=false;await social.transaction(async session=>{
        await social.conversationAccess(id,conversationId,session);row=await social.collection('messages').findOne({senderId:id,operationKey:key},{session});if(row){if(row.fingerprint!==fingerprint)throw new GameError('This message key was already used for different content',409,'idempotency_conflict');replayed=true;return;}
        const conv=await social.collection('conversations').findOneAndUpdate({id:conversationId},{$inc:{seq:1}},{returnDocument:'after',session});if(!conv)throw new GameError('Conversation not found',404,'conversation_unavailable');const now=Math.max(store.clock(),(conv.updatedAt??0)+1);await social.collection('conversations').updateOne({id:conversationId},{$set:{updatedAt:now}},{session});row={id:crypto.randomUUID(),conversationId,senderId:id,kind,text:messageText,seq:conv.seq,createdAt:now,operationKey:key,fingerprint,hiddenFor:[],...(replyTo?{replyTo}:{}),...(media?{media}:{}),...(uploadFingerprint?{uploadFingerprint}:{})};await social.collection('messages').insertOne(row,{session});await social.collection('members').updateMany({conversationId,leftAt:null},{$set:{updatedAt:now}},{session});await social.collection('members').updateOne({conversationId,residentId:id},{$max:{readSeq:row.seq,deliveredSeq:row.seq,readAt:now,deliveredAt:now}},{session});
      });
      const view=replayed?await social.messageView(row,id):{...social.messageEvent(row),deliveredTo:[],readBy:[],deliveredCount:0,readCount:0,nextReceiptsCursor:null};if(!replayed)await social.fanoutMessage(row,id);return{ok:true,message:view,replayed};
    }
    let row,members=[],notices=[],replayed=false;
    store.transaction(()=>{
      const prior=store.get('SELECT * FROM message_operations WHERE sender_id=? AND operation_key=?',id,key);if(prior){if(prior.fingerprint!==fingerprint)throw new GameError('This message key was already used for different content',409,'idempotency_conflict');row=store.get('SELECT * FROM messages WHERE id=?',prior.message_id);replayed=true;return;}
      const saved=store.insertConversationMessage(id,conversationId,messageText);row=saved.row;members=saved.members;saveSqliteMeta(row.id,conversationId,id,{kind,...(replyTo?{replyTo}:{}),...(media?{media}:{}),...(uploadFingerprint?{uploadFingerprint}:{})});store.run('INSERT INTO message_operations VALUES(?,?,?,?,?)',id,key,fingerprint,row.id,row.created_at);
      for(const target of members)if(target!==id&&!store.blocked(id,target)&&!store.muted(target,id)){const notice={id:crypto.randomUUID(),kind:'message',title:store.profile(id).displayName,body:messageText.slice(0,140),link:`conversation:${conversationId}`,createdAt:row.created_at,readAt:null};store.run('INSERT INTO notifications(id,resident_id,kind,title,body,link,created_at,read_at,sender_id) VALUES(?,?,?,?,?,?,?,NULL,?)',notice.id,target,notice.kind,notice.title,notice.body,notice.link,notice.createdAt,id);notices.push({target,notice});}
    });
    const view=store.messageView(row);if(!replayed){for(const target of members)if(!store.blocked(id,target))store.emitUser(target,'message',view);for(const{target,notice}of notices)store.emitUser?.(target,'notification',notice);}return{ok:true,message:view,replayed};
  }
  async function emitUpdate(row,senderId){
    if(mongo){const event=social.messageEvent(row);for await(const member of social.fanoutMembers(row.conversationId,senderId))store.emitUser?.(member.residentId,'message',event);return;}
    const view=store.messageView(row);for(const member of store.all('SELECT resident_id FROM members WHERE conversation_id=?',row.conversation_id))if(!store.blocked(senderId,member.resident_id))store.emitUser(member.resident_id,'message',view);
  }
  async function deleteMessage(id,messageId,scope){
    safeId(messageId,'Choose a message');if(!['me','everyone'].includes(scope))throw new GameError('Choose how to delete this message');let row,meta,conversationId,senderId,mediaId=null;
    if(mongo){row=await social.collection('messages').findOne({id:messageId});if(!row)throw new GameError('Message not found',404,'message_not_found');conversationId=row.conversationId;senderId=row.senderId;await access(id,conversationId);if(row.kind==='transfer')throw new GameError('Naira transfer receipts stay in the conversation record',409,'transfer_receipt_immutable');if(scope==='everyone'&&senderId!==id)throw new GameError('You can only delete your own message for everyone',403,'message_delete_forbidden');if(scope==='me'){await social.collection('messages').updateOne({id:messageId},{$addToSet:{hiddenFor:id}});return{ok:true,messageId,scope};}mediaId=row.media?.id||null;await social.collection('messages').updateOne({id:messageId},{$set:{deletedAt:store.clock(),deletedBy:id,text:'This message was deleted'},$unset:{media:'',replyTo:''}});row=await social.collection('messages').findOne({id:messageId});await emitUpdate(row,id);
    }else{row=store.get('SELECT * FROM messages WHERE id=?',messageId);if(!row)throw new GameError('Message not found',404,'message_not_found');conversationId=row.conversation_id;senderId=row.sender_id;await access(id,conversationId);const base=store.messageView(row);if(base.kind==='transfer')throw new GameError('Naira transfer receipts stay in the conversation record',409,'transfer_receipt_immutable');if(scope==='everyone'&&senderId!==id)throw new GameError('You can only delete your own message for everyone',403,'message_delete_forbidden');meta=sqliteMeta(messageId);if(scope==='me'){meta.hiddenFor=[...new Set([...(meta.hiddenFor||[]),id])];saveSqliteMeta(messageId,conversationId,senderId,meta);return{ok:true,messageId,scope};}mediaId=meta.media?.id||null;meta={...meta,deletedAt:store.clock(),deletedBy:id};delete meta.media;delete meta.replyTo;saveSqliteMeta(messageId,conversationId,senderId,meta);await emitUpdate(row,id);
    }
    if(mediaId)mediaStore.remove(mediaId).catch(error=>log('chat_media_cleanup_failed',{code:error.code||'cleanup_failed'}));return{ok:true,messageId,scope,message:mongo?social.messageEvent(row):store.messageView(row)};
  }
  async function mediaMessage(id,req,res,url,conversationId){
    writeGuard(req);await access(id,conversationId);rate(id,30);const kind=url.searchParams.get('kind'),mime=(req.headers['content-type']||'').split(';')[0].trim().toLowerCase(),durationMs=Number(url.searchParams.get('durationMs')||0),replyToMessageId=url.searchParams.get('replyToMessageId')||null,key=keyValue(url.searchParams.get('idempotencyKey')||''),caption=clean(url.searchParams.get('caption')||'',500);
    if(!['image','voice'].includes(kind))throw new GameError('Choose photo or voice note',400,'invalid_media_kind');
    const limit=kind==='image'?CHAT_MEDIA_LIMITS.imageBytes:CHAT_MEDIA_LIMITS.voiceBytes,bytes=await rawBody(req,limit+1);
    const uploadFingerprint=hash({conversationId,kind,mime,durationMs:kind==='voice'?durationMs:0,replyToMessageId,caption:kind==='image'?caption:'',contentHash:crypto.createHash('sha256').update(bytes).digest('hex')});
    const existing=await existingOperation(id,key);if(existing){
      const meta=mongo?existing:sqliteMeta(existing.id),view=mongo?await social.messageView(existing,id):store.messageView(existing);
      const compatible=(existing.conversationId||existing.conversation_id)===conversationId&&meta.kind===kind&&meta.media?.mime===mime&&(meta.media?.durationMs||0)===(kind==='voice'?durationMs:0)&&(meta.replyTo?.id||null)===replyToMessageId&&(kind!=='image'||existing.text===(caption||'📷 Photo'));
      if(meta.uploadFingerprint?meta.uploadFingerprint!==uploadFingerprint:!compatible)throw new GameError('This message key was already used for different content',409,'idempotency_conflict');
      send(res,200,{ok:true,message:view,replayed:true});return;
    }
    const mediaId=crypto.randomUUID(),media=await mediaStore.put({mediaId,kind,mime,bytes,durationMs});let result;
    try{result=await enhancedSend(id,conversationId,{kind,text:kind==='image'?(caption||'📷 Photo'):'🎤 Voice note',replyToMessageId,media,uploadFingerprint,idempotencyKey:key});}catch(error){await mediaStore.remove(mediaId).catch(()=>{});throw error;}
    if(result.replayed&&result.message?.media?.id!==mediaId)await mediaStore.remove(mediaId).catch(()=>{});send(res,201,result);
  }
  async function mediaRead(id,res,mediaId){
    safeId(mediaId,'Invalid media id');let row,meta,conversationId,mime,senderId;
    if(mongo){row=await social.collection('messages').findOne({'media.id':mediaId});if(!row||row.deletedAt)throw new GameError('This chat media is unavailable',404,'media_missing');conversationId=row.conversationId;mime=row.media.mime;senderId=row.senderId;if(row.hiddenFor?.includes(id))throw new GameError('This chat media is unavailable',404,'media_missing');}
    else{const saved=store.get("SELECT message_id,conversation_id,sender_id,meta FROM chat_message_meta WHERE json_extract(meta,'$.media.id')=?",mediaId);if(!saved)throw new GameError('This chat media is unavailable',404,'media_missing');meta=parseJSON(saved.meta);if(meta.deletedAt||meta.hiddenFor?.includes(id))throw new GameError('This chat media is unavailable',404,'media_missing');conversationId=saved.conversation_id;mime=meta.media.mime;senderId=saved.sender_id;}
    const member=await access(id,conversationId);
    if(await store.blocked(id,senderId)||(mongo&&row.seq<=(member.joinSeq??0)))throw new GameError('This chat media is unavailable',404,'media_missing');
    const opened=await mediaStore.read(mediaId);if(opened.redirect){res.writeHead(302,{'location':opened.redirect,'cache-control':'private, max-age=60','referrer-policy':'no-referrer','x-content-type-options':'nosniff'});res.end();return;}res.writeHead(200,{'content-type':mime,'content-length':opened.body.length,'cache-control':'private, max-age=300','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"});res.end(opened.body);
  }
  async function presence(id,conversationId,body){await access(id,conversationId);const state=body.state==='recording'?'recording':'idle',displayName=(await store.resident(id,id)).displayName,event={residentId:id,displayName,conversationId,state,at:store.clock()};if(mongo){for await(const member of social.fanoutMembers(conversationId,id))if(member.residentId!==id)store.emitUser?.(member.residentId,'typing',event);}else for(const member of store.all('SELECT resident_id FROM members WHERE conversation_id=?',conversationId))if(member.resident_id!==id&&!store.blocked(id,member.resident_id))store.emitUser(member.resident_id,'typing',event);return{ok:true};}
  function matches(url,method){const p=url.pathname;return p==='/api/conversations'&&method==='GET'||/^\/api\/conversations\/[^/]+\/messages$/.test(p)&&['GET','POST'].includes(method)||/^\/api\/chat-pro\/conversations\/[^/]+\/(media|presence)$/.test(p)||/^\/api\/chat-pro\/messages\/[^/]+\/delete$/.test(p)||/^\/api\/chat-pro\/media\/[^/]+$/.test(p)&&method==='GET';}
  async function handle(req,res,url){
    const method=req.method||'GET';if(!matches(url,method))return false;const id=await authenticate(req);if(!id)throw new GameError('Sign in to your resident account',401,'authentication_required');
    if(url.pathname==='/api/conversations'&&method==='GET'){
      const result=mongo?await social.conversationPage(id,{cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined}):await directory.conversations(id,{cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined});result.conversations=await Promise.all((result.conversations||[]).map(c=>sanitizeConversation(id,c)));send(res,200,result);return true;
    }
    const messages=url.pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);if(messages){const conversationId=decodeURIComponent(messages[1]);if(method==='GET'){const result=await directory.messages(id,conversationId,{cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')??undefined});const visible=[];for(const message of result.messages||[])if(!await isHidden(id,message.id))visible.push(message);result.messages=visible;result.conversation=await sanitizeConversation(id,result.conversation);send(res,200,result);return true;}writeGuard(req);const body=await readJson(req,65536);const kind=body.kind||'text';if(['image','voice'].includes(kind))throw new GameError('Use the private media endpoint for photo or voice messages',400,'media_endpoint_required');const replyToMessageId=body.replyToMessageId||null;if(replyToMessageId){const result=await enhancedSend(id,conversationId,{text:body.text,kind:'text',replyToMessageId,idempotencyKey:body.idempotencyKey});send(res,201,result);return true;}rate(id);send(res,201,await store.sendMessage(id,conversationId,body.text,body));return true;}
    const media=url.pathname.match(/^\/api\/chat-pro\/conversations\/([^/]+)\/media$/);if(media&&method==='POST'){await mediaMessage(id,req,res,url,decodeURIComponent(media[1]));return true;}
    const recording=url.pathname.match(/^\/api\/chat-pro\/conversations\/([^/]+)\/presence$/);if(recording&&method==='POST'){writeGuard(req);send(res,200,await presence(id,decodeURIComponent(recording[1]),await readJson(req,4096)));return true;}
    const deletion=url.pathname.match(/^\/api\/chat-pro\/messages\/([^/]+)\/delete$/);if(deletion&&method==='POST'){writeGuard(req);const body=await readJson(req,4096);send(res,200,await deleteMessage(id,decodeURIComponent(deletion[1]),body.scope||'me'));return true;}
    const mediaGet=url.pathname.match(/^\/api\/chat-pro\/media\/([^/]+)$/);if(mediaGet&&method==='GET'){await mediaRead(id,res,decodeURIComponent(mediaGet[1]));return true;}
    return false;
  }
  return{matches,handle,mediaConfiguration:()=>mediaStore.configuration()};
}

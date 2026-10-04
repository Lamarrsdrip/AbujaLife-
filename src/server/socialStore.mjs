import crypto from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { GameError, catalog } from './gameStore.mjs';

export const SOCIAL_META = Object.freeze({statusDurationMs:86400000,maxImageBytes:524288,maxTextLength:4000,maxCommentLength:2000,maxPageSize:50});
const uid = () => crypto.randomUUID();
const check = (value,message,status=400,code='invalid_social_action') => {if(!value)throw new GameError(message,status,code);};
const textValue = (value,max,label) => {check(value===undefined||typeof value==='string',`${label} must be text`);const text=(value||'').trim();check(text.length<=max,`${label} is too long`,413,'content_too_large');return text;};
const identifier = (value,label='Choose a valid item') => {check(typeof value==='string'&&value.length>0&&value.length<=80,label);return value;};
const operationKey = value => {check(typeof value==='string'&&/^[A-Za-z0-9:_-]{8,128}$/.test(value),'Include a unique idempotency key',400,'idempotency_required');return value;};
const fingerprint = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cursorFor = row => row?Buffer.from(JSON.stringify([row.created_at??row.started_at,row.id])).toString('base64url'):null;
function pageOptions({cursor,limit=20}={}) {
  limit=Number(limit);check(Number.isSafeInteger(limit)&&limit>=1&&limit<=SOCIAL_META.maxPageSize,'Choose a page size of 1–50');
  if(!cursor)return{limit,after:null};
  check(typeof cursor==='string'&&cursor.length<=256,'Invalid page cursor',400,'invalid_cursor');
  try{const value=JSON.parse(Buffer.from(cursor,'base64url').toString());check(Array.isArray(value)&&value.length===2&&Number.isSafeInteger(value[0])&&value[0]>=0&&typeof value[1]==='string'&&value[1].length>0&&value[1].length<=80,'Invalid page cursor',400,'invalid_cursor');return{limit,after:value};}
  catch{throw new GameError('Invalid page cursor',400,'invalid_cursor');}
}
const visible = column => `NOT EXISTS(SELECT 1 FROM moderation b WHERE b.kind='block' AND ((b.owner=? AND b.target=${column}) OR (b.target=? AND b.owner=${column})))`;
const keyset = column => `(${column}.created_at<? OR (${column}.created_at=? AND ${column}.id<?))`;
const crcTable = Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(buffer){let n=0xffffffff;for(const byte of buffer)n=crcTable[(n^byte)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function dimensions(width,height){check(width>0&&height>0&&width<=4096&&height<=4096&&width*height<=16777216,'Use an image no larger than 4096 pixels per side',413,'image_dimensions');}
function validatePng(bytes) {
  check(bytes.length>=57&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Invalid PNG image');
  let offset=8,header=null,ended=false;const compressed=[];
  while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset),end=offset+12+length;check(end<=bytes.length,'Invalid PNG image');const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+length);check(bytes.readUInt32BE(offset+8+length)===crc32(bytes.subarray(offset+4,offset+8+length)),'Invalid PNG checksum');
    if(!header){check(type==='IHDR'&&length===13,'Invalid PNG header');const width=data.readUInt32BE(0),height=data.readUInt32BE(4),depth=data[8],colour=data[9],channels={0:1,2:3,3:1,4:2,6:4}[colour];dimensions(width,height);check(channels&&[1,2,4,8,16].includes(depth)&&([0,3].includes(colour)||depth>=8)&&!(colour===3&&depth===16)&&data[10]===0&&data[11]===0&&data[12]<=1,'Unsupported PNG image');header={width,height,depth,channels,interlace:data[12]};}
    else check(type!=='IHDR','Invalid PNG image');
    if(type==='IDAT')compressed.push(data);
    if(type==='IEND'){check(length===0&&end===bytes.length,'Invalid PNG ending');ended=true;break;}offset=end;
  }
  check(ended&&compressed.length,'Incomplete PNG image');
  const {width,height,depth,channels,interlace}=header;
  const passes=interlace?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
  const rows=passes.map(([x,y,dx,dy])=>({width:Math.max(0,Math.ceil((width-x)/dx)),height:Math.max(0,Math.ceil((height-y)/dy))})).filter(p=>p.width&&p.height).map(p=>({...p,stride:1+Math.ceil(p.width*channels*depth/8)}));
  const length=rows.reduce((sum,p)=>sum+p.height*p.stride,0);check(length<=67108864,'PNG expands beyond the image limit',413,'image_dimensions');
  let pixels;try{pixels=inflateSync(Buffer.concat(compressed),{maxOutputLength:length});}catch{throw new GameError('Invalid PNG pixel data');}check(pixels.length===length,'Invalid PNG pixel data');let position=0;for(const pass of rows)for(let row=0;row<pass.height;row++){check(pixels[position]<=4,'Invalid PNG pixel filter');position+=pass.stride;}
}
function validateJpeg(bytes) {
  check(bytes.length>12&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217,'Invalid JPEG image');
  let offset=2,foundSize=false,foundScan=false;
  while(offset<bytes.length-2){check(bytes[offset]===255,'Invalid JPEG marker');while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===217)break;if(marker===0||marker===216)throw new GameError('Invalid JPEG marker');if(marker>=208&&marker<=215||marker===1)continue;check(offset+2<=bytes.length,'Invalid JPEG segment');const length=bytes.readUInt16BE(offset);check(length>=2&&offset+length<=bytes.length,'Invalid JPEG segment');
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){check(length>=8,'Invalid JPEG dimensions');dimensions(bytes.readUInt16BE(offset+5),bytes.readUInt16BE(offset+3));foundSize=true;}
    if(marker===218){foundScan=true;break;}offset+=length;
  }
  check(foundSize&&foundScan,'Incomplete JPEG image');
}
function validateWebp(bytes) {
  check(bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.length,'Invalid WebP image');
  let offset=12,image=false;
  while(offset+8<=bytes.length){const kind=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),start=offset+8,end=start+length;check(end<=bytes.length,'Invalid WebP segment');
    if(kind==='VP8 '){check(length>=10&&bytes[start+3]===157&&bytes[start+4]===1&&bytes[start+5]===42,'Invalid WebP pixels');dimensions(bytes.readUInt16LE(start+6)&16383,bytes.readUInt16LE(start+8)&16383);image=true;}
    if(kind==='VP8L'){check(length>=5&&bytes[start]===47,'Invalid WebP pixels');const bits=bytes.readUInt32LE(start+1);dimensions((bits&16383)+1,((bits>>>14)&16383)+1);check((bits>>>29)===0,'Invalid WebP version');image=true;}
    if(kind==='VP8X'){check(length===10,'Invalid WebP header');dimensions(1+bytes.readUIntLE(start+4,3),1+bytes.readUIntLE(start+7,3));check(!(bytes[start]&2),'Upload a still image for this post');}
    offset=end+(length%2);
  }
  check(image&&offset===bytes.length,'Incomplete WebP image');
}
function imageValue(value) {
  if(value===undefined||value===null||value==='')return null;
  check(typeof value==='string'&&value.length<=Math.ceil(SOCIAL_META.maxImageBytes/3)*4+40,'Image is too large; use an image under 512 KiB',413,'image_too_large');
  const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);check(match&&match[2].length%4===0,'Upload a PNG, JPEG or WebP image',400,'invalid_image');const bytes=Buffer.from(match[2],'base64');check(bytes.length<=SOCIAL_META.maxImageBytes&&bytes.toString('base64')===match[2],'Invalid image encoding',400,'invalid_image');
  ({png:validatePng,jpeg:validateJpeg,webp:validateWebp})[match[1]](bytes);return`data:image/${match[1]};base64,${bytes.toString('base64')}`;
}

/** Durable real-resident social content. This store owns no authentication tokens. */
export class SocialStore {
  constructor(gameStore) {
    this.game=gameStore;this.db=gameStore.db;
    this.authorizeModeration=()=>{throw new GameError('Content moderation permission is required',403,'admin_permission_required');};
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS social_posts(id TEXT PRIMARY KEY,author_id TEXT NOT NULL REFERENCES residents(id),kind TEXT NOT NULL CHECK(kind IN ('post','status')),text TEXT NOT NULL,image_data_url TEXT,created_at INTEGER NOT NULL,expires_at INTEGER,deleted_at INTEGER,deleted_by TEXT REFERENCES residents(id),deletion_reason TEXT,operation_key TEXT NOT NULL,fingerprint TEXT NOT NULL,UNIQUE(author_id,operation_key));
      CREATE TABLE IF NOT EXISTS social_likes(post_id TEXT NOT NULL REFERENCES social_posts(id),resident_id TEXT NOT NULL REFERENCES residents(id),created_at INTEGER NOT NULL,PRIMARY KEY(post_id,resident_id));
      CREATE TABLE IF NOT EXISTS social_comments(id TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES social_posts(id),author_id TEXT NOT NULL REFERENCES residents(id),text TEXT NOT NULL,created_at INTEGER NOT NULL,operation_key TEXT NOT NULL,fingerprint TEXT NOT NULL,UNIQUE(author_id,operation_key));
      CREATE TABLE IF NOT EXISTS home_visit_requests(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES residents(id),guest_id TEXT NOT NULL REFERENCES residents(id),note TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected','cancelled')),created_at INTEGER NOT NULL,answered_at INTEGER,operation_key TEXT NOT NULL,fingerprint TEXT NOT NULL,UNIQUE(guest_id,operation_key));
      CREATE TABLE IF NOT EXISTS home_visit_sessions(id TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL REFERENCES home_visit_requests(id),owner_id TEXT NOT NULL REFERENCES residents(id),guest_id TEXT NOT NULL REFERENCES residents(id),property_id TEXT NOT NULL,started_at INTEGER NOT NULL,ended_at INTEGER,end_reason TEXT);
      CREATE INDEX IF NOT EXISTS social_posts_feed ON social_posts(kind,created_at DESC,id DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS social_posts_author ON social_posts(author_id,created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS social_posts_expiry ON social_posts(expires_at) WHERE kind='status' AND deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS social_comments_page ON social_comments(post_id,created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS social_comments_author ON social_comments(author_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS social_likes_resident ON social_likes(resident_id,post_id);
      CREATE INDEX IF NOT EXISTS moderation_reverse ON moderation(target,kind,owner);
      CREATE INDEX IF NOT EXISTS friendship_incoming ON friendship(recipient,status,sender);
      CREATE INDEX IF NOT EXISTS home_visit_requests_owner ON home_visit_requests(owner_id,created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS home_visit_requests_guest ON home_visit_requests(guest_id,created_at DESC,id DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS home_visit_requests_one_pending ON home_visit_requests(owner_id,guest_id) WHERE status='pending';
      CREATE INDEX IF NOT EXISTS home_visit_sessions_owner ON home_visit_sessions(owner_id,ended_at,started_at DESC,id DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS home_visit_sessions_one_active ON home_visit_sessions(guest_id) WHERE ended_at IS NULL;
    `);
  }
  get(sql,...args){return this.game.get(sql,...args);}
  all(sql,...args){return this.game.all(sql,...args);}
  run(sql,...args){return this.game.run(sql,...args);}
  transaction(fn){return this.game.transaction(fn);}
  clock(){return this.game.clock();}
  profile(id){check(typeof id==='string'&&id.length>0&&id.length<=80&&this.get('SELECT 1 FROM residents WHERE id=?',id),'Sign in to your resident account',401,'authentication_required');return this.game.profile(id);}
  save(profile){return this.game.save(profile);}
  postView(id,row){return{id:row.id,userId:row.author_id,resident:this.game.resident(id,row.author_id),text:row.text,imageDataUrl:row.image_data_url,kind:row.kind,createdAt:row.created_at,expiresAt:row.expires_at,likes:this.get('SELECT COUNT(*) n FROM social_likes WHERE post_id=?',row.id).n,likedByMe:Boolean(this.get('SELECT 1 FROM social_likes WHERE post_id=? AND resident_id=?',row.id,id)),commentCount:this.get(`SELECT COUNT(*) n FROM social_comments c WHERE post_id=? AND ${visible('c.author_id')}`,row.id,id,id).n};}
  postAccess(id,postId){this.profile(id);identifier(postId,'Choose a post');const row=this.get(`SELECT p.* FROM social_posts p WHERE p.id=? AND p.deleted_at IS NULL AND (p.expires_at IS NULL OR p.expires_at>?) AND ${visible('p.author_id')}`,postId,this.clock(),id,id);check(row,'Post is unavailable',404,'post_unavailable');return row;}
  contentPage(id,kind,options={}) {
    this.profile(id);const {limit,after}=pageOptions(options),now=this.clock(),args=kind==='status'?[kind,now-SOCIAL_META.statusDurationMs,now,id,id]:[kind,id,id],expiry=kind==='status'?'p.created_at>? AND p.expires_at>?':'p.expires_at IS NULL';let clause='';if(after){clause=` AND ${keyset('p')}`;args.push(after[0],after[0],after[1]);}args.push(limit+1);
    const rows=this.all(`SELECT p.* FROM social_posts p JOIN residents r ON r.id=p.author_id WHERE p.kind=? AND p.deleted_at IS NULL AND ${expiry} AND ${visible('p.author_id')}${clause} ORDER BY p.created_at DESC,p.id DESC LIMIT ?`,...args),items=rows.slice(0,limit);return{ok:true,[kind==='status'?'statuses':'posts']:items.map(row=>this.postView(id,row)),nextCursor:rows.length>limit?cursorFor(items.at(-1)):null,serverTime:now};
  }
  feed(id,options={}){return this.contentPage(id,'post',options);}
  statuses(id,options={}){return this.contentPage(id,'status',options);}
  createPost(id,body={}) {
    this.profile(id);const text=textValue(body.text,SOCIAL_META.maxTextLength,'Post'),image=imageValue(body.imageDataUrl),kind=body.kind??'post',key=operationKey(body.idempotencyKey);check(kind==='post'||kind==='status','Choose a post or 24-hour status');check(text.length||image,'Write something or choose an image');const hash=fingerprint({text,image,kind});let replayed=false;
    const row=this.transaction(()=>{const prior=this.get('SELECT * FROM social_posts WHERE author_id=? AND operation_key=?',id,key);if(prior){check(prior.fingerprint===hash,'This idempotency key was already used for different content',409,'idempotency_conflict');check(prior.deleted_at===null,'This post was deleted',410,'post_unavailable');check(prior.expires_at===null||prior.expires_at>this.clock(),'This status has expired',410,'status_expired');replayed=true;return prior;}const createdAt=this.clock(),postId=uid();this.run('INSERT INTO social_posts(id,author_id,kind,text,image_data_url,created_at,expires_at,operation_key,fingerprint) VALUES(?,?,?,?,?,?,?,?,?)',postId,id,kind,text,image,createdAt,kind==='status'?createdAt+SOCIAL_META.statusDurationMs:null,key,hash);return this.get('SELECT * FROM social_posts WHERE id=?',postId);});
    const post=this.postView(id,row);if(!replayed){this.game.emitUser(id,'social-post',{post});this.game.emitZone(id,'social-post',{post});}return{ok:true,post,replayed};
  }
  toggleLike(id,postId) {
    const row=this.postAccess(id,postId);this.transaction(()=>{const existing=this.get('SELECT 1 FROM social_likes WHERE post_id=? AND resident_id=?',postId,id);if(existing)this.run('DELETE FROM social_likes WHERE post_id=? AND resident_id=?',postId,id);else this.run('INSERT INTO social_likes VALUES(?,?,?)',postId,id,this.clock());});const post=this.postView(id,row);this.game.emitUser(id,'social-post',{post});if(row.author_id!==id)this.game.emitUser(row.author_id,'social-change',{postId});return{ok:true,post};
  }
  commentView(id,row){return{id:row.id,postId:row.post_id,userId:row.author_id,resident:this.game.resident(id,row.author_id),text:row.text,createdAt:row.created_at};}
  comments(id,postId,options={}) {
    this.postAccess(id,postId);const {limit,after}=pageOptions(options),args=[postId,id,id];let clause='';if(after){clause=` AND ${keyset('c')}`;args.push(after[0],after[0],after[1]);}args.push(limit+1);const rows=this.all(`SELECT c.* FROM social_comments c JOIN residents r ON r.id=c.author_id WHERE c.post_id=? AND ${visible('c.author_id')}${clause} ORDER BY c.created_at DESC,c.id DESC LIMIT ?`,...args),items=rows.slice(0,limit);return{ok:true,comments:items.map(row=>this.commentView(id,row)),nextCursor:rows.length>limit?cursorFor(items.at(-1)):null};
  }
  addComment(id,postId,body={}) {
    const post=this.postAccess(id,postId),text=textValue(body.text,SOCIAL_META.maxCommentLength,'Comment'),key=operationKey(body.idempotencyKey);check(text.length,'Write a comment first');const hash=fingerprint({postId,text});let replayed=false;const row=this.transaction(()=>{const prior=this.get('SELECT * FROM social_comments WHERE author_id=? AND operation_key=?',id,key);if(prior){check(prior.fingerprint===hash,'This idempotency key was already used for a different comment',409,'idempotency_conflict');replayed=true;return prior;}const commentId=uid();this.run('INSERT INTO social_comments VALUES(?,?,?,?,?,?,?)',commentId,postId,id,text,this.clock(),key,hash);return this.get('SELECT * FROM social_comments WHERE id=?',commentId);});const comment=this.commentView(id,row);if(!replayed){this.game.emitUser(id,'social-comment',{comment});if(post.author_id!==id)this.game.emitUser(post.author_id,'social-comment',{comment});}return{ok:true,comment,replayed};
  }
  deleteOwnPost(id,postId) {
    this.profile(id);identifier(postId,'Choose a post');const row=this.get('SELECT * FROM social_posts WHERE id=? AND author_id=?',postId,id);check(row,'Your post was not found',404,'post_unavailable');const replayed=row.deleted_at!==null;if(!replayed)this.run("UPDATE social_posts SET deleted_at=?,deleted_by=?,deletion_reason='Author deleted' WHERE id=?",this.clock(),id,postId);if(!replayed){this.game.emitUser(id,'social-delete',{postId});this.game.emitZone(id,'social-delete',{postId});}return{ok:true,postId,deleted:true,replayed};
  }
  moderationPosts(id,options={}) {
    this.profile(id);this.authorizeModeration(id);const {limit,after}=pageOptions(options),args=[];let clause=options.includeDeleted?'1=1':'p.deleted_at IS NULL';if(after){clause+=` AND ${keyset('p')}`;args.push(after[0],after[0],after[1]);}args.push(limit+1);const rows=this.all(`SELECT p.* FROM social_posts p WHERE ${clause} ORDER BY p.created_at DESC,p.id DESC LIMIT ?`,...args),items=rows.slice(0,limit);return{ok:true,posts:items.map(row=>({...this.postView(id,row),deletedAt:row.deleted_at,deletedBy:row.deleted_by,deletionReason:row.deletion_reason})),nextCursor:rows.length>limit?cursorFor(items.at(-1)):null};
  }
  moderateDeletePost(id,postId,body={}) {
    this.profile(id);this.authorizeModeration(id);identifier(postId,'Choose a post');const reason=textValue(body.reason,500,'Moderation reason');check(reason.length>=3,'Explain why this post is being removed');const row=this.get('SELECT * FROM social_posts WHERE id=?',postId);check(row,'Post was not found',404,'post_unavailable');const replayed=row.deleted_at!==null;if(!replayed)this.run('UPDATE social_posts SET deleted_at=?,deleted_by=?,deletion_reason=? WHERE id=?',this.clock(),id,reason,postId);if(!replayed){this.game.emitUser(row.author_id,'social-delete',{postId,moderated:true});if(id!==row.author_id)this.game.emitUser(id,'social-delete',{postId,moderated:true});}return{ok:true,postId,deleted:true,replayed};
  }
  acceptedFriends(a,b){return Boolean(this.get("SELECT 1 FROM friendship WHERE status='accepted' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))",a,b,b,a));}
  visitPermission(owner,guestId) {return owner.settings.allowInvites!==false&&owner.settings.allowHomeVisits!==false&&!this.game.blocked(owner.id,guestId)&&(!owner.settings.homeVisitsFriendsOnly||this.acceptedFriends(owner.id,guestId));}
  ownHome(owner){return owner.location.kind==='home'&&owner.location.district===owner.home.district&&owner.district===owner.home.district&&!owner.activeTrip;}
  requestView(viewer,row){return{id:row.id,ownerId:row.owner_id,guestId:row.guest_id,owner:this.game.resident(viewer,row.owner_id),guest:this.game.resident(viewer,row.guest_id),note:row.note,status:row.status,createdAt:row.created_at,answeredAt:row.answered_at};}
  requestVisit(id,body={}) {
    const guest=this.profile(id),ownerId=identifier(body.ownerId??body.residentId,'Choose a home owner');check(ownerId!==id,'Choose another resident to visit');const owner=this.game.profile(ownerId),note=textValue(body.note,300,'Visit note'),key=operationKey(body.idempotencyKey);check(this.visitPermission(owner,id),'This resident is not accepting home visits',403,'visit_unavailable');const hash=fingerprint({ownerId,note});let replayed=false;
    const row=this.transaction(()=>{const prior=this.get('SELECT * FROM home_visit_requests WHERE guest_id=? AND operation_key=?',id,key);if(prior){check(prior.fingerprint===hash,'This idempotency key was already used for another visit',409,'idempotency_conflict');replayed=true;return prior;}check(guest.location.kind==='public'&&guest.district===owner.home.district&&!guest.activeTrip&&!guest.activeShift&&!guest.drivingVehicle,'Head outside in the owner’s home neighbourhood and park before requesting a visit',409,'visit_location');check(!this.get("SELECT 1 FROM home_visit_requests WHERE guest_id=? AND owner_id=? AND status='pending'",id,ownerId),'A visit request is already waiting for this owner',409,'visit_pending');const requestId=uid();this.run("INSERT INTO home_visit_requests(id,owner_id,guest_id,note,status,created_at,operation_key,fingerprint) VALUES(?,?,?,?,'pending',?,?,?)",requestId,ownerId,id,note,this.clock(),key,hash);return this.get('SELECT * FROM home_visit_requests WHERE id=?',requestId);});const request=this.requestView(id,row);if(!replayed){this.game.emitUser(ownerId,'home-visit-request',{request:this.requestView(ownerId,row)});this.game.emitUser(id,'home-visit-request',{request});this.game.notify(ownerId,'home-visit','Home visit request',`${guest.displayName} would like to visit your home.`,'visits',id);}return{ok:true,request,replayed};
  }
  answerVisit(id,requestId,accept) {
    this.reconcileVisits(id);identifier(requestId,'Choose a home visit request');check(typeof accept==='boolean','Accept or reject this visit request');let replayed=false,session=null;
    const row=this.transaction(()=>{const request=this.get('SELECT * FROM home_visit_requests WHERE id=? AND owner_id=?',requestId,id);check(request,'Home visit request was not found',404,'visit_unavailable');if(request.status!=='pending'){check(request.status===(accept?'accepted':'rejected'),'This visit request was already answered differently',409,'visit_answered');replayed=true;session=this.get('SELECT * FROM home_visit_sessions WHERE request_id=?',requestId);return request;}const owner=this.game.profile(id),guest=this.game.profile(request.guest_id);check(!this.game.blocked(id,guest.id),'This home visit request is unavailable',403,'visit_unavailable');if(accept){check(this.visitPermission(owner,guest.id),'Your home visit privacy settings prevent this visit',403,'visit_unavailable');check(this.ownHome(owner),'Return to your own home before welcoming a visitor',409,'owner_not_home');check(guest.location.kind==='public'&&guest.district===owner.home.district&&!guest.activeTrip&&!guest.activeShift&&!guest.drivingVehicle,'The guest must be outside in your home neighbourhood and parked',409,'visit_location');check(!this.get('SELECT 1 FROM home_visit_sessions WHERE guest_id=? AND ended_at IS NULL',guest.id),'This guest is already visiting a home',409,'visit_active');const timestamp=this.clock();session={id:uid(),request_id:request.id,owner_id:id,guest_id:guest.id,property_id:owner.home.propertyId,started_at:timestamp,ended_at:null,end_reason:null};this.run('INSERT INTO home_visit_sessions VALUES(?,?,?,?,?,?,?,?)',...Object.values(session));guest.location={kind:'visit',district:owner.home.district,venue:'home',ownerId:id,visitId:session.id};guest.drivingVehicle=null;this.save(guest);}this.run('UPDATE home_visit_requests SET status=?,answered_at=? WHERE id=?',accept?'accepted':'rejected',this.clock(),requestId);return this.get('SELECT * FROM home_visit_requests WHERE id=?',requestId);});
    if(!replayed){for(const target of [id,row.guest_id])this.game.emitUser(target,'home-visit',{request:this.requestView(target,row),visitId:session?.id??null});if(accept)this.game.emitUser(row.guest_id,'profile',{profile:this.game.profile(row.guest_id)});}return{ok:true,request:this.requestView(id,row),visit:session?.ended_at===null?this.visitView(id,session):null,replayed};
  }
  visitView(id,row){const owner=this.game.profile(row.owner_id),inventory=owner.inventory.filter(itemId=>catalog.some(item=>item.id===itemId&&item.category==='furniture'));return{id:row.id,requestId:row.request_id,ownerId:row.owner_id,guestId:row.guest_id,owner:this.game.resident(id,row.owner_id),guest:this.game.resident(id,row.guest_id),home:structuredClone(owner.home),furnitureLayout:structuredClone(owner.furnitureLayout),storedFurniture:[...owner.storedFurniture],startedAt:row.started_at,ownerHome:{id:owner.id,username:owner.username,displayName:owner.displayName,appearance:structuredClone(owner.appearance),home:structuredClone(owner.home),inventory,furnitureLayout:structuredClone(owner.furnitureLayout),storedFurniture:[...owner.storedFurniture]}};}
  endSession(row,reason) {
    const timestamp=this.clock();this.transaction(()=>{this.run('UPDATE home_visit_sessions SET ended_at=?,end_reason=? WHERE id=? AND ended_at IS NULL',timestamp,reason,row.id);const guest=this.game.profile(row.guest_id);if(guest.location.kind==='visit'&&guest.location.visitId===row.id){guest.location={kind:'public',district:guest.district,venue:'neighbourhood'};guest.drivingVehicle=null;this.save(guest);}});for(const target of [row.owner_id,row.guest_id])this.game.emitUser(target,'home-visit-ended',{visitId:row.id,reason});this.game.emitUser(row.guest_id,'profile',{profile:this.game.profile(row.guest_id)});
  }
  reconcileVisits(id) {
    this.profile(id);const sessions=this.all('SELECT * FROM home_visit_sessions WHERE ended_at IS NULL AND (guest_id=? OR owner_id=?)',id,id);
    for(const row of sessions){const owner=this.game.profile(row.owner_id),guest=this.game.profile(row.guest_id);if(!this.ownHome(owner)||owner.home.propertyId!==row.property_id||!this.visitPermission(owner,guest.id)||guest.location.kind!=='visit'||guest.location.visitId!==row.id)this.endSession(row,'Home visit is no longer available');}
  }
  leaveVisit(id) {this.profile(id);const session=this.get('SELECT * FROM home_visit_sessions WHERE guest_id=? AND ended_at IS NULL',id);if(session)this.endSession(session,'Guest left');return{ok:true,profile:this.game.profile(id),visit:null,replayed:!session};}
  visitState(id,options={}) {
    this.reconcileVisits(id);const {limit,after}=pageOptions(options),args=[id,id,id,id,id,id];let clause='';if(after){clause=` AND ${keyset('v')}`;args.push(after[0],after[0],after[1]);}args.push(limit+1);const rows=this.all(`SELECT v.* FROM home_visit_requests v WHERE (v.owner_id=? OR v.guest_id=?) AND ${visible('v.owner_id')} AND ${visible('v.guest_id')}${clause} ORDER BY v.created_at DESC,v.id DESC LIMIT ?`,...args),items=rows.slice(0,limit),session=this.get('SELECT * FROM home_visit_sessions WHERE guest_id=? AND ended_at IS NULL',id);
    const visitorPage=pageOptions({cursor:options.visitorsCursor,limit}),visitorArgs=[id];let visitorClause='';if(visitorPage.after){visitorClause=' AND (started_at<? OR (started_at=? AND id<?))';visitorArgs.push(visitorPage.after[0],visitorPage.after[0],visitorPage.after[1]);}visitorArgs.push(limit+1);const visitors=this.all(`SELECT * FROM home_visit_sessions WHERE owner_id=? AND ended_at IS NULL${visitorClause} ORDER BY started_at DESC,id DESC LIMIT ?`,...visitorArgs);
    return{ok:true,visit:session?this.visitView(id,session):null,requests:items.map(row=>this.requestView(id,row)),visitors:visitors.slice(0,limit).map(row=>this.visitView(id,row)),nextRequestsCursor:rows.length>limit?cursorFor(items.at(-1)):null,nextVisitorsCursor:visitors.length>limit?cursorFor(visitors[limit-1]):null};
  }
}

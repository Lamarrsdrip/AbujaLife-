import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { GameStore, GameError } from '../src/server/gameStore.mjs';
import { SocialStore, SOCIAL_META } from '../src/server/socialStore.mjs';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
async function fixture(t) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'abujalife-social-'));let time=Date.now(),game=new GameStore({dataDir,clock:()=>time,originRandomInt:()=>0}),social=new SocialStore(game);
  const sessions=await Promise.all(['resident','neighbor','third'].map(username=>game.register({username,displayName:username,password:'a-test-password'})));
  t.after(()=>{game.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  return{get game(){return game;},get social(){return social;},id:sessions[0].residentId,other:sessions[1].residentId,third:sessions[2].residentId,sessions,dataDir,advance:ms=>{time+=ms;},restart(){game.close();game=new GameStore({dataDir,clock:()=>time});social=new SocialStore(game);}};
}
const post=(social,id,text,key=`post_${crypto.randomUUID()}`)=>social.createPost(id,{text,idempotencyKey:key}).post;
const errorCode=code=>error=>error instanceof GameError&&error.code===code;

test('social content is empty until real residents publish; sessions and all interactions survive restart',async t=>{
  const f=await fixture(t);assert.deepEqual(f.social.feed(f.id).posts,[]);assert.deepEqual(f.social.statuses(f.id).statuses,[]);
  const created=f.social.createPost(f.id,{text:'An actual resident in Garki',imageDataUrl:png,idempotencyKey:'durable_post_1'}).post;
  assert.equal(created.resident.id,f.id);assert.equal(created.imageDataUrl,png);assert.equal(created.likes,0);
  const liked=f.social.toggleLike(f.other,created.id).post;assert.equal(liked.likes,1);assert.equal(liked.likedByMe,true);
  const comment=f.social.addComment(f.other,created.id,{text:'Let us meet after work',idempotencyKey:'durable_comment_1'}).comment;
  f.restart();assert.equal(f.game.session(f.sessions[0].token),f.id);assert.equal(f.social.feed(f.other).posts[0].id,created.id);assert.equal(f.social.feed(f.other).posts[0].likes,1);assert.equal(f.social.feed(f.other).posts[0].likedByMe,true);assert.equal(f.social.feed(f.other).posts[0].commentCount,1);assert.equal(f.social.comments(f.id,created.id).comments[0].id,comment.id);
  assert.equal(f.social.toggleLike(f.other,created.id).post.likes,0);
});

test('unauthenticated store calls cannot read or create social content or visit requests',async t=>{
  const {social,id}=await fixture(t),created=post(social,id,'Private behind authentication');
  for(const read of [()=>social.feed(null),()=>social.statuses('unknown'),()=>social.comments(null,created.id),()=>social.visitState(undefined)])assert.throws(read,errorCode('authentication_required'));
  for(const write of [()=>social.createPost(null,{text:'Forged',idempotencyKey:'forged_key_1'}),()=>social.toggleLike(null,created.id),()=>social.addComment(null,created.id,{text:'Forged',idempotencyKey:'forged_key_2'}),()=>social.deleteOwnPost(null,created.id),()=>social.requestVisit(null,{ownerId:id,idempotencyKey:'forged_key_3'}),()=>social.leaveVisit(null)])assert.throws(write,errorCode('authentication_required'));
});

test('statuses last exactly 24 server-clock hours and client timestamps never extend them',async t=>{
  const f=await fixture(t),created=f.social.createPost(f.id,{kind:'status',text:'Today in Abuja',createdAt:9999999999999,expiresAt:9999999999999,idempotencyKey:'status_clock_1'}).post;
  assert.equal(created.expiresAt-created.createdAt,SOCIAL_META.statusDurationMs);assert.equal(f.social.feed(f.id).posts.length,0);assert.equal(f.social.statuses(f.other).statuses.length,1);
  f.advance(SOCIAL_META.statusDurationMs-1);assert.equal(f.social.statuses(f.other).statuses.length,1);f.advance(1);assert.equal(f.social.statuses(f.other).statuses.length,0);assert.throws(()=>f.social.toggleLike(f.other,created.id),errorCode('post_unavailable'));assert.throws(()=>f.social.comments(f.other,created.id),errorCode('post_unavailable'));assert.throws(()=>f.social.createPost(f.id,{kind:'status',text:'Today in Abuja',idempotencyKey:'status_clock_1'}),errorCode('status_expired'));assert.equal(f.game.get('SELECT expires_at FROM social_posts WHERE id=?',created.id).expires_at,created.expiresAt);
});

test('same-clock keyset pages expose all posts and comments without duplicates or a total-content cap',async t=>{
  const {social,id,other}=await fixture(t);for(let i=0;i<73;i++)post(social,id,`Real post ${i}`,`page_post_${i}`);
  const seen=[];let cursor=null;do{const page=social.feed(other,{limit:17,cursor});assert.ok(page.posts.length<=17);seen.push(...page.posts.map(p=>p.id));cursor=page.nextCursor;}while(cursor);
  assert.equal(seen.length,73);assert.equal(new Set(seen).size,73);const postId=seen[0];for(let i=0;i<54;i++)social.addComment(other,postId,{text:`Real comment ${i}`,idempotencyKey:`page_comment_${i}`});
  const comments=[];cursor=null;do{const page=social.comments(id,postId,{limit:13,cursor});comments.push(...page.comments.map(c=>c.id));cursor=page.nextCursor;}while(cursor);assert.equal(comments.length,54);assert.equal(new Set(comments).size,54);
  assert.throws(()=>social.feed(id,{limit:51}));assert.throws(()=>social.feed(id,{cursor:'invented'}),errorCode('invalid_cursor'));
  const plan=social.all("EXPLAIN QUERY PLAN SELECT * FROM social_posts WHERE kind='post' AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 20");assert.ok(plan.some(row=>row.detail.includes('social_posts_feed')));
});

test('blocks filter posts and comments in both directions before pagination and prevent interactions',async t=>{
  const {social,game,id,other,third}=await fixture(t),mine=post(social,id,'Mine'),theirs=post(social,other,'Theirs');social.addComment(other,mine.id,{text:'Hidden on block',idempotencyKey:'block_comment_1'});social.addComment(third,mine.id,{text:'Visible resident',idempotencyKey:'block_comment_2'});game.moderate(id,'block',other,true);
  assert.ok(social.feed(id).posts.every(p=>p.userId!==other));assert.ok(social.feed(other).posts.every(p=>p.userId!==id));assert.equal(social.feed(id).posts.find(p=>p.id===mine.id).commentCount,1);assert.deepEqual(social.comments(id,mine.id).comments.map(c=>c.userId),[third]);assert.throws(()=>social.toggleLike(id,theirs.id),errorCode('post_unavailable'));assert.throws(()=>social.addComment(other,mine.id,{text:'Bypass',idempotencyKey:'block_comment_3'}),errorCode('post_unavailable'));
  assert.equal(social.feed(third).posts.length,2);
});

test('idempotent publishing and commenting cannot duplicate content, change content, or resurrect deletion',async t=>{
  const {social,game,id,other}=await fixture(t),body={text:'Once',idempotencyKey:'idempotent_post_1'},first=social.createPost(id,body),retry=social.createPost(id,body);assert.equal(retry.post.id,first.post.id);assert.equal(retry.replayed,true);assert.equal(social.feed(id).posts.length,1);
  assert.throws(()=>social.createPost(id,{...body,text:'Changed'}),errorCode('idempotency_conflict'));const c={text:'Comment once',idempotencyKey:'idempotent_comment_1'},a=social.addComment(other,first.post.id,c),b=social.addComment(other,first.post.id,c);assert.equal(a.comment.id,b.comment.id);assert.equal(b.replayed,true);assert.equal(social.comments(id,first.post.id).comments.length,1);assert.throws(()=>social.addComment(other,first.post.id,{...c,text:'Changed'}),errorCode('idempotency_conflict'));
  assert.throws(()=>social.deleteOwnPost(other,first.post.id),errorCode('post_unavailable'));social.deleteOwnPost(id,first.post.id);assert.equal(social.feed(other).posts.length,0);assert.equal(social.deleteOwnPost(id,first.post.id).replayed,true);assert.throws(()=>social.createPost(id,body),errorCode('post_unavailable'));assert.equal(game.get('SELECT COUNT(*) n FROM social_posts').n,1);
});

test('image and text validation rejects scripts, corrupt raster data, oversized payloads and empty content',async t=>{
  const {social,id}=await fixture(t);let counter=0;const invalid=imageDataUrl=>social.createPost(id,{imageDataUrl,idempotencyKey:`image_reject_${counter++}`});
  for(const input of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=','https://example.com/image.png','data:text/html;base64,PGh0bWw+','data:image/png;base64,aGVsbG8=','data:image/jpeg;base64,/9j/aGVsbG8=/9k='])assert.throws(()=>invalid(input));
  const broken=Buffer.from(png.split(',')[1],'base64');broken[40]^=1;assert.throws(()=>invalid(`data:image/png;base64,${broken.toString('base64')}`),/PNG/);assert.throws(()=>invalid(`data:image/png;base64,${Buffer.alloc(SOCIAL_META.maxImageBytes+1).toString('base64')}`));assert.throws(()=>social.createPost(id,{text:'x'.repeat(4001),idempotencyKey:'long_text_key'}));assert.throws(()=>social.createPost(id,{text:' ',idempotencyKey:'empty_text_key'}));assert.throws(()=>social.createPost(id,{text:'No key'}),errorCode('idempotency_required'));assert.deepEqual(social.feed(id).posts,[]);
});

test('moderation hooks deny permission by default and preserve the moderator, reason, and deleted content audit',async t=>{
  const {social,game,id,other}=await fixture(t),created=post(social,id,'Review me');assert.throws(()=>social.moderationPosts(other),errorCode('admin_permission_required'));assert.throws(()=>social.moderateDeletePost(other,created.id,{reason:'Content violation'}),errorCode('admin_permission_required'));
  social.authorizeModeration=actor=>{if(actor!==other)throw new GameError('Not a moderator',403,'admin_permission_required');};social.moderateDeletePost(other,created.id,{reason:'Content violation'});assert.equal(social.feed(id).posts.length,0);const audit=social.moderationPosts(other,{includeDeleted:true}).posts[0];assert.equal(audit.deletedBy,other);assert.equal(audit.deletionReason,'Content violation');assert.equal(game.get('SELECT deleted_by FROM social_posts WHERE id=?',created.id).deleted_by,other);
});

test('home visits require actual owner approval and show their real layout without granting furniture or home benefits',async t=>{
  const f=await fixture(t);f.game.action(f.id,'purchase',{itemId:'plant'});f.game.action(f.id,'place-furniture',{itemId:'plant',room:'living',x:0.5,y:0.5,rotation:90});f.game.action(f.other,'leave-home');const request=f.social.requestVisit(f.other,{ownerId:f.id,note:'Can I come over?',idempotencyKey:'home_visit_1'}).request;
  assert.equal(f.game.profile(f.other).location.kind,'public');assert.equal(f.social.visitState(f.id).requests[0].guestId,f.other);assert.throws(()=>f.social.answerVisit(f.third,request.id,true),errorCode('visit_unavailable'));const accepted=f.social.answerVisit(f.id,request.id,true);assert.equal(accepted.visit.ownerId,f.id);const before=f.game.profile(f.other),ownerBefore=f.game.profile(f.id);assert.equal(before.location.kind,'visit');assert.equal(before.location.ownerId,f.id);const state=f.social.visitState(f.other);assert.deepEqual(state.visit.furnitureLayout,ownerBefore.furnitureLayout);assert.ok(state.visit.ownerHome.inventory.includes('plant'));assert.equal(Object.hasOwn(state.visit.ownerHome,'wallet'),false);assert.equal(Object.hasOwn(state.visit.ownerHome,'settings'),false);
  for(const action of ['eat','sleep','shower','relax','place-furniture','store-furniture'])assert.throws(()=>f.game.action(f.other,action,{itemId:'plant',ownerId:f.id}),/Go home/);assert.equal(f.game.profile(f.other).wallet,before.wallet);assert.deepEqual(f.game.profile(f.id),ownerBefore);
  assert.equal(f.social.requestVisit(f.other,{ownerId:f.id,note:'Can I come over?',idempotencyKey:'home_visit_1'}).replayed,true);assert.equal(f.social.answerVisit(f.id,request.id,true).replayed,true);assert.equal(f.game.get('SELECT COUNT(*) n FROM home_visit_sessions').n,1);f.restart();assert.equal(f.social.visitState(f.other).visit.ownerId,f.id);f.social.leaveVisit(f.other);assert.equal(f.game.profile(f.other).location.kind,'public');assert.equal(f.social.visitState(f.other).visit,null);assert.equal(f.social.leaveVisit(f.other).replayed,true);assert.equal(f.social.answerVisit(f.id,request.id,true).visit,null);assert.equal(f.game.profile(f.other).location.kind,'public');
});

test('home visit privacy, friend requirements, rejections and owner presence are enforced by the server',async t=>{
  const {social,game,id,other}=await fixture(t);game.action(other,'leave-home');let owner=game.profile(id);owner.settings.allowHomeVisits=false;game.save(owner);assert.throws(()=>social.requestVisit(other,{ownerId:id,idempotencyKey:'closed_home_1'}),errorCode('visit_unavailable'));owner.settings.allowHomeVisits=true;owner.settings.homeVisitsFriendsOnly=true;game.save(owner);assert.throws(()=>social.requestVisit(other,{ownerId:id,idempotencyKey:'friends_home_1'}),errorCode('visit_unavailable'));game.requestFriend(other,id);game.respondFriend(id,game.friendRequests(id)[0].id,true);const request=social.requestVisit(other,{ownerId:id,idempotencyKey:'friends_home_2'}).request;
  game.action(id,'leave-home');assert.throws(()=>social.answerVisit(id,request.id,true),errorCode('owner_not_home'));assert.equal(game.profile(other).location.kind,'public');social.answerVisit(id,request.id,false);assert.equal(social.visitState(other).requests[0].status,'rejected');assert.throws(()=>social.answerVisit(id,request.id,true),errorCode('visit_answered'));assert.equal(game.get('SELECT COUNT(*) n FROM home_visit_sessions').n,0);
});

test('home visits end when an owner leaves, closes privacy, or blocks a guest',async t=>{
  const {social,game,id,other}=await fixture(t);game.action(other,'leave-home');for(const [index,change] of [()=>game.action(id,'leave-home'),()=>{const p=game.profile(id);p.settings.allowHomeVisits=false;game.save(p);},()=>game.moderate(id,'block',other,true)].entries()){
    const owner=game.profile(id);owner.settings.allowHomeVisits=true;owner.location={kind:'home',district:owner.home.district,venue:'home'};game.save(owner);game.moderate(id,'block',other,false);const request=social.requestVisit(other,{ownerId:id,idempotencyKey:`revoked_home_${index}`}).request;social.answerVisit(id,request.id,true);change();assert.equal(social.visitState(other).visit,null);assert.equal(game.profile(other).location.kind,'public');assert.equal(game.get('SELECT COUNT(*) n FROM home_visit_sessions WHERE ended_at IS NULL').n,0);
  }
});

test('home request and actual visitor windows are independently pageable without truncating durable collections',async t=>{
  const {social,game,id,other,third}=await fixture(t);game.action(other,'leave-home');game.action(third,'leave-home');
  for(let i=0;i<54;i++){const request=social.requestVisit(other,{ownerId:id,idempotencyKey:`request_page_${i}`}).request;social.answerVisit(id,request.id,false);}
  const seen=[];let cursor=null;do{const state=social.visitState(id,{limit:13,cursor});seen.push(...state.requests.map(r=>r.id));cursor=state.nextRequestsCursor;}while(cursor);assert.equal(seen.length,54);assert.equal(new Set(seen).size,54);
  for(const [index,guest] of [other,third].entries()){const request=social.requestVisit(guest,{ownerId:id,idempotencyKey:`visitor_page_${index}`}).request;social.answerVisit(id,request.id,true);}
  const first=social.visitState(id,{limit:1});assert.equal(first.visitors.length,1);assert.ok(first.nextVisitorsCursor);const second=social.visitState(id,{limit:1,visitorsCursor:first.nextVisitorsCursor});assert.equal(second.visitors.length,1);assert.equal(second.nextVisitorsCursor,null);assert.notEqual(first.visitors[0].guestId,second.visitors[0].guestId);
});

test('social and visit realtime delivery addresses actual participants and idempotent retries emit no duplicate events',async t=>{
  const {social,game,id,other,third}=await fixture(t),events=[],zones=[];game.emitUser=(target,event)=>events.push({target,event});game.emitZone=(sender,event)=>zones.push({sender,event});
  const body={text:'A real post',idempotencyKey:'events_post_1'},created=social.createPost(id,body).post;let count=events.length;social.createPost(id,body);assert.equal(events.length,count);social.toggleLike(other,created.id);const comment={text:'A real reply',idempotencyKey:'events_comment_1'};social.addComment(other,created.id,comment);count=events.length;social.addComment(other,created.id,comment);assert.equal(events.length,count);
  game.action(other,'leave-home');const requestBody={ownerId:id,idempotencyKey:'events_visit_1'},request=social.requestVisit(other,requestBody).request;count=events.length;social.requestVisit(other,requestBody);assert.equal(events.length,count);social.answerVisit(id,request.id,true);count=events.length;social.answerVisit(id,request.id,true);assert.equal(events.length,count);
  assert.ok(events.length>0);assert.ok(events.every(row=>row.target===id||row.target===other));assert.ok(events.every(row=>row.target!==third));assert.ok(zones.every(row=>row.sender===id));
});

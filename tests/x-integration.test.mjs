import test from 'node:test';
import assert from 'node:assert/strict';
import { X_OAUTH_SCOPES, xAuthorizeURL, createXIntegration } from '../src/server/xIntegration.mjs';

test('X OAuth uses PKCE without leaking the verifier', () => {
  const verifier='a-secure-verifier-that-must-never-enter-the-authorize-url';
  const url=new URL(xAuthorizeURL({clientId:'client-123',redirectUri:'https://api.abujacity.life/api/x/callback',state:'state-123',verifier}));
  assert.equal(url.origin,'https://x.com');
  assert.equal(url.pathname,'/i/oauth2/authorize');
  assert.equal(url.searchParams.get('response_type'),'code');
  assert.equal(url.searchParams.get('client_id'),'client-123');
  assert.equal(url.searchParams.get('state'),'state-123');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.ok(url.searchParams.get('code_challenge'));
  assert.equal(url.href.includes(verifier),false);
});

test('X scopes cover read, post, social actions and refresh', () => {
  for(const scope of ['tweet.read','tweet.write','users.read','follows.read','follows.write','like.read','like.write','bookmark.read','bookmark.write','offline.access'])assert.ok(X_OAUTH_SCOPES.includes(scope),scope);
});

test('X integration is safely disabled when credentials are absent', async () => {
  const store={session:async token=>token==='session-token'?'resident-1':null};
  const integration=createXIntegration({store,env:{},publicWebUrl:'http://localhost:8787',apiPublicUrl:'http://localhost:8787',corsOrigins:['http://localhost:8787']});
  assert.equal(integration.configured,false);
  const result=await integration.status('resident-1');
  assert.deepEqual(result,{ok:true,enabled:false,connected:false,reason:'credentials_missing'});
});

async function handleAction(integration, {path='/api/x/connect',method='POST',origin='https://abujacity.life',contentType='application/json',cookie=true}={}) {
  const { Readable }=await import('node:stream');
  const req=Readable.from([Buffer.from('{}')]);
  Object.assign(req,{url:path,method,socket:{remoteAddress:'127.0.0.1'},headers:{...(origin!==null?{origin}:{}),...(contentType?{'content-type':contentType}:{}),...(cookie?{cookie:'abujalife_session=session-token'}:{authorization:`Bearer ${'a'.repeat(64)}`})}});
  const headers={};let status=0,body='';
  const res={writableEnded:false,setHeader(name,value){headers[name]=value;},writeHead(code,values){status=code;Object.assign(headers,values);},end(value=''){body=value;this.writableEnded=true;}};
  assert.notEqual(await integration.handle(req,res),false);
  assert.equal(res.writableEnded,true);
  return{status,body:headers['content-type']?.startsWith('text/html')?body:JSON.parse(body),headers};
}
function guardedIntegration(options={}) {
  return createXIntegration({store:{session:async()=> 'resident-1'},env:{X_CLIENT_ID:'client-fixture',X_CLIENT_SECRET:'secret-fixture'},publicWebUrl:'https://abujacity.life',apiPublicUrl:'https://api.abujacity.life',corsOrigins:['https://abujacity.life'],...options});
}

test('X cookie mutations require exact approved origin and JSON',async()=>{
  const integration=guardedIntegration();
  assert.equal((await handleAction(integration,{origin:null})).status,403);
  assert.equal((await handleAction(integration,{origin:'https://abujacity.life/untrusted'})).status,403);
  assert.equal((await handleAction(integration,{origin:'https://evil.example'})).status,403);
  assert.equal((await handleAction(integration,{contentType:'text/plain'})).status,415);
  const allowed=await handleAction(integration);
  assert.equal(allowed.status,200);
  assert.match(allowed.body.authorizeUrl,/^https:\/\/x\.com\//);
  assert.equal(allowed.headers['x-frame-options'],'DENY');
  assert.equal((await handleAction(integration,{origin:null,cookie:false})).status,200);
});

test('X handlers reject suspended residents and cap repeated mutations',async()=>{
  const suspended=guardedIntegration({admin:{isSuspended:async()=>true}});
  assert.equal((await handleAction(suspended)).status,403);
  const integration=guardedIntegration({admin:{isSuspended:async()=>false}});
  for(let i=0;i<90;i++)assert.equal((await handleAction(integration)).status,200);
  const blocked=await handleAction(integration);
  assert.equal(blocked.status,429);
  assert.equal(blocked.body.code,'rate_limited');
});

test('Mongo runtime identity includes encrypted X token collection',async()=>{
  const {MONGO_COLLECTIONS}=await import('../src/server/mongo/database.mjs');
  assert.ok(MONGO_COLLECTIONS.includes('x_connections'));
});

test('OAuth profile updates preserve refreshed X credentials',async()=>{
  let refreshCount=0;
  const requests=[];
  const integration=guardedIntegration({fetchImpl:async(url,options)=>{
    if(url.endsWith('/oauth2/token')){
      const refreshed=options.body.get('grant_type')==='refresh_token';
      if(refreshed)refreshCount++;
      return new Response(JSON.stringify({access_token:refreshed?'fresh-token':'old-token',refresh_token:refreshed?'fresh-refresh':'old-refresh',expires_in:refreshed?7200:1}),{status:200});
    }
    requests.push(options.headers.authorization);
    return new Response(JSON.stringify({data:{id:'123',name:'Fixture resident'}}),{status:200});
  }});
  const connect=await handleAction(integration),state=new URL(connect.body.authorizeUrl).searchParams.get('state');
  const callback=await handleAction(integration,{path:`/api/x/callback?code=fixture-code&state=${state}`,method:'GET',origin:null});
  assert.equal(callback.status,200);
  assert.equal((await handleAction(integration,{path:'/api/x/status',method:'GET'})).status,200);
  assert.equal(refreshCount,1);
  assert.deepEqual(requests,['Bearer fresh-token','Bearer fresh-token']);
});

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

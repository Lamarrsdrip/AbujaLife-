import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mergeCoreBootstrap } from '../app/auth-session.js';
import { normalizeAPIResponse } from '../app/api-client.js';
import { phoneAppPages } from '../app/phone-home.js';

test('periodic core refresh preserves optional state without retriggering full hydration', () => {
  const current={
    authenticated:true,
    startup:false,
    profile:{id:'r1',district:'jabi',location:{kind:'public'}},
    conversations:[{id:'c1'}],
    friends:[{id:'r2'}]
  };
  const next={
    authenticated:true,
    startup:true,
    profile:{id:'r1',district:'jabi',location:{kind:'public'},wallet:5000}
  };
  const merged=mergeCoreBootstrap(current,next);
  assert.equal(merged.startup,false);
  assert.deepEqual(merged.conversations,current.conversations);
  assert.deepEqual(merged.friends,current.friends);
  assert.equal(merged.profile.wallet,5000);
});

test('first authenticated startup still allows optional hydration', () => {
  const next={authenticated:true,startup:true,profile:{id:'r1'}};
  assert.equal(mergeCoreBootstrap({authenticated:false},next).startup,true);
});

test('HTML or empty upstream failures become recoverable JSON game errors', async () => {
  const input=new Response('<html>bad gateway</html>',{status:502,headers:{'content-type':'text/html'}});
  const output=await normalizeAPIResponse(input);
  assert.equal(output.status,502);
  assert.deepEqual(await output.json(),{
    ok:false,
    error:'The city connection was interrupted. Please try again.',
    code:'invalid_response'
  });
});

test('valid JSON API responses pass through unchanged', async () => {
  const input=new Response(JSON.stringify({ok:true,value:4}),{status:200,headers:{'content-type':'application/json; charset=utf-8'}});
  const output=await normalizeAPIResponse(input);
  assert.equal(output,input);
  assert.deepEqual(await output.clone().json(),{ok:true,value:4});
});

test('unfinished phone apps are not exposed as playable launchers', () => {
  const pages=phoneAppPages([['calls','Calls'],['messages','Messages'],['social','Social']]);
  const flat=pages.flat();
  assert.equal(flat.some(app=>app[0]==='calls'),false);
  assert.equal(flat.some(app=>app[0]==='messages'),true);
  assert.equal(flat.some(app=>app[0]==='social'),true);
});

test('nearby presence reuses viewer zone without weakening candidate privacy checks', () => {
  const source=fs.readFileSync('src/server/mongo/presenceStore.mjs','utf8');
  assert.match(source,/viewerZone=null/);
  assert.match(source,/this\.canShare\(person\.id,id,zone,\{viewerZone:zone\}\)/);
  assert.match(source,/this\.social\.blocked\(id,viewer\)/);
  assert.match(source,/presenceVisible===false/);
  assert.match(source,/await this\.zone\(id\)===zone/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBrowserURL,browserPolicy,normalizeCheckoutURL} from '../app/phone-browser.js';
import {activeSocialStatuses,safeSocialImage,createAdvancingServerClock,createPhoneSocial} from '../app/phone-social.js';

test('phone address validation accepts websites and rejects executable, relative and credential addresses',()=>{
  assert.equal(normalizeBrowserURL('example.com/abuja?q=home'),'https://example.com/abuja?q=home');
  assert.equal(normalizeBrowserURL('HTTP://example.com'),'http://example.com/');
  for(const value of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','file:///tmp/account','https://user:password@example.com','example.com@evil.test','//evil.test','/relative','https://example.com\\@evil.test','https://exam\nple.com'])assert.throws(()=>normalizeBrowserURL(value),value);
});

test('official platform embedding and HTTPS mixed content use an explicit external fallback',()=>{
  for(const value of ['https://x.com/','https://www.twitter.com/','https://www.tiktok.com/@resident'])assert.equal(browserPolicy(value).canEmbed,false);
  assert.equal(browserPolicy('https://x.com.evil.test/').canEmbed,true);
  assert.equal(browserPolicy('https://example.com/').canEmbed,true);
  assert.equal(browserPolicy('http://example.com/','https:').canEmbed,false);
  assert.equal(browserPolicy('http://example.com/','http:').canEmbed,true);
});

test('checkout navigation stays with the official HTTPS provider',()=>{
  assert.equal(normalizeCheckoutURL('https://checkout.flutterwave.com/v3/example'),'https://checkout.flutterwave.com/v3/example');
  for(const value of ['http://checkout.flutterwave.com/','https://checkout.flutterwave.com.evil.test/','https://flutterwave.com@evil.test/','https://evil.test/','javascript:alert(1)'])assert.throws(()=>normalizeCheckoutURL(value),value);
});

test('24-hour statuses disappear at expiry and regular posts never become statuses',()=>{
  const createdAt=Date.UTC(2026,9,4,12),expiresAt=createdAt+86400000;
  const rows=[{id:'status',kind:'status',createdAt,expiresAt},{id:'fallback',kind:'status',createdAt},{id:'post',kind:'post',createdAt,expiresAt},{id:'invalid',kind:'status',createdAt:'not a date'}];
  assert.deepEqual(activeSocialStatuses(rows,expiresAt-1).map(row=>row.id),['status','fallback']);
  assert.deepEqual(activeSocialStatuses(rows,expiresAt),[]);
});

test('social image markup accepts only actual supported image data URLs',()=>{
  assert.equal(safeSocialImage('data:image/png;base64,iVBORw0KGgo='),'data:image/png;base64,iVBORw0KGgo=');
  for(const value of ['data:image/svg+xml;base64,PHN2Zz4=','javascript:alert(1)','https://tracker.example/private','data:text/html;base64,PHNjcmlwdD4=','data:image/png;base64," onerror="alert(1)'])assert.equal(safeSocialImage(value),'');
});

test('phone server clock advances monotonically between changed bootstrap timestamps',()=>{
  let serverTime=100000,tick=10;
  const now=createAdvancingServerClock({getServerTime:()=>serverTime,monotonicNow:()=>tick,localNow:()=>{throw new Error('Browser wall time must not override a server timestamp');}});
  tick+=5000;assert.equal(now(),105000,'Time spent with the phone closed must still advance');
  assert.equal(now(),105000,'Repeated rendering must not reset the elapsed server clock');
  serverTime=200000;assert.equal(now(),200000);
  tick+=2500;assert.equal(now(),202500);
});

test('phone clock uses local time once only until a server timestamp arrives',()=>{
  let serverTime,tick=0,wallTime=800000,calls=0;
  const now=createAdvancingServerClock({getServerTime:()=>serverTime,monotonicNow:()=>tick,localNow:()=>{calls++;return wallTime;}});
  assert.equal(now(),800000);
  wallTime=999999999;tick=100;assert.equal(now(),800100);assert.equal(calls,1);
  serverTime=1000;assert.equal(now(),1000);
  tick=250;assert.equal(now(),1150);
});

test('phone status UI follows advancing server expiry despite an incorrect browser wall clock',async()=>{
  const createdAt=Date.UTC(2026,9,4,12),expiresAt=createdAt+86400000;
  let tick=0,serverTime=expiresAt-1000;
  const now=createAdvancingServerClock({getServerTime:()=>serverTime,monotonicNow:()=>tick,localNow:()=>expiresAt+86400000});
  const social=createPhoneSocial({getProfile:()=>({id:'clock-fixture'}),getNow:now,isPreview:()=>false,api:async path=>path.startsWith('/api/social/statuses')?{statuses:[{id:'status-fixture',userId:'clock-fixture',kind:'status',text:'Server-clock status fixture',createdAt,expiresAt}]}:{posts:[]},navigate(){},render(){},toast(){},esc:String,icon:()=>'',button:()=>'',headline:()=>'',portrait:()=>'',dateTime:String,makeRequestKey:()=> 'clock-fixture-key'});
  social.reset();await social.load();
  assert.match(social.markup('socialstatuses'),/Server-clock status fixture/);
  tick=999;assert.match(social.markup('socialstatuses'),/Server-clock status fixture/);
  tick=1000;assert.doesNotMatch(social.markup('socialstatuses'),/Server-clock status fixture/);
  serverTime=expiresAt-500;assert.match(social.markup('socialstatuses'),/Server-clock status fixture/,'A fresh authoritative server sample corrects client drift');
});

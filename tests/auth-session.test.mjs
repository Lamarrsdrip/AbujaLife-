import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticateAccount,finishOnboarding,accountErrorMessage,mergeCoreBootstrap} from '../app/auth-session.js';

const timeout=()=>new DOMException('Fetch is aborted','TimeoutError');
const session={authenticated:true,entry:true,profile:{id:'one',username:'ada',onboardingComplete:true,wallet:100000}};

test('entry refresh keeps hydrated social cards while committed core state updates',()=>{
 const current={...session,conversations:[{id:'dm-one',unread:2}],nearby:[{id:'private-guest'}],payments:{enabled:true},homeVisit:{owner:'old'}};
 const next={authenticated:true,entry:true,profile:{...session.profile,wallet:95000,location:{kind:'public'}},nearby:[],conversations:[],payments:null,homeVisit:null};
 const merged=mergeCoreBootstrap(current,next);
 assert.equal(merged.profile,next.profile);assert.equal(merged.homeVisit,null);assert.equal(merged.conversations,current.conversations);assert.equal(merged.payments,current.payments);assert.deepEqual(merged.nearby,[]);
});

test('entry refresh never carries private cards between accounts or anonymous state',()=>{
 const current={...session,conversations:[{id:'private-dm'}]};
 for(const next of [{authenticated:true,entry:true,profile:{id:'other'},conversations:[]},{authenticated:false,entry:true},{authenticated:true,profile:session.profile,conversations:[]}])assert.equal(mergeCoreBootstrap(current,next),next);
});

test('successful login consumes the playable entry returned by the canonical auth route',async()=>{
 const calls=[];let reads=0;
 const result=await authenticateAccount({mode:'login',credentials:{username:'ada',password:'private'},api:async(path,options)=>{calls.push({path,options});return{...session,ok:true,residentId:'one'};},readSession:async()=>{reads++;throw new Error('must not read session after a complete auth response');}});
 assert.equal(result.profile.id,'one');assert.equal(reads,0);assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/auth/login');assert.equal(Object.hasOwn(calls[0].options.body,'startup'),false);
});

test('successful registration uses the canonical route with no startup flags or compatibility suffixes',async()=>{
 const calls=[];
 const result=await authenticateAccount({mode:'register',credentials:{username:'ada',password:'private'},api:async(path,options)=>{calls.push({path,options});return{...session,ok:true,residentId:'one'};},readSession:async()=>{throw new Error('unexpected read');}});
 assert.equal(result.profile.id,'one');assert.equal(calls[0].path,'/api/auth/register');assert.equal(calls[0].path.includes('?session=1'),false);assert.equal(Object.hasOwn(calls[0].options.body,'startup'),false);
});

test('interrupted auth can recover only the same genuine resident session without replaying the write',async()=>{
 const writes=[];let reads=0;
 const result=await authenticateAccount({mode:'login',credentials:{username:'ada',password:'private'},api:async(path,options)=>{writes.push({path,options});throw timeout();},readSession:async()=>{reads++;return session;}});
 assert.equal(result,session);assert.equal(writes.length,1);assert.equal(reads,1);assert.equal(writes[0].path,'/api/auth/login');
 await assert.rejects(authenticateAccount({mode:'login',credentials:{username:'bello'},api:async()=>{throw timeout();},readSession:async()=>session}),{name:'TimeoutError'});
});

test('credential errors never fall back to an existing session',async()=>{
 let reads=0;const denied=Object.assign(new Error('Username or password is incorrect'),{status:401,code:'invalid_credentials'});
 await assert.rejects(authenticateAccount({mode:'login',credentials:{username:'ada'},api:async()=>{throw denied;},readSession:async()=>{reads++;return session;}}),error=>error===denied);
 assert.equal(reads,0);
});

test('auth response for another resident is rejected immediately',async()=>{
 await assert.rejects(authenticateAccount({mode:'login',credentials:{username:'ada'},api:async()=>({...session,profile:{...session.profile,id:'two',username:'bello'}}),readSession:async()=>session}),/could not be opened/);
});

test('committed onboarding returns its profile without startup flags or another blocking entry read',async()=>{
 let reads=0;
 const profile=await finishOnboarding({residentId:'one',draft:{displayName:'Ada'},api:async(path,options)=>{assert.equal(path,'/api/profile');assert.equal(Object.hasOwn(options.body,'startup'),false);return{profile:session.profile};},readSession:async()=>{reads++;throw timeout();}});
 assert.equal(profile,session.profile);assert.equal(reads,0);
});

test('lost onboarding response recovers only confirmed completion for the same resident',async()=>{
 let writes=0;const api=async()=>{writes++;throw timeout();};
 assert.equal(await finishOnboarding({residentId:'one',api,readSession:async()=>session}),session.profile);assert.equal(writes,1);
 await assert.rejects(finishOnboarding({residentId:'other',api,readSession:async()=>session}),{name:'TimeoutError'});
 await assert.rejects(finishOnboarding({residentId:'one',api,readSession:async()=>({...session,profile:{...session.profile,onboardingComplete:false}})}),{name:'TimeoutError'});
});

test('friendly errors distinguish interruption, bad credentials and unauthenticated state',()=>{
 assert.doesNotMatch(accountErrorMessage(timeout()),/Fetch is aborted/);
 assert.equal(accountErrorMessage({status:401}),'Please sign in again.');
 assert.equal(accountErrorMessage({status:401,code:'invalid_credentials',message:'Username or password is incorrect'}),'Username or password is incorrect');
 assert.equal(accountErrorMessage({status:403,message:'Account suspended'}),'Account suspended');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticateAccount,finishOnboarding,accountErrorMessage} from '../app/auth-session.js';

const timeout=()=>new DOMException('Fetch is aborted','TimeoutError');
const session={authenticated:true,profile:{id:'one',username:'ada',onboardingComplete:true,wallet:100000}};
test('lost signup response recovers its genuine session without repeating registration',async()=>{
 const writes=[];let reads=0;
 const result=await authenticateAccount({mode:'register',credentials:{username:'Ada',password:'private'},api:async(path,options)=>{writes.push({path,options});throw timeout();},readSession:async()=>{reads++;return session;}});
 assert.equal(result,session);assert.equal(writes.length,1);assert.equal(reads,1);assert.equal(writes[0].options.body.startup,true);
});
test('wrong credentials and another resident never masquerade as successful signup',async()=>{
 let reads=0;const denied=Object.assign(new Error('Wrong password'),{status:401});
 await assert.rejects(authenticateAccount({mode:'login',credentials:{username:'ada'},api:async()=>{throw denied;},readSession:async()=>{reads++;return session;}}),error=>error===denied);
 assert.equal(reads,0);
 await assert.rejects(authenticateAccount({mode:'register',credentials:{username:'bello'},api:async()=>{throw timeout();},readSession:async()=>session}),{name:'TimeoutError'});
});
test('committed onboarding renders its returned profile without another blocking bootstrap',async()=>{
 let reads=0;
 const profile=await finishOnboarding({residentId:'one',draft:{displayName:'Ada'},api:async(path,options)=>{assert.equal(path,'/api/profile');assert.equal(options.body.startup,true);return{profile:session.profile};},readSession:async()=>{reads++;throw timeout();}});
 assert.equal(profile,session.profile);assert.equal(reads,0);
});
test('lost onboarding response recovers only confirmed completion for the same resident',async()=>{
 let writes=0;const api=async()=>{writes++;throw timeout();};
 assert.equal(await finishOnboarding({residentId:'one',api,readSession:async()=>session}),session.profile);assert.equal(writes,1);
 await assert.rejects(finishOnboarding({residentId:'other',api,readSession:async()=>session}),{name:'TimeoutError'});
 await assert.rejects(finishOnboarding({residentId:'one',api,readSession:async()=>({...session,profile:{...session.profile,onboardingComplete:false}})}),{name:'TimeoutError'});
});
test('friendly errors distinguish a lost connection from an expired session',()=>{
 assert.doesNotMatch(accountErrorMessage(timeout()),/Fetch is aborted/);
 assert.match(accountErrorMessage({status:401}),/sign in again/);
 assert.equal(accountErrorMessage({status:403,message:'Account suspended'}),'Account suspended');
});

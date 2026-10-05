import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUsernameOnlyAuth } from '../src/server/authPolicy.mjs';

test('production username-only policy strips email and disables email/link auth', async () => {
  const calls=[];
  const auth={
    credentials(input){calls.push(['credentials',input]);return input;},
    async login(input){calls.push(['login',input]);return input;},
  };
  applyUsernameOnlyAuth(auth);
  const registered=auth.credentials({username:'resident_abuja',displayName:'Resident',password:'password123',email:'resident@example.com'});
  assert.equal(registered.email,undefined);
  assert.equal(registered.username,'resident_abuja');
  const login=await auth.login({username:'resident_abuja',password:'password123',email:'resident@example.com'});
  assert.deepEqual(login,{username:'resident_abuja',password:'password123'});
  assert.throws(()=>auth.login({username:'resident@example.com',password:'password123'}),error=>error.code==='invalid_credentials'&&error.status===401);
  assert.throws(()=>auth.login({email:'resident@example.com',password:'password123'}),error=>error.code==='invalid_credentials'&&error.status===401);
  assert.deepEqual(auth.configuration(),{ok:true,emailVerificationEnabled:false,passwordResetEnabled:false,usernameOnly:true});
  for(const action of ['requestEmailVerification','verifyEmail','emailStatus','requestPasswordReset','completePasswordReset'])assert.throws(()=>auth[action]({}),error=>error.code==='email_auth_disabled');
  assert.equal(calls.filter(([kind])=>kind==='login').length,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionServer } from '../src/server/production-http.mjs';

function server(env){
  const store={db:{collection:()=>({})}},social={collection:()=>({}),messageEvent:row=>row};
  return createProductionServer({store,social,directory:{},admin:{},payments:{},rewards:{},database:{},corsOrigins:['https://abujacity.life'],publicWebUrl:'https://abujacity.life',env,log:()=>{}});
}

test('production chat honors the supplied environment rather than inheriting development storage',()=>{
  const api=server({NODE_ENV:'production'});
  try{assert.equal(api.sessionRuntime.chatPro.mediaConfiguration().configured,false);}
  finally{api.closeRealtime();}
});

test('production startup refuses release-relative media from the supplied environment',()=>{
  assert.throws(()=>server({NODE_ENV:'production',CHAT_MEDIA_DIR:'C:\\services\\abujalife\\releases\\candidate\\.local\\chat-media'}),/outside versioned release/);
});

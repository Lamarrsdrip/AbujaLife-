import { pathToFileURL } from 'node:url';
import { connectMongo } from './mongo/database.mjs';
import { MongoGameStore } from './mongo/gameStore.mjs';
import { MongoSocialStore } from './mongo/socialStore.mjs';
import { MongoDirectoryStore } from './mongo/directoryStore.mjs';
import { MongoPresenceStore } from './mongo/presenceStore.mjs';
import { MongoAdminStore } from './mongo/adminStore.mjs';
import { MongoPaymentStore } from './mongo/paymentStore.mjs';
import { MongoAuthStore } from './mongo/authStore.mjs';
import { createEmailDelivery } from './emailDelivery.mjs';
import { createProductionServer, productionLog } from './production-http.mjs';

function publicOrigin(value,name){let url;try{url=new URL(value);}catch{throw new Error(`${name} requires a public HTTPS origin`);}if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||/^(localhost|127\.|0\.|\[?::1\]?$)/i.test(url.hostname))throw new Error(`${name} requires a public HTTPS origin`);return url.origin;}
export function productionConfig(env=process.env){
  if(env.NODE_ENV!=='production')throw new Error('NODE_ENV must be production for this entrypoint');
  if(!env.MONGODB_URI)throw new Error('MONGODB_URI is required; production has no SQLite fallback');
  if(env.MONGODB_DATABASE!=='abujalife_prod')throw new Error('MONGODB_DATABASE must be abujalife_prod');
  const publicWebUrl=publicOrigin(env.PUBLIC_WEB_URL,'PUBLIC_WEB_URL'),apiPublicUrl=publicOrigin(env.API_PUBLIC_URL,'API_PUBLIC_URL');
  const corsOrigins=(env.CORS_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean).map(v=>publicOrigin(v,'CORS_ORIGINS'));
  if(!corsOrigins.includes(publicWebUrl))throw new Error('CORS_ORIGINS must include PUBLIC_WEB_URL');
  const port=Number(env.PORT||3000);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PORT must be an unprivileged valid port');
  const host=env.HOST||'127.0.0.1';if(!['127.0.0.1','::1','0.0.0.0'].includes(host))throw new Error('HOST must be a loopback address or the explicit private container listener');
  return{uri:env.MONGODB_URI,database:env.MONGODB_DATABASE,port,host,publicWebUrl,apiPublicUrl,corsOrigins,trustProxy:env.TRUST_PROXY==='1',configKey:env.ABUJALIFE_CONFIG_KEY,adminUsername:env.ABUJALIFE_ADMIN_USERNAME||''};
}
export async function createProductionApplication({env=process.env,clock=Date.now,originRandomInt,fetchImpl=fetch,log=productionLog,database:providedDatabase}={}){
  const config=productionConfig(env),database=providedDatabase||await connectMongo({uri:config.uri,database:config.database,production:true});
  try{
    const delivery=createEmailDelivery({env,publicWebUrl:config.publicWebUrl,fetchImpl,log});
    const auth=new MongoAuthStore({client:database.client,db:database.db,clock,...delivery});
    const store=new MongoGameStore({client:database.client,db:database.db,clock,originRandomInt,production:true,auth});
    const social=new MongoSocialStore(store);await social.init({ensureIndexes:false});social.attachToGame();
    const directory=new MongoDirectoryStore(store,social);
    const presence=new MongoPresenceStore(store,social);await presence.init({ensureIndexes:false});
    const admin=new MongoAdminStore({store,bootstrapUsername:config.adminUsername});await admin.init({ensureIndexes:false});
    social.authorizeModeration=id=>admin.requirePermission(id,'moderation');
    const payments=new MongoPaymentStore({store,admin,fetchImpl,configKey:config.configKey,publicOrigin:config.publicWebUrl,log});await payments.init({ensureIndexes:false});
    const server=createProductionServer({...config,store,social,directory,presence,admin,payments,database,log});
    return{server,store,social,directory,presence,admin,payments,database,config,close:async()=>{server.closeRealtime();if(server.listening)await new Promise(resolve=>server.close(resolve));await database.close();}};
  }catch(error){await database.close();throw error;}
}
export async function startProduction(){
  let app;try{app=await createProductionApplication();await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(app.config.port,app.config.host,resolve);});productionLog('startup',{port:app.config.port,storage:'mongodb',database:'abujalife_prod',emailConfigured:app.store.auth.configuration().emailVerificationEnabled});}catch(error){productionLog('startup_failure',{code:error.code||'configuration_or_database_error'});if(app)await app.close();process.exitCode=1;return;}
  let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{if(stopping)return;stopping=true;productionLog('shutdown',{signal});const timeout=setTimeout(()=>{productionLog('shutdown_timeout');process.exit(1);},10000);timeout.unref();try{await app.close();clearTimeout(timeout);process.exitCode=0;}catch{productionLog('shutdown_failure');process.exitCode=1;}});
  process.on('uncaughtException',()=>{productionLog('crash',{code:'uncaught_exception'});process.exit(1);});process.on('unhandledRejection',()=>{productionLog('crash',{code:'unhandled_rejection'});process.exit(1);});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await startProduction();

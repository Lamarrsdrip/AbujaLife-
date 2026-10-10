import '../src/shared/abuja-landmarks-2026.mjs';
import crypto from 'node:crypto';
import { createServer } from '../src/server/http.mjs';
import { attachXIntegration } from '../src/server/xIntegration.mjs';
import { attachCivicRuntime } from '../src/server/civicRuntime.mjs';
const port=Number(process.env.PORT||8787);
const localOrigin=`http://localhost:${port}`;
const loopbackOrigin=`http://127.0.0.1:${port}`;
const localOrigins=[localOrigin,loopbackOrigin];
const qaClockHour=Number(process.env.ABUJALIFE_QA_CLOCK_HOUR_WAT);
let clock=Date.now;
if(Number.isInteger(qaClockHour)&&qaClockHour>=0&&qaClockHour<=23){
  const now=Date.now(),wat=new Date(now+3600000),target=Date.UTC(wat.getUTCFullYear(),wat.getUTCMonth(),wat.getUTCDate(),qaClockHour-1,0,0,0),offset=target-now;
  clock=()=>Date.now()+offset;
}
// Browser gates that need a known starting life pin the origin draw; everyone else gets the real random one.
const qaOrigin=['nepo','lapo'].indexOf(process.env.ABUJALIFE_QA_ORIGIN);
const originRandomInt=qaOrigin<0?undefined:(min,max)=>min===0&&max===2?qaOrigin:crypto.randomInt(min,max);
const server=createServer({production:process.argv.includes('--prod'),publicWebUrl:localOrigin,corsOrigins:localOrigins,clock,...(originRandomInt?{originRandomInt}:{})});
attachXIntegration(server,{store:server.store,env:process.env,publicWebUrl:process.env.PUBLIC_WEB_URL||localOrigin,apiPublicUrl:process.env.API_PUBLIC_URL||localOrigin,corsOrigins:process.env.PUBLIC_WEB_URL?[process.env.PUBLIC_WEB_URL]:localOrigins,fetchImpl:fetch});
await attachCivicRuntime(server,{store:server.store,admin:server.admin,publicWebUrl:localOrigin,corsOrigins:localOrigins,log:(event,data)=>console.warn(`[civic] ${event}`,data)});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Choose another PORT or stop the AbujaLife process using it.`:error.message);server.store.close();process.exit(1);});
server.listen(port,'0.0.0.0',()=>console.log(`AbujaLife → http://localhost:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.closeRealtime();server.close(()=>process.exit(0));});
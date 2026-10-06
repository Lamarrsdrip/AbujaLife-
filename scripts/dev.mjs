import { createServer } from '../src/server/http.mjs';
import { attachCoreEntry } from '../src/server/coreEntry.mjs';
import { attachXIntegration } from '../src/server/xIntegration.mjs';
const port = Number(process.env.PORT || 8787);
const server = createServer({production:process.argv.includes('--prod')});
const localOrigin=`http://localhost:${port}`;
attachCoreEntry(server,{store:server.store,admin:server.admin,corsOrigins:[localOrigin],publicWebUrl:localOrigin,secureCookies:false});
attachXIntegration(server,{store:server.store,env:process.env,publicWebUrl:process.env.PUBLIC_WEB_URL||localOrigin,apiPublicUrl:process.env.API_PUBLIC_URL||localOrigin,corsOrigins:[process.env.PUBLIC_WEB_URL||localOrigin],fetchImpl:fetch});
server.on('error',error=>{
  console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Choose another PORT or stop the AbujaLife process using it.`:error.message);
  server.store.close();
  process.exit(1);
});
server.listen(port,'0.0.0.0',()=>console.log(`AbujaLife → http://localhost:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
  server.closeRealtime();
  server.close(()=>process.exit(0));
});
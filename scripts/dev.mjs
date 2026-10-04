import { createServer } from '../src/server/http.mjs';
const port = Number(process.env.PORT || 8787);
const server = createServer({production:process.argv.includes('--prod')});
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

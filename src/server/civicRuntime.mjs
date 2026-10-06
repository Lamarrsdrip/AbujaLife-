import { CivicIntegrationV2 } from './civicIntegration-v2.mjs';
import { GameError } from './errors.mjs';

const json=(res,status,body)=>{if(!res.writableEnded){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));}};

export async function attachCivicRuntime(server,options={}){
  const civic=await new CivicIntegrationV2(options).init();
  const listeners=server.listeners('request');
  if(!listeners.length)throw new Error('Cannot attach Civic Life before the HTTP handler exists');
  server.removeAllListeners('request');
  server.on('request',(req,res)=>{
    let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{}
    if(pathname.startsWith('/api/civic/')){void civic.handle(req,res).catch(error=>{const status=error instanceof GameError?error.status:500;options.log?.('civic_runtime_error',{status,code:error.code||'internal_error'});if(!res.headersSent)json(res,status,{ok:false,error:error instanceof GameError?error.message:'Something went wrong. Please try again.',code:error.code||'server_error'});else res.end();});return;}
    for(const listener of listeners)listener.call(server,req,res);
  });
  server.civicIntegration=civic;
  return civic;
}

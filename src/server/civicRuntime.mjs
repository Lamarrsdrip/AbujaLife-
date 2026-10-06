import { CivicIntegrationV2 } from './civicIntegration-v2.mjs';
import { CIVIC_META } from '../shared/civic-life.mjs';
import { GameError } from './errors.mjs';

const json=(res,status,body)=>{if(!res.writableEnded){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));}};

async function termsWon(civic,residentId){
  if(civic.mongo)return civic.c('civic_governments').countDocuments({winnerId:residentId});
  const row=civic.store.get('SELECT count(*) terms FROM civic_governments WHERE winner_id=?',residentId);
  return Number(row?.terms||0);
}

function enforceTermLimit(civic){
  const originalState=civic.state.bind(civic),originalNominate=civic.nominate.bind(civic);
  civic.state=async residentId=>{
    const [state,terms]=await Promise.all([originalState(residentId),termsWon(civic,residentId)]);
    const termLimitReached=terms>=CIVIC_META.termLimit;
    return{...state,resident:{...state.resident,termsWon:terms},eligibility:{...state.eligibility,termLimit:CIVIC_META.termLimit,termsWon:terms,termLimitReached,nominationOpen:Boolean(state.eligibility?.nominationOpen&&!termLimitReached)}};
  };
  civic.nominate=async(residentId,body)=>{
    const terms=await termsWon(civic,residentId);
    if(terms>=CIVIC_META.termLimit)throw new GameError(`You have completed the AbujaLife presidential limit of ${CIVIC_META.termLimit} terms`,409,'presidential_term_limit');
    return originalNominate(residentId,body);
  };
  return civic;
}

export async function attachCivicRuntime(server,options={}){
  const civic=enforceTermLimit(await new CivicIntegrationV2(options).init());
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

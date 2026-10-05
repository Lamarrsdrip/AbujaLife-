import crypto from 'node:crypto';

export const X_OAUTH_SCOPES = Object.freeze([
  'tweet.read','tweet.write','users.read','follows.read','follows.write',
  'like.read','like.write','bookmark.read','bookmark.write','offline.access'
]);

const X_API='https://api.x.com/2';
const X_AUTHORIZE='https://x.com/i/oauth2/authorize';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const TOKEN_COOKIE='abujalife_session=';

const base64url=value=>Buffer.from(value).toString('base64url');
const randomToken=(bytes=32)=>base64url(crypto.randomBytes(bytes));
const sha256=value=>crypto.createHash('sha256').update(value).digest();
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function xAuthorizeURL({clientId,redirectUri,state,verifier,scopes=X_OAUTH_SCOPES}){
  const challenge=base64url(sha256(verifier));
  const url=new URL(X_AUTHORIZE);
  url.searchParams.set('response_type','code');
  url.searchParams.set('client_id',clientId);
  url.searchParams.set('redirect_uri',redirectUri);
  url.searchParams.set('scope',scopes.join(' '));
  url.searchParams.set('state',state);
  url.searchParams.set('code_challenge',challenge);
  url.searchParams.set('code_challenge_method','S256');
  return url.href;
}

function tokenFor(req){
  const bearer=/^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(req.headers.authorization||'');
  if(bearer)return bearer[1];
  return(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(TOKEN_COOKIE))?.slice(TOKEN_COOKIE.length)||null;
}
function json(res,status,body,extra={}){if(res.writableEnded)return;res.writeHead(status,{...JSON_HEADERS,...extra});res.end(JSON.stringify(body));}
function html(res,status,body){if(res.writableEnded)return;res.writeHead(status,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});res.end(body);}
async function readJSON(req,max=32768){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>max)throw Object.assign(new Error('Request body is too large'),{status:413});parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{throw Object.assign(new Error('Send valid JSON'),{status:400});}}
function normalizedOrigin(value){try{return new URL(value).origin;}catch{return '';}}
function validID(value){return /^[0-9]{1,32}$/.test(String(value||''));}

function cryptoBox(secret){
  if(!secret)return null;
  const key=sha256(secret);
  return{
    seal(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return Buffer.concat([iv,tag,ciphertext]).toString('base64url');},
    open(value){const raw=Buffer.from(String(value||''),'base64url');if(raw.length<29)throw new Error('Invalid encrypted X connection');const iv=raw.subarray(0,12),tag=raw.subarray(12,28),ciphertext=raw.subarray(28),decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8'));}
  };
}

function connectionStore({database,secret}){
  const memory=new Map(),box=cryptoBox(secret),collection=database?.db?.collection?.('x_connections');
  return{
    persistent:!!(collection&&box),
    async get(id){if(collection&&box){const row=await collection.findOne({_id:String(id)});if(!row?.sealed)return null;try{return box.open(row.sealed);}catch{return null;}}return memory.get(String(id))||null;},
    async set(id,value){if(collection&&box){await collection.updateOne({_id:String(id)},{$set:{sealed:box.seal(value),updatedAt:new Date()}},{upsert:true});return;}memory.set(String(id),value);},
    async delete(id){if(collection&&box)await collection.deleteOne({_id:String(id)});memory.delete(String(id));}
  };
}

async function fetchJSON(fetchImpl,url,options={}){
  const response=await fetchImpl(url,{...options,signal:options.signal||AbortSignal.timeout(20000)});
  const text=await response.text();let body={};try{body=text?JSON.parse(text):{};}catch{body={detail:text||`X returned HTTP ${response.status}`};}
  if(!response.ok){const message=body.detail||body.title||body.error_description||body.error||`X returned HTTP ${response.status}`;const error=Object.assign(new Error(message),{status:response.status,xBody:body});throw error;}
  return body;
}

export function createXIntegration({store,database,env=process.env,publicWebUrl,apiPublicUrl,fetchImpl=fetch,corsOrigins=[]}={}){
  if(!store)throw new Error('X integration requires the AbujaLife store');
  const clientId=String(env.X_CLIENT_ID||'').trim(),clientSecret=String(env.X_CLIENT_SECRET||'').trim();
  const callback=String(env.X_REDIRECT_URI||`${String(apiPublicUrl||'').replace(/\/$/,'')}/api/x/callback`).trim();
  const encryptionSecret=String(env.X_TOKEN_ENCRYPTION_KEY||env.ABUJALIFE_CONFIG_KEY||'').trim();
  const production=!!database;
  const configured=!!(clientId&&clientSecret&&callback&&(!production||encryptionSecret));
  const connections=connectionStore({database,secret:encryptionSecret});
  const states=new Map(),allowedOrigins=new Set([normalizedOrigin(publicWebUrl),...corsOrigins.map(normalizedOrigin)].filter(Boolean));

  async function resident(req){const token=tokenFor(req);return token?await store.session(token):null;}
  function cors(req,res){const origin=req.headers.origin;if(!origin)return true;if(!allowedOrigins.size||!allowedOrigins.has(normalizedOrigin(origin))){json(res,403,{ok:false,error:'This origin is not permitted'});return false;}res.setHeader('access-control-allow-origin',origin);res.setHeader('access-control-allow-credentials','true');res.setHeader('vary','Origin');return true;}
  function ensureConfigured(){if(!configured){const error=new Error(production&&!encryptionSecret?'X connection is waiting for X_TOKEN_ENCRYPTION_KEY.':'X connection is not configured yet.');error.status=503;throw error;}}
  async function requireResident(req){const id=await resident(req);if(!id)throw Object.assign(new Error('Sign in to connect X'),{status:401});return id;}
  async function tokenExchange(params){ensureConfigured();const body=new URLSearchParams(params);body.set('client_id',clientId);return fetchJSON(fetchImpl,`${X_API}/oauth2/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','authorization':`Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`},body});}
  async function refresh(id,connection){if(!connection?.refreshToken)throw Object.assign(new Error('Reconnect X to continue'),{status:401});const token=await tokenExchange({grant_type:'refresh_token',refresh_token:connection.refreshToken});const next={...connection,accessToken:token.access_token,refreshToken:token.refresh_token||connection.refreshToken,scope:token.scope||connection.scope,expiresAt:Date.now()+(Number(token.expires_in)||7200)*1000};await connections.set(id,next);return next;}
  async function connectionFor(id){let connection=await connections.get(id);if(!connection)throw Object.assign(new Error('Connect your X account first'),{status:401,code:'x_not_connected'});if(connection.expiresAt&&connection.expiresAt<Date.now()+60000)connection=await refresh(id,connection);return connection;}
  async function api(id,path,{method='GET',body}={}){
    let connection=await connectionFor(id);
    const request=async()=>fetchJSON(fetchImpl,`${X_API}${path}`,{method,headers:{authorization:`Bearer ${connection.accessToken}`,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    try{return await request();}catch(error){if(error.status!==401||!connection.refreshToken)throw error;connection=await refresh(id,connection);return request();}
  }
  async function me(id){const result=await api(id,'/users/me?user.fields=id,name,username,profile_image_url,verified,description,public_metrics');return result.data||null;}
  async function status(id){if(!configured)return{ok:true,enabled:false,connected:false,reason:production&&!encryptionSecret?'secure_token_key_missing':'credentials_missing'};const connection=await connections.get(id);if(!connection)return{ok:true,enabled:true,connected:false};try{const user=await me(id);if(user){connection.user=user;await connections.set(id,connection);}return{ok:true,enabled:true,connected:true,user:user||connection.user||null,scopes:String(connection.scope||'').split(' ').filter(Boolean)};}catch(error){if(error.status===401)return{ok:true,enabled:true,connected:false};throw error;}}
  async function connect(id){ensureConfigured();const state=randomToken(28),verifier=randomToken(48);states.set(state,{residentId:String(id),verifier,createdAt:Date.now()});for(const[key,value]of states)if(Date.now()-value.createdAt>10*60*1000)states.delete(key);return{ok:true,authorizeUrl:xAuthorizeURL({clientId,redirectUri:callback,state,verifier})};}
  async function callbackRequest(url){ensureConfigured();const code=url.searchParams.get('code'),state=url.searchParams.get('state'),oauthError=url.searchParams.get('error');const pending=state&&states.get(state);if(oauthError)throw Object.assign(new Error(url.searchParams.get('error_description')||oauthError),{status:400});if(!code||!pending)throw Object.assign(new Error('This X connection request expired. Start again from AbujaLife.'),{status:400});states.delete(state);const token=await tokenExchange({grant_type:'authorization_code',code,redirect_uri:callback,code_verifier:pending.verifier});const connection={accessToken:token.access_token,refreshToken:token.refresh_token||'',scope:token.scope||X_OAUTH_SCOPES.join(' '),expiresAt:Date.now()+(Number(token.expires_in)||7200)*1000,connectedAt:Date.now()};await connections.set(pending.residentId,connection);connection.user=await me(pending.residentId);await connections.set(pending.residentId,connection);return connection.user;}
  async function timeline(id,url){const kind=url.searchParams.get('kind')||'home',user=(await connectionFor(id)).user||await me(id);if(!user?.id)throw Object.assign(new Error('X profile unavailable'),{status:502});const common='max_results=25&tweet.fields=id,text,created_at,author_id,public_metrics,conversation_id,attachments&expansions=author_id&user.fields=id,name,username,profile_image_url,verified';let path;if(kind==='mentions')path=`/users/${user.id}/mentions?${common}`;else if(kind==='bookmarks')path=`/users/${user.id}/bookmarks?${common}`;else if(kind==='search'){const q=String(url.searchParams.get('q')||'').trim();if(!q)throw Object.assign(new Error('Enter something to search on X'),{status:400});path=`/tweets/search/recent?query=${encodeURIComponent(q)}&${common}`;}else path=`/users/${user.id}/timelines/reverse_chronological?${common}`;const result=await api(id,path);return{ok:true,kind,items:result.data||[],includes:result.includes||{},meta:result.meta||{}};}
  async function mutate(id,pathname,body){const connection=await connectionFor(id),user=connection.user||await me(id);if(!user?.id)throw Object.assign(new Error('X profile unavailable'),{status:502});
    if(pathname==='/api/x/post'){const text=String(body.text||'').trim();if(!text)throw Object.assign(new Error('Write something first'),{status:400});const payload={text};if(body.replyTo&&validID(body.replyTo))payload.reply={in_reply_to_tweet_id:String(body.replyTo)};return{ok:true,result:await api(id,'/tweets',{method:'POST',body:payload})};}
    const tweetId=String(body.tweetId||'');
    if(pathname==='/api/x/like'){if(!validID(tweetId))throw Object.assign(new Error('Choose a valid X post'),{status:400});return{ok:true,result:await api(id,body.active===false?`/users/${user.id}/likes/${tweetId}`:`/users/${user.id}/likes`,{method:body.active===false?'DELETE':'POST',...(body.active===false?{}:{body:{tweet_id:tweetId}})})};}
    if(pathname==='/api/x/repost'){if(!validID(tweetId))throw Object.assign(new Error('Choose a valid X post'),{status:400});return{ok:true,result:await api(id,body.active===false?`/users/${user.id}/retweets/${tweetId}`:`/users/${user.id}/retweets`,{method:body.active===false?'DELETE':'POST',...(body.active===false?{}:{body:{tweet_id:tweetId}})})};}
    if(pathname==='/api/x/bookmark'){if(!validID(tweetId))throw Object.assign(new Error('Choose a valid X post'),{status:400});return{ok:true,result:await api(id,body.active===false?`/users/${user.id}/bookmarks/${tweetId}`:`/users/${user.id}/bookmarks`,{method:body.active===false?'DELETE':'POST',...(body.active===false?{}:{body:{tweet_id:tweetId}})})};}
    if(pathname==='/api/x/follow'){const target=String(body.userId||'');if(!validID(target))throw Object.assign(new Error('Choose a valid X account'),{status:400});return{ok:true,result:await api(id,body.active===false?`/users/${user.id}/following/${target}`:`/users/${user.id}/following`,{method:body.active===false?'DELETE':'POST',...(body.active===false?{}:{body:{target_user_id:target}})})};}
    throw Object.assign(new Error('Unknown X action'),{status:404});
  }
  async function disconnect(id){const connection=await connections.get(id);if(connection?.accessToken&&configured){try{const body=new URLSearchParams({token:connection.accessToken,token_type_hint:'access_token',client_id:clientId});await fetchImpl(`${X_API}/oauth2/revoke`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','authorization':`Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`},body,signal:AbortSignal.timeout(8000)});}catch{}}
    await connections.delete(id);return{ok:true,connected:false};}

  async function handle(req,res){
    const url=new URL(req.url,'https://api.abujacity.life'),pathname=url.pathname;if(!pathname.startsWith('/api/x/'))return false;
    try{
      if(!cors(req,res))return true;
      if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization','access-control-max-age':'600','cache-control':'no-store'});res.end();return true;}
      if(pathname==='/api/x/callback'&&req.method==='GET'){
        try{const user=await callbackRequest(url),target=JSON.stringify(normalizedOrigin(publicWebUrl));const back=`${String(publicWebUrl||'/').replace(/\/$/,'')}/?x=connected`;return html(res,200,`<!doctype html><meta charset="utf-8"><title>X connected · AbujaLife</title><style>body{font-family:system-ui;background:#08130e;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}.c{max-width:420px;padding:32px;text-align:center}.b{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:999px;background:#fff;color:#111;text-decoration:none}</style><div class="c"><h1>X connected</h1><p>${escapeHTML(user?.name||user?.username||'Your account')} is ready inside AbujaLife.</p><a class="b" href="${escapeHTML(back)}">Return to AbujaLife</a></div><script>try{window.opener&&window.opener.postMessage({type:'abujalife:x-connected'},${target});setTimeout(()=>window.close(),350)}catch{}</script>`);}catch(error){const back=`${String(publicWebUrl||'/').replace(/\/$/,'')}/?x=error`;return html(res,error.status||400,`<!doctype html><meta charset="utf-8"><title>X connection failed · AbujaLife</title><style>body{font-family:system-ui;background:#19100d;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}.c{max-width:440px;padding:32px;text-align:center}.b{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:999px;background:#fff;color:#111;text-decoration:none}</style><div class="c"><h1>Could not connect X</h1><p>${escapeHTML(error.message)}</p><a class="b" href="${escapeHTML(back)}">Back to AbujaLife</a></div>`);}
      }
      const id=await requireResident(req);
      if(pathname==='/api/x/status'&&req.method==='GET')return json(res,200,await status(id)),true;
      if(pathname==='/api/x/connect'&&req.method==='POST'){await readJSON(req);return json(res,200,await connect(id)),true;}
      if(pathname==='/api/x/timeline'&&req.method==='GET')return json(res,200,await timeline(id,url)),true;
      if(pathname==='/api/x/disconnect'&&req.method==='POST'){await readJSON(req);return json(res,200,await disconnect(id)),true;}
      if(['/api/x/post','/api/x/like','/api/x/repost','/api/x/bookmark','/api/x/follow'].includes(pathname)&&req.method==='POST')return json(res,200,await mutate(id,pathname,await readJSON(req))),true;
      json(res,405,{ok:false,error:'This X action is not available'});return true;
    }catch(error){json(res,error.status||502,{ok:false,error:error.message||'X is unavailable right now',code:error.code||'x_request_failed',details:error.xBody?.errors||undefined});return true;}
  }
  return{configured,persistent:connections.persistent,handle,status,connect};
}

export function attachXIntegration(server,options={}){
  const integration=createXIntegration(options),listeners=server.listeners('request');
  if(!listeners.length)throw new Error('Cannot attach X integration before the HTTP request handler exists');
  server.removeAllListeners('request');
  server.on('request',(req,res)=>{
    let pathname='';try{pathname=new URL(req.url,'https://api.abujacity.life').pathname;}catch{}
    if(pathname.startsWith('/api/x/')){void integration.handle(req,res);return;}
    for(const listener of listeners)listener.call(server,req,res);
  });
  server.xIntegration=integration;
  return integration;
}

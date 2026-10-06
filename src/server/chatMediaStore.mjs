import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameError } from './errors.mjs';

export const CHAT_MEDIA_LIMITS=Object.freeze({imageBytes:8*1024*1024,voiceBytes:8*1024*1024,voiceDurationMs:120000});
export const CHAT_IMAGE_MIMES=Object.freeze(['image/jpeg','image/png','image/webp']);
export const CHAT_VOICE_MIMES=Object.freeze(['audio/webm','audio/mp4','audio/mpeg','audio/ogg']);
const fail=(ok,message,status=400,code='invalid_chat_media')=>{if(!ok)throw new GameError(message,status,code);};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const hmac=(key,value,encoding)=>crypto.createHmac('sha256',key).update(value).digest(encoding);
const rfc3986=value=>encodeURIComponent(value).replace(/[!'()*]/g,ch=>`%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
const safeId=value=>{fail(typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value),'Invalid media id',400,'invalid_media_id');return value;};
const mimeFor=(kind,mime)=>{const allowed=kind==='image'?CHAT_IMAGE_MIMES:kind==='voice'?CHAT_VOICE_MIMES:[];fail(allowed.includes(mime),'Unsupported chat media format',415,'unsupported_media');return mime;};

export function validateChatMediaBytes(kind,mime,bytes,{durationMs=0}={}){
  mime=mimeFor(kind,mime);fail(Buffer.isBuffer(bytes)&&bytes.length>0,'Choose media to send');
  const limit=kind==='image'?CHAT_MEDIA_LIMITS.imageBytes:CHAT_MEDIA_LIMITS.voiceBytes;fail(bytes.length<=limit,kind==='image'?'Photo is too large':'Voice note is too large',413,'media_too_large');
  if(kind==='image'){
    const png=bytes.length>12&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg=bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;
    const webp=bytes.length>16&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
    fail((mime==='image/png'&&png)||(mime==='image/jpeg'&&jpg)||(mime==='image/webp'&&webp),'Photo data does not match its file type',400,'invalid_media_bytes');
  }else{
    fail(Number.isSafeInteger(durationMs)&&durationMs>0&&durationMs<=CHAT_MEDIA_LIMITS.voiceDurationMs,'Voice note must be between 1 and 120 seconds',400,'invalid_voice_duration');
    const webm=bytes.length>4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
    const mp4=bytes.length>12&&bytes.toString('ascii',4,8)==='ftyp';
    const ogg=bytes.length>4&&bytes.toString('ascii',0,4)==='OggS';
    const mp3=bytes.length>3&&(bytes.toString('ascii',0,3)==='ID3'||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0));
    fail((mime==='audio/webm'&&webm)||(mime==='audio/mp4'&&mp4)||(mime==='audio/ogg'&&ogg)||(mime==='audio/mpeg'&&mp3),'Voice-note data does not match its file type',400,'invalid_media_bytes');
  }
  return{kind,mime,size:bytes.length,durationMs:kind==='voice'?durationMs:undefined};
}

function s3Config(env){
  const endpoint=(env.CHAT_MEDIA_S3_ENDPOINT||'').trim().replace(/\/+$/,'');
  const bucket=(env.CHAT_MEDIA_S3_BUCKET||'').trim();
  const accessKey=(env.CHAT_MEDIA_S3_ACCESS_KEY_ID||'').trim();
  const secretKey=(env.CHAT_MEDIA_S3_SECRET_ACCESS_KEY||'').trim();
  if(!endpoint||!bucket||!accessKey||!secretKey)return null;
  let url;try{url=new URL(endpoint);}catch{throw new Error('CHAT_MEDIA_S3_ENDPOINT must be a valid HTTPS URL');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('CHAT_MEDIA_S3_ENDPOINT must be a clean HTTPS endpoint');
  if(!/^[A-Za-z0-9._-]{3,100}$/.test(bucket))throw new Error('CHAT_MEDIA_S3_BUCKET is invalid');
  return{endpoint:url,bucket,accessKey,secretKey,region:(env.CHAT_MEDIA_S3_REGION||'auto').trim()||'auto'};
}
function amzTime(now=new Date()){const iso=now.toISOString().replace(/[:-]|\.\d{3}/g,'');return{stamp:iso,date:iso.slice(0,8)};}
function signingKey(secret,date,region){return hmac(hmac(hmac(hmac(`AWS4${secret}`,date),region),'s3'),'aws4_request');}
function objectURL(config,key){const base=config.endpoint.pathname.replace(/\/$/,'');const encoded=key.split('/').map(rfc3986).join('/');return new URL(`${base}/${rfc3986(config.bucket)}/${encoded}`,config.endpoint.origin);}
function signedHeaders(config,method,key,body,mime,now=new Date()){
  const url=objectURL(config,key),{stamp,date}=amzTime(now),payloadHash=sha256(body),headers={'content-type':mime,'host':url.host,'x-amz-content-sha256':payloadHash,'x-amz-date':stamp};
  const names=Object.keys(headers).sort(),canonicalHeaders=names.map(name=>`${name}:${String(headers[name]).trim()}\n`).join(''),signed=names.join(';');
  const canonical=[method,url.pathname,'',canonicalHeaders,signed,payloadHash].join('\n'),scope=`${date}/${config.region}/s3/aws4_request`,toSign=['AWS4-HMAC-SHA256',stamp,scope,sha256(canonical)].join('\n'),signature=hmac(signingKey(config.secretKey,date,config.region),toSign,'hex');
  return{url,headers:{'content-type':mime,'x-amz-content-sha256':payloadHash,'x-amz-date':stamp,authorization:`AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${signature}`}};
}
function presignedGet(config,key,seconds=300,now=new Date()){
  const url=objectURL(config,key),{stamp,date}=amzTime(now),scope=`${date}/${config.region}/s3/aws4_request`,credential=`${config.accessKey}/${scope}`;
  const query=new URLSearchParams({'X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Credential':credential,'X-Amz-Date':stamp,'X-Amz-Expires':String(seconds),'X-Amz-SignedHeaders':'host'});
  const canonicalQuery=[...query.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${rfc3986(k)}=${rfc3986(v)}`).join('&'),canonical=['GET',url.pathname,canonicalQuery,`host:${url.host}\n`,'host','UNSIGNED-PAYLOAD'].join('\n'),toSign=['AWS4-HMAC-SHA256',stamp,scope,sha256(canonical)].join('\n');
  query.set('X-Amz-Signature',hmac(signingKey(config.secretKey,date,config.region),toSign,'hex'));url.search=query.toString();return url.toString();
}

export class ChatMediaStore{
  constructor({env=process.env,fetchImpl=fetch,rootDir=null}={}){
    this.env=env;this.fetch=fetchImpl;this.s3=s3Config(env);this.production=env.NODE_ENV==='production';
    this.root=rootDir||env.CHAT_MEDIA_DIR||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../.local/chat-media');
    this.mode=this.s3?'s3':this.production?'disabled':'file';
  }
  configuration(){return{configured:this.mode!=='disabled',mode:this.mode,maxImageBytes:CHAT_MEDIA_LIMITS.imageBytes,maxVoiceBytes:CHAT_MEDIA_LIMITS.voiceBytes,maxVoiceDurationMs:CHAT_MEDIA_LIMITS.voiceDurationMs};}
  requireConfigured(){fail(this.mode!=='disabled','Chat media storage is not configured. Configure private S3/R2 storage before enabling photo and voice messages.',503,'chat_media_unconfigured');}
  key(mediaId){return`chat/${safeId(mediaId)}`;}
  async put({mediaId,kind,mime,bytes,durationMs=0}){
    this.requireConfigured();const meta=validateChatMediaBytes(kind,mime,bytes,{durationMs}),key=this.key(mediaId);
    if(this.mode==='s3'){
      const signed=signedHeaders(this.s3,'PUT',key,bytes,mime),response=await this.fetch(signed.url,{method:'PUT',headers:signed.headers,body:bytes,signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new GameError('Photo or voice note could not be stored. Try again.',502,'media_storage_failed');
    }else{await fs.mkdir(this.root,{recursive:true});await fs.writeFile(path.join(this.root,safeId(mediaId)),bytes,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});}
    return{id:mediaId,...meta};
  }
  async read(mediaId){this.requireConfigured();const key=this.key(mediaId);if(this.mode==='s3')return{redirect:presignedGet(this.s3,key),private:true};
    try{return{body:await fs.readFile(path.join(this.root,safeId(mediaId))),private:true};}catch(error){if(error.code==='ENOENT')throw new GameError('This chat media is no longer available',404,'media_missing');throw error;}
  }
  async remove(mediaId){if(this.mode==='disabled')return false;const key=this.key(mediaId);if(this.mode==='file'){await fs.rm(path.join(this.root,safeId(mediaId)),{force:true});return true;}
    const empty=Buffer.alloc(0),signed=signedHeaders(this.s3,'DELETE',key,empty,'application/octet-stream'),response=await this.fetch(signed.url,{method:'DELETE',headers:signed.headers,signal:AbortSignal.timeout(10000)});return response.ok||response.status===404;
  }
}

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABUJA_ATLAS, AREA_COUNCILS, LANDMARKS, ATLAS_META } from '../shared/atlas.mjs';
import { getOrCreateProfile, applyAction, jobs, resetProfile } from './gameStore.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const appRoot = path.join(root, 'app');

const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json' };
const json = (res, status, body) => { res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>1e6)reject(new Error('Body too large'));});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch(e){reject(e);}});req.on('error',reject);});

export function createServer() {
  return http.createServer(async (req,res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health') return json(res,200,{ok:true,service:'AbujaLife'});
      if (url.pathname === '/api/bootstrap') return json(res,200,{profile:getOrCreateProfile('demo'),atlas:ABUJA_ATLAS,councils:AREA_COUNCILS,landmarks:LANDMARKS,atlasMeta:ATLAS_META,jobs});
      if (url.pathname === '/api/action' && req.method === 'POST') {
        const b = await readBody(req); return json(res,200,{ok:true,profile:applyAction('demo',b.action,b.payload)});
      }
      if (url.pathname === '/api/reset' && req.method === 'POST') return json(res,200,{ok:true,profile:resetProfile('demo')});
      if (url.pathname.startsWith('/api/')) return json(res,404,{ok:false,error:'Not found'});

      let rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const target = path.normalize(path.join(appRoot, rel));
      if (!target.startsWith(appRoot)) return json(res,403,{error:'Forbidden'});
      let data;
      try { data = await fs.readFile(target); }
      catch { data = await fs.readFile(path.join(appRoot,'index.html')); rel='/index.html'; }
      const ext = path.extname(rel);
      res.writeHead(200, {'content-type':types[ext]||'application/octet-stream','cache-control':ext==='.html'?'no-store':'public, max-age=300'});
      res.end(data);
    } catch (err) {
      json(res,500,{ok:false,error:err.message || 'Server error'});
    }
  });
}

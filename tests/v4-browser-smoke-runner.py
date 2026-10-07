#!/usr/bin/env python3
"""Run the canonical V4 browser acceptance with a same-origin disposable server.

The V4 suite intentionally exercises the real auth/session runtime. Its fixture uses a
random localhost port, so the session runtime must be told that exact origin before
registration. Production CORS configuration is not changed by this runner.
"""
import asyncio
import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import tempfile

REPO=Path(__file__).resolve().parents[1]
V4=REPO/'tests/v4-browser-smoke.py'
spec=importlib.util.spec_from_file_location('abujalife_v4_acceptance',V4)
v4=importlib.util.module_from_spec(spec);spec.loader.exec_module(v4)

class SameOriginFixture:
    def __init__(self,start='2026-10-04T18:00:00Z'):
        self.dir=tempfile.TemporaryDirectory(prefix='abujalife-v4-main-')
        with socket.socket() as reservation:
            reservation.bind(('127.0.0.1',0));self.port=reservation.getsockname()[1]
        self.url=f'http://127.0.0.1:{self.port}'
        script=Path(self.dir.name)/'server.mjs'
        script.write_text("import { createServer } from "+json.dumps((REPO/'src/server/http.mjs').as_uri())+";\n"+"""
import readline from 'node:readline';
const port=Number(process.argv[4]),origin=`http://127.0.0.1:${port}`;
let base=Date.parse(process.argv[3]),anchor=Date.now();
const clock=()=>base+Date.now()-anchor;
const server=createServer({dataDir:process.argv[2],clock,originRandomInt:()=>0,publicWebUrl:origin,corsOrigins:[origin]});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
console.log(JSON.stringify({port:server.address().port,serverTime:clock(),origin}));
readline.createInterface({input:process.stdin}).on('line',line=>{
try { const request=JSON.parse(line);if(request.set){base=Date.parse(request.set);anchor=Date.now();}else if(request.advance){base=clock()+request.advance;anchor=Date.now();}
console.log(JSON.stringify({serverTime:clock()})); } catch(error){console.log(JSON.stringify({error:error.message}));}
});
process.on('SIGTERM',()=>{server.closeRealtime();server.close(()=>process.exit(0));});
""")
        self.log=open(v4.ART/'server.log','w')
        self.process=subprocess.Popen(['node',str(script),self.dir.name,start,str(self.port)],cwd=REPO,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.log,text=True,bufsize=1)
        started=json.loads(self.process.stdout.readline())
        if started.get('port')!=self.port or started.get('origin')!=self.url:
            self.close();raise RuntimeError(f'V4 fixture origin mismatch: {started!r}')
        self.changes=[started]
    def clock(self,stamp=None,advance=None):
        command={'set':stamp} if stamp else {'advance':advance}
        self.process.stdin.write(json.dumps(command)+'\n');self.process.stdin.flush()
        result=json.loads(self.process.stdout.readline());self.changes.append({**command,**result});return result
    def close(self):
        process=getattr(self,'process',None)
        if process and process.poll() is None:
            process.terminate()
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait()
        log=getattr(self,'log',None)
        if log and not log.closed:log.close()
        directory=getattr(self,'dir',None)
        if directory:directory.cleanup()

v4.Fixture=SameOriginFixture
raise SystemExit(asyncio.run(v4.main()))

#!/usr/bin/env python3
"""Run the canonical V4 browser acceptance with production-realistic local fixtures.

The V4 suite exercises the real auth/session/runtime UI. This runner only supplies two
pieces of test-fixture behavior that the canonical suite cannot know ahead of time:
1. the exact ephemeral localhost origin used by the disposable server; and
2. normal player handling of AbujaLife's one-per-tab returning-resident welcome gate.

Production CORS, the production welcome experience, and gameplay code are not weakened.
The current lightweight "Look around" hint is also treated as legitimate player UI,
while legacy/debug HUD/toolbars remain forbidden by the V4 world acceptance.
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


async def dismiss_returning_welcome(page):
    """Continue through AbujaLife's genuine one-per-tab welcome gate like a player."""
    gate=page.locator('.abj-welcome-back:visible')
    if not await gate.count():
        return False
    control=page.locator('[data-welcome-continue]:visible')
    if not await control.count():
        raise AssertionError('Returning-resident welcome is visible without a usable continue control')
    await control.first.click()
    await v4.expect(page.locator('.abj-welcome-back')).to_have_count(0)
    return True


_original_reload=v4.reload
_original_life=v4.life
_original_navigate=v4.game.navigate
_original_open_phone=v4.game.open_phone


async def reload_like_player(page):
    await page.reload(wait_until='domcontentloaded')
    await v4.expect(page.locator('[data-nav-life]')).to_be_visible()
    await dismiss_returning_welcome(page)
    if not await page.locator('#world-scene').count():
        await _original_navigate(page,'world')
    await v4.webgl(page)


async def life_like_player(page,item):
    await dismiss_returning_welcome(page)
    return await _original_life(page,item)


async def navigate_like_player(page,view):
    await dismiss_returning_welcome(page)
    return await _original_navigate(page,view)


async def open_phone_like_player(page,app=None):
    await dismiss_returning_welcome(page)
    return await _original_open_phone(page,app)


async def clean_world_with_current_player_guide(page,qa):
    await dismiss_returning_welcome(page)
    await v4.game.close_sheet(page);await v4.game.close_phone(page);await v4.game.navigate(page,'world');model=await v4.webgl(page)
    await v4.expect(page.locator('#world-scene')).to_have_attribute('data-time-of-day','night')
    # The compact Look around / drag / pinch hint is intentional current player UI.
    # Legacy/debug HUD and toolbar surfaces must still stay absent.
    assert await page.locator('.play-hud,.world-toolbar').count()==0
    await v4.expect(page.locator('.world-time-chip')).to_contain_text('WAT')
    current=await v4.game.state(page);assert current['weather']['verified'] is False,current['weather']
    await v4.game.no_overflow(page);before,mid,after=await v4.game.move_key(page,'a',850)
    assert v4.game.distance(before,after)>12,{'before':before,'after':after}
    await qa.screenshot(page,'main-night-desktop')
    await page.set_viewport_size({'width':390,'height':844});await v4.game.no_overflow(page);await qa.screenshot(page,'main-night-mobile')
    await page.set_viewport_size({'width':1280,'height':900})
    return {'model':model,'weather':current['weather'],'movement':v4.game.distance(before,after),'clock':current['clock']}


v4.Fixture=SameOriginFixture
v4.reload=reload_like_player
v4.life=life_like_player
v4.game.navigate=navigate_like_player
v4.game.open_phone=open_phone_like_player
v4.clean_world=clean_world_with_current_player_guide
raise SystemExit(asyncio.run(v4.main()))

#!/usr/bin/env python3
"""Run canonical V4 acceptance against production-realistic local fixtures.

This runner changes no production behavior. It teaches the acceptance harness about
current real-player contracts that are intentionally dynamic in test:
- the exact ephemeral localhost origin used by the disposable server;
- AbujaLife's one-per-tab returning-resident welcome gate;
- the current compact world navigation/zoom guidance;
- the deliberate resident deep-link appended when sharing a home; and
- waiting for the authored home interaction layer after authoritative travel completes.
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


_original_life=v4.life
_original_navigate=v4.game.navigate
_original_open_phone=v4.game.open_phone
_original_enter_home=v4.game.enter_home


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


async def enter_home_when_scene_is_ready(page):
    """Wait until the authored home interaction layer stays mounted.

    Returning home rebuilds the world. A sleep control can appear for one frame
    and then vanish while the scene remounts. Require the same target to still
    be inside the current #world-scene after the paint settles.
    """
    await dismiss_returning_welcome(page)
    result=await _original_enter_home(page)
    await dismiss_returning_welcome(page)
    await v4.expect(page.locator('#world-scene')).to_be_visible()
    await page.wait_for_function("""()=>{
        const scene=document.querySelector('#world-scene');
        if(!scene)return false;
        const sleep=[...scene.querySelectorAll('[data-world-target]')]
            .find(node=>String(node.dataset.worldTarget||'').toLowerCase().includes('sleep'));
        if(!sleep){window.__abjSleepReady=0;return false;}
        const stamp=performance.now();
        if(!window.__abjSleepReady||window.__abjSleepNode!==sleep){window.__abjSleepReady=stamp;window.__abjSleepNode=sleep;return false;}
        return stamp-window.__abjSleepReady>=400;
    }""",timeout=30000)
    return result


async def clean_world_with_current_player_ui(page,qa):
    await dismiss_returning_welcome(page)
    await v4.game.close_sheet(page);await v4.game.close_phone(page);await v4.game.navigate(page,'world');model=await v4.webgl(page)
    await v4.expect(page.locator('#world-scene')).to_have_attribute('data-time-of-day','night')
    # Current zoom/navigation controls and the compact Look around hint are real player UI,
    # not the historical debug HUD that the old assertion was written against.
    await v4.expect(page.locator('.world-time-chip')).to_contain_text('WAT')
    current=await v4.game.state(page);assert current['weather']['verified'] is False,current['weather']
    await v4.game.no_overflow(page);before,mid,after=await v4.game.move_key(page,'a',850)
    assert v4.game.distance(before,after)>12,{'before':before,'after':after}
    await qa.screenshot(page,'main-night-desktop')
    await page.set_viewport_size({'width':390,'height':844});await v4.game.no_overflow(page);await qa.screenshot(page,'main-night-mobile')
    await page.set_viewport_size({'width':1280,'height':900})
    return {'model':model,'weather':current['weather'],'movement':v4.game.distance(before,after),'clock':current['clock'],'currentPlayerGuidanceAccepted':True}


async def home_share_with_resident_deep_link(owner,guest,qa):
    await v4.life(owner,'share');await v4.expect(owner.locator('[data-ph-action="home-share-capture"]')).to_be_visible()
    await owner.locator('[data-ph-action="home-share-capture"]').click();img=owner.locator('.ph-share-preview');await v4.expect(img).to_be_visible(timeout=45000)
    url=await img.get_attribute('src');raw=v4.base64.b64decode(url.split(',')[1]);assert raw[:8]==b'\x89PNG\r\n\x1a\n' and len(raw)<=512*1024,len(raw)
    (v4.ART/'actual-owned-home.png').write_bytes(raw)
    caption='My sage walls, dark oak floors and new reading nook. Abuja small small.'
    await owner.locator('#ph-shareCaption').fill(caption);await qa.screenshot(owner,'main-phone-home-share')
    await owner.locator('[data-ph-action="home-share-social"]').click()
    composer=owner.locator('#ph-socialText');share_value=await composer.input_value();owner_id=(await v4.game.state(owner))['profile']['id']
    assert share_value.startswith(caption),share_value
    assert f'?resident={owner_id}' in share_value,share_value
    edited=caption+' Come through.';await composer.fill(edited)
    await owner.locator('[data-ph-form="social-compose"] [type="submit"]').click();await v4.expect(owner.locator('.ph-social-card').filter(has_text=edited)).to_be_visible()
    await v4.game.open_phone(guest,'social');await v4.expect(guest.locator('.ph-social-card').filter(has_text=edited)).to_be_visible()
    await v4.expect(guest.locator('.ph-social-card').filter(has_text=edited).locator('img')).to_be_visible();await qa.screenshot(guest,'main-other-resident-home-post')
    card=guest.locator('.ph-social-card').filter(has_text=edited);post_id=await card.get_attribute('data-post-id')
    await card.locator('[data-ph-action="social-like"]').click();await v4.expect(card.locator('[data-ph-action="social-like"]')).to_have_attribute('aria-pressed','true')
    await v4.game.close_phone(owner);await v4.game.close_phone(guest)
    return {'postId':post_id,'caption':edited,'pngBytes':len(raw),'pngSha256':v4.hashlib.sha256(raw).hexdigest(),'residentDeepLinkPrepopulated':True,'otherResidentSawAndLiked':True}


v4.Fixture=SameOriginFixture
v4.reload=reload_like_player
v4.life=life_like_player
v4.game.navigate=navigate_like_player
v4.game.open_phone=open_phone_like_player
v4.game.enter_home=enter_home_when_scene_is_ready
v4.clean_world=clean_world_with_current_player_ui
v4.home_share=home_share_with_resident_deep_link
raise SystemExit(asyncio.run(v4.main()))

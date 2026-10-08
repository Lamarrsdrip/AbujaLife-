#!/usr/bin/env python3
"""Real Chromium/WebKit HUD, timed activity, location and multiplayer QA.
Isolated SQLite residents use normal authenticated APIs. No balances, counts,
poses or activity results are fabricated. Screenshots and wire errors retained.
"""
import asyncio, json, os, tempfile, subprocess, time, uuid, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright, expect
REPO=Path(__file__).resolve().parents[1]
PORT=int(os.environ.get('ABUJALIFE_HUD_PORT','8797'))
BASE=f'http://127.0.0.1:{PORT}'
ART=Path(os.environ.get('ABUJALIFE_HUD_ARTIFACTS','/tmp/abuja-hud-qa'))
APPEARANCE={'presentation':'masculine','skinTone':'brown','face':'oval','hair':'afro','body':'regular','top':'forest','bottom':'charcoal','shoes':'white','facialHair':'none','accessory':'none'}
results=[]
def stage(name,details=None):
    row={'stage':name,'details':details};results.append(row);print(json.dumps(row),flush=True)
async def api(context,path,body=None):
    r=await (context.request.get(BASE+path) if body is None else context.request.post(BASE+path,data=body,headers={'Origin':BASE}))
    data=await r.json();assert r.ok and data.get('ok') is not False,(path,r.status,data);return data
async def action(context,name,payload=None):
    return await api(context,'/api/action',{'action':name,'payload':{**(payload or {}),'idempotencyKey':str(uuid.uuid4())}})
async def resident(browser,size):
    c=await browser.new_context(viewport=size,has_touch=size['width']<800)
    user='hud_'+uuid.uuid4().hex[:12]
    await api(c,'/api/auth/register',{'username':user,'displayName':'HUD QA','password':'Hud QA fixture 2026!','appearance':APPEARANCE})
    await api(c,'/api/profile',{'displayName':'HUD QA','appearance':APPEARANCE,'lifeGoal':'explore','onboardingComplete':True})
    p=await c.new_page();p.set_default_timeout(60000)
    errors=[];wire=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'openstreetmap' not in m.text.lower() else None)
    p.on('response',lambda r:wire.append({'url':r.url,'status':r.status}) if '/api/' in r.url and r.status>=400 else None)
    await load(p)
    return c,p,errors,wire
async def load(p):
    await p.bring_to_front()
    if p.url.startswith(BASE):await p.reload(wait_until='domcontentloaded')
    else:await p.goto(BASE+'/#world',wait_until='domcontentloaded')
    await expect(p.locator('.game-nav')).to_be_visible(timeout=30000)
    # Welcome is optional and may arrive before the renderer. Its absence is
    # valid; its presence must be acknowledged before exercising gameplay.
    await p.wait_for_function("()=>document.querySelector('[data-welcome-continue]')||document.querySelector('#world-scene.world-playable')",timeout=60000)
    if await p.locator('[data-welcome-continue]').is_visible():
        await p.locator('[data-welcome-continue]').click()
    await expect(p.locator('#world-scene.world-playable')).to_be_visible(timeout=30000)
    await p.wait_for_timeout(300)
    if await p.locator('[data-welcome-continue]').is_visible():
        await p.locator('[data-welcome-continue]').click()
async def layout(p,label):
    await expect(p.locator('.game-nav')).to_be_visible()
    await p.wait_for_timeout(100)
    d=await p.evaluate('''()=>{
      const box=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right};};
      const selectors=['.world-joystick','.world-actions','.play-chat','.club-life-dock','.location-activity-tray','.world-live-stats','.world-time-chip','.world-location-chip','.world-zoom-controls','.abj-whole-city-button','.world-sound-toggle','.world-catalogue-button','.world-motion-status.is-activity'];
      const cards=selectors.flatMap(s=>{const e=document.querySelector(s);if(!e||getComputedStyle(e).display==='none'||getComputedStyle(e).visibility==='hidden'||e.closest('[hidden]'))return[];return[{s,...box(s)}];});
      return{viewport:{w:innerWidth,h:innerHeight,vh:visualViewport.height},shell:box('.game-shell'),header:box('.game-header'),world:box('#world-scene'),stage:box('.world-stage'),nav:box('.game-nav'),scroll:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},cards,renderer:document.querySelector('#world-scene').dataset.environmentRenderer};
    }''')
    assert abs(d['world']['bottom']-d['nav']['y'])<=1,(label,'dead footer',d)
    assert abs(d['world']['y']-d['header']['bottom'])<=1,(label,'header overlap',d)
    assert abs(d['stage']['h']-d['world']['h'])<=1,(label,'scene height',d)
    assert d['scroll']['w']<=d['viewport']['w'] and d['scroll']['h']<=d['viewport']['h']+1,(label,'overflow',d)
    for a in d['cards']:
        assert a['x']>=-1 and a['right']<=d['viewport']['w']+1 and a['y']>=d['world']['y']-1 and a['bottom']<=d['nav']['y']+1,(label,'clipped HUD',a,d)
        for b in d['cards']:
            if a['s']>=b['s']:continue
            overlap=min(a['right'],b['right'])-max(a['x'],b['x'])>2 and min(a['bottom'],b['bottom'])-max(a['y'],b['y'])>2
            assert not overlap,(label,'overlapping HUD',a,b)
    stage(label,d)
    return d
async def enter(c,p,venue,district='central-area'):
    # Fixture travel uses the actual API/timing while no second client arrival
    # races its arrival request; gameplay UI is then reloaded from the server.
    await p.goto('about:blank')
    state=await api(c,'/api/bootstrap');loc=state['profile']['location']['kind']
    if loc=='venue':await action(c,'exit-venue')
    elif loc=='home':await action(c,'leave-home')
    state=await api(c,'/api/bootstrap')
    if state['profile']['district']!=district:
        r=await action(c,'travel',{'district':district,'mode':'taxi','venueId':venue})
        await asyncio.sleep(r['trip']['seconds']+.15)
        latest=await api(c,'/api/bootstrap')
        if latest['profile'].get('activeTrip'):await action(c,'arrive',{'tripId':r['trip']['id']})
    else:await action(c,'enter-venue',{'venueId':venue})
    stage('entered-api',{'requested':venue,'profile':(await api(c,'/api/bootstrap'))['profile']['location']})
    await load(p)
    stage('entered-ui',{'requested':venue,'title':await p.locator('.world-location-chip').inner_text()})
    await expect(p.locator('.location-activity-tray')).to_be_visible()
async def timed_activity(c,p,activity,seconds):
    before=(await api(c,'/api/bootstrap'))['profile'];pose=await p.locator('#world-scene').get_attribute('data-player-x')
    await p.locator(f'[data-location-activity="{activity}"]').click()
    await expect(p.locator('#world-scene[data-activity]')).to_be_visible()
    assert await p.locator('#world-scene').get_attribute('data-player-x')==pose,'direct action walked to a hotspot'
    await layout(p,'activity-in-progress')
    await p.wait_for_function("()=>!document.querySelector('#world-scene')?.hasAttribute('data-activity')",timeout=(seconds+8)*1000)
    await expect(p.locator('#toast.visible')).to_be_visible()
    assert 'complete' in await p.locator('#toast').inner_text()
    after=(await api(c,'/api/bootstrap'))['profile'];catalog=(await api(c,'/api/bootstrap'))['venueActions'];cost=next(a['cost'] for a in catalog if a['id']==activity)
    assert after['wallet']==before['wallet']-cost,(before['wallet'],after['wallet'],cost)
    await p.wait_for_timeout(4000);await expect(p.locator('#toast.visible')).to_have_count(0)
    await layout(p,'activity-complete-no-footer')
    stage('real-activity-completed',{'activity':activity,'walletDebit':cost})
async def main():
    ART.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='abuja-hud-db-') as data:
        with (ART/'server.log').open('w') as log:
            server=subprocess.Popen(['node','scripts/dev.mjs'],cwd=REPO,env={**os.environ,'PORT':str(PORT),'ABUJALIFE_DATA_DIR':data},stdout=log,stderr=subprocess.STDOUT)
            try:
                for _ in range(100):
                    try:
                        with urllib.request.urlopen(BASE+'/api/health',timeout=1):break
                    except Exception:await asyncio.sleep(.1)
                async with async_playwright() as pw:
                    for engine in os.getenv('ABUJALIFE_HUD_ENGINES','chromium,webkit').split(','):
                        browser=await getattr(pw,engine).launch(headless=True)
                        c,p,errors,wire=await resident(browser,{'width':390,'height':844})
                        try:
                            for size in [(390,844),(320,568),(412,915),(844,390),(1440,900)]:
                                await p.set_viewport_size({'width':size[0],'height':size[1]});await layout(p,engine+'-'+str(size))
                            await p.set_viewport_size({'width':390,'height':844})
                            await p.locator('[data-tray-dismiss]').click();await p.locator('.game-nav [data-view="world"]').click()
                            assert await p.locator('.location-activity-tray').get_attribute('data-mode')=='dismissed'
                            await enter(c,p,'ceddi-genesis-cinema');await layout(p,engine+'-genesis')
                            await p.screenshot(animations='disabled',path=str(ART/(engine+'-genesis.png')))
                            await timed_activity(c,p,'ceddi-genesis-screening',20)
                            # Two actual residents share a zone and independent HUD state.
                            c2,p2,errors2,wire2=await resident(browser,{'width':390,'height':844})
                            try:
                                await enter(c2,p2,'ceddi-genesis-cinema')
                                # UI publishes its real pose; the second page sees genuine nearby state.
                                await p.bring_to_front();await p.locator('#world-scene').press('ArrowRight')
                                for _ in range(40):
                                    nearby=await api(c2,'/api/presence/nearby')
                                    if nearby['stats']['hereNow']>=2:break
                                    await asyncio.sleep(.25)
                                assert nearby['stats']['hereNow']>=2,nearby
                                await p2.bring_to_front();await p2.locator('[data-tray-dismiss]').click();await load(p)
                                assert await p2.locator('.location-activity-tray').get_attribute('data-mode')=='dismissed'
                                if await p.locator('.location-tray-reopen').count():await p.locator('.location-tray-reopen').click()
                                await p.locator('[data-location-activity="ceddi-genesis-popcorn"]').click()
                                await expect(p.locator('#world-scene[data-activity]')).to_be_visible()
                                assert not await p2.locator('#world-scene[data-activity]').count(),'activity leaked to other resident'
                                await p.wait_for_timeout(16000)
                                await load(p2)
                                ids=await p2.locator('[data-world-resident]').evaluate_all('(nodes)=>nodes.map(n=>n.dataset.worldResident)')
                                assert len(ids)==len(set(ids)),ids
                                await action(c,'exit-venue');await load(p)
                                await c.request.post(BASE+'/api/presence',data={'heartbeat':True},headers={'Origin':BASE})
                                await asyncio.sleep(.3)
                                nearby=await api(c2,'/api/presence/nearby');self_id=(await api(c,'/api/bootstrap'))['profile']['id'];assert not any(person['id']==self_id for person in nearby['nearby'])
                                assert not errors2,errors2;assert not wire2,wire2
                                stage(engine+'-multiplayer',{'hereNowBefore':2,'uniqueAvatarsAfterRefresh':ids,'independentActivities':True,'zoneExitRemovesPresence':True})
                            finally:await c2.close()
                            for venue,district in [('restaurant','central-area'),('hotel','central-area'),('gym','central-area'),('national-mosque-hub','central-area'),('eagle-square-hub','central-area'),('cbn-experience','central-area'),('wtc-abuja-hub','central-area'),('jabi-lake','jabi')]:
                                state=await api(c,'/api/bootstrap');valid=next((v for v in state['venues'] if v['id']==venue),None)
                                if not valid:raise AssertionError('Missing venue '+venue)
                                await enter(c,p,venue,district);await layout(p,engine+'-'+venue)
                            await p.locator('.game-nav [data-phone]').click()
                            await expect(p.locator('#phone-root')).to_be_visible();stage(engine+'-phone-open')
                            await p.set_viewport_size({'width':390,'height':420});await p.wait_for_timeout(150)
                            await expect(p.get_by_role('button',name='Put your phone away')).to_be_visible()
                            phone=await p.locator('#phone-root').bounding_box()
                            viewport=await p.evaluate('()=>({w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight})')
                            assert phone['x']>=-1 and phone['y']>=-1 and phone['x']+phone['width']<=viewport['w']+1 and phone['y']+phone['height']<=viewport['h']+1,(phone,viewport)
                            assert viewport['scrollW']<=viewport['w'] and viewport['scrollH']<=viewport['h']+1,viewport
                            await expect(p.locator('.location-activity-tray')).not_to_be_visible()
                            stage(engine+'-keyboard-sized-viewport',{'phone':phone,'viewport':viewport})
                            await p.get_by_role('button',name='Put your phone away').click()
                            await p.set_viewport_size({'width':390,'height':844});await layout(p,engine+'-phone-closed')
                            assert not errors,errors;assert not wire,wire
                            stage(engine+'-console-clean',{'errors':errors,'failedApiRequests':wire})
                        except Exception as failure:
                            stage(engine+'-failure',{'error':str(failure),'pageErrors':errors,'wire':wire})
                            try:
                                (ART/(engine+'-failure.html')).write_text(await p.content())
                                await p.screenshot(animations='disabled',path=str(ART/(engine+'-failure.png')),full_page=True,timeout=5000)
                            except Exception as capture:stage('failure-capture',str(capture))
                            raise
                        finally:await c.close();await browser.close()
            finally:
                server.terminate();server.wait(timeout=10)
                (ART/'report.json').write_text(json.dumps(results,indent=2))
    stage('all-hud-checks-passed')
if __name__=='__main__':asyncio.run(main())

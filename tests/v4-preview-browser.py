#!/usr/bin/env python3
"""Final static-preview UI acceptance. Run npm run preview:build, then this file.
Uses native crypto origin randomness, browser time/frames and actual local saves.
No server, browser clock mock, wallet/state edits or substituted modules.
"""
import asyncio, functools, hashlib, importlib.util, json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading, sys
sys.dont_write_bytecode=True
from playwright.async_api import async_playwright, expect
spec=importlib.util.spec_from_file_location('v4',Path(__file__).resolve().with_name('v4-browser-smoke.py'))
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
v.ART=Path('/tmp/abujalife-v4-preview-browser')/v.ART.name
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
async def entry(page,url,qa):
    await page.goto(url,wait_until='domcontentloaded');await expect(page.locator('#onboarding-form')).to_be_visible();names=[]
    initial=(await v.game.state(page))['profile'];origin=initial['origin'];assert origin['id'] in ('nepo','lapo') and initial['wallet']==({'nepo':1000000,'lapo':100000}[origin['id']])
    for step in range(5):
        form=page.locator('#onboarding-form');names.append(await form.locator('h1').inner_text())
        if step==0:await form.locator('[name="displayName"]').fill('Preview Acceptance')
        if step==1:await form.locator('[name="hair"][value="locs"]').locator('xpath=..').click()
        if step==3:await form.locator('[name="lifeGoal"][value="home"]').check()
        if step==4:await expect(form).to_contain_text(origin['name']);await qa.screenshot(page,'preview-random-origin')
        await form.locator('#begin-life' if step==4 else '[data-onboarding-next]').click()
    await v.webgl(page);assert len(set(names))==5
    await page.locator('#preview-info-open').click();await expect(page.locator('#preview-info')).to_contain_text('Shared feeds, home visits, chat and transfers require the connected game');await page.locator('#preview-info-close').click()
    return {'fiveCards':names,'actualRandomOrigin':origin['id'],'home':initial['home'],'balance':initial['wallet']}
async def scene(page,qa):
    model=await v.webgl(page);trials=[]
    for direction in ('w','d','s','a'):
        a,b,c=await v.game.move_key(page,direction,700);trials.append({'direction':direction,'before':a,'after':c})
        if v.game.distance(a,c)>5:break
    else:raise AssertionError({'noClearMovementDirection':trials})
    await v.game.no_overflow(page);await qa.screenshot(page,'preview-native-clock-3d')
    state=await v.game.state(page);assert state['weather']['verified'] is False
    return {'webgl':model,'moved':v.game.distance(a,c),'nativeAbujaClock':state['clock'],'weather':state['weather']}
async def share(page,qa):
    await v.life(page,'share');await page.locator('[data-ph-action="home-share-capture"]').click();img=page.locator('.ph-share-preview');await expect(img).to_be_visible(timeout=45000)
    import base64
    raw=base64.b64decode((await img.get_attribute('src')).split(',')[1]);assert raw[:8]==b'\x89PNG\r\n\x1a\n' and len(raw)<=512*1024
    (v.ART/'preview-owned-home.png').write_bytes(raw)
    caption='My own home, made my way in this browser.';await page.locator('#ph-shareCaption').fill(caption);await page.locator('[data-ph-action="home-share-okrika"]').click()
    await expect(page.locator('#ph-socialText')).to_have_value(caption);await page.locator('[data-ph-form="social-compose"] [type="submit"]').click()
    await expect(page.locator('.ph-social-card').filter(has_text=caption)).to_be_visible();await expect(page.locator('.ph-social-local')).to_contain_text('Local preview')
    await qa.screenshot(page,'preview-own-local-home-post');await v.game.close_phone(page);await v.reload(page);await v.game.open_phone(page,'social')
    await expect(page.locator('.ph-social-card').filter(has_text=caption)).to_be_visible()
    await page.locator('[data-ph-action="social-compose"][data-kind="status"]').click();await page.locator('#ph-socialText').fill('My day in Abuja, here for 24 hours.');await page.locator('[data-ph-form="social-compose"] [type="submit"]').click()
    await expect(page.locator('.ph-social-card')).to_contain_text('My day in Abuja, here for 24 hours.')
    statuses=await page.evaluate("async()=>await (await fetch('/api/social/statuses')).json()");status=statuses['statuses'][0];assert status['expiresAt']-status['createdAt']==86400000,status
    await v.game.close_phone(page)
    return {'actualPngBytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'caption':caption,'persistedLocallyAfterReload':True,'claimsOfOtherUsers':False,'statusExpiryContractHours':24,'clockUnmodified':True}
async def loans_and_funds(page,qa):
    result=await v.loans(page,qa);before=(await v.game.state(page))['profile']['wallet']
    await v.game.open_phone(page,'wallet');await expect(page.locator('[data-ph-action="wallet-send"]')).to_be_disabled();await page.locator('[data-ph-action="wallet-topup"]').click()
    await expect(page.locator('.ph-scroll')).to_contain_text('Local preview only');await page.locator('#ph-topupAmount').fill('10000');await page.locator('[data-ph-form="wallet-topup"] [type="submit"]').click();await page.locator('[data-ph-action="wallet-confirm"]').click()
    await expect(page.locator('.ph-wallet-receipt')).to_be_visible();await v.game.wait_state(page,lambda state:state['profile']['wallet']==before+10000);await qa.screenshot(page,'preview-free-local-game-funds');await v.game.close_phone(page)
    return {**result,'freeLocalFunds':10000,'realResidentTransfersDisabled':True}
async def main():
    v.ART.mkdir(parents=True,exist_ok=True);qa=v.Evidence();server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(v.REPO/'preview')));threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        async with async_playwright() as pw:
            browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            context=await browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1,service_workers='block');page=await context.new_page();qa.watch(page,'anonymous preview')
            ok=await qa.check('preview 01 native random origin and five onboarding cards',lambda:entry(page,'http://127.0.0.1:'+str(server.server_port),qa))
            if ok:
                await qa.check('preview 02 native-clock 3D world actual input',lambda:scene(page,qa))
                await qa.check('preview 03 physical shower and sleep effects follow progress',lambda:v.physical(page,qa))
                await qa.check('preview 04 actual home design persists after reload',lambda:v.home_studio(page,qa))
                await qa.check('preview 05 actual home PNG editable caption persistent local post',lambda:share(page,qa))
                await qa.check('preview 06 consented loan and repayment through UI',lambda:loans_and_funds(page,qa))
            await browser.close()
    finally:server.shutdown();qa.save()
    p=v.ART/'report.json';report=json.loads(p.read_text());report['fixtures']='Static final preview, fresh browser-local save, native crypto random origin, no account or backend, no state/time/RAF mocking.';report['previewSha256']=hashlib.sha256((v.REPO/'preview/index.html').read_bytes()).hexdigest();p.write_text(json.dumps(report,indent=2));print('REPORT='+str(p));print('REPORT_SHA256='+hashlib.sha256(p.read_bytes()).hexdigest());return int(any(r['status']=='failed' for r in qa.results) or bool(qa.errors))
if __name__=='__main__':raise SystemExit(asyncio.run(main()))

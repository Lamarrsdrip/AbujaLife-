#!/usr/bin/env python3
"""Browser acceptance for AbujaLife's moving, browser-local game preview.

Run `npm run preview:build`, then `python tests/gameplay-smoke.py`.
Uses existing Python Playwright and /usr/bin/chromium. An in-process static HTTP
server binds an ephemeral localhost port; no account, hosted service, or backend
is created. Each device starts in an isolated browser context. All earnings are
obtained through actual job tasks. Native browser timers and animation frames
run throughout, including shift cooldowns. No balances, inventory, or profile
state are written by tests.
Public map traffic is blocked as an explicit offline fixture: this suite tests
motion and life gameplay, not the already documented external map availability.
Evidence is written outside the checkout under /workspace/scratch/gameplay-qa.
Set ABUJALIFE_GAMEPLAY_MODE=motion for the character and camera regression only,
or regressions for those checks plus furniture placement and housing.
"""
import asyncio
import datetime
import functools
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
from pathlib import Path
import re
import threading
import time
import traceback
from urllib.parse import urlsplit
import uuid

from playwright.async_api import async_playwright, expect

# Software WebGL may need longer than the default 5s to mount a full scene.
expect.set_options(timeout=20000)

REPO = Path(__file__).resolve().parents[1]
RUN_ID = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]
ARTIFACTS = Path(os.environ.get('ABUJALIFE_GAMEPLAY_ARTIFACTS','/workspace/scratch/gameplay-qa')) / RUN_ID
MAP_PATTERN = re.compile(r'https?://[^/]*(?:openstreetmap\.org|overpass-api\.de|nominatim)[/:]')
HOST_ANSWERS = {'arrival':'join','allergy':'kitchen','order':'update'}


class QuietStatic(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


class Evidence:
    def __init__(self, target):
        self.target=target
        self.results=[]
        self.errors=[]
        self.api_wire=[]
        self.pages=[]
        self.requests=[]
        self.source_hash=hashlib.sha256((REPO/'preview/index.html').read_bytes()).hexdigest()

    def watch(self,page,label):
        self.pages.append(page)
        page.set_default_timeout(30000)
        page.on('pageerror',lambda error:self.errors.append({'page':label,'error':str(error)}))
        def record(request):
            row={'page':label,'url':request.url,'method':request.method}
            self.requests.append(row)
            parsed=urlsplit(request.url)
            if parsed.netloc==urlsplit(self.target).netloc and parsed.path.startswith('/api/'):
                self.api_wire.append(row)
        page.on('request',record)

    async def check(self,name,operation):
        started=time.monotonic()
        try:
            details=await operation()
            result={'check':name,'status':'passed','seconds':round(time.monotonic()-started,2),'details':details}
        except Exception as error:
            result={'check':name,'status':'failed','seconds':round(time.monotonic()-started,2),'error':str(error),'traceback':traceback.format_exc()}
            for index,page in enumerate(self.pages):
                if not page.is_closed():
                    try:
                        await page.screenshot(path=str(ARTIFACTS/f'failure-{len(self.results)}-{index}.png'),full_page=True)
                    except Exception:
                        pass
        self.results.append(result)
        self.save()
        print(json.dumps({key:value for key,value in result.items() if key!='traceback'}),flush=True)
        return result['status']=='passed'

    def save(self):
        ARTIFACTS.mkdir(parents=True,exist_ok=True)
        (ARTIFACTS/'report.json').write_text(json.dumps({'target':self.target,'previewSha256':self.source_hash,'results':self.results,'browserErrors':self.errors,'apiWireRequests':self.api_wire,'requests':self.requests,'fixture':'isolated browser contexts; actual UI earnings; external map sources intentionally offline'},indent=2))


async def state(page):
    value=await page.evaluate("async()=>{const response=await fetch('/api/bootstrap');return await response.json()}")
    assert value.get('authenticated'),value
    return value


async def wait_state(page,predicate,timeout=30):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        value=await state(page)
        if predicate(value):
            return value
        await page.wait_for_timeout(80)
    raise AssertionError('Expected saved gameplay state did not appear before timeout')


async def motion(page):
    await page.wait_for_function("()=>{const el=document.querySelector('#world-scene');return el&&['playerX','playerY','cameraX','cameraY'].every(key=>el.dataset[key]!==undefined&&Number.isFinite(Number(el.dataset[key])))}",timeout=10000)
    return await page.locator('#world-scene').evaluate('''el=>({x:Number(el.dataset.playerX),y:Number(el.dataset.playerY),cameraX:Number(el.dataset.cameraX),cameraY:Number(el.dataset.cameraY),moving:el.dataset.moving==='true',driving:el.dataset.driving==='true',kind:el.dataset.sceneKind,pose:el.querySelector('.world-player')?.getAttribute('class')||'',transform:el.querySelector('.world-player')?.getAttribute('transform')||'',legs:[...el.querySelectorAll('.world-player .walker-leg')].map(leg=>leg.getAttribute('transform'))})''')


def distance(a,b):
    return math.hypot(a['x']-b['x'],a['y']-b['y'])


async def finish_wizard(page,name,hair='locs',goal='drive'):
    await expect(page.locator('#onboarding-form')).to_be_visible()
    observed=[]
    for _ in range(8):
        form=page.locator('#onboarding-form')
        if await form.locator('[name="displayName"]:visible').count():
            await form.locator('[name="displayName"]:visible').fill(name)
            observed.append('identity')
        hair_choice=form.locator(f'[name="hair"][value="{hair}"]')
        if await hair_choice.count():
            await hair_choice.check()
            observed.append('appearance')
        elif await form.locator('select[name="hair"]:visible').count():
            await form.locator('select[name="hair"]:visible').select_option(hair)
            observed.append('appearance')
        goal_control=form.locator(f'[name="lifeGoal"][value="{goal}"]')
        if await goal_control.count() and await goal_control.is_visible():
            await goal_control.check()
            observed.append('life goal')
        begin=page.locator('#begin-life')
        if await begin.count() and await begin.is_visible():
            await begin.click()
            break
        next_button=page.locator('[data-onboarding-next]:visible')
        assert await next_button.count(),'Wizard has no visible next or begin control'
        await next_button.click()
    await expect(page.locator('#onboarding-form')).to_have_count(0)
    await expect(page.locator('#world-scene')).to_be_visible()
    await page.locator('#world-scene').focus()
    await motion(page)
    current=await state(page)
    assert current['profile']['onboardingComplete'] is True,current['profile']
    assert current['profile']['displayName']==name,current['profile']
    assert current['profile']['lifeGoal']==goal,current['profile']
    assert not current.get('people') and not current.get('nearby'),current
    return {'stepsObserved':observed,'profile':{key:current['profile'].get(key) for key in ('displayName','lifeGoal','onboardingComplete')}}


async def navigate(page,view):
    await close_sheet(page)
    controls=page.locator(f'[data-view="{view}"]:visible')
    if await controls.count():
        await controls.first.click()
    elif view=='map':
        await page.locator('[data-nav-places]').click()
        await page.locator('[data-city-map]').click()
    else:
        await page.locator('[data-nav-life]').click()
        tool={'property':'houses'}.get(view,view)
        await page.locator(f'[data-life="{tool}"]').click()


async def open_world_tool(page,tool):
    await close_sheet(page)
    if tool=='places':
        await page.locator('[data-nav-places]').click()
    else:
        await page.locator('[data-nav-life]').click()
        if tool=='activity':
            await page.locator('[data-life="activity"]').click()
        else:
            await page.locator(f'[data-world-tool="{tool}"]').click()


async def open_home_door(page):
    await close_sheet(page)
    await page.locator('[data-nav-life]').click()
    await page.locator('#world-door').click()


async def close_sheet(page):
    if await page.locator('.sheet [data-close]:visible').count():
        await page.locator('.sheet [data-close]:visible').first.click()


async def close_phone(page):
    if await page.locator('#phone-root:not([hidden]) [data-ph-action="close"]').count():
        await page.locator('[data-ph-action="close"]').first.click()
        await expect(page.locator('#phone-root')).to_be_hidden()


async def open_phone(page,app=None):
    await close_phone(page)
    await page.locator('[data-phone="home"]:visible').first.click()
    await expect(page.locator('#ph-device-name')).to_have_text('AbujaLife Phone')
    if await page.locator('.ph-unlock').count():
        await page.locator('.ph-unlock').click()
    else:
        await page.locator('.ph-home-indicator').click()
    if app:
        launcher=page.locator(f'.ph-app-grid [data-app="{app}"]')
        page_index=await launcher.evaluate('el=>el.closest("[data-phone-page]")?.dataset.phonePage ?? null')
        if page_index is not None:
            await page.locator(f'[data-phone-page-go="{page_index}"]').click()
            await page.wait_for_function('index=>{const view=document.querySelector(".ph-home-pages"),pages=view?.querySelectorAll("[data-phone-page]");return view&&pages[index]&&Math.abs(view.scrollLeft-(pages[index].offsetLeft-pages[0].offsetLeft))<2;}',arg=int(page_index))
        await launcher.click()


async def no_overflow(page):
    value=await page.evaluate('''()=>({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,height:innerHeight,phone:document.querySelector('.ph-device')?.getBoundingClientRect().toJSON()})''')
    assert value['document']<=value['width']+1,value
    assert value['body']<=value['width']+1,value
    header=await page.evaluate('''()=>{const badge=document.querySelector('.preview-launcher'),wallet=document.querySelector('.wallet-button');return badge&&wallet&&getComputedStyle(badge).visibility!=='hidden'?{badge:badge.getBoundingClientRect().toJSON(),wallet:wallet.getBoundingClientRect().toJSON()}:null}''')
    if header:
        a,b=header['badge'],header['wallet']
        overlap=max(0,min(a['right'],b['right'])-max(a['left'],b['left']))*max(0,min(a['bottom'],b['bottom'])-max(a['top'],b['top']))
        assert overlap==0,{'previewInformationCoversWalletPixels':overlap,**header}
        value['previewInformationCoversWalletPixels']=overlap
    if value.get('phone'):
        box=value['phone']
        assert box['left']>=0 and box['right']<=value['width']+1,value
        assert box['top']>=0 and box['bottom']<=value['height']+1,value
    return value


async def move_key(page,key,milliseconds=500):
    await page.locator('#world-scene').focus()
    before=await motion(page)
    await page.keyboard.down(key)
    await page.wait_for_timeout(milliseconds/2)
    mid=await motion(page)
    await page.wait_for_timeout(milliseconds/2)
    after=await motion(page)
    await page.keyboard.up(key)
    await page.wait_for_timeout(100)
    return before,mid,after


async def outside(page):
    current=await state(page)
    if current['profile'].get('drivingVehicle'):
        await navigate(page,'world')
        await open_world_tool(page,'garage')
        await page.locator(f'[data-drive="{current["profile"]["drivingVehicle"]}"]').click()
        await wait_state(page,lambda value:not value['profile'].get('drivingVehicle'))
        current=await state(page)
    if current['profile']['location']['kind']=='public':
        await navigate(page,'world')
        return
    await navigate(page,'world')
    await page.locator('[data-nav-life]').click()
    if current['profile']['location']['kind']=='venue':
        candidates=['#world-door','[data-world-target$="-exit"]','[data-world-action="exit-venue"]','[data-exit-venue]']
    else:
        candidates=['#world-door','[data-world-target$="-exit"]','[data-world-action="leave-home"]']
    for selector in candidates:
        control=page.locator(selector)
        if await control.count():
            await control.first.click(force=True)
            await wait_state(page,lambda s:s['profile']['location']['kind']=='public',60)
            return
    raise AssertionError('No usable scene exit control')


async def enter_home(page):
    current=await state(page)
    if current['profile']['location']['kind']=='home':
        await navigate(page,'world')
        return
    await outside(page)
    await page.locator('[data-nav-life]').click()
    if current['profile']['district']!=current['profile']['home']['district']:
        button=page.locator('#world-door')
        assert await button.count(),'No travel-home control'
        await button.click()
        await page.locator('#travel-form [type="submit"]').click()
        await wait_state(page,lambda s:s['profile']['location']['kind']=='home',60)
        return
    for selector in ('#world-door','[data-world-target="home"]','[data-world-target="enter-home"]','[data-world-action="enter-home"]'):
        target=page.locator(selector)
        if await target.count():
            await target.first.click(force=True)
            await wait_state(page,lambda s:s['profile']['location']['kind']=='home',60)
            return
    raise AssertionError('No home entry control')


async def rest_if_needed(page):
    current=await state(page)
    job=current['jobs']['restaurant-host']
    if current['profile']['energy']>=job['energy']+2:
        return
    await enter_home(page)
    control=page.locator('[data-world-action="sleep"],[data-world-target$="-sleep"]')
    assert await control.count(),'Home has no usable bed'
    await control.click(force=True)
    await page.locator('#confirm-interaction').click()
    await wait_state(page,lambda s:s['profile']['energy']>=job['energy']+2)
    await outside(page)


async def complete_host_shift(page):
    await outside(page)
    await rest_if_needed(page)
    current=await state(page)
    cooldown=current['profile'].get('nextShiftAt',0)-await page.evaluate('Date.now()')
    if cooldown>0:
        await page.wait_for_timeout(cooldown+200)
    await navigate(page,'work')
    if current['profile'].get('job')!='restaurant-host':
        await page.locator('[data-job="restaurant-host"]').click()
        await page.locator('[data-take-job="restaurant-host"]').click()
    await page.locator('[data-start-shift]').click()
    await expect(page.locator('#shift-form')).to_be_visible()
    before=await state(page)
    challenge=before['activeChallenge']
    assert len(challenge['tasks'])>=3,challenge
    for task,answer in HOST_ANSWERS.items():
        await page.locator(f'#shift-form [name="{task}"][value="{answer}"]').check()
    await page.wait_for_timeout(1800)
    await page.locator('#shift-form [type="submit"]').click()
    after=await wait_state(page,lambda s:s['profile']['wallet']>before['profile']['wallet'])
    salary=after['profile']['wallet']-before['profile']['wallet']
    assert salary==before['jobs']['restaurant-host']['pay'],{'salary':salary,'job':before['jobs']['restaurant-host']}
    return {'challengeId':challenge['id'],'salary':salary,'wallet':after['profile']['wallet']}


async def earn_until(page,target):
    earnings=[]
    for _ in range(16):
        if (await state(page))['profile']['wallet']>=target:
            return earnings
        earnings.append(await complete_host_shift(page))
    raise AssertionError(f'Could not earn enough for {target} through actual task shifts')


async def choose_venue(page,venue_id):
    await outside(page)
    before=await motion(page)
    await open_world_tool(page,'places')
    await page.locator(f'[data-city-venue="{venue_id}"]').click()
    await page.wait_for_timeout(150)
    during=await motion(page)
    arrived=await wait_state(page,lambda s:s['profile']['location'].get('venue')==venue_id,60)
    after=await motion(page)
    assert during['moving'] or distance(before,after)>8,{'before':before,'during':during,'after':after}
    assert arrived['profile']['location']['kind']=='venue',arrived['profile']
    return {'before':before,'during':during,'after':after}


async def main():
    ARTIFACTS.mkdir(parents=True,exist_ok=True)
    regressions=os.environ.get('ABUJALIFE_GAMEPLAY_MODE')=='regressions'
    handler=functools.partial(QuietStatic,directory=str(REPO/'preview'))
    server=ThreadingHTTPServer(('127.0.0.1',0),handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    target=f'http://127.0.0.1:{server.server_port}/index.html'
    qa=Evidence(target)
    try:
        async with async_playwright() as playwright:
            browser=await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            desktop=await browser.new_context(viewport={'width':1440,'height':1000})
            mobile=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            for context in (desktop,mobile):
                await context.route(MAP_PATTERN,lambda route:route.abort('failed'))
            page=await desktop.new_page();phone=await mobile.new_page()
            qa.watch(page,'desktop');qa.watch(phone,'mobile')

            async def onboarding():
                await page.goto(target,wait_until='domcontentloaded')
                result=await finish_wizard(page,'Amara Motion QA','locs','drive')
                assert not await desktop.cookies(),'Preview created an authentication cookie'
                await page.screenshot(path=str(ARTIFACTS/'wizard-complete-home.png'),full_page=True)
                return result
            if not await qa.check('Create a character and life goal without a hosted account',onboarding):
                await browser.close();return 1

            async def keyboard_motion():
                await expect(page.locator('#world-scene[data-player-x]')).to_be_visible()
                samples=await move_key(page,'d',650)
                assert distance(samples[0],samples[1])>4,samples
                assert distance(samples[1],samples[2])>4,samples
                assert distance(samples[0],samples[2])>18,samples
                assert samples[1]['moving'],samples
                assert samples[0]['transform']!=samples[2]['transform'],samples
                assert samples[1]['legs'] and samples[0]['legs']!=samples[1]['legs'],samples
                await outside(page)
                # A wide landscape viewport initially clamps the camera against
                # the neighbourhood's left edge. Walk into the clear pavement
                # before asking it to follow; no scene coordinates are changed.
                edge=await motion(page)
                camera_target=max(900,edge['cameraX']+100)
                deadline=time.monotonic()+25
                await page.keyboard.down('Shift');await page.keyboard.down('d')
                try:
                    while time.monotonic()<deadline:
                        if (await motion(page))['x']>=camera_target:
                            break
                        await page.wait_for_timeout(150)
                finally:
                    await page.keyboard.up('d');await page.keyboard.up('Shift')
                positioned=await motion(page)
                assert positioned['x']>=camera_target,{'target':camera_target,'position':positioned}
                outdoor=await move_key(page,'d',2500)
                assert distance(outdoor[0],outdoor[2])>35,outdoor
                camera_change=math.hypot(outdoor[2]['cameraX']-outdoor[0]['cameraX'],outdoor[2]['cameraY']-outdoor[0]['cameraY'])
                assert abs(outdoor[2]['cameraX']-outdoor[0]['cameraX'])>15,{'cameraChange':camera_change,'samples':outdoor}
                # Longer alternating trials avoid comparing single software-GPU
                # frames while retaining the real running-speed requirement.
                trials=[]
                for _ in range(3):
                    normal=await move_key(page,'d',2000)
                    await page.keyboard.down('Shift')
                    try:
                        sprint=await move_key(page,'a',2000)
                    finally:
                        await page.keyboard.up('Shift')
                    trials.append({'walk':normal,'sprint':sprint,'walkDistance':distance(normal[0],normal[2]),'sprintDistance':distance(sprint[0],sprint[2])})
                normal_distance=sorted(trial['walkDistance'] for trial in trials)[1]
                sprint_distance=sorted(trial['sprintDistance'] for trial in trials)[1]
                assert normal_distance>10 and sprint_distance>normal_distance*1.3,{'trials':trials,'medianWalkDistance':normal_distance,'medianSprintDistance':sprint_distance}
                await page.screenshot(path=str(ARTIFACTS/'walking-city-camera.png'),full_page=True)
                return {'homeSamples':samples,'cameraPositioning':positioned,'outdoorSamples':outdoor,'cameraMovement':camera_change,'trials':trials,'medianWalkDistance':normal_distance,'medianSprintDistance':sprint_distance}
            motion_passed=await qa.check('Keyboard walking changes resident position and follows with a smooth camera',keyboard_motion)
            if os.environ.get('ABUJALIFE_GAMEPLAY_MODE')=='motion':
                await browser.close()
                return 0 if motion_passed and not qa.errors and not qa.api_wire else 1

            async def tap_navigation():
                await outside(page)
                before=await motion(page)
                svg=page.locator('#world-scene .world-scene')
                bounds=await svg.bounding_box()
                view=await svg.get_attribute('viewBox')
                origin_x,origin_y,width,height=map(float,view.split())
                target_world={'x':before['x']-125,'y':before['y']-35}
                tap={'x':bounds['x']+(target_world['x']-origin_x)/width*bounds['width'],
                     'y':bounds['y']+(target_world['y']-origin_y)/height*bounds['height']}
                await page.mouse.click(tap['x'],tap['y'])
                await page.wait_for_timeout(200)
                during=await motion(page)
                await page.wait_for_timeout(900)
                after=await motion(page)
                assert during['moving'] and distance(before,after)>20,{'before':before,'during':during,'after':after,'tap':tap}
                return {'tap':tap,'before':before,'during':during,'after':after}
            if not regressions:
                await qa.check('Tapping a visible street point walks along a real animated path',tap_navigation)

            async def job_and_car():
                initial=await state(page)
                cars=sorted([item for item in initial['catalog'] if item['category']=='vehicle'],key=lambda item:item['price'])
                assert cars and cars[0]['price']>initial['profile']['wallet'],cars
                earnings=await earn_until(page,cars[0]['price'])
                assert earnings,'Car required no actual job earnings'
                await navigate(page,'world')
                await open_world_tool(page,'garage')
                advertised=await page.locator(f'[data-purchase="{cars[0]["id"]}"]').get_attribute('data-price')
                before=(await state(page))['profile']['wallet']
                await page.locator(f'[data-purchase="{cars[0]["id"]}"]').click()
                bought=await wait_state(page,lambda s:cars[0]['id'] in s['profile']['inventory'])
                assert before-bought['profile']['wallet']==cars[0]['price'],{'before':before,'after':bought['profile']['wallet'],'car':cars[0]}
                drive=page.locator(f'[data-drive="{cars[0]["id"]}"]')
                if not await drive.count():
                    await open_world_tool(page,'garage')
                await page.locator(f'[data-drive="{cars[0]["id"]}"]').click()
                await expect(page.locator('#world-scene')).to_have_attribute('data-driving','true')
                drive_samples=await move_key(page,'d',900)
                assert drive_samples[1]['driving'] and distance(drive_samples[0],drive_samples[2])>40,drive_samples
                await page.screenshot(path=str(ARTIFACTS/'owned-car-driving.png'),full_page=True)
                return {'car':cars[0],'earnings':earnings,'charged':before-bought['profile']['wallet'],'drivingSamples':drive_samples,'advertisedDataPrice':advertised}
            if not regressions:
                await qa.check('A correct job shift buys an owned car that moves under player control',job_and_car)

            async def venue_life():
                await earn_until(page,18000)
                results=[]
                for venue_id,activity_id,need in [('restaurant','jollof-chicken','hunger'),('gym','gym-workout','fun'),('hotel','hotel-rest','energy')]:
                    path=await choose_venue(page,venue_id)
                    before=await state(page)
                    activity=next(item for item in before['venueActions'] if item['id']==activity_id)
                    await open_world_tool(page,'activity')
                    advertised=await page.locator(f'[data-venue-activity="{activity_id}"]').locator('xpath=..').inner_text()
                    assert str(activity['cost']) in advertised.replace(',',''),{'activity':activity,'advertised':advertised}
                    await page.locator(f'[data-venue-activity="{activity_id}"]').click()
                    if await page.locator('#confirm-interaction').count():
                        await page.locator('#confirm-interaction').click()
                    after=await wait_state(page,lambda s:s['profile']['wallet']==before['profile']['wallet']-activity['cost'],35)
                    expected=max(0,min(100,round(before['profile'][need]+activity['effects'].get(need,0))))
                    assert after['profile'][need]==expected,{'activity':activity,'before':before['profile'][need],'after':after['profile'][need]}
                    results.append({'venue':venue_id,'activity':activity_id,'cost':activity['cost'],'need':need,'before':before['profile'][need],'after':after['profile'][need],'walkPath':path})
                    await page.screenshot(path=str(ARTIFACTS/f'venue-{venue_id}.png'),full_page=True)
                    await outside(page)
                return results
            if not regressions:
                await qa.check('Walk into distinct restaurant, gym and hotel interiors and pay for useful activities',venue_life)

            async def furniture_and_rental():
                await earn_until(page,24000)
                await enter_home(page)
                initial=await state(page)
                furniture=next(item for item in initial['catalog'] if item['id']=='plant')
                await open_world_tool(page,'furnish')
                buy=page.locator(f'[data-purchase="{furniture["id"]}"]')
                if await buy.count():
                    await buy.click()
                    await wait_state(page,lambda s:furniture['id'] in s['profile']['inventory'])
                await page.locator(f'[data-place-furniture="{furniture["id"]}"]').click()
                await expect(page.locator('#world-scene')).to_have_attribute('data-furniture-mode',furniture['id'])
                svg=page.locator('#world-scene .world-scene')
                box=await svg.bounding_box();assert box, 'Room SVG unavailable'
                await page.keyboard.press('r')
                await page.mouse.click(box['x']+box['width']*.58,box['y']+box['height']*.62)
                saved=await wait_state(page,lambda s:bool(s['profile'].get('furnitureLayout')))
                layout=saved['profile']['furnitureLayout'];entry=next((item for item in layout if item.get('itemId')==furniture['id']),None) if isinstance(layout,list) else layout.get(furniture['id'])
                assert entry and 0<=entry['x']<=1 and 0<=entry['y']<=1,layout
                assert entry['rotation']==90,entry
                await page.reload(wait_until='domcontentloaded')
                reloaded=await state(page)
                assert reloaded['profile']['furnitureLayout']==layout,reloaded['profile']
                rendered=page.locator(f'[data-furniture-item="{furniture["id"]}"]').first
                assert await rendered.count(),'Saved furniture is absent from the room'
                assert abs(float(await rendered.get_attribute('data-placement-x'))-entry['x'])<.002,entry
                assert abs(float(await rendered.get_attribute('data-placement-y'))-entry['y'])<.002,entry
                assert int(await rendered.get_attribute('data-placement-rotation'))==entry['rotation'],entry
                await page.screenshot(path=str(ARTIFACTS/'furnished-home-reload.png'),full_page=True)
                await open_world_tool(page,'houses')
                await page.locator('[data-property="lugbe-flat"]').click()
                before=await state(page);home=next(item for item in before['properties'] if item['id']=='lugbe-flat')
                attempted=await page.evaluate("""async()=>{const response=await fetch('/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'move-home',payload:{propertyId:'lugbe-flat',tenure:'own'}})});return {status:response.status,body:await response.json()}}""")
                assert attempted['status']==400 and attempted['body']['ok'] is False,attempted
                rejected=await state(page)
                assert rejected['profile']['wallet']==before['profile']['wallet'],rejected['profile']
                assert rejected['profile']['home']==before['profile']['home'],rejected['profile']
                await page.locator('[data-move="rent"]').click()
                rented=await wait_state(page,lambda s:s['profile']['home']['propertyId']=='lugbe-flat')
                assert before['profile']['wallet']-rented['profile']['wallet']==home['rent'],{'property':home,'before':before['profile'],'after':rented['profile']}
                assert rented['profile']['district']==before['profile']['district'],'Renting teleported the resident'
                await page.reload(wait_until='domcontentloaded')
                persisted=await state(page)
                assert persisted['profile']['home']['propertyId']=='lugbe-flat'
                return {'furniture':entry,'rentalCost':home['rent'],'rentPeriod':home.get('rentPeriod',before.get('economyMeta',{})),'unaffordablePurchaseRejected':True,'rentalPersisted':True}
            await qa.check('Owned furniture placement survives reload and housing prices preserve travel and affordability',furniture_and_rental)

            async def phone_blocks_motion():
                await outside(page)
                direction='d'
                probe=await move_key(page,direction,300)
                if distance(probe[0],probe[2])<5:
                    direction='a';probe=await move_key(page,direction,300)
                assert distance(probe[0],probe[2])>5,probe
                await open_phone(page,'map')
                search=page.locator('#phone-root input[type="search"],#phone-root [name="search"]').first
                if await search.count():
                    await search.fill('Wuse')
                before=await motion(page)
                await page.keyboard.down(direction);await page.wait_for_timeout(650);await page.keyboard.up(direction)
                after=await motion(page)
                assert distance(before,after)<.5,{'before':before,'after':after}
                await no_overflow(page)
                await close_phone(page)
                resumed=await move_key(page,direction,400)
                assert distance(resumed[0],resumed[2])>5,resumed
                return {'blockedDistance':distance(before,after),'resumedDistance':distance(resumed[0],resumed[2])}
            if not regressions:
                await qa.check('Phone focus blocks world controls and closing it restores movement',phone_blocks_motion)

            async def mobile_controls():
                await phone.goto(target,wait_until='domcontentloaded')
                wizard=await finish_wizard(phone,'Mobile Motion QA','braids','explore')
                joystick=phone.locator('.world-joystick')
                await expect(joystick).to_be_visible()
                await joystick.scroll_into_view_if_needed()
                box=await joystick.bounding_box();assert box, 'Joystick has no touch target'
                center={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}
                before=await motion(phone)
                cdp=await mobile.new_cdp_session(phone)
                await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':center['x'],'y':center['y'],'radiusX':5,'radiusY':5}]})
                await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':center['x']+34,'y':center['y'],'radiusX':5,'radiusY':5}]})
                await phone.wait_for_timeout(600)
                moving=await motion(phone)
                await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                await cdp.detach()
                assert distance(before,moving)>15 and moving['moving'],{'before':before,'moving':moving}
                metrics=await no_overflow(phone)
                await open_phone(phone,'wallet');blocked=await motion(phone)
                await phone.keyboard.down('d');await phone.wait_for_timeout(400);await phone.keyboard.up('d')
                assert distance(blocked,await motion(phone))<.5
                await no_overflow(phone)
                await phone.screenshot(path=str(ARTIFACTS/'mobile-phone-blocking.png'),full_page=True)
                await close_phone(phone)
                await phone.screenshot(path=str(ARTIFACTS/'mobile-joystick-world.png'),full_page=True)
                return {'wizard':wizard,'movement':distance(before,moving),'metrics':metrics}
            if not regressions:
                await qa.check('Mobile joystick moves the resident with a usable phone and no overflow',mobile_controls)

            async def persistence_and_integrity():
                before=await state(page)
                pose_before=await motion(page)
                parked_before=await page.locator('.world-parked-car').get_attribute('transform') if await page.locator('.world-parked-car').count() else None
                await page.reload(wait_until='domcontentloaded')
                await expect(page.locator('#onboarding-form')).to_have_count(0)
                after=await state(page)
                pose_after=await motion(page)
                assert distance(pose_before,pose_after)<.1,{'before':pose_before,'after':pose_after}
                assert math.hypot(pose_before['cameraX']-pose_after['cameraX'],pose_before['cameraY']-pose_after['cameraY'])<20,{'before':pose_before,'after':pose_after}
                if parked_before is not None:
                    assert await page.locator('.world-parked-car').get_attribute('transform')==parked_before
                for key in ('wallet','inventory','appearance','home','onboardingComplete','lifeGoal'):
                    assert after['profile'][key]==before['profile'][key],{'key':key,'before':before['profile'][key],'after':after['profile'][key]}
                assert not after.get('people') and not after.get('friends') and not after.get('conversations')
                assert not qa.api_wire,qa.api_wire
                assert not qa.errors,qa.errors
                assert hashlib.sha256((REPO/'preview/index.html').read_bytes()).hexdigest()==qa.source_hash,'Preview bundle changed during acceptance'
                return {'savedFields':['wallet','inventory','appearance','home','lifeGoal'],'noFakeResidents':True,'outboundApiRequests':0,'uncaughtBrowserErrors':0,'savedMotion':{'before':pose_before,'after':pose_after},'parkedCarRetained':parked_before is not None}
            if not regressions:
                await qa.check('Reload preserves the resident without fake people or outbound game API requests',persistence_and_integrity)
            else:
                assert hashlib.sha256((REPO/'preview/index.html').read_bytes()).hexdigest()==qa.source_hash,'Preview bundle changed during acceptance'
            await browser.close()
    finally:
        qa.save();server.shutdown();server.server_close();thread.join(timeout=3)
    failures=[result for result in qa.results if result['status']!='passed']
    print(f'Gameplay evidence: {ARTIFACTS}',flush=True)
    return 1 if failures or qa.errors or qa.api_wire else 0


if __name__=='__main__':
    raise SystemExit(asyncio.run(main()))

#!/usr/bin/env python3
"""End-to-end acceptance for the premium life-simulation upgrade.

Run after application files settle and `npm run preview:build` completes.
Uses real Chromium/WebGL with SwiftShader, disposable server residents/SQLite,
and fresh browser-local preview contexts. UI actions acquire every game balance,
car and investment; this suite never seeds or edits a wallet. Captured real
requests are replayed only to verify idempotency. No paid transaction occurs.
Artifacts stay outside the checkout in /workspace/scratch/premium-qa.
Set ABUJALIFE_PREMIUM_MODE to server, preview or both (default).
"""
import asyncio
import datetime
import functools
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.request
from urllib.parse import urlsplit
import uuid

from playwright.async_api import async_playwright, expect

# Software WebGL may need longer than the default 5s to mount a full scene.
expect.set_options(timeout=20000)

REPO=Path(__file__).resolve().parents[1]
RUN_ID=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]
ARTIFACTS=Path(os.environ.get('ABUJALIFE_PREMIUM_ARTIFACTS','/workspace/scratch/premium-qa'))/RUN_ID
PASSWORD='Local premium acceptance 2026!'
MAP_PATTERN=re.compile(r'https?://[^/]*(?:openstreetmap\.org|overpass-api\.de|nominatim)[/:]')
MODE=os.environ.get('ABUJALIFE_PREMIUM_MODE','both')
assert MODE in ('server','preview','both'),MODE


def source_hashes():
    paths=[p for folder in ('app','src') for p in (REPO/folder).rglob('*') if p.is_file()]
    paths += [REPO/'preview/index.html',REPO/'preview/runtime.mjs',REPO/'package.json']
    return {str(path.relative_to(REPO)):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(paths)}


# Reuse tested player controls and accessible navigation helpers, without running
# the historical suite or replacing any application/server behavior.
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('gameplay_helpers',REPO/'tests/gameplay-smoke.py')
game=importlib.util.module_from_spec(spec);spec.loader.exec_module(game)


class QuietStatic(SimpleHTTPRequestHandler):
    def log_message(self,*_):
        pass


class Evidence:
    def __init__(self):
        self.results=[];self.errors=[];self.pages=[];self.requests=[]
        self.initial=source_hashes()

    def watch(self,page,label):
        self.pages.append(page);page.set_default_timeout(15000)
        page.on('pageerror',lambda error:self.errors.append({'page':label,'error':str(error)}))
        def record(request):
            if '/api/' in request.url:
                body=request.post_data_json if request.post_data else None
                if isinstance(body,dict) and 'password' in body:body={**body,'password':'[fixture redacted]'}
                self.requests.append({'page':label,'url':request.url,'method':request.method,'body':body})
        page.on('request',record)

    async def check(self,label,operation):
        started=time.monotonic()
        try:
            result={'check':label,'status':'passed','details':await operation()}
        except Exception as error:
            result={'check':label,'status':'failed','error':str(error),'traceback':traceback.format_exc()}
            for i,page in enumerate(self.pages):
                if not page.is_closed():
                    try:await page.screenshot(path=str(ARTIFACTS/f'failure-{len(self.results)}-{i}.png'),full_page=True)
                    except Exception:pass
        result['seconds']=round(time.monotonic()-started,2)
        self.results.append(result);self.save()
        print(json.dumps({k:v for k,v in result.items() if k!='traceback'}),flush=True)
        return result['status']=='passed'

    def save(self):
        ARTIFACTS.mkdir(parents=True,exist_ok=True)
        (ARTIFACTS/'report.json').write_text(json.dumps({'results':self.results,'browserErrors':self.errors,
            'requests':self.requests,'sourceHashes':self.initial,
            'fixtures':'Disposable real server residents and fresh anonymous preview contexts; actual UI game top-ups; external map sources explicitly offline; SwiftShader WebGL'},indent=2))


async def finish_cards(page,name,hair,goal,qa,label):
    await expect(page.locator('#onboarding-form')).to_be_visible()
    headings=[];observed=[]
    for step in range(8):
        form=page.locator('#onboarding-form')
        headings.append(await form.locator('h1').inner_text())
        names=form.locator('[name="displayName"]')
        if await names.count():await names.fill(name);observed.append('name')
        hair_choice=form.locator(f'[name="hair"][value="{hair}"]')
        if await hair_choice.count():
            await hair_choice.locator('xpath=..').click();await expect(hair_choice).to_be_checked();observed.append('hair')
        goal_choice=form.locator(f'[name="lifeGoal"][value="{goal}"]')
        if await goal_choice.count():await goal_choice.check();observed.append('goal')
        await game.no_overflow(page)
        await page.screenshot(path=str(ARTIFACTS/f'{label}-onboarding-{step+1}.png'),full_page=True)
        start=form.locator('#begin-life')
        if await start.count():await start.click();break
        await form.locator('[data-onboarding-next]').click()
    await expect(page.locator('#onboarding-form')).to_have_count(0)
    await expect(page.locator('#world-scene')).to_be_visible()
    saved=await game.state(page)
    assert saved['profile']['displayName']==name,saved['profile']
    assert saved['profile']['appearance']['hair']==hair,saved['profile']
    assert saved['profile']['lifeGoal']==goal and saved['profile']['onboardingComplete'],saved['profile']
    assert len(headings)==5 and len(set(headings))==5,headings
    assert sorted(observed)==['goal','hair','name'],observed
    return {'headings':headings,'profileId':saved['profile']['id'],'appearance':saved['profile']['appearance']}


async def create_resident(page,target,name,username,qa,label,preview=False):
    await page.goto(target,wait_until='domcontentloaded')
    if not preview:
        await expect(page.locator('#auth-form')).to_be_visible()
        await page.locator('#auth-form [name="displayName"]').fill(name)
        await page.locator('#auth-form [name="username"]').fill(username)
        await page.locator('#auth-form [name="password"]').fill(PASSWORD)
        await game.no_overflow(page)
        await page.screenshot(path=str(ARTIFACTS/f'{label}-signup.png'),full_page=True)
        await page.locator('.auth-submit').click()
    return await finish_cards(page,name,'braids','home',qa,label)


async def wait_webgl(page):
    await expect(page.locator('#world-scene')).to_have_attribute('data-character-renderer','webgl-3d',timeout=25000)
    layer=page.locator('#world-scene canvas.world-character-layer')
    await expect(layer).to_have_count(1)
    metrics=await layer.evaluate('''canvas=>({width:canvas.width,height:canvas.height,rect:canvas.getBoundingClientRect().toJSON(),context:!!(canvas.getContext('webgl2')||canvas.getContext('webgl'))})''')
    assert metrics['context'] and metrics['width']>0 and metrics['height']>0,metrics
    return metrics


async def wallet_topup(page,amount):
    before=(await game.state(page))['profile']['wallet']
    await game.open_phone(page,'wallet')
    await page.locator('[data-ph-action="wallet-topup"]').click()
    form=page.locator('[data-ph-form="wallet-topup"]')
    await expect(form).to_be_visible()
    await form.locator('#ph-topupAmount').fill(str(amount))
    await expect(form).to_contain_text('cannot be withdrawn as cash')
    await form.locator('[type="submit"]').click()
    await expect(page.locator('.ph-review-card')).to_contain_text(f'₦{amount:,}')
    await page.locator('[data-ph-action="wallet-confirm"]').click()
    await expect(page.locator('.ph-wallet-receipt')).to_contain_text('TOP-UP COMPLETE')
    saved=await game.wait_state(page,lambda s:s['profile']['wallet']==before+amount)
    await expect(page.locator('.ph-scroll')).to_contain_text('Naira')
    await game.close_phone(page)
    return {'before':before,'amount':amount,'after':saved['profile']['wallet']}


async def check_clean_world(page,label):
    await game.close_sheet(page);await game.close_phone(page);await game.navigate(page,'world')
    model=await wait_webgl(page)
    await expect(page.locator('.game-nav>button')).to_have_count(4)
    assert await page.locator('.play-guide,.play-hud,.world-toolbar').count()==0,'Old stacked HUD remains in the rendered game'
    await expect(page.locator('.wallet-button')).to_contain_text('Naira balance')
    assert (await page.locator('.world-location-chip').bounding_box())['height']<=55,'Location chrome is too large'
    await game.no_overflow(page)
    before,middle,after=await game.move_key(page,'d',700)
    assert game.distance(before,after)>12 and (middle['moving'] or after['moving']),{'before':before,'middle':middle,'after':after}
    await page.screenshot(path=str(ARTIFACTS/f'{label}-3d-world.png'),full_page=True)
    return {'WebGL':model,'movement':game.distance(before,after),'navigationButtons':4,'stackedHudCards':0}


async def paint_and_drive(page,label):
    await game.outside(page)
    initial=await game.state(page)
    cars=[item for item in initial['catalog'] if item['category']=='vehicle']
    assert {'Toyota','BMW','Mercedes-Benz','Mercedes-AMG'}<=set(car.get('brand') for car in cars),cars
    selected=next(item for item in cars if item['id']=='mercedes-g63')
    await game.open_world_tool(page,'garage')
    card=page.locator('.garage-card').filter(has=page.locator('[data-purchase="mercedes-g63"]'))
    await expect(card).to_contain_text('G-Wagon')
    await card.locator('[data-car-paint="mercedes-g63"][value="red"]').locator('xpath=..').click()
    before=(await game.state(page))['profile']['wallet']
    await card.locator('[data-purchase="mercedes-g63"]').click()
    saved=await game.wait_state(page,lambda s:selected['id'] in s['profile']['inventory'])
    assert before-saved['profile']['wallet']==selected['price'],{'before':before,'saved':saved['profile'],'car':selected}
    assert saved['profile']['vehicleColors'][selected['id']]=='red',saved['profile']
    await game.open_world_tool(page,'garage')
    owned=page.locator('.garage-card').filter(has=page.locator('[data-drive="mercedes-g63"]'))
    await owned.locator('[data-car-paint="mercedes-g63"][value="blue"]').locator('xpath=..').click()
    painted=await game.wait_state(page,lambda s:s['profile']['vehicleColors'].get(selected['id'])=='blue')
    await game.open_world_tool(page,'garage')
    await page.locator('[data-drive="mercedes-g63"]').click()
    await expect(page.locator('#world-scene')).to_have_attribute('data-driving','true')
    before,middle,after=await game.move_key(page,'d',900)
    assert middle['driving'] and game.distance(before,after)>30,{'before':before,'middle':middle,'after':after}
    await wait_webgl(page)
    await page.screenshot(path=str(ARTIFACTS/f'{label}-g-wagon-driving.png'),full_page=True)
    await page.reload(wait_until='domcontentloaded')
    restored=await game.state(page)
    assert restored['profile']['vehicleColors'][selected['id']]=='blue',restored['profile']
    assert restored['profile']['drivingVehicle']==selected['id'],restored['profile']
    return {'model':selected['name'],'cost':selected['price'],'purchasePaint':'red','repaint':'blue','drivenDistance':game.distance(before,after),'reloadPersisted':True}


async def buy_investment(page):
    await game.close_phone(page);await game.navigate(page,'property')
    await page.locator('[data-property-tab="investments"]').click()
    await page.locator('[data-invest-property="lugbe-flat"]').click()
    before=await game.state(page)
    prop=next(item for item in before['properties'] if item['id']=='lugbe-flat')
    await page.locator('[data-buy-investment="lugbe-flat"]').click()
    bought=await game.wait_state(page,lambda s:bool(s['profile'].get('propertyInvestments',{}).get('lugbe-flat')))
    assert before['profile']['wallet']-bought['profile']['wallet']==prop['buy'],{'before':before['profile'],'after':bought['profile'],'property':prop}
    assert bought['profile']['home']==before['profile']['home'],'Investment purchase changed main residence'
    assert bought['profile']['location']==before['profile']['location'],'Investment purchase teleported resident'
    return {'propertyId':prop['id'],'cost':prop['buy'],'investment':bought['profile']['propertyInvestments'][prop['id']]}


async def collect_and_sell(page,preview=False):
    await game.close_phone(page);await game.close_sheet(page)
    initial=await game.state(page)
    holding=initial['profile']['propertyInvestments']['lugbe-flat']
    wait_ms=max(0,holding['boughtAt']+60000-await page.evaluate('Date.now()'))+250
    if wait_ms>0:
        await page.wait_for_timeout(wait_ms)
    await game.navigate(page,'property')
    await page.locator('[data-property-tab="investments"]').click()
    await page.locator('[data-invest-property="lugbe-flat"]').click()
    before=await game.state(page)
    await page.locator('[data-collect-rent="lugbe-flat"]').click()
    paid=await game.wait_state(page,lambda s:s['profile']['wallet']>before['profile']['wallet'])
    income=paid['profile']['wallet']-before['profile']['wallet']
    assert income>=holding['incomePerPeriod'] and income%holding['incomePerPeriod']==0,{'holding':holding,'income':income}
    await game.navigate(page,'property')
    await page.locator('[data-property-tab="investments"]').click()
    await page.locator('[data-invest-property="lugbe-flat"]').click()
    before_sell=await game.state(page)
    await page.locator('[data-sell-investment="lugbe-flat"]').click()
    sold=await game.wait_state(page,lambda s:'lugbe-flat' not in s['profile'].get('propertyInvestments',{}))
    assert sold['profile']['wallet']-before_sell['profile']['wallet']==holding['resaleValue'],{'holding':holding,'before':before_sell['profile'],'after':sold['profile']}
    await page.reload(wait_until='domcontentloaded')
    assert 'lugbe-flat' not in (await game.state(page))['profile'].get('propertyInvestments',{})
    return {'incomeCollected':income,'resale':holding['resaleValue'],'positionRemovedAndPersisted':True}


async def venue_expansion(page,label):
    await game.outside(page)
    visits=[]
    for venue_id,action_id,need in [('mosque','mosque-prayer','stress'),('church','church-community','social'),('club','club-dance','fun')]:
        route=await game.choose_venue(page,venue_id)
        await wait_webgl(page)
        before=await game.state(page)
        activity=next(item for item in before['venueActions'] if item['id']==action_id)
        await game.open_world_tool(page,'activity')
        await page.locator(f'[data-venue-activity="{action_id}"]').click()
        after=await game.wait_state(page,lambda s:s['profile'][need]==max(0,min(100,before['profile'][need]+activity['effects'][need])),40)
        assert before['profile']['wallet']-after['profile']['wallet']==activity['cost'],{'activity':activity,'before':before['profile'],'after':after['profile']}
        await page.screenshot(path=str(ARTIFACTS/f'{label}-venue-{venue_id}.png'),full_page=True)
        visits.append({'venue':venue_id,'activity':action_id,'cost':activity['cost'],'need':need,'after':after['profile'][need],'movementRoute':route})
        await game.outside(page)
    await game.choose_venue(page,'gym')
    # Meaningful accessible scene labels prove equipment is present, rather than
    # accepting a venue title over an empty room.
    await expect(page.locator('#world-scene [data-world-object="treadmill"]')).to_have_count(3)
    await expect(page.locator('#world-scene [data-world-object="free-weights"]')).to_have_count(1)
    await expect(page.locator('#world-scene [data-world-object="bench-press"]')).to_have_count(1)
    await page.screenshot(path=str(ARTIFACTS/f'{label}-gym-equipment.png'),full_page=True)
    await game.outside(page)
    return {'visits':visits,'gymEquipment':['treadmills','free weights']}


async def travel_and_lake(page,label,preview=False):
    await game.outside(page);await game.navigate(page,'map')
    await page.locator('[aria-label="Find a district or town"]').fill('Jabi')
    await page.locator('.abuja-map-place').filter(has=page.get_by_text('Jabi',exact=True)).first.click()
    await page.locator('.abuja-map-travel').click()
    await page.locator('#travel-form [name="mode"]').select_option('bus')
    await page.locator('#travel-form [type="submit"]').click()
    trip=(await game.wait_state(page,lambda s:bool(s['profile'].get('activeTrip'))))['profile']['activeTrip']
    await expect(page.locator('.trip-banner')).to_be_visible()
    await wait_webgl(page)
    await page.wait_for_function("()=>Boolean(document.querySelector('#world-scene')?.dataset.playerModelBounds)")
    # Project the real 3D vehicle's bounding box through its active camera. This
    # includes the roof and tests the transport people actually see.
    car=await page.locator('#world-scene').evaluate('el=>JSON.parse(el.dataset.playerModelBounds)')
    banner=await page.locator('.trip-banner').bounding_box()
    assert car and car['width']>0 and car['height']>0 and banner,{'car':car,'banner':banner}
    overlap=max(0,min(car['x']+car['width'],banner['x']+banner['width'])-max(car['x'],banner['x']))*max(0,min(car['y']+car['height'],banner['y']+banner['height'])-max(car['y'],banner['y']))
    assert overlap==0,{'car':car,'banner':banner,'overlapPixels':overlap}
    before=await game.motion(page);await page.wait_for_timeout(400);after=await game.motion(page)
    journey_movement=game.distance(before,after)
    assert journey_movement>2,{'before':before,'after':after}
    await page.screenshot(path=str(ARTIFACTS/f'{label}-unobscured-journey.png'),full_page=True)
    # Let visible travel finish naturally under the real browser clock.
    await game.wait_state(page,lambda s:s['profile']['district']=='jabi' and not s['profile'].get('activeTrip'),40)
    await game.choose_venue(page,'jabi-lake')
    await expect(page.locator('.world-location-chip')).to_contain_text('Jabi Lake')
    assert await page.locator('.world-lake-ripple').count()>0,'Lake has no authored water geometry'
    before=await game.state(page)
    await game.open_world_tool(page,'activity');await page.locator('[data-venue-activity="lake-walk"]').click()
    after=await game.wait_state(page,lambda s:s['profile']['fun']==min(100,before['profile']['fun']+20),40)
    await page.screenshot(path=str(ARTIFACTS/f'{label}-jabi-lake.png'),full_page=True)
    return {'destination':'jabi','tripSeconds':trip['seconds'],'bannerOverlapPixels':overlap,'journeyMotion':journey_movement,'lakesideActivity':'lake-walk'}


async def transfer_to_real_resident(page,recipient,qa,label):
    sender_before=await game.state(page);recipient_before=await game.state(recipient)
    receiver=recipient_before['profile']
    await game.open_phone(page,'wallet')
    await page.locator('[data-ph-action="wallet-send"]').click()
    await page.locator(f'[data-ph-action="wallet-recipient"][data-id="{receiver["id"]}"]').click()
    form=page.locator('[data-ph-form="wallet-transfer"]')
    await form.locator('#ph-transferAmount').fill('6500')
    await form.locator('#ph-transferNote').fill('A real resident transfer in browser QA')
    await form.locator('[type="submit"]').click()
    await expect(page.locator('.ph-review-card')).to_contain_text(receiver['displayName'])
    await expect(page.locator('.ph-review-card')).to_contain_text('@'+receiver['username'])
    await expect(page.locator('.ph-review-card')).to_contain_text('₦6,500')
    await page.locator('[data-ph-action="wallet-confirm"]').click()
    await expect(page.locator('.ph-wallet-receipt')).to_contain_text('TRANSFER COMPLETE')
    sender_after=await game.wait_state(page,lambda s:s['profile']['wallet']==sender_before['profile']['wallet']-6500)
    receiver_after=await game.wait_state(recipient,lambda s:s['profile']['wallet']==recipient_before['profile']['wallet']+6500)
    request=next(r for r in reversed(qa.requests) if r['page']==label and r['url'].endswith('/api/wallet/transfer') and r['method']=='POST')
    assert request['body']['residentId']==receiver['id'],request
    assert request['body']['amount']==6500 and request['body']['idempotencyKey'],request
    replay=await page.evaluate("""async args=>{const response=await fetch('/api/wallet/transfer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)});return {status:response.status,body:await response.json()}}""",request['body'])
    assert replay['status']==200 and replay['body'].get('replayed') is True,replay
    assert (await game.state(page))['profile']['wallet']==sender_after['profile']['wallet']
    assert (await game.state(recipient))['profile']['wallet']==receiver_after['profile']['wallet']
    await game.open_phone(recipient,'wallet')
    await expect(recipient.locator('.ph-scroll')).to_contain_text('₦6,500')
    await recipient.screenshot(path=str(ARTIFACTS/'real-recipient-wallet.png'),full_page=True)
    await game.close_phone(page);await game.close_phone(recipient)
    await page.reload(wait_until='domcontentloaded');await recipient.reload(wait_until='domcontentloaded')
    assert (await game.state(page))['profile']['wallet']==sender_after['profile']['wallet']
    assert (await game.state(recipient))['profile']['wallet']==receiver_after['profile']['wallet']
    return {'actualSenderId':sender_after['profile']['id'],'actualRecipientId':receiver['id'],'amount':6500,'fee':0,'senderDelta':-6500,'recipientDelta':6500,'replayedRequestCreditsNeitherAgain':True,'bothSidesPersistAfterReload':True}


async def dice_game(page,qa,label):
    await game.choose_venue(page,'games-lounge')
    await game.open_world_tool(page,'activity')
    await expect(page.locator('#dice-form')).to_be_visible()
    before=await game.state(page)
    await page.locator('#dice-form [name="stake"]').fill('100')
    await page.locator('#dice-form [name="choice"][value="high"]').check()
    await page.locator('#dice-form [type="submit"]').click()
    saved=await game.wait_state(page,lambda s:bool(s['profile'].get('lastGambleRound')))
    round=saved['profile']['lastGambleRound']
    assert round['choice']=='high' and round['stake']==100 and 1<=round['die']<=6,round
    assert round['won']==(round['die']>=4),round
    assert saved['profile']['wallet']-before['profile']['wallet']==(100 if round['won'] else -100),{'round':round,'before':before['profile']['wallet'],'after':saved['profile']['wallet']}
    await expect(page.locator('[data-dice-result]')).not_to_contain_text('Rolling…')
    if label=='server':
        request=next(r for r in reversed(qa.requests) if r['page']==label and r['body'] and r['body'].get('action')=='play-dice')
        replay=await page.evaluate("""async body=>{const response=await fetch('/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()}}""",request['body'])
        assert replay['status']==200 and replay['body'].get('replayed') is True,replay
        assert (await game.state(page))['profile']['wallet']==saved['profile']['wallet']
    await page.screenshot(path=str(ARTIFACTS/f'{label}-dice-result.png'),full_page=True)
    await game.close_sheet(page);await game.outside(page)
    return {'round':round,'walletDelta':saved['profile']['wallet']-before['profile']['wallet'],'realRandomRoll':True,'replayDoesNotRerollOrChargeAgain':label=='server'}


async def preview_social_truth(page):
    current=await game.state(page)
    assert not current.get('people') and not current.get('friends') and not current.get('conversations'),current
    assert current.get('walletMeta',{}).get('transferEnabled') is False,current.get('walletMeta')
    await game.open_phone(page,'wallet')
    await expect(page.locator('[data-ph-action="wallet-send"]')).to_be_disabled()
    await expect(page.locator('.ph-scroll')).to_contain_text('registered residents')
    await game.close_phone(page)
    return {'fakeResidents':0,'browserLocalTransfersDisabled':True,'sharedChatRequiresActualGameServer':True}


async def rich_home_upgrade(page,label,preview=False):
    await game.close_sheet(page);await game.close_phone(page)
    await wallet_topup(page,5000000)
    await game.navigate(page,'property')
    await page.locator('[data-property="maitama-villa"]').click()
    await expect(page.locator('#house-tour')).to_have_attribute('data-environment-renderer','webgl-3d',timeout=25000)
    before=await game.state(page)
    home=next(item for item in before['properties'] if item['id']=='maitama-villa')
    await page.locator('[data-move="own"]').click()
    bought=await game.wait_state(page,lambda s:s['profile']['home']['propertyId']=='maitama-villa')
    assert before['profile']['wallet']-bought['profile']['wallet']==home['buy'],{'before':before['profile'],'after':bought['profile'],'home':home}
    assert bought['profile']['district']==before['profile']['district'],'Buying a rich home teleported its owner'
    await game.outside(page)
    await game.open_home_door(page)
    await page.locator('#travel-form [type="submit"]').click()
    trip=(await game.wait_state(page,lambda s:bool(s['profile'].get('activeTrip'))))['profile']['activeTrip']
    # Let visible travel finish naturally under the real browser clock.
    await game.wait_state(page,lambda s:s['profile']['location']['kind']=='home' and s['profile']['district']=='maitama',40)
    await wait_webgl(page)
    await expect(page.locator('#world-scene')).to_have_attribute('data-home-property','maitama-villa')
    kinds=await page.locator('#world-scene').evaluate('el=>JSON.parse(el.dataset.environmentObjects)')
    assert 'lake' in kinds,{'villaObjects':kinds}
    before_items=(await game.state(page))['profile']['wallet']
    for item_id in ('portable-ac','premium-sofa'):
        await game.open_world_tool(page,'furnish')
        product=page.locator(f'[data-product-model="{item_id}"]').first
        await expect(product).to_have_attribute('data-product-renderer','webgl-3d',timeout=25000)
        await page.locator(f'[data-purchase="{item_id}"]').click()
        await game.wait_state(page,lambda s:item_id in s['profile']['inventory'])
    purchased=await game.state(page)
    assert before_items-purchased['profile']['wallet']==101000,purchased['profile']
    await page.locator('[data-place-furniture="portable-ac"]').click()
    await expect(page.locator('#world-scene')).to_have_attribute('data-furniture-mode','portable-ac')
    box=await page.locator('#world-scene .world-scene').bounding_box()
    entry=None
    for x,y in ((.58,.62),(.38,.72),(.72,.72),(.48,.8),(.25,.62),(.58,.48)):
        await page.mouse.click(box['x']+box['width']*x,box['y']+box['height']*y)
        await page.wait_for_timeout(500)
        layout=(await game.state(page))['profile'].get('furnitureLayout',[])
        entry=next((item for item in layout if item.get('itemId')=='portable-ac'),None) if isinstance(layout,list) else layout.get('portable-ac')
        if entry:break
    assert entry and 0<=entry['x']<=1 and 0<=entry['y']<=1,{'layout':layout,'floorClicksAttempted':6}
    await page.keyboard.press('Escape')
    await page.reload(wait_until='domcontentloaded')
    restored=await game.state(page)
    assert restored['profile']['home']['propertyId']=='maitama-villa' and restored['profile']['home']['tenure']=='own',restored['profile']
    assert {'portable-ac','premium-sofa'}<=set(restored['profile']['inventory']),restored['profile']
    assert restored['profile']['furnitureLayout']==layout,restored['profile']
    await wait_webgl(page)
    kinds=await page.locator('#world-scene').evaluate('el=>JSON.parse(el.dataset.environmentObjects)')
    assert 'portable-ac' in kinds,kinds
    await page.screenshot(path=str(ARTIFACTS/f'{label}-maitama-villa-upgrades.png'),full_page=True)
    return {'ownedHome':'maitama-villa','gamePrice':home['buy'],'actualJourney':trip['seconds'],'poolIs3D':True,'upgradesCost':101000,'placedAirConditioner':entry,'purchaseAndLayoutPersisted':True}


async def private_api_stays_uncached(page):
    # This is the real production service worker, not a test replacement.
    await page.evaluate("async()=>{await navigator.serviceWorker.ready}")
    await page.wait_for_timeout(300)
    cache=await page.evaluate("""async()=>{const names=await caches.keys(),urls=[];for(const name of names){const bucket=await caches.open(name);for(const request of await bucket.keys())urls.push(request.url);}return{names,urls}}""")
    assert cache['urls'],'Application shell was not cached by the real service worker'
    assert not [url for url in cache['urls'] if '/api/' in url],cache
    return {'serviceWorkerCaches':cache['names'],'shellRequestsCached':len(cache['urls']),'privateApiRequestsCached':0}


async def webgl_fallback(browser,target,preview,qa,label):
    context=await browser.new_context(viewport={'width':360,'height':800},is_mobile=True,has_touch=True)
    await context.route(MAP_PATTERN,lambda route:route.abort('failed'))
    # An explicit device-capability fixture models a phone that cannot create a
    # WebGL context. It does not intercept gameplay APIs or alter player state.
    await context.add_init_script("""(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^(webgl|webgl2|experimental-webgl)$/.test(kind)?null:original.call(this,kind,...args)}})()""")
    page=await context.new_page();qa.watch(page,label+'-fallback')
    try:
        await create_resident(page,target,'Fallback Resident QA','qa_fallback_'+label,qa,label+'-fallback',preview)
        await page.wait_for_timeout(400)
        assert await page.locator('#world-scene').get_attribute('data-character-renderer')!='webgl-3d','Unavailable GPU was presented as active3D'
        await expect(page.locator('.world-player-walker .walker-body')).to_be_visible()
        before,middle,after=await game.move_key(page,'d',700)
        assert game.distance(before,after)>10 and middle['moving'],{'before':before,'middle':middle,'after':after}
        await game.no_overflow(page)
        await page.screenshot(path=str(ARTIFACTS/f'{label}-no-webgl-fallback.png'),full_page=True)
        return {'deviceCapability':'WebGL context unavailable','authoredCharacterVisible':True,'movement':game.distance(before,after),'viewport':[360,800]}
    finally:await context.close()


async def main():
    ARTIFACTS.mkdir(parents=True,exist_ok=True)
    qa=Evidence();process=None;static=None;thread=None
    with tempfile.TemporaryDirectory(prefix='abujalife-premium-qa-') as data_dir:
        targets=[]
        if MODE in ('server','both'):
            with socket.socket() as probe:probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
            target=f'http://127.0.0.1:{port}'
            log=(ARTIFACTS/'server.log').open('w')
            process=subprocess.Popen(['node','scripts/dev.mjs'],cwd=REPO,env=dict(os.environ,PORT=str(port),ABUJALIFE_DATA_DIR=data_dir),stdout=log,stderr=subprocess.STDOUT)
            for _ in range(150):
                if process.poll() is not None:raise RuntimeError('Disposable server exited; inspect server.log')
                try:
                    with urllib.request.urlopen(target+'/api/health',timeout=1) as response:
                        if response.status==200:break
                except Exception:await asyncio.sleep(.1)
            else:raise RuntimeError('Disposable server did not start')
            targets.append(('server',target,False))
        if MODE in ('preview','both'):
            handler=functools.partial(QuietStatic,directory=str(REPO/'preview'))
            static=ThreadingHTTPServer(('127.0.0.1',0),handler)
            thread=threading.Thread(target=static.serve_forever,daemon=True);thread.start()
            targets.append(('preview',f'http://127.0.0.1:{static.server_port}/index.html',True))
        try:
            async with async_playwright() as playwright:
                browser=await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
                for label,target,preview in targets:
                    context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
                    await context.route(MAP_PATTERN,lambda route:route.abort('failed'))
                    page=await context.new_page();qa.watch(page,label)
                    # Use normal browser time: the premium suite does not need a
                    # fake clock, which also replaces animation-frame scheduling.
                    async def signup():return await create_resident(page,target,label+' Premium QA','qa_premium_'+label,qa,label,preview)
                    if not await qa.check(label+': premium card-by-card signup saves selected appearance and life goal',signup):
                        await context.close();continue
                    await qa.check(label+': uncluttered four-button UI renders and moves an actual WebGL human',lambda:check_clean_world(page,label))
                    await qa.check(label+': free game Naira top-up is credited through the wallet UI',lambda:wallet_topup(page,5000000))
                    if preview:
                        await qa.check('preview: anonymous local game does not fake shared residents or transfers',lambda:preview_social_truth(page))
                    else:
                        receiver_context=await browser.new_context(viewport={'width':1440,'height':1000})
                        await receiver_context.route(MAP_PATTERN,lambda route:route.abort('failed'))
                        receiver=await receiver_context.new_page();qa.watch(receiver,'actual-recipient')
                        async def receiver_signup():return await create_resident(receiver,target,'Recipient Premium QA','qa_premium_receiver',qa,'recipient',False)
                        if await qa.check('server: create an independent recipient with a distinct session',receiver_signup):
                            await qa.check('server: send game Naira to a real resident once and persist both ledgers',lambda:transfer_to_real_resident(page,receiver,qa,label))
                        await receiver_context.close()
                    await qa.check(label+': buying an investment changes only game finances, not residence or location',lambda:buy_investment(page))
                    await qa.check(label+': real branded G-Wagon supports paint selection, repaint, driving and persistence',lambda:paint_and_drive(page,label))
                    await qa.check(label+': mosque, church and club activities work, and gym contains equipment',lambda:venue_expansion(page,label))
                    await qa.check(label+': a real random dice round updates game money and cannot be replayed for another payout',lambda:dice_game(page,qa,label))
                    await qa.check(label+': compact journey UI leaves moving transport visible, then Jabi Lake is playable',lambda:travel_and_lake(page,label,preview))
                    await qa.check(label+': property rent can be collected, then sold and persists after reload',lambda:collect_and_sell(page,preview))
                    await qa.check(label+': a Maitama villa and useful 3D house upgrades can be bought, reached, arranged and saved',lambda:rich_home_upgrade(page,label,preview))
                    if not preview:await qa.check('server: real service worker caches shell assets but no private financial API',lambda:private_api_stays_uncached(page))
                    await qa.check(label+': a phone without WebGL keeps a visible, playable fallback',lambda:webgl_fallback(browser,target,preview,qa,label))
                    await context.close()
                async def integrity():
                    assert not qa.errors,qa.errors
                    assert source_hashes()==qa.initial,'Application source changed during acceptance; freeze and rerun'
                    preview_origin=next((urlsplit(url).netloc for label,url,_ in targets if label=='preview'),None)
                    preview_requests=[r for r in qa.requests if r['page']=='preview' and urlsplit(r['url']).netloc==preview_origin]
                    assert not preview_requests,preview_requests
                    return {'sourceFilesHashed':len(qa.initial),'uncaughtJavaScriptErrors':0,'previewOutboundApiRequests':0}
                await qa.check('Published candidate source stays frozen and anonymous preview creates no game API traffic',integrity)
                await browser.close()
        finally:
            if process:
                process.terminate()
                try:process.wait(timeout=5)
                except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
                log.close()
            if static:static.shutdown();static.server_close();thread.join(timeout=3)
            qa.save()
    failed=[r for r in qa.results if r['status']!='passed']
    print(json.dumps({'passed':len(qa.results)-len(failed),'failed':len(failed),'report':str(ARTIFACTS/'report.json')}),flush=True)
    return int(bool(failed or qa.errors))


if __name__=='__main__':raise SystemExit(asyncio.run(main()))

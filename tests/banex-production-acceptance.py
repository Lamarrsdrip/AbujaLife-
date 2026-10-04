#!/usr/bin/env python3
"""Focused real production Banex acceptance at 390×844.

Uses the actual dist and Mongo API through the existing local TLS/domain proxy.
No API mocks, origin overrides, wallet grants or client-state changes. The shop
and authored floor positions are game scenery; this does not verify a real
Banex address, precise map pin, public hosting or physical iOS.
"""
import asyncio
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
from urllib.parse import urlsplit
import uuid

from playwright.async_api import async_playwright, expect

sys.dont_write_bytecode=True
REPO=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('latest_acceptance_helpers',REPO/'tests/latest-production-acceptance.py')
helpers=importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
base=helpers.base
base.ARTIFACTS=Path(os.environ.get('ABUJALIFE_QA_ARTIFACTS','/workspace/scratch/banex-production-acceptance'))/base.RUN_ID
ARTIFACTS=base.ARTIFACTS
api=base.api
state=helpers.state
wait_state=helpers.wait_state
expect.set_options(timeout=30000)


def passed(report,name,**details):
    report['checks'].append({'check':name,'status':'passed',**({'details':details} if details else {})})


async def pose(page):
    return await page.locator('#world-scene').evaluate('el=>({x:Number(el.dataset.playerX),y:Number(el.dataset.playerY),distance:Number(el.dataset.distance),moving:el.dataset.moving,nearby:el.dataset.nearby})')


async def snapshot(page,filename):
    await page.wait_for_timeout(750)
    if await page.locator('#toast.visible').count():
        await page.wait_for_function('()=>!document.querySelector("#toast.visible")',timeout=6000)
    await page.screenshot(path=str(ARTIFACTS/filename),full_page=True,animations='disabled')


async def run_browser(report,certificate_spki):
    report['scope']='Actual newly rebuilt production Banex venue and shop against the real disposable Mongo API;390×844 touch Chromium over the repository local TLS/domain proxy.'
    report['fixture_policy']='Real registrations, explicit gender and random starter balances only. Real UI quotes, trips, purchase, placement and optional two-account transfer; no mock, top-up, grant or state override.'
    report['limitations'].append('Local touch Chromium with SwiftShader does not verify physical iOS or physical-device frame rates.')
    report['limitations'].append('Banex is original game scenery; this run does not verify a real-world address, map pin, retailer stock or price.')
    report['dist_hashes']={str(p.relative_to(base.DIST)):hashlib.sha256(p.read_bytes()).hexdigest() for p in base.DIST.rglob('*') if p.is_file()}
    async with async_playwright() as playwright:
        replacement=f'127.0.0.1:{base.TLS_PORT}'
        browser=await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',f'--ignore-certificate-errors-spki-list={certificate_spki}',f'--host-resolver-rules=MAP abujacity.life {replacement}, MAP api.abujacity.life {replacement}'])
        context=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
        page=await context.new_page()
        errors,network,actions=[],[],[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('response',lambda r:network.append({'origin':urlsplit(r.url).netloc,'path':urlsplit(r.url).path,'status':r.status}))
        def record(request):
            if request.method=='POST' and urlsplit(request.url).path=='/api/action':
                actions.append(request.post_data_json)
        page.on('request',record)
        try:
            profile=await base.register(page,'Banex acceptance','banex_'+uuid.uuid4().hex[:10],'feminine')
            starting=await state(page)
            assert profile['home']['district']!='wuse-ii-a08'
            venue=next(v for v in starting['venues'] if v['id']=='banex')
            assert venue['districts']==['wuse-ii-a08'] and venue.get('settingSource')=='authored-game-scenery'
            passed(report,'Actual Female signup receives a random starter home and the authored Banex destination',origin=profile['origin'],home=profile['home'],wallet=profile['wallet'])

            await page.locator('[data-nav-places]').click()
            await page.locator('[data-city-map]').click()
            await expect(page.locator('.abuja-map-search input')).to_be_visible()
            await page.locator('.abuja-map-search input').fill('Banex')
            await page.locator('.abuja-map-place').filter(has_text='Banex Tech Market').click()
            await expect(page.locator('.abuja-map-selected-info>strong')).to_have_text('Banex Tech Market')
            await expect(page.locator('.abuja-map-selected .abuja-map-pin-note')).to_have_text('No precise map pin available yet.')
            assert await page.locator('.abuja-map-marker').filter(has_text='Banex').count()==0
            await helpers.no_overflow(page)
            await snapshot(page,'map-banex-search-390.png')
            async with page.expect_response(lambda r:urlsplit(r.url).path=='/api/travel/quote' and r.request.method=='GET' and 'venueId=banex' in r.url) as observed:
                await page.locator('.abuja-map-travel').click()
            first_quote=await(await observed.value).json()
            assert first_quote['quote']['venueId']=='banex' and first_quote['quote']['destination']=='wuse-ii-a08'
            await expect(page.locator('#travel-form [name="mode"][value="walk"]')).to_be_disabled()
            await expect(page.locator('#travel-form [name="mode"][value="bus"]')).to_be_enabled()
            await expect(page.locator('#travel-form [name="mode"][value="taxi"]')).to_be_enabled()
            async with page.expect_response(lambda r:urlsplit(r.url).path=='/api/travel/quote' and 'mode=taxi' in r.url) as observed:
                await page.locator('#travel-form [name="mode"][value="taxi"]').check()
            taxi_quote=await(await observed.value).json()
            assert taxi_quote['quote']['cost']>0 and taxi_quote['quote']['venueId']=='banex'
            async with page.expect_response(lambda r:urlsplit(r.url).path=='/api/travel/quote' and 'mode=bus' in r.url) as observed:
                await page.locator('#travel-form [name="mode"][value="bus"]').check()
            bus_quote=(await(await observed.value).json())['quote']
            await expect(page.locator('#travel-form [type="submit"]')).to_be_enabled()
            await snapshot(page,'banex-paid-journey-choice-390.png')
            async with page.expect_response(lambda r:urlsplit(r.url).path=='/api/action' and r.request.method=='POST' and r.request.post_data_json.get('action')=='travel',timeout=45000) as observed:
                await page.locator('#travel-form [type="submit"]').click()
            response=await observed.value
            assert response.status==200,await response.text()
            trip_state=await response.json()
            trip=trip_state['trip']
            assert trip['venueId']=='banex' and trip['destination']=='wuse-ii-a08' and trip['mode']=='bus'
            assert trip['cost']==bus_quote['cost'] and trip_state['profile']['wallet']==profile['wallet']-trip['cost']
            await expect(page.locator('.trip-banner')).to_be_visible()
            # Reload while on the real clock so the selected destination must
            # survive server persistence rather than an in-memory pending flag.
            await page.reload(wait_until='domcontentloaded')
            resumed=(await state(page))['profile']
            if resumed.get('activeTrip'):
                assert resumed['activeTrip']['id']==trip['id'] and resumed['activeTrip']['venueId']=='banex'
            else:
                assert resumed['location']['kind']=='venue' and resumed['location'].get('venue')=='banex' and resumed['district']=='wuse-ii-a08'
            arrived=await wait_state(page,lambda s:s['profile']['location']['kind']=='venue' and s['profile']['location'].get('venue')=='banex',75)
            assert arrived['profile']['district']=='wuse-ii-a08' and arrived['profile']['wallet']==profile['wallet']-trip['cost']
            passed(report,'Map search has an honest unpinned venue and real bus/taxi quotes; paid selected Banex trip survives reload and arrives in Wuse II',bus=bus_quote,taxi=taxi_quote['quote'],trip=trip)

            await helpers.wait_world(page)
            kinds=json.loads(await page.locator('#world-scene').get_attribute('data-environment-objects'))
            required=['tech-laptop-stall','tech-console-stall','tech-accessory-stall','tech-repair-bench','tech-power-stall','tech-parts-shelf']
            assert all(kind in kinds for kind in required),kinds
            assert not any(item in arrived['profile']['inventory'] for item in ('standing-fan','music-speaker','tv','gaming-console','power-inverter')),'Display stock became owned without purchase'
            await snapshot(page,'inside-banex-tech-market-390.png')
            before_walk=await pose(page)
            anchor=page.locator('[data-world-target$="browse-0"]')
            await expect(anchor).to_be_visible()
            await anchor.click()
            await expect(page.locator('#sheet-title')).to_have_text('Banex Tech Market',timeout=45000)
            after_walk=await pose(page)
            assert after_walk['distance']>before_walk['distance']+20,(before_walk,after_walk)
            await expect(page.locator('[data-banex-purchase="standing-fan"]')).to_be_visible()
            await expect(page.locator('[data-banex-purchase]')).to_have_count(7)
            await snapshot(page,'banex-shop-seven-tech-items-390.png')
            passed(report,'Actual3D tech stalls and repair counters remain scene-only; physical walking reaches the seven-item Banex shop through clear aisles',scene_objects=kinds,before=before_walk,after=after_walk)

            current=await state(page)
            catalog=current['catalog'] if isinstance(current['catalog'],list) else [dict(v,id=k) for k,v in current['catalog'].items()]
            item=next(i for i in catalog if i['id']=='standing-fan')
            before_purchase=current['profile']['wallet']
            async with page.expect_response(lambda r:urlsplit(r.url).path=='/api/action' and r.request.method=='POST' and r.request.post_data_json.get('action')=='purchase') as observed:
                await page.locator('[data-banex-purchase="standing-fan"]').click()
            response=await observed.value
            assert response.status==200,await response.text()
            purchase_request=response.request.post_data_json
            await expect(page.locator('#sheet-title')).to_have_text('Arrange '+item['name'])
            await expect(page.locator('[data-arrange-home="standing-fan"]').first).to_be_visible()
            purchased=(await state(page))['profile']
            assert purchased['location'].get('venue')=='banex' and 'standing-fan' in purchased['inventory']
            assert purchased['wallet']==before_purchase-item['price'] and purchased['furnitureLayout'].get('standing-fan') is None
            assert (await api(page,'/api/action',purchase_request))['replayed'] is True
            assert (await state(page))['profile']['wallet']==purchased['wallet']
            await snapshot(page,'banex-purchase-arrange-at-home-390.png')
            passed(report,'Banex purchase charges the actual catalogue price once, gives ownership, and opens Arrange with a home prompt without teleporting',item=item['id'],price=item['price'],walletBefore=before_purchase,walletAfter=purchased['wallet'])

            # A purchase rebuilds the world while its sheet pauses simulation.
            # Resume through real controls before measuring a new controller's
            # distance; paused initial frames have no motion dataset yet.
            await page.locator('.sheet-close').click()
            await helpers.wait_world(page)
            await page.wait_for_function('()=>{const el=document.querySelector("#world-scene");return el&&el.dataset.distance!==undefined&&Number.isFinite(Number(el.dataset.distance));}')
            before_exit=await pose(page)
            report['exit_measurement']={'before':before_exit}
            await helpers.open_furnishing(page,'standing-fan')
            await page.locator('[data-arrange-home="standing-fan"]').first.click()
            await page.wait_for_function('before=>{const el=document.querySelector("#world-scene");return el&&Number(el.dataset.distance)>before+40&&String(el.dataset.environmentObjects).includes("tech-laptop-stall");}',arg=before_exit['distance'],timeout=15000)
            walking_to_exit=await pose(page)
            report['exit_measurement']['walking']=walking_to_exit
            await expect(page.locator('#travel-form')).to_be_visible(timeout=45000)
            outside=(await state(page))['profile']
            assert outside['location']['kind']=='public' and outside['district']=='wuse-ii-a08' and outside['wallet']==purchased['wallet']
            await page.locator('#travel-form [name="mode"][value="bus"]').check()
            await expect(page.locator('#travel-form [type="submit"]')).to_be_enabled()
            await snapshot(page,'banex-return-home-paid-choice-390.png')
            async with page.expect_response(lambda r:urlsplit(r.url).path=='/api/action' and r.request.method=='POST' and r.request.post_data_json.get('action')=='return-home',timeout=45000) as observed:
                await page.locator('#travel-form [type="submit"]').click()
            response=await observed.value
            assert response.status==200,await response.text()
            home_transit=await response.json()
            return_trip=home_transit['trip']
            assert return_trip['returningHome'] and return_trip['destination']==profile['home']['district'] and return_trip['cost']>0
            assert home_transit['profile']['wallet']==purchased['wallet']-return_trip['cost']
            home=await wait_state(page,lambda s:s['profile']['location']['kind']=='home',75)
            assert home['profile']['district']==profile['home']['district']
            await expect(page.locator('#sheet-title')).to_have_text('Arrange '+item['name'])
            await helpers.wait_world(page)
            entry,taps=await helpers.floor_place(page,'standing-fan')
            assert entry['rotation']==90
            await helpers.wait_world(page)
            await expect(page.locator('[data-furniture-item="standing-fan"]').first).to_be_attached()
            await snapshot(page,'banex-standing-fan-owned-home-390.png')
            saved=(await state(page))['profile']
            await page.reload(wait_until='domcontentloaded')
            restored=(await state(page))['profile']
            assert restored['inventory']==saved['inventory'] and restored['furnitureLayout']['standing-fan']==entry and restored['wallet']==saved['wallet']
            await helpers.wait_world(page)
            await helpers.no_overflow(page)
            await expect(page.locator('[data-quick-home]')).to_be_visible()
            passed(report,'Arrange-at-home physically exits Banex, offers a paid return route and reopens the owned item; Rotate/floor placement and ownership persist',beforeExit=before_exit,walkingToExit=walking_to_exit,returnTrip=return_trip,placement=entry,floor_taps=taps)

            if os.environ.get('ABUJALIFE_QA_CHAT_CAPTURE')=='1':
                await compact_chat_capture(browser,page,report,errors,network)
            assert not errors,errors
            assert not any(n['origin']=='abujacity.life' and n['path'].startswith('/api/') for n in network)
            assert not any(n['origin']=='api.abujacity.life' and n['status']>=500 for n in network)
            assert all(report['dist_hashes'][name]==hashlib.sha256((base.DIST/name).read_bytes()).hexdigest() for name in report['dist_hashes']),'dist changed during acceptance'
            passed(report,'Focused Banex production bundle has no page errors, frontend API calls or API5xx responses')
        except Exception:
            try:
                await page.screenshot(path=str(ARTIFACTS/'failure.png'),full_page=True,timeout=5000)
                (ARTIFACTS/'failure.html').write_text(await page.content())
            except Exception:
                pass
            raise
        finally:
            report['page_errors']=errors
            report['network']=network
            report['action_requests']=actions
            await browser.close()


async def compact_chat_capture(browser,sender,report,errors,network):
    context=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    receiver=await context.new_page()
    receiver.on('pageerror',lambda e:errors.append('recipient: '+str(e)))
    receiver.on('response',lambda r:network.append({'origin':urlsplit(r.url).netloc,'path':urlsplit(r.url).path,'status':r.status,'context':'recipient'}))
    try:
        recipient=await base.register(receiver,'Banex friend','banex_mate_'+uuid.uuid4().hex[:9],'masculine')
        await helpers.phone_app(sender,'messages')
        await sender.locator('.ph-compose-new').click()
        await sender.locator('#ph-search').fill(recipient['username'])
        async with sender.expect_response(lambda r:urlsplit(r.url).path=='/api/conversations' and r.request.method=='POST') as observed:
            await sender.locator(f'[data-ph-action="dm"][data-id="{recipient["id"]}"]').click()
        conversation=(await(await observed.value).json())['conversation']['id']
        await expect(sender.locator('#ph-message')).to_be_enabled()
        await sender.locator('#ph-message').fill('Found my setup at Banex. Coffee later?')
        await sender.locator('.ph-send').click()
        await expect(sender.locator('#ph-message')).to_have_value('')
        await helpers.phone_app(receiver,'messages')
        await receiver.locator(f'[data-ph-action="thread"][data-id="{conversation}"]').click()
        before=[(await state(p))['profile']['wallet'] for p in (sender,receiver)]
        await sender.locator('[data-ph-action="chat-send-money"]').click()
        await sender.locator('#ph-transferAmount').fill('1000')
        await sender.locator('#ph-transferNote').fill('Coffee after Banex')
        await sender.locator('[data-ph-form="wallet-transfer"] [type="submit"]').click()
        async with sender.expect_response(lambda r:urlsplit(r.url).path=='/api/wallet/transfer' and r.request.method=='POST') as observed:
            await sender.locator('[data-ph-action="wallet-confirm"]').click()
        response=await observed.value
        assert response.status==200,await response.text()
        body=response.request.post_data_json
        assert body['conversationId']==conversation and body['residentId']==recipient['id']
        for p,filename in ((sender,'compact-chat-money-sent-390.png'),(receiver,'compact-chat-money-received-390.png')):
            await expect(p.locator('.ph-transfer-message>strong')).to_have_text('₦1,000')
            await snapshot(p,filename)
        after=[(await state(p))['profile']['wallet'] for p in (sender,receiver)]
        assert after==[before[0]-1000,before[1]+1000],(before,after)
        bounds=await sender.locator('.ph-transfer-message').bounding_box()
        assert bounds and bounds['height']<=165 and bounds['width']<=300,bounds
        passed(report,'Latest compact premium chat money card renders an actual confirmed two-account transfer at390×844',before=before,after=after,receiptBounds=bounds)
    finally:
        await context.close()


if __name__=='__main__':
    base.run_browser=run_browser
    result=base.main()
    report=json.loads((ARTIFACTS/'report.json').read_text())
    lines=['# Banex production acceptance','',f'Status: **{report["status"]}**','',report['scope'],'',report['fixture_policy'],'']
    lines.extend(f'- {check["status"]}: {check["check"]}' for check in report['checks'])
    if report.get('error'):
        lines.extend(['',f'Failure: {report["error"]}'])
    lines.extend(['','Screenshots:',''])
    lines.extend(f'- [{image.name}]({image})' for image in sorted(ARTIFACTS.glob('*.png')))
    lines.extend(['','Scope limits:',''])
    lines.extend('- '+limit for limit in report['limitations'])
    (ARTIFACTS/'acceptance.md').write_text('\n'.join(lines)+'\n')
    raise SystemExit(result)

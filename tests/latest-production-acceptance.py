#!/usr/bin/env python3
"""Mobile acceptance against the actual dist and disposable production Mongo API.

Reuses the loopback TLS/domain proxy in production-browser-smoke.py. This test
never mocks an API, assigns an origin, grants funds, or changes client state.
All purchases, furniture actions, chat and transfers use the application's UI.
Read-only API checks and identical-key replays verify the authoritative result.
Public hosting/TLS, physical iOS and operating-system installation are outside
this local Chromium/SwiftShader acceptance run.
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

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('production_browser_helpers', REPO / 'tests/production-browser-smoke.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
base.ARTIFACTS = Path(os.environ.get('ABUJALIFE_QA_ARTIFACTS', '/workspace/scratch/latest-production-acceptance')) / base.RUN_ID
ARTIFACTS = base.ARTIFACTS
api = base.api
PASSWORD = 'Disposable browser acceptance 2026!'
expect.set_options(timeout=30000)


def passed(report, name, **details):
    report['checks'].append({'check': name, 'status': 'passed', **({'details': details} if details else {})})


async def state(page):
    return await api(page, '/api/bootstrap')


async def wait_state(page, predicate, timeout=45):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        current = await state(page)
        if predicate(current):
            return current
        await page.wait_for_timeout(500)
    raise AssertionError({'waiting_for': str(predicate), 'last_profile': current['profile']})


async def no_overflow(page):
    values = await page.evaluate('''()=>({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth})''')
    assert max(values['document'], values['body']) <= values['width'] + 1, values
    home = await page.locator('[data-quick-home]').bounding_box()
    assert home and home['x'] >= 0 and home['x'] + home['width'] <= values['width'] + 1, home


async def wait_world(page):
    await expect(page.locator('#world-scene')).to_have_attribute('data-environment-renderer', 'webgl-3d')
    await expect(page.locator('#world-scene canvas').first).to_be_visible()
    await no_overflow(page)
    # Let a small number of genuine frames paint before taking visual evidence.
    await page.wait_for_timeout(500)


async def finish_existing_signup(page, gender):
    await page.reload(wait_until='domcontentloaded')
    await expect(page.locator('#onboarding-form')).to_be_visible()
    await expect(page.locator('#onboarding-form [name="presentation"]:checked')).to_have_count(0)
    await expect(page.locator('#onboarding-form [name="presentation"]')).to_have_count(2)
    await page.locator(f'#onboarding-form [name="presentation"][value="{gender}"]').check()
    for _ in range(8):
        if await page.locator('#onboarding-form [name="lifeGoal"][value="career"]').count():
            await page.locator('#onboarding-form [name="lifeGoal"][value="career"]').check()
        if await page.locator('#begin-life:visible').count():
            await page.locator('#begin-life').click()
            break
        await page.locator('[data-onboarding-next]:visible').click()
    await expect(page.locator('#onboarding-form')).to_have_count(0)
    await page.wait_for_function("document.documentElement.dataset.connection==='online'")
    result = (await state(page))['profile']
    assert result['onboardingComplete'] and result['appearance']['presentation'] == gender
    return result


async def phone_app(page, app):
    # Put an already-open app away to make the entry repeatable through real controls.
    if await page.locator('.ph-header-close:visible').count():
        await page.locator('.ph-header-close').click()
    await page.locator('.game-nav [data-phone="home"]').click()
    if await page.locator('.ph-unlock:visible').count():
        await page.locator('.ph-unlock').click()
    else:
        await page.locator('.ph-home-indicator').click()
    await page.locator(f'.ph-app-grid [data-app="{app}"]').click()
    await expect(page.locator('.ph-app-header')).to_be_visible()


async def close_phone(page):
    if await page.locator('.ph-header-close:visible').count():
        await page.locator('.ph-header-close').click()
    await expect(page.locator('#phone-root')).to_be_hidden()


async def open_furnishing(page, item_id):
    await page.locator('[data-nav-life]').click()
    await page.locator('[data-life="furnish"]').click()
    await expect(page.locator(f'[data-furniture-card="{item_id}"]')).to_be_visible()


async def floor_place(page, item_id):
    await page.locator(f'[data-place-furniture="{item_id}"]').click()
    await expect(page.locator('#world-scene')).to_have_attribute('data-furniture-mode', item_id)
    await page.locator('[data-world-control="rotate"]').click()
    assert '90' in await page.locator('.world-motion-status').inner_text()
    svg = page.locator('#world-scene .world-scene')
    box = await svg.bounding_box()
    assert box
    attempts = []
    # Physical floor taps. Obstacle, doorway and safe-path validation remain on.
    points = [(x, y) for y in (.54, .65, .75, .43, .84) for x in (.55, .38, .69, .25, .82)]
    for x, y in points:
        px, py = box['x'] + box['width'] * x, box['y'] + box['height'] * y
        if px < 10 or px > 380 or py < 100 or py > 690:
            continue
        await page.mouse.move(px, py)
        blocked = await page.locator('.world-furniture-ghost').evaluate("el=>el.classList.contains('is-blocked')")
        attempts.append({'x_fraction': x, 'y_fraction': y, 'blocked': blocked})
        if blocked:
            continue
        await page.mouse.click(px, py)
        await page.wait_for_timeout(700)
        current = (await state(page))['profile']
        entry = current.get('furnitureLayout', {}).get(item_id)
        if entry:
            assert entry['rotation'] == 90, entry
            return entry, attempts
    raise AssertionError({'floor_taps': attempts, 'status': await page.locator('.world-motion-status').inner_text(), 'profile': (await state(page))['profile']})


async def run_browser(report, certificate_spki):
    if os.environ.get('ABUJALIFE_QA_CAPTURE_ONLY')=='garage':
        return await garage_capture(report,certificate_spki)
    report['scope'] = 'Actual rebuilt production app + real disposable Mongo API; two 390×844 touch Chromium contexts over the existing loopback TLS/domain proxy.'
    report['fixture_policy'] = 'Real random registrations, explicit gender, starter balances only; no top-up, wallet/state grant, API mock or origin override.'
    report['dist_hashes'] = {str(path.relative_to(base.DIST)): hashlib.sha256(path.read_bytes()).hexdigest() for path in base.DIST.rglob('*') if path.is_file()}
    async with async_playwright() as playwright:
        replacement = f'127.0.0.1:{base.TLS_PORT}'
        browser = await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                  f'--ignore-certificate-errors-spki-list={certificate_spki}',
                  f'--host-resolver-rules=MAP abujacity.life {replacement}, MAP api.abujacity.life {replacement}'])
        contexts = [await browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True) for _ in range(2)]
        pages = [await context.new_page() for context in contexts]
        errors, network, actions = [], [], []
        for index, page in enumerate(pages):
            page.on('pageerror', lambda error, label=index: errors.append({'account':label,'error':str(error)}))
            page.on('response', lambda response, label=index: network.append({'account':label,'path':urlsplit(response.url).path,'origin':urlsplit(response.url).netloc,'status':response.status}))
            def record(request, label=index):
                if request.method == 'POST' and urlsplit(request.url).path in ('/api/action','/api/wallet/transfer'):
                    actions.append({'account':label,'path':urlsplit(request.url).path,'body':request.post_data_json})
            page.on('request', record)
        try:
            print(json.dumps({'progress':'Registering the first mobile resident'}),flush=True)
            profiles = [await base.register(pages[0], 'Acceptance Ada', 'accept_f_' + uuid.uuid4().hex[:10], 'feminine')]
            print(json.dumps({'progress':'First signup complete; registering the second resident'}),flush=True)
            profiles.append(await base.register(pages[1], 'Acceptance Bayo', 'accept_m_' + uuid.uuid4().hex[:10], 'masculine'))
            registrations = [{'origin':p['origin']['id'] if isinstance(p['origin'],dict) else p['origin'], 'residentId':p['id']} for p in profiles]
            def origin(p):
                return p['origin']['id'] if isinstance(p['origin'],dict) else p['origin']
            # If the two fair random starts match, use the same real registration
            # route up to eight total registrations and finish the eventual account
            # in the visible wizard. Unselected accounts are disposable QA records.
            while origin(profiles[0]) == origin(profiles[1]) and len(registrations) < 8:
                await api(pages[1], '/api/auth/register', {'displayName':'Acceptance Bayo','username':'accept_m_'+uuid.uuid4().hex[:10],'password':PASSWORD})
                candidate = (await state(pages[1]))['profile']
                print(json.dumps({'progress':'A real random alternate origin was registered','origin':origin(candidate),'registration':len(registrations)+1}),flush=True)
                registrations.append({'origin':origin(candidate),'residentId':candidate['id']})
                if origin(candidate) != origin(profiles[0]):
                    profiles[1] = await finish_existing_signup(pages[1], 'masculine')
                    break
            assert {origin(p) for p in profiles} == {'lapo','nepo'}, {'bounded_random_registrations':registrations}
            report['registrations'] = registrations
            passed(report, 'Real Female/Male signup wizards and bounded fair random Lapo/Nepo starts', registrations=len(registrations))

            fresh = {}
            for page, profile in zip(pages, profiles):
                await wait_world(page)
                current = (await state(page))['profile']
                assert current['home']['starterVersion'] == 1 and current['location']['kind'] == 'home'
                kinds = json.loads(await page.locator('#world-scene').get_attribute('data-environment-objects'))
                owned = await page.locator('#world-scene [data-furniture-item]').evaluate_all('nodes=>[...new Set(nodes.map(n=>n.dataset.furnitureItem))]')
                if origin(current) == 'lapo':
                    assert current['wallet'] == 100000 and current['inventory'] == []
                    assert owned == [] and 'sleeping-mat' in kinds
                    assert not any(k in kinds for k in ['bed','sofa','fridge','tv','wardrobe','kitchen'])
                else:
                    assert current['wallet'] == 1000000 and set(current['inventory']) == {'bed','sofa','dining-table','fridge'}
                    assert set(owned) == set(current['inventory'])
                    assert not any(k in kinds for k in ['tv','wardrobe','kitchen'])
                fresh[origin(current)] = {'home':current['home'],'inventory':current['inventory'],'objects':kinds}
                await page.screenshot(path=str(ARTIFACTS / f'fresh-{origin(current)}-390.png'), full_page=True)
            passed(report, 'Actual WebGL starter rooms show sparse Lapo and four owned Nepo furnishings', homes=fresh)

            lapo_index = next(i for i,p in enumerate(profiles) if origin(p) == 'lapo')
            furnish_page = pages[lapo_index]
            initial = await state(furnish_page)
            catalog = initial['catalog'] if isinstance(initial['catalog'],list) else [dict(value,id=key) for key,value in initial['catalog'].items()]
            item = next(i for i in catalog if i['id'] == 'bedside-table')
            await furnish_page.goto(base.WEB + '/#market', wait_until='domcontentloaded')
            await furnish_page.locator(f'[data-purchase="{item["id"]}"]').click()
            await expect(furnish_page.locator('#sheet-title')).to_have_text('Arrange ' + item['name'])
            await expect(furnish_page.locator(f'[data-furniture-card="{item["id"]}"]')).to_have_class(__import__('re').compile('furniture-card-selected'))
            purchased = (await state(furnish_page))['profile']
            assert purchased['wallet'] == initial['profile']['wallet'] - item['price'] and item['id'] in purchased['inventory']
            entry, taps = await floor_place(furnish_page,item['id'])
            await wait_world(furnish_page)
            await expect(furnish_page.locator(f'[data-furniture-item="{item["id"]}"]').first).to_be_attached()
            await furnish_page.screenshot(path=str(ARTIFACTS / 'lapo-purchased-placed-390.png'),full_page=True)
            await open_furnishing(furnish_page,item['id'])
            await furnish_page.locator(f'[data-store-furniture="{item["id"]}"]').click()
            stored = await wait_state(furnish_page,lambda s:item['id'] in s['profile'].get('storedFurniture',[]))
            assert item['id'] in stored['profile']['inventory']
            await furnish_page.locator(f'[data-sell-item="{item["id"]}"]').click()
            async with furnish_page.expect_response(lambda r:urlsplit(r.url).path=='/api/action' and r.request.method=='POST' and r.request.post_data_json.get('action')=='sell-item') as observed:
                await furnish_page.locator('[data-confirm-sale]').click()
            response = await observed.value
            assert response.status == 200, await response.text()
            sale_request = response.request.post_data_json
            sale = await response.json()
            after_sale = (await state(furnish_page))['profile']
            assert sale['sale']['amount'] == item['price']//2
            assert item['id'] not in after_sale['inventory'] and item['id'] not in after_sale.get('storedFurniture',[]) and item['id'] not in after_sale.get('furnitureLayout',{})
            assert after_sale['wallet'] == purchased['wallet'] + item['price']//2
            assert (await api(furnish_page,'/api/action',sale_request))['replayed'] is True
            assert (await state(furnish_page))['profile']['wallet'] == after_sale['wallet']
            await expect(furnish_page.locator(f'[data-furniture-item="{item["id"]}"]')).to_have_count(0)
            passed(report, 'Furniture purchase opens selected Arrange; floor tap and Rotate save; Store/Sell remove placement with one buyback credit', item=item['id'], placement=entry, floor_taps=taps)

            sender, receiver = pages
            for page in pages:
                await page.goto(base.WEB + '/',wait_until='domcontentloaded')
                await expect(page.locator('.game-nav')).to_be_visible()
                await page.wait_for_function("document.documentElement.dataset.connection==='online'")
            await phone_app(sender,'messages')
            await sender.locator('.ph-compose-new').click()
            await sender.locator('#ph-search').fill(profiles[1]['username'])
            async with sender.expect_response(lambda r:urlsplit(r.url).path=='/api/conversations' and r.request.method=='POST') as observed:
                await sender.locator(f'[data-ph-action="dm"][data-id="{profiles[1]["id"]}"]').click()
            conversation = (await (await observed.value).json())['conversation']['id']
            await expect(sender.locator('#ph-message')).to_be_enabled()
            text = 'See you in Abuja · ' + base.RUN_ID
            await sender.locator('#ph-message').fill(text)
            async with sender.expect_response(lambda r:urlsplit(r.url).path==f'/api/conversations/{conversation}/messages' and r.request.method=='POST') as observed:
                await sender.locator('.ph-send').click()
            send_response = await observed.value
            assert send_response.status == 201 and send_response.request.post_data_json['idempotencyKey']
            row = sender.locator('.ph-message').filter(has=sender.locator('.ph-bubble',has_text=text))
            await expect(row.locator('.ph-message-receipt')).to_have_text('Delivered')
            draft = 'My next message stays here'
            await sender.locator('#ph-message').fill(draft)
            await close_phone(sender)
            await phone_app(receiver,'messages')
            inbox_row = receiver.locator(f'[data-ph-action="thread"][data-id="{conversation}"]')
            await expect(inbox_row.locator('.ph-unread')).to_have_text('1')
            await inbox_row.click()
            await expect(receiver.locator('.ph-bubble').filter(has_text=text)).to_be_visible()
            await expect(receiver.locator('#ph-unread-anchor')).to_be_visible()
            await receiver.screenshot(path=str(ARTIFACTS / 'recipient-unread-thread-390.png'),full_page=True)
            await phone_app(sender,'messages')
            await sender.locator(f'[data-ph-action="thread"][data-id="{conversation}"]').click()
            await expect(sender.locator('#ph-message')).to_have_value(draft)
            await expect(sender.locator('.ph-message').filter(has=sender.locator('.ph-bubble',has_text=text)).locator('.ph-message-receipt')).to_have_text('Read')
            await sender.screenshot(path=str(ARTIFACTS / 'sender-read-draft-390.png'),full_page=True)
            passed(report, 'Directory UI opens a real DM; realtime Delivered→Read, actual unread anchor and draft survive phone close', conversationId=conversation)

            balances_before = [(await state(page))['profile']['wallet'] for page in pages]
            await sender.locator('[data-ph-action="chat-send-money"]').click()
            await expect(sender.locator('.ph-transfer-person strong')).to_have_text(profiles[1]['displayName'])
            await sender.locator('#ph-transferAmount').fill('1000')
            await sender.locator('#ph-transferNote').fill('Coffee together')
            await sender.locator('[data-ph-form="wallet-transfer"] [type="submit"]').click()
            await expect(sender.locator('.ph-review-card>strong')).to_have_text('₦1,000')
            assert [(await state(page))['profile']['wallet'] for page in pages] == balances_before
            await sender.screenshot(path=str(ARTIFACTS / 'chat-transfer-review-390.png'),full_page=True)
            async with sender.expect_response(lambda r:urlsplit(r.url).path=='/api/wallet/transfer' and r.request.method=='POST') as observed:
                await sender.locator('[data-ph-action="wallet-confirm"]').click()
            transfer_response = await observed.value
            assert transfer_response.status == 200, await transfer_response.text()
            transfer_request = transfer_response.request.post_data_json
            assert transfer_request['residentId'] == profiles[1]['id'] and transfer_request['conversationId'] == conversation and transfer_request['idempotencyKey']
            await expect(sender.locator('#ph-message')).to_have_value(draft)
            await expect(sender.locator('.ph-transfer-message>strong')).to_have_text('₦1,000')
            await expect(receiver.locator('.ph-transfer-message>strong')).to_have_text('₦1,000')
            assert await sender.locator('.ph-transfer-message').inner_text() != await receiver.locator('.ph-transfer-message').inner_text()
            balances_after = [(await state(page))['profile']['wallet'] for page in pages]
            assert balances_after == [balances_before[0]-1000,balances_before[1]+1000], (balances_before,balances_after)
            replay = await api(sender,'/api/wallet/transfer',transfer_request)
            assert replay['replayed'] is True
            assert [(await state(page))['profile']['wallet'] for page in pages] == balances_after
            await sender.screenshot(path=str(ARTIFACTS / 'chat-money-sent-390.png'),full_page=True)
            await receiver.screenshot(path=str(ARTIFACTS / 'chat-money-received-390.png'),full_page=True)
            passed(report, 'In-chat review confirms verified peer; one atomic debit/credit and authoritative receipts on both real accounts', before=balances_before,after=balances_after)

            for page,profile,balance in zip(pages,profiles,balances_after):
                await page.reload(wait_until='domcontentloaded')
                await expect(page.locator('.game-nav')).to_be_visible()
                restored = (await state(page))['profile']
                assert restored['id']==profile['id'] and restored['wallet']==balance and restored['appearance']['presentation']==profile['appearance']['presentation']
                await phone_app(page,'messages')
                await page.locator(f'[data-ph-action="thread"][data-id="{conversation}"]').click()
                await expect(page.locator('.ph-transfer-message>strong')).to_have_text('₦1,000')
                await close_phone(page)
                await no_overflow(page)
            passed(report, 'Server session, explicit gender, both balances and one chat receipt persist after reload')

            # Same-neighbourhood paid venue trip: actual mode choice, fare, motion,
            # destination arrival and the always-visible Home button's physical walk.
            traveler=pages[lapo_index]
            before_trip=(await state(traveler))['profile']
            await traveler.locator('[data-nav-places]').click()
            await traveler.locator('[data-city-venue="cafe"]').click()
            await expect(traveler.locator('#travel-form [name="mode"][value="walk"]')).to_be_visible()
            await traveler.locator('#travel-form [name="mode"][value="bus"]').check()
            await expect(traveler.locator('#travel-form [type="submit"]')).to_be_enabled()
            await traveler.locator('#travel-form [type="submit"]').click()
            transit=await wait_state(traveler,lambda s:bool(s['profile'].get('activeTrip')))
            assert transit['profile']['activeTrip']['mode']=='bus' and transit['profile']['activeTrip']['venueId']=='cafe'
            assert transit['profile']['activeTrip']['cost']>0 and transit['profile']['wallet']==before_trip['wallet']-transit['profile']['activeTrip']['cost']
            await expect(traveler.locator('.trip-banner')).to_be_visible()
            await no_overflow(traveler)
            await traveler.screenshot(path=str(ARTIFACTS / 'bus-trip-390.png'),full_page=True)
            arrived=await wait_state(traveler,lambda s:s['profile']['location']['kind']=='venue' and s['profile']['location'].get('venue')=='cafe',60)
            await traveler.locator('[data-quick-home]').click()
            home=await wait_state(traveler,lambda s:s['profile']['location']['kind']=='home',60)
            assert home['profile']['district']==home['profile']['home']['district'] and home['profile']['wallet']==arrived['profile']['wallet']
            await wait_world(traveler)
            await traveler.screenshot(path=str(ARTIFACTS / 'returned-home-390.png'),full_page=True)
            passed(report, 'Destination offers travel modes; actual paid bus arrives at café; visible Home button physically returns to own room', trip=transit['profile']['activeTrip'])

            await traveler.locator('[data-nav-life]').click()
            await traveler.locator('[data-life="garage"]').click()
            await expect(traveler.locator('.sheet .eyebrow').first).to_have_text('ABUJA CAR')
            await expect(traveler.locator('.garage-card .garage-art').first).to_be_visible()
            await traveler.wait_for_timeout(700)
            await traveler.screenshot(path=str(ARTIFACTS / 'abuja-car-showroom-390.png'),full_page=True,animations='disabled')
            passed(report,'Latest dealership is labelled Abuja Car and shows the actual original vehicle catalogue')

            assert not errors, errors
            assert not any(n['origin']=='abujacity.life' and n['path'].startswith('/api/') for n in network)
            assert not any(n['origin']=='api.abujacity.life' and n['status']>=500 for n in network)
            assert all(report['dist_hashes'][name]==hashlib.sha256((base.DIST/name).read_bytes()).hexdigest() for name in report['dist_hashes']), 'dist changed during acceptance'
            passed(report, 'Actual latest bundle has no page errors, frontend-origin API calls or API 5xx responses')
        except Exception:
            for index,page in enumerate(pages):
                try:
                    await page.screenshot(path=str(ARTIFACTS/f'failure-{index+1}.png'),full_page=True,timeout=5000)
                    (ARTIFACTS/f'failure-{index+1}.html').write_text(await page.content())
                except Exception:
                    pass
            raise
        finally:
            report['page_errors']=errors
            report['network']=network
            report['action_requests']=actions
            await browser.close()


async def garage_capture(report,certificate_spki):
    report['scope']='Supplemental settled-animation mobile screenshot of the actual latest Abuja Car catalogue; same disposable production Mongo API and local TLS proxy.'
    async with async_playwright() as playwright:
        replacement=f'127.0.0.1:{base.TLS_PORT}'
        browser=await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',f'--ignore-certificate-errors-spki-list={certificate_spki}',f'--host-resolver-rules=MAP abujacity.life {replacement}, MAP api.abujacity.life {replacement}'])
        context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        page=await context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        try:
            await base.register(page,'Catalogue acceptance','capture_'+uuid.uuid4().hex[:10],'feminine')
            await page.locator('[data-nav-life]').click()
            await page.locator('[data-life="garage"]').click()
            await expect(page.locator('.sheet .eyebrow').first).to_have_text('ABUJA CAR')
            await expect(page.locator('.garage-card .garage-art').first).to_be_visible()
            await page.wait_for_timeout(1200)
            await page.screenshot(path=str(ARTIFACTS/'abuja-car-showroom-390.png'),full_page=True,animations='disabled')
            report['garage_layout']=await page.locator('.sheet').evaluate('el=>({rect:el.getBoundingClientRect().toJSON(),opacity:getComputedStyle(el).opacity,transform:getComputedStyle(el).transform})')
            assert report['garage_layout']['opacity']=='1'
            assert not errors,errors
            passed(report,'Settled Abuja Car sheet and actual vehicle catalogue are visible at390×844')
        finally:
            report['page_errors']=errors
            await browser.close()


if __name__=='__main__':
    base.run_browser=run_browser
    raise SystemExit(base.main())

#!/usr/bin/env python3
"""Real production mobile launcher and in-chat money acceptance.

Run after a production build against the disposable production Mongo API on
8995. Reuses the existing loopback-only TLS proxy, never mocks an endpoint,
grants money, changes a client profile, or inspects a secret. Public hosting,
public CA certificates and physical Safari are outside this local acceptance.
"""
import asyncio
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit
import uuid

from playwright.async_api import async_playwright, expect

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('latest_production_helpers', REPO / 'tests/latest-production-acceptance.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
base = helpers.base
base.ARTIFACTS = Path(os.environ.get('ABUJALIFE_QA_ARTIFACTS', '/workspace/scratch/phone-premium')) / base.RUN_ID
ARTIFACTS = base.ARTIFACTS
api = base.api
state = helpers.state
passed = helpers.passed
expect.set_options(timeout=30000)


async def open_home(page):
    if await page.locator('#phone-root:visible').count():
        await page.locator('.ph-home-indicator').click()
    else:
        await page.locator('.game-nav [data-phone="home"]').click()
        if await page.locator('.ph-unlock:visible').count():
            await page.locator('.ph-unlock').click()
    await expect(page.locator('.ph-home-paged')).to_be_visible()


async def page_number(page, index):
    await expect(page.locator(f'[data-phone-page-go="{index}"]')).to_have_attribute('aria-current', 'page')
    await page.wait_for_function('''index => {
      const host=document.querySelector('.ph-home-pages');
      return Math.abs(host.scrollLeft - host.clientWidth * index) < 2;
    }''', arg=index)


async def choose_page(page, index):
    await page.locator(f'[data-phone-page-go="{index}"]').click()
    await page_number(page, index)


async def native_swipe(page, direction):
    box = await page.locator('.ph-home-pages').bounding_box()
    assert box
    start = box['x'] + box['width'] * (.82 if direction == 'left' else .18)
    end = box['x'] + box['width'] * (.18 if direction == 'left' else .82)
    y = box['y'] + box['height'] * .82
    cdp = await page.context.new_cdp_session(page)
    try:
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':start,'y':y,'radiusX':1,'radiusY':1,'force':1}]})
        for step in range(1, 11):
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':start+(end-start)*step/10,'y':y,'radiusX':1,'radiusY':1,'force':1}]})
            await page.wait_for_timeout(25)
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    finally:
        await cdp.detach()


async def open_messages(page):
    await open_home(page)
    await page.locator('.ph-dock [data-app="messages"]').click()
    await expect(page.locator('.ph-inbox-title')).to_be_visible()


async def unsafe_status(page, path, body):
    return await page.evaluate('''async ({path,body})=>{
      const response=await fetch(globalThis.ABUJA_PUBLIC_CONFIG.API_PUBLIC_URL+path,{
        credentials:'include',method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
      });return {status:response.status,body:await response.json()};
    }''', {'path':path,'body':body})


async def run_browser(report, certificate_spki):
    report['scope'] = 'Actual rebuilt dist, real disposable Mongo production API and two 390×844 touch Chromium accounts over local TLS/public domain names.'
    report['fixture_policy'] = 'Real visible signups and starter balances only; no API mocks, balance grants, demo top-ups or client state changes.'
    hashes = {str(path.relative_to(base.DIST)):hashlib.sha256(path.read_bytes()).hexdigest() for path in base.DIST.rglob('*') if path.is_file()}
    report['dist_hashes'] = hashes
    async with async_playwright() as playwright:
        replacement = f'127.0.0.1:{base.TLS_PORT}'
        browser = await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,
            args=['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',
                  f'--ignore-certificate-errors-spki-list={certificate_spki}',f'--host-resolver-rules=MAP abujacity.life {replacement}, MAP api.abujacity.life {replacement}'])
        contexts = [await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True) for _ in range(2)]
        pages = [await context.new_page() for context in contexts]
        errors, network, transfers = [], [], []
        for index, page in enumerate(pages):
            page.on('pageerror',lambda error,label=index:errors.append({'account':label,'error':str(error)}))
            page.on('response',lambda response,label=index:network.append({'account':label,'origin':urlsplit(response.url).netloc,'path':urlsplit(response.url).path,'status':response.status}))
            page.on('request',lambda request,label=index:transfers.append({'account':label,'body':request.post_data_json}) if request.method=='POST' and urlsplit(request.url).path=='/api/wallet/transfer' else None)
        try:
            profiles = []
            for page,name,gender in zip(pages,['Premium Ada','Premium Bayo'],['feminine','masculine']):
                print(json.dumps({'progress':'Registering a real phone acceptance account','name':name}),flush=True)
                profiles.append(await base.register(page,name,'phone_'+uuid.uuid4().hex[:10],gender))
                await helpers.wait_world(page)
            sender, receiver = pages
            passed(report,'Two real signups use explicit Female/Male and persistent authenticated production sessions')

            await open_home(sender)
            sizes = await sender.locator('.ph-device').evaluate('el=>el.getBoundingClientRect().toJSON()')
            assert 295 <= sizes['width'] <= 321 and sizes['height'] <= 677, sizes
            assert sizes['x'] >= 25 and sizes['x']+sizes['width'] <= 365 and sizes['y'] >= 35, sizes
            counts = await sender.locator('.ph-home-page .ph-app-grid').evaluate_all('nodes=>nodes.map(el=>el.children.length)')
            assert counts == [8,8,4], counts
            assert await sender.locator('.ph-home-page .ph-widget-row').count() == 1
            assert await sender.locator('.ph-dock [data-app]').count() == 4
            dock = await sender.locator('.ph-dock').bounding_box()
            active_ids = []
            for index in range(3):
                await choose_page(sender,index)
                current_dock = await sender.locator('.ph-dock').bounding_box()
                assert abs(current_dock['y']-dock['y']) < 1, (dock,current_dock)
                apps = sender.locator(f'[data-phone-page="{index}"] .ph-app-grid [data-app]')
                ids = await apps.evaluate_all('nodes=>nodes.map(el=>el.dataset.app)')
                active_ids.extend(ids)
                for app in ids:
                    launcher = sender.locator(f'[data-phone-page="{index}"] .ph-app-grid [data-app="{app}"]')
                    await expect(launcher).to_be_enabled()
                    rect = await launcher.bounding_box()
                    assert rect and rect['x'] >= sizes['x'] and rect['x']+rect['width'] <= sizes['x']+sizes['width']+1, rect
                    await launcher.click()
                    await expect(sender.locator('.ph-app-header')).to_be_visible()
                    await sender.locator('.ph-home-indicator').click()
                    await page_number(sender,index)
                await sender.screenshot(path=str(ARTIFACTS/f'phone-app-page-{index+1}-390.png'),full_page=True,animations='disabled')
            assert len(active_ids) == len(set(active_ids)) == 20
            passed(report,'Smaller 320×676 launcher has 8/8/4 genuinely reachable apps, first-page widgets and a pinned dock',device=sizes,apps=active_ids)

            await choose_page(sender,0)
            await expect(sender.locator('[data-phone-page-step="-1"]')).to_be_disabled()
            await sender.locator('[data-phone-page-step="1"]').click()
            await page_number(sender,1)
            await sender.locator('[data-phone-page-step="1"]').click()
            await page_number(sender,2)
            await expect(sender.locator('[data-phone-page-step="1"]')).to_be_disabled()
            await choose_page(sender,0)
            await native_swipe(sender,'left')
            await page_number(sender,1)
            await native_swipe(sender,'right')
            await page_number(sender,0)
            assert await sender.evaluate('visualViewport.scale') == 1
            passed(report,'Native touch swipes and accessible dots/arrows change bounded pages while website scale stays one')

            await open_messages(sender)
            await sender.locator('.ph-compose-new').click()
            await sender.locator('#ph-search').fill(profiles[1]['username'])
            async with sender.expect_response(lambda response:urlsplit(response.url).path=='/api/conversations' and response.request.method=='POST') as observed:
                await sender.locator(f'[data-ph-action="dm"][data-id="{profiles[1]["id"]}"]').click()
            conversation = (await (await observed.value).json())['conversation']['id']
            text = 'We fit meet for Jabi · '+base.RUN_ID
            await sender.locator('#ph-message').fill(text)
            await sender.locator('.ph-send').click()
            await expect(sender.locator('.ph-bubble').filter(has_text=text)).to_be_visible()
            draft = 'My conversation draft stays with me'
            await sender.locator('#ph-message').fill(draft)
            await open_messages(receiver)
            await receiver.locator(f'[data-ph-action="thread"][data-id="{conversation}"]').click()
            await expect(receiver.locator('.ph-bubble').filter(has_text=text)).to_be_visible()
            before = [(await state(page))['profile']['wallet'] for page in pages]
            await sender.locator('[data-ph-action="chat-send-money"]').click()
            await expect(sender.locator('.ph-money-panel:not(.is-review)')).to_be_visible()
            await expect(sender.locator('.ph-chat-thread')).to_be_visible()
            await expect(sender.locator('#ph-message')).to_have_value(draft)
            await sender.locator('[data-ph-action="chat-money-max"]').click()
            await expect(sender.locator('#ph-transferAmount')).to_have_value(str(before[0]))
            await sender.locator('[data-ph-action="chat-money-close"]').click()
            await expect(sender.locator('.ph-money-panel')).to_have_count(0)
            assert not transfers and [(await state(page))['profile']['wallet'] for page in pages] == before
            await sender.locator('[data-ph-action="chat-send-money"]').click()
            await sender.locator('[data-ph-action="chat-money-amount"][data-amount="1000"]').click()
            await expect(sender.locator('#ph-transferAmount')).to_have_value('1000')
            amount_font = await sender.locator('#ph-transferAmount').evaluate('el=>getComputedStyle(el).fontSize')
            assert amount_font == '29px', amount_font
            report['entry_amount_font'] = amount_font
            await sender.locator('#ph-transferNote').fill('For transport to Jabi')
            await sender.screenshot(path=str(ARTIFACTS/'inline-money-entry-390.png'),full_page=True,animations='disabled')
            await sender.locator('#ph-money-review').click()
            await expect(sender.locator('.ph-money-panel.is-review')).to_be_visible()
            await expect(sender.locator('.ph-money-review-amount>strong')).to_have_text('₦1,000')
            await expect(sender.locator('.ph-money-recipient strong')).to_have_text(profiles[1]['displayName'])
            await expect(sender.locator('.ph-money-recipient small')).to_have_text('@'+profiles[1]['username'])
            breakdown = await sender.locator('.ph-money-breakdown').inner_text()
            assert '₦0' in breakdown and f'₦{before[0]-1000:,}' in breakdown, breakdown
            assert not transfers and [(await state(page))['profile']['wallet'] for page in pages] == before
            await sender.locator('[data-ph-action="wallet-edit"]').click()
            await expect(sender.locator('#ph-transferAmount')).to_have_value('1000')
            await expect(sender.locator('#ph-transferNote')).to_have_value('For transport to Jabi')
            await sender.locator('#ph-transferAmount').fill('2000')
            await sender.locator('#ph-money-review').click()
            await expect(sender.locator('.ph-money-review-amount>strong')).to_have_text('₦2,000')
            assert not transfers and [(await state(page))['profile']['wallet'] for page in pages] == before
            await sender.locator('[data-ph-action="wallet-edit"]').click()
            await sender.locator('#ph-transferAmount').fill('1000')
            await sender.locator('#ph-money-review').click()
            await sender.screenshot(path=str(ARTIFACTS/'inline-money-review-390.png'),full_page=True,animations='disabled')
            passed(report,'Inline gold money panel keeps chat draft; Max, preset, cancel and edit/review never debit early',balances=before)

            async with sender.expect_response(lambda response:urlsplit(response.url).path=='/api/wallet/transfer' and response.request.method=='POST') as observed:
                await sender.locator('[data-ph-action="wallet-confirm"]').click()
            response = await observed.value
            assert response.status == 200, await response.text()
            request = response.request.post_data_json
            result = await response.json()
            assert request['residentId'] == profiles[1]['id'] and request['conversationId'] == conversation and request['amount'] == 1000 and request['idempotencyKey']
            await expect(sender.locator('.ph-money-panel')).to_have_count(0)
            await expect(sender.locator('#ph-message')).to_have_value(draft)
            for page in pages:
                await expect(page.locator('.ph-transfer-message>strong')).to_have_text('₦1,000')
                assert await page.locator('.ph-transfer-message').count() == 1
            after = [(await state(page))['profile']['wallet'] for page in pages]
            assert after == [before[0]-1000,before[1]+1000], (before,after)
            replay = await api(sender,'/api/wallet/transfer',request)
            assert replay['replayed'] is True and replay['transfer']['id'] == result['transfer']['id']
            assert [(await state(page))['profile']['wallet'] for page in pages] == after
            for index,page in enumerate(pages):
                await expect(page.locator('.ph-transfer-message')).to_have_count(1)
                await page.screenshot(path=str(ARTIFACTS/f'confirmed-money-{"sent" if index==0 else "received"}-390.png'),full_page=True,animations='disabled')
            passed(report,'Confirm credits the verified peer once, emits authoritative receipts to both real accounts and safely replays',before=before,after=after,transferId=result['transfer']['id'])

            for page,profile,balance in zip(pages,profiles,after):
                await page.reload(wait_until='domcontentloaded')
                await expect(page.locator('.game-nav')).to_be_visible()
                assert (await state(page))['profile']['id'] == profile['id']
                assert (await state(page))['profile']['wallet'] == balance
                await open_messages(page)
                await page.locator(f'[data-ph-action="thread"][data-id="{conversation}"]').click()
                await expect(page.locator('.ph-transfer-message')).to_have_count(1)
                await expect(page.locator('.ph-transfer-message>strong')).to_have_text('₦1,000')
            passed(report,'Both account balances and the single immutable chat receipt persist after refresh')

            await receiver.locator('.ph-thread-person').click()
            async with receiver.expect_response(lambda response:urlsplit(response.url).path=='/api/moderation/block' and response.request.method=='POST') as observed:
                await receiver.locator('[data-ph-action="block"][data-value="true"]').click()
            assert (await observed.value).status == 200
            blocked = await unsafe_status(sender,'/api/wallet/transfer',{**request,'idempotencyKey':str(uuid.uuid4())})
            assert blocked['status'] == 403, blocked
            assert [(await state(page))['profile']['wallet'] for page in pages] == after
            blocked_message = await unsafe_status(sender,f'/api/conversations/{conversation}/messages',{'text':'Blocked message must not be accepted','idempotencyKey':str(uuid.uuid4())})
            assert blocked_message['status'] == 403, blocked_message
            passed(report,'Receiver UI block is enforced by production money and messaging APIs with 403 and unchanged balances')

            assert not errors, errors
            assert not any(row['origin']=='abujacity.life' and row['path'].startswith('/api/') for row in network)
            assert not any(row['origin']=='api.abujacity.life' and row['status']>=500 for row in network)
            assert all(hashes[name]==hashlib.sha256((base.DIST/name).read_bytes()).hexdigest() for name in hashes), 'dist changed during acceptance'
            passed(report,'Latest phone bundle has no JavaScript errors, frontend-origin API calls or API 5xx responses')
        except Exception:
            for index,page in enumerate(pages):
                try:
                    await page.screenshot(path=str(ARTIFACTS/f'failure-account-{index+1}.png'),full_page=True,timeout=5000)
                    (ARTIFACTS/f'failure-account-{index+1}.html').write_text(await page.content())
                except Exception:
                    pass
            raise
        finally:
            report['page_errors'] = errors
            report['network'] = network
            report['transfer_requests'] = transfers
            await browser.close()


if __name__ == '__main__':
    base.run_browser = run_browser
    raise SystemExit(base.main())

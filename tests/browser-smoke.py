#!/usr/bin/env python3
"""Real Chromium acceptance checks; disposable residents and SQLite storage.

Run: python tests/browser-smoke.py
Requires Python Playwright and system Chromium (/usr/bin/chromium by default).
Starts its own localhost server on PORT 8790, removes all test data on exit, and
writes evidence outside the checkout to /workspace/scratch/integration-qa.
No external account, purchase, or hosted preview is created. Public OSM requests
are observed honestly: failure fallback can pass while map-source access fails.
"""
import asyncio
import datetime
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import traceback
import urllib.request
import uuid

from playwright.async_api import async_playwright, expect

# Software WebGL may need longer than the default 5s to mount a full scene.
expect.set_options(timeout=20000)

REPO = Path(__file__).resolve().parents[1]
RUN_ID = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]
ARTIFACTS = Path(os.environ.get('ABUJALIFE_QA_ARTIFACTS', '/workspace/scratch/integration-qa')) / RUN_ID
PORT = int(os.environ.get('ABUJALIFE_QA_PORT', '8790'))
BASE = f'http://127.0.0.1:{PORT}'
PASSWORD = 'Local acceptance only 2026!'


def source_hashes():
    files = [file for folder in ('app','src') for file in (REPO/folder).rglob('*') if file.is_file()]
    files += [REPO/'scripts/dev.mjs', REPO/'package.json']
    return {str(file.relative_to(REPO)):hashlib.sha256(file.read_bytes()).hexdigest() for file in sorted(files)}


class Acceptance:
    def __init__(self):
        self.results = []
        self.errors = []
        self.network = []
        self.source_responses = []
        self.source_start = source_hashes()
        self.pages = []

    async def check(self, name, operation):
        start = time.monotonic()
        try:
            details = await operation()
            result = {'check': name, 'status': 'passed', 'seconds': round(time.monotonic()-start, 2)}
            if details is not None:
                result['details'] = details
        except Exception as error:
            result = {'check': name, 'status': 'failed', 'seconds': round(time.monotonic()-start, 2),
                      'error': str(error), 'traceback': traceback.format_exc()}
            for index, page in enumerate(self.pages):
                if not page.is_closed():
                    try:
                        await page.screenshot(path=str(ARTIFACTS/f'failure-{len(self.results)}-{index}.png'), full_page=True)
                    except Exception:
                        pass
        self.results.append(result)
        print(json.dumps({key: value for key, value in result.items() if key != 'traceback'}), flush=True)
        self.save()
        return result['status'] == 'passed'

    def watch(self, page, label):
        self.pages.append(page)
        page.set_default_timeout(30000)
        page.on('pageerror', lambda error: self.errors.append({'page': label, 'error': str(error)}))
        page.on('console', lambda message: self.errors.append({'page': label, 'console': message.text})
                if message.type == 'error' and 'openstreetmap' not in message.text else None)
        page.on('response', lambda response: self.source_responses.append({'page':label,'url':response.url,'status':response.status})
                if any(domain in response.url for domain in ('openstreetmap.org','overpass-api.de')) else None)
        page.on('requestfailed', lambda request: self.network.append({'page': label, 'url': request.url,
                'failure': request.failure}))

    def save(self):
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        (ARTIFACTS/'report.json').write_text(json.dumps({'results': self.results, 'browserErrors': self.errors,
            'networkFailures': self.network, 'sourceResponses':self.source_responses, 'sourceHashesAtStart':self.source_start}, indent=2))


async def bootstrap(page):
    response = await page.request.get(f'{BASE}/api/bootstrap')
    assert response.ok, await response.text()
    return await response.json()


async def wait_state(page, predicate, timeout=30):
    deadline = time.monotonic()+timeout
    while time.monotonic() < deadline:
        state = await bootstrap(page)
        if predicate(state):
            return state
        await asyncio.sleep(.1)
    raise AssertionError(f'Expected authoritative state did not appear within {timeout}s; last profile: {state.get("profile")}')


async def close_phone(page):
    if await page.locator('#phone-root:not([hidden])').count():
        await page.locator('[data-ph-action="close"]').first.click()
        await expect(page.locator('#phone-root')).to_be_hidden()


async def open_phone(page, app=None):
    await close_phone(page)
    await page.locator('.game-nav [data-phone="home"]').click()
    await expect(page.locator('#ph-device-name')).to_have_text('AbujaLife Phone')
    if await page.locator('.ph-unlock').count():
        await page.locator('.ph-unlock').click()
    else:
        await page.locator('.ph-home-indicator').click()
    if app:
        await page.locator(f'.ph-app-grid [data-app="{app}"]').click()


async def dismiss_returning_welcome(page):
    """A returning resident gets one welcome-back gate per tab. Continue through it."""
    if await page.evaluate("() => sessionStorage.getItem('abujalife.welcome-back.v1') === '1'"):
        return
    welcome = page.locator('[data-welcome-continue]')
    try:
        await welcome.wait_for(state='visible', timeout=8000)
    except Exception:
        return
    await welcome.click()
    await expect(page.locator('.abj-welcome-back')).to_have_count(0)


async def complete_resident_wizard(page, display_name, hair):
    """Complete the real character/life/controls flow after account creation."""
    await expect(page.locator('#onboarding-form')).to_be_visible()
    for _ in range(8):
        form=page.locator('#onboarding-form')
        presentation = 'feminine' if hair == 'braids' else 'masculine'
        gender = form.locator(f'[name="presentation"][value="{presentation}"]')
        if await gender.count() and await gender.first.is_visible():
            await gender.first.check()
        name_control=form.locator('[name="displayName"]:visible')
        if await name_control.count():
            await name_control.fill(display_name)
        hair_choice=form.locator(f'[name="hair"][value="{hair}"]')
        if await hair_choice.count():
            await hair_choice.check()
        else:
            hair_control=form.locator('select[name="hair"]:visible')
            if await hair_control.count():
                await hair_control.select_option(hair)
        goal_control=form.locator('[name="lifeGoal"][value="career"]')
        if await goal_control.count() and await goal_control.is_visible():
            await goal_control.check()
        begin=page.locator('#begin-life:visible')
        if await begin.count():
            await begin.click()
            break
        next_button=page.locator('[data-onboarding-next]:visible')
        assert await next_button.count(),'Wizard has no visible next or begin control'
        await next_button.click()
    await expect(page.locator('#onboarding-form')).to_have_count(0)
    await expect(page.locator('.game-nav')).to_be_visible()
    profile = (await bootstrap(page))['profile']
    assert profile['onboardingComplete'] is True
    assert profile['displayName'] == display_name and profile['appearance']['hair'] == hair
    assert profile['appearance']['presentation'] == ('feminine' if hair == 'braids' else 'masculine')
    assert profile['lifeGoal'] == 'career'


async def activate_home_object(page, action):
    legacy = page.locator(f'[data-world-action="{action}"]')
    if await legacy.count():
        await legacy.click()
        return
    point = page.locator(f'[data-world-target$="-{action}"]').first
    await expect(point).to_have_count(1)
    # Real accessible keyboard activation follows the same walk-to-object path.
    # It also works when a cutaway room marker starts outside the camera viewport.
    await point.focus()
    await page.keyboard.press('Enter')


async def register(page, username, display_name, hair):
    await page.goto(BASE, wait_until='domcontentloaded')
    await page.locator('[name="displayName"]').fill(display_name)
    await page.locator('[name="username"]').fill(username)
    await page.locator('[name="password"]').fill(PASSWORD)
    await page.locator('.auth-submit').click()
    await complete_resident_wizard(page, display_name, hair)
    state = await bootstrap(page)
    assert state['authenticated'] and state['profile']['appearance']['hair'] == hair
    return state['profile']


async def close_overlays(page):
    await close_sheet(page)
    journey = page.locator('[data-map-journey-close]:visible')
    if await journey.count():
        await journey.first.click()
    restored = page.locator('[data-restored-map-close]:visible')
    if await restored.count():
        await restored.click()
        await expect(page.locator('.abj-restored-map')).to_have_count(0)
    street = page.locator('[data-map-close]:visible')
    if await street.count():
        await street.click()


async def navigate(page,view):
    await close_overlays(page)
    if view=='map':
        await page.locator('.game-nav [data-nav-outside]').click()
        await expect(page.locator('.abj-restored-map')).to_be_visible()
        return
    control=page.locator(f'.game-nav [data-view="{view}"]')
    if await control.count():
        await control.click()
    else:
        await page.locator('[data-nav-life]').click()
        target={'property':'houses'}.get(view,view)
        await page.locator(f'[data-life="{target}"]').click()


async def close_sheet(page):
    control=page.locator('.sheet [data-close]:visible')
    if await control.count():
        await control.first.click()


async def open_home_door(page):
    await close_sheet(page)
    await page.locator('[data-nav-life]').click()
    await page.locator('#world-door').click()


async def assert_no_overflow(page):
    metrics = await page.evaluate('''() => ({viewport:innerWidth,document:document.documentElement.scrollWidth,
        body:document.body.scrollWidth, height:innerHeight, phone:document.querySelector('.ph-device')?.getBoundingClientRect().toJSON()})''')
    assert metrics['document'] <= metrics['viewport']+1, metrics
    assert metrics['body'] <= metrics['viewport']+1, metrics
    if metrics.get('phone'):
        box = metrics['phone']
        assert box['left'] >= 0 and box['right'] <= metrics['viewport']+1, metrics
        assert box['top'] >= 0 and box['bottom'] <= metrics['height']+1, metrics
    return metrics


async def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='abujalife-browser-qa-') as data_dir:
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(('127.0.0.1', PORT))
        with (ARTIFACTS/'server.log').open('w') as server_log:
            env = dict(os.environ, PORT=str(PORT), ABUJALIFE_DATA_DIR=data_dir)
            server = subprocess.Popen(['node', 'scripts/dev.mjs'], cwd=REPO, env=env,
                stdout=server_log, stderr=subprocess.STDOUT)
            qa = Acceptance()
            browser = None
            try:
                deadline = time.monotonic()+15
                while time.monotonic() < deadline:
                    if server.poll() is not None:
                        raise RuntimeError(f'Test server exited; see {ARTIFACTS}/server.log')
                    try:
                        with urllib.request.urlopen(f'{BASE}/api/health', timeout=1) as response:
                            if response.status == 200:
                                break
                    except Exception:
                        await asyncio.sleep(.1)
                else:
                    raise RuntimeError('Isolated localhost server did not become healthy')
                async with async_playwright() as playwright:
                    browser = await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
                        headless=True, args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
                    context_a = await browser.new_context(viewport={'width':1440,'height':1000})
                    context_b = await browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
                    a, b = await context_a.new_page(), await context_b.new_page()
                    qa.watch(a, 'resident-a'); qa.watch(b, 'resident-b')
                    users = {}

                    async def onboarding():
                        users['a'] = await register(a, 'qa_amara', 'Amara QA', 'braids')
                        users['b'] = await register(b, 'qa_tunde', 'Tunde QA', 'afro')
                        assert users['a']['id'] != users['b']['id']
                        assert users['a']['location']['kind'] == 'home'
                        await a.screenshot(path=str(ARTIFACTS/'home-desktop.png'), full_page=True)
                        await b.screenshot(path=str(ARTIFACTS/'home-mobile.png'), full_page=True)
                        return {'registeredResidents': 2, 'distinctSessions': True,'engine':'Chromium','mobileTouchContext':[390,844]}
                    if not await qa.check('Two real residents register through browser UI', onboarding):
                        raise AssertionError('Onboarding acceptance failed; inspect the saved report')

                    async def persisted_auth_and_appearance():
                        await a.reload(wait_until='domcontentloaded')
                        await dismiss_returning_welcome(a)
                        await expect(a.locator('.game-nav')).to_be_visible()
                        state = await bootstrap(a)
                        assert state['profile']['id'] == users['a']['id']
                        assert state['profile']['appearance']['hair'] == 'braids'
                        await a.locator('[aria-label="Your resident profile"]').click()
                        await a.locator('#profile-form [name="hair"][value="locs"]').check()
                        await a.locator('#profile-form [name="top"][value="ochre"]').check()
                        await a.locator('#profile-form [type="submit"]').click()
                        await wait_state(a, lambda s:s['profile']['appearance']['hair']=='locs')
                        await a.reload(wait_until='domcontentloaded')
                        await dismiss_returning_welcome(a)
                        await expect(a.locator('#profile-form')).to_be_visible()
                        state = await bootstrap(a)
                        assert state['profile']['appearance']['hair']=='locs'
                        assert state['profile']['appearance']['top']=='ochre'
                        return {'appearancePersists': True, 'authenticatedReload': True}
                    await qa.check('Authentication and character customization survive reload', persisted_auth_and_appearance)

                    async def home_objects():
                        await navigate(a,'world')
                        before = (await bootstrap(a))['profile']
                        await activate_home_object(a, 'sleep')
                        await expect(a.locator('#sheet-title')).to_have_text('Get some rest')
                        await a.locator('#confirm-interaction').click()
                        await expect(a.locator('.sheet')).to_have_count(0)
                        after = (await wait_state(a, lambda s:s['profile']['energy'] > before['energy'] or s['profile']['stress'] < before['stress'], timeout=25))['profile']
                        assert after['energy'] > before['energy'] or after['stress'] < before['stress'], 'Rest must improve energy or stress'
                        before_shower = (await bootstrap(a))['profile']
                        await activate_home_object(a, 'shower')
                        await a.locator('#confirm-interaction').click()
                        await expect(a.locator('.sheet')).to_have_count(0)
                        before = (await wait_state(a, lambda s:s['profile']['hygiene'] > before_shower['hygiene'], timeout=25))['profile']
                        assert before['hygiene'] > before_shower['hygiene'], 'Shower must improve hygiene'
                        await activate_home_object(a, 'eat')
                        advertised = await a.locator('.sheet .detail-line strong').inner_text()
                        await a.locator('#confirm-interaction').click()
                        await expect(a.locator('.sheet')).to_have_count(0)
                        after = (await wait_state(a, lambda s:s['profile']['hunger'] > before['hunger'], timeout=25))['profile']
                        paid = before['wallet']-after['wallet']
                        assert advertised == f'₦{paid:,}', {'advertised':advertised,'charged':paid}
                        assert after['hunger'] > before['hunger'], 'A paid meal must improve hunger'
                        return {'contextualObjects': ['bed','shower','kitchen'], 'mealCharge':paid}
                    await qa.check('Home objects affect needs with an accurate visible price', home_objects)

                    async def phone_hardware_and_back():
                        await a.locator('.game-nav [data-phone="home"]').click()
                        await expect(a.locator('#ph-device-name')).to_have_text('AbujaLife Phone')
                        await expect(a.locator('.ph-unlock')).to_be_visible()
                        await a.screenshot(path=str(ARTIFACTS/'phone-lock-desktop.png'), full_page=True)
                        await a.locator('.ph-unlock').click()
                        await a.screenshot(path=str(ARTIFACTS/'phone-home-desktop.png'), full_page=True)
                        await a.locator('.ph-app-grid [data-app="wallet"]').click()
                        await expect(a.locator('.ph-app-header>strong')).to_have_text('Naira wallet')
                        await a.locator('.ph-back').click()
                        await expect(a.locator('.ph-app-grid').first).to_be_visible()
                        await close_phone(a)
                        return {'device':'AbujaLife Phone','lockUnlock':True,'appBack':True}
                    await qa.check('Phone lock, unlock, hardware identity, app and back navigation', phone_hardware_and_back)

                    async def friendships():
                        await a.reload(wait_until='domcontentloaded')
                        await dismiss_returning_welcome(a)
                        await expect(a.locator('.game-nav')).to_be_visible()
                        await open_phone(a, 'contacts')
                        await a.locator(f'[data-ph-action="person"][data-id="{users["b"]["id"]}"]').click()
                        await expect(a.locator('.ph-contact-hero')).to_contain_text('Online now')
                        await a.locator('[data-ph-action="friend-request"]').click()
                        await wait_state(b, lambda s:len(s.get('friendRequests',[]))>0)
                        await b.reload(wait_until='domcontentloaded')
                        await dismiss_returning_welcome(b)
                        await expect(b.locator('.game-nav')).to_be_visible()
                        await open_phone(b, 'friends')
                        await expect(b.locator('.ph-request-row')).to_contain_text('Amara QA')
                        await b.locator('[data-ph-action="friend-respond"][data-accept="true"]').click()
                        await wait_state(a, lambda s:len(s.get('friends',[]))==1)
                        await expect(b.locator('.ph-list-row').filter(has_text='Amara QA')).to_be_visible()
                        return {'friendRequestAccepted':True,'presenceShowsRealOnlineSession':True}
                    await qa.check('Real online presence and friend request acceptance', friendships)

                    async def direct_messages():
                        await a.locator('[data-ph-action="dm"]').click()
                        await expect(a.locator('#ph-message')).to_be_visible()
                        await a.locator('#ph-message').fill('Meet by Jabi lake? Browser QA message one.')
                        await a.locator('[aria-label="Send message"]').click()
                        await expect(a.locator('.ph-bubbles')).to_contain_text('Browser QA message one.')
                        bstate = await wait_state(b, lambda s:any(c.get('unread',0)>0 for c in s.get('conversations',[])))
                        conversation = bstate['conversations'][0]
                        await close_phone(b)
                        await open_phone(b, 'messages')
                        await expect(b.locator('.ph-unread')).to_have_text('1')
                        await b.locator(f'[data-ph-action="thread"][data-id="{conversation["id"]}"]').click()
                        await expect(b.locator('.ph-bubbles')).to_contain_text('Browser QA message one.')
                        await expect(a.locator('.ph-message.mine')).to_contain_text('Read')
                        # Delay only delivery of the real POST response: server and recipient
                        # still receive the real message. Typing the next draft in this window
                        # must survive send completion as well as incoming realtime activity.
                        message_url=f'{BASE}/api/conversations/{conversation["id"]}/messages'
                        async def delayed_real_response(route):
                            if route.request.method!='POST':
                                await route.continue_();return
                            response=await route.fetch()
                            await asyncio.sleep(.4)
                            await route.fulfill(response=response)
                        await a.route(message_url, delayed_real_response)
                        await a.locator('#ph-message').fill('Browser QA message three, live into your open thread.')
                        await a.locator('[aria-label="Send message"]').click()
                        await expect(b.locator('.ph-bubbles')).to_contain_text('message three, live into your open thread.')
                        await a.locator('#ph-message').fill('Keep this unsent draft during incoming activity.')
                        await expect(a.locator('[aria-label="Send message"]')).to_be_enabled()
                        await a.unroute(message_url, delayed_real_response)
                        await expect(a.locator('#ph-message')).to_have_value('Keep this unsent draft during incoming activity.')
                        await b.locator('#ph-message').fill('Yes. Browser QA message two.')
                        await expect(a.locator('.ph-thread-person')).to_contain_text('is typing')
                        await b.locator('[aria-label="Send message"]').click()
                        await expect(a.locator('.ph-bubbles')).to_contain_text('Browser QA message two.')
                        await expect(a.locator('#ph-message')).to_have_value('Keep this unsent draft during incoming activity.')
                        await a.locator('#ph-message').fill('')
                        await expect(a.locator('.ph-bubbles')).to_contain_text('Browser QA message one.')
                        astate = await bootstrap(a)
                        assert astate['conversations'][0]['unread']==0
                        await a.screenshot(path=str(ARTIFACTS/'real-thread-desktop.png'), full_page=True)
                        await b.screenshot(path=str(ARTIFACTS/'real-thread-mobile.png'), full_page=True)
                        await close_phone(a)
                        await a.reload(wait_until='domcontentloaded')
                        await dismiss_returning_welcome(a)
                        await expect(a.locator('.game-nav')).to_be_visible()
                        await open_phone(a, 'messages')
                        await a.locator(f'[data-ph-action="thread"][data-id="{conversation["id"]}"]').click()
                        await expect(a.locator('.ph-bubbles')).to_contain_text('Browser QA message two.')
                        return {'conversationId':conversation['id'],'realtimeBothDirections':True,'unreadAndReadReceipt':True,'reloadPersists':True}
                    await qa.check('Realtime two-session DM, unread badge, read receipt and persisted history', direct_messages)

                    async def presence_privacy_realtime():
                        await open_phone(a, 'contacts')
                        row = a.locator(f'[data-ph-action="person"][data-id="{users["b"]["id"]}"]')
                        await expect(row).to_contain_text('Online now')
                        await open_phone(b, 'settings')
                        await b.locator('[data-ph-action="setting"][data-key="presenceVisible"]').click()
                        await wait_state(a, lambda s:not next(person for person in s['people'] if person['id']==users['b']['id'])['online'])
                        await expect(row).not_to_contain_text('Online now')
                        await b.locator('[data-ph-action="setting"][data-key="presenceVisible"]').click()
                        await wait_state(a, lambda s:next(person for person in s['people'] if person['id']==users['b']['id'])['online'])
                        await expect(row).to_contain_text('Online now')
                        await close_phone(a)
                        await close_phone(b)
                        return {'presencePrivacyRespected':True,'liveUiChangesWithoutReload':True}
                    await qa.check('Presence privacy changes propagate into the open phone in realtime', presence_privacy_realtime)

                    async def job_tasks_and_reward():
                        await close_phone(a)
                        await navigate(a,'world')
                        await open_home_door(a)
                        await wait_state(a, lambda s:s['profile']['location']['kind']=='public')
                        await navigate(a,'work')
                        await a.locator('[data-job="restaurant-host"]').click()
                        await a.locator('[data-take-job="restaurant-host"]').click()
                        await wait_state(a, lambda s:s['profile']['job']=='restaurant-host')
                        await a.locator('[data-start-shift]').click()
                        if await a.locator('#travel-form').count():
                            submit = a.locator('#travel-form [type="submit"]')
                            await expect(submit).to_be_enabled()
                            await submit.click()
                            await wait_state(a, lambda s:s['profile']['district']=='garki-i' and s['profile']['location']['kind']=='public' and not s['profile'].get('activeTrip'), timeout=40)
                            await navigate(a,'work')
                            await a.locator('[data-job="restaurant-host"]').click()
                            await a.locator('[data-start-shift]').click()
                        await expect(a.locator('#shift-form')).to_be_visible()
                        before = await bootstrap(a)
                        challenge = before['activeChallenge']
                        answers={'arrival':'join','allergy':'kitchen','order':'update'}
                        for task, answer in answers.items():
                            await a.locator(f'#shift-form [name="{task}"][value="{answer}"]').check()
                        await asyncio.sleep(1.6)
                        await a.locator('#shift-form [type="submit"]').click()
                        state = await wait_state(a, lambda s:s['profile']['completedShifts']==1)
                        earned = state['profile']['wallet']-before['profile']['wallet']
                        assert earned==5600, earned
                        replay=await a.request.post(f'{BASE}/api/action',data={'action':'complete-shift','payload':{
                            'challengeId':challenge['id'],'answers':[{'taskId':key,'optionId':value} for key,value in answers.items()]}})
                        assert replay.ok, await replay.text()
                        assert (await bootstrap(a))['profile']['wallet']==state['profile']['wallet']
                        tamper=await a.request.post(f'{BASE}/api/action',data={'action':'work-shift','payload':{'pay':999999,'wallet':999999}})
                        assert tamper.status==400
                        assert (await bootstrap(a))['profile']['wallet']==state['profile']['wallet']
                        return {'actualTaskAnswers':3,'earned':earned,'replayMintsNoMoney':True,'clientRewardForgeryRejected':True}
                    await qa.check('Playable shift earns salary once and rejects forged reward', job_tasks_and_reward)

                    async def market_purchase():
                        await close_overlays(a)
                        before = await bootstrap(a)
                        await open_phone(a, 'market')
                        await expect(a.locator('.ph-scroll')).to_contain_text('Okrika Marketplace')
                        await a.locator('[data-ph-action="item"][data-id="linen-shirt"]').click()
                        await a.locator('[data-ph-action="purchase"]').click()
                        state = await wait_state(a, lambda s:'linen-shirt' in s['profile']['inventory'])
                        assert before['profile']['wallet']-state['profile']['wallet']==4200
                        duplicate=await a.request.post(f'{BASE}/api/action',data={'action':'purchase','payload':{'itemId':'linen-shirt'}})
                        assert duplicate.status==409
                        assert (await bootstrap(a))['profile']['wallet']==state['profile']['wallet']
                        await close_phone(a)
                        await a.reload(wait_until='domcontentloaded')
                        await dismiss_returning_welcome(a)
                        await expect(a.locator('.game-nav')).to_be_visible()
                        state = await bootstrap(a)
                        assert 'linen-shirt' in state['profile']['inventory']
                        return {'virtualItem':'linen-shirt','charged':4200,'duplicateRejected':True,'persists':True,'okrikaMarketplace':True}
                    await qa.check('Virtual item purchase, authoritative charge, duplicate rejection and persistence', market_purchase)

                    async def map_travel_and_return():
                        home = users['a']['home']
                        await close_phone(a)
                        await navigate(a,'map')
                        await a.locator('[aria-label="Search all city and advertising destinations"]').fill('Abaji Town')
                        await a.locator('[data-outside-destination]').filter(has_text='Abaji Town').first.click()
                        await expect(a.locator('.outside-selection')).to_contain_text('Abaji Town')
                        await a.screenshot(path=str(ARTIFACTS/'map-source-status.png'), full_page=True)
                        await a.locator('[data-outside-action="travel"]').click()
                        await a.locator('[data-map-mode="bus"]').click()
                        await expect(a.locator('[data-map-go]')).to_be_enabled()
                        quoted_fare = await a.locator('[data-map-quote] strong').inner_text()
                        before = (await bootstrap(a))['profile']
                        await a.locator('[data-map-go]').click()
                        transit = await wait_state(a, lambda s:s['profile'].get('activeTrip'))
                        fare = before['wallet']-transit['profile']['wallet']
                        assert quoted_fare == f'₦{fare:,}', {'quotedFare':quoted_fare,'charged':fare}
                        await expect(a.locator('.trip-banner')).to_be_visible()
                        trip=transit['profile']['activeTrip']
                        assert trip['seconds']>=10, 'Use a longer real bus trip so reload exercises the in-progress journey'
                        saved_before_reload=(await bootstrap(a))['profile']
                        assert saved_before_reload['activeTrip']['id']==trip['id']
                        await a.reload(wait_until='domcontentloaded')
                        await dismiss_returning_welcome(a)
                        restored=(await bootstrap(a))['profile']
                        if restored.get('activeTrip'):
                            assert restored['activeTrip']['id']==trip['id']
                        else:
                            assert time.time()*1000>=trip['arrivesAt'], 'A trip cannot arrive before its deadline'
                            assert restored['district']==trip['destination'] and restored['location']['kind']=='public'
                        assert restored['wallet']==transit['profile']['wallet'], 'Reload must not charge the fare again'
                        arrived=await wait_state(a, lambda s:s['profile']['district']=='abaji-town' and not s['profile'].get('activeTrip'), timeout=40)
                        assert arrived['profile']['location']['kind']=='public'
                        assert (await bootstrap(a))['profile']['district']=='abaji-town'
                        await expect(a.locator('#world-scene')).to_contain_text('Abaji Town')
                        assert 'okrika' in (await a.locator('#world-scene').inner_text()).lower()
                        await open_home_door(a)
                        await expect(a.locator('#travel-form')).to_be_visible()
                        await a.locator('#travel-form [type="submit"]').click()
                        await expect(a.locator('.trip-banner')).to_be_visible()
                        await wait_state(a, lambda s:s['profile']['location']['kind']=='home' and s['profile']['district']==home['district'], timeout=40)
                        await a.reload(wait_until='domcontentloaded')
                        await dismiss_returning_welcome(a)
                        await expect(a.locator('#world-scene')).to_contain_text(home['name'])
                        return {'destination':'abaji-town','travelPersistsAcrossReload':True,'arrivalAndReturnHome':True,'quotedFareMatchesCharge':fare,
                            'homeDistrict':home['district'],'homeName':home['name'],
                            'mapSource':'authored-3d-city','geographySourceAccuracy':'not independently validated by this browser test'}
                    await qa.check('Map destination search, real trip state, arrival, in-world ad and return home', map_travel_and_return)

                    async def browser_back():
                        await close_phone(a)
                        await close_overlays(a)
                        await navigate(a,'world')
                        await navigate(a,'work')
                        await a.go_back(wait_until='domcontentloaded')
                        await expect(a.locator('#world-scene')).to_be_visible()
                        await navigate(a,'map')
                        await expect(a.locator('.abj-restored-map')).to_be_visible()
                        await a.locator('[data-restored-map-close]').click()
                        await expect(a.locator('#world-scene')).to_be_visible()
                        return {'hashHistoryBackRestoresWorld':True,'mapOpensOverTheCity':True}
                    await qa.check('Browser Back restores map then home', browser_back)

                    async def viewport_matrix():
                        result=[]
                        for width,height,label in [(320,568,'small-iphone'),(390,844,'iphone'),(430,932,'large-iphone'),(360,800,'android'),(1440,1000,'desktop')]:
                            await close_phone(a)
                            await a.set_viewport_size({'width':width,'height':height})
                            await navigate(a,'world')
                            await assert_no_overflow(a)
                            await a.screenshot(path=str(ARTIFACTS/f'{label}-world.png'),full_page=True)
                            await open_phone(a)
                            metrics=await assert_no_overflow(a)
                            await a.screenshot(path=str(ARTIFACTS/f'{label}-phone-home.png'),full_page=False)
                            await a.locator('.ph-app-grid [data-app="messages"]').click()
                            await expect(a.locator('.ph-app-header>strong')).to_have_text('Messages')
                            await assert_no_overflow(a)
                            await a.locator('.ph-back').click()
                            await expect(a.locator('.ph-app-grid').first).to_be_visible()
                            await close_phone(a)
                            await navigate(a,'map')
                            await assert_no_overflow(a)
                            await a.locator('[aria-label="Search all city and advertising destinations"]').fill('Kuje')
                            await expect(a.locator('[data-outside-destination]').first).to_contain_text('Kuje')
                            await a.screenshot(path=str(ARTIFACTS/f'{label}-map.png'),full_page=True)
                            result.append({'viewport':[width,height],'label':label,'emulation':'desktop Chromium viewport size','documentWidth':metrics['document']})
                        return result
                    await qa.check('Five viewport layouts, phone app controls and map search without horizontal overflow', viewport_matrix)

                    async def slow_connection():
                        await close_phone(a)
                        cdp=await context_a.new_cdp_session(a)
                        await cdp.send('Network.enable')
                        await cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':400,
                            'downloadThroughput':50000,'uploadThroughput':30000})
                        started=time.monotonic()
                        try:
                            await a.reload(wait_until='domcontentloaded', timeout=70000)
                            await dismiss_returning_welcome(a)
                            await expect(a.locator('.game-nav')).to_be_visible(timeout=25000)
                            await navigate(a,'world')
                            assert (await bootstrap(a))['authenticated']
                            return {'latencyMs':400,'downloadBytesPerSecond':50000,'usableAfterSeconds':round(time.monotonic()-started,2)}
                        finally:
                            await cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':0,
                                'downloadThroughput':-1,'uploadThroughput':-1})
                            await cdp.detach()
                    await qa.check('Saved life loads and navigates under a throttled connection', slow_connection)

                    async def logout_and_login():
                        await close_phone(a)
                        await close_overlays(a)
                        await a.locator('[aria-label="Your resident profile"]').click()
                        await a.locator('[data-logout]').click()
                        await expect(a.locator('#auth-form')).to_be_visible()
                        assert not (await bootstrap(a))['authenticated']
                        await a.locator('[name="username"]').fill('qa_amara')
                        await a.locator('[name="password"]').fill('wrong password 123')
                        await a.locator('.auth-submit').click()
                        await expect(a.locator('#auth-error')).not_to_be_empty()
                        assert not (await bootstrap(a))['authenticated']
                        await a.locator('[name="password"]').fill(PASSWORD)
                        await a.locator('.auth-submit').click()
                        await expect(a.locator('.game-nav')).to_be_visible()
                        state=await bootstrap(a)
                        assert state['profile']['id']==users['a']['id']
                        assert 'linen-shirt' in state['profile']['inventory']
                        return {'logoutInvalidatesSession':True,'incorrectPasswordRejected':True,'savedProgressRestored':True}
                    await qa.check('Logout, rejected incorrect password and sign-in restore saved resident', logout_and_login)
                    async def stable_source():
                        after=source_hashes()
                        assert after==qa.source_start, 'Application files changed during acceptance; rerun after edits settle'
                        return {'filesHashed':len(after)}
                    await qa.check('Application source remained stable during browser acceptance', stable_source)
                    qa.save()
                    await browser.close(); browser=None
            finally:
                try:
                    if browser:
                        await browser.close()
                finally:
                    server.terminate()
                    try:
                        server.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        server.kill();server.wait(timeout=5)
                    qa.save()
            failed=[result for result in qa.results if result['status']=='failed']
            print(json.dumps({'passed':len(qa.results)-len(failed),'failed':len(failed),
                'uncaughtJavaScriptErrors':len([row for row in qa.errors if 'error' in row]),'report':str(ARTIFACTS/'report.json')}),flush=True)
            if failed or any('error' in row for row in qa.errors):
                raise SystemExit(1)


if __name__ == '__main__':
    asyncio.run(main())

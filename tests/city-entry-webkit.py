#!/usr/bin/env python3
import asyncio
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import uuid
import urllib.request

from playwright.async_api import async_playwright, expect

REPO = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get('ABUJALIFE_WEBKIT_PORT', '8792'))
BASE = f'http://127.0.0.1:{PORT}'
PASSWORD = 'AbujaLife WebKit QA 2026!'
DISPLAY = 'WebKit QA'
ARTIFACT_DIR = Path(os.environ.get('ABUJALIFE_WEBKIT_ARTIFACTS', '/tmp/abujalife-webkit'))
IPHONE = {
    'viewport': {'width': 390, 'height': 844},
    'is_mobile': True,
    'has_touch': True,
    'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
}
APPEARANCE = {
    'presentation': 'masculine', 'skinTone': 'brown', 'face': 'oval',
    'hair': 'afro', 'body': 'regular', 'top': 'forest',
    'bottom': 'charcoal', 'shoes': 'white', 'facialHair': 'none', 'accessory': 'none'
}

def stage(name, details=None):
    print(json.dumps({'stage': name, **({'details': details} if details is not None else {})}), flush=True)

async def wait_healthy(server):
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if server.poll() is not None:
            raise RuntimeError('AbujaLife dev server exited before browser test')
        try:
            with urllib.request.urlopen(f'{BASE}/api/health', timeout=1) as response:
                if response.status == 200:
                    return
        except Exception:
            await asyncio.sleep(.15)
    raise RuntimeError('AbujaLife dev server did not become healthy')

async def create_completed_resident(playwright, username):
    stage('fixture-register')
    request = await playwright.request.new_context(base_url=BASE, extra_http_headers={'Origin': BASE})
    try:
        registered = await request.post('/api/auth/register', data={
            'displayName': DISPLAY, 'username': username, 'password': PASSWORD, 'appearance': APPEARANCE
        }, timeout=20000)
        if not registered.ok:
            raise AssertionError(f'fixture register failed: {registered.status} {await registered.text()}')
        stage('fixture-profile')
        profile = await request.post('/api/profile', data={
            'displayName': DISPLAY, 'appearance': APPEARANCE, 'lifeGoal': 'career', 'onboardingComplete': True
        }, timeout=20000)
        if not profile.ok:
            raise AssertionError(f'fixture profile failed: {profile.status} {await profile.text()}')
        entry = await request.get('/api/entry', timeout=20000)
        body = await entry.json()
        if not entry.ok or not body.get('authenticated') or not body.get('profile', {}).get('onboardingComplete'):
            raise AssertionError(f'fixture entry invalid: {entry.status} {body}')
        await request.post('/api/auth/logout', data={}, timeout=20000)
    finally:
        await request.dispose()

async def observe(page):
    page_errors, console_errors, api_events = [], [], []
    page.set_default_timeout(20000)
    page.on('pageerror', lambda error: page_errors.append(str(error)+'\n'+str(error.stack)))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    page.on('response', lambda response: api_events.append({
        'method': response.request.method,
        'path': response.url.replace(BASE, ''),
        'status': response.status
    }) if '/api/' in response.url else None)
    return page_errors, console_errors, api_events

async def assert_playable(page, label):
    stage(f'{label}-wait-world')
    await expect(page.locator('.loading-state')).to_have_count(0, timeout=25000)
    await expect(page.locator('.game-nav')).to_be_visible(timeout=25000)
    await expect(page.locator('#world-scene')).to_be_visible(timeout=25000)
    stage(f'{label}-world-visible')
    await page.wait_for_timeout(7000)
    snapshot = await page.evaluate('''() => ({
        nav: !!document.querySelector('.game-nav'),
        world: !!document.querySelector('#world-scene'),
        loader: !!document.querySelector('.loading-state'),
        bodyText: document.body?.innerText?.slice(0, 500) || '',
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        connected: document.querySelector('#world-scene')?.isConnected === true,
        renderer: document.querySelector('#world-scene')?.dataset.environmentRenderer || 'fallback',
        webgl: document.querySelector('#world-scene')?.dataset.webglContext || 'ok'
    })''')
    if not snapshot['nav'] or not snapshot['world'] or snapshot['loader'] or not snapshot['connected']:
        raise AssertionError(f'{label} lost playable city after render: {snapshot}')
    if snapshot['width'] > snapshot['viewport'] + 2:
        raise AssertionError(f'{label} overflows mobile viewport: {snapshot}')
    stage(f'{label}-stable', snapshot)
    return snapshot

async def sign_in_existing(browser, username):
    context = await browser.new_context(**IPHONE)
    if os.environ.get('ABUJALIFE_LEGACY_ABORT') == '1':
        await context.add_init_script('AbortSignal.any=undefined;AbortSignal.timeout=undefined;')
    page = await context.new_page()
    page_errors, console_errors, api_events = await observe(page)
    try:
        stage('existing-open-auth')
        await page.goto(BASE, wait_until='domcontentloaded', timeout=20000)
        await expect(page.locator('#auth-form')).to_be_visible(timeout=20000)
        await page.locator('[data-mode="login"]').click()
        await page.locator('[name="username"]').fill(username)
        await page.locator('[name="password"]').fill(PASSWORD)
        stage('existing-submit-login')
        await page.locator('.auth-submit').click()
        first = await assert_playable(page, 'existing-login')
        stage('existing-reload')
        await page.reload(wait_until='domcontentloaded', timeout=20000)
        second = await assert_playable(page, 'existing-reload')
        await page.screenshot(path=str(ARTIFACT_DIR / 'webkit-existing-city.png'), full_page=True)
        fatal_console = [entry for entry in console_errors if 'openstreetmap' not in entry.lower()]
        if page_errors or fatal_console:
            raise AssertionError(f'existing resident browser errors: page={page_errors}; console={fatal_console}; api={api_events[-20:]}')
        return {'login': first, 'reload': second, 'apiEvents': api_events[-20:]}
    except Exception as error:
        await page.screenshot(path=str(ARTIFACT_DIR / 'existing-failure.png'), full_page=True)
        (ARTIFACT_DIR / 'existing-failure.html').write_text(await page.content())
        stage('existing-failure', {'error': str(error), 'pageErrors': page_errors, 'consoleErrors': console_errors[-10:], 'apiEvents': api_events[-20:]})
        raise
    finally:
        await context.close()

async def complete_onboarding(page, api_events):
    await expect(page.locator('#onboarding-form')).to_be_visible(timeout=20000)
    for index in range(10):
        form = page.locator('#onboarding-form')
        if not await form.count():
            break
        stage('onboarding-step', index)
        for selector in [
            '[name="presentation"][value="masculine"]',
            '[name="hair"][value="afro"]',
            '[name="body"][value="regular"]',
            '[name="top"][value="forest"]',
            '[name="bottom"][value="charcoal"]',
            '[name="shoes"][value="white"]',
            '[name="lifeGoal"][value="career"]',
        ]:
            control = form.locator(selector)
            if await control.count() and await control.first.is_visible():
                await control.first.check()
        display = form.locator('[name="displayName"]:visible')
        if await display.count():
            await display.fill(DISPLAY)
        begin = page.locator('#begin-life:visible')
        if await begin.count():
            stage('onboarding-submit-final')
            await begin.click()
            break
        next_button = page.locator('[data-onboarding-next]:visible')
        if not await next_button.count():
            raise AssertionError('Onboarding has no visible continue control')
        await next_button.click()
    try:
        await expect(page.locator('#onboarding-form')).to_have_count(0, timeout=25000)
    except AssertionError as original:
        error_text = ''
        if await page.locator('#onboarding-error').count():
            error_text = (await page.locator('#onboarding-error').inner_text()).strip()
        step = await page.locator('.onboarding-progress strong').inner_text() if await page.locator('.onboarding-progress strong').count() else 'unknown'
        raise AssertionError(f'onboarding did not finish; step={step!r}; ui_error={error_text!r}; api_events={api_events[-12:]}') from original

async def register_and_reenter(browser, username):
    context = await browser.new_context(**IPHONE)
    if os.environ.get('ABUJALIFE_LEGACY_ABORT') == '1':
        await context.add_init_script('AbortSignal.any=undefined;AbortSignal.timeout=undefined;')
    page = await context.new_page()
    page_errors, console_errors, api_events = await observe(page)
    try:
        stage('new-open-auth')
        await page.goto(BASE, wait_until='domcontentloaded', timeout=20000)
        await expect(page.locator('#auth-form')).to_be_visible(timeout=20000)
        await page.locator('[name="displayName"]').fill(DISPLAY)
        await page.locator('[name="username"]').fill(username)
        await page.locator('[name="password"]').fill(PASSWORD)
        stage('new-submit-register')
        await page.locator('.auth-submit').click()
        await complete_onboarding(page, api_events)
        fresh = await assert_playable(page, 'new-resident')
        stage('new-logout')
        logout = await context.request.post(f'{BASE}/api/auth/logout', data={}, timeout=20000)
        if not logout.ok:
            raise AssertionError(f'logout failed: {logout.status} {await logout.text()}')
        await page.reload(wait_until='domcontentloaded', timeout=20000)
        await expect(page.locator('#auth-form')).to_be_visible(timeout=20000)
        await page.locator('[data-mode="login"]').click()
        await page.locator('[name="username"]').fill(username)
        await page.locator('[name="password"]').fill(PASSWORD)
        stage('new-sign-back-in')
        await page.locator('.auth-submit').click()
        signed_in = await assert_playable(page, 'new-sign-back-in')
        await page.screenshot(path=str(ARTIFACT_DIR / 'webkit-new-city.png'), full_page=True)
        fatal_console = [entry for entry in console_errors if 'openstreetmap' not in entry.lower()]
        if page_errors or fatal_console:
            raise AssertionError(f'new resident browser errors: page={page_errors}; console={fatal_console}; api={api_events[-20:]}')
        return {'fresh': fresh, 'signedIn': signed_in, 'apiEvents': api_events[-20:]}
    except Exception as error:
        stage('new-failure', {'error': str(error), 'pageErrors': page_errors, 'consoleErrors': console_errors[-10:], 'apiEvents': api_events[-20:]})
        raise
    finally:
        await context.close()

async def main():
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='abujalife-webkit-') as data_dir:
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(('127.0.0.1', PORT))
        log_path = ARTIFACT_DIR / 'server.log'
        with log_path.open('w') as server_log:
            env = dict(os.environ, PORT=str(PORT), ABUJALIFE_DATA_DIR=data_dir, ABUJALIFE_QA_ORIGIN='lapo')
            server = subprocess.Popen(['node', 'scripts/dev.mjs'], cwd=REPO, env=env,
                                      stdout=server_log, stderr=subprocess.STDOUT)
            try:
                await wait_healthy(server)
                stage('server-healthy')
                async with async_playwright() as playwright:
                    existing_username = f'existing_{uuid.uuid4().hex[:10]}'
                    new_username = f'new_{uuid.uuid4().hex[:10]}'
                    await create_completed_resident(playwright, existing_username)
                    browser = await playwright.webkit.launch(headless=True)
                    try:
                        existing = await asyncio.wait_for(sign_in_existing(browser, existing_username), timeout=180)
                        new = await asyncio.wait_for(register_and_reenter(browser, new_username), timeout=180)
                    finally:
                        await browser.close()
                    print(json.dumps({'ok': True, 'engine': 'webkit-mobile', 'existingResident': existing, 'newResident': new}), flush=True)
            finally:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait(timeout=5)

if __name__ == '__main__':
    asyncio.run(main())

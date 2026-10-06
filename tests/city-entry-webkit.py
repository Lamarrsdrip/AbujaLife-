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
USERNAME = f'webkit_{uuid.uuid4().hex[:10]}'
DISPLAY = 'WebKit QA'
ARTIFACT_DIR = Path(os.environ.get('ABUJALIFE_WEBKIT_ARTIFACTS', '/tmp/abujalife-webkit'))

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

async def complete_onboarding(page):
    await expect(page.locator('#onboarding-form')).to_be_visible(timeout=20000)
    for _ in range(10):
        form = page.locator('#onboarding-form')
        if not await form.count():
            break
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
            await begin.click()
            break
        next_button = page.locator('[data-onboarding-next]:visible')
        if not await next_button.count():
            raise AssertionError('Onboarding has no visible continue control')
        await next_button.click()
    await expect(page.locator('#onboarding-form')).to_have_count(0, timeout=20000)

async def assert_playable(page, label):
    await expect(page.locator('.loading-state')).to_have_count(0, timeout=20000)
    await expect(page.locator('.game-shell')).to_be_visible(timeout=20000)
    await expect(page.locator('.game-nav')).to_be_visible(timeout=20000)
    await expect(page.locator('#world-scene')).to_be_visible(timeout=20000)
    await page.wait_for_timeout(7000)
    snapshot = await page.evaluate('''() => ({
        shell: !!document.querySelector('.game-shell'),
        nav: !!document.querySelector('.game-nav'),
        world: !!document.querySelector('#world-scene'),
        loader: !!document.querySelector('.loading-state'),
        bodyText: document.body?.innerText?.slice(0, 500) || '',
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        connected: document.querySelector('#world-scene')?.isConnected === true,
        renderer: document.querySelector('#world-scene')?.dataset.environmentRenderer || 'fallback'
    })''')
    if not snapshot['shell'] or not snapshot['nav'] or not snapshot['world'] or snapshot['loader'] or not snapshot['connected']:
        raise AssertionError(f'{label} lost playable city after render: {snapshot}')
    if snapshot['width'] > snapshot['viewport'] + 2:
        raise AssertionError(f'{label} overflows mobile viewport: {snapshot}')
    return snapshot

async def main():
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='abujalife-webkit-') as data_dir:
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(('127.0.0.1', PORT))
        log_path = ARTIFACT_DIR / 'server.log'
        with log_path.open('w') as server_log:
            env = dict(os.environ, PORT=str(PORT), ABUJALIFE_DATA_DIR=data_dir)
            server = subprocess.Popen(['node', 'scripts/dev.mjs'], cwd=REPO, env=env,
                                      stdout=server_log, stderr=subprocess.STDOUT)
            try:
                await wait_healthy(server)
                async with async_playwright() as playwright:
                    browser = await playwright.webkit.launch(headless=True)
                    context = await browser.new_context(
                        viewport={'width': 390, 'height': 844},
                        is_mobile=True,
                        has_touch=True,
                        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
                    )
                    page = await context.new_page()
                    page_errors = []
                    console_errors = []
                    page.on('pageerror', lambda error: page_errors.append(str(error)))
                    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)

                    await page.goto(BASE, wait_until='domcontentloaded')
                    await expect(page.locator('#auth-form')).to_be_visible(timeout=20000)
                    await page.locator('[name="displayName"]').fill(DISPLAY)
                    await page.locator('[name="username"]').fill(USERNAME)
                    await page.locator('[name="password"]').fill(PASSWORD)
                    await page.locator('.auth-submit').click()
                    await complete_onboarding(page)
                    first = await assert_playable(page, 'fresh resident')

                    logout = await context.request.post(f'{BASE}/api/auth/logout', data={})
                    if not logout.ok:
                        raise AssertionError(f'logout failed: {logout.status} {await logout.text()}')
                    await page.reload(wait_until='domcontentloaded')
                    await expect(page.locator('#auth-form')).to_be_visible(timeout=20000)
                    await page.locator('[data-mode="login"]').click()
                    await page.locator('[name="username"]').fill(USERNAME)
                    await page.locator('[name="password"]').fill(PASSWORD)
                    await page.locator('.auth-submit').click()
                    second = await assert_playable(page, 'signed-in resident')

                    await page.reload(wait_until='domcontentloaded')
                    third = await assert_playable(page, 'authenticated reload')

                    await page.screenshot(path=str(ARTIFACT_DIR / 'webkit-city.png'), full_page=True)
                    if page_errors:
                        raise AssertionError(f'WebKit page errors: {page_errors}')
                    fatal_console = [entry for entry in console_errors if 'openstreetmap' not in entry.lower()]
                    if fatal_console:
                        raise AssertionError(f'WebKit console errors: {fatal_console}')

                    print(json.dumps({'ok': True, 'engine': 'webkit-mobile', 'fresh': first, 'login': second, 'reload': third}))
                    await context.close()
                    await browser.close()
            finally:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait(timeout=5)

if __name__ == '__main__':
    asyncio.run(main())

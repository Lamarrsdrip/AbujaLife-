#!/usr/bin/env python3
"""Exercise actual dist + a real disposable Mongo API at the two public origins.

Start the repository's real production API against a disposable Mongo database,
then run ABUJALIFE_QA_API_PORT=8995 python tests/production-browser-smoke.py.
No API endpoint is mocked. A loopback-only TLS proxy forwards requests to that
API and serves dist. Chromium maps the actual public domains to this proxy and
accepts its generated local test certificate. Public DNS/TLS is not verified.
The API fixture owner remains responsible for dropping its disposable database.
"""
import asyncio
import base64
import datetime
import hashlib
import http.client
import http.server
import json
import mimetypes
import os
from pathlib import Path
import ssl
import subprocess
import tempfile
import threading
import time
import traceback
from urllib.parse import unquote, urlsplit
import urllib.request
import uuid

from playwright.async_api import async_playwright, expect

REPO = Path(__file__).resolve().parents[1]
DIST = REPO / 'dist'
API_PORT = int(os.environ.get('ABUJALIFE_QA_API_PORT', '8995'))
TLS_PORT = int(os.environ.get('ABUJALIFE_QA_TLS_PORT', '443'))
RUN_ID = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
ARTIFACTS = Path(os.environ.get('ABUJALIFE_QA_ARTIFACTS', '/workspace/scratch/production-browser')) / RUN_ID
WEB = 'https://abujacity.life'
API = 'https://api.abujacity.life'
expect.set_options(timeout=30000)


class Checks(list):
    def append(self, result):
        super().append(result)
        print(json.dumps(result), flush=True)


class Proxy(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError, ssl.SSLError):
            # Chromium can close an idle TLS connection during page reload.
            pass

    def log_message(self, *_):
        pass

    def do_GET(self):
        self.forward()

    def do_POST(self):
        self.forward()

    def do_OPTIONS(self):
        self.forward()

    def do_HEAD(self):
        self.forward()

    def forward(self):
        hostname = self.headers.get('Host', '').split(':')[0]
        if hostname == 'api.abujacity.life':
            self.api()
        elif hostname == 'abujacity.life':
            self.static()
        else:
            self.send_error(400, 'Use the configured game domains')

    def api(self):
        connection = http.client.HTTPConnection('127.0.0.1', API_PORT, timeout=45)
        try:
            body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
            headers = {key: value for key, value in self.headers.items() if key.lower() not in ('connection', 'host')}
            headers['Host'] = 'api.abujacity.life'
            connection.request(self.command, self.path, body=body, headers=headers)
            response = connection.getresponse()
            stream = response.getheader('content-type', '').startswith('text/event-stream')
            data = None if stream else response.read()
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in ('connection', 'transfer-encoding', 'content-length'):
                    self.send_header(key, value)
            if stream:
                self.send_header('Connection', 'close')
                self.close_connection = True
            else:
                self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            if self.command == 'HEAD':
                return
            if stream:
                while True:
                    chunk = response.read1(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
            else:
                self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, ssl.SSLError):
            pass
        finally:
            connection.close()

    def static(self):
        if self.command not in ('GET', 'HEAD'):
            self.send_error(405)
            return
        pathname = unquote(urlsplit(self.path).path)
        if pathname.startswith('/api/'):
            self.send_error(404)
            return
        filename = (DIST / pathname.lstrip('/')).resolve()
        if not filename.is_relative_to(DIST.resolve()):
            self.send_error(404)
            return
        if filename.is_dir():
            filename /= 'index.html'
        if not filename.exists() and '.' not in Path(pathname).name:
            filename = DIST / 'index.html'
        if not filename.is_file():
            self.send_error(404)
            return
        data = filename.read_bytes()
        mime = 'application/manifest+json' if filename.suffix == '.webmanifest' else mimetypes.guess_type(str(filename))[0] or 'application/octet-stream'
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)


async def api(page, path, body=None):
    result = await page.evaluate('''async ({path,body})=>{
      const response=await fetch(globalThis.ABUJA_PUBLIC_CONFIG.API_PUBLIC_URL+path,{
        credentials:'include',cache:'no-store',...(body===null?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
      });return {status:response.status,body:await response.json()};
    }''', {'path': path, 'body': body})
    assert 200 <= result['status'] < 300 and result['body'].get('ok', True), result
    return result['body']


async def register(page, name, username, gender):
    await page.goto(WEB + '/', wait_until='domcontentloaded')
    await expect(page.locator('#auth-form')).to_be_visible()
    await page.locator('#auth-form [name="displayName"]').fill(name)
    await page.locator('#auth-form [name="username"]').fill(username)
    await page.locator('#auth-form [name="password"]').fill('Disposable browser acceptance 2026!')
    await page.locator('#auth-form [type="submit"]').click()
    await expect(page.locator('#onboarding-form')).to_be_visible()
    await expect(page.locator('#onboarding-form [name="presentation"]:checked')).to_have_count(0)
    await expect(page.locator('#onboarding-form [name="presentation"]')).to_have_count(2)
    await page.locator(f'#onboarding-form [name="presentation"][value="{gender}"]').check()
    for _ in range(8):
        goal = page.locator('#onboarding-form [name="lifeGoal"][value="career"]')
        if await goal.count():
            await goal.check()
        begin = page.locator('#begin-life:visible')
        if await begin.count():
            await begin.click()
            break
        await page.locator('[data-onboarding-next]:visible').click()
    await expect(page.locator('#onboarding-form')).to_have_count(0)
    await expect(page.locator('.game-nav')).to_be_visible()
    await page.wait_for_function("document.documentElement.dataset.connection==='online'", timeout=30000)
    state = await api(page, '/api/bootstrap')
    assert state['authenticated'] and state['profile']['onboardingComplete']
    assert state['profile']['appearance']['presentation'] == gender
    assert state.get('preview') is not True
    assert await page.evaluate("document.documentElement.dataset.preview||null") is None
    return state['profile']


async def wallet_transfer(page, target, target_username, amount):
    await page.locator('.game-nav [data-phone="home"]').click()
    await expect(page.locator('#ph-device-name')).to_be_visible()
    unlock = page.locator('.ph-unlock')
    if await unlock.count():
        await unlock.click()
    else:
        await page.locator('.ph-home-indicator').click()
    await page.locator('.ph-app-grid [data-app="wallet"]').click()
    await page.locator('[data-ph-action="wallet-send"]').click()
    await expect(page.locator('#ph-search')).to_be_visible()
    await page.locator('#ph-search').fill(target_username)
    await page.locator(f'[data-ph-action="wallet-recipient"][data-id="{target}"]').click()
    await page.locator('[data-ph-form="wallet-transfer"] [name="transferAmount"]').fill(str(amount))
    await page.locator('[data-ph-form="wallet-transfer"] [name="transferNote"]').fill('Cross-origin browser acceptance')
    await page.locator('[data-ph-form="wallet-transfer"] [type="submit"]').click()
    async with page.expect_response(lambda response: response.url == API + '/api/wallet/transfer' and response.request.method == 'POST') as observed:
        await page.locator('[data-ph-action="wallet-confirm"]').click()
    response = await observed.value
    assert response.status == 200, await response.text()
    request = response.request.post_data_json
    assert request['idempotencyKey']
    await expect(page.locator('.ph-wallet-receipt')).to_be_visible()
    return request


async def run_browser(report, certificate_spki):
    async with async_playwright() as playwright:
        replacement = f'127.0.0.1:{TLS_PORT}'
        browser = await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                  f'--ignore-certificate-errors-spki-list={certificate_spki}',
                  f'--host-resolver-rules=MAP abujacity.life {replacement}, MAP api.abujacity.life {replacement}'])
        contexts = [await browser.new_context(viewport={'width': 1280, 'height': 900}) for _ in range(2)]
        pages = [await context.new_page() for context in contexts]
        errors, network = [], []
        for index, page in enumerate(pages):
            page.on('pageerror', lambda error, label=index: errors.append({'resident': label, 'error': str(error)}))
            page.on('response', lambda response, label=index: network.append({'resident': label, 'path': urlsplit(response.url).path, 'origin': urlsplit(response.url).netloc, 'status': response.status}))
        try:
            female = await register(pages[0], 'Browser Female', 'browser_f_' + uuid.uuid4().hex[:10], 'feminine')
            male = await register(pages[1], 'Browser Male', 'browser_m_' + uuid.uuid4().hex[:10], 'masculine')
            report['checks'].append({'check': 'Two separate real account signups and explicit Female/Male wizards', 'status': 'passed'})
            cookie_metadata = []
            for context, page in zip(contexts, pages):
                cookie = next(cookie for cookie in await context.cookies() if cookie['name'] == 'abujalife_session')
                assert cookie['domain'] == 'api.abujacity.life' and cookie['httpOnly'] and cookie['secure'] and cookie['sameSite'] == 'Lax'
                assert 'abujalife_session' not in await page.evaluate('document.cookie')
                cookie_metadata.append({key: cookie[key] for key in ('name', 'domain', 'httpOnly', 'secure', 'sameSite')})
            report['cookie_metadata'] = cookie_metadata
            report['checks'].append({'check': 'API host-only Secure HttpOnly SameSite=Lax cookies and credentialed SSE', 'status': 'passed'})
            market = await api(pages[0], '/api/bootstrap')
            catalog = market['catalog'] if isinstance(market['catalog'], list) else [dict(value, id=key) for key, value in market['catalog'].items()]
            choices = [item for item in catalog if item['category'] != 'vehicle' and item['id'] not in market['profile']['inventory'] and 0 < item['price'] <= market['profile']['wallet'] - 100]
            assert choices, 'The starting resident cannot afford any available market item'
            item = min(choices, key=lambda candidate: candidate['price'])
            await pages[0].goto(WEB + '/#market', wait_until='domcontentloaded')
            async with pages[0].expect_response(lambda response: response.url == API + '/api/action' and response.request.method == 'POST') as observed:
                await pages[0].locator(f'[data-purchase="{item["id"]}"]').click()
            purchase_response = await observed.value
            assert purchase_response.status == 200, await purchase_response.text()
            purchase = purchase_response.request.post_data_json
            assert purchase['payload']['idempotencyKey'], 'The app wrapper did not add an action operation key'
            purchased = (await api(pages[0], '/api/bootstrap'))['profile']
            assert item['id'] in purchased['inventory'] and purchased['wallet'] == market['profile']['wallet'] - item['price']
            assert (await api(pages[0], '/api/action', purchase))['replayed'] is True
            assert (await api(pages[0], '/api/bootstrap'))['profile']['wallet'] == purchased['wallet']
            report['checks'].append({'check': 'Real market purchase receives an action key and replays without another debit', 'status': 'passed'})
            await pages[0].goto(WEB + '/', wait_until='domcontentloaded')
            await expect(pages[0].locator('.game-nav')).to_be_visible()
            before = [(await api(page, '/api/bootstrap'))['profile']['wallet'] for page in pages]
            request = await wallet_transfer(pages[0], male['id'], male['username'], 100)
            after = [(await api(page, '/api/bootstrap'))['profile']['wallet'] for page in pages]
            assert after == [before[0] - 100, before[1] + 100], (before, after)
            replay = await api(pages[0], '/api/wallet/transfer', request)
            assert replay['replayed'] is True
            assert [(await api(page, '/api/bootstrap'))['profile']['wallet'] for page in pages] == after
            report['checks'].append({'check': 'Real phone transfer, atomic two-account balances and identical-key replay', 'status': 'passed'})
            conversation = (await api(pages[0], '/api/conversations', {'residentId': male['id']}))['conversation']['id']
            message = 'Real Mongo message ' + RUN_ID
            await api(pages[0], '/api/conversations/' + conversation + '/messages', {'text': message})
            recipient_messages = await api(pages[1], '/api/conversations/' + conversation + '/messages')
            assert any(row['text'] == message for row in recipient_messages['messages'])
            text = 'Real connected feed ' + RUN_ID
            post = (await api(pages[0], '/api/social/posts', {'kind': 'post', 'text': text, 'idempotencyKey': str(uuid.uuid4())}))['post']
            feed = await api(pages[1], '/api/social/feed')
            assert any(row['id'] == post['id'] and row['text'] == text for row in feed['posts'])
            report['checks'].append({'check': 'Connected resident messages and feed cross both real accounts', 'status': 'passed'})
            for page, profile in zip(pages, [female, male]):
                await page.reload(wait_until='domcontentloaded')
                await expect(page.locator('.game-nav')).to_be_visible()
                state = await api(page, '/api/bootstrap')
                assert state['profile']['id'] == profile['id']
                await page.wait_for_function("document.documentElement.dataset.connection==='online'", timeout=30000)
                await page.evaluate("Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('The production worker did not become ready')),30000))])")
                cache_urls = await page.evaluate('''async()=>{const urls=[];for(const name of await caches.keys()){for(const request of await (await caches.open(name)).keys())urls.push(request.url);}return urls;}''')
                assert cache_urls and any(urlsplit(url).path == '/app.js' for url in cache_urls)
                assert all(urlsplit(url).netloc == 'abujacity.life' and not urlsplit(url).path.startswith(('/api/', '/admin')) for url in cache_urls)
            report['checks'].append({'check': 'Session/progress persist after reload and worker contains only public frontend shell', 'status': 'passed'})
            assert not errors, errors
            assert not any(row['origin'] == 'abujacity.life' and row['path'].startswith('/api/') for row in network), network
            assert not any(row['origin'] == 'api.abujacity.life' and row['status'] >= 500 for row in network), network
            report['checks'].append({'check': 'Bundled app has no JavaScript errors, no frontend API calls and no API 5xx responses', 'status': 'passed'})
            for index, page in enumerate(pages):
                await page.screenshot(path=str(ARTIFACTS / f'account-{index + 1}.png'), full_page=True)
        except Exception:
            for index, page in enumerate(pages):
                try:
                    await page.screenshot(path=str(ARTIFACTS / f'failure-account-{index + 1}.png'), full_page=True, timeout=5000)
                    (ARTIFACTS / f'failure-account-{index + 1}.html').write_text(await page.content())
                except Exception:
                    pass
            raise
        finally:
            report['page_errors'] = errors
            report['network'] = network
            await browser.close()


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    report = {'run_id': RUN_ID, 'checks': Checks(), 'scope': 'Actual static production build and real disposable Mongo API over local HTTPS using public domain names.',
              'limitations': ['Public DNS, hosted Hostinger files and public CA certificate are not verified.', 'Chromium accepts only this generated local test certificate; installation/provider TLS verification is unchanged.', 'Operating-system PWA installation is not exercised.']}
    server = None
    try:
        assert (DIST / 'index.html').is_file(), 'Run npm run build first'
        with urllib.request.urlopen(f'http://127.0.0.1:{API_PORT}/health', timeout=10) as response:
            health = json.load(response)
        assert health.get('ok') is True and health.get('storage') == 'mongodb', health
        with tempfile.TemporaryDirectory(prefix='abujalife-browser-tls-') as directory:
            certificate = Path(directory) / 'certificate.pem'
            key = Path(directory) / 'private-key.pem'
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=abujacity.life',
                            '-addext', 'subjectAltName=DNS:abujacity.life,DNS:api.abujacity.life', '-keyout', str(key), '-out', str(certificate)],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            public_key = subprocess.run(['openssl', 'x509', '-in', str(certificate), '-pubkey', '-noout'], check=True, capture_output=True).stdout
            public_der = subprocess.run(['openssl', 'pkey', '-pubin', '-outform', 'DER'], input=public_key, check=True, capture_output=True).stdout
            certificate_spki = base64.b64encode(hashlib.sha256(public_der).digest()).decode()
            server = http.server.ThreadingHTTPServer(('127.0.0.1', TLS_PORT), Proxy)
            server.daemon_threads = True
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(str(certificate), str(key))
            server.socket = context.wrap_socket(server.socket, server_side=True)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            asyncio.run(run_browser(report, certificate_spki))
        report['status'] = 'passed'
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = str(error)
        report['traceback'] = traceback.format_exc()
    finally:
        if server:
            server.shutdown()
            server.server_close()
        (ARTIFACTS / 'report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'status': report['status'], 'checks': report['checks'], 'artifacts': str(ARTIFACTS), **({'error': report['error']} if 'error' in report else {})}, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())

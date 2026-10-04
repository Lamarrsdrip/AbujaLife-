#!/usr/bin/env python3
"""Real admin top-up UI acceptance against dist and a disposable Mongo API.

Start the real production API with the disposable configuration, build dist, then
run ABUJALIFE_QA_MONGO_CONFIG=/private/test-mongodb.json python tests/admin-topup-browser.py.
The existing server-console bootstrap grants a role only after browser signup.
Credentials stay in the subprocess environment and never enter test artifacts.
The fixture owner is responsible for dropping the disposable database afterwards.
"""
import asyncio
import base64
import datetime
import hashlib
import http.server
import importlib.util
import json
import os
from pathlib import Path
import re
import ssl
import subprocess
import tempfile
import threading
import traceback
from urllib.parse import urlsplit, urlencode
import urllib.request
import uuid

from playwright.async_api import async_playwright, expect

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('production_browser_helpers', REPO / 'tests/production-browser-smoke.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
DIST, WEB, API = helpers.DIST, helpers.WEB, helpers.API
API_PORT, TLS_PORT = helpers.API_PORT, helpers.TLS_PORT
RUN_ID = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
ARTIFACTS = Path(os.environ.get('ABUJALIFE_QA_ARTIFACTS', '/workspace/scratch/admin-topup-browser')) / RUN_ID
CONFIG = Path(os.environ.get('ABUJALIFE_QA_MONGO_CONFIG') or os.environ.get('TEST_MONGODB_CONFIG') or '/tmp/abujalife-production-integration/test-mongodb.json')
ADMIN = WEB + '/admin/'


async def result(page, path, body=None):
    return await page.evaluate('''async ({path,body})=>{
      const response=await fetch(globalThis.ABUJA_PUBLIC_CONFIG.API_PUBLIC_URL+path,{
        credentials:'include',cache:'no-store',...(body===null?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
      });return {status:response.status,body:await response.json()};
    }''', {'path': path, 'body': body})


async def api(page, path, body=None):
    value = await result(page, path, body)
    assert 200 <= value['status'] < 300 and value['body'].get('ok', True), f"API {path} failed with status {value['status']}"
    return value['body']


def bootstrap(username):
    # Use the same private app credential as the running API, without a shell,
    # without command-line secrets, and without copying credentials to artifacts.
    fixture = json.loads(CONFIG.read_text())
    assert isinstance(fixture.get('uri'), str) and fixture.get('database') == 'abujalife_prod', 'Use the disposable production Mongo fixture configuration'
    environment = dict(os.environ, NODE_ENV='production', MONGODB_URI=fixture['uri'], MONGODB_DATABASE=fixture['database'])
    completed = subprocess.run(['node', 'deploy/admin-bootstrap.mjs', '--username', username], cwd=REPO, env=environment,
                               capture_output=True, text=True, timeout=45)
    if completed.returncode != 0:
        raise RuntimeError(f'Server-console admin bootstrap failed (exit {completed.returncode}); private subprocess output withheld')
    try:
        granted = json.loads(completed.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        raise RuntimeError('Server-console bootstrap returned an unexpected result; private subprocess output withheld') from None
    assert granted.get('ok') is True and granted.get('role') == 'superadmin' and granted.get('username') == username, 'Server-console role grant did not match the actual resident'
    return {'ok': True, 'username': username, 'role': 'superadmin', 'method': 'deploy/admin-bootstrap.mjs --username EXISTING_USERNAME'}


async def register(page, username, name):
    await page.goto(ADMIN, wait_until='domcontentloaded')
    await page.wait_for_function('Boolean(globalThis.ABUJA_PUBLIC_CONFIG?.API_PUBLIC_URL)')
    value = await api(page, '/api/auth/register', {'username': username, 'displayName': name, 'password': 'Disposable admin browser acceptance 2026!'})
    assert value['authenticated'] is True and value.get('preview') is not True
    return value['profile']


async def audit_for(page, actor_id, target_id):
    rows, cursor, seen = [], None, set()
    while True:
        query = '?' + urlencode({'cursor': cursor}) if cursor else ''
        value = await api(page, '/api/admin/audit' + query)
        rows.extend(row for row in value['audit'] if row['action'] == 'adjust-wallet' and row['actor_id'] == actor_id and row['target_id'] == target_id)
        cursor = value.get('nextCursor')
        if not cursor:
            return rows
        assert cursor not in seen and len(seen) < 200, 'Audit pagination failed to progress'
        seen.add(cursor)


async def search_and_manage(page, username, resident_id):
    await page.locator('[data-admin-view="residents"]').click()
    await expect(page.locator('.admin-toolbar [name="query"]')).to_be_visible()
    await page.locator('.admin-toolbar [name="query"]').fill(username)
    async with page.expect_response(lambda response: urlsplit(response.url).path == '/api/admin/residents'
                                    and response.request.method == 'GET' and 'query=' + username in response.url):
        await page.locator('.admin-toolbar [type="submit"]').click()
    await expect(page.locator(f'[data-resident="{resident_id}"]')).to_be_visible()
    await expect(page.locator('.admin-table tbody tr')).to_have_count(1)
    await page.locator(f'[data-resident="{resident_id}"]').click()
    await expect(page.locator('[data-operation="wallet"]')).to_be_visible()


async def run_browser(report, certificate_spki):
    async with async_playwright() as playwright:
        replacement = f'127.0.0.1:{TLS_PORT}'
        browser = await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server',
                  f'--ignore-certificate-errors-spki-list={certificate_spki}',
                  f'--host-resolver-rules=MAP abujacity.life {replacement}, MAP api.abujacity.life {replacement}'])
        contexts = [await browser.new_context(viewport={'width': 1280, 'height': 1000}) for _ in range(2)]
        pages = [await context.new_page() for context in contexts]
        admin_page, resident_page = pages
        errors, network, topup_posts = [], [], []
        for index, page in enumerate(pages):
            page.on('pageerror', lambda error, label=index: errors.append({'account': label, 'error': str(error)}))
            page.on('response', lambda response, label=index: network.append({'account': label, 'path': urlsplit(response.url).path, 'origin': urlsplit(response.url).netloc, 'status': response.status}))
            page.on('request', lambda request, label=index: topup_posts.append({'account': label, 'body': request.post_data_json})
                    if urlsplit(request.url).path == '/api/admin/wallet/adjust' and request.method == 'POST' else None)
        try:
            admin_username, target_username = 'qa_admin_' + uuid.uuid4().hex[:10], 'qa_topup_' + uuid.uuid4().hex[:10]
            administrator = await register(admin_page, admin_username, 'Browser Administrator')
            target = await register(resident_page, target_username, 'Browser Top-up Recipient')
            before, amount, reason = target['wallet'], 12345, 'Browser acceptance player top-up ' + RUN_ID
            for context, page in zip(contexts, pages):
                cookie = next(cookie for cookie in await context.cookies() if cookie['name'] == 'abujalife_session')
                assert cookie['domain'] == 'api.abujacity.life' and cookie['httpOnly'] and cookie['secure'] and cookie['sameSite'] == 'Lax'
                assert 'abujalife_session' not in await page.evaluate('document.cookie')
            report['accounts'] = {'administrator': {'id': administrator['id'], 'username': admin_username}, 'target': {'id': target['id'], 'username': target_username}}
            report['checks'].append({'check': 'Two actual Mongo-backed accounts have separate API Secure HttpOnly cookies', 'status': 'passed'})

            await resident_page.reload(wait_until='domcontentloaded')
            await expect(resident_page.locator('.access-card h1')).to_have_text('Administrator access.')
            await expect(resident_page.locator('[data-operation="wallet"], [data-admin-view]')).to_have_count(0)
            assert (await api(resident_page, '/api/admin/status'))['role'] is None
            unauthorized_body = {'residentId': target['id'], 'amount': amount, 'reason': reason, 'idempotencyKey': str(uuid.uuid4())}
            for path, body in [('/api/admin/residents', None), ('/api/admin/wallet/adjust', unauthorized_body), ('/api/admin/audit', None)]:
                denied = await result(resident_page, path, body)
                assert denied['status'] == 403 and denied['body']['code'] == 'admin_forbidden', 'An ordinary resident received administrative access'
            assert (await api(resident_page, '/api/wallet'))['profile']['wallet'] == before
            await resident_page.screenshot(path=str(ARTIFACTS / 'ordinary-resident-denied.png'), full_page=True)
            report['checks'].append({'check': 'Ordinary resident has no finance UI and receives 403 for resident, credit and audit APIs', 'status': 'passed'})

            report['bootstrap'] = await asyncio.to_thread(bootstrap, admin_username)
            access = await api(admin_page, '/api/admin/status')
            assert access['role'] == 'superadmin' and 'finance' in access['permissions']
            await admin_page.reload(wait_until='domcontentloaded')
            await expect(admin_page.locator('.admin-role')).to_have_text('superadmin')
            await search_and_manage(admin_page, target_username, target['id'])
            report['checks'].append({'check': 'Private server-console grant binds the existing resident and real Residents search opens the intended account', 'status': 'passed'})

            form = admin_page.locator('[data-operation="wallet"]')
            await form.locator('[name="amount"]').fill('0')
            await form.locator('[name="reason"]').fill(reason)
            assert not await form.evaluate('(form)=>form.checkValidity()'), 'Zero credit was accepted by the positive amount UI'
            await form.locator('[type="submit"]').click()
            await expect(form.locator('[data-topup-review]')).to_be_hidden()
            await form.locator('[name="amount"]').fill(str(amount))
            await form.locator('[name="reason"]').fill('')
            assert not await form.evaluate('(form)=>form.checkValidity()'), 'A top-up without an accountable reason was accepted'
            await form.locator('[name="reason"]').fill(reason)
            await form.locator('[type="submit"]').click()
            review = form.locator('[data-topup-review]')
            await expect(review).to_be_visible()
            await expect(review).to_contain_text('@' + target_username)
            await expect(review).to_contain_text('₦' + format(amount, ','))
            await expect(review).to_contain_text('Current balance ₦' + format(before, ','))
            assert not any(row['account'] == 0 for row in topup_posts), 'Review performed an unconfirmed credit'
            assert (await api(resident_page, '/api/wallet'))['profile']['wallet'] == before
            await form.locator('[name="amount"]').fill(str(amount + 1))
            await expect(review).to_be_hidden()
            await expect(form.locator('[type="submit"]')).to_have_text('Review top-up')
            await form.locator('[name="amount"]').fill(str(amount))
            await form.locator('[type="submit"]').click()
            await expect(review).to_contain_text('@' + target_username)
            await admin_page.screenshot(path=str(ARTIFACTS / 'topup-review.png'), full_page=True)
            report['checks'].append({'check': 'Positive amount and reason are required; review shows target, amount and current balance, edits require a new review, and review adds no funds', 'status': 'passed'})

            async with admin_page.expect_response(lambda response: response.url == API + '/api/admin/wallet/adjust' and response.request.method == 'POST') as observed:
                await form.locator('[type="submit"]').click()
            response = await observed.value
            assert response.status == 200, 'Confirmed administrative top-up failed'
            committed = await response.json()
            request = response.request.post_data_json
            assert request['residentId'] == target['id'] and request['amount'] == amount and request['reason'] == reason
            assert re.fullmatch(r'[A-Za-z0-9_-]{8,100}', request['idempotencyKey'])
            assert committed['profile']['wallet'] == before + amount and committed['replayed'] is False
            await expect(admin_page.locator('.admin-resident-summary').first).to_contain_text('₦' + format(before + amount, ','))
            target_detail = await api(admin_page, '/api/admin/residents/' + target['id'])
            ledger = [row for row in target_detail['transactions'] if row['reason'] == 'Administrator adjustment · ' + reason]
            assert len(ledger) == 1 and ledger[0]['amount'] == amount
            audit = await audit_for(admin_page, administrator['id'], target['id'])
            assert len(audit) == 1 and audit[0]['details'] == {'amount': amount, 'reason': reason, 'before': before, 'after': before + amount}
            report['topup'] = {'amount': amount, 'before': before, 'after': before + amount, 'ledger_id': ledger[0]['id'], 'audit_id': audit[0]['id']}
            report['checks'].append({'check': 'Confirm credits the chosen resident once and records one matching ledger entry and actor/target/reason audit', 'status': 'passed'})

            for _ in range(2):
                replay = await api(admin_page, '/api/admin/wallet/adjust', request)
                assert replay['replayed'] is True and replay['profile']['wallet'] == before + amount
            conflict = await result(admin_page, '/api/admin/wallet/adjust', {**request, 'amount': amount + 1})
            assert conflict['status'] == 409 and conflict['body']['code'] == 'idempotency_conflict'
            target_detail = await api(admin_page, '/api/admin/residents/' + target['id'])
            assert len([row for row in target_detail['transactions'] if row['reason'] == 'Administrator adjustment · ' + reason]) == 1
            assert len(await audit_for(admin_page, administrator['id'], target['id'])) == 1
            assert (await api(resident_page, '/api/wallet'))['profile']['wallet'] == before + amount
            denied = await result(resident_page, '/api/admin/wallet/adjust', request)
            assert denied['status'] == 403 and denied['body']['code'] == 'admin_forbidden'
            report['checks'].append({'check': 'Captured UI request retries add no extra credit, ledger or audit; changed-body key conflicts and the other resident still receives 403', 'status': 'passed'})

            await admin_page.reload(wait_until='domcontentloaded')
            await expect(admin_page.locator('.admin-role')).to_have_text('superadmin')
            await search_and_manage(admin_page, target_username, target['id'])
            await expect(admin_page.locator('.admin-resident-summary').first).to_contain_text('₦' + format(before + amount, ','))
            await resident_page.reload(wait_until='domcontentloaded')
            await expect(resident_page.locator('.access-card h1')).to_have_text('Administrator access.')
            assert (await api(resident_page, '/api/wallet'))['profile']['wallet'] == before + amount
            assert len(await audit_for(admin_page, administrator['id'], target['id'])) == 1
            await admin_page.screenshot(path=str(ARTIFACTS / 'topup-persisted.png'), full_page=True)
            assert not errors, errors
            assert not any(row['origin'] == 'abujacity.life' and row['path'].startswith('/api/') for row in network), 'Admin requested an API path from the static host'
            assert not any(row['origin'] == 'api.abujacity.life' and row['status'] >= 500 for row in network), 'The real API returned a server error'
            report['checks'].append({'check': 'Top-up and access persist after refresh; bundled admin has no JavaScript errors, frontend API requests or API 5xx responses', 'status': 'passed'})
        except Exception:
            for index, page in enumerate(pages):
                try:
                    await page.screenshot(path=str(ARTIFACTS / f'failure-account-{index + 1}.png'), full_page=True, timeout=5000)
                    (ARTIFACTS / f'failure-account-{index + 1}.html').write_text(await page.content())
                except Exception:
                    pass
            raise
        finally:
            report['page_errors'], report['network'] = errors, network
            await browser.close()


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    report = {'run_id': RUN_ID, 'checks': helpers.Checks(), 'scope': 'Actual production dist admin UI and real disposable Mongo API over local HTTPS at the public domain names.',
              'limitations': ['Public DNS, live Hostinger files and public CA certificates are not verified.', 'Chromium accepts only this generated local test certificate; installation/provider TLS verification is unchanged.', 'Refresh persistence is tested; this script does not restart the shared API fixture.']}
    server = None
    try:
        assert (DIST / 'admin/index.html').is_file(), 'Run npm run build first'
        assert CONFIG.is_file(), 'Set ABUJALIFE_QA_MONGO_CONFIG to the running disposable Mongo fixture configuration'
        report['build_hashes'] = {name: hashlib.sha256((REPO / name).read_bytes()).hexdigest() for name in ['app/admin.js', 'dist/admin.js', 'dist/admin/index.html', 'dist/runtime-config.js']}
        with urllib.request.urlopen(f'http://127.0.0.1:{API_PORT}/health', timeout=10) as response:
            health = json.load(response)
        assert health.get('ok') is True and health.get('storage') == 'mongodb', 'The running fixture is not a healthy real Mongo API'
        with tempfile.TemporaryDirectory(prefix='abujalife-admin-browser-tls-') as directory:
            certificate, private_key = Path(directory) / 'certificate.pem', Path(directory) / 'private-key.pem'
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=abujacity.life',
                            '-addext', 'subjectAltName=DNS:abujacity.life,DNS:api.abujacity.life', '-keyout', str(private_key), '-out', str(certificate)],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            public_key = subprocess.run(['openssl', 'x509', '-in', str(certificate), '-pubkey', '-noout'], check=True, capture_output=True).stdout
            public_der = subprocess.run(['openssl', 'pkey', '-pubin', '-outform', 'DER'], input=public_key, check=True, capture_output=True).stdout
            certificate_spki = base64.b64encode(hashlib.sha256(public_der).digest()).decode()
            server = http.server.ThreadingHTTPServer(('127.0.0.1', TLS_PORT), helpers.Proxy)
            server.daemon_threads = True
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(str(certificate), str(private_key))
            server.socket = context.wrap_socket(server.socket, server_side=True)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            asyncio.run(run_browser(report, certificate_spki))
        report['status'] = 'passed'
    except Exception as error:
        report['status'], report['error'], report['traceback'] = 'failed', str(error), traceback.format_exc()
    finally:
        if server:
            server.shutdown()
            server.server_close()
        (ARTIFACTS / 'report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'status': report['status'], 'checks': report['checks'], 'artifacts': str(ARTIFACTS), **({'error': report['error']} if 'error' in report else {})}, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())

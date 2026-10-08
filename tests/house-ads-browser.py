#!/usr/bin/env python3
"""Exercise the real ads HTTP loader, V4 renderer and pointer interaction.

The HTTP fixture serves the authored Okrika campaign definitions and inventory
through the existing public endpoint contracts. It never assigns __ABJ_ADS__,
creates payment orders, mutates a wallet, or writes production campaigns.
The deliberately named paid creative fixture checks presentation precedence;
Mongo integration tests separately exercise real reservations and billing.
"""
import asyncio
import base64
import copy
import json
import os
import socket
import struct
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

from playwright.async_api import async_playwright, expect

REPO = Path(__file__).resolve().parents[1]
ART = Path(os.getenv('ABUJALIFE_HOUSE_AD_ARTIFACTS', '/tmp/abuja-house-ad-qa'))
HTML = '''<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/ads.css">
<link rel="stylesheet" href="/outside-city.css"><link rel="stylesheet" href="/outside-quick-access.css">
<link rel="stylesheet" href="/game-map.css"><link rel="stylesheet" href="/abuja-game-polish-2026.css">
<link rel="stylesheet" href="/game-hud.css"><style>
body{margin:0}.abj-restored-map{height:100dvh;grid-template-rows:minmax(0,1fr) auto}
.abj-restored-map-stage{min-height:0}#map{height:100%;min-height:0}
.outside-city{height:100%;min-height:100%}</style></head><body>
<main id="app"><div class="abj-restored-map"><div class="abj-restored-map-stage"><div id="map"></div></div>
<button class="abj-restored-map-close" aria-label="Close map">×</button>
<nav class="abj-map-bottom-nav"><button>Play</button><button>Map</button><button>My life</button><button>Phone</button></nav>
</div></main><div id="sheet-root"></div><div id="toast" role="status"></div>
<script type="module">
import '/outside-quick-access.js';
import {renderOutside} from '/outside-city-v4.js';
import {ABUJA_ATLAS} from '/src/shared/atlas.mjs';
import {VENUES} from '/src/shared/life.mjs';
await import('/ads.js');
window.qa=renderOutside(document.querySelector('#map'),{
 atlas:ABUJA_ATLAS,venues:VENUES,profile:{district:'central-area'},
 onSelect:destination=>{if(destination.advertise)dispatchEvent(new CustomEvent('abj:open-ad-studio',{
  detail:{kind:destination.kind,plotId:destination.adPlotId,zoneId:destination.adZoneId}
 }));}
});
</script></body></html>'''


def authored_data():
    script = '''import {OKRIKA_HOUSE_CAMPAIGNS} from './src/shared/okrika-house-ads.mjs';
import {MAP_AD_INVENTORY,COMPATIBILITY_MAP_AD_INVENTORY,ALL_SPACES,adPlacementMetadata} from './src/shared/advertising.mjs';
import {AD_PRICING} from './src/server/mongo/adStore.mjs';
console.log(JSON.stringify({campaigns:OKRIKA_HOUSE_CAMPAIGNS,spaces:[...MAP_AD_INVENTORY,...COMPATIBILITY_MAP_AD_INVENTORY],legacySpaces:ALL_SPACES.map(adPlacementMetadata),pricing:AD_PRICING}));'''
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script], cwd=REPO, text=True))


class PublicAdFixture:
    def __init__(self, data):
        self.data = data
        self.active = copy.deepcopy(data['campaigns'])
        self.requests = []
        self.revision = 0

    def snapshot(self, url):
        now = int(time.time() * 1000)
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        active = copy.deepcopy(self.active)
        inventory = self.data['legacySpaces'] if '/api/payments/config' in url else self.data['spaces']
        if all(k in query for k in ('x', 'y', 'width', 'height')):
            x, y, w, h = (float(query[k][0]) for k in ('x', 'y', 'width', 'height'))
            spaces = {p['id']: p for p in self.data['spaces']}
            active = [ad for ad in active if any(
                (p := spaces.get(slot)) and p['x'] < x + w and p['x'] + p['width'] > x
                and p['y'] < y + h and p['y'] + p['height'] > y for slot in ad['slots'])]
            inventory = [p for p in inventory if p['x'] < x + w and p['x'] + p['width'] > x
                         and p['y'] < y + h and p['y'] + p['height'] > y]
        if '/api/ads/world' in url:
            limit = min(180, max(12, int(query.get('limit', ['96'])[0])))
            page = max(0, int(query.get('page', ['0'])[0]))
            inventory = inventory[page * limit:(page + 1) * limit]
        by_slot = {slot: ad for ad in sorted(active, key=lambda ad: ad.get('campaignType') != 'house') for slot in ad['slots']}
        spaces = []
        for original in inventory:
            space = copy.deepcopy(original)
            ad = by_slot.get(space['id'])
            if ad:
                space['ad'] = ad
                space['houseAd'] = ad.get('campaignType') == 'house'
                space['available'] = space['houseAd']
            spaces.append(space)
        paid_slots = {slot for ad in self.active if ad.get('campaignType') != 'house' for slot in ad['slots']}
        house_placements = [{'campaignId': ad['campaignId'], 'slotId': slot}
                            for ad in self.active if ad.get('campaignType') == 'house'
                            for slot in ad['slots'] if slot not in paid_slots]
        return {'ok': True, 'enabled': True, 'serverTime': now, 'pricing': self.data['pricing'],
                'active': active, 'spaces': spaces, 'houseCampaigns': sum(ad.get('campaignType') == 'house' for ad in self.active),
                'housePlacements': house_placements,
                'inventory': {'total': len(self.data['spaces'])}, 'nextPage': None,
                'houseRevision': self.revision, 'fixtureRevision': self.revision}

    async def route(self, route):
        request = route.request
        self.requests.append({'url': request.url, 'method': request.method, 'revision': self.revision})
        path = urllib.parse.urlparse(request.url).path
        if request.method != 'GET' or path not in ('/api/payments/config', '/api/ads/world'):
            # Catch every API call: an accidental POST cannot fall through to
            # the local backend, and the final method assertion will fail.
            await route.fulfill(status=400, content_type='application/json', body=json.dumps({'ok': False, 'error': 'Unexpected request in readonly house-ad browser fixture'}))
            return
        body = self.snapshot(request.url)
        if '/api/payments/config' in request.url:
            # Billing deliberately disabled: the advertising studio may open,
            # but this regression cannot accidentally initiate checkout.
            body = {'ok': True, 'enabled': False, 'ads': body}
        await route.fulfill(status=200, content_type='application/json', body=json.dumps(body))

    def replace(self, campaigns):
        self.active = copy.deepcopy(campaigns)
        self.revision += 1


async def focus_reload(page, fixture):
    revision = fixture.revision
    await page.evaluate("dispatchEvent(new Event('focus'))")
    await page.wait_for_function("revision => globalThis.__ABJ_ADS__?.fixtureRevision === revision", arg=revision)
    await page.wait_for_timeout(400)


async def select_plot(page, slot):
    selection = page.locator('.outside-selection')
    if await selection.is_visible():
        await selection.locator('[data-outside-action="close"]').evaluate('element => element.click()')
        await expect(selection).to_be_hidden()
    search = page.get_by_role('searchbox')
    await expect(search).to_be_visible()
    await search.fill(slot)
    await page.locator('[data-outside-destination]').first.evaluate('element => element.click()')
    await expect(page.locator('.outside-selection')).to_be_visible()


async def check_house(page, campaign):
    await select_plot(page, campaign['slots'][0])
    selection = page.locator('.outside-selection')
    await expect(selection.locator('h3')).to_have_text(campaign['title'])
    await expect(selection.locator('.outside-sponsored-link')).to_have_attribute('href', campaign['link'])
    await expect(selection).to_contain_text('Advertising Land', ignore_case=True)
    await expect(selection).to_contain_text('Sponsored · Okrika')
    await expect(selection).to_contain_text('okrika.store')
    await expect(selection).to_contain_text('hello@okrika.store')
    await expect(selection.locator('.outside-sponsored-link')).to_contain_text(campaign['cta'])
    await expect(selection.get_by_role('button', name='Advertise in Abuja')).to_be_visible()


def paid_creative_fixture():
    """A small valid PNG fixture, using the same allowed MIME as paid uploads."""
    width, height = 900, 450
    background, foreground = bytes.fromhex('d69725'), bytes.fromhex('063e34')
    plain = background * width
    stripe = background * 60 + foreground * 780 + background * 60
    pixels = b''.join(b'\x00' + (stripe if 120 <= y < 165 or 220 <= y < 265 else plain) for y in range(height))
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b'')
    return 'data:image/png;base64,' + base64.b64encode(png).decode()


async def exercise(page, fixture, engine, label, width, base):
    await page.route('**/qa-house-ads', lambda route: route.fulfill(status=200, content_type='text/html', body=HTML))
    await page.route('**/api/**', fixture.route)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    await page.goto(base + '/qa-house-ads', wait_until='domcontentloaded')
    await page.wait_for_function('()=>window.qa && globalThis.__ABJ_ADS__?.active?.length === 20')
    await expect(page.locator('#map')).to_have_attribute('data-outside-renderer', 'webgl-3d-v4')
    snapshot = await page.evaluate('globalThis.__ABJ_ADS__.active')
    assert len({ad['campaignId'] for ad in snapshot}) == 20
    assert all(ad['billing'] is False and ad['permanent'] is True and ad.get('endAt') is None for ad in snapshot)
    assert not any('txRef' in ad or 'amount' in ad for ad in snapshot)
    # At desktop resolution the software-rendered 3D scene can starve Playwright
    # pointer dispatch. Trigger the real DOM click handlers for HUD controls;
    # ad taps and drag-versus-pan below still use genuine pointer input.
    await page.get_by_role('button', name='Show advertising plots').evaluate('element => element.click()')
    await page.wait_for_timeout(600)
    await page.screenshot(path=str(ART / f'{engine}-{label}-inventory.png'), animations='disabled')

    campaigns = fixture.data['campaigns']
    # The first engine/mobile pass visits every authored campaign through the
    # real directory and resolves its actual map placement.
    to_visit = campaigns if engine == 'chromium' and label == 'iphone' else [campaigns[i] for i in (0, 1, 18)]
    if os.getenv('ABUJALIFE_HOUSE_AD_VISIT_LIMIT'):
        to_visit = to_visit[:int(os.environ['ABUJALIFE_HOUSE_AD_VISIT_LIMIT'])]
    for index, campaign in enumerate(to_visit):
        await check_house(page, campaign)
        if index == 0:
            bounds = await page.locator('.outside-selection').bounding_box()
            nav = await page.locator('.abj-map-bottom-nav').bounding_box()
            assert bounds['y'] + bounds['height'] <= nav['y'] + 1, (bounds, nav)
            await page.screenshot(path=str(ART / f'{engine}-{label}-selected-card.png'), animations='disabled')
        await page.locator('[data-outside-action="close"]').evaluate('element => element.click()')
        await page.wait_for_timeout(650)
        await page.wait_for_function('()=>qa.getAdDiagnostics().cachedTextures > 0 && qa.getAdDiagnostics().visibleDisplays > 0')
        diagnostics = await page.evaluate('qa.getAdDiagnostics()')
        assert diagnostics['cachedTextures'] <= 24 and diagnostics['visibleDisplays'] <= 60, diagnostics
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        if index in (0, 1, len(to_visit) - 1):
            await page.screenshot(path=str(ART / f'{engine}-{label}-{campaign["id"]}.png'), animations='disabled')
        print(json.dumps({'engine': engine, 'viewport': label, 'visited': campaign['id']}), flush=True)

    first = campaigns[0]
    await check_house(page, first)
    await page.wait_for_timeout(1000)
    before_zoom = await page.evaluate('({camera:qa.getCameraState(),revision:qa.getAdDiagnostics().revision})')
    await page.locator('[data-outside-action="out"]').evaluate('element => element.click()')
    await page.locator('[data-outside-action="out"]').evaluate('element => element.click()')
    await page.wait_for_function('revision => qa.getAdDiagnostics().revision > revision', arg=before_zoom['revision'])
    await page.wait_for_timeout(1000)
    after_zoom = await page.evaluate('qa.getCameraState()')
    assert after_zoom['zoom'] < before_zoom['camera']['zoom'] * .9, (before_zoom, after_zoom)
    # Viewport HTTP updates must preserve a user's selected-card pan/zoom rather
    # than repeatedly focusing the selected parcel again.
    rect = await page.locator('.outside-stage').bounding_box()
    cx, cy = rect['x'] + rect['width'] / 2, rect['y'] + rect['height'] / 2
    before_pan = await page.evaluate('({camera:qa.getCameraState(),revision:qa.getAdDiagnostics().revision})')
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 70, cy + 18, steps=10)
    await page.mouse.up()
    await page.wait_for_function('revision => qa.getAdDiagnostics().revision > revision', arg=before_pan['revision'])
    await page.wait_for_timeout(1000)
    after_pan = await page.evaluate('qa.getCameraState()')
    assert abs(after_pan['x'] - before_pan['camera']['x']) + abs(after_pan['y'] - before_pan['camera']['y']) > 10, (before_pan, after_pan)
    assert after_pan['zoom'] < before_zoom['camera']['zoom'] * .9, (before_zoom, after_pan)
    await expect(page.locator('.outside-selection')).to_be_visible()
    # The secondary CTA uses the existing advertising flow and keeps real Naira
    # separate. It must not silently turn a house click into a paid checkout.
    await page.get_by_role('button', name='Advertise in Abuja').click(force=True)
    await expect(page.get_by_role('dialog', name='Put your business in the city.')).to_be_visible(timeout=25000)
    await expect(page.locator('.abj-ad-studio')).to_contain_text('Your game Naira balance stays separate.')
    await expect(page.locator('.abj-ad-submit')).to_be_disabled()
    close_is_on_top = await page.locator('[data-ad-close]').evaluate('button => { const r=button.getBoundingClientRect(); return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest(".sheet-backdrop") !== null; }')
    assert close_is_on_top, 'Advertising sheet is covered by the full-screen map layer'
    await page.get_by_role('button', name='Close advertising').evaluate('element => element.click()')
    await page.locator('[data-outside-action="close"]').evaluate('element => element.click()')
    await page.wait_for_timeout(800)
    rect = await page.locator('.outside-stage').bounding_box()
    cx, cy = rect['x'] + rect['width'] / 2, rect['y'] + rect['height'] / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 60, cy + 12, steps=10)
    await page.mouse.up()
    await expect(page.locator('.outside-selection')).to_be_hidden()
    await check_house(page, first)
    await page.locator('[data-outside-action="close"]').evaluate('element => element.click()')
    await page.wait_for_timeout(800)
    await page.mouse.click(cx, cy)
    await expect(page.locator('.outside-sponsored-link')).to_have_attribute('href', first['link'])

    # A full public refresh removes disabled campaigns instead of preserving
    # stale cached house adverts. The selection should also disappear.
    fixture.replace(campaigns[1:])
    await focus_reload(page, fixture)
    assert len(await page.evaluate('globalThis.__ABJ_ADS__.active')) == 19
    await expect(page.locator('.outside-selection')).to_be_hidden()
    await select_plot(page, first['slots'][0])
    await expect(page.locator('.outside-sponsored-link')).to_have_count(0)
    await page.locator('[data-outside-action="close"]').evaluate('element => element.click()')

    occupied = {slot for ad in campaigns for slot in ad['slots']}
    new_slot = next(p['id'] for p in fixture.data['spaces'] if p['id'] not in occupied)
    moved = copy.deepcopy(first)
    moved['slots'], moved['slotId'] = [new_slot], new_slot
    moved['title'], moved['headline'] = 'Okrika moved fixture', 'A FRESH CORNER OF ABUJA'
    fixture.replace([moved, *campaigns[1:]])
    await focus_reload(page, fixture)
    assert len(await page.evaluate('globalThis.__ABJ_ADS__.active')) == 20
    await select_plot(page, first['slots'][0])
    await expect(page.locator('.outside-sponsored-link')).to_have_count(0)
    await page.locator('[data-outside-action="close"]').evaluate('element => element.click()')
    await check_house(page, moved)
    await page.locator('[data-outside-action="close"]').evaluate('element => element.click()')

    # Paid presentation takes priority in either response order. Both are HTTP
    # fixtures; no provider/payment/account data is synthesized into production.
    paid = {'txRef': 'abjl_ad_browser_fixture', 'kind': 'plot', 'slots': [new_slot],
            'title': 'Paid creative fixture', 'link': 'https://example.com/paid-creative-fixture',
            'imageDataUrl': paid_creative_fixture(),
            'startAt': int(time.time() * 1000) - 1000, 'endAt': int(time.time() * 1000) + 3600000}
    for campaigns_order in ([moved, paid, *campaigns[1:]], [paid, moved, *campaigns[1:]]):
        fixture.replace(campaigns_order)
        await focus_reload(page, fixture)
        await select_plot(page, new_slot)
        await expect(page.locator('.outside-selection h3')).to_have_text(paid['title'])
        await expect(page.locator('.outside-sponsored-link')).to_have_attribute('href', paid['link'])
        await page.locator('[data-outside-action="close"]').evaluate('element => element.click()')
    assert not errors, errors
    assert all(request['method'] == 'GET' for request in fixture.requests)
    assert all(urllib.parse.urlparse(request['url']).path in ('/api/payments/config', '/api/ads/world') for request in fixture.requests)
    return {'engine': engine, 'viewport': label, 'width': width, 'authoredCampaigns': 20,
            'campaignsVisited': len(to_visit), 'realClientHttpLoader': True,
            'disableAndMoveRefresh': True, 'paidPrecedenceBothOrders': True,
            'selectedCardViewportRefreshPreservesPanZoom': True,
            'tapVersusPan': True, 'advertisingStudio': True, 'errors': errors,
            'httpRequests': len(fixture.requests), 'diagnostics': await page.evaluate('qa.getAdDiagnostics()')}


async def main():
    ART.mkdir(parents=True, exist_ok=True)
    data, report = authored_data(), []
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1', 0))
        port = reservation.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    with tempfile.TemporaryDirectory(prefix='abuja-house-ad-qa-') as temporary, (ART / 'server.log').open('w') as log:
        server = subprocess.Popen(['node', 'scripts/dev.mjs'], cwd=REPO,
                                  env={**os.environ, 'PORT': str(port), 'ABUJALIFE_DATA_DIR': temporary},
                                  stdout=log, stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                try:
                    with urllib.request.urlopen(base + '/api/health', timeout=1):
                        break
                except Exception:
                    await asyncio.sleep(.1)
            async with async_playwright() as pw:
                for engine in os.getenv('ABUJALIFE_HOUSE_AD_ENGINES', 'chromium,webkit').split(','):
                    browser = await getattr(pw, engine).launch(headless=True)
                    try:
                        viewports = [('iphone', 390, 844), ('desktop', 1440, 900)]
                        if os.getenv('ABUJALIFE_HOUSE_AD_IPHONE_ONLY') == '1':
                            viewports = viewports[:1]
                        selected_viewports = os.getenv('ABUJALIFE_HOUSE_AD_VIEWPORTS')
                        if selected_viewports:
                            requested = set(selected_viewports.split(','))
                            viewports = [viewport for viewport in viewports if viewport[0] in requested]
                        for label, width, height in viewports:
                            context = await browser.new_context(viewport={'width': width, 'height': height},
                                                                device_scale_factor=1 if width < 800 else 0.7,
                                                                has_touch=width < 800)
                            page = await context.new_page()
                            fixture = PublicAdFixture(data)
                            try:
                                result = await exercise(page, fixture, engine, label, width, base)
                            except Exception as error:
                                details = {'engine': engine, 'viewport': label, 'failure': str(error), 'requests': fixture.requests,
                                           'ads': await page.evaluate('globalThis.__ABJ_ADS__'),
                                           'sheet': await page.locator('#sheet-root').inner_html(),
                                           'layers': await page.evaluate('''() => { const read = el => { if (!el) return null; const s=getComputedStyle(el),r=el.getBoundingClientRect(); return {tag:el.tagName,id:el.id,className:typeof el.className==='string'?el.className:'',style:el.getAttribute('style'),position:s.position,zIndex:s.zIndex,transform:s.transform,rect:{x:r.x,y:r.y,width:r.width,height:r.height}} }; const root=document.querySelector('#sheet-root'),close=document.querySelector('[data-ad-close]'),r=close?.getBoundingClientRect(); let parents=[],p=root; while(p&&parents.length<8){parents.push(read(p));p=p.parentElement}; return {root:read(root),parents,map:read(document.querySelector('.abj-restored-map')),backdrop:read(document.querySelector('.sheet-backdrop')),top:r?read(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)):null,styles:[...document.styleSheets].map(s=>({href:s.href,rules:[...(s.cssRules||[])].filter(x=>x.selectorText?.includes('sheet-root')).map(x=>x.cssText)}))}; }''')}
                                (ART / f'{engine}-{label}-failure.json').write_text(json.dumps(details, indent=2))
                                await page.screenshot(path=str(ART / f'{engine}-{label}-failure.png'), animations='disabled')
                                raise
                            report.append(result)
                            print(json.dumps(result), flush=True)
                            await context.close()
                    finally:
                        await browser.close()
        finally:
            server.terminate()
            server.wait(timeout=10)
            (ART / 'report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    asyncio.run(main())

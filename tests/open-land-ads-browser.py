#!/usr/bin/env python3
"""Real-browser release gate for direct map advertising.

Exercises the production map renderer plus direct safe-land picker and real
advertising studio. Provider checkout is never called: HTTP responses are local
readonly fixtures. Backend payment/admin mutation behavior is covered by Node/Mongo tests.
"""
import asyncio
import json
import math
import os
import socket
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright, expect

REPO = Path(__file__).resolve().parents[1]
ART = Path(os.getenv('ABUJALIFE_OPEN_LAND_AD_ARTIFACTS', '/tmp/abuja-open-land-ad-qa'))
HTML = '''<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/ads.css">
<link rel="stylesheet" href="/outside-city.css"><link rel="stylesheet" href="/map-premium-2026.css"><link rel="stylesheet" href="/outside-quick-access.css">
<link rel="stylesheet" href="/game-map.css"><link rel="stylesheet" href="/abuja-game-polish-2026.css">
<link rel="stylesheet" href="/game-hud.css"><style>
body{margin:0}.abj-restored-map{height:100dvh;grid-template-rows:minmax(0,1fr) auto}
.abj-restored-map-stage{min-height:0}#map{height:100%;min-height:0}.outside-city{height:100%;min-height:100%}
</style></head><body><main id="app"><div class="abj-restored-map"><div class="abj-restored-map-stage"><div id="map"></div></div>
<button class="abj-restored-map-close" aria-label="Close map">×</button>
<nav class="abj-map-bottom-nav"><button>Play</button><button>Map</button><button>My life</button><button>Phone</button></nav></div></main>
<div id="sheet-root"></div><div id="toast" role="status"></div>
<script type="module">
import '/outside-quick-access.js';
import {renderOutside} from '/outside-city-v4.js';
import {ABUJA_ATLAS} from '/src/shared/atlas.mjs';
import {VENUES} from '/src/shared/life.mjs';
import {adSpaceFromId} from '/src/shared/advertising.mjs';
window.lastPlacement=null;addEventListener('abj:open-ad-studio',event=>{window.lastPlacement=event.detail;});
window.spaceFor=id=>adSpaceFromId(id);
globalThis.__ABJ_ADS__={active:[]};
window.qa=renderOutside(document.querySelector('#map'),{atlas:ABUJA_ATLAS,venues:VENUES,profile:{district:'central-area'}});
globalThis.__ABJ_MAP__=window.qa;
await import('/ads.js');
await import('/admin-ad-bypass.js');
await import('/open-land-ads.js');
window.qaReady=true;
</script></body></html>'''


def authored_inventory():
    # The real authored and compatibility city plots, in the order the server pages them.
    script = "import {MAP_AD_INVENTORY,COMPATIBILITY_MAP_AD_INVENTORY} from './src/shared/advertising.mjs';console.log(JSON.stringify([...MAP_AD_INVENTORY,...COMPATIBILITY_MAP_AD_INVENTORY]));"
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',script], cwd=REPO, text=True))


def zone_data():
    script = "import {AD_ZONES} from './src/shared/advertising.mjs';console.log(JSON.stringify(AD_ZONES));"
    return {row['id']: row for row in json.loads(subprocess.check_output(['node','--input-type=module','-e',script], cwd=REPO, text=True))}


AUTHORED = authored_inventory()


class Fixture:
    def __init__(self, zones, admin=False):
        self.zones = zones
        self.admin = admin
        self.requests = []

    def world(self, url):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        zone_id = query.get('zone', [None])[0]
        now = int(time.time() * 1000)
        if zone_id == 'map-parcels':
            # The Map opens framed on the city, where the first open land is an authored plot.
            limit = min(180, max(12, int(query.get('limit', ['96'])[0])))
            page = max(0, int(query.get('page', ['0'])[0]))
            rows = AUTHORED[page * limit:(page + 1) * limit]
            return {'ok': True, 'zones': list(self.zones.values()), 'spaces': [{**row, 'available': True, 'eligible': row.get('eligible', True) is not False} for row in rows], 'active': [],
                    'nextPage': page + 1 if (page + 1) * limit < len(AUTHORED) else None, 'serverTime': now}
        if not zone_id or zone_id == 'legacy' or zone_id not in self.zones:
            return {'ok': True, 'zones': list(self.zones.values()), 'spaces': [], 'active': [], 'nextPage': None, 'serverTime': now}
        zone = self.zones[zone_id]
        limit = min(180, max(12, int(query.get('limit', ['96'])[0])))
        page = max(0, int(query.get('page', ['0'])[0]))
        cols = max(1, math.floor(zone['width'] / 120))
        rows = max(1, math.floor(zone['height'] / 100))
        start, end = page * limit, min(rows * cols, (page + 1) * limit)
        spaces = []
        for index in range(start, end):
            row, column = divmod(index, cols)
            spaces.append({'id': f'ad:{zone_id}:{row}:{column}', 'kind': 'plot', 'zoneId': zone_id,
                           'zone': zone['name'], 'row': row, 'column': column,
                           'x': zone['x'] + column * 120 + 18, 'y': zone['y'] + row * 100 + 18,
                           'width': 96, 'height': 70, 'available': True, 'eligible': True, 'tier': 'standard'})
        return {'ok': True, 'zones': list(self.zones.values()), 'spaces': spaces, 'active': [],
                'nextPage': page + 1 if end < rows * cols else None, 'serverTime': now}

    async def route(self, route):
        request = route.request
        path = urllib.parse.urlparse(request.url).path
        self.requests.append({'method': request.method, 'path': path, 'url': request.url})
        if path == '/api/payments/config' and request.method == 'GET':
            now = int(time.time() * 1000)
            body = {'ok': True, 'enabled': True, 'ads': {'enabled': True, 'serverTime': now,
                    'pricing': {'currency':'NGN','amount':2000,'durationDays':7,'plotPackSize':1,'billboardCount':1},
                    'zones': list(self.zones.values()), 'spaces': [], 'active': []}}
        elif path == '/api/ads/world' and request.method == 'GET':
            body = self.world(request.url)
        elif path == '/api/admin/status' and request.method == 'GET':
            body = {'ok': True, 'role': 'superadmin' if self.admin else None,
                    'permissions': ['overview','residents','moderation','payments','finance','roles','settings','audit'] if self.admin else [],
                    'bootstrapConfigured': True}
        else:
            await route.fulfill(status=400, content_type='application/json', body=json.dumps({'ok':False,'error':'Unexpected mutation/API call in readonly open-land fixture'}))
            return
        await route.fulfill(status=200, content_type='application/json', body=json.dumps(body))


async def open_from_blank_land(page):
    # Revenue-critical behavior: a resident must not discover or enable an Ads
    # mode first. A normal tap on eligible map land must open the studio itself.
    ads_toggle = page.get_by_role('button', name='Show advertising plots')
    await expect(ads_toggle).to_have_attribute('aria-pressed', 'false')
    stage = await page.locator('.outside-stage').bounding_box()
    assert stage
    candidates = [(x, y) for y in (.28,.38,.48,.58,.68,.76) for x in (.16,.28,.40,.52,.64,.76,.86)]
    for xf, yf in candidates:
        if await page.get_by_role('dialog', name='Put your business in the city.').count():
            break
        await page.mouse.click(stage['x'] + stage['width'] * xf, stage['y'] + stage['height'] * yf)
        await page.wait_for_timeout(80)
    dialog = page.get_by_role('dialog', name='Put your business in the city.')
    await expect(dialog).to_be_visible(timeout=5000)
    await expect(ads_toggle).to_have_attribute('aria-pressed', 'false')
    await page.wait_for_function('()=>window.lastPlacement?.plotId && document.querySelectorAll("[data-ad-selected] [data-ad-remove]").length===1')
    result = await page.evaluate('''()=>({placement:window.lastPlacement,space:window.spaceFor(window.lastPlacement.plotId),selected:document.querySelector('[data-ad-selected] [data-ad-remove]')?.dataset.adRemove})''')
    assert result['placement']['plotId'] == result['selected'], result
    assert result['space']['eligible'] is True and result['space']['kind'] == 'plot', result
    return result


async def exercise(browser, base, zones, admin, viewport, label):
    context = await browser.new_context(viewport=viewport, has_touch=viewport['width'] < 800)
    page = await context.new_page();fixture = Fixture(zones, admin=admin);errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    await page.route('**/qa-open-land-ads', lambda route: route.fulfill(status=200, content_type='text/html', body=HTML))
    await page.route('**/api/**', fixture.route)
    await page.goto(base + '/qa-open-land-ads', wait_until='domcontentloaded')
    await page.wait_for_function('()=>window.qaReady===true')
    await expect(page.locator('#map')).to_have_attribute('data-outside-renderer','webgl-3d-v4')
    placement = await open_from_blank_land(page)
    studio = page.locator('.abj-ad-studio')
    if admin:
        await expect(studio).to_contain_text('ADMIN · PLATFORM CAMPAIGN')
        await expect(studio).to_contain_text('No charge')
        await expect(studio.locator('.abj-ad-submit')).to_have_text('Publish to AbujaLife · No charge')
        assert await studio.locator('input[name="email"]').evaluate('el=>el.required') is False
    else:
        await expect(studio).to_contain_text('7-DAY PLACEMENT')
        await expect(studio).to_contain_text('₦2,000')
        await expect(studio.locator('.abj-ad-submit')).to_contain_text('Continue to Flutterwave')
    await page.screenshot(path=str(ART / f'{label}-{"admin" if admin else "resident"}.png'), animations='disabled')
    assert not [r for r in fixture.requests if r['method'] != 'GET'], fixture.requests
    assert not errors, errors
    await context.close()
    return {'label':label,'admin':admin,'plotId':placement['placement']['plotId'],'safe':True,
            'studio':'no-charge' if admin else 'ngn-2000','requests':len(fixture.requests)}


async def main():
    ART.mkdir(parents=True, exist_ok=True);zones=zone_data();report=[]
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1',0));port=reservation.getsockname()[1]
    base=f'http://127.0.0.1:{port}'
    with tempfile.TemporaryDirectory(prefix='abuja-open-land-ad-qa-') as data,(ART/'server.log').open('w') as log:
        server=subprocess.Popen(['node','scripts/dev.mjs'],cwd=REPO,env={**os.environ,'PORT':str(port),'ABUJALIFE_DATA_DIR':data},stdout=log,stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                try:
                    with urllib.request.urlopen(base+'/api/health',timeout=1):break
                except Exception:await asyncio.sleep(.1)
            async with async_playwright() as pw:
                webkit=await pw.webkit.launch(headless=True)
                try:report.append(await exercise(webkit,base,zones,False,{'width':390,'height':844},'webkit-iphone'))
                finally:await webkit.close()
                chromium=await pw.chromium.launch(headless=True)
                try:report.append(await exercise(chromium,base,zones,True,{'width':1440,'height':900},'chromium-desktop'))
                finally:await chromium.close()
        finally:
            server.terminate();server.wait(timeout=10);(ART/'report.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report),flush=True)

if __name__=='__main__':asyncio.run(main())

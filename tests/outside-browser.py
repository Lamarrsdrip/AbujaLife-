#!/usr/bin/env python3
"""Outside acceptance with actual Chromium WebGL, UI, clock and money.

Run after npm run preview:build, against an existing real dev API:
  ABUJALIFE_OUTSIDE_URL=http://127.0.0.1:8787 python tests/outside-browser.py
The runner creates only disposable residents through signup. It never mocks an
endpoint, injects game state, grants money, changes clocks or replaces RAF.
All evidence is written outside the checkout under /tmp.
"""
import asyncio
import datetime
import functools
import hashlib
import json
import os
from pathlib import Path
import io
import statistics
import sys
import time
import traceback
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
import uuid

from playwright.async_api import async_playwright, expect
from PIL import Image, ImageStat

sys.dont_write_bytecode = True
expect.set_options(timeout=30000)
REPO = Path(__file__).resolve().parents[1]
URL = os.environ.get('ABUJALIFE_OUTSIDE_URL', 'http://127.0.0.1:8787')
PREVIEW_URL = os.environ.get('ABUJALIFE_OUTSIDE_PREVIEW_URL')
RUN = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:6]
ART = Path(os.environ.get('ABUJALIFE_OUTSIDE_ARTIFACTS', '/tmp/abujalife-outside-browser')) / RUN
ONLY = set(filter(None, os.environ.get('ABUJALIFE_OUTSIDE_ONLY', '').split(',')))


class StopAcceptance(Exception):
    pass


class Evidence:
    def __init__(self):
        self.results, self.errors, self.requests = [], [], []
        self.console_errors, self.network_failures, self.bad_http = [], [], []
        self.pages = []

    def watch(self, page, name):
        self.pages.append(page)
        page.on('pageerror', lambda error: self.errors.append({'page': name, 'error': str(error)}))
        page.on('console', lambda message: self.console_errors.append({'page':name, 'error':message.text}) if message.type == 'error' else None)
        page.on('requestfailed', lambda req: self.network_failures.append({'page':name, 'url':req.url, 'failure':req.failure}))
        page.on('response', lambda res: self.bad_http.append({'page':name, 'url':res.url, 'status':res.status}) if res.status >= 400 else None)
        def request(req):
            if req.method != 'POST' or urlsplit(req.url).path != '/api/action':
                return
            self.requests.append({'page': name, 'body': req.post_data_json})
        page.on('request', request)

    def save(self):
        ART.mkdir(parents=True, exist_ok=True)
        files = [REPO / 'app/app.js', REPO / 'app/outside-city.js', REPO / 'preview/index.html']
        report = {'results': self.results, 'browserErrors': self.errors, 'consoleErrors':self.console_errors,
                  'failedRequests':self.network_failures, 'httpErrors':self.bad_http, 'actualApiActions': self.requests,
                  'sourceSha256': {str(p.relative_to(REPO)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.exists()},
                  'policy': 'Native Chromium clock, animation frames, software WebGL and CDP touch; UI signups and purchases; no browser or API mocks, balance grants, profile or renderer injections.'}
        (ART / 'report.json').write_text(json.dumps(report, indent=2))

    async def check(self, name, operation):
        start = time.monotonic()
        try:
            details = await operation()
            result = {'check': name, 'status': 'passed', 'seconds': round(time.monotonic() - start, 2), 'details': details}
        except Exception as error:
            result = {'check': name, 'status': 'failed', 'seconds': round(time.monotonic() - start, 2),
                      'error': str(error), 'traceback': traceback.format_exc()}
            for i, page in enumerate(self.pages):
                if not page.is_closed():
                    try:
                        await page.screenshot(path=str(ART / f'failure-{len(self.results)}-{i}.png'), full_page=True)
                    except Exception:
                        pass
        self.results.append(result)
        print(json.dumps({k: v for k, v in result.items() if k != 'traceback'}), flush=True)
        self.save()
        if result['status'] == 'failed':
            print('REPORT='+str(ART/'report.json'), flush=True)
            raise StopAcceptance(name)
        return result['status'] == 'passed'


async def state(page):
    result = await page.evaluate("async()=>await (await fetch('/api/bootstrap')).json()")
    assert result.get('authenticated'), 'The real account/local preview is not authenticated'
    return result


async def wait_state(page, predicate, timeout=60):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = await state(page)
        if predicate(value):
            return value
        await page.wait_for_timeout(120)
    raise AssertionError('Expected authoritative state did not arrive within the native clock deadline')


async def frames(page, count=12):
    await page.evaluate('''count=>new Promise(resolve=>{let n=0;function frame(){if(++n>=count)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);})''', count)


async def onboarding(page, url, preview=False):
    await page.goto(url, wait_until='domcontentloaded')
    if not preview:
        await expect(page.locator('#auth-form')).to_be_visible()
        values = {'displayName': 'Outside Acceptance', 'username': 'outside_' + uuid.uuid4().hex[:12], 'password': 'Disposable outside acceptance 2026!'}
        for field, value in values.items():
            await page.locator(f'#auth-form [name="{field}"]').fill(value)
        await page.locator('.auth-submit').click()
    await expect(page.locator('#onboarding-form')).to_be_visible()
    for step in range(5):
        form = page.locator('#onboarding-form')
        if step == 0:
            await form.locator('[name="displayName"]').fill('Outside Acceptance')
            await form.locator('[name="presentation"][value="feminine"]').check()
        if step == 1:
            await form.locator('[name="hair"][value="braids"]').locator('xpath=..').click()
        if step == 3:
            await form.locator('[name="lifeGoal"][value="home"]').check()
        await form.locator('#begin-life' if step == 4 else '[data-onboarding-next]').click()
    await expect(page.locator('[data-nav-outside]')).to_be_visible()
    profile = (await state(page))['profile']
    assert profile['onboardingComplete'] and profile['wallet'] in (10_000_000, 100_000_000), profile
    return {'origin': profile['origin']['id'], 'startingBalance': profile['wallet'], 'district': profile['district']}


async def outside(page):
    close = page.locator('.sheet [data-close]:visible')
    if await close.count():
        await close.first.click()
    await page.locator('[data-nav-outside]').click()
    await expect(page.locator('#outside-root canvas')).to_be_visible(timeout=60000)
    await frames(page, 12)


async def touch_drag(page, points, steps=10):
    session = await page.context.new_cdp_session(page)
    try:
        def touches(fraction):
            return [{'id': i, 'x': a[0]+(b[0]-a[0])*fraction, 'y': a[1]+(b[1]-a[1])*fraction,
                     'radiusX': 1, 'radiusY': 1, 'force': 1} for i, (a, b) in enumerate(points)]
        await session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': touches(0)})
        for index in range(1, steps+1):
            await session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': touches(index/steps)})
            await page.wait_for_timeout(25)
        await session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    finally:
        await session.detach()
    await frames(page, 12)


async def native_timing(page):
    samples = await page.evaluate('''()=>new Promise(resolve=>{let previous,values=[];function frame(now){if(previous!==undefined)values.push(now-previous);previous=now;if(values.length>=16)resolve(values);else requestAnimationFrame(frame);}requestAnimationFrame(frame);})''')
    assert len(samples) == 16 and all(value > 0 for value in samples), samples
    ordered = sorted(samples)
    return {'nativeRafSamples': len(samples), 'medianFrameMs': round(statistics.median(samples), 2), 'p95FrameMs': round(ordered[int(len(ordered)*.95)-1], 2),
            'measurementScope': 'Local headless Chromium software WebGL, not a physical-device FPS claim'}


async def rendered_canvas(page, label):
    canvas = page.locator('#outside-root canvas')
    info = await canvas.evaluate('''c=>{const gl=c.getContext('webgl2')||c.getContext('webgl');const ext=gl?.getExtension('WEBGL_debug_renderer_info');return {width:c.width,height:c.height,webgl:!!gl,contextLost:gl?.isContextLost(),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};}''')
    assert info['webgl'] and not info['contextLost'] and info['width'] > 200 and info['height'] > 200, info
    raw = await canvas.screenshot(path=str(ART / f'{label}-canvas.png'))
    image = Image.open(io.BytesIO(raw)).convert('RGB')
    stats = ImageStat.Stat(image)
    info['pixelStandardDeviation'] = [round(value, 2) for value in stats.stddev]
    colors = image.resize((160, 120)).getcolors(160*120)
    info['sampleUniqueColors'] = len(colors) if colors else 160*120
    assert max(stats.stddev) > 12 and info['sampleUniqueColors'] > 100, info
    return info


async def bounded_layout(page):
    value = await page.evaluate('''()=>{
      const box=selector=>document.querySelector(selector)?.getBoundingClientRect().toJSON();
      return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
        scene:box('#outside-root'),header:box('.game-header'),navigation:box('.game-nav'),canvas:box('#outside-root canvas'),mapRoots:document.querySelectorAll('#map-root,.map-stage').length};
    }''')
    assert value['documentWidth'] <= value['width']+1 and value['bodyWidth'] <= value['width']+1, value
    assert value['mapRoots'] == 0, value
    for key in ('scene', 'header', 'navigation', 'canvas'):
        box = value[key]
        assert box and box['left'] >= -1 and box['right'] <= value['width']+1 and box['top'] >= -1 and box['bottom'] <= value['height']+1, {key: box, 'viewport': value}
    assert value['scene']['bottom'] <= value['navigation']['top']+2, value
    return value


async def close_sheet(page):
    control = page.locator('.sheet [data-close]:visible')
    if await control.count():
        await control.first.click()
    await expect(page.locator('#travel-form')).to_have_count(0)


async def buy_real_car(page):
    before = (await state(page))['profile']
    await page.locator('[data-nav-life]').click()
    await page.locator('[data-life="garage"]').click()
    await expect(page.locator('[data-purchase="used-hatchback"]')).to_be_enabled()
    async with page.expect_response(lambda r: urlsplit(r.url).path == '/api/action' and r.request.method == 'POST' and r.request.post_data_json.get('action') == 'purchase') as observed:
        await page.locator('[data-purchase="used-hatchback"]').click()
    response = await observed.value
    assert response.status == 200, await response.text()
    current = (await state(page))['profile']
    assert 'used-hatchback' in current['inventory'] and current['wallet'] == before['wallet']-28000, current
    await close_sheet(page)
    return {'vehicle': 'used-hatchback', 'actualPurchaseDebit': 28000}


async def exit_real_venue(page):
    await page.locator('[data-nav-life]').click()
    await page.locator('#world-door').click()
    await wait_state(page, lambda s: s['profile']['location']['kind'] == 'public', timeout=70)


async def paid_ride(page, mode):
    await outside(page)
    await choose_destination(page, 'venue', 'restaurant', 'Courtyard Kitchen')
    await expect(page.locator('#sheet-title')).to_have_text('Courtyard Kitchen')
    before = (await state(page))['profile']
    modes = await page.locator('#travel-form [name="mode"]').evaluate_all('nodes=>nodes.map(n=>({mode:n.value,disabled:n.disabled}))')
    assert {'bus', 'taxi', 'bike', 'walk', 'car'}.issubset({m['mode'] for m in modes}), modes
    await page.locator(f'#travel-form [name="mode"][value="{mode}"]').check()
    await expect(page.locator('#travel-form [type="submit"]')).to_be_enabled()
    quote = await page.locator('#travel-quote').inner_text()
    assert (await state(page))['profile']['wallet'] == before['wallet'], 'Choosing a transport mode debited the wallet before confirmation'
    async with page.expect_response(lambda r: urlsplit(r.url).path == '/api/action' and r.request.method == 'POST' and r.request.post_data_json.get('action') == 'travel') as observed:
        await page.locator('#travel-form [type="submit"]').click()
    response = await observed.value
    assert response.status == 200, await response.text()
    result = await response.json()
    trip = result['trip']
    assert trip['mode'] == mode and trip['venueId'] == 'restaurant' and trip['cost'] > 0, trip
    assert f'₦{trip["cost"]:,}' in quote, {'displayedQuote': quote, 'actualTrip': trip}
    assert result['profile']['wallet'] == before['wallet']-trip['cost'], result['profile']
    arrived = (await wait_state(page, lambda s: not s['profile']['activeTrip'] and s['profile']['location'].get('venue') == 'restaurant', timeout=100))['profile']
    assert arrived['wallet'] == before['wallet']-trip['cost'] and arrived['district'] == before['district'], arrived
    await expect(page.locator('#world-scene')).to_have_attribute('data-environment-renderer', 'webgl-3d', timeout=60000)
    await page.screenshot(path=str(ART / f'connected-{mode}-real-arrival.png'), full_page=True)
    await exit_real_venue(page)
    return {'mode': mode, 'quoteText': quote, 'fare': trip['cost'], 'nativeJourneySeconds': trip['seconds'], 'walletBefore': before['wallet'], 'walletAfter': arrived['wallet'], 'destination': arrived['location'], 'modeChoices': modes}


async def choose_destination(page, kind, identity, name):
    await page.locator('.outside-search input').fill(name)
    choice = page.locator(f'[data-outside-destination="{kind}:{identity}"]')
    await expect(choice).to_be_visible()
    await choice.click()
    await expect(page.locator('.outside-selection h3')).to_have_text(name)
    await page.locator('[data-outside-action="travel"]').click()
    await expect(page.locator('#travel-form')).to_be_visible()


async def catalog(page):
    current = await state(page)
    atlas, venues = current['atlas'], current['venues']
    if not isinstance(venues, list):
        venues = [{'id': identity, **value} for identity, value in venues.items()]
    assert len(atlas) == 123 and len(venues) == 20, {'districts': len(atlas), 'venues': len(venues)}
    await expect(page.locator('#outside-root')).to_have_attribute('data-outside-districts', '123')
    await expect(page.locator('#outside-root')).to_have_attribute('data-outside-venues', '20')
    identities = await page.locator('.outside-roof-label').evaluate_all('nodes=>nodes.map(n=>n.dataset.destinationKey)')
    expected = [f'district:{place["id"]}' for place in atlas] + [f'venue:{place["id"]}' for place in venues]
    assert len(set(identities)) == 143 and set(identities) == set(expected), identities
    for kind, places in [('district', atlas), ('venue', venues)]:
        for place in places:
            await page.locator('.outside-search input').fill(place['name'])
            choice = page.locator(f'[data-outside-destination="{kind}:{place["id"]}"]')
            await expect(choice).to_be_visible()
            await expect(choice).to_be_enabled()
            assert await choice.locator('strong').inner_text() == place['name']
    await page.locator('.outside-search input').fill('')
    await page.locator('[data-outside-action="directory"]').click()
    await expect(page.locator('[data-outside-destination]')).to_have_count(143)
    await page.locator('[data-outside-action="directory"]').click()
    return {'districtRoofIdentities': 123, 'venueRoofIdentities': 20, 'individuallySearchableAndEnabled': 143, 'directoryCount': 143}


async def projection(page):
    return await page.locator('.outside-roof-label').evaluate_all('''nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.destinationKey,{transform:n.style.transform,hidden:n.hidden}]))''')


async def scene_camera(page):
    await page.wait_for_function("()=>!!document.querySelector('#outside-root')?.dataset.outsideCamera")
    return await page.locator('#outside-root').evaluate('el=>JSON.parse(el.dataset.outsideCamera)')


def moved_labels(before, after):
    return [identity for identity, value in before.items() if value['transform'] and not value['hidden'] and
            identity in after and not after[identity]['hidden'] and value['transform'] != after[identity]['transform']]


async def clear_canvas_point(page):
    return await page.locator('#outside-root').evaluate('''root=>{
      const r=root.getBoundingClientRect();for(const yy of [.55,.4,.65,.32,.75])for(const xx of [.5,.65,.35,.78,.22]){
        const x=r.x+r.width*xx,y=r.y+r.height*yy;
        if(document.elementFromPoint(x,y)?.closest('.outside-city > .outside-stage'))return {x,y};
      }throw Error('No unobstructed canvas gesture point');
    }''')


async def interactions(page, label, mobile):
    await page.locator('[data-outside-action="overview"]').click()
    await frames(page, 10)
    before = await projection(page)
    camera_before = await scene_camera(page)
    await page.locator('[data-outside-action="in"]').click()
    await frames(page, 10)
    after = await projection(page)
    zoom_camera = await scene_camera(page)
    zoom_changed = moved_labels(before, after)
    assert len(zoom_changed) >= 1 and zoom_camera['zoom'] > camera_before['zoom']+.1, {'zoomMovedVisibleRoofLabels': zoom_changed, 'cameraBefore': camera_before, 'cameraAfter': zoom_camera}
    point = await clear_canvas_point(page)
    before = await projection(page)
    if mobile:
        await touch_drag(page, [((point['x'], point['y']), (point['x']+35, point['y']+20))])
    else:
        await page.mouse.move(point['x'], point['y'])
        await page.mouse.down()
        await page.mouse.move(point['x']+35, point['y']+20, steps=10)
        await page.mouse.up()
        await frames(page, 10)
    after = await projection(page)
    pan_camera = await scene_camera(page)
    pan_changed = moved_labels(before, after)
    assert len(pan_changed) >= 1 and abs(pan_camera['x']-zoom_camera['x'])+abs(pan_camera['z']-zoom_camera['z']) > 5, {'panMovedVisibleRoofLabels': pan_changed, 'cameraBefore': zoom_camera, 'cameraAfter': pan_camera}
    await page.locator('[data-outside-action="mode"]').click()
    await expect(page.locator('[data-outside-action="mode"]')).to_have_attribute('aria-pressed', 'true')
    point = await clear_canvas_point(page)
    before = await projection(page)
    if mobile:
        await touch_drag(page, [((point['x'], point['y']), (point['x']+35, point['y']+15))])
    else:
        await page.mouse.move(point['x'], point['y'])
        await page.mouse.down()
        await page.mouse.move(point['x']+35, point['y']+15, steps=10)
        await page.mouse.up()
        await frames(page, 10)
    after = await projection(page)
    orbit_camera = await scene_camera(page)
    orbit_changed = moved_labels(before, after)
    assert len(orbit_changed) >= 1 and abs(orbit_camera['yaw']-pan_camera['yaw']) > .04, {'orbitMovedVisibleRoofLabels': orbit_changed, 'cameraBefore': pan_camera, 'cameraAfter': orbit_camera}
    await page.locator('[data-outside-action="mode"]').click()
    if mobile:
        # Native pinch with starts on the real canvas; no synthetic PointerEvent.
        pair = await page.locator('#outside-root').evaluate('''root=>{
          const r=root.getBoundingClientRect();for(const yy of [.45,.6,.32])for(const xx of [.5,.65,.35]){
            const x=r.x+r.width*xx,y=r.y+r.height*yy;
            if([-35,35].every(d=>document.elementFromPoint(x+d,y)?.closest('.outside-city > .outside-stage')))return {x,y};
          }throw Error('No unobstructed native pinch start');
        }''')
        before = await projection(page)
        before_pinch_camera = await scene_camera(page)
        await touch_drag(page, [((pair['x']-35, pair['y']), (pair['x']-62, pair['y'])), ((pair['x']+35, pair['y']), (pair['x']+62, pair['y']))])
        pinch_changed = moved_labels(before, await projection(page))
        after_pinch_camera = await scene_camera(page)
        assert len(pinch_changed) >= 1 and after_pinch_camera['zoom'] > before_pinch_camera['zoom']+.1, {'nativePinchMovedVisibleRoofLabels': pinch_changed, 'cameraBefore':before_pinch_camera, 'cameraAfter':after_pinch_camera}
        assert await page.evaluate('visualViewport.scale') == 1
    else:
        pinch_changed = None
    await page.locator('[data-outside-action="overview"]').click()
    await frames(page, 10)
    roof = page.locator('.outside-roof-label:visible').first
    await expect(roof).to_be_visible()
    roof_name = await roof.get_attribute('aria-label')
    await roof.click()
    await expect(page.locator('.outside-selection')).to_be_visible()
    await page.locator('[data-outside-action="travel"]').click()
    await expect(page.locator('#travel-form')).to_be_visible()
    await close_sheet(page)
    await page.locator('[data-outside-action="close"]').click()
    await page.screenshot(path=str(ART / f'{label}-native-controls.png'), full_page=True)
    return {'zoomMovedVisibleRoofLabels': len(zoom_changed), 'panMovedVisibleRoofLabels': len(pan_changed), 'orbitMovedVisibleRoofLabels': len(orbit_changed),
            'nativePinchMovedVisibleRoofLabels': len(pinch_changed) if pinch_changed else None, 'actualCameraAfterZoom': zoom_camera, 'actualCameraAfterPan': pan_camera,
            'actualCameraAfterOrbit': orbit_camera, 'realRoofTapReachedTravelSheet': roof_name, **await native_timing(page)}


async def viewport_check(page, label, mobile):
    await outside(page)
    initial_camera = await scene_camera(page)
    await page.screenshot(path=str(ART / f'{label}-outside-initial.png'), full_page=True)
    await page.locator('[data-outside-action="overview"]').click()
    await frames(page, 10)
    labels = await page.locator('.outside-roof-label:visible').evaluate_all('''nodes=>nodes.map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {text:n.textContent,fontSize:Number.parseFloat(s.fontSize),weight:Number(s.fontWeight),width:r.width,height:r.height};})''')
    assert len(labels) >= 5, labels
    assert all(value['weight'] >= 700 and value['fontSize'] >= 9 for value in labels), labels
    await page.screenshot(path=str(ART / f'{label}-outside-overview.png'), full_page=True)
    return {'initialActualCamera': initial_camera, 'layout': await bounded_layout(page), 'actualCanvas': await rendered_canvas(page, label), 'readableBoldVisibleRoofLabels': labels,
            'controls': await interactions(page, label, mobile)}


async def position_for_local_rides(page):
    before = (await state(page))['profile']
    if before['district'] == 'garki-i':
        return {'district': 'garki-i', 'alreadyThere': True}
    await outside(page)
    current = await state(page)
    destination = next(place for place in current['atlas'] if place['id'] == 'garki-i')
    await choose_destination(page, 'district', 'garki-i', destination['name'])
    await expect(page.locator('#travel-form [type="submit"]')).to_be_enabled()
    await page.locator('#travel-form [type="submit"]').click()
    arrived = (await wait_state(page, lambda s: s['profile']['district'] == 'garki-i' and not s['profile']['activeTrip'], timeout=100))['profile']
    assert arrived['wallet'] < before['wallet'] and arrived['location']['kind'] == 'public', arrived
    return {'district': arrived['district'], 'actualFare': before['wallet']-arrived['wallet']}


async def free_walk(page):
    await outside(page)
    await choose_destination(page, 'venue', 'restaurant', 'Courtyard Kitchen')
    before = (await state(page))['profile']
    await expect(page.locator('#travel-form [name="mode"][value="walk"]')).to_be_enabled()
    await page.locator('#travel-form [name="mode"][value="walk"]').check()
    await expect(page.locator('#travel-form [type="submit"]')).to_be_enabled()
    await expect(page.locator('#travel-quote')).to_contain_text('Free')
    await page.locator('#travel-form [type="submit"]').click()
    arrived = (await wait_state(page, lambda s: s['profile']['location'].get('venue') == 'restaurant', timeout=100))['profile']
    assert arrived['wallet'] == before['wallet'] and not arrived['activeTrip'], arrived
    await exit_real_venue(page)
    return {'mode': 'walk', 'unchangedRealWallet': before['wallet'], 'destination': arrived['location']}


async def phone_bounds(page):
    await page.locator('.game-nav [data-phone="home"]').click()
    unlock = page.locator('.ph-unlock:visible')
    if await unlock.count():
        await unlock.click()
    await expect(page.locator('.ph-home-paged')).to_be_visible()
    device = await page.locator('.ph-device').bounding_box()
    assert device and device['width'] <= 330 and device['height'] <= 700 and device['x'] >= 0 and device['y'] >= 0 and device['x']+device['width'] <= 391 and device['y']+device['height'] <= 845, device
    counts = await page.locator('.ph-home-page .ph-app-grid').evaluate_all('nodes=>nodes.map(n=>n.children.length)')
    assert counts == [8,8,4], counts
    await page.locator('[data-phone-page-go="1"]').click()
    await expect(page.locator('[data-phone-page-go="1"]')).to_have_attribute('aria-current', 'page')
    box = await page.locator('.ph-home-pages').bounding_box()
    await touch_drag(page, [((box['x']+box['width']*.2,box['y']+box['height']*.82), (box['x']+box['width']*.82,box['y']+box['height']*.82))])
    await expect(page.locator('[data-phone-page-go="0"]')).to_have_attribute('aria-current','page')
    await page.screenshot(path=str(ART/'connected-phone-bounded-paging-390.png'), full_page=True)
    await page.locator('[data-ph-action="close"]').first.click()
    return {'phoneBounds':device, 'threePageAppCounts':counts, 'accessiblePagingAndNativeSwipe':True}


async def main():
    ART.mkdir(parents=True, exist_ok=True)
    qa = Evidence()
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    preview_server = None
    preview_url = PREVIEW_URL
    if preview_url is None:
        preview_server = ThreadingHTTPServer(('127.0.0.1',0), functools.partial(Quiet,directory=str(REPO/'preview')))
        threading.Thread(target=preview_server.serve_forever,daemon=True).start()
        preview_url = f'http://127.0.0.1:{preview_server.server_port}/'
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        page = await context.new_page()
        qa.watch(page, 'connected native mobile')
        connected = await qa.check('connected real signup and starter balance', lambda: onboarding(page, URL)) if not ONLY or 'connected' in ONLY else False
        if connected:
            for label, width, height in [('mobile-390x844',390,844), ('android-412x915',412,915)]:
                await page.set_viewport_size({'width':width,'height':height})
                await qa.check(label+' rendered bounded city and native controls', lambda label=label: viewport_check(page, label, True))
            desktop_context = await browser.new_context(viewport={'width':1280,'height':900}, device_scale_factor=1,
                storage_state=await context.storage_state())
            desktop = await desktop_context.new_page()
            qa.watch(desktop, 'connected native desktop')
            await desktop.goto(URL+'/#outside', wait_until='domcontentloaded')
            await expect(desktop.locator('[data-nav-outside]')).to_be_visible()
            await qa.check('desktop-1280x900 rendered bounded city and native mouse controls', lambda: viewport_check(desktop, 'desktop-1280x900', False))
            await desktop_context.close()
            await page.bring_to_front()
            await page.set_viewport_size({'width':390,'height':844})
            await outside(page)
            await qa.check('all 123 districts and 20 venues searchable', lambda: catalog(page))
            await qa.check('phone still bounded with 8/8/4 apps and native paging', lambda: phone_bounds(page))
            car = await qa.check('real own-car purchase without grants', lambda: buy_real_car(page))
            positioned = await qa.check('Outside destination travels to real Garki I', lambda: position_for_local_rides(page))
            if positioned:
                for mode in ['bus','taxi','bike'] + (['car'] if car else []):
                    await qa.check('Outside '+mode+' charges once and arrives in the selected venue', lambda mode=mode: paid_ride(page, mode))
                await qa.check('Outside local walk reaches venue with no fare', lambda: free_walk(page))
        await context.close()
        preview_context = await browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        preview = await preview_context.new_page()
        qa.watch(preview, 'generated local preview')
        preview_ready = await qa.check('generated preview native origin onboarding', lambda: onboarding(preview, preview_url, True)) if not ONLY or 'preview' in ONLY else False
        if preview_ready:
            await qa.check('generated preview same bounded WebGL Outside', lambda: viewport_check(preview, 'preview-mobile-390x844', True))
            await qa.check('generated preview same complete destination directory', lambda: catalog(preview))
        await browser.close()
    if preview_server:
        preview_server.shutdown()
    qa.save()
    print('REPORT='+str(ART / 'report.json'))
    return int(any(result['status'] == 'failed' for result in qa.results) or bool(qa.errors))


if __name__ == '__main__':
    try:
        raise SystemExit(asyncio.run(main()))
    except StopAcceptance:
        raise SystemExit(1)

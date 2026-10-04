#!/usr/bin/env python3
"""Native mobile preview acceptance for a paid Abuja Car visit and physical exit.

Run npm run preview:build first. This uses the generated anonymous preview,
its real adapter, native browser clock/animation frames and actual UI controls.
No profile, wallet, pose or renderer injection is used.
"""
import asyncio
import functools
import hashlib
import importlib.util
import json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys
import threading

from playwright.async_api import async_playwright, expect

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('preview_helpers', Path(__file__).resolve().with_name('v4-preview-browser.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
v = helpers.v
v.ART = Path('/tmp/abujalife-dealership-exit-browser') / v.ART.name


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


async def visible_player(page):
    # Authored coordinates alone cannot prove a resident is visible. Read the
    # real orthographic projection and mesh bounds published by the renderer.
    # Twenty genuine frames also replace mesh diagnostics left on the reused
    # container by the preceding interior; animation time is never mocked.
    await page.evaluate('''()=>new Promise(resolve=>{let frames=0;const next=()=>{if(++frames>=20)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);})''')
    await page.wait_for_function('''()=>{
      const el=document.querySelector('#world-scene');
      if(!el?.dataset.playerModelBounds)return false;
      try{const model=JSON.parse(el.dataset.playerModelBounds);return [el.dataset.playerScreenX,el.dataset.playerScreenY,...Object.values(model)].every(value=>Number.isFinite(Number(value)))&&model.width>0&&model.height>0;}catch{return false;}
    }''', timeout=15000)
    measurement = await page.locator('#world-scene').evaluate('''el=>{
      const rect=el.getBoundingClientRect(),model=JSON.parse(el.dataset.playerModelBounds);
      return {scene:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},floor:{x:Number(el.dataset.playerScreenX),y:Number(el.dataset.playerScreenY)},model};
    }''')
    scene, floor, model = measurement['scene'], measurement['floor'], measurement['model']
    assert 24 <= floor['x'] <= scene['width'] - 24 and 48 <= floor['y'] <= scene['height'] - 24, measurement
    intersection_width = max(0, min(scene['x'] + scene['width'], model['x'] + model['width']) - max(scene['x'], model['x']))
    intersection_height = max(0, min(scene['y'] + scene['height'], model['y'] + model['height']) - max(scene['y'], model['y']))
    visible_fraction = intersection_width * intersection_height / (model['width'] * model['height'])
    assert visible_fraction >= .95, {**measurement, 'visible_model_fraction': visible_fraction}
    assert model['width'] >= 8 and model['height'] >= 20, measurement
    return {**measurement, 'visible_model_fraction': visible_fraction}


async def home_controls(page):
    await expect(page.locator('.game-header [data-quick-home]')).to_have_count(0)
    await expect(page.locator('.world-action-row .world-home-shortcut[data-quick-home]')).to_have_count(1)
    await expect(page.locator('.world-action-row .world-sprint-button')).to_have_count(1)
    home = await page.locator('.world-home-shortcut[data-quick-home]').bounding_box()
    arrow = await page.locator('.world-action-row .world-sprint-button').bounding_box()
    location = await page.locator('.world-interact-button').bounding_box()
    joystick = await page.locator('.world-joystick').bounding_box()
    assert all((home, arrow, location, joystick)), (home, arrow, location, joystick)
    assert home['width'] >= 44 and home['height'] >= 44, home
    assert abs(home['y'] + home['height'] / 2 - arrow['y'] - arrow['height'] / 2) <= 3, {'home': home, 'arrow': arrow}
    for name, other in [('arrow', arrow), ('location', location), ('joystick', joystick)]:
        overlap_width = max(0, min(home['x'] + home['width'], other['x'] + other['width']) - max(home['x'], other['x']))
        overlap_height = max(0, min(home['y'] + home['height'], other['y'] + other['height']) - max(home['y'], other['y']))
        assert overlap_width * overlap_height <= 1, {'home': home, name: other, 'overlap': overlap_width * overlap_height}
    assert home['x'] >= 0 and home['x'] + home['width'] <= 391, home
    return {'home': home, 'arrow': arrow, 'location': location, 'joystick': joystick, 'headerHomeAbsent': True}


async def check_exit(page, qa):
    original = (await v.game.state(page))['profile']
    await page.locator('[data-nav-places]').click()
    await page.locator('[data-city-venue="dealership"]').click()
    await expect(page.locator('#sheet-title')).to_have_text('Abuja Car')
    await page.locator('#travel-form [name="mode"][value="bus"]').check()
    await expect(page.locator('#travel-form [type="submit"]')).to_be_enabled()
    await page.locator('#travel-form [type="submit"]').click()
    arrived = await v.game.wait_state(page, lambda s: s['profile']['location']['kind'] == 'venue' and s['profile']['location']['venue'] == 'dealership', timeout=50)
    await v.webgl(page)
    assert arrived['profile']['district'] == original['district']
    assert arrived['profile']['wallet'] < original['wallet']
    assert arrived['profile']['home']['propertyId'] == original['home']['propertyId']
    await qa.screenshot(page, 'abuja-car-arrival-390')
    await page.locator('[data-nav-life]').click()
    await page.locator('#world-door').click()
    exited = await v.game.wait_state(page, lambda s: s['profile']['location']['kind'] == 'public', timeout=50)
    await v.webgl(page)
    exterior = await v.game.motion(page)
    door = await page.locator('.world-point[data-world-target="dealership"]').evaluate('el=>{const m=el.transform.baseVal.consolidate().matrix;return {x:m.e,y:m.f};}')
    entry = exited['profile']['location']['exteriorEntry']
    assert entry['venueId'] == 'dealership'
    assert exited['profile']['district'] == original['district']
    assert exterior['kind'] == 'public'
    assert v.game.distance(exterior, door) < 40, {'door': door, 'resident': exterior}
    assert exited['profile']['wallet'] == arrived['profile']['wallet']
    exit_visibility = await visible_player(page)
    controls = await home_controls(page)
    await qa.screenshot(page, 'abuja-car-exit-own-street-390')

    # Walk with actual keyboard input, then reload. The previous exit should
    # stay consumed instead of resetting the resident to the same doorstep.
    movements = []
    for direction in ('d', 's', 'a', 'w'):
        before, _, after = await v.game.move_key(page, direction, 700)
        movements.append({'direction': direction, 'before': before, 'after': after})
        if v.game.distance(before, after) > 35:
            break
    else:
        raise AssertionError({'unable_to_walk_after_exit': movements})
    await helpers.v.reload(page)
    reloaded = await v.game.motion(page)
    assert v.game.distance(after, reloaded) < 3, {'walked': after, 'reloaded': reloaded}
    assert v.game.distance(exterior, reloaded) > 35
    assert (await v.game.state(page))['profile']['location']['exteriorEntry'] == entry
    reload_visibility = await visible_player(page)
    await qa.screenshot(page, 'abuja-car-exterior-walk-retained-390')

    # Only the explicit Home control should send the resident to their home.
    await page.locator('[data-quick-home]').click()
    returned = await v.game.wait_state(page, lambda s: s['profile']['location']['kind'] == 'home', timeout=75)
    assert returned['profile']['home']['propertyId'] == original['home']['propertyId']
    assert returned['profile']['wallet'] == exited['profile']['wallet']
    assert 'exteriorEntry' not in returned['profile']['location']
    await v.webgl(page)
    await qa.screenshot(page, 'explicit-home-after-abuja-car-390')
    return {'paidArrival': arrived['profile']['location'], 'exitedTo': exited['profile']['location'], 'exitPose': exterior, 'exitVisibility': exit_visibility, 'homeControls': controls, 'walkedPose': after, 'reloadedPose': reloaded, 'reloadVisibility': reload_visibility, 'returnHomeExplicit': True}


async def main():
    v.ART.mkdir(parents=True, exist_ok=True)
    qa = v.Evidence()
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(v.REPO / 'preview')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            context = await browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True, service_workers='block')
            page = await context.new_page()
            qa.watch(page, 'real mobile dealership preview')
            ready = await qa.check('Fresh real random origin and explicit Female onboarding', lambda: helpers.entry(page, 'http://127.0.0.1:' + str(server.server_port), qa))
            if ready:
                await qa.check('Paid Abuja Car visit physically exits at the dealership, retains movement through reload, and returns home only explicitly', lambda: check_exit(page, qa))
            await browser.close()
    finally:
        server.shutdown()
        qa.save()
    report_path = v.ART / 'report.json'
    report = json.loads(report_path.read_text())
    report['fixtures'] = 'Fresh anonymous local save; native crypto origin and browser time/frames; real bus fare, physical door exit, keyboard walking and explicit Home UI; no profile/wallet/pose injection.'
    report['limitations'] = ['Local Chromium/SwiftShader at 390×844 does not establish physical iOS performance or public hosting.']
    report['previewSha256'] = hashlib.sha256((v.REPO / 'preview/index.html').read_bytes()).hexdigest()
    report_path.write_text(json.dumps(report, indent=2))
    print('REPORT=' + str(report_path))
    return int(any(result['status'] == 'failed' for result in qa.results) or bool(qa.errors))


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))

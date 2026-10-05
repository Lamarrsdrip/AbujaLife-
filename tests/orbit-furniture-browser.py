#!/usr/bin/env python3
"""Native mobile/desktop orbit and furniture acceptance on real MongoDB.

Run after the production build. This test owns one private API child on8996,
and may restart only that child. The private Mongo fixture config is read by
Node, never printed. All accounts, purchases, placements and sales use actual
product UI; read-only geometry planning chooses practical floor coordinates.
No game state, balance, browser clock, RAF or endpoint is mocked.
"""
import asyncio
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
from urllib.parse import urlsplit
import uuid

from playwright.async_api import async_playwright, expect

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('phone_acceptance_helpers', REPO / 'tests/phone-premium-browser.py')
phone = importlib.util.module_from_spec(spec)
spec.loader.exec_module(phone)
helpers, base = phone.helpers, phone.base
base.API_PORT = int(os.environ.get('ABUJALIFE_QA_OWN_API_PORT', '8996'))
base.ARTIFACTS = Path(os.environ.get('ABUJALIFE_QA_ARTIFACTS', '/workspace/scratch/orbit-furniture')) / base.RUN_ID
ARTIFACTS = base.ARTIFACTS
api, state, passed = base.api, helpers.state, helpers.passed
expect.set_options(timeout=30000)
owned_api = None


class OwnedApi:
    """Manage only the child launched by this runner, never an existing API."""
    def __init__(self):
        config = Path(os.environ.get('ABUJALIFE_QA_MONGO_CONFIG', '/tmp/abujalife-production-integration/test-mongodb.json'))
        assert config.is_file(), 'Supply a private disposable Mongo fixture config file'
        self.script = ARTIFACTS / 'private-api-fixture.mjs'
        self.script.write_text('import fs from "node:fs/promises";\n' +
            'import {createProductionApplication} from ' + json.dumps((REPO / 'src/server/production.mjs').as_uri()) + ';\n' +
            'const fixture=JSON.parse(await fs.readFile(' + json.dumps(str(config)) + ',"utf8"));\n' +
            'let app;try{app=await createProductionApplication({env:{NODE_ENV:"production",MONGODB_URI:fixture.uri,MONGODB_DATABASE:fixture.database,PUBLIC_WEB_URL:"https://abujacity.life",API_PUBLIC_URL:"https://api.abujacity.life",CORS_ORIGINS:"https://abujacity.life,https://www.abujacity.life",PORT:' + json.dumps(str(base.API_PORT)) + '}});' +
            'await new Promise((resolve,reject)=>{app.server.once("error",reject);app.server.listen(' + str(base.API_PORT) + ',"127.0.0.1",resolve);});console.log(JSON.stringify({ready:true,storage:"mongodb"}));}' +
            'catch(error){console.error(JSON.stringify({event:"fixture_start_failed",code:error.code||"startup"}));process.exit(1);}\n' +
            'for(const signal of ["SIGINT","SIGTERM"])process.on(signal,async()=>{await app.close();process.exit(0);});\n')
        self.script.chmod(0o600)
        self.process = None
        self.starts = 0

    def start(self):
        assert self.process is None or self.process.poll() is not None
        # Refuse to adopt or terminate a listener another task already owns.
        try:
            urllib.request.urlopen(f'http://127.0.0.1:{base.API_PORT}/health', timeout=.3).close()
        except Exception:
            pass
        else:
            raise AssertionError('The acceptance API port is already occupied; choose a different private test port')
        self.process = subprocess.Popen(['node', str(self.script)], cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        line = self.process.stdout.readline()
        assert line and json.loads(line).get('ready') is True, 'The private production fixture could not start; no credential output is retained'
        self.starts += 1

    def stop(self):
        if self.process is not None and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        self.process = None

    def restart(self):
        self.stop()
        self.start()


async def native_frames(page, count=16):
    await page.evaluate('''count=>new Promise(resolve=>{let frames=0;const next=()=>{if(++frames>=count)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);})''', count)


async def camera(page):
    await page.wait_for_function('''()=>{const d=document.querySelector('#world-scene')?.dataset;return d&&['cameraYaw','cameraElevation','cameraZoom','playerX','playerY'].every(k=>d[k]!==undefined&&Number.isFinite(Number(d[k])));}''')
    return await page.locator('#world-scene').evaluate('''el=>({yaw:Number(el.dataset.cameraYaw),elevation:Number(el.dataset.cameraElevation),zoom:Number(el.dataset.cameraZoom),x:Number(el.dataset.playerX),y:Number(el.dataset.playerY),gesture:el.querySelector('.world-scene')?.dataset.worldGesture})''')


async def preview(page, item_id=None):
    await page.wait_for_function('''item=>{try{const value=JSON.parse(document.querySelector('#world-scene')?.dataset.furniturePreview||'null');return value&&(!item||value.itemId===item);}catch{return false;}}''', arg=item_id)
    return await page.locator('#world-scene').evaluate('''el=>{const value=JSON.parse(el.dataset.furniturePreview);if(!value.modelBounds&&el.dataset.furnitureModelBounds)value.modelBounds=JSON.parse(el.dataset.furnitureModelBounds);return value;}''')


async def ground_point(page, point):
    return await page.locator('#world-scene .world-ground').evaluate('''(el,p)=>{const value=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:value.x,y:value.y};}''', point)


async def touch_drag(page, start, end, steps=12, hold=0):
    session = await page.context.new_cdp_session(page)
    try:
        def point(p):
            return {'x': p['x'], 'y': p['y'], 'radiusX': 1, 'radiusY': 1, 'force': 1}
        await session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point(start)]})
        for index in range(1, steps + 1):
            p = {'x': start['x'] + (end['x'] - start['x']) * index / steps, 'y': start['y'] + (end['y'] - start['y']) * index / steps}
            await session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [point(p)]})
            await page.wait_for_timeout(25)
        if hold:
            await page.wait_for_timeout(hold)
        await session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    finally:
        await session.detach()


async def pinch(page, expanding):
    box = await page.locator('#world-scene').bounding_box()
    center = {'x': box['x'] + box['width'] / 2, 'y': box['y'] + box['height'] * .45}
    start, end = (25, 125) if expanding else (125, 20)
    session = await page.context.new_cdp_session(page)
    try:
        def points(radius):
            return [{'id': index, 'x': center['x'] + sign * radius, 'y': center['y'], 'radiusX': 1, 'radiusY': 1, 'force': 1} for index, sign in [(0, -1), (1, 1)]]
        await session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': points(start)})
        for index in range(1, 11):
            await session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': points(start + (end - start) * index / 10)})
            await page.wait_for_timeout(25)
        await session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    finally:
        await session.detach()
    await native_frames(page, 20)


def angle_delta(before, after):
    return (after - before + math.pi) % (2 * math.pi) - math.pi


async def snapshot(page, name):
    await native_frames(page, 8)
    await page.screenshot(path=str(ARTIFACTS / name), full_page=True, animations='disabled')


def geometry_plan(profile, item_id, rotation=0):
    """Read-only source geometry; it never saves or manufactures ownership."""
    script = '''import fs from 'node:fs';
import {buildInterior} from './app/world-interiors.js';
import {furniturePlacementFeedback} from './src/shared/furniture-placement.mjs';
const {profile,itemId,rotation}=JSON.parse(fs.readFileSync(0,'utf8'));
const scene=buildInterior({profile,id:'acceptance-read-only-plan'}),area=scene.furnishingArea;
const options=[],invalid={};
for(let yi=8;yi<=92;yi+=4)for(let xi=8;xi<=92;xi+=4){
const placement={x:xi/100,y:yi/100,rotation,propertyId:profile.home.propertyId};
const feedback=furniturePlacementFeedback(profile,itemId,placement,{scene});
if(feedback.valid)options.push({placement,point:{x:area.x+placement.x*area.w,y:area.y+placement.y*area.h}});
else if(!invalid[feedback.code])invalid[feedback.code]={placement,point:{x:area.x+placement.x*area.w,y:area.y+placement.y*area.h},code:feedback.code};
}
options.sort((a,b)=>Math.hypot(a.placement.x-.48,a.placement.y-.55)-Math.hypot(b.placement.x-.48,b.placement.y-.55));
const objects=scene.objects.filter(o=>o.itemId).map(o=>({itemId:o.itemId,x:o.x,y:o.y,w:o.w,h:o.h,elevation:o.elevation||0,supportId:o.supportId||null}));
console.log(JSON.stringify({area,width:scene.width,height:scene.height,options:options.slice(0,32),invalid,objects}));'''
    result = subprocess.run(['node', '--input-type=module', '-e', script], cwd=REPO, input=json.dumps({'profile': profile, 'itemId': item_id, 'rotation': rotation}), text=True, capture_output=True)
    assert result.returncode == 0, 'Read-only furniture geometry planning failed'
    return json.loads(result.stdout)


async def screen_relative_motion(page, label, mobile, report):
    await native_frames(page, 20)
    keyboard = None
    for key, direction in [('d', (1,0)), ('a', (-1,0)), ('w', (0,-1)), ('s', (0,1))]:
        before = await camera(page)
        matrix = await page.locator('#world-scene .world-ground').evaluate('''el=>{const m=el.getScreenCTM();return {a:m.a,b:m.b,c:m.c,d:m.d};}''')
        await page.locator('#world-scene').focus()
        await page.keyboard.down(key)
        await page.wait_for_timeout(800)
        await page.keyboard.up(key)
        await native_frames(page, 3)
        after = await camera(page)
        dx, dy = after['x']-before['x'], after['y']-before['y']
        projected = {'x':matrix['a']*dx+matrix['c']*dy,'y':matrix['b']*dx+matrix['d']*dy}
        forward = projected['x']*direction[0]+projected['y']*direction[1]
        sideways = projected['x']*direction[1]-projected['y']*direction[0]
        if math.hypot(dx,dy)>12 and forward>3 and abs(sideways)<max(3,forward*.65):
            keyboard = {'key':key,'before':before,'after':after,'projected':projected}
            break
    assert keyboard, 'No clear keyboard direction moved along the screen-relative axis at the current real orbit angle'
    assert abs(angle_delta(keyboard['before']['yaw'], keyboard['after']['yaw'])) < .03, keyboard
    joystick = None
    if mobile:
        # Reverse the successful keyboard vector to use the same clear path.
        direction = {'d':(-1,0),'a':(1,0),'w':(0,1),'s':(0,-1)}[keyboard['key']]
        box = await page.locator('.world-joystick').bounding_box()
        start = {'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}
        end = {'x':start['x']+direction[0]*box['width']*.31,'y':start['y']+direction[1]*box['height']*.31}
        before = await camera(page)
        matrix = await page.locator('#world-scene .world-ground').evaluate('''el=>{const m=el.getScreenCTM();return {a:m.a,b:m.b,c:m.c,d:m.d};}''')
        await touch_drag(page,start,end,steps=4,hold=750)
        await native_frames(page,3)
        after = await camera(page)
        dx,dy=after['x']-before['x'],after['y']-before['y']
        projected={'x':matrix['a']*dx+matrix['c']*dy,'y':matrix['b']*dx+matrix['d']*dy}
        assert projected['x']*direction[0]+projected['y']*direction[1]>3, {'before':before,'after':after,'projected':projected}
        assert abs(angle_delta(before['yaw'],after['yaw']))<.03, {'before':before,'after':after}
        joystick={'before':before,'after':after,'projected':projected}
    passed(report,f'{label} keyboard and available native joystick follow screen directions at the rotated camera angle',keyboard=keyboard,joystick=joystick)


async def open_catalogue(page, category='all', ownership='all'):
    await page.locator('[data-home-catalogue]').click()
    await expect(page.locator('.furnish-catalogue-panel')).to_be_visible()
    await expect(page.locator('.furnish-catalogue-panel')).to_have_attribute('aria-modal', 'false')
    await page.locator(f'[data-furnish-category="{category}"]').click()
    await page.locator(f'[data-furnish-filter="{ownership}"]').click()


async def select_piece(page, item_id, buy=False):
    choice = page.locator(f'[data-furnish-select="{item_id}"]')
    await choice.scroll_into_view_if_needed()
    if buy:
        async with page.expect_response(lambda response: urlsplit(response.url).path == '/api/action' and response.request.method == 'POST' and response.request.post_data_json.get('action') == 'purchase') as observed:
            await choice.click()
        response = await observed.value
        assert response.status == 200, await response.text()
        request = response.request.post_data_json
    else:
        await choice.click()
        request = None
    await expect(page.locator('.furnish-catalogue-panel')).to_have_count(0)
    await expect(page.locator('#world-scene')).to_have_attribute('data-furniture-mode', item_id)
    return request


async def aim_piece(page, item_id, candidate, mobile=True):
    screen = await ground_point(page, candidate['point'])
    box = await page.locator('#world-scene').bounding_box()
    assert box['x'] + 10 < screen['x'] < box['x'] + box['width'] - 10 and box['y'] + 10 < screen['y'] < box['y'] + box['height'] - 80, {'screen': screen, 'scene': box, 'candidate': candidate}
    if mobile:
        await page.touchscreen.tap(screen['x'], screen['y'])
    else:
        await page.mouse.click(screen['x'], screen['y'])
    await native_frames(page, 12)
    value = await preview(page, item_id)
    assert abs(value['placement']['x'] - candidate['placement']['x']) < .035 and abs(value['placement']['y'] - candidate['placement']['y']) < .035, {'expected': candidate, 'actual': value}
    return value


async def confirm_place(page, item_id):
    await expect(page.locator('[data-world-control="place-furniture"]')).to_be_enabled()
    async with page.expect_response(lambda response: urlsplit(response.url).path == '/api/action' and response.request.method == 'POST' and response.request.post_data_json.get('action') == 'place-furniture') as observed:
        await page.locator('[data-world-control="place-furniture"]').click()
    response = await observed.value
    assert response.status == 200, await response.text()
    result = await response.json()
    saved = result['profile']['furnitureLayout'][item_id]
    await expect(page.locator('#world-scene')).to_have_attribute('data-furniture-mode', '')
    return saved


async def drag_piece(page, item_id, candidate, mobile):
    await native_frames(page,12)
    value=await preview(page,item_id)
    bounds=value.get('modelBounds')
    assert bounds and bounds['width']>4 and bounds['height']>4,value
    start={'x':bounds['x']+bounds['width']/2,'y':bounds['y']+bounds['height']/2}
    end=await ground_point(page,candidate['point'])
    if mobile:
        await touch_drag(page,start,end)
    else:
        await page.mouse.move(start['x'],start['y'])
        await page.mouse.down()
        await page.mouse.move(end['x'],end['y'],steps=12)
        await page.mouse.up()
    await native_frames(page,12)
    moved=await preview(page,item_id)
    assert math.hypot(moved['cursor']['x']-value['cursor']['x'],moved['cursor']['y']-value['cursor']['y'])>15, {'before':value,'after':moved}
    return moved


async def orbit_check(page, label, mobile, report, actions):
    before = await camera(page)
    original = (await state(page))['profile']
    scene = await page.locator('#world-scene').bounding_box()
    start = {'x': scene['x'] + scene['width'] * .33, 'y': scene['y'] + scene['height'] * .44}
    end = {'x': start['x'] + min(130, scene['width'] * .30), 'y': start['y'] + 20}
    if mobile:
        await touch_drag(page, start, end)
    else:
        await page.mouse.move(start['x'], start['y'])
        await page.mouse.down()
        await page.mouse.move(end['x'], end['y'], steps=12)
        await page.mouse.up()
    await native_frames(page,2)
    released = await camera(page)
    await native_frames(page, 6)
    coast = await camera(page)
    assert abs(angle_delta(before['yaw'], released['yaw'])) > .20, (before, released)
    assert abs(angle_delta(released['yaw'], coast['yaw'])) > .001, (released, coast)
    assert math.hypot(coast['x'] - before['x'], coast['y'] - before['y']) < 2, (before, coast)
    assert (await state(page))['profile']['furnitureLayout'] == original['furnitureLayout']
    await native_frames(page, 20)
    stable = await camera(page)
    assert math.radians(28) <= stable['elevation'] <= math.radians(68)
    await snapshot(page, f'{label}-native-orbit.png')
    passed(report, f'{label} genuine drag rotates and coasts without walking or changing a home', before=before, released=released, coast=coast)
    await screen_relative_motion(page,label,mobile,report)
    if mobile:
        count = sum(action['action'] == 'place-furniture' for action in actions)
        await pinch(page, True)
        maximum = await camera(page)
        await pinch(page, False)
        minimum = await camera(page)
        assert maximum['zoom'] <= 2.5001 and maximum['zoom'] >= 2.40, maximum
        assert .7999 <= minimum['zoom'] <= .86, minimum
        assert await page.evaluate('visualViewport.scale') == 1
        assert sum(action['action'] == 'place-furniture' for action in actions) == count
        assert (await state(page))['profile']['furnitureLayout'] == original['furnitureLayout']
        passed(report, 'Native two-finger pinch is capped to the environment and never places furniture or scales the webpage', maximum=maximum, minimum=minimum)
    await page.locator('[data-world-control="zoom-fit"]').click()
    await native_frames(page, 20)


async def furniture_check(page, label, mobile, report, actions):
    await open_catalogue(page, 'living')
    panel = await page.locator('.furnish-catalogue-panel').bounding_box()
    scene = await page.locator('#world-scene').bounding_box()
    assert panel['height'] <= await page.evaluate('innerHeight*.40') and panel['y'] > scene['y'] + scene['height'] * .45, {'panel': panel, 'scene': scene}
    await expect(page.locator('[data-furnish-category]')).to_have_count(10)
    before = (await state(page))['profile']
    catalogue = (await state(page))['catalog']
    if not isinstance(catalogue, list):
        catalogue = [dict(value, id=key) for key, value in catalogue.items()]
    table = next(item for item in catalogue if item['id'] == 'coffee-table')
    purchase = await select_piece(page, 'coffee-table', buy=True)
    purchased = (await state(page))['profile']
    assert purchased['wallet'] == before['wallet'] - table['price'] and 'coffee-table' in purchased['inventory']
    assert purchase['payload']['idempotencyKey']
    assert (await api(page, '/api/action', purchase))['replayed'] is True
    assert (await state(page))['profile']['wallet'] == purchased['wallet']
    ghost = await preview(page, 'coffee-table')
    await native_frames(page, 12)
    ghost = await preview(page, 'coffee-table')
    assert ghost.get('renderer') == 'webgl-3d' and ghost.get('modelBounds', {}).get('width', 0) > 4, ghost
    await page.locator('[data-world-control="cancel-furniture"]').click()
    canceled = (await state(page))['profile']
    assert 'coffee-table' not in canceled['furnitureLayout'] and 'coffee-table' in canceled['storedFurniture']
    assert canceled['wallet'] == purchased['wallet']
    await open_catalogue(page, 'living', 'stored')
    await select_piece(page, 'coffee-table')
    await page.locator('[data-world-control="rotate"]').click()
    rotated = await preview(page, 'coffee-table')
    assert rotated['placement']['rotation'] == 90, rotated
    cursor_before = dict(rotated['cursor'])
    await page.locator('[data-world-control="nudge-right"]').click()
    nudged = await preview(page, 'coffee-table')
    assert math.hypot(nudged['cursor']['x'] - cursor_before['x'], nudged['cursor']['y'] - cursor_before['y']) > 1
    plan = geometry_plan((await state(page))['profile'], 'coffee-table', 90)
    assert plan['options'], plan
    # Show actual invalid geometry and verify the server rejects the same input.
    invalid = plan['invalid'].get('furniture_wall_overlap') or plan['invalid'].get('furniture_object_overlap')
    assert invalid, plan['invalid']
    blocked = await aim_piece(page, 'coffee-table', invalid, mobile)
    assert blocked['valid'] is False, blocked
    await expect(page.locator('[data-world-control="place-furniture"]')).to_be_disabled()
    rejected = await phone.unsafe_status(page, '/api/action', {'action': 'place-furniture', 'payload': {'itemId': 'coffee-table', **invalid['placement'], 'elevation': 9999}})
    assert rejected['status'] == 400 and rejected['body']['code'] == invalid['code'], rejected
    assert (await state(page))['profile']['furnitureLayout'] == canceled['furnitureLayout']
    chosen = next(candidate for candidate in plan['options'] if abs(candidate['placement']['x'] - invalid['placement']['x']) > .05 or abs(candidate['placement']['y'] - invalid['placement']['y']) > .05)
    valid = await aim_piece(page, 'coffee-table', chosen, mobile)
    assert valid['valid'] is True and valid.get('renderer') == 'webgl-3d', valid
    alternative=next(candidate for candidate in plan['options'] if math.hypot(candidate['point']['x']-chosen['point']['x'],candidate['point']['y']-chosen['point']['y'])>45)
    dragged=await drag_piece(page,'coffee-table',alternative,mobile)
    # A native drag must keep the owned item pending, rather than silently
    # saving a floor tap or treating the movement as a camera orbit.
    assert (await state(page))['profile']['furnitureLayout']==canceled['furnitureLayout']
    valid=await aim_piece(page,'coffee-table',chosen,mobile)
    await page.locator('[data-world-control="snap"]').click()
    snapped=await preview(page,'coffee-table')
    assert snapped['valid'] is True,snapped
    if mobile:
        count=sum(action['action']=='place-furniture' for action in actions)
        pending_layout=(await state(page))['profile']['furnitureLayout']
        await pinch(page,True)
        assert sum(action['action']=='place-furniture' for action in actions)==count
        assert (await state(page))['profile']['furnitureLayout']==pending_layout
        await page.locator('[data-world-control="zoom-fit"]').click()
        await native_frames(page,20)
    await snapshot(page, f'{label}-real-3d-coffee-table-ghost.png')
    saved = await confirm_place(page, 'coffee-table')
    assert saved['propertyId'] == before['home']['propertyId'] and saved['rotation'] == 90
    assert (await state(page))['profile']['wallet'] == purchased['wallet']
    passed(report, f'{label} compact nonmodal catalogue buys once and shows a real 3D ghost; native drag, Cancel, Rotate, Nudge, Snap, collision feedback and explicit Place work', panel=panel, purchase=purchase, invalid=invalid, ghost=valid, dragged=dragged, snapped=snapped, placement=saved)
    await snapshot(page, f'{label}-table-placed.png')
    return saved


async def run_browser(report, certificate_spki):
    report['scope'] = 'Actual rebuilt static production client, two real Mongo accounts,390×844 touch and1280×900 desktop Chromium, local TLS/domain proxy, and one exclusively owned restartable production API child.'
    report['fixture_policy'] = 'No mocks, origin assignments, grants, clock/RAF substitution or client state edits; geometry planner is read-only and every successful purchase/placement/sale uses actual UI.'
    hashes = {str(path.relative_to(base.DIST)): hashlib.sha256(path.read_bytes()).hexdigest() for path in base.DIST.rglob('*') if path.is_file()}
    report['dist_hashes'] = hashes
    async with async_playwright() as playwright:
        replacement = f'127.0.0.1:{base.TLS_PORT}'
        browser = await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', f'--ignore-certificate-errors-spki-list={certificate_spki}', f'--host-resolver-rules=MAP abujacity.life {replacement}, MAP api.abujacity.life {replacement}'])
        contexts = [await browser.new_context(viewport=size, device_scale_factor=1, is_mobile=mobile, has_touch=mobile) for size, mobile in [({'width':390,'height':844}, True), ({'width':1280,'height':900}, False)]]
        pages = [await context.new_page() for context in contexts]
        errors, network, actions = [], [], []
        for index, page in enumerate(pages):
            page.on('pageerror', lambda error, label=index: errors.append({'account':label,'error':str(error)}))
            page.on('response', lambda response, label=index: network.append({'account':label,'origin':urlsplit(response.url).netloc,'path':urlsplit(response.url).path,'status':response.status}))
            page.on('request', lambda request, label=index: actions.append({'account':label,**request.post_data_json}) if request.method=='POST' and urlsplit(request.url).path=='/api/action' else None)
        try:
            profiles = []
            for index, (page, gender) in enumerate(zip(pages, ['feminine','masculine'])):
                await page.bring_to_front()
                profiles.append(await base.register(page, 'Orbit resident '+str(index+1), 'orbit_'+uuid.uuid4().hex[:11], gender))
                await helpers.wait_world(page)
            passed(report, 'Actual Female/Male signups receive genuine random starters and persist authenticated sessions')
            placements = []
            for page, label, mobile in zip(pages, ['mobile','desktop'], [True,False]):
                await page.bring_to_front()
                await orbit_check(page, label, mobile, report, actions)
                placements.append(await furniture_check(page, label, mobile, report, actions))
            # Further item-ray, surface and social/restart checks are installed
            # below once the root renderer's final public interfaces are frozen.
            assert not errors, errors
            assert not any(row['origin']=='abujacity.life' and row['path'].startswith('/api/') for row in network)
            assert not any(row['origin']=='api.abujacity.life' and row['status']>=500 for row in network)
            assert all(hashes[name]==hashlib.sha256((base.DIST/name).read_bytes()).hexdigest() for name in hashes), 'dist changed during acceptance'
            passed(report, 'Native orbit/furniture run has no JavaScript errors, frontend API calls or API5xx responses')
        except Exception:
            for index, page in enumerate(pages):
                try:
                    await page.screenshot(path=str(ARTIFACTS/f'failure-account-{index+1}.png'), full_page=True, timeout=5000)
                    (ARTIFACTS/f'failure-account-{index+1}.html').write_text(await page.content())
                except Exception:
                    pass
            raise
        finally:
            report['page_errors'], report['network'], report['action_requests'] = errors, network, actions
            await browser.close()


if __name__ == '__main__':
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    owned_api = OwnedApi()
    try:
        owned_api.start()
        base.run_browser = run_browser
        result = base.main()
    finally:
        owned_api.stop()
    raise SystemExit(result)

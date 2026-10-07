#!/usr/bin/env python3
"""V4 acceptance through the complete connected game, real UI and real WebGL.

Run: python tests/v4-browser-smoke.py
Optional targeted recheck: ABUJALIFE_V4_ONLY=physical,work (or clubs).
Uses installed Playwright + /usr/bin/chromium and Node >=24. The disposable
server uses only its existing injectable clock and origin RNG. A private stdin
pipe changes the test calendar; no test route, wallet edit, fake users, browser
clock override, mocked RAF or substituted application module is involved.
Source hashes, actual API actions, screenshots and results are saved in /tmp.
"""
import asyncio, base64, datetime, hashlib, importlib.util, json, os
from pathlib import Path
import re, subprocess, sys, tempfile, time, traceback, uuid
from playwright.async_api import async_playwright, expect
expect.set_options(timeout=25000)
REPO=Path(__file__).resolve().parents[1]
ART=Path(os.environ.get('ABUJALIFE_V4_ARTIFACTS','/tmp/abujalife-v4-browser'))/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:6])
PASSWORD='Disposable V4 acceptance 2026!'
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('game_helpers',REPO/'tests/gameplay-smoke.py')
game=importlib.util.module_from_spec(spec);spec.loader.exec_module(game)

def hashes():
    return {str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for d in ('app','src') for p in sorted((REPO/d).rglob('*')) if p.is_file()}

class Fixture:
    def __init__(self,start='2026-10-04T18:00:00Z'):
        self.dir=tempfile.TemporaryDirectory(prefix='abujalife-v4-main-')
        script=Path(self.dir.name)/'server.mjs'
        script.write_text("import { createServer } from "+json.dumps((REPO/'src/server/http.mjs').as_uri())+";\n"+"""
import readline from 'node:readline';
let base=Date.parse(process.argv[3]),anchor=Date.now();
const clock=()=>base+Date.now()-anchor;
const server=createServer({dataDir:process.argv[2],clock,originRandomInt:()=>0});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
console.log(JSON.stringify({port:server.address().port,serverTime:clock()}));
readline.createInterface({input:process.stdin}).on('line',line=>{
try { const request=JSON.parse(line);if(request.set){base=Date.parse(request.set);anchor=Date.now();}else if(request.advance){base=clock()+request.advance;anchor=Date.now();}
console.log(JSON.stringify({serverTime:clock()})); } catch(error){console.log(JSON.stringify({error:error.message}));}
});
process.on('SIGTERM',()=>{server.closeRealtime();server.close(()=>process.exit(0));});
""")
        self.log=open(ART/'server.log','w')
        self.process=subprocess.Popen(['node',str(script),self.dir.name,start],cwd=REPO,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.log,text=True,bufsize=1)
        started=json.loads(self.process.stdout.readline());self.url='http://127.0.0.1:'+str(started['port']);self.changes=[started]
    def clock(self,stamp=None,advance=None):
        command={'set':stamp} if stamp else {'advance':advance}
        self.process.stdin.write(json.dumps(command)+'\n');self.process.stdin.flush()
        result=json.loads(self.process.stdout.readline());self.changes.append({**command,**result});return result
    def close(self):
        self.process.terminate()
        try:self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:self.process.kill();self.process.wait()
        self.log.close();self.dir.cleanup()

class Evidence:
    def __init__(self):self.initial=hashes();self.results=[];self.errors=[];self.requests=[];self.responses=[];self.pages=[];self.fixture=None
    def watch(self,page,label):
        self.pages.append(page);page.set_default_timeout(20000)
        page.on('pageerror',lambda error:self.errors.append({'page':label,'error':str(error)}))
        def request(req):
            if '/api/' not in req.url or req.method=='GET':return
            body=req.post_data_json or {}
            if 'password' in body:body={**body,'password':'[redacted fixture]'}
            if body.get('imageDataUrl'):body={**body,'imageDataUrl':'[actual PNG '+str(len(body['imageDataUrl']))+' characters]'}
            self.requests.append({'page':label,'path':req.url.split('/api/',1)[1],'body':body})
        page.on('request',request)
        async def response(res):
            if '/api/' in res.url and res.request.method!='GET':
                try:
                    body=await res.json();self.responses.append({'page':label,'path':res.url.split('/api/',1)[1],'status':res.status,'error':body.get('error'),'code':body.get('code')})
                except Exception:pass
        page.on('response',response)
    async def screenshot(self,page,label):
        await page.screenshot(path=str(ART/(label+'.png')),full_page=True,timeout=30000)
    async def check(self,label,call):
        start=time.monotonic()
        try:result={'check':label,'status':'passed','details':await call()}
        except Exception as e:
            result={'check':label,'status':'failed','error':str(e),'traceback':traceback.format_exc()}
            for i,page in enumerate(self.pages):
                if not page.is_closed():
                    try:await self.screenshot(page,f'failure-{len(self.results)+1}-{i}')
                    except Exception:pass
        result['seconds']=round(time.monotonic()-start,2);self.results.append(result);self.save()
        print(json.dumps({k:v for k,v in result.items() if k!='traceback'}),flush=True)
        return result['status']=='passed'
    def save(self):
        current=hashes();changed=[p for p,h in self.initial.items() if current.get(p)!=h]+[p for p in current if p not in self.initial]
        report={'gitHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),'results':self.results,'browserErrors':self.errors,'apiMutations':self.requests,'apiResponses':self.responses,'sourceHashesStart':self.initial,'sourceHashesEnd':current,'sourceChangedDuringRun':changed,'privateFixtureClock':self.fixture.changes if self.fixture else [],'fixtures':'Disposable real SQLite server, originRandomInt()=>0 yields genuine registration Nepo/Jabi origin. Clock only via private server stdin. Native browser clock/RAF, SwiftShader WebGL. No wallet/profile/position injection; all state changes use application UI.'}
        (ART/'report.json').write_text(json.dumps(report,indent=2))

async def webgl(page):
    scene=page.locator('#world-scene');await expect(scene).to_have_attribute('data-character-renderer','webgl-3d',timeout=45000)
    await expect(scene).to_have_attribute('data-environment-renderer','webgl-3d')
    canvas=scene.locator('canvas.world-character-layer');await expect(canvas).to_be_visible()
    value=await canvas.evaluate('c=>({width:c.width,height:c.height,webgl:!!(c.getContext("webgl2")||c.getContext("webgl"))})')
    assert value['webgl'] and value['width']>0 and value['height']>0,value
    return value

async def life(page,item):
    await game.close_phone(page);await game.close_sheet(page)
    await page.locator('[data-nav-life]').click();await page.locator(f'[data-life="{item}"]').click()

async def reload(page):
    await page.reload(wait_until='domcontentloaded');await expect(page.locator('[data-nav-life]')).to_be_visible()
    if not await page.locator('#world-scene').count():await game.navigate(page,'world')
    await webgl(page)

async def register(page,url,name,username,qa):
    await page.goto(url,wait_until='domcontentloaded');await expect(page.locator('#auth-form')).to_be_visible()
    for field,value in [('displayName',name),('username',username),('password',PASSWORD)]:await page.locator(f'#auth-form [name="{field}"]').fill(value)
    await page.locator('.auth-submit').click();await expect(page.locator('#onboarding-form')).to_be_visible()
    headings=[]
    for step in range(5):
        form=page.locator('#onboarding-form');headings.append(await form.locator('h1').inner_text())
        if step==0:
            await form.locator('[name="displayName"]').fill(name)
            await form.locator('[name="presentation"][value="feminine"]').check()
        if step==1:await form.locator('[name="hair"][value="braids"]').locator('xpath=..').click()
        if step==3:await form.locator('[name="lifeGoal"][value="home"]').check()
        if step==4:
            await expect(form).to_contain_text('Nepo');await expect(form).to_contain_text('1,000,000');await qa.screenshot(page,username+'-origin')
        await form.locator('#begin-life' if step==4 else '[data-onboarding-next]').click()
    await expect(page.locator('#onboarding-form')).to_have_count(0);await webgl(page)
    state=await game.state(page);p=state['profile'];assert p['origin']['id']=='nepo' and p['wallet']==1000000,p
    assert p['home']['layoutId']=='jabi-apartment' and p['home']['district']=='jabi',p
    assert p['onboardingComplete'] and len(set(headings))==5
    return {'id':p['id'],'headings':headings,'wallet':p['wallet'],'home':p['home']}

async def clean_world(page,qa):
    await game.close_sheet(page);await game.close_phone(page);await game.navigate(page,'world');model=await webgl(page)
    await expect(page.locator('#world-scene')).to_have_attribute('data-time-of-day','night')
    assert await page.locator('.play-guide,.play-hud,.world-toolbar').count()==0
    await expect(page.locator('.world-time-chip')).to_contain_text('WAT')
    current=await game.state(page);assert current['weather']['verified'] is False,current['weather']
    await game.no_overflow(page);before,mid,after=await game.move_key(page,'a',850)
    assert game.distance(before,after)>12,{'before':before,'after':after}
    await qa.screenshot(page,'main-night-desktop')
    await page.set_viewport_size({'width':390,'height':844});await game.no_overflow(page);await qa.screenshot(page,'main-night-mobile')
    await page.set_viewport_size({'width':1280,'height':900})
    return {'model':model,'weather':current['weather'],'movement':game.distance(before,after),'clock':current['clock']}

async def physical(page,qa,activities=('shower','sleep')):
    results=[]
    for activity in activities:
        # Returning home rebuilds the world. A marker can exist for one frame and
        # then disappear. Keep the real Enter key, but only on a control that is
        # still mounted in the current scene, and retry if that scene remounts.
        activated=False
        last_labels=[]
        for _ in range(6):
            handle=await page.wait_for_function('''(activity)=>{
                const scene=document.querySelector('#world-scene');
                if(!scene)return null;
                return [...scene.querySelectorAll('[data-world-target]')]
                    .find(node=>String(node.dataset.worldTarget||'').toLowerCase().includes(activity))||null;
            }''',arg=activity,timeout=30000)
            element=handle.as_element()
            last_labels=await page.locator('#world-scene [data-world-target]').evaluate_all('nodes=>nodes.map(n=>({id:n.dataset.worldTarget,label:n.getAttribute("aria-label")}))')
            if element is None:
                continue
            try:
                await element.press('Enter',timeout=4000)
                await expect(page.locator('#confirm-interaction')).to_be_visible(timeout=5000)
                activated=True
                break
            except Exception:
                continue
        assert activated,(activity,last_labels)
        before=(await game.state(page))['profile'];count=len([r for r in qa.requests if r['body'].get('action')==activity])
        await page.locator('#confirm-interaction').click()
        await expect(page.locator('#world-scene')).to_have_attribute('data-activity',activity)
        await expect(page.locator('#world-scene')).to_have_attribute('data-activity-pose',activity)
        await page.wait_for_function('()=>Number(document.querySelector("#world-scene")?.dataset.activityProgress)>.12',timeout=10000)
        during=(await game.state(page))['profile'];assert len([r for r in qa.requests if r['body'].get('action')==activity])==count,'Effects sent before animation finished'
        key='hygiene' if activity=='shower' else 'energy';assert during[key]==before[key],(before[key],during[key])
        await qa.screenshot(page,'main-physical-'+activity)
        await page.wait_for_function('(activity)=>document.querySelector("#world-scene")?.dataset.activity!==activity',arg=activity,timeout=25000)
        after=await game.wait_state(page,lambda s:s['profile'][key]>before[key],20)
        results.append({'activity':activity,'before':before[key],'after':after['profile'][key],'effectsDelayed':True})
    return results

async def home_studio(page,qa):
    await life(page,'design');await expect(page.locator('.home-editor')).to_be_visible()
    await page.locator('[data-home-editor="wall"][data-value="sage"]').click()
    await page.locator('[data-home-editor="floor"][data-value="darkoak"]').click()
    await page.locator('[data-home-editor="tab"][data-tab="rooms"]').click();await page.locator('[data-home-editor="add"]').click()
    await expect(page.locator('[data-home-divider]')).to_have_count(1)
    await qa.screenshot(page,'main-home-studio-divider');await page.locator('[data-home-editor="save"]').click()
    saved=await game.wait_state(page,lambda s:len(s['profile']['home'].get('roomStyle',{}).get('partitions',[]))==1)
    style=saved['profile']['home']['roomStyle'];assert style['wall']=='sage' and style['floor']=='darkoak',style
    if await page.locator('[data-home-editor="close"]').count():await page.locator('[data-home-editor="close"]').click()
    await reload(page)
    assert (await game.state(page))['profile']['home']['roomStyle']==style
    await life(page,'design');await expect(page.locator('[data-home-editor="wall"][data-value="sage"]')).to_have_attribute('aria-pressed','true')
    await expect(page.locator('.home-editor-view img')).to_be_visible(timeout=45000);await qa.screenshot(page,'main-home-studio-surfaces')
    await page.locator('[data-home-editor="close"]').click();return style

async def home_share(owner,guest,qa):
    await life(owner,'share');await expect(owner.locator('[data-ph-action="home-share-capture"]')).to_be_visible()
    await owner.locator('[data-ph-action="home-share-capture"]').click();img=owner.locator('.ph-share-preview');await expect(img).to_be_visible(timeout=45000)
    url=await img.get_attribute('src');raw=base64.b64decode(url.split(',')[1]);assert raw[:8]==b'\x89PNG\r\n\x1a\n' and len(raw)<=512*1024,len(raw)
    (ART/'actual-owned-home.png').write_bytes(raw)
    caption='My sage walls, dark oak floors and new reading nook. Abuja small small.'
    await owner.locator('#ph-shareCaption').fill(caption);await qa.screenshot(owner,'main-phone-home-share')
    await owner.locator('[data-ph-action="home-share-social"]').click();await expect(owner.locator('#ph-socialText')).to_have_value(caption)
    edited=caption+' Come through.';await owner.locator('#ph-socialText').fill(edited)
    await owner.locator('[data-ph-form="social-compose"] [type="submit"]').click();await expect(owner.locator('.ph-social-card').filter(has_text=edited)).to_be_visible()
    await game.open_phone(guest,'social');await expect(guest.locator('.ph-social-card').filter(has_text=edited)).to_be_visible()
    await expect(guest.locator('.ph-social-card').filter(has_text=edited).locator('img')).to_be_visible();await qa.screenshot(guest,'main-other-resident-home-post')
    card=guest.locator('.ph-social-card').filter(has_text=edited);post_id=await card.get_attribute('data-post-id')
    await card.locator('[data-ph-action="social-like"]').click();await expect(card.locator('[data-ph-action="social-like"]')).to_have_attribute('aria-pressed','true')
    await game.close_phone(owner);await game.close_phone(guest)
    return {'postId':post_id,'caption':edited,'pngBytes':len(raw),'pngSha256':hashlib.sha256(raw).hexdigest(),'otherResidentSawAndLiked':True}

async def statuses(owner,guest,fixture,qa):
    await game.open_phone(owner,'social');await owner.locator('[data-ph-action="social-compose"][data-kind="status"]').click()
    caption='A real 24-hour hello from Jabi.';await owner.locator('#ph-socialText').fill(caption);await owner.locator('[data-ph-form="social-compose"] [type="submit"]').click()
    await expect(owner.locator('.ph-social-card').filter(has_text=caption)).to_be_visible()
    await game.open_phone(guest,'social');await guest.locator('[data-app="socialstatuses"]').click();await expect(guest.locator('.ph-social-card').filter(has_text=caption)).to_be_visible()
    fixture.clock(advance=86401000)
    await game.close_phone(guest);await reload(guest);await game.open_phone(guest,'social');await guest.locator('[data-app="socialstatuses"]').click()
    await expect(guest.locator('.ph-social-card').filter(has_text=caption)).to_have_count(0);await expect(guest.locator('.ph-empty')).to_contain_text('No current statuses')
    await qa.screenshot(guest,'main-status-expired');await game.close_phone(owner);await game.close_phone(guest);return {'visibleBefore':True,'absentAfterHours':24,'browserClockMocked':False}

async def visits(owner,guest,qa):
    await reload(owner);await reload(guest);owner_id=(await game.state(owner))['profile']['id'];guest_id=(await game.state(guest))['profile']['id']
    print('STEP visits: guest walks outside',flush=True)
    await game.outside(guest);print('STEP visits: request',flush=True);await life(guest,'visits');await guest.locator(f'[data-visit-person="{owner_id}"]').click()
    await guest.locator('#request-visit-form [name="note"]').fill('Can I come see your new room?');await guest.locator('#request-visit-form button').click()
    await expect(guest.locator('.visit-request')).to_contain_text('pending')
    print('STEP visits: owner accepts',flush=True)
    await life(owner,'visits');await owner.locator('[data-visit-response][data-accept="true"]').click()
    await game.wait_state(guest,lambda s:s['profile']['location']['kind']=='visit')
    await game.close_sheet(owner);await game.close_sheet(guest);await webgl(guest)
    await expect(guest.locator('#world-scene')).to_have_attribute('data-scene-kind','visit')
    state=await game.state(guest);owner_profile=(await game.state(owner))['profile'];assert state['homeVisit']['ownerHome']['home']['roomStyle']==owner_profile['home']['roomStyle'],state['homeVisit']
    await expect(guest.locator('svg.world-scene')).to_have_attribute('data-home-property',owner_profile['home']['propertyId'])
    await qa.screenshot(guest,'main-guest-in-actual-owner-home');await life(guest,'design');await expect(guest.locator('.home-editor')).to_have_count(0)
    await game.close_sheet(guest);await game.close_sheet(owner)
    print('STEP visits: live movement and chat',flush=True)
    before,middle,after=await game.move_key(guest,'d',900);assert game.distance(before,after)>5
    await game.wait_state(owner,lambda s:any(p['id']==guest_id and p.get('pose') for p in s['nearby']),30)
    pose=(next(p for p in (await game.state(owner))['nearby'] if p['id']==guest_id))['pose'];assert abs(pose['x']-after['x'])<60,(pose,after)
    await life(owner,'chat');await life(guest,'chat');message='This reading corner is lovely. Thanks for the invite.'
    await guest.locator('#local-text').fill(message);await guest.locator('#local-chat-form button').click();await expect(owner.locator('#local-messages')).to_contain_text(message)
    await qa.screenshot(owner,'main-owner-live-visit-chat');await game.close_sheet(owner);await game.close_sheet(guest)
    await life(guest,'home');await game.wait_state(guest,lambda s:s['profile']['location']['kind']=='public',60)
    assert not (await game.state(guest)).get('homeVisit')
    return {'ownerId':owner_id,'guestId':guest_id,'trueOwnerRoomStyle':owner_profile['home']['roomStyle'],'pose':pose,'chatDelivered':True,'leftVisit':True}

async def loans(page,qa):
    await life(page,'loans');before=(await game.state(page))['profile']['wallet']
    await page.locator('#borrow-loan-form [name="amount"]').fill('50000');await page.locator('#borrow-loan-form button').click()
    await expect(page.locator('.sheet')).to_contain_text('Know your terms');await page.locator('[data-loan-confirm]').click()
    await expect(page.locator('[data-loan-error]')).to_contain_text('Read and accept');assert (await game.state(page))['profile']['wallet']==before
    await page.locator('[data-loan-consent]').check();await qa.screenshot(page,'main-loan-consent');await page.locator('[data-loan-confirm]').click()
    borrowed=await game.wait_state(page,lambda s:s['profile']['wallet']==before+50000)
    active=next(l for l in borrowed['profile']['loans'] if l['outstanding']>0);await expect(page.locator('#repay-loan-form')).to_be_visible()
    await page.locator('#repay-loan-form button').click();await page.locator('[data-loan-confirm]').click()
    settled=await game.wait_state(page,lambda s:not any(l['outstanding']>0 for l in s['profile']['loans']))
    assert settled['profile']['wallet']==before+50000-active['outstanding']
    await qa.screenshot(page,'main-loan-settled');await game.close_sheet(page)
    return {'withoutConsent':False,'principal':50000,'repaid':active['outstanding'],'walletBefore':before,'walletAfter':settled['profile']['wallet']}

async def work(page,fixture,qa):
    print('STEP work: Sunday banking closed',flush=True)
    fixture.clock('2026-10-11T09:00:00Z');await reload(page);await life(page,'work');await page.locator('[data-job="bank-teller"]').click();await page.locator('[data-take-job="bank-teller"]').click()
    await expect(page.locator('[data-start-shift]')).to_be_disabled();await expect(page.locator('.work-calendar')).to_contain_text('Sunday');await qa.screenshot(page,'main-work-sunday-closed')
    fixture.clock('2026-10-12T09:00:00Z');await reload(page);await life(page,'work');await page.locator('[data-job="bank-teller"]').click();await expect(page.locator('[data-start-shift]')).to_be_enabled()
    await expect(page.locator('.work-calendar')).to_contain_text('08:00');await expect(page.locator('.work-calendar')).to_contain_text('17:00')
    await page.locator('[data-job="property-agent"]').click();await page.locator('[data-take-job="property-agent"]').click()
    saved=[]
    for slot,hour in [('morning','09'),('afternoon','13')]:
        print('STEP work: '+slot,flush=True)
        fixture.clock('2026-10-12T'+hour+':00:00Z');await reload(page);await life(page,'work')
        await page.locator('[data-start-shift]').click()
        if (await game.state(page))['profile']['location']['kind']=='public' and await page.locator('[data-start-shift]').count():await page.locator('[data-start-shift]').click()
        await expect(page.locator('#shift-form')).to_be_visible();reading_started=time.monotonic();before=(await game.state(page))['profile']['wallet']
        for task,answer in {'needs':'budget','listing':'verify','viewing':'total'}.items():await page.locator(f'#shift-form [name="{task}"][value="{answer}"]').check()
        await page.wait_for_timeout(max(0,1700-(time.monotonic()-reading_started)*1000))
        await page.locator('#shift-form button').click();s=await game.wait_state(page,lambda s:s['profile']['wallet']>before)
        assert s['profile']['wallet']-before==9800;saved.append(s['profile']['workDays']['2026-10-12'])
        await expect(page.locator('[data-start-shift]')).to_be_disabled()
    await expect(page.locator('.work-calendar')).to_contain_text('0 of 2');await qa.screenshot(page,'main-work-two-real-day-slots')
    await game.navigate(page,'world');return {'bankClosedSunday':True,'bankMondayHours':'08:00–17:00 WAT','propertyShifts':saved}

async def open_club(page,venue):
    """Choose a nightclub from the outdoor Destinations list.

    The city map covers the street and only lists landmarks, so close it.
    Destinations is the player list of real venues, including clubs in other
    neighbourhoods. Choosing one opens the paid travel form.
    """
    await game.close_sheet(page);await game.close_phone(page)
    if await page.locator('.abj-restored-map').count():
        await page.locator('[data-restored-map-close]').click()
        await expect(page.locator('.abj-restored-map')).to_have_count(0)
    if (await game.state(page))['profile']['location']['kind']!='public':
        await game.outside(page)
    if await page.locator('.abj-restored-map').count():
        await page.locator('[data-restored-map-close]').click()
        await expect(page.locator('.abj-restored-map')).to_have_count(0)
    button=page.locator('[data-outside-destinations]')
    await expect(button).to_be_visible(timeout=20000)
    await button.click()
    await page.locator(f'[data-city-venue="{venue}"]').click()

async def club(page,venue,activity,kind,fixture,qa):
    print('STEP club: '+venue,flush=True)
    await open_club(page,venue)
    deadline=time.monotonic()+60
    while time.monotonic()<deadline:
        if await page.locator('#travel-form').count():break
        if ((await game.state(page))['profile']['location'].get('venueId') or (await game.state(page))['profile']['location'].get('venue'))==venue:break
        await page.wait_for_timeout(350)
    else:raise AssertionError('Venue route did not reach its doorway or travel form')
    if await page.locator('#travel-form').count():
        await page.locator('#travel-form [name="mode"][value="taxi"]').check();await expect(page.locator('#travel-form [type="submit"]')).to_be_enabled();await page.locator('#travel-form [type="submit"]').click()
        arrived=await game.wait_state(page,lambda s:bool(s['profile'].get('activeTrip')) or (s['profile']['location'].get('venueId') or s['profile']['location'].get('venue'))==venue,60)
        if arrived['profile'].get('activeTrip'):
            await expect(page.locator('#world-scene')).to_have_attribute('data-scene-kind','transit',timeout=15000)
            car_before=await game.motion(page);await page.wait_for_timeout(1300);car_after=await game.motion(page)
            assert game.distance(car_before,car_after)>10,{'journeyCarBefore':car_before,'journeyCarAfter':car_after}
            bounds=json.loads(await page.locator('#world-scene').get_attribute('data-player-model-bounds'));banner=await page.locator('.trip-banner').bounding_box()
            overlap=max(0,min(bounds['x']+bounds['width'],banner['x']+banner['width'])-max(bounds['x'],banner['x']))*max(0,min(bounds['y']+bounds['height'],banner['y']+banner['height'])-max(bounds['y'],banner['y']))
            assert overlap==0,{'car':bounds,'destinationBar':banner,'overlap':overlap}
            await qa.screenshot(page,'main-visible-moving-journey-'+venue)
            duration=max(0,arrived['profile']['activeTrip']['arrivesAt']-arrived['serverTime'])
            fixture.clock(advance=duration+1000)
            await page.reload(wait_until='domcontentloaded')
            await expect(page.locator('#world-scene')).to_be_visible(timeout=20000)
            if await page.locator('[data-arrive]').count():await expect(page.locator('[data-arrive]')).to_be_enabled(timeout=10000);await page.locator('[data-arrive]').click()
            await game.wait_state(page,lambda s:not s['profile'].get('activeTrip'),30)
            await open_club(page,venue)
    await game.wait_state(page,lambda s:(s['profile']['location'].get('venueId') or s['profile']['location'].get('venue'))==venue,60);await webgl(page)
    objects=json.loads(await page.locator('#world-scene').get_attribute('data-environment-objects'));assert kind in objects,objects
    if await page.locator('.abj-restored-map').count():
        await page.locator('[data-restored-map-close]').click()
        await expect(page.locator('.abj-restored-map')).to_have_count(0)
    audio=page.locator('#world-scene .world-sound-toggle');await expect(audio).to_have_attribute('aria-pressed','false');await audio.click();await expect(audio).to_have_attribute('aria-pressed','true')
    await qa.screenshot(page,'main-club-'+venue)
    await life(page,'activity');await expect(page.locator('.club-schedule-note')).to_contain_text('The set is on')
    current=await game.state(page);cost=next(a['cost'] for a in current['venueActions'] if a['id']==activity);before=current['profile']['wallet']
    await page.locator(f'[data-venue-activity="{activity}"]').click()
    await expect(page.locator('#world-scene')).to_have_attribute('data-activity',re.compile('.+'),timeout=15000)
    await game.wait_state(page,lambda s:s['profile']['wallet']==before-cost,60)
    after=(await game.state(page))['profile']['wallet'];assert before-after==cost
    return {'venue':venue,'sceneObject':kind,'objects':objects,'optInMusic':True,'activity':activity,'cost':cost,'balanceAfter':after}

async def main():
    selected=set(os.environ.get('ABUJALIFE_V4_ONLY','').split(','))-{''}
    assert selected <= {'physical','work','clubs'},selected
    ART.mkdir(parents=True,exist_ok=True);qa=Evidence();fixture=Fixture('2026-10-17T21:00:00Z' if selected=={'clubs'} else '2026-10-04T18:00:00Z');qa.fixture=fixture
    print('ARTIFACTS='+str(ART),flush=True)
    try:
        async with async_playwright() as pw:
            browser=await pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            contexts=[await browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1,service_workers='block') for _ in range(2)]
            owner,guest=[await c.new_page() for c in contexts];qa.watch(owner,'owner');qa.watch(guest,'guest')
            registered=await qa.check('01 genuine registration and five-card origin onboarding',lambda:register(owner,fixture.url,'Ada Acceptance','ada_v4',qa))
            if not registered:await browser.close();return 1
            if selected:
                if 'physical' in selected:await qa.check('03 physical shower and sleep delay their server effects',lambda:physical(owner,qa))
                if 'work' in selected:await qa.check('10 work respects WAT weekdays and two completed slots',lambda:work(owner,fixture,qa))
                if 'clubs' in selected:
                    fixture.clock('2026-10-17T21:00:00Z');await reload(owner)
                    await game.enter_home(owner);await physical(owner,qa,('sleep',))
                    for venue,activity,kind in ([('club','club-dance','dj-booth')] if os.environ.get('ABUJALIFE_V4_ONE_CLUB') else [('club','club-dance','dj-booth'),('bear-barn','bear-barn-relax','pub-bar'),('club-cage','cage-dance','lighting-truss'),('magic-city','magic-city-stage','performance-stage')]):
                        await qa.check('11 '+venue+' reachable distinct 3D club paid activity and opt-in sound',lambda v=venue,a=activity,k=kind:club(owner,v,a,k,fixture,qa))
            else:
                await qa.check('02 quiet full 3D night world and responsive movement',lambda:clean_world(owner,qa))
                await qa.check('03 physical shower and sleep delay their server effects',lambda:physical(owner,qa))
                await qa.check('04 home studio surfaces and reachable divider persist',lambda:home_studio(owner,qa))
                guest_ok=await qa.check('05 second independently registered connected resident',lambda:register(guest,fixture.url,'Bayo Acceptance','bayo_v4',qa))
                if guest_ok:
                    await qa.check('06 actual home PNG and editable caption reach real resident feed',lambda:home_share(owner,guest,qa))
                    await qa.check('07 real status disappears after 24 server hours',lambda:statuses(owner,guest,fixture,qa))
                    await qa.check('08 owner-approved visit actual home live pose and shared chat',lambda:visits(owner,guest,qa))
                await guest.close()
                await qa.check('09 explicit loan consent borrowing and repayment',lambda:loans(owner,qa))
                await qa.check('10 work respects WAT weekdays and two completed slots',lambda:work(owner,fixture,qa))
                fixture.clock('2026-10-17T21:00:00Z');await reload(owner)
                await game.enter_home(owner);await physical(owner,qa,('sleep',))
                for venue,activity,kind in ([('club','club-dance','dj-booth')] if os.environ.get('ABUJALIFE_V4_ONE_CLUB') else [('club','club-dance','dj-booth'),('bear-barn','bear-barn-relax','pub-bar'),('club-cage','cage-dance','lighting-truss'),('magic-city','magic-city-stage','performance-stage')]):
                    await qa.check('11 '+venue+' reachable distinct 3D club paid activity and opt-in sound',lambda v=venue,a=activity,k=kind:club(owner,v,a,k,fixture,qa))
            qa.save();await browser.close()
    finally:fixture.close();qa.save()
    report=ART/'report.json';print('REPORT_SHA256='+hashlib.sha256(report.read_bytes()).hexdigest(),flush=True)
    print('SUMMARY='+json.dumps({'passed':sum(r['status']=='passed' for r in qa.results),'failed':sum(r['status']=='failed' for r in qa.results),'browserErrors':qa.errors,'report':str(report)}),flush=True)
    return int(any(r['status']=='failed' for r in qa.results) or bool(qa.errors))
if __name__=='__main__':raise SystemExit(asyncio.run(main()))

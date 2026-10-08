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
from playwright.async_api import async_playwright, expect, TimeoutError as PlaywrightTimeoutError
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
        page.on('pageerror',lambda error:self.errors.append({'page':label,'error':str(error),'stack':error.stack}))
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
        report={'gitHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),'results':self.results,'browserErrors':self.errors,'apiMutations':self.requests,'apiResponses':self.responses,'sourceHashesStart':self.initial,'sourceHashesEnd':current,'sourceChangedDuringRun':changed,'privateFixtureClock':self.fixture.changes if self.fixture else [],'fixtures':'Disposable real SQLite server; each registration selects its origin in the signup form. originRandomInt()=>0 selects the first authored home in that origin. Clock only via private server stdin. Native browser clock/RAF, SwiftShader WebGL. No wallet/profile/position injection; all state changes use application UI.'}
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

async def register(page,url,name,username,qa,origin='nepo'):
    await page.goto(url,wait_until='domcontentloaded');await expect(page.locator('#auth-form')).to_be_visible()
    welcome=page.locator('#welcome-scene')
    await expect(welcome).to_have_attribute('data-character-renderer','webgl-3d',timeout=45000)
    await expect(welcome).to_have_attribute('data-environment-renderer','webgl-3d')
    quality=await welcome.evaluate('''el=>{const canvas=el.querySelector('canvas.world-character-layer'),r=canvas?.getBoundingClientRect();return {width:canvas?.width,height:canvas?.height,cssWidth:r?.width,cssHeight:r?.height,environmentMeshes:Number(el.dataset.environmentMeshes||0),webgl:!!(canvas&&(canvas.getContext('webgl2')||canvas.getContext('webgl')))}}''')
    assert quality['webgl'] and quality['environmentMeshes']>0 and quality['width']+1>=quality['cssWidth'] and quality['height']+1>=quality['cssHeight'],quality
    await qa.screenshot(page,username+'-login-room-desktop')
    await page.set_viewport_size({'width':390,'height':844})
    await game.no_overflow(page);await qa.screenshot(page,username+'-login-room-mobile')
    await page.set_viewport_size({'width':1280,'height':900})
    for field,value in [('displayName',name),('username',username),('password',PASSWORD)]:await page.locator(f'#auth-form [name="{field}"]').fill(value)
    await page.locator(f'#auth-form [name="originId"][value="{origin}"]').check()
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
            expected={'nepo':('Nepo Baby','100,000,000'),'lapo':('Lapo Baby','10,000,000')}[origin]
            await expect(form).to_contain_text(expected[0]);await expect(form).to_contain_text(expected[1]);await qa.screenshot(page,username+'-origin')
        await form.locator('#begin-life' if step==4 else '[data-onboarding-next]').click()
    await expect(page.locator('#onboarding-form')).to_have_count(0);await webgl(page)
    state=await game.state(page);p=state['profile'];expected_balance={'nepo':100_000_000,'lapo':10_000_000}[origin]
    assert p['origin']['id']==origin and p['wallet']==expected_balance,p
    if origin=='nepo':assert p['home']['layoutId']=='jabi-apartment' and p['home']['district']=='jabi',p
    else:assert p['home']['layoutId']=='garki-studio' and p['home']['district']=='lugbe',p
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

async def phone_hardware(page,qa):
    await game.close_sheet(page);await game.close_phone(page);await game.navigate(page,'world')
    await page.evaluate("window.__phoneSceneBefore=document.querySelector('#world-scene')")
    measurements=[]
    try:
        for width,height,label in [(1280,900,'desktop'),(390,844,'mobile')]:
            await page.set_viewport_size({'width':width,'height':height})
            await game.open_phone(page)
            root=page.locator('#phone-root');device=root.locator('.ph-device')
            await expect(root).to_be_visible();await expect(device).to_be_visible()
            await expect(device.locator('.ph-statusbar .ph-network-type')).to_have_text('Wi-Fi')
            await expect(device.locator('.ph-island')).to_be_visible()
            close=root.locator('.ph-device-caption [data-ph-action="close"]')
            await expect(close).to_be_visible();await expect(close).to_contain_text('Close')
            box=await device.bounding_box()
            metrics=await device.evaluate("""el=>{const matches=[];const walk=(rules,source,media='')=>{for(const rule of rules){if(rule.selectorText&&rule.selectorText.includes('ph-device')){try{if(el.matches(rule.selectorText))matches.push({source,media,selector:rule.selectorText,style:rule.style.cssText})}catch{}}else if(rule.cssRules)walk(rule.cssRules,source,rule.conditionText||media)}};for(const sheet of document.styleSheets){try{walk(sheet.cssRules,sheet.href)}catch{}}return {rect:el.getBoundingClientRect().toJSON(),width:getComputedStyle(el).width,height:getComputedStyle(el).height,aspectRatio:getComputedStyle(el).aspectRatio,captionTop:getComputedStyle(el.querySelector('.ph-device-caption')).top,rootClass:el.closest('#phone-root')?.className,matches}}""")
            assert box and 320<box['width']<=width and box['height']<height,{'viewport':[width,height],'device':box,'computed':metrics}
            await qa.screenshot(page,'main-phone-pro-frame-'+label)
            await close.click();await expect(root).to_be_hidden()
            assert await page.evaluate("window.__phoneSceneBefore===document.querySelector('#world-scene')"),'Opening or closing the phone remounted the world'
            measurements.append({'viewport':[width,height],'frame':[round(box['width']),round(box['height'])],'singleMountedWorld':True})
    finally:
        await game.close_phone(page)
        await page.set_viewport_size({'width':1280,'height':900})
    return {'device':'responsive Pro Max-style virtual handset','networkIndicator':'Wi-Fi','measurements':measurements,'existingPhoneLifecyclePreserved':True}

async def physical(page,qa,activities=('shower','sleep')):
    local_preview=await page.evaluate("document.documentElement.dataset.preview==='browser'")
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
        await expect(page.locator('#toast')).to_contain_text('A little better than before',timeout=20000)
        after=await game.state(page);value=after['profile'][key]
        actions=[r for r in qa.requests if r['body'].get('action')==activity]
        if not local_preview:assert len(actions)==count+1,{'activity':activity,'beforeRequests':count,'afterRequests':len(actions)}
        assert value>=before[key],{'activity':activity,'before':before[key],'after':value}
        # A need can already be at its 100-point cap. The action still
        # completes and applies its other benefits; it simply cannot raise a
        # capped meter any further.
        results.append({'activity':activity,'before':before[key],'after':value,'atCap':value==100,'effectsDelayed':True,'localPreview':local_preview})
    return results

async def home_studio(page,qa):
    await expect(page.locator('.abj-home-garage-bay')).to_have_count(0)
    await life(page,'garage');await expect(page.locator('.garage-cars')).to_be_visible()
    await game.close_sheet(page)
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

async def investment_portfolio(page,fixture,qa):
    """Exercise the existing investment UI against authoritative server state."""
    await game.navigate(page,'property')
    await page.locator('[data-property-tab="investments"]').click()
    count=page.locator('[data-portfolio-count]')
    await expect(count).to_have_text('0 properties')
    for key in ('purchase','resale','rent'):
        await expect(page.locator(f'[data-portfolio-value="{key}"]')).to_have_text('₦0')
    initial=await game.state(page)
    primary_id=initial['profile']['home']['propertyId']
    assert initial['profile'].get('propertyInvestments')=={},initial['profile'].get('propertyInvestments')
    prop=next(item for item in initial['properties'] if item['id']=='lugbe-flat')
    assert prop['id']!=primary_id and initial['profile']['wallet']>=prop['buy'],{'property':prop,'profile':initial['profile']}
    await page.locator('[data-invest-property="lugbe-flat"]').click()
    await page.locator('[data-buy-investment="lugbe-flat"]').click()
    bought=await game.wait_state(page,lambda value:bool(value['profile'].get('propertyInvestments',{}).get('lugbe-flat')))
    holding=bought['profile']['propertyInvestments']['lugbe-flat']
    assert initial['profile']['wallet']-bought['profile']['wallet']==prop['buy'],{'before':initial['profile']['wallet'],'after':bought['profile']['wallet'],'property':prop}
    assert bought['profile']['home']['propertyId']==primary_id and bought['profile']['location']==initial['profile']['location']
    await expect(page.locator('[data-portfolio-count]')).to_have_text('1 property')
    await expect(page.locator('[data-portfolio-value="purchase"]')).to_have_text(f"₦{holding['purchasePrice']:,}")
    await expect(page.locator('[data-portfolio-value="resale"]')).to_have_text(f"₦{holding['resaleValue']:,}")
    await qa.screenshot(page,'main-investment-owned')

    # The fixture advances only the server clock. Reload lets the normal bootstrap
    # resynchronize the app's game clock before the rent timer is evaluated.
    fixture.clock(advance=7*24*60*60*1000+1)
    await reload(page)
    await game.navigate(page,'property')
    await page.locator('[data-property-tab="investments"]').click()
    await page.locator('[data-invest-property="lugbe-flat"]').click()
    before_collect=await game.state(page)
    wallet_before_collect=before_collect['profile']['wallet']
    await expect(page.locator('[data-collect-rent="lugbe-flat"]')).to_be_enabled()
    await page.locator('[data-collect-rent="lugbe-flat"]').click()
    collected=await game.wait_state(page,lambda value:value['profile']['wallet']>wallet_before_collect)
    rent_delta=collected['profile']['wallet']-wallet_before_collect
    assert rent_delta>=holding['incomePerPeriod'] and rent_delta%holding['incomePerPeriod']==0,{'income':rent_delta,'holding':holding}
    assert len(collected['profile']['propertyInvestments'])==1
    await expect(page.locator('[data-portfolio-count]')).to_have_text('1 property')
    await expect(page.locator('[data-portfolio-value="purchase"]')).to_have_text(f"₦{holding['purchasePrice']:,}")
    await qa.screenshot(page,'main-investment-rent-collected')

    await page.locator('[data-sell-investment="lugbe-flat"]').click()
    sold=await game.wait_state(page,lambda value:'lugbe-flat' not in value['profile'].get('propertyInvestments',{}))
    sale_delta=sold['profile']['wallet']-collected['profile']['wallet']
    assert sale_delta>=holding['resaleValue'] and (sale_delta-holding['resaleValue'])%holding['incomePerPeriod']==0,{'saleDelta':sale_delta,'holding':holding}
    await expect(page.locator('[data-portfolio-count]')).to_have_text('0 properties')
    for key in ('purchase','resale','rent'):
        await expect(page.locator(f'[data-portfolio-value="{key}"]')).to_have_text('₦0')
    await page.reload(wait_until='domcontentloaded')
    persisted=await game.state(page)
    assert 'lugbe-flat' not in persisted['profile'].get('propertyInvestments',{})
    assert 'lugbe-flat' not in persisted['profile'].get('ownedProperties',[])
    await game.navigate(page,'property')
    await page.locator('[data-property-tab="investments"]').click()
    await expect(page.locator('[data-portfolio-count]')).to_have_text('0 properties')
    await page.locator('[data-invest-property="lugbe-flat"]').click()
    await expect(page.locator('[data-buy-investment="lugbe-flat"]')).to_be_enabled()
    return {'initialCount':0,'bought':holding['purchasePrice'],'activeCountAfterBuy':1,'rentCollected':rent_delta,'saleProceeds':sale_delta,'activeCountAfterReload':0,'primaryHomeExcluded':True}

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
        await expect(page.locator('#shift-form')).to_be_visible();reading_started=time.monotonic();started=await game.state(page);before=started['profile']['wallet'];expected_pay=started['jobs']['property-agent']['pay']
        answers={'needs':'budget','listing':'verify','viewing':'total'}
        for task,answer in answers.items():
            choice=page.locator(f'#shift-form [name="{task}"][value="{answer}"]')
            await choice.check();await expect(choice).to_be_checked()
        await page.wait_for_timeout(max(0,1700-(time.monotonic()-reading_started)*1000))
        # Live profile refreshes can replace the challenge form while a
        # disposable clock fixture is advanced. Verify the real form payload
        # immediately before submission so a stale radio cannot silently
        # turn this into an incomplete-shift browser validation error.
        form=page.locator('#shift-form')
        for task,answer in answers.items():
            choice=form.locator(f'[name="{task}"][value="{answer}"]')
            if not await choice.is_checked():await choice.check()
        submitted=await form.evaluate('el=>Object.fromEntries(new FormData(el))')
        assert submitted==answers,{'expectedAnswers':answers,'formAnswers':submitted}
        await page.locator('#shift-form button').click();s=await game.wait_state(page,lambda s:s['profile']['wallet']>before)
        assert s['profile']['wallet']-before==expected_pay;saved.append(s['profile']['workDays']['2026-10-12'])
        await expect(page.locator('[data-start-shift]')).to_be_disabled()
    await expect(page.locator('.work-calendar')).to_contain_text('0 of 2');await qa.screenshot(page,'main-work-two-real-day-slots')
    await game.navigate(page,'world');return {'bankClosedSunday':True,'bankMondayHours':'08:00–17:00 WAT','propertyShifts':saved}

async def open_club_destination(page,venue):
    # Nightlife venues are searchable 3D map destinations; follow the same
    # destination card and route chooser that a player uses.
    await game.close_sheet(page);await game.close_phone(page)
    city_map=page.locator('.abj-restored-map')
    if await city_map.count()==0:await page.locator('[data-nav-outside]').click()
    await expect(city_map).to_be_visible(timeout=60000)
    state=await game.state(page)
    venue_name=next((item['name'] for item in state.get('venues',[]) if item.get('id')==venue),venue.replace('-',' '))
    search=city_map.locator('.outside-search input[type="search"]')
    await search.fill(venue_name)
    destination=city_map.locator('[data-outside-destination]').filter(has_text=venue_name).first
    await expect(destination).to_be_visible(timeout=15000)
    await destination.click()
    await city_map.locator('[data-outside-action="travel"]').click()
    route=page.locator('.abj-map-journey')
    await expect(route).to_be_visible(timeout=15000)
    walk=route.locator('[data-map-mode="walk"]')
    mode='walk' if await walk.is_enabled() else 'bus'
    await route.locator(f'[data-map-mode="{mode}"]').click()
    await expect(route.locator('[data-map-go]')).to_be_enabled(timeout=15000)
    departure=await game.state(page)
    await route.locator('[data-map-go]').click()
    await expect(city_map).to_have_count(0,timeout=15000)
    started=await game.wait_state(page,lambda s:bool(s['profile'].get('activeTrip')) or s['profile']['location']['kind']=='venue',30)
    return {'departure':departure,'started':started,'mode':mode}

async def club(page,venue,activity,kind,fixture,qa):
    print('STEP club: '+venue,flush=True)
    route=await open_club_destination(page,venue)
    departure_wallet=route['departure']['profile']['wallet'];mode=route['mode'];trip=route['started'];travel_cost=0
    local=mode=='walk'
    if local:
        assert trip['profile']['location']['kind']=='venue' and (trip['profile']['location'].get('venueId') or trip['profile']['location'].get('venue'))==venue,trip['profile']['location']
    else:
        active_trip=trip['profile'].get('activeTrip')
        if active_trip:
            travel_cost=active_trip['cost']
            assert active_trip['mode']==mode and active_trip['venueId']==venue,active_trip
            assert trip['profile']['wallet']==departure_wallet-travel_cost
            car_before=await game.motion(page)
            if car_before['kind']=='transit':
                await expect(page.locator('#world-scene')).to_have_class(re.compile(r'\bworld-route-trip\b'))
                progress=page.locator('.trip-banner .world-route-progress')
                await expect(progress).to_be_visible()
                await expect(progress).to_have_attribute('aria-valuenow',re.compile(r'^(?:0|[1-9][0-9]?|100)$'))
                # A slow browser can finish the short trip while the 3D scene
                # mounts. Wait for motion or the authoritative arrival scene.
                try:
                    await page.wait_for_function('''({x,y})=>{const el=document.querySelector('#world-scene');return el?.dataset.sceneKind!=='transit'||Math.hypot(Number(el.dataset.playerX)-x,Number(el.dataset.playerY)-y)>10}''',arg={'x':car_before['x'],'y':car_before['y']},timeout=5000)
                except PlaywrightTimeoutError:
                    pass
            if await page.locator('#world-scene').get_attribute('data-scene-kind')=='transit':
                car_after=await game.motion(page)
                assert game.distance(car_before,car_after)>10,{'journeyCarBefore':car_before,'journeyCarAfter':car_after}
                stage=await page.locator('#world-scene').bounding_box();banner=await page.locator('.trip-banner').bounding_box()
                # The route camera follows its avatar at the center of the world
                # canvas. Keep the travel card clear of that focal area.
                focus={'x':stage['x']+stage['width']*.4,'y':stage['y']+stage['height']*.35,'width':stage['width']*.2,'height':stage['height']*.3}
                overlap=max(0,min(focus['x']+focus['width'],banner['x']+banner['width'])-max(focus['x'],banner['x']))*max(0,min(focus['y']+focus['height'],banner['y']+banner['height'])-max(focus['y'],banner['y']))
                assert overlap==0,{'playerFocus':focus,'destinationBar':banner,'overlap':overlap}
                await qa.screenshot(page,'main-visible-moving-journey-'+venue)
            elif not trip['profile'].get('activeTrip'):
                trip=await game.state(page)
                assert trip['profile']['location']['kind']=='venue' and (trip['profile']['location'].get('venueId') or trip['profile']['location'].get('venue'))==venue,trip['profile']
                travel_cost=departure_wallet-trip['profile']['wallet']
            if trip['profile'].get('activeTrip'):
                duration=max(0,active_trip['arrivesAt']-trip['serverTime'])
                fixture.clock(advance=duration+1000)
                # Bootstrap re-anchors the injected server clock. Arrival itself still
                # uses the normal game timer/button and opens the chosen venue directly.
                await reload(page)
                if await page.locator('[data-arrive]').count():
                    await expect(page.locator('[data-arrive]')).to_be_enabled(timeout=10000)
                    await page.locator('[data-arrive]').click()
        else:
            # The trip may complete before the slow 3D scene finishes building.
            # Validate the persisted destination and real debit instead of assuming
            # a transient activeTrip is still present in the first bootstrap read.
            assert trip['profile']['location']['kind']=='venue' and (trip['profile']['location'].get('venueId') or trip['profile']['location'].get('venue'))==venue,trip['profile']
            travel_cost=departure_wallet-trip['profile']['wallet']
    arrived=await game.wait_state(page,lambda s:s['profile']['location']['kind']=='venue' and (s['profile']['location'].get('venueId') or s['profile']['location'].get('venue'))==venue,90)
    assert not arrived['profile'].get('activeTrip'),arrived['profile']
    assert arrived['profile']['wallet']==departure_wallet-travel_cost
    await webgl(page)
    objects=json.loads(await page.locator('#world-scene').get_attribute('data-environment-objects'));assert kind in objects,objects
    await expect(page.locator('.abj-home-garage-bay')).to_have_count(0)
    tray=page.locator('.location-activity-tray')
    if await tray.count() and await tray.get_attribute('data-mode')=='open':
        await page.get_by_role('button',name='Minimize activities').click()
        await expect(tray).to_have_attribute('data-mode','minimized')
    await expect(page.locator('.club-spray-button')).to_be_visible()
    await page.locator('.club-spray-button').click();await expect(page.locator('.club-spray-menu')).to_be_visible()
    await expect(page.locator('.club-spray-menu button').first).to_be_visible()
    await page.locator('.club-spray-button').click();await expect(page.locator('.club-spray-menu')).to_be_hidden()
    audio=page.locator('.world-sound-toggle');await expect(audio).to_have_attribute('aria-pressed','false')
    await audio.click();await expect(audio).to_have_attribute('aria-pressed','true')
    await qa.screenshot(page,'main-club-'+venue)
    outcomes=[]
    # Keep the resident's real energy needs viable for the next venue in the
    # end-to-end journey. Repeat/retry safety is covered by authoritative API
    # tests; this browser path exercises one genuine paid action per venue.
    for attempt in range(1):
        await life(page,'activity')
        await expect(page.locator('.club-schedule-note')).to_contain_text('DJ live')
        current=await game.state(page);assert current['clubSchedule']['isOpen'],current['clubSchedule']
        authored=next(a for a in current['venueActions'] if a['id']==activity);cost=authored['cost'];before=current['profile']
        count=len([r for r in qa.requests if r['body'].get('action')=='venue-action' and r['body'].get('payload',{}).get('activityId')==activity])
        button=page.locator(f'[data-venue-activity="{activity}"]');await expect(button).to_be_enabled()
        # Completion is deliberately brief. Capture actual DOM notifications
        # while the action runs, before waiting for the persisted wallet effect.
        await page.evaluate('''()=>{window.__qaActivityToasts=[];window.__qaToastObserver?.disconnect();window.__qaToastObserver=new MutationObserver(()=>{const text=document.querySelector('#toast')?.textContent||'';if(text)window.__qaActivityToasts.push(text);});window.__qaToastObserver.observe(document.querySelector('#toast'),{childList:true,subtree:true,characterData:true});}''')
        await button.click()
        # Native approach/activity animation finishes before the server mutation.
        # Charge/effect evidence is authoritative; a home-sleep progress bar is
        # not part of the nightlife acceptance contract.
        completed=await game.wait_state(page,lambda s:s['profile']['wallet']==before['wallet']-cost,90)
        after=completed['profile']
        assert after['wallet']==before['wallet']-cost
        assert len([r for r in qa.requests if r['body'].get('action')=='venue-action' and r['body'].get('payload',{}).get('activityId')==activity])==count+1
        # Fun and cleanliness have no passive decay in this fixture, so these
        # verify exact intended effects even if the resident approached slowly.
        for need in ('fun','hygiene','stress','mood'):
            if need in authored['effects']:
                assert after[need]==max(0,min(100,before[need]+authored['effects'][need])),{'need':need,'before':before[need],'after':after[need],'effect':authored['effects'][need]}
        await page.wait_for_function("()=>window.__qaActivityToasts.some(text=>text.toLowerCase().includes('complete'))",timeout=20000)
        await page.evaluate('window.__qaToastObserver.disconnect()')
        outcomes.append({'attempt':attempt+1,'cost':cost,'balanceAfter':after['wallet'],'effects':authored['effects']})
    await life(page,'home')
    outside=await game.wait_state(page,lambda s:s['profile']['location']['kind']=='public',60)
    assert outside['profile']['district']==arrived['profile']['district']
    await webgl(page);await qa.screenshot(page,'main-club-exit-'+venue)
    return {'venue':venue,'routeMode':mode,'travelCost':travel_cost,'sceneObject':kind,'objects':objects,'optInMusic':True,'activity':activity,'paidActivities':outcomes,'exitDistrict':outside['profile']['district']}

async def main():
    selected=set(os.environ.get('ABUJALIFE_V4_ONLY','').split(','))-{''}
    assert selected <= {'physical','work','clubs','phone','investments'},selected
    ART.mkdir(parents=True,exist_ok=True);qa=Evidence();fixture=Fixture('2026-10-17T21:00:00Z' if selected=={'clubs'} else '2026-10-04T18:00:00Z');qa.fixture=fixture
    print('ARTIFACTS='+str(ART),flush=True)
    try:
        async with async_playwright() as pw:
            gpu_args=[] if sys.platform=='darwin' else ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
            browser=await pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or (str(Path('/usr/bin/chromium')) if Path('/usr/bin/chromium').exists() else pw.chromium.executable_path),headless=True,args=['--no-sandbox',*gpu_args])
            contexts=[await browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1,service_workers='block') for _ in range(2)]
            owner,guest=[await c.new_page() for c in contexts];qa.watch(owner,'owner');qa.watch(guest,'guest')
            registered=await qa.check('01 real Nepo signup starts with ₦100M and completes five onboarding cards',lambda:register(owner,fixture.url,'Ada Acceptance','ada_v4',qa,'nepo'))
            if not registered:await browser.close();return 1
            if selected:
                if 'physical' in selected:await qa.check('03 physical shower and sleep delay their server effects',lambda:physical(owner,qa))
                if 'work' in selected:await qa.check('10 work respects WAT weekdays and two completed slots',lambda:work(owner,fixture,qa))
                if 'phone' in selected:await qa.check('02 premium responsive Pro Max-style phone frame preserves the mounted world',lambda:phone_hardware(owner,qa))
                if 'investments' in selected:await qa.check('03 authoritative investment portfolio buys, collects rent, sells and persists',lambda:investment_portfolio(owner,fixture,qa))
                if 'clubs' in selected:
                    fixture.clock('2026-10-17T21:00:00Z');await reload(owner)
                    await game.enter_home(owner);await physical(owner,qa,('sleep',))
                    clubs=[('club','club-dance','dj-booth'),('bear-barn','bear-barn-relax','pub-bar'),('club-cage','cage-dance','lighting-truss'),('magic-city','magic-city-stage','performance-stage')]
                    if os.environ.get('ABUJALIFE_V4_CLUB'):
                        clubs=[entry for entry in clubs if entry[0]==os.environ['ABUJALIFE_V4_CLUB']]
                        assert clubs,'ABUJALIFE_V4_CLUB must name an authored nightlife venue'
                    elif os.environ.get('ABUJALIFE_V4_ONE_CLUB'):
                        clubs=clubs[:1]
                    for venue,activity,kind in clubs:
                        await qa.check('11 '+venue+' reachable distinct 3D club paid activity and opt-in sound',lambda v=venue,a=activity,k=kind:club(owner,v,a,k,fixture,qa))
            else:
                await qa.check('02 quiet full 3D night world and responsive movement',lambda:clean_world(owner,qa))
                await qa.check('02 premium responsive Pro Max-style phone frame preserves the mounted world',lambda:phone_hardware(owner,qa))
                await qa.check('03 physical shower and sleep delay their server effects',lambda:physical(owner,qa))
                await qa.check('03 authoritative investment portfolio buys, collects rent, sells and persists',lambda:investment_portfolio(owner,fixture,qa))
                await qa.check('04 home studio surfaces and reachable divider persist',lambda:home_studio(owner,qa))
                guest_ok=await qa.check('05 second Nepo resident registers in the same Jabi neighbourhood for multiplayer',lambda:register(guest,fixture.url,'Bayo Acceptance','bayo_v4',qa,'nepo'))
                if guest_ok:
                    await qa.check('06 actual home PNG and editable caption reach real resident feed',lambda:home_share(owner,guest,qa))
                    await qa.check('07 real status disappears after 24 server hours',lambda:statuses(owner,guest,fixture,qa))
                    await qa.check('08 owner-approved visit actual home live pose and shared chat',lambda:visits(owner,guest,qa))
                await guest.close()
                lapo_context=await browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1,service_workers='block')
                lapo_page=await lapo_context.new_page();qa.watch(lapo_page,'lapo signup')
                await qa.check('05 real Lapo signup starts with ₦10M and saves a rent-free starter home',lambda:register(lapo_page,fixture.url,'Lapo Acceptance','lapo_v4',qa,'lapo'))
                await lapo_context.close()
                await qa.check('09 explicit loan consent borrowing and repayment',lambda:loans(owner,qa))
                await qa.check('10 work respects WAT weekdays and two completed slots',lambda:work(owner,fixture,qa))
                fixture.clock('2026-10-17T21:00:00Z');await reload(owner)
                await game.enter_home(owner);await physical(owner,qa,('sleep',))
                clubs=[('club','club-dance','dj-booth'),('bear-barn','bear-barn-relax','pub-bar'),('club-cage','cage-dance','lighting-truss'),('magic-city','magic-city-stage','performance-stage')]
                if os.environ.get('ABUJALIFE_V4_CLUB'):
                    clubs=[entry for entry in clubs if entry[0]==os.environ['ABUJALIFE_V4_CLUB']]
                    assert clubs,'ABUJALIFE_V4_CLUB must name an authored nightlife venue'
                elif os.environ.get('ABUJALIFE_V4_ONE_CLUB'):
                    clubs=clubs[:1]
                for venue,activity,kind in clubs:
                    await qa.check('11 '+venue+' reachable distinct 3D club paid activity and opt-in sound',lambda v=venue,a=activity,k=kind:club(owner,v,a,k,fixture,qa))
            qa.save();await browser.close()
    finally:fixture.close();qa.save()
    report=ART/'report.json';print('REPORT_SHA256='+hashlib.sha256(report.read_bytes()).hexdigest(),flush=True)
    print('SUMMARY='+json.dumps({'passed':sum(r['status']=='passed' for r in qa.results),'failed':sum(r['status']=='failed' for r in qa.results),'browserErrors':qa.errors,'report':str(report)}),flush=True)
    return int(any(r['status']=='failed' for r in qa.results) or bool(qa.errors))
if __name__=='__main__':raise SystemExit(asyncio.run(main()))

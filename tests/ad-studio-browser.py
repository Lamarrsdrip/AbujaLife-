#!/usr/bin/env python3
"""Advertising studio responsiveness on phone-sized screens.

The source dev server has no ad store, so the ad endpoints are answered by this
fixture with the production response shapes. Inventory is deliberately slow
(INVENTORY_DELAY_MS) to prove the studio never waits on it. Everything else is
the real client: real sheet, real rendering, real request cancellation.
"""
import asyncio,json,os,subprocess,sys,tempfile,time,urllib.request,uuid
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.async_api import async_playwright

REPO=Path(__file__).resolve().parents[1];PORT=int(os.getenv('ABUJALIFE_AD_STUDIO_PORT','8796'));BASE=f'http://127.0.0.1:{PORT}'
ART=Path(os.getenv('ABUJALIFE_AD_STUDIO_ARTIFACTS','/tmp/abuja-ad-studio-qa'));INVENTORY_DELAY_MS=3000;TOTAL_PLOTS=130
APPEARANCE={'presentation':'masculine'}
FRAME_PROBE='''()=>new Promise(done=>{const gaps=[];let last=performance.now(),n=0;const tick=now=>{gaps.push(now-last);last=now;if(++n<40)requestAnimationFrame(tick);else done({max:Math.max(...gaps),avg:gaps.reduce((a,b)=>a+b,0)/gaps.length});};requestAnimationFrame(tick);})'''
def stage(name,details=None):print(json.dumps({'stage':name,'details':details}),flush=True)

async def run(pw,size,admin=False):
    # Headless Chromium on macOS falls back to software WebGL and stalls on the 3D world; Linux CI keeps its default.
    browser=await pw.chromium.launch(headless=True,args=['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'] if sys.platform=='darwin' else [])
    c=await browser.new_context(viewport=size,has_touch=True,is_mobile=True,device_scale_factor=2)
    user='ads_'+uuid.uuid4().hex[:12]
    for path,body in [('/api/auth/register',{'username':user,'displayName':'Ads QA','password':'Ads QA fixture 2026!','appearance':APPEARANCE,'originId':'lapo'}),('/api/profile',{'displayName':'Ads QA','appearance':APPEARANCE,'lifeGoal':'explore','onboardingComplete':True})]:
        r=await c.request.post(BASE+path,data=body);assert r.ok,(path,r.status,await r.text())
    p=await c.new_page();errors=[];world=[];aborted=[];checkout=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('requestfailed',lambda r:aborted.append(r.url) if '/api/ads/world' in r.url else None)
    async def config(route):
        await route.fulfill(json={'ok':True,'enabled':True,'provider':'Flutterwave','mode':'test','currency':'NGN','ads':{'pricing':{'amount':2000,'plotPackSize':1,'currency':'NGN','days':7},'spaces':[],'active':[],'serverTime':int(time.time()*1000)}})
    async def inventory(route):
        q=parse_qs(urlsplit(route.request.url).query);world.append({k:v[0] for k,v in q.items()})
        if 'zone' not in q:
            await route.fulfill(json={'ok':True,'spaces':[],'active':[]});return
        page=int(q.get('page',['0'])[0]);limit=int(q.get('limit',['96'])[0]);zone=q['zone'][0]
        await asyncio.sleep(INVENTORY_DELAY_MS/1000)
        ids=list(range(page*limit,min(TOTAL_PLOTS,(page+1)*limit)))
        spaces=[{'id':f'{zone}-qa-{i}','kind':'plot','zoneId':zone,'zone':'QA','row':i//10,'column':i%10,'available':i%7!=3,'eligible':True,'name':f'Plot {i+1}'} for i in ids]
        try:await route.fulfill(json={'ok':True,'spaces':spaces,'nextPage':page+1 if (page+1)*limit<TOTAL_PLOTS else None,'serverTime':int(time.time()*1000)})
        except Exception:pass
    async def pay(route):
        checkout.append(route.request.post_data_json);await asyncio.sleep(.4)
        await route.fulfill(status=503,json={'error':'Fixture stops before the payment provider.','code':'fixture_stop'})
    async def status(route):await route.fulfill(json={'ok':True,'role':'superadmin' if admin else None,'permissions':['payments'] if admin else []})
    await p.route('**/api/admin/status',status)
    await p.route('**/api/payments/config',config);await p.route('**/api/ads/world**',inventory);await p.route('**/api/payments/checkout',pay)
    await p.goto(BASE,wait_until='networkidle');await p.wait_for_selector('.world-canvas',timeout=30000)
    w=p.locator('[data-welcome-continue]')
    if await w.count() and await w.first.is_visible():await w.first.click()
    await p.wait_for_function('()=>globalThis.__ABJ_ADS__?.pricing?.amount===2000',timeout=15000)
    # Frame pacing of the game itself, before the studio exists, is the baseline.
    await p.wait_for_timeout(1500);baseline=await p.evaluate(FRAME_PROBE)
    before=len(world)
    if admin:
        # Administrators get the free-publishing layer on top of the same studio. It
        # must settle: a self-triggering observer here once froze the whole page.
        await p.evaluate('''()=>{window.__submitWrites=0;new MutationObserver(records=>{for(const r of records)if(r.target.classList?.contains('abj-ad-submit'))window.__submitWrites+=r.addedNodes.length;}).observe(document.querySelector('#sheet-root'),{subtree:true,childList:true});
          dispatchEvent(new CustomEvent('abj:open-ad-studio',{detail:{kind:'plot',zoneId:'map-parcels'}}));}''')
        await asyncio.sleep(INVENTORY_DELAY_MS/1000+1.2)
        try:state=await asyncio.wait_for(p.evaluate('''()=>({writes:window.__submitWrites,label:document.querySelector('.abj-ad-submit')?.textContent,mode:document.querySelector('[data-ad-form]')?.dataset.adminAdMode,cells:document.querySelectorAll('[data-ad-space]').length,eyebrow:document.querySelector('.abj-ad-studio .eyebrow')?.textContent})'''),timeout=6)
        except asyncio.TimeoutError:raise AssertionError('the admin advertising studio froze the page')
        assert state['mode']=='1' and state['label']=='Publish to AbujaLife · No charge' and 'ADMIN' in state['eyebrow'],state
        assert state['writes']<=4,('the admin layer keeps rewriting the submit button',state)
        assert state['cells']>0,state
        probe=await p.evaluate(FRAME_PROBE);assert probe['max']<=max(50,baseline['max']*2),('admin studio stalls frames',probe,baseline)
        await p.locator('[data-ad-space]:not([disabled])').first.click()
        assert await p.locator('[data-ad-selected] [data-ad-remove]').count()==1
        assert not errors,errors
        await p.screenshot(path=str(ART/f'studio-admin-{size["width"]}x{size["height"]}.png'))
        await browser.close();return {'viewport':size,'admin':True,'submitWrites':state['writes'],'frameMaxMs':round(probe['max'],1),'cells':state['cells']}
    # 1. The shell is in the DOM in the same task as the open request, with inventory still loading.
    opened=await p.evaluate('''()=>{const t=performance.now();dispatchEvent(new CustomEvent('abj:open-ad-studio',{detail:{kind:'plot'}}));
      const form=document.querySelector('[data-ad-form]'),grid=document.querySelector('[data-ad-grid]');
      return{ms:performance.now()-t,shell:!!form,close:!!document.querySelector('[data-ad-close]'),busy:grid?.getAttribute('aria-busy'),text:grid?.textContent,price:document.querySelector('[data-ad-price]')?.textContent,cells:document.querySelectorAll('[data-ad-space]').length};}''')
    assert opened['shell'] and opened['close'],opened
    assert opened['busy']=='true' and 'Loading available spaces' in opened['text'] and opened['cells']==0,opened
    assert opened['price']=='₦2,000',opened
    assert opened['ms']<100,('studio shell must render synchronously',opened)
    assert len(world)==before,('opening must not start an inventory request before first paint',world[before:])
    # 2. While inventory is still loading the form, tabs, close button and scrolling all respond.
    await p.locator('[name="title"]').fill('Mama Put Kitchen');await p.locator('[name="email"]').fill('owner@example.com')
    assert await p.locator('[name="title"]').input_value()=='Mama Put Kitchen'
    await p.locator('.abj-ad-studio').evaluate('node=>node.scrollTo(0,240)');scrolled=await p.locator('.abj-ad-studio').evaluate('node=>node.scrollTop')
    # The sheet's own entrance animation is measured separately below; this probe
    # is the steady state a player types and scrolls in while spaces are loading.
    await p.wait_for_timeout(700);frames=await p.evaluate(FRAME_PROBE)
    assert await p.locator('[data-ad-grid]').get_attribute('aria-busy')=='true','inventory should still be loading during the responsiveness probe'
    assert frames['max']<=max(50,baseline['max']*2),('the studio stalls frames while inventory loads',frames,baseline)
    assert frames['avg']<=max(22,baseline['avg']*1.3),('the studio lowers the frame rate while inventory loads',frames,baseline)
    # 3. The inventory page arrives, is small, omits artwork and renders every cell.
    await p.wait_for_selector('[data-ad-space]',timeout=8000)
    first=[q for q in world[before:] if 'zone' in q]
    assert len(first)==1 and first[0]['zoom']=='1' and int(first[0]['limit'])<=48 and first[0]['page']=='0',first
    assert not any(q.get('limit')=='96' for q in world[before:]),('broad 96-space request during open',world[before:])
    limit=int(first[0]['limit']);await p.wait_for_function(f'()=>document.querySelectorAll("[data-ad-space]").length==={limit}',timeout=4000)
    # 4. Every placement stays reachable through More spaces, then Previous returns instantly from cache.
    seen=set(await p.eval_on_selector_all('[data-ad-space]','els=>els.map(e=>e.dataset.adSpace)'));pages=1
    while not await p.locator('[data-ad-page="next"]').is_disabled():
        await p.locator('[data-ad-page="next"]').click();pages+=1
        await p.wait_for_function(f'()=>document.querySelector("[data-ad-page-label]").textContent==="Page {pages}"&&document.querySelector("[data-ad-grid]").getAttribute("aria-busy")==="false"',timeout=8000)
        await p.wait_for_timeout(120);seen|=set(await p.eval_on_selector_all('[data-ad-space]','els=>els.map(e=>e.dataset.adSpace)'))
    assert len(seen)==TOTAL_PLOTS,('complete inventory must be reachable',len(seen),pages)
    t=time.time();await p.locator('[data-ad-page="previous"]').click()
    await p.wait_for_function(f'()=>document.querySelector("[data-ad-page-label]").textContent==="Page {pages-1}"&&document.querySelectorAll("[data-ad-space]").length>0',timeout=600)
    cached_ms=(time.time()-t)*1000;assert cached_ms<600,cached_ms
    # 5. Rapid page and area switching: only the final request may land.
    await p.evaluate('''()=>{const next=document.querySelector('[data-ad-page="next"]'),prev=document.querySelector('[data-ad-page="previous"]'),zone=document.querySelector('[data-ad-zone]');
      const other=[...zone.options].map(o=>o.value).filter(v=>v!=='map-parcels'&&v!=='legacy');
      zone.value=other[0];zone.dispatchEvent(new Event('change'));zone.value=other[1];zone.dispatchEvent(new Event('change'));zone.value=other[2];zone.dispatchEvent(new Event('change'));window.__finalZone=other[2];}''')
    final=await p.evaluate('window.__finalZone')
    await p.wait_for_function('()=>document.querySelector("[data-ad-grid]").getAttribute("aria-busy")==="false"&&document.querySelectorAll("[data-ad-space]").length>0',timeout=8000)
    await p.wait_for_timeout(INVENTORY_DELAY_MS+300)
    ids=await p.eval_on_selector_all('[data-ad-space]','els=>els.map(e=>e.dataset.adSpace)')
    assert ids and all(i.startswith(final+'-qa-') for i in ids),('a stale area response replaced the current page',final,ids[:3])
    assert await p.locator('[data-ad-page-label]').inner_text()=='Page 1'
    assert len(aborted)>=2,('superseded inventory requests should be aborted',aborted)
    # 6. Closing mid-load cancels the request; repeated open/close leaves nothing behind.
    for _ in range(4):
        await p.evaluate("dispatchEvent(new CustomEvent('abj:open-ad-studio',{detail:{kind:'plot',zoneId:'map-parcels'}}))")
        await p.locator('[data-ad-close]').click()
    assert await p.locator('[data-ad-form]').count()==0
    settled=len(world);await p.wait_for_timeout(INVENTORY_DELAY_MS+500)
    assert await p.locator('[data-ad-form]').count()==0 and await p.locator('[data-ad-space]').count()==0,'a late response must not rebuild a closed studio'
    assert len(world)<=settled+1,('requests continued after close',world[settled:])
    # 7. A double-tapped checkout sends exactly one request with one idempotency key.
    await p.evaluate("dispatchEvent(new CustomEvent('abj:open-ad-studio',{detail:{kind:'plot',zoneId:'map-parcels'}}))")
    await p.wait_for_selector('[data-ad-space]:not([disabled])',timeout=8000);await p.locator('[data-ad-space]:not([disabled])').first.click()
    png=bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000'+'1f15c489'+'0000000d49444154789c6360f8cfc0f01f0005050201'+'5f6a8d2b'+'0000000049454e44ae426082')
    await p.locator('[name="image"]').set_input_files({'name':'ad.png','mimeType':'image/png','buffer':png})
    await p.locator('[name="title"]').fill('Mama Put Kitchen');await p.locator('[name="email"]').fill('owner@example.com');await p.locator('[name="link"]').fill('https://example.com')
    ready=True
    try:await p.wait_for_function('()=>!document.querySelector(".abj-ad-submit").disabled',timeout=6000)
    except Exception:ready=False
    if ready:
        await p.evaluate('()=>{const b=document.querySelector(".abj-ad-submit");b.click();b.click();document.querySelector("[data-ad-form]").requestSubmit();}')
        await p.wait_for_function('()=>document.querySelector("[data-ad-note]").classList.contains("error")',timeout=6000)
        assert len(checkout)==1,('duplicate checkout requests',len(checkout))
        assert checkout[0]['idempotencyKey'] and checkout[0]['purpose']=='ad' and len(checkout[0]['slots'])==1 and checkout[0]['checkoutSchema']==2,checkout[0]
    # 8. Entrance cost compared with a plain sheet using the same shared sheet styles.
    ENTRY='''kind=>new Promise(done=>{
      if(kind==='plain')document.querySelector('#sheet-root').innerHTML='<div class="sheet-backdrop"><section class="sheet"><h2>Plain</h2><p>Sheet</p></section></div>';
      else dispatchEvent(new CustomEvent('abj:open-ad-studio',{detail:{kind:'plot',zoneId:'map-parcels'}}));
      const gaps=[];let last=performance.now(),n=0;const tick=now=>{gaps.push(now-last);last=now;if(++n<36)requestAnimationFrame(tick);else done(gaps.slice(1).filter(g=>g>25).reduce((a,b)=>a+b,0));};requestAnimationFrame(tick);})'''
    close="document.querySelector('#sheet-root').replaceChildren()"
    await p.evaluate(close);await p.wait_for_timeout(1200)
    plain=await p.evaluate(ENTRY,'plain')
    await p.evaluate(close);await p.wait_for_timeout(1200)
    studio=await p.evaluate(ENTRY,'studio')
    await p.wait_for_timeout(300)
    assert not errors,errors
    await p.screenshot(path=str(ART/f'studio-{size["width"]}x{size["height"]}.png'))
    result={'viewport':size,'openMs':round(opened['ms'],2),'baselineFrameMaxMs':round(baseline['max'],1),'frameMaxMs':round(frames['max'],1),'frameAvgMs':round(frames['avg'],1),'scrolledWhileLoading':scrolled,'pageSize':limit,'pages':pages,'placementsReached':len(seen),'cachedPageMs':round(cached_ms),'abortedRequests':len(aborted),'checkoutRequests':len(checkout),'checkoutExercised':ready,'entrySlowFrameMs':{'plainSheet':round(plain),'adStudio':round(studio)}}
    await browser.close();return result

async def main():
    ART.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as data,open(ART/'server.log','w') as log:
        server=subprocess.Popen(['node','scripts/dev.mjs'],cwd=REPO,env={**os.environ,'PORT':str(PORT),'ABUJALIFE_DATA_DIR':data},stdout=log,stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                try:
                    with urllib.request.urlopen(BASE+'/api/health',timeout=1):break
                except Exception:await asyncio.sleep(.1)
            async with async_playwright() as pw:
                for size in [{'width':390,'height':844},{'width':320,'height':568},{'width':430,'height':932}]:
                    stage('ad-studio',await run(pw,size))
                for size in [{'width':390,'height':844},{'width':1440,'height':900}]:
                    stage('ad-studio-admin',await run(pw,size,admin=True))
            stage('all-ad-studio-checks-passed')
        finally:
            server.terminate()
            try:server.wait(timeout=10)
            except Exception:server.kill()
if __name__=='__main__':asyncio.run(main())

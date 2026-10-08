#!/usr/bin/env python3
"""Actual production DOM/API on local TLS; Chromium mobile and laptop geometry.
Keyboard geometry uses an explicit VisualViewport simulation, not a claim of
physical iPhone keyboard testing. No paid transaction is initiated here.
"""
import asyncio, importlib.util, json, os, uuid
from pathlib import Path
from playwright.async_api import async_playwright, expect
REPO=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('production_frames',REPO/'tests/production-browser-smoke.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
async def geometry(page):
 return await page.evaluate('''()=>{
 const rect=selector=>document.querySelector(selector)?.getBoundingClientRect().toJSON();
 return {device:rect('.ph-device'),screen:rect('.ph-screen'),caption:rect('.ph-device-caption'),viewport:{height:visualViewport.height,width:visualViewport.width,top:visualViewport.offsetTop},body:getComputedStyle(document.body).position};}''')
async def empty_sky_point(page):
 # Tap an unobstructed point on the actual world canvas, away from rendered
 # building/landmark labels. The stage canvas paints the surrounding sky-blue
 # ad area too, so this exercises the same hit-test as a player tap.
 return await page.evaluate('''()=>{
  const canvas=document.querySelector('.outside-stage canvas');
  if(!canvas)throw new Error('outside world canvas is missing');
  const r=canvas.getBoundingClientRect();
  for(const [fx,fy] of [[.06,.42],[.94,.42],[.08,.72],[.92,.72],[.5,.08],[.5,.92]]){
   const x=r.left+r.width*fx,y=r.top+r.height*fy;
   if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;
   if(document.elementFromPoint(x,y)===canvas)return{x,y,fx,fy};
  }
  throw new Error('no unobstructed sky/canvas point is available for an advertising tap');
 }''')
async def run(report,certificate_spki):
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--no-sandbox','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',f'--ignore-certificate-errors-spki-list={certificate_spki}',f'--host-resolver-rules=MAP abujacity.life 127.0.0.1:{base.TLS_PORT}, MAP api.abujacity.life 127.0.0.1:{base.TLS_PORT}'])
  try:
   for label,width,height,mobile in [('mobile',393,852,True),('laptop',1440,900,False)]:
    context=await browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
    page=await context.new_page();errors=[];network=[]
    report.setdefault('diagnostics',{})[label]={'errors':errors,'network':network}
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('requestfailed',lambda request:network.append({'url':request.url,'failure':request.failure}))
    page.on('response',lambda response:network.append({'url':response.url,'status':response.status}) if '/api/' in response.url and response.status>=400 else None)
    page.on('console',lambda message:errors.append(message.text) if message.type=='error' else None)
    try:
     await base.register(page,'Frame '+label,'frame_'+uuid.uuid4().hex[:10],'feminine')
    except Exception:
     report['diagnostics'][label]['auth'] = await page.evaluate('''()=>{const e=document.querySelector('#auth-form [type=submit]');if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e),x=r.left+r.width/2,y=r.top+r.height/2;return{rect:r.toJSON(),disabled:e.disabled,opacity:s.opacity,transform:s.transform,animation:s.animationName,transition:s.transition,hit:document.elementFromPoint(x,y)?.outerHTML?.slice(0,500),html:e.outerHTML,form:document.querySelector('#auth-form')?.getBoundingClientRect().toJSON()}}''')
     await page.screenshot(path=str(base.ARTIFACTS/f'{label}-auth-failed.png'),timeout=90000)
     raise
    await expect(page.locator('#world-scene.world-playable')).to_be_visible(timeout=30000)
    await page.locator('.wallet-button').click();await expect(page.locator('.ph-device')).to_be_visible()
    g=await geometry(page)
    assert g['device']['x']>=0 and g['device']['y']>=0,g
    assert g['device']['x']+g['device']['width']<=width+1 and g['device']['y']+g['device']['height']<=height+1,g
    assert g['screen']['x']>=g['device']['x'] and g['screen']['y']>=g['device']['y'],g
    assert await page.locator('.ph-status-icons').get_attribute('aria-label')=='Wi-Fi connected, battery'
    assert g['body']=='fixed',g
    await page.screenshot(path=str(base.ARTIFACTS/f'{label}-phone.png'),timeout=90000)
    # Exercise actual focus, phone sizing listeners and composer clipping with
    # the viewport Safari reports when a keyboard takes the lower screen area.
    if mobile:
     await page.locator('[data-ph-action="wallet-topup"]').click()
     await expect(page.get_by_label('Payment amount (NGN)',exact=True)).to_be_visible()
     await page.get_by_label('Payment amount (NGN)',exact=True).focus()
     await page.evaluate('''()=>{window.__qaOriginalViewport=window.visualViewport;const vv=new EventTarget();Object.assign(vv,{width:393,height:420,offsetTop:28,offsetLeft:0});Object.defineProperty(window,'visualViewport',{value:vv,configurable:true});dispatchEvent(new Event('resize'));}''')
     await page.wait_for_function("Number(document.querySelector('#phone-root').style.getPropertyValue('--ph-device-scale'))<.5")
     keyboard=await geometry(page)
     assert keyboard['device']['y']>=28 and keyboard['device']['y']+keyboard['device']['height']<=448,keyboard
     await page.get_by_label('Payment amount (NGN)',exact=True).fill('300')
     await page.screenshot(path=str(base.ARTIFACTS/'mobile-keyboard-geometry.png'))
     await page.evaluate("Object.defineProperty(window,'visualViewport',{value:window.__qaOriginalViewport,configurable:true});document.activeElement.blur();dispatchEvent(new Event('resize'))")
    await page.locator('.ph-device-caption [data-ph-action="close"]').click()
    await expect(page.locator('#phone-root')).to_be_hidden()
    assert await page.evaluate("getComputedStyle(document.body).position")!='fixed'
    await page.locator('.game-nav [data-view="market"]').count() # dock itself is verified below
    await page.locator('.game-nav [data-nav-life]').click()
    await page.locator('[data-life-action="property"]').count()
    await page.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)')
    dock=await page.locator('.game-nav').bounding_box();assert dock and dock['y']+dock['height']<=height and dock['y']>height-140,dock
    await page.locator('#sheet-root .sheet-close').click()
    await page.locator('.game-nav [data-nav-outside]').click()
    await expect(page.locator('.abj-restored-map canvas')).to_be_visible()
    await page.locator('[data-outside-action="ads"]').click()
    sky=await empty_sky_point(page)
    await page.mouse.click(sky['x'],sky['y'])
    await expect(page.locator('.outside-selection')).to_be_visible()
    await expect(page.locator('[data-outside-action="advertise"]')).to_be_visible()
    await page.locator('[data-outside-action="advertise"]').click()
    await expect(page.locator('.abj-ad-studio')).to_be_visible()
    assert await page.locator('[data-ad-note]').inner_text(), 'selection guidance missing'
    await page.screenshot(path=str(base.ARTIFACTS/f'{label}-ad-selection.png'),timeout=90000)
    assert not errors,errors
    report['checks'].append({'name':label+' phone, focus/scroll lock, fixed dock, sky-blue map ad tap and studio','passed':True,'geometry':g,'adTap':sky})
    await context.close()
  finally: await browser.close()
base.run_browser=run
if __name__=='__main__':raise SystemExit(base.main())

#!/usr/bin/env python3
"""Actual V4 renderer/pointer QA with clearly named creative fixtures.
No backend campaign, payment, wallet or inventory is mutated. The standalone
fixture feeds the same map renderer four synthetic aspect ratios for visual QA.
Full-client gameplay and production campaign truth are verified separately.
"""
import asyncio,json,os,subprocess,tempfile,urllib.request
from pathlib import Path
from playwright.async_api import async_playwright,expect
REPO=Path(__file__).resolve().parents[1];PORT=8798;BASE=f'http://127.0.0.1:{PORT}';ART=Path(os.getenv('ABUJALIFE_AD_ARTIFACTS','/tmp/abuja-map-ad-qa'))
HTML='''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/outside-city.css"><link rel="stylesheet" href="/outside-quick-access.css"><link rel="stylesheet" href="/abuja-game-polish-2026.css"><link rel="stylesheet" href="/game-hud.css"><style>body{margin:0}#map{height:100dvh}.outside-city{height:100%;min-height:100%}.fixture-label{position:absolute;z-index:99;top:10px;left:10px;background:white;font:12px sans-serif;padding:5px}</style></head><body><div id="map"></div><span class="fixture-label">QA creative fixture</span><script type="module">
import {renderOutside} from '/outside-city-v4.js';import {ABUJA_ATLAS} from '/src/shared/atlas.mjs';import {VENUES} from '/src/shared/life.mjs';
const ratio=new URLSearchParams(location.search).get('ratio').split('x').map(Number),canvas=document.createElement('canvas');canvas.width=ratio[0];canvas.height=ratio[1];const ctx=canvas.getContext('2d');ctx.fillStyle='#075d44';ctx.fillRect(0,0,...ratio);ctx.strokeStyle='#ffc64b';ctx.lineWidth=30;ctx.strokeRect(15,15,ratio[0]-30,ratio[1]-30);ctx.fillStyle='white';ctx.font=`bold ${Math.min(...ratio)*.11}px sans-serif`;ctx.textAlign='center';ctx.fillText('ABUJA AD QA',ratio[0]/2,ratio[1]*.45);ctx.fillStyle='#ffc64b';ctx.fillText(`${ratio[0]} × ${ratio[1]}`,ratio[0]/2,ratio[1]*.65);
globalThis.__ABJ_ADS__={active:[{txRef:'creative-fixture',title:'Creative fixture',link:'https://example.com/qa',slots:['ad:city-frontage:80:25'],startAt:Date.now()-1000,endAt:Date.now()+3600000,imageDataUrl:canvas.toDataURL('image/png')}]};
window.qa=renderOutside(document.querySelector('#map'),{atlas:ABUJA_ATLAS,venues:VENUES,profile:{district:'central-area'}});
</script></body></html>'''
async def main():
 ART.mkdir(parents=True,exist_ok=True);report=[]
 with tempfile.TemporaryDirectory(prefix='abuja-ad-qa-') as data,(ART/'server.log').open('w') as log:
  server=subprocess.Popen(['node','scripts/dev.mjs'],cwd=REPO,env={**os.environ,'PORT':str(PORT),'ABUJALIFE_DATA_DIR':data},stdout=log,stderr=subprocess.STDOUT)
  try:
   for _ in range(100):
    try:
     with urllib.request.urlopen(BASE+'/api/health',timeout=1):break
    except Exception:await asyncio.sleep(.1)
   async with async_playwright() as pw:
    for engine in os.getenv('ABUJALIFE_AD_ENGINES','webkit,chromium').split(','):
     browser=await getattr(pw,engine).launch(headless=True)
     try:
      for label,w,h in ([('desktop',1440,900)] if os.getenv('ABUJALIFE_AD_DESKTOP_ONLY')=='1' else [('iphone',390,844),('desktop',1440,900)]):
       page=await browser.new_page(viewport={'width':w,'height':h},has_touch=w<800);await page.bring_to_front();errors=[]
       page.on('pageerror',lambda e:errors.append(str(e)))
       await page.route('**/qa-map-fixture*',lambda route:route.fulfill(status=200,content_type='text/html',body=HTML))
       for ratio in ['900x900','600x900','900x600','900x225']:
        await page.goto(BASE+'/qa-map-fixture?ratio='+ratio,wait_until='domcontentloaded');await page.wait_for_function('()=>window.qa')
        await page.get_by_role('searchbox').fill('Ad plot 036');await page.locator('[data-outside-destination]').click();await page.locator('[data-outside-action="close"]').click();await page.wait_for_timeout(1300)
        d=await page.evaluate('()=>({camera:qa.getCameraState(),ads:qa.getAdDiagnostics(),scroll:document.documentElement.scrollWidth,w:innerWidth})');assert d['ads']['visibleDisplays']==1 and d['ads']['cachedTextures']==1,d;assert d['scroll']<=w,d
        await page.screenshot(path=str(ART/f'{engine}-{label}-{ratio}.png'),animations='disabled',timeout=30000)
        # The creative is centered by the real camera. A deliberate canvas tap
        # opens campaign information; a drag across it must not select an ad.
        await page.mouse.move(w/2,h/2);await page.mouse.down();await page.mouse.move(w/2+50,h/2+10,steps=8);await page.mouse.up();await expect(page.locator('.outside-selection')).to_be_hidden()
        await page.get_by_role('searchbox').fill('Ad plot 036');await page.locator('[data-outside-destination]').click();await page.locator('[data-outside-action="close"]').click();await page.wait_for_timeout(1000)
        await page.mouse.click(w/2,h/2);await expect(page.locator('.outside-sponsored-link')).to_be_visible();assert await page.locator('.outside-sponsored-link').get_attribute('href')=='https://example.com/qa'
        await page.locator('[data-outside-action="close"]').click()
        for _ in range(4):await page.locator('[data-outside-action="out"]').click()
        await page.wait_for_timeout(1000);assert (await page.evaluate('qa.getAdDiagnostics()'))['visibleDisplays']==1
        report.append({'engine':engine,'viewport':label,'ratio':ratio,'renderer':d,'tapAndDrag':True});print(json.dumps(report[-1]),flush=True)
       assert not errors,errors;await page.close()
     finally:await browser.close()
  finally:server.terminate();server.wait(timeout=10);(ART/'report.json').write_text(json.dumps(report,indent=2))
if __name__=='__main__':asyncio.run(main())

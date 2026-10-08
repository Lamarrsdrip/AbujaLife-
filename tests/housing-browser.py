"""Native UI acceptance against a real local production/Mongo fixture.

ABUJALIFE_HOUSING_URL=https://localhost:8801
ABUJALIFE_HOUSING_CLOCK=/private/tmp/abuja-housing-browser-clock.json
Only the private fixture's server time is accelerated; wallets and actions always
use the actual API, transactions, ledger and browser controls. Never run on live.
"""
import asyncio
import json
import os
from pathlib import Path
import secrets
import time
import traceback
from urllib.parse import urlparse
META_PATH=Path(os.environ.get('ABUJALIFE_HOUSING_FIXTURE_METADATA','/private/tmp/abuja-ad-booking-fixture-metadata.json'))
CONTROL_KEY=json.loads(META_PATH.read_text())['controlKey'] if META_PATH.is_file() else ''
from playwright.async_api import async_playwright, expect

URL=os.environ.get('ABUJALIFE_HOUSING_URL','https://localhost:8801')
CLOCK=Path(os.environ.get('ABUJALIFE_HOUSING_CLOCK','/private/tmp/abuja-housing-browser-clock.json'))
OUT=Path(os.environ.get('ABUJALIFE_HOUSING_REPORT','/private/tmp/abuja-housing-browser-qa'))
DAY=86400000
report={'scope':'Actual production HTTP/Mongo stores; native browser UI. Local server clock only is accelerated. No wallet grants, fake API responses or production state.', 'checks':[], 'engines':{}}

async def read(page,route='/api/entry'):
    result=await page.evaluate("""async route=>{const r=await fetch(route,{credentials:'include'});return {status:r.status,data:await r.json()};}""",route)
    assert result['status']==200,result
    return result['data']

async def truth(page):return (await read(page))['profile']
def check(label,value,**evidence):
    assert value,{'check':label,**evidence}
    report['checks'].append({'check':label,'passed':True,**evidence})
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'report.json').write_text(json.dumps(report,indent=2));print(label,flush=True)

async def close_panel(page):
    welcome=page.locator('[data-welcome-continue]:visible')
    if await welcome.count():await welcome.click()
    for selector in ['[data-ph-action="close"]:visible','.sheet [data-close]:visible']:
        buttons=page.locator(selector)
        if await buttons.count():await buttons.first.click()

async def bills(page):
    await close_panel(page)
    await page.locator('[data-nav-life]').click()
    await page.locator('[data-life="housing"]').click()
    await expect(page.locator('.sheet #sheet-title')).to_be_visible()

async def signup(page,origin,label):
    username=f'house_{origin}_{secrets.token_hex(4)}';password=secrets.token_urlsafe(24)
    await page.goto(URL,wait_until='domcontentloaded')
    await page.locator('#auth-form [name="displayName"]').fill(f'Housing QA {label}')
    await page.locator('#auth-form [name="username"]').fill(username)
    await page.locator('#auth-form [name="password"]').fill(password)
    await page.locator(f'#auth-form [name="originId"][value="{origin}"]').check()
    await page.locator('#auth-form [type="submit"]').click()
    for index in range(5):
        await expect(page.locator('#onboarding-form')).to_be_visible()
        if index==0:await page.locator('[name="presentation"][value="masculine"]').check()
        await page.locator('#onboarding-form [type="submit"]').click()
    await expect(page.locator('#world-scene')).to_be_visible(timeout=30000)
    p=await truth(page);expected=10_000_000 if origin=='lapo' else 100_000_000
    check(f'{label}: native {origin} signup and five-step onboarding',p['wallet']==expected and p['origin']['id']==origin,balance=p['wallet'],tenure=p['home']['tenure'])
    return {'username':username,'password':password,'id':p['id']}

async def rent_home(page,property_id='lugbe-flat',tenure='rent'):
    await close_panel(page);await page.locator('[data-nav-life]').click();await page.locator('[data-life="houses"]').click()
    await page.locator(f'[data-property="{property_id}"]').click()
    await expect(page.locator('#house-tour')).to_be_visible()
    consent=page.locator('[data-move-debt-consent]')
    if await consent.count():await consent.check()
    await page.locator(f'[data-move="{tenure}"]').click()
    await expect(page.locator('.sheet')).to_have_count(0,timeout=30000)
    p=await truth(page);assert p['home']['propertyId']==property_id,p['home'];return p

async def reload(page,account=None):
    await page.reload(wait_until='domcontentloaded');await page.wait_for_function("()=>document.querySelector('#world-scene')||document.querySelector('#auth-form')",timeout=30000)
    if await page.locator('#auth-form').count():
        assert account,'the resident session expired; a login is required to continue this acceptance test'
        await page.locator('[data-mode="login"]').click()
        await page.locator('#auth-form [name="username"]').fill(account['username'])
        await page.locator('#auth-form [name="password"]').fill(account['password'])
        await page.locator('#auth-form [type="submit"]').click()
        await expect(page.locator('#world-scene')).to_be_visible(timeout=30000)
    else:await expect(page.locator('#world-scene')).to_be_visible(timeout=30000)
    welcome=page.locator('[data-welcome-continue]:visible')
    if await welcome.count():await welcome.click()

async def advance_to(page,timestamp):
    current=(await read(page))['serverTime'];delta=max(0,int(timestamp-current))
    while delta>0:
        step=min(delta,10*DAY)
        response=await page.request.post(URL+'/__fixture/advance',headers={'x-fixture-key':CONTROL_KEY},data={'ms':step})
        assert response.ok,await response.text()
        delta-=step

async def pay(page):
    await bills(page);await page.locator('[data-housing-pay]').click();button=page.locator('[data-housing-confirm]');await expect(button).to_be_enabled();await button.click()
    # The confirmation sheet itself has no [data-housing-pay] control, so that
    # selector can disappear before the request is sent. Wait for the reviewed
    # confirmation to be replaced by the post-action housing sheet, then read
    # the authoritative API state (never just the optimistic UI).
    await expect(page.locator('[data-housing-confirm]')).to_have_count(0,timeout=30000)
    result=await truth(page)
    for _ in range(40):
        if result['home'].get('tenancy',{}).get('outstanding')==0:break
        await asyncio.sleep(.25);result=await truth(page)
    return result

async def play(engine,browser):
    context=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2,ignore_https_errors=True)
    nepo_context=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2,ignore_https_errors=True)
    page=await context.new_page();nepo=await nepo_context.new_page();errors=[];warnings=[];requests=[]
    for name,target in [('lapo',page),('nepo',nepo)]:
        target.on('pageerror',lambda error,n=name:errors.append({'user':n,'error':str(error)}))
        target.on('console',lambda msg,n=name:warnings.append({'user':n,'type':msg.type,'text':msg.text}) if msg.type in ['error','warning'] else None)
        target.on('requestfailed',lambda request,n=name:requests.append({'user':n,'url':request.url,'failure':request.failure}))
    report['engines'][engine]={'pageErrors':errors,'consoleWarningsAndErrors':warnings,'failedRequests':requests}
    lapo_account=await signup(page,'lapo',engine+' Lapo');nepo_account=await signup(nepo,'nepo',engine+' Nepo')
    private=OUT/f'{engine}-own-credentials.json';private.write_text(json.dumps([lapo_account,nepo_account]));private.chmod(0o600)
    request=await page.evaluate("async id=>{const r=await fetch('/api/friends/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({residentId:id})});return {status:r.status,data:await r.json()}}",nepo_account['id'])
    assert request['status'] in [200,201],request
    incoming=await read(nepo,'/api/bootstrap');request_id=next(item['id'] for item in incoming['friendRequests'] if item['from']==lapo_account['id'])
    response=await nepo.evaluate("async id=>{const r=await fetch('/api/friends/respond',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:id,accept:true})});return {status:r.status,data:await r.json()}}",request_id)
    assert response['status']==200,response
    assert any(person['id']==nepo_account['id'] for person in (await read(page,'/api/bootstrap'))['friends'])
    await bills(nepo);check(engine+': gifted home truth has no weekly rent',await nepo.locator('[data-housing-pay]').count()==0 and 'Gifted and owned' in await nepo.locator('.sheet').inner_text());await close_panel(nepo)
    p=await rent_home(page);t=p['home']['tenancy'];start=p['wallet'];check(engine+': rental charges one first week and a real deposit',start==10_000_000-360_000 and t['weeklyRent']==180_000 and t['outstanding']==0 and t['deposit']==180_000,home=p['home'],balance=start)
    await reload(page,lapo_account);check(engine+': refresh keeps the same tenancy and wallet',(await truth(page))['home']['tenancy']['id']==t['id'] and (await truth(page))['wallet']==start)
    await bills(page);await page.screenshot(path=str(OUT/f'{engine}-rent-current-mobile.png'))
    await advance_to(page,t['nextRentDueAt']+1000);await reload(page,lapo_account);due=await truth(page);check(engine+': elapsed server week accrues rent without silent debit',due['home']['tenancy']['outstanding']==180_000 and due['wallet']==start,status=due['home']['tenancy']['status'])
    paid=await pay(page);check(engine+': native reviewed rent payment clears arrears once',paid['wallet']==start-180_000 and paid['home']['tenancy']['outstanding']==0,wallet=paid['wallet'],expectedWallet=start-180_000,outstanding=paid['home']['tenancy']['outstanding'])
    wallet=await read(page,'/api/wallet');check(engine+': rent payment has an actual transaction record',len([row for row in wallet['transactions'] if row.get('type')=='RENT_PAYMENT'])==1)
    await close_panel(page);await advance_to(page,paid['home']['tenancy']['nextRentDueAt']+1000);await reload(page,lapo_account);await bills(page);await page.locator('[data-housing-action="talk-landlord"]').click();await expect(page.locator('[data-housing-action="ask-rent-time"]')).to_be_visible()
    await page.evaluate("""()=>{window.__housingUiDiag={profiles:[],stories:[]};addEventListener('abujalife:profile',e=>window.__housingUiDiag.profiles.push({id:e.detail?.profile?.id,kind:e.detail?.profile?.home?.tenancy?.story?.kind}));new MutationObserver(()=>{const story=document.querySelector('.housing-story');if(story)window.__housingUiDiag.stories.push(story.innerText)}).observe(document.querySelector('#sheet-root'),{subtree:true,childList:true,characterData:true})}""")
    async with page.expect_response(lambda r:r.url.endswith('/api/action') and json.loads(r.request.post_data or '{}').get('action')=='ask-rent-time') as pending:
        await page.locator('[data-housing-action="ask-rent-time"]').click()
    response=await pending.value;action_result=await response.json();assert response.ok,{'status':response.status,'result':action_result}
    grace=action_result['profile'];check(engine+': landlord grace is saved by the server',grace['home']['tenancy']['graceUntil']>grace['home']['tenancy']['firstMissedAt'],graceUntil=grace['home']['tenancy']['graceUntil'])
    refreshed=await truth(page);check(engine+': fresh entry returns the saved landlord story',refreshed['home']['tenancy']['story']['kind']=='grace' and refreshed['home']['tenancy']['graceUntil']==grace['home']['tenancy']['graceUntil'],story=refreshed['home']['tenancy']['story']['kind'])
    await page.wait_for_timeout(500);panel_text=await page.locator('.housing-story').inner_text();ui_diag=await page.evaluate('window.__housingUiDiag')
    expected_story=f"{grace['home']['tenancy']['story']['title']} {grace['home']['tenancy']['story']['text']}"
    check(engine+': action response updates the mounted housing panel',' '.join(panel_text.split())==' '.join(expected_story.split()),actual=panel_text,expected=expected_story,profileId=grace['id'],events=ui_diag['profiles'],storyChanges=ui_diag['stories'][-6:])
    if os.environ.get('ABUJALIFE_HOUSING_STOP_AFTER_GRACE')=='1':
        check(engine+': action response and mounted housing panel agree',await page.locator('.housing-story').inner_text()==f"{grace['home']['tenancy']['story']['title']}{grace['home']['tenancy']['story']['text']}")
        await context.close();await nepo_context.close();return
    # A real transfer to the other own QA resident creates the insufficient-funds
    # situation. The fixture never edits a wallet or grants unearned money.
    await close_panel(page);await page.locator('[data-phone="wallet"]').click();await page.locator('[data-ph-action="wallet-send"]').click();await expect(page.locator(f'[data-ph-action="wallet-recipient"][data-id="{nepo_account["id"]}"]')).to_be_visible(timeout=15000);await page.locator(f'[data-ph-action="wallet-recipient"][data-id="{nepo_account["id"]}"]').click();balance=(await truth(page))['wallet'];await page.locator('[name="transferAmount"]').fill(str(balance-1000));await page.locator('[data-ph-form="wallet-transfer"] [type="submit"]').click();await page.locator('[data-ph-action="wallet-confirm"]').click();await expect(page.locator('[data-ph-action="wallet-confirm"]')).to_have_count(0,timeout=30000);check(engine+': genuine transfer makes a broke resident',(await truth(page))['wallet']==1000)
    await close_panel(page);await bills(page);await page.locator('[data-housing-pay]').click();check(engine+': unaffordable rent cannot be charged',await page.locator('[data-housing-confirm]').is_disabled());await close_panel(page)
    first=grace['home']['tenancy']['firstMissedAt']
    for delta,status in [(7*DAY+1000,'warning'),(14*DAY+1000,'serious'),(21*DAY+1000,'final')]:
        await advance_to(page,first+delta);await reload(page,lapo_account);current=await truth(page);check(engine+': fair arrears stage '+status,current['home']['tenancy']['status']==status,outstanding=current['home']['tenancy']['outstanding']);await bills(page);await page.screenshot(path=str(OUT/f'{engine}-rent-{status}-mobile.png'));await close_panel(page)
    final=(await truth(page))['home']['tenancy'];await advance_to(page,final['finalNoticeAt']+7*DAY+1000);await reload(page,lapo_account);evicted=await truth(page);check(engine+': final notice leads to a valid temporary home',evicted['home']['tenure']=='temporary' and evicted['home']['propertyId']=='garki-studio' and evicted['home']['housingDebts'][0]['outstanding']>0,home=evicted['home'],balance=evicted['wallet'])
    await bills(page);await page.screenshot(path=str(OUT/f'{engine}-packing-out-mobile.png'));await close_panel(page)
    await reload(nepo,nepo_account);np=await truth(nepo);check(engine+': another user’s gifted owned home never accrued rent','tenancy' not in np['home'] and np['home']['tenure']=='own' and np['wallet']==100_000_000+balance-1000)
    await page.locator('[data-nav-life]').click();await page.locator('[data-life="loans"]').click();await page.locator('#borrow-loan-form [name="amount"]').fill('500000');await page.locator('#borrow-loan-form [type="submit"]').click();await page.locator('[data-loan-consent]').check();await page.locator('[data-loan-confirm]').click();await expect(page.locator('[data-loan-confirm]')).to_have_count(0,timeout=30000);borrowed=await truth(page);loan_state=await read(page,'/api/wallet');check(engine+': explicit reviewed loan gives a real path to rebuild',borrowed['wallet']==501000 and loan_state['loans'][0]['outstanding']==525000)
    moved=await rent_home(page,'mpape-self-contained');check(engine+': cheaper home starts a new clean weekly tenancy while old debt remains',moved['home']['tenancy']['weeklyRent']==120000 and moved['home']['tenancy']['outstanding']==0 and moved['home']['housingDebts'][0]['outstanding']>0 and moved['wallet']==261000)
    await bills(page);await page.screenshot(path=str(OUT/f'{engine}-fresh-start-mobile.png'));await close_panel(page)
    await page.set_viewport_size({'width':1440,'height':900});await bills(page);await page.screenshot(path=str(OUT/f'{engine}-housing-desktop.png'));check(engine+': desktop housing has no horizontal overflow',await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    await close_panel(page);await page.locator('[data-nav-life]').click();await page.locator('[data-life="profile"]').click();await page.locator('[data-logout]').click();await page.locator('[data-mode="login"]').click();await page.locator('#auth-form [name="username"]').fill(lapo_account['username']);await page.locator('#auth-form [name="password"]').fill(lapo_account['password']);await page.locator('#auth-form [type="submit"]').click();await expect(page.locator('#world-scene')).to_be_visible(timeout=30000);restored=await truth(page);restored_wallet=await read(page,'/api/wallet');check(engine+': logout and real login preserve the new home, loan and housing debt',restored['wallet']==moved['wallet'] and restored['home']['tenancy']['id']==moved['home']['tenancy']['id'] and restored_wallet['loans'][0]['id']==loan_state['loans'][0]['id'])
    await context.close();await nepo_context.close()

async def main():
    if urlparse(URL).hostname not in ['localhost','127.0.0.1'] or not CONTROL_KEY:raise SystemExit('A private LOCAL production/Mongo fixture is required; live origins are forbidden.')
    OUT.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as playwright:
        for engine in os.environ.get('ABUJALIFE_HOUSING_ENGINES','chromium,webkit').split(','):
            browser=await getattr(playwright,engine).launch(headless=engine!='chromium',args=['--use-angle=metal'] if engine=='chromium' else [])
            try:await play(engine,browser)
            except Exception as error:report['failure']={'engine':engine,'error':str(error),'traceback':traceback.format_exc()};raise
            finally:await browser.close();(OUT/'report.json').write_text(json.dumps(report,indent=2))
if __name__=='__main__':asyncio.run(main())

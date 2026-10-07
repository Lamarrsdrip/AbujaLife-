#!/usr/bin/env python3
"""Connected handset/voice acceptance using real UI, MediaRecorder and storage.

Run after other browser suites: python tests/phone-voice-browser.py
Uses the V4 disposable same-origin server and actual registration/onboarding.
Chromium captures a generated WAV through its native fake audio input device;
MediaRecorder, media uploads, messages, playback, cookies and realtime are real.
There are no mocked endpoints, account grants, DOM state edits or recorder shims.
Evidence and persistent fixture media are retained under /tmp by default.
"""
import asyncio
import datetime
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import struct
import sys
import time
import uuid
import wave

from playwright.async_api import async_playwright, expect

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parents[1]
RUN = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:6]
ART = Path(os.environ.get('ABUJALIFE_PHONE_VOICE_ARTIFACTS', '/tmp/abujalife-phone-voice')) / RUN
spec = importlib.util.spec_from_file_location('v4_acceptance', REPO/'tests/v4-browser-smoke.py')
v4 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v4)
v4.ART = ART
game = v4.game
SIZES = [(320,568), (360,800), (375,812), (390,844), (430,932), (1280,900)]


class PhoneEvidence(v4.Evidence):
    def watch(self,page,label):
        self.pages.append(page)
        page.set_default_timeout(30000)
        page.on('pageerror',lambda error:self.errors.append({'page':label,'error':str(error)}))
        starts = {}
        def request(req):
            starts[id(req)] = time.monotonic()
            if '/api/' not in req.url or req.method=='GET':return
            if '/media?' in req.url:
                raw = req.post_data_buffer or b''
                body = {'nativeMediaBytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                        'mime':req.headers.get('content-type')}
            else:
                try:body = req.post_data_json or {}
                except Exception:body = {'unparsedBody':True}
                if 'password' in body:body = {**body,'password':'[redacted fixture]'}
            self.requests.append({'page':label,'path':req.url.split('/api/',1)[1],'body':body})
        async def response(res):
            if '/api/' not in res.url or res.request.method=='GET':return
            try:
                body = await res.json()
                self.responses.append({'page':label,'path':res.url.split('/api/',1)[1],'status':res.status,
                                       'error':body.get('error'),'code':body.get('code'),
                                       'seconds':round(time.monotonic()-starts.get(id(res.request),time.monotonic()),3)})
            except Exception:pass
        page.on('request',request)
        page.on('response',response)


def audio_input(path):
    """A deterministic, non-silent microphone signal, with a native WAV header."""
    rate = 48000
    samples = bytearray()
    for index in range(rate):
        t = index/rate
        envelope = .12*(.7+.3*math.sin(2*math.pi*3*t))
        sample = envelope*(math.sin(2*math.pi*220*t)+.35*math.sin(2*math.pi*440*t))
        samples.extend(struct.pack('<h', round(sample*32767)))
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        for _ in range(60):
            wav.writeframes(samples)
    return {'path':str(path), 'seconds':60, 'rate':rate,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


async def read_messages(page, conversation_id):
    return await page.evaluate('''async id=>{
      const response=await fetch(`/api/conversations/${encodeURIComponent(id)}/messages`,{credentials:'include',cache:'no-store'});
      if(!response.ok)throw new Error(`Read messages: ${response.status}`);
      return (await response.json()).messages;
    }''', conversation_id)


async def login(page, url, username):
    await page.goto(url, wait_until='domcontentloaded')
    await expect(page.locator('#auth-form')).to_be_visible(timeout=60000)
    if await page.locator('.auth-switch [data-mode="login"]').count():
        await page.locator('.auth-switch [data-mode="login"]').click()
    await page.locator('#auth-form [name="username"]').fill(username)
    await page.locator('#auth-form [name="password"]').fill(v4.PASSWORD)
    await page.locator('#auth-form [type="submit"]').click()
    await expect(page.locator('#auth-form')).to_have_count(0, timeout=60000)
    await v4.webgl(page)


async def open_thread(page, conversation_id):
    await game.open_phone(page, 'messages')
    thread = page.locator(f'[data-ph-action="thread"][data-id="{conversation_id}"]')
    await expect(thread).to_be_visible(timeout=45000)
    await thread.click()
    await expect(page.locator('#ph-message')).to_be_enabled()
    await expect(page.locator('[data-pro-mic]')).to_be_visible()


async def start_conversation(owner, recipient):
    await game.open_phone(owner, 'messages')
    await owner.locator('[data-ph-action="compose"]').click()
    await owner.locator('#ph-search').fill(recipient['username'])
    row = owner.locator(f'[data-ph-action="dm"][data-id="{recipient["id"]}"]')
    await expect(row).to_be_visible(timeout=45000)
    async with owner.expect_response(lambda response: response.request.method=='POST'
                                     and response.url.endswith('/api/conversations')) as response:
        await row.click()
    result = await (await response.value).json()
    assert result.get('conversation', {}).get('id'), result
    await expect(owner.locator('#ph-message')).to_be_enabled()
    return result['conversation']['id']


async def world_reference(page):
    await game.close_phone(page)
    await game.navigate(page, 'world')
    await v4.webgl(page)
    canvas = await page.locator('#world-scene canvas.world-character-layer').element_handle()
    assert canvas is not None
    return canvas, await game.motion(page)


async def same_world(page, reference):
    canvas, before = reference
    assert await canvas.evaluate('''node=>node.isConnected &&
      document.querySelector('#world-scene canvas.world-character-layer')===node'''), 'Phone navigation replaced the world canvas'
    after = await game.motion(page)
    assert game.distance(before, after)<.2, {'before':before, 'after':after}
    assert before['kind']==after['kind'] and before['driving']==after['driving']


async def handset(page):
    await expect(page.locator('.ph-device')).to_be_visible()
    await game.no_overflow(page)
    value = await page.evaluate('''()=>{
      const device=document.querySelector('.ph-device'),screen=device.querySelector('.ph-screen');
      const d=device.getBoundingClientRect(),s=screen.getBoundingClientRect(),style=getComputedStyle(device),ss=getComputedStyle(screen);
      return {device:d.toJSON(),screen:s.toJSON(),radius:parseFloat(style.borderTopLeftRadius),
        shadow:style.boxShadow,screenOverflow:ss.overflow,status:!!screen.querySelector('.ph-statusbar'),
        island:!!screen.querySelector('.ph-island'),indicator:!!screen.querySelector('.ph-home-indicator'),
        hardware:device.querySelectorAll('.ph-hardware').length};
    }''')
    d, s = value['device'], value['screen']
    assert s['left']>=d['left']+2 and s['right']<=d['right']-2, value
    assert s['top']>=d['top'] and s['bottom']<=d['bottom'], value
    assert value['radius']>=12 and value['shadow']!='none', value
    assert value['screenOverflow']=='hidden' and value['status'] and value['island'] and value['indicator'], value
    assert value['hardware']>=2, value
    return value


async def put_away(page, reference):
    # Use the real caption control whose backdrop hitbox previously regressed.
    await page.locator('.ph-device-caption [data-ph-action="close"]').click()
    await expect(page.locator('#phone-root')).to_be_hidden()
    await same_world(page, reference)


async def playback(page, container, button_selector):
    audio = container.locator('audio')
    button = container.locator(button_selector)
    await button.click()
    await expect(button).to_have_attribute('aria-label', 'Pause voice note')
    await page.wait_for_function('''selector=>{
      const audio=document.querySelector(selector);return audio&&!audio.paused&&audio.currentTime>0&&!audio.error;
    }''', arg=await audio.evaluate('a=>a.closest(".pro-voice-draft")?".pro-voice-draft audio":`.ph-message[data-message-id="${a.closest("[data-message-id]").dataset.messageId}"] audio`'))
    await button.click()
    assert await audio.evaluate('a=>a.paused&&!a.error')
    return await audio.evaluate('a=>({currentTime:a.currentTime,duration:Number.isFinite(a.duration)?a.duration:null,readyState:a.readyState,error:a.error?.code||null})')


async def record(page, cancelled=False):
    await page.locator('[data-pro-mic]').click()
    await expect(page.locator('.pro-recording')).to_be_visible()
    await page.wait_for_timeout(1100 if cancelled else 3200)
    await page.locator('[data-pro-record-cancel]' if cancelled else '[data-pro-record-done]').click()
    await expect(page.locator('.pro-recording')).to_have_count(0)
    if cancelled:
        await expect(page.locator('.pro-voice-draft')).to_have_count(0)
    else:
        await expect(page.locator('.pro-voice-draft')).to_contain_text('Voice note ready')


async def media_bytes(page, url):
    return await page.evaluate('''async url=>{
      const response=await fetch(url,{credentials:'include',cache:'no-store'});
      const bytes=await response.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);
      return {status:response.status,mime:response.headers.get('content-type'),size:bytes.byteLength,
        sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};
    }''', url)


async def voice_flow(owner, guest, conversation_id, size, qa):
    width, height = size
    await owner.set_viewport_size({'width':width, 'height':height})
    await guest.set_viewport_size({'width':width, 'height':height})
    reference = await world_reference(owner)
    await open_thread(owner, conversation_id)
    frame = await handset(owner)
    await same_world(owner, reference)
    text = f'Real handset text at {width}x{height}'
    await owner.locator('#ph-message').fill(text)
    await owner.locator('.ph-composer .ph-send').click()
    await expect(owner.locator('.ph-message.mine').filter(has_text=text)).to_have_count(1)
    await open_thread(guest, conversation_id)
    await expect(guest.locator('.ph-message').filter(has_text=text)).to_have_count(1)
    baseline = await read_messages(owner, conversation_id)
    owner_id = (await game.state(owner))['profile']['id']
    sent_text = [message for message in baseline if message.get('text')==text]
    assert len(sent_text)==1 and sent_text[0]['senderId']==owner_id, sent_text
    native = await owner.evaluate('''()=>({recorder:String(MediaRecorder).includes('[native code]'),
      secure:isSecureContext,getUserMedia:typeof navigator.mediaDevices?.getUserMedia==='function'})''')
    assert all(native.values()), native
    await record(owner, cancelled=True)
    assert len(await read_messages(owner, conversation_id))==len(baseline)
    await record(owner)
    preview = await playback(owner, owner.locator('.pro-voice-draft'), '[data-pro-draft-play]')
    await owner.locator('[data-pro-voice-discard]').click()
    await expect(owner.locator('.pro-voice-draft')).to_have_count(0)
    assert len(await read_messages(owner, conversation_id))==len(baseline)
    await record(owner)
    requests_before = len([request for request in qa.requests if '/media?' in request['path']])
    async with owner.expect_response(lambda response: '/api/chat-pro/conversations/' in response.url
                                     and '/media?' in response.url and response.request.method=='POST', timeout=60000) as response:
        # Native double-clicks exercise the disabled/in-flight send guard.
        await owner.locator('[data-pro-voice-send]').click(click_count=2, delay=90)
    upload = await response.value
    result = await upload.json()
    assert upload.status==201 and result.get('ok'), result
    message = result.get('message')
    assert message and message['kind']=='voice' and message.get('media') and message['senderId']==owner_id, result
    message_id, media = message['id'], message['media']
    assert media['size']>0 and 2500<=media['durationMs']<=120000, media
    await expect(owner.locator('.pro-voice-draft')).to_have_count(0)
    await expect(owner.locator(f'.ph-message.mine[data-message-id="{message_id}"] .pro-voice-player')).to_be_visible()
    saved = await read_messages(owner, conversation_id)
    new_voice = [message for message in saved if message.get('kind')=='voice' and message['id'] not in {m['id'] for m in baseline}]
    assert len(new_voice)==1 and new_voice[0]['id']==message_id, new_voice
    assert len([request for request in qa.requests if '/media?' in request['path']])==requests_before+1
    received = guest.locator(f'.ph-message[data-message-id="{message_id}"] .pro-voice-player')
    await expect(received).to_be_visible(timeout=45000)
    recipient_audio = await playback(guest, received, '[data-pro-voice-play]')
    stored = await media_bytes(guest, media['url'])
    assert stored['status']==200 and stored['size']==media['size'] and stored['mime'].split(';')[0]==media['mime'], stored
    await qa.screenshot(owner, f'handset-voice-{width}x{height}')
    await same_world(owner, reference)
    await owner.locator('.ph-app-header [data-ph-action="back"]').click()
    await expect(owner.locator('.ph-inbox-title h2')).to_have_text('Messages')
    await owner.locator('.ph-home-indicator').click()
    await expect(owner.locator('.ph-home-pages')).to_be_visible()
    await same_world(owner, reference)
    await put_away(owner, reference)
    # Explicit reload intentionally creates a new world; messages/media must persist.
    await v4.reload(guest)
    await open_thread(guest, conversation_id)
    persisted = guest.locator(f'.ph-message[data-message-id="{message_id}"] .pro-voice-player')
    await expect(persisted).to_be_visible()
    await playback(guest, persisted, '[data-pro-voice-play]')
    assert await media_bytes(guest, media['url'])==stored
    await game.close_phone(guest)
    return {'viewport':size,'handset':frame,'nativeRecorder':native,'text':text,'messageId':message_id,
            'media':media,'storedBytes':stored,'preview':preview,'recipientPlayback':recipient_audio,
            'cancelAndDiscardUnsent':True,'doubleClickSingleUpload':True,'worldCanvasPreserved':True,'reloadPlayable':True}


async def main():
    ART.mkdir(parents=True, exist_ok=True)
    signal = audio_input(ART/'native-microphone-input.wav')
    # Configure only this disposable subprocess, retaining actual local media for evidence.
    env_before = {key:os.environ.get(key) for key in ('CHAT_MEDIA_DIR','CHAT_MEDIA_S3_ENDPOINT')}
    os.environ['CHAT_MEDIA_DIR'] = str(ART/'persistent-media')
    os.environ.pop('CHAT_MEDIA_S3_ENDPOINT', None)
    qa = PhoneEvidence()
    fixture = v4.Fixture('2026-10-17T21:00:00Z')
    qa.fixture = fixture
    for key, value in env_before.items():
        if value is None:os.environ.pop(key, None)
        else:os.environ[key] = value
    print('ARTIFACTS='+str(ART), flush=True)
    try:
        async with async_playwright() as pw:
            executable = os.environ.get('CHROMIUM_PATH') or (str(Path('/usr/bin/chromium')) if Path('/usr/bin/chromium').exists() else pw.chromium.executable_path)
            gpu_args = [] if sys.platform=='darwin' else ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
            browser = await pw.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox',
                '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
                '--use-file-for-fake-audio-capture='+str(ART/'native-microphone-input.wav'),*gpu_args])
            users = [('Voice Sender','voice_sender'),('Voice Recipient','voice_recipient')]
            contexts = [await browser.new_context(viewport={'width':390,'height':844}, is_mobile=True,
                        has_touch=True, permissions=['microphone'], service_workers='block') for _ in users]
            owner, guest = [await context.new_page() for context in contexts]
            qa.watch(owner,'sender-mobile');qa.watch(guest,'recipient-mobile')
            accounts = []
            conversation_id = None
            async def setup():
                nonlocal conversation_id
                for page, (name, username) in zip((owner,guest),users):
                    account = await v4.register(page, fixture.url, name, username, qa)
                    accounts.append({**account,'username':username})
                conversation_id = await start_conversation(owner, accounts[1])
                return {'participants':[account['id'] for account in accounts],'conversationId':conversation_id}
            if not await qa.check('two genuine registered phone participants and UI conversation',setup):
                await browser.close()
                return 1
            for size in SIZES[:-1]:
                await qa.check(f'handset native voice {size[0]}x{size[1]}',lambda size=size:voice_flow(owner,guest,conversation_id,size,qa))
            for context in contexts:await context.close()
            contexts = [await browser.new_context(viewport={'width':1280,'height':900},permissions=['microphone'],
                        service_workers='block') for _ in users]
            owner, guest = [await context.new_page() for context in contexts]
            qa.watch(owner,'sender-desktop');qa.watch(guest,'recipient-desktop')
            async def desktop():
                for page, (_, username) in zip((owner,guest),users):await login(page,fixture.url,username)
                result = await voice_flow(owner,guest,conversation_id,SIZES[-1],qa)
                await game.navigate(owner,'profile')
                await owner.locator('[data-logout]').click()
                await expect(owner.locator('#auth-form')).to_be_visible()
                await login(owner,fixture.url,users[0][1])
                await open_thread(owner,conversation_id)
                persisted = owner.locator(f'.ph-message[data-message-id="{result["messageId"]}"] .pro-voice-player')
                await expect(persisted).to_be_visible()
                await playback(owner,persisted,'[data-pro-voice-play]')
                result['logoutLoginPlayable'] = True
                return result
            await qa.check('handset native voice 1280x900 with genuine re-login',desktop)
            qa.save()
            await browser.close()
    finally:
        fixture.close()
        qa.save()
        (ART/'audio-input-evidence.json').write_text(json.dumps(signal,indent=2))
    summary = {'passed':sum(row['status']=='passed' for row in qa.results),
               'failed':sum(row['status']=='failed' for row in qa.results),'browserErrors':qa.errors,'report':str(ART/'report.json')}
    print('SUMMARY='+json.dumps(summary),flush=True)
    return int(summary['failed']>0 or bool(qa.errors) or summary['passed']!=len(SIZES)+1)


if __name__=='__main__':
    raise SystemExit(asyncio.run(main()))

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import struct

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'app'


def require_replace(path, old, new):
    text = path.read_text()
    if old not in text:
        raise RuntimeError(f'Expected source not found in {path}: {old[:100]}')
    path.write_text(text.replace(old, new, 1))


def font(size, bold=False):
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def gradient(size, start, end):
    w, h = size
    image = Image.new('RGB', size, start)
    px = image.load()
    for y in range(h):
        t = y / max(1, h - 1)
        color = tuple(round(start[i] * (1 - t) + end[i] * t) for i in range(3))
        for x in range(w):
            px[x, y] = color
    return image


def draw_gate(image, box, radius=48):
    draw = ImageDraw.Draw(image)
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    gold = '#E7C16F'
    gold_hi = '#F4D993'
    gold_lo = '#A8793E'
    deep = '#17382D'
    road = '#53695E'
    # subtle moon and horizon
    draw.ellipse((x0 + .74*w, y0 + .09*h, x0 + .86*w, y0 + .21*h), fill='#496F5E')
    draw.arc((x0 + .05*w, y0 + .62*h, x0 + .95*w, y0 + 1.08*h), 190, 350, fill='#6F917D', width=max(4, int(w*.05)))
    # pillars
    draw.rounded_rectangle((x0 + .13*w, y0 + .31*h, x0 + .31*w, y0 + .69*h), radius=max(4, int(radius*.3)), fill=gold)
    draw.rounded_rectangle((x0 + .69*w, y0 + .31*h, x0 + .87*w, y0 + .69*h), radius=max(4, int(radius*.3)), fill=gold)
    draw.rectangle((x0 + .16*w, y0 + .34*h, x0 + .25*w, y0 + .60*h), fill=gold_hi)
    draw.rectangle((x0 + .75*w, y0 + .34*h, x0 + .84*w, y0 + .60*h), fill=gold_hi)
    # arch top
    pts = [
        (x0 + .22*w, y0 + .37*h),
        (x0 + .31*w, y0 + .22*h),
        (x0 + .42*w, y0 + .15*h),
        (x0 + .50*w, y0 + .13*h),
        (x0 + .58*w, y0 + .15*h),
        (x0 + .69*w, y0 + .22*h),
        (x0 + .78*w, y0 + .37*h),
        (x0 + .70*w, y0 + .41*h),
        (x0 + .62*w, y0 + .29*h),
        (x0 + .55*w, y0 + .24*h),
        (x0 + .50*w, y0 + .23*h),
        (x0 + .45*w, y0 + .24*h),
        (x0 + .38*w, y0 + .29*h),
        (x0 + .30*w, y0 + .41*h),
    ]
    draw.polygon(pts, fill=gold)
    draw.rectangle((x0 + .25*w, y0 + .42*h, x0 + .75*w, y0 + .51*h), fill=gold_lo)
    draw.rectangle((x0 + .31*w, y0 + .445*h, x0 + .69*w, y0 + .49*h), fill=deep)
    draw.rectangle((x0 + .39*w, y0 + .51*h, x0 + .61*w, y0 + .69*h), fill=deep)
    draw.rectangle((x0 + .12*w, y0 + .66*h, x0 + .33*w, y0 + .71*h), fill=gold_lo)
    draw.rectangle((x0 + .67*w, y0 + .66*h, x0 + .88*w, y0 + .71*h), fill=gold_lo)
    # road
    road_pts = [(x0 + .40*w, y0 + .69*h), (x0 + .60*w, y0 + .69*h), (x0 + .82*w, y0 + .98*h), (x0 + .18*w, y0 + .98*h)]
    draw.polygon(road_pts, fill=road)
    center = x0 + .5*w
    draw.line((center, y0 + .73*h, center, y0 + .94*h), fill='#F4D78F', width=max(3, int(w*.018)))


def make_icon(size, out_path):
    scale = 3
    canvas = gradient((size*scale, size*scale), (40, 91, 70), (16, 42, 34))
    d = ImageDraw.Draw(canvas)
    pad = int(size*scale*.045)
    d.rounded_rectangle((pad, pad, size*scale-pad, size*scale-pad), radius=int(size*scale*.19), outline='#315F4D', width=max(2, int(size*scale*.01)))
    draw_gate(canvas, (int(.05*size*scale), int(.045*size*scale), int(.95*size*scale), int(.96*size*scale)), radius=int(size*scale*.09))
    canvas.resize((size, size), Image.Resampling.LANCZOS).save(out_path, optimize=True)


def make_social(out_path):
    W, H = 1200, 630
    image = Image.new('RGB', (W, H), '#F6F4EE')
    draw = ImageDraw.Draw(image)
    # left premium Abuja panel
    panel = gradient((430, H), (38, 88, 68), (15, 42, 33))
    image.paste(panel, (0, 0))
    draw_gate(image, (48, 78, 382, 552), radius=38)
    # brand rule
    draw.rounded_rectangle((470, 74, 536, 84), radius=5, fill='#CBA85B')
    x, y = 470, 116
    f_brand = font(70, True)
    draw.text((x, y), 'Abuja', font=f_brand, fill='#14231E')
    abuja_w = draw.textlength('Abuja', font=f_brand)
    draw.text((x + abuja_w, y), 'Life', font=f_brand, fill='#23614B')
    life_w = draw.textlength('Life', font=f_brand)
    draw.ellipse((x + abuja_w + life_w + 15, y + 16, x + abuja_w + life_w + 29, y + 30), fill='#CBA85B')
    draw.text((470, 222), 'Your city. Your story.', font=font(46, True), fill='#14231E')
    draw.text((470, 302), 'Meet people, explore, play', font=font(28), fill='#53655E')
    draw.text((470, 344), 'and build your life in Abuja.', font=font(28), fill='#53655E')
    draw.rounded_rectangle((470, 423, 774, 493), radius=35, fill='#23614B')
    cta = 'ENTER ABUJALIFE'
    ctaf = font(22, True)
    tw = draw.textlength(cta, font=ctaf)
    draw.text((470 + (304-tw)/2, 445), cta, font=ctaf, fill='white')
    draw.text((470, 530), 'abujacity.life', font=font(25, True), fill='#6A766F')
    # tiny decorative Abuja-green linework
    draw.line((1020, 76, 1128, 76), fill='#CBA85B', width=5)
    draw.line((1080, 92, 1148, 92), fill='#23614B', width=5)
    image.save(out_path, optimize=True)


# Generate correct raster branding assets from one coherent gate direction.
icons = APP / 'icons'
icons.mkdir(exist_ok=True)
make_icon(512, icons / 'icon-512.png')
make_icon(512, icons / 'icon-maskable-512.png')
make_icon(192, icons / 'icon-192.png')
make_icon(180, icons / 'apple-touch-icon.png')
make_social(APP / 'social-preview.png')

# Social crawlers must use the dedicated landscape card, never an app icon.
index = APP / 'index.html'
require_replace(index,
    '<meta property="og:image" content="https://abujacity.life/icons/icon-512.png?v=abuja-city-gate-20261005-4" />',
    '<meta property="og:image" content="https://abujacity.life/social-preview.png?v=abujalife-share-20261005-1" />\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />\n  <meta property="og:image:type" content="image/png" />\n  <meta property="og:image:alt" content="AbujaLife — Your city. Your story." />')
require_replace(index, '<meta name="twitter:card" content="summary" />', '<meta name="twitter:card" content="summary_large_image" />')
require_replace(index,
    '<meta name="twitter:image" content="https://abujacity.life/icons/icon-512.png?v=abuja-city-gate-20261005-4" />',
    '<meta name="twitter:image" content="https://abujacity.life/social-preview.png?v=abujalife-share-20261005-1" />\n  <meta name="twitter:image:alt" content="AbujaLife — Your city. Your story." />')
text = index.read_text().replace('abuja-city-gate-20261005-4', 'abujalife-gate-20261005-5')
index.write_text(text)
require_replace(index,
    '  <script type="module" src="/app.js"></script>',
    '  <script type="module">import { applyUncappedEconomyPolicy } from \'/src/shared/economy-policy.mjs\'; applyUncappedEconomyPolicy();</script>\n  <script type="module" src="/app.js"></script>\n  <script type="module" src="/auth-username-only-ui.js"></script>')

# Preserve newest auth-session PWA shell while adding this integration's modules/card.
sw = APP / 'sw.js'
require_replace(sw, "const CACHE='abujalife-responsive-auth-v18';", "const CACHE='abujalife-economy-share-v19';")
require_replace(sw, "'/auth-recovery.js','/auth-session.js',", "'/auth-recovery.js','/auth-session.js','/auth-username-only-ui.js',")
require_replace(sw, "'/manifest.webmanifest','/icon.svg',", "'/manifest.webmanifest','/icon.svg','/social-preview.png',")
require_replace(sw, "'/src/shared/life.mjs','/src/shared/vehicles.mjs',", "'/src/shared/life.mjs','/src/shared/economy-policy.mjs','/src/shared/vehicles.mjs',")

# Preserve main's newer startup integration checks; change only the authoritative 10x plant price assertion.
prod = ROOT / 'tests' / 'production-integration.mjs'
require_replace(prod, 'assert.equal(action.data.profile.wallet,before.wallet-2300);', 'assert.equal(action.data.profile.wallet,before.wallet-23000);')

# Regression: social crawlers can never silently fall back to the square app icon again.
test = ROOT / 'tests' / 'social-preview.test.mjs'
test.write_text("""import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');\nfunction pngSize(path){const data=fs.readFileSync(new URL(path,import.meta.url));assert.equal(data.toString('ascii',1,4),'PNG');return {width:data.readUInt32BE(16),height:data.readUInt32BE(20)};}\n\ntest('AbujaLife link cards use the dedicated wide branded social preview',()=>{\n  assert.match(html,/twitter:card\\\" content=\\\"summary_large_image/);\n  assert.match(html,/og:image\\\" content=\\\"https:\\/\\/abujacity\\.life\\/social-preview\\.png\\?v=/);\n  assert.match(html,/twitter:image\\\" content=\\\"https:\\/\\/abujacity\\.life\\/social-preview\\.png\\?v=/);\n  assert.doesNotMatch(html,/og:image\\\" content=\\\"[^\\\"]*icon-512\\.png/);\n  assert.deepEqual(pngSize('../app/social-preview.png'),{width:1200,height:630});\n});\n\ntest('AbujaLife installed icons are correctly sized raster gate assets',()=>{\n  assert.deepEqual(pngSize('../app/icons/icon-512.png'),{width:512,height:512});\n  assert.deepEqual(pngSize('../app/icons/icon-maskable-512.png'),{width:512,height:512});\n  assert.deepEqual(pngSize('../app/icons/icon-192.png'),{width:192,height:192});\n  assert.deepEqual(pngSize('../app/icons/apple-touch-icon.png'),{width:180,height:180});\n});\n""")

print('Finalized username-only/economy shell and regenerated AbujaLife social/icon assets.')

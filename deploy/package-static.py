#!/usr/bin/env python3
"""Build a secret-free static Hostinger ZIP with the local preview and PWA shell."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
import json
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DESTINATION = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/abujacity-local-preview.zip').resolve()

html = (ROOT / 'preview/index.html').read_text()
if html.count('</head>') != 1 or html.count('</body>') != 1:
    raise ValueError('Build the self-contained preview before packaging it.')
if 'rel="manifest"' in html.split('</head>', 1)[0] or "serviceWorker.register('/sw.js')" in html:
    raise ValueError('Raw-CDN preview must not already contain root-domain PWA registration.')
head = '''<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
'''
registration = '''<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
</script>
'''
html = html.replace('</head>', head + '</head>').replace('</body>', registration + '</body>')
files = {
    'index.html': html.encode(),
    'manifest.webmanifest': (ROOT / 'preview/manifest.webmanifest').read_bytes(),
    'sw.js': (ROOT / 'preview/sw.js').read_bytes(),
    'icon.svg': (ROOT / 'app/icon.svg').read_bytes(),
    '.htaccess': b'''# Optional Apache/LiteSpeed MIME and cache headers for the PWA shell.
<IfModule mod_mime.c>
  AddType application/manifest+json .webmanifest
  AddType application/javascript .js
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "^(index\\.html|sw\\.js|manifest\\.webmanifest)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
''',
}
for source in sorted((ROOT / 'app/icons').glob('*.png')):
    if source.is_symlink():
        raise ValueError('Release icons must be regular files.')
    files['icons/' + source.name] = source.read_bytes()

manifest = json.loads(files['manifest.webmanifest'])
for icon in manifest['icons']:
    if icon['src'].lstrip('/') not in files:
        raise ValueError('Manifest references an icon outside this release.')
if 'icons/apple-touch-icon.png' not in files:
    raise ValueError('Apple Home Screen icon is missing.')

revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
dirty = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip())
metadata = {
    'application': 'AbujaLife',
    'publicOrigin': 'https://abujacity.life',
    'mode': 'local-single-player-preview',
    'sharedAccounts': False,
    'sharedMultiplayer': False,
    'realPayments': False,
    'revision': revision,
    'workingTreeChanged': dirty,
    'createdAt': datetime.now(timezone.utc).isoformat(),
    'files': [{'path': name, 'bytes': len(data), 'sha256': sha256(data).hexdigest()} for name, data in sorted(files.items())],
}
files['RELEASE.json'] = (json.dumps(metadata, indent=2) + '\n').encode()
DESTINATION.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(DESTINATION, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name, data in sorted(files.items()):
        archive.writestr(name, data)
checksum = sha256(DESTINATION.read_bytes()).hexdigest()
Path(str(DESTINATION) + '.sha256').write_text(f'{checksum}  {DESTINATION.name}\n')
print(json.dumps({'ok': True, 'archive': str(DESTINATION), 'sha256': checksum, 'files': len(files), 'mode': metadata['mode'], 'revision': revision, 'workingTreeChanged': dirty}))

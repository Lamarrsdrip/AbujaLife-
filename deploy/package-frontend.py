#!/usr/bin/env python3
"""Package the genuine production dist frontend for Hostinger shared hosting."""
from pathlib import Path
from datetime import datetime, timezone
from hashlib import sha256
import json
import re
import subprocess
import sys
import zipfile

root=Path(__file__).resolve().parent.parent
dist=root/'dist'
destination=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/abujacity-production-frontend.zip').resolve()
required=['index.html','runtime-config.js','sw.js','manifest.webmanifest','.htaccess','admin/index.html']
if not all((dist/name).is_file() for name in required):raise ValueError('Run npm run build to produce the real production frontend first.')
files={}
for file in sorted(dist.rglob('*')):
 if file.is_symlink():raise ValueError('Frontend release must not contain symlinks.')
 if not file.is_file():continue
 name=file.relative_to(dist).as_posix()
 if re.search(r'(^|/)(\.env(?:\..*)?|\.secrets|node_modules|src|server|\.git)(/|$)|\.(?:sqlite|db|enc|log)$',name):raise ValueError('Private or server-only file found in production dist: '+name)
 files[name]=file.read_bytes()
if b'https://api.abujacity.life' not in files['runtime-config.js'] or b'https://abujacity.life' not in files['runtime-config.js']:raise ValueError('Build this release for the authorized AbujaLife production domains.')
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
dirty=bool(subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip())
metadata={'application':'AbujaLife','mode':'production-api-frontend','publicOrigin':'https://abujacity.life','apiPublicOrigin':'https://api.abujacity.life','revision':revision,'workingTreeChanged':dirty,'createdAt':datetime.now(timezone.utc).isoformat(),'files':[{'path':name,'bytes':len(data),'sha256':sha256(data).hexdigest()} for name,data in sorted(files.items())]}
files['RELEASE.json']=(json.dumps(metadata,indent=2)+'\n').encode()
destination.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as archive:
 for name,data in files.items():archive.writestr(name,data)
digest=sha256(destination.read_bytes()).hexdigest()
Path(str(destination)+'.sha256').write_text(f'{digest}  {destination.name}\n')
print(json.dumps({'ok':True,'archive':str(destination),'sha256':digest,'files':len(files),'mode':metadata['mode'],'revision':revision,'workingTreeChanged':dirty}))

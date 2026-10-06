from pathlib import Path
p=Path('app/outside-city-v4.js')
s=p.read_text()
old="row.mesh.position.z=airport.z+108+Math.sin((row.offset+t*row.speed)*.012)*13;}}},dispose()"
new="row.mesh.position.z=airport.z+108+Math.sin((row.offset+t*row.speed)*.012)*13;}},dispose()"
if old not in s: raise SystemExit('airport animation splice not found')
p.write_text(s.replace(old,new,1))
print('city world integrity hotfix applied')

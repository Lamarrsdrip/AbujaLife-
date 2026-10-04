import { ABUJA_ATLAS, AREA_COUNCILS, FCC_DISTRICTS, SATELLITE_TOWNS } from '../src/shared/atlas.mjs';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const assert = (x,m)=>{if(!x)throw new Error(m)};
assert(AREA_COUNCILS.length===6,'Expected six FCT Area Councils');
assert(FCC_DISTRICTS.length>=90,'Legacy FCC district and sector catalogue coverage shrank unexpectedly');
assert(SATELLITE_TOWNS.length>=20,'Satellite-town coverage too thin');
const ids = new Set();
for (const place of ABUJA_ATLAS) { assert(place.id && place.name && place.kind,'Invalid atlas place'); assert(!ids.has(place.id),`Duplicate place ${place.id}`); ids.add(place.id); }
console.log(`✓ Location catalogue: ${FCC_DISTRICTS.length} FCC/sector entries + ${SATELLITE_TOWNS.length} towns/communities; official geography review pending`);
for(const directory of ['app','scripts','src/server','src/shared'])for(const file of fs.readdirSync(directory)){
  if(!/\.(mjs|js)$/.test(file))continue;
  const result=spawnSync(process.execPath,['--check',`${directory}/${file}`],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}

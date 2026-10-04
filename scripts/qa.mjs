import { ABUJA_ATLAS, AREA_COUNCILS, FCC_DISTRICTS, SATELLITE_TOWNS } from '../src/shared/atlas.mjs';
const assert = (x,m)=>{if(!x)throw new Error(m)};
assert(AREA_COUNCILS.length===6,'Expected six FCT Area Councils');
assert(FCC_DISTRICTS.length>=90,'FCC atlas must model roughly the full 93-district planning system');
assert(SATELLITE_TOWNS.length>=20,'Satellite-town coverage too thin');
const ids = new Set();
for (const place of ABUJA_ATLAS) { assert(place.id && place.name && place.council,'Invalid atlas place'); assert(!ids.has(place.id),`Duplicate place ${place.id}`); ids.add(place.id); }
console.log(`✓ Abuja atlas: ${FCC_DISTRICTS.length} FCC/sector entries + ${SATELLITE_TOWNS.length} towns/communities across ${AREA_COUNCILS.length} councils`);

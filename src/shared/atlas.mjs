import { GEOGRAPHY_SOURCES, SETTLEMENT_POINTS } from './geography-sources.mjs';

export const AREA_COUNCILS = [
  ['amac','Abuja Municipal Area Council','AMAC','city'],['bwari','Bwari','Bwari','hills'],['gwagwalada','Gwagwalada','Gwagwalada','campus'],['kuje','Kuje','Kuje','green'],['kwali','Kwali','Kwali','market'],['abaji','Abaji','Abaji','heritage']
].map(([id,name,short,tone])=>({id,name,short,tone,kind:'area-council',territory:'fct',verification:'official-source-pending'}));

const phaseDefaults = {
  I:{rent:'high',commute:12}, II:{rent:'high',commute:17}, III:{rent:'medium',commute:25}, IV:{rent:'low',commute:42}, V:{rent:'low',commute:38}
};
const fcc=(id,name,phase,code,vibe='planned Abuja district')=>({id,name,council:null,territory:'fct',city:'fcc',kind:id.startsWith('sector-')?'fcc-sector':'fcc-district',phase:null,code:null,legacyAssertions:{phase,code,council:'amac'},verification:'official-source-pending',vibe,rent:phaseDefaults[phase].rent,commute:phaseDefaults[phase].commute,tags:[]});
const town=(id,name,council,vibe,commute)=>({id,name,council,territory:'fct',city:id,kind:'town',phase:null,code:null,verification:'official-source-pending',vibe,rent:'varied',commute,tags:[],...(SETTLEMENT_POINTS[id]?{coordinates:SETTLEMENT_POINTS[id].coordinates,coordinateSource:SETTLEMENT_POINTS[id].source}: {})});

const phase1=[
 ['central-area','Central Area','A00','government + business'],['garki-i','Garki I','A01','established mixed-use'],['wuse-i','Wuse I','A02','commerce + residential'],['garki-ii','Garki II','A03','dense everyday Abuja'],['asokoro','Asokoro','A04','diplomatic + premium residential'],['maitama','Maitama','A05','premium residential + diplomatic'],['maitama-ii','Maitama II','A06','premium expansion'],['wuse-ii-a07','Wuse II','A07','nightlife + restaurants + offices'],['wuse-ii-a08','Wuse II','A08','retail + residential'],['guzape','Guzape','A09','hillside modern residential'],['maitama-extension','Maitama Extension',null,'premium expansion'],['asokoro-extension','Asokoro Extension',null,'premium expansion']
].map(([id,n,c,v])=>fcc(id,n,'I',c,v));

const phase2=[
 ['kukwaba','Kukwaba / National Park','B00','stadium + park district'],['gudu','Gudu','B01','auto + commerce + residential'],['durumi','Durumi','B02','residential + institutions'],['wuye','Wuye','B03','planned residential'],['jabi','Jabi','B04','lake + mall + apartments'],['utako','Utako','B05','transport + hotels + offices'],['mabushi','Mabushi','B06','central residential + hospitality'],['katampe','Katampe','B07','hills + premium residential'],['jahi','Jahi','B08','fast-growing residential'],['kado','Kado','B09','retail + residential'],['dakibiyu','Dakibiyu','B10','residential'],['kaura','Kaura','B11','residential + estates'],['duboyi','Duboyi','B12','residential'],['gaduwa','Gaduwa','B13','dense estates'],['dutse-fcc','Dutse','B14','residential'],['sector-a','Sector Centre A','B15','planned centre'],['sector-b','Sector Centre B','B16','planned centre'],['sector-c','Sector Centre C','B17','planned centre'],['sector-d','Sector Centre D','B18','planned centre'],['katampe-extension','Katampe Extension','B19','premium hills expansion']
].map(([id,n,c,v])=>fcc(id,n,'II',c,v));

const phase3=[
 ['institution-research','Institution & Research','C00','institutions + research'],['karmo','Karmo','C01','industrial + residential edge'],['gwarinpa-i','Gwarinpa I','C02','large residential estate + commerce'],['gwarinpa-ii','Gwarinpa II / Bunkoro','C03','residential expansion'],['dape','Dape','C04','residential + expansion'],['kafe','Kafe','C05','residential estates'],['mbora','Mbora / Nbora','C06','residential + estates'],['galadimawa','Galadimawa','C07','residential + expressway access'],['dakwo','Dakwo','C08','residential + estates'],['lokogoma','Lokogoma','C09','dense estate corridor'],['wumba','Wumba','C10','residential growth area'],['saraji','Saraji','C11','developing residential'],['kabusa','Kabusa','C12','residential + local community'],['okanje','Okanje','C13','developing district'],['pyakasa','Pyakasa','C14','airport-side community'],['wupa','Wupa','C15','industrial / utility corridor'],['industrial-1','Industrial Area I','C16','industry + logistics'],['industrial-2','Industrial Area II','C17','industry + logistics'],['bunkoro','Bunkoro','C18','mass housing / growth'],['sector-e','Sector Centre E','C19','planned centre'],['sector-f','Sector Centre F','C20','planned centre'],['sector-g','Sector Centre G','C21','planned centre'],['sector-h','Sector Centre H','C22','planned centre']
].map(([id,n,c,v])=>fcc(id,n,'III',c,v));

const phase4Names=[
 ['karsana-east','Karsana East','D01'],['karsana-south','Karsana South','D02'],['idogwari','Idogwari','D03'],['idu-sabo','Idu-Sabo','D04'],['karsana-north','Karsana North','D05'],['karsana-west','Karsana West','D06'],['sabo-gida','Sabo Gida','D07'],['tasha','Tasha / Kodo','D08'],['kagini','Kagini','D09'],['gwagwa','Gwagwa','D10'],['filindabo','Filindabo','D11'],['kaba','Kaba','D12'],['ketti-north','Ketti North','D13'],['sheretti','Sheretti','D14'],['sheretti-cheche','Sheretti Cheche','D15'],['waru-pozema','Waru-Pozema','D16'],['ketti','Ketti','D17'],['ketti-east','Ketti East','D18'],['burun-west','Burun West','D19'],['burun','Burun','D20'],['gidari-bahago','Gidari Bahago','D21'],['gwari','Gwari','D22'],['bude-west','Bude West','D23'],['bude','Bude','D24'],['kpoto-west','Kpoto West','D25'],['kpoto-east','Kpoto East','D26'],['chafe','Chafe','D27'],['jaite','Jaite','D28'],['mamusa-north','Mamusa North','D29'],['mamusa-east','Mamusa East','D30'],['sector-k','Sector Centre K','D31'],['sector-l','Sector Centre L','D32'],['sector-m','Sector Centre M','D33'],['sector-n','Sector Centre N','D34'],['sector-o','Sector Centre O','D35'],['sector-q','Sector Centre Q','D36'],['sector-r','Sector Centre R','D37'],['sector-s','Sector Centre S','D38']
];
const phase4=phase4Names.map(([id,n,c])=>fcc(id,n,'IV',c,id.startsWith('sector-')?'planned sector centre':'developing / mass-housing district'));
const phase5=[fcc('kyami','Kyami','V','E23','airport-axis planned district')];
export const FCC_DISTRICTS=[...phase1,...phase2,...phase3,...phase4,...phase5];

export const SATELLITE_TOWNS=[
 town('nyanya','Nyanya','amac','dense commuter town',35),town('karu','Karu','amac','mixed-use commuter town',32),town('jikwoyi','Jikwoyi','amac','residential commuter community',38),town('kurudu','Kurudu','amac','residential growth town',42),town('orozo','Orozo','amac','peri-urban residential',45),town('karshi','Karshi','amac','satellite town',55),town('gidan-mangoro','Gidan Mangoro','amac','peri-urban community',45),
 town('mpape','Mpape','bwari','hillside dense community',28),town('kubwa','Kubwa','bwari','major satellite city + commerce',35),town('dawaki','Dawaki','bwari','residential commuter area',30),town('dei-dei','Dei-Dei','bwari','building materials + transport hub',38),town('bwari-town','Bwari Town','bwari','council town + institutions',55),town('ushafa','Ushafa','bwari','historic hills community',58),town('dutse-alhaji','Dutse Alhaji','bwari','dense residential + commerce',32),
 town('zuba','Zuba','gwagwalada','western transport gateway',50),town('gwagwalada-town','Gwagwalada Town','gwagwalada','university + market town',65),town('paiko-kore','Paiko-Kore','gwagwalada','regional community',75),town('dobi','Dobi','gwagwalada','regional community',80),
 town('kuje-town','Kuje Town','kuje','council town + markets',55),town('lugbe','Lugbe','amac','airport corridor residential city',32),town('chika','Chika','amac','airport-road community',35),town('kuchigoro','Kuchigoro','amac','airport-corridor community',30),town('pyakasa-town','Pyakasa community','amac','airport-corridor community',38),town('sauka','Sauka','amac','airport-corridor community',40),
 town('kwali-town','Kwali Town','kwali','council market town',85),town('sheda','Sheda','kwali','research + regional community',78),town('yangoji','Yangoji','kwali','regional community',95),town('abaji-town','Abaji Town','abaji','historic council town',105),town('yaba-abaji','Yaba (Abaji)','abaji','regional community',110)
];

export const LANDMARKS=[
 ['aso-rock','Aso Rock',null,'nature'],['national-mosque','National Mosque','central-area','civic'],['national-christian-centre','National Christian Centre','central-area','civic'],['national-assembly','National Assembly','central-area','civic'],['supreme-court','Supreme Court','central-area','civic'],['eagle-square','Eagle Square','central-area','event'],['millennium-park','Millennium Park','maitama','park'],['jabi-lake','Jabi Lake','jabi','recreation'],['jabi-lake-mall','Jabi Lake Mall','jabi','shopping'],['wuse-market','Wuse Market','wuse-i','market'],['utako-motor-park','Utako Motor Park','utako','transport'],['national-stadium','Moshood Abiola National Stadium','kukwaba','sport'],['international-conference-centre','International Conference Centre','central-area','event'],['city-gate','Abuja City Gate','kukwaba','civic'],['airport','Nnamdi Azikiwe International Airport',null,'transport'],['rail-hub','Idu Rail Station',null,'transport'],['abuja-metro-station','Abuja Metro Station',null,'transport']
].map(([id,name,district,type])=>({id,name,district,type,territory:'fct',kind:'landmark',verification:'official-source-pending'}));

export const ABUJA_ATLAS=[...FCC_DISTRICTS,...SATELLITE_TOWNS];
export const GEOGRAPHY_HIERARCHY=['territory','area-council','city-or-town','district-or-sector','neighbourhood','road-corridor','venue'];
export const ATLAS_META={
  title:'Abuja / FCT World Atlas',
  sourceModel:'Legacy location catalogue; source-backed GeoNames settlement points; official district and council verification pending',
  councilCount:AREA_COUNCILS.length,
  locationCount:ABUJA_ATLAS.length,
  landmarkCount:LANDMARKS.length,
  sources:GEOGRAPHY_SOURCES,
  hierarchy:GEOGRAPHY_HIERARCHY,
  focus:SETTLEMENT_POINTS.abuja,
  verifiedCoordinateCount:Object.values(SETTLEMENT_POINTS).length,
  officialGeographyComplete:false,
  note:'FCC districts, sector centres and satellite towns have separate record types. Legacy cadastral codes, phases and council assignments are retained as unverified assertions for source review, not official boundaries.'
};

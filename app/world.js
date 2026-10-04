// Original AbujaLife scenery. These are authored social spaces, not geographic maps.
let serial = 0;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shades = {
  skin: {deep:'#613e2e',brown:'#986343',warm:'#bf865d',light:'#d7a882'},
  top: {ochre:'#bd733a',forest:'#326752',cream:'#e6dfce',navy:'#334456',agbada:'#c3a26d'},
  bottom: {charcoal:'#41464a',denim:'#536b7a',cream:'#d7cfbd'},
  shoes: {white:'#eeece5',black:'#303538'}
};
const color = (kind, key, fallback) => shades[kind][key] || fallback;

function residentArt(a = {}) {
  const skin = color('skin',a.skinTone,'#986343');
  const top = color('top',a.top,'#bd733a');
  const bottom = color('bottom',a.bottom,'#41464a');
  const shoe = color('shoes',a.shoes,'#eeece5');
  const body = a.body === 'broad' ? 9 : a.body === 'slim' ? -6 : 0;
  const left = 66-body, right = 134+body;
  const feminine = a.presentation === 'feminine';
  const face = a.face === 'round' ? 'M74 63Q73 43 100 42Q127 43 127 64L124 88Q117 108 100 109Q83 108 76 89Z' : a.face === 'angular' ? 'M76 61Q76 43 100 43Q124 43 124 61L122 88L109 106H92L78 90Z' : 'M75 63Q75 43 100 42Q125 43 125 63L122 88Q118 107 100 109Q82 107 78 88Z';
  const hairs = {
    crop:'<path d="M75 70V57Q73 34 100 33Q128 34 125 58V68L119 60L117 51Q103 58 82 50L82 63Z" fill="#242322"/><path d="M81 46Q102 39 119 46" stroke="#3c3731" stroke-width="4" fill="none"/>',
    bald:'<path d="M77 59Q80 43 100 42Q119 43 123 59" fill="none" stroke="#fff" opacity=".13" stroke-width="3"/>',
    afro:'<path d="M75 76Q61 71 65 59Q57 46 69 37Q68 21 85 25Q95 14 107 23Q123 19 129 33Q143 38 135 52Q141 65 126 75L122 57Q106 60 81 52Z" fill="#292724"/><path d="M72 42Q90 22 118 33M67 57Q79 48 85 47M110 27Q126 30 128 43" fill="none" stroke="#453c32" stroke-width="3" stroke-linecap="round"/>',
    locs:'<path d="M75 61Q74 31 99 31Q128 31 127 63L124 74L118 52Q97 63 82 54L79 79" fill="#282521"/><path d="M80 38Q73 60 74 90M89 35Q79 57 81 86M98 35Q90 53 86 60M107 35Q116 53 119 81M118 39Q130 69 126 96M99 36Q104 49 102 55" stroke="#41382e" stroke-width="6" stroke-linecap="round" fill="none"/>',
    braids:'<path d="M74 72Q67 29 100 28Q134 31 128 78L118 58Q106 58 81 55L81 77Z" fill="#282521"/><path d="M81 37Q76 56 75 103M88 33Q84 47 81 57M96 31L90 55M103 31L100 56M111 33L109 57M119 39Q125 62 126 108" stroke="#4b3a2d" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M75 85V124M126 89V125" stroke="#282521" stroke-width="7" stroke-linecap="round"/>'
  };
  const agbada = a.top === 'agbada';
  return `<g class="resident-figure">
    <ellipse cx="100" cy="271" rx="43" ry="9" fill="#25392d" opacity=".15"/>
    <path d="M${left+5} 179L99 179L94 249L74 249Z" fill="${bottom}"/><path d="M101 179L${right-5} 179L127 249H106Z" fill="${bottom}"/>
    <path d="M76 187L82 238M121 187L117 238" stroke="#111" opacity=".12" stroke-width="3"/>
    <path d="M74 245H94L96 260Q88 266 63 262L64 255Z" fill="${shoe}"/><path d="M106 245H126L135 255L135 263H105Z" fill="${shoe}"/>
    <path d="M65 260L94 260M107 260H133" stroke="#262b2b" stroke-width="2" opacity=".55"/>
    <path d="M${left} 125Q${left-15} 127 ${left-16} 146L${left-22} 190Q${left-25} 203 ${left-16} 207Q${left-7} 208 ${left-6} 196L${left+2} 153Z" fill="${skin}"/>
    <path d="M${right} 125Q${right+15} 127 ${right+16} 146L${right+22} 190Q${right+25} 203 ${right+16} 207Q${right+7} 208 ${right+6} 196L${right-2} 153Z" fill="${skin}"/>
    ${agbada ? `<path d="M79 116Q100 107 122 116L155 137L145 191L124 188L126 213H74L76 188L54 191L45 138Z" fill="${top}"/><path d="M99 125V207M90 135L90 182M109 135V182" stroke="#ede3cc" stroke-width="3" fill="none"/><path d="M83 117L100 126L119 117L113 146H88Z" fill="#af8b57"/>` : `<path d="M81 114Q100 109 119 114L${right+12} 126L${right+7} 149L${right-1} 149L${right-1} 186Q100 195 ${left+1} 186L${left+1} 149L${left-7} 149L${left-12} 126Z" fill="${top}"/><path d="M${left+6} 147L${left+6} 181M${right-6} 147L${right-6} 181" stroke="#111" opacity=".09" stroke-width="2"/><path d="M84 115Q100 131 117 115" stroke="#fff" opacity=".25" stroke-width="3" fill="none"/>`}
    <path d="M89 98H112L114 116Q100 127 86 116Z" fill="${skin}"/><path d="M89 104Q102 111 112 103L112 109Q98 118 89 110Z" fill="#221916" opacity=".16"/>
    <ellipse cx="76" cy="76" rx="5" ry="9" fill="${skin}"/><ellipse cx="124" cy="76" rx="5" ry="9" fill="${skin}"/>
    <path d="${face}" fill="${skin}"/><path d="M78 64Q79 47 96 45" fill="none" stroke="#fff" stroke-width="3" opacity=".1"/>
    <path d="M85 68L94 67M106 67L115 68" stroke="#3d2c24" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="90" cy="73" rx="2.2" ry="2.5" fill="#242321"/><ellipse cx="111" cy="73" rx="2.2" ry="2.5" fill="#242321"/>
    <path d="M100 75L97 86H103" fill="none" stroke="#352720" stroke-width="1.5" opacity=".4" stroke-linecap="round"/>
    <path d="M92 94Q100 98 109 94" fill="none" stroke="#482d26" stroke-width="2" stroke-linecap="round"/>
    ${a.facialHair==='beard'?'<path d="M79 84L86 94Q100 104 114 94L121 84L119 99Q100 119 82 100Z" fill="#2b2722" opacity=".85"/><path d="M92 93Q100 97 109 93" fill="none" stroke="#b3896a" stroke-width="1.5"/>':''}
    ${hairs[a.hair]||hairs.crop}
    ${a.accessory==='glasses'?'<g fill="none" stroke="#272e2e" stroke-width="2"><rect x="80" y="66" width="17" height="14" rx="5"/><rect x="104" y="66" width="17" height="14" rx="5"/><path d="M97 70H104M75 69H80M121 69H126"/></g>':''}
    ${feminine?'<circle cx="76" cy="87" r="2.5" fill="#c8a45e"/><circle cx="124" cy="87" r="2.5" fill="#c8a45e"/>':''}
  </g>`;
}

export function avatarSVG(appearance = {}, {size = 160, fullBody = false} = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="resident-avatar ${fullBody?'resident-avatar-full':''}" viewBox="${fullBody?'0 0 200 280':'25 22 150 154'}" width="${Number(size)||160}" role="img" aria-label="Resident portrait">${residentArt(appearance)}</svg>`;
}

const tree = (x,y,s=1,variant=0) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="9" rx="61" ry="16" fill="#243b2b" opacity=".12"/><path d="M-6 2L-3-94L5-97L8 2Z" fill="#786148"/><path d="M2-75L-32-108M1-61L30-97" fill="none" stroke="#786148" stroke-width="7"/><g class="world-leaves"><path d="M-69-88Q-89-113-66-135Q-70-165-42-174Q-27-204 3-187Q37-202 52-171Q87-163 80-131Q101-104 73-83Q49-59 20-74Q-18-53-46-77Z" fill="${variant?'#3c6a49':'#39664b'}"/><path d="M-63-125Q-66-158-37-162Q-14-185 5-171Q32-184 42-156Q60-157 67-134Q33-142 11-126Q-16-135-31-111Z" fill="#527a50"/><path d="M-49-154Q-21-178 5-163M-8-109Q23-129 51-115" stroke="#7b955e" stroke-width="8" opacity=".3" stroke-linecap="round" fill="none"/></g></g>`;
const palm = (x,y,s=1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-5 0Q5-81 1-159" stroke="#92714e" stroke-width="11" fill="none"/><path d="M-6-19L7-23M-5-45L8-49M-4-71L8-75M-3-98L7-102M-3-126L6-130" stroke="#b8966b" stroke-width="3"/><g class="world-leaves" fill="#426b45"><path d="M2-160Q-65-189-91-134Q-36-161 2-153Z"/><path d="M2-160Q-38-216-60-184Q-20-185 2-153Z"/><path d="M2-160Q29-205 61-178Q24-180 2-153Z"/><path d="M2-160Q83-173 88-126Q46-160 2-153Z"/><path d="M2-160Q14-153 21-96Q31-134 2-160Z"/></g></g>`;
const shrubs = (x,y,w=180) => `<g transform="translate(${x} ${y})"><rect x="0" y="-17" width="${w}" height="25" rx="12" fill="#426947"/>${Array.from({length:Math.ceil(w/28)},(_,i)=>`<ellipse cx="${i*28+13}" cy="-13" rx="21" ry="15" fill="${i%2?'#5b7d4f':'#4d754c'}"/>`).join('')}<path d="M0 7H${w}" stroke="#8c9577" stroke-width="5"/></g>`;
const windows = (x,y,cols,rows,w=42,h=55) => Array.from({length:cols*rows},(_,i)=>`<g transform="translate(${x+(i%cols)*(w+17)} ${y+Math.floor(i/cols)*(h+23)})"><rect width="${w}" height="${h}" fill="#7e989a"/><path d="M3 2H${w-3}V${h-3}" fill="none" stroke="#c2ceca" stroke-width="3"/><path d="M${w/2} 2V${h}" stroke="#52676b" stroke-width="2"/></g>`).join('');
const car = (x,y,s=1,c='#deddd3') => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="89" cy="63" rx="101" ry="12" fill="#233029" opacity=".2"/><path d="M7 38L27 30L48 5Q56-2 106 0L137 9L156 29L180 35Q188 37 190 48L187 62H0L0 46Z" fill="${c}"/><path d="M35 29L52 9H77V29ZM84 9H106L126 14L142 29H84Z" fill="#577078"/><path d="M52 12H74M87 12H105L122 18" stroke="#aec0bd" stroke-width="3" fill="none" opacity=".7"/><path d="M22 34H165M80 31V56M147 30V56" stroke="#616d6b" opacity=".3" fill="none"/><rect x="159" y="36" width="23" height="8" rx="3" fill="#f2ead0"/><rect x="3" y="37" width="13" height="7" rx="2" fill="#c17d61"/><circle cx="36" cy="60" r="17" fill="#303737"/><circle cx="152" cy="60" r="17" fill="#303737"/><circle cx="36" cy="60" r="9" fill="#aaaeb0"/><circle cx="152" cy="60" r="9" fill="#aaaeb0"/><path d="M94 38H103" stroke="#4b5656" stroke-width="3" stroke-linecap="round"/></g>`;
const bench = (x,y,s=1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0H131L139 18H-7Z" fill="#977653"/><path d="M2-36H127V-3H2Z" fill="#ac8a60"/><path d="M5-27H124M5-15H124" stroke="#6f5a44" stroke-width="3"/><path d="M5 14V44M126 14V44M8-37V5M122-37V5" stroke="#425051" stroke-width="7"/></g>`;
const lamp = (x,y,s=1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0V-195Q0-211 18-211H57" stroke="#62706c" stroke-width="7" fill="none"/><path d="M38-216H71L64-205H39Z" fill="#53645f"/><path d="M43-205H63" stroke="#e8d9ae" stroke-width="3"/></g>`;
function object(action, label, content, {x=0,y=0,w=150,h=40,lx=x+w/2,ly=y-16}={}) {
  return `<g class="world-object" role="button" tabindex="0" data-world-action="${escape(action)}" aria-label="${escape(label)}"><title>${escape(label)}</title>${content}<rect class="world-hit" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/><g class="world-affordance" transform="translate(${lx} ${ly})"><rect x="${-Math.max(64,label.length*3.9)}" y="-21" width="${Math.max(128,label.length*7.8)}" height="37" rx="18"/><text y="3" text-anchor="middle">${escape(label)}</text></g></g>`;
}

const homePlans = {
  'garki-studio': {wall:['#eee8d9','#ddd9c9'],floor:['#c0aa88','#dbc5a1'],sofa:['#8f9d88','#a6b19b','#b6bea5','#88977e','#98a78c'],layout:{}},
  'lugbe-flat': {wall:['#f1e8d9','#dfd7c6'],floor:['#c0ad92','#e0cab0'],sofa:['#a2917c','#b9a58c','#cfb79c','#95816b','#ad947c'],layout:{sleep:'translate(-9 38) scale(.92)',relax:'translate(14 28) scale(.97)'}},
  'gwarinpa-apartment': {wall:['#e8e8d9','#d7ddca'],floor:['#b49b73','#ccb184'],sofa:['#748d7f','#8aa295','#9bb1a1','#6c8577','#839c8b'],layout:{sleep:'translate(16 26) scale(.94)',relax:'translate(-8 40)'}},
  'jabi-apartment': {wall:['#e5ebe5','#d5ddd7'],floor:['#c6c4b4','#e7e6d7'],sofa:['#829da0','#9bb4b2','#b5c6bf','#6f898d','#8da7a5'],layout:{sleep:'translate(40 30) scale(.9)',relax:'translate(12 47) scale(.97)',eat:'translate(34 12) scale(.94)'}},
  'guzape-terrace': {wall:['#eee3d4','#dfd1bc'],floor:['#b19479','#d0b496'],sofa:['#a88367','#b8987d','#cdb293','#97755d','#b18f72'],layout:{sleep:'translate(10 54) scale(.87)',relax:'translate(25 12) scale(.98)',eat:'translate(66 44) scale(.9)'}},
  'maitama-villa': {wall:['#eeede2','#dcded0'],floor:['#d6d5c6','#e8e8dc'],sofa:['#536c69','#6c8580','#8aa197','#49615d','#5d7770'],layout:{sleep:'translate(29 62) scale(.82)',relax:'translate(-48 39) scale(1.04)',eat:'translate(67 68) scale(.85)',shower:'translate(80 34) scale(.92)'}}
};

function definitions(id, profile = {}) {
  const plan = homePlans[profile.home?.propertyId] || homePlans['garki-studio'];
  return `<defs>
    <linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#bcd1cf"/><stop offset="1" stop-color="#e9e7d4"/></linearGradient>
    <linearGradient id="${id}-wall" x2="0" y2="1"><stop stop-color="${plan.wall[0]}"/><stop offset="1" stop-color="${plan.wall[1]}"/></linearGradient>
    <linearGradient id="${id}-floor" x2=".2" y2="1"><stop stop-color="${plan.floor[0]}"/><stop offset="1" stop-color="${plan.floor[1]}"/></linearGradient>
    <linearGradient id="${id}-water" x2="0" y2="1"><stop stop-color="#729d98"/><stop offset="1" stop-color="#a8c5b4"/></linearGradient>
    <linearGradient id="${id}-glass" x2=".8" y2="1"><stop stop-color="#aac0bd"/><stop offset=".45" stop-color="#779391"/><stop offset="1" stop-color="#54716f"/></linearGradient>
    <linearGradient id="${id}-sun" x2="1" y2="1"><stop stop-color="#fff5ca" stop-opacity=".55"/><stop offset="1" stop-color="#fff5ca" stop-opacity="0"/></linearGradient>
    <pattern id="${id}-floorboards" width="126" height="61" patternUnits="userSpaceOnUse" patternTransform="skewX(-12)"><path d="M0 0H126M0 61H126M64 0V61" fill="none" stroke="#8d785e" stroke-width="1" opacity=".17"/></pattern>
    <pattern id="${id}-tiles" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M0 0H35V35H0Z" fill="none" stroke="#bac4bf" stroke-width="1"/></pattern>
    <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#26392e" flood-opacity=".12"/></filter>
    <clipPath id="${id}-roomWindow"><rect x="115" y="132" width="289" height="218" rx="3"/></clipPath>
  </defs>`;
}

function studioScene(id, profile) {
  const houseName = profile.home?.name || 'Garki studio';
  return `<rect width="1200" height="780" fill="#cbcfc0"/>
    <path d="M0 0H1200V437H0Z" fill="url(#${id}-wall)"/>
    <path d="M0 0H75V447L0 485Z" fill="#d5d4c3"/><path d="M1158 0H1200V483L1158 442Z" fill="#c7c9b7"/>
    <path d="M75 423H1158L1200 780H0Z" fill="url(#${id}-floor)"/><path d="M75 423H1158L1200 780H0Z" fill="url(#${id}-floorboards)"/>
    <path d="M74 425H1157" stroke="#b9b7a5" stroke-width="9"/><path d="M75 54H1157" stroke="#fff9e7" stroke-width="5"/>
    <g data-home-art="outlook" clip-path="url(#${id}-roomWindow)"><rect x="115" y="132" width="289" height="218" fill="url(#${id}-sky)"/><path d="M90 256Q171 211 259 225Q327 194 428 226V360H90Z" fill="#bdc4ac"/><path d="M129 259H263V350H129Z" fill="#d9dac7"/><path d="M135 260V242H241L259 259" fill="#c2c7b2"/>${windows(143,276,3,1,26,45)}${tree(320,390,.9)}${palm(166,370,.72)}<path d="M90 350H435" stroke="#e0dbc9" stroke-width="20"/></g>
    <rect x="108" y="126" width="303" height="231" fill="none" stroke="#f8f2df" stroke-width="12"/><path d="M258 134V348M113 250H404" stroke="#eee9d9" stroke-width="7"/><path d="M117 353H406" stroke="#bcb8a7" stroke-width="9"/>
    <path d="M98 124H126V371L101 367Q121 267 98 124Z" fill="#b3bdb0"/><path d="M394 123H426L418 369H394Q411 272 394 123Z" fill="#b3bdb0"/><path d="M105 133L110 355M409 132L413 358" stroke="#7e9787" opacity=".3" stroke-width="3"/>
    <path d="M117 353L400 353L755 763H277Z" fill="url(#${id}-sun)"/>
    <g data-home-art="picture" transform="translate(445 119)"><rect width="123" height="127" rx="2" fill="#c4ab7d"/><rect x="7" y="7" width="109" height="113" fill="#eee5d0"/><path d="M14 99Q38 63 62 82Q81 52 110 47V112H14Z" fill="#9eac88"/><path d="M15 105Q50 74 84 89Q107 86 110 77V112H15Z" fill="#607d64"/><circle cx="80" cy="36" r="13" fill="#d8af68"/></g>
    <g data-home-art="clock" transform="translate(580 158)"><circle r="25" fill="#eeeee0" stroke="#c0bba8" stroke-width="5"/><path d="M0-15V0L10 6" stroke="#526357" stroke-width="3" stroke-linecap="round"/></g>
    ${object('wardrobe','Choose an outfit',`<g transform="translate(71 352)"><path d="M0 0L22-8H116L132 1V147H0Z" fill="#967d5b"/><rect x="8" y="3" width="113" height="132" fill="#b39b77"/><path d="M64 4V135M121 4V137" stroke="#836b4c" stroke-width="3"/><path d="M53 64V82M75 64V82" stroke="#4f5d54" stroke-width="4" stroke-linecap="round"/><rect x="10" y="137" width="110" height="10" fill="#715d43"/></g>`,{x:71,y:344,w:135,h:164,lx:141,ly:329})}
    ${object('sleep','Sleep in your bed',`<g><ellipse cx="354" cy="606" rx="177" ry="24" fill="#886f50" opacity=".15"/><rect x="233" y="356" width="261" height="91" rx="8" fill="#997d5b"/><path d="M242 367H485V422H242Z" fill="#bda682"/><path d="M230 446L491 446L548 587L180 587Z" fill="#a58966"/><path d="M180 578H548V612H180Z" fill="#856c50"/><path d="M197 608V626M533 608V624" stroke="#635c4c" stroke-width="10"/><path d="M237 421H484L541 568Q539 585 524 586H203Q185 584 190 568Z" fill="#ece5d1"/><path d="M212 486H509L541 568Q539 585 524 586H203Q185 584 190 568Z" fill="#698776"/><path d="M228 495H513M219 510H519M210 527H525M203 544H532M197 561H537" stroke="#779482" opacity=".7" stroke-width="2"/><path d="M256 429H343L350 469H246Q246 444 256 429ZM361 429H463L473 469H360Z" fill="#f8f1de"/><path d="M256 434H337M368 434H455" stroke="#dad2bf" stroke-width="2"/><path d="M340 485L365 567" stroke="#425f50" stroke-width="2" opacity=".25"/></g>`,{x:195,y:365,w:350,h:251,lx:372,ly:351})}
    <g data-home-art="bedside" transform="translate(508 410)"><path d="M0 0H61L74 33H0Z" fill="#b4966e"/><path d="M0 33H74V81H0Z" fill="#987d59"/><path d="M7 40H65V64H7Z" fill="#af936c"/><path d="M30 50H44" stroke="#46584b" stroke-width="3"/><path d="M8 81V93M66 81V93" stroke="#665c47" stroke-width="6"/><path d="M33-8V-30" stroke="#6e715d" stroke-width="4"/><path d="M15-31L21-56H47L55-31Z" fill="#e8d5a4"/><ellipse cx="35" cy="-7" rx="14" ry="4" fill="#8d947c"/></g>
    ${object('eat','Make a meal',`<g transform="translate(600 265)"><rect width="251" height="28" fill="#aebcaf"/><rect x="0" y="30" width="251" height="88" fill="#dbe0d4"/><path d="M0 30H251M0 59H251M0 88H251M31 30V116M93 30V116M156 30V116M218 30V116" stroke="#bdc9bd" stroke-width="1"/><rect x="0" y="116" width="251" height="61" fill="#8c9c88"/><path d="M2 113H253V126H0Z" fill="#eae4d2"/><path d="M81 127V174M159 127V174" stroke="#647964" stroke-width="2"/><path d="M12 139H32M99 139H122M179 139H202" stroke="#e8e2cc" stroke-width="3"/><path d="M2-31H106V29H2Z" fill="#b6bfab"/><path d="M53-29V27" stroke="#8fa28f" stroke-width="2"/><path d="M44-4V8M64-4V8" stroke="#556d5b" stroke-width="3"/><path d="M149-31H248V29H149Z" fill="#b6bfab"/><path d="M199-29V27" stroke="#8fa28f" stroke-width="2"/><path d="M187-4V8M211-4V8" stroke="#556d5b" stroke-width="3"/><ellipse cx="49" cy="115" rx="30" ry="9" fill="#a0a49b"/><ellipse cx="49" cy="114" rx="22" ry="6" fill="#798e85"/><path d="M49 111V90Q49 81 61 81V91" stroke="#7c8e87" stroke-width="5" fill="none"/><rect x="103" y="99" width="82" height="17" rx="2" fill="#455751"/><ellipse cx="122" cy="102" rx="10" ry="3" fill="#718078"/><ellipse cx="165" cy="109" rx="10" ry="3" fill="#718078"/><path d="M119 99V90H142V99" fill="#ac6847"/><path d="M143 94H152" stroke="#774832" stroke-width="3"/><path d="M198 97L209 76L216 98" fill="#899f62"/><rect x="196" y="98" width="24" height="17" rx="3" fill="#d8c1a0"/></g><g transform="translate(851 249)"><rect width="66" height="194" rx="5" fill="#d6d6c5"/><rect x="5" y="5" width="55" height="61" rx="3" fill="#e4e4d4"/><path d="M2 69H64" stroke="#b4bead" stroke-width="3"/><path d="M11 25V45M11 86V120" stroke="#647b6b" stroke-width="4" stroke-linecap="round"/></g>`,{x:600,y:239,w:318,h:207,lx:740,ly:226})}
    ${object('shower','Take a shower',`<g><path d="M951 89H1147V420H951Z" fill="#ced7cd"/><path d="M959 102H1137V410H959Z" fill="url(#${id}-tiles)"/><path d="M948 90H1149V104H948Z" fill="#b4c3b5"/><path d="M952 414H1149V427H952Z" fill="#a6b6a6"/><path d="M985 123H1089V397H985Z" fill="#b6ccc3" opacity=".6"/><path d="M986 122V400H1089V122Z" fill="none" stroke="#829d90" stroke-width="4"/><path d="M1040 129V394" stroke="#e6ece2" stroke-width="3"/><path d="M1011 130V164Q1012 173 1027 173" fill="none" stroke="#758d86" stroke-width="5"/><ellipse cx="1033" cy="175" rx="17" ry="5" fill="#788e86"/><path d="M1058 265V287" stroke="#718a7e" stroke-width="4"/><path d="M1000 372H1077L1087 398H991Z" fill="#e4e9dc"/><g transform="translate(1100 332)"><path d="M0 0H38V38H0Z" fill="#e9e8d7"/><ellipse cx="19" cy="46" rx="22" ry="14" fill="#edf0e3"/><ellipse cx="19" cy="44" rx="13" ry="6" fill="#becdc1"/><path d="M8 58H31L29 76H11Z" fill="#d9ded0"/><rect x="29" y="11" width="5" height="9" fill="#a6b9aa"/></g><rect x="953" y="211" width="21" height="81" rx="2" fill="#738d78"/><path d="M953 221H974M956 286H971" stroke="#96ac90" stroke-width="2"/></g>`,{x:951,y:103,w:196,h:319,lx:1049,ly:75})}
    <path d="M634 492H945L1033 657H571Z" fill="#d6d1b9"/><path d="M648 504H934L1004 641H596Z" fill="none" stroke="#b9b398" stroke-width="4"/><path d="M637 522H944M625 547H956M612 572H970M599 599H985M587 627H1000" stroke="#c4c0a8" stroke-width="2"/>
    ${object('relax','Settle on the sofa',`<g><ellipse cx="898" cy="576" rx="161" ry="28" fill="#796b54" opacity=".13"/><path d="M763 411Q763 391 784 391H1000Q1024 391 1024 412V505H763Z" fill="#8f9d88"/><path d="M778 405H889V492H778Z" fill="#a6b19b"/><path d="M895 405H1009V492H895Z" fill="#a6b19b"/><path d="M752 480H1025L1046 530H747Z" fill="#b6bea5"/><path d="M747 529H1046V559H747Z" fill="#88977e"/><path d="M739 440Q739 427 756 427H774V546H739ZM1014 427H1034Q1053 427 1053 443V546H1014Z" fill="#98a78c"/><path d="M759 557V577M1031 557V577" stroke="#6c6652" stroke-width="9"/><path d="M779 501H894M899 501H1014" stroke="#96a588" stroke-width="2"/><path d="M790 433L830 416L847 454L807 469Z" fill="#d6bb81"/><path d="M949 418L985 438L969 474L930 454Z" fill="#d8dbc5"/></g>`,{x:739,y:390,w:317,h:190,lx:900,ly:375})}
    <g data-home-art="coffee-table" transform="translate(659 614)"><ellipse cx="65" cy="50" rx="107" ry="28" fill="#826f52" opacity=".12"/><path d="M-19-11H151L166 26H-28Z" fill="#b08f62"/><path d="M-23 25H166V37H-23Z" fill="#987951"/><path d="M-11 37L-17 76M150 37L155 73" stroke="#6e6550" stroke-width="9"/><path d="M5-7H68L74 11H0Z" fill="#eee2bf"/><path d="M8-3H62" stroke="#9fb194" stroke-width="4"/><ellipse cx="112" cy="2" rx="16" ry="7" fill="#ac6847"/><path d="M98-15H126L123 1Q113 10 100 1Z" fill="#c88561"/><path d="M126-9Q139-13 136-3Q134 2 125 1" fill="none" stroke="#c88561" stroke-width="4"/></g>
    <g data-home-art="base-plant" transform="translate(1114 519)"><ellipse cy="8" rx="31" ry="10" fill="#7e795c" opacity=".2"/><path d="M-25-45H25L19 7H-19Z" fill="#be8e6b"/><path d="M0-41V-133M0-80Q-53-104-41-132Q-5-122 0-89M1-63Q46-102 40-126Q3-110 1-75M-2-94Q-23-130-9-151Q14-122 2-98M2-115Q35-141 23-161Q5-146 2-125" fill="#497352" stroke="#4a7050" stroke-width="4" stroke-linejoin="round"/></g>
    ${object('leave-home','Head outside',`<g transform="translate(24 621)"><path d="M0 0H100V136H0Z" fill="#d2c7aa"/><path d="M9 10H87V136H9Z" fill="#8d9078"/><path d="M16 18H80V136H16Z" fill="#748475"/><path d="M75 81H84" stroke="#dcc795" stroke-width="4"/><path d="M-7 133H109V145H-7Z" fill="#b9b299"/><rect x="35" y="107" width="24" height="10" fill="#6d7867"/></g>`,{x:18,y:621,w:121,h:149,lx:92,ly:604})}
    <g data-home-art="mat" transform="translate(936 679)"><path d="M0 0H142V53H0Z" fill="#ceb58b"/><path d="M8 7H134V46H8Z" fill="#b7a982"/><path d="M32 13H110M32 24H110M32 35H110" stroke="#9a906b" stroke-width="2"/></g>
    <text x="1118" y="749" text-anchor="end" class="world-etched">${escape(houseName)}</text>`;
}

const xml = node => new XMLSerializer().serializeToString(node);
const svgDocument = content => new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`,'image/svg+xml');

function homeOutlook(id, property) {
  const base = `<rect x="115" y="132" width="289" height="218" fill="url(#${id}-sky)"/>`;
  if(property === 'jabi-apartment') return `${base}<path d="M111 221Q270 196 414 213V350H111Z" fill="url(#${id}-water)"/><path d="M112 219Q189 191 263 209Q340 192 415 213" fill="#8caa80"/>${tree(169,218,.35)}${tree(310,216,.29)}<path d="M126 263H210M250 295H359M160 327H253" stroke="#d4e0cf" opacity=".5" stroke-width="2"/><path d="M115 330H403M122 326V350M187 326V350M255 326V350M324 326V350M395 326V350" stroke="#b3bfb0" stroke-width="4"/>`;
  if(property === 'guzape-terrace') return `${base}<path d="M115 244L184 209L224 169L255 193L290 175L322 208L405 241V350H115Z" fill="#97aa92"/><path d="M224 172L235 186L228 205L211 209L210 190Z" fill="#c1c4ae"/><path d="M118 272Q248 239 406 260V350H118Z" fill="#acbda0"/>${tree(349,356,.77)}<path d="M139 288H247V344H139Z" fill="#d8d4bf"/>${windows(153,296,3,1,19,24)}<path d="M134 286H253V294H134Z" fill="#eae3cc"/>`;
  if(property === 'maitama-villa') return `${base}<path d="M112 248H407V350H112Z" fill="#a9ba92"/>${shrubs(122,309,282)}${palm(334,329,.91)}<path d="M133 237H237V275H133Z" fill="#d4d6bd"/><path d="M127 232H246V241H127Z" fill="#e6e2c7"/><path d="M139 239V302M232 239V302" stroke="#ccceb5" stroke-width="7"/><path d="M149 258H222" stroke="#9dab8a" stroke-width="3"/><path d="M120 330H409" stroke="#e5dec2" stroke-width="20"/>`;
  if(property === 'lugbe-flat') return `${base}<path d="M110 229Q287 214 412 233V350H110Z" fill="#a6b591"/><path d="M110 301H412V326H110Z" fill="#8f9b89"/><path d="M110 312H412" stroke="#e5ddbc" stroke-width="2" stroke-dasharray="26 22"/>${car(253,288,.39,'#d5bd85')}${tree(151,334,.63)}<path d="M210 233H299V279H210Z" fill="#d4d2b6"/><path d="M204 231L236 209H275L306 231Z" fill="#9ca486"/>`;
  if(property === 'gwarinpa-apartment') return `${base}<path d="M113 239H409V351H113Z" fill="#b3c19c"/><path d="M150 255H267V325H150Z" fill="#e3dcc2"/><path d="M141 254L205 226L277 254Z" fill="#8e9d82"/>${windows(164,269,3,1,21,34)}${tree(345,366,.87)}${shrubs(126,338,205)}`;
  return null;
}

function upgradePlant(x,y,scale=1) {
  return `<g data-home-item="plant" transform="translate(${x} ${y}) scale(${scale})"><title>Your indoor plant</title><ellipse cy="8" rx="38" ry="12" fill="#73644d" opacity=".14"/><path d="M-28-37H28L21 8H-21Z" fill="#d6b285"/><path d="M-24-32H24" stroke="#e5cba2" stroke-width="4"/><g fill="#4e7957" stroke="#416d4e" stroke-width="3"><path d="M0-35L-3-124Q-36-135-38-114Q-28-93-3-97L-2-69Q-50-79-48-100Q-15-97-2-76L1-50Q36-57 37-84Q12-83 1-61L1-89Q28-102 26-121Q4-118 0-99Z"/><path d="M-2-102Q-10-147 8-154Q21-130-2-103Z"/></g></g>`;
}
function bookshelf(x,y,scale=1) {
  return `<g data-home-item="bookshelf" transform="translate(${x} ${y}) scale(${scale})"><title>Your bookshelf</title><ellipse cx="65" cy="152" rx="82" ry="13" fill="#72684d" opacity=".12"/><path d="M0 0H132V150H0Z" fill="#a48863"/><path d="M10 9H122V142H10Z" fill="#7d6d53"/><path d="M6 47H125M6 95H125M6 142H125" stroke="#c0a27a" stroke-width="7"/><path d="M18 15H29V43H18ZM47 15H60V43H47ZM66 14H77V43H66Z" fill="#a6b291"/><path d="M32 11H44V43H32ZM80 17H95V43H80Z" fill="#d2b683"/><path d="M101 12L111 10L119 40L109 43Z" fill="#bb8462"/><path d="M17 84H62V91H17ZM20 75H56V83H20Z" fill="#d5c599"/><path d="M79 63H108L105 89H82Z" fill="#bb8e6b"/><path d="M80 63Q95 59 107 63" fill="none" stroke="#dcc09a" stroke-width="3"/><path d="M19 109H47V137H19Z" fill="#9aaf92"/><path d="M56 107H90V137H56Z" fill="#c8b489"/><path d="M65 113H80M65 117H80" stroke="#9b8663" stroke-width="2"/><path d="M102 109H115V137H102Z" fill="#bd8e6b"/><path d="M9 150V159M123 150V159" stroke="#715f49" stroke-width="7"/></g>`;
}
function loungeChair(x,y,scale=1) {
  return object('relax','Read in your lounge chair',`<g data-home-item="lounge-chair" transform="translate(${x} ${y}) scale(${scale})"><title>Your lounge chair</title><ellipse cx="64" cy="143" rx="81" ry="16" fill="#74654e" opacity=".13"/><path d="M12 12Q11-2 28-2H103Q119-2 119 15L113 87H19Z" fill="#af895f"/><path d="M24 10H105L100 78H29Z" fill="#c8a276"/><path d="M18 76H114L128 105H4Z" fill="#d3b28a"/><path d="M6 102H126V120H6Z" fill="#9b7754"/><path d="M3 52H19V107H3ZM114 52H130V107H114Z" fill="#967451"/><path d="M15 118L9 142M116 118L123 140" stroke="#645e48" stroke-width="8"/><path d="M38 25L70 19L79 54L44 62Z" fill="#d9d8bd"/><path d="M53 35H69M55 41H71" stroke="#a4af91" stroke-width="2"/></g>`,{x:x-8*scale,y:y-7*scale,w:150*scale,h:168*scale,lx:x+64*scale,ly:y-25*scale});
}

function propertyDetail(id,property,mobile=false) {
  const scale = mobile ? .7 : 1;
  const position = mobile ? 'translate(250 84)' : 'translate(590 83)';
  if(property==='lugbe-flat') return mobile ? '<path d="M386 300H404V717H386Z" fill="#d6d1bb"/><path d="M386 300H404V311H386Z" fill="#f4edda"/><path d="M386 706H404V717H386Z" fill="#a8b49c"/>' : '<path d="M566 195H588V532H566Z" fill="#d4d2bf"/><path d="M566 194H588V206H566Z" fill="#f5eedb"/><path d="M566 520H588V532H566Z" fill="#a2b196"/>';
  if(property==='guzape-terrace') return `<g data-home-detail="staircase" transform="${mobile?'translate(300 87) scale(.58)':'translate(583 77) scale(.9)'}"><path d="M0 0H340V12H0Z" fill="#d2c5aa"/><path d="M15 291L299 42H340L45 305Z" fill="#ae9475"/><path d="M39 288H79M71 260H111M103 232H143M135 204H175M167 176H207M199 148H239M231 120H271M263 92H303" stroke="#e8d7b9" stroke-width="8"/><path d="M38 259L320 10M43 257V285M91 215V243M141 171V199M191 127V155M239 85V113M288 42V70" stroke="#647767" stroke-width="5"/><path d="M285 15V55H340" fill="none" stroke="#c8c7ad" stroke-width="7"/></g>`;
  if(property==='garki-studio') return '';
  const view = property==='jabi-apartment' ? '<path d="M0 44H288V127H0Z" fill="#87ada4"/><path d="M0 43Q82 26 151 40Q227 26 288 41" fill="#9bb894"/><path d="M15 86H73M157 108H263" stroke="#d8e6d5" stroke-width="2"/>' : `<path d="M0 43H288V127H0Z" fill="#a6b897"/>${shrubs(4,99,282)}${palm(215,128,.67)}`;
  return `<g data-home-detail="terrace-window" transform="${position} scale(${scale})"><rect width="288" height="134" fill="url(#${id}-sky)"/>${view}<rect width="288" height="134" fill="none" stroke="#f1efdb" stroke-width="9"/><path d="M98 3V131M191 3V131" stroke="#dde5d3" stroke-width="5"/><path d="M1 124H287" stroke="#b5c7b0" stroke-width="7"/></g>`;
}

function mobileHome(id,profile,doc,height) {
  const property = profile.home?.propertyId || 'garki-studio';
  const extra = height-980;
  const objects = {};
  const layouts = {
    wardrobe:'translate(-12 25) scale(.8)',sleep:'translate(-130 137) scale(.9)',eat:'translate(-274 24) scale(.9)',shower:'translate(-274 27) scale(.9)',relax:'translate(-245 212) scale(.9)','leave-home':`translate(21 ${230+extra*.72}) scale(.9)`
  };
  if(property==='lugbe-flat') layouts.sleep='translate(-109 176) scale(.83)';
  if(property==='jabi-apartment') {layouts.relax='translate(-190 226) scale(.86)';layouts.eat='translate(-240 36) scale(.88)';}
  if(property==='guzape-terrace') {layouts.eat='translate(-247 2) scale(.88)';layouts.sleep='translate(-121 165) scale(.86)';}
  if(property==='maitama-villa') {layouts.sleep='translate(-115 192) scale(.8)';layouts.relax='translate(-325 175) scale(1.01)';layouts.eat='translate(-254 17) scale(.89)';}
  for(const [action,transform] of Object.entries(layouts)) {
    const node=doc.querySelector(`[data-world-action="${action}"]`);
    if(node) {node.setAttribute('transform',transform);objects[action]=xml(node);}
  }
  const outlook = doc.querySelector('[data-home-art="outlook"]');
  const table = doc.querySelector('[data-home-art="coffee-table"]');
  const lampArt = doc.querySelector('[data-home-art="bedside"]');
  const plantArt = doc.querySelector('[data-home-art="base-plant"]');
  if(table) table.setAttribute('transform',`translate(457 ${781+extra*.45}) scale(.76)`);
  if(lampArt) lampArt.setAttribute('transform','translate(335 505) scale(.7)');
  if(plantArt) plantArt.setAttribute('transform','translate(743 727) scale(.72)');
  return `<rect width="800" height="${height}" fill="#cbd0bd"/><path d="M26 0H774V433H26Z" fill="url(#${id}-wall)"/><path d="M0 0H27V450L0 465ZM774 0H800V465L774 433Z" fill="#c5cbb8"/><path d="M27 431H774L800 ${height}H0Z" fill="url(#${id}-floor)"/><path d="M27 431H774L800 ${height}H0Z" fill="url(#${id}-floorboards)"/><path d="M27 432H774" stroke="#aaa98f" stroke-width="7"/><path d="M26 47H774" stroke="#f8f3df" stroke-width="4"/>
    <g transform="translate(-42 0) scale(.79)">${outlook?xml(outlook):''}<rect x="108" y="126" width="303" height="231" fill="none" stroke="#f8f2df" stroke-width="12"/><path d="M258 134V348M113 250H404" stroke="#eee9d9" stroke-width="7"/><path d="M98 124H126V371L101 367Q121 267 98 124ZM394 123H426L418 369H394Q411 272 394 123Z" fill="#aebca9"/></g>
    <path d="M48 279H277L510 ${height}H160Z" fill="url(#${id}-sun)"/>
    ${propertyDetail(id,property,true)}
    ${property==='garki-studio'?'<g transform="translate(306 88)"><rect width="153" height="143" fill="#c2a477"/><rect x="7" y="7" width="139" height="129" fill="#eee5d0"/><path d="M15 120Q60 65 97 83Q128 58 139 57V129H15Z" fill="#8ca582"/><path d="M16 122Q54 99 94 109Q122 83 138 94V129H16Z" fill="#5d8064"/><circle cx="100" cy="40" r="18" fill="#d4ac68"/></g>':''}
    ${objects.wardrobe||''}${objects.shower||''}${objects.eat||''}
    <path d="M411 574H730L778 ${884+extra*.4}H383Z" fill="#d4d0b7"/><path d="M424 589H717L761 ${865+extra*.4}H400Z" fill="none" stroke="#b7b296" stroke-width="4"/><path d="M414 658H734M408 720H745M403 786H756" stroke="#c0bea4" stroke-width="2"/>
    ${objects.sleep||''}${lampArt?xml(lampArt):''}${objects.relax||''}${table?xml(table):''}${plantArt?xml(plantArt):''}${objects['leave-home']||''}
    <text x="749" y="${height-29}" text-anchor="end" class="world-etched">${escape(profile.home?.name||'Garki studio')}</text>`;
}

function homeScene(id,profile,mobile=false,height=980) {
  const property = profile.home?.propertyId || 'garki-studio';
  const plan = homePlans[property] || homePlans['garki-studio'];
  const owns = new Set(Array.isArray(profile.inventory)?profile.inventory:[]);
  const doc = svgDocument(studioScene(id,profile));
  const outlook = homeOutlook(id,property);
  if(outlook) doc.querySelector('[data-home-art="outlook"]').innerHTML=outlook;
  const sofa=doc.querySelector('[data-world-action="relax"]');
  const sofaPalette=owns.has('sofa')?['#a46f53','#bb8869','#d0a282','#906147','#b27e5d']:plan.sofa;
  const originalPalette=homePlans['garki-studio'].sofa;
  sofa.querySelectorAll('[fill]').forEach(n=>{const i=originalPalette.indexOf(n.getAttribute('fill'));if(i!==-1)n.setAttribute('fill',sofaPalette[i]);});
  if(owns.has('sofa')) {
    sofa.setAttribute('data-home-item','sofa');
    const trim=svgDocument('<path d="M786 411H884V483H786ZM902 411H1003V483H902Z" stroke="#e3bf9a" stroke-width="2" fill="none"/><path d="M791 515H1007" stroke="#deba96" stroke-width="2" fill="none"/>').documentElement;
    [...trim.childNodes].forEach(n=>sofa.insertBefore(doc.importNode(n,true),sofa.querySelector('.world-hit')));
  }
  let art;
  if(mobile) art=mobileHome(id,profile,doc,height);
  else {
    for(const [action,transform] of Object.entries(plan.layout)) doc.querySelector(`[data-world-action="${action}"]`)?.setAttribute('transform',transform);
    if(property!=='garki-studio') {
      doc.querySelector('[data-home-art="clock"]')?.remove();
      const picture=doc.querySelector('[data-home-art="picture"]');
      if(property==='guzape-terrace') picture?.remove();
      else if(picture) picture.setAttribute('transform','translate(446 95) scale(.85)');
      const table=doc.querySelector('[data-home-art="coffee-table"]');
      if(table) table.setAttribute('transform','translate(659 639)');
      const detail=svgDocument(propertyDetail(id,property)).documentElement;
      const before=doc.querySelector('[data-world-action]');
      [...detail.childNodes].forEach(n=>before.parentNode.insertBefore(doc.importNode(n,true),before));
    }
    if(owns.has('bookshelf')||owns.has('lounge-chair')) doc.querySelector('[data-home-art="mat"]')?.remove();
    art=[...doc.documentElement.childNodes].map(xml).join('');
  }
  const floorExtra=mobile?height-980:0;
  if(owns.has('plant')) art+=upgradePlant(mobile?535:163,mobile?919+floorExtra*.4:707,mobile?.68:.77);
  if(owns.has('bookshelf')) art+=bookshelf(mobile?643:1060,mobile?738+floorExtra*.4:568,mobile?.92:.87);
  if(owns.has('lounge-chair')) art+=loungeChair(mobile?158:887,mobile?741+floorExtra*.42:606,mobile?1.06:1);
  return art;
}

function mobilePublic(id,profile,place,height) {
  return `<rect width="800" height="${height}" fill="url(#${id}-sky)"/><path d="M0 390H800V${height}H0Z" fill="#ccceb5"/><g transform="translate(0 59) scale(.6666667)">${sceneFor(place)(id,profile,place)}</g>
    <path d="M0 581H800V613H0Z" fill="#a9b596"/><path d="M0 581H800M0 613H800" stroke="#e7dfbf" stroke-width="7"/><path d="M0 666H800M0 758H800M0 850H800M0 942H800M155 613L109 ${height}M442 613L452 ${height}M720 613L789 ${height}" stroke="#b6b79d" stroke-width="2"/>
    ${tree(-23,height-10,1.48)}${tree(824,height-15,1.5)}${shrubs(14,617,184)}${shrubs(640,617,154)}
    <path d="M29 886L145 855L219 969L104 ${height}" fill="#527646" opacity=".045"/>
    <text x="734" y="${height-35}" text-anchor="end" class="world-etched">${escape(place.name||'Abuja')}</text>`;
}

function sky(id, hills = false) {
  return `<rect width="1200" height="780" fill="url(#${id}-sky)"/><circle cx="960" cy="91" r="55" fill="#f0e9ca" opacity=".45"/><path d="M0 215Q146 175 252 206Q342 178 451 199Q584 165 703 197Q839 147 936 180Q1077 168 1200 201V335H0Z" fill="#aebcab" opacity=".65"/>${hills?'<path d="M715 230L808 151Q837 127 849 114L878 145L892 157L938 130L969 162L998 197L1097 239Z" fill="#91a397"/><path d="M807 152L848 118L865 141L849 153L836 166Z" fill="#b1b7a6"/>':''}`;
}
function road({highway=false}={}) {
  return `<path d="M0 477H1200V780H0Z" fill="#d0d0b8"/><path d="M0 570H1200V780H0Z" fill="#858e83"/><path d="M0 589H1200" stroke="#d8d5be" stroke-width="10"/><path d="M0 618H1200" stroke="#abb2a0" stroke-width="2"/><path d="M0 635H1200M0 747H1200" stroke="#d9d4b9" stroke-width="4" stroke-dasharray="69 76"/><path d="M0 680H1200V704H0Z" fill="#8b9e73"/><path d="M0 680H1200M0 704H1200" stroke="#d5d4b8" stroke-width="5"/><path d="M28 692H154M259 692H376M493 692H615M723 692H845M963 692H1129" stroke="#779268" stroke-width="9" stroke-linecap="round"/><path d="M0 765H1200" stroke="#d1ccb0" stroke-width="5"/>${highway?'<path d="M0 740H1200" stroke="#e5dcc0" stroke-width="2"/>':''}<path d="M0 552H1200" stroke="#a8b296" stroke-width="8"/><path d="M0 512H1200M126 481L129 555M380 481L384 555M641 481L645 555M912 481L916 555M1161 481L1167 555" stroke="#bcbca4" stroke-width="2"/>`;
}
function advertisement(x,y,s=1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M19 83V170M157 83V170" stroke="#68776d" stroke-width="7"/><rect x="0" y="0" width="177" height="90" rx="2" fill="#65766b"/><rect x="5" y="5" width="167" height="80" fill="#e9e3c9"/><path d="M116 5H172V85H116Z" fill="#58775c"/><path d="M139 25Q155 16 160 29L155 58L130 58L128 32Z" fill="#d8d9bf"/><path d="M136 26Q144 39 153 26" fill="none" stroke="#70876c" stroke-width="3"/><text x="15" y="35" font-family="Georgia,serif" font-size="26" fill="#385b43">Okrika</text><text x="16" y="57" font-size="9" fill="#576653" letter-spacing="1">GOOD FINDS. REAL LIFE.</text><text x="16" y="75" font-size="7.5" fill="#697364" letter-spacing="1.2">ADVERTISEMENT</text></g>`;
}
const homeDoor = (profile, place, x=80,y=449) => profile.home?.district === place?.id ? object('enter-home','Go into your home',`<g transform="translate(${x} ${y})"><path d="M0 0H78V49H0Z" fill="#e9e4cf"/><path d="M13 1H64V46H13Z" fill="#6d8470"/><path d="M0 48H78" stroke="#7a8c72" stroke-width="5"/><path d="M22 14L39 3L57 14M29 13V34H49V13" fill="none" stroke="#e6e7d2" stroke-width="3"/></g>`,{x,y,w:78,h:55,lx:x+39,ly:y-16}) : '';

function garkiScene(id,profile,place) {
  return `${sky(id)}<path d="M30 198H334V398H30Z" fill="#d7d7c1"/><path d="M30 194H336V207H30Z" fill="#e7e3cf"/>${windows(51,227,5,2,37,43)}<path d="M47 205V396M326 205V396" stroke="#b5bdab" stroke-width="8"/>
    <path d="M814 220H1163V414H814Z" fill="#cfceb8"/>${windows(837,246,5,2,45,46)}<path d="M807 214H1171V229H807Z" fill="#e6e2cc"/>
    <path d="M157 331H894V476H157Z" fill="#d8c9a3"/><path d="M144 321H905V341H144Z" fill="#eee0bb"/><path d="M158 342H894V375H158Z" fill="#a68758"/><path d="M183 374H351V469H183Z" fill="url(#${id}-glass)"/><path d="M185 391H349M239 374V468M294 374V468" stroke="#d1d5be" stroke-width="4"/>
    ${object('hangout','Sit down for a meal',`<g><path d="M382 375H586V473H382Z" fill="#5a7465"/><path d="M391 387H577V448H391Z" fill="#88a095"/><path d="M473 384V471M393 446H575" stroke="#d3d6c1" stroke-width="4"/><path d="M366 372H601L588 349H382Z" fill="#6f8c6c"/><path d="M369 372H598V385H369Z" fill="#8ca27b"/><text x="483" y="363" text-anchor="middle" fill="#f0ead1" font-size="15" letter-spacing="2">CORNER KITCHEN</text><g transform="translate(409 467)"><ellipse cx="28" cy="4" rx="36" ry="11" fill="#ac8b61"/><path d="M28 8V45" stroke="#6e7158" stroke-width="5"/><path d="M8 44H48" stroke="#6e7158" stroke-width="4"/><path d="M-27-8V29M82-8V29" stroke="#60765c" stroke-width="5"/><path d="M-37-6H-11M70-6H94M-35 15H-12M71 15H94" stroke="#788d68" stroke-width="7"/></g></g>`,{x:378,y:348,w:216,h:158,lx:484,ly:329})}
    <path d="M617 376H866V472H617Z" fill="#dedaca"/><path d="M642 388H692V472H642Z" fill="#6c8678"/><path d="M711 389H846V453H711Z" fill="#8fa99b"/><path d="M721 400H837V436H721Z" fill="#c3cbac"/><text x="743" y="362" text-anchor="middle" font-size="14" fill="#f5eccf" letter-spacing="2">TAILOR &amp; REPAIRS</text><path d="M610 472H873V483H610Z" fill="#b3af8f"/>
    ${road()}${tree(63,481,1.4)}${tree(1090,483,1.32)}${shrubs(900,475,126)}${palm(343,482,.78)}${lamp(976,545,.78)}
    ${object('exercise','Walk the green verge',bench(679,506,.8),{x:668,y:469,w:127,h:77,lx:731,ly:453})}${homeDoor(profile,place,106,477)}
    ${car(174,601,1.03,'#bcc6bc')}${car(844,706,.94,'#bdac87')}
    <g transform="translate(975 447)"><rect width="32" height="53" rx="3" fill="#6a7a62"/><path d="M5 8H27M8 14H24" stroke="#bdc8a8" stroke-width="2"/></g>`;
}

function wuseScene(id,profile,place) {
  return `${sky(id)}<path d="M599 145H863V347H599Z" fill="#c6cbb9"/>${windows(618,168,4,2,42,59)}<path d="M586 142H874V158H586Z" fill="#e3e3ce"/>
    <path d="M98 246H593V471H98Z" fill="#e3deca"/><path d="M97 246H591V265H97Z" fill="#bab5a0"/><path d="M109 265H580V321H109Z" fill="#c2c5ae"/>${windows(124,280,7,1,44,32)}
    <path d="M114 338H352V467H114Z" fill="url(#${id}-glass)"/><path d="M113 337H352V350H113Z" fill="#546e5b"/><path d="M127 351V466M233 351V466M337 351V466" stroke="#a9b7a3" stroke-width="5"/><text x="234" y="334" text-anchor="middle" font-size="17" letter-spacing="3" fill="#465e4d">THREAD / FORM</text><path d="M163 388H209V445H163Z" fill="#d4b17b"/><path d="M272 388H310V445H272Z" fill="#c7d0bd"/><path d="M175 389L187 398L198 389M278 389L291 398L303 389" stroke="#7b7d65" stroke-width="3" fill="none"/>
    ${object('hangout','Meet at Canopy',`<g><path d="M373 342H570V469H373Z" fill="url(#${id}-glass)"/><path d="M369 340H575V359H369Z" fill="#6a7f69"/><text x="472" y="333" text-anchor="middle" font-size="18" letter-spacing="3" fill="#435e49">CANOPY</text><path d="M389 360V467M473 360V467M554 360V467" stroke="#b7c2ad" stroke-width="4"/><path d="M361 376H588L572 351H377Z" fill="#a1ab83"/><path d="M357 375H590V386H357Z" fill="#b9be98"/><g transform="translate(411 473)"><circle cy="3" r="23" fill="#bca984"/><path d="M0 10V41" stroke="#5b6d59" stroke-width="4"/><path d="M-14 40H14" stroke="#5b6d59" stroke-width="4"/><path d="M-47-10V25M49-10V25" stroke="#70886d" stroke-width="5"/><path d="M-57-8H-34M39-8H61M-57 13H-34M39 13H61" stroke="#7e9677" stroke-width="7"/></g></g>`,{x:359,y:326,w:234,h:181,lx:474,ly:309})}
    ${object('cinema','See a film',`<g><path d="M679 299H940V476H679Z" fill="#b7b294"/><path d="M682 302H938V320H682Z" fill="#eee3c5"/><path d="M692 340H929V378H692Z" fill="#65785e"/><text x="810" y="365" text-anchor="middle" font-size="20" letter-spacing="3" fill="#f4ead1">THE SCREEN</text><path d="M721 391H899V473H721Z" fill="#627b72"/><path d="M725 395H895V423H725Z" fill="#80988c"/><path d="M810 391V473" stroke="#b7bfaa" stroke-width="5"/><path d="M706 467H913V479H706Z" fill="#dad4b6"/></g>`,{x:689,y:330,w:242,h:151,lx:810,ly:307})}
    ${road()}${advertisement(949,290,1.1)}${tree(48,488,1.38)}${tree(611,486,.96)}${tree(1147,488,1.27)}${shrubs(723,486,188)}${lamp(975,544,.86)}${palm(318,492,.86)}${homeDoor(profile,place,93,483)}
    ${car(751,601,1.05,'#52676e')}${car(173,706,.96,'#e0ddd0')}`;
}

function jabiScene(id,profile,place) {
  return `${sky(id)}<path d="M0 264Q258 224 538 267Q706 246 1200 271V533H0Z" fill="url(#${id}-water)"/><path d="M0 268Q168 248 337 259Q476 249 599 270" stroke="#d3dac1" stroke-width="6" fill="none"/><path d="M0 261Q106 230 273 243Q390 222 509 247L531 268Z" fill="#7f9a76"/>${tree(120,264,.43)}${tree(331,263,.38)}${tree(475,269,.34)}
    <g class="world-water" fill="none" stroke="#d3e0cd" stroke-width="2" opacity=".38"><path d="M62 330H271M346 351H561M8 416H196M266 442H452M441 383H619M45 492H229M513 493H638"/></g>
    <path d="M548 513L764 389H1200V780H0V606Z" fill="#cfceb4"/><path d="M0 650L688 436H1200" fill="none" stroke="#e7dfc1" stroke-width="12"/><path d="M0 698L721 486H1200" fill="none" stroke="#b9bd9f" stroke-width="2"/><path d="M0 757L766 540H1200" fill="none" stroke="#b9bd9f" stroke-width="2"/>
    ${object('cinema','Go to Lakeside Cinema',`<g><path d="M741 195H1081L1142 366H713Z" fill="#d5d4bd"/><path d="M732 189H1090L1106 210H723Z" fill="#f0ead2"/><path d="M731 256H1114L1123 274H726Z" fill="#a8b6a5"/><path d="M753 276H1097L1130 371H732Z" fill="url(#${id}-glass)"/><path d="M788 278L778 368M847 278L844 368M906 278L910 368M967 278L979 368M1028 278L1049 368" stroke="#c8d0b9" stroke-width="6"/><path d="M741 367H1139V388H741Z" fill="#e8e1c6"/><text x="915" y="243" text-anchor="middle" font-size="23" fill="#5d735d" letter-spacing="3">LAKESIDE</text><text x="914" y="262" text-anchor="middle" font-size="10" fill="#647761" letter-spacing="4">CINEMA &amp; SOCIAL</text></g>`,{x:735,y:225,w:404,h:166,lx:920,ly:202})}
    ${tree(1155,458,1.5)}${palm(714,453,1.16)}${shrubs(803,427,246)}${palm(494,521,.93)}
    <path d="M0 592L518 441" stroke="#667c6e" stroke-width="6"/><path d="M0 542L518 391" stroke="#789587" stroke-width="5"/><path d="M33 531V583M147 498V551M265 463V516M387 427V482M510 393V445" stroke="#7a9280" stroke-width="5"/>
    ${object('hangout','Take a seat by the lake',bench(225,581,1.04),{x:207,y:538,w:164,h:95,lx:292,ly:518})}
    ${object('exercise','Follow the lakeside path',`<g transform="translate(744 566)"><path d="M0 0H102V54H0Z" fill="#879974"/><path d="M7 6H95V48H7Z" fill="#e5e4cb"/><path d="M26 34Q37 12 52 14L77 21" stroke="#729575" stroke-width="4" fill="none"/><path d="M57 12L77 21L61 30" stroke="#729575" stroke-width="4" fill="none"/><path d="M14 54V88M88 54V88" stroke="#768966" stroke-width="5"/></g>`,{x:743,y:564,w:108,h:89,lx:797,ly:543})}${homeDoor(profile,place,1047,441)}
    <g transform="translate(65 345)"><path d="M0 0H69L54 13H11Z" fill="#bd9671"/><path d="M23 0V-16H48V0" fill="#bd9671"/><path d="M32-16L32-28" stroke="#c8cdb7" stroke-width="2"/></g>`;
}

function villaScene(id,profile,place) {
  const hills = /asokoro|guzape/i.test(place?.name||'');
  return `${sky(id,hills)}<path d="M0 372Q254 329 520 352Q798 313 1200 357V481H0Z" fill="#bdc7ac"/>
    <path d="M247 240H663V429H247Z" fill="#e0dfcd"/><path d="M306 180H624V296H306Z" fill="#e8e5d3"/><path d="M292 173H638V190H292Z" fill="#c0c5b2"/><path d="M239 237H671V253H239Z" fill="#c1c7b6"/>
    <path d="M329 204H482V274H329Z" fill="url(#${id}-glass)"/><path d="M405 204V274" stroke="#d2d9c7" stroke-width="4"/><path d="M508 202H597V275H508Z" fill="url(#${id}-glass)"/><path d="M520 203V274M584 203V274" stroke="#bbc7b2" stroke-width="3"/>
    <path d="M274 282H615V397H274Z" fill="url(#${id}-glass)"/><path d="M287 285V397M379 285V397M473 285V397M606 285V397" stroke="#b9c8b3" stroke-width="7"/><path d="M251 283H658L644 266H263Z" fill="#dfdfcd"/><path d="M269 252V425M632 252V424" stroke="#e4e3ce" stroke-width="12"/>
    <path d="M101 370H742V461H101Z" fill="#bdc7b1"/><path d="M96 366H746V379H96Z" fill="#d5d9c2"/><path d="M418 377H595V461H418Z" fill="#607666"/><path d="M430 386V454M446 386V454M462 386V454M478 386V454M494 386V454M510 386V454M526 386V454M542 386V454M558 386V454M575 386V454" stroke="#7d9280" stroke-width="4"/><path d="M512 378V461" stroke="#ccd3bc" stroke-width="3"/>
    <path d="M800 247H1100V426H800Z" fill="#cfceba"/><path d="M823 235H1074V253H823Z" fill="#e8e1c9"/>${windows(827,269,4,2,43,49)}<path d="M785 380H1150V461H785Z" fill="#b5bfa6"/><path d="M779 377H1156V390H779Z" fill="#d2d7bf"/>
    ${road()}${palm(688,399,1.26)}${palm(251,380,.93)}${tree(37,463,1.59)}${tree(1140,467,1.37)}${shrubs(106,456,298)}${shrubs(617,455,110)}${shrubs(815,457,242)}${lamp(952,539,.86)}
    ${object('hangout','Pause in the neighbourhood garden',bench(666,513,.85),{x:650,y:477,w:146,h:85,lx:724,ly:460})}${object('exercise','Take a neighbourhood walk',`<g transform="translate(363 490)"><path d="M0 0H47V56H0Z" fill="#708669"/><path d="M7 7H40V42H7Z" fill="#d9dfc5"/><path d="M22 14L15 29H22L28 38M22 23L31 27M15 29L9 38" stroke="#638a69" fill="none" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="10" r="3" fill="#638a69"/></g>`,{x:355,y:487,w:65,h:80,lx:388,ly:470})}${homeDoor(profile,place,465,458)}
    ${car(809,602,1.06,'#e4e1d5')}`;
}

function estateScene(id,profile,place) {
  return `${sky(id)}<g>${[80,366,652].map((x,i)=>`<g transform="translate(${x} 205)"><path d="M0 24L123-26L251 24V44H0Z" fill="#a6ac94"/><path d="M15 38H239V221H15Z" fill="${i%2?'#e1d8ba':'#d9ddc7'}"/>${windows(36,66,3,1,43,57)}<path d="M27 133H224V147H27Z" fill="#a8b799"/><path d="M48 148H118V221H48Z" fill="#789281"/><path d="M138 150H205V205H138Z" fill="#8ba192"/><path d="M165 151V204" stroke="#c3d0ba" stroke-width="3"/><path d="M6 217H248V229H6Z" fill="#b4bda1"/></g>`).join('')}</g>
    <path d="M41 393H975V467H41Z" fill="#b9c4ac"/><path d="M41 390H975V402H41Z" fill="#d4d9c0"/><path d="M180 402H272V467H180ZM469 402H558V467H469ZM756 402H846V467H756Z" fill="#758b71"/>
    ${road()}${tree(48,484,1.4)}${tree(1108,484,1.37)}${palm(335,444,.96)}${palm(624,444,.93)}${shrubs(41,462,116)}${shrubs(290,461,152)}${shrubs(576,461,158)}${shrubs(865,463,111)}
    ${object('hangout','Meet in the estate garden',bench(495,515,.9),{x:480,y:475,w:151,h:89,lx:554,ly:457})}${object('exercise','Stretch at the outdoor court',`<g transform="translate(869 487)"><path d="M0 0H111L123 49H-10Z" fill="#829a75"/><path d="M8 8H102L110 39H1Z" fill="none" stroke="#e5e0bd" stroke-width="2"/><path d="M57 7V40" stroke="#e5e0bd" stroke-width="2"/><ellipse cx="57" cy="23" rx="16" ry="8" fill="none" stroke="#e5e0bd" stroke-width="2"/></g>`,{x:858,y:483,w:139,h:63,lx:927,ly:465})}${homeDoor(profile,place,186,465)}${lamp(723,548,.87)}${car(129,603,1,'#a9b9b2')}`;
}

function centralScene(id,profile,place) {
  return `${sky(id,true)}<g transform="translate(70 168)"><path d="M0 65H189V300H0Z" fill="#c6ccbc"/>${windows(15,84,4,3,26,42)}<path d="M0 59H189V71H0Z" fill="#e0e2cb"/></g><g transform="translate(945 134)"><path d="M0 43H159V331H0Z" fill="#bdc7b8"/>${windows(14,67,3,4,31,38)}<path d="M0 39H159V51H0Z" fill="#d7ddc7"/></g>
    <path d="M309 216H847V435H309Z" fill="#dadcca"/><path d="M339 200H817V217H339Z" fill="#c1c7b1"/><path d="M360 213V428M421 213V428M735 213V428M796 213V428" stroke="#f0ecd7" stroke-width="15"/><path d="M459 239H697V415H459Z" fill="url(#${id}-glass)"/><path d="M478 240V414M516 240V414M555 240V414M594 240V414M633 240V414M677 240V414" stroke="#b9c9bb" stroke-width="4"/><path d="M459 294H697M459 353H697" stroke="#b9c9bb" stroke-width="3"/><path d="M345 426H809L829 443H325Z" fill="#bfc9b3"/><path d="M326 443H829L849 459H305Z" fill="#cfd6bf"/><path d="M306 459H849L868 477H285Z" fill="#dce0c8"/>
    ${road()}${shrubs(302,464,100)}${shrubs(749,464,105)}${tree(44,484,1.43)}${tree(1137,486,1.32)}${palm(269,467,1.16)}${palm(890,467,1.16)}
    ${object('hangout','Meet in the civic garden',bench(661,514,.9),{x:645,y:476,w:151,h:91,lx:720,ly:459})}${object('exercise','Walk the boulevard',`<g transform="translate(480 501)"><path d="M0 0H66V31H0Z" fill="#7f926f"/><path d="M10 15H53M45 8L54 15L45 22" stroke="#e9e4c9" stroke-width="3" fill="none"/><path d="M6 32V60M60 32V60" stroke="#6c8267" stroke-width="5"/></g>`,{x:474,y:494,w:81,h:72,lx:514,ly:476})}${homeDoor(profile,place,120,471)}${lamp(994,551,.88)}${car(761,603,1,'#d5d6c8')}${car(134,706,.92,'#9dada8')}`;
}

function townScene(id,profile,place) {
  return `${sky(id,true)}<path d="M12 313H322V448H12Z" fill="#d7d6be"/><path d="M1 310L79 257H282L334 310Z" fill="#8e9980"/>${windows(37,333,4,1,47,66)}<path d="M357 279H709V449H357Z" fill="#d8cba9"/><path d="M341 278H723V293H341Z" fill="#aaa98b"/>${windows(379,303,5,1,45,44)}<path d="M376 367H688V449H376Z" fill="#8eaa97"/><path d="M437 368V449M501 368V449M565 368V449M627 368V449" stroke="#d6ddc5" stroke-width="5"/>
    ${object('hangout','Meet at the neighbourhood café',`<g><path d="M377 365H495L482 349H390Z" fill="#788f68"/><text x="437" y="360" text-anchor="middle" fill="#efe8c9" font-size="12" letter-spacing="1.5">DAILY TABLE</text><g transform="translate(398 461)"><ellipse cx="32" cy="4" rx="37" ry="10" fill="#b39565"/><path d="M32 8V39M17 39H49" stroke="#6c735a" stroke-width="4"/><path d="M-19-9V30M84-9V30M-30-7H-7M71-7H95" stroke="#7b916c" stroke-width="6"/></g></g>`,{x:375,y:348,w:128,h:151,lx:440,ly:328})}
    <path d="M777 329H1119V447H777Z" fill="#d1d4bb"/><path d="M764 330L829 287H1069L1133 330Z" fill="#adb69b"/>${windows(799,350,4,1,55,65)}
    ${road()}${tree(36,485,1.43)}${tree(1130,485,1.28)}${palm(719,452,.94)}${shrubs(781,462,233)}${advertisement(909,198,.91)}
    <g transform="translate(551 456)"><path d="M-11 0H135L124-17H1Z" fill="#81906e"/><path d="M0 0V83M124 0V83" stroke="#697e66" stroke-width="6"/><path d="M7 5H117V64H7Z" fill="#b4c6b1" opacity=".7"/>${bench(15,56,.75)}<path d="M49-8H81" stroke="#e4e2c7" stroke-width="4"/></g>
    ${object('exercise','Follow the shaded footpath',bench(824,513,.9),{x:808,y:475,w:149,h:89,lx:882,ly:457})}${homeDoor(profile,place,164,457)}${lamp(332,545,.85)}${car(733,597,1.09,'#cad1b9')}${car(125,706,.91,'#d0b078')}`;
}

function sceneFor(place) {
  const name = `${place?.id||''} ${place?.name||''}`.toLowerCase();
  if (/jabi/.test(name)) return jabiScene;
  if (/wuse/.test(name)) return wuseScene;
  if (/maitama|asokoro|guzape/.test(name)) return villaScene;
  if (/gwarinpa|life camp|lifecamp/.test(name)) return estateScene;
  if (/central|three arms/.test(name)) return centralScene;
  if (place?.kind === 'town' || /lugbe|airport|utako|kubwa/.test(name)) return townScene;
  return garkiScene;
}

function placedResident(person, x, y, scale, own = false, labelScale = 1) {
  const fullName = person.displayName || person.username || (own ? 'You' : 'Resident');
  const name = fullName.length>18 ? fullName.slice(0,17)+'…' : fullName;
  return `<g class="world-resident ${own?'world-self':'world-other'}" transform="translate(${x} ${y}) scale(${scale})" ${own?'':`role="button" tabindex="0" data-world-resident="${escape(person.id)}" aria-label="View ${escape(name)}'s profile"`}>
    ${residentArt(person.appearance)}
    ${own?'':`<rect class="world-hit" x="35" y="23" width="132" height="249" rx="18"/>`}
    <g class="resident-name" transform="translate(100 0) scale(${labelScale}) translate(-100 0)"><rect x="${100-Math.max(24,name.length*4.2)}" y="-2" width="${Math.max(48,name.length*8.4)}" height="27" rx="13" fill="${own?'#f4eddb':'#edf0df'}"/><text x="100" y="16" text-anchor="middle" fill="#3a5141" font-size="13" font-weight="650">${escape(name)}</text></g>
  </g>`;
}

/** Draw a home or current public zone. Every displayed neighbour is supplied by the server. */
export function renderWorld(container, {profile = {}, place = {}, people = [], onInteract = () => {}, onResident = () => {}} = {}) {
  if (!container) return () => {};
  const id = `abuja-world-${++serial}`;
  const atHome = profile.location?.kind === 'home';
  const districtName = place.name || 'Garki';
  const neighbours = atHome || profile.activeTrip ? [] : people.filter(p => p.id !== profile.id && p.online && p.district === profile.district && p.location?.kind === 'public').slice(0,5);
  container.classList.add('world-canvas');
  let lastWidth = 0;
  const draw = () => {
    const width = container.clientWidth || 1200;
    lastWidth = width;
    const mobile = container.id === 'world-scene' && width <= 600;
    const height = mobile ? Math.max(980,Math.round(440*800/width)) : 780;
    const extra = height-980;
    const scene = atHome ? homeScene(id,profile,mobile,height) : mobile ? mobilePublic(id,profile,place,height) : sceneFor(place)(id,profile,place);
    const slots = mobile ? [[78,649+extra*.2,.58],[576,655+extra*.22,.59],[135,786+extra*.4,.58],[511,799+extra*.4,.61],[347,691+extra*.25,.51]] : [[114,376,.52],[825,382,.54],[366,394,.49],[999,378,.55],[678,391,.50]];
    const residents = neighbours.map((p,i)=>placedResident(p,...slots[i],false,mobile?2.4:1)).join('');
    const self = mobile ? placedResident(profile,atHome?316:313,atHome?678+extra*.4:685+extra*.4,atHome?.78:.82,true,2) : placedResident(profile,atHome?531:514,atHome?478:378,atHome?.75:.58,true);
    container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mobile?800:1200} ${height}" preserveAspectRatio="xMidYMid meet" style="aspect-ratio:${mobile?800:1200}/${height}" class="world-scene ${mobile?'world-portrait ':''}${atHome?'world-interior':'world-public'}" data-home-property="${atHome?escape(profile.home?.propertyId||'garki-studio'):''}" role="group" aria-label="${escape(atHome?'Inside your home':`${districtName} neighbourhood`)}">
      <title>${escape(atHome?'Your home in '+districtName:districtName+' social space')}</title><desc>${atHome?'Select your bed, kitchen, shower, sofa, wardrobe or front door.':'Select a venue, a garden or another resident to interact. This illustrated scene is a game space; the map shows real geography.'}</desc>${definitions(id,profile)}${scene}${residents}${self}
    </svg><div class="world-key"><span class="world-key-dot"></span>${atHome?'Your place':'Out in '+escape(districtName)}<span class="world-key-hint">${atHome?'Touch an object':'Touch a place or resident'}</span></div>`;
    container.querySelectorAll('.world-hit').forEach(hit => {
      const matrix=hit.getScreenCTM();
      if(!matrix)return;
      const sx=Math.hypot(matrix.a,matrix.b),sy=Math.hypot(matrix.c,matrix.d);
      for(const [axis,length,scale] of [['x','width',sx],['y','height',sy]]) {
        const current=Number(hit.getAttribute(length)),target=44/scale;
        if(scale>0&&current<target) {hit.setAttribute(axis,Number(hit.getAttribute(axis))-(target-current)/2);hit.setAttribute(length,target);}
      }
    });
  };
  draw();
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {if(Math.abs(container.clientWidth-lastWidth)>4)draw();}) : null;
  observer?.observe(container);
  const activate = target => {
    const action = target.closest('[data-world-action]');
    if (action && container.contains(action)) {onInteract(action.dataset.worldAction);return;}
    const resident = target.closest('[data-world-resident]');
    if (resident && container.contains(resident)) {
      const person = neighbours.find(p=>String(p.id)===resident.dataset.worldResident);
      if (person) onResident(person);
    }
  };
  const click = e => activate(e.target);
  const key = e => {if((e.key==='Enter'||e.key===' ') && e.target.closest('[data-world-action],[data-world-resident]')) {e.preventDefault();activate(e.target);}};
  container.addEventListener('click',click);
  container.addEventListener('keydown',key);
  return () => {observer?.disconnect();container.removeEventListener('click',click);container.removeEventListener('keydown',key);};
}

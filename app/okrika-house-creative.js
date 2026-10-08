const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const wrap=(value,max=24,{upper=true,limit=3}={})=>{const words=String(value||'').split(/\s+/).filter(Boolean),lines=[];let line='';for(const word of words){const next=(line+' '+word).trim();if(line&&next.length>max){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);const out=lines.slice(0,limit);return upper?out.map(v=>v.toUpperCase()):out;};
const tspan=(lines,x,y,size,gap=Math.round(size*1.02))=>lines.map((line,i)=>`<text x="${x}" y="${y+i*gap}" class="h" font-size="${size}">${esc(line)}</text>`).join('');
const motifs=[
 `<g transform="translate(820 86)"><rect width="255" height="380" rx="38" class="cream"/><rect x="22" y="42" width="211" height="62" rx="18" class="mint"/><rect x="22" y="124" width="94" height="110" rx="20" class="light"/><rect x="139" y="124" width="94" height="110" rx="20" class="light"/><rect x="22" y="255" width="211" height="76" rx="20" class="green"/><circle cx="128" cy="21" r="5" class="dark"/></g>`,
 `<g transform="translate(835 110)"><circle cx="105" cy="105" r="95" fill="none" stroke="#d9efc6" stroke-width="18"/><circle cx="105" cy="105" r="42" class="cream"/><path d="M105 7v44M105 159v44M7 105h44M159 105h44" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="m177 178 75 75" stroke="#f2cf72" stroke-width="24" stroke-linecap="round"/></g>`,
 `<g transform="translate(800 95)"><path d="M20 40h250l-30 300H50z" class="cream"/><path d="M70 40c0-62 150-62 150 0" fill="none" stroke="#d9efc6" stroke-width="18"/><rect x="78" y="106" width="115" height="25" rx="12" class="green"/><rect x="78" y="155" width="145" height="18" rx="9" class="mint"/><rect x="78" y="198" width="110" height="18" rx="9" class="mint"/></g>`,
 `<g transform="translate(795 105)"><rect x="0" y="120" width="290" height="170" rx="34" class="cream"/><rect x="175" y="160" width="92" height="80" rx="12" class="light"/><path d="M35 120 80 50h92l58 70" class="green"/><circle cx="70" cy="304" r="30" class="dark"/><circle cx="230" cy="304" r="30" class="dark"/><circle cx="70" cy="304" r="13" class="mint"/><circle cx="230" cy="304" r="13" class="mint"/></g>`,
 `<g transform="translate(810 86)"><rect x="0" y="0" width="270" height="360" rx="34" class="cream"/><circle cx="82" cy="105" r="44" class="mint"/><circle cx="188" cy="105" r="44" class="light"/><path d="M62 102h40M82 82v40M165 105h46" stroke="#0b4a3b" stroke-width="13" stroke-linecap="round"/><rect x="38" y="186" width="194" height="24" rx="12" class="green"/><rect x="38" y="230" width="154" height="16" rx="8" class="mint"/><rect x="38" y="266" width="178" height="16" rx="8" class="mint"/></g>`,
 `<g transform="translate(805 90)"><circle cx="92" cy="82" r="70" class="cream"/><circle cx="202" cy="156" r="66" class="mint"/><circle cx="105" cy="258" r="76" class="light"/><path d="M75 82h35M92 64v35M176 156h52M71 258h68" stroke="#0b4a3b" stroke-width="13" stroke-linecap="round"/></g>`,
 `<g transform="translate(820 100)"><rect x="0" y="0" width="255" height="330" rx="34" class="cream"/><rect x="24" y="38" width="207" height="96" rx="24" class="mint"/><path d="m61 88 25 21 49-53" fill="none" stroke="#0b4a3b" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><rect x="24" y="160" width="207" height="55" rx="22" class="green"/><rect x="24" y="238" width="95" height="64" rx="22" class="light"/><rect x="136" y="238" width="95" height="64" rx="22" class="light"/></g>`,
 `<g transform="translate(795 95)"><rect x="0" y="0" width="300" height="320" rx="38" class="cream"/><circle cx="75" cy="80" r="38" class="green"/><circle cx="150" cy="80" r="38" class="mint"/><circle cx="225" cy="80" r="38" class="light"/><rect x="40" y="153" width="220" height="23" rx="11" class="green"/><rect x="40" y="202" width="170" height="16" rx="8" class="mint"/><rect x="40" y="240" width="205" height="16" rx="8" class="mint"/></g>`,
];

export function okrikaHouseCreativeDataUrl(ad={}){
 const variant=Math.abs(Number(ad.creativeVariant)||0),layout=variant%motifs.length;
 const bg=layout%3===0?'#063e34':layout%3===1?'#0a5443':'#123f38';
 const accent=['#d9efc6','#f2cf72','#e8f3df','#b8dfbd'][variant%4];
 const title=String(ad.title||'OKRIKA').toUpperCase().slice(0,36);
 const headline=wrap(ad.headline||ad.body||'Buy. Sell. Discover.',19);
 const body=wrap(String(ad.body||'').slice(0,120),46,{upper:false,limit:2}),domain=ad.domain||'okrika.store',email=ad.email||'hello@okrika.store',eyebrow=ad.eyebrow||'OKRIKA',cta=ad.cta||'Visit Okrika';
 const titleY=headline.length>2?190:215,bodyY=titleY+headline.length*58+38;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
 <style>.h{font-family:Arial,Helvetica,sans-serif;font-weight:900;letter-spacing:-1px;fill:#fff}.s{font-family:Arial,Helvetica,sans-serif;font-weight:700;fill:#dce9df}.cap{font-family:Arial,Helvetica,sans-serif;font-weight:800;letter-spacing:3px;fill:${accent}}.cream{fill:#f8f5e9}.mint{fill:#cfe7d2}.light{fill:#eef3e8}.green{fill:#16966f}.dark{fill:#073c33}</style>
 <rect width="1200" height="675" rx="34" fill="${bg}"/>
 <circle cx="${1100-(variant%5)*26}" cy="${70+(variant%4)*22}" r="${180+(variant%3)*35}" fill="${accent}" opacity=".08"/>
 <text x="62" y="64" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="900" fill="#fff">◉ Okrika</text>
 <text x="62" y="130" class="cap" font-size="18">${esc(eyebrow)} · ${esc(title)}</text>
 ${tspan(headline,62,titleY,48,51)}
 ${body.map((line,i)=>`<text x="62" y="${bodyY+i*30}" class="s" font-size="23">${esc(line)}</text>`).join('')}
 ${motifs[layout]}
 <rect x="62" y="555" width="1076" height="2" fill="#fff" opacity=".16"/>
 <text x="62" y="608" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="900" fill="${accent}">${esc(domain)}</text>
 <text x="875" y="608" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#dce9df">${esc(email)}</text>
 <text x="1138" y="608" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="900" fill="#fff">${esc(cta)} ↗</text>
 </svg>`;
 return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

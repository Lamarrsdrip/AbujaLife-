import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import zlib from 'node:zlib';

function decodedPNG(filename) {
  const buffer=fs.readFileSync(filename);
  assert.deepEqual([...buffer.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  let offset=8;const idat=[];let header,ended=false;
  while(offset<buffer.length){
    const length=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8);
    assert.ok(offset+12+length<=buffer.length,`${filename}: truncated ${type}`);
    const data=buffer.subarray(offset+8,offset+8+length);
    if(type==='IHDR')header={width:data.readUInt32BE(0),height:data.readUInt32BE(4),channels:data[9]===6?4:3};
    if(type==='IDAT')idat.push(data);
    if(type==='IEND')ended=true;
    offset+=length+12;
  }
  assert.ok(ended,`${filename}: missing image end`);
  const pixels=zlib.inflateSync(Buffer.concat(idat));
  assert.equal(pixels.length,(header.width*header.channels+1)*header.height,`${filename}: invalid decoded pixels`);
  const rows=[];const stride=header.width*header.channels;
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<header.height;y++){
    const row=Buffer.from(pixels.subarray(y*(stride+1)+1,(y+1)*(stride+1))),filter=pixels[y*(stride+1)],prior=rows[y-1];
    for(let x=0;x<stride;x++){const a=x>=header.channels?row[x-header.channels]:0,b=prior?.[x]||0,c=x>=header.channels?(prior?.[x-header.channels]||0):0;row[x]=(row[x]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}
    rows.push(row);
  }
  return {...header,pixels:Buffer.concat(rows)};
}

test('checked-in branding exports decode completely at their declared icon and preview dimensions',()=>{
  const manifest=JSON.parse(fs.readFileSync('app/manifest.webmanifest','utf8'));
  for(const icon of manifest.icons.filter(i=>i.type==='image/png')){
    assert.match(icon.src,/-v3\.png$/);
    const image=decodedPNG(`app${icon.src}`);assert.equal(`${image.width}x${image.height}`,icon.sizes);
  }
  for(const size of [48,180,192,512])assert.equal(decodedPNG(`app/icons/abujalife-city-gate-${size}-v3.png`).width,size);
  const social=decodedPNG('app/social/abujalife-city-gate-v3.png');assert.equal(social.width,1200);assert.equal(social.height,630);
  for(const filename of ['app/icons/abujalife-city-gate-180-v3.png','app/icons/abujalife-city-gate-maskable-512-v3.png']){
    const image=decodedPNG(filename);
    if(image.channels===4)for(let i=3;i<image.pixels.length;i+=4)assert.equal(image.pixels[i],255,`${filename}: install artwork must have an opaque background`);
  }
  const ico=fs.readFileSync('app/favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
  for(let i=0;i<3;i++){const p=6+i*16,length=ico.readUInt32LE(p+8),offset=ico.readUInt32LE(p+12);assert.ok(offset+length<=ico.length);assert.deepEqual([...ico.subarray(offset,offset+8)],[137,80,78,71,13,10,26,10]);}
});

test('all social and install entry points use the current versioned artwork',()=>{
  const html=fs.readFileSync('app/index.html','utf8');
  assert.match(html,/twitter:card" content="summary_large_image"/);
  for(const type of ['og:image','og:image:secure_url','twitter:image'])assert.ok(html.includes(`${type}" content="https://abujacity.life/social/abujalife-x-card-20261008.jpg"`));
  assert.match(html,/og:image:width" content="1200"/);assert.match(html,/og:image:height" content="630"/);
  assert.match(html,/apple-touch-icon[^>]+abujalife-city-gate-180-v3\.png/);
  assert.match(html,/shortcut icon[^>]+favicon\.ico\?v=abuja-brand-v3/);
  assert.doesNotMatch(html,/abuja-brand-v2|share-v2/);
});

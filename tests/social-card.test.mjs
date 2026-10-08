import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const title='AbujaLife — Live the City';
const description='Explore Abuja. Build your life. Meet people, discover the city and create your own Abuja story.';
const imageURL='https://abujacity.life/social/abujalife-x-card-20261008.jpg';

test('initial HTML has one consistent canonical large-image social card',()=>{
 const html=fs.readFileSync('app/index.html','utf8'),head=html.match(/<head>([\s\S]*?)<\/head>/)[1];
 const fields=new Map();
 for(const tag of head.matchAll(/<meta\b[^>]*>/g)){
  const attrs=Object.fromEntries([...tag[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  const key=attrs.name||attrs.property;if(!key)continue;
  assert.ok(!fields.has(key),`Conflicting or duplicate metadata: ${key}`);fields.set(key,attrs.content);
 }
 for(const key of ['og:title','twitter:title'])assert.equal(fields.get(key),title);
 for(const key of ['description','og:description','twitter:description'])assert.equal(fields.get(key),description);
 for(const key of ['og:image','og:image:secure_url','twitter:image'])assert.equal(fields.get(key),imageURL);
 assert.equal(fields.get('og:type'),'website');assert.equal(fields.get('og:site_name'),'AbujaLife');
 assert.equal(fields.get('og:url'),'https://abujacity.life/');assert.equal(fields.get('twitter:card'),'summary_large_image');
 assert.equal(fields.get('og:image:width'),'1200');assert.equal(fields.get('og:image:height'),'630');assert.equal(fields.get('og:image:type'),'image/jpeg');
 assert.deepEqual([...head.matchAll(/<title>(.*?)<\/title>/g)].map(m=>m[1]),[title]);
 assert.deepEqual([...head.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/g)].map(m=>m[1]),['https://abujacity.life/']);
 assert.doesNotMatch(head,/Your city, your story|social\/abujalife-city-gate-v3\.png|localhost|127\.0\.0\.1/);
 assert.equal(head.includes('<script'),false,'Social metadata must precede client JavaScript');
 const manifest=JSON.parse(fs.readFileSync('app/manifest.webmanifest','utf8'));
 assert.ok(manifest.icons.every(icon=>!icon.src.includes('x-card')),'Social marketing artwork must not replace PWA icons');
});

test('the dated public social asset is a complete optimized 1200 by 630 JPEG',()=>{
 const bytes=fs.readFileSync('app/social/abujalife-x-card-20261008.jpg');
 assert.equal(bytes.readUInt16BE(0),0xffd8);assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9);
 assert.ok(bytes.length<350_000,'Keep crawler downloads small');
 let offset=2,dimensions;
 while(offset<bytes.length-2){
  assert.equal(bytes[offset],255);while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];if(marker===0xda||marker===0xd9)break;
  const length=bytes.readUInt16BE(offset);assert.ok(length>=2&&offset+length<=bytes.length);
  if([0xc0,0xc1,0xc2].includes(marker)){dimensions={height:bytes.readUInt16BE(offset+3),width:bytes.readUInt16BE(offset+5)};break;}
  offset+=length;
 }
 assert.deepEqual(dimensions,{width:1200,height:630});
 const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
 assert.notEqual(hash(bytes),hash(fs.readFileSync('app/social/abujalife-city-gate-v3.png')));
});

test('crawler policy permits the public card and HTTP www redirects directly to canonical HTTPS',()=>{
 const robots=fs.readFileSync('app/robots.txt','utf8');
 assert.match(robots,/User-agent: \*\nAllow: \/\n/);assert.doesNotMatch(robots,/Disallow: \/\s*$/m);
 const caddy=fs.readFileSync('deploy/windows/configure-frontend.ps1','utf8');
 assert.match(caddy,/http:\/\/www\.abujacity\.life\s*\{\s*redir https:\/\/abujacity\.life\{uri\} 308\s*\}/);
 assert.match(caddy,/script-src 'self';/);assert.doesNotMatch(caddy,/script-src[^;]*unsafe-inline/);
 const build=fs.readFileSync('scripts/build-production.mjs','utf8');assert.match(build,/sourceDirectory, 'robots\.txt'/);
});

import zlib from 'node:zlib';

const COLORS = Object.freeze({
  green: [31, 80, 59, 255],
  deep: [27, 72, 53, 255],
  green2: [51, 112, 83, 255],
  cream: [244, 241, 230, 255],
  gold: [224, 186, 105, 255],
  stone: [240, 209, 138, 255],
  stoneLight: [249, 230, 185, 255],
  stoneDark: [202, 147, 68, 255],
  road: [53, 99, 77, 255],
  lane: [255, 240, 200, 255],
  ink: [24, 53, 41, 255],
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function png(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1); raw[row] = 0;
    pixels.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function canvas(width, height, background = COLORS.cream) {
  const pixels = Buffer.alloc(width * height * 4);
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (Math.floor(y) * width + Math.floor(x)) * 4;
    pixels[i] = color[0]; pixels[i+1] = color[1]; pixels[i+2] = color[2]; pixels[i+3] = color[3] ?? 255;
  };
  const fill = color => { for (let y=0;y<height;y++) for (let x=0;x<width;x++) set(x,y,color); };
  fill(background);
  return { width, height, pixels, set };
}

function rect(c, x0, y0, x1, y1, color) {
  const sx=Math.max(0,Math.floor(x0)), ex=Math.min(c.width,Math.ceil(x1));
  const sy=Math.max(0,Math.floor(y0)), ey=Math.min(c.height,Math.ceil(y1));
  for(let y=sy;y<ey;y++) for(let x=sx;x<ex;x++) c.set(x,y,color);
}
function ellipse(c, cx, cy, rx, ry, color) {
  const x0=Math.floor(cx-rx), x1=Math.ceil(cx+rx), y0=Math.floor(cy-ry), y1=Math.ceil(cy+ry);
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) if(((x-cx)**2)/(rx**2)+((y-cy)**2)/(ry**2)<=1)c.set(x,y,color);
}
function roundedRect(c, x0, y0, x1, y1, radius, color) {
  rect(c,x0+radius,y0,x1-radius,y1,color); rect(c,x0,y0+radius,x1,y1-radius,color);
  ellipse(c,x0+radius,y0+radius,radius,radius,color); ellipse(c,x1-radius,y0+radius,radius,radius,color);
  ellipse(c,x0+radius,y1-radius,radius,radius,color); ellipse(c,x1-radius,y1-radius,radius,radius,color);
}
function polygon(c, pts, color) {
  const minY=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1]))));
  const maxY=Math.min(c.height-1,Math.ceil(Math.max(...pts.map(p=>p[1]))));
  for(let y=minY;y<=maxY;y++) {
    const nodes=[];
    for(let i=0,j=pts.length-1;i<pts.length;j=i++) {
      const [xi,yi]=pts[i],[xj,yj]=pts[j];
      if((yi<y&&yj>=y)||(yj<y&&yi>=y)) nodes.push(xi+(y-yi)/(yj-yi)*(xj-xi));
    }
    nodes.sort((a,b)=>a-b);
    for(let k=0;k+1<nodes.length;k+=2) rect(c,nodes[k],y,nodes[k+1]+1,y+1,color);
  }
}
function line(c,x0,y0,x1,y1,width,color){
  const steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);
  for(let i=0;i<=steps;i++){const t=i/steps;ellipse(c,x0+(x1-x0)*t,y0+(y1-y0)*t,width/2,width/2,color);}
}
function gate(c,cx,cy,scale=1){
  const P=(x,y)=>[cx+x*scale,cy+y*scale];
  polygon(c,[P(-68,78),P(68,78),P(126,190),P(-126,190)],COLORS.road);
  line(c,...P(0,90),...P(0,178),7*scale,COLORS.lane);
  roundedRect(c,...P(-132,-67),...P(-61,90),10*scale,COLORS.stone);
  roundedRect(c,...P(61,-67),...P(132,90),10*scale,COLORS.stone);
  polygon(c,[P(-90,-41),P(-58,-101),P(0,-132),P(58,-101),P(90,-41),P(57,-24),P(31,-63),P(0,-81),P(-31,-63),P(-57,-24)],COLORS.stone);
  roundedRect(c,...P(-84,-28),...P(84,10),7*scale,COLORS.stoneDark);
  rect(c,...P(-50,10),...P(50,90),COLORS.deep);
  rect(c,...P(-117,-49),...P(-80,63),COLORS.stoneLight);
  rect(c,...P(80,-49),...P(117,63),COLORS.stoneLight);
}

const GLYPHS = Object.freeze({
  'A': [[[0,7],[2,0]],[[2,0],[4,7]],[[1,4],[3,4]]],
  'B': [[[0,0],[0,7]],[[0,0],[3,0]],[[3,0],[4,1]],[[4,1],[4,3]],[[4,3],[3,4]],[[3,4],[0,4]],[[3,4],[4,5]],[[4,5],[4,6]],[[4,6],[3,7]],[[3,7],[0,7]]],
  'C': [[[4,0],[1,0]],[[1,0],[0,1]],[[0,1],[0,6]],[[0,6],[1,7]],[[1,7],[4,7]]],
  'E': [[[4,0],[0,0]],[[0,0],[0,7]],[[0,4],[3,4]],[[0,7],[4,7]]],
  'F': [[[4,0],[0,0]],[[0,0],[0,7]],[[0,4],[3,4]]],
  'G': [[[4,1],[3,0]],[[3,0],[1,0]],[[1,0],[0,1]],[[0,1],[0,6]],[[0,6],[1,7]],[[1,7],[4,7]],[[4,7],[4,4]],[[4,4],[2,4]]],
  'I': [[[0,0],[4,0]],[[2,0],[2,7]],[[0,7],[4,7]]],
  'J': [[[0,0],[4,0]],[[3,0],[3,6]],[[3,6],[2,7]],[[2,7],[0,7]],[[0,7],[0,5]]],
  'L': [[[0,0],[0,7]],[[0,7],[4,7]]],
  'M': [[[0,7],[0,0]],[[0,0],[2,3]],[[2,3],[4,0]],[[4,0],[4,7]]],
  'O': [[[1,0],[3,0]],[[3,0],[4,1]],[[4,1],[4,6]],[[4,6],[3,7]],[[3,7],[1,7]],[[1,7],[0,6]],[[0,6],[0,1]],[[0,1],[1,0]]],
  'P': [[[0,7],[0,0]],[[0,0],[3,0]],[[3,0],[4,1]],[[4,1],[4,3]],[[4,3],[3,4]],[[3,4],[0,4]]],
  'R': [[[0,7],[0,0]],[[0,0],[3,0]],[[3,0],[4,1]],[[4,1],[4,3]],[[4,3],[3,4]],[[3,4],[0,4]],[[2,4],[4,7]]],
  'S': [[[4,0],[1,0]],[[1,0],[0,1]],[[0,1],[0,3]],[[0,3],[1,4]],[[1,4],[3,4]],[[3,4],[4,5]],[[4,5],[4,6]],[[4,6],[3,7]],[[3,7],[0,7]]],
  'T': [[[0,0],[4,0]],[[2,0],[2,7]]],
  'U': [[[0,0],[0,6]],[[0,6],[1,7]],[[1,7],[3,7]],[[3,7],[4,6]],[[4,6],[4,0]]],
  'Y': [[[0,0],[2,3]],[[4,0],[2,3]],[[2,3],[2,7]]],
});
function vectorText(c, text, x, y, scale, color, stroke = Math.max(2, scale * 0.42), tracking = scale * 1.65) {
  let cursor=x;
  for (const raw of text.toUpperCase()) {
    if(raw===' '){cursor += scale*3.5; continue;}
    const glyph=GLYPHS[raw];
    if(glyph) for(const [[x0,y0],[x1,y1]] of glyph) line(c,cursor+x0*scale,y+y0*scale,cursor+x1*scale,y+y1*scale,stroke,color);
    cursor += scale*4 + tracking;
  }
  return cursor;
}

function icon(size, maskable=false) {
  const c=canvas(size,size,COLORS.green);
  ellipse(c,size*0.18,size*0.18,size*0.52,size*0.52,COLORS.green2);
  ellipse(c,size*0.86,size*0.12,size*0.25,size*0.25,COLORS.gold);
  const margin=size*(maskable?0.10:0.07);
  roundedRect(c,margin,margin,size-margin,size-margin,size*0.18,COLORS.deep);
  gate(c,size/2,size*0.44,size/(maskable?600:560));
  return png(size,size,c.pixels);
}

function socialCard() {
  const w=1200,h=630,c=canvas(w,h,COLORS.cream);
  roundedRect(c,42,42,450,588,54,COLORS.deep);
  ellipse(c,120,650,390,285,[35,82,61,255]);
  ellipse(c,1090,20,180,180,[232,216,174,255]);
  gate(c,246,260,1.05);
  vectorText(c,'ABUJALIFE',520,122,14,COLORS.ink,6,13);
  vectorText(c,'YOUR CITY YOUR STORY',522,266,6,[176,118,57,255],3,6);
  vectorText(c,'MULTIPLAYER ABUJA',522,360,5,[73,91,83,255],2.4,5);
  roundedRect(c,520,454,930,522,34,[226,236,225,255]);
  vectorText(c,'ABUJACITY LIFE',548,472,4.2,COLORS.deep,2.2,4.2);
  roundedRect(c,520,552,720,558,3,[176,118,57,255]);
  return png(w,h,c.pixels);
}

export function generateBrandRasterAssets() {
  return Object.freeze({
    'icons/apple-touch-icon.png': icon(180),
    'icons/icon-192.png': icon(192),
    'icons/icon-512.png': icon(512),
    'icons/icon-maskable-512.png': icon(512,true),
    'social/abujalife-share-v2.png': socialCard(),
  });
}

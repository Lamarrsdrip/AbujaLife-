// Lightweight, instanced-friendly silhouettes for real Abuja references used by the game.
// These are authored approximations for navigation and atmosphere, not architectural replicas.
const palette=['#d7b16d','#6e9da0','#b97569','#80976d','#d9d0b9','#7d739b'];

export const REAL_ABUJA_PLACE_IDS=Object.freeze([
  'city-gate-plaza','aso-rock-view','cbn-experience','magicland','farm-city','transcorp-hilton-hub',
  'millennium-park-hub','eagle-square-hub','national-mosque-hub','national-christian-centre-hub','national-stadium-hub',
]);

export function buildRealAbujaPlace({venue,box,add,tree,building}) {
  const {id,x,z}=venue;
  if(id==='city-gate-plaza'){
    box('#d8ddcf',x,2,z,150,4,108);box('#c9cdbf',x,4,z,136,4,18);
    for(const side of [-1,1]){
      box('#f2f1e9',x+side*36,48,z,17,92,28);box('#ecece3',x+side*43,18,z,31,31,40);
    }
    box('#f3f1e9',x,39,z+1,79,10,20);box('#377c55',x,58,z+2,25,16,5);
    box('#385b55',x,8,z-41,118,4,15);for(const side of [-1,1])tree(x+side*64,z+42,.9,true);
    venue.height=118;return true;
  }
  if(id==='aso-rock-view'){
    box('#c9cbb8',x,3,z+24,150,5,88);box('#9ca488',x,2,z-52,176,4,58);
    const rocks=[[-47,42,42,69,45],[-12,55,59,93,61],[34,47,50,79,54],[67,35,36,58,43]];
    for(const [dx,y,w,h,d] of rocks)add('sphere','#8f9587',x+dx,y,z-72,w,h,d);
    box('#697365',x,12,z+45,82,6,15);for(const side of[-1,1])tree(x+side*63,z+38,.85);
    venue.height=128;return true;
  }
  if(id==='cbn-experience'){
    box('#c7c6b4',x,3,z,146,6,102);building(x,z-5,95,72,166,'#d5cdb9',1);
    box('#6f999d',x,90,z+38,68,111,4);box('#c39b63',x,14,z+52,118,13,22);
    for(const side of[-1,1])box('#e1ddcf',x+side*55,31,z+35,9,52,9);
    venue.height=205;return true;
  }
  if(id==='magicland'){
    box('#87a979',x,3,z,170,6,132);box('#d7c59d',x,5,z+38,145,3,20);
    building(x-48,z-36,66,48,42,'#d7b27d',2);
    const radius=43,cx=x+42,cz=z-23;
    add('cylinder','#8a806d',cx,35,cz,5,70,5);
    for(let i=0;i<12;i++){
      const a=i*Math.PI*2/12,px=cx+Math.cos(a)*radius,py=45+Math.sin(a)*radius;
      add('sphere',palette[i%palette.length],px,py,cz,8,8,8);
    }
    box('#697d76',cx,46,cz,4,92,4);box('#e3d7b5',cx,5,cz,94,4,11);
    for(const side of[-1,1])tree(x+side*72,z+50,.9,true);
    venue.height=120;return true;
  }
  if(id==='farm-city'){
    box('#a1b48c',x,3,z,158,6,116);building(x,z-22,130,63,56,'#c6b28c',2);
    box('#8a7558',x,8,z+43,132,5,36);for(let i=0;i<5;i++)box('#ded0ad',x-52+i*26,14,z+42,18,4,18);
    for(const side of[-1,1])tree(x+side*68,z+42,.85,true);venue.height=86;return true;
  }
  if(id==='transcorp-hilton-hub'){
    box('#a9b99a',x,3,z,190,6,132);building(x,z-18,158,62,156,'#c7bba5',1);
    box('#81aaa7',x+53,7,z+47,72,4,31);box('#e5dcc3',x+53,4,z+47,86,3,42);
    for(let i=0;i<6;i++)tree(x-77+i*30,z+55,.75,true);venue.height=205;return true;
  }
  if(id==='millennium-park-hub'){
    box('#789b71',x,3,z,184,6,146);box('#d8cfae',x,5,z,22,3,138);box('#d8cfae',x,5,z,174,3,18);
    add('cylinder','#d6d1b7',x,8,z,25,5,25);add('cylinder','#6ea6aa',x,12,z,20,4,20);add('sphere','#d5ece0',x,21,z,5,14,5);
    for(let i=0;i<10;i++){const a=i*Math.PI*2/10;tree(x+Math.cos(a)*72,z+Math.sin(a)*54,.85,i%3===0);}
    venue.height=82;return true;
  }
  if(id==='eagle-square-hub'){
    box('#d7d2bd',x,3,z,180,6,140);box('#b7a982',x,6,z,118,4,84);box('#7c8d7c',x,13,z-28,74,16,26);
    for(const side of[-1,1]){add('cylinder','#647d76',x+side*58,34,z+26,2,60,2);box(side<0?'#2f8557':'#e8e5d6',x+side*52,50,z+26,13,23,2);}
    box('#ece5cc',x,10,z+53,132,5,14);venue.height=96;return true;
  }
  if(id==='national-mosque-hub'){
    box('#cbd2b8',x,3,z,152,6,116);building(x,z,105,78,62,'#ded6bd',1);
    add('sphere','#c7aa64',x,90,z,42,29,40);
    for(const side of[-1,1]){add('cylinder','#e2dcc8',x+side*53,65,z-28,7,125,7);add('cone','#c4a45f',x+side*53,134,z-28,12,23,12);}
    venue.height=170;return true;
  }
  if(id==='national-christian-centre-hub'){
    box('#c9d0b8',x,3,z,150,6,114);building(x,z,108,76,80,'#ddd1b6',1);
    box('#d9bc79',x,124,z,7,64,7);box('#d9bc79',x,137,z,47,7,7);venue.height=176;return true;
  }
  if(id==='national-stadium-hub'){
    box('#a4b693',x,2,z,186,4,150);add('cylinder','#d9d5c2',x,18,z,160,28,126);add('cylinder','#506b61',x,34,z,132,13,98);add('cylinder','#6e9a68',x,42,z,92,5,60);
    box('#d8cba8',x,46,z,68,2,7);venue.height=94;return true;
  }
  return false;
}

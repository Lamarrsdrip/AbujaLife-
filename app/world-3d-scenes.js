// Original, procedural AbujaLife sets. All models and surface textures are local.
// Floor coordinates remain identical to the gameplay/collision coordinates.
import { vehicleFor } from '../src/shared/vehicles.mjs';

export function buildThreeEnvironment(T, {scene: layout, profile = {}, kind, venue, place, depthScale = Math.SQRT2, modelOnly} = {}) {
  const group = new T.Group();
  group.name = 'AbujaLife authored 3D environment';
  const geometries = new Map(), materials = new Map(), textures = [];
  const water = [], movingCars = [], nightBeams=[], clubLights=[];
  const ds = depthScale;
  const isClub=venue?.kind==='club'||['club','club-cage','magic-city','bear-barn'].includes(venue?.id);
  const indoor = kind === 'home' || kind === 'visit' || (kind === 'venue' && !['park', 'jabi-lake'].includes(venue?.id));
  const mat = (color, roughness = .76, metalness = 0, extra = {}) => {
    const key = JSON.stringify([color, roughness, metalness, extra]);
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({color, roughness, metalness, ...extra}));
    return materials.get(key);
  };
  function geo(key, create) {if (!geometries.has(key)) geometries.set(key, create()); return geometries.get(key);}
  function mesh(parent, geometry, material, x=0, y=0, z=0, shadow=true) {
    const m = new T.Mesh(geometry, material); m.position.set(x,y,z);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(p, x,y,z,w,h,d,color, rounded=false, shadow=true) {
    const key = `box:${w}:${h}:${d}:${rounded}`;
    const geometry=geo(key,()=> {
      if (!rounded || Math.min(w,h,d)<8) return new T.BoxGeometry(w,h,d);
      const radius=Math.min(4,w/8,h/8,d/8), shape=new T.Shape();
      const l=-w/2+radius,r=w/2-radius,b=-h/2+radius,t=h/2-radius;
      shape.moveTo(l,b-radius);shape.lineTo(r,b-radius);shape.quadraticCurveTo(r+radius,b-radius,r+radius,b);
      shape.lineTo(r+radius,t);shape.quadraticCurveTo(r+radius,t+radius,r,t+radius);
      shape.lineTo(l,t+radius);shape.quadraticCurveTo(l-radius,t+radius,l-radius,t);
      shape.lineTo(l-radius,b);shape.quadraticCurveTo(l-radius,b-radius,l,b-radius);
      const g=new T.ExtrudeGeometry(shape,{depth:Math.max(1,d-radius*2),bevelEnabled:true,bevelThickness:radius,bevelSize:radius*.4,bevelSegments:2,steps:1,curveSegments:3});
      g.translate(0,0,-d/2+radius);return g;
    });
    return mesh(p,geometry,typeof color==='string'?mat(color):color,x,y,z,shadow);
  }
  function ball(p,x,y,z,rx,ry,rz,color,segments=10) {
    const m=mesh(p,geo(`sphere:${segments}`,()=>new T.SphereGeometry(1,segments,8)),typeof color==='string'?mat(color):color,x,y,z);
    m.scale.set(rx,ry,rz);return m;
  }
  function cylinder(p,x,y,z,r,h,color,top=r,segments=12) {
    return mesh(p,geo(`cyl:${r}:${top}:${h}:${segments}`,()=>new T.CylinderGeometry(top,r,h,segments)),typeof color==='string'?mat(color):color,x,y,z);
  }
  function leg(p,x,z,height=35,color='#73533d') {box(p,x,height/2,z,6,height,6,color);}
  function surfaceTexture(type) {
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const c=canvas.getContext('2d');if(!c)return null;
    let seed=9137;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    if(type==='wood') {
      c.fillStyle='#b39472';c.fillRect(0,0,256,256);
      for(let row=0;row<8;row++) {
        c.fillStyle=['#bc9c77','#b69670','#c3a47f','#ae906d'][row%4];c.fillRect(0,row*32,256,31);
        c.strokeStyle='#846f5440';c.lineWidth=1;c.beginPath();c.moveTo(0,row*32);c.lineTo(256,row*32);c.stroke();
        for(let i=0;i<23;i++){c.strokeStyle=i%3?'#705a3920':'#f0d7af26';const y=row*32+2+random()*27;c.beginPath();const x=random()*256;c.moveTo(x,y);c.bezierCurveTo(x+35,y-1,x+61,y+2,x+100,y);c.stroke();}
        c.fillStyle='#705a3940';c.fillRect((row%2)*128,row*32,1,32);
      }
    } else if(type==='tile'||type==='bath') {
      c.fillStyle=type==='bath'?'#afc2bc':'#d8d3c8';c.fillRect(0,0,256,256);
      for(let i=0;i<380;i++){c.fillStyle=i%2?'#b3ab9b10':'#ffffff20';c.fillRect(random()*256,random()*256,random()*14,1);}
      c.strokeStyle=type==='bath'?'#eff5ed':'#a9a69f';c.lineWidth=2;
      for(let i=0;i<=4;i++){c.beginPath();c.moveTo(i*64,0);c.lineTo(i*64,256);c.moveTo(0,i*64);c.lineTo(256,i*64);c.stroke();}
    } else {
      c.fillStyle=type==='road'?'#454c51':'#627854';c.fillRect(0,0,256,256);
      for(let i=0;i<2200;i++){c.fillStyle=i%2?'#ffffff13':'#00000012';c.fillRect(random()*256,random()*256,1.5,1.5);}
    }
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    texture.wrapS=texture.wrapT=T.RepeatWrapping;textures.push(texture);return texture;
  }
  function floor(parent,x,y,w,h,type='wood',height=0) {
    const texture=surfaceTexture(type==='oak'||type==='darkoak'?'wood':type);
    if(texture)texture.repeat.set(Math.max(1,w/240),Math.max(1,h/240));
    const material=new T.MeshStandardMaterial({color:type==='darkoak'?'#796b61':'#ffffff',map:texture,roughness:type==='tile'?.4:.86,metalness:0});materials.set(`floor:${materials.size}`,material);
    return box(parent,x+w/2,height-2,(y+h/2)*ds,w,4,h*ds,material,false,false);
  }
  const wood=mat('#a98761'), darkWood=mat('#6c4d36'), cream=mat('#e9e0cb'), linen=mat('#e6dfd1'), green=mat('#506959'), metal=mat('#485158',.35,.6), glass=mat('#86adb4',.19,.08,{transparent:true,opacity:.43});
  function plant(p,w=40,h=40) {
    cylinder(p,0,11,0,w*.35,23,'#b58461',w*.43);
    cylinder(p,0,24,0,w*.4,3,'#4b4233');
    for(let i=0;i<6;i++) {
      const a=i*2.39996, yy=46+(i%3)*18;
      const stem=cylinder(p,Math.sin(a)*5,yy-10,Math.cos(a)*5,1.2,yy-22,'#365b37',1,6);stem.rotation.z=Math.sin(a)*.2;
      const leaf=ball(p,Math.sin(a)*w*.45,yy,Math.cos(a)*h*.43,w*.27,15,5,i%2?'#527649':'#3d663e');leaf.rotation.z=-Math.sin(a)*.5;
    }
  }
  function chair(p,w,h,color='#bb9a75') {
    for(const x of [-w*.34,w*.34])for(const z of [-h*.3,h*.3])leg(p,x,z,29);
    box(p,0,31,0,w*.94,12,h*.86,color,true);
    box(p,0,58,-h*.38,w*.92,49,11,color,true);
    box(p,-w*.46,43,0,8,20,h*.76,color,true);box(p,w*.46,43,0,8,20,h*.76,color,true);
  }
  function tabletop(p,w,h,height=44) {
    for(const x of [-w*.38,w*.38])for(const z of [-h*.34,h*.34])leg(p,x,z,height-4);
    box(p,0,height,0,w,7,h,wood,true);
  }
  function cup(p,x,y,z) {cylinder(p,x,y,z,5,9,'#ece5d6',5);cylinder(p,x,y+5,z,4.2,.8,'#5d3d2d');}
  function objectModel(type,w,h,source={}) {
    const p=new T.Group();p.name=type||'fixture';
    switch(type) {
      case 'king-bed':case 'bed': {
        for(const x of [-w*.4,w*.4])for(const z of [-h*.42,h*.42])leg(p,x,z,16);
        box(p,0,21,0,w,19,h,darkWood,true);box(p,0,36,0,w*.95,18,h*.94,linen,true);
        box(p,0,63,-h*.48,w+3,75,13,wood,true);
        box(p,0,48,h*.14,w*.94,7,h*.59,type==='king-bed'?'#3d5866':'#5f7472',true);
        for(const x of [-w*.25,w*.25]){const pillow=box(p,x,49,-h*.33,w*.4,12,h*.16,'#f4eddf',true);pillow.rotation.y=x<0?.07:-.04;}
        box(p,0,53,h*.31,w*.94,4,h*.13,'#c5bba7',true);break;
      }
      case 'premium-sofa':case 'sofa': {
        const frame=type==='premium-sofa'?mat('#624739',.4,.02):mat('#6d7568'),upholstery=type==='premium-sofa'?mat('#927055',.48):mat('#9ba68f'),back=type==='premium-sofa'?mat('#856149',.48):mat('#929e88');
        for(const x of [-w*.4,w*.4])for(const z of [-h*.33,h*.33])leg(p,x,z,15);
        box(p,0,28,0,w,25,h,frame,true);box(p,0,59,-h*.36,w,51,h*.24,back,true);
        const seats=w>200?3:2;for(let i=0;i<seats;i++){box(p,-w/2+(i+.5)*w/seats,43,6,w/seats-5,13,h*.65,upholstery,true);box(p,-w/2+(i+.5)*w/seats,67,-h*.28,w/seats-6,40,14,back,true);}
        box(p,-w*.47,52,0,w*.11,42,h,back,true);box(p,w*.47,52,0,w*.11,42,h,back,true);
        const cushion=box(p,-w*.27,70,3,30,30,12,'#c6a579',true);cushion.rotation.z=.13;break;
      }
      case 'chair':case 'lounge-chair':case 'cinema-chair':chair(p,w,h,type==='cinema-chair'?'#805a52':'#b69b77');break;
      case 'coffee-table':tabletop(p,w,h,33);box(p,-w*.18,39,0,w*.3,3,h*.36,'#d5d0ba');cup(p,w*.28,40,0);break;
      case 'dining-table':case 'table':case 'picnic-table': {
        tabletop(p,w*.7,h*.7,49);
        for(const z of [-h*.44,h*.44])for(const x of [-w*.25,w*.25]){const c=new T.Group();c.position.set(x,0,z);if(z>0)c.rotation.y=Math.PI;chair(c,w*.22,h*.28);p.add(c);}
        cylinder(p,-w*.2,54,0,14,2,'#f0e8d4');cylinder(p,w*.2,54,0,14,2,'#f0e8d4');cup(p,0,55,9);break;
      }
      case 'wardrobe':case 'bookshelf':case 'shelf': {
        const height=type==='wardrobe'?132:125;
        box(p,0,height/2,0,w,height,h,darkWood);
        if(type==='wardrobe'){
          for(const x of [-w*.25,w*.25]){box(p,x,height/2,h*.51,w*.47,height-7,4,wood);box(p,x>0?6:-6,62,h*.55,3,16,3,metal);}
          box(p,0,height+3,0,w+6,5,h+4,wood);
        }else{
          for(let row=0;row<3;row++){box(p,0,12+row*38,h*.18,w-8,5,h*.7,wood);for(let i=0;i<6;i++){const book=box(p,-w*.39+i*w*.14,26+row*38,h*.22,w*.1,22+(i%3)*4,h*.38,['#758971','#aa8061','#c6af8c','#657980'][i%4]);if(i===5)book.rotation.z=.1;}}
        }break;
      }
      case 'gaming-console':case 'tv':case 'desk':case 'dj-booth': {
        tabletop(p,w,h,53);box(p,0,82,-h*.22,w*.42,38,5,'#252f32',true);box(p,0,83,-h*.19,w*.37,30,1,'#6f9b9e');box(p,0,60,h*.12,w*.37,2,h*.22,'#aab0aa');
        if(type==='dj-booth')for(const x of [-w*.3,w*.3]){cylinder(p,x,59,h*.08,16,4,'#171f24');cylinder(p,x,62,h*.08,7,1,'#628791');}break;
      }
      case 'portable-ac':box(p,0,46,0,w*.92,91,h*.9,'#d8ddd6',true);for(let i=0;i<5;i++)box(p,0,72-i*5,h*.47,w*.63,2,1,'#626f71');box(p,w*.22,89,0,14,2,8,'#678d87');break;
      case 'power-inverter':box(p,0,21,0,w,41,h,'#59676a',true);box(p,0,60,0,w*.92,35,h*.76,'#d2d5cc',true);box(p,0,62,h*.42,w*.37,15,2,'#597a72');box(p,0,63,h*.44,w*.25,6,1,'#9bc3a2');for(const x of [-w*.27,w*.27])cylinder(p,x,45,0,3,5,'#b49d70');break;
      case 'pool-table': {
        for(const x of [-w*.38,w*.38])for(const z of [-h*.34,h*.34])leg(p,x,z,43);
        box(p,0,49,0,w,18,h,darkWood,true);box(p,0,60,0,w*.89,3,h*.83,'#426f5a');
        for(const x of [-w*.45,0,w*.45])for(const z of [-h*.43,h*.43])cylinder(p,x,63,z,7,2,'#293a33');
        for(let i=0;i<6;i++)ball(p,32+(i%3)*7,67,-11+Math.floor(i/3)*8,4.5,4.5,4.5,['#d9c076','#ccdbd4','#ae6252','#617da2'][i%4]);ball(p,-w*.26,67,12,4.5,4.5,4.5,'#eee8d9');
        const cue=cylinder(p,0,65,h*.32,1.4,w*.84,'#c4a275');cue.rotation.z=Math.PI/2;break;
      }
      case 'bar-cart': {
        for(const x of [-w*.39,w*.39])for(const z of [-h*.3,h*.3]){cylinder(p,x,5,z,5,4,metal).rotation.x=Math.PI/2;box(p,x,36,z,3,60,3,metal);}
        for(const y of [15,52])box(p,0,y,0,w,4,h,wood);
        for(let i=0;i<4;i++){cylinder(p,-w*.3+i*w*.2,66,-h*.14,5,24,['#8a6a43','#506959','#637a83'][i%3],4);cylinder(p,-w*.3+i*w*.2,82,-h*.14,2.5,8,'#9d916b');}cup(p,w*.27,59,h*.15);break;
      }
      case 'art-piece':box(p,0,67,0,80,97,6,darkWood);box(p,0,67,4,69,85,2,'#decfab');box(p,-13,68,6,20,61,1,'#466d65');box(p,13,51,6,29,24,1,'#b38a5b');leg(p,-25,0,23);leg(p,25,0,23);break;
      case 'kitchen':case 'counter':case 'produce': {
        box(p,0,35,0,w,67,h, type==='kitchen'?'#708678':'#92714d');box(p,0,70,0,w+5,6,h+5,type==='kitchen'?'#e5e0d3':'#d0bb96');
        for(let i=0;i<4;i++){const x=-w*.375+i*w*.25;box(p,x,37,h*.51,w*.23,56,3,type==='kitchen'?'#91a393':'#a78a64');box(p,x,54,h*.54,15,3,3,metal);}
        if(type==='kitchen') {
          box(p,-w*.29,74,0,w*.24,2,h*.6,metal,true);box(p,-w*.29,75,0,w*.17,2,h*.41,'#a9b7b1',true);cylinder(p,-w*.29,89,-h*.23,2.5,25,metal);box(p,-w*.26,102,-h*.23,w*.07,3,3,metal);
          box(p,w*.26,75,0,w*.28,3,h*.6,'#252e30');for(const x of [w*.2,w*.34])for(const z of [-h*.16,h*.16])cylinder(p,x,78,z,w*.045,1,'#717c7b');
        } else if(type==='produce') {
          for(let i=0;i<12;i++)ball(p,-w*.4+(i%4)*w*.26,80,-h*.25+Math.floor(i/4)*h*.23,8,8,8,['#a4513e','#719454','#d1aa58'][Math.floor(i/4)]);
        }else{box(p,w*.29,92,-h*.1,35,28,5,'#263d3b',true);box(p,w*.29,93,-h*.065,29,20,1,'#84a69c');}
        break;
      }
      case 'fridge':box(p,0,67,0,w,132,h,'#bdc7c3',true);box(p,0,97,h*.51,w*.91,52,4,'#d2d8d3',true);box(p,0,35,h*.51,w*.91,64,4,'#d2d8d3',true);box(p,-w*.31,88,h*.57,3,24,3,metal);box(p,-w*.31,38,h*.57,3,26,3,metal);break;
      case 'performance-stage':{box(p,0,16,0,w,32,h,mat('#665068',.55),true);box(p,0,33,0,w-8,3,h-8,mat('#997385',.45),true);for(const x of [-w*.48,w*.48])box(p,x,75,-h*.46,12,130,12,metal);box(p,0,140,-h*.46,w,10,10,metal);break;}
      case 'lighting-truss':{for(const x of [-w*.48,w*.48])box(p,x,90,0,9,180,9,metal);box(p,0,181,0,w,9,10,metal);for(let i=0;i<6;i++)box(p,-w*.42+i*w*.17,167,0,20,17,17,mat(i%2?'#779dad':'#9984ad',.4,0,{emissive:i%2?'#4eacc5':'#aa70c8',emissiveIntensity:.6}));break;}
      case 'pub-bar':{box(p,0,41,0,w,82,h,darkWood,true);box(p,0,84,0,w+10,7,h+10,wood,true);for(let i=0;i<6;i++){cylinder(p,-w*.4+i*w*.16,96,-h*.15,5,18,['#678573','#ac9d64'][i%2],4);cup(p,-w*.4+i*w*.16,92,h*.2);}break;}
      case 'shower': {
        box(p,0,4,0,w,8,h,'#e4e8de');box(p,0,79,-h*.45,w,153,5,'#9bb8ad');box(p,-w*.46,80,0,4,155,h,glass);box(p,w*.46,80,0,4,155,h,glass);box(p,0,80,h*.45,w,153,3,glass);
        cylinder(p,-w*.2,96,-h*.38,2,74,metal);box(p,-w*.13,133,-h*.29,w*.18,3,h*.2,metal);box(p,w*.1,66,h*.49,3,21,3,metal);cylinder(p,0,9,0,6,1,metal);break;
      }
      case 'toilet':box(p,0,36,-h*.27,w*.75,53,h*.38,'#e8e8df',true);cylinder(p,0,20,h*.08,w*.36,31,'#e8e8df',w*.43);ball(p,0,37,h*.13,w*.44,5,h*.31,'#f4f2e9');ball(p,0,39,h*.13,w*.3,2,h*.22,'#b0c5c0');break;
      case 'basin':box(p,0,31,0,w,58,h,'#799385');box(p,0,64,0,w+6,8,h+4,'#eee9da',true);ball(p,0,69,0,w*.3,4,h*.33,'#b9c9c1');cylinder(p,0,80,-h*.34,2,22,metal);break;
      case 'plant':plant(p,w,h);break;
      case 'floor-lamp':case 'lamp':cylinder(p,0,3,0,15,5,metal);cylinder(p,0,56,0,2.5,106,metal);cylinder(p,0,116,0,25,32,mat('#eee0bd',.8,0,{emissive:'#dfba7b',emissiveIntensity:.18}),15);break;
      case 'treadmill': {
        box(p,0,12,0,w,17,h,metal,true);box(p,0,22,0,w*.7,4,h*.81,'#242b2c');for(let i=0;i<5;i++)box(p,0,25,-h*.32+i*h*.16,w*.66,1,2,'#485153');
        for(const x of [-w*.43,w*.43]){const bar=box(p,x,64,-h*.29,6,90,6,metal);bar.rotation.x=-.13;box(p,x,60,0,5,5,h*.5,metal);}
        box(p,0,111,-h*.32,w*.86,7,h*.17,metal,true);box(p,0,118,-h*.34,w*.48,2,h*.1,'#62b1aa');break;
      }
      case 'free-weights': {
        box(p,0,43,0,w,5,h*.85,metal);for(const x of [-w*.43,w*.43])box(p,x,23,0,7,44,h*.85,metal);
        for(let i=0;i<8;i++){const x=-w*.4+i*w*.8/7;const bar=cylinder(p,x,54,0,2,32,metal);bar.rotation.z=Math.PI/2;for(const d of [-12,12]){const weight=cylinder(p,x+d,54,0,10,7,'#2c3839');weight.rotation.z=Math.PI/2;}}break;
      }
      case 'bench-press': {
        for(const z of [-h*.3,h*.3]){box(p,0,30,z,w*.4,8,8,metal);leg(p,0,z,30,'#485158');}
        box(p,0,45,0,w*.4,14,h*.8,'#34423f',true);
        for(const x of [-w*.36,w*.36])box(p,x,58,-h*.28,7,112,7,metal);
        const bar=cylinder(p,0,110,-h*.28,3,w*.92,metal);bar.rotation.z=Math.PI/2;
        for(const x of [-w*.34,w*.34])for(let i=0;i<2;i++){const plate=cylinder(p,x+(x>0?i:-i)*7,110,-h*.28,h*.21,6,'#2d363a');plate.rotation.z=Math.PI/2;}break;
      }
      case 'bench':case 'pew': {
        for(const x of [-w*.4,w*.4])for(const z of [-h*.28,h*.28])leg(p,x,z,30);
        box(p,0,36,0,w,9,h,wood);box(p,0,67,-h*.4,w,49,8,wood);break;
      }
      case 'altar':tabletop(p,w,h,60);box(p,0,68,0,w*.68,2,h*.82,'#ece1ca');box(p,0,100,-h*.15,4,67,4,darkWood);box(p,0,112,-h*.15,31,4,4,darkWood);for(const x of [-w*.3,w*.3]){cylinder(p,x,80,0,3,21,'#dbc28d');ball(p,x,92,0,2,4,2,mat('#ffd693',.6,0,{emissive:'#ffad42',emissiveIntensity:.65}));}break;
      case 'prayer-alcove':box(p,0,69,-h*.4,w,135,12,'#d3c9af');box(p,0,58,-h*.29,w*.48,110,6,'#59766a',true);box(p,0,5,0,w*.8,2,h*.9,'#8b7556');break;
      case 'dice-table': {
        tabletop(p,w,h,52);box(p,0,57,0,w*.94,3,h*.9,'#315f50',true);
        for(const [x,z] of [[-12,-8],[15,7]]){box(p,x,67,z,15,15,15,'#f0e9dd',true);for(const d of [-3,3])ball(p,x+d,75,z,1.4,.5,1.4,'#334d43');}
        for(const x of [-w*.31,w*.31])for(let i=0;i<3;i++)cylinder(p,x,62+i*2,h*.2,8,2,['#b97058','#bfaa6b','#8fa3a0'][i]);break;
      }
      case 'speaker':box(p,0,51,0,w,102,h,'#293436',true);ball(p,0,57,h*.52,w*.36,w*.36,2,'#111c20');ball(p,0,24,h*.52,w*.23,w*.23,2,'#4a5659');break;
      case 'stairs':for(let i=0;i<8;i++)box(p,0,5+i*9,-h/2+(i+.5)*h/8,w,10+i*18,h/8,'#bba68a');break;
      case 'lake': {
        const material=mat('#477f89',.24,.18,{transparent:true,opacity:.92});box(p,0,1,0,w,4,h,material,false,false);water.push(material);
        for(let i=0;i<7;i++)box(p,-w*.35+(i%3)*w*.3,4,-h*.4+i*h*.13,w*.18,1,1,'#a7cbc6',false,false);break;
      }
      case 'dock':for(let i=0;i<12;i++)box(p,-w/2+(i+.5)*w/12,10,0,w/12-2,8,h,wood);for(const x of [-w*.44,w*.44])for(const z of [-h*.42,h*.42])cylinder(p,x,-10,z,5,47,darkWood);break;
      case 'boat': {
        const hull=ball(p,0,16,0,w*.5,15,h*.46,'#ece6d6');box(p,0,27,0,w*.53,5,h*.68,wood);box(p,0,38,0,w*.37,17,h*.4,'#718f88',true);break;
      }
      case 'car': {
        const car=carModel('#d5d8d2','sedan');p.add(car.group);car.group.scale.set(w/210,.95,h/90);break;
      }
      case 'tree':tree(p,w*.9);break;
      case 'rug':box(p,0,1,0,w,2,h,'#b9a78e');break;
      default:box(p,0,28,0,w,55,h,'#a9997d',true);break;
    }
    return p;
  }
  function tree(p,size=80) {
    cylinder(p,0,52,0,6,104,'#7c6547',4,8);
    for(const [x,y,z,r] of [[0,125,0,.46],[-.27,109,.14,.37],[.28,113,-.1,.38],[0,151,-.08,.33]])ball(p,x*size,y,z*size,r*size,r*size*.88,r*size,['#58774d','#678153','#46693e'][Math.round(y)%3],8);
  }
  function carModel(color,style='sedan',vehicleId) {
    const p=new T.Group(),wheels=[];
    const offroad=style==='offroad',suv=style==='suv'||offroad,bus=style==='bus',hatch=style==='hatchback';
    const length=bus?295:offroad?223:suv?227:hatch?180:213,width=bus?105:offroad?103:suv?101:88;
    const paint=mat(color,.27,.28),window=mat('#384f59',.15,.32),tire=mat('#202a2d',.9),chrome=mat('#adb7b9',.22,.75);
    box(p,0,34,0,length,36,width,paint,!offroad);
    box(p,0,52,0,length*.94,12,width*.94,paint,!offroad);
    box(p,0,21,0,length*.89,8,width*.91,'#293236');
    const cabinLength=bus?length*.75:offroad?length*.68:suv?length*.62:hatch?length*.61:length*.54;
    const cabinHeight=bus?48:offroad?40:suv?36:29,cabinX=hatch?-11:suv?-7:-9;
    box(p,cabinX,60+cabinHeight/2,0,cabinLength,cabinHeight,width*.79,window,!offroad);
    box(p,cabinX,61+cabinHeight,0,cabinLength+3,5,width*.84,paint,!offroad);
    for(const x of [cabinX-cabinLength*.47,cabinX,cabinX+cabinLength*.47])box(p,x,60+cabinHeight/2,0,4,cabinHeight,width*.83,paint);
    for(const z of [-width*.42,width*.42])box(p,cabinX,58,z,cabinLength,6,3,chrome);
    // Each model has a recognisable original body/grille treatment, without logos.
    const bmw=vehicleId?.startsWith('bmw')||vehicleId==='city-sedan';
    box(p,length*.51,35,0,3,18,width*.54,'#29343b');
    if(bmw)for(const z of [-10,10])box(p,length*.525,37,z,2,14,15,chrome,true);
    else for(let i=0;i<3;i++)box(p,length*.525,31+i*5,0,2,2,width*.5,chrome);
    const lamps=mat('#fff0ce',.2,.05,{emissive:'#ead3a2',emissiveIntensity:.24});
    for(const z of [-width*.34,width*.34]){
      if(offroad){const head=cylinder(p,length*.52,44,z,8,2,lamps);head.rotation.z=Math.PI/2;}
      else box(p,length*.505,43,z,4,8,width*.17,lamps,true);
      box(p,-length*.505,42,z,4,9,width*.17,'#a85546',true);
      box(p,cabinX+19,71,z*1.36,13,7,7,paint,true);
      box(p,cabinX-13,47,z*1.42,12,3,2,chrome);
    }
    for(const x of [-length*.32,length*.33])for(const z of [-width*.5,width*.5]){
      const wheel=new T.Group();wheel.position.set(x,22,z);p.add(wheel);
      const rubber=cylinder(wheel,0,0,0,21,13,tire,21,16);rubber.rotation.x=Math.PI/2;
      const rim=cylinder(wheel,0,0,z>0?7:-7,13,2,chrome,13,12);rim.rotation.x=Math.PI/2;
      for(let i=0;i<5;i++){const spoke=box(wheel,0,0,z>0?9:-9,2,22,1,'#616e77');spoke.rotation.z=i*Math.PI/5;}
      wheels.push(wheel);
    }
    if(offroad){const spare=cylinder(p,-length*.55,50,0,21,14,tire);spare.rotation.z=Math.PI/2;box(p,0,64,-width*.51,length*.78,4,5,chrome);box(p,0,64,width*.51,length*.78,4,5,chrome);}
    if(style==='taxi')box(p,-5,98,0,29,11,20,'#d7c083',true);
    const beams=new T.Group(),beamMat=new T.MeshBasicMaterial({color:'#fff0b5',transparent:true,opacity:.035,depthWrite:false,side:T.DoubleSide});materials.set(`beams:${materials.size}`,beamMat);for(const z of [-width*.34,width*.34]){const cone=mesh(beams,geo('headlightcone',()=>new T.ConeGeometry(39,170,12,1,true)),beamMat,length/2+85,33,z,false);cone.rotation.z=Math.PI/2;cone.userData.excludeFromBounds=true;}beams.visible=false;if(!modelOnly){p.add(beams);nightBeams.push(beams);}
    p.name=vehicleFor(vehicleId)?.name||style;
    return {group:p,wheels};
  }
  function placeObject(item) {
    const type=item.kind||'fixture';
    const transposed=item.rotation%180===90&&!['plant','floor-lamp','portable-ac','power-inverter','art-piece'].includes(type);
    const model=objectModel(type,transposed?item.h:item.w,transposed?item.w:item.h,item),p=new T.Group();p.add(model);
    if(item.rotation)model.rotation.y=-item.rotation*Math.PI/180;
    p.position.set(item.x+item.w/2,0,(item.y+item.h/2)*ds);p.scale.z=ds;
    p.userData={kind:type,itemId:item.itemId||null};group.add(p);return p;
  }
  function interiorSet() {
    const outdoor=['park','jabi-lake'].includes(venue?.id);
    floor(group,0,0,layout.width,layout.height,outdoor?'grass':'wood',-4);
    floor(group,60,140,layout.width-120,layout.height-220,outdoor?'grass':layout.floorMaterial||'tile');
    for(const area of layout.floorAreas||[]) {
      if(area.material==='rug'){
        box(group,area.x+area.w/2,1,(area.y+area.h/2)*ds,area.w,2,area.h*ds,area.color||'#a9a186',false,false);
        box(group,area.x+area.w/2,2,(area.y+area.h/2)*ds,Math.max(1,area.w-14),1,Math.max(1,area.h-14)*ds,mat('#b8ad93',.96),false,false);
      }else floor(group,area.x,area.y,area.w,area.h,area.material==='pave'?'tile':area.material,1);
    }
    if(!outdoor) {
      const wallColor=({sand:'#cdbca4',ivory:'#e5e0d6',sage:'#9caf99',clay:'#ba9380'})[profile.home?.roomStyle?.wall]||'#c4b096';
      // Roofless cutaway: full-height rear/partition walls and lowered front sides.
      box(group,layout.width/2,72,134*ds,layout.width-96,144,13,wallColor);
      box(group,55,69,(layout.height+140)/2*ds,14,138,(layout.height-140)*ds,wallColor);
      box(group,layout.width-55,33,(layout.height+140)/2*ds,14,66,(layout.height-140)*ds,wallColor);
      box(group,layout.width/2,16,(layout.height-83)*ds,layout.width-96,32,13,'#bfaa8c');
      for(const wall of layout.walls||[]) {
        const height=wall.y>layout.height*.55?68:125;
        box(group,wall.x+wall.w/2,height/2,(wall.y+wall.h/2)*ds,wall.w,height,wall.h*ds,wallColor);
        box(group,wall.x+wall.w/2,height+1,(wall.y+wall.h/2)*ds,wall.w+1,3,wall.h*ds+1,'#ede4d3');
      }
      // Framed windows, wall lights, art and skirting keep surfaces lived in.
      for(const x of [layout.width*.22,layout.width*.76]) {
        box(group,x,81,143*ds,135,64,5,darkWood);box(group,x,82,147*ds,122,52,3,mat('#9db8b8',.17,.1));box(group,x,82,150*ds,4,53,2,cream);
        box(group,x,14,144*ds,160,3,4,cream);
      }
      box(group,layout.width*.49,85,143*ds,66,58,4,darkWood);box(group,layout.width*.49,85,146*ds,55,47,2,mat('#6c8275'));
      box(group,layout.width*.49-9,84,148*ds,15,27,1,mat('#c5b58b'));
      for(const x of [layout.width*.13,layout.width*.61,layout.width*.89]) {
        box(group,x,105,148*ds,17,27,12,mat('#e0bc7f',.55,.15,{emissive:'#ddaa62',emissiveIntensity:.24}),true);
      }
    }
    for(const item of layout.objects||[])placeObject(item);
    // Soft textiles and objects that do not block a route still appear in 3D.
    for(const placement of layout.furniturePlacements||[]) {
      const existing=(layout.objects||[]).some(o=>o.itemId===placement.itemId);
      if(!existing)placeObject({...placement,kind:placement.itemId});
    }
    if(venue?.id==='gym'){
      for(let i=0;i<3;i++){box(group,865+i*114,1,430*ds,82,2,219*ds,['#7e9d99','#b19b76','#a7af8e'][i],true);}
      const rack=new T.Group();rack.position.set(374,0,693*ds);rack.scale.z=ds;group.add(rack);
      box(rack,0,44,0,400,5,70,metal);for(const x of [-178,178])box(rack,x,25,0,7,47,54,metal);
      for(let i=0;i<8;i++){const x=-172+i*49;const bar=cylinder(rack,x,56,0,2,36,metal);bar.rotation.z=Math.PI/2;for(const d of [-14,14]){const weight=cylinder(rack,x+d,56,0,11,8,'#2c3839');weight.rotation.z=Math.PI/2;}}
    }
    if(venue?.id==='mosque')for(let row=0;row<4;row++)for(let col=0;col<5;col++){box(group,225+col*180,1,(420+row*143)*ds,110,2,105*ds,'#829078');box(group,225+col*180,3,(390+row*143)*ds,77,1,3*ds,'#c6b895');}
    if(isClub){
      for(let i=0;i<(venue?.id==='bear-barn'?1:3);i++){const light=new T.SpotLight(['#a57be1','#64b9d3','#e5bb79'][i],24000,740,.48,.75,1.6);light.position.set(400+i*350,190,280*ds);light.target.position.set(590+i*150,0,620*ds);group.add(light,light.target);clubLights.push(light);}
      if(venue?.id!=='bear-barn')box(group,layout.width*.5,1,layout.height*.56*ds,430,3,380*ds,mat(venue?.id==='club'?'#404f45':venue?.id==='magic-city'?'#6d4c69':'#41475b',.25,.12));
      for(let i=0;i<8;i++){box(group,layout.width*.34+i*61,6,layout.height*.36*ds,28,3,14,mat(i%2?'#a071a5':'#527b93',.3,0,{emissive:i%2?'#8b4a92':'#4068ae',emissiveIntensity:.5}));}
    }
    if(venue?.id==='jabi-lake') {
      if(!(layout.objects||[]).some(o=>o.kind==='lake'))placeObject({kind:'lake',x:80,y:140,w:layout.width-160,h:350});
      for(const [x,y] of [[150,790],[layout.width-150,790],[layout.width-140,430]]){const t=new T.Group();t.position.set(x,0,y*ds);group.add(t);tree(t,110);}
    }
  }
  function sign(parent,name,width=220,height=38,x=0,y=0,z=0) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');if(!c)return;
    c.fillStyle='#e6dfcd';c.fillRect(0,0,512,128);c.fillStyle='#314d42';c.font=`600 ${name.length>21?28:36}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(name,256,66,480);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
    const material=new T.MeshStandardMaterial({map:texture,roughness:.9});materials.set(`sign:${name}`,material);
    const plane=mesh(parent,geo(`sign:${width}:${height}`,()=>new T.PlaneGeometry(width,height)),material,x,y,z,false);return plane;
  }
  function citySet() {
    const affluent=/maitama|asokoro|guzape|jabi/i.test(profile.district||place?.name||'');
    floor(group,0,0,layout.width,layout.height,'grass',-6);
    floor(group,0,610,layout.width,132,'tile',-1);floor(group,0,1390,layout.width,144,'tile',-1);floor(group,0,2170,layout.width,114,'tile',-1);
    for(const [y,h] of [[722,252],[1534,234],[2284,234],[3170,234]]) {
      floor(group,0,y,layout.width,h,'road',0);
      for(let x=0;x<layout.width;x+=100)box(group,x+28,1,(y+h/2)*ds,52,1,4*ds,'#d4cbb2',false,false);
      box(group,layout.width/2,2,y*ds,layout.width,3,8*ds,'#d1cab8',false,false);box(group,layout.width/2,2,(y+h)*ds,layout.width,3,8*ds,'#d1cab8',false,false);
    }
    floor(group,1820,0,254,layout.height,'road',0);
    for(let y=0;y<layout.height;y+=100)box(group,1947,1,(y+25)*ds,4,1,51*ds,'#d4cbb2',false,false);
    const buildings=layout.buildings||layout.obstacles.filter(o=>o.w>200&&o.h>180).map(o=>({...o,y:o.y+o.h,frontY:true,floors:2,name:''}));
    for(const b of buildings) {
      const p=new T.Group(),bottom=b.frontY===false?b.y:b.y-b.h,height=b.id==='hotel'?250:b.id==='home'?145:b.floors>1?140:103;
      p.position.set(b.x+b.w/2,0,(bottom+b.h/2)*ds);group.add(p);
      box(p,0,height/2,0,b.w,height,b.h*ds,affluent?'#e5decc':b.wall||'#d6d1bc');box(p,0,height+7,0,b.w+14,14,b.h*ds+14,affluent?'#77796b':b.accent||'#677669');
      box(p,0,7,b.h*ds/2+6,b.w+30,14,28,'#b9baa8');
      box(p,0,42,b.h*ds/2+2,55,84,4,glass);box(p,0,43,b.h*ds/2+5,3,86,3,cream);
      const rows=height>200?3:height>125?2:1;
      for(let row=0;row<rows;row++)for(const x of [-b.w*.3,b.w*.3]){box(p,x,60+row*63,b.h*ds/2+2,b.w*.2,37,4,mat('#739899',.25,.08,{emissive:'#e8c48b',emissiveIntensity:0}));box(p,x,60+row*63,b.h*ds/2+5,3,38,2,cream);}
      if(b.name)sign(p,b.name,Math.min(b.w-30,290),35,0,height-20,b.h*ds/2+5);
      if(b.id==='mosque') {const dome=ball(p,0,height+11,0,b.w*.3,70,b.h*ds*.3,'#749180');const minaret=cylinder(p,b.w*.36,height*.85,-b.h*.2*ds,19,height*1.7,'#dcd1b6',17);cylinder(p,b.w*.36,height*1.73,-b.h*.2*ds,27,21,'#729180',15);}
      if(b.id==='church'){box(p,0,height+34,b.h*.12*ds,7,72,7,'#796c52');box(p,0,height+51,b.h*.12*ds,47,7,7,'#796c52');}
      if(affluent&&b.id==='home') {
        for(const x of [-b.w*.42,b.w*.42]){box(p,x,20,b.h*ds*.56,b.w*.23,40,15,'#e3dbc5');box(p,x,43,b.h*ds*.56,b.w*.25,6,19,'#87967a');}
        for(const x of [-b.w*.43,b.w*.43]){const planter=new T.Group();planter.position.set(x,0,b.h*ds*.63);plant(planter,35,30);p.add(planter);}
      }
    }
    for(const [x,y,size] of [[91,650,110],[658,610,85],[1204,643,82],[1745,633,103],[2152,615,85],[2730,626,95],[3400,643,123],[80,1441,114],[705,1449,91],[1740,1435,101],[2728,1440,97],[1040,1998,125],[1710,2010,128]]){const p=new T.Group();p.position.set(x,0,y*ds);group.add(p);tree(p,size);}
    for(const y of [668,1480])for(const x of [570,1160,2660,3270]) {
      cylinder(group,x,66,y*ds,3,132,'#626c63',2);box(group,x+15,134,y*ds,34,6,12,metal);box(group,x+16,130,y*ds,23,1,7,mat('#dcd2a9',.8,0,{emissive:'#d8bf80',emissiveIntensity:.15}));
    }
  }
  function journeySet() {
    floor(group,0,0,layout.width,layout.height,'grass',-5);floor(group,0,674,layout.width,317,'road');
    for(let x=0;x<layout.width;x+=155)box(group,x+39,1,824*ds,76,1,4*ds,'#ded1b0',false,false);
    for(let x=90;x<layout.width;x+=600){for(const y of [610,1170]){const p=new T.Group();p.position.set(x,0,y*ds);group.add(p);tree(p,90+(x%3)*13);}if(x%1200===90){box(group,x+230,57,420*ds,190,114,155*ds,'#d2cbb6');box(group,x+230,119,420*ds,210,13,175*ds,'#788677');}}
  }
  if(modelOnly) {
    const model=modelOnly.category==='vehicle'?carModel(modelOnly.color,modelOnly.bodyStyle,modelOnly.id).group:objectModel(modelOnly.kind,modelOnly.width||110,modelOnly.depth||80);
    group.add(model);
    return {group,dispose(){for(const texture of textures)texture.dispose();}};
  }
  if(kind==='transit')journeySet();else if(kind==='home'||kind==='visit'||kind==='venue')interiorSet();else citySet();
  let ownCar,parkedCar;
  if(profile.drivingVehicle||profile.activeTrip||profile.inventory?.some(id=>vehicleFor(id))) {
    const ownId=profile.drivingVehicle||profile.activeTrip?.vehicleId||profile.inventory?.find(id=>vehicleFor(id));
    const item=vehicleFor(ownId);
    ownCar=carModel('#d8d8ca',profile.activeTrip?.mode==='bus'?'bus':profile.activeTrip?.mode==='taxi'?'taxi':item?.bodyStyle||'sedan',ownId);group.add(ownCar.group);
    if(kind==='public'){parkedCar=carModel('#d8d8ca',item?.bodyStyle||'sedan',ownId);group.add(parkedCar.group);}
  }
  for(const traffic of layout.traffic||[]){const car=carModel(traffic.color,traffic.type||'sedan');group.add(car.group);movingCars.push(car);}
  // WebGL scene metadata supports acceptance checks without replacing gameplay.
  group.userData={environment:'true-3d',indoor,objects:(layout.objects||[]).map(o=>o.kind),materials:'procedural wood, tile, glass, fabric and metal'};
  function positionCar(car,p,angle=0,visible=true,moving=false,time=0) {
    if(!car)return;car.group.visible=visible;if(!visible)return;
    car.group.position.set(p.x,0,p.y*ds);car.group.rotation.y=-Math.atan2(Math.sin(angle*Math.PI/180)*ds,Math.cos(angle*Math.PI/180));
    for(const wheel of car.wheels)wheel.rotation.z=moving?-time*9:0;
  }
  const glowingMaterials=[...materials.values()].filter(m=>m.emissive&&m.emissive.getHex()!==0).map(material=>({material,day:material.emissiveIntensity}));
  let appliedColor,lastNight;
  return {
    group,
    playerModel:()=>ownCar?.group,
    update({clock,weather,clubOpen,elapsed=0,player,angle=0,transport,driving,carColor,parked,trafficPositions=[],trip}) {
      const night=!!clock?.isNight;if(night!==lastNight){for(const glow of glowingMaterials)glow.material.emissiveIntensity=night?Math.max(.9,glow.day*5):glow.day;for(const beams of nightBeams)beams.visible=night;lastNight=night;}
      clubLights.forEach((light,i)=>{light.intensity=clubOpen?21000+Math.sin(elapsed*2+i)*5000:0;light.target.position.set(580+i*180+Math.sin(elapsed*.55+i)*150,0,(630+Math.cos(elapsed*.4+i)*160)*ds);});
      if(carColor&&carColor!==appliedColor) {
        for(const car of [ownCar,parkedCar])if(car)car.group.traverse(o=>{if(o.material?.metalness===.28)o.material.color.set(carColor);});appliedColor=carColor;
      }
      positionCar(ownCar,player,trip?0:angle,!!transport,true,elapsed);
      positionCar(parkedCar,parked||player,0,!transport&&!indoor,false,elapsed);
      trafficPositions.forEach((p,i)=>positionCar(movingCars[i],p,p.angle,true,true,elapsed));
      for(const material of water)material.opacity=.91+Math.sin(elapsed*.7)*.025;
    },
    dispose(){for(const texture of textures)texture.dispose();}
  };
}

// Premium procedural AbujaLife surfaces. Every texture is generated locally so the
// live city never waits on a CDN and every scene can release its own GPU resources.
export function createWorldMaterialLibrary(T, {size = 128} = {}) {
  const textures = new Map(), dataTextures = new Map(), materials = new Map();
  const clamp = value => Math.max(0, Math.min(255, Math.round(value)));
  const fract = value => value - Math.floor(value);
  const smooth = (a,b,x) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };

  function texture(type, repeatX = 1, repeatY = 1) {
    const key = `${type}:${repeatX.toFixed(3)}:${repeatY.toFixed(3)}`;
    if (textures.has(key)) return textures.get(key);
    const baseKey = `${type}:1.000:1.000`;
    if (key !== baseKey) {
      const map = texture(type).clone();
      map.repeat.set(repeatX, repeatY); map.needsUpdate = true;
      textures.set(key, map); return map;
    }

    const data = new Uint8Array(size * size * 4);
    let seed = 9137;
    const noise = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx=x/size, ny=y/size, n=noise(), n2=noise();
      let shade=246;
      if(type==='wood'){
        const grain=Math.sin(ny*92+Math.sin(nx*13)*2.4)+Math.sin(ny*33+nx*11)*.38;
        shade=224+grain*8+(n-.5)*8;
        if(fract(nx*5)<.012)shade-=18;
      } else if(type==='planks'){
        const boards=7, board=Math.floor(nx*boards), seam=fract(nx*boards), stagger=fract(ny*2+(board%2)*.5);
        const grain=Math.sin(ny*112+board*1.9+Math.sin(nx*24)*2.2);
        shade=224+grain*7+Math.sin(board*4.7)*5+(n-.5)*6;
        if(seam<.018||seam>.982||stagger<.009)shade=170+(n2-.5)*8;
      } else if(type==='plaster'){
        const cloud=Math.sin(nx*18+ny*13)+Math.sin(nx*39-ny*31)*.36;
        shade=244+cloud*1.8+(n-.5)*8;
      } else if(type==='fabric'){
        const warp=(x%5<2?8:-3), weft=(y%5<2?5:-4);
        shade=231+warp+weft+(n-.5)*6;
      } else if(type==='stone'){
        const vein=Math.abs(Math.sin(nx*17+ny*28+Math.sin(ny*17)*2.2));
        shade=238-vein*10-(vein>.93?42:0)+(n-.5)*7;
      } else if(type==='tile'||type==='bath'){
        const cells=type==='bath'?4:3, sx=fract(nx*cells), sy=fract(ny*cells), grout=Math.min(sx,1-sx,sy,1-sy);
        shade=grout<.025?185:245+(n-.5)*4;
        if(type==='bath'&&grout>.025)shade+=Math.sin((nx+ny)*26)*2;
      } else if(type==='road'){
        shade=205+(n-.5)*30; if(n2>.965)shade-=26;
      } else if(type==='grass'){
        const blades=Math.sin(nx*92+ny*37)*4+Math.sin(nx*31-ny*66)*3;
        shade=218+(n-.5)*32+blades;
      } else if(type==='rug'){
        const border=Math.min(nx,1-nx,ny,1-ny), pattern=Math.sin(nx*35)*Math.sin(ny*31);
        shade=border<.055?185:221+pattern*11+(x%3?5:-4)+(n-.5)*5;
      }
      const i=(y*size+x)*4, c=clamp(shade);
      data[i]=data[i+1]=data[i+2]=c; data[i+3]=255;
    }
    const map=new T.DataTexture(data,size,size,T.RGBAFormat);
    map.name=`AbujaLife premium authored ${type}`; map.colorSpace=T.SRGBColorSpace;
    map.wrapS=map.wrapT=T.RepeatWrapping; map.magFilter=T.LinearFilter; map.minFilter=T.LinearMipmapLinearFilter;
    map.generateMipmaps=true; map.anisotropy=4; map.needsUpdate=true;
    map.userData={surface:type,authored:true,premium:true,usage:'color'}; textures.set(key,map); return map;
  }

  // PBR data textures must stay linear. Reusing an sRGB colour texture as a
  // bump/roughness source makes the relief response physically incorrect and
  // over-contrasty. The data view deliberately shares authored pixels but has
  // its own Texture state and GPU colour-space interpretation.
  function dataTexture(type, repeatX = 1, repeatY = 1) {
    const key=`${type}:${repeatX.toFixed(3)}:${repeatY.toFixed(3)}`;
    if(dataTextures.has(key))return dataTextures.get(key);
    const map=texture(type,repeatX,repeatY).clone();
    map.name=`AbujaLife premium authored ${type} data`;
    map.colorSpace=T.NoColorSpace ?? '';
    map.userData={surface:type,authored:true,premium:true,usage:'data'};
    map.needsUpdate=true;dataTextures.set(key,map);return map;
  }

  const defaults={
    wood:{roughness:.47,bumpScale:.09},planks:{roughness:.49,bumpScale:.075},
    plaster:{roughness:.82,bumpScale:.025},fabric:{roughness:.88,bumpScale:.06},
    stone:{roughness:.31,bumpScale:.035},tile:{roughness:.34,bumpScale:.05},
    bath:{roughness:.30,bumpScale:.045},road:{roughness:.94,bumpScale:.16},
    grass:{roughness:.96,bumpScale:.13},rug:{roughness:.91,bumpScale:.12},
    ceramic:{roughness:.19,metalness:.02,clearcoat:.32,clearcoatRoughness:.22},
    metal:{roughness:.24,metalness:.78},
    glass:{roughness:.08,metalness:.05,transparent:true,opacity:.38,depthWrite:false,clearcoat:.72,clearcoatRoughness:.08}
  };

  function material(type,color='#ffffff',extra={}){
    const key=JSON.stringify([type,color,extra]); if(materials.has(key))return materials.get(key);
    const {repeatX=1,repeatY=1,...options}=extra;
    const textured=['wood','planks','plaster','fabric','stone','tile','bath','road','grass','rug'].includes(type);
    const map=textured?texture(type,repeatX,repeatY):null;
    const bumpMap=textured?dataTexture(type,repeatX,repeatY):null;
    const physical=['ceramic','glass','fabric'].includes(type)&&T.MeshPhysicalMaterial;
    const Klass=physical?T.MeshPhysicalMaterial:T.MeshStandardMaterial;
    const base={color,metalness:0,...defaults[type],...(map?{map,bumpMap}:{}),...options};
    if(type==='fabric'&&physical)Object.assign(base,{sheen:0.22,sheenRoughness:.78,sheenColor:new T.Color(color).lerp(new T.Color('#fff4e4'),.15)});
    const result=new Klass(base);result.name=`AbujaLife premium ${type}`;result.userData={surface:type,premium:true};
    materials.set(key,result);return result;
  }

  return {texture,dataTexture,material,stats:()=>({textures:textures.size+dataTextures.size,materials:materials.size,size,premium:true}),dispose(){for(const map of textures.values())map.dispose();for(const map of dataTextures.values())map.dispose();for(const mat of materials.values())mat.dispose();textures.clear();dataTextures.clear();materials.clear();}};
}

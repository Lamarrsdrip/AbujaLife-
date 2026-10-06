// Small authored RoomEnvironment for AbujaLife PBR image-based lighting.
// Keeping this local avoids a runtime dependency on a missing Three addon while
// still feeding PMREM a coherent neutral/warm environment. This is indirect
// environment lighting, not a claim of realtime global illumination.
function buildRoomEnvironment(T,{indoors=false}={}){
  const scene=new T.Scene();
  const geometry=new T.BoxGeometry(1,1,1);
  const roomMaterial=new T.MeshStandardMaterial({color:indoors?0xe8dcc6:0xdfe7dc,roughness:.92,metalness:0,side:T.BackSide});
  const room=new T.Mesh(geometry,roomMaterial);
  room.scale.set(30,24,30);room.position.set(0,9,0);scene.add(room);

  const blockMaterial=new T.MeshStandardMaterial({color:indoors?0xa9987d:0x91a58e,roughness:.82,metalness:0});
  const transforms=[[-6,1.5,4,3,4,3],[5,2,-3,4,5,3],[-2,.8,-7,2.5,2.5,4],[8,1,6,2.5,3,2.5]];
  for(const [x,y,z,sx,sy,sz] of transforms){const mesh=new T.Mesh(geometry,blockMaterial);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);scene.add(mesh);}

  const key=new T.PointLight(indoors?0xffd7aa:0xffe2b8,indoors?90:70,34,2);key.position.set(-6,12,5);scene.add(key);
  const fill=new T.PointLight(indoors?0xc7dcff:0xcfe4ff,indoors?42:55,30,2);fill.position.set(9,7,-7);scene.add(fill);
  const top=new T.PointLight(0xffffff,indoors?34:48,30,2);top.position.set(0,14,0);scene.add(top);

  scene.userData.dispose=()=>{geometry.dispose();roomMaterial.dispose();blockMaterial.dispose();};
  return scene;
}

// One small prefiltered environment map gives PBR materials coherent indirect
// reflections without attempting expensive realtime GI across the whole city.
export function createWorldEnvironmentLighting(T,renderer,{indoors=false,constrained=false}={}){
  if(constrained)return{texture:null,dispose(){}};
  const pmrem=new T.PMREMGenerator(renderer);
  const room=buildRoomEnvironment(T,{indoors});
  const target=pmrem.fromScene(room,indoors?.035:.08,.1,100);
  room.userData.dispose?.();
  pmrem.dispose();
  target.texture.name=indoors?'AbujaLife warm interior IBL':'AbujaLife ambient IBL';
  return{texture:target.texture,dispose(){target.dispose();}};
}

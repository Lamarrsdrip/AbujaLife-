import { RoomEnvironment } from './vendor/RoomEnvironment.js';

// One small prefiltered environment map gives PBR materials coherent indirect
// reflections without attempting realtime GI. Static architecture remains lit
// by the authored sun/ambient system; this only supplies the missing IBL term.
export function createWorldEnvironmentLighting(T,renderer,{indoors=false,constrained=false}={}){
  if(constrained)return{texture:null,dispose(){}};
  const pmrem=new T.PMREMGenerator(renderer);
  pmrem.compileCubemapShader?.();
  const room=new RoomEnvironment();
  const target=pmrem.fromScene(room,indoors?.035:.08,0.1,100,{size:indoors?128:64});
  room.dispose?.();
  pmrem.dispose();
  target.texture.name=indoors?'AbujaLife warm interior IBL':'AbujaLife ambient IBL';
  return{texture:target.texture,dispose(){target.dispose();}};
}

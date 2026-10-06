import { LoadingManager } from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { KTX2Loader } from './vendor/KTX2Loader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.js';

const cache=new Map();
const pending=new Map();

export function createWorldAssetLoader(renderer,{basisPath='/vendor/basis/',onError=()=>{}}={}){
  const manager=new LoadingManager();
  manager.onError=url=>onError({type:'asset-load',url});
  const ktx2=new KTX2Loader(manager).setTranscoderPath(basisPath).setWorkerLimit(2).detectSupport(renderer);
  const gltf=new GLTFLoader(manager).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

  const load=async url=>{
    if(cache.has(url))return cache.get(url);
    if(pending.has(url))return pending.get(url);
    const request=gltf.loadAsync(url).then(result=>{
      const value={scene:result.scene,animations:result.animations||[],asset:result.asset||{},url};
      cache.set(url,value);pending.delete(url);return value;
    }).catch(error=>{pending.delete(url);onError({type:'asset-load',url,error});throw error;});
    pending.set(url,request);return request;
  };

  return {
    load,
    preload:url=>{void load(url).catch(()=>{});},
    has:url=>cache.has(url),
    clone:async url=>{
      const asset=await load(url);
      return asset.scene.clone(true);
    },
    stats:()=>({loaded:cache.size,pending:pending.size,ktx2:true,meshopt:true}),
    dispose(){ktx2.dispose();}
  };
}

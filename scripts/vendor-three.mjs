import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'app/vendor');
await fs.mkdir(output,{recursive:true});

await build({
  absWorkingDir:root,
  entryPoints:['node_modules/three/build/three.module.js'],
  outfile:path.join(output,'three.module.js'),
  bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,legalComments:'inline'
});

const sharedThree={name:'abujalife-shared-three',setup(builder){
  builder.onResolve({filter:/^three$/},()=>({path:'./three.module.js',external:true}));
}};
const addons={
  GLTFLoader:'node_modules/three/examples/jsm/loaders/GLTFLoader.js',
  KTX2Loader:'node_modules/three/examples/jsm/loaders/KTX2Loader.js',
  meshopt_decoder:'node_modules/three/examples/jsm/libs/meshopt_decoder.module.js',
  RoomEnvironment:'node_modules/three/examples/jsm/environments/RoomEnvironment.js'
};
for(const [name,entry] of Object.entries(addons))await build({
  absWorkingDir:root,
  entryPoints:[entry],
  outfile:path.join(output,`${name}.js`),
  bundle:true,
  platform:'browser',
  format:'esm',
  target:'es2022',
  minify:true,
  legalComments:'inline',
  plugins:[sharedThree]
});

const basisSource=path.join(root,'node_modules/three/examples/jsm/libs/basis');
const basisOutput=path.join(output,'basis');
await fs.mkdir(basisOutput,{recursive:true});
for(const file of ['basis_transcoder.js','basis_transcoder.wasm'])await fs.copyFile(path.join(basisSource,file),path.join(basisOutput,file));
await fs.copyFile(path.join(root,'node_modules/three/LICENSE'),path.join(output,'LICENSE.three.txt'));
console.log('Built one local Three.js 0.180.0 runtime plus IBL, GLTF/KTX2/Meshopt addons and Basis transcoder.');

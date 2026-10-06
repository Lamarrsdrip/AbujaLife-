import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorldMaterialLibrary } from '../app/world-materials.js';

test('visible colour textures are sRGB while bump/PBR data remains linear',()=>{
  const library=createWorldMaterialLibrary(THREE,{size:32});
  const material=library.material('wood','#b18e63',{repeatX:2,repeatY:3});
  assert.ok(material.map);
  assert.ok(material.bumpMap);
  assert.notEqual(material.map,material.bumpMap,'colour and data need independent texture state');
  assert.equal(material.map.colorSpace,THREE.SRGBColorSpace);
  assert.equal(material.bumpMap.colorSpace,THREE.NoColorSpace);
  assert.deepEqual(material.map.repeat.toArray(),[2,3]);
  assert.deepEqual(material.bumpMap.repeat.toArray(),[2,3]);
  assert.equal(material.map.userData.usage,'color');
  assert.equal(material.bumpMap.userData.usage,'data');
  library.dispose();
  assert.deepEqual(library.stats(),{textures:0,materials:0,size:32,premium:true});
});

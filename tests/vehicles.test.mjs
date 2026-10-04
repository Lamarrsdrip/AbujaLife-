import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from '../app/vendor/three.module.js';
import { VEHICLE_CATALOG, VEHICLE_COLORS, vehicleFor, vehicleColorHex } from '../src/shared/vehicles.mjs';
import { catalog } from '../src/shared/catalogue.mjs';
import { vehicleIllustration } from '../app/vehicle-art.js';
import { buildThreeEnvironment } from '../app/world-3d-scenes.js';

const additions = ['ferrari-roma','ferrari-sf90','lamborghini-huracan','lamborghini-urus','bugatti-chiron','porsche-911'];
const models = additions.map(vehicleFor);
function build(item,colorId='silver') {
  const env=buildThreeEnvironment(THREE,{modelOnly:{...item,color:vehicleColorHex({vehicleColors:{[item.id]:colorId}},item)}});
  const model=env.group.children[0];model.updateMatrixWorld(true);
  return {model,size:new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()),dispose(){env.dispose();model.traverse(p=>{p.geometry?.dispose();p.material?.dispose();});}};
}
function geometricSignature(model) {
  const bounds=new THREE.Box3().setFromObject(model),span=bounds.getSize(new THREE.Vector3()),points=[],v=new THREE.Vector3();
  model.traverse(p=>{if(!p.isMesh)return;const positions=p.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(p.matrixWorld);points.push([v.x/span.x,v.y/span.y,v.z/span.z].map(n=>n.toFixed(4)).join(','));}});
  return createHash('sha256').update(points.sort().join(';')).digest('hex');
}

test('new named cars enter the same authoritative catalogue without changing existing cars or colours',()=>{
  const legacy=[['used-hatchback',28000],['starter-hatchback',95000],['compact-car',240000],['city-sedan',380000],['premium-suv',890000],['mercedes-c-class',520000],['bmw-x5',1150000],['mercedes-g63',1650000]];
  for(const[id,price]of legacy)assert.equal(vehicleFor(id).price,price);
  assert.equal(new Set(VEHICLE_CATALOG.map(i=>i.id)).size,VEHICLE_CATALOG.length);
  for(const car of models){assert.ok(car);assert.equal(catalog.find(i=>i.id===car.id),car);assert.equal(car.category,'vehicle');assert.ok(Number.isSafeInteger(car.price)&&car.price>0);assert.ok(car.dimensions.wheelbaseMm<car.dimensions.lengthMm);assert.deepEqual(car.availableColors,VEHICLE_COLORS.map(c=>c.id));assert.ok(car.availableColors.includes(car.defaultColor));assert.match(car.description,/virtual/i);assert.match(car.description,/approximation/i);for(const sections of[car.renderShape.body,car.renderShape.cabin])for(const section of sections)assert.ok(section[1]>section[2],car.id+' positive panel thickness');}
  assert.deepEqual(new Set(models.map(i=>i.brand)),new Set(['Ferrari','Lamborghini','Bugatti','Porsche']));
});

test('all six actual generated meshes have finite indexed geometry and four independent moving wheels',()=>{
  for(const car of models){const {model,dispose}=build(car);let triangles=0,meshes=0;const wheels=model.children.filter(p=>p.name==='Animated wheel');assert.equal(wheels.length,4,car.id);
    for(const wheel of wheels){assert.ok(wheel.isGroup);assert.ok(wheel.children.every(p=>p.isMesh));const before=new THREE.Box3().setFromObject(wheel);wheel.rotation.z=.5;wheel.updateMatrixWorld(true);const after=new THREE.Box3().setFromObject(wheel);assert.ok(before.getSize(new THREE.Vector3()).length()>0);assert.ok(after.getSize(new THREE.Vector3()).length()>0);}
    model.traverse(p=>{if(!p.isMesh)return;meshes++;const pos=p.geometry.getAttribute('position'),normal=p.geometry.getAttribute('normal');assert.ok(pos.count>0);assert.equal(pos.count,normal.count);for(const n of pos.array)assert.ok(Number.isFinite(n),car.id+' position');for(const n of normal.array)assert.ok(Number.isFinite(n),car.id+' normal');for(const i of p.geometry.index?.array||[])assert.ok(i>=0&&i<pos.count,car.id+' index');triangles+=(p.geometry.index?.count||pos.count)/3;});
    assert.ok(meshes<40,car.id+' rigid pieces stay batched');assert.ok(triangles>1000&&triangles<10000,car.id+' local procedural mesh stays bounded');dispose();
  }
});

test('measured wheelbase, stance and height retain model-specific real-world proportions',()=>{
  const results=new Map();for(const car of models){const fixture=build(car),wheels=fixture.model.children.filter(p=>p.name==='Animated wheel'),wheelbase=Math.max(...wheels.map(p=>p.position.x))-Math.min(...wheels.map(p=>p.position.x));
    assert.ok(Math.abs(wheelbase/fixture.size.x-car.dimensions.wheelbaseMm/car.dimensions.lengthMm)<.04,car.id+' wheelbase proportion');
    assert.ok(Math.abs(fixture.size.y/fixture.size.x-car.dimensions.heightMm/car.dimensions.lengthMm)<.04,car.id+' height proportion');
    results.set(car.id,fixture.size.clone());fixture.dispose();}
  assert.ok(results.get('lamborghini-urus').y>results.get('lamborghini-huracan').y*1.35);
  assert.ok(results.get('lamborghini-urus').x>results.get('lamborghini-huracan').x*1.1);
  assert.ok(results.get('bugatti-chiron').z>results.get('porsche-911').z*1.08);
  assert.ok(results.get('ferrari-roma').y>results.get('ferrari-sf90').y*1.05);
});

test('body geometry stays different after normalizing dimensions and paint',()=>{
  const signatures=[];for(const car of models){const fixture=build(car);signatures.push(geometricSignature(fixture.model));fixture.dispose();}
  assert.equal(new Set(signatures).size,models.length,'rescaling and relabeling a common body cannot satisfy the six models');
  const roma=build(vehicleFor('ferrari-roma')),sf90=build(vehicleFor('ferrari-sf90')),porsche=build(vehicleFor('porsche-911'));
  const cabinBounds=f=>{const cabin=f.model.children.find(p=>p.name==='Model-specific cabin glazing');assert.ok(cabin);return new THREE.Box3().setFromObject(cabin);};
  assert.ok(cabinBounds(roma).max.x/roma.size.x<cabinBounds(sf90).max.x/sf90.size.x-.09,'Roma leaves a visibly longer bonnet');
  assert.ok(cabinBounds(porsche).min.x/porsche.size.x<cabinBounds(sf90).min.x/sf90.size.x-.10,'911 glass extends into its rounded rear fastback');
  roma.dispose();sf90.dispose();porsche.dispose();
});

test('repaint alters every painted material without changing model geometry or glazing',()=>{
  for(const car of models){const red=build(car,'red'),green=build(car,'green');assert.equal(geometricSignature(red.model),geometricSignature(green.model));
    for(const [fixture,color]of[[red,'red'],[green,'green']]){const paint=[],glass=[];fixture.model.traverse(p=>{if(p.material?.metalness===.28)paint.push(p.material.color.getHexString());if(p.name==='Model-specific cabin glazing')glass.push(p.material.color.getHexString());});assert.ok(paint.length>0);assert.ok(paint.every(hex=>hex===VEHICLE_COLORS.find(c=>c.id===color).hex.slice(1)));assert.deepEqual(glass,['243f4e']);fixture.dispose();}
  }
});

test('fallback illustrations expose distinct local silhouettes, accessible names and selected paint',()=>{
  const outlines=[];for(const car of models){const svg=vehicleIllustration(car,'red');assert.match(svg,/^<svg /);assert.ok(svg.includes(`aria-label="${car.name} in Ruby red"`));assert.ok(svg.includes(`data-vehicle-model="${car.modelStyle}"`));assert.ok(svg.includes('data-vehicle-color="red"'));assert.ok(svg.includes('#963d41'));assert.doesNotMatch(svg,/NaN|undefined|<image|<script|https?:\/\//);outlines.push(svg.match(/<path d="([^"]+)" fill="#963d41"/)[1]);const next=vehicleIllustration(car,'green');assert.notEqual(svg.match(/id="([^"]+)-paint"/)[1],next.match(/id="([^"]+)-paint"/)[1]);}
  assert.equal(new Set(outlines).size,models.length,'side outlines differ before badges or paint are applied');
  const hostile=vehicleIllustration({...vehicleFor('ferrari-roma'),name:'<script>bad</script>'},'silver');assert.ok(hostile.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.doesNotMatch(hostile,/<script>/);
});

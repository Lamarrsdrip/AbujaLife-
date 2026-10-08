import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildInterior,furniturePlacementPreservesRoutes} from '../app/world-interiors.js';
import {buildThreeEnvironment} from '../app/world-3d-scenes.js';
import {worldVehicleState} from '../app/world-vehicle-state.js';
import {venueFor} from '../src/shared/life.mjs';
import {VEHICLE_CATALOG} from '../src/shared/vehicles.mjs';

const scene={width:1400,height:1100,objects:[],walls:[],floorAreas:[],furniturePlacements:[],interactables:[],buildings:[],traffic:[]};
function withoutCanvas(t){const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>null})};t.after(()=>{globalThis.document=previous;});}

test('both existing cinemas carry their authored projection screen into actual Three geometry',t=>{
  withoutCanvas(t);
  for(const venueId of ['cinema','ceddi-genesis-cinema']){
    const layout=buildInterior({profile:{location:{kind:'venue',venue:venueId}},venue:venueFor(venueId)});
    const screen=layout.objects.find(object=>object.kind==='cinema-screen');
    assert.deepEqual({x:screen?.x,y:screen?.y,w:screen?.w,h:screen?.h,kind:screen?.kind,solid:screen?.solid},{x:129,y:157,w:1172,h:128,kind:'cinema-screen',solid:false});
    assert.equal(layout.objects.filter(object=>object.kind==='cinema-chair').length,48,'existing auditorium seats stay intact');
    assert.equal(furniturePlacementPreservesRoutes(layout,null),true,'screen adds no walking collision');
    const environment=buildThreeEnvironment(THREE,{scene:layout,kind:'venue',venue:venueFor(venueId)});
    assert.ok(environment.group.userData.objects.includes('cinema-screen'));
    const projection=environment.group.getObjectByName('Cinema projection screen');
    assert.ok(projection?.isMesh,'projection is real geometry rather than hidden SVG');
    assert.ok(projection.material.emissiveIntensity>0);
    assert.equal(projection.material.map,null,'static illustration requires no video decode or extra image texture');
    environment.group.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(projection);
    assert.ok(bounds.getSize(new THREE.Vector3()).x>1100,'screen remains wide enough to recognize');
    assert.ok(bounds.min.y>40,'screen is raised above the floor');
    let released=0;projection.material.addEventListener('dispose',()=>released++);
    environment.dispose();environment.dispose();assert.equal(released,1);
  }
});

test('interaction and native scenery select the same actual parked vehicle, not the first inventory item',t=>{
  withoutCanvas(t);
  const [first,chosen]=VEHICLE_CATALOG.filter(item=>item.renderShape).slice(0,2);
  assert.ok(first&&chosen);
  const profile={district:'garki',inventory:[first.id,chosen.id],vehiclePresence:{vehicleId:chosen.id,district:'garki',state:'parked'}};
  assert.deepEqual(worldVehicleState(profile),{vehicleId:chosen.id,carWithYou:true});
  const environment=buildThreeEnvironment(THREE,{scene,profile,kind:'public'});
  assert.equal(environment.playerModel()?.userData.vehicleId,chosen.id);
  const cars=environment.group.children.filter(object=>object.userData.vehicleId);
  assert.equal(cars.length,2);assert.ok(cars.every(object=>object.userData.vehicleId===chosen.id));
  environment.update({player:{x:200,y:200},parked:{x:400,y:400},ownVehicle:chosen.id,carWithYou:true});
  assert.equal(cars[0].visible,false);assert.equal(cars[1].visible,true);
  environment.update({player:{x:200,y:200},parked:{x:400,y:400},ownVehicle:null,carWithYou:false});
  assert.equal(cars[1].visible,false,'absent server vehicle has no ghost model');
  environment.update({player:{x:200,y:200},parked:{x:400,y:400},ownVehicle:chosen.id,carWithYou:false});
  assert.equal(cars[1].visible,false,'legacy recorded district visibility also reaches WebGL');
  environment.update({player:{x:200,y:200},ownVehicle:chosen.id,carWithYou:true,transport:true,driving:true});
  assert.equal(cars[0].visible,true);assert.equal(cars[1].visible,false,'driving never duplicates the parked car');
  environment.dispose();
});

test('cars left in other districts and transit are absent while legacy owned-car and paid transport keep working',t=>{
  withoutCanvas(t);
  const id=VEHICLE_CATALOG[0].id;
  for(const presence of [{vehicleId:id,district:'jabi',state:'parked'},{vehicleId:id,district:'garki',state:'transit'}]){
    const profile={district:'garki',inventory:[id],vehiclePresence:presence};
    assert.deepEqual(worldVehicleState(profile),{vehicleId:null,carWithYou:false});
    const environment=buildThreeEnvironment(THREE,{scene,profile,kind:'public'});
    assert.equal(environment.playerModel(),undefined);
    assert.equal(environment.group.children.some(object=>object.userData.vehicleId),false);
    environment.dispose();
  }
  assert.deepEqual(worldVehicleState({district:'garki',inventory:[id]}),{vehicleId:id,carWithYou:true});
  assert.deepEqual(worldVehicleState({district:'garki',inventory:[id]},'jabi'),{vehicleId:id,carWithYou:false});
  const transport=buildThreeEnvironment(THREE,{scene,profile:{activeTrip:{mode:'bus'}},kind:'transit'});
  assert.equal(transport.playerModel()?.name,'bus');transport.dispose();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../app/vendor/three.module.js';
import { WORLD_CAMERA, WORLD_ZOOM, clampWorldZoom, worldViewport, constrainWorldCamera, applyWorldCamera, screenToWorld, worldToScreen, worldGroundMatrix, worldFloorTransform, screenVectorToWorld, normalizeWorldOrientation, worldCameraEnvelope } from '../app/world-camera.js';

test('mobile neighbourhood framing exposes several streets without depending on device pixel ratio', () => {
  const view = worldViewport({pixelWidth: 358, pixelHeight: 540, sceneWidth: 3540, sceneHeight: 4190});
  assert.ok(view.width >= 1200, 'default phone view is at least three times the former 393 world-unit crop');
  assert.equal(view.width / view.height, 358 / 540);
  const desktop = worldViewport({pixelWidth: 1200, pixelHeight: 760, sceneWidth: 3540, sceneHeight: 4190});
  assert.ok(desktop.width > view.width && desktop.width <= 1640);
});

test('every room edge remains visible at default zoom on narrow phones and wide desktops', () => {
  for (const [sceneWidth, sceneHeight] of [[1000, 820], [1320, 1100], [1640, 1230]]) {
    for (const [pixelWidth, pixelHeight] of [[358, 540], [1200, 760]]) {
      const view = worldViewport({pixelWidth, pixelHeight, sceneWidth, sceneHeight, interior: true});
      const center = constrainWorldCamera({x: 80, y: sceneHeight - 145}, view, {width: sceneWidth, height: sceneHeight});
      assert.deepEqual(center, {x: sceneWidth / 2, y: sceneHeight / 2});
      assert.ok(view.width >= sceneWidth + 128 && view.height >= sceneHeight + 144);
      for (const p of [{x: 0, y: 0}, {x: sceneWidth, y: sceneHeight}]) {
        const screen = worldToScreen(p, {left: 0, top: 0, width: pixelWidth, height: pixelHeight}, center, view);
        assert.ok(screen.x > 0 && screen.x < pixelWidth && screen.y > 0 && screen.y < pixelHeight);
      }
    }
  }
});

test('zoom gestures and repeated taps cannot exceed the playable camera range', () => {
  let zoom = 1;
  for (let i = 0; i < 200; i++) zoom = clampWorldZoom(zoom * WORLD_ZOOM.step);
  assert.equal(zoom, WORLD_ZOOM.max);
  for (let i = 0; i < 200; i++) zoom = clampWorldZoom(zoom / WORLD_ZOOM.step);
  assert.equal(zoom, WORLD_ZOOM.min);
  assert.equal(clampWorldZoom(Number.NaN), 1);
  assert.equal(clampWorldZoom(Infinity), 1);
  assert.equal(clampWorldZoom(-1000), WORLD_ZOOM.min);
  assert.equal(clampWorldZoom(1000), WORLD_ZOOM.max);
});

test('floor picking stays aligned with genuine 3D projection through zoom, follow and resize', () => {
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), camera = new THREE.OrthographicCamera(-500, 500, 325, -325, 1, 12000);
  for (const [pixelWidth, pixelHeight] of [[358, 540], [1024, 680]]) {
    const bounds = {left: 13, top: 122, width: pixelWidth, height: pixelHeight};
    for (const zoom of [.8, 1, 1.44, 2.5]) {
      const view = worldViewport({pixelWidth, pixelHeight, sceneWidth: 3540, sceneHeight: 4190, zoom});
      const center = constrainWorldCamera({x: 1840, y: 2400}, view, {width: 3540, height: 4190});
      assert.equal(applyWorldCamera(camera, {...center, ...view}), true);
      for (const point of [{x: 1780, y: 2480}, {x: 1900, y: 2310}, {x: center.x, y: center.y}]) {
        const projected = new THREE.Vector3(point.x, 0, point.y / Math.SQRT1_2).project(camera);
        const rendered = {x: bounds.left + (projected.x + 1) * bounds.width / 2, y: bounds.top + (1 - projected.y) * bounds.height / 2};
        const overlay = worldToScreen(point, bounds, center, view), picked = screenToWorld(rendered, bounds, center, view);
        assert.ok(Math.abs(rendered.x - overlay.x) < 1e-8 && Math.abs(rendered.y - overlay.y) < 1e-8, 'visible mesh and click plane coincide');
        assert.ok(Math.hypot(picked.x - point.x, picked.y - point.y) < 1e-8);
        ray.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
        const hit = ray.ray.intersectPlane(ground, new THREE.Vector3());
        assert.ok(Math.hypot(hit.x - point.x, hit.z * Math.SQRT1_2 - point.y) < 1e-8, 'real camera ray hits the same furniture floor coordinate');
      }
    }
  }
});

test('camera constraints follow roads at close zoom and center rooms when wider than their bounds', () => {
  assert.deepEqual(constrainWorldCamera({x: 20, y: 4100}, {width: 500, height: 600}, {width: 3540, height: 4190}), {x: 250, y: 3890});
  assert.deepEqual(constrainWorldCamera({x: 10, y: 10}, {width: 1300, height: 1800}, {width: 1000, height: 800}), {x: 500, y: 400});
  const camera = new THREE.OrthographicCamera(-500, 500, 325, -325, 1, 12000);
  assert.equal(applyWorldCamera(camera, {x: 0, y: 0, width: 0, height: 600}), false);
});

test('oblique dollhouse floor picking agrees with actual camera rays, SVG floor transforms and screen directions', () => {
  const camera=new THREE.OrthographicCamera(-500,500,325,-325,1,12000),ray=new THREE.Raycaster(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const bounds={left:11,top:123,width:390,height:510};
  for(const zoom of [.8,1,1.44,2.5]){
    const view=worldViewport({pixelWidth:bounds.width,pixelHeight:bounds.height,sceneWidth:3540,sceneHeight:4190,zoom,oblique:true});
    const center=constrainWorldCamera({x:1710,y:2060},view,{width:3540,height:4190});
    applyWorldCamera(camera,{...center,...view});
    const affine=worldFloorTransform(center,view).match(/matrix\(([^)]+)\)/)[1].split(' ').map(Number);
    for(const point of [{x:1450,y:1820},{x:1820,y:2390},center]){
      const projected=new THREE.Vector3(point.x,0,point.y*Math.SQRT2).project(camera);
      const expected=worldToScreen(point,bounds,center,view),picked=screenToWorld(expected,bounds,center,view);
      const actual={x:bounds.left+(projected.x+1)*bounds.width/2,y:bounds.top+(1-projected.y)*bounds.height/2};
      assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-8,'genuine oblique mesh and interactive floor coincide');
      assert.ok(Math.hypot(point.x-picked.x,point.y-picked.y)<1e-8);
      const [a,b,c,d,e,f]=affine,svgFloor={x:a*point.x+c*point.y+e,y:b*point.x+d*point.y+f};
      const svgScreen={x:bounds.left+(svgFloor.x-center.x+view.width/2)/view.width*bounds.width,y:bounds.top+(svgFloor.y-center.y+view.height/2)/view.height*bounds.height};
      assert.ok(Math.hypot(svgScreen.x-actual.x,svgScreen.y-actual.y)<1e-8,'SVG labels, paths and furnishing ghosts follow the 3D ground');
      ray.setFromCamera(new THREE.Vector2(projected.x,projected.y),camera);
      const hit=ray.ray.intersectPlane(ground,new THREE.Vector3());
      assert.ok(Math.hypot(hit.x-point.x,hit.z/Math.SQRT2-point.y)<1e-8);
    }
  }
  const matrix=worldGroundMatrix(true);
  for(const input of [{x:1,y:0},{x:0,y:1},{x:-.3,y:.7}]){
    const world=screenVectorToWorld(input,true);
    assert.ok(Math.hypot(matrix.a*world.x+matrix.c*world.y-input.x,matrix.b*world.x+matrix.d*world.y-input.y)<1e-9,'joystick directions remain screen relative');
  }
});

test('oblique rooms frame every floor corner and full rear wall on phones and desktops',()=>{
  const camera=new THREE.OrthographicCamera(-500,500,325,-325,1,12000);
  for(const [width,height]of[[1000,820],[1320,1100],[1640,1230]])for(const [pixelWidth,pixelHeight]of[[390,510],[1200,760]]){
    const view=worldViewport({pixelWidth,pixelHeight,sceneWidth:width,sceneHeight:height,interior:true,oblique:true}),center=constrainWorldCamera({x:80,y:height-140},view,{width,height});
    assert.deepEqual(center,{x:width/2,y:height/2});applyWorldCamera(camera,{...center,...view});
    for(const [x,y,z]of[[0,0,0],[width,0,0],[0,0,height],[width,0,height],[50,176,134],[width-50,176,134]]){
      const point=new THREE.Vector3(x,y,z*Math.SQRT2).project(camera);
      assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1,'floor and roofless wall remain in the default frame');
    }
    const base=new THREE.Vector3(width/2,0,height/2*Math.SQRT2).project(camera),top=new THREE.Vector3(width/2,176,height/2*Math.SQRT2).project(camera);
    assert.ok((base.y-top.y)*pixelHeight/2<-20,'wall elevation remains visibly tall at whole-room framing');
  }
});

test('oblique city follow keeps dealership exits and edge residents inside the real projected viewport',()=>{
  const camera=new THREE.OrthographicCamera(-500,500,325,-325,1,12000),scene={width:3540,height:4190};
  const bounds={left:0,top:0,width:390,height:730};
  for(const zoom of [.8,1,2.5])for(const player of [{x:405,y:1458},{x:32,y:32},{x:3508,y:32},{x:32,y:4158},{x:3508,y:4158}]){
    const view=worldViewport({pixelWidth:bounds.width,pixelHeight:bounds.height,sceneWidth:scene.width,sceneHeight:scene.height,zoom,oblique:true});
    const center=constrainWorldCamera({x:player.x,y:player.y-55},view,scene);applyWorldCamera(camera,{...center,...view});
    for(const height of [0,180]){
      const projected=new THREE.Vector3(player.x,height,player.y*Math.SQRT2).project(camera);
      assert.ok(Math.abs(projected.x)<.92&&Math.abs(projected.y)<.92,JSON.stringify({zoom,player,height,center,projected}));
    }
    const rendered=worldToScreen(player,bounds,center,view),picked=screenToWorld(rendered,bounds,center,view);
    assert.ok(Math.hypot(picked.x-player.x,picked.y-player.y)<1e-8,'edge following preserves precise floor picks');
    assert.ok(rendered.x>20&&rendered.x<bounds.width-20&&rendered.y>20&&rendered.y<bounds.height-20);
  }
});

test('full orbit angles preserve floor rays, movement directions and complete default room framing',()=>{
  const camera=new THREE.OrthographicCamera(-500,500,325,-325,1,12000),ray=new THREE.Raycaster(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const scene={width:1760,height:1280},bounds={left:11,top:94,width:390,height:730};
  for(let turn=0;turn<12;turn++)for(const elevation of [WORLD_CAMERA.minElevation,WORLD_CAMERA.elevation,WORLD_CAMERA.maxElevation]){
    const view=worldViewport({pixelWidth:bounds.width,pixelHeight:bounds.height,sceneWidth:scene.width,sceneHeight:scene.height,interior:true,oblique:true,yaw:turn*Math.PI/6,elevation});
    const center=constrainWorldCamera({x:200,y:1180},view,scene);assert.deepEqual(center,{x:880,y:640});applyWorldCamera(camera,{...center,...view});
    for(const point of [{x:0,y:0},{x:scene.width,y:0},{x:0,y:scene.height},{x:scene.width,y:scene.height},{x:795,y:847}]){
      const projected=new THREE.Vector3(point.x,0,point.y*Math.SQRT2).project(camera),screen=worldToScreen(point,bounds,center,view);
      assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1,'all room corners fit after orbit');
      assert.ok(Math.hypot(screen.x-(bounds.left+(projected.x+1)*bounds.width/2),screen.y-(bounds.top+(1-projected.y)*bounds.height/2))<1e-7,'current orbit is shared by meshes and controls');
      ray.setFromCamera(new THREE.Vector2(projected.x,projected.y),camera);const hit=ray.ray.intersectPlane(ground,new THREE.Vector3());
      assert.ok(Math.hypot(hit.x-point.x,hit.z/Math.SQRT2-point.y)<1e-7,'camera picking does not drift while orbiting');
      const picked=screenToWorld(screen,bounds,center,view);assert.ok(Math.hypot(picked.x-point.x,picked.y-point.y)<1e-7);
    }
    const matrix=worldGroundMatrix(true,view),right=screenVectorToWorld({x:1,y:0},true,view);
    assert.ok(Math.abs(matrix.a*right.x+matrix.c*right.y-1)<1e-8&&Math.abs(matrix.b*right.x+matrix.d*right.y)<1e-8,'rightward input still moves right on the screen');
    for(const x of [50,scene.width-50]){
      const wall=new THREE.Vector3(x,176,134*Math.SQRT2).project(camera);assert.ok(Math.abs(wall.x)<1&&Math.abs(wall.y)<1&&Math.abs(wall.z)<1,'full-height rear walls are visible and not near/far clipped');
    }
  }
});

test('orbit camera envelope contains visible elevated meshes even for a tall low-angle mobile frustum',()=>{
  const camera=new THREE.OrthographicCamera(-500,500,325,-325,1,12000),center={x:405,y:1458};
  for(const height of [730,3800,6200])for(const elevation of [WORLD_CAMERA.minElevation,WORLD_CAMERA.elevation,WORLD_CAMERA.maxElevation])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const view={width:height*390/730,height,oblique:true,yaw,elevation},envelope=worldCameraEnvelope(view);applyWorldCamera(camera,{...center,...view});
    assert.ok(camera.position.y>600,'the camera remains above the geometry allowance');assert.equal(camera.near,envelope.near);assert.equal(camera.far,envelope.far);
    for(const modelHeight of [0,176,600])for(const side of [-1,1]){
      const floor=screenVectorToWorld({x:side*view.width*.49,y:side*view.height*.49+modelHeight*Math.cos(elevation)},true,view);
      const mesh=new THREE.Vector3(center.x+floor.x,modelHeight,(center.y+floor.y)*Math.SQRT2).project(camera);
      assert.ok(Math.abs(mesh.x)<1&&Math.abs(mesh.y)<1&&Math.abs(mesh.z)<1,JSON.stringify({height,elevation,yaw,modelHeight,side,mesh,envelope}));
    }
  }
  const repaired=normalizeWorldOrientation({yaw:NaN,elevation:Infinity});assert.deepEqual(repaired,{yaw:WORLD_CAMERA.yaw,elevation:WORLD_CAMERA.elevation});
});

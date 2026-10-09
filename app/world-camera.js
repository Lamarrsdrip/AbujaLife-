// Camera preferences are local presentation only; they never change player state.
// min is a safe, non-zero floor: the viewport divides by zoom, and at .01 the
// view is 100x the default frame, far beyond any authored scene plus context.
export const WORLD_ZOOM = Object.freeze({min: .01, max: 10, step: 1.3, default: 1});
// A fixed, original dollhouse angle makes wall height and furniture sides visible.
// The authored floor and server coordinates stay unchanged.
export const WORLD_CAMERA = Object.freeze({yaw: 31 * Math.PI / 180, elevation: 38 * Math.PI / 180,
  minElevation: 28 * Math.PI / 180, maxElevation: 68 * Math.PI / 180, depthScale: Math.SQRT2});
const bounded = (value, min, max) => Math.max(min, Math.min(max, value));
const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;

export function normalizeWorldOrientation({yaw, elevation} = {}) {
  const angle=Number.isFinite(yaw)?yaw:WORLD_CAMERA.yaw;
  return {yaw: angle>=-Math.PI&&angle<Math.PI?angle:((angle+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI,
    elevation: bounded(Number.isFinite(elevation)?elevation:WORLD_CAMERA.elevation,WORLD_CAMERA.minElevation,WORLD_CAMERA.maxElevation)};
}

export function worldGroundMatrix(oblique = false, orientation = WORLD_CAMERA) {
  if (!oblique) return {a: 1, b: 0, c: 0, d: 1};
  const {yaw,elevation}=normalizeWorldOrientation(orientation),{depthScale}=WORLD_CAMERA;
  return {a: Math.cos(yaw), b: Math.sin(elevation) * Math.sin(yaw), c: -depthScale * Math.sin(yaw), d: depthScale * Math.sin(elevation) * Math.cos(yaw)};
}

export function screenVectorToWorld(vector, oblique = false, orientation = WORLD_CAMERA) {
  const {a,b,c,d} = worldGroundMatrix(oblique,orientation), determinant = a*d-b*c;
  return {x: (d*vector.x-c*vector.y)/determinant, y: (-b*vector.x+a*vector.y)/determinant};
}

/** Project just the authored floor; elevated meshes are still genuine 3D geometry. */
export function worldFloorTransform(camera, viewport) {
  const {a,b,c,d} = worldGroundMatrix(viewport.oblique,viewport);
  return `matrix(${a} ${b} ${c} ${d} ${camera.x-a*camera.x-c*camera.y} ${camera.y-b*camera.x-d*camera.y})`;
}

export function clampWorldZoom(value) {
  return bounded(Number.isFinite(value) ? value : WORLD_ZOOM.default, WORLD_ZOOM.min, WORLD_ZOOM.max);
}

/** Frame a whole room, or several streets, instead of scaling world units with phone pixels. */
export function worldViewport({pixelWidth, pixelHeight, sceneWidth, sceneHeight, interior = false, transit = false, zoom = 1, oblique = false, yaw, elevation}) {
  const aspect = positive(pixelWidth, 1000) / positive(pixelHeight, 640);
  const width = positive(sceneWidth, 1000), height = positive(sceneHeight, 650);
  const orientation=normalizeWorldOrientation({yaw,elevation}),matrix = worldGroundMatrix(oblique,orientation);
  const projectedWidth = Math.abs(matrix.a)*width+Math.abs(matrix.c)*height;
  const projectedHeight = Math.abs(matrix.b)*width+Math.abs(matrix.d)*height;
  const wallClearance = oblique ? 180 * Math.cos(orientation.elevation) : 0;
  const baseWidth = interior
    ? oblique ? Math.max(projectedWidth+72, (projectedHeight+wallClearance*2+72)*aspect)
      : Math.max(width + 128, (height + 144) * aspect)
    : transit ? Math.max(1080, Math.min(1500, 1080 * Math.sqrt(aspect / .72)))
      : Math.max(1200, Math.min(1640, 1200 * Math.sqrt(aspect / .72)));
  const level = clampWorldZoom(zoom);
  return {width: baseWidth / level, height: baseWidth / level / aspect, zoom: level, baseWidth, oblique, ...orientation};
}

/** An oversized viewport must center the scene, rather than push it into one corner. */
export function constrainWorldCamera(position, viewport, scene) {
  if (viewport.oblique) {
    const {a,b,c,d}=worldGroundMatrix(true,viewport);
    const projectedWidth=Math.abs(a)*scene.width+Math.abs(c)*scene.height;
    const projectedHeight=Math.abs(b)*scene.width+Math.abs(d)*scene.height;
    if(viewport.width>=projectedWidth&&viewport.height>=projectedHeight)return {x:scene.width/2,y:scene.height/2};
    // A rotated viewport cannot be constrained with its inverse axis-aligned
    // footprint: doing so pushes edge residents beyond a visible corner. Follow
    // the resident to the real scene boundary and permit background beyond it.
    return {x:bounded(Number.isFinite(position.x)?position.x:scene.width/2,0,scene.width),
      y:bounded(Number.isFinite(position.y)?position.y:scene.height/2,0,scene.height)};
  }
  const axis = (value, span, extent) => span >= extent
    ? extent / 2
    : bounded(Number.isFinite(value) ? value : extent / 2, span / 2, extent - span / 2);
  const {a,b,c,d} = worldGroundMatrix(viewport.oblique,viewport), determinant = a*d-b*c;
  const floorWidth = (Math.abs(d)*viewport.width+Math.abs(c)*viewport.height)/determinant;
  const floorHeight = (Math.abs(b)*viewport.width+Math.abs(a)*viewport.height)/determinant;
  return {x: axis(position.x, floorWidth, scene.width), y: axis(position.y, floorHeight, scene.height)};
}

/** Keep the orthographic eye above, and its clipping planes outside, visible geometry. */
export function worldCameraEnvelope({height, elevation, maxHeight = 600} = {}) {
  const orientation=normalizeWorldOrientation({elevation}),span=positive(height,650),clearance=positive(maxHeight,600);
  // A visible elevated mesh can be nearer than the same ground projection by
  // maxHeight/sin(elevation). This margin prevents orbiting into its near plane.
  const distance=Math.max(3600,span/2/Math.tan(orientation.elevation)+clearance/Math.sin(orientation.elevation)+200);
  return {distance,near:1,far:Math.max(12000,distance*2+clearance*2+400)};
}

/** Match the authored 2D floor coordinates with the actual orthographic 3D camera. */
export function applyWorldCamera(camera, {x, y, width, height, oblique = false, yaw, elevation, maxHeight}) {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return false;
  const orientation=normalizeWorldOrientation({yaw,elevation}),envelope=oblique?worldCameraEnvelope({height,elevation:orientation.elevation,maxHeight}):null;
  if (camera.right !== width / 2 || camera.top !== height / 2 || envelope&&(camera.near!==envelope.near||camera.far!==envelope.far)) {
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    if(envelope){camera.near=envelope.near;camera.far=envelope.far;}
    camera.updateProjectionMatrix();
  }
  if (oblique) {
    const {yaw,elevation}=orientation,{depthScale}=WORLD_CAMERA,{distance}=envelope;
    camera.position.set(x+distance*Math.cos(elevation)*Math.sin(yaw), distance*Math.sin(elevation), y*depthScale+distance*Math.cos(elevation)*Math.cos(yaw));
    camera.lookAt(x, 0, y*depthScale);
  } else {
    camera.position.set(x, 2200, y / Math.SQRT1_2 + 2200);
    camera.lookAt(x, 0, y / Math.SQRT1_2);
  }
  camera.updateMatrixWorld(true);
  return true;
}

// The SVG interaction plane and orthographic 3D ground plane share this exact transform.
export function screenToWorld(point, bounds, camera, viewport) {
  const projected = {x: ((point.x-bounds.left)/positive(bounds.width,1)-.5)*viewport.width,
    y: ((point.y-bounds.top)/positive(bounds.height,1)-.5)*viewport.height};
  const floor = screenVectorToWorld(projected, viewport.oblique,viewport);
  return {x: camera.x+floor.x, y: camera.y+floor.y};
}

export function worldToScreen(point, bounds, camera, viewport) {
  const {a,b,c,d} = worldGroundMatrix(viewport.oblique,viewport), dx=point.x-camera.x, dy=point.y-camera.y;
  return {x: bounds.left + ((a*dx+c*dy)/viewport.width+.5)*bounds.width,
    y: bounds.top + ((b*dx+d*dy)/viewport.height+.5)*bounds.height};
}

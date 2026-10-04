// Camera preferences are local presentation only; they never change player state.
export const WORLD_ZOOM = Object.freeze({min: .8, max: 2.5, step: 1.2, default: 1});
const bounded = (value, min, max) => Math.max(min, Math.min(max, value));
const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;

export function clampWorldZoom(value) {
  return bounded(Number.isFinite(value) ? value : WORLD_ZOOM.default, WORLD_ZOOM.min, WORLD_ZOOM.max);
}

/** Frame a whole room, or several streets, instead of scaling world units with phone pixels. */
export function worldViewport({pixelWidth, pixelHeight, sceneWidth, sceneHeight, interior = false, transit = false, zoom = 1}) {
  const aspect = positive(pixelWidth, 1000) / positive(pixelHeight, 640);
  const width = positive(sceneWidth, 1000), height = positive(sceneHeight, 650);
  const baseWidth = interior
    ? Math.max(width + 128, (height + 144) * aspect)
    : transit ? Math.max(1080, Math.min(1500, 1080 * Math.sqrt(aspect / .72)))
      : Math.max(1200, Math.min(1640, 1200 * Math.sqrt(aspect / .72)));
  const level = clampWorldZoom(zoom);
  return {width: baseWidth / level, height: baseWidth / level / aspect, zoom: level, baseWidth};
}

/** An oversized viewport must center the scene, rather than push it into one corner. */
export function constrainWorldCamera(position, viewport, scene) {
  const axis = (value, span, extent) => span >= extent
    ? extent / 2
    : bounded(Number.isFinite(value) ? value : extent / 2, span / 2, extent - span / 2);
  return {x: axis(position.x, viewport.width, scene.width), y: axis(position.y, viewport.height, scene.height)};
}

/** Match the authored 2D floor coordinates with the actual orthographic 3D camera. */
export function applyWorldCamera(camera, {x, y, width, height}) {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return false;
  if (camera.right !== width / 2 || camera.top !== height / 2) {
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  }
  camera.position.set(x, 2200, y / Math.SQRT1_2 + 2200);
  camera.lookAt(x, 0, y / Math.SQRT1_2); camera.updateMatrixWorld(true);
  return true;
}

// The SVG interaction plane and orthographic 3D ground plane share this exact transform.
export function screenToWorld(point, bounds, camera, viewport) {
  return {x: camera.x - viewport.width / 2 + (point.x - bounds.left) / positive(bounds.width, 1) * viewport.width,
    y: camera.y - viewport.height / 2 + (point.y - bounds.top) / positive(bounds.height, 1) * viewport.height};
}

export function worldToScreen(point, bounds, camera, viewport) {
  return {x: bounds.left + (point.x - camera.x + viewport.width / 2) / viewport.width * bounds.width,
    y: bounds.top + (point.y - camera.y + viewport.height / 2) / viewport.height * bounds.height};
}

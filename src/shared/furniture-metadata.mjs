// Authored game-model heights in the same floor units used by the 3D renderer.
// These are trusted catalogue definitions, never client-provided elevations.
export const FURNITURE_SURFACES = Object.freeze({
  'coffee-table': Object.freeze({ height:36.5, widthScale:1, depthScale:1 }),
  'bedside-table': Object.freeze({ height:51, widthScale:1, depthScale:1 }),
  'dining-table': Object.freeze({ height:52.5, widthScale:.7, depthScale:.7 }),
  'kitchen-unit': Object.freeze({ height:73, widthScale:1, depthScale:1 }),
  'storage-drawers': Object.freeze({ height:83, widthScale:1, depthScale:1 }),
});
export const SURFACE_FURNITURE = Object.freeze(['plant','music-speaker','art-piece','table-lamp','ceramic-vase','succulent','book-stack']);
export const SURFACE_ONLY_FURNITURE = Object.freeze(['table-lamp','ceramic-vase','succulent','book-stack']);
export const furnitureSurface = itemId => FURNITURE_SURFACES[itemId] || null;
export const canUseFurnitureSurface = itemId => SURFACE_FURNITURE.includes(itemId);

export function furnitureSurfaceRect(object) {
  const surface=furnitureSurface(object?.itemId);
  if(!surface)return null;
  const rotated=Number(object.rotation)%180!==0;
  const widthScale=rotated?surface.depthScale:surface.widthScale;
  const depthScale=rotated?surface.widthScale:surface.depthScale;
  const w=object.w*widthScale,h=object.h*depthScale;
  return {x:object.x+(object.w-w)/2,y:object.y+(object.h-h)/2,w,h,height:surface.height};
}

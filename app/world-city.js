// Stable Abuja world base + play-mode landmark sizing.
// Map/geographic registries remain untouched; only free-roam 3D landmark
// footprints are normalised so newer destinations have the same physical
// presence as the older hotel, cinema, residences and Tokyo blocks.
import { buildCity as buildBaseCity } from './world-city-base.js';

export { cityTree, vehicleArt, buildJourney } from './world-city-base.js';

export const WORLD_LANDMARK_SIZES=Object.freeze({
  airport:[560,300],cityGate:[390,260],stadium:[470,330],magicland:[420,300],
  wtc:[430,420],cbn:[420,390],assembly:[460,320],eagle:[400,250],
  mosque:[430,340],church:[410,330],transcorp:[460,390],millennium:[440,300],
  aso:[430,300],farmCity:[400,280],jabiLake:[500,300],mall:[440,300],
  conference:[440,320],banex:[440,290],inec:[420,320],efcc:[430,330],court:[430,320],
});

export function buildCity(options={}){
  const scene=buildBaseCity(options);
  scene.buildings=(scene.buildings||[]).map(building=>{
    if(!building?.landmarkBuilder)return building;
    const size=WORLD_LANDMARK_SIZES[building.landmarkBuilder];
    if(!size)return building;
    const centerX=building.x+building.w/2;
    const centerY=building.frontY===false?building.y+building.h/2:building.y-building.h/2;
    const [w,h]=size;
    return {...building,x:centerX-w/2,y:building.frontY===false?centerY-h/2:centerY+h/2,w,h,worldScale:'legacy-city-compatible'};
  });
  scene.landmarkScaleVersion=2;
  scene.landmarkScaleReference='legacy-hotel-cinema-residence';
  return scene;
}

export function worldLandmarkSize(builder){return WORLD_LANDMARK_SIZES[builder]||null;}

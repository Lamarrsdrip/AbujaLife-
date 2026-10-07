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

function environmentalSponsor(scene){
  const width=Number(scene?.width)||8500,height=Number(scene?.height)||4190;
  const x=Math.max(210,width-730),y=Math.max(250,height-330);
  return `<g class="city-context-block city-environmental-sponsor" data-environmental-sponsor="okrika" transform="translate(${x} ${y})"><ellipse cx="180" cy="104" rx="205" ry="28" fill="#183b3020"/><rect width="360" height="104" rx="18" fill="#f5efdc" stroke="#2c6f52" stroke-width="6"/><rect x="16" y="16" width="328" height="72" rx="12" fill="#176b49"/><text x="180" y="52" text-anchor="middle" fill="#fff" font-size="27" font-weight="800" letter-spacing="3">OKRIKA</text><text x="180" y="77" text-anchor="middle" fill="#d9f2e5" font-size="13" font-weight="650" letter-spacing="1.2">FIND IT · SELL IT · SWAP IT</text></g>`;
}

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
  // Okrika is AbujaLife's own environmental sponsor marker. Paid resident ads remain
  // exclusively in the existing Business Park/roadside inventory and backend.
  scene.art=`${String(scene.art||'')}${environmentalSponsor(scene)}`;
  scene.landmarkScaleVersion=2;
  scene.landmarkScaleReference='legacy-hotel-cinema-residence';
  scene.environmentalSponsor='okrika';
  return scene;
}

export function worldLandmarkSize(builder){return WORLD_LANDMARK_SIZES[builder]||null;}

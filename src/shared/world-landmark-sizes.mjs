// Physical free-roam footprints shared by SVG art, WebGL buildings and navigation.
export const WORLD_LANDMARK_SIZES=Object.freeze({
  airport:[560,300],cityGate:[390,260],stadium:[470,330],magicland:[420,300],
  wtc:[430,420],cbn:[420,390],assembly:[460,320],eagle:[400,250],
  mosque:[430,340],church:[410,330],transcorp:[460,390],millennium:[440,300],
  aso:[430,300],farmCity:[400,280],jabiLake:[500,300],mall:[440,300],
  conference:[440,320],banex:[440,290],inec:[420,320],efcc:[430,330],court:[430,320],
  cinema:[440,300],gallery:[420,300],grocery:[440,300],
});

// Reuse the established free-roam façade for equivalent building categories.
// Monument/landscape models and the requested CBN/EFCC silhouettes stay authored.
export const WORLD_LANDMARK_FACADES=Object.freeze({
  wtc:'office',assembly:'office',mosque:'mosque',church:'church',transcorp:'hotel',
  mall:'shop',conference:'office',inec:'office',court:'office',farmCity:'restaurant',
  banex:'tech-market',cinema:'cinema',gallery:'shop',grocery:'shop',
});

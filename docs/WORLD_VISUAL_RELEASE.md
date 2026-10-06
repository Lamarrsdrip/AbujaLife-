# AbujaLife World Visual Release

## Release direction

AbujaLife's production visual target is a premium stylized isometric 3D life-simulator: polished mid-poly silhouettes, restrained physically based materials, warm Abuja daylight, strong contact grounding, tasteful saturated colour, soft shadows and a miniature/diorama composition.

The upgrade must affect the real playable Three.js world. Do not use screenshots/background renders as a substitute and do not mount a second renderer or parallel world/state system.

## Canonical renderer rules

- Keep one world renderer, one camera/input path, one player entity, one location registry, one interaction path and one multiplayer presence contract.
- Direct Three.js remains the production renderer unless profiling demonstrates a blocker.
- Preserve the root scene during travel, LOD changes, asset loads, reconnects, visibility changes and quality transitions.
- A replacement chunk/LOD becomes visible only after it is ready; never transition `valid world -> blank -> replacement`.

## Production asset path

Editable source asset -> consistent scale/origin/pivot -> UV/PBR authoring -> optional baked self-AO/light information -> collision/interaction metadata -> LOD variants -> GLB/glTF 2.0 -> prune/dedup/quantize -> Meshopt where measured -> KTX2/Basis textures where measured -> content-hashed/versioned static asset -> CDN/runtime cache -> Three.js loader/cache.

Use GLTFLoader for production models. Use one geometry compression path per asset rather than double-compressing. KTX2Loader must call `detectSupport(renderer)` before compressed texture loads. Bundle all required decoder/transcoder assets under AbujaLife-controlled static paths.

Repeated props such as trees, lamps, benches and common residential modules should use shared geometry/materials and InstancedMesh or glTF instancing where practical.

## Lighting/materials

- MeshStandardMaterial-compatible metallic/roughness PBR.
- Colour/emissive textures are sRGB; normal/roughness/metalness/AO are data textures.
- PMREM-prefiltered environment lighting for PBR reflections/fill.
- One coherent warm sun/directional light.
- Baked/static AO and indirect-light cues for architecture where appropriate.
- Dynamic shadows/contact grounding only inside a measured near-player budget.
- Movable furniture cannot depend on permanent baked floor shadows.
- Preserve day/night/weather through lighting presets rather than replacing them.

## World/detail strategy

Near player: high-detail required assets and nearby multiplayer entities.

Nearby destination: async prefetch.

Mid distance: lower LOD/chunk detail.

Far distance: simplified massing/skyline.

Outside range: release only resources that are genuinely no longer referenced. Use LOD hysteresis so objects do not thrash at boundaries.

The local Outside view remains a playable neighbourhood-scale scene around the residence. The wide Abuja map/destination overview is secondary and is generated from the same canonical location registry.

## Abuja coverage

Landmarks/districts must be authored as recognisable stylised Abuja interpretations with sensible spatial relationships, not random generic towers. Core coverage includes City Gate, CBD/institutional skyline character, National Mosque, National Christian Centre, National Assembly/Eagle Square government zone, CBN, Transcorp Hilton area, Millennium Park, Jabi Lake/commercial area, Magicland, National Stadium, WTC/Twin-Tower character and existing supported districts/venues.

Important structures must connect to gameplay and multiplayer gathering/activity rather than exist only as decoration.

## Interior coverage

LAPO starter homes remain intentionally sparse but polished. Upgraded LAPO/NEPO homes should use premium cutaway/dollhouse composition, good proportions, warm materials and grounded furniture while preserving the existing authoritative furniture/property data model.

Furniture interaction remains catalogue -> buy/choose -> actual 3D item -> drag/rotate -> validated Place, plus Move/Rotate/Store/Sell for owned items.

## Performance and quality tiers

Do not use identical GPU budgets on every device. Establish High/Medium/Low tiers from measured capability/frame time. Adjust DPR, shadow range/map size, LOD distance and cosmetic entity budgets without replacing the world with placeholder cubes.

Track renderer info in development/admin diagnostics: FPS/frame time, calls, triangles, textures, geometries, active chunks and context-loss/asset-failure events.

## Reliability

Handle WebGL context loss/restoration, failed optional assets, cached-version mismatches, background/foreground, reconnect and partial district loads without dropping the whole scene.

Service worker/runtime caching should cache versioned public static assets only and must never public-cache authenticated/private API responses.

## Multiplayer/scale

Render 3D locally. Durable economy/ownership/messages remain server-authoritative in MongoDB. Realtime motion/presence uses spatial/venue interest management and a lower network tick rate than render FPS. Do not globally broadcast all movement. Distributed presence/pub-sub may be introduced behind the existing contract when measured load requires it; Redis Pub/Sub is never durable message storage.

## Acceptance evidence

Release claims require actual gameplay evidence, not compilation alone: LAPO starter/upgraded home, NEPO home, local outside street, club/gym/marketplace, furniture placement, vehicles/characters/phone, repeated navigation, two-account multiplayer where possible, WebKit/mobile viewport checks, production build and CI.

Do not claim 60 FPS, zero failures, unlimited scale or physical-device results without recorded measurements.

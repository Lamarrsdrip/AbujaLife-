# AbujaLife Premium 3D Continuation Checklist

This is the active implementation/handover checklist for `feat/real-abuja-multiplayer-city-2026-10-06`.

## Continuity
- Preserve latest main startup/auth/reconnect/browser-entry fixes.
- Preserve existing economy, jackpot, property, furniture, multiplayer, phone, transport and navigation contracts.
- Keep one canonical Three.js renderer/world/camera/interaction architecture.
- Finish existing city/polish/civic work before integration to main.
- Never force-push main or overwrite concurrent work.

## Outstanding thread requirements
- Remove duplicate/oversized My Life cards and unnecessary cards under the live view.
- Keep Outside as a readable local neighbourhood scene around the residence; use the wide Abuja map for destination discovery.
- Restore compact premium navigation controls on gameplay and map views.
- Fix the AbujaLife app icon/brand surface.
- Keep perimeter advertising plots as actual selectable buy/manage-able plots.
- Preserve geographically sensible Abuja landmark/district placement.
- Replace generic hero landmark shapes with recognisable stylised Abuja interpretations.
- Give landmark destinations actual multiplayer/activity purpose.
- Wire the fictional AbujaLife presidential election/campaign/integrity storyline to durable game state before calling it complete.

## Premium 3D implementation target
- Premium stylised isometric life-sim: polished mid-poly silhouettes, PBR materials, warm Nigerian daylight, soft grounding, tasteful colour and diorama composition.
- Improve the real playable world, not screenshots/backgrounds.
- Keep direct Three.js unless profiling proves a blocker.
- Introduce a production GLB/glTF path for hero/reusable assets instead of leaving runtime primitive trees as the final art standard.
- GLTFLoader + one measured geometry-compression path (prefer Meshopt where appropriate).
- KTX2/Basis compressed textures where appropriate with `KTX2Loader.detectSupport(renderer)`.
- Correct colour spaces and metallic/roughness PBR.
- PMREM/environment lighting plus one coherent sun and a bounded near-player shadow/contact budget.
- Shared geometry/materials and instancing for repeated props.
- Frustum culling, LOD with hysteresis and district/chunk visibility without remounting the root renderer.
- Progressive nearby loading; valid current world stays visible until replacement content is ready.
- Adaptive quality/DPR that preserves the art direction on mobile.
- Versioned public static asset caching only; never public-cache private authenticated API responses.

## Art/game coverage
- LAPO starter home stays intentionally sparse but polished.
- Upgraded LAPO and NEPO homes use premium cutaway/dollhouse composition while preserving authoritative furniture/property state.
- Upgrade local streets, clubs, gym, marketplace, vehicles, avatars, catalogue previews and phone surfaces consistently.
- Okrika Marketplace remains only an in-game virtual marketplace name; no Okrika commerce/wallet/inventory coupling.
- Keep varied characters and clothing.
- Maintain existing walking/bus/taxi/bike/owned-car behaviour and destination selection.

## Reliability/scale
- Client renders 3D locally; no default pixel streaming.
- Nearby/venue-based multiplayer interest only; no global high-frequency movement fanout.
- MongoDB remains durable truth for economy/ownership/messages.
- No database writes every animation frame.
- Do not claim millions of concurrent players or 60 FPS without measured evidence.

## Verification gates
- login/signup/startup/reconnect/browser entry
- `npm run qa`
- `npm run build`
- production integration/release validation
- browser/gameplay/premium smoke tests
- WebKit/mobile viewport coverage available in CI
- two-account multiplayer flow where environment permits
- renderer diagnostics for frame time/FPS, calls, triangles, textures/geometries, context loss and asset failures
- no blank-scene/world-root remount during normal travel/resume

## Refs when this checklist was created
- Main: `d0931885a4d774b005dbe1a65f8d2a9f3d0d8deb`
- Feature branch checkpoint before premium 3D work: `c0ca071f34a47c3f5b694f08f6a65e3b1bb99e23`
- PR: #39

Keep this file current as work progresses so another session can continue without restarting or losing requirements.

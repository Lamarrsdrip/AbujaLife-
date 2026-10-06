# AbujaLife Premium 3D Continuation Checklist

This document is the active handover/checklist for `feat/real-abuja-multiplayer-city-2026-10-06`.

## Continuity rules

- Preserve current `main` startup/auth/reconnect/browser-entry fixes.
- Preserve existing gameplay, economy, jackpot, property, furniture, multiplayer, phone and navigation contracts.
- Keep one canonical Three.js world/camera/interaction architecture. Do not add a second engine or overlay world.
- Complete and verify existing Abuja city/polish/civic work before integrating the full art-pipeline upgrade.
- Do not merge or force-push `main` until CI, production build and gameplay checks are green.

## Existing thread requirements being carried forward

- Remove duplicate/oversized My Life cards and unnecessary cards beneath the live view.
- Keep the local Outside view readable and playable around the resident instead of shrinking the whole city into the gameplay view.
- Keep a separate wide Abuja destination/map overview sourced from the canonical location registry.
- Restore compact premium navigation controls on gameplay and map views.
- Keep the AbujaLife app icon/brand surface correct.
- Preserve interactive perimeter advertising plots as actual buy/manage-able plots, not decorative colour.
- Preserve geographically sensible Abuja district/landmark placement.
- Major Abuja landmarks must be recognisable stylised interpretations, not generic building blocks.
- Preserve/expand activities at landmarks so they have gameplay purpose and multiplayer gathering value.
- Preserve the fictional AbujaLife presidential election/campaign/integrity storyline and wire it to real game state before exposing it as complete.
- Preserve the existing jackpot, transport, property, furniture, realtime, signup/login and reconnect systems.

## Premium 3D target

- Premium stylised isometric life-sim: polished mid-poly silhouettes, restrained PBR, warm Nigerian daylight, soft grounding, tasteful saturated colour and diorama composition.
- Improve the actual playable renderer, not screenshots/background images.
- Direct Three.js remains the renderer unless profiling proves a blocker.
- Prefer GLB/glTF 2.0 production assets over large trees of runtime primitives for final hero content.
- Reusable material families, consistent scale/origins/pivots, LOD metadata, collision bounds and interaction anchors.
- GLTFLoader + Meshopt; KTX2/Basis textures where supported with `KTX2Loader.detectSupport(renderer)`.
- Correct colour spaces, PBR metallic/roughness workflow, PMREM/environment lighting and a bounded shadow budget.
- Instancing/shared geometry/materials for repeated props.
- Frustum culling, LOD hysteresis and district/chunk visibility without remounting the root renderer.
- Progressive nearby loading; never blank the current world while a replacement chunk is loading.
- Adaptive quality tiers/DPR that preserve art direction on mobile.
- Service-worker/runtime caching for versioned public assets only; never public-cache private authenticated responses.

## Gameplay/art coverage

- LAPO starter home remains intentionally sparse but polished.
- Upgraded LAPO and NEPO homes use premium cutaway/dollhouse composition while preserving authoritative furniture data.
- Upgrade local streets, clubs, gym, marketplace, catalogue previews, vehicles, avatars and phone surfaces consistently.
- Okrika Marketplace remains only the in-game virtual marketplace name; no coupling to Okrika commerce/wallet/inventory.
- Keep varied characters and clothing/appearance options.
- Maintain transport chooser and supported walking/bus/taxi/bike/owned-car behaviour.

## Scale/reliability

- Client renders 3D locally; no default cloud pixel-streaming architecture.
- Nearby/venue-based multiplayer interest only; never global high-frequency movement broadcasts.
- MongoDB remains durable source of truth for economy/ownership/messages.
- Presence/pub-sub can be distributed behind the existing realtime contract when measured load requires it.
- No database writes every animation frame.
- Do not claim millions of concurrent users or 60 FPS without measured evidence.

## Verification gates

- Login/signup/startup/reconnect/browser-entry remain green before visual expansion.
- `npm run qa`
- `npm run build`
- production integration/release validation
- browser/gameplay/premium smoke tests
- mobile viewport/WebKit coverage available in CI
- two-account multiplayer flow where environment permits
- record renderer metrics: frame time/FPS, draw calls, triangles, textures/geometries and memory where browser instrumentation permits
- verify no world-root remount/blank-scene transition during normal navigation/resume

## Current refs at creation

- Main: `d0931885a4d774b005dbe1a65f8d2a9f3d0d8deb`
- Feature branch prior to this document: `c0ca071f34a47c3f5b694f08f6a65e3b1bb99e23`
- PR: #39

Update this document as implementation/testing progresses so another session can continue without restarting or losing requirements.

# AbujaLife

**AbujaLife is an original, premium social open-world life game set in Abuja.** This repository is the source-first foundation for one Unity client shipping to iOS, Android and WebGL, plus server-authoritative game/economy services.

The target is not "Lagos Life with Abuja names." The target is a navigable Abuja where a resident can live, work, drive, furnish homes, meet people, build businesses, attend events, participate in a fictional civic layer and discover Okrika's real marketplace without mixing virtual and real money.

## What is in this repo
- `game-unity/` — Unity 6 project source: third-person movement, camera, mobile controls, world streaming, generated Abuja vertical slice, vehicles/traffic, needs, interiors/furniture, phone/marketplace foundations, day/night/weather, performance helpers.
- `services/core/` — runnable Node 20 game-domain API with authoritative ledger, jobs, inventory, property, vehicles, businesses, social graph, presence, events, fictional Mayor elections, ads and Okrika handoff.
- `data/abuja/` — 46 encoded Abuja/FCT gameplay areas plus landmarks, roads, transit, jobs, properties, vehicles, businesses, events, NPC archetypes and City Market items.
- `infra/` — initial production Postgres schema and Docker local dependencies.
- `docs/` — product, architecture, art pipeline, monetization, Okrika growth loop, Abuja coverage, API and handoff notes.

## Run QA
```bash
npm run qa
```

## Run API
```bash
npm run start:api
# http://localhost:8787/health
```

## Generate the Unity code prototype
Open `game-unity/` in Unity 6, then run:

**AbujaLife → Build → Open World Vertical Slice**

The generated test world contains code-built Central Area, Wuse II, Jabi, Maitama, Gwarinpa, City Gate and an Aso Rock proxy so movement/streaming/world systems can be tested before final environment art arrives.

## Reality check
A believable open-world Abuja needs a professional 3D content pipeline. The generated buildings in this repo are deliberately placeholders; calling them the final realistic Abuja would be dishonest. The architecture is designed so final photogrammetry/modelled roads, structures, foliage, interiors, characters and vehicles replace placeholder art without replacing game systems.

## Okrika bridge
Virtual purchases use Abuja Naira. Physical Okrika items never do. `services/core/src/market.js` and `game-unity/.../CommerceBoundary.cs` enforce that separation in code.

See `docs/BUILD_AND_RELEASE.md` for repo setup and platform build steps.

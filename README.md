# AbujaLife

**AbujaLife is a browser-first social life game set across Abuja and the wider FCT.**

The product direction is deliberately simple: get into the world fast, build a life, earn and spend Abuja Naira, travel across Abuja, work, own homes and businesses, meet people, attend events, and discover Okrika real-world listings without mixing game money with physical commerce.

## Run locally

```bash
git pull origin main
npm run qa
npm run dev
```

Open:

```text
http://localhost:8787
```

No Unity installation is required for normal development or testing.

## Current playable alpha

- mobile-first browser game shell
- starter home scene and resident needs
- server-authoritative Abuja Naira
- food / sleep / hygiene / social loop
- playable job loop and reputation
- travel across a searchable Abuja/FCT atlas
- all six FCT Area Councils represented
- FCC planning phases/sectors represented as geography data
- satellite towns and communities represented separately from FCC districts
- in-game phone foundation
- Okrika real-world marketplace bridge
- game-money top-up boundary with receipt idempotency tests
- PWA manifest for installable web delivery

## Product rule

AbujaLife is **not** a fake 1:1 GTA clone and it is not a list of Abuja names. The complete territory lives in the world atlas; the places players actually enter are built as crafted gameplay scenes with their own visual identity, economy, people, activities and progression. This lets AbujaLife cover the whole FCT without turning into a huge low-quality procedural playground.

## Platforms

The web game is the primary instant-play surface. Native iOS and Android apps will ship from the same browser-first product shell with platform-specific payments, push notifications and store integrations added behind shared server-authoritative game rules.

## Okrika bridge

Abuja Naira is closed-loop virtual game currency. Real Okrika listings use real-world Okrika checkout. Game currency can never buy a physical Okrika item.

## Quality standard

Every player-facing scene must feel intentionally designed for Abuja. District identity comes from culture, density, roads, architecture, activities, economy and people—not just a label pasted over generic scenery.

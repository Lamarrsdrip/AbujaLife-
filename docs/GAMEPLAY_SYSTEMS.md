# Gameplay systems

## Core resident loop
Create resident → receive starter home → satisfy needs → earn through playable work → travel → socialize → buy clothes/furniture/vehicles → move homes → open business → build reputation → participate in events/civic systems.

## Systems implemented in source
- Third-person character motor and orbit camera
- Mobile joystick/look routing with desktop/WebGL fallback
- Needs model and server actions
- Server-authoritative Abuja Naira ledger
- Receipt-verification boundary and idempotent top-ups
- Virtual City Market
- Hard commerce boundary between Abuja Naira and physical Okrika goods
- Job shifts with score, reputation and cooldowns
- Home rent/purchase backend
- Furniture placement controller
- Owned vehicles, fuel, condition and odometer backend
- Drive controller / traffic agents / traffic lights
- Player businesses and business cycles
- Chat, friends, block state
- Presence heartbeat and nearby-player queries
- City events
- Fictional Mayor of AbujaLife nomination/voting
- In-world ad booking with moderation state
- Day/night, weather and Abuja dry/rainy-season controller
- District additive scene streaming
- Okrika marketplace handoff
- Mobile safe-area UI utility
- Adaptive quality controller

## Systems intentionally scaffolded, not falsely marked finished
Final realistic art, production animations, full multiplayer netcode, production payment verification adapters, scalable Postgres/Redis persistence, moderation console, voice calls, live service analytics, App Store/Play receipt servers and final asset bundles still require production implementation and content.

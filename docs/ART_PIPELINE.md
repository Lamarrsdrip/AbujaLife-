# Premium art pipeline

The code alone cannot make a believable city. Realism must be budgeted as a content pipeline.

## Characters
- original Nigerian/African base meshes and skin tones
- modular hair, beards, streetwear, corporate wear and traditional clothing
- retargeted locomotion set: walk/run/sprint/idle/phone/sit/eat/drink/dance/greet/drive/passenger/sleep
- LOD0-LOD3, GPU skinning budget, WebGL fallbacks

## Environment
- modular Abuja road kit: 2/4/6 lane, medians, service roads, gutters, sidewalks, intersections
- walls/gates/security booths/estate signage
- villa, terrace, apartment, shopfront, office and institutional kits
- Nigerian road furniture, power infrastructure, street lighting, waste bins, kiosks, parking details
- vegetation atlas tuned for Abuja climate
- decals: lane wear, patched asphalt, dust, drain staining, curb paint

## Vehicles
Original/licensed generic vehicles; no manufacturer trademarks unless licensed. Interior camera optional later. LODs and pooled traffic variants mandatory.

## Lighting
URP forward+ where device allows, baked GI for static interiors, reflection probes, light probes, volume profiles by district/weather, aggressive mobile shadow-distance tiers.

## Performance budgets
- mobile target: stable 30 baseline, 60 on capable devices
- dynamic resolution on mobile
- occlusion culling in dense blocks
- HLOD/impostors for distant skyline
- pooled pedestrians/traffic
- Addressables per district
- WebGL memory target defined and tested per content milestone

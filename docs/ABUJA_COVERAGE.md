# Abuja world coverage

AbujaLife treats Abuja as a streamed open world, not a menu of city names.

## Encoded world areas in this checkpoint
46 districts/areas are already represented in `data/abuja/districts.json`, spanning the established FCC core and major growth/satellite corridors. Phase-aware identity, architecture profile, road character, greenery, traffic, pedestrians, property tier, and streaming budget are data rather than hard-coded scene logic.

The first high-detail art-production wave should prioritize:
1. Central Area / Three Arms / major civic skyline
2. Wuse I + Wuse II
3. Maitama + Maitama Extension
4. Asokoro + Asokoro Extension
5. Jabi / lakefront
6. Garki I + II
7. Gwarinpa I + II
8. Guzape
9. Utako
10. Airport corridor / City Gate / Lugbe

Then fill the remaining encoded districts in waves while preserving world continuity.

## World anchors
`landmarks.json` contains original-game interpretations of Aso Rock, Millennium Park, Jabi Lake, Abuja City Gate, Moshood Abiola National Stadium, Abuja International Conference Centre, National Mosque, National Christian Centre, Three Arms Zone, Lower Usuma Dam, National Children's Park & Zoo, transport hubs and the airport.

Real-world landmarks are reference anchors only. Production art should be created from original modeling/photogrammetry/reference work with appropriate rights and should not reuse third-party game assets.

## Road/transport logic
`roads.json` models major expressway/parkway gameplay connections. `transit.json` separates walking, ride-hailing style trips, buses, rail and personally owned vehicles. Driving remains in-world so travel itself becomes gameplay.

## Abuja feel
The art direction is deliberately not a generic African city. District identity must be readable through road width, setbacks, walls/gates, vegetation density, elevation, building height, signage density, traffic and time-of-day behavior before the HUD tells the player where they are.

# AbujaLife Unity content root

The scripts here are asset-agnostic. Do not place downloaded/copied commercial game assets in this repository unless licensing explicitly permits redistribution.

Recommended scene split:
- `Boot`
- `PersistentSystems`
- `Wuse2_Exterior_A`
- `Wuse2_Interior_StarterApartment`
- `Jabi_Exterior_A`
- subsequent district chunks

Every exterior chunk should expose `WorldChunkAnchor` objects and be loadable additively by `WorldStreamManager`.

# Build & release

## Requirements
- Unity 6 / 6000.x with iOS, Android and WebGL modules
- Node.js 20+
- Xcode for iOS signing
- Android SDK/NDK supplied by Unity Hub
- Docker for local Postgres/Redis when moving beyond the in-memory dev store

## Backend
```bash
npm run qa
npm run start:api
```
API defaults to `http://localhost:8787`.

## Unity
1. Add `game-unity/` in Unity Hub.
2. Let packages resolve.
3. Run **AbujaLife → Build → Open World Vertical Slice**.
4. Open `Assets/AbujaLife/Scenes/AbujaVerticalSlice.unity`.
5. Press Play for the code-generated systems/world smoke slice.
6. Run **AbujaLife → Validate → Production Readiness** before commits that touch the Unity project.

The generated geometry is a systems testbed. It is not the promised final realistic Abuja artwork; replace it progressively with optimized production art while preserving location identities and gameplay components.

## Platforms
The production client is one Unity project targeting iOS, Android and WebGL. Platform payment adapters must map to the same backend ledger only after server-side verification.

## Git
```bash
git init
git add .
git commit -m "feat: bootstrap AbujaLife open-world foundation"
git branch -M main
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

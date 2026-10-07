# AbujaLife final integration — ACTIVE, NOT RELEASED

Resume from `codex/final-production-completion`. Do not call this task complete,
merge main, or deploy until all acceptance and production gates below pass.
The original complete user request is saved in `docs/FINAL_ENGINEER_REQUEST.md`.

## Starting state (verified 2026-10-07)

- Repository: Lamarrsdrip/AbujaLife-
- GitHub main: `c223a17092b26e594fe94b55225eb03ec072a385`
- PR #48: OPEN, DRAFT, MERGEABLE, head `d864a5ba154b5851032bc41d42b62a3f2ea3340d`
- Source branch: `fix/full-platform-integration-2026-10-07`
- CI 37573852172: QA/windows passed; browser failed at sleep-after-work empty marker list after checks 01–10.
- Frontend release validation 37573852170 passed.
- No later Grok remote branch, commit, comment, or local checkout found.
- Component branches `cdf40e0` and `69672e68` are already ancestors of PR #48.
- VPS current.json: release `c223a17092b2-41bbb4a12d42`, revision same main; API healthy, MongoDB.

## Workspace and preservation

- Active checkout: `/Users/libertyelectronics/AbujaLife-final`.
- Evidence: `/Users/libertyelectronics/abujalife-final-evidence` (outside Git).
- Python: evidence `/venv/bin/python`, Playwright Chromium/WebKit installed.
- Old `/Users/libertyelectronics/Projects/AbujaLife` remains untouched: old c4e476c branch with 42 modified and 14 untracked files. Do not reset it or blindly integrate abandoned Redis architecture.
- Old Desktop checkout remains untouched and clean.
- No force-push. Push checkpoints on this branch; later update PR #48 by fast-forward or create successor PR preserving all PR48 work.

## Completed baseline checks

- `npm ci --ignore-scripts`: passed.
- `npm run qa`: **456/456 passed** before new fixes.
- `npm run build`: passed before new fixes (69 files, ~2.6 MB dist).
- New scene/phone/world focused tests: **11/11 passed**.
- Initial Mac V4 registration and WebKit run timed out under severe local host load. These are NOT passing browser results; artifacts retained in evidence `v4-baseline` / `webkit`. CI original passed registration to work then failed sleep; investigate both current host readiness and product lifecycle.

## Work underway at this checkpoint

1. Root: scene lifecycle, Phone keyboard, V4 acceptance, browser/manual QA, final gates, GitHub, VPS.
   - Added `playableSceneKey` and idempotent render guard to retain world renderer when delayed realtime/phone refreshes describe the same physical scene.
   - Ensure new furniture/room changes and travel still reconstruct when physically required.
   - Keyboard CSS retains handset width rather than shrinking to ~130px when native keyboard reduces visual viewport.
   - V4 portable Chromium path honors `CHROMIUM_PATH` or installed Playwright binary.
   - Still reproduce sleep after work and update stale nightlife acceptance to current player UX.
2. Backend agent: injected production env/fetch forwarding, graceful SSE drain before server.close, voice retry/content binding/cleanup and errors, documented scale/Jackpot; focused tests and Mongo fixture pending.
3. Nightlife agent: current Outside/directory navigation, nearby travel, vehicle ID continuity and parked rendering, remote SVG facades; focused checks pending.
4. World/home agent: connect previously UNUSED authored landmark interior library; bind default owned furniture to property; sensible authored room anchors for premium furniture; moving journey scenery; focused checks pending.

## Known findings, distinguish bugs from stale expectations

- Real: delayed realtime location refresh can call renderMain again after authoritative action already changed scene (sleep marker race). Guard now added; real browser confirmation still required.
- Real: Phone mutate refresh default rebuilds scene. Guard now added; canvas identity must be checked.
- Real: keyboard sizing scales device width directly by reduced height; fix added, verify 320/360/375/390/430 and desktop.
- Real: landmark fixture SVG overlay never calls authored `buildLandmarkVenue`, so 3D stays generic.
- Real: owned furniture with no saved placement row can follow player into each home.
- Real: remote Cage/MagicCity/BearBarn SVG named facades drawn in every district.
- Real: same-district Home offers unsupported taxi/bus; vehicle selection/presence loses actual car ID.
- Real: production injected env not propagated to session/chat media; shutdown waits on SSE before closing SSE.
- Real: media retry keys not bound to bytes/conversation; same upload retry races create different media IDs.
- Stale V4 assumptions: `[data-nav-places]` removed; transport select now radio cards; nightclub activities apply immediate effect, not home sleep-style animation; Tokyo original global venue behavior is intentional compatible architecture.
- Not yet proven: all sleep/work, world flash, doors, mobile keyboard and voice recorder flows.

## Active processes when written

- Root disposable manual server: `node /Users/libertyelectronics/abujalife-final-evidence/manual-server.mjs`, localhost:8795. Genuine Nepo/Jabi registration origin and controlled server-only clock.
- Work-only V4 rerun log `v4-work.log` may still be running. Inspect processes/log before starting more browsers.
- CUA in-app browser navigation timed out; ambient context later shows localhost tab but CUA currently reports browser unavailable. Do not claim hands-on manual play has passed.
- Backend attempted Mongo boot; no running fixture was confirmed yet. Coordinate or inspect before starting another.

## Remaining release gates (mandatory)

- Finish all fixes, audit full original scope, personally inspect real rendered game/evidence and use two real disposable residents; auth/onboarding/world/home/phone/voice/social/visits/cars/jobs/loans/economy/multiplayer/Jackpot/nightlife.
- Full final `npm run qa`, `node --test deploy/windows/runtime.test.mjs`, `npm run build`, `npm run qa:infra`, relevant Mongo/media/transport/property tests.
- Mobile WebKit city-entry gate, historical Chromium journey, FULL V4 runner to end (currently 10 numbered earlier checks + 4 clubs = 14 actual check entries). No unexplained skips or fake state/rewards.
- Keep reports/screenshots/API evidence and compare source hashes; tests run amid agent edits are baseline, not final release proof.
- Re-fetch main, preserve concurrent changes, push verified PR48 update or successor, ready PR, CI green, safe merge, exact final main SHA.
- Deploy ONLY final green main via canonical VPS auto-update; verify `shared/state/current.json`, `auto-deploy.json`, `/health`, shared media permissions/path, public version and post-deploy smoke.
- SSH: `ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes Administrator@173.212.249.202` (host verified; never disable checking).
- VPS root C:\services\abujalife. Invoke shared/runtime/auto-update.ps1 -Root root through PowerShell. Do not print environment secrets.
- Honest limit: current realtime is one Node process, ~5,000 SSE client cap, in-memory client/zone maps, nearby cap; no distributed fanout. Never claim millions/100M concurrency.

Update this file at each meaningful checkpoint. Final report must give starting state,
recovered work, bugs/stale tests/races, fixes, actual QA, final PR/main SHA, VPS deployed
SHA/media/health/public smoke and remaining limitations. **No success report while incomplete.**

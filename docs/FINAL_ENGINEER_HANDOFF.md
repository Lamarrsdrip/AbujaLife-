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

## Nightlife checkpoint appendix (2026-10-07)

- Committed product fixes: `35aa209` (includes root lifecycle guard in app/app.js and the world agent landmarkExterior export).
- Current navigation, verified from live application wiring: Outside renders the playable street; its `[data-outside-destinations]` button opens `openCityPlaces()` and `[data-city-venue]`. The optional utility Map has a searchable 3D directory. No removed `[data-nav-places]` control is needed.
- Tokyo retains its intentional global venue compatibility. Cage/Wuse II A07, Magic City/Garki II, and Bear Barn/Jabi remain district restricted. Remote SVG facades are now unnamed, noninteractive city context, consistent with WebGL.
- Nearby-car travel defaults to Car and preserves the actual owned vehicle ID across departure, arrival, and venue exit. Explicit walking leaves the car parked. The journey/world renderer uses actual trip vehicle and parked district presence. Same-district Home exposes supported Walk/Car choices.
- Focused command: `node --test tests/nightlife-navigation.test.mjs tests/transport.test.mjs tests/vehicle-continuity-fast-location.test.mjs tests/schedules.test.mjs tests/final-world-phone-regression.test.mjs` initially passed 29/30. The new exit-presence test exposed mutable before-state use; capturing carWithResident before the transition fixed it. The complete affected vehicle file was rerun: 3/3 passed. The other 27 checks had already passed, including every district entrance, four club activities/hours, transport fare/ownership, and multiple-car ID selection. This is not a claim that the original grouped command was rerun green.
- Syntax checks passed for app/app.js, app/world-city-base.js, app/world-simulator.js; git diff --check passed.
- Correction to the earlier stale-assumption note: physical club interactions DO use native approach/activity animation before server dispatch. Direct backend venue-action requests apply their effect immediately. Acceptance should verify the actual charge, effect, acknowledgement, and single request rather than require the home-sleep-specific progress presentation.
- V4 club helper updated to actual Outside/Destinations UI and transport radio cards. It selects local walking or cross-district taxi, verifies travel fare and moving journey, checks distinct interiors/music and current schedule copy, performs two real activities with single request/exact debit/effects/completion toast, and exits to the same district street. Arrival already opens the requested room; no repeated destination selection is necessary. Python AST syntax and diff whitespace checks passed. Browser execution of these updated helpers is still pending; full V4 has not passed.

## Latest root checkpoint — login quality steering

The user additionally requested restoration of the clear, detailed login-home 3D
shown in their photos. Actual cause identified: `world-simulator.js` explicitly
skipped renderer creation for `welcome-scene`, so login showed flat SVG, while
Realm CSS replaced serif heading with oversized bold sans text. Root restored
welcome WebGL mounting, centered its camera, and added `login-home-2026.css` loaded
last with clear large room framing and serif heading. Actual rendered screenshots
still need verification. Root scene key now also includes `drivingVehicle`.

Mac browser diagnostics: installed Playwright 1.63.0; old Chromium headless shell
SwiftShader stalled, although registration returned 201 with no page errors. Native
full Chromium rerun log `v4-native-work.log` is active; main() now selects native GPU
on Darwin and retains SwiftShader on Linux. Do NOT label these stalled runs passes.
CUA repeatedly reports browser unavailable although the ambient app tab is visible.
New physical() resolves the current button locator rather than one-shot marker list;
the product render guard is the underlying duplicate-remount fix and must be tested.

Committed recovered/fixed work: 35aa209 travel/nightlife/vehicle + scene guard;
9e861c1 V4 current nightlife contracts; 2ccaf9c real authored interiors/furniture/
landmark collision scaling/populated moving journeys (21/21 focused checks).
Backend focused checks 31/31 passed; Mongo production/media/restart/privacy validation
is being bootstrapped. Phone/voice native browser acceptance is being added by agent.
Main and production still remain on c223a170; no release gate or deployment claimed.

## Continuation checkpoint — 2026-10-07 08:20 WAT

- User asked to continue exactly from this branch and repeated the login-room
  quality issue. Keep working on `codex/final-production-completion` and preserve
  this handoff for a replacement agent.
- Desktop and 390px mobile Chromium screenshots are at
  `/Users/libertyelectronics/abujalife-final-evidence/login-readonly-diagnostic/`
  (`capture-desktop.png`, `capture-mobile.png`). Both show the detailed authored
  home rendered as WebGL behind the login page; desktop DOM reports premium
  render quality, 80 environment meshes, PMREM lighting, and no page errors.
  This directly verifies the user's 3D restoration visually.
- The login diagnostic's first strict `#auth-form` visible wait timed out even
  though a follow-up capture showed the complete, visible auth form and room.
  Its initial wait result is a timing false alarm; preserve the screenshot and
  don't describe the page as failed to render.
- Root retry edits had removed the adjacent `supportedVoiceMime`,
  `sendPresence`, `stopPlayback`, and `releaseTransient` helpers. This caused a
  real `phone-chat-pro.js` module error. They are restored in the working tree.
  `tests/phone-media-retry.test.mjs` now extracts only `sendMedia`; 2/2 retry
  checks pass after fixing that boundary. V4 has also been updated to navigate
  via the actual current Map → search → destination → route chooser UI, because
  `[data-nav-outside]` opens the Map and never enters the public street.
- Integrated `npm run qa` finished 479/480 before the latest fixes. The one
  failure caught missing full venue names in airport/stadium/conference/Transcorp
  interior signs. The product signs now use their canonical full names and the
  focused `tests/world-coherence-regression.test.mjs` passes 6/6.
- Full V4 runner started 2026-10-07 at 07:19 UTC/Lagos 08:19, evidence directory
  `/Users/libertyelectronics/abujalife-final-evidence/v4-final/20261007T071903Z-5a13b0`.
  Current exec session ID is 71907; poll it before starting another browser.
- Backend uncommitted changes now include the Mongo message schema fix that
  permits validated image/voice/deleted-media documents while preserving
  immutable transfer records. The backend agent reported 2/2 focused production
  Mongo voice/restart/live-SSE and presence/privacy gates after the fix. Recheck
  against the repository's available Mongo fixture and save final outputs.
- Still run the final full QA, Windows runtime, production build, infra, WebKit,
  historical Chromium, V4 (all checks), and native phone voice suite. Re-fetch
  latest main, push/PR/CI, safe merge, and deploy/smoke are not done. GitHub DNS
  lookup previously failed in this restricted environment; local work must be
  committed and the branch/handoff kept recoverable regardless.

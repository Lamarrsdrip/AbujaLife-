# AbujaLife handover: finish responsiveness and real multiplayer

Work on `Lamarrsdrip/AbujaLife-`. Resume the existing fixes; do not restart a broad visual redesign. The owner wants fast login/signup, responsive house and account interactions, and real players seeing each other walk, chat and visit on streets and inside venues. They report approximately 3,500 registered users; that count has not been independently verified here.

## Recovery point

The verified speed release is already pushed to `main`: **e377196**. It incorporates the concurrent main work through **dc6483c** without overwriting rewards, ads, nightlife or multiplayer features.

The subsequent multiplayer changes are preserved on **handover/auth-multiplayer-20261005**. Fetch this branch, inspect your working tree, and integrate it with current `main` safely. Never force-push or discard another session’s edits. This checkpoint is **not fully verified or promoted to main**.

## Implemented fixes

Main already contains authoritative core startup (`/api/bootstrap?startup=1`, auth/onboarding `startup:true`), background social/payment hydration, genuine-session recovery after interrupted writes, stale-response protection, session-expiry sign-in, idempotent advertising decoration, deferred product previews and renderer resource improvements. Browser authentication never succeeds from a cached profile.

The checkpoint additionally contains:

- Nearby visibility based on authoritative same-zone authorization, replacing the public-street-only filter that excluded club, restaurant, gym and approved-home occupants. Blocks, private homes and privacy settings remain enforced.
- Legacy visibility defaults fixed for real movement events.
- Arrival presence leases renewed before peer notifications, while fan-out remains outside the action response.
- Stationary poses renewed without carrying them across zones, privacy changes or expired leases.
- General request limits keyed by verified resident, with anonymous/invalid sessions still limited by IP. Login/message/write protections remain.
- `app/world-presence.js`: two movement updates per second, immediate initial/changed-scene publication, idle renewals, failed-write retries and no overlapping writes. Chat dialogs publish stationary presence rather than making players vanish. Presence writes do not invalidate background account hydration.
- `app/living-city.js`: fixed another self-triggering observer loop when live statistics were displayed; observes render boundaries and updates unchanged labels/counts idempotently.
- Outside now uses the same playable local street and camera as leaving home. A Destinations button opens the existing venue and transport chooser; the district map is secondary. Check this navigation carefully. Old exploratory city-directory edits were archived outside the checkout at `/workspace/scratch/abujalife-paused-visual/`; do not reintroduce them.
- Core refreshes preserve existing account cards only for the same account; nearby players are cleared on realm changes.

## Verification and exact outstanding failures

The pushed main checkpoint passed **341 QA tests**, **13 actual production HTTP/Mongo checks**, **4 Windows runtime checks**, builds and local Chromium checks at 393×852 and 1280×800.

An earlier multiplayer snapshot passed **347 QA tests**, six new client presence/DOM-loop tests, and **13 Mongo social checks**. Latest focused startup/NAT checks passed **8/8**. These numbers do **not** establish that the final checkpoint passes all checks.

Before promotion, correct two test harness failures and rerun:

1. `tests/mongo-presence.integration.mjs`, around line 81: the home-chat SSE predicate assumes `event.data.message`; inspect the actual event payload and assert the real message shape. Earlier assertions already verified real street, venue and approved-home poses and privacy suppression. Later block assertions were not reached.
2. The new stationary-presence test in `tests/mongo-social.integration.mjs` assumed an otherwise empty shared district. Concurrent test fixtures introduced other legitimate residents. Restrict assertions to that fixture’s resident IDs, isolate fixtures, and retain all privacy/block/stale-zone assertions. Do not change production behavior to conceal a test failure.

The final Outside/navigation, idle renewal and NAT changes require a fresh full QA run. Regenerate both builds afterward; committed preview currently predates the last edits. Add any missing case for unknown-avatar arrival races if two-account testing exposes one.

## Finish in this order

1. Inspect status and the checkpoint diff. Preserve current remote changes.
2. Correct the two harness assumptions and verify production implementations rather than weakening assertions.
3. Run `npm run qa`, `node --test deploy/windows/runtime.test.mjs`, disposable Mongo integration, and actual production HTTP integration. Never point destructive fixtures at the live database.
4. Test two real sessions: same street movement, same venue movement, click-player interaction, chat, consented visit, home movement, block/privacy, idle for over 45 seconds, refresh and backend restart. Verify an arriving stationary player appears. Verify Outside exits to the actual current neighbourhood and all venue choices retain transport selection.
5. Run `npm run build` and `npm run preview:build`, inspect secret exposure and generated assets, then merge/push tested code to `main`. Preserve the existing CI/deployment flow.
6. Verify the deployed frontend, API, CORS, realtime and deployed commit from the Mac/VPS environment. Report actual results and remaining blockers without claiming unmeasured capacity.

## Infrastructure and local evidence

Frontend: `https://abujacity.life` on Hostinger shared hosting. Backend: `https://api.abujacity.life`, VPS `173.212.249.202`, Windows Server 2022, Node/Mongo/Caddy; established API service `AbujaLife-API`, isolated database `abujalife_prod`. Consult existing production/Windows deployment documentation. Use the owner’s existing Mac SSH key/agent as Administrator on port 22; never request or expose a password/private key, and do not disrupt Okrika.

This cloud proxy rejects the public website/API with HTTP 403 before reaching them, so live deployment and CI completion were not verified here. On this cloud workspace only, the disposable Mongo configuration is `/tmp/abujalife-production-integration/test-mongodb.json` (secret: never print). Logs: `/tmp/abujalife-responsive-final-qa.log`, `/tmp/abujalife-responsive-mongo.log`, `/tmp/abujalife-multiplayer-qa.log`, `/tmp/abujalife-multiplayer-browser.log`. Temporary browser harness: `/tmp/abujalife-responsive-browser.py`; it passed signup, onboarding, real Outside navigation/destinations, session reload and responsive timers with local Chromium.

Registered users are not equivalent to concurrent users in the same space. Do not add fake online players. Existing single-process SSE capacity guard is 5,000 connections and nearby rendering is bounded; do not claim readiness for 100 million users. Future scale needs distributed presence/pub-sub, routed realtime workers, interest-based rendering and tested capacity. Public live-place discovery/meetup hubs would help players deliberately converge; they are not implemented by this checkpoint.

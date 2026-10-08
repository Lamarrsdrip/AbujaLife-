# Production gameplay and revenue pass — 2026-10-07

Branch: `codex/final-engineer-integration`. Starting main/production:
`b6fe532a257d7cf19a70ae77be541fc3ba4d2d28`.
At this checkpoint source, build, unit, Mongo, production-API and disposable Docker
checks pass. Main integration, VPS deployment, and post-deployment phone/laptop
browser confirmation remain pending. Do not call production verification complete
until those finish.
All user requests in this thread remain in scope, including map-wide advertising,
phone Wi-Fi and production mobile/laptop verification. Earlier main/Codex history
was already reconciled; preserve its furniture, vehicle, chat, portfolio, presence,
login, landmark, nightlife and voice work. Fetch main again before merging.

## Reviewed evidence and production repair

- Entire 240.981-second recording visually reviewed through all 241 chronological
  one-second frames (16 contact sheets). Audio has not been reviewed.
  Source: `/Users/libertyelectronics/Downloads/RPReplay_Final1791370485.MP4`.
- 0:01–0:03 and 3:04–3:11: native keyboard breaks complete phone composition.
- 0:20–1:04: ad selection unclear, uploaded PNG reports too large, CTA inaccessible;
  reload does not fix it.
- 1:31–1:48: generic driving corridor followed by stale completed journey;
  repeated arrival errors eventually hit rate limits. Refresh at 2:14 recovers.
- 2:58: large wallet figures wrap poorly. 3:14–3:32: top-up return has no automatic
  verification; user is asked for a provider transaction ID.
- Production QA A (`@qa_a_7806516f7e`) inspected without charging real money.
- Provider audit: 73 game-credit orders (70 unconfirmed, 2 failed, 1 successful),
  4 unconfirmed ad orders and 48 unconfirmed Jackpot deposits.
- The genuine successful game-credit order `abjl_eac8dd4f-b47f-420f-85c2-778e7c21836e`
  was verified independently against Flutterwave (transaction 2102289128,
  NGN 300, 15,000 game Naira). It was pending with zero receipts.
  Existing deployed Mongo fulfillment credited it once. Re-verification returned
  replayed=true, receipt count 1, unchanged balance. No invented/manual money.
- Live provider credentials and webhook secret are configured. The exact reason
  this transaction never received webhook fulfillment still needs log/provider
  delivery investigation; absence of automatic return and background verification
  was confirmed in deployed code. Do not claim webhook delivery cause proven.
- Evidence lives outside Git in `/Users/libertyelectronics/abujalife-final-evidence`.
  Private local Mongo URI/key files must never be committed or printed.

## Integrated implementations

- Physical phone sizing via one all-input VisualViewport owner, whole-device
  proportional scaling, scroll lock and Wi-Fi hardware indicator.
- Fixed safe-area app dock and long-page bottom inset.
- One journey arrival controller: single in-flight intent, authoritative recovery,
  stable retry key, bounded backoff and stale-trip isolation. Arrival API returns
  explicit trip_not_active. Trips persist actual departure location.
- Trip rendering delegates to existing authored 3D Abuja map/road graph, owned
  vehicle model, sampled turns, camera follow and authoritative progress. The obsolete
  route corridor and its tests were removed and replaced with shared-city checks.
- Immediate authoritative refresh reconciliation through mounted World APIs;
  reconnect refreshes both state and nearby presence.
- Shared strict provider fact verification used by the existing game-credit,
  advertising and Jackpot owners. Reference-only return verification, persisted
  provider/fulfillment facts, bounded server reconciliation and combined admin
  revenue list. Existing DB receipt/ledger idempotency remains authoritative.
- Ads studio: paginated zones, selected/remove list, explicit requirement count,
  image fallback compression, stable checkout retry intent, campaign management.
- Map inventory covers city and blue surrounds; existing district IDs preserved;
  new broader zones cannot sell duplicate surfaces. Existing paid campaigns
  render as image planes through a narrow updateAds API on the mounted map.
  Viewport-bounded paid-campaign streaming is bounded and tested. The world canvas
  and surrounding sky-blue area use the same ad selection path.
- Eight new destinations reuse the existing authored façade system, reachable
  entrances and venue activities. City width is 11,200. CBN and EFCC stay on their
  existing render paths.
- Living City uses the existing activity registry and resident progression. Server
  claims suppress cross-tab duplicates; account ownership and quiet-state checks
  prevent late cards. Driving prompts require an available owned vehicle; Jackpot
  discovery remains behind the existing eligibility signal.
- Okrika and AbujaLife continue to share the existing Flutterwave account/API
  configuration. No key rotation, dashboard change or Okrika source change was
  made. Each app's configured public origin is used for its return URL; AbujaLife
  ignores foreign Okrika references. Unit and Mongo tests cover this isolation.

## Tests completed on this branch before main integration

- 12 existing authenticated Mongo payment tests passed before later changes.
- 26 focused baseline unit tests passed (payments, ads, phone).
- 12 new unit tests passed (arrival state/recovery, image optimisation, viewport).
- Full `npm run qa`: 516 tests, zero failures. Windows runtime suite: 5 passed.
- Production build passes (72 public files).
- Full `npm run qa:infra` passes: isolated Mongo/API containers, serialized Mongo
  integration files, production API acceptance, encrypted backup, tamper rejection,
  restore and restart persistence.
- Production API acceptance: all 13 checks pass. Mongo acceptance covers visit
  deduplication, unique online residents, exact-zone counts, hidden/expired presence,
  realtime expiry, payment replay and city/sky ad reservation races.
- Payment unit and Mongo tests verify provider amount/currency/reference/status,
  callback/webhook cooperation, concurrent exactly-once fulfillment, global
  cross-product transaction receipt uniqueness and foreign Okrika reference
  isolation. No live payment was initiated by these tests.
- Removed obsolete generic route corridor/highway; shared-city and actual-renderer
  fallback motion/once-only arrival tests pass. Removed competing VisualViewport
  listener/CSS owner.
- Python Playwright is unavailable in this shell, so the updated automated frame/map
  test could not be rerun here. An earlier run passed the mobile shell and stopped
  on a laptop click point overlapping a landmark label; the test now selects an
  unobstructed canvas point. The production build was checked at 393×852 and
  1440×900 in that prior run; keyboard geometry is simulated and is not physical
  iPhone hardware testing.
- Local authenticated replica set at 127.0.0.1:27089 (`abujaqa`), isolated local
  `abujalife_prod` DB. Config under evidence/mongo-local-pass. Running mongod must
  remain available for further Mongo/browser QA. TEST_PAYMENT_KEY_FILE selects
  evidence/mongo-local-pass/payment-key; do not mix random config encryption keys.

## Remaining finalization work — do not omit

1. Fetch main immediately before integration; the post-verification fetch confirmed
   it remains `b6fe532a257d7cf19a70ae77be541fc3ba4d2d28`, the parent of this branch.
   Preserve all Codex-only commits.
2. Push the verified descendant to main, run the canonical Windows VPS updater,
   and verify release identity, API health and served assets.
3. Play the deployed production app on phone-sized and laptop viewports. Verify the
   phone shell/dock, map and blue-space ad selection, city navigation and journey
   completion without charging a live payment. Public TLS/DNS and physical iPhone
   keyboard behavior are separate from isolated test evidence.
4. Recheck main and deployment health after any correction. Do not use real checkout
   as a QA fixture.

## Production deployment context

VPS `Administrator@173.212.249.202`, SSH key ~/.ssh/id_ed25519 with IdentitiesOnly
and StrictHostKeyChecking. Root `C:\services\abujalife`; state shared/state/current.json.
Canonical shared/runtime/auto-update.ps1 follows main. Current deployed release
b6fe532a257d-00385ac3c6c4 is the PREVIOUS pass, not proof of these changes.
Avoid leaking runtime environment/provider keys. User already authorised safe
main integration, deployment and provider-confirmed pending-payment reconciliation.

## Further checkpoint — shared account, discovery, map and world

- Shared Okrika Flutterwave account/API stays intact. No credentials rotated,
  no account dashboard webhook changed, no Okrika source changed. Okrika's existing
  handler only looks up its own references and ignores AbujaLife references.
  AbujaLife callback plus bounded server reconciliation can verify abandoned
  orders independently of a shared dashboard webhook. Do not claim provider
  delivery configuration or historical webhook root cause proven.
- Found concrete v3 checkout/v4-only signature mismatch. Existing verification
  owner now accepts v3 verif-hash OR v4 raw-body HMAC, with strict server provider
  verification and mode binding. Invalid modern signature never falls back.
- Global unique payment_receipts now protects credits, ads and Jackpot against
  cross-product reuse of one provider transaction; each existing product ledger
  remains authoritative. Mongo transactional/concurrency tests passed.
- Latest payment + discovery test run: 22 passed, no skips. Actual v3 hash,
  callback replay, server verification, background reconcile and paid city/blue
  reservation/fulfillment are included.
- Latest full QA: 516 passed, 0 failed. Docker infrastructure and all Mongo/API
  integration tests pass, including backup/restore after the previous fixture race
  was fixed by isolated resident IDs and serialized integration files.
- Production read-only stats audit: 18,004 residents, 9 unique visible online,
  13 visible connections, 207 tracked visits today, 181 sessions whose latest
  visit is today. Repeat visits can explain the difference; exact today's visits
  cannot be reconstructed from a last-visit marker alone. Evidence JSON is private.
- Visit marker + counter now commit together in existing transaction. Realtime
  heartbeat produces authoritative stats with one bulk zone aggregate, dedupes
  unchanged output and handles expired presence, without another SSE connection
  or one-second per-user polling. Browser state now receives nearby stats.
- Phone mobile Chromium: whole frame fits keyboard-shaped VisualViewport,
  scroll locked, Wi-Fi shown. This is a simulation, not physical native keyboard.
  Map ad button/close overlap found and competing CSS removed; mobile tap/studio
  flow passed. Laptop ad tap test was corrected to avoid real landmark labels; run
  production browser confirmation after deployment. WebKit/physical iPhone remain
  unverified here.
- New world request: older detailed façade owner reused for equivalent newer
  hotels, offices, shops, cinemas and faith buildings. CBN/EFCC and outdoor
  monument models preserved. Registry adds eight destinations: Central Park,
  Sahad CBD/Area 11, Grand Square, Ceddi Plaza/Genesis, Thought Pyramid, Nike Art
  Gallery. Each has existing API activities and a reachable interior. Free-roam
  width 8,500 -> 11,200; appended streets/entrances/footprints. New landmark
  navigation derives from canonical city-landmarks instead of duplicate list.
  Unit, build and Mongo checks pass; live production browser review remains.
- Source references for destination identity/purpose (game anchors are stylised):
  https://sahadstores.com/ ; https://grandsquareng.com/ ;
  https://genesiscinemas.com/ceddi-plaza-abuja/ ;
  https://www.linkedin.com/company/central-park-abuja ;
  https://www.linkedin.com/company/nikeartgalleryabuja ;
  https://www.lifeinmycityartsfestival.org/assets/pdf/2024/regional_exhibition_schedule.pdf
- No main merge or deployment of this checkpoint yet. The integration branch is
  pushed for continuation; final main push, canonical Windows redeploy and
  production mobile/laptop verification remain.

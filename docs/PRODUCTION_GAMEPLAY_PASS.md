# Active production gameplay and revenue pass — 2026-10-07

Branch: `codex/final-engineer-integration`. Starting main/production:
`b6fe532a257d7cf19a70ae77be541fc3ba4d2d28`.
This is an INCOMPLETE engineering checkpoint. Never deploy it as a finished pass.
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

## Current implementations awaiting final verification

- Physical phone sizing via one all-input VisualViewport owner, whole-device
  proportional scaling, scroll lock and Wi-Fi hardware indicator.
- Fixed safe-area app dock and long-page bottom inset.
- One journey arrival controller: single in-flight intent, authoritative recovery,
  stable retry key, bounded backoff and stale-trip isolation. Arrival API returns
  explicit trip_not_active. Trips persist actual departure location.
- Trip rendering delegates to existing authored 3D Abuja map/road graph, owned
  vehicle model, sampled turns, camera follow and authoritative progress. Old
  route-corridor module/tests still require safe consolidation and replacement.
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
  Viewport-bounded paid-campaign streaming is being wired/tested.

## Tests actually completed this pass

- 12 existing authenticated Mongo payment tests passed before later changes.
- 26 focused baseline unit tests passed (payments, ads, phone).
- 12 new unit tests passed (arrival state/recovery, image optimisation, viewport).
- 8 map/ad inventory tests passed (coverage, overlap rejection, paid placement,
  expiry, existing ads contracts). Full npm QA now passes: 505 tests, zero failures. Windows runtime: 5 tests pass.
- Production build passes. Infra checks running. Expanded Mongo: reference-only
  callback and background-worker race pass; paid city/sky ad reservation/fulfillment
  passes its transactional assertions; admin list assertion being verified.
- Removed obsolete generic route corridor/highway; shared-city and actual-renderer
  fallback motion/once-only arrival: 7 tests pass. Removed competing polish
  VisualViewport listener/CSS owner. Actual browser acceptance is next.
- Local authenticated replica set at 127.0.0.1:27089 (`abujaqa`), isolated local
  `abujalife_prod` DB. Config under evidence/mongo-local-pass. Running mongod must
  remain available for further Mongo/browser QA. TEST_PAYMENT_KEY_FILE selects
  evidence/mongo-local-pass/payment-key; do not mix random config encryption keys.

## Required next work — do not omit

1. Finish and verify map viewport streaming/index/slot coordinate writes and
   expiry, selection, business links, transactional checkout; real mobile/laptop.
2. Replace obsolete trip static/fake renderer tests with real shared-city motion
   tests; browser-test camera/turns/arrival, repeated travel and car continuity.
3. Strengthen actual Mongo payment/ad/Jackpot callback, concurrency, reconciliation,
   late reservation, invalid provider facts and ledger tests; investigate production
   webhook delivery; all revenue states/admin handling. Never charge a live test.
4. Full phone keyboard/WebKit geometry, currency layout and fixed dock playthrough.
5. Living City discovery director is NOT implemented yet. Consolidate the old
   unpersisted work reminder; registry-derived destinations, personal context,
   quiet states, weighted diversity, durable cooldown/discovery history,
   privacy-safe public social activity, needs/work/story/feature/eligible Jackpot
   routing and lightweight instrumentation are still required.
6. Audit today's visits against actual production data and defined Lagos-day,
   session dedupe; verify unique online/here expiry and multi-tab behavior.
7. Complete earlier broad tasks/regressions: furniture immediate move/store/sell,
   home isolation, compact live chat/privacy, portfolio buy/rent/sell totals,
   physical garage/no floating card, exact landmarks, nightlife, voice retry,
   stable login, multiplayer visits and all affected mutation/reconnect behavior.
8. Run npm run qa, Windows runtime tests, build, qa:infra, relevant Mongo tests,
   Chromium/WebKit journeys, V4 current-client acceptance and actual player flows.
9. Fetch main again, reconcile valid newer work, rerun affected checks, commit and
   push safely to main only after completion, canonical Windows VPS deployment,
   verify release identity/health/assets and play production phone AND laptop.

## Production deployment context

VPS `Administrator@173.212.249.202`, SSH key ~/.ssh/id_ed25519 with IdentitiesOnly
and StrictHostKeyChecking. Root `C:\services\abujalife`; state shared/state/current.json.
Canonical shared/runtime/auto-update.ps1 follows main. Current deployed release
b6fe532a257d-00385ac3c6c4 is the PREVIOUS pass, not proof of these changes.
Avoid leaking runtime environment/provider keys. User already authorised safe
main integration, deployment and provider-confirmed pending-payment reconciliation.

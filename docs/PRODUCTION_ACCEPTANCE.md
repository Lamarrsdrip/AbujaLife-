# Production acceptance record

Validated locally on 4 October 2026 using Node 24.19.0, the genuine Hostinger build and isolated, authenticated MongoDB. This is a source-release acceptance record, not confirmation of a live deployment.

| Check | Result | Scope |
| --- | --- | --- |
| `npm run qa` | 218 passed, zero skipped or failed | Auth, economy, ownership, room layout, messaging, transport, camera, vehicles and public builds |
| `npm run qa:infra` | 36 Mongo integration tests and 12 production HTTP checks passed | Real private replica set, restricted identities, API restart, immutable ledger, idempotent payments/transfers, messages and blocks |
| Docker and recovery acceptance | Passed | UID 1000/read-only API, immutable image selection, encrypted consistent backup, corruption rejection, complete snapshot restore and failed-promotion rollback |
| Connected two-account browser acceptance | 7 passed | Genuine static frontend, secure sessions, realtime, purchases, transfers, persisted messages and public-only service-worker caching |
| Resident/home/inbox acceptance | 9 passed | Explicit Female/Male, fresh Lapo/Nepo rooms, buy/place/rotate/store/sell, real unread/read state, transfers, paid travel and quick Home |
| Banex and compact chat acceptance before visual refresh | 7 passed | Real map search and fare choices, paid journey/reload, physical browsing/exit, purchased fan placement/reload, two-account transfer |
| Admin top-up browser acceptance | 7 passed | Actual existing-resident role grant, ordinary-account 403s, required reason, Review → Confirm, one credit/ledger/audit, replay safety and refresh persistence |
| Environment camera acceptance | Original 9 WebGL and 2 SVG checks; 9 oblique-room checks and 17 mobile edge checks passed | Original oblique dollhouse depth, whole-room framing, capped scene gestures, precise floor picking/placement, actual resident mesh visible at doorway/map edges across 0.8×, 1× and 2.5× |
| Final anonymous preview | 6 browser checks passed | Explicit gender/random origin, resumed real 3D movement after closing preview information, shower/sleep animations, persistent room design, actual home PNG/local post/status and disclosed local funds/loans |
| Smaller phone and inline money acceptance | 8 passed | All 20 apps actually opened across native 8/8/4 pages, 320 × 676 launcher, pinned dock, swipe/dots/restore, inline draft-preserving review/confirm, two-account exact-once transfer/replay/reload and block enforcement |
| Authoritative exterior exit | 26 focused checks, 1 actual Mongo integration and 2 native mobile preview checks passed | Paid Abuja Car arrival exits at its authored door with a fully visible resident; forged home hints are ignored and consumed transitions retain later walking/reloads. Compact Home sits beside the arrow with a 44px target, no overlap and actual physical return |

Connected browser tests used local TLS routing for the two intended public hostnames and explicitly trusted only their generated test certificate. They do not verify public DNS, a public CA certificate, Hostinger upload or physical Safari. Test accounts and data were disposable. Payment-provider fixtures verify server checks and idempotency, not live merchant transactions. Software WebGL results do not establish physical-device frame rates.

## Live gates still required

The cloud task cannot execute on the owner's Mac or use its existing SSH key. The read-only attempt to `Administrator@173.212.249.202:22` returned connection refused before authentication. No Okrika server, proxy, firewall, database, ports or production secrets were inspected or changed. No Hostinger browser-control connector is available here, despite the owner's logged-in hPanel session.

Before promotion to `main`, complete read-only VPS/Okrika discovery, isolated deployment, public DNS/HTTPS, Hostinger upload, external health/CORS/realtime, two-account persistence across a real backend restart, Okrika coexistence, configured off-server backup delivery and GitHub CI. Git push works through platform authentication; the GitHub Actions API was denied by the proxy, so remote CI is unverified.

## Intended production handoff

| Item | Configuration; live status unverified |
| --- | --- |
| Website | `https://abujacity.life` on Hostinger shared hosting |
| API and realtime | `https://api.abujacity.life` through the existing VPS HTTPS proxy |
| Database | Separate authenticated private `abujalife_prod` MongoDB replica set |
| Process | Docker Compose project `abujalife-prod`, service `api` |
| Directory | Dedicated `/opt/abujalife/`, subject to existing VPS conventions |
| Ports | Container API 3000; host loopback 18787 after collision check; public HTTPS 443, HTTP 80 and existing SSH 22 |
| Mongo/Redis exposure | Mongo has no published port in the tested stack; Redis is not used |
| Backups | Encrypted backup/restore tested locally; production schedule and separate storage not installed |
| Main revision | `5f37d16def0e2bf29496a74b6f621812eb75f754`; promotion withheld pending live gates |

Use [MAC_LAUNCH_PROMPT.md](MAC_LAUNCH_PROMPT.md) for the ready-to-paste launch task on the owner’s Mac. See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for commands, environment-file locations, backup retention, restore steps and safe deployment/rollback. Server initialization generates isolated private credentials without committing them. Configure optional Flutterwave merchant credentials through the permission-checked admin dashboard and an off-server backup destination separately. Never send SSH passwords, private keys or payment secrets in chat.

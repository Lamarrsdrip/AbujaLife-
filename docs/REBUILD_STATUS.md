# Rebuild acceptance record

Recorded 4 October 2026. Recovery tag: `recovery/pre-social-world-5f37d16`. Work branch: `rebuild/abujalife-social-world`.

## Current v4 life-simulation candidate

V4 adds permanent starting lives, scheduled daily activities, a home-design studio, actual resident publishing and consented home visits to the original 3D game. The four-tab interface, locally bundled renderer, eight branded cars in seven colours, six authored home-layout families and eighteen furniture items remain available.

New registrations receive a server-assigned, immutable origin with equal Nepo/Lapo odds. Nepo starts with ₦1,000,000 and a gifted Jabi, Guzape or Maitama home. Lapo starts with ₦100,000 and a practical authored starter home in Lugbe, Kubwa, Nyanya, Bwari or Gwagwalada. An optional fictional LAPO-style game loan requires explicit consent to a one-time 5% fee, due in 28 real days, and supports early or partial repayment. Neither the origin names nor the simulated lender imply real residents' circumstances or an affiliation with LAPO Microfinance Bank.

Home Studio changes wall and floor finishes and adds draggable, resizable, rotatable room dividers, removal and Undo. Server validation keeps dividers within the authored floor plan and preserves usable routes; the former twelve-divider business cap is removed. Larger purchased layouts provide more physical room. Sleep, bathing and gym activities use physical 3D poses. A guest can enter another real resident's home only after owner consent, subject to neighbourhood, presence, privacy and blocking checks. Guests see the actual owner's design and furniture, share real location positions and chat, and cannot edit or claim the owner's home benefits. Leaving or withdrawing consent revokes the visit.

The phone offers official X and TikTok links and a browser. Official social sites open externally rather than being claimed as verified embedded apps. Xshare renders a PNG from the player's actual 3D home and saved design, provides an editable caption and offers native sharing, PNG download or an X text intent. The player decides whether to publish and attaches the image on X; no external post is fabricated or automatically submitted. The full-server Okrika feed stores actual residents' photos, posts, likes, comments and server-expiring 24-hour statuses. Directory, message and content pagination bounds each request without a business limit on total residents or stored content. See [SOCIAL_CONTRACT.md](SOCIAL_CONTRACT.md).

Day and night use actual Africa/Lagos time (UTC+1). Weather is explicitly a seasonal game simulation, not a measured forecast. Office and bank roles open Monday–Friday, while restaurant and other roles have suitable weekend schedules. The allowance is two global shifts per Abuja day, one per available slot, including when changing jobs. Nineteen venue types now include Tokyo, Cage, Magic City and Bear Barn, with district-specific authored interiors and game prices. These are player-provided names, not verified addresses, real layouts or business quotations. DJ nights run Wednesday, Friday and Saturday from 20:00–02:00 Abuja time, with an opt-in original generated beat and moving, explicitly simulated dancers.

The former wallet, daily demonstration-fund, dice-stake and rental-accrual business ceilings are removed. Exact safe-integer arithmetic, affordability, physical routing, supported-image/request sizes, authentication and bounded query pages still apply. These safeguards are distinct from population or content ceilings and do not prove million-user capacity.

The full server includes role-protected administration, moderation, audited wallet adjustments and encrypted Flutterwave merchant configuration. Free full-server demonstration funds are disabled by default. Only an independently verified provider transaction matching the saved order can credit paid game funds; no live merchant credentials, public origin or configuration key were supplied and no live payment was tested. Provider fixtures test code behaviour, not a configured live merchant. Webhook signature compatibility remains externally unverified. Setup and payment boundaries are in [ADMIN_PAYMENTS.md](ADMIN_PAYMENTS.md).

The account-free public static preview remains **device-local single-player**. It saves its own origin, purchases, design, posts and statuses and offers free local virtual funds; it cannot connect separate residents, accept payments or perform shared home visits. Cloudflare Quick Tunnel's account-free API returned proxy CONNECT 403, so no public Node backend or multiplayer tunnel was created. Official X/TikTok access and Open-Meteo were also blocked. The external links and seasonal simulation state these limits rather than presenting invented live services.

## Current v4 validation

`npm run qa` passes **125/125** tests with no failures or skips, plus module and catalogue checks. Coverage includes the new origins, loans, daily schedules, home-design geometry, raster upload validation, durable social content and visits, paginated directories, administrator permissions and encrypted configuration, provider-verification fixtures and actual HTTP integrations, alongside the existing economy, authentication and persistence regressions. The aggregate includes nine rebuilt-preview adapter scenarios and three additional server-clock authority checks. This aggregate preceded the narrow client trip-progress correction described below; backend code is unchanged.

Standard `npm start` was checked against the SQLite health endpoint. Anonymous bootstrap reports nineteen venues and disabled payments, the tested shell JavaScript module paths load, and unauthenticated administrator entry redirects to sign-in. No live merchant, environment configuration key or public payment origin is configured.

The final client correction makes trip progress use the authoritative server-clock anchor rather than the browser's own clock. Its syntax check passes. The rebuilt preview is **1,364,502 bytes**, contains nineteen venues and all four named nightlife settings, and excludes administrator CSS from its public bundle. Its SHA-256 is `cb344887c188437378a0d59a4ce278e5aa97de2e3ce2b3a9837b8e956eb728b6`. The tracked `tests/preview-v4.test.mjs` scenarios were rerun and pass **9/9** against this rebuilt adapter. They are distinct from browser acceptance and were already part of the aggregate suite.

Fourteen named connected-client workflows now have passing evidence across accepted targets, with **zero unresolved latest results**. The consolidated record is `/tmp/abujalife-v4-connected-acceptance.json`, SHA-256 `5684edb28f6b28e96f5495b7cc66a90785200b4b4ef45692632e2f9329e30503`. It maps each workflow to its actual report and preserves superseded raw failures rather than presenting a single clean fourteen-check run.

| Connected browser report | Recorded result | Scope |
| --- | --- | --- |
| `/tmp/abujalife-v4-browser/20261004T185635Z-36e343/report.json` | 8 passed, 4 failed | Initial connected registration, 3D world, Home Studio, actual house PNG/feed sharing, status expiry, real home visits/positions/chat and loan workflows; diagnostic fixture failures retained |
| `/tmp/abujalife-v4-browser/20261004T190742Z-11cfbc/report.json` | 4 passed, 1 failed | Corrected physical sleep/shower and scheduled-work checks; nightclub tour needed actual rest after its multi-day work fixture |
| `/tmp/abujalife-v4-browser/20261004T191332Z-978f29/report.json` | 5/5 passed | Registration and all four distinct nightlife settings, charged activities, opt-in sound, actual trip progress and zero car/banner overlap |

Every listed run has no uncaught JavaScript errors and unchanged production sources during that run. The initial eight workflow passes preceded the one-line trip-clock correction in `app/world.js`; the final physical/work and rested nightclub targets use the frozen corrected source. Fixture corrections use stable accessible markers, native task-reading time and actual rest through the UI. No wallet or profile values are injected. The final compiled-preview browser suite passes **6/6** workflows, with zero uncaught JavaScript errors and unchanged production sources. Its report is `/tmp/abujalife-v4-preview-browser/20261004T192135Z-e94a4c/report.json`, SHA-256 `6896664b66085344363886503b3fe995414a54a1d2e71134fad3770785ba9209`, against the exact preview hash above. It covers native-random onboarding, actual WebGL input, delayed physical activity effects, saved room design, actual home PNG/local social persistence, and consented loans plus local game funds. The earlier 5/6 preview diagnostic hit a valid studio obstacle in an assumed movement direction; the corrected harness tries clear native movement directions and preserves collision. Component targets remain distinct from full-client acceptance, and historical V3 passes below are not current evidence.

Current reproducible commands:

```sh
npm run qa
npm run assets:build
python tests/v4-browser-smoke.py
npm run preview:build
python tests/v4-preview-browser.py
```

The full-client suite uses disposable real residents and SQLite data, actual UI registration and purchases, and a private IPC test-server clock/origin fixture. It keeps normal browser time and animation frames and does not inject wallet or profile state to bypass gameplay. Legacy `qa:browser`, `qa:gameplay` and `qa:premium` fixtures are historical V3 targets whose starting-life, job and funding assumptions predate V4.

## Historical v3 premium game candidate

The following V3 delivery and validation notes are retained as historical evidence. Current V4 behaviour and acceptance are described above.

The v3 client replaces flat scenery with original procedural 3D characters, cars, cutaway homes, furniture and venue equipment. The renderer is pinned Three.js 0.180.0, bundled locally with its licence; neither the server client nor the self-contained preview downloads a runtime rendering library. A vector fallback preserves playable controls when WebGL is unavailable. Cars, clothes, furniture and property cards reuse actual 3D models rather than competitor images.

Five short onboarding cards show a live avatar. Four main tabs keep the interface compact, while a slim journey banner leaves the moving vehicle visible. Work, profile, map, garage, property and shopping pages received layout, focus and mobile-overflow fixes.

The catalogue contains eight Toyota, BMW and Mercedes vehicles with seven paint colours, six distinct walkable homes and eighteen furniture items. Okrika Marketplace is the requested shopping destination. New air conditioning, inverter, bed, sofa and console upgrades affect sleep, relaxation or service bills; the pool table, drinks trolley and artwork are decorative. The richer homes include Jabi, Guzape and Maitama options with scaled game purchase and rental prices.

Sixteen venue types include an equipped gym, mosque, church, club, games lounge and an authored Jabi Lake setting available only in Jabi. Venue activities have visible character poses or animations, costs where applicable, and server-validated need effects.

The phone labels the wallet **Naira balance** and offers free virtual top-ups with review and receipt screens. The full server supports actual registered-resident transfers with atomic debit/credit records, recipient notifications and payload-bound replay protection. Additional homes can accrue simulated rent and be resold or become the primary home. The dice lounge uses a persisted, cryptographically random server result. All of these use game Naira with no cash value; real payments, withdrawals and payment-provider integration remain unavailable.

The public account-free preview uses the same client with an isolated browser adapter, saves only local single-player progress and never contacts the production resident database. Shared chat, resident transfers and public events require the full Node server. Ambient NPCs and traffic are explicitly simulated; there are no fake registered residents, recipients or online totals.

## Historical v3 validation

`npm run qa` passes **37/37** tests plus module and catalogue checks. Coverage includes durable top-up and transfer replay protection, restart persistence, balanced recipient ledgers, paint ownership, investment timing and resale, dice result replay, richer home benefits, existing jobs, property, messaging and authentication safeguards. Four geometry regression tests also verify routes across all six homes with empty, fully furnished and rotated inventories, plus every venue.

The clean dependency install and local renderer asset build pass with pinned Three.js and esbuild. Preview/server adapter parity passes **155** checks; richer upgrade and storage parity adds **62** checks after the storage-persistence correction.

The premium page audit passes **28/28** browser checks: character-preview containment, map use, work selection, profile saving, a charged marketplace purchase, mobile/desktop overflow and correctly framed large property thumbnails. Evidence is in `/tmp/abujalife-page-audit/report.json` and `/tmp/abujalife-page-audit/house-thumbs-report.json`.

The premium full-server target passes **14/14** browser checks, including two real resident sessions, chat, reviewed game-Naira transfers and replay protection. Its accepted server results are in `/workspace/scratch/premium-qa/20261004T170623Z-391bf5f7/report.json`; the preview fixture failures in that mixed report are not counted as passes.

The separate premium preview target passes **13/13** checks with no uncaught JavaScript errors or outbound game API requests. Its normal browser clock exercises actual movement, venue actions, purchases, investments, rich-home upgrades and reloads. Report: `/workspace/scratch/premium-qa/20261004T171625Z-100f3216/report.json`. This run replaces the earlier preview fixture's mocked animation clock and incorrectly broad API-request classification; the tested application runtime did not change.

The premium evidence records preview SHA-256 `b0c12d46b286be7ba35c5b972f9e3341a388319e2522d6b110c64d6063fa1dcc`. A subsequent narrow preview-badge CSS adjustment avoids wallet-label overlap, and the server page adds favicon metadata; application JavaScript and the 3D runtime are unchanged. The resulting preview SHA-256 is `6091642571ddd82a847b73e9cbe2733a9d58f615c893feb55409781c9b25181c`.

The final full-server regression passes **15/15** checks with no uncaught JavaScript errors and unchanged application sources. It verifies two-resident chat, unread/read state, retained drafts and privacy; wages and purchases; an actual 14-second Abaji Town bus journey with preserved trip identity after reload and exactly one ₦1,030 fare; return home, five viewport sizes, a throttled connection and reauthentication. Report: `/workspace/scratch/integration-qa/20261004T174459Z-927266b5/report.json`.

The final static-preview broad run records **7/9** passes on the `609164…` bundle, with no uncaught JavaScript errors or outbound game API requests. Its two failed checks were fixture issues: camera movement began at a clamped scene edge, and the home-entry fixture allowed only 20 seconds to walk from a distant hotel. Report: `/workspace/scratch/gameplay-qa/20261004T175116Z-2b98411a/report.json`.

The corrected focused regression passes **3/3** with unchanged application and preview sources: fresh onboarding; actual walking, running and following-camera movement; and furniture/housing. It uses a normal browser clock, bounded walking trials and a 60-second route budget. Actual UI purchases, plant placement and 90-degree rotation persist exactly after reload; Lugbe rental charges ₦18,000 and persists, while unaffordable ownership leaves the wallet and home unchanged. Report: `/workspace/scratch/gameplay-qa/20261004T175948Z-60dbfc1c/report.json`. Run this target with `ABUJALIFE_GAMEPLAY_MODE=regressions npm run qa:gameplay`. It also has no uncaught JavaScript errors or outbound game API requests.

Together the broad and corrected focused runs provide passing evidence for all **nine named static-preview checks**, with onboarding repeated for the fresh target context. The final preview SHA-256 remains `6091642571ddd82a847b73e9cbe2733a9d58f615c893feb55409781c9b25181c`.

Browser evidence uses Chromium, including mobile touch emulation and viewport sizing; native iOS/Safari has not been tested. Previous candidate results below remain historical evidence.

Historical V3 commands:

```sh
npm run qa
npm run assets:build
npm run qa:browser
npm run preview:build
npm run qa:gameplay
npm run qa:premium
```

The premium suite uses fresh browser-local preview contexts, disposable server residents and actual UI top-ups and purchases. It exercises actual WebGL models, onboarding, the quiet HUD, wallets, transfers, car ownership and paint, investment purchase/rent/resale, new venues, rich-home upgrades and renderer fallback. Reports and screenshots are written outside the checkout to `/workspace/scratch/premium-qa`; the broader suites use `/workspace/scratch/integration-qa` and `/workspace/scratch/gameplay-qa`.

## Historical v2 candidate evidence

Before the v3 rendering and economy upgrade, the 4 October gameplay candidate passed 9/9 browser checks, with no uncaught JavaScript errors or outbound game API requests. Actual UI actions earned a wage, bought and drove a car, entered the restaurant/gym/hotel, placed and rotated owned furniture, rented a home and exercised a touch joystick. The full two-resident server regression passed 15/15. Reports: `/workspace/scratch/gameplay-qa/20261004T144903Z-647970ac/report.json` and `/workspace/scratch/integration-qa/20261004T145100Z-f076f48e/report.json`.

A subsequent narrow rendering/persistence patch passed 4/4 targeted checks for upright decorative items, actual purchases, placement/rotation, exact reload position and a fresh character spawn. No uncaught JavaScript errors or outbound game API requests occurred. That historical preview SHA-256 was `11120b919a660e3138f488b5a1ee331206dd6005d56423219f39a98e0e33f99e`; it is not the current 3D preview. Evidence: `/workspace/scratch/targeted-decor-qa/20261004T150154Z-de1359a8/report.json`.

## Gates still requiring external access

| Gate | Observed result | Required follow-up |
| --- | --- | --- |
| Live Lagos Life inspection | Chromium failed before document load with `ERR_TUNNEL_CONNECTION_FAILED`; independent proxy request returned CONNECT 403 | Enable `lagoslife.app` / `www.lagoslife.app`, inspect public UI/policies/stats/ads, and explicitly record any sign-in boundary |
| Official Abuja hierarchy / district verification | FCTA and both AGIS hosts returned proxy 403 | Verify the existing catalogue against FCTA/AGIS; resolve names, phases, council attribution and official boundaries from evidence |
| Recognizable real road map | OSM tile/provider access failed in this machine; honest fallback and source-backed settlement pins work | Enable OpenStreetMap tile/Overpass destinations, visually inspect real roads, confirm district markers only from reliable records |

Domain requirements were saved to the cloud environment draft. Draft persistence does not apply runtime network changes or publish an environment.

The brief requires all acceptance gates before merging the complete rebuild into main. The gates above remain outstanding, so the work must remain reviewable on its rebuild branch until they pass. No claim of completed competitor study, verified full FCT coverage, production readiness, or a published environment is justified yet.

## Internal competitor matrix

No Lagos Life page loaded, so its features below remain unobserved. The implemented AbujaLife choices come from the supplied product brief and original design; no competitor source, artwork, or visual design was copied.

| Area | Lagos Life evidence | AbujaLife implementation / remaining gap |
| --- | --- | --- |
| Entry and identity | Unobserved | Five-card setup with live 3D avatar, appearance editing, life goals and saved account/browser progress |
| Home and world | Unobserved | Original 3D movement, nineteen authored venue types, six home-layout families, Home Studio and consented owner-home visits |
| Phone | Unobserved | Original Pro Max-inspired hardware, messages/contacts/wallet/privacy, official browser links and player-controlled home PNG sharing |
| Social | Unobserved | Real session presence, location chat, DMs, groups, Okrika posts/photos/comments/likes/statuses, cursor pages and moderation controls |
| Geography and travel | Unobserved | Source-provenanced settlement pins, real tile architecture, quoted compressed journeys; live road verification pending |
| Careers and economy | Unobserved | Permanent origins, consented fictional loans, real-time shift schedules, replay-protected salaries/transfers, cars, home upgrades and investments; provider integration tested with fixtures, live merchant acceptance pending |
| Shopping and advertising | Unobserved | Requested Okrika Marketplace for clothing and home goods, with charged game purchases; no ad-purchase system |
| Retention | Unobserved | Persistent identity, friends, work, home and event plans; no fabricated engagement statistics |
| Performance | Unobserved | Locally bundled pinned 3D renderer, shared snapshot renderer for catalogue previews, vector fallback and asset-only PWA caching; current browser regression recorded separately |

Production work still required includes account recovery, voice communication, moderation operations and measured capacity, distributed presence and storage, live merchant acceptance and webhook-format verification, player businesses and civic gameplay. A public persistent Node deployment is also required for shared online play. Treat these as outstanding scope, not simulated completed features.

# Rebuild acceptance record

Recorded 4 October 2026. Recovery tag: `recovery/pre-social-world-5f37d16`. Work branch: `rebuild/abujalife-social-world`.

## Current premium game candidate

The v3 client replaces flat scenery with original procedural 3D characters, cars, cutaway homes, furniture and venue equipment. The renderer is pinned Three.js 0.180.0, bundled locally with its licence; neither the server client nor the self-contained preview downloads a runtime rendering library. A vector fallback preserves playable controls when WebGL is unavailable. Cars, clothes, furniture and property cards reuse actual 3D models rather than competitor images.

Five short onboarding cards show a live avatar. Four main tabs keep the interface compact, while a slim journey banner leaves the moving vehicle visible. Work, profile, map, garage, property and shopping pages received layout, focus and mobile-overflow fixes.

The catalogue contains eight Toyota, BMW and Mercedes vehicles with seven paint colours, six distinct walkable homes and eighteen furniture items. Okrika Marketplace is the requested shopping destination. New air conditioning, inverter, bed, sofa and console upgrades affect sleep, relaxation or service bills; the pool table, drinks trolley and artwork are decorative. The richer homes include Jabi, Guzape and Maitama options with scaled game purchase and rental prices.

Sixteen venue types include an equipped gym, mosque, church, club, games lounge and an authored Jabi Lake setting available only in Jabi. Venue activities have visible character poses or animations, costs where applicable, and server-validated need effects.

The phone labels the wallet **Naira balance** and offers free virtual top-ups with review and receipt screens. The full server supports actual registered-resident transfers with atomic debit/credit records, recipient notifications and payload-bound replay protection. Additional homes can accrue simulated rent and be resold or become the primary home. The dice lounge uses a persisted, cryptographically random server result. All of these use game Naira with no cash value; real payments, withdrawals and payment-provider integration remain unavailable.

The public account-free preview uses the same client with an isolated browser adapter, saves only local single-player progress and never contacts the production resident database. Shared chat, resident transfers and public events require the full Node server. Ambient NPCs and traffic are explicitly simulated; there are no fake registered residents, recipients or online totals.

## Current validation

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

Reproducible commands:

```sh
npm run qa
npm run assets:build
npm run qa:browser
npm run preview:build
npm run qa:gameplay
npm run qa:premium
```

The premium suite uses fresh browser-local preview contexts, disposable server residents and actual UI top-ups and purchases. It exercises actual WebGL models, onboarding, the quiet HUD, wallets, transfers, car ownership and paint, investment purchase/rent/resale, new venues, rich-home upgrades and renderer fallback. Reports and screenshots are written outside the checkout to `/workspace/scratch/premium-qa`; the broader suites use `/workspace/scratch/integration-qa` and `/workspace/scratch/gameplay-qa`.

## Earlier candidate evidence

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
| Home and world | Unobserved | Original 3D walking/running/driving, collision and tap paths, following camera, labeled NPC ambience, sixteen venue types and six cutaway home layouts |
| Phone | Unobserved | Original Pro Max-inspired hardware, lock/home/app/back states, messages/contacts/wallet/privacy |
| Social | Unobserved | Real session presence, zone chat, DMs, groups, invitations and moderation controls |
| Geography and travel | Unobserved | Source-provenanced settlement pins, real tile architecture, quoted compressed journeys; live road verification pending |
| Careers and economy | Unobserved | Task decisions, salary replay protection, eight branded cars, furniture upgrades, primary homes and rental investments, game top-ups and registered-resident transfers; no real payments |
| Shopping and advertising | Unobserved | Requested Okrika Marketplace for clothing and home goods, with charged game purchases; no ad-purchase system |
| Retention | Unobserved | Persistent identity, friends, work, home and event plans; no fabricated engagement statistics |
| Performance | Unobserved | Locally bundled pinned 3D renderer, shared snapshot renderer for catalogue previews, vector fallback and asset-only PWA caching; current browser regression recorded separately |

Production systems still requiring development include account recovery, voice communication, moderation operations, scaled multi-process presence, billing integrations, private-home visits, businesses and civic gameplay. Treat these as outstanding scope, not simulated completed features.

# AbujaLife

A playable browser life simulation set in Abuja and the wider Federal Capital Territory. Create a resident, walk and drive through an original 3D city, work, visit venues, and build a home and lifestyle of your own.

The interface uses English with local Hausa and Nigerian Pidgin greetings such as **Sannu** and **How far?**, Abuja neighbourhood names and Nigerian meals. Full language translations are not implemented.

Try the [anonymous browser preview](docs/PREVIEW.md) without an account or API key. Its progress stays on your device; the full server provides shared multiplayer.

## Develop

Node.js **24 or later** is required. Local development uses built-in SQLite; production uses a dedicated authenticated MongoDB replica set and a separate API. No Unity installation is needed. The pinned Three.js renderer is bundled and served locally; the running game does not fetch a rendering library from a CDN.

```bash
nvm use                 # optional if Node 24 is already active
npm ci
npm run assets:build
npm run qa
npm run dev
```

The server listens on port 8787. `PORT=8791 npm run dev` selects another port. `npm start` starts the Mongo-backed production API and requires its production environment; it does not serve a demo or the static frontend. Backend changes restart the development server automatically; refresh the browser after client changes.

Use the existing checkout and preserve local work. The production operations guide describes the owner Mac and Windows VPS deployment.

## Playable workflow

- Complete five short character cards with a live 3D avatar, customize your appearance and choose a life goal. The public preview requires no account; the full server saves registered residents.
- Choose Female or Male during character setup. A new registration receives a permanent, randomly assigned starting life, with an equal chance of **Nepo** or **Lapo**. Nepo starts with ₦1,000,000 and a gifted Jabi, Guzape or Maitama home; Lapo starts with ₦100,000 and an authored starter home in Lugbe, Kubwa, Nyanya, Bwari or Gwagwalada. New Lapo homes begin with basic plumbing and a sleeping mat, with no free furniture inventory; Nepo homes begin with a modest owned furnishing set. These are fictional game origins, not claims about the people living in those neighbourhoods.
- Use the four main tabs: **Play**, **Places**, **My Life**, and **Phone**. Needs, purchases and planning open when requested; a compact journey banner leaves the moving car visible.
- Start with a wider view of the city or your full room. Use the environment’s + / − and wide-view buttons, pinch or mouse wheel to zoom within its allowed range. Page zoom stays fixed. Move with WASD/arrows, hold Shift to run, or drag the mobile joystick. Tap the ground to walk there; tap a door/object or press E nearby to interact. The camera follows you and the minimap shows your position.
- Enter twenty authored venue types, including restaurants, a hotel, an equipped gym, cinema, grocery shop, café, salon, park, **Abuja Car** dealership, **Banex Tech Market** in Wuse II, estate office, **Okrika Marketplace**, mosque, church, four nightlife settings, games lounge and Jabi Lake. District availability varies. Meals, workouts, prayer, dancing and rest have visible 3D poses or animations and effects on your needs.
- Explore six original 3D cutaway homes, from a Garki studio through Lugbe, Gwarinpa and Jabi apartments to a Guzape terrace and Maitama villa. Furniture, rooms, people and vehicles are actual mesh models with lighting and shadows. A vector fallback keeps controls usable if WebGL is unavailable.
- Use **Home Studio** to change wall and floor finishes and drag, resize, rotate or remove room dividers, with Undo and saved changes. Design checks keep doors and usable routes clear. Move into a bigger authored layout when you want more room.
- Open the fictional in-game AbujaLife Phone. Lock/unlock it, open apps, and go back without losing message drafts.
- Open the phone browser for official **X** and **TikTok** links. These sites open externally rather than being presented as verified embedded apps. **Xshare** captures a PNG of your actual 3D home and saved layout, lets you edit its caption, and offers native sharing, download or an X draft. You attach the image and choose when to publish externally.
- Find real registered residents, request friendship, exchange live messages, form friend groups, and send invitations. The inbox preserves drafts, paginates history, supports retry-safe sends, and provides reviewed Send Naira transfers with server-generated receipts in the conversation. Presence, typing, message delivery, reading, and unread state come from actual sessions.
- Publish photos and posts to the **City Circle** social feed, like and comment on real residents' content, or publish a status that expires after 24 hours. Resident directories, messages and content use cursor pages; page sizes are request bounds rather than total-population or stored-content limits.
- Ask to visit a resident who is home in your neighbourhood. The owner must accept; privacy settings and blocks apply. Guests see the owner's actual home and furniture and share its location chat and positions, while home editing and personal home activities remain owner-only. Leaving or withdrawing consent ends the visit.
- Choose a job, travel to its district, and answer its work tasks to earn a server-calculated salary. Work uses actual **Africa/Lagos** time: office and bank roles open Monday–Friday, while restaurant and other schedules include suitable weekends. Complete at most two global shifts per Abuja day, one per shift slot; changing jobs cannot bypass the allowance. A completed shift cannot pay twice.
- Choose among fourteen Toyota, BMW, Mercedes, Ferrari, Lamborghini, Bugatti and Porsche models, including a G-Wagon, and seven paint colours. Original procedural models give the cars distinct body profiles; they are authored game approximations. Buy an affordable model, walk to the owned car and take the wheel, or repaint it from the garage. Drive with the movement controls and park before entering a building.
- Shop for clothing and thirty-six furniture items at Okrika Marketplace. A furniture purchase opens its arrangement controls; place, rotate or store it, or sell an owned item back to the system for half its game price. Inspect original 3D previews, arrange owned furniture on clear floor positions, use R to rotate, or return an item to storage. Your saved layout appears in the home; premium outfits require ownership.
- Upgrade your home with air conditioning, an inverter, sectional sofa, king-size bed, gaming console, pool table, drinks trolley and artwork. Some upgrades improve sleep or relaxation; the inverter reduces recurring home service bills by 15%. Pool tables, trolleys and artwork are decorative rather than separate playable activities.
- Hunt for a home by neighbourhood, bedrooms, layout and game price. Take a free walkthrough, rent or buy, then travel there. Rent covers a game year (28 real days); weekly service bills are separate. Prices are scaled virtual prices, not actual Abuja market quotations.
- Buy additional homes as investments, collect simulated rent and sell them, or move into one you own. Rent accrues at 0.2% of the game purchase price per real minute without an accrual ceiling; sale becomes available after one minute and returns 90% of the purchase price plus accrued rent. Your primary home does not produce investment rent.
- Read and consent to an optional **LAPO-style game loan**, with a one-time 5% fee and repayment due after 28 real days. Repay early or in parts from the wallet. This fictional game lender has no affiliation with LAPO Microfinance Bank; borrowing never happens automatically.
- Open **Naira balance** on the phone for receipts and transaction history. The anonymous preview offers free local game funds; the full server uses Flutterwave checkout after an administrator configures the provider. Choose an actual registered resident, review the recipient and amount, then transfer game Naira. Repeated requests cannot duplicate a verified payment credit, transfer or supported investment operation.
- Visit Dice & Chill Lounge to stake at least ₦100 of affordable game Naira on Low (1–3) or High (4–6). A match returns twice the stake; the other result loses it. The full server rolls a cryptographically random die and persists the result.
- See day and night follow the real Abuja clock, with explicitly simulated seasonal weather. Visit **Tokyo**, **Cage**, **Magic City** or **Bear Barn** for their authored interiors; DJ sessions run Wednesday, Friday and Saturday, 20:00–02:00 Abuja time. Sound is opt-in and uses an original generated beat. Dancing NPCs are simulated ambience. These player-provided venue names do not establish verified addresses, real business layouts or real prices.
- Search the location catalogue, compare a server-calculated fare, take transport, and arrive after a short compressed journey. Walking stays within a neighbourhood.
- Create events and RSVP. Block, mute, report, and control presence or invitations from the phone.

Naira here is **game money with no withdrawal facility**. The full server can sell game funds through administrator-configured Flutterwave checkout; only a matching, independently verified provider transaction credits the wallet. Free demonstration top-ups are unavailable in production regardless of administrator settings. The static preview keeps its own single-player demonstration balance on the device and accepts no real payments. There are no seeded fake friends or fake online totals. Okrika Marketplace sells only virtual game items. Okrika appears as environmental advertising and has no shared database, wallet, inventory or checkout.

The former business ceilings on balances, demonstration-fund totals, dice stakes, rent accrual and room-divider counts have been removed. Exact whole-Naira arithmetic, affordability, physical route checks, upload/request sizes and bounded query pages still apply. These correctness and security bounds do not certify unlimited deployment capacity.

## Persistence and realtime

Production stores accounts, hashed sessions, appearance, player state, needs, progress, wallets, immutable ledgers and transfer receipts, ownership, jobs, social relationships and messages in separate indexed MongoDB collections. Local development stores its own equivalent game state in SQLite. The default database directory is ignored `.local/`; set `ABUJALIFE_DATA_DIR` to select a persistent directory. Preserve this directory to retain residents and their progress. Never commit a database or credential file.

The backend validates valuable state in transactions. Authentication uses password hashing with scrypt and random sessions stored as hashes. Production cookies are host-only, Secure and HttpOnly; browser writes use the exact configured frontend origin and credentialed CORS. Server-Sent Events deliver messages to conversation members and nearby activity to the appropriate location zone. Presence privacy and blocking apply to these events.

Production runs a private MongoDB replica set and one Node API/SSE process as isolated native Windows services/tasks, with health checks and encrypted scheduled backups copied to the owner Mac. Redis is not required for this first deployment. Email verification and password recovery are implemented but require Resend credentials. Horizontal realtime fanout, native payment verification, voice notes/calls, player businesses and civic elections require further implementation. Cursor pagination removes total-content display ceilings without proving capacity for millions of concurrent residents. Social persistence, visit consent and privacy boundaries are documented in [SOCIAL_CONTRACT.md](docs/SOCIAL_CONTRACT.md).

## Administration and payments

The production frontend includes an administrator dashboard at `/admin/` (local development also supports `/admin.html`), with roles, resident search, suspension, report and post moderation, audited wallet adjustments, payment configuration and an audit trail. Admins with finance access can review and confirm a positive player top-up from Residents → Manage; each grant is idempotent and recorded in the wallet ledger and audit trail. First create a real resident, then bind that existing account from the server console:

Use the protected Windows bootstrap command in [PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md). It resolves only an existing resident and grants no future matching username access.

Flutterwave keys are entered in the dashboard and encrypted on the server using `ABUJALIFE_CONFIG_KEY`. Set a stable 32-byte configuration key and the public HTTPS origin before enabling checkout. Provider verification requires an exact successful status, transaction ID, reference, NGN amount and ownership match before an atomic, replay-protected wallet credit. No live merchant was configured or payment attempted during development. Webhook signature compatibility could not be independently confirmed because the provider documentation site was blocked; return and manual verification work separately from webhooks.

Use [PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) for the current MongoDB/Hostinger architecture, private configuration, administration, deployment and backup/restore commands. [ADMIN_PAYMENTS.md](docs/ADMIN_PAYMENTS.md) records earlier local-development provider tests. The static preview cannot provide shared chat or run a payment backend. The production browser connects to the VPS API at https://api.abujacity.life.

## Production build and acceptance

```bash
npm ci
npm run qa
npm run build
npm run qa:infra
```

`build` creates the connected Hostinger frontend in `dist/`. `qa:infra` requires Docker and creates its own authenticated private MongoDB fixture, verifies both accounts through the actual API and process restart, builds the real containers, and exercises encrypted backup/restore. It cleans only its own fixture resources. It does not connect to the owner's VPS or validate public hosting.

See [PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) before deploying and [PRODUCTION_ACCEPTANCE.md](docs/PRODUCTION_ACCEPTANCE.md) for the current checks and outstanding launch gates. The owner Mac connects to the actual Windows VPS with its existing SSH key and publishes the frontend through the authenticated Hostinger account. The acceptance record distinguishes live production verification from fixture checks and optional provider limitations.

## Geography

The legacy catalogue has 94 FCC district/sector records and 29 town/community records. It is an expansion catalogue, **not a verified cadastral dataset**. Unverified phase/cadastral codes are withheld and retained only as internal legacy assertions. FCC council assignments are unknown until official verification.

Six settlement reference points were copied exactly from the inspected GeoNames dataset packaged in `geonamescache 3.0.2`. They are named settlement points, not district centroids or boundaries. The map uses attributed OpenStreetMap tiles and only source-identified coordinates; it does not generate substitute roads or fictional district shapes. When a source cannot load, the map says so and keeps catalogue search and travel usable.

Source records and dates: [geography-sources.mjs](src/shared/geography-sources.mjs). Attribution and licences: [GEOGRAPHY_LICENSE.md](src/shared/GEOGRAPHY_LICENSE.md).

Live Lagos Life inspection, FCTA/AGIS verification, and OSM road rendering were blocked by the cloud proxy during this rebuild. See [the acceptance record](docs/REBUILD_STATUS.md). Enable the required domains in environment settings and rerun those gates before merging or publishing this as the completed rebuild.

## Validate

```bash
npm run qa
npm run assets:build
python tests/v4-browser-smoke.py
npm run preview:build
python tests/v4-preview-browser.py
```

`qa` checks every application/server/shared/script module, catalogue integrity, and meaningful database/HTTP/SSE tests. Test databases are temporary and do not change live residents.

V4 browser acceptance uses `python tests/v4-browser-smoke.py`, Python Playwright and Chromium. The cloud environment already provides them. For another machine, install Playwright and Chromium, or set `CHROMIUM_PATH` to a local Chromium executable. The suite uses disposable real residents and SQLite data, actual UI registration and purchases, and a private test-server clock/origin fixture. It does not overwrite wallets or profiles to bypass gameplay. Normal browser time and animation frames drive movement. Final report paths, fixture scope and accepted counts are recorded in [REBUILD_STATUS.md](docs/REBUILD_STATUS.md).

After rebuilding the self-contained preview, run `python tests/v4-preview-browser.py` for its browser target. The nine preview-adapter parity scenarios in `tests/preview-v4.test.mjs` also run as part of `npm run qa`; they are distinct from real Chromium UI acceptance.

`qa:browser`, `qa:gameplay` and `qa:premium` preserve historical V3 fixtures and evidence. Their assumptions predate the permanent origins, work schedules and full-server payment configuration, so they are not the V4 acceptance gate. The current V4 full-client browser suite and preview-adapter parity are recorded separately.

The authored walkable streets and fictional venues are game scenery; the geographic map remains separate and source-backed. Moving city NPCs and traffic are labeled simulations, never fake registered residents or online totals.

The clock uses West Africa Time without daylight saving. Weather is a deterministic seasonal game simulation, not a measured forecast: Open-Meteo access returned proxy CONNECT 403. Official X and TikTok sites were also blocked here, so live external-page behaviour and embedding have not been verified.

The full-server PWA caches only application assets, including the local rendering library. Private API responses and messages are never cached by the service worker. Full-server gameplay needs a server connection; offline entry gives a retry path rather than pretending progress was saved. The separate self-contained preview saves single-player progress in browser storage.

# AbujaLife

A playable browser life simulation set in Abuja and the wider Federal Capital Territory. Create a resident, walk and drive through an original 3D city, work, visit venues, and build a home and lifestyle of your own.

The interface uses English with local Hausa and Nigerian Pidgin greetings such as **Sannu** and **How far?**, Abuja neighbourhood names and Nigerian meals. Full language translations are not implemented.

Try the [anonymous browser preview](docs/PREVIEW.md) without an account or API key. Its progress stays on your device; the full server provides shared multiplayer.

## Develop

Node.js **24 or later** is required for the built-in SQLite database. No Unity or external database is needed. The pinned Three.js renderer is bundled and served locally; the running game does not fetch a rendering library from a CDN.

```bash
nvm use                 # optional if Node 24 is already active
npm ci
npm run assets:build
npm run qa
npm run dev
```

The server listens on port 8787. `PORT=8791 npm run dev` selects another port. `npm start` starts the server without file watching. Backend changes restart the development server automatically; refresh the browser after client changes.

Use the existing checkout. Every cloud task already has an isolated environment; do not create a Git worktree unless explicitly requested.

## Playable workflow

- Complete five short character cards with a live 3D avatar, customize your appearance and choose a life goal. The public preview requires no account; the full server saves registered residents.
- Use the four main tabs: **Play**, **Places**, **My Life**, and **Phone**. Needs, purchases and planning open when requested; a compact journey banner leaves the moving car visible.
- Move with WASD/arrows, hold Shift to run, or drag the mobile joystick. Tap the ground to walk there; tap a door/object or press E nearby to interact. The camera follows you and the minimap shows your position.
- Enter sixteen authored venue types, including restaurants, a hotel, an equipped gym, cinema, grocery shop, café, salon, park, dealership, estate office, **Okrika Marketplace**, mosque, church, club, games lounge and Jabi Lake. The lake is available in Jabi. Meals, workouts, prayer, dancing and rest have visible poses or animations and effects on your needs.
- Explore six original 3D cutaway homes, from a Garki studio through Lugbe, Gwarinpa and Jabi apartments to a Guzape terrace and Maitama villa. Furniture, rooms, people and vehicles are actual mesh models with lighting and shadows. A vector fallback keeps controls usable if WebGL is unavailable.
- Open the iPhone 18 Pro Max-inspired fictional in-game device. Lock/unlock it, open apps, and go back without losing message drafts.
- Find real registered residents, request friendship, exchange live messages, form friend groups, and send invitations. Presence, typing, message delivery, reading, and unread state come from actual sessions.
- Choose a job, travel to its district, and answer its work tasks to earn a server-calculated salary. A completed shift cannot pay twice.
- Earn one correct restaurant shift to afford a pre-owned Toyota Corolla, then walk to the owned car and take the wheel. Choose among eight Toyota, BMW and Mercedes models, including a G-Wagon, and seven paint colours. Repaint an owned car from the garage. Drive with the movement controls and park before entering a building.
- Shop for clothing and eighteen furniture items at Okrika Marketplace. Inspect original 3D previews, arrange owned furniture on clear floor positions, use R to rotate, or return an item to storage. Your saved layout appears in the home; premium outfits require ownership.
- Upgrade your home with air conditioning, an inverter, sectional sofa, king-size bed, gaming console, pool table, drinks trolley and artwork. Some upgrades improve sleep or relaxation; the inverter reduces recurring home service bills by 15%. Pool tables, trolleys and artwork are decorative rather than separate playable activities.
- Hunt for a home by neighbourhood, bedrooms, layout and game price. Take a free walkthrough, rent or buy, then travel there. Rent covers a game year (28 real days); weekly service bills are separate. Prices are scaled virtual prices, not actual Abuja market quotations.
- Buy additional homes as investments, collect simulated rent and sell them, or move into one you own. Rent accrues at 0.2% of the game purchase price per real minute, capped at 60 accrued periods; sale becomes available after one minute and returns 90% of the purchase price plus accrued rent. Your primary home does not produce investment rent.
- Open **Naira balance** on the phone for free game top-ups, receipts and transaction history. On the full server, choose an actual registered resident, review the recipient and amount, then transfer game Naira. Repeated requests cannot duplicate a top-up, transfer or supported investment operation.
- Visit Dice & Chill Lounge to stake ₦100–₦5,000 of game Naira on Low (1–3) or High (4–6). A match returns twice the stake; the other result loses it. The full server rolls a cryptographically random die and persists the result.
- Search the location catalogue, compare a server-calculated fare, take transport, and arrive after a short compressed journey. Walking stays within a neighbourhood.
- Create events and RSVP. Block, mute, report, and control presence or invitations from the phone.

Naira here is **virtual game money with no cash value**. Top-ups are free game funds; there is no real payment, withdrawal or connected payment provider. The full server validates balances and transfers; the static preview keeps its own single-player balance on the device. There are no seeded fake friends or fake online totals. Okrika Marketplace is the requested in-world shopping destination, with purchases charged to the game balance.

## Persistence and realtime

SQLite stores residents, hashed passwords, sessions, profiles, wallet transactions, inventory, property investments, job challenges, messages, social relationships, events, invitations, reports and replay-protected economy operations. The default database directory is ignored `.local/`; set `ABUJALIFE_DATA_DIR` to select a persistent directory. Preserve this directory to retain residents and their progress. Never commit a database or credential file.

The backend validates valuable state in transactions. Authentication uses password hashing with scrypt, random HttpOnly session cookies, and same-origin JSON writes. Server-Sent Events deliver messages to conversation members and nearby activity to the appropriate location zone. Presence privacy and blocking apply to these events.

This deployment architecture supports one Node process with SQLite. Horizontal scale, account recovery, operational moderation tools, payment-provider integration, voice notes/calls, player businesses, and civic elections require further implementation. Home invitations currently record consent and plans; entering another resident's private home is not implemented. These are not advertised as functioning systems.

## Geography

The legacy catalogue has 94 FCC district/sector records and 29 town/community records. It is an expansion catalogue, **not a verified cadastral dataset**. Unverified phase/cadastral codes are withheld and retained only as internal legacy assertions. FCC council assignments are unknown until official verification.

Six settlement reference points were copied exactly from the inspected GeoNames dataset packaged in `geonamescache 3.0.2`. They are named settlement points, not district centroids or boundaries. The map uses attributed OpenStreetMap tiles and only source-identified coordinates; it does not generate substitute roads or fictional district shapes. When a source cannot load, the map says so and keeps catalogue search and travel usable.

Source records and dates: [geography-sources.mjs](src/shared/geography-sources.mjs). Attribution and licences: [GEOGRAPHY_LICENSE.md](src/shared/GEOGRAPHY_LICENSE.md).

Live Lagos Life inspection, FCTA/AGIS verification, and OSM road rendering were blocked by the cloud proxy during this rebuild. See [the acceptance record](docs/REBUILD_STATUS.md). Enable the required domains in environment settings and rerun those gates before merging or publishing this as the completed rebuild.

## Validate

```bash
npm run qa
npm run qa:browser
npm run preview:build
npm run qa:gameplay
npm run qa:premium
```

`qa` checks every application/server/shared/script module, catalogue integrity, and meaningful database/HTTP/SSE tests. Test databases are temporary and do not change live residents.

Browser acceptance requires Python Playwright and Chromium. The cloud environment already provides them. For another machine, install Playwright and its Chromium browser, or set `CHROMIUM_PATH` to a local Chromium executable. The suite starts its own server on port 8790 with disposable residents and data. It tests two separate browser sessions, live social interactions, jobs/economy, persistence, travel, back navigation, a throttled connection, and 320/360/390/430/1440-pixel widths. Set `ABUJALIFE_QA_PORT` to select an unused port and `ABUJALIFE_QA_ARTIFACTS` for evidence output.

`qa:gameplay` serves the self-contained preview from an isolated temporary static server and checks character setup, visible movement and camera follow, touch controls, earned car ownership, venue activities, furniture placement, housing, persistence and input focus. It does not add residents to the real database.

For a focused rerun of onboarding, movement/camera and furniture/housing, use `ABUJALIFE_GAMEPLAY_MODE=regressions npm run qa:gameplay`. Both modes use actual browser time and UI-earned funds. Current accepted reports, target coverage and source hashes are recorded in [REBUILD_STATUS.md](docs/REBUILD_STATUS.md).

`qa:premium` checks the five-card onboarding, actual WebGL models, compact interface, phone top-up and transfer receipts, replay protection, branded-car purchase and paint, property investments, the new venues, rich-home upgrades and WebGL fallback. It uses disposable server residents and a fresh preview context. Set `ABUJALIFE_PREMIUM_MODE` to `server`, `preview` or `both`, and `ABUJALIFE_PREMIUM_ARTIFACTS` to select the report directory. All game funds are acquired through the real UI; no test edits a wallet to skip a purchase.

The authored walkable streets and fictional venues are game scenery; the geographic map remains separate and source-backed. Moving city NPCs and traffic are labeled simulations, never fake registered residents or online totals.

The full-server PWA caches only application assets, including the local rendering library. Private API responses and messages are never cached by the service worker. Full-server gameplay needs a server connection; offline entry gives a retry path rather than pretending progress was saved. The separate self-contained preview saves single-player progress in browser storage.

# AbujaLife

A playable browser life simulation set in Abuja and the wider Federal Capital Territory. Create your character, walk and drive around an authored city, enter venues, work, and make a home your own.

Try the [anonymous browser preview](docs/PREVIEW.md) without an account or API key. Its progress stays on your device; the full server provides shared multiplayer.

## Develop

Node.js **24 or later** is required for the built-in SQLite database. No Unity, external database, or package service is needed.

```bash
nvm use                 # optional if Node 24 is already active
npm ci
npm run qa
npm run dev
```

The server listens on port 8787. `PORT=8791 npm run dev` selects another port. `npm start` starts the server without file watching. Backend changes restart the development server automatically; refresh the browser after client changes.

Use the existing checkout. Every cloud task already has an isolated environment; do not create a Git worktree unless explicitly requested.

## Playable workflow

- Answer the three-step character setup, customize your appearance and choose a life goal. The public preview requires no account; the full server saves registered residents.
- Move with WASD/arrows, hold Shift to run, or drag the mobile joystick. Tap the ground to walk there; tap a door/object or press E nearby to interact. The camera follows you and the minimap shows your position.
- Enter restaurants, a hotel, gym, cinema, grocery shop, café, salon, park, dealership, furniture showroom and estate office. Meals, workouts and rest have visible animations, virtual costs and effects on your needs.
- Walk around six distinct cutaway home layouts and use the bed, kitchen, shower, sofa, wardrobe and front door.
- Open the iPhone 18 Pro Max-inspired fictional in-game device. Lock/unlock it, open apps, and go back without losing message drafts.
- Find real registered residents, request friendship, exchange live messages, form friend groups, and send invitations. Presence, typing, message delivery, reading, and unread state come from actual sessions.
- Choose a job, travel to its district, and answer its work tasks to earn a server-calculated salary. A completed shift cannot pay twice.
- Earn one correct restaurant shift to afford a used hatchback, then walk to the owned car and take the wheel. Drive with the movement controls and park before entering a building. Better vehicles are longer-term goals.
- Buy clothing and furniture when you want. Arrange owned furniture on a clear floor position, use R to rotate, and see your saved layout in the home. Premium outfits require ownership.
- Hunt for a home by neighbourhood, bedrooms, layout and game price. Take a free walkthrough, rent or buy, then travel there. Rent covers a game year (28 real days); weekly service bills are separate. Prices are scaled virtual prices, not actual Abuja market quotations.
- Search the location catalogue, compare a server-calculated fare, take transport, and arrive after a short compressed journey. Walking stays within a neighbourhood.
- Create events and RSVP. Block, mute, report, and control presence or invitations from the phone.

There are no seeded fake friends, fake online totals, or client-approved currency top-ups. Abuja Naira is virtual game money. **Okrika appears only as an in-world advertisement; it is absent from City Market and the game economy.**

## Persistence and realtime

SQLite stores residents, hashed passwords, sessions, profiles, wallet transactions, inventory, property, job challenges, messages, social relationships, events, invitations, and reports. The default database directory is ignored `.local/`; set `ABUJALIFE_DATA_DIR` to select a persistent directory. Preserve this directory to retain residents and their progress. Never commit a database or credential file.

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
```

`qa` checks every application/server/shared/script module, catalogue integrity, and meaningful database/HTTP/SSE tests. Test databases are temporary and do not change live residents.

Browser acceptance requires Python Playwright and Chromium. The cloud environment already provides them. For another machine, install Playwright and its Chromium browser, or set `CHROMIUM_PATH` to a local Chromium executable. The suite starts its own server on port 8790 with disposable residents and data. It tests two separate browser sessions, live social interactions, jobs/economy, persistence, travel, back navigation, a throttled connection, and 320/360/390/430/1440-pixel widths. Set `ABUJALIFE_QA_PORT` to select an unused port and `ABUJALIFE_QA_ARTIFACTS` for evidence output.

`qa:gameplay` serves the self-contained preview from an isolated temporary static server and checks character setup, visible movement and camera follow, touch controls, earned car ownership, venue activities, furniture placement, housing, persistence and input focus. It does not add residents to the real database.

The authored walkable streets and fictional venues are game scenery; the geographic map remains separate and source-backed. Moving city NPCs and traffic are labeled simulations, never fake registered residents or online totals.

The PWA caches only application assets. Private API responses and messages are never cached by the service worker. Gameplay needs a server connection; offline entry gives a retry path rather than pretending progress was saved.

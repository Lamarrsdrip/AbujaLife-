# AbujaLife

AbujaLife is a multiplayer Abuja life simulator. Residents create a character, move through Abuja-inspired neighbourhoods and landmarks, work, own or rent homes, drive, socialize, chat, furnish spaces, and take part in fictional city activities.

## Current product

The current production client includes:

- A persistent MongoDB-backed resident account and economy.
- Multiplayer presence, same-zone resident avatars, public-street resident name tags, location chat and privacy controls.
- A full Abuja World plus a separate Map experience.
- Authored Abuja landmarks, venue-specific interiors and fictional civic story destinations.
- A property market with a broad Abuja housing ladder across more than 20 purchasable/rentable homes and reusable authored layouts.
- Property-aware resident furniture placement, storage and resale.
- Abuja Car ownership, persistent vehicle state and route-based travel.
- The in-game AbujaLife Phone with Messages, wallet/Naira tools, City Story, calls, voice notes and other resident apps inside the handset overlay.
- Social posts, comments, likes, 24-hour statuses, groups, events, visits and direct messages.
- Administrator moderation, finance controls, audited corrections and persistent settings.
- Flutterwave-backed configured payment flows where a feature explicitly uses external money.
- Fictional AbujaLife civic/election gameplay.
- Community Jackpot, when enabled, as a separate funded subsystem with its own balance, room entry and admin-reviewed bank-withdrawal flow.

## Naira and Community Jackpot

Ordinary AbujaLife wallet Naira is **game currency**. It powers the resident economy, purchases, rent, transport, transfers, jobs and other simulator systems and is not presented as a cash-redemption wallet.

Community Jackpot is intentionally separate from the ordinary game wallet. When configured, a resident funds the Jackpot balance through the supported payment provider, enters a Jackpot room, and winnings remain in the Jackpot balance until the resident requests a bank payout. Withdrawal requests are reviewed/paid through the finance-admin flow and the product applies the configured withdrawal fee. A Jackpot withdrawal does not make the ordinary AbujaLife game wallet cash-withdrawable.

## Homes

AbujaLife no longer has only six housing choices. The property catalogue contains a larger Abuja-specific progression across entry, mid-market, upper and luxury homes in multiple real Abuja areas already represented by the game atlas.

The renderer deliberately reuses a maintained set of authored structural layouts rather than creating a separate brittle engine for every listing. Listings still differ by location, type, bedrooms, bathrooms, area, tier, pricing, comfort, features and furnishing treatment. Resident-owned furniture placements are property-aware so furniture left in one home does not silently duplicate into another.

## Chat media and voice notes

Chat photos and voice notes are private authenticated media. Production does not write chat media into a versioned release directory. Windows production receives a persistent `CHAT_MEDIA_DIR` under AbujaLife shared runtime storage, while deployments using configured private S3/R2-compatible storage use that instead. Failed storage is treated as a failed send rather than a successful phantom message.

## Production architecture

Production uses MongoDB as the authoritative persistent store and serves the web client separately from the API. Windows releases are versioned under the AbujaLife release tree while mutable runtime data such as persistent chat media is kept under shared runtime storage.

The deployment updater promotes an exact checked GitHub revision only after the required release checks are green. Backups are encrypted and the repository includes restore/restart verification against disposable production infrastructure.

### Realtime scaling

The current realtime server keeps each process bounded and fails closed when that process reaches its configured live-connection capacity. Persistent presence leases are Mongo-backed, but realtime fanout is still process-local today. Horizontal multi-process fanout is therefore a remaining scale architecture step before AbujaLife can claim very large simultaneous realtime concurrency; removing the safety limit without a broker would not constitute a real scale fix.

## Verification

The repository release workflow runs unit/integration QA, Windows runtime checks, production build/infrastructure checks, a Mobile WebKit city-entry gate, the historical resident browser journey and the current V4 full-client browser acceptance. Browser evidence is retained as workflow artifacts for inspection.

Public-hosting, DNS/certificate state and third-party provider availability are environment checks and should be verified separately from disposable local production acceptance.

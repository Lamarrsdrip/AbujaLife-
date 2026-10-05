# Account and interaction responsiveness — 5 October 2026

This change merges the latest multiplayer, rewards and advertising work with the startup and freeze fixes. Existing account, economy, property, chat and visit authorization remains on the server.

## What changed

- Login, signup and account refreshes use the authoritative core bootstrap. Social history, payment configuration and wider account cards load separately, so those services cannot hold the entry screen or an action response.
- Onboarding enters the game using the committed profile returned by the server. An interrupted response checks the genuine session without automatically repeating registration or claiming an unconfirmed save.
- Loaded social cards remain visible during a core refresh for the same account. A different or expired account never inherits them. Background reads cannot overwrite a newer wallet or furniture placement.
- Legacy fast routes remain compatible, but explicit core requests retain active work, administrator state and validated guest-home data. Failed requests never return cached authentication or a synthetic successful bootstrap.
- Committed house, venue and visit actions finish before presence fan-out. Ownership, authorization and visit reconciliation still complete before a successful response.
- Advertising decorations no longer trigger themselves through subtree observers. Repeated movement ticks do not rebuild unchanged roof labels or advertising layers.
- Product previews render only near the viewport through a shared idle queue and pause during input. Static camera work, actor materials and shadows are reused; furniture preview resources are released when editing finishes.
- The service worker shell version changes so the new account module ships with the update.

## Verification

- `npm run qa`: 341 tests passed.
- `node --test deploy/windows/runtime.test.mjs`: 4 tests passed.
- Actual production HTTP server against an authenticated disposable MongoDB: 13 checks passed, including core startup/login/onboarding, multiple accounts, messages and balances after process restart, and blocking.
- Focused production route checks keep optional work and presence fan-out unresolved while successful core and house responses complete; guest-home authorization remains enforced.
- Local Chromium at 393 × 852 and 1280 × 800: real signup, the character wizard, saved session reload and public-world responsiveness checked. This is browser emulation, not physical-device performance certification.
- Connected Hostinger frontend and anonymous preview rebuild successfully. The anonymous preview does not verify production authentication.

## Release checks

Push the integrated commit to `main` and let the existing CI and deployment process promote the API and frontend together. No production credentials are stored in this change.

This cloud environment's outbound proxy rejects connections to `abujacity.life` and `api.abujacity.life` with HTTP 403 before reaching the sites. Public deployment, production latency and GitHub CI completion must therefore be confirmed from the existing Mac/VPS deployment environment. Local passing checks do not establish capacity for 100 million simultaneous users.

After promotion, check anonymous opening, login, signup, final **Start playing**, house entry/exit, vehicle purchases and two-account chat in Safari and Chrome. Confirm `/health`, the deployed commit and error/latency logs. Account and wallet state must remain intact after restarting the API.

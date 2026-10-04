# Durable social content and home visits

`src/server/socialStore.mjs` exports `SocialStore(gameStore)` and `SOCIAL_META`. It uses the existing authenticated residents, SQLite connection, transaction wrapper, server clock, block rules and realtime delivery callbacks. Construction creates empty indexed tables. It does not create demonstration residents, posts, comments, likes or visitors.

The HTTP layer must obtain the resident ID from `GameStore.session()` and reject unauthenticated requests. Every public social method also verifies that its resident ID exists; IDs in request bodies never select the acting resident.

## Feed, statuses and comments

| Store method | Request | Result |
| --- | --- | --- |
| `feed(id, options)` | `{cursor?, limit?}` | `{ok, posts, nextCursor, serverTime}` |
| `statuses(id, options)` | `{cursor?, limit?}` | `{ok, statuses, nextCursor, serverTime}` |
| `createPost(id, body)` | `{text?, imageDataUrl?, kind?: 'post' \| 'status', idempotencyKey}` | `{ok, post, replayed}` |
| `toggleLike(id, postId)` | Post ID | `{ok, post}` |
| `comments(id, postId, options)` | `{cursor?, limit?}` | `{ok, comments, nextCursor}` |
| `addComment(id, postId, body)` | `{text, idempotencyKey}` | `{ok, comment, replayed}` |
| `deleteOwnPost(id, postId)` | Post ID | `{ok, postId, deleted: true, replayed}` |

A post contains `{id, userId, resident, text, imageDataUrl, kind, createdAt, expiresAt, likes, likedByMe, commentCount}`. A comment contains `{id, postId, userId, resident, text, createdAt}`. `resident` is the real public resident projection, respecting presence privacy. Images and expiry are `null` when absent. Like counts aggregate actual rows; comment counts exclude blocked authors for the viewer.

Text is limited to 4,000 characters per post and 2,000 per comment. An image must be a canonical base64 PNG, JPEG or WebP data URL. SVG, arbitrary URLs, HTML and mismatched raster headers are rejected. Decoded images are limited to 512 KiB, 4,096 pixels per side and 16,777,216 pixels overall. PNG chunks, checksums, decompression length and filter bytes are validated; JPEG and WebP structures and dimensions are checked. WebP animation is rejected. The HTTP route must allow the base64 expansion of a supported image, with an appropriate bounded body size of at least 768 KiB; unrelated routes can retain smaller limits. The browser must render user text as text and use images as image sources.

Status expiry is assigned from the server clock at creation plus exactly 24 hours. Client `createdAt` or `expiresAt` fields are ignored. All normal reads and interactions exclude expired or deleted posts. Retrying publication never extends a status. An expired-status retry fails with `status_expired` and a deleted-post retry fails with `post_unavailable`.

An idempotency key uses 8–128 ASCII letters, numbers, underscores, hyphens or colons. Reusing a key with identical content returns the existing row; changed content fails with HTTP 409 `idempotency_conflict`. Deletion retains the row for audit and replay protection.

Pages default to 20 records and accept 1–50. Returned opaque cursors encode the server timestamp and ID ordering. Filtering blocks and status expiry happens in SQL before the page limit. Timestamp ties are ordered by ID, so same-millisecond content remains reachable without duplication. These are per-query page sizes; there is no limit on residents or total stored content. Status reads also bound their timestamp range to the current 24-hour window. Relevant feed, comment, expiry, author and reverse-block indexes are created.

## Consensual home visits

| Store method | Request | Result |
| --- | --- | --- |
| `requestVisit(guestId, body)` | `{ownerId \| residentId, note?, idempotencyKey}` | `{ok, request, replayed}` |
| `answerVisit(ownerId, requestId, accept)` | Request ID and boolean | `{ok, request, visit, replayed}` |
| `leaveVisit(guestId)` | No body fields required | `{ok, profile, visit: null, replayed}` |
| `visitState(id, options)` | `{cursor?, visitorsCursor?, limit?}` | `{ok, visit, requests, visitors, nextRequestsCursor, nextVisitorsCursor}` |
| `reconcileVisits(id)` | Acting resident ID | Ends invalid sessions; no return payload |

A request contains `{id, ownerId, guestId, owner, guest, note, status, createdAt, answeredAt}`. Its statuses are `pending`, `accepted`, `rejected` and `cancelled`. Only the owner can answer their request. Each owner/guest pair can have one pending request; a guest can have one active home visit. These constraints prevent duplicate requests and conflicting active locations rather than limiting the population.

The guest must be outside and parked in the owner's home neighbourhood, with no active journey or shift, to request or begin a visit. Accepting also requires the owner to be physically in their own home. Privacy uses `settings.allowInvites`, `settings.allowHomeVisits` (allowed unless explicitly false) and `settings.homeVisitsFriendsOnly` (accepted friends required when true). Blocks apply in both directions. Rejecting a visit does not move either resident. Identical request/answer retries do not create additional sessions or teleport a departed guest back inside.

Acceptance saves the guest's location as `{kind: 'visit', district, venue: 'home', ownerId, visitId}`. A visit contains `{id, requestId, ownerId, guestId, owner, guest, home, furnitureLayout, storedFurniture, startedAt, ownerHome}`. `ownerHome` contains only `{id, username, displayName, appearance, home, inventory, furnitureLayout, storedFurniture}`; its inventory contains furniture only. The layout is the owner's current durable layout. It does not disclose the owner's wallet, settings, vehicle inventory or investments.

GameStore must route `kind: 'visit'` to `home:${ownerId}` for real location chat and presence. Visiting residents must not be treated as being in their own home: home meals, sleep, shower, relaxation and furniture changes must require `kind: 'home'`. Travel, return-home and moving home must leave the visit first or be rejected while visiting. The HTTP/core integration should run `reconcileVisits(id)` around actions and after privacy or block changes. Reading `visitState` also reconciles. The owner leaving, moving home, closing privacy or blocking a guest ends the session and returns the actual guest to the neighbourhood; no home benefit or wallet debit is applied.

Request and visitor collections use independent cursor windows. Visitors use `visitorsCursor`; requests use `cursor`. Reconciliation queries only the acting resident's actual active visit sessions. It does not scan all residents.

## Administrative moderation

`social.authorizeModeration` denies by default. The trusted server integration must assign `actorId => admin.requirePermission(actorId, 'moderation')`. Client-provided permission flags must never configure this callback.

`moderationPosts(actorId, {cursor?, limit?, includeDeleted?})` returns `{ok, posts, nextCursor}` and includes `deletedAt`, `deletedBy` and `deletionReason` on each post. It can inspect expired statuses and deleted content for authorized moderation. `moderateDeletePost(actorId, postId, {reason})` requires a 3–500-character reason, records the real moderator and reason, and returns `{ok, postId, deleted: true, replayed}`. Neither method can be used without the injected moderation permission check.

Realtime events are emitted for actual authors, owners, guests and existing zone participants through the existing delivery callbacks. No synthetic online population or fabricated activity is generated.

## Validation and operating limits

Run `node --test tests/social.test.mjs`. The tests exercise actual registered residents and sessions, restart persistence, empty initial feeds, publishing, likes/comments, server-clock status expiry, keyset traversal beyond one page, blocking, idempotency, upload rejection, moderation permission/audit, owner-only consent, real furniture views, denied guest benefits and session revocation.

This implementation remains a single-process Node/SQLite service. Its indexes and bounded reads remove new full-population scans; they do not certify service for ten million concurrent residents. That scale requires shared database/media storage, distributed presence and fan-out, multiple server workers, operational limits and measured load tests.

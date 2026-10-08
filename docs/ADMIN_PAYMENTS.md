# Administration and verified payments

> Historical local SQLite/development guide. For the actual Windows/Mongo production deployment, use [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md). Production demo top-ups stay disabled regardless of administrator settings; production roles bind an existing resident through the private server bootstrap.

The full Node/SQLite server has a separate administrator dashboard at `/admin.html`. The anonymous static preview does not expose administrator access, accept real payments or connect separate residents.

## Bind the first administrator

Create the resident account through the game first. On the server console, using the same `ABUJALIFE_DATA_DIR` as the game, run:

```bash
node scripts/admin-bootstrap.mjs --username EXISTING_RESIDENT_USERNAME
```

This command grants that existing resident ID the `superadmin` role. It never creates a resident or a password. Alternatively, set `ABUJALIFE_ADMIN_USERNAME` before starting the server; that startup binds only an already-existing resident. A later registration matching that name is not automatically granted access.

Sign in to that resident account, then open `/admin.html`. A super administrator can assign `operator` or `moderator` roles to other existing residents. Operators can manage payment configuration and recorded wallet adjustments; moderators can review reports and community posts. Only super administrators can assign roles. The server protects the last active super administrator.

Suspension revokes the resident's current sessions. Report decisions, role changes, wallet adjustments, settings and verified payment credits are recorded in the audit trail. Wallet adjustments require a reason and an idempotency key; replaying an adjustment cannot apply it twice. Resident and activity lists use bounded keyset pages rather than loading every account into the browser.

## Configure Flutterwave

Set a stable, private `ABUJALIFE_CONFIG_KEY` on the server. It must encode 32 random bytes as 64 hexadecimal characters or base64. For example, generate it on the server console with `openssl rand -hex 32`, then save it in the host's private environment settings. Preserve this key across restarts and backups; losing or changing it prevents decryption of previously saved provider credentials. Do not put the generated value in chat, source control, browser storage or logs.

Set `ABUJALIFE_PUBLIC_ORIGIN` to the game's public HTTPS origin, or enter that origin in the dashboard. In **Payments**, select test or live mode, enter the matching Flutterwave secret key and webhook signing secret, set the game-Naira credit rate and enable the selected mode. Activating a mode determines which merchant configuration creates new checkouts. Keys are encrypted with AES-256-GCM and authenticated scope information; the dashboard receives only masked values. Pending orders retain their original encrypted merchant key and credit amount, so a later configuration change cannot change their credits.

Full-server free demonstration top-ups are disabled by default. The anonymous preview continues to offer clearly labeled local game funds. The administrator can explicitly enable free demonstration top-ups through **Settings**. Neither purchased game Naira nor free preview funds provide a withdrawal facility.

Community Jackpot uses a separate funded account and ledger. When configured, provider-verified deposits fund that account and room winnings remain there. A resident can request a bank withdrawal from the Jackpot balance; the finance-admin flow reviews the request and records payment or returns a rejected hold. The current withdrawal quote retains a 10% fee when paid. This does not permit cash withdrawal from the ordinary AbujaLife game wallet or preview funds. See [the current product currency boundaries](../README.md#naira-and-community-jackpot).

Checkout sends the server's saved NGN amount, unique reference, customer receipt email and configured callback origin to Flutterwave's `/v3/payments` API. Only an HTTPS URL on `flutterwave.com` or its subdomains is accepted as a returned checkout link. The amount and credit rate are selected on the server, not by a client assertion that payment succeeded.

After checkout, the server fetches `/v3/transactions/:id/verify`. Before crediting, it requires all of the following to match the saved order:

- Successful provider response and transaction status.
- Transaction ID and unique checkout reference.
- Exact NGN amount and currency.
- The requesting resident's ownership of the order.

The wallet credit, ledger entry, credited order and audit record commit in one SQLite transaction. A provider transaction ID can credit only one order, and retries return the existing result. **Payments → Verify a transaction** also provides recovery using a transaction ID and the saved checkout reference.

The implemented webhook endpoint is `/api/payments/webhook`. It accepts a raw-body HMAC-SHA256 signature in the `flutterwave-signature` header using base64 encoding, then independently verifies the transaction through the provider API before any credit. It does not accept a header that merely repeats the webhook secret. The current Flutterwave documentation website returned HTTP 403 through this cloud proxy, so that merchant webhook format was not independently confirmed in this environment. Confirm the format against current provider documentation before enabling delivery in the merchant dashboard. Return and manual transaction verification operate independently of webhook delivery.

The transaction verification path and successful response fields were checked against [Flutterwave's official Node v3 SDK](https://github.com/Flutterwave/Flutterwave-node-v3/blob/537f9f4455f922a879e4f088cf0f596621c3517c/services/transactions/rave.verify.js) and its [transaction examples](https://github.com/Flutterwave/Flutterwave-node-v3/blob/537f9f4455f922a879e4f088cf0f596621c3517c/documentation/transactions.md). The automated provider tests inject an explicit local provider fixture. No live merchant credentials were supplied, no live payment was attempted, and those tests do not demonstrate a configured merchant account.

## Public server preview

A shared game needs a public Node server and persistent SQLite storage. RawGitHack serves the separate static single-player preview; it cannot run the server APIs or shared chat.

Cloudflare Quick Tunnel requires no provider account, but `https://api.trycloudflare.com` returned `CONNECT 403` from this environment's proxy on 2026-10-04. No tunnel was provisioned and no public full-server URL was created. A temporary tunnel would also last only while this workspace and its server remain running. A persistent host remains necessary for an ongoing shared game; this architecture is not a verified ten-million-user deployment.

# AbujaLife in-world advertising

AbujaLife advertising is separate from the virtual Abuja Naira economy.

- Price: ₦2,000 NGN per placement.
- Duration: 7 days.
- City display advertising: each purchase reserves exactly one available ad plot. Residents choose the exact available plot they want before checkout.
- Roadside advertising: ten visible roadside billboard spaces are available; each purchase reserves one board.
- Creative: PNG, JPEG or WebP uploaded by the resident and compressed client-side before submission.
- Link: secure HTTPS website or X link.
- Payment: existing AbujaLife Flutterwave configuration. Provider success is verified independently by the server before a placement is activated.
- Flutterwave metadata: checkout metadata is intentionally scalar-only. The authoritative campaign, selected slot, amount, owner and creative remain in AbujaLife's server-side ad order and are resolved from the unique `tx_ref` during verification.
- Idempotency: provider transaction receipts and resident checkout operation keys are unique. The client versions checkout intents so a fixed payment flow never reuses an obsolete hosted-payment link.
- Availability: ad slots are reserved during checkout and locked while active. TTL indexes release expired reservations/placements.
- Economy: successful advertising payments do not credit or debit the Abuja Naira game wallet.

The ad world is deliberately separate from residential gameplay so campaigns remain visible without making the playable neighbourhoods feel like a generic city grid. Empty plots and boards show the current ₦2,000 / 7-day offer, while active creatives are rendered in-world and link only to their verified HTTPS destination.

The production Mongo bootstrap creates `ad_orders`, `ad_slots`, and append-only `ad_receipts`. Runtime application credentials have no Mongo DDL privileges.

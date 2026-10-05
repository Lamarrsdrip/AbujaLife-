# AbujaLife in-world advertising

AbujaLife advertising is separate from the virtual Abuja Naira economy.

- Price: ₦2,000 NGN.
- Duration: 7 days.
- Business land: the dedicated open Abuja Business Park contains 40 visible plots; each purchase reserves exactly 5 available plots.
- Roadside advertising: ten visible roadside billboard spaces are available; each purchase reserves one board.
- Creative: PNG, JPEG or WebP uploaded by the resident and compressed client-side before submission.
- Link: secure HTTPS website or X link.
- Payment: existing AbujaLife Flutterwave configuration. Provider success is verified by the server before a placement is activated.
- Idempotency: provider transaction receipts and resident checkout operation keys are unique.
- Availability: ad slots are reserved during checkout and locked while active. TTL indexes release expired reservations/placements.
- Economy: successful advertising payments do not credit or debit the Abuja Naira game wallet.

The ad park is deliberately separate from residential gameplay so campaigns remain visible without making the playable neighbourhoods feel like a generic city grid. Empty plots and boards show the current ₦2,000 / 7-day offer, while active creatives are rendered in-world and link only to their verified HTTPS destination.

The production Mongo bootstrap creates `ad_orders`, `ad_slots`, and append-only `ad_receipts`. Runtime application credentials have no Mongo DDL privileges.

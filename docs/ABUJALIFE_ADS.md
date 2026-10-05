# AbujaLife in-world advertising

AbujaLife advertising is separate from the virtual Abuja Naira economy.

- Price: ₦2,000 NGN.
- Duration: 7 days.
- Business land: exactly 5 available plots per purchase.
- Roadside advertising: one available billboard per purchase.
- Creative: PNG, JPEG or WebP uploaded by the resident and compressed client-side before submission.
- Link: secure HTTPS website or X link.
- Payment: existing AbujaLife Flutterwave configuration. Provider success is verified by the server before a placement is activated.
- Idempotency: provider transaction receipts and resident checkout operation keys are unique.
- Availability: ad slots are reserved during checkout and locked while active. TTL indexes release expired reservations/placements.
- Economy: successful advertising payments do not credit or debit the Abuja Naira game wallet.

The production Mongo bootstrap creates `ad_orders`, `ad_slots`, and append-only `ad_receipts`. Runtime application credentials have no Mongo DDL privileges.

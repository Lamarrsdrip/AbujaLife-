# AbujaLife in-world advertising

AbujaLife advertising is separate from the virtual Abuja Naira economy.

- Price: ₦2,000 NGN per placement.
- Duration: 7 days.
- Inventory: expanded safe authored map parcels, 43 compatibility parcels and ten safely positioned roadside boards reuse the existing placement IDs, reservations, campaigns and payment system. Scalable city/sky zones remain available subject to protected-land checks.
- City display advertising: each purchase reserves exactly one available ad plot. Residents can tap eligible map land directly and choose the exact available plot before checkout; the Ads control is an optional inventory highlight, not a required mode.
- Roadside advertising: ten visible roadside billboard spaces are available; each purchase reserves one board.
- Creative: PNG, JPEG or WebP uploaded by the resident and compressed client-side before submission.
- Link: secure HTTPS website or X link.
- Payment: existing AbujaLife Flutterwave configuration. Provider success is verified independently by the server before a placement is activated.
- Flutterwave metadata: checkout metadata is intentionally scalar-only. The authoritative campaign, selected slot, amount, owner and creative remain in AbujaLife's server-side ad order and are resolved from the unique `tx_ref` during verification.
- Idempotency: provider transaction receipts and resident checkout operation keys are unique. The client versions checkout intents so a fixed payment flow never reuses an obsolete hosted-payment link.
- Availability: ad slots are reserved during checkout and locked while active. TTL indexes release expired reservations/placements.
- Economy: successful advertising payments do not credit or debit the Abuja Naira game wallet.

The shared `map-ad-land.mjs` catalogue protects district housing and expansion anchors, landmarks and access, navigation roads and walkways, and the ambient traffic corridor. Every authored parcel passes the same land and parcel collision rules on the server and client. Existing paid placement IDs resolve to their canonical full parcel geometry; protected land cannot be newly booked.

The forty original Business Park IDs and three earlier checkout cells use dedicated medium parcels on safe unused land inside the existing city plane. Their former footprints overlapped newer parcels or protected land, so this explicit relocation preserves existing paid and pending campaigns without rewriting orders, reservations or receipts. The original IDs remain the reservation keys; other dynamic IDs cannot book their compatibility land. The active Okrika parcel and two already-safe cells from the earlier five-slot checkout retain their exact authored geometry.

Vacant inventory is part of the map surface: clean square/rectangular ground tiles remain visible during ordinary exploration and become stronger when the optional Ads highlight is enabled. The layer uses two shared instanced meshes, at most 280 visible parcels, and no vacant-plot image textures or per-plot queries. A normal tap on eligible vacant land opens the existing ad studio directly; roads, buildings, landmarks and occupied campaigns keep their native interactions. Drag, pan and multi-touch gestures do not become purchases. Availability is checked again against server reservations before checkout.

Active creative occupies 92% of the limiting plot dimension with its aspect ratio preserved, and the thin raised frame adapts to the creative. Explicit cover mode crops rather than stretching. The renderer shares geometry, keeps at most 60 visible displays and 24 decoded textures, chooses 256/512/1024 texture detail by projected screen area, culls outside the buffered viewport, and retains existing texture while upgrading. Expired placements disappear without fabricating active campaigns. A deliberate tap on an occupied campaign opens the real campaign information and verified CTA.

The payments-permission admin endpoint `/api/admin/ads/inventory` reports the expanded authored and compatibility placements with truthful available, reserved or occupied status, campaign reference, owner and dates. Existing campaign/payment pages retain the wider dynamic city and sky inventory. Authorized admins can publish real platform campaigns into the same slot/campaign system without a payment charge; resident checkout remains ₦2,000 for seven days.

The production Mongo bootstrap creates `ad_orders`, `ad_slots`, and append-only `ad_receipts`. Runtime application credentials have no Mongo DDL privileges.

# Outside and native game release

This release combines the changes from `origin/main` at `35a5cae` with the saved
camera, furniture and character work. It preserves the existing production
deployment and provider configuration.

## Product changes

- Outside replaces the main Places/map navigation with a live, original 3D city.
  Every one of the 123 atlas entries and 20 venues is discoverable. Bold roof
  labels and search select real district/venue identities; transport uses the
  existing server quote, debit, journey and arrival flows.
- A readable initial neighbourhood view can pan, orbit and pinch. Whole city
  fits the complete catalogue. The arrangement is stylized game scenery, not
  a claim about exact geographic building positions.
- Homes, all building facades, roads, trees and furniture use richer shared
  materials, architectural trim, contact shadows and refined original models.
  The sparse Lapo starter remains intentionally sparse.
- Female/Male choices, durable varied appearances and distinct hair models are
  preserved. Okrika Marketplace is the virtual game's display name; no real
  Okrika commerce, inventory, users, database or wallet is connected.
- The app uses a bounded full-height game viewport and compact native dock.
  Phone pages retain 8/8/4 apps, a pinned dock, touch targets and real chat money
  review/confirmation. Furniture has a bottom catalogue and actual 3D preview,
  movement, rotation, explicit placement, storage and confirmed system resale.
- Startup does not wait for optional account configuration. Bootstrap has an
  eight-second deadline and a reconnect state. The redundant DOM observer that
  repeatedly rewrote unchanged marketplace text is removed. Outside batches
  scenery/traffic and updates fixed roof-label transforms only when the view
  changes; hidden scenes stop their rendering loop.

## Verification at the first main checkpoint

`npm run qa`: 280 passed, zero failed/skipped before the additional startup
regression tests. `npm run build` generates 43 public files; `preview:build`
generates the anonymous, self-contained preview. The four Windows runtime
tests pass. The new startup checks verify a stalled optional request and a
bootstrap timeout/reconnect without weakening authentication.

The fresh Docker production acceptance passed 43 authenticated Mongo tests and
12 HTTP checks, followed by encrypted consistent backup, corruption rejection,
complete snapshot restore and retained sessions, wallets and admin access
after restart. This used isolated local services, not a live VPS mutation.

Standalone Chromium verified Outside rendering, all 143 destinations, travel
selection without client location mutation, portrait/landscape framing and
resource cleanup. Integrated mobile signup and bounded WebGL rendering passed.
The remaining integrated camera/travel/phone and furniture browser checks are
being completed after this checkpoint; the final evidence is recorded below.

The cloud proxy denied current requests to the public website/API. The previous
live deployment evidence in `PRODUCTION_ACCEPTANCE.md` remains historical;
this document does not claim the new revision has deployed or passed remote CI.
The LagosLife browser comparison was blocked by a certificate authority error.
Software WebGL measurements do not establish 60 FPS on physical iPhones or
Android devices.

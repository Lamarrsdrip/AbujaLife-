# Advertising studio speed and zoom range

Branch `fix/ads-speed-zoom-range-2026-10-10`, from `main` at `74461fe` (PR #54 merge).

## Advertising

### What was wrong

1. **Administrators froze the page.** `app/admin-ad-bypass.js` re-assigned the submit button's label from
   inside its own `MutationObserver`. Assigning `textContent` records a mutation even when the text is
   identical (verified in Chromium and WebKit), so the observer re-triggered itself without end. On `main`
   a probe counted 388 rewrites of the same label in three seconds and the page stopped answering.
   Residents were not affected; anyone with the payments permission was.
2. **Opening waited on inventory.** `openStudio` awaited configuration, then the first inventory page, before
   the sheet was usable, and `loadAds()` chained the 96-space city overview onto every configuration load.
3. **Listing pages carried artwork.** The studio asked for `zoom=2`, so every occupied space returned its
   base64 campaign image although the grid never shows it.
4. **Every refresh redrew the world.** `abj:ads-updated` fired on each poll, focus and map pan even when
   nothing had changed, and the 3D map rebuilds its ad layers on that event.
5. **Reads wrote to the database.** `world()` and `publicState()` ran an expired-slot `deleteMany` on every call.

### What changed

- `openStudio` is synchronous: the sheet, form, tabs and close button exist in the same task. Pricing comes
  from memory or a 24-hour display-only cache and refreshes in the background.
- Inventory for the current page loads after first paint, with `AbortController` cancellation on close,
  reopen, tab, area and page changes, and a version guard so a late response can never repaint a newer page.
- Pages are 24 (phone) or 48 (wide) placements, requested with `zoom=1`. This is presentation only: the
  server already pages by `page * limit`, so Previous/More spaces still walks every placement.
- Visited pages are kept for two minutes and shown instantly, then revalidated when older than five seconds.
  A page is redrawn only when availability actually changed.
- Cells are appended in batches of 12 per frame.
- `abj:ads-updated` is dispatched only when pricing, campaigns or space availability change.
- The admin layer and the studio now write to the DOM only when a value differs.
- Read paths purge expired slots at most every 15 seconds. Their queries already ignore expired locks;
  checkout and admin inventory keep the exact, transactional purge.

Payment verification, reservation locking, occupied-space rejection, the checkout idempotency key and the
Flutterwave flow are unchanged. No placement was removed and no cap was added.

## Zoom

- **Map (`app/map.js`)**: `MAP_ZOOM` replaces the hard-coded `7..17`. The minimum is tile level 0, the whole
  world. Buttons, pinch, wheel and keyboard share `clampMapZoom`. The centre is normalised onto the globe so
  wide views pan and wrap; repeated world columns get their own tile elements. Building cards hide below
  level 11 and per-district pins below level 8 (the city pin, the selected place and the current place stay).
- **World (`app/world-camera.js`)**: `WORLD_ZOOM.min` is `.01` (was `.06`), six times wider. It is never zero.
  The existing camera envelope scales near/far with the view, and picking stays aligned (tested).
- **Street view**: zooming out past 1x now rises into an aerial view (down to `.1`, ten times the walking
  distance) and stops being pulled in by buildings once the eye is above the rooftops. Street view remains
  the default.
- The live 3D Map (`outside-city-v4.js`) already allowed `.22`, which shows about 4.7x the whole city; it was
  not changed.

## Not resolved

- The studio's entrance animation still shows roughly 0.5–1 s of slow frames in headless Chromium on a Mac.
  The cost is native paint, not script (80–150 ms of script), and the page shows similar hiccups with nothing
  opened, so the measurement is too noisy to attribute. It needs profiling on a real phone.
- The viewport ad stream used while panning the map still requests artwork (`zoom=2`, up to 180 campaigns).
  That is the map's display path, not the studio, and was left alone.

# Street view: third-person 3D presentation

Branch `feat/street-view-3d-2026-10-09`, started from `main` at `1060e09`. Not merged, not deployed.

## Why

On a phone the playable world was a distant tilted "dollhouse": an orthographic camera framing a whole
room or several streets, rendered at 1.3x on 2x–3x screens. The city read as a small pastel model rather
than a place you are standing in.

## What changed

- **Third-person perspective camera** (`app/world-street-camera.js`, wired in `app/world-3d.js` and
  `app/world-simulator.js`). The eye follows behind the resident at street level, eases behind the direction
  of travel (faster when driving), and rises over buildings instead of clipping into them. Drag still looks
  around, pinch and +/− still zoom, the joystick and tap-to-walk are unchanged in meaning.
- **Horizon** (`app/world-skyline.js`): sky dome, far ground, fogged skyline and granite outcrops, with day,
  dusk, night and rain palettes. Three draw calls of distant scenery, no collision, deterministic per district.
- **Believable scale**: in street view residents are drawn at building scale (door-height people) rather than
  the enlarged overview figures.
- **Interiors**: the eye looks over the camera-facing walls (which the scene already lowers) and the exit door
  leaf steps aside when it would hide the resident.
- **Sharper rendering**: phone pixel-ratio ceiling raised 1.3x → 1.75x (desktop 1.8x → 2x). The frame-rate
  governor now judges only consecutive gameplay frames and steps down by 0.25x. Previously idle frames were
  counted as slow frames, so a resting scene dropped to 1x on any phone.
- **Overview kept**: a view switch beside the recentre button returns to the original overview camera. Arranging
  furniture, the login/welcome scene and the non-WebGL fallback always use the overview. The choice persists
  per device (`abujalife:world-view`).

Game state, server coordinates, navigation, collision, interactions, economy and saves are untouched: this is
presentation only. The SVG layer becomes a screen-space overlay in street view so every marker, label and tap
target keeps working.

## Verification (2026-10-09, local)

- `npm run qa`: 610/610 (602 before + 8 new in `tests/street-view-camera.test.mjs`). One existing assertion that
  pinned the old `1.3:1.8` pixel ratio was updated to the new ceiling; nothing else changed in existing tests.
- `npm run build`: passes.
- `tests/city-entry-webkit.py` (mobile WebKit city entry gate): passes.
- `tests/game-hud-browser.py` (HUD layout at 390x844, 320x568, 412x915, 844x390, 1440x900 plus venue and
  multiplayer steps): Chromium passes in full. WebKit failed once late in a combined run with "network connection
  was lost" while other suites were using the machine, then passed in full when run alone with a clean console.
- Manual, headless Chromium 390x844 @2x with GPU: street walk, tap-to-walk, drag-look, enter home, interior
  walk, overview toggle, buy car, drive. No page errors.
- Frame time while driving in rain on this Mac (682x1258 buffer, 104 draw calls, ~122k triangles): 17.2 ms
  average, 16.8 ms p95. **This is a desktop GPU figure, not a phone measurement.**

## Not done / known limits

- No real-device profiling yet (frame time, memory, thermals, battery) on target phones.
- The Map / "Whole Abuja" view (`outside-city*.js`) is a separate renderer and is unchanged: it is still a
  distant overview.
- Journey ("transit") scenes use the street camera but were not individually reviewed.
- Building, vehicle and character models are the existing procedural meshes. Street view exposes their
  simplicity at close range; the GLB/texture asset pass is the next graphics step.
- Roads end at the edge of each authored scene; fog and a tree line soften it but there is no continuous city.
- Remaining CI browser gates not run locally: `qa:browser`, map-ad, open-land-ads and the V4 runner.

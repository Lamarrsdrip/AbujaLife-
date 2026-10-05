# Connected static frontend

The public frontend is a static build of the full AbujaLife game. The source of
truth remains `main`; the Windows VPS release task builds it into the same
immutable release as the API and Caddy serves that release from the existing
VPS. GitHub Actions validates the static artifact but no longer publishes a
separate `hostinger-production` branch.

The old Hostinger document root is retained until public DNS cutover is
complete. It is a rollback copy only; do not point it at `main`, which contains
source files and is not a static document root.

Run `npm ci` with Node 24 or newer, then `npm run build`. The build writes the
connected game to `dist/`. The Windows deploy builds this directory inside the
immutable API release, then atomically updates the Caddy frontend root only
after the new API candidate is healthy. It bundles the game, administrator
client, shared game rules and pinned Three.js renderer.

The build reads only two public variables:

| Variable | Default |
| --- | --- |
| `API_PUBLIC_URL` | `https://api.abujacity.life` |
| `PUBLIC_WEB_URL` | `https://abujacity.life` |

Both must be public HTTPS origins, without credentials, ports, paths, queries or fragments. `runtime-config.js` contains exactly these values. Database connections, payment provider credentials, administrative passwords, signing keys and server configuration belong on the API VPS and are never build inputs. Rebuild before changing either public origin; keep API CORS and frontend response headers aligned with the deployed domains.

The API client sends credentials with every API request and the authenticated realtime event stream. The API must allow exactly `https://abujacity.life`, support credentialed CORS preflights and issue its own HttpOnly, Secure, SameSite=Lax session cookies. The production API lives at `https://api.abujacity.life`; the frontend never serves `/api` itself. The static service worker caches an explicit public shell list and bypasses all cross-origin requests, API routes, administration routes and runtime configuration. It never caches resident data, messages, balances or authentication responses.

`/admin/` is a static operations client using the same API origin. The server enforces administrator authentication and permissions. The public build includes no administrator credential or bootstrap secret.

Source development keeps `/api` on its own origin. `npm run preview:build` remains the separate anonymous browser preview, whose API adapter stores demonstration progress locally. Do not upload `preview/index.html` as the connected production game.

Run `node --test tests/build-production.test.mjs` to verify origin validation, credentialed requests, complete static assets, secret exclusion and service-worker privacy rules. Production functional acceptance additionally requires the real MongoDB API and browser requests between the two HTTPS origins.

For reproducible local acceptance, start the real production API against a disposable MongoDB replica set, run `npm run build`, then `ABUJALIFE_QA_API_PORT=8995 python tests/production-browser-smoke.py` with the fixture's API port. The script serves the actual build through a local TLS proxy and maps both public hostnames in Chromium. It exercises two registered accounts, explicit Female/Male signup choices, cookie persistence, realtime events, a real phone transfer, idempotent replay, messages, posts and worker cache privacy. It accepts only its generated local test certificate; this check does not verify public DNS or public CA certificates. Reports and screenshots are saved outside the repository. The API fixture owner must drop the disposable database afterward.

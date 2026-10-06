# AbujaLife session runtime finalization

The login/startup critical path has one authority.

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/entry`

`src/server/sessionRuntime.mjs` is instantiated directly by both HTTP servers and dispatched before the rest of the API. There is no auth listener wrapper and no legacy login/register/logout implementation underneath it.

The retired startup stack (`coreEntry`, `entryBootstrap`, `fastStartup`, fast auth/bootstrap routes, `?session=1`, and startup bootstrap semantics) must not be restored.

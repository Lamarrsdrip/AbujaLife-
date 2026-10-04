# Core API surface

Public/bootstrap:
- `GET /health`
- `POST /v1/session/guest`
- `GET /v1/world/bootstrap`
- `GET /v1/world/districts`
- `GET /v1/jobs`
- `GET /v1/market/catalog`
- `GET /v1/properties`
- `GET /v1/vehicles`
- `GET /v1/business-types`
- `GET /v1/events?district=...`

Player state/actions:
- `GET /v1/players/:id`
- `POST /v1/players/:id/life`
- `POST /v1/players/:id/presence`
- `GET /v1/players/:id/nearby`
- `POST /v1/players/:id/jobs/:jobId/complete`
- `POST /v1/players/:id/market/purchase`
- `POST /v1/players/:id/wallet/topup`
- `POST /v1/players/:id/property`
- `POST /v1/players/:id/vehicles/purchase`
- `POST /v1/players/:id/vehicles/:vehicleId/drive`
- `POST /v1/players/:id/businesses`
- `POST /v1/players/:id/businesses/:businessId/cycle`
- `POST /v1/players/:id/events/:eventId/join`
- `POST /v1/players/:id/mayor/nominate`
- `POST /v1/players/:id/mayor/vote`
- `POST /v1/players/:id/ads`
- `GET /v1/players/:id/okrika`

Social:
- `POST /v1/messages`
- `GET /v1/players/:id/messages`
- `POST /v1/friends/request`
- `POST /v1/friends/accept`
- `POST /v1/players/block`

This dev API uses an in-memory store so the domain rules are runnable without infrastructure. `infra/postgres/schema.sql` defines the first persistent production model; authentication/rate limiting must be enabled before Internet exposure.

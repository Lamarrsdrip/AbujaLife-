# Architecture

## Client
Unity URP is the gameplay client across iOS, Android and WebGL. Districts/interiors are additive scenes. Production content should migrate to Addressables/remote catalogs once asset delivery is configured.

## Server authority
The server owns:
- wallet/ledger
- inventory
- job rewards/cooldowns
- property ownership
- marketplace transactions
- progression/reputation
- payment grants

The client owns prediction/presentation only.

## Production services roadmap
The zero-dependency service in this repo is intentionally a domain-first reference implementation. Replace adapters, not rules:
- MongoDB Atlas repository adapter
- Redis for presence, rate-limit and ephemeral locks
- WebSocket gateway for zone presence/chat
- object storage/CDN for UGC
- Apple/Google/web payment verification adapters
- moderation queue and admin service
- analytics/event pipeline

## Zones
Do not network every player in Abuja to every other player. Presence is sharded by zone/instance. Friends/group members can be preferentially co-located. Interiors are separate instances.

# Production acceptance record

The deployment takeover runs on the owner’s Mac against the real VPS and authenticated Hostinger account. This replaces the earlier cloud environment’s access limitation. Results below distinguish completed checks from outstanding live acceptance.

| Check | Observed result |
| --- | --- |
| GitHub baseline | `main` 5f37d16; dedicated infrastructure branch f7874ba, eight commits ahead, zero behind |
| Mac SSH | Authorized existing Ed25519 key connects to Administrator@173.212.249.202 |
| VPS | Windows Server 2022, native Node 24.21.0/MongoDB 8.0/Caddy 2.11.4; no Docker runtime in use |
| Domain | abujacity.life active in Hostinger account; dedicated static website created |
| API DNS/TLS | api A record points to VPS; verified HTTPS certificate, Caddy reload preserved original Okrika vhosts |
| Application QA | 217 tests passed after backend/email/realtime/auth UI fixes |
| Isolated Mongo QA | 39 authenticated Mongo integration checks passed on disposable instance |
| Production HTTP fixture | 12 restart/persistence/realtime/authorization checks passed |
| Repository secret scan | 729 Git objects examined; findings were generated URI templates and explicitly named test payment fixtures; no real credential identified |
| Okrika baseline and proxy change | Public API and White Studio healthy before and after Caddy reload |
| Native live deployment | In progress; not yet accepted |
| Hostinger game upload/browser QA | In progress; not yet accepted |
| Off-server backups | Mac encrypted-pull implementation prepared; live delivery not yet accepted |
| Main/CI promotion | Pending final QA and CI |

Live acceptance must additionally verify authenticated private AbujaLife Mongo, normalized persistence/index readiness, restricted application privileges, actual API startup/recovery, two-account realtime and durable state across restart, negative authorization, actual Hostinger headers/routes/network traffic, validated scheduled backups/off-server delivery, final main revision and CI. No local fixture result substitutes for these public checks.

Email verification/password reset delivery remains disabled without a dedicated Resend key and verified sender. Flutterwave live checkout remains disabled without configured merchant verification credentials. Apple/Google verification remains fail-closed pending real platform adapters. These optional provider omissions must remain visible in the final report.

See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for actual Windows resource isolation and operational commands. No secrets or user database snapshots belong in this record.

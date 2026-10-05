# Production acceptance record

The deployment takeover completed from the owner’s Mac against the real VPS and authenticated Hostinger account. Results below record live evidence and the remaining provider prerequisites.

| Check | Observed result |
| --- | --- |
| GitHub baseline | Final `main` is `41e2f66`; dedicated infrastructure work was promoted after live acceptance |
| Concurrent source update | b867f44 adds 3D depth, compact phone and authoritative exterior transitions; merged without overwriting either session |
| Mac SSH | Authorized existing Ed25519 key connects to Administrator@173.212.249.202 |
| VPS | Windows Server 2022, native Node 24.21.0/MongoDB 8.0/Caddy 2.11.4; no Docker runtime in use |
| Domain | abujacity.life active in Hostinger account; dedicated static website created |
| API DNS/TLS | api A record points to VPS; verified HTTPS certificate, Caddy reload preserved original Okrika vhosts |
| Application QA | 234 tests passed after backend/email/realtime/auth UI fixes |
| Isolated Mongo QA | 40 authenticated Mongo integration checks passed on disposable instance |
| Production HTTP fixture | 12 restart/persistence/realtime/authorization checks passed |
| Repository secret scan | 729 Git objects examined; findings were generated URI templates and explicitly named test payment fixtures; no real credential identified |
| Okrika baseline and proxy change | Public API and White Studio healthy before and after Caddy reload |
| Native live deployment | **Passed**; revision `41e2f66ecfca-6b88670b1408` is healthy on `AbujaLife-API` with Node 24, loopback 18787, supervised LocalService startup/reload and validated `AbujaLife-AutoDeploy` polling |
| Hostinger game deployment/browser QA | **Passed**; `https://abujacity.life` serves the `41e2f66` production build from the generated `hostinger-production` branch. HTTPS redirects/deep routes/security headers work, the browser loads the playable Garki scene and calls only HTTPS API origins |
| Off-server backups | **Passed**; encrypted AES-GCM archive copied and authenticated at `~/AbujaLife-backups`, LaunchAgent `life.abujacity.backup-pull` active every six hours, backup/config keys mode 0600 |
| Main/CI promotion | **Passed**; `main` is `41e2f66`; CI runs `37257026063` and `37257026052` passed on Ubuntu and Windows/frontend deployment |

Live acceptance completed. The private audit confirms `abujalife_prod`, authentication, loopback Mongo 27017, 51 collections, 170 indexes, append-only ledger protections and application DDL denial. Public HTTPS acceptance passed 9 checks before and 7 checks after a graceful AbujaLife-only restart using three independent accounts: sessions, wallets, ledger, inventory, homes, vehicles, jobs, locations, conversations, SSE reconnect, idempotency, cross-account denial and bilateral block enforcement. The backup task produced an AES-256-GCM archive with authenticated `mongorestore --dryRun` validation; the Mac pull verified checksum and GCM authentication without plaintext output. Okrika API and White Studio remained healthy. No local fixture result substitutes for these public checks.

The normal release path is now `main` → GitHub Actions QA/build → generated `hostinger-production` static artifact branch → Hostinger Git auto-deployment, while the VPS `AbujaLife-AutoDeploy` task polls only successful public GitHub checks and runs the existing candidate/health-checked Windows promotion. No Mac process or manual frontend upload is needed after a merge.

Email verification/password reset delivery remains disabled without a dedicated Resend key and verified sender. Flutterwave live checkout remains disabled without configured merchant verification credentials. Apple/Google verification remains fail-closed pending real platform adapters. These optional provider omissions must remain visible in the final report.

See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for actual Windows resource isolation and operational commands. No secrets or user database snapshots belong in this record.

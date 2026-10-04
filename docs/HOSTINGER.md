# Hostinger hosting plan

The production architecture now uses the static frontend on **https://abujacity.life**, a separate **https://api.abujacity.life** Node 24 API, and an isolated authenticated MongoDB replica set/database. The former single-origin SQLite instructions are superseded.

Follow [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for tested packaging, VPS separation, Hostinger upload, DNS/HTTPS, administration and encrypted backup/restore. The older local-preview ZIP remains device-only and is not the production frontend. Live deployment has not occurred: authorized read-only SSH to the supplied VPS returned connection refused, and no authenticated Hostinger access is exposed here.

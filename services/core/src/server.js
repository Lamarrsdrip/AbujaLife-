import http from 'node:http';
import { createApp } from './app.js';
import { createRouter } from './router.js';
const port = Number(process.env.PORT ?? 8787);
const app = createApp({
  allowDevReceipts: process.env.ALLOW_DEV_RECEIPTS === 'true',
  okrikaBaseUrl: process.env.OKRIKA_BASE_URL ?? 'https://okrika.store'
});
const server = http.createServer(createRouter(app));
server.listen(port, '0.0.0.0', () => console.log(`AbujaLife core listening on :${port}`));

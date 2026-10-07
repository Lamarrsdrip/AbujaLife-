import { configuration, apiEnvironment, safeCode } from './runtime.mjs';
import { createProductionApplication } from '../../src/server/production.mjs';
import { productionLog } from '../../src/server/production-http.mjs';

const config = configuration();
const port = process.env.ABUJALIFE_CANDIDATE_PORT ? Number(process.env.ABUJALIFE_CANDIDATE_PORT) : config.apiPort;
if (![18787, 18788].includes(port)) throw new Error('Only the dedicated private API and candidate ports are allowed.');
const runtimeEnv = apiEnvironment(config, port);
// Chat Pro is attached below the production HTTP/session runtime, whose legacy
// constructor defaults to process.env. Mirror only the runtime identity and
// persistent chat-media path so it cannot fall back into a versioned release.
process.env.NODE_ENV = runtimeEnv.NODE_ENV;
process.env.CHAT_MEDIA_DIR = runtimeEnv.CHAT_MEDIA_DIR;
let app, stopping = false;
async function shutdown(reason) {
  if (stopping) return;
  stopping = true;
  productionLog('shutdown', { reason });
  const deadline = setTimeout(() => process.exit(1), 12000);
  deadline.unref();
  try { if (app) await app.close(); clearTimeout(deadline); process.exit(0); }
  catch { process.exit(1); }
}
try {
  app = await createProductionApplication({ env: runtimeEnv });
  await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
  productionLog('startup', { port, storage: 'mongodb', database: config.database });
  if (process.send) process.send({ type: 'ready', port });
} catch (error) {
  productionLog('startup_failure', { code: safeCode(error) });
  if (app) await app.close().catch(() => {});
  process.exit(1);
}
process.on('message', message => { if (message?.type === 'shutdown') void shutdown('supervisor'); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void shutdown(signal));
process.on('disconnect', () => void shutdown('supervisor_disconnect'));
process.on('uncaughtException', () => { productionLog('crash', { code: 'uncaught_exception' }); process.exit(1); });
process.on('unhandledRejection', () => { productionLog('crash', { code: 'unhandled_rejection' }); process.exit(1); });

import { JackpotIntegration } from './jackpotIntegration.mjs';
import { GameError } from './errors.mjs';

const SECURITY_HEADERS = Object.freeze({
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000',
  'cache-control': 'no-store',
});

function json(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
}

export async function attachJackpotRuntime(server, options = {}) {
  const integration = new JackpotIntegration(options);
  await integration.tick();
  integration.timer = setInterval(() => {
    void integration.tick().catch(error => options.log?.('jackpot_tick_error', { code: error.code || 'internal_error' }));
  }, 4000);
  integration.timer.unref?.();

  const listeners = server.listeners('request');
  if (!listeners.length) throw new Error('Cannot attach Community Jackpot before the HTTP request handler exists');
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    let pathname = '';
    try { pathname = new URL(req.url, 'https://api.abujacity.life').pathname; } catch {}
    if (pathname.startsWith('/api/jackpot/') || pathname.startsWith('/api/admin/jackpot/')) {
      void integration.handle(req, res);
      return;
    }
    if (pathname === '/api/payments/webhook' && req.method === 'POST') {
      void integration.handleWebhook(req, res).catch(error => {
        const status = error instanceof GameError ? error.status : 500;
        options.log?.('jackpot_webhook_error', { status, code: error instanceof GameError ? error.code : 'internal_error' });
        if (!res.headersSent) json(res, status, { ok: false, error: error instanceof GameError ? error.message : 'Something went wrong. Please try again.', code: error instanceof GameError ? error.code : 'server_error' });
        else res.end();
      });
      return;
    }
    for (const listener of listeners) listener.call(server, req, res);
  });
  server.on('close', () => integration.close());
  server.jackpotIntegration = integration;
  return integration;
}

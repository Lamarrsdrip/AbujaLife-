import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailDelivery } from '../src/server/emailDelivery.mjs';
import { productionConfig } from '../src/server/production.mjs';

const base = { NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost/abujalife_prod', MONGODB_DATABASE: 'abujalife_prod', PUBLIC_WEB_URL: 'https://abujacity.life', API_PUBLIC_URL: 'https://api.abujacity.life', CORS_ORIGINS: 'https://abujacity.life' };

test('production API defaults to loopback and container exposure requires explicit configuration', () => {
  assert.equal(productionConfig(base).host, '127.0.0.1');
  assert.equal(productionConfig({ ...base, HOST: '0.0.0.0' }).host, '0.0.0.0');
  assert.throws(() => productionConfig({ ...base, HOST: '173.212.249.202' }), /HOST/);
});

test('unconfigured email stays disabled and partial provider configuration fails safely', () => {
  assert.deepEqual(createEmailDelivery({ env: {} }), { deliverPasswordReset: null, deliverEmailVerification: null });
  assert.throws(() => createEmailDelivery({ env: { RESEND_API_KEY: 'secret' }, publicWebUrl: base.PUBLIC_WEB_URL }), /Configure both/);
  assert.throws(() => createEmailDelivery({ env: { RESEND_API_KEY: 'secret', EMAIL_FROM: 'sender@example.com\nBCC: other@example.com' }, publicWebUrl: base.PUBLIC_WEB_URL }), /Configure both/);
});

test('email links keep recovery tokens in fragments and logs omit secrets and recipients', async () => {
  const calls = [], logs = [], token = 'ab'.repeat(32), key = 'private-provider-key';
  const delivery = createEmailDelivery({ env: { RESEND_API_KEY: key, EMAIL_FROM: 'AbujaLife <hello@abujacity.life>' }, publicWebUrl: base.PUBLIC_WEB_URL, fetchImpl: async (...args) => { calls.push(args); return { ok: true }; }, log: (...args) => logs.push(args) });
  await delivery.deliverPasswordReset({ email: 'recipient@example.test', token });
  await delivery.deliverEmailVerification({ email: 'recipient@example.test', token });
  assert.equal(calls[0][0], 'https://api.resend.com/emails');
  assert.equal(calls[0][1].redirect, 'error');
  assert.equal(calls[0][1].headers.authorization, `Bearer ${key}`);
  const reset = JSON.parse(calls[0][1].body), verification = JSON.parse(calls[1][1].body);
  assert.ok(reset.text.includes(`https://abujacity.life/#reset-password=${token}`));
  assert.ok(verification.text.includes(`https://abujacity.life/#verify-email=${token}`));
  assert.doesNotMatch(JSON.stringify(logs), /private-provider-key|recipient@example|abababab/);
});

test('provider delivery errors never return response bodies or credentials', async () => {
  const logs = [], delivery = createEmailDelivery({ env: { RESEND_API_KEY: 'private-key', EMAIL_FROM: 'hello@abujacity.life' }, publicWebUrl: base.PUBLIC_WEB_URL, fetchImpl: async () => { throw new Error('private-key'); }, log: (...args) => logs.push(args) });
  await assert.rejects(delivery.deliverPasswordReset({ email: 'recipient@example.test', token: 'ab'.repeat(32) }), /^Error: Email delivery failed$/);
  assert.deepEqual(logs, [['email_delivery_failure', { kind: 'password-reset' }]]);
});

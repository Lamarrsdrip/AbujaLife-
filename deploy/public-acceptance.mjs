#!/usr/bin/env node
// Explicit operator-run HTTPS acceptance. Never invoked by CI and never restarts a service.
// Run --phase before, restart ONLY AbujaLife through its service control, then --phase after.
// Generated account credentials and expected state live only in QA_EVIDENCE_DIR outside Git.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

class AcceptanceError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const expect = (condition, code) => { if (!condition) throw new AcceptanceError(code); };
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sorted = value => [...value].sort();
const operationKey = () => crypto.randomUUID();
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function origin(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new AcceptanceError(`${name}_required`); }
  expect(url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash && !url.port && /^(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*$/i.test(url.hostname) && !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(url.hostname), `${name}_must_be_public_https_origin`);
  return url.origin;
}

async function privateDirectory(value) {
  expect(typeof value === 'string' && path.isAbsolute(value), 'absolute_qa_evidence_dir_required');
  await fs.mkdir(value, { recursive: true, mode: 0o700 });
  const directory = await fs.realpath(value), relative = path.relative(repo, directory);
  expect(relative.startsWith('..' + path.sep) || path.isAbsolute(relative), 'qa_evidence_must_be_outside_repository');
  for (let current = directory;; current = path.dirname(current)) {
    let git = false;
    try { await fs.lstat(path.join(current, '.git')); git = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    expect(!git, 'qa_evidence_must_be_outside_git');
    if (current === path.dirname(current)) break;
  }
  await fs.chmod(directory, 0o700);
  return directory;
}

async function privateWrite(filename, value) {
  const temporary = filename + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, filename);
    await fs.chmod(filename, 0o600);
  } finally { await fs.rm(temporary, { force: true }); }
}

function snapshot(profile) {
  return { id: profile.id, wallet: profile.wallet, district: profile.district, location: profile.location, home: profile.home,
    inventory: sorted(profile.inventory), vehicleColors: profile.vehicleColors, ownedProperties: sorted(profile.ownedProperties),
    propertyInvestments: profile.propertyInvestments, furnitureLayout: profile.furnitureLayout, storedFurniture: sorted(profile.storedFurniture),
    job: profile.job, careerLevel: profile.careerLevel, skills: profile.skills, completedShifts: profile.completedShifts };
}

export async function runPublicAcceptance({ phase, env = process.env } = {}) {
  expect(['before', 'after'].includes(phase), 'phase_must_be_before_or_after');
  expect(env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'tls_verification_must_be_enabled');
  const api = origin(env.PUBLIC_API_URL, 'public_api_url');
  const web = origin(env.PUBLIC_WEB_URL || `https://${new URL(api).hostname.replace(/^api\./, '')}`, 'public_web_url');
  const directory = await privateDirectory(env.QA_EVIDENCE_DIR), evidenceFile = path.join(directory, 'public-acceptance.private.json');
  const checks = [], streams = new Set();
  let evidence = { version: 1, api, web, createdAt: new Date().toISOString(), stage: 'started', accounts: {} };
  let activeCheck = '';
  const save = () => privateWrite(evidenceFile, evidence);
  const check = async (name, action) => { activeCheck = name; await action(); checks.push(name); console.log(`PASS ${name}`); };
  const request = async (route, { account, method = 'GET', body, requestOrigin = web, headers = {} } = {}) => {
    const response = await fetch(api + route, { method, headers: { origin: requestOrigin, ...(account ? { cookie: account.cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15000) });
    let data;
    try { data = await response.json(); } catch { throw new AcceptanceError('api_response_must_be_json'); }
    return { status: response.status, data, cookie: response.headers.get('set-cookie'), headers: response.headers };
  };
  const success = (result, status = 200) => { expect(result.status === status && result.data?.ok !== false, 'unexpected_api_status'); return result.data; };
  const profile = async account => success(await request('/api/bootstrap', { account })).profile;
  const action = async (account, name, payload = {}) => success(await request('/api/action', { account, method: 'POST', body: { action: name, payload: { ...payload, idempotencyKey: payload.idempotencyKey || operationKey() } } }));
  function sessionCookie(header) {
    expect(typeof header === 'string' && /(?:^|;)\s*HttpOnly(?:;|$)/i.test(header) && /(?:^|;)\s*Secure(?:;|$)/i.test(header) && /SameSite=Lax/i.test(header) && !/(?:^|;)\s*Domain=/i.test(header), 'secure_host_only_session_cookie_required');
    const cookie = header.split(';')[0];
    expect(/^abujalife_session=[a-f0-9]{64}$/i.test(cookie), 'opaque_session_cookie_required');
    return cookie;
  }
  function realtime(account) {
    const controller = new AbortController(), queue = [];
    let failure = false, connected = false;
    const connection = { close: () => { controller.abort(); streams.delete(connection); }, async wait(predicate) {
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        expect(!failure, 'realtime_connection_failed');
        const found = queue.find(predicate);
        if (found) return found;
        await delay(50);
      }
      throw new AcceptanceError(connected ? 'realtime_event_not_delivered' : 'realtime_connection_timeout');
    } };
    streams.add(connection);
    void (async () => {
      try {
        const response = await fetch(api + '/api/realtime', { headers: { origin: web, cookie: account.cookie }, redirect: 'error', signal: controller.signal });
        expect(response.status === 200 && response.headers.get('content-type')?.startsWith('text/event-stream'), 'authenticated_sse_required');
        connected = true;
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) { if (!controller.signal.aborted) failure = true; break; }
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
          expect(buffer.length < 1048576, 'realtime_frame_too_large');
          for (let split; (split = buffer.indexOf('\n\n')) >= 0;) {
            const block = buffer.slice(0, split); buffer = buffer.slice(split + 2);
            const event = /^event: (.+)$/m.exec(block)?.[1], data = /^data: (.+)$/m.exec(block)?.[1];
            if (event && data) { queue.push({ event, data: JSON.parse(data) }); if (queue.length > 1000) queue.shift(); }
          }
        }
      } catch { if (!controller.signal.aborted) failure = true; }
    })();
    return connection;
  }
  const limitations = ['MongoDB database name/authentication, private binding, append-only database privileges, backup validity and service auto-start require separate server inspection.', 'Paid provider fulfillment and email delivery require real provider credentials; this test grants no paid entitlements.', 'Job assignment/progression state is checked; timed salary completion is excluded because public QA must obey the real work schedule.', 'This API test does not verify Hostinger browser rendering, frontend deep routes, DNS records or certificate renewal configuration.'];
  try {
    if (phase === 'before') {
      let exists = false;
      try { await fs.lstat(evidenceFile); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      expect(!exists, 'existing_evidence_use_after_or_new_directory');
      await save();
    } else {
      const file = await fs.lstat(evidenceFile);
      expect(file.isFile() && !file.isSymbolicLink() && (file.mode & 0o077) === 0, 'private_evidence_permissions_required');
      evidence = JSON.parse(await fs.readFile(evidenceFile, 'utf8'));
      expect(evidence.version === 1 && evidence.api === api && evidence.web === web && evidence.stage === 'ready-for-operator-restart', 'matching_completed_before_evidence_required');
      expect(evidence.accounts.A && evidence.accounts.B && evidence.accounts.C, 'three_saved_accounts_required');
    }
    await check('Public HTTPS health, Mongo storage, safe response and credentialed CORS', async () => {
      const response = await request('/health');
      expect(response.status === 200 && response.data.ok === true && response.data.storage === 'mongodb', 'healthy_mongo_api_required');
      expect(equal(sorted(Object.keys(response.data)), ['ok', 'service', 'storage']), 'health_response_contains_unexpected_fields');
      expect(response.headers.get('access-control-allow-origin') === web && response.headers.get('access-control-allow-credentials') === 'true', 'exact_credentialed_cors_required');
      expect(response.headers.get('strict-transport-security')?.includes('max-age='), 'hsts_required');
      const preflight = await fetch(api + '/api/action', { method: 'OPTIONS', headers: { origin: web, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      expect(preflight.status === 204, 'cors_preflight_failed');
      expect((await request('/api/bootstrap', { requestOrigin: 'https://unauthorized.invalid' })).status === 403, 'wrong_origin_must_be_denied');
      expect((await request('/api/wallet')).status === 401, 'anonymous_wallet_must_be_denied');
    });
    if (phase === 'before') {
      await check('Three independent accounts sign up and log in using persistent secure sessions', async () => {
        const suffix = crypto.randomBytes(5).toString('hex');
        for (const [label, presentation] of [['A', 'feminine'], ['B', 'masculine'], ['C', 'masculine']]) {
          const account = { username: `qa_${label.toLowerCase()}_${suffix}`, password: crypto.randomBytes(24).toString('base64url') };
          evidence.accounts[label] = account; await save();
          const registered = await request('/api/auth/register', { method: 'POST', body: { username: account.username, password: account.password, displayName: `Production QA ${label}` } });
          success(registered, 201); account.id = registered.data.profile.id; account.cookie = sessionCookie(registered.cookie); await save();
          const registrationCookie = account.cookie;
          success(await request('/api/auth/logout', { account, method: 'POST', body: {} }));
          expect((await request('/api/wallet', { account: { cookie: registrationCookie } })).status === 401, 'logout_must_revoke_registration_session');
          const loggedIn = await request('/api/auth/login', { method: 'POST', body: { username: account.username, password: account.password } });
          success(loggedIn); expect(loggedIn.data.profile.id === account.id, 'login_identity_changed'); account.cookie = sessionCookie(loggedIn.cookie); await save();
          success(await request('/api/profile', { account, method: 'POST', body: { appearance: { presentation }, onboardingComplete: true } }));
        }
        expect(new Set(Object.values(evidence.accounts).map(account => account.id)).size === 3, 'accounts_must_be_distinct');
      });
      const { A, B, C } = evidence.accounts;
      await check('Untrusted identities, wallet values, ownership and prototype top-ups cannot grant authority', async () => {
        const beforeA = await profile(A), beforeB = await profile(B);
        const mutation = success(await request('/api/profile', { account: A, method: 'POST', body: { id: B.id, residentId: B.id, userId: B.id, displayName: 'Production QA A verified', wallet: 999999999999, inventory: ['maitama-villa'], ownedProperties: ['maitama-villa'], skills: { Finance: 999 } } }));
        expect(mutation.profile.id === A.id && mutation.profile.wallet === beforeA.wallet && equal(sorted(mutation.profile.inventory), sorted(beforeA.inventory)) && equal(mutation.profile.skills, beforeA.skills), 'client_authority_must_be_ignored');
        expect(equal(snapshot(await profile(B)), snapshot(beforeB)), 'another_account_must_not_change');
        expect((await request('/api/wallet/topup', { account: A, method: 'POST', body: { amount: 10000, verified: true } })).status === 403, 'client_payment_claim_must_be_denied');
        expect((await request('/api/action', { account: A, method: 'POST', body: { action: 'demo-topup', payload: { amount: 10000, idempotencyKey: operationKey() } } })).status === 403, 'demo_topup_must_be_denied');
        expect((await request('/api/admin/settings', { account: A, method: 'POST', body: { gameTopupsEnabled: true } })).status === 403, 'nonadmin_must_be_denied');
        const bootstrap = success(await request('/api/bootstrap', { account: A }));
        expect(bootstrap.walletMeta.demoTopupEnabled === false, 'production_demo_topup_must_be_disabled');
      });
      await check('Friendship and conversation membership persist for the two participants', async () => {
        success(await request('/api/friends/request', { account: A, method: 'POST', body: { residentId: B.id } }));
        const pending = success(await request('/api/bootstrap', { account: B })).friendRequests.find(row => row.from === A.id);
        expect(pending?.id, 'friend_request_missing');
        success(await request('/api/friends/respond', { account: B, method: 'POST', body: { requestId: pending.id, accept: true } }));
        const created = success(await request('/api/conversations', { account: A, method: 'POST', body: { kind: 'dm', residentId: B.id } }), 201);
        evidence.conversationId = created.conversation.id; await save();
      });
      await check('Account B receives account A direct message through public authenticated SSE', async () => {
        const connection = realtime(B); await connection.wait(item => item.event === 'ready' && item.data.residentId === B.id);
        const sent = success(await request(`/api/conversations/${evidence.conversationId}/messages`, { account: A, method: 'POST', body: { text: 'AbujaLife production persistence acceptance.', idempotencyKey: operationKey() } }), 201);
        evidence.messageId = sent.message.id; await save();
        const delivered = await connection.wait(item => item.event === 'message' && item.data.id === evidence.messageId);
        expect(delivered.data.text === sent.message.text && delivered.data.senderId === A.id, 'realtime_message_identity_mismatch'); connection.close();
      });
      await check('Server-priced furniture, vehicle paint, rented home and career assignment persist', async () => {
        const bootstrap = success(await request('/api/bootstrap', { account: A })), before = bootstrap.profile;
        const plant = bootstrap.catalog.find(item => item.id === 'plant'), car = bootstrap.catalog.find(item => item.id === 'used-hatchback'), home = bootstrap.properties.find(item => item.id === 'lugbe-flat');
        expect(plant && car && home && car.defaultColor && before.wallet >= plant.price + car.price + home.rent + 1550, 'required_catalog_or_starting_balance_missing');
        const furniture = await action(A, 'purchase', { itemId: plant.id, price: 0 });
        expect(furniture.profile.wallet === before.wallet - plant.price && furniture.profile.inventory.includes(plant.id), 'furniture_price_or_ownership_incorrect');
        const vehicle = await action(A, 'purchase', { itemId: car.id, color: car.defaultColor, price: 0 });
        expect(vehicle.profile.wallet === furniture.profile.wallet - car.price && vehicle.profile.vehicleColors[car.id] === car.defaultColor, 'vehicle_price_or_paint_incorrect');
        const rented = await action(A, 'move-home', { propertyId: home.id, tenure: 'rent', rent: 0 });
        expect(rented.profile.wallet === vehicle.profile.wallet - home.rent && rented.profile.home.propertyId === home.id && rented.profile.home.tenure === 'rent', 'rent_price_or_home_incorrect');
        await action(A, 'take-job', { jobId: 'bank-teller' });
        if ((await profile(A)).location.kind === 'home') await action(A, 'leave-home');
        expect((await profile(A)).location.kind === 'public', 'public_location_required');
        evidence.purchaseLedgerReasons = ['purchase', 'Car purchase', 'move-home']; await save();
      });
      await check('Money transfer derives sender identity and credits one durable receipt across retries', async () => {
        const beforeA = await profile(A), beforeB = await profile(B), connections = [realtime(A), realtime(B)];
        try {
          for (const connection of connections) await connection.wait(item => item.event === 'ready');
          const body = { senderId: B.id, from: B.id, userId: B.id, residentId: B.id, conversationId: evidence.conversationId, amount: 1550, note: 'Production QA virtual transfer', idempotencyKey: operationKey() };
          evidence.transferBody = body; await save();
          const granted = success(await request('/api/wallet/transfer', { account: A, method: 'POST', body }));
          const receipt = granted.message;
          expect(receipt?.kind === 'transfer' && receipt.transfer.fromId === A.id && receipt.transfer.toId === B.id && receipt.transfer.amount === 1550, 'server_transfer_receipt_required');
          evidence.transferMessageId = receipt.id; evidence.transferId = granted.transfer.id; await save();
          for (const connection of connections) await connection.wait(item => item.event === 'message' && item.data.id === receipt.id && item.data.kind === 'transfer');
          const replay = success(await request('/api/wallet/transfer', { account: A, method: 'POST', body }));
          expect(replay.replayed === true && replay.message.id === receipt.id, 'transfer_replay_must_not_duplicate');
          expect((await profile(A)).wallet === beforeA.wallet - 1550 && (await profile(B)).wallet === beforeB.wallet + 1550, 'transfer_balance_invariant_failed');
          const acknowledged = await request(`/api/conversations/${evidence.conversationId}/delivered`, { account: B, method: 'POST', body: { uptoSeq: receipt.seq, uptoMessageId: receipt.id } });
          success(acknowledged);
          await connections[0].wait(item => item.event === 'message' && item.data.receipt && item.data.residentId === B.id && item.data.deliveredAt);
        } finally { connections.forEach(connection => connection.close()); }
      });
      await check('Cross-account conversation guesses, cross-origin writes and unauthorized receipts fail', async () => {
        const route = `/api/conversations/${evidence.conversationId}`;
        expect((await request(route + '/messages', { account: C })).status === 404, 'nonmember_read_must_be_denied');
        expect((await request(route + '/messages', { account: C, method: 'POST', body: { text: 'Unauthorized QA message', residentId: A.id, idempotencyKey: operationKey() } })).status === 404, 'nonmember_write_must_be_denied');
        expect((await request(route + '/delivered', { account: C, method: 'POST', body: { uptoSeq: 1 } })).status === 404, 'nonmember_receipt_must_be_denied');
        expect((await request('/api/profile', { account: A, method: 'POST', requestOrigin: 'https://unauthorized.invalid', body: {} })).status === 403, 'cross_origin_write_must_be_denied');
      });
      await check('Refreshing both clients retains messages, wallet balances and ledger history before restart', async () => {
        evidence.expected = {};
        for (const [label, account] of Object.entries(evidence.accounts)) {
          const current = await profile(account); evidence.expected[label] = snapshot(current);
          const wallet = success(await request('/api/wallet', { account })); evidence.expected[label].ledger = wallet.transactions;
          expect(Number.isSafeInteger(current.wallet) && wallet.transactions.length > 0, 'persistent_wallet_and_ledger_required');
        }
        for (const account of [A, B]) {
          const history = success(await request(`/api/conversations/${evidence.conversationId}/messages`, { account }));
          expect(history.messages.some(message => message.id === evidence.messageId) && history.messages.filter(message => message.id === evidence.transferMessageId).length === 1, 'persistent_message_and_receipt_required');
        }
        expect(evidence.expected.A.ledger.some(row => row.amount === -1550) && evidence.expected.B.ledger.some(row => row.amount === 1550), 'both_transfer_ledger_entries_required');
        evidence.stage = 'ready-for-operator-restart'; evidence.beforeCompletedAt = new Date().toISOString(); await save();
      });
    } else {
      const { A, B, C } = evidence.accounts;
      await check('After operator restart, sessions, balances, ledger, inventory, homes, vehicles, careers and locations survive', async () => {
        for (const [label, account] of Object.entries(evidence.accounts)) {
          const current = await profile(account), { ledger, ...expected } = evidence.expected[label];
          expect(equal(snapshot(current), expected), 'player_state_changed_after_restart');
          const wallet = success(await request('/api/wallet', { account }));
          expect(equal(wallet.transactions, ledger), 'wallet_ledger_changed_after_restart');
        }
        for (const account of [A, B]) {
          const history = success(await request(`/api/conversations/${evidence.conversationId}/messages`, { account }));
          expect(history.messages.some(message => message.id === evidence.messageId) && history.messages.filter(message => message.id === evidence.transferMessageId).length === 1, 'messages_or_transfer_receipt_lost_after_restart');
        }
        const replay = success(await request('/api/wallet/transfer', { account: A, method: 'POST', body: evidence.transferBody }));
        expect(replay.replayed === true && replay.message.id === evidence.transferMessageId && replay.profile.wallet === evidence.expected.A.wallet, 'durable_transfer_idempotency_failed');
      });
      await check('All three saved accounts explicitly log in again after restart without losing persisted state', async () => {
        for (const [label, account] of Object.entries(evidence.accounts)) {
          const loggedIn = await request('/api/auth/login', { method: 'POST', body: { username: account.username, password: account.password } });
          success(loggedIn); expect(loggedIn.data.profile.id === account.id, 'saved_login_identity_mismatch');
          account.cookie = sessionCookie(loggedIn.cookie); await save();
          const { ledger, ...expected } = evidence.expected[label];
          expect(equal(snapshot(loggedIn.data.profile), expected), 'saved_login_state_mismatch');
        }
      });
      await check('Public SSE reconnects after backend restart and delivers a new persistent message', async () => {
        const connection = realtime(B);
        try {
          await connection.wait(item => item.event === 'ready' && item.data.residentId === B.id);
          const sent = success(await request(`/api/conversations/${evidence.conversationId}/messages`, { account: A, method: 'POST', body: { text: 'Reconnected after the AbujaLife backend restart.', idempotencyKey: operationKey() } }), 201);
          await connection.wait(item => item.event === 'message' && item.data.id === sent.message.id);
          const history = success(await request(`/api/conversations/${evidence.conversationId}/messages`, { account: B }));
          expect(history.messages.some(message => message.id === sent.message.id), 'reconnected_message_must_persist');
        } finally { connection.close(); }
      });
      await check('Cross-account authorization still denies guessed conversations after restart', async () => {
        expect((await request(`/api/conversations/${evidence.conversationId}/messages`, { account: C })).status === 404, 'nonmember_read_after_restart_must_be_denied');
        expect((await request(`/api/conversations/${evidence.conversationId}/delivered`, { account: C, method: 'POST', body: { uptoSeq: 1 } })).status === 404, 'nonmember_receipt_after_restart_must_be_denied');
      });
      await check('Bilateral blocks deny REST messages, history and wallet transfers after refresh', async () => {
        success(await request('/api/moderation/block', { account: B, method: 'POST', body: { residentId: A.id, blocked: true } }));
        expect((await request(`/api/conversations/${evidence.conversationId}/messages`, { account: A, method: 'POST', body: { text: 'Blocked acceptance message', idempotencyKey: operationKey() } })).status === 403, 'blocked_message_must_be_denied');
        expect((await request(`/api/conversations/${evidence.conversationId}/messages`, { account: A })).status === 403, 'blocked_history_must_be_denied');
        expect((await request('/api/wallet/transfer', { account: A, method: 'POST', body: { residentId: B.id, amount: 1, idempotencyKey: operationKey() } })).status === 403, 'blocked_transfer_must_be_denied');
        expect((await profile(A)).wallet === evidence.expected.A.wallet && (await profile(B)).wallet === evidence.expected.B.wallet, 'blocked_actions_must_not_change_wallets');
      });
      await check('Account session listing, refresh, logout and logout-all invalidate their own durable sessions', async () => {
        const listed = success(await request('/api/auth/sessions', { account: C }));
        expect(listed.sessions.some(session => session.current), 'current_session_must_be_listed');
        const oldCookie = C.cookie, refreshed = await request('/api/auth/refresh', { account: C, method: 'POST', body: {} });
        success(refreshed); C.cookie = sessionCookie(refreshed.cookie); await save();
        expect(C.cookie !== oldCookie && (await request('/api/wallet', { account: { cookie: oldCookie } })).status === 401, 'refresh_must_invalidate_old_session');
        success(await request('/api/auth/logout-all', { account: C, method: 'POST', body: {} }));
        expect((await request('/api/wallet', { account: C })).status === 401, 'logout_all_must_invalidate_session');
        success(await request('/api/auth/logout', { account: A, method: 'POST', body: {} }));
        expect((await request('/api/wallet', { account: A })).status === 401, 'logout_must_invalidate_session');
      });
      evidence.stage = 'after-complete'; evidence.afterCompletedAt = new Date().toISOString(); await save();
    }
    const report = { ok: true, phase, checks: checks.length, passed: checks, api, publicTlsAndHostnameValidated: true, realtime: 'authenticated SSE over HTTPS', persistenceComparison: phase === 'after' ? 'passed after operator-controlled backend restart' : 'expected state saved; operator must restart only AbujaLife and run after', limitations };
    await privateWrite(path.join(directory, `${phase}-report.json`), report);
    console.log(JSON.stringify({ ok: true, phase, checks: checks.length, realtime: 'SSE over HTTPS', next: phase === 'before' ? 'Restart only AbujaLife through its service control, then run --phase after with the same evidence directory.' : 'Public API acceptance phases passed; verify server infrastructure and Hostinger browser separately.' }));
    return report;
  } catch (error) {
    const code = error instanceof AcceptanceError ? error.code : 'public_acceptance_failed';
    const report = { ok: false, phase, checks: checks.length, passed: checks, failedCheck: activeCheck || 'configuration or evidence', code, limitations };
    await privateWrite(path.join(directory, `${phase}-report.json`), report).catch(() => {});
    console.error(JSON.stringify({ ok: false, phase, checks: checks.length, failedCheck: report.failedCheck, code }));
    return report;
  } finally { for (const connection of [...streams]) connection.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), index = args.indexOf('--phase');
    expect(index >= 0 && args.length === 2 && index === 0, 'usage_requires_phase_before_or_after');
    const report = await runPublicAcceptance({ phase: args[index + 1] });
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: error instanceof AcceptanceError ? error.code : 'public_acceptance_configuration_failed' }));
    process.exitCode = 1;
  }
}

import { ORIGIN_META } from '../shared/origins.mjs';
import { GameError } from './errors.mjs';

const DEFAULT_BALANCES = Object.freeze(Object.fromEntries(ORIGIN_META.options.map(option => [option.id, option.startingBalance])));
const BALANCE_KEYS = Object.freeze({ nepo: 'nepoStartingBalance', lapo: 'lapoStartingBalance' });
const CACHE_MS = 5_000;
const fail = (condition, message, status = 400, code = 'invalid_admin_action') => { if (!condition) throw new GameError(message, status, code); };
const validBalance = value => Number.isSafeInteger(value) && value >= 0;

function normalizedSettings(value = {}) {
  return {
    registrationOpen: value.registrationOpen !== false,
    maintenance: value.maintenance === true,
    gameTopupsEnabled: false,
    nepoStartingBalance: validBalance(value.nepoStartingBalance) ? value.nepoStartingBalance : DEFAULT_BALANCES.nepo,
    lapoStartingBalance: validBalance(value.lapoStartingBalance) ? value.lapoStartingBalance : DEFAULT_BALANCES.lapo,
  };
}

function applyBalances(settings) {
  for (const option of ORIGIN_META.options) {
    const key = BALANCE_KEYS[option.id];
    if (key && validBalance(settings[key])) option.startingBalance = settings[key];
  }
}

/**
 * Adds persistent starting-balance controls without introducing a business cap.
 * Number.MAX_SAFE_INTEGER remains the representation boundary so every Naira
 * stays exact. A short per-process cache keeps registration hot while allowing
 * multiple API instances to converge on an admin change within seconds.
 */
export async function attachOriginEconomySettings({ admin, store } = {}) {
  fail(admin?.collection && admin?.store?.transaction && store?.register, 'Origin economy settings require production stores', 500, 'origin_settings_unavailable');
  let cached = null, cachedAt = 0;

  const read = async ({ session = null, force = false } = {}) => {
    const now = Date.now();
    if (!session && !force && cached && now - cachedAt < CACHE_MS) return cached;
    const row = await admin.collection('admin_settings').findOne({ _id: 'game' }, session ? { session } : {});
    const settings = normalizedSettings(row?.value || {});
    applyBalances(settings);
    if (!session) { cached = settings; cachedAt = now; }
    return settings;
  };

  admin.publicSettings = async () => read();

  admin.saveSettings = async (id, body) => {
    fail(body && typeof body === 'object' && !Array.isArray(body), 'Use game settings');
    const allowed = new Set(['registrationOpen', 'maintenance', 'gameTopupsEnabled', 'nepoStartingBalance', 'lapoStartingBalance']);
    fail(Object.keys(body).every(field => allowed.has(field)), 'Choose supported game settings');
    for (const key of ['registrationOpen', 'maintenance', 'gameTopupsEnabled']) if (body[key] !== undefined) fail(typeof body[key] === 'boolean', 'Use boolean game settings');
    fail(body.gameTopupsEnabled !== true, 'Free game top-ups are disabled in production', 403, 'topup_disabled');
    for (const key of ['nepoStartingBalance', 'lapoStartingBalance']) if (body[key] !== undefined) fail(validBalance(body[key]), 'Starting balance must be an exact non-negative whole Naira amount');

    let settings;
    await admin.store.transaction(async session => {
      await admin.requirePermission(id, 'settings', { session });
      const old = await read({ session, force: true });
      settings = normalizedSettings({ ...old, ...body, gameTopupsEnabled: false });
      await admin.collection('admin_settings').updateOne(
        { _id: 'game' },
        { $set: { value: settings, updatedAt: admin.clock() } },
        { session, upsert: true }
      );
      await admin.record(id, 'update-game-settings', null, settings, { session });
    });
    applyBalances(settings);
    cached = settings;
    cachedAt = Date.now();
    return { ok: true, settings };
  };

  const register = store.register.bind(store);
  store.register = async body => {
    await read();
    return register(body);
  };

  await read({ force: true });
  return { refresh: () => read({ force: true }) };
}

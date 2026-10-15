import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { connectMongo } from '../src/server/mongo/database.mjs';
import { MongoGameStore } from '../src/server/mongo/gameStore.mjs';
import { dealMoments, momentsView, MOMENT_TEMPLATES } from '../src/shared/city-moments.mjs';
import { GIG_RULES } from '../src/shared/street-gigs.mjs';

const configFile = process.env.TEST_MONGODB_CONFIG, config = configFile ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
const uri = process.env.TEST_MONGODB_URI || config.uri, database = process.env.TEST_MONGODB_DATABASE || config.database || 'abujalife_prod';
const integration = (name, fn) => test(name, { skip: !uri ? 'Requires TEST_MONGODB_URI or TEST_MONGODB_CONFIG for a real replica set' : false }, fn);
const at = (date, hour) => Date.parse(`${date}T${String(hour).padStart(2, '0')}:30:00+01:00`), key = () => crypto.randomUUID();

integration('Mongo: City Moments progress from real gigs, persist in progression and pay once through the ledger', async t => {
  const connection = await connectMongo({ uri, database, production: true }); t.after(() => connection.close());
  let now = at('2026-10-14', 8);
  const store = new MongoGameStore({ ...connection, clock: () => now, originRandomInt: (min, max) => max === 2 ? 1 : 0 });
  const { residentId: id } = await store.register({ username: `moment_${crypto.randomBytes(5).toString('hex')}`, displayName: 'Moment', password: 'secure-test-password' });
  await store.action(id, 'leave-home');
  const profile = await store.profile(id), candidates = [];
  for (let day = 12; day <= 30; day++) for (const hour of [8, 17]) candidates.push(at(`2026-10-${day}`, hour));
  now = candidates.find(when => dealMoments(profile, when).some(m => m.templateId === 'rush-hour')); assert.ok(now);
  for (let i = 0; i < 2; i++) {
    const g = (await store.action(id, 'gig-offer')).gigs.gig; await store.action(id, 'gig-accept', { gigId: g.id }); now += GIG_RULES.minLegMs;
    await store.action(id, 'gig-pickup', { gigId: g.id }); now += GIG_RULES.minLegMs; await store.action(id, 'gig-complete', { gigId: g.id, idempotencyKey: key() }); now += GIG_RULES.cooldownMs;
  }
  const moment = momentsView(await store.profile(id), now).moments.find(m => m.templateId === 'rush-hour');
  assert.ok(moment?.done, 'progress persisted in the progression collection');
  const before = (await store.profile(id)).wallet, claimKey = key(), reward = MOMENT_TEMPLATES.find(m => m.id === 'rush-hour').naira;
  const claimed = await store.action(id, 'moment-claim', { momentId: moment.id, idempotencyKey: claimKey });
  assert.equal(claimed.profile.wallet, before + reward);
  assert.equal((await store.action(id, 'moment-claim', { momentId: moment.id, idempotencyKey: claimKey })).replayed, true);
  await assert.rejects(store.action(id, 'moment-claim', { momentId: moment.id, idempotencyKey: key() }), error => error.code === 'moment_claimed');
  assert.equal((await store.profile(id)).wallet, before + reward, 'paid exactly once');
  const row = await connection.db.collection('progression').findOne({ residentId: id });
  assert.equal(row.moments.list.find(m => m.id === moment.id).claimed, true);
});

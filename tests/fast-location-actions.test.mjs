import test from 'node:test';
import assert from 'node:assert/strict';
import { installFastLocationActions } from '../src/server/fastLocationActions.mjs';

function fixture({ activeTrip = null, location = { kind: 'home', district: 'jabi-a03', venue: 'home' } } = {}) {
  const now = 1_800_000;
  const state = {
    player_state: {
      _id: 'resident-a', residentId: 'resident-a', district: 'jabi-a03', location,
      activeTrip, drivingVehicle: null,
    },
    needs: {
      _id: 'resident-a', residentId: 'resident-a', energy: 80, hunger: 70, social: 60,
      lastActionAt: now - 10 * 60_000,
    },
  };
  const touched = [];
  const emitted = [];
  const delegated = [];
  const clone = value => structuredClone(value);
  const matches = (row, query = {}) => Object.entries(query).every(([key, value]) => {
    if (key === 'location.kind') return row.location?.kind === value;
    return (row[key] ?? null) === value;
  });
  const store = {
    clock: () => now,
    async transaction(fn) { return fn({ id: 'session-a' }); },
    collection(name) {
      const row = state[name];
      if (!row) throw new Error(`Unexpected collection ${name}`);
      return {
        async findOne(query) {
          touched.push(['findOne', name]);
          return matches(row, query) ? clone(row) : null;
        },
        async updateOne(query, update) {
          touched.push(['updateOne', name]);
          if (!matches(row, query)) return { matchedCount: 0, modifiedCount: 0 };
          Object.assign(row, clone(update.$set || {}));
          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
    },
    async profile(id) {
      touched.push(['profile', id]);
      return {
        id,
        district: state.player_state.district,
        location: clone(state.player_state.location),
        activeTrip: state.player_state.activeTrip,
        drivingVehicle: state.player_state.drivingVehicle,
        energy: state.needs.energy,
        hunger: state.needs.hunger,
        social: state.needs.social,
        lastActionAt: state.needs.lastActionAt,
      };
    },
    async emitUser(id, type, data) { emitted.push({ id, type, data: clone(data) }); },
    async action(id, action, payload) {
      delegated.push({ id, action, payload: clone(payload) });
      return { ok: true, delegated: true };
    },
  };
  return { store, state, touched, emitted, delegated, now };
}

test('leave-home is a bounded player-state transition instead of the generic economy action', async () => {
  const f = fixture();
  installFastLocationActions(f.store);

  const result = await f.store.action('resident-a', 'leave-home', { idempotencyKey: 'outside-1' });

  assert.equal(result.ok, true);
  assert.equal(result.fastLocation, true);
  assert.equal(result.replayed, false);
  assert.equal(result.profile.location.kind, 'public');
  assert.equal(result.profile.location.venue, 'neighbourhood');
  assert.equal(f.state.player_state.location.kind, 'public');
  assert.equal(f.state.player_state.drivingVehicle, null);
  assert.equal(f.delegated.length, 0, 'leave-home must bypass the heavyweight generic action path');

  // Ten minutes of normal needs decay must be preserved exactly enough for the
  // same rounded public profile values as the generic action path.
  assert.equal(f.state.needs.energy, 79);
  assert.equal(f.state.needs.hunger, 69);
  assert.equal(f.state.needs.social, 60);
  assert.equal(f.state.needs.lastActionAt, f.now);

  assert.deepEqual(f.touched.filter(([kind]) => kind !== 'profile').map(([, name]) => name), [
    'player_state', 'needs', 'player_state', 'needs',
  ]);
  assert.equal(f.emitted.length, 1);
  assert.equal(f.emitted[0].type, 'profile');
  assert.equal(f.emitted[0].data.profile.location.kind, 'public');
});

test('leave-home retry after a committed mobile response loss is idempotent', async () => {
  const f = fixture({ location: { kind: 'public', district: 'jabi-a03', venue: 'neighbourhood' } });
  installFastLocationActions(f.store);

  const result = await f.store.action('resident-a', 'leave-home', {});

  assert.equal(result.ok, true);
  assert.equal(result.fastLocation, true);
  assert.equal(result.replayed, true);
  assert.equal(result.profile.location.kind, 'public');
  assert.equal(f.touched.some(([kind]) => kind === 'updateOne'), false, 'a replay must not rewrite state');
  assert.equal(f.emitted.length, 0, 'a replay must not duplicate realtime profile events');
});

test('active travel still blocks leaving home and unrelated actions delegate unchanged', async () => {
  const blocked = fixture({ activeTrip: { id: 'trip-a' } });
  installFastLocationActions(blocked.store);
  await assert.rejects(
    blocked.store.action('resident-a', 'leave-home', {}),
    error => error?.code === 'trip_in_progress' && error?.status === 409,
  );

  const ordinary = fixture();
  installFastLocationActions(ordinary.store);
  const result = await ordinary.store.action('resident-a', 'sleep', { amount: 0 });
  assert.deepEqual(result, { ok: true, delegated: true });
  assert.deepEqual(ordinary.delegated, [{ id: 'resident-a', action: 'sleep', payload: { amount: 0 } }]);
});

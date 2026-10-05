import test from 'node:test';
import assert from 'node:assert/strict';
import { createCityStats } from '../src/server/cityStats.mjs';

test('city stats expose real online counts, today visits and venue hotspots', async () => {
  const now = Date.parse('2026-10-05T20:00:00+01:00');
  const presence = {
    zone: async () => 'venue:jabi:gym',
  };
  const store = {
    clock: () => now,
    auth: { hashToken: token => `hash:${token}` },
    presence,
    collection(name) {
      if (name === 'residents') return { countDocuments: async () => 12000 };
      if (name === 'admin_settings') return {
        findOne: async () => ({ _id:'city-traffic', visitsAllTime:54321, visitDays:{ '2026-10-05':7321 }, trackingSince:now-86400000 }),
        updateOne: async () => ({ modifiedCount:1 }),
      };
      if (name === 'sessions') return { updateOne: async () => ({ modifiedCount:1 }) };
      if (name === 'presence_sessions') return {
        aggregate(pipeline) {
          const serialized=JSON.stringify(pipeline);
          if (serialized.includes('"$sort"')) return { toArray: async () => [
            { _id:'venue:wuse-ii-a07:club', online:42 },
            { _id:'venue:jabi:gym', online:18 },
            { _id:'venue:central-area:mosque', online:11 },
          ] };
          if (serialized.includes('"zone":"venue:jabi:gym"')) return { toArray: async () => [{ count:18 }] };
          return { toArray: async () => [{ count:133 }] };
        },
      };
      throw new Error(`Unexpected collection ${name}`);
    },
  };

  const stats=createCityStats(store,{globalCacheMs:0,zoneCacheMs:0});
  const result=await stats.snapshot('resident-1');
  assert.equal(result.onlineNow,133);
  assert.equal(result.totalPlayers,12000);
  assert.equal(result.visitsToday,7321);
  assert.equal(result.hereNow,18);
  assert.deepEqual(result.hotPlaces[0],{district:'wuse-ii-a07',venueId:'club',zone:'venue:wuse-ii-a07:club',online:42});
  assert.equal(result.hotPlaces.length,3);
});

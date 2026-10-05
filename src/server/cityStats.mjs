const VISIT_WINDOW_MS = 30 * 60 * 1000;
const GLOBAL_CACHE_MS = 4000;
const ZONE_CACHE_MS = 2500;
const STATS_ID = 'city-traffic';
const HOT_PLACE_LIMIT = 8;

export function abujaDateKey(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function countFrom(rows) {
  return Number(rows?.[0]?.count || 0);
}

function parseVenueZone(zone) {
  const match = /^venue:([^:]+):(.+)$/.exec(String(zone || ''));
  if (!match) return null;
  return { district: match[1], venueId: match[2] };
}

export function createCityStats(store, { globalCacheMs = GLOBAL_CACHE_MS, zoneCacheMs = ZONE_CACHE_MS } = {}) {
  let globalCache = null;
  const zoneCache = new Map();

  async function recordVisit(token, residentId) {
    if (!token || !residentId || typeof store.auth?.hashToken !== 'function') return false;
    const now = store.clock();
    const bucket = Math.floor(now / VISIT_WINDOW_MS);
    const sessionId = store.auth.hashToken(token);
    const session = await store.collection('sessions').updateOne(
      { _id: sessionId, residentId, cityVisitBucket: { $ne: bucket } },
      { $set: { cityVisitBucket: bucket, lastCityVisitAt: now } },
    );
    if (session.modifiedCount !== 1) return false;

    const day = abujaDateKey(now);
    await store.collection('admin_settings').updateOne(
      { _id: STATS_ID },
      {
        $inc: { visitsAllTime: 1, [`visitDays.${day}`]: 1 },
        $setOnInsert: { trackingSince: now },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );
    globalCache = null;
    return true;
  }

  async function globalSnapshot() {
    const now = store.clock();
    if (globalCache && now - globalCache.at < globalCacheMs) return globalCache.value;
    const day = abujaDateKey(now);
    const [onlineRows, totalPlayers, traffic, hotZoneRows] = await Promise.all([
      store.collection('presence_sessions').aggregate([
        { $match: { expiresAt: { $gt: new Date(now) } } },
        { $group: { _id: '$residentId' } },
        { $count: 'count' },
      ]).toArray(),
      store.collection('residents').countDocuments({}),
      store.collection('admin_settings').findOne({ _id: STATS_ID }),
      store.collection('presence_sessions').aggregate([
        { $match: { zone: /^venue:/, presenceVisible: { $ne: false }, expiresAt: { $gt: new Date(now) } } },
        { $group: { _id: { zone: '$zone', residentId: '$residentId' } } },
        { $group: { _id: '$_id.zone', online: { $sum: 1 } } },
        { $sort: { online: -1, _id: 1 } },
        { $limit: HOT_PLACE_LIMIT },
      ]).toArray(),
    ]);
    const hotPlaces = hotZoneRows.flatMap(row => {
      const parsed = parseVenueZone(row._id);
      return parsed ? [{ ...parsed, zone: row._id, online: Number(row.online || 0) }] : [];
    });
    const value = {
      onlineNow: countFrom(onlineRows),
      totalPlayers: Number(totalPlayers || 0),
      visitsToday: Number(traffic?.visitDays?.[day] || 0),
      visitsAllTime: Number(traffic?.visitsAllTime || 0),
      trackingSince: Number(traffic?.trackingSince || now),
      hotPlaces,
    };
    globalCache = { at: now, value };
    return value;
  }

  async function hereNow(residentId) {
    const now = store.clock();
    const zone = await store.presence.zone(residentId);
    const cached = zoneCache.get(zone);
    if (cached && now - cached.at < zoneCacheMs) return cached.count;
    const rows = await store.collection('presence_sessions').aggregate([
      { $match: { zone, presenceVisible: { $ne: false }, expiresAt: { $gt: new Date(now) } } },
      { $group: { _id: '$residentId' } },
      { $count: 'count' },
    ]).toArray();
    const count = countFrom(rows);
    zoneCache.set(zone, { at: now, count });
    if (zoneCache.size > 250) {
      for (const [key, entry] of zoneCache) if (now - entry.at > zoneCacheMs * 4) zoneCache.delete(key);
    }
    return count;
  }

  async function snapshot(residentId) {
    const [global, local] = await Promise.all([globalSnapshot(), hereNow(residentId)]);
    return { ...global, hereNow: local };
  }

  return { recordVisit, globalSnapshot, snapshot };
}

export const CITY_STATS_META = Object.freeze({ visitWindowMs: VISIT_WINDOW_MS, hotPlaceLimit: HOT_PLACE_LIMIT });

import crypto from 'node:crypto';
import { GameError } from '../errors.mjs';

const EVENT_TTL_MS = 2 * 60 * 1000;
const MAX_EVENT_BYTES = 64 * 1024;
const identifier = (value, label) => {
  const text = String(value ?? '');
  if (!text || text.length > 180) throw new GameError(label || 'Invalid realtime target', 400, 'invalid_realtime_target');
  return text;
};

/**
 * Mongo change streams turn realtime fan-out into a cluster-wide concern rather
 * than a single Node process concern. Every API instance only holds its own SSE
 * sockets; events cross instances through this short-lived collection.
 */
export class MongoRealtimeBroker {
  constructor({ db, clock = Date.now, log = () => {} } = {}) {
    if (!db) throw new TypeError('Realtime broker requires MongoDB');
    this.db = db;
    this.clock = clock;
    this.log = log;
    this.handlers = new Set();
    this.stream = null;
    this.closed = false;
    this.instanceId = crypto.randomUUID();
  }

  collection() { return this.db.collection('realtime_events'); }

  async init() {
    await Promise.all([
      this.collection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.collection().createIndex({ kind: 1, userId: 1, createdAt: -1 }),
      this.collection().createIndex({ kind: 1, zone: 1, createdAt: -1 }),
    ]);
    try {
      this.stream = this.collection().watch(
        [{ $match: { operationType: 'insert' } }],
        { fullDocument: 'updateLookup', maxAwaitTimeMS: 10000 }
      );
      this.stream.on('change', change => this.dispatch(change.fullDocument));
      this.stream.on('error', error => this.log('realtime_broker_error', { code: error?.codeName || error?.code || 'change_stream_error' }));
    } catch (error) {
      this.log('realtime_broker_error', { code: error?.codeName || error?.code || 'change_stream_start_failed' });
      throw error;
    }
    return this;
  }

  subscribe(handler) {
    if (typeof handler !== 'function') throw new TypeError('Realtime handler must be a function');
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  dispatch(document) {
    if (!document || this.closed) return;
    for (const handler of this.handlers) {
      Promise.resolve(handler(document)).catch(error => this.log('realtime_dispatch_error', { code: error?.code || 'dispatch_failed' }));
    }
  }

  async publish(document) {
    if (this.closed) return false;
    const now = this.clock();
    const row = {
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      instanceId: this.instanceId,
      createdAt: now,
      expiresAt: new Date(now + EVENT_TTL_MS),
      ...document,
    };
    const bytes = Buffer.byteLength(JSON.stringify(row.data ?? null), 'utf8');
    if (bytes > MAX_EVENT_BYTES) throw new GameError('Realtime event is too large', 413, 'realtime_event_too_large');
    await this.collection().insertOne(row);
    return true;
  }

  publishUser(userId, event, data, { senderId = null } = {}) {
    return this.publish({ kind: 'user', userId: identifier(userId), event: identifier(event, 'Invalid realtime event'), data, senderId: senderId ? identifier(senderId) : null });
  }

  publishZone(zone, event, data, { senderId = null } = {}) {
    return this.publish({ kind: 'zone', zone: identifier(zone), event: identifier(event, 'Invalid realtime event'), data, senderId: senderId ? identifier(senderId) : null });
  }

  async close() {
    this.closed = true;
    this.handlers.clear();
    if (this.stream) await this.stream.close().catch(() => {});
    this.stream = null;
  }
}

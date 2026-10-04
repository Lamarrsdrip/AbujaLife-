import { GameError } from './gameStore.mjs';

const valid = (ok, message) => { if (!ok) throw new GameError(message); };
const encode = row => row ? Buffer.from(JSON.stringify([row.created_at, row.id])).toString('base64url') : null;
function decode(value) {
  if (!value) return null;
  try {
    valid(typeof value === 'string' && value.length < 512, 'Invalid page cursor');
    const [at, id] = JSON.parse(Buffer.from(value, 'base64url').toString());
    valid(Number.isSafeInteger(at) && typeof id === 'string' && id.length > 0 && id.length <= 80, 'Invalid page cursor');
    return [at, id];
  } catch { throw new GameError('Invalid page cursor'); }
}
const count = n => Math.max(1, Math.min(100, Number.isSafeInteger(Number(n)) ? Number(n) : 40));
const visible = alias => `NOT EXISTS (SELECT 1 FROM moderation b WHERE b.kind='block' AND ((b.owner=? AND b.target=${alias}) OR (b.target=? AND b.owner=${alias})))`;

// Page size bounds each response, not the number of residents or saved messages.
export class ResidentDirectory {
  constructor(store) {
    this.store = store;
    store.db.exec(`CREATE INDEX IF NOT EXISTS residents_directory ON residents(created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS messages_history ON messages(conversation_id,created_at DESC,id DESC);
      CREATE VIRTUAL TABLE IF NOT EXISTS resident_directory_search USING fts5(username,display_name);
      CREATE TRIGGER IF NOT EXISTS resident_search_insert AFTER INSERT ON residents BEGIN
        INSERT INTO resident_directory_search(rowid,username,display_name) VALUES(new.rowid,new.username,json_extract(new.profile,'$.displayName'));
      END;
      CREATE TRIGGER IF NOT EXISTS resident_search_update AFTER UPDATE ON residents
      WHEN old.username<>new.username OR json_extract(old.profile,'$.displayName')<>json_extract(new.profile,'$.displayName') BEGIN
        DELETE FROM resident_directory_search WHERE rowid=old.rowid;
        INSERT INTO resident_directory_search(rowid,username,display_name) VALUES(new.rowid,new.username,json_extract(new.profile,'$.displayName'));
      END;
      CREATE TRIGGER IF NOT EXISTS resident_search_delete AFTER DELETE ON residents BEGIN
        DELETE FROM resident_directory_search WHERE rowid=old.rowid;
      END;
      INSERT INTO resident_directory_search(rowid,username,display_name)
      SELECT r.rowid,r.username,json_extract(r.profile,'$.displayName') FROM residents r
      WHERE NOT EXISTS(SELECT 1 FROM resident_directory_search f WHERE f.rowid=r.rowid);`);
  }
  people(id, {q = '', cursor, limit} = {}) {
    const store = this.store, page = decode(cursor), size = count(limit);
    q = String(q).trim().slice(0, 80);
    const clauses = ['r.id<>?', visible('r.id')], args = [id, id, id];
    if (q) {
      const tokens = q.match(/[\p{L}\p{N}]+/gu) || [];
      if (!tokens.length) return {ok:true, people:[], nextCursor:null};
      clauses.push('r.rowid IN (SELECT rowid FROM resident_directory_search WHERE resident_directory_search MATCH ?)');
      args.push(tokens.map(token => `"${token}"*`).join(' AND '));
    }
    if (page) { clauses.push('(r.created_at<? OR (r.created_at=? AND r.id<?))'); args.push(page[0], page[0], page[1]); }
    const rows = store.all(`SELECT r.id,r.created_at FROM residents r WHERE ${clauses.join(' AND ')} ORDER BY r.created_at DESC,r.id DESC LIMIT ?`, ...args, size + 1);
    const hasMore = rows.length > size, selected = rows.slice(0, size);
    return {ok: true, people: selected.map(row => store.resident(id, row.id)), nextCursor: hasMore ? encode(selected.at(-1)) : null};
  }
  messages(id, conversationId, {cursor, limit} = {}) {
    const store = this.store, page = decode(cursor), size = count(limit);
    store.conversationAccess(id, conversationId);
    store.readConversation(id, conversationId);
    const clauses = ['m.conversation_id=?', visible('m.sender_id')], args = [conversationId, id, id];
    if (page) { clauses.push('(m.created_at<? OR (m.created_at=? AND m.id<?))'); args.push(page[0], page[0], page[1]); }
    const rows = store.all(`SELECT m.* FROM messages m WHERE ${clauses.join(' AND ')} ORDER BY m.created_at DESC,m.id DESC LIMIT ?`, ...args, size + 1);
    const hasMore = rows.length > size, selected = rows.slice(0, size);
    return {ok: true, conversation: store.conversation(id, conversationId), messages: selected.slice().reverse().map(row => store.messageView(row)), nextCursor: hasMore ? encode(selected.at(-1)) : null};
  }
}

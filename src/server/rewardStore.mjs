import crypto from 'node:crypto';
import { GameError } from './errors.mjs';

const uid = () => crypto.randomUUID();
const DEFAULT_ID = 'share-abuja-life';
const DEFAULT_REWARD = 100000;
const SESSION_TTL = 15 * 60 * 1000;
const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const check = (condition, message, status = 400, code = 'invalid_request') => { if (!condition) throw new GameError(message, status, code); };

/** SQLite reward engine. Reward amounts are read from the server campaign row and
 * settlement runs inside GameStore.economyOperation, so the normal wallet ledger
 * remains the only source of Game Naira credits. */
export class RewardStore {
  constructor({ store, admin, clock = () => store.clock(), publicWebUrl = 'https://abujacity.life' } = {}) {
    check(store?.db && store.transaction && store.economyOperation, 'Reward storage is unavailable', 500, 'rewards_unavailable');
    this.store = store; this.admin = admin; this.clock = clock; this.publicWebUrl = publicWebUrl.replace(/\/$/, '');
    this.store.db.exec(`CREATE TABLE IF NOT EXISTS reward_campaigns(
      id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,reward_amount INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,start_at INTEGER,end_at INTEGER,max_claims INTEGER NOT NULL DEFAULT 1,
      share_text TEXT NOT NULL,share_url TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS reward_share_sessions(
      id TEXT PRIMARY KEY,resident_id TEXT NOT NULL,campaign_id TEXT NOT NULL,reward_amount INTEGER NOT NULL,
      share_text TEXT NOT NULL,share_url TEXT NOT NULL,expires_at INTEGER NOT NULL,status TEXT NOT NULL,
      created_at INTEGER NOT NULL,completed_at INTEGER);
      CREATE TABLE IF NOT EXISTS reward_claims(
      id TEXT PRIMARY KEY,resident_id TEXT NOT NULL,campaign_id TEXT NOT NULL,share_session_id TEXT NOT NULL,
      reward_amount INTEGER NOT NULL,created_at INTEGER NOT NULL,UNIQUE(campaign_id,resident_id),UNIQUE(campaign_id,share_session_id));
      CREATE INDEX IF NOT EXISTS reward_sessions_resident ON reward_share_sessions(resident_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS reward_claims_resident ON reward_claims(resident_id,created_at DESC);
      CREATE TABLE IF NOT EXISTS reward_activity_definitions(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,venue_id TEXT,reward_amount INTEGER NOT NULL,duration_ms INTEGER NOT NULL,cooldown_ms INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS reward_activity_sessions(id TEXT PRIMARY KEY,resident_id TEXT NOT NULL,activity_id TEXT NOT NULL,started_at INTEGER NOT NULL,ready_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,status TEXT NOT NULL,completed_at INTEGER);
      CREATE TABLE IF NOT EXISTS reward_activity_claims(id TEXT PRIMARY KEY,resident_id TEXT NOT NULL,activity_id TEXT NOT NULL,session_id TEXT NOT NULL,reward_amount INTEGER NOT NULL,created_at INTEGER NOT NULL,UNIQUE(resident_id,session_id));`);
    const now = this.clock();
    this.store.run(`INSERT OR IGNORE INTO reward_campaigns
      (id,title,description,reward_amount,enabled,start_at,end_at,max_claims,share_text,share_url,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, DEFAULT_ID, 'Share AbujaLife', 'Share AbujaLife with your people.', DEFAULT_REWARD, 1, null, null, 1,
      'I am building my life in AbujaLife 👀 Join me in AbujaLife. 🏙️ abujacity.life', `${this.publicWebUrl}/`, now, now);
    this.store.run(`INSERT OR IGNORE INTO reward_activity_definitions VALUES(?,?,?,?,?,?,?,?)`, 'gym-workout', 'Gym workout', 'Complete a focused workout at Neighbourhood Fitness.', 'gym', 5000, 5 * 60 * 1000, 60 * 60 * 1000, 1);
  }
  campaignRow(id = DEFAULT_ID) { return this.store.get('SELECT * FROM reward_campaigns WHERE id=?', id); }
  active(row, now = this.clock()) { return row && row.enabled === 1 && (row.start_at == null || now >= row.start_at) && (row.end_at == null || now <= row.end_at); }
  view(row, claimed = false) { return { id: row.id, title: row.title, description: row.description, rewardGameNaira: row.reward_amount, maxClaims: row.max_claims, shareText: row.share_text, shareUrl: row.share_url, startsAt: row.start_at, endsAt: row.end_at, enabled: row.enabled === 1, claimed }; }
  campaigns(residentId) {
    const rows = this.store.all('SELECT * FROM reward_campaigns ORDER BY created_at ASC');
    return { ok: true, campaigns: rows.map(row => this.view(row, Boolean(residentId && this.store.get('SELECT id FROM reward_claims WHERE campaign_id=? AND resident_id=?', row.id, residentId)))) };
  }
  async earnOverview(residentId) {
    const profile = this.store.profile(residentId), activities = this.store.all('SELECT * FROM reward_activity_definitions WHERE enabled=1').map(row => ({ id: row.id, title: row.title, description: row.description, venueId: row.venue_id, rewardGameNaira: row.reward_amount, durationMs: row.duration_ms, cooldownMs: row.cooldown_ms }));
    return { ok: true, balance: profile.wallet, jobs: this.store.publicJobs(), activities, campaigns: this.campaigns(residentId).campaigns, recommendations: [{ type: 'job', title: 'Complete a job shift', rewardHint: 'Career payout' }, { type: 'activity', title: activities[0]?.title || 'Explore a venue', rewardGameNaira: activities[0]?.rewardGameNaira || 5000 }, { type: 'share', title: 'Share AbujaLife', rewardGameNaira: this.campaignRow()?.reward_amount || DEFAULT_REWARD }] };
  }
  async startActivity(residentId, body = {}) {
    const activityId = clean(body.activityId, 80), row = this.store.get('SELECT * FROM reward_activity_definitions WHERE id=? AND enabled=1', activityId); check(row, 'Choose an available activity', 404, 'activity_not_found'); const profile = this.store.profile(residentId); check(!row.venue_id || profile.location?.venue === row.venue_id, 'Be inside the activity venue before starting', 409, 'activity_location_required'); const now = this.clock(); const last = this.store.get('SELECT created_at FROM reward_activity_claims WHERE resident_id=? AND activity_id=? ORDER BY created_at DESC LIMIT 1', residentId, activityId); check(!last || now - last.created_at >= row.cooldown_ms, 'Try a different activity for a while; this reward is cooling down', 409, 'activity_cooldown'); const session = { id: uid(), resident_id: residentId, activity_id: activityId, started_at: now, ready_at: now + row.duration_ms, expires_at: now + row.duration_ms + 10 * 60 * 1000, status: 'started', completed_at: null }; this.store.run('INSERT INTO reward_activity_sessions VALUES(?,?,?,?,?,?,?,?)', session.id, session.resident_id, session.activity_id, session.started_at, session.ready_at, session.expires_at, session.status, session.completed_at); return { ok: true, activity: { id: row.id, title: row.title, rewardGameNaira: row.reward_amount, readyAt: session.ready_at, expiresAt: session.expires_at }, activitySessionId: session.id };
  }
  async completeActivity(residentId, body = {}) {
    const sessionId = clean(body.activitySessionId, 80), session = this.store.get('SELECT * FROM reward_activity_sessions WHERE id=? AND resident_id=?', sessionId, residentId); check(session, 'Activity session was not found', 404, 'activity_session_not_found'); const key = `activity-reward-${session.id}`; return this.store.economyOperation(residentId, 'activity-reward', { idempotencyKey: key }, { activityId: session.activity_id, activitySessionId: session.id }, (profile, timestamp) => { const current = this.store.get('SELECT * FROM reward_activity_sessions WHERE id=? AND resident_id=?', session.id, residentId); check(current?.status === 'started', 'This activity has already been settled', 409, 'activity_already_settled'); check(timestamp >= current.ready_at, 'Keep going until the activity is complete', 409, 'activity_not_complete'); check(timestamp <= current.expires_at, 'This activity session has expired', 409, 'activity_expired'); const row = this.store.get('SELECT * FROM reward_activity_definitions WHERE id=? AND enabled=1', current.activity_id); check(row, 'This activity is no longer available', 409, 'activity_unavailable'); const claim = { id: uid(), resident_id: residentId, activity_id: row.id, session_id: current.id, reward_amount: row.reward_amount, created_at: timestamp }; this.store.run('UPDATE reward_activity_sessions SET status=?,completed_at=? WHERE id=?', 'completed', timestamp, current.id); this.store.run('INSERT INTO reward_activity_claims VALUES(?,?,?,?,?,?)', claim.id, claim.resident_id, claim.activity_id, claim.session_id, claim.reward_amount, claim.created_at); profile.wallet += row.reward_amount; return { activityClaim: { id: claim.id, activityId: row.id, rewardGameNaira: row.reward_amount, createdAt: timestamp }, rewardGameNaira: row.reward_amount, ledgerReason: `activity_reward · ${row.title}` }; });
  }
  async start(residentId, body = {}) {
    const campaignId = clean(body.campaignId || DEFAULT_ID, 80); check(/^[A-Za-z0-9_-]{1,80}$/.test(campaignId), 'Choose a valid earn campaign');
    const now = this.clock(), row = this.campaignRow(campaignId); check(this.active(row, now), 'This earn campaign is not available right now', 409, 'campaign_unavailable');
    const previous = this.store.get('SELECT * FROM reward_claims WHERE campaign_id=? AND resident_id=?', campaignId, residentId);
    if (previous) return { ok: true, claimed: true, claim: this.claimView(previous), campaign: this.view(row, true) };
    const session = { id: uid(), resident_id: residentId, campaign_id: row.id, reward_amount: row.reward_amount, share_text: row.share_text, share_url: row.share_url, expires_at: now + SESSION_TTL, status: 'started', created_at: now, completed_at: null };
    this.store.run('INSERT INTO reward_share_sessions VALUES(?,?,?,?,?,?,?,?,?,?)', session.id, session.resident_id, session.campaign_id, session.reward_amount, session.share_text, session.share_url, session.expires_at, session.status, session.created_at, session.completed_at);
    return { ok: true, claimed: false, shareSessionId: session.id, expiresAt: session.expires_at, campaign: this.view(row, false), share: { text: session.share_text, url: session.share_url, title: 'AbujaLife' } };
  }
  claimView(row) { return { id: row.id, campaignId: row.campaign_id, rewardGameNaira: row.reward_amount, createdAt: row.created_at }; }
  async complete(residentId, body = {}) {
    const sessionId = clean(body.shareSessionId, 80); check(/^[0-9a-f-]{20,80}$/i.test(sessionId), 'Share session is invalid', 400, 'invalid_share_session');
    const session = this.store.get('SELECT * FROM reward_share_sessions WHERE id=? AND resident_id=?', sessionId, residentId); check(session, 'Share session was not found', 404, 'share_session_not_found');
    const key = `share-reward-${session.id}`;
    return this.store.economyOperation(residentId, 'social-share-reward', { idempotencyKey: key }, { campaignId: session.campaign_id, shareSessionId: session.id }, (profile, timestamp) => {
      const current = this.store.get('SELECT * FROM reward_share_sessions WHERE id=? AND resident_id=?', session.id, residentId);
      check(current && current.status === 'started', 'This share has already been settled', 409, 'share_already_settled');
      check(timestamp <= current.expires_at, 'This share session has expired', 409, 'share_session_expired');
      const campaign = this.campaignRow(current.campaign_id); check(this.active(campaign, timestamp), 'This earn campaign is no longer available', 409, 'campaign_unavailable');
      check(!this.store.get('SELECT id FROM reward_claims WHERE campaign_id=? AND resident_id=?', campaign.id, residentId), 'This campaign reward was already collected', 409, 'reward_already_claimed');
      const claim = { id: uid(), resident_id: residentId, campaign_id: campaign.id, share_session_id: current.id, reward_amount: campaign.reward_amount, created_at: timestamp };
      this.store.run('UPDATE reward_share_sessions SET status=?,completed_at=? WHERE id=? AND status=?', 'completed', timestamp, current.id, 'started');
      this.store.run('INSERT INTO reward_claims VALUES(?,?,?,?,?,?)', claim.id, claim.resident_id, claim.campaign_id, claim.share_session_id, claim.reward_amount, claim.created_at);
      profile.wallet += claim.reward_amount;
      return { claim: this.claimView(claim), rewardGameNaira: claim.reward_amount, campaign: this.view(campaign, true), ledgerReason: `SOCIAL_SHARE_REWARD · ${campaign.title}` };
    });
  }
  async adminList(adminId) { this.admin?.requirePermission?.(adminId, 'payments'); return this.campaigns(); }
  async adminSave(adminId, body = {}) {
    this.admin?.requirePermission?.(adminId, 'payments');
    const id = clean(body.id || DEFAULT_ID, 80), title = clean(body.title, 100), description = clean(body.description, 300), shareText = clean(body.shareText, 500), shareUrl = clean(body.shareUrl || this.publicWebUrl + '/', 500);
    check(/^[A-Za-z0-9_-]{1,80}$/.test(id) && title.length >= 3 && description.length >= 3 && shareText.length >= 5, 'Complete the campaign fields');
    const amount = Number(body.rewardGameNaira), maxClaims = Number(body.maxClaims ?? 1); check(Number.isSafeInteger(amount) && amount > 0 && amount <= 10000000, 'Reward must be a positive whole Game Naira amount'); check(Number.isSafeInteger(maxClaims) && maxClaims >= 1 && maxClaims <= 100, 'Choose a valid claim limit');
    const now = this.clock(); this.store.run(`INSERT INTO reward_campaigns(id,title,description,reward_amount,enabled,start_at,end_at,max_claims,share_text,share_url,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,reward_amount=excluded.reward_amount,enabled=excluded.enabled,start_at=excluded.start_at,end_at=excluded.end_at,max_claims=excluded.max_claims,share_text=excluded.share_text,share_url=excluded.share_url,updated_at=excluded.updated_at`, id, title, description, amount, body.enabled === false ? 0 : 1, body.startAt == null ? null : Number(body.startAt), body.endAt == null ? null : Number(body.endAt), maxClaims, shareText, shareUrl, now, now);
    return this.campaigns();
  }
}

export { DEFAULT_ID as DEFAULT_REWARD_CAMPAIGN_ID, DEFAULT_REWARD };

import { invariant } from './errors.js';
import { id } from './id.js';

export const openBusiness = ({ store, ledger, businesses, playerId, businessTypeId, districtId, name, requestId }) => {
  const type = businesses.find(b => b.id === businessTypeId);
  invariant(type, 'BUSINESS_TYPE_NOT_FOUND', 'Business type does not exist.', 404);
  invariant(type.districts.includes(districtId), 'BUSINESS_DISTRICT_INVALID', 'That business cannot open in this district.', 409);
  const cleanName = String(name ?? '').trim();
  invariant(cleanName.length >= 2 && cleanName.length <= 40, 'INVALID_BUSINESS_NAME', 'Business name must be 2-40 characters.');
  ledger.post({ playerId, amount: -type.startupCost, reason: 'business_startup', reference: type.id, idempotencyKey: requestId ? `business:${playerId}:${requestId}` : undefined });
  return store.addBusiness({ id: id('biz'), ownerId: playerId, typeId: type.id, name: cleanName, districtId, reputation: 0, level: 1, createdAt: new Date().toISOString() });
};

export const runBusinessCycle = ({ store, ledger, businesses, playerId, businessId, quality = 1, now = Date.now() }) => {
  const business = store.getBusiness(businessId);
  invariant(business.ownerId === playerId, 'BUSINESS_FORBIDDEN', 'You do not own this business.', 403);
  const type = businesses.find(b => b.id === business.typeId);
  invariant(type, 'BUSINESS_TYPE_NOT_FOUND', 'Business type does not exist.', 404);
  const last = business.lastCycleAt ?? 0;
  invariant(now - last >= 5 * 60 * 1000, 'BUSINESS_COOLDOWN', 'Business cycle is not ready.', 429);
  const q = Math.max(0.5, Math.min(1.25, Number(quality) || 1));
  const [min,max] = type.revenuePerCycle;
  const base = Math.round((min + max) / 2);
  const revenue = Math.round(base * q * (1 + business.reputation * 0.01));
  ledger.post({ playerId, amount: revenue, reason: 'business_revenue', reference: business.id });
  return store.updateBusiness(business.id, { lastCycleAt: now, reputation: business.reputation + (q >= 0.95 ? 1 : 0) });
};

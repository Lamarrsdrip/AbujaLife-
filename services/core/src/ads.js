import { invariant } from './errors.js';
import { id } from './id.js';
export const bookCityAd = ({ store, ledger, playerId, districtId, title, targetUrl, days = 7, pricePerDay = 250000, requestId }) => {
  invariant(Number.isSafeInteger(days) && days >= 1 && days <= 30, 'INVALID_AD_DURATION', 'Ad duration must be 1-30 days.');
  const clean = String(title ?? '').trim(); invariant(clean.length >= 2 && clean.length <= 60, 'INVALID_AD_TITLE', 'Ad title must be 2-60 characters.');
  const url = new URL(targetUrl); invariant(['https:','http:'].includes(url.protocol), 'INVALID_AD_URL', 'Ad URL must be http(s).');
  const cost = pricePerDay * days;
  ledger.post({ playerId, amount: -cost, reason: 'city_ad_booking', reference: districtId, idempotencyKey: requestId ? `ad:${playerId}:${requestId}` : undefined });
  return store.addAd({ id:id('ad'), playerId, districtId, title:clean, targetUrl:url.toString(), startsAt:new Date().toISOString(), days, status:'pending_moderation' });
};

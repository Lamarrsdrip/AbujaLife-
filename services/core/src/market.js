import { invariant } from './errors.js';
export const purchaseVirtualItem = ({ store, ledger, catalog, playerId, itemId, quantity = 1, requestId }) => {
  invariant(Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 20, 'INVALID_QUANTITY', 'Invalid quantity.');
  const item = catalog.find(i => i.id === itemId);
  invariant(item, 'ITEM_NOT_FOUND', 'Item not found.', 404);
  invariant(item.type !== 'physical', 'COMMERCE_BOUNDARY', 'Physical goods cannot be purchased with Abuja Naira.', 403);
  const cost = item.price * quantity;
  const entry = ledger.post({ playerId, amount: -cost, reason: 'city_market_purchase', reference: itemId, idempotencyKey: requestId ? `purchase:${playerId}:${requestId}` : undefined, metadata: { quantity } });
  store.addItem(playerId, itemId, quantity);
  return { item, quantity, cost, ledgerEntry: entry };
};

export const okrikaHandoff = ({ baseUrl, playerId, districtId, query = '' }) => {
  const u = new URL('/explore', baseUrl);
  u.searchParams.set('src', 'abujalife');
  u.searchParams.set('player', playerId);
  u.searchParams.set('district', districtId);
  if (query) u.searchParams.set('q', query);
  return { kind: 'physical-commerce', currency: 'real-money-only', url: u.toString() };
};

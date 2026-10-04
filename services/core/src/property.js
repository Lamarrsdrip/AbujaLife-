import { invariant } from './errors.js';

export const acquireProperty = ({ store, ledger, properties, playerId, propertyId, mode = 'rent', requestId }) => {
  const property = properties.find(p => p.id === propertyId);
  invariant(property, 'PROPERTY_NOT_FOUND', 'Property does not exist.', 404);
  invariant(mode === 'rent' || mode === 'buy', 'INVALID_PROPERTY_MODE', 'Property mode must be rent or buy.');
  const cost = mode === 'rent' ? property.rent : property.buy;
  invariant(Number.isSafeInteger(cost) && cost > 0, 'PROPERTY_UNAVAILABLE', 'This property is not available for that mode.', 409);
  ledger.post({ playerId, amount: -cost, reason: mode === 'rent' ? 'property_rent' : 'property_purchase', reference: property.id, idempotencyKey: requestId ? `property:${playerId}:${requestId}` : undefined, metadata: { mode } });
  return store.setHome(playerId, { propertyId: property.id, districtId: property.district, mode, acquiredAt: new Date().toISOString() });
};

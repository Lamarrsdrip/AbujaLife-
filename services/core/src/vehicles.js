import { invariant } from './errors.js';
import { id } from './id.js';

export const purchaseVehicle = ({ store, ledger, vehicles, playerId, vehicleId, requestId }) => {
  const vehicle = vehicles.find(v => v.id === vehicleId);
  invariant(vehicle, 'VEHICLE_NOT_FOUND', 'Vehicle does not exist.', 404);
  ledger.post({ playerId, amount: -vehicle.price, reason: 'vehicle_purchase', reference: vehicle.id, idempotencyKey: requestId ? `vehicle:${playerId}:${requestId}` : undefined });
  return store.addVehicle(playerId, { id: id('veh'), modelId: vehicle.id, fuel: vehicle.fuelCapacity, condition: 100, odometerKm: 0, purchasedAt: new Date().toISOString() });
};

export const driveVehicle = ({ store, vehicleId, playerId, distanceKm, fuelEfficiency = 10 }) => {
  invariant(Number.isFinite(distanceKm) && distanceKm > 0 && distanceKm <= 500, 'INVALID_DISTANCE', 'Distance is invalid.');
  const owned = store.getVehicle(playerId, vehicleId);
  const fuelUsed = distanceKm / fuelEfficiency;
  invariant(owned.fuel >= fuelUsed, 'OUT_OF_FUEL', 'Vehicle does not have enough fuel.', 409);
  return store.updateVehicle(playerId, vehicleId, { fuel: Math.max(0, owned.fuel - fuelUsed), odometerKm: owned.odometerKm + distanceKm, condition: Math.max(0, owned.condition - distanceKm * 0.003) });
};

// Server adapter for City Moments. Rules live in src/shared/city-moments.mjs.
import { GameError } from './errors.mjs';
import { MOMENT_ACTIONS, MomentError, applyMomentAction } from '../shared/city-moments.mjs';

export { MOMENT_ACTIONS };
/** Runs inside a store's existing atomic economy operation. */
export function applyServerMomentAction(profile, action, payload, { now }) {
  try { return applyMomentAction(profile, action, payload, { now }); }
  catch (error) { if (error instanceof MomentError) throw new GameError(error.message, error.status, error.code); throw error; }
}

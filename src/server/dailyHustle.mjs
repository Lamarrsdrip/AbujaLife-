// Server adapter for Today's Hustle. Rules live in src/shared/daily-hustle.mjs.
import { GameError } from './errors.mjs';
import { HUSTLE_ACTIONS, HUSTLE_MONEY_ACTIONS, HustleError, applyHustleAction, recordHustleProgress } from '../shared/daily-hustle.mjs';

export { HUSTLE_ACTIONS, HUSTLE_MONEY_ACTIONS, recordHustleProgress };
/** Runs inside a store's existing atomic economy operation. */
export function applyServerHustleAction(profile, action, payload, { now }) {
  try { return applyHustleAction(profile, action, payload, { now }); }
  catch (error) { if (error instanceof HustleError) throw new GameError(error.message, error.status, error.code); throw error; }
}

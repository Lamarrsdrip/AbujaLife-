// Server adapter for street gigs. The rules live in src/shared/street-gigs.mjs;
// this turns their rule errors into the API's error type and supplies randomness.
import crypto from 'node:crypto';
import { GameError } from './errors.mjs';
import { GIG_ACTIONS, GIG_MONEY_ACTIONS, GigError, applyGigAction } from '../shared/street-gigs.mjs';

export { GIG_ACTIONS, GIG_MONEY_ACTIONS };
/** Runs inside a store's existing atomic economy operation, like housing actions. */
export function applyServerGigAction(profile, action, payload, { now, randomInt = crypto.randomInt } = {}) {
  try { return applyGigAction(profile, action, payload, { now, randomInt }); }
  catch (error) { if (error instanceof GigError) throw new GameError(error.message, error.status, error.code); throw error; }
}

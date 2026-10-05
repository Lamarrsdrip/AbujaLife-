import { LOAN_META } from './life.mjs';

/**
 * AbujaLife has no arbitrary gameplay-money ceiling. The only upper boundary is
 * JavaScript's exact-integer representation limit so one Naira never silently
 * becomes an inexact floating-point value. Security/risk controls remain
 * separate from game-business limits.
 */
export function applyUncappedEconomyPolicy() {
  LOAN_META.uncapped = true;
  LOAN_META.dailyPrincipalCap = Number.MAX_SAFE_INTEGER;
  LOAN_META.maxOutstandingPrincipal = Number.MAX_SAFE_INTEGER;
  LOAN_META.redrawAfterRepaymentPercent = 0;
  LOAN_META.description = 'Optional fictional game borrowing with no arbitrary gameplay principal ceiling. A one-time 5% fee is due in 28 real days; exact whole-Naira arithmetic is preserved.';
  return LOAN_META;
}

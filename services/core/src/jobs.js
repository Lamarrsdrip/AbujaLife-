import { invariant } from './errors.js';
export const completeJobShift = ({ store, ledger, jobs, playerId, jobId, score = 1, now = Date.now() }) => {
  const player = store.getPlayer(playerId);
  const job = jobs.find(j => j.id === jobId);
  invariant(job, 'JOB_NOT_FOUND', 'Job does not exist.', 404);
  invariant(player.reputation >= job.minReputation, 'REPUTATION_REQUIRED', 'Reputation requirement not met.', 403);
  const last = store.getJobRun(playerId, jobId);
  if (last) invariant((now - last) / 1000 >= job.cooldownSeconds, 'JOB_COOLDOWN', 'This shift is not available yet.', 429);
  const normalized = Math.max(0.50, Math.min(1.20, Number(score) || 1));
  const pay = Math.round(job.pay * normalized);
  const entry = ledger.post({ playerId, amount: pay, reason: 'job_shift', reference: job.id });
  store.setJobRun(playerId, jobId, now);
  store.updatePlayer(playerId, { xp: player.xp + Math.round(20 * normalized), reputation: player.reputation + (normalized >= 0.9 ? 1 : 0) });
  return { pay, score: normalized, ledgerEntry: entry };
};

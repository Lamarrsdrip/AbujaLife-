import { invariant } from './errors.js';
export const nominateMayor = ({ store, playerId, manifesto }) => {
  const p = store.getPlayer(playerId);
  invariant(p.reputation >= 20, 'REPUTATION_REQUIRED', 'Mayor candidates need at least 20 reputation.', 403);
  const text = String(manifesto ?? '').trim();
  invariant(text.length >= 20 && text.length <= 500, 'INVALID_MANIFESTO', 'Manifesto must be 20-500 characters.');
  return store.setMayorCandidate(playerId, text);
};
export const voteMayor = ({ store, voterId, candidateId }) => {
  store.getPlayer(voterId); store.getPlayer(candidateId);
  invariant(store.mayorCandidates.has(candidateId), 'CANDIDATE_NOT_FOUND', 'Candidate not found.', 404);
  return store.castMayorVote(voterId, candidateId);
};

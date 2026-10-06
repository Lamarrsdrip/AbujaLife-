/** Civic collections are created by the bootstrap identity. The application user must not run DDL. */
export const MONGO_CIVIC_INDEXES = Object.freeze({
  civic_candidates: [
    [{ cycleId: 1, residentId: 1 }, { unique: true }],
    [{ cycleId: 1, status: 1, support: -1 }, {}],
  ],
  civic_votes: [
    [{ cycleId: 1, voterId: 1 }, { unique: true }],
    [{ cycleId: 1, candidateId: 1 }, {}],
  ],
  civic_events: [
    [{ cycleId: 1, createdAt: -1 }, {}],
  ],
  civic_governments: [
    [{ cycleId: 1 }, { unique: true }],
  ],
  civic_actions: [
    [{ cycleId: 1, residentId: 1, operationKey: 1 }, { unique: true }],
  ],
});

export async function ensureMongoCivicSchema(db) {
  for (const [name, indexes] of Object.entries(MONGO_CIVIC_INDEXES)) {
    for (const [keys, options] of indexes) await db.collection(name).createIndex(keys, options);
  }
}

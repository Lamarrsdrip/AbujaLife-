export const JACKPOT_COLLECTIONS = Object.freeze([
  'jackpot_accounts',
  'jackpot_ledger',
  'jackpot_deposit_orders',
  'jackpot_deposit_receipts',
  'jackpot_rooms',
  'jackpot_entries',
  'jackpot_withdrawals',
]);

export const JACKPOT_APPEND_ONLY_COLLECTIONS = Object.freeze([
  'jackpot_ledger',
  'jackpot_deposit_receipts',
  'jackpot_entries',
]);

const validator = { $jsonSchema: { bsonType: 'object' } };

const indexes = Object.freeze({
  jackpot_accounts: [
    [{ residentId: 1 }, { unique: true }],
  ],
  jackpot_ledger: [
    [{ residentId: 1, operationKey: 1 }, { unique: true }],
    [{ residentId: 1, createdAt: -1 }, {}],
  ],
  jackpot_deposit_orders: [
    [{ txRef: 1 }, { unique: true }],
    [{ residentId: 1, operationKey: 1 }, { unique: true }],
    [{ transactionId: 1 }, { unique: true, partialFilterExpression: { transactionId: { $type: 'string' } } }],
  ],
  jackpot_deposit_receipts: [
    [{ provider: 1, transactionId: 1 }, { unique: true }],
  ],
  jackpot_rooms: [
    [{ laneId: 1, active: 1 }, { unique: true, partialFilterExpression: { active: true } }],
    [{ status: 1, drawsAt: 1 }, {}],
  ],
  jackpot_entries: [
    [{ roomId: 1, residentId: 1 }, { unique: true }],
    [{ roomId: 1, createdAt: 1, _id: 1 }, {}],
  ],
  jackpot_withdrawals: [
    [{ residentId: 1, operationKey: 1 }, { unique: true }],
    [{ status: 1, requestedAt: 1 }, {}],
  ],
});

export async function ensureMongoJackpotSchema(db) {
  for (const name of JACKPOT_COLLECTIONS) {
    try {
      await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
    } catch (error) {
      if (error.code !== 48) throw error;
    }
    await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
  }
  for (const [name, definitions] of Object.entries(indexes)) {
    for (const [key, options] of definitions) await db.collection(name).createIndex(key, options);
  }
  await migrateJackpotWithdrawalFingerprints(db);
  return { collections: [...JACKPOT_COLLECTIONS] };
}

export async function migrateJackpotWithdrawalFingerprints(db){
  const withdrawals=db.collection('jackpot_withdrawals');
  // Old replay fingerprints included the full bank account number even though
  // encryptedBank was encrypted. Bootstrap scrubs all such rows, including
  // completed payouts, while preserving the original replay identity.
  for await(const row of withdrawals.find({fingerprint:/^\{/},{projection:{_id:1,fingerprint:1}}).batchSize(200)){
    const fingerprint=crypto.createHash('sha256').update(row.fingerprint).digest('hex');
    await withdrawals.updateOne({_id:row._id,fingerprint:row.fingerprint},{$set:{fingerprint}});
  }
}
import crypto from 'node:crypto';

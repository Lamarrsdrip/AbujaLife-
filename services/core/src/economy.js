import { invariant } from './errors.js';
import { id } from './id.js';

export class Ledger {
  constructor() {
    this.entries = [];
    this.idempotency = new Map();
  }

  balance(playerId) {
    return this.entries.filter(e => e.playerId === playerId).reduce((sum, e) => sum + e.amount, 0);
  }

  post({ playerId, amount, reason, reference, idempotencyKey, metadata = {} }) {
    invariant(Number.isSafeInteger(amount) && amount !== 0, 'INVALID_AMOUNT', 'Ledger amount must be a non-zero integer.');
    invariant(playerId, 'PLAYER_REQUIRED', 'playerId is required.');
    invariant(reason, 'REASON_REQUIRED', 'reason is required.');
    if (idempotencyKey && this.idempotency.has(idempotencyKey)) return this.idempotency.get(idempotencyKey);
    const next = this.balance(playerId) + amount;
    invariant(next >= 0, 'INSUFFICIENT_FUNDS', 'Not enough Abuja Naira.');
    const entry = Object.freeze({
      id: id('led'), playerId, amount, reason, reference: reference ?? null,
      metadata: Object.freeze({ ...metadata }), createdAt: new Date().toISOString()
    });
    this.entries.push(entry);
    if (idempotencyKey) this.idempotency.set(idempotencyKey, entry);
    return entry;
  }
}

export class PaymentReceiptVerifier {
  constructor({ allowDevReceipts = false } = {}) { this.allowDevReceipts = allowDevReceipts; }
  verify(receipt) {
    invariant(receipt && receipt.provider && receipt.transactionId, 'INVALID_RECEIPT', 'Missing payment receipt fields.');
    // Production adapters must call Apple App Store Server API, Google Play Developer API,
    // or the configured web PSP server-to-server verification endpoint here.
    if (receipt.provider === 'dev-sandbox') {
      invariant(this.allowDevReceipts, 'UNVERIFIED_PAYMENT', 'Development receipts are disabled.', 403);
      invariant(receipt.status === 'verified', 'UNVERIFIED_PAYMENT', 'Receipt was not verified.', 403);
      invariant(Number.isSafeInteger(receipt.gameAmount) && receipt.gameAmount > 0, 'INVALID_AMOUNT', 'Invalid game amount.');
      return { transactionId: receipt.transactionId, gameAmount: receipt.gameAmount, provider: receipt.provider };
    }
    throw Object.assign(new Error('Production payment adapter not configured.'), { code: 'PAYMENT_ADAPTER_REQUIRED', status: 503 });
  }
}

export const grantTopup = ({ ledger, verifier, playerId, receipt }) => {
  const verified = verifier.verify(receipt);
  return ledger.post({
    playerId,
    amount: verified.gameAmount,
    reason: 'currency_topup',
    reference: verified.transactionId,
    idempotencyKey: `topup:${verified.provider}:${verified.transactionId}`,
    metadata: { provider: verified.provider }
  });
};

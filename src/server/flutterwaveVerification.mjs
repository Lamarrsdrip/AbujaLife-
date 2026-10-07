import { GameError } from './errors.mjs';

export const isTransactionId = value => /^\d{1,24}$/.test(String(value ?? ''));
export const isPaymentReference = value => typeof value === 'string' && /^abjl_[A-Za-z0-9_-]{1,90}$/.test(value);
export const isProviderPath = value => value === '/v3/payments' || /^\/v3\/transactions\/\d{1,24}\/verify$/.test(value) || /^\/v3\/transactions\/verify_by_reference\?tx_ref=abjl_[A-Za-z0-9_-]{1,90}$/.test(value);

// All three existing products verify the same provider facts. Product quantities
// and recipients still come exclusively from their saved authoritative orders.
export async function verifyFlutterwaveOrder(payments, { transactionId, txRef, amount, secretKey, onResult = async () => {} }) {
  const suppliedId = String(transactionId ?? '');
  if ((suppliedId && !isTransactionId(suppliedId)) || (!suppliedId && !isPaymentReference(txRef))) throw new GameError('Use your saved checkout reference or Flutterwave transaction ID', 400, 'invalid_transaction');
  const data = await payments.provider(suppliedId ? `/v3/transactions/${suppliedId}/verify` : `/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, secretKey);
  const id = String(data?.id ?? '');
  const matches = isTransactionId(id) && (!suppliedId || id === suppliedId) && data?.currency === 'NGN' && Number(data?.amount) === amount && data?.tx_ref === txRef && (!data?.meta?.abujalife_reference || data.meta.abujalife_reference === txRef);
  await onResult({ providerStatus: String(data?.status || 'unknown').slice(0, 40), providerTransactionId: isTransactionId(id) ? id : null, matches });
  if (!matches || data?.status !== 'successful') throw new GameError('Flutterwave has not confirmed a successful transaction matching this checkout’s amount, currency and reference', 409, 'payment_verification_failed');
  return { data, transactionId: id };
}

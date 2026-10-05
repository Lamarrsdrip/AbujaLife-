import crypto from 'node:crypto';

/** Optional transactional mail. Provider secrets and recovery tokens stay server-side. */
export function createEmailDelivery({ env = process.env, publicWebUrl, fetchImpl = fetch, log = () => {} } = {}) {
  const key = env.RESEND_API_KEY || '', from = env.EMAIL_FROM || '';
  if (!key && !from) return { deliverPasswordReset: null, deliverEmailVerification: null };
  if (!key || !from || !/^(?:[^<>\r\n]+\s*<)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(from)) {
    throw new Error('Configure both RESEND_API_KEY and a verified EMAIL_FROM sender');
  }
  const origin = new URL(publicWebUrl).origin;
  const deliver = kind => async ({ email, token }) => {
    const recovery = kind === 'password-reset', link = `${origin}/#${recovery ? 'reset-password' : 'verify-email'}=${token}`;
    const subject = recovery ? 'Reset your AbujaLife password' : 'Verify your AbujaLife email';
    const text = `${recovery ? 'Choose a new password for your AbujaLife account' : 'Confirm this email address for your AbujaLife account'}:\n\n${link}\n\nThis link expires in ${recovery ? '30 minutes' : '24 hours'}. If you did not request it, you can ignore this email.`;
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'idempotency-key': `abujalife-${kind}-${crypto.createHash('sha256').update(token).digest('hex')}` },
        body: JSON.stringify({ from, to: [email], subject, text }), redirect: 'error', signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('Email provider rejected delivery');
      log('email_delivery', { kind });
    } catch {
      log('email_delivery_failure', { kind });
      throw new Error('Email delivery failed');
    }
  };
  return { deliverPasswordReset: deliver('password-reset'), deliverEmailVerification: deliver('email-verification') };
}

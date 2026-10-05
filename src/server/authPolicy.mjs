// AbujaLife account creation is intentionally username/password only.
// Existing account records may still contain a historical email, but new
// registrations never collect, persist or send email and no recovery mail is
// advertised by the production client.
export function applyUsernameOnlyAuth(auth) {
  if (!auth || typeof auth.credentials !== 'function') throw new TypeError('Auth store is required');
  const credentials = auth.credentials.bind(auth);
  auth.credentials = input => {
    const body = input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : {};
    delete body.email;
    return credentials(body);
  };
  auth.deliverEmailVerification = null;
  auth.deliverPasswordReset = null;
  auth.configuration = () => ({ ok: true, emailVerificationEnabled: false, passwordResetEnabled: false });
  return auth;
}

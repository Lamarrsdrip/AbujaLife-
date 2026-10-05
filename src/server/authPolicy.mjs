import { GameError } from './errors.mjs';

// AbujaLife account access is intentionally username/password only.
// New registrations never collect or persist email, and the production auth
// surface exposes no verification or password-recovery link flow.
export function applyUsernameOnlyAuth(auth) {
  if (!auth || typeof auth.credentials !== 'function') throw new TypeError('Auth store is required');
  const credentials = auth.credentials.bind(auth);
  auth.credentials = input => {
    const body = input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : {};
    delete body.email;
    return credentials(body);
  };

  const unavailable = () => { throw new GameError('This account uses username and password only.', 404, 'email_auth_disabled'); };
  auth.deliverEmailVerification = null;
  auth.deliverPasswordReset = null;
  auth.requestEmailVerification = unavailable;
  auth.verifyEmail = unavailable;
  auth.emailStatus = unavailable;
  auth.requestPasswordReset = unavailable;
  auth.completePasswordReset = unavailable;
  auth.configuration = () => ({ ok: true, emailVerificationEnabled: false, passwordResetEnabled: false, usernameOnly: true });
  return auth;
}

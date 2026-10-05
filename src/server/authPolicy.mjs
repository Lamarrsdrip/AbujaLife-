import { GameError } from './errors.mjs';

// AbujaLife account access is intentionally username/password only.
// New registrations never collect or persist email, and production login never
// accepts an email identifier. Recovery/verification link flows stay disabled.
export function applyUsernameOnlyAuth(auth) {
  if (!auth || typeof auth.credentials !== 'function' || typeof auth.login !== 'function') throw new TypeError('Auth store is required');

  const credentials = auth.credentials.bind(auth);
  auth.credentials = input => {
    const body = input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : {};
    delete body.email;
    return credentials(body);
  };

  const login = auth.login.bind(auth);
  auth.login = input => {
    const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new GameError('Username or password is incorrect', 401, 'invalid_credentials');
    return login({ username, password: body.password });
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

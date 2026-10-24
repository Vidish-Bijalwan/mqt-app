/**
 * Auth scaffolding (v1.2, item 71 — BLOCKED).
 * No SMS provider has been chosen and no OTP backend is connected, so
 * every function here returns 'not configured' and NEVER reports success.
 * LoginScreen shows a disabled Send OTP button on top of this module;
 * nothing here sends, verifies, or fakes an OTP.
 */

export type AuthStatus =
  | { configured: false; reason: 'not configured' }
  | { configured: true; phone: string };

export interface OtpResult {
  ok: false;
  error: 'not configured';
}

/** Always 'not configured' until a real SMS provider + backend land. */
export async function getAuthStatus(): Promise<AuthStatus> {
  return { configured: false, reason: 'not configured' };
}

/** Never sends an OTP — there is no provider to send one with. */
export async function requestOtp(_phone: string): Promise<OtpResult> {
  return { ok: false, error: 'not configured' };
}

/** Never verifies an OTP — there is nothing to verify against. */
export async function verifyOtp(
  _phone: string,
  _code: string,
): Promise<OtpResult> {
  return { ok: false, error: 'not configured' };
}

/** No session exists to sign out of. */
export async function signOut(): Promise<void> {
  // No-op by design: guest mode only until auth is configured.
}

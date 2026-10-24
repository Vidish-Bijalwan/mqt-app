/**
 * Biometric gate for the Account tab (v1.2).
 *
 * expo-local-authentication is installed (Builder C, via
 * `npx expo install`, SDK 58-compatible), so the import below resolves
 * normally. The runtime guards stay: in Expo Go the native module is
 * absent, so every function resolves to "unavailable" and the biometric
 * toggle explains that and stays off — the app never locks the user
 * out and never fakes a check. A real biometric prompt needs a
 * development build or a release APK, not Expo Go or web.
 */
import * as LocalAuth from 'expo-local-authentication';

export interface BiometricAvailability {
  available: boolean;
  /** Human-readable reason when unavailable (shown on the toggle). */
  reason: string | null;
}

/** True only when hardware + enrolment exist AND the module loaded. */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const mod = LocalAuth as unknown as {
      hasHardwareAsync?: () => Promise<boolean>;
      isEnrolledAsync?: () => Promise<boolean>;
    };
    const hasHardware = mod.hasHardwareAsync;
    const isEnrolled = mod.isEnrolledAsync;
    if (typeof hasHardware !== 'function' || typeof isEnrolled !== 'function') {
      return {
        available: false,
        reason: 'Biometric unlock is not available in this build yet.',
      };
    }
    const [hardware, enrolled] = await Promise.all([
      hasHardware(),
      isEnrolled(),
    ]);
    if (!hardware) {
      return {
        available: false,
        reason: 'This device has no biometric hardware.',
      };
    }
    if (!enrolled) {
      return {
        available: false,
        reason: 'No fingerprint or face is enrolled on this device.',
      };
    }
    return { available: true, reason: null };
  } catch {
    return {
      available: false,
      reason: 'Biometric unlock is not available in this build yet.',
    };
  }
}

/**
 * Authenticate with biometrics, falling back to the device credential
 * (PIN/pattern/password) when the device offers one. Returns false on
 * cancel, failure, or when the module is unavailable — never throws.
 */
export async function authenticateBiometric(): Promise<boolean> {
  try {
    const mod = LocalAuth as unknown as {
      authenticateAsync?: (opts?: {
        promptMessage?: string;
        disableDeviceFallback?: boolean;
      }) => Promise<{ success: boolean }>;
    };
    if (typeof mod.authenticateAsync !== 'function') return false;
    const result = await mod.authenticateAsync({
      promptMessage: 'Unlock your account',
      // Device-credential fallback: false keeps the fallback ENABLED.
      disableDeviceFallback: false,
    });
    return result.success === true;
  } catch {
    return false;
  }
}

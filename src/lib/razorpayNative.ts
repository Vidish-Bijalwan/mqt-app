/**
 * Native Razorpay checkout (Android/iOS only).
 *
 * react-native-razorpay v3: default export with `.open(options)` returning
 * a Promise — success resolves with `{ razorpay_payment_id, ... }`,
 * failure / dismissal rejects with `{ code, description, ... }`.
 * (Verified against node_modules/react-native-razorpay v3.0.0:
 * RazorpayCheckout.js + src/types.ts.)
 *
 * The SDK is loaded with a dynamic import inside openCheckout, NOT a
 * static import: on iOS a static import throws at import time when the
 * native module is not linked (NativeEventEmitter invariant), which
 * would crash the screen on mount. The dynamic import makes a missing
 * native module a catchable RazorpayNativeUnavailableError instead.
 *
 * The key, order id and amount come ONLY from the backend create-order
 * response passed in by the caller — nothing is hardcoded here.
 * On web, Metro resolves `razorpayNative.web.ts` instead of this file,
 * so the native SDK never enters the web bundle.
 */

export const RAZORPAY_NATIVE_UNAVAILABLE_MESSAGE =
  'Payment unavailable on this build — contact us on WhatsApp.';

/** Thrown when the native Razorpay module is not available in this build. */
export class RazorpayNativeUnavailableError extends Error {
  constructor(message: string = RAZORPAY_NATIVE_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = 'RazorpayNativeUnavailableError';
  }
}

export interface NativeCheckoutOptions {
  /** Public key id from the create-order backend response only. */
  key: string;
  /** Order id from the create-order backend response only. */
  orderId: string;
  /** Amount in paise from the create-order backend response only. */
  amountPaise: number;
  description: string;
  name: string;
  contact: string;
  email: string;
}

export interface NativeCheckoutResult {
  paymentId: string;
}

interface RazorpaySdk {
  open: (options: Record<string, unknown>) => Promise<{
    razorpay_payment_id?: unknown;
  }>;
}

async function loadSdk(): Promise<RazorpaySdk> {
  try {
    // @ts-ignore: react-native-razorpay v3 ships no TypeScript declarations.
    const mod = await import('react-native-razorpay');
    const sdk = (mod?.default ?? mod) as RazorpaySdk | undefined;
    if (!sdk || typeof sdk.open !== 'function') {
      throw new Error('Razorpay native module is not linked in this build.');
    }
    return sdk;
  } catch (err) {
    if (err instanceof RazorpayNativeUnavailableError) throw err;
    throw new RazorpayNativeUnavailableError();
  }
}

function looksLikeMissingNativeModule(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /not linked|native module|undefined is not (a )?function|RNRazorpayCheckout/i.test(
    message,
  );
}

function sdkErrorDescription(err: unknown): string | null {
  if (typeof err === 'object' && err !== null) {
    const description = (err as { description?: unknown }).description;
    if (typeof description === 'string' && description.trim() !== '') {
      return description.trim();
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return null;
}

/**
 * Open the native Razorpay checkout. Throws RazorpayNativeUnavailableError
 * when the SDK is not available in this build; throws a user-safe Error
 * (no payment confirmed, retry allowed) for dismissal / failure.
 */
export async function openCheckout(
  options: NativeCheckoutOptions,
): Promise<NativeCheckoutResult> {
  const sdk = await loadSdk();
  let data: { razorpay_payment_id?: unknown };
  try {
    data = await sdk.open({
      key: options.key,
      order_id: options.orderId,
      amount: options.amountPaise,
      currency: 'INR',
      name: 'My Quick Trippers',
      description: options.description,
      prefill: {
        name: options.name,
        contact: options.contact,
        email: options.email,
      },
      theme: { color: '#127C82' },
    });
  } catch (err) {
    if (looksLikeMissingNativeModule(err)) {
      throw new RazorpayNativeUnavailableError();
    }
    const description = sdkErrorDescription(err);
    if (
      description !== null &&
      /cancel|dismiss|closed|aborted/i.test(description)
    ) {
      throw new Error(
        'Payment was closed before completing. No payment was confirmed — you can try again.',
      );
    }
    const detail =
      description !== null ? description.replace(/\.+$/, '') : 'Payment failed';
    throw new Error(
      `${detail}. No payment was confirmed — you can try again.`,
    );
  }
  const paymentId =
    typeof data.razorpay_payment_id === 'string'
      ? data.razorpay_payment_id
      : '';
  if (paymentId === '') {
    throw new Error(
      'Payment failed. No payment was confirmed — you can try again.',
    );
  }
  return { paymentId };
}

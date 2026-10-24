/**
 * Web stub for the native Razorpay checkout.
 *
 * Metro picks this file instead of razorpayNative.ts on web, so the
 * native SDK (and its native modules) never enter the web bundle.
 * PayScreen never calls openCheckout on web — it hands off to the
 * website /pay page — but if anything ever does, it fails with the
 * same unavailable error the native wrapper throws when the SDK is
 * missing, never with a crash or a fake payment.
 *
 * The exported names and option shape intentionally mirror
 * razorpayNative.ts; keep them in sync.
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

/** Web has no native checkout — always unavailable by design. */
export async function openCheckout(
  _options: NativeCheckoutOptions,
): Promise<NativeCheckoutResult> {
  throw new RazorpayNativeUnavailableError();
}

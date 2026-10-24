/**
 * Website API client — My Quick Trippers v1.
 *
 * SITE_BASE is the public website only. No secrets live in app code:
 * the Razorpay keyId comes ONLY from the create-order backend response.
 * Do NOT use the legacy /api/payments/create-order route (dropped
 * Cashfree route) — the live route is /api/payments/razorpay/create-order.
 */
export const SITE_BASE = 'https://www.myquicktrippers.com';

/** Error whose message is safe to show to the user (no stack traces). */
export class ApiError extends Error {
  readonly status?: number;
  /** True when the lead/payment must NOT be silently dropped: the UI
   *  must offer the WhatsApp fallback instead of a dead end. */
  readonly needsFallback: boolean;

  constructor(message: string, status?: number, needsFallback = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.needsFallback = needsFallback;
  }
}

function statusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Please check the details you entered and try again.';
    case 401:
    case 403:
      return 'This request was not accepted. Please contact the team on WhatsApp.';
    case 429:
      return 'Too many requests right now. Please try again shortly or contact the team on WhatsApp so your enquiry is not lost.';
    case 502:
    case 503:
      return 'The server is temporarily unavailable. Please try again or contact the team on WhatsApp so your enquiry is not lost.';
    default:
      return 'Something went wrong. Please try again or contact the team on WhatsApp.';
  }
}

async function readErrorText(res: Response): Promise<string | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    try {
      const json = JSON.parse(text) as { error?: unknown; message?: unknown };
      if (typeof json.error === 'string' && json.error) return json.error;
      if (typeof json.message === 'string' && json.message) return json.message;
    } catch {
      // Plain-text error body.
    }
    return text.length <= 300 ? text : null;
  } catch {
    return null;
  }
}

async function postJson<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  let res: Response;
  try {
    res = await fetch(`${SITE_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Network failure: NEVER silently drop the lead/payment.
    return {
      ok: false,
      error: new ApiError(
        'Could not reach the server. Please check your connection or contact the team on WhatsApp so your enquiry is not lost.',
        undefined,
        true,
      ),
    };
  }
  if (res.ok) {
    try {
      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch {
      return {
        ok: false,
        error: new ApiError(
          'The server returned an unexpected response. Please try again.',
          res.status,
        ),
      };
    }
  }
  const serverText = await readErrorText(res);
  const needsFallback =
    res.status === 429 || res.status === 502 || res.status === 503;
  return {
    ok: false,
    error: new ApiError(
      serverText ?? statusMessage(res.status),
      res.status,
      needsFallback,
    ),
  };
}

/* ------------------------------ validation ------------------------------ */

/** Strip everything but digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Enquiry phone rule (server): 8–15 digits after stripping non-digits. */
export function isValidEnquiryPhone(phone: string): boolean {
  const digits = digitsOnly(phone);
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Indian mobile rule: after stripping a leading 91 / 0 country/trunk
 * prefix, exactly 10 digits starting with 6–9.
 */
export function normaliseIndianMobile(phone: string): string | null {
  let digits = digitsOnly(phone);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Today's date in Asia/Kolkata (UTC+5:30), as YYYY-MM-DD. */
export function todayInKolkata(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

/**
 * Travel date rule (server): optional, YYYY-MM-DD, a real calendar date,
 * and not in the past when compared in Asia/Kolkata.
 * Returns an error string, or null when valid/empty.
 */
export function travelDateError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return 'Travel date must be in YYYY-MM-DD format.';
  }
  const [y, m, d] = trimmed.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return 'Travel date is not a real calendar date.';
  }
  if (trimmed < todayInKolkata()) {
    return 'Travel date cannot be in the past.';
  }
  return null;
}

/* ------------------------------- enquiry -------------------------------- */

export interface EnquiryInput {
  name: string;
  phone: string;
  email?: string;
  packageSlug?: string;
  packageName?: string;
  travelDate?: string;
  travellers?: number;
  message?: string;
}

export interface EnquiryResult {
  ok: boolean;
  id: string;
  ref: string;
  notified: boolean;
}

/** Client mirror of the server's enquiry validation. Null = valid. */
export function enquiryValidationError(input: EnquiryInput): string | null {
  if (input.name.trim().length < 2) {
    return 'Please enter your name (at least 2 characters).';
  }
  if (!isValidEnquiryPhone(input.phone)) {
    return 'Please enter a valid phone number (8–15 digits).';
  }
  if (input.email !== undefined && input.email.trim() !== '' && !isValidEmail(input.email)) {
    return 'Please enter a valid email address, or leave it blank.';
  }
  const dateError = travelDateError(input.travelDate ?? '');
  if (dateError) return dateError;
  if (
    input.travellers !== undefined &&
    (!Number.isInteger(input.travellers) ||
      input.travellers < 1 ||
      input.travellers > 50)
  ) {
    return 'Travellers must be a whole number between 1 and 50.';
  }
  return null;
}

/**
 * Submit an enquiry to the website's Leads table. Throws ApiError with a
 * user-safe message. `formRenderedAt` is the ms timestamp captured when
 * the form mounted (server anti-spam field, not user input).
 * `company` is a honeypot and MUST stay empty — never render it as a field.
 */
export async function submitEnquiry(
  input: EnquiryInput,
  formRenderedAt: number,
): Promise<EnquiryResult> {
  const clientError = enquiryValidationError(input);
  if (clientError) throw new ApiError(clientError);

  const body: Record<string, unknown> = {
    name: input.name.trim(),
    phone: digitsOnly(input.phone),
    company: '',
    formRenderedAt,
  };
  if (input.email !== undefined && input.email.trim() !== '') {
    body.email = input.email.trim();
  }
  if (input.packageSlug) body.packageSlug = input.packageSlug;
  if (input.packageName) body.packageName = input.packageName;
  if (input.travelDate !== undefined && input.travelDate.trim() !== '') {
    body.travelDate = input.travelDate.trim();
  }
  if (input.travellers !== undefined) body.travellers = input.travellers;
  if (input.message !== undefined && input.message.trim() !== '') {
    body.message = input.message.trim();
  }

  const result = await postJson<EnquiryResult>('/api/enquiries', body);
  if (!result.ok) throw result.error;
  return result.data;
}

/* ------------------------------ Razorpay -------------------------------- */

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  amountPaise: number;
  currency: 'INR';
  /** Backend-supplied public key id — never hardcode one in app code. */
  keyId: string;
}

/** Client mirror of the create-order validation. Null = valid. */
export function paymentValidationError(
  amount: number,
  phone: string,
  email?: string,
): string | null {
  if (!Number.isFinite(amount) || amount < 1 || amount > 1000000) {
    return 'Amount must be between ₹1 and ₹10,00,000.';
  }
  if (normaliseIndianMobile(phone) === null) {
    return 'Please enter a valid 10-digit Indian mobile number.';
  }
  if (email !== undefined && email.trim() !== '' && !isValidEmail(email)) {
    return 'Please enter a valid email address, or leave it blank.';
  }
  return null;
}

/**
 * Create a LIVE Razorpay order via the website backend (same backend as
 * /pay). Throws ApiError with the server's message where available.
 * Amount is in rupees; the backend returns amountPaise for checkout.
 */
export async function createRazorpayOrder(input: {
  amount: number;
  name?: string;
  phone: string;
  email?: string;
}): Promise<RazorpayOrder> {
  const clientError = paymentValidationError(
    input.amount,
    input.phone,
    input.email,
  );
  if (clientError) throw new ApiError(clientError);

  const body: Record<string, unknown> = {
    amount: input.amount,
    phone: normaliseIndianMobile(input.phone),
  };
  if (input.name !== undefined && input.name.trim() !== '') {
    body.name = input.name.trim();
  }
  if (input.email !== undefined && input.email.trim() !== '') {
    body.email = input.email.trim();
  }

  const result = await postJson<RazorpayOrder>(
    '/api/payments/razorpay/create-order',
    body,
  );
  if (!result.ok) throw result.error;
  if (!result.data.orderId || !result.data.keyId) {
    throw new ApiError(
      'The server returned an incomplete order. Please try again.',
    );
  }
  return result.data;
}

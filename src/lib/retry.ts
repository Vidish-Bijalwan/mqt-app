/**
 * Smart retry helper (v2, item 154).
 *
 * Small, dependency-free retry with backoff for the catalogue / blog /
 * enquiry paths. It never invents data and never swallows the final
 * error: after the last attempt the original error is re-thrown so the
 * caller can show its visible retry UI and the "try WhatsApp instead"
 * fallback. No NetInfo is installed in this app, so connectivity is
 * inferred from fetch success/failure only — never claimed otherwise.
 */

export interface RetryOptions {
  /** Total attempts including the first (default 3). */
  attempts?: number;
  /** Delay before the first retry in ms (default 500). */
  delayMs?: number;
  /** Multiplier applied to the delay after each failure (default 2). */
  backoffFactor?: number;
  /** Called after each failed attempt that will be retried. */
  onRetry?: (attempt: number, error: unknown) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True for errors that look like a network failure (offline, timeout,
 *  DNS, aborted fetch, or the app's own user-safe network messages).
 *  Used only to pick UI copy — it never changes what is retried. */
export function isNetworkLikeError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TypeError') {
      return true;
    }
    return /could not reach|check your connection|timed out|network/i.test(
      error.message,
    );
  }
  return false;
}

/**
 * Run `fn`, retrying on failure up to `attempts` times with exponential
 * backoff. Returns the first success; throws the last error otherwise.
 * The delay is capped at 8s so a retry never stalls the UI for long.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const backoffFactor = options.backoffFactor ?? 2;
  let delay = options.delayMs ?? 500;
  let lastError: unknown = new Error('Retry failed');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        options.onRetry?.(attempt, err);
        await sleep(Math.min(delay, 8000));
        delay *= backoffFactor;
      }
    }
  }
  throw lastError;
}

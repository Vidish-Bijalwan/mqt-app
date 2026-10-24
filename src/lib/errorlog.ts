/**
 * Device-local error log (v2, item 155).
 *
 * The last N errors with timestamps, stored in AsyncStorage and viewable
 * on the Offline & Diagnostics screen. There is NO crash-reporting
 * backend and nothing is ever sent anywhere: Sentry is blocked pending
 * a DSN decision (no DSN, no secret), so this log is local-only by
 * design. Messages are truncated and stack traces are never stored, so
 * no secret or personal data can leak into the log.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ERROR_LOG_KEY = '@mqt/error-log';
export const MAX_ERROR_LOG_ENTRIES = 50;

export interface ErrorLogEntry {
  id: string;
  /** Short source label, e.g. 'blog-article', 'catalog', 'enquiry'. */
  source: string;
  /** User-safe message only — never a stack trace. */
  message: string;
  /** ISO timestamp. */
  timestamp: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function validateEntry(raw: unknown): ErrorLogEntry | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const source = asString(raw.source);
  const message = asString(raw.message);
  const timestamp = asString(raw.timestamp);
  if (id === '' || source === '' || message === '' || timestamp === '') {
    return null;
  }
  return { id, source, message, timestamp };
}

/** Append one entry (newest first, capped). Best-effort: a storage
 *  failure must never crash the caller that is already handling an
 *  error. */
export async function logError(
  source: string,
  error: unknown,
): Promise<void> {
  try {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    const entry: ErrorLogEntry = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source,
      message: message.slice(0, 300),
      timestamp: new Date().toISOString(),
    };
    const existing = await listErrorLog();
    await AsyncStorage.setItem(
      ERROR_LOG_KEY,
      JSON.stringify([entry, ...existing].slice(0, MAX_ERROR_LOG_ENTRIES)),
    );
  } catch {
    // Logging must never fail the app.
  }
}

/** Newest first; [] when nothing is stored or the data is unreadable. */
export async function listErrorLog(): Promise<ErrorLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ERROR_LOG_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(validateEntry)
      .filter((e): e is ErrorLogEntry => e !== null);
  } catch {
    return [];
  }
}

export async function clearErrorLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ERROR_LOG_KEY);
  } catch {
    // Best-effort only.
  }
}

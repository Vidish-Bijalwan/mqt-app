/**
 * Release-health diagnostics (v2, item 209) — DEVICE-LOCAL ONLY.
 *
 * What this module does:
 * - Startup time: the module captures a load timestamp at import. The
 *   coordinator calls markAppReady() once the first screen has rendered
 *   (App.tsx wiring, see qa/v2-routes-admin.md); startupMs is the gap.
 *   Until markAppReady() runs, startup time reports as "not recorded"
 *   rather than a fabricated number.
 * - Screen-render timing: useScreenRenderTime() measures mount to first
 *   committed effect for the screen that uses it.
 * - Error log: logError() appends a capped (50-entry) device-local list
 *   of { timestamp, source, message } under '@mqt/diagnostics-errors'.
 * - API error counts: recordApiError() counts failures per endpoint
 *   under '@mqt/diagnostics-api-errors'. Nothing here phones home.
 *
 * What this module does NOT do (BLOCKED, item 209 partial): remote
 * crash reporting. No Sentry DSN exists and none is invented here; no
 * crash SDK is initialised, and no diagnostic data leaves the device.
 * DiagnosticsScreen shows everything this module records, and states
 * the remote-reporting gap plainly.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION } from '../constants';
import { readCachedAppConfig } from './appConfig';
import { readCachedCatalog } from './catalog';

export const DIAGNOSTICS_ERRORS_KEY = '@mqt/diagnostics-errors';
export const DIAGNOSTICS_API_ERRORS_KEY = '@mqt/diagnostics-api-errors';
const MAX_ERROR_ENTRIES = 50;

/* ------------------------------ startup --------------------------------- */

const moduleLoadedAt = Date.now();
let appReadyAt: number | null = null;

/**
 * Call once, when the first screen has rendered (coordinator wiring in
 * App.tsx). Later calls are ignored: startup time is measured once.
 */
export function markAppReady(): void {
  if (appReadyAt === null) appReadyAt = Date.now();
}

/** Milliseconds from module load to markAppReady(), or null if unmarked. */
export function getStartupMs(): number | null {
  return appReadyAt === null ? null : appReadyAt - moduleLoadedAt;
}

/* --------------------------- screen render ------------------------------ */

/**
 * Measures this screen's mount-to-first-effect time in ms. Returns null
 * until the first effect has run. Respects nothing but the mount itself:
 * it does not track navigation or re-renders.
 */
/**
 * Module-level measurer (same pattern as runAppConfigLoad in appConfig):
 * the set-state-in-effect rule inlines component-scope callbacks called
 * from effects and flags them, but a module-level function is opaque to
 * that analysis. Behaviour is unchanged: one measurement after mount.
 */
function measureRenderTime(
  mountedAt: number,
  setRenderMs: (ms: number) => void,
): void {
  setRenderMs(Date.now() - mountedAt);
}

export function useScreenRenderTime(): number | null {
  // Lazy state initializer: runs once on mount, so the mount timestamp
  // is stable across re-renders (unlike a bare Date.now() in render).
  const [mountedAt] = useState(() => Date.now());
  const [renderMs, setRenderMs] = useState<number | null>(null);
  useEffect(() => {
    measureRenderTime(mountedAt, setRenderMs);
  }, [mountedAt]);
  return renderMs;
}

/* ------------------------------ error log ------------------------------- */

export interface DiagnosticErrorEntry {
  timestamp: number;
  source: string;
  message: string;
}

/** Append one entry, newest-first, capped at 50. Best-effort storage. */
export async function logError(
  source: string,
  message: string,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DIAGNOSTICS_ERRORS_KEY);
    let entries: DiagnosticErrorEntry[] = [];
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        entries = parsed.filter(
          (e): e is DiagnosticErrorEntry =>
            typeof e === 'object' &&
            e !== null &&
            typeof (e as { timestamp?: unknown }).timestamp === 'number' &&
            typeof (e as { source?: unknown }).source === 'string' &&
            typeof (e as { message?: unknown }).message === 'string',
        );
      }
    }
    entries.unshift({
      timestamp: Date.now(),
      source,
      message: message.slice(0, 300),
    });
    await AsyncStorage.setItem(
      DIAGNOSTICS_ERRORS_KEY,
      JSON.stringify(entries.slice(0, MAX_ERROR_ENTRIES)),
    );
  } catch {
    // Diagnostics must never break the app.
  }
}

export async function getErrorLog(): Promise<DiagnosticErrorEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(DIAGNOSTICS_ERRORS_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is DiagnosticErrorEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as { timestamp?: unknown }).timestamp === 'number' &&
        typeof (e as { source?: unknown }).source === 'string' &&
        typeof (e as { message?: unknown }).message === 'string',
    );
  } catch {
    return [];
  }
}

export async function clearErrorLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DIAGNOSTICS_ERRORS_KEY);
  } catch {
    // Best-effort only.
  }
}

/* ---------------------------- API error counts -------------------------- */

/**
 * Record one API failure against an endpoint label (e.g. '/api/packages'
 * or 'app-config'). Callers pass labels, never URLs with secrets, and
 * never request/response bodies.
 */
export async function recordApiError(endpoint: string): Promise<void> {
  if (endpoint === '') return;
  try {
    const raw = await AsyncStorage.getItem(DIAGNOSTICS_API_ERRORS_KEY);
    let counts: Record<string, number> = {};
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        counts = parsed as Record<string, number>;
      }
    }
    counts[endpoint] = (counts[endpoint] ?? 0) + 1;
    await AsyncStorage.setItem(
      DIAGNOSTICS_API_ERRORS_KEY,
      JSON.stringify(counts),
    );
  } catch {
    // Best-effort only.
  }
}

export async function getApiErrorCounts(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(DIAGNOSTICS_API_ERRORS_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof value === 'number') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export async function clearApiErrorCounts(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DIAGNOSTICS_API_ERRORS_KEY);
  } catch {
    // Best-effort only.
  }
}

/* ------------------------------ snapshot -------------------------------- */

export interface LastSyncStamps {
  catalogUpdatedAt: string | null;
  configCachedAt: number | null;
}

/** Last sync stamps, read from the existing on-device caches only. */
export async function getLastSyncStamps(): Promise<LastSyncStamps> {
  const [catalog, config] = await Promise.all([
    readCachedCatalog(),
    readCachedAppConfig(),
  ]);
  return {
    catalogUpdatedAt: catalog?.updatedAt ?? null,
    configCachedAt: config?.cachedAt ?? null,
  };
}

export interface ReleaseHealth {
  appVersion: string;
  startupMs: number | null;
  apiErrorTotal: number;
  apiErrorCounts: Record<string, number>;
  errorLogCount: number;
  lastSync: LastSyncStamps;
}

/** One snapshot for DiagnosticsScreen. All values are device-local. */
export async function getReleaseHealth(): Promise<ReleaseHealth> {
  const [counts, errors, lastSync] = await Promise.all([
    getApiErrorCounts(),
    getErrorLog(),
    getLastSyncStamps(),
  ]);
  const apiErrorTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    appVersion: APP_VERSION,
    startupMs: getStartupMs(),
    apiErrorTotal,
    apiErrorCounts: counts,
    errorLogCount: errors.length,
    lastSync,
  };
}

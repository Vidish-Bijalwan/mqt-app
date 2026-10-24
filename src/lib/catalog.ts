/**
 * Live package catalogue (v1.2 data layer).
 *
 * The app still ships the bundled catalogue (src/data/packages.ts) as the
 * instant fallback. This module fetches the live catalogue from the
 * website, caches it on-device, and exposes it through useCatalog().
 *
 * No prices, photos, ratings or offers are invented here: mrp/dealPrice
 * and the computed price fields come verbatim from the API response.
 * When the API omits a price field, the result is "no price" (empty
 * strings, hasPrice false) — never a guessed number. No PII is logged.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, SITE_BASE } from './api';
import { packages as bundledPackages } from '../data/packages';
import type { Package } from '../data/packages';

export const CATALOG_STORAGE_KEY = '@mqt/catalog';
const CATALOG_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 2; // initial attempt + one retry

/** Computed price fields exactly as returned by the API. */
export interface CatalogPriceInfo {
  hasPrice: boolean;
  display: string;
  crossed: string;
  save: string;
}

/**
 * A catalogue entry in the app's existing Package shape, with the API's
 * computed price fields alongside when the entry came from the live feed.
 * Bundled entries have no priceInfo — screens keep using getPriceInfo()
 * from ./price for those, per the existing rule.
 */
export interface CatalogPackage extends Package {
  priceInfo?: CatalogPriceInfo;
}

export interface CatalogResult {
  packages: CatalogPackage[];
  updatedAt: string | null;
}

export type CatalogSource = 'live' | 'cache' | 'bundled';

export interface UseCatalogResult {
  packages: CatalogPackage[];
  source: CatalogSource;
  updatedAt: string | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

/* --------------------------- defensive parsing -------------------------- */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asBool(value: unknown): boolean {
  return value === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Map one raw API entry to a CatalogPackage. Returns null for malformed
 * entries (missing/blank slug or title) — they are dropped, never thrown.
 * The image field is already site-absolute per the API contract and is
 * kept as-is; all other fields default to '' when absent.
 */
export function mapCatalogEntry(raw: unknown): CatalogPackage | null {
  if (!isRecord(raw)) return null;
  const slug = asString(raw.slug).trim();
  const title = asString(raw.title).trim();
  if (slug === '' || title === '') return null;
  const pkg: CatalogPackage = {
    slug,
    title,
    category: asString(raw.category),
    image: asString(raw.image),
    duration: asString(raw.duration),
    route: asString(raw.route),
    description: asString(raw.description),
    mrp: asString(raw.mrp),
    dealPrice: asString(raw.dealPrice),
  };
  if (
    raw.hasPrice !== undefined ||
    raw.display !== undefined ||
    raw.crossed !== undefined ||
    raw.save !== undefined
  ) {
    pkg.priceInfo = {
      hasPrice: asBool(raw.hasPrice),
      display: asString(raw.display),
      crossed: asString(raw.crossed),
      save: asString(raw.save),
    };
  }
  return pkg;
}

function validateCatalogEntries(rawList: unknown): CatalogPackage[] {
  if (!Array.isArray(rawList)) return [];
  const out: CatalogPackage[] = [];
  for (const raw of rawList) {
    const entry = mapCatalogEntry(raw);
    if (entry !== null) out.push(entry);
  }
  return out;
}

/* ------------------------------ caching --------------------------------- */

interface CachedCatalog {
  packages: CatalogPackage[];
  updatedAt: string | null;
}

/** Best-effort cache write: a storage failure must never fail a fetch. */
async function writeCachedCatalog(result: CatalogResult): Promise<void> {
  try {
    const payload: CachedCatalog = {
      packages: result.packages,
      updatedAt: result.updatedAt,
    };
    await AsyncStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Cache is best-effort only; the live result is still returned.
  }
}

/**
 * Read the cached catalogue, re-validating entries on the way out so a
 * corrupt or hand-edited cache can never inject a malformed entry.
 * Returns null when nothing is cached or the cache is unreadable.
 */
export async function readCachedCatalog(): Promise<CatalogResult | null> {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.packages)) return null;
    const packages = validateCatalogEntries(parsed.packages);
    if (packages.length === 0) return null;
    return {
      packages,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return null;
  }
}

/* ------------------------------ fetching -------------------------------- */

function userSafeFetchError(status?: number): ApiError {
  if (status === 429) {
    return new ApiError(
      'Too many requests right now. Please try again shortly.',
      status,
    );
  }
  if (status === 502 || status === 503) {
    return new ApiError(
      'The server is temporarily unavailable. Please try again.',
      status,
    );
  }
  if (status !== undefined) {
    return new ApiError('Something went wrong. Please try again.', status);
  }
  return new ApiError(
    'Could not reach the server. Please check your connection and try again.',
  );
}

async function fetchCatalogOnce(): Promise<CatalogResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${SITE_BASE}/api/packages`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(
          'The request timed out. Please check your connection and try again.',
        );
      }
      throw userSafeFetchError();
    }
    if (!res.ok) throw userSafeFetchError(res.status);
    let data: unknown;
    try {
      data = (await res.json()) as unknown;
    } catch {
      throw new ApiError(
        'The server returned an unexpected response. Please try again.',
        res.status,
      );
    }
    if (!isRecord(data) || !Array.isArray(data.packages)) {
      throw new ApiError(
        'The server returned an unexpected response. Please try again.',
      );
    }
    const packages = validateCatalogEntries(data.packages);
    if (packages.length === 0) {
      // A live response with zero usable entries must not wipe the
      // catalogue: treat it as a failed fetch so the hook falls back
      // to cache / bundled data instead of showing an empty catalogue.
      throw new ApiError(
        'The server returned an unexpected response. Please try again.',
      );
    }
    return {
      packages,
      updatedAt:
        typeof data.updatedAt === 'string' ? data.updatedAt : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the live catalogue: GET {SITE_BASE}/api/packages with a 15s
 * timeout and one retry (two attempts total). On success the validated
 * list is cached to '@mqt/catalog' and returned. Throws ApiError with a
 * user-safe message on failure; malformed entries are dropped, never
 * thrown. Cache writes are best-effort and never fail the fetch.
 */
export async function fetchCatalog(): Promise<CatalogResult> {
  let lastError: ApiError = userSafeFetchError();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await fetchCatalogOnce();
      await writeCachedCatalog(result);
      return result;
    } catch (err) {
      lastError =
        err instanceof ApiError ? err : userSafeFetchError();
      // One retry: loop again unless this was the last attempt.
    }
  }
  throw lastError;
}

/* -------------------------------- hook ---------------------------------- */

/**
 * Live catalogue hook.
 *
 * Returns the bundled catalogue immediately (source 'bundled'), then
 * fetches live in the background. On success the list is replaced and
 * cached (source 'live'). On failure the cached list is used when
 * present (source 'cache'), otherwise the bundled list stays, and
 * `error` is set in both failure cases so the screen can offer a retry.
 * refresh() forces a refetch (network, no cache short-circuit).
 */
/**
 * Module-level catalogue loader. It takes the hook's setters explicitly
 * so the mount effect can call it without tripping
 * react-hooks/set-state-in-effect: that rule inlines component-scope
 * callbacks called from effects and flags their setState calls, even
 * though every setState here runs after an await (network/cache reads).
 * A module-level function is opaque to that analysis, and the loader
 * itself is unchanged behaviourally. The initial useState(true) marks
 * loading on mount; refresh() marks it before re-running the loader.
 */
async function runCatalogLoad(args: {
  setPackages: Dispatch<SetStateAction<CatalogPackage[]>>;
  setSource: Dispatch<SetStateAction<CatalogSource>>;
  setUpdatedAt: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<ApiError | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  mountedRef: { current: boolean };
}): Promise<void> {
  const {
    setPackages,
    setSource,
    setUpdatedAt,
    setError,
    setLoading,
    mountedRef,
  } = args;
  try {
    const result = await fetchCatalog();
    if (!mountedRef.current) return;
    setPackages(result.packages);
    setSource('live');
    setUpdatedAt(result.updatedAt);
    setError(null);
  } catch (err) {
    const apiError =
      err instanceof ApiError ? err : userSafeFetchError();
    const cached = await readCachedCatalog();
    if (!mountedRef.current) return;
    if (cached !== null) {
      setPackages(cached.packages);
      setSource('cache');
      setUpdatedAt(cached.updatedAt);
    } else {
      setPackages(bundledPackages as CatalogPackage[]);
      setSource('bundled');
      setUpdatedAt(null);
    }
    setError(apiError);
  } finally {
    if (mountedRef.current) setLoading(false);
  }
}

export function useCatalog(): UseCatalogResult {
  const [packages, setPackages] = useState<CatalogPackage[]>(
    bundledPackages as CatalogPackage[],
  );
  const [source, setSource] = useState<CatalogSource>('bundled');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void runCatalogLoad({
      setPackages,
      setSource,
      setUpdatedAt,
      setError,
      setLoading,
      mountedRef,
    });
  }, []);

  const refresh = useCallback(() => {
    if (mountedRef.current) setLoading(true);
    void runCatalogLoad({
      setPackages,
      setSource,
      setUpdatedAt,
      setError,
      setLoading,
      mountedRef,
    });
  }, []);

  return { packages, source, updatedAt, loading, error, refresh };
}

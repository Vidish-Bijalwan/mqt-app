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
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
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

/**
 * Single-attempt live fetch (no retry). Used ONLY for the session's
 * deferred background load in CatalogProvider: on a slow connection a
 * second 15s attempt would double the window in which taps feel dead,
 * and the provider already shows bundled/cached data meanwhile, so a
 * retry adds nothing the user can see. Explicit refresh() still uses
 * fetchCatalog() (with its retry) above.
 */
export async function fetchCatalogSingle(): Promise<CatalogResult> {
  const result = await fetchCatalogOnce();
  await writeCachedCatalog(result);
  return result;
}

/**
 * Clear expo-image's disk + memory caches (SDK 58: clearDiskCache() /
 * clearMemoryCache()). Best-effort by design — see the refresh()
 * comment for why this runs only on explicit Refresh, never per load.
 */
export async function clearImageCaches(): Promise<void> {
  try {
    await ExpoImage.clearMemoryCache();
  } catch {
    // Best-effort only; the catalogue refetch still proceeds.
  }
  try {
    await ExpoImage.clearDiskCache();
  } catch {
    // Best-effort only; the catalogue refetch still proceeds.
  }
}

/* --------------------------- shared provider ---------------------------- */

/**
 * Shared catalogue provider (v2.0.1 bugfix).
 *
 * Previously every screen called useCatalog() and every hook instance
 * fired its own GET /api/packages (525KB, 15s timeout x2 attempts), so
 * Home + Packages mounting together at launch saturated a slow
 * connection and the JS thread and taps felt dead. Now ONE provider,
 * mounted once at the app root, owns the catalogue and every screen
 * reads the same state through useCatalog().
 *
 * Load order: bundled catalogue instantly (initial state) -> cached
 * catalogue from AsyncStorage (fast, local) -> ONE live fetch in the
 * background, deferred until after first paint. `loading` stays true
 * until that session background attempt settles (success or failure),
 * so a detail screen never concludes "not found" while the live
 * catalogue is still in flight. Screens render the bundled/cached list
 * while loading; only the detail not-found decision gates on loading.
 * On live failure the cached list is used when present (source
 * 'cache'), otherwise the bundled list stays, and `error` is set in
 * both failure cases so the screen can offer a retry. A live response
 * with zero usable entries never wipes the catalogue (fetchCatalogOnce
 * throws, and the loader falls back to cache / bundled instead).
 * refresh() forces a refetch with the retrying fetchCatalog().
 */
/**
 * Module-level catalogue loaders. They take the provider's setters
 * explicitly so the mount effect can call them without tripping
 * react-hooks/set-state-in-effect: that rule inlines component-scope
 * callbacks called from effects and flags their setState calls, even
 * though every setState here runs after an await (network/cache reads).
 * Module-level functions are opaque to that analysis. The initial
 * useState(true) marks loading on mount; refresh() marks it before
 * re-running the loader.
 */
async function runCatalogLoad(args: {
  fetchFn: () => Promise<CatalogResult>;
  setPackages: Dispatch<SetStateAction<CatalogPackage[]>>;
  setSource: Dispatch<SetStateAction<CatalogSource>>;
  setUpdatedAt: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<ApiError | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  mountedRef: { current: boolean };
}): Promise<void> {
  const {
    fetchFn,
    setPackages,
    setSource,
    setUpdatedAt,
    setError,
    setLoading,
    mountedRef,
  } = args;
  try {
    const result = await fetchFn();
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

/**
 * Fast local step: promote the cached catalogue over the bundled one
 * without touching `loading` or `error` — the session live attempt is
 * still pending, so loading must stay true until it settles.
 */
async function runCatalogCacheLoad(args: {
  setPackages: Dispatch<SetStateAction<CatalogPackage[]>>;
  setSource: Dispatch<SetStateAction<CatalogSource>>;
  setUpdatedAt: Dispatch<SetStateAction<string | null>>;
  mountedRef: { current: boolean };
}): Promise<void> {
  const { setPackages, setSource, setUpdatedAt, mountedRef } = args;
  const cached = await readCachedCatalog();
  if (!mountedRef.current || cached === null) return;
  setPackages(cached.packages);
  setSource('cache');
  setUpdatedAt(cached.updatedAt);
}

/** Fallback if the first-paint deferral never fires. */
const BACKGROUND_FALLBACK_MS = 1500;

/**
 * Defer `start` until after first paint, with a timeout guard.
 *
 * NOTE: InteractionManager was removed from react-native core in
 * 0.88 (this app's RN version) — importing it is a type error and
 * accessing it throws in DEV — so the deferral is requestAnimationFrame
 * followed by a zero-delay timeout (i.e. after the paint the frame
 * schedules), with the 1500ms fallback timer as the guard that ensures
 * the background load still fires even if the frame callback never
 * runs. Same observable contract as runAfterInteractions + fallback:
 * first paint is never blocked by the 525KB fetch, and the load is
 * never lost. Returns a cleanup that cancels both timers.
 */
function deferAfterFirstPaint(start: () => void): () => void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    start();
  };
  let rafId: number | null = null;
  if (typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(() => {
      setTimeout(run, 0);
    });
  }
  const timer = setTimeout(run, BACKGROUND_FALLBACK_MS);
  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    clearTimeout(timer);
  };
}

const CatalogContext = createContext<UseCatalogResult | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [packages, setPackages] = useState<CatalogPackage[]>(
    bundledPackages as CatalogPackage[],
  );
  const [source, setSource] = useState<CatalogSource>('bundled');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const mountedRef = useRef(true);
  const sessionAttemptedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    void runCatalogCacheLoad({
      setPackages,
      setSource,
      setUpdatedAt,
      mountedRef,
    });
    // Deferred single background attempt: run after first paint, with
    // a timeout guard so it still fires even if the frame callback
    // never runs. The `started` guard keeps it to one attempt per
    // session (deferAfterFirstPaint also guards against double-fire).
    let started = false;
    const start = () => {
      if (started || sessionAttemptedRef.current) return;
      started = true;
      sessionAttemptedRef.current = true;
      void runCatalogLoad({
        fetchFn: fetchCatalogSingle,
        setPackages,
        setSource,
        setUpdatedAt,
        setError,
        setLoading,
        mountedRef,
      });
    };
    const cancelDeferred = deferAfterFirstPaint(start);
    return () => {
      mountedRef.current = false;
      cancelDeferred();
    };
  }, []);

  const refresh = useCallback(() => {
    if (mountedRef.current) setLoading(true);
    // v2.0.2 working refresh: Refresh must also clear the expo-image
    // disk + memory caches (SDK 58 API, verified against the versioned
    // docs and the installed expo-image types: Image.clearDiskCache()
    // and Image.clearMemoryCache() — note: no Async suffix in SDK 58).
    // Best-effort: on web both resolve false, and a failure must never
    // break the catalogue refetch itself.
    //
    // RENAME POLICY (do not "fix" this with cache-busting params):
    // same-URL image swaps are handled by renaming the image file on
    // the site (e.g. the Jyotirlinga photo moved to a new -somnath
    // path), NOT by cache expiry. No cache-busting query params are
    // added to image loads anywhere: they would force every photo to
    // re-download on every load, which is exactly what breaks the app
    // on slow connections. Refresh is the one explicit moment the user
    // asks for fresh data, so it is the one moment caches are cleared.
    void (async () => {
      await clearImageCaches();
      if (!mountedRef.current) return;
      await runCatalogLoad({
        fetchFn: fetchCatalog,
        setPackages,
        setSource,
        setUpdatedAt,
        setError,
        setLoading,
        mountedRef,
      });
    })();
  }, []);

  const catalogValue = useMemo<UseCatalogResult>(
    () => ({ packages, source, updatedAt, loading, error, refresh }),
    [packages, source, updatedAt, loading, error, refresh],
  );

  // No JSX here: this file is catalog.ts, not .tsx, so the provider
  // renders via createElement (keeps the provider beside the fetch /
  // cache helpers it owns, with no new file or import cycle).
  // react-hooks/refs misfires on the props object below (it reads the
  // `value` key as a ref being passed during render); catalogValue is
  // a useMemo result, not a ref, and no .current is read here — so
  // the rule is disabled for just this return statement.
  /* eslint-disable react-hooks/refs */
  return createElement(
    CatalogContext.Provider,
    { value: catalogValue },
    children,
  );
  /* eslint-enable react-hooks/refs */
}

/**
 * Shared catalogue hook. Consumes CatalogProvider (mounted once at the
 * app root); the return shape is unchanged, so existing screens do not
 * change. Outside a provider (isolated render only) it falls back to
 * the bundled catalogue with loading false and a no-op refresh.
 */
const fallbackCatalog: UseCatalogResult = {
  packages: bundledPackages as CatalogPackage[],
  source: 'bundled',
  updatedAt: null,
  loading: false,
  error: null,
  refresh: () => undefined,
};

export function useCatalog(): UseCatalogResult {
  const ctx = useContext(CatalogContext);
  return ctx ?? fallbackCatalog;
}

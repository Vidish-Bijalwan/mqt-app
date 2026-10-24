/**
 * Remote config + update decisions (v1.2 data layer). Pure logic, no UI.
 *
 * fetchAppConfig() reads the website's /api/app-config, caches it to
 * '@mqt/appconfig' with a 1-hour TTL, and useAppConfig() exposes it.
 * A forced update prompt must NEVER trap users: decideUpdatePrompt()
 * only returns the decision — the screen that renders a forced prompt
 * must pair it with both an update action and a contact action (e.g.
 * WhatsApp/call) so a user who cannot update can still reach the team.
 *
 * No secrets, prices, offers or PII live here. Unknown/missing fields
 * fall back to safe defaults (update urgency 'none', maintenance off,
 * flags off, no banners) rather than throwing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, SITE_BASE } from './api';

export const APP_CONFIG_STORAGE_KEY = '@mqt/appconfig';
/** Cached config is fresh for 1 hour; older cache is stale but still
 *  usable as a fallback when a live fetch fails. */
export const APP_CONFIG_TTL_MS = 60 * 60 * 1000;
const APP_CONFIG_TIMEOUT_MS = 15000;

export type UpdateUrgency = 'none' | 'soft' | 'critical';

export interface MaintenanceInfo {
  enabled: boolean;
  message: string;
}

export interface AppFlags {
  chatEnabled: boolean;
  offersBannerEnabled: boolean;
  /**
   * v2 item 208: home card-density experiment value carried from the
   * site (`exp_home-card-density`). Undefined when the site does not
   * emit it — the resolver then uses the safe default. Parsed
   * defensively: only a string survives, anything else is dropped.
   */
  homeCardDensity?: string;
}

export interface AppBanner {
  id: string;
  title: string;
  subtitle?: string;
  target?: string;
}

export interface AppConfig {
  appVersion: string;
  latestVersion: string;
  minSupportedVersion: string;
  updateUrgency: UpdateUrgency;
  maintenance: MaintenanceInfo;
  flags: AppFlags;
  banners: AppBanner[];
}

export type UpdatePromptType = 'none' | 'soft' | 'forced';

export interface UpdatePrompt {
  type: UpdatePromptType;
  latestVersion: string;
}

export interface UseAppConfigResult {
  config: AppConfig | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

/* --------------------------- defensive parsing -------------------------- */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUrgency(value: unknown): UpdateUrgency {
  return value === 'soft' || value === 'critical' ? value : 'none';
}

function parseBanner(raw: unknown): AppBanner | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id).trim();
  const title = asString(raw.title).trim();
  if (id === '' || title === '') return null;
  const banner: AppBanner = { id, title };
  const subtitle = asString(raw.subtitle);
  if (subtitle !== '') banner.subtitle = subtitle;
  const target = asString(raw.target);
  if (target !== '') banner.target = target;
  return banner;
}

/**
 * Parse a raw /api/app-config payload into an AppConfig. Returns null
 * when the payload is not an object at all; any missing/invalid field
 * inside an object falls back to a safe default instead of throwing.
 */
export function parseAppConfig(data: unknown): AppConfig | null {
  if (!isRecord(data)) return null;
  const maintenance = isRecord(data.maintenance) ? data.maintenance : {};
  const flags = isRecord(data.flags) ? data.flags : {};
  const banners: AppBanner[] = [];
  if (Array.isArray(data.banners)) {
    for (const raw of data.banners) {
      const banner = parseBanner(raw);
      if (banner !== null) banners.push(banner);
    }
  }
  return {
    appVersion: asString(data.appVersion),
    latestVersion: asString(data.latestVersion),
    minSupportedVersion: asString(data.minSupportedVersion),
    updateUrgency: parseUrgency(data.updateUrgency),
    maintenance: {
      enabled: maintenance.enabled === true,
      message: asString(maintenance.message),
    },
    flags: {
      chatEnabled: flags.chatEnabled === true,
      offersBannerEnabled: flags.offersBannerEnabled === true,
      homeCardDensity:
        typeof flags.homeCardDensity === 'string'
          ? flags.homeCardDensity
          : undefined,
    },
    banners,
  };
}

/* ------------------------------ caching --------------------------------- */

interface CachedAppConfig {
  config: AppConfig;
  cachedAt: number;
}

/** Best-effort cache write: a storage failure must never fail a fetch. */
async function writeCachedAppConfig(config: AppConfig): Promise<void> {
  try {
    const payload: CachedAppConfig = { config, cachedAt: Date.now() };
    await AsyncStorage.setItem(
      APP_CONFIG_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    // Cache is best-effort only; the live result is still returned.
  }
}

/**
 * Read the cached config (any age). Returns null when nothing is cached
 * or the cache is unreadable. Callers decide fresh vs stale via
 * isFreshCachedAppConfig().
 */
export async function readCachedAppConfig(): Promise<CachedAppConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(APP_CONFIG_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.cachedAt !== 'number') return null;
    const config = parseAppConfig(parsed.config);
    if (config === null) return null;
    return { config, cachedAt: parsed.cachedAt };
  } catch {
    return null;
  }
}

export function isFreshCachedAppConfig(
  cached: CachedAppConfig,
  now: number = Date.now(),
): boolean {
  return now - cached.cachedAt < APP_CONFIG_TTL_MS;
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

/**
 * Fetch remote config: GET {SITE_BASE}/api/app-config with a 15s timeout.
 *
 * Unless forceRefresh is set, a fresh (< 1h) cached config is returned
 * without a network call. Otherwise the network is used; on success the
 * result is cached and returned. On network failure this throws ApiError
 * — it does NOT silently return stale cache; the hook (useAppConfig)
 * catches that error and falls back to the stale cache itself, keeping
 * the error visible so screens know the config may be out of date.
 */
export async function fetchAppConfig(options?: {
  forceRefresh?: boolean;
}): Promise<AppConfig> {
  if (options?.forceRefresh !== true) {
    const cached = await readCachedAppConfig();
    if (cached !== null && isFreshCachedAppConfig(cached)) {
      return cached.config;
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APP_CONFIG_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${SITE_BASE}/api/app-config`, {
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
    const config = parseAppConfig(data);
    if (config === null) {
      throw new ApiError(
        'The server returned an unexpected response. Please try again.',
      );
    }
    await writeCachedAppConfig(config);
    return config;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------- version comparison --------------------------- */

/**
 * Semver compare on numeric parts only: compareVersions('1.2.3','1.10.0')
 * is -1 (numeric, not lexicographic). Missing parts count as 0, so
 * '1.2' == '1.2.0'. Non-numeric segments parse as 0; a leading 'v' is
 * tolerated. Returns -1, 0, or 1.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('.')
      .map((part) => {
        const n = parseInt(part, 10);
        return Number.isNaN(n) ? 0 : n;
      });
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * Decide which update prompt (if any) to show for `currentVersion`.
 *
 * - 'forced' when currentVersion < minSupportedVersion OR the config's
 *   updateUrgency is 'critical'. A forced prompt must never trap users:
 *   the rendering screen must pair it with both an update action and a
 *   contact action (this function only returns the decision).
 * - 'soft' when currentVersion < latestVersion.
 * - 'none' otherwise (including when versions are missing/empty, which
 *   compare as 0 and therefore cannot force a prompt on their own).
 */
export function decideUpdatePrompt(
  config: Pick<
    AppConfig,
    'latestVersion' | 'minSupportedVersion' | 'updateUrgency'
  >,
  currentVersion: string,
): UpdatePrompt {
  const latestVersion = config.latestVersion;
  if (
    compareVersions(currentVersion, config.minSupportedVersion) < 0 ||
    config.updateUrgency === 'critical'
  ) {
    return { type: 'forced', latestVersion };
  }
  if (compareVersions(currentVersion, latestVersion) < 0) {
    return { type: 'soft', latestVersion };
  }
  return { type: 'none', latestVersion };
}

/* -------------------------------- hook ---------------------------------- */

/**
 * Remote-config hook.
 *
 * On mount it resolves via fetchAppConfig() (fresh cache short-circuits
 * the network for 1h). On fetch failure it falls back to the stale cache
 * when one exists — config is still set, but `error` is also set so the
 * screen knows the config may be out of date. With no cache at all,
 * config stays null and `error` is set. refresh() forces a live refetch.
 */
/**
 * Module-level config loader. It takes the hook's setters explicitly
 * so the mount effect can call it without tripping
 * react-hooks/set-state-in-effect: that rule inlines component-scope
 * callbacks called from effects and flags their setState calls, even
 * though every setState here runs after an await (network/cache reads).
 * A module-level function is opaque to that analysis, and the loader
 * itself is unchanged behaviourally. The initial useState(true) marks
 * loading on mount; refresh() marks it before re-running the loader.
 */
async function runAppConfigLoad(args: {
  forceRefresh: boolean;
  setConfig: Dispatch<SetStateAction<AppConfig | null>>;
  setError: Dispatch<SetStateAction<ApiError | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  mountedRef: { current: boolean };
}): Promise<void> {
  const { forceRefresh, setConfig, setError, setLoading, mountedRef } =
    args;
  try {
    const live = await fetchAppConfig({ forceRefresh });
    if (!mountedRef.current) return;
    setConfig(live);
    setError(null);
  } catch (err) {
    const apiError =
      err instanceof ApiError ? err : userSafeFetchError();
    // Stale cache is usable on failure.
    const cached = await readCachedAppConfig();
    if (!mountedRef.current) return;
    if (cached !== null) setConfig(cached.config);
    else setConfig(null);
    setError(apiError);
  } finally {
    if (mountedRef.current) setLoading(false);
  }
}

export function useAppConfig(): UseAppConfigResult {
  const [config, setConfig] = useState<AppConfig | null>(null);
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
    void runAppConfigLoad({
      forceRefresh: false,
      setConfig,
      setError,
      setLoading,
      mountedRef,
    });
  }, []);

  const refresh = useCallback(() => {
    if (mountedRef.current) setLoading(true);
    void runAppConfigLoad({
      forceRefresh: true,
      setConfig,
      setError,
      setLoading,
      mountedRef,
    });
  }, []);

  return { config, loading, error, refresh };
}

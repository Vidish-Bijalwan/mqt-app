/**
 * Search, filter, sort, collections and persistence for Category C
 * (v1.3 items 21–26). Pure helpers operate on catalogue entries only —
 * no field is invented: every helper below reads slug, title, category,
 * duration, route, description, or the real price (priceInfo on live
 * entries, getPriceInfo() on bundled entries).
 *
 * ITEM 21 — TYPO TOLERANCE, stated plainly:
 * A query is split into tokens (lowercased, diacritics stripped,
 * punctuation collapsed). A package matches when EVERY query token
 * matches at least one searchable field token (title, route,
 * description, category) by EITHER (a) substring containment, OR
 * (b) Levenshtein edit distance <= 1 for tokens of length >= 4, and
 * <= 2 for tokens of length >= 8. Short tokens (< 4 chars) get exact
 * substring only, so "go" never fuzzy-matches "do". This is token-level
 * tolerance, not spell correction: no suggestion or rewrite is offered.
 *
 * ITEM 22 — FILTERS OFFERED, and the ones deliberately NOT offered:
 * Offered: category (real categories from the catalogue), budget bands
 * (from real prices; unpriced packages land in the "Price on enquiry"
 * bucket, never in a numeric band), duration bands (parsed "N Days"
 * from the duration string; empty/unparseable durations land in the
 * "Duration not listed" bucket, never guessed).
 * NOT offered: month of travel, group type, transport mode — the
 * catalogue has no field for any of them, so offering them as filters
 * would filter on invented data.
 *
 * ITEM 23 — SORTS OFFERED, and the ones deliberately NOT offered:
 * Offered: price low→high, price high→low, duration short→long,
 * duration long→short, title A–Z. Unpriced packages sort last in both
 * price directions; unparseable durations sort last in both duration
 * directions (they are not silently dropped).
 * NOT offered: "real enquiry popularity" (no per-package enquiry counts
 * in the catalogue) and "newest" (no published/added date field).
 *
 * ITEM 26 — COLLECTIONS (computed from real catalogue data only; no
 * hardcoded package lists):
 * - "Trips under ₹25,000": real deal price < 25000.
 * - "Weekend getaways": parsed duration <= 3 days, labelled with that
 *   bound so the label is the rule, not a marketing claim.
 * - "Pilgrimage circuits": category exactly "Pilgrimage" — the
 *   catalogue's pilgrimage category (it holds most Chardham/Yatra
 *   packages, e.g. Chardham Yatra and Badrinath Kedarnath Yatra).
 *   Chardham-titled packages filed under North India / South India /
 *   India Tours are NOT reclassified by title keyword: reclassifying
 *   by keyword would invent a category the catalogue did not assign.
 *
 * ITEM 27 — MAP DISCOVERY: DEFERRED. No per-package coordinates exist
 * in any catalogue field (checked: slug, title, category, image,
 * duration, route, description, mrp/dealPrice, priceInfo). Plotting
 * pins would require invented locations, so no map library is added
 * and no map screen ships in this batch.
 *
 * ITEM 30 — VOICE SEARCH: DEFERRED. expo-speech is text-to-speech
 * only; @react-native-voice/voice is a legacy bridge module. The only
 * maintained SDK-58-versioned recogniser found, expo-speech-recognition
 * 58.0.0, is a native TurboModule needing a config plugin, the
 * RECORD_AUDIO permission and a new native build — native risk that
 * cannot be verified through this batch's web-export verification, and
 * no fake "listening" UI is shipped in its place.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CatalogPackage } from './catalog';
import { getPriceInfo, parseINR } from './price';
import type { Package } from '../data/packages';

/* ------------------------------ search ---------------------------------- */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const norm = normalize(text);
  return norm === '' ? [] : norm.split(' ');
}

/** Small Levenshtein implementation (tokens are short; no dependency). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Max edit distance allowed for a query token (see header comment). */
function allowedDistance(token: string): number {
  if (token.length >= 8) return 2;
  if (token.length >= 4) return 1;
  return 0;
}

function tokenMatchesField(queryToken: string, fieldTokens: string[]): boolean {
  const maxDist = allowedDistance(queryToken);
  for (const fieldToken of fieldTokens) {
    if (fieldToken.includes(queryToken) || queryToken.includes(fieldToken)) {
      return true;
    }
    if (maxDist > 0 && levenshtein(queryToken, fieldToken) <= maxDist) {
      return true;
    }
  }
  return false;
}

/** True when every query token matches title, route, description or category. */
export function matchesSearch(pkg: Package, query: string): boolean {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return true;
  const fieldTokens = [
    ...tokenize(pkg.title),
    ...tokenize(pkg.route),
    ...tokenize(pkg.description),
    ...tokenize(pkg.category),
  ];
  return queryTokens.every((t) => tokenMatchesField(t, fieldTokens));
}

export function searchPackages<T extends Package>(
  packages: T[],
  query: string,
): T[] {
  if (query.trim() === '') return packages;
  return packages.filter((pkg) => matchesSearch(pkg, query));
}

/* ------------------------------ prices ---------------------------------- */

/**
 * The one price accessor for search/filter/sort: live entries use their
 * priceInfo, bundled entries use getPriceInfo(). Returns null when the
 * package genuinely has no price — never a guessed number.
 */
export function getSearchPrice(pkg: CatalogPackage): {
  hasPrice: boolean;
  deal: number;
  display: string;
} {
  if (pkg.priceInfo !== undefined) {
    return {
      hasPrice: pkg.priceInfo.hasPrice,
      deal: parseINR(pkg.priceInfo.display),
      display: pkg.priceInfo.hasPrice ? pkg.priceInfo.display : '',
    };
  }
  const info = getPriceInfo(pkg);
  return { hasPrice: info.hasPrice, deal: info.deal, display: info.display };
}

/* ----------------------------- durations -------------------------------- */

/**
 * Parse "N Days" out of a duration string ("11 Days / 10 Nights" → 11,
 * "2 Nights / 3 Days" → 3). Falls back to a "ND/"-style day count when
 * no "Days" token exists. Returns null for empty/unparseable strings —
 * the caller buckets those as "Duration not listed", never as 0 days.
 */
export function parseDurationDays(duration: string): number | null {
  const daysMatch = duration.match(/(\d+)\s*days?/i);
  if (daysMatch !== null) return parseInt(daysMatch[1], 10);
  const shortMatch = duration.match(/(\d+)\s*D(?:\/|$)/);
  if (shortMatch !== null) return parseInt(shortMatch[1], 10);
  return null;
}

/* ------------------------------ filters --------------------------------- */

export type BudgetBandId =
  | 'under25k'
  | '25to50k'
  | '50to100k'
  | 'over100k'
  | 'enquiry';

export interface BudgetBand {
  id: BudgetBandId;
  label: string;
  /** Inclusive lower bound in ₹; null = no numeric band (enquiry). */
  min: number | null;
  /** Exclusive upper bound in ₹; null = unbounded above. */
  max: number | null;
}

export const BUDGET_BANDS: BudgetBand[] = [
  { id: 'under25k', label: 'Under ₹25,000', min: null, max: 25000 },
  { id: '25to50k', label: '₹25,000 – ₹50,000', min: 25000, max: 50000 },
  { id: '50to100k', label: '₹50,000 – ₹1,00,000', min: 50000, max: 100000 },
  { id: 'over100k', label: 'Over ₹1,00,000', min: 100000, max: null },
  { id: 'enquiry', label: 'Price on enquiry', min: null, max: null },
];

export type DurationBandId = 'upto3' | '4to7' | '8plus' | 'notListed';

export interface DurationBand {
  id: DurationBandId;
  label: string;
  min: number | null;
  max: number | null;
}

export const DURATION_BANDS: DurationBand[] = [
  { id: 'upto3', label: 'Up to 3 days', min: null, max: 4 },
  { id: '4to7', label: '4 – 7 days', min: 4, max: 8 },
  { id: '8plus', label: '8+ days', min: 8, max: null },
  { id: 'notListed', label: 'Duration not listed', min: null, max: null },
];

export interface SearchFilters {
  category: string | null;
  budget: BudgetBandId | 'all';
  duration: DurationBandId | 'all';
}

export const DEFAULT_FILTERS: SearchFilters = {
  category: null,
  budget: 'all',
  duration: 'all',
};

function inBudget(deal: number, hasPrice: boolean, band: BudgetBand): boolean {
  if (band.id === 'enquiry') return !hasPrice;
  if (!hasPrice) return false;
  if (band.min !== null && deal < band.min) return false;
  if (band.max !== null && deal >= band.max) return false;
  return true;
}

function inDuration(days: number | null, band: DurationBand): boolean {
  if (band.id === 'notListed') return days === null;
  if (days === null) return false;
  if (band.min !== null && days < band.min) return false;
  if (band.max !== null && days >= band.max) return false;
  return true;
}

export function applyFilters<T extends CatalogPackage>(
  packages: T[],
  filters: SearchFilters,
): T[] {
  return packages.filter((pkg) => {
    if (filters.category !== null && pkg.category !== filters.category) {
      return false;
    }
    if (filters.budget !== 'all') {
      const band = BUDGET_BANDS.find((b) => b.id === filters.budget);
      const price = getSearchPrice(pkg);
      if (band === undefined || !inBudget(price.deal, price.hasPrice, band)) {
        return false;
      }
    }
    if (filters.duration !== 'all') {
      const band = DURATION_BANDS.find((b) => b.id === filters.duration);
      const days = parseDurationDays(pkg.duration);
      if (band === undefined || !inDuration(days, band)) return false;
    }
    return true;
  });
}

/** Real categories present in this catalogue, in first-seen order. */
export function categoriesOf(packages: Package[]): string[] {
  return Array.from(new Set(packages.map((p) => p.category))).filter(
    (c) => c !== '',
  );
}

/* ------------------------------- sorts ---------------------------------- */

export type SortId =
  | 'price-asc'
  | 'price-desc'
  | 'duration-asc'
  | 'duration-desc'
  | 'title-az';

export const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'duration-asc', label: 'Duration: short to long' },
  { id: 'duration-desc', label: 'Duration: long to short' },
  { id: 'title-az', label: 'Title: A to Z' },
];

export function sortPackages<T extends CatalogPackage>(
  packages: T[],
  sort: SortId,
): T[] {
  const sorted = [...packages];
  switch (sort) {
    case 'price-asc':
      sorted.sort((a, b) => {
        const pa = getSearchPrice(a);
        const pb = getSearchPrice(b);
        if (pa.hasPrice !== pb.hasPrice) return pa.hasPrice ? -1 : 1;
        return pa.deal - pb.deal;
      });
      break;
    case 'price-desc':
      sorted.sort((a, b) => {
        const pa = getSearchPrice(a);
        const pb = getSearchPrice(b);
        if (pa.hasPrice !== pb.hasPrice) return pa.hasPrice ? -1 : 1;
        return pb.deal - pa.deal;
      });
      break;
    case 'duration-asc':
      sorted.sort((a, b) => {
        const da = parseDurationDays(a.duration);
        const db = parseDurationDays(b.duration);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
      break;
    case 'duration-desc':
      sorted.sort((a, b) => {
        const da = parseDurationDays(a.duration);
        const db = parseDurationDays(b.duration);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return db - da;
      });
      break;
    case 'title-az':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }
  return sorted;
}

/** Full pipeline: search → filter → sort. */
export function applySearch<T extends CatalogPackage>(
  packages: T[],
  query: string,
  filters: SearchFilters,
  sort: SortId,
): T[] {
  return sortPackages(applyFilters(searchPackages(packages, query), filters), sort);
}

/* ---------------------------- collections ------------------------------- */

export interface Collection {
  id: string;
  title: string;
  /** The rule, in words, so the label can never outrun the data. */
  rule: string;
  packages: CatalogPackage[];
}

export function getCollections(packages: CatalogPackage[]): Collection[] {
  return [
    {
      id: 'under25k',
      title: 'Trips under ₹25,000',
      rule: 'Real deal price under ₹25,000.',
      packages: packages.filter((pkg) => {
        const price = getSearchPrice(pkg);
        return price.hasPrice && price.deal < 25000;
      }),
    },
    {
      id: 'weekend',
      title: 'Weekend getaways',
      rule: 'Duration of 3 days or less.',
      packages: packages.filter((pkg) => {
        const days = parseDurationDays(pkg.duration);
        return days !== null && days <= 3;
      }),
    },
    {
      id: 'pilgrimage',
      title: 'Pilgrimage circuits',
      rule: 'Packages in the Pilgrimage category.',
      packages: packages.filter((pkg) => pkg.category === 'Pilgrimage'),
    },
  ];
}

/* ------------------------- persistence (item 24) ------------------------ */

export interface PersistedSearchState {
  query: string;
  filters: SearchFilters;
  sort: SortId;
}

export const SEARCH_STATE_KEY = '@mqt/search-state';
export const SEARCH_HISTORY_KEY = '@mqt/search-history';
export const SAVED_SEARCHES_KEY = '@mqt/saved-searches';
export const COMPARE_KEY = '@mqt/compare';

const MAX_HISTORY = 10;
const MAX_SAVED_SEARCHES = 20;
const MAX_COMPARE = 3;

export const DEFAULT_SEARCH_STATE: PersistedSearchState = {
  query: '',
  filters: DEFAULT_FILTERS,
  sort: 'price-asc',
};

function isValidFilters(value: unknown): value is SearchFilters {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as SearchFilters;
  if (f.category !== null && typeof f.category !== 'string') return false;
  if (
    f.budget !== 'all' &&
    BUDGET_BANDS.every((b) => b.id !== f.budget)
  ) {
    return false;
  }
  if (
    f.duration !== 'all' &&
    DURATION_BANDS.every((b) => b.id !== f.duration)
  ) {
    return false;
  }
  return true;
}

export async function saveSearchState(
  state: PersistedSearchState,
): Promise<void> {
  try {
    await AsyncStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is best-effort; search still works without it.
  }
}

export async function loadSearchState(): Promise<PersistedSearchState> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_STATE_KEY);
    if (raw === null) return DEFAULT_SEARCH_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_SEARCH_STATE;
    }
    const p = parsed as Partial<PersistedSearchState>;
    return {
      query: typeof p.query === 'string' ? p.query : '',
      filters: isValidFilters(p.filters) ? p.filters : DEFAULT_FILTERS,
      sort:
        SORT_OPTIONS.some((o) => o.id === p.sort) && p.sort !== undefined
          ? p.sort
          : 'price-asc',
    };
  } catch {
    return DEFAULT_SEARCH_STATE;
  }
}

/* --------------------- history + saved searches (item 25) --------------- */

export async function listSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

export async function addSearchHistory(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed === '') return listSearchHistory();
  const next = [
    trimmed,
    ...(await listSearchHistory()).filter((q) => q !== trimmed),
  ].slice(0, MAX_HISTORY);
  try {
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
  return next;
}

export async function clearSearchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // Best-effort only.
  }
}

export interface SavedSearch {
  id: string;
  query: string;
  filters: SearchFilters;
  sort: SortId;
  /**
   * Price snapshot at save time: slug → display price string ('' when
   * the package had no price). Compared by detectSavedSearchPriceChanges.
   */
  priceSnapshot: Record<string, string>;
  savedAt: string;
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_SEARCHES_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is SavedSearch =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as SavedSearch).id === 'string' &&
        typeof (v as SavedSearch).query === 'string' &&
        isValidFilters((v as SavedSearch).filters) &&
        typeof (v as SavedSearch).priceSnapshot === 'object',
    );
  } catch {
    return [];
  }
}

/**
 * Save the current search, snapshotting the display price of every
 * package it currently matches. Returns the saved entry, or null when
 * an identical search is already saved (no duplicate rows).
 */
export async function saveSavedSearch(
  query: string,
  filters: SearchFilters,
  sort: SortId,
  matched: CatalogPackage[],
): Promise<SavedSearch | null> {
  const existing = await listSavedSearches();
  const duplicate = existing.find(
    (s) =>
      s.query === query &&
      JSON.stringify(s.filters) === JSON.stringify(filters) &&
      s.sort === sort,
  );
  if (duplicate !== undefined) return null;
  const priceSnapshot: Record<string, string> = {};
  for (const pkg of matched) {
    priceSnapshot[pkg.slug] = getSearchPrice(pkg).display;
  }
  const entry: SavedSearch = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    query,
    filters,
    sort,
    priceSnapshot,
    savedAt: new Date().toISOString(),
  };
  const next = [entry, ...existing].slice(0, MAX_SAVED_SEARCHES);
  try {
    await AsyncStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
  return entry;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const next = (await listSavedSearches()).filter((s) => s.id !== id);
  try {
    await AsyncStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
}

export interface SavedSearchPriceChange {
  savedSearchId: string;
  slug: string;
  oldPrice: string;
  newPrice: string;
}

/**
 * PURE price-change detection (item 25): given stored saved searches
 * and the current catalogue, report every snapshotted package whose
 * display price now differs. No storage reads, no network, no
 * notification mechanism — the alert surfacing (push/in-app banner) is
 * wired at integration; this helper only detects. A package that left
 * the catalogue, or had no price at save time and still has none,
 * is not a change; gaining a price from '' counts as one.
 */
export function detectSavedSearchPriceChanges(
  savedSearches: SavedSearch[],
  currentCatalog: CatalogPackage[],
): SavedSearchPriceChange[] {
  const bySlug = new Map(currentCatalog.map((pkg) => [pkg.slug, pkg]));
  const changes: SavedSearchPriceChange[] = [];
  for (const saved of savedSearches) {
    for (const [slug, oldPrice] of Object.entries(saved.priceSnapshot)) {
      const current = bySlug.get(slug);
      if (current === undefined) continue;
      const newPrice = getSearchPrice(current).display;
      if (newPrice !== oldPrice) {
        changes.push({
          savedSearchId: saved.id,
          slug,
          oldPrice,
          newPrice,
        });
      }
    }
  }
  return changes;
}

/* ------------------------- compare selection (item 28) ------------------ */

export async function listCompareSlugs(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(COMPARE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

/**
 * Toggle a slug in the compare set. Max 3 enforced: adding a fourth
 * returns atLimit true and leaves the set unchanged. Returns the new
 * set and whether the toggle hit the limit.
 */
export async function toggleCompareSlug(
  slug: string,
): Promise<{ slugs: string[]; atLimit: boolean }> {
  const current = await listCompareSlugs();
  let next: string[];
  let atLimit = false;
  if (current.includes(slug)) {
    next = current.filter((s) => s !== slug);
  } else if (current.length >= MAX_COMPARE) {
    next = current;
    atLimit = true;
  } else {
    next = [...current, slug];
  }
  try {
    await AsyncStorage.setItem(COMPARE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
  return { slugs: next, atLimit };
}

export async function clearCompareSlugs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(COMPARE_KEY);
  } catch {
    // Best-effort only.
  }
}

/**
 * Device-local wishlist (v1.3 item 29). Slugs only — package data always
 * comes from the catalogue, so a wishlisted package that later changes
 * price or leaves the catalogue can never show stale invented data.
 *
 * Shareable wishlist: the system Share sheet with package names. A
 * per-package site link is included ONLY because the package URL
 * pattern was verified against the live sitemap
 * (https://www.myquicktrippers.com/sitemap.xml, 1031 URLs, fetched
 * 2026-10-24): package entries are
 * https://www.myquicktrippers.com/packages/<slug> — e.g. the bundled
 * slug "10-days-assam-meghalaya-arunachal-pradesh-tour-packages"
 * appears verbatim as /packages/<that slug>. If that pattern ever
 * stops verifying, drop the links and share text-only.
 *
 * Price-drop alerts for the wishlist (backlog item 29's "price-drop
 * alerts" half, like item 25's saved-search alerts) follow the same
 * split as item 25: snapshots are stored here and a pure detection
 * helper is exported; no notification mechanism is invented here —
 * alert surfacing is wired at integration.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CatalogPackage } from './catalog';
import { getSearchPrice } from './search';

export const WISHLIST_KEY = '@mqt/wishlist';
export const WISHLIST_PRICES_KEY = '@mqt/wishlist-prices';

export const SITE_PACKAGE_URL_BASE =
  'https://www.myquicktrippers.com/packages';

export function wishlistPackageUrl(slug: string): string {
  return `${SITE_PACKAGE_URL_BASE}/${slug}`;
}

/** Stored slug list, in the order items were added. Returns [] on any error. */
export async function listWishlist(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(WISHLIST_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

export async function isWishlisted(slug: string): Promise<boolean> {
  return (await listWishlist()).includes(slug);
}

/**
 * Toggle one slug. Returns the new wishlist (the caller renders from
 * this, so the UI can never disagree with storage). Storage failures
 * are best-effort: the in-memory result is still returned.
 */
export async function toggleWishlist(slug: string): Promise<string[]> {
  const current = await listWishlist();
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [...current, slug];
  try {
    await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
  return next;
}

/** Record the current display price for one wishlisted slug. */
export async function setWishlistPriceSnapshot(
  slug: string,
  displayPrice: string,
): Promise<void> {
  try {
    const snapshots = await getWishlistPriceSnapshots();
    snapshots[slug] = displayPrice;
    await AsyncStorage.setItem(
      WISHLIST_PRICES_KEY,
      JSON.stringify(snapshots),
    );
  } catch {
    // Best-effort only.
  }
}

/** Snapshot map: slug → display price string at snapshot time. */
export async function getWishlistPriceSnapshots(): Promise<
  Record<string, string>
> {
  try {
    const raw = await AsyncStorage.getItem(WISHLIST_PRICES_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export interface WishlistPriceChange {
  slug: string;
  oldPrice: string;
  newPrice: string;
}

/**
 * PURE wishlist price-change detection: compare stored snapshots
 * against the current catalogue. No storage reads inside this helper
 * beyond what the caller passed in — callers load snapshots with
 * getWishlistPriceSnapshots() first. Same surfacing split as item 25:
 * detection here, notification wiring at integration.
 */
export function detectWishlistPriceChanges(
  snapshots: Record<string, string>,
  currentCatalog: CatalogPackage[],
): WishlistPriceChange[] {
  const bySlug = new Map(currentCatalog.map((pkg) => [pkg.slug, pkg]));
  const changes: WishlistPriceChange[] = [];
  for (const [slug, oldPrice] of Object.entries(snapshots)) {
    const current = bySlug.get(slug);
    if (current === undefined) continue;
    const newPrice = getSearchPrice(current).display;
    if (newPrice !== oldPrice) {
      changes.push({ slug, oldPrice, newPrice });
    }
  }
  return changes;
}

/**
 * Share text for a wishlist: one line per package — name, price when
 * the package genuinely has one, and the verified site link. No
 * invented prices: an unpriced package gets no price fragment at all.
 */
export function buildWishlistShareText(
  items: CatalogPackage[],
): string {
  if (items.length === 0) return 'My My Quick Trippers wishlist is empty.';
  const lines = items.map((pkg) => {
    const price = getSearchPrice(pkg);
    const pricePart = price.hasPrice ? ` — ${price.display}` : '';
    return `${pkg.title}${pricePart}\n${wishlistPackageUrl(pkg.slug)}`;
  });
  return `My My Quick Trippers wishlist:\n\n${lines.join('\n\n')}`;
}

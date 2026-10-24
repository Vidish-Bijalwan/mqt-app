/**
 * Price history per package (v2, item 84).
 *
 * Built ONLY from real stored snapshots — never a prediction, never
 * "book now or wait" advice, and never a price the catalogue did not
 * actually show.
 *
 * Sources, in order:
 * 1. Dated snapshots recorded here (PRICE_HISTORY_KEY) whenever a
 *    package detail is viewed — recordPriceSnapshot() is the hook the
 *    detail screen calls; screens owned by this batch call it on
 *    their own package views, and the coordinator wires the same call
 *    into PackageDetailScreen (whose file this batch must not edit).
 * 2. The wishlist snapshot map (WISHLIST_PRICES_KEY, owned by
 *    src/lib/wishlist.ts — READ here, never edited). That map stores
 *    only a display string with NO date, so it can only seed an
 *    undated "previously observed" comparison, never a dated trend.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WISHLIST_PRICES_KEY } from './wishlist';
import { parseINR, formatINR } from './price';

export const PRICE_HISTORY_KEY = '@mqt/price-history';

export interface PriceSnapshot {
  /** Display string exactly as shown, e.g. "₹40,500". */
  display: string;
  /** Numeric deal parsed from display (0 when unparseable). */
  amount: number;
  /** ISO timestamp of the observation. */
  at: string;
}

function isSnapshot(value: unknown): value is PriceSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as PriceSnapshot;
  return (
    typeof s.display === 'string' &&
    typeof s.amount === 'number' &&
    typeof s.at === 'string'
  );
}

async function readAll(): Promise<Record<string, PriceSnapshot[]>> {
  try {
    const raw = await AsyncStorage.getItem(PRICE_HISTORY_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Record<string, PriceSnapshot[]> = {};
    for (const [slug, list] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (Array.isArray(list)) {
        out[slug] = list.filter(isSnapshot).slice(-50);
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Record the currently displayed price for one package. Appends only
 * when the amount differs from the latest snapshot (repeat views at
 * the same price do not spam the history). Returns the new history.
 */
export async function recordPriceSnapshot(
  slug: string,
  display: string,
): Promise<PriceSnapshot[]> {
  if (display.trim() === '') return listPriceHistory(slug);
  const all = await readAll();
  const history = all[slug] ?? [];
  const amount = parseINR(display);
  const latest = history[history.length - 1];
  if (latest !== undefined && latest.amount === amount) return history;
  const next = [
    ...history,
    { display, amount, at: new Date().toISOString() },
  ].slice(-50);
  all[slug] = next;
  try {
    await AsyncStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(all));
  } catch {
    // Best-effort only.
  }
  return next;
}

/** Dated snapshots for one package, oldest first. [] when none. */
export async function listPriceHistory(
  slug: string,
): Promise<PriceSnapshot[]> {
  const all = await readAll();
  return all[slug] ?? [];
}

/** The wishlist snapshot map (undated, owned by wishlist.ts). */
export async function getWishlistSnapshotDisplay(
  slug: string,
): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(WISHLIST_PRICES_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const value = (parsed as Record<string, unknown>)[slug];
    return typeof value === 'string' && value !== '' ? value : null;
  } catch {
    return null;
  }
}

export type PriceTrend =
  | { kind: 'down' | 'up' | 'same'; text: string }
  | { kind: 'undated'; text: string }
  | { kind: 'none'; text: string };

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * PURE observed-trend text. Dated history: compares the FIRST dated
 * snapshot with the CURRENT display price ("down ₹X since <date>").
 * No dated history but a wishlist snapshot exists: reports the
 * previously observed price with its date explicitly unknown.
 * No prediction and no buy/wait advice is ever produced here.
 */
export function priceTrendText(
  history: PriceSnapshot[],
  currentDisplay: string,
  wishlistDisplay: string | null,
): PriceTrend {
  const current = parseINR(currentDisplay);
  if (history.length > 0) {
    const first = history[0];
    if (first.amount > 0 && current > 0 && first.amount !== current) {
      const diff = Math.abs(first.amount - current);
      return current < first.amount
        ? {
            kind: 'down',
            text: `Down ${formatINR(diff)} since ${formatDate(first.at)} (observed ${first.display}, now ${currentDisplay}).`,
          }
        : {
            kind: 'up',
            text: `Up ${formatINR(diff)} since ${formatDate(first.at)} (observed ${first.display}, now ${currentDisplay}).`,
          };
    }
    return {
      kind: 'same',
      text: `No price change observed since ${formatDate(first.at)} (${first.display}).`,
    };
  }
  if (wishlistDisplay !== null) {
    const old = parseINR(wishlistDisplay);
    if (old > 0 && current > 0 && old !== current) {
      const diff = Math.abs(old - current);
      return {
        kind: 'undated',
        text: `Previously observed at ${wishlistDisplay} (date not recorded); now ${currentDisplay} — a difference of ${formatINR(diff)}.`,
      };
    }
    return {
      kind: 'undated',
      text: `Previously observed at ${wishlistDisplay} (date not recorded); price unchanged.`,
    };
  }
  return {
    kind: 'none',
    text: 'No earlier price has been recorded for this package yet. Future views will build its history.',
  };
}

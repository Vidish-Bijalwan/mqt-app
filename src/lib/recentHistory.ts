/**
 * Recently viewed / compared history (v2, item 88). Device-local,
 * private, clearable. Viewed entries are recorded by this batch's
 * screens (Trips, Planner, TripDetail) whenever they open a package;
 * full coverage of every PackageDetail open needs the coordinator to
 * call recordViewed() from PackageDetailScreen (see
 * qa/v2-routes-planner.md) — this batch must not edit that screen.
 * Compared history reuses the existing compare selection in
 * src/lib/search.ts (COMPARE_KEY '@mqt/compare'); nothing is duplicated.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listCompareSlugs } from './search';

export const RECENTLY_VIEWED_KEY = '@mqt/recently-viewed';
const MAX_VIEWED = 20;

export interface ViewedEntry {
  slug: string;
  viewedAt: string;
}

export async function listViewed(): Promise<ViewedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is ViewedEntry =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as ViewedEntry).slug === 'string' &&
        typeof (v as ViewedEntry).viewedAt === 'string',
    );
  } catch {
    return [];
  }
}

export async function recordViewed(slug: string): Promise<ViewedEntry[]> {
  const next = [
    { slug, viewedAt: new Date().toISOString() },
    ...(await listViewed()).filter((v) => v.slug !== slug),
  ].slice(0, MAX_VIEWED);
  try {
    await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
  return next;
}

export async function clearViewed(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENTLY_VIEWED_KEY);
  } catch {
    // Best-effort only.
  }
}

/** Compared slugs, via the existing compare selection (search.ts). */
export async function listCompared(): Promise<string[]> {
  return listCompareSlugs();
}

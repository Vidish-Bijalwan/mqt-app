/**
 * Personal notes on packages (v2, item 87). Device-local, private.
 * One free-form note per package slug, stored under '@mqt/package-notes'.
 * Editing UI lives in PlannerScreen and TripDetailScreen (this batch's
 * screens). A PackageDetailScreen entry point ("My note") is specified
 * in qa/v2-routes-planner.md for the coordinator to wire, because this
 * batch must not edit PackageDetailScreen itself.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PACKAGE_NOTES_KEY = '@mqt/package-notes';

export interface PackageNote {
  text: string;
  updatedAt: string;
}

async function readAll(): Promise<Record<string, PackageNote>> {
  try {
    const raw = await AsyncStorage.getItem(PACKAGE_NOTES_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Record<string, PackageNote> = {};
    for (const [slug, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as PackageNote).text === 'string'
      ) {
        out[slug] = value as PackageNote;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** '' when no note exists. */
export async function getPackageNote(slug: string): Promise<string> {
  const all = await readAll();
  return all[slug]?.text ?? '';
}

/** Empty text deletes the note. */
export async function setPackageNote(
  slug: string,
  text: string,
): Promise<void> {
  const all = await readAll();
  if (text.trim() === '') {
    delete all[slug];
  } else {
    all[slug] = { text, updatedAt: new Date().toISOString() };
  }
  try {
    await AsyncStorage.setItem(PACKAGE_NOTES_KEY, JSON.stringify(all));
  } catch {
    // Best-effort only.
  }
}

export async function deletePackageNote(slug: string): Promise<void> {
  await setPackageNote(slug, '');
}

/** Slugs that have a note, newest-first by update time. */
export async function listNotedSlugs(): Promise<string[]> {
  const all = await readAll();
  return Object.entries(all)
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
    .map(([slug]) => slug);
}

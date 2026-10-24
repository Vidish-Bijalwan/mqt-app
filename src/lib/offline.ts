/**
 * Offline pack + trip kits (v2, items 151 + 153).
 *
 * HONESTY: the site API routes (PR #251) are UNMERGED, so no live
 * endpoint is assumed to exist. The offline pack is the last-synced
 * catalogue stored device-local, falling back to the bundled catalogue
 * shipped in the app when no sync has ever succeeded. The pack stamp
 * ("last updated") is the sync time the app itself recorded — never a
 * server claim. Trip kits are built ONLY from a real saved trip record
 * plus the real catalogue entry for its package (duration/route/
 * description verbatim); where no catalogue entry exists, the kit says
 * so and points at the team instead of inventing an itinerary. The only
 * contact in a kit is the team's real number — no other emergency
 * number is claimed, because none is verified in the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchCatalog,
  readCachedCatalog,
} from './catalog';
import type { CatalogPackage } from './catalog';
import { packages as bundledPackages } from '../data/packages';
import { CONTACT_PHONE_DISPLAY } from './contact';
import { listTrips } from './trips';
import type { SavedTrip } from './trips';

export const OFFLINE_PACK_KEY = '@mqt/offline-pack';
export const TRIP_KITS_KEY = '@mqt/trip-kits';

export interface OfflinePack {
  packages: CatalogPackage[];
  /** Server-reported updatedAt when the live sync supplied one. */
  updatedAt: string | null;
  /** ISO timestamp this device last synced/stored the pack. */
  syncedAt: string;
  source: 'live' | 'cache' | 'bundled';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Human "last updated" stamp for a pack, or 'Not synced yet'. */
export function formatPackStamp(pack: OfflinePack | null): string {
  if (pack === null) return 'Not synced yet';
  const d = new Date(pack.syncedAt);
  if (Number.isNaN(d.getTime())) return 'Not synced yet';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Read the stored offline pack, or null when none was ever stored. */
export async function readOfflinePack(): Promise<OfflinePack | null> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_PACK_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.packages)) return null;
    const packages = (parsed.packages as unknown[]).filter(
      (p): p is CatalogPackage =>
        isRecord(p) &&
        asString(p.slug) !== '' &&
        asString(p.title) !== '',
    ) as CatalogPackage[];
    if (packages.length === 0) return null;
    const source = asString(parsed.source);
    return {
      packages,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      syncedAt: asString(parsed.syncedAt),
      source:
        source === 'live' || source === 'cache' ? source : 'bundled',
    };
  } catch {
    return null;
  }
}

async function writeOfflinePack(pack: OfflinePack): Promise<void> {
  try {
    await AsyncStorage.setItem(OFFLINE_PACK_KEY, JSON.stringify(pack));
  } catch {
    // Best-effort only.
  }
}

/**
 * Sync the offline pack: live catalogue when reachable, else the
 * cached catalogue, else the bundled catalogue. Always returns a
 * usable pack (the app keeps working offline on bundled fallbacks) and
 * reports whether the sync actually reached the network, so UI copy
 * never claims a live sync that did not happen.
 */
export async function syncOfflinePack(): Promise<{
  pack: OfflinePack;
  online: boolean;
}> {
  try {
    const live = await fetchCatalog();
    const pack: OfflinePack = {
      packages: live.packages,
      updatedAt: live.updatedAt,
      syncedAt: new Date().toISOString(),
      source: 'live',
    };
    await writeOfflinePack(pack);
    return { pack, online: true };
  } catch {
    // Offline (or the unmerged live route): fall through to fallbacks.
  }
  const cached = await readCachedCatalog();
  if (cached !== null) {
    const pack: OfflinePack = {
      packages: cached.packages,
      updatedAt: cached.updatedAt,
      syncedAt: new Date().toISOString(),
      source: 'cache',
    };
    await writeOfflinePack(pack);
    return { pack, online: false };
  }
  const pack: OfflinePack = {
    packages: bundledPackages as CatalogPackage[],
    updatedAt: null,
    syncedAt: new Date().toISOString(),
    source: 'bundled',
  };
  await writeOfflinePack(pack);
  return { pack, online: false };
}

/* ------------------------------ trip kits ------------------------------- */

export interface TripKit {
  ref: string;
  slug: string;
  packageName: string;
  /** ISO timestamp of the saved trip record. */
  date: string;
  travelDate?: string;
  /** Verbatim catalogue facts (duration/route/description) or an
   *  honest "not available" note — never an invented day plan. */
  itinerarySummary: string;
  /** Team contact only — the only verified contact in the app. */
  contacts: { label: string; value: string }[];
  savedAt: string;
}

function buildItinerarySummary(pkg: CatalogPackage | undefined): string {
  if (pkg === undefined) {
    return (
      'Itinerary details for this trip are not stored in the app. ' +
      'Ask the team for the day-wise plan for your booking.'
    );
  }
  const lines: string[] = [];
  if (pkg.duration !== '') lines.push(`Duration: ${pkg.duration}`);
  if (pkg.route !== '') lines.push(`Route: ${pkg.route}`);
  if (pkg.description !== '') lines.push(pkg.description);
  if (lines.length === 0) {
    return (
      'Itinerary details for this trip are not stored in the app. ' +
      'Ask the team for the day-wise plan for your booking.'
    );
  }
  return lines.join('\n');
}

/** Build a kit from a real saved trip + the catalogue (offline pack
 *  first, bundled fallback). Returns null when the trip is unknown. */
export async function buildTripKitForRef(
  ref: string,
): Promise<TripKit | null> {
  const trips = await listTrips();
  const trip: SavedTrip | undefined = trips.find((t) => t.ref === ref);
  if (trip === undefined) return null;
  const pack = await readOfflinePack();
  const packages: CatalogPackage[] =
    pack !== null ? pack.packages : (bundledPackages as CatalogPackage[]);
  const pkg = packages.find((p) => p.slug === trip.slug);
  const kit: TripKit = {
    ref: trip.ref,
    slug: trip.slug,
    packageName: trip.packageName,
    date: trip.date,
    ...(trip.travelDate !== undefined
      ? { travelDate: trip.travelDate }
      : {}),
    itinerarySummary: buildItinerarySummary(pkg),
    contacts: [
      { label: 'My Quick Trippers team', value: CONTACT_PHONE_DISPLAY },
    ],
    savedAt: new Date().toISOString(),
  };
  await saveTripKit(kit);
  return kit;
}

function validateTripKit(raw: unknown): TripKit | null {
  if (!isRecord(raw)) return null;
  const ref = asString(raw.ref);
  const packageName = asString(raw.packageName);
  if (ref === '' || packageName === '') return null;
  return {
    ref,
    slug: asString(raw.slug),
    packageName,
    date: asString(raw.date),
    ...(asString(raw.travelDate) !== ''
      ? { travelDate: asString(raw.travelDate) }
      : {}),
    itinerarySummary: asString(raw.itinerarySummary),
    contacts: [{ label: 'My Quick Trippers team', value: CONTACT_PHONE_DISPLAY }],
    savedAt: asString(raw.savedAt),
  };
}

export async function listTripKits(): Promise<TripKit[]> {
  try {
    const raw = await AsyncStorage.getItem(TRIP_KITS_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(validateTripKit)
      .filter((k): k is TripKit => k !== null);
  } catch {
    return [];
  }
}

export async function saveTripKit(kit: TripKit): Promise<void> {
  try {
    const existing = await listTripKits();
    const rest = existing.filter((k) => k.ref !== kit.ref);
    await AsyncStorage.setItem(
      TRIP_KITS_KEY,
      JSON.stringify([kit, ...rest]),
    );
  } catch {
    // Best-effort only.
  }
}

export async function loadTripKit(ref: string): Promise<TripKit | null> {
  const kits = await listTripKits();
  return kits.find((k) => k.ref === ref) ?? null;
}

/** Plain-text kit for the system share sheet. No PDF export: no PDF
 *  library is installed, so PDF export is deferred (see task note). */
export function tripKitShareText(kit: TripKit): string {
  const lines = [
    `Trip kit: ${kit.packageName}`,
    `Booking ref: ${kit.ref}`,
  ];
  if (kit.travelDate !== undefined) {
    lines.push(`Travel date: ${kit.travelDate}`);
  }
  lines.push('', kit.itinerarySummary, '');
  for (const c of kit.contacts) {
    lines.push(`${c.label}: ${c.value}`);
  }
  return lines.join('\n');
}

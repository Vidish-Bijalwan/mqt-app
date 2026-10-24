/**
 * Booking-request draft + summary (v1.3, items 41–50).
 *
 * HONESTY RULE: the business has NO booking engine. Everything here is
 * a booking REQUEST / enquiry sent through the existing submitEnquiry()
 * lead channel. Nothing here invents availability, prices, confirmation
 * numbers, coupons, hotels, or itineraries. Add-ons, price-hold and
 * group terms are REQUESTS the team confirms on callback.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPriceInfo } from './price';
import type { CatalogPackage } from './catalog';
import { SITE_BASE } from './api';

export const BOOKING_DRAFT_KEY = '@mqt/booking-draft';

/** Verified 2026-10-25 from the live sitemap: package pages live at
 *  https://www.myquicktrippers.com/packages/<slug>, and bundled slugs
 *  match sitemap slugs (checked for the Assam package). */
export function packageSiteUrl(slug: string): string {
  return `${SITE_BASE}/packages/${slug}`;
}

/** Item 38: selectable REQUEST options — no prices exist for these. */
export interface AddonOption {
  id: string;
  label: string;
}

export const ADDON_OPTIONS: AddonOption[] = [
  { id: 'extra-nights', label: 'Extra nights' },
  { id: 'private-cab', label: 'Private cab' },
  { id: 'flight-help', label: 'Flight booking help' },
];

export function addonLabel(id: string): string {
  return ADDON_OPTIONS.find((a) => a.id === id)?.label ?? id;
}

export interface BookingTraveler {
  name: string;
  /** Optional user-entered age (saved profiles have no age field). */
  age: string;
  band: 'adult' | 'child';
  /** True when picked from a saved traveler profile. */
  fromSaved?: boolean;
}

export interface BookingDraft {
  step: number;
  slug: string;
  packageName: string;
  preferredDate: string;
  alternateDate: string;
  flexibleMonth: string;
  travelers: BookingTraveler[];
  adults: number;
  children: number;
  infants: number;
  sharing: 'double' | 'triple';
  extraMattress: boolean;
  addons: string[];
  groupMode: boolean;
  groupName: string;
  groupSize: string;
  priceHold: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
}

export function emptyDraft(slug: string, packageName: string): BookingDraft {
  return {
    step: 0,
    slug,
    packageName,
    preferredDate: '',
    alternateDate: '',
    flexibleMonth: '',
    travelers: [],
    adults: 1,
    children: 0,
    infants: 0,
    sharing: 'double',
    extraMattress: false,
    addons: [],
    groupMode: false,
    groupName: '',
    groupSize: '',
    priceHold: false,
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    notes: '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asDraft(raw: unknown): BookingDraft | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.slug !== 'string' || typeof raw.packageName !== 'string') {
    return null;
  }
  const base = emptyDraft(raw.slug, raw.packageName);
  const merged: BookingDraft = { ...base, ...(raw as Partial<BookingDraft>) };
  if (!Array.isArray(merged.travelers)) merged.travelers = [];
  merged.travelers = merged.travelers.filter(
    (t) =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as BookingTraveler).name === 'string',
  );
  if (!Array.isArray(merged.addons)) merged.addons = [];
  if (merged.step < 0 || merged.step > 5) merged.step = 0;
  return merged;
}

export async function loadBookingDraft(
  slug: string,
): Promise<BookingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(BOOKING_DRAFT_KEY);
    if (raw === null) return null;
    const draft = asDraft(JSON.parse(raw) as unknown);
    if (draft === null || draft.slug !== slug) return null;
    return draft;
  } catch {
    return null;
  }
}

export async function saveBookingDraft(draft: BookingDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Draft persistence is best-effort; the flow must never block on it.
  }
}

export async function clearBookingDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BOOKING_DRAFT_KEY);
  } catch {
    // Best-effort only.
  }
}

/** Total travelers from the room counts (infants counted separately). */
export function travelerTotal(draft: BookingDraft): number {
  return draft.adults + draft.children + draft.infants;
}

/**
 * Build the message sent with the enquiry. Every uncertain item is
 * worded as a request for the team to confirm — never as a fact.
 * No computed total price is included: whether the listed price is
 * per person or total is unknown, so the team confirms the final total.
 */
export function buildBookingMessage(
  draft: BookingDraft,
  listedPrice: string,
): string {
  const lines: string[] = [
    'Booking request (via app — please confirm; not a confirmed booking).',
    `Package: ${draft.packageName}`,
  ];
  if (listedPrice !== '') lines.push(`Price as listed: ${listedPrice}`);
  const dates: string[] = [];
  if (draft.preferredDate !== '') {
    dates.push(`Preferred date: ${draft.preferredDate}`);
  }
  if (draft.alternateDate !== '') {
    dates.push(`Alternate date: ${draft.alternateDate}`);
  }
  if (draft.flexibleMonth !== '') {
    dates.push(`Flexible month: ${draft.flexibleMonth}`);
  }
  if (dates.length > 0) {
    lines.push(
      'Preferred dates (request — confirmed departures are shared by the team):',
      ...dates,
    );
  }
  lines.push(
    `Rooms: ${draft.adults} adult(s), ${draft.children} child(ren), ${draft.infants} infant(s); ` +
      `${draft.sharing} sharing` +
      (draft.extraMattress ? '; extra mattress requested' : ''),
  );
  if (draft.travelers.length > 0) {
    lines.push(
      'Travelers: ' +
        draft.travelers
          .map(
            (t) =>
              `${t.name} (${t.band}${t.age !== '' ? `, age ${t.age}` : ''})`,
          )
          .join('; '),
    );
  }
  if (draft.groupMode) {
    lines.push(
      'Group booking request (school/corporate): ' +
        `${draft.groupName !== '' ? draft.groupName : 'group'}; ` +
        `${draft.groupSize !== '' ? `${draft.groupSize} travelers` : '10+ travelers'}; ` +
        'per-head pricing requested (not quoted); ' +
        'teacher-free terms to be confirmed by the team on callback.',
    );
  }
  if (draft.addons.length > 0) {
    lines.push(
      'Add-on requests (requests — confirmed by the team): ' +
        draft.addons.map(addonLabel).join(', '),
    );
  }
  if (draft.priceHold) {
    lines.push(
      'Request: please hold this price for 24 hours (request, not a guarantee).',
    );
  }
  lines.push(
    'Discounts and offers: to be confirmed by the team on callback (no coupon code).',
    'Final total: to be confirmed by the team on callback.',
  );
  if (draft.notes.trim() !== '') lines.push(`Notes: ${draft.notes.trim()}`);
  return lines.join('\n');
}

/** Split a "→"-separated route into stops. Stops are NOT days. */
export function routeStops(route: string): string[] {
  return route
    .split('→')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 * Item 39: similar packages — same category first, then price-band
 * proximity (absolute difference of listed deal prices). Unpriced
 * packages are never assigned a price: they sort after priced ones
 * and render as "Price on enquiry".
 */
export function similarPackages(
  packages: CatalogPackage[],
  current: CatalogPackage,
  limit = 8,
): CatalogPackage[] {
  const currentPrice = getPriceInfo(current);
  const scored = packages
    .filter((p) => p.slug !== current.slug)
    .map((p) => {
      const price = getPriceInfo(p);
      const sameCategory = p.category === current.category ? 0 : 1;
      const gap =
        price.hasPrice && currentPrice.hasPrice
          ? Math.abs(price.deal - currentPrice.deal)
          : Number.MAX_SAFE_INTEGER;
      return { pkg: p, sameCategory, gap, priced: price.hasPrice };
    })
    .sort((a, b) => {
      if (a.sameCategory !== b.sameCategory) return a.sameCategory - b.sameCategory;
      if (a.priced !== b.priced) return a.priced ? -1 : 1;
      return a.gap - b.gap;
    });
  return scored.slice(0, limit).map((s) => s.pkg);
}

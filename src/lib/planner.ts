/**
 * Trip planner + trip tools (v2, Category I items 81/82/85/86/190 and
 * Category S items 181–190 support).
 *
 * HONESTY RULES (do not soften these):
 * - A "trip" here is either a user-created plan (named, device-local)
 *   or a real enquiry the user already submitted (SavedTrip, read from
 *   src/lib/trips.ts — never rewritten here). Nothing here invents a
 *   booking, a payment, a driver, a hotel, a pickup point, a permit
 *   rule or an itinerary day.
 * - Package prices come only from the real catalogue via getSearchPrice
 *   (priceInfo on live entries, getPriceInfo() on bundled entries).
 *   A price flagged estimated on the site stays labelled estimated.
 * - The budget estimator (item 82) multiplies the listed package price
 *   by the traveler count ONLY as a labelled assumption — the site
 *   does not state per-traveler vs per-trip in the catalogue — and
 *   flights/extras are user-entered only. No cost is ever invented.
 * - Pickup points, travelers and documents for a saved enquiry are
 *   shown only when the record actually carries them; otherwise the UI
 *   says "to be confirmed with team".
 * - Item 86 share is a TEXT summary via the system Share sheet. PDF
 *   export is deferred (no PDF library is installed); the UI says so.
 * - Item 90 (festival/season calendar) is NOT built here: the repo
 *   holds no structured, verified festival dates (only a notification
 *   preference label mentions festivals), so inventing dates would
 *   break the honesty rule. It stays DEFERRED.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedTrip } from './trips';

/* ------------------------------ trip types ------------------------------ */

/** Item 190: family vs school/corporate tag. No other types are offered. */
export type TripType = 'family' | 'school' | 'corporate';

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  family: 'Family',
  school: 'School',
  corporate: 'Corporate',
};

export interface PlannedTrip {
  id: string;
  name: string;
  type: TripType;
  /** Free-form user note for the whole plan. */
  note: string;
  /** Preferred travel date, YYYY-MM-DD, or '' when unset. */
  travelDate: string;
  /** Traveler names, as entered by the user (may be empty). */
  travelers: string[];
  /** Pickup point ONLY when the user entered one; '' = unknown. */
  pickupPoint: string;
  /** Package slugs in this plan, in added order. */
  packageSlugs: string[];
  /** Ids of the generic checklist items the user ticked off. */
  checkedChecklist: string[];
  createdAt: string;
}

export const PLANNER_TRIPS_KEY = '@mqt/planner-trips';
/** Per-saved-trip metadata (type tag + document notes), keyed by enquiry ref. */
export const TRIP_META_KEY = '@mqt/trip-meta';
/** Per-trip user-entered expenses, keyed by trip key (planner id or enquiry ref). */
export const TRIP_EXPENSES_KEY = '@mqt/trip-expenses';

export interface TripMeta {
  type?: TripType;
  /** User-added note for the documents folder (item 183). */
  docNote?: string;
}

export function emptyPlannedTrip(
  name: string,
  type: TripType,
): PlannedTrip {
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name: name.trim(),
    type,
    note: '',
    travelDate: '',
    travelers: [],
    pickupPoint: '',
    packageSlugs: [],
    checkedChecklist: [],
    createdAt: new Date().toISOString(),
  };
}

function isPlannedTrip(value: unknown): value is PlannedTrip {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as PlannedTrip;
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    (t.type === 'family' || t.type === 'school' || t.type === 'corporate') &&
    Array.isArray(t.packageSlugs)
  );
}

export async function listPlannerTrips(): Promise<PlannedTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(PLANNER_TRIPS_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlannedTrip);
  } catch {
    return [];
  }
}

export async function savePlannerTrip(trip: PlannedTrip): Promise<void> {
  const existing = await listPlannerTrips();
  const next = [
    trip,
    ...existing.filter((t) => t.id !== trip.id),
  ];
  try {
    await AsyncStorage.setItem(PLANNER_TRIPS_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
}

export async function deletePlannerTrip(id: string): Promise<void> {
  const next = (await listPlannerTrips()).filter((t) => t.id !== id);
  try {
    await AsyncStorage.setItem(PLANNER_TRIPS_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
}

export async function getPlannerTrip(
  id: string,
): Promise<PlannedTrip | undefined> {
  return (await listPlannerTrips()).find((t) => t.id === id);
}

/* ------------------------- saved-trip metadata -------------------------- */

async function readTripMeta(): Promise<Record<string, TripMeta>> {
  try {
    const raw = await AsyncStorage.getItem(TRIP_META_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Record<string, TripMeta>;
  } catch {
    return {};
  }
}

export async function getTripMeta(ref: string): Promise<TripMeta> {
  const all = await readTripMeta();
  return all[ref] ?? {};
}

export async function setTripType(
  ref: string,
  type: TripType,
): Promise<void> {
  const all = await readTripMeta();
  all[ref] = { ...(all[ref] ?? {}), type };
  try {
    await AsyncStorage.setItem(TRIP_META_KEY, JSON.stringify(all));
  } catch {
    // Best-effort only.
  }
}

export async function setTripDocNote(
  ref: string,
  docNote: string,
): Promise<void> {
  const all = await readTripMeta();
  all[ref] = { ...(all[ref] ?? {}), docNote };
  try {
    await AsyncStorage.setItem(TRIP_META_KEY, JSON.stringify(all));
  } catch {
    // Best-effort only.
  }
}

/* --------------------------- date helpers (181) ------------------------- */

/** Parse YYYY-MM-DD as a LOCAL date (no UTC shift). Null when invalid. */
export function parseTripDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }
  return date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days from today until the trip date (negative = past). Null when unset/invalid. */
export function daysUntilTrip(
  travelDate: string,
  today: Date = new Date(),
): number | null {
  const date = parseTripDate(travelDate);
  if (date === null) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfDay(date).getTime() - startOfDay(today).getTime()) / msPerDay,
  );
}

export type TripTimeStatus = 'upcoming' | 'today' | 'past' | 'no-date';

export function tripTimeStatus(
  travelDate: string | undefined,
  today: Date = new Date(),
): TripTimeStatus {
  if (travelDate === undefined || travelDate === '') return 'no-date';
  const days = daysUntilTrip(travelDate, today);
  if (days === null) return 'no-date';
  if (days > 0) return 'upcoming';
  if (days === 0) return 'today';
  return 'past';
}

/** Item 186: saved trips whose travelDate has passed. Trips with no date are never "past". */
export function pastTrips(trips: SavedTrip[]): SavedTrip[] {
  return trips.filter(
    (t) => t.travelDate !== undefined && tripTimeStatus(t.travelDate) === 'past',
  );
}

/** Item 181: saved trips that are today or in the future (dated only). */
export function upcomingTrips(trips: SavedTrip[]): SavedTrip[] {
  return trips.filter((t) => {
    if (t.travelDate === undefined) return false;
    const status = tripTimeStatus(t.travelDate);
    return status === 'upcoming' || status === 'today';
  });
}

export function formatTripDate(value: string): string {
  const date = parseTripDate(value);
  if (date === null) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* --------------------- generic checklist (item 85) ---------------------- */

/**
 * GENERIC items only — no per-operator, per-destination or per-permit
 * requirements are stated, because none are published in the repo.
 * Every item is labelled generic in the UI.
 */
export interface ChecklistItem {
  id: string;
  label: string;
  group: 'Documents' | 'Packing' | 'Permits & confirmations';
}

export const GENERIC_CHECKLIST: ChecklistItem[] = [
  { id: 'id-proof', label: 'Valid photo ID for every traveler', group: 'Documents' },
  { id: 'booking-proof', label: 'Enquiry/booking reference saved (screenshot or note)', group: 'Documents' },
  { id: 'tickets', label: 'Travel tickets / boarding details, if booked separately', group: 'Documents' },
  { id: 'medicines', label: 'Personal medicines and prescriptions', group: 'Packing' },
  { id: 'weather-clothing', label: 'Clothing for the destination weather', group: 'Packing' },
  { id: 'chargers', label: 'Chargers and power bank', group: 'Packing' },
  { id: 'permits-confirm', label: 'Permits, if any apply — confirm with the team (no permit rule is stated here)', group: 'Permits & confirmations' },
  { id: 'pickup-confirm', label: 'Pickup point and time — confirm with the team', group: 'Permits & confirmations' },
  { id: 'team-contact', label: 'Team contact number saved on the phone', group: 'Permits & confirmations' },
];

/* --------------------- generic documents list (item 183) ---------------- */

/**
 * Generic requirement list only. Permit info is "confirm with team"
 * unless a real published source exists in the repo — none was found
 * (no permit rules in the catalogue, booking or content libs).
 */
export const GENERIC_DOCUMENTS: string[] = [
  'Photo ID for every traveler (generic requirement — exact ID type to be confirmed with the team).',
  'Enquiry/booking reference for this trip.',
  'Any permits that apply to this destination — confirm with the team; no permit rule is stated here.',
  'Insurance documents, if you hold travel insurance (optional, user-held).',
];

/* ------------------------- budget estimator (82) ------------------------ */

export interface BudgetInput {
  /** One listed package price per package in the plan (deal, ₹). */
  packageDeals: { hasPrice: boolean; deal: number }[];
  travelers: number;
  /** User-entered only. */
  flightCost: number;
  /** User-entered only. */
  extrasCost: number;
}

export interface BudgetResult {
  /** Sum of listed package prices (₹) before traveler multiplication. */
  packagePerTraveler: number;
  /** packagePerTraveler × travelers. */
  packageSubtotal: number;
  flightCost: number;
  extrasCost: number;
  total: number;
  perTraveler: number;
  /** True when any package in the plan has no listed price. */
  hasUnpriced: boolean;
}

export function computeBudget(input: BudgetInput): BudgetResult {
  const travelers = Math.max(1, Math.floor(input.travelers) || 1);
  const packagePerTraveler = input.packageDeals.reduce(
    (sum, p) => sum + (p.hasPrice ? p.deal : 0),
    0,
  );
  const packageSubtotal = packagePerTraveler * travelers;
  const total = packageSubtotal + input.flightCost + input.extrasCost;
  return {
    packagePerTraveler,
    packageSubtotal,
    flightCost: input.flightCost,
    extrasCost: input.extrasCost,
    total,
    perTraveler: total / travelers,
    hasUnpriced: input.packageDeals.some((p) => !p.hasPrice),
  };
}

/** Parse a user-entered ₹ amount; garbage/blank => 0. Never invents. */
export function parseUserAmount(value: string): number {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits === '') return 0;
  const parsed = parseInt(digits, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/* ------------------------------ share text ------------------------------ */

/** Item 86: text summary only. PDF export is deferred — no PDF lib. */
export function buildPlannerShareText(
  trip: PlannedTrip,
  packageLines: string[],
): string {
  const lines = [
    `Trip plan: ${trip.name} (${TRIP_TYPE_LABELS[trip.type]})`,
    trip.travelDate !== ''
      ? `Preferred travel date: ${formatTripDate(trip.travelDate)}`
      : 'Preferred travel date: not set yet',
    trip.travelers.length > 0
      ? `Travelers: ${trip.travelers.join(', ')}`
      : null,
    trip.note !== '' ? `Note: ${trip.note}` : null,
    '',
    packageLines.length > 0
      ? `Packages:\n${packageLines.join('\n')}`
      : 'No packages added yet.',
    '',
    'Planned with My Quick Trippers. Prices, pickup points and permits to be confirmed with the team.',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

/**
 * Item 187: text summary, NOT live tracking. The UI must label it so —
 * this app has no live location, driver or vehicle feed.
 */
export function buildTripStatusShareText(
  packageName: string,
  travelDate: string | undefined,
  ref: string | undefined,
  teamPhoneDisplay: string,
): string {
  const lines = [
    `Trip status (text summary — not live tracking): ${packageName}`,
    travelDate !== undefined && travelDate !== ''
      ? `Travel date: ${formatTripDate(travelDate)}`
      : 'Travel date: to be confirmed with the team',
    ref !== undefined ? `Enquiry ref: ${ref}` : null,
    `Team contact: ${teamPhoneDisplay}`,
    'Pickup point and on-trip details to be confirmed with the team.',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

/* --------------------------- expenses (item 185) ------------------------ */

export interface TripExpense {
  id: string;
  /** Planner trip id or saved-trip enquiry ref — the trip this belongs to. */
  tripKey: string;
  label: string;
  /** User-entered ₹ amount (real user data). */
  amount: number;
  addedAt: string;
}

function isTripExpense(value: unknown): value is TripExpense {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as TripExpense;
  return (
    typeof e.id === 'string' &&
    typeof e.tripKey === 'string' &&
    typeof e.label === 'string' &&
    typeof e.amount === 'number'
  );
}

export async function listTripExpenses(
  tripKey: string,
): Promise<TripExpense[]> {
  try {
    const raw = await AsyncStorage.getItem(TRIP_EXPENSES_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTripExpense).filter((e) => e.tripKey === tripKey);
  } catch {
    return [];
  }
}

export async function addTripExpense(
  tripKey: string,
  label: string,
  amount: number,
): Promise<TripExpense[]> {
  const entry: TripExpense = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    tripKey,
    label: label.trim(),
    amount: Math.max(0, Math.floor(amount) || 0),
    addedAt: new Date().toISOString(),
  };
  try {
    const raw = await AsyncStorage.getItem(TRIP_EXPENSES_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    const all = (Array.isArray(parsed) ? parsed : []).filter(isTripExpense);
    await AsyncStorage.setItem(
      TRIP_EXPENSES_KEY,
      JSON.stringify([entry, ...all]),
    );
  } catch {
    // Best-effort only.
  }
  return listTripExpenses(tripKey);
}

export async function deleteTripExpense(
  tripKey: string,
  id: string,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TRIP_EXPENSES_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    const all = (Array.isArray(parsed) ? parsed : []).filter(isTripExpense);
    await AsyncStorage.setItem(
      TRIP_EXPENSES_KEY,
      JSON.stringify(all.filter((e) => e.id !== id)),
    );
  } catch {
    // Best-effort only.
  }
}

export function totalExpenses(expenses: TripExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

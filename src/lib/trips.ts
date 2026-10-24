import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Device-local recent enquiries ("My Trips", v1.1 item 1).
 * Stored only on this device — nothing is invented here: an entry is
 * written only after a real enquiry submission returns a reference
 * (see EnquiryScreen). Sign-in / account sync lands in v1.2.
 */

export interface SavedTrip {
  /** Package slug, as in the bundled catalogue. */
  slug: string;
  packageName: string;
  /** Enquiry reference returned by the server. */
  ref: string;
  /** ISO timestamp of when the enquiry was saved. */
  date: string;
  /** v1.3 (additive): preferred travel date from a booking request,
   *  YYYY-MM-DD. Older entries have no travelDate and stay valid. */
  travelDate?: string;
}

const STORAGE_KEY = '@mqt/trips';
const MAX_TRIPS = 50;

/** Append (or refresh, by ref) one enquiry. Callers treat failures as best-effort. */
export async function saveTrip(trip: SavedTrip): Promise<void> {
  const existing = await listTrips();
  const rest = existing.filter((t) => t.ref !== trip.ref);
  const next = [trip, ...rest].slice(0, MAX_TRIPS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Newest first. Returns [] when nothing is stored or the data is unreadable. */
export async function listTrips(): Promise<SavedTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is SavedTrip =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as SavedTrip).slug === 'string' &&
        typeof (t as SavedTrip).packageName === 'string' &&
        typeof (t as SavedTrip).ref === 'string' &&
        typeof (t as SavedTrip).date === 'string',
    );
  } catch {
    return [];
  }
}

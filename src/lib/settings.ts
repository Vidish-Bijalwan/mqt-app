/**
 * Local settings / profile / traveler storage (v1.2).
 * Everything here lives ONLY on this device (AsyncStorage). Nothing is
 * synced to an account — sign-in is not connected yet (see lib/auth.ts).
 * DataPrivacyScreen's delete uses ALL_LOCAL_KEYS to wipe this data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from './i18n';

export type ThemeChoice = 'light' | 'dark';
export type FontScale = 0.85 | 1 | 1.15 | 1.3;
export type ContactPref = 'whatsapp' | 'sms' | 'call';

export interface NotificationPrefs {
  /** Live gates for LOCAL notifications (v1.3, see lib/notifications.ts):
   *  tripUpdates gates departure reminders, reminders gates price-drop /
   *  booking reminders. `offers` still records intent only — there is no
   *  offer feed yet, so it gates nothing (labelled honestly in UI). */
  tripUpdates: boolean;
  offers: boolean;
  reminders: boolean;
}

/** Quiet hours (v1.3): scheduled local notifications whose delivery
 *  time falls inside the window are shifted past the window end.
 *  Times are local "HH:MM" (24h). A window may wrap midnight
 *  (e.g. 22:00–07:00). */
export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: '22:00',
  end: '07:00',
};

export interface Settings {
  theme: ThemeChoice;
  fontScale: FontScale;
  language: Language;
  notifications: NotificationPrefs;
  /** Quiet hours for scheduled local notifications (v1.3). */
  quietHours: QuietHours;
  /** Preferred contact channel for callbacks/messages. */
  commPref: ContactPref;
  /** True = prefer WhatsApp contact; False = prefer SMS. Kept separate
   *  from commPref so the UI can show both toggles honestly. */
  whatsappPreferred: boolean;
  smsPreferred: boolean;
  callPreferred: boolean;
  /** Low-data preference (recorded; no behaviour change yet). */
  dataSaver: boolean;
  /** Biometric gate for the Account tab (see lib/biometric.ts). */
  biometricEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  fontScale: 1,
  language: 'en',
  notifications: { tripUpdates: true, offers: false, reminders: true },
  quietHours: DEFAULT_QUIET_HOURS,
  commPref: 'whatsapp',
  whatsappPreferred: true,
  smsPreferred: false,
  callPreferred: true,
  dataSaver: false,
  biometricEnabled: false,
};

export interface Profile {
  name: string;
  phone: string;
  email: string;
  homeCity: string;
  travelPreferences: string;
}

export const EMPTY_PROFILE: Profile = {
  name: '',
  phone: '',
  email: '',
  homeCity: '',
  travelPreferences: '',
};

export type TravelerBand = 'adult' | 'child';

export interface Traveler {
  id: string;
  name: string;
  band: TravelerBand;
  relation: string;
}

const SETTINGS_KEY = '@mqt/settings';
const PROFILE_KEY = '@mqt/profile';
const TRAVELERS_KEY = '@mqt/travelers';
const CHAT_DRAFT_KEY = '@mqt/chat-draft';
const TRIPS_KEY = '@mqt/trips';
/** Real cache keys from the v1.2 data layer (catalog/blog/appConfig). */
const CATALOG_CACHE_KEY = '@mqt/catalog';
const BLOG_CACHE_KEY = '@mqt/blogposts';
const APP_CONFIG_CACHE_KEY = '@mqt/appconfig';

/** Every AsyncStorage key this app owns (used by DataPrivacy delete). */
export const ALL_LOCAL_KEYS = [
  SETTINGS_KEY,
  PROFILE_KEY,
  TRAVELERS_KEY,
  CHAT_DRAFT_KEY,
  TRIPS_KEY,
  CATALOG_CACHE_KEY,
  BLOG_CACHE_KEY,
  APP_CONFIG_CACHE_KEY,
  /** v1.3 notification stores (see lib/notifications.ts). */
  '@mqt/notifications',
  '@mqt/price-watch',
  '@mqt/push-token',
  '@mqt/pending-notification-link',
] as const;

export { CHAT_DRAFT_KEY };

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isHHMM(value: unknown): value is string {
  return (
    typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

/** Validate a stored quiet-hours object; fall back to defaults on any
 *  malformed field (never trust hand-edited storage). */
export function normalizeQuietHours(value: unknown): QuietHours {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_QUIET_HOURS;
  }
  const q = value as Partial<QuietHours>;
  return {
    enabled: q.enabled === true,
    start: isHHMM(q.start) ? q.start : DEFAULT_QUIET_HOURS.start,
    end: isHHMM(q.end) ? q.end : DEFAULT_QUIET_HOURS.end,
  };
}

export async function loadSettings(): Promise<Settings> {
  const saved = await readJson<Partial<Settings>>(SETTINGS_KEY);
  if (!saved) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(saved.notifications ?? {}) },
    quietHours: normalizeQuietHours(saved.quietHours),
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadProfile(): Promise<Profile> {
  const saved = await readJson<Partial<Profile>>(PROFILE_KEY);
  return { ...EMPTY_PROFILE, ...(saved ?? {}) };
}

export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function listTravelers(): Promise<Traveler[]> {
  const saved = await readJson<Traveler[]>(TRAVELERS_KEY);
  if (!Array.isArray(saved)) return [];
  return saved.filter(
    (t) =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as Traveler).id === 'string' &&
      typeof (t as Traveler).name === 'string',
  );
}

export async function addTraveler(
  traveler: Omit<Traveler, 'id'>,
): Promise<Traveler[]> {
  const next = [
    ...((await listTravelers()) as Traveler[]),
    { ...traveler, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
  ];
  await AsyncStorage.setItem(TRAVELERS_KEY, JSON.stringify(next));
  return next;
}

export async function updateTraveler(
  id: string,
  patch: Partial<Omit<Traveler, 'id'>>,
): Promise<Traveler[]> {
  const next = (await listTravelers()).map((t) =>
    t.id === id ? { ...t, ...patch } : t,
  );
  await AsyncStorage.setItem(TRAVELERS_KEY, JSON.stringify(next));
  return next;
}

export async function deleteTraveler(id: string): Promise<Traveler[]> {
  const next = (await listTravelers()).filter((t) => t.id !== id);
  await AsyncStorage.setItem(TRAVELERS_KEY, JSON.stringify(next));
  return next;
}

/** Delete every local key this app owns. Already-sent enquiries are NOT
 *  touched — they live in the team's Leads table (see DataPrivacyScreen). */
export async function clearAllLocalData(): Promise<void> {
  const extra = await AsyncStorage.getAllKeys();
  const owned = extra.filter((k) => k.startsWith('@mqt/'));
  await AsyncStorage.multiRemove(Array.from(new Set([...ALL_LOCAL_KEYS, ...owned])));
}

/** Local-data summary for the DataPrivacy export (counts only, no secrets). */
export async function localDataSummary(): Promise<Record<string, unknown>> {
  const [profile, travelers, tripsRaw] = await Promise.all([
    loadProfile(),
    listTravelers(),
    AsyncStorage.getItem(TRIPS_KEY),
  ]);
  let tripCount = 0;
  try {
    const parsed: unknown = tripsRaw ? JSON.parse(tripsRaw) : null;
    tripCount = Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    tripCount = 0;
  }
  return {
    exportedAt: new Date().toISOString(),
    note: 'On-device data only. Already-sent enquiries live in the team Leads table and are not included here.',
    profileStored: Boolean(
      profile.name || profile.phone || profile.email || profile.homeCity,
    ),
    travelerCount: travelers.length,
    savedTripCount: tripCount,
    travelers: travelers.map((t) => ({
      name: t.name,
      band: t.band,
      relation: t.relation,
    })),
  };
}

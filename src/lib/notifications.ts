/**
 * Local notifications + notification centre (v1.3, items 161–170).
 *
 * HONESTY RULES — read before changing anything here:
 * - Every centre entry traces to a real event: a notification the OS
 *   delivered, a notification actually scheduled, or a real catalogue
 *   price comparison. Nothing is ever invented for display.
 * - Remote (Expo) push SENDING is DEFERRED: there is no server route
 *   that sends push and no token store on the server. The client side
 *   (permission flow, Expo push-token retrieval stored locally only,
 *   listeners, badge) is implemented; the token is never sent anywhere
 *   and never logged.
 * - Offer alerts (164), chat replies (165) and festival/season alerts
 *   (169) are DEFERRED: no offer feed, no two-way chat inbox and no
 *   seasonality feed exist, so NOTHING is scheduled for them. The
 *   `offers` preference is recorded and labelled honestly in UI.
 * - On web builds expo-notifications is stubbed: scheduling and badge
 *   calls are no-ops, but the centre (local AsyncStorage entries) still
 *   works. Real-phone delivery verification on the final APK is owed.
 *
 * Preference gates (166):
 * - tripUpdates gates departure reminders (163).
 * - reminders gates price-drop alerts (162) and booking/abandoned
 *   reminders (168/170).
 * - offers gates nothing yet (no feed) — labelled as such in UI.
 * Quiet hours (166) shift any scheduled delivery that falls inside the
 * window to just past the window end (see applyQuietHours).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { loadSettings } from './settings';
import type { QuietHours, Settings } from './settings';

/* ------------------------------------------------------------------ */
/* Storage keys                                                        */
/* ------------------------------------------------------------------ */

export const NOTIFICATIONS_KEY = '@mqt/notifications';
export const PRICE_WATCH_KEY = '@mqt/price-watch';
export const PUSH_TOKEN_KEY = '@mqt/push-token';
const PENDING_LINK_KEY = '@mqt/pending-notification-link';
const TRIPS_STORAGE_KEY = '@mqt/trips';
const BOOKING_DRAFT_KEY = '@mqt/booking-draft';

const IS_WEB = Platform.OS === 'web';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type NotificationKind =
  | 'price-drop'
  | 'reminder'
  | 'booking'
  | 'received'
  | 'scheduled'
  | 'abandoned';

export interface NotificationDeepLink {
  /** Real routes only: 'PackageDetail' | 'Trips' | 'Notifications'. */
  screen: 'PackageDetail' | 'Trips' | 'Notifications';
  slug?: string;
}

export interface NotificationEntry {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** ISO timestamp the entry was created. */
  createdAt: string;
  /** ISO timestamp of a future scheduled delivery, when applicable. */
  scheduledFor?: string;
  read: boolean;
  dismissed: boolean;
  /** Expo local-notification identifier, when one was scheduled. */
  localId?: string;
  deepLink?: NotificationDeepLink;
  /** Booking entries (168) offer the existing WhatsApp follow-up path. */
  whatsappMessage?: string;
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort only; a storage failure must never crash the caller.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/* ------------------------------------------------------------------ */
/* Centre store                                                        */
/* ------------------------------------------------------------------ */

function validateEntry(raw: unknown): NotificationEntry | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const title = asString(raw.title);
  const body = asString(raw.body);
  const createdAt = asString(raw.createdAt);
  const kind = asString(raw.kind);
  if (id === '' || title === '' || createdAt === '') return null;
  if (
    kind !== 'price-drop' &&
    kind !== 'reminder' &&
    kind !== 'booking' &&
    kind !== 'received' &&
    kind !== 'scheduled' &&
    kind !== 'abandoned'
  ) {
    return null;
  }
  const entry: NotificationEntry = {
    id,
    kind: kind as NotificationKind,
    title,
    body,
    createdAt,
    read: raw.read === true,
    dismissed: raw.dismissed === true,
  };
  const scheduledFor = asString(raw.scheduledFor);
  if (scheduledFor !== '') entry.scheduledFor = scheduledFor;
  const localId = asString(raw.localId);
  if (localId !== '') entry.localId = localId;
  if (isRecord(raw.deepLink)) {
    const screen = asString(raw.deepLink.screen);
    if (
      screen === 'PackageDetail' ||
      screen === 'Trips' ||
      screen === 'Notifications'
    ) {
      const slug = asString(raw.deepLink.slug);
      entry.deepLink =
        slug !== ''
          ? { screen: screen as NotificationDeepLink['screen'], slug }
          : { screen: screen as NotificationDeepLink['screen'] };
    }
  }
  const whatsappMessage = asString(raw.whatsappMessage);
  if (whatsappMessage !== '') entry.whatsappMessage = whatsappMessage;
  return entry;
}

/** All stored entries, newest first, including dismissed ones. */
export async function listAllEntries(): Promise<NotificationEntry[]> {
  const raw = await readJson<unknown[]>(NOTIFICATIONS_KEY);
  if (!Array.isArray(raw)) return [];
  const entries = raw
    .map(validateEntry)
    .filter((e): e is NotificationEntry => e !== null);
  entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return entries;
}

/** Visible centre entries: dismissed ones are hidden, never deleted
 *  silently — dismiss only flips the flag. */
export async function listCenterEntries(): Promise<NotificationEntry[]> {
  return (await listAllEntries()).filter((e) => !e.dismissed);
}

export async function addCenterEntry(
  entry: Omit<NotificationEntry, 'id' | 'createdAt' | 'read' | 'dismissed'> & {
    createdAt?: string;
  },
): Promise<NotificationEntry> {
  const full: NotificationEntry = {
    ...entry,
    id: newId('mqt-notif'),
    createdAt: entry.createdAt ?? new Date().toISOString(),
    read: false,
    dismissed: false,
  };
  const existing = await listAllEntries();
  await writeJson(NOTIFICATIONS_KEY, [full, ...existing].slice(0, 200));
  await syncBadge();
  return full;
}

export async function markAllRead(): Promise<void> {
  const entries = await listAllEntries();
  await writeJson(
    NOTIFICATIONS_KEY,
    entries.map((e) => ({ ...e, read: true })),
  );
  await syncBadge();
}

export async function markEntryRead(id: string): Promise<void> {
  const entries = await listAllEntries();
  await writeJson(
    NOTIFICATIONS_KEY,
    entries.map((e) => (e.id === id ? { ...e, read: true } : e)),
  );
  await syncBadge();
}

/** Dismiss hides the entry from the centre and cancels its local
 *  notification when one was scheduled. */
export async function dismissEntry(id: string): Promise<void> {
  const entries = await listAllEntries();
  const target = entries.find((e) => e.id === id);
  if (target?.localId) await cancelLocalNotification(target.localId);
  await writeJson(
    NOTIFICATIONS_KEY,
    entries.map((e) => (e.id === id ? { ...e, dismissed: true } : e)),
  );
  await syncBadge();
}

export async function unreadCount(): Promise<number> {
  return (await listCenterEntries()).filter((e) => !e.read).length;
}

/* ------------------------------------------------------------------ */
/* Quiet hours (166)                                                   */
/* ------------------------------------------------------------------ */

function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Shift `date` past the quiet window when it falls inside it. A window
 * that wraps midnight (start > end) covers [start, 24:00) + [00:00, end).
 * Returns the original date when quiet hours are off, the window is
 * empty (start === end), or the time is outside the window. The shift
 * lands exactly on the window end (same day, or next day for a wrapped
 * window's early-morning part).
 */
export function applyQuietHours(date: Date, quiet: QuietHours): Date {
  if (!quiet.enabled) return date;
  const start = hhmmToMinutes(quiet.start);
  const end = hhmmToMinutes(quiet.end);
  if (start === end) return date;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const inside = start < end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
  if (!inside) return date;
  const out = new Date(date);
  out.setHours(Math.floor(end / 60), end % 60, 0, 0);
  // End-of-window today; when that is already past (e.g. 23:30 in a
  // 22:00–07:00 window, whose 07:00 end was this morning), the end is
  // tomorrow. For the early-morning part of a wrapped window (06:30 in
  // 22:00–07:00) today's 07:00 is still ahead, so it stays same-day.
  if (out.getTime() <= date.getTime()) out.setDate(out.getDate() + 1);
  return out;
}

/* ------------------------------------------------------------------ */
/* Expo notification plumbing (161)                                    */
/* ------------------------------------------------------------------ */

// Foreground presentation: show banner + list, no sound, badge handled
// explicitly via syncBadge so the count always matches the centre.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let navigateCallback: ((link: NotificationDeepLink) => void) | null = null;

/** App shell registers its navigator here so a tapped notification can
 *  deep-link. Links are validated to real routes only (see type). */
export function registerNotificationNavigation(
  navigate: (link: NotificationDeepLink) => void,
): void {
  navigateCallback = navigate;
}

async function storePendingLink(link: NotificationDeepLink): Promise<void> {
  await writeJson(PENDING_LINK_KEY, link);
}

/** Consumed by NotificationCenter on focus: a tap that arrived before
 *  navigation was ready. Returns null when nothing is pending. */
export async function consumePendingLink(): Promise<NotificationDeepLink | null> {
  const raw = await readJson<unknown>(PENDING_LINK_KEY);
  await AsyncStorage.removeItem(PENDING_LINK_KEY).catch(() => undefined);
  if (!isRecord(raw)) return null;
  const screen = asString(raw.screen);
  if (
    screen !== 'PackageDetail' &&
    screen !== 'Trips' &&
    screen !== 'Notifications'
  ) {
    return null;
  }
  const slug = asString(raw.slug);
  return slug !== ''
    ? { screen: screen as NotificationDeepLink['screen'], slug }
    : { screen: screen as NotificationDeepLink['screen'] };
}

function deepLinkFromData(data: unknown): NotificationDeepLink | null {
  if (!isRecord(data)) return null;
  const screen = asString(data.screen);
  if (
    screen !== 'PackageDetail' &&
    screen !== 'Trips' &&
    screen !== 'Notifications'
  ) {
    return null;
  }
  const slug = asString(data.slug);
  return slug !== ''
    ? { screen: screen as NotificationDeepLink['screen'], slug }
    : { screen: screen as NotificationDeepLink['screen'] };
}

export async function getPermissionStatus(): Promise<PermissionStatus> {
  if (IS_WEB) return 'undetermined';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/**
 * Explicit permission flow (called from the centre's enable button —
 * never auto-prompted on launch). On Android the channel is created
 * first, as the SDK 58 docs require for the prompt to appear. Returns
 * the final status. When granted, the Expo push token is retrieved and
 * stored locally (see ensurePushToken).
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (IS_WEB) return 'undetermined';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('mqt-default', {
        name: 'My Quick Trippers',
        // SDK 58.1.6 types: AndroidImportance lives in the submodule
        // types and is not re-exported from the package index, so the
        // import/namespace lint rule flags the documented usage.
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus === 'granted') await ensurePushToken();
    return finalStatus === 'granted'
      ? 'granted'
      : finalStatus === 'denied'
        ? 'denied'
        : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/**
 * Expo push-token retrieval, client-side only (161). The token is
 * stored under '@mqt/push-token' on this device and NEVER sent to any
 * server (no server token route exists yet) and NEVER logged. Returns
 * null on web, without a project id, on simulator/emulator failure, or
 * when permission is not granted. Safe to call repeatedly — a stored
 * token is returned without re-requesting.
 */
export async function ensurePushToken(): Promise<string | null> {
  if (IS_WEB) return null;
  try {
    const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (stored) return stored;
    if ((await getPermissionStatus()) !== 'granted') return null;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } })
        .easConfig?.projectId;
    if (!projectId) return null;
    const token = (
      await Notifications.getExpoPushTokenAsync({ projectId })
    ).data;
    if (typeof token === 'string' && token !== '') {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

/** Schedule one local notification. Returns its identifier, or null on
 *  web / without permission / on failure. `data` carries only the deep
 *  link (screen + slug) — never personal data. */
export async function scheduleLocalNotification(args: {
  title: string;
  body: string;
  date: Date;
  data?: NotificationDeepLink;
  quietHours?: QuietHours;
}): Promise<string | null> {
  if (IS_WEB) return null;
  try {
    if ((await getPermissionStatus()) !== 'granted') return null;
    const when = args.quietHours
      ? applyQuietHours(args.date, args.quietHours)
      : args.date;
    if (when.getTime() <= Date.now()) return null;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: args.title,
        body: args.body,
        data: (args.data ?? {}) as Record<string, unknown>,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
  } catch {
    return null;
  }
}

/** Present a local notification immediately (used for price drops and
 *  the one-time abandoned-draft nudge, which are discovered in-app). */
export async function presentLocalNotification(args: {
  title: string;
  body: string;
  data?: NotificationDeepLink;
}): Promise<string | null> {
  if (IS_WEB) return null;
  try {
    if ((await getPermissionStatus()) !== 'granted') return null;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: args.title,
        body: args.body,
        data: (args.data ?? {}) as Record<string, unknown>,
      },
      trigger: null,
    });
  } catch {
    return null;
  }
}

export async function cancelLocalNotification(id: string): Promise<void> {
  if (IS_WEB) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered or unknown — nothing to cancel.
  }
}

export async function syncBadge(): Promise<void> {
  if (IS_WEB) return;
  try {
    await Notifications.setBadgeCountAsync(await unreadCount());
  } catch {
    // Badge unsupported on this device — the centre count is truth.
  }
}

/**
 * Wire listeners + badge sync. Called once from the app shell. The
 * received listener records every delivered notification as a centre
 * entry (kind 'received') — the only way a 'received' entry is created.
 * The response listener deep-links when navigation is registered, and
 * otherwise stores a pending link for the centre to consume.
 */
export function initNotifications(): () => void {
  const received = Notifications.addNotificationReceivedListener(
    (notification) => {
      const content = notification.request.content;
      const link = deepLinkFromData(content.data);
      void addCenterEntry({
        kind: 'received',
        title: content.title ?? 'Notification',
        body: content.body ?? '',
        ...(link !== null ? { deepLink: link } : {}),
      });
    },
  );
  const response = Notifications.addNotificationResponseReceivedListener(
    (resp) => {
      const link = deepLinkFromData(
        resp.notification.request.content.data,
      );
      if (link === null) return;
      if (navigateCallback !== null) {
        navigateCallback(link);
      } else {
        void storePendingLink(link);
      }
    },
  );
  void syncBadge();
  return () => {
    received.remove();
    response.remove();
  };
}

/* ------------------------------------------------------------------ */
/* Price-drop alerts (162)                                             */
/* ------------------------------------------------------------------ */

/** slug → last-seen price string (the display string, e.g. "₹12,999"). */
export type PriceWatchStore = Record<string, string>;

export async function readPriceWatch(): Promise<PriceWatchStore> {
  const raw = await readJson<unknown>(PRICE_WATCH_KEY);
  if (!isRecord(raw)) return {};
  const out: PriceWatchStore = {};
  for (const [slug, value] of Object.entries(raw)) {
    if (typeof value === 'string' && slug !== '') out[slug] = value;
  }
  return out;
}

/**
 * Sync the watched set (called at integration with the wishlist's
 * slugs — the wishlist module is owned by another builder, so nothing
 * here imports it). Slugs no longer watched are pruned; newly watched
 * slugs start with NO baseline price, so their first sighting only
 * records the price and never alerts (a first sighting is not a drop).
 */
export async function syncWatchedSlugs(slugs: string[]): Promise<void> {
  const store = await readPriceWatch();
  const wanted = new Set(slugs.filter((s) => s !== ''));
  const next: PriceWatchStore = {};
  for (const slug of wanted) {
    if (store[slug] !== undefined) next[slug] = store[slug];
  }
  await writeJson(PRICE_WATCH_KEY, next);
}

export interface PriceSnapshot {
  slug: string;
  title: string;
  /** Current display price string from getPriceInfo()/priceInfo. */
  price: string;
}

function parsePriceNumber(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  if (digits === '') return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export interface PriceDropResult {
  /** Entries created for real drops (empty when none). */
  drops: NotificationEntry[];
  /** Slugs whose baseline was recorded for the first time. */
  baselined: string[];
}

/**
 * Compare the live catalogue against stored prices. A drop is ONLY a
 * numeric decrease of the parsed display price versus the stored one
 * (unparseable strings never alert). Each real drop creates a centre
 * entry (deep link → PackageDetail) and, when the reminders preference
 * is on and permission is granted, presents a local notification. The
 * stored price always advances to the current price, so a drop alerts
 * exactly once. Gated by the `reminders` preference (166): when off,
 * baselines still advance but no entry/notification is created.
 */
export async function detectPriceDrops(
  currentCatalog: PriceSnapshot[],
): Promise<PriceDropResult> {
  const settings = await loadSettings();
  const store = await readPriceWatch();
  const drops: NotificationEntry[] = [];
  const baselined: string[] = [];
  const next: PriceWatchStore = { ...store };
  for (const item of currentCatalog) {
    if (item.slug === '' || item.price === '') continue;
    const previous = store[item.slug];
    if (previous === undefined) {
      // First sighting: record baseline, never alert.
      next[item.slug] = item.price;
      baselined.push(item.slug);
      continue;
    }
    next[item.slug] = item.price;
    if (!settings.notifications.reminders) continue;
    const oldNum = parsePriceNumber(previous);
    const newNum = parsePriceNumber(item.price);
    if (oldNum === null || newNum === null || newNum >= oldNum) continue;
    const link: NotificationDeepLink = {
      screen: 'PackageDetail',
      slug: item.slug,
    };
    const localId = await presentLocalNotification({
      title: `Price drop: ${item.title}`,
      body: `Now ${item.price} (was ${previous}).`,
      data: link,
    });
    drops.push(
      await addCenterEntry({
        kind: 'price-drop',
        title: `Price drop: ${item.title}`,
        body: `Now ${item.price} (was ${previous}).`,
        deepLink: link,
        ...(localId !== null ? { localId } : {}),
      }),
    );
  }
  await writeJson(PRICE_WATCH_KEY, next);
  return { drops, baselined };
}

/**
 * Record a baseline price for a slug without alerting (used when a
 * package is first watched). detectPriceDrops also baselines on first
 * sighting, so this is only needed when the caller wants the baseline
 * recorded before any catalogue comparison runs.
 */
export async function recordPriceBaseline(
  slug: string,
  price: string,
): Promise<void> {
  if (slug === '' || price === '') return;
  const store = await readPriceWatch();
  if (store[slug] === undefined) {
    store[slug] = price;
    await writeJson(PRICE_WATCH_KEY, store);
  }
}

/* ------------------------------------------------------------------ */
/* Departure reminders (163)                                           */
/* ------------------------------------------------------------------ */

/** Fixed morning delivery time for reminders (local time). */
export const REMINDER_HOUR = 9;
export const REMINDER_MINUTE = 0;

function parseTravelDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function reminderDateFor(travel: Date, daysBefore: number): Date {
  const out = new Date(travel);
  out.setDate(out.getDate() - daysBefore);
  out.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  return out;
}

interface SavedTripWithDate {
  slug: string;
  packageName: string;
  ref: string;
  date: string;
  travelDate?: string;
}

/** Read saved trips defensively: another builder is ADDITIVELY adding
 *  an optional travelDate — trips without one get NO reminder. */
async function listTripsWithDate(): Promise<SavedTripWithDate[]> {
  try {
    const raw = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is SavedTripWithDate =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as SavedTripWithDate).slug === 'string' &&
        typeof (t as SavedTripWithDate).packageName === 'string' &&
        typeof (t as SavedTripWithDate).ref === 'string' &&
        typeof (t as SavedTripWithDate).date === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * (Re)schedule departure reminders for every saved trip that HAS a
 * travelDate. 7-day and 1-day reminders at 09:00 local, shifted past
 * quiet hours. Gated by the `tripUpdates` preference (166): when off,
 * all previously scheduled reminders are cancelled and none are set.
 * Previously scheduled mqt reminders are always cancelled first, so
 * re-saving a trip never duplicates. Centre entries (kind 'scheduled')
 * are created for each future reminder; past reminders are skipped.
 * Call after a trip is saved. No-ops for trips without travelDate.
 */
export async function rescheduleTripReminders(): Promise<NotificationEntry[]> {
  const settings: Settings = await loadSettings();
  // Cancel previously scheduled mqt reminders (both native + stale
  // centre entries are reconciled below).
  if (!IS_WEB) {
    try {
      const scheduled =
        await Notifications.getAllScheduledNotificationsAsync();
      for (const req of scheduled) {
        if (req.identifier.startsWith('mqt-reminder-')) {
          await Notifications.cancelScheduledNotificationAsync(
            req.identifier,
          );
        }
      }
    } catch {
      // Scheduling state is best-effort; centre entries still reconcile.
    }
  }
  // Drop all live (non-dismissed) scheduled entries: they are rebuilt
  // identically below for trips that still qualify, so re-saving a
  // trip never duplicates a reminder. Dismissed entries stay dismissed.
  const existing = await listAllEntries();
  await writeJson(
    NOTIFICATIONS_KEY,
    existing.filter((e) => !(e.kind === 'scheduled' && !e.dismissed)),
  );

  if (!settings.notifications.tripUpdates) {
    await syncBadge();
    return [];
  }

  const trips = await listTripsWithDate();
  const created: NotificationEntry[] = [];
  for (const trip of trips) {
    if (typeof trip.travelDate !== 'string') continue;
    const travel = parseTravelDate(trip.travelDate);
    if (travel === null) continue;
    for (const daysBefore of [7, 1]) {
      const rawDate = reminderDateFor(travel, daysBefore);
      const when = applyQuietHours(rawDate, settings.quietHours);
      if (when.getTime() <= Date.now()) continue;
      const title =
        daysBefore === 7
          ? `Your trip is in 7 days: ${trip.packageName}`
          : `Your trip is tomorrow: ${trip.packageName}`;
      const body =
        daysBefore === 7
          ? 'Time to check documents and pack. Tap to view your trips.'
          : 'Your trip departs tomorrow. Tap to view your trips.';
      const link: NotificationDeepLink = { screen: 'Trips' };
      let localId: string | null = null;
      if (!IS_WEB) {
        try {
          if ((await getPermissionStatus()) === 'granted') {
            localId = await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                data: link as unknown as Record<string, unknown>,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: when,
              },
            });
          }
        } catch {
          localId = null;
        }
      }
      created.push(
        await addCenterEntry({
          kind: 'scheduled',
          title,
          body,
          scheduledFor: when.toISOString(),
          deepLink: link,
          ...(localId !== null ? { localId } : {}),
        }),
      );
    }
  }
  return created;
}

/* ------------------------------------------------------------------ */
/* Booking entries + WhatsApp fallback (168)                           */
/* ------------------------------------------------------------------ */

/**
 * Centre entry for a real booking/enquiry request. Critical updates
 * arrive via the EXISTING WhatsApp follow-up path — this does not
 * create a new SMS system. The screen renders a WhatsApp action from
 * `whatsappMessage` for these entries.
 */
export async function addBookingEntry(args: {
  ref: string;
  packageName: string;
  status: string;
}): Promise<NotificationEntry> {
  return addCenterEntry({
    kind: 'booking',
    title: `Booking update: ${args.packageName}`,
    body: `${args.status} (ref ${args.ref}). The team follows up on WhatsApp for critical updates.`,
    deepLink: { screen: 'Trips' },
    whatsappMessage: `Hi My Quick Trippers! I have a question about my booking (ref ${args.ref}) for "${args.packageName}".`,
  });
}

/* ------------------------------------------------------------------ */
/* Abandoned-enquiry reminder (170)                                    */
/* ------------------------------------------------------------------ */

export interface BookingDraft {
  /** ISO timestamp the draft was last saved. */
  savedAt?: string;
  createdAt?: string;
  /** Set once the one-time reminder has fired. */
  reminded?: boolean;
  slug?: string;
  packageName?: string;
}

async function readBookingDraft(): Promise<{
  draft: BookingDraft;
  raw: Record<string, unknown>;
} | null> {
  try {
    const rawText = await AsyncStorage.getItem(BOOKING_DRAFT_KEY);
    if (rawText === null) return null;
    const parsed: unknown = JSON.parse(rawText);
    if (!isRecord(parsed)) return null;
    return { draft: parsed as BookingDraft, raw: parsed };
  } catch {
    return null;
  }
}

export type AbandonedCheckResult =
  | 'no-draft'
  | 'too-recent'
  | 'already-reminded'
  | 'reminders-off'
  | 'reminded';

/**
 * ONE-TIME local notification when a booking draft sits unsubmitted for
 * >24h. Fires at most once per draft: the stored `reminded` flag is set
 * when it fires and checked first on every later call. The draft key is
 * owned by another builder and read defensively — a missing or
 * malformed draft simply yields 'no-draft'. Gated by `reminders` (166):
 * when off, nothing fires and the flag is NOT set, so the reminder can
 * still fire once if the preference is later turned on.
 */
export async function checkAbandonedDraft(): Promise<AbandonedCheckResult> {
  const found = await readBookingDraft();
  if (found === null) return 'no-draft';
  const { draft, raw } = found;
  if (draft.reminded === true) return 'already-reminded';
  const savedAt = asString(draft.savedAt) || asString(draft.createdAt);
  const savedMs = savedAt !== '' ? new Date(savedAt).getTime() : NaN;
  if (!Number.isFinite(savedMs)) return 'no-draft';
  if (Date.now() - savedMs <= 24 * 60 * 60 * 1000) return 'too-recent';
  const settings = await loadSettings();
  if (!settings.notifications.reminders) return 'reminders-off';
  const packageName = asString(draft.packageName);
  const title = 'Your booking enquiry is still waiting';
  const body =
    packageName !== ''
      ? `You started an enquiry for "${packageName}" over a day ago. Tap to pick it up where you left off.`
      : 'You started a booking enquiry over a day ago. Tap to pick it up where you left off.';
  const link: NotificationDeepLink =
    typeof draft.slug === 'string' && draft.slug !== ''
      ? { screen: 'PackageDetail', slug: draft.slug }
      : { screen: 'Notifications' };
  const localId = await presentLocalNotification({
    title,
    body,
    data: link,
  });
  await addCenterEntry({
    kind: 'abandoned',
    title,
    body,
    deepLink: link,
    ...(localId !== null ? { localId } : {}),
  });
  await writeJson(BOOKING_DRAFT_KEY, { ...raw, reminded: true });
  return 'reminded';
}

/**
 * Deferred features (164/165/169) — documented here so no caller can
 * accidentally schedule them. There is no offer feed, no two-way chat
 * inbox, and no seasonality feed, so these schedule NOTHING. The UI
 * states the dependency honestly instead of showing fake alerts.
 */
export const DEFERRED_NOTIFICATION_FEATURES = [
  {
    id: 'offers',
    label: 'Offer alerts',
    reason: 'Offer alerts arrive when the team publishes an offer feed.',
  },
  {
    id: 'chat',
    label: 'Chat reply alerts',
    reason: 'Needs a real two-way chat backend — none exists yet.',
  },
  {
    id: 'festival',
    label: 'Festival / season alerts',
    reason: 'Needs a real seasonality / offer feed — none exists yet.',
  },
] as const;

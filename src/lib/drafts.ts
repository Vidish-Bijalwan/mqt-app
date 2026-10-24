/**
 * Form drafts + offline enquiry queue (v2, items 152 / 156 / 157).
 *
 * One implementation serves both items: a half-filled enquiry form
 * autosaves on every change (156) and, when submission fails, the
 * enquiry is queued device-local and retried later (152). No NetInfo
 * is installed, so "back online" is inferred, never claimed: the queue
 * is retried when the app returns to the foreground (register the
 * listener once in the app shell — coordinator wiring, since App.tsx
 * is not owned by this batch) and on manual retry from the Offline &
 * Diagnostics screen. Rotation/backgrounding cannot lose a draft:
 * every change is written to AsyncStorage immediately, and the form
 * restores from storage on mount — state is never memory-only.
 * Nothing is submitted by this module on its own: flushEnquiryQueue
 * only runs when the caller invokes it (foreground return or a manual
 * retry tap), and it takes the submit function as a parameter.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { EnquiryInput, EnquiryResult } from './api';

export const ENQUIRY_FORM_DRAFT_KEY = '@mqt/enquiry-form-draft';
export const ENQUIRY_QUEUE_KEY = '@mqt/enquiry-queue';
export const BLOG_SEARCH_DRAFT_KEY = '@mqt/blog-search-draft';

/* --------------------------- generic drafts ----------------------------- */

export async function saveFormDraft(
  key: string,
  value: unknown,
): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort: a draft failure must never block typing.
  }
}

export async function loadFormDraft<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function clearFormDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Best-effort only.
  }
}

/* ---------------------- enquiry form draft (156) ------------------------ */

export interface EnquiryFormDraft {
  slug: string;
  packageName: string;
  name: string;
  phone: string;
  email: string;
  travelDate: string;
  travellers: string;
  message: string;
  savedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Autosave a half-filled enquiry form (call on every change). */
export async function saveEnquiryFormDraft(
  draft: Omit<EnquiryFormDraft, 'savedAt'>,
): Promise<void> {
  await saveFormDraft(ENQUIRY_FORM_DRAFT_KEY, {
    ...draft,
    savedAt: new Date().toISOString(),
  });
}

/** Restore a half-filled enquiry form after kill/crash, or null. */
export async function loadEnquiryFormDraft(): Promise<EnquiryFormDraft | null> {
  const raw = await loadFormDraft<unknown>(ENQUIRY_FORM_DRAFT_KEY);
  if (!isRecord(raw)) return null;
  if (asString(raw.slug) === '' || asString(raw.packageName) === '') {
    return null;
  }
  return {
    slug: asString(raw.slug),
    packageName: asString(raw.packageName),
    name: asString(raw.name),
    phone: asString(raw.phone),
    email: asString(raw.email),
    travelDate: asString(raw.travelDate),
    travellers: asString(raw.travellers),
    message: asString(raw.message),
    savedAt: asString(raw.savedAt),
  };
}

export async function clearEnquiryFormDraft(): Promise<void> {
  await clearFormDraft(ENQUIRY_FORM_DRAFT_KEY);
}

/* ---------------------- blog search draft (156/157) --------------------- */

export interface BlogSearchDraft {
  query: string;
  category: string | null;
}

/** Autosave the blog list's search + category (call on every change). */
export async function saveBlogSearchDraft(
  draft: BlogSearchDraft,
): Promise<void> {
  await saveFormDraft(BLOG_SEARCH_DRAFT_KEY, draft);
}

export async function loadBlogSearchDraft(): Promise<BlogSearchDraft | null> {
  const raw = await loadFormDraft<unknown>(BLOG_SEARCH_DRAFT_KEY);
  if (!isRecord(raw)) return null;
  return {
    query: asString(raw.query),
    category:
      typeof raw.category === 'string' && raw.category !== ''
        ? raw.category
        : null,
  };
}

/* ----------------------- offline enquiry queue (152) -------------------- */

export interface QueuedEnquiry {
  id: string;
  input: EnquiryInput;
  /** Server anti-spam field captured when the form first mounted. */
  formRenderedAt: number;
  queuedAt: string;
  attempts: number;
  lastError: string;
}

function validateQueued(raw: unknown): QueuedEnquiry | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (id === '' || !isRecord(raw.input)) return null;
  const input = raw.input;
  if (asString(input.name) === '' || asString(input.phone) === '') {
    return null;
  }
  const name = asString(input.name);
  const phone = asString(input.phone);
  const enquiryInput: EnquiryInput = {
    name,
    phone,
    ...(asString(input.email) !== '' ? { email: asString(input.email) } : {}),
    ...(asString(input.packageSlug) !== ''
      ? { packageSlug: asString(input.packageSlug) }
      : {}),
    ...(asString(input.packageName) !== ''
      ? { packageName: asString(input.packageName) }
      : {}),
    ...(asString(input.travelDate) !== ''
      ? { travelDate: asString(input.travelDate) }
      : {}),
    ...(typeof input.travellers === 'number'
      ? { travellers: input.travellers }
      : {}),
    ...(asString(input.message) !== ''
      ? { message: asString(input.message) }
      : {}),
  };
  return {
    id,
    input: enquiryInput,
    formRenderedAt:
      typeof raw.formRenderedAt === 'number' ? raw.formRenderedAt : 0,
    queuedAt: asString(raw.queuedAt),
    attempts: typeof raw.attempts === 'number' ? raw.attempts : 0,
    lastError: asString(raw.lastError),
  };
}

export async function listQueuedEnquiries(): Promise<QueuedEnquiry[]> {
  try {
    const raw = await AsyncStorage.getItem(ENQUIRY_QUEUE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(validateQueued)
      .filter((q): q is QueuedEnquiry => q !== null);
  } catch {
    return [];
  }
}

/** Queue a failed/unsent enquiry for later retry. Returns its id. */
export async function queueEnquiry(
  input: EnquiryInput,
  formRenderedAt: number,
): Promise<string> {
  const item: QueuedEnquiry = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    input,
    formRenderedAt,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: '',
  };
  const existing = await listQueuedEnquiries();
  try {
    await AsyncStorage.setItem(
      ENQUIRY_QUEUE_KEY,
      JSON.stringify([item, ...existing]),
    );
  } catch {
    // Best-effort only.
  }
  return item.id;
}

export async function removeQueuedEnquiry(id: string): Promise<void> {
  const existing = await listQueuedEnquiries();
  try {
    await AsyncStorage.setItem(
      ENQUIRY_QUEUE_KEY,
      JSON.stringify(existing.filter((q) => q.id !== id)),
    );
  } catch {
    // Best-effort only.
  }
}

export interface FlushResult {
  sent: string[];
  /** ids still queued, with attempts incremented and lastError set. */
  failed: string[];
}

/**
 * Attempt every queued enquiry once with the caller's submit function.
 * Successes are removed from the queue; failures stay queued with an
 * incremented attempt count and the failure message, so the user can
 * retry manually or wait for the next foreground return. This function
 * never invents a success: only a resolved submit removes an item.
 */
export async function flushEnquiryQueue(
  submit: (item: QueuedEnquiry) => Promise<EnquiryResult>,
): Promise<FlushResult> {
  const queued = await listQueuedEnquiries();
  const sent: string[] = [];
  const failed: string[] = [];
  const remaining: QueuedEnquiry[] = [];
  for (const item of queued) {
    try {
      await submit(item);
      sent.push(item.id);
    } catch (err) {
      failed.push(item.id);
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastError:
          err instanceof Error ? err.message.slice(0, 300) : 'Send failed.',
      });
    }
  }
  try {
    await AsyncStorage.setItem(ENQUIRY_QUEUE_KEY, JSON.stringify(remaining));
  } catch {
    // Best-effort only.
  }
  return { sent, failed };
}

/**
 * Retry the queue whenever the app returns to the foreground. Returns
 * an unsubscribe function. NOTE: this is a foreground-return trigger
 * inferred from AppState, NOT a NetInfo connectivity trigger — no
 * NetInfo package is installed, so no such claim is made. The app
 * shell (coordinator wiring) registers this once with a real submit
 * function; the Diagnostics screen offers the same flush manually.
 */
export function registerForegroundFlush(
  flush: () => void,
): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') flush();
  });
  return () => subscription.remove();
}

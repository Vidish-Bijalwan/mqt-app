/**
 * "What's new" trigger (v2, item 206). Version-stamp check only — the
 * coordinator wires this into the launch gate (App.tsx) and navigates
 * to WhatsNewScreen with `sinceVersion` set to the last-seen version.
 *
 * Rules:
 * - Fresh install (no stamp stored): do NOT show the screen; stamp the
 *   current version instead. First-run users get no changelog popup.
 * - Same version as the stamp: do not show.
 * - Older stamp than the running version: show (an update happened).
 * - Newer stamp than the running version (downgrade): do not show, and
 *   do not rewrite the stamp — the next real update still triggers.
 *
 * Storage is device-local ('@mqt/last-seen-version'), best-effort, and
 * holds no PII. No network call is made here; version comparison reuses
 * compareVersions() from appConfig.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { compareVersions } from './appConfig';

export const LAST_SEEN_VERSION_KEY = '@mqt/last-seen-version';

/**
 * Pure decision: should the What's New screen appear for this launch?
 * `lastSeenVersion` is null on a fresh install.
 */
export function shouldShowWhatsNew(
  lastSeenVersion: string | null,
  currentVersion: string,
): boolean {
  if (lastSeenVersion === null || lastSeenVersion === '') return false;
  if (currentVersion === '') return false;
  return compareVersions(lastSeenVersion, currentVersion) < 0;
}

/** Read the stored last-seen version. Null = never stamped. */
export async function loadLastSeenVersion(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);
    return raw === null || raw === '' ? null : raw;
  } catch {
    return null;
  }
}

/** Stamp `version` as seen. Best-effort: storage failure never blocks. */
export async function markWhatsNewSeen(version: string): Promise<void> {
  if (version === '') return;
  try {
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, version);
  } catch {
    // Best-effort only.
  }
}

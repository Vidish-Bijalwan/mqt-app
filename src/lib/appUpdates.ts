/**
 * In-app OTA updates (v2.0.3) — expo-updates, SDK 58.
 *
 * API semantics, verified against the installed expo-updates
 * (~58.0.18) types AND the Expo docs ("Downloading updates"):
 * - checkForUpdateAsync() checks the server WITHOUT downloading.
 *   It resolves { isAvailable, manifest, isRollBackToEmbedded } and
 *   REJECTS in development mode, in Expo Go, and when updates are not
 *   enabled — callers must treat a rejection as "could not check",
 *   never as "up to date".
 * - fetchUpdateAsync() downloads the newest update to local storage.
 *   It resolves { isNew, ... }. The download is NOT applied until
 *   the next cold start OR an explicit reloadAsync().
 * - reloadAsync() reloads the app with the most recently downloaded
 *   update. It is called ONLY from an explicit user tap ("Restart
 *   now") — never automatically, never on launch, never after a
 *   background fetch.
 *
 * No new native dependency: expo-updates was already installed
 * (package.json ~58.0.18) and app.json already points at the EAS
 * Update URL, with runtimeVersion policy appVersion — so an update
 * published for runtime 2.0.2 reaches exactly the v2.0.2 phones
 * this fix targets. A version bump would start a new runtime line
 * and strand them; this module never bumps anything.
 *
 * Web honesty: the expo-updates web module always resolves
 * checkForUpdateAsync() to isAvailable=false and fetchUpdateAsync()
 * to isNew=false, so in the web preview a check reports "up to
 * date" by construction. The real check runs on the installed app
 * build; the Account screen says so in its note.
 */
import { useCallback, useRef, useState } from 'react';
import * as Updates from 'expo-updates';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'downloading'
  | 'ready'
  | 'error';

/** User-safe message for a failed check/download. Never leaks internals. */
const CHECK_FAILED =
  'Could not check for updates. Check your connection and try again.';

export function useUpdateChecker() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  // Guards the launch auto-check (App.tsx) to one attempt per session
  // and keeps a manual tap from racing it: a second concurrent check
  // is ignored, it never cancels the first.
  const busyRef = useRef(false);

  const checkForUpdates = useCallback(async (): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus('checking');
    setError(null);
    try {
      // Development builds cannot check (the API rejects in dev), so
      // report that honestly instead of pretending to be up to date.
      if (__DEV__) {
        setStatus('error');
        setError(
          'Update checks run on the installed app build, not in development.',
        );
        return;
      }
      const check = await Updates.checkForUpdateAsync();
      // isRollBackToEmbedded is also a real pending change: a rollback
      // directive still needs fetch + restart to take effect.
      if (!check.isAvailable && !check.isRollBackToEmbedded) {
        setStatus('up-to-date');
        return;
      }
      setStatus('downloading');
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew || check.isRollBackToEmbedded) {
        // Downloaded, NOT applied: reload happens only on the user's
        // explicit "Restart now" tap (restartNow below).
        setStatus('ready');
      } else {
        setStatus('up-to-date');
      }
    } catch {
      setStatus('error');
      setError(CHECK_FAILED);
    } finally {
      busyRef.current = false;
    }
  }, []);

  const dismissReady = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const restartNow = useCallback(async (): Promise<void> => {
    // The ONLY reloadAsync() call site in the app, and it runs only
    // from an explicit user tap. If reload fails, stay on 'ready' so
    // the user can tap again instead of losing the downloaded update.
    try {
      await Updates.reloadAsync();
    } catch {
      setStatus('ready');
      setError(
        'Could not restart just now. Please try Restart now again.',
      );
    }
  }, []);

  return { status, error, checkForUpdates, dismissReady, restartNow };
}

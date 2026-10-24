# v2 routes spec — new stack screens for the coordinator to wire (items 206, 209)

Status: SPEC ONLY. No navigation file was edited by this batch
(`App.tsx`, `src/navigation/*` untouched). The coordinator adds these
routes; this file is the exact contract. Component files already exist
and typecheck standalone.

## New stack routes

### 1. WhatsNew — "What's new" screen (item 206)

| Field | Value |
|---|---|
| Component | `WhatsNewScreen` from `src/screens/WhatsNewScreen.tsx` |
| Route name (proposed) | `WhatsNew` |
| Params | `{ sinceVersion?: string }` — omit for the full changelog; pass the last-seen version for the post-update view |
| Header title (proposed) | `What's new` |
| Entry point | Launch gate ONLY, via the version-stamp check in `src/lib/whatsNew.ts` (see wiring below). NOT a tab, NOT an Account row — it is a post-update interstitial, not a destination users browse to. |
| Props mapping | `sinceVersion` param → `sinceVersion` prop; `onDone` prop → navigation back / dismiss to the main stack (coordinator's choice; the screen renders no button when `onDone` is omitted) |

Launch-gate wiring (coordinator, in App.tsx — not done here):

```ts
import { loadLastSeenVersion, markWhatsNewSeen, shouldShowWhatsNew } from './src/lib/whatsNew';
import { APP_VERSION } from './src/constants';

// After the maintenance + forced-update gates pass, before/alongside
// the main stack (order with the soft-update nudge is the coordinator's
// call — What's New must never block a forced update or maintenance):
const lastSeen = await loadLastSeenVersion();
if (shouldShowWhatsNew(lastSeen, APP_VERSION)) {
  // navigate to WhatsNew with { sinceVersion: lastSeen }
  // on Done: await markWhatsNewSeen(APP_VERSION), then show the app.
} else if (lastSeen === null) {
  await markWhatsNewSeen(APP_VERSION); // fresh install: stamp, don't show
}
```

Rules the wiring must keep: never show on fresh install; never show
when the stamp equals the running version; never show before the
maintenance/forced-update gates; always stamp after dismissal, or the
screen will reappear on every launch.

### 2. Diagnostics — release-health screen (item 209)

| Field | Value |
|---|---|
| Component | `DiagnosticsScreen` from `src/screens/DiagnosticsScreen.tsx` |
| Route name (proposed) | `Diagnostics` |
| Params | none |
| Header title (proposed) | `Release health` |
| Entry point (proposed) | One row in AccountScreen ("Release health"), added by the coordinator/Account owner — this batch does not edit AccountScreen. Until wired, the screen is reachable only by the temp screenshot harness (reverted). |
| Props | none (the screen loads everything from `src/lib/diagnostics.ts` on mount) |

Startup-time wiring (coordinator, in App.tsx — not done here):

```ts
import { markAppReady } from './src/lib/diagnostics';
// Call exactly once, when the first screen has rendered (e.g. in the
// launch gate's first successful render effect, or via NavigationContainer
// onReady + one frame). Until this call exists, DiagnosticsScreen
// honestly reports startup time as "Not recorded yet".
```

## Already-wired screens (no action — for the coordinator's map)

- `MaintenanceScreen`: NOT a stack route. Rendered by the App.tsx
  launch gate when remote config has `maintenance.enabled` (verified
  end to end this batch, item 207). Props: `{ message, onRetry }`.
- `ForcedUpdateScreen`: NOT a stack route. Same launch gate, on forced
  prompts. No change needed.

## Coordinator follow-ups owned outside this batch

1. AppFlags flag delivery for the home-density experiment (item 208):
   add the experiment flag to `AppFlags` + `parseAppConfig()` in
   `src/lib/appConfig.ts` (e.g. a field carrying the
   `exp_home-card-density` value) so the site can actually drive
   variant B. `src/lib/experiments.ts` already honours the flag the
   moment it arrives; HomeScreen already passes `config.flags`.
2. WhatsNew launch-gate wiring + Diagnostics Account row + markAppReady
   call, per the snippets above.
3. `eas.json` staging-profile diff (qa/v2-rollout-runbook.md §1) and
   `app.json` ios diff (qa/v2-store-readiness.md §4) — both await
   coordinator application; neither was applied here.
4. Navigation types: add `WhatsNew` and `Diagnostics` to
   `RootStackParamList` when wiring (this batch must not edit
   `src/navigation/types.ts`).

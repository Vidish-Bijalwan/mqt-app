# v2 rollout runbook — staged OTA rollouts + instant rollback (item 205)

Status: DOCUMENTATION ONLY. No build was made, no update was published,
and `eas.json` was NOT edited by this batch. The coordinator applies the
diff below and runs the commands. Nothing here is submitted or shipped
by this document.

## 0. What already exists (verified in-repo, do not re-add)

- `app.json` already sets `updates.url` to the EAS project
  (`https://u.expo.dev/61ca1513-a157-469d-913e-e6db82aa9caa`) and
  `runtimeVersion.policy` to `appVersion`. OTA updates therefore only
  ever reach builds with the same app version — a native change (new
  native library, permission, icon/splash, SDK bump) can NEVER be
  delivered by OTA and always needs a new store build.
- `eas.json` already declares build channels `development`, `preview`
  and `production` (one per build profile). No channel rename is needed.
- `expo-updates` (~58.0.18) is already a dependency.

## 1. EXACT eas.json diff for the coordinator to apply

Purpose: add a named soak profile so a production-candidate JS bundle
is exercised on internal devices before any production OTA percentage.
This is the ONLY eas.json change this item needs.

```diff
   "build": {
     "development": {
       "android": {
         "buildType": "apk"
       },
       "developmentClient": true,
       "distribution": "internal",
       "channel": "development"
     },
     "preview": {
       "android": {
         "buildType": "apk"
       },
       "distribution": "internal",
       "channel": "preview"
     },
+    "staging": {
+      "android": {
+        "buildType": "apk"
+      },
+      "distribution": "internal",
+      "channel": "staging"
+    },
     "production": {
       "channel": "production"
     }
   },
```

Notes for the coordinator:

- Channel names are created on first use; after applying the diff, run
  one `eas build --profile staging --platform android` so the `staging`
  channel exists before any OTA targets it.
- Do NOT change `production.channel`, the package name
  (`com.anonymous.mqtapp`), or any contact details in this diff.
- OTA publishes do not use eas.json channels directly: publish with
  `eas update --channel <channel>` (see §2). The build-profile
  `channel` field only decides which channel a fresh install listens to.

## 2. Channels

| Channel | Audience | Used for |
|---|---|---|
| `development` | Dev devices (development client) | In-progress work, never users |
| `preview` | Internal QA devices (internal APK) | QA of release candidates |
| `staging` | Internal soak devices (internal APK) | Production-candidate soak before any production percentage |
| `production` | All installed production builds | Staged percentage releases, then 100% |

## 3. Percentage release procedure (per-update rollout)

Commands (EAS CLI, run from `~/workspace/mqt-app/`; substitute the real
update message):

```bash
# 1. Soak: publish to staging first, verify on internal devices.
eas update --channel staging --message "v2.0.0-rc1: <what changed>"

# 2. Production, staged: start at 10%.
eas update --channel production --rollout-percentage 10 \
  --message "v2.0.0: <what changed>"

# 3. Observe (see §5), then widen. Edit the live rollout percentage:
eas update:edit   # interactive: raise 10 -> 50 -> 100

# 4. At 100%, confirm the rollout is fully out before the next release:
eas channel:view production
eas update:list --branch production
```

Rules:

- Never jump 0 → 100% on a release that changes payments, enquiry
  submission, or the launch gate. Minimum soak: staging verified, then
  10% for at least one full day of real usage, then 50%, then 100%.
- Never publish an OTA for a runtime version that does not match the
  installed builds. Check `runtimeVersion` (app version) first: an OTA
  built for v2.0.0 will not reach v1.3.0 installs, and that is correct
  behaviour, not a bug.
- Every publish message names the version and the change. "Fixes" with
  no version is not an acceptable message.

## 4. One-tap revert procedure (instant rollback)

Rollback reverts JAVASCRIPT/OTA only. It cannot fix a bad native build;
for that, see §6.

Fastest path (interactive, one command, pick the last good update):

```bash
eas update:rollback
```

Deterministic path (when the last-good update group id is known from
`eas update:list --branch production`):

```bash
eas update:republish --group <last-good-update-group-id>
# or, interactively within the branch:
eas update:republish --branch production
```

After either command, verify before announcing anything:

```bash
eas channel:view production
eas update:list --branch production   # the republished group is now latest
```

Then: reopen the app on a production device (fresh launch picks up the
republished update), confirm the broken behaviour is gone, and only
then tell the team the rollback is done. A rollback that nobody
verified on a device is not a completed rollback.

## 5. What to watch during a rollout (release health)

- DiagnosticsScreen (item 209, device-local): startup time, API error
  counts, error log, last sync stamp — check on a device running the
  new update, not from a dashboard that does not exist yet.
- No remote crash dashboard exists yet (Sentry blocked, no DSN — see
  item 209). Until one is configured, rollout health is judged by:
  device checks, enquiry/payment success on the live backend, and
  user reports via WhatsApp/call. Do not claim a crash-free rate that
  no system measured.

## 6. Emergency brakes (when rollback is not enough)

If the bad release is native (crash on launch, broken native payment),
or the OTA itself cannot be fetched:

1. Enable maintenance mode via the site's `/api/app-config`
   (`maintenance.enabled: true` with an honest message). The app's
   launch gate already renders MaintenanceScreen with call/WhatsApp
   fallback — verified end to end in this batch (item 207).
2. If the version must never run again, raise `minSupportedVersion`
   in the same config: the launch gate shows ForcedUpdateScreen with
   WhatsApp/call fallback (never a trap).
3. Ship a corrected native build through the store track (Play staged
   rollout, §7) and only then lift maintenance mode.

## 7. Store staged rollout (separate from OTA percentages)

OTA percentages (§3) control who gets a JS update. A new APK/AAB in
Google Play has its own staged rollout in Play Console (e.g. 10% →
50% → 100% of the track). The two percentages are independent: a 100%
OTA on top of a 10% Play rollout still only reaches the 10% who have
the new native build. Coordinate both numbers on release day; do not
announce "100% rolled out" when only one of them is at 100%.

## 8. Explicitly NOT done by this batch

- No `eas.json` edit, no build, no update published, no channel
  created, no Expo contact. The diff in §1 awaits the coordinator.
- No Play submission, no Apple submission (see qa/v2-store-readiness.md).
